//
// Created by hang on 12/26/25.
//
#include "soem_wrapper/ecat_node.hpp"
#include "soem_wrapper/wrapper.hpp"
#include "soem_wrapper/utils/io_utils.hpp"
#include "soem_wrapper/utils/sys_utils.hpp"
#include "soem_wrapper/utils/logger_utils.hpp"
#include "soem_wrapper/utils/config_utils.hpp"

#include "ethercat.h"
#include <time.h>

namespace aim::ecat {
    using namespace aim::utils::config;
    using namespace aim::io::little_endian;
    using namespace std::chrono_literals;

    static std::shared_ptr<EthercatNode> node = nullptr;

    void register_node() {
        node = std::make_shared<EthercatNode>();
    }

    std::shared_ptr<EthercatNode> get_node() {
        return node;
    }

    void destroy_node() {
        node.reset();
    }

    EthercatNode::EthercatNode() : Node("EthercatNode"), running_(true), exiting_(false), exiting_reset_called_(false) {
        RCLCPP_INFO(*logging::get_sys_logger(), "Current version: %s", GIT_HASH);

        this->declare_parameter<std::string>("interface", "enp2s0");
        interface_ = this->get_parameter("interface").as_string();
        RCLCPP_INFO(*logging::get_sys_logger(), "Using interface: %s", interface_.c_str());

        this->declare_parameter<int>("rt_cpu", 6);
        rt_cpu_ = this->get_parameter("rt_cpu").as_int(); // NOLINT
        RCLCPP_INFO(*logging::get_sys_logger(), "Using rt-cpu: %d", rt_cpu_);

        this->declare_parameter<std::string>("non_rt_cpus", "0-5,7-15");
        non_rt_cpus_ = this->get_parameter("non_rt_cpus").as_string();
        RCLCPP_INFO(*logging::get_sys_logger(), "Using non_rt_cpus: %s", non_rt_cpus_.c_str());

        this->declare_parameter<int>("sequenced_imu_period_us", 3000);
        sequenced_imu_period_us_ = this->get_parameter("sequenced_imu_period_us").as_int();
        if (sequenced_imu_period_us_ <= 0) {
            RCLCPP_WARN(*logging::get_sys_logger(),
                        "Invalid sequenced_imu_period_us=%lld, using 3000 us",
                        static_cast<long long>(sequenced_imu_period_us_));
            sequenced_imu_period_us_ = 3000;
        }
        RCLCPP_INFO(*logging::get_sys_logger(),
                    "Using sequenced IMU sample period: %lld us",
                    static_cast<long long>(sequenced_imu_period_us_));

        this->declare_parameter<int>("loop_stall_profile_threshold_us", 5000);
        loop_stall_profile_threshold_us_ = this->get_parameter("loop_stall_profile_threshold_us").as_int();
        if (loop_stall_profile_threshold_us_ <= 0) {
            RCLCPP_WARN(*logging::get_sys_logger(),
                        "Invalid loop_stall_profile_threshold_us=%lld, using 5000 us",
                        static_cast<long long>(loop_stall_profile_threshold_us_));
            loop_stall_profile_threshold_us_ = 5000;
        }
        RCLCPP_INFO(*logging::get_sys_logger(),
                    "Using EtherCAT loop stall profiler threshold: %lld us",
                    static_cast<long long>(loop_stall_profile_threshold_us_));

        this->declare_parameter<std::string>(
            "config_file", "/home/hang/ecat_ws/src/soem_wrapper/config/config.yaml");
        config_file_ = this->get_parameter("config_file").as_string();
        RCLCPP_INFO(*logging::get_cfg_logger(), "Using config_file: %s", config_file_.c_str());
        get_configuration_data()->load_initial_value_from_config(config_file_);
        RCLCPP_INFO(*logging::get_cfg_logger(), "Configuration file loaded");

        register_components();
    }

    EthercatNode::~EthercatNode() {
        running_ = false;
    }

    void EthercatNode::on_shutdown() {
        RCLCPP_INFO(*logging::get_sys_logger(), "Shutting down");

        exiting_ = true;
        // wait until reset command sent
        while (!exiting_reset_called_) {
            rclcpp::sleep_for(std::chrono::milliseconds(10));
        }

        // then wait for another 100ms for slaves to reset actuators
        rclcpp::sleep_for(std::chrono::milliseconds(100));

        RCLCPP_INFO(*logging::get_data_logger(), "Stop data cycle");
        running_ = false;
        if (data_thread_.joinable()) {
            data_thread_.join();
        }
        if (checker_thread_.joinable()) {
            checker_thread_.join();
        }

        ec_slave[0].state = EC_STATE_INIT;
        ec_writestate(0);
        RCLCPP_INFO(*logging::get_sys_logger(), "Init state for all slaves requested");
        ec_close();
    }

    void EthercatNode::record_loop_stall_snapshot(const int64_t scheduler_gap_us,
                                                   const int64_t receive_us,
                                                   const int64_t copy_in_us,
                                                   const int64_t process_pdo_us,
                                                   const int64_t process_lock_wait_us,
                                                   const int64_t process_body_us,
                                                   const int64_t process_body_cpu_us,
                                                   const int64_t copy_out_us,
                                                   const int64_t send_us,
                                                   const int64_t cycle_us,
                                                   const int64_t raw_pdo_gap_us,
                                                   const int observed_wkc) {
        // The realtime thread is the only writer. Publish an odd generation while
        // updating and an even generation once every atomic field is committed.
        // Snapshot writes only happen on an anomalous gap, so seq_cst atomics here
        // avoid a mutex without adding cost to normal EtherCAT cycles.
        const uint64_t current_generation = loop_stall_generation_.load();
        const uint64_t write_generation = (current_generation & ~uint64_t{1}) + 1U;
        loop_stall_generation_.store(write_generation);

        loop_stall_snapshot_.scheduler_gap_us.store(scheduler_gap_us);
        loop_stall_snapshot_.receive_us.store(receive_us);
        loop_stall_snapshot_.copy_in_us.store(copy_in_us);
        loop_stall_snapshot_.process_pdo_us.store(process_pdo_us);
        loop_stall_snapshot_.process_lock_wait_us.store(process_lock_wait_us);
        loop_stall_snapshot_.process_body_us.store(process_body_us);
        loop_stall_snapshot_.process_body_cpu_us.store(process_body_cpu_us);
        loop_stall_snapshot_.copy_out_us.store(copy_out_us);
        loop_stall_snapshot_.send_us.store(send_us);
        loop_stall_snapshot_.cycle_us.store(cycle_us);
        loop_stall_snapshot_.raw_pdo_gap_us.store(raw_pdo_gap_us);
        loop_stall_snapshot_.observed_wkc.store(observed_wkc);

        loop_stall_generation_.store(write_generation + 1U);
    }

    void EthercatNode::datacycle_callback() {
        // set soem_wrapper cpu affinity
        const pthread_t thread_id = pthread_self();
        cpu_set_t cpuset;
        CPU_ZERO(&cpuset);
        CPU_SET(rt_cpu_, &cpuset);
        int result = pthread_setaffinity_np(thread_id, sizeof(cpu_set_t), &cpuset);
        if (result != 0) {
            RCLCPP_ERROR(*logging::get_sys_logger(), "Failed to set CPU affinity");
        }

        // set thread priority
        // 49 to make it less than the nic irq
        sched_param sch_params{};
        sch_params.sched_priority = 49;
        result = pthread_setschedparam(thread_id, SCHED_FIFO, &sch_params);
        if (result != 0) {
            RCLCPP_ERROR(*logging::get_sys_logger(), "Failed to set thread priority.");
        } else {
            RCLCPP_INFO(*logging::get_sys_logger(), "Thread priority set to 49 with SCHED_FIFO");
        }

        // move other threads in this cpu
        utils::sys::move_threads(rt_cpu_, non_rt_cpus_, interface_);
        RCLCPP_INFO(*logging::get_sys_logger(), "move threads finished");

        // bind nic irq to same cpu core
        utils::sys::move_irq(rt_cpu_, interface_);
        RCLCPP_INFO(*logging::get_sys_logger(), "bind irq finished");

        // optimize nic settings
        utils::sys::setup_nic(interface_);
        RCLCPP_INFO(*logging::get_sys_logger(), "setup nic finished");

        bool all_slave_ready = false;
        rclcpp::Time current_time{};
        bool raw_pdo_observation_initialized = false;
        auto last_raw_pdo_observation = std::chrono::steady_clock::now();

        // To explain a receive-to-receive gap, keep the stage durations that
        // happened after the previous receive. On the next receive these values,
        // plus scheduler_gap_us and receive_us, partition the observed raw PDO gap.
        bool previous_cycle_timing_initialized = false;
        int64_t previous_copy_in_us = 0;
        int64_t previous_process_pdo_us = 0;
        int64_t previous_process_lock_wait_us = 0;
        int64_t previous_process_body_us = 0;
        int64_t previous_process_body_cpu_us = -1;
        int64_t previous_copy_out_us = 0;
        int64_t previous_send_us = 0;
        auto previous_send_end = std::chrono::steady_clock::now();

        const auto to_us = [](const auto duration) -> int64_t {
            return std::chrono::duration_cast<std::chrono::microseconds>(duration).count();
        };

        // CLOCK_THREAD_CPUTIME_ID advances only while this DATA thread is actually
        // executing on a CPU. Comparing it with steady-clock wall time separates
        // CPU work from time spent blocked or preempted by higher-priority work.
        const auto thread_cpu_now_us = []() -> int64_t {
            timespec ts{};
            if (clock_gettime(CLOCK_THREAD_CPUTIME_ID, &ts) != 0) {
                return -1;
            }
            return static_cast<int64_t>(ts.tv_sec) * 1000000LL +
                   static_cast<int64_t>(ts.tv_nsec) / 1000LL;
        };

        // all settings updated, mark data cycle as operational
        in_operational_ = true;

        while (running_) {
            const auto loop_entry = std::chrono::steady_clock::now();
            const int64_t scheduler_gap_us = previous_cycle_timing_initialized
                                                 ? to_us(loop_entry - previous_send_end)
                                                 : 0;

            // recv ecat frame
            const auto receive_start = loop_entry;
            wkc_ = ec_receive_processdata(100);
            const auto raw_pdo_observation = std::chrono::steady_clock::now();
            const int64_t receive_us = to_us(raw_pdo_observation - receive_start);

            // ProductCode 0x06 currently forwards sequenced IMU samples every
            // 3 ms (~333 Hz). Keep that period configurable so a 500 Hz setup can
            // select 2000 us without changing source code. No ROS logging is done
            // here: anomalous timing is handed to the non-realtime checker thread.
            int64_t raw_pdo_gap_us = 0;
            if (raw_pdo_observation_initialized) {
                raw_pdo_gap_us = to_us(raw_pdo_observation - last_raw_pdo_observation);

                const bool sample_risk = raw_pdo_gap_us >= sequenced_imu_period_us_;
                const bool detailed_stall = raw_pdo_gap_us >= loop_stall_profile_threshold_us_;
                if (previous_cycle_timing_initialized && (sample_risk || detailed_stall)) {
                    record_loop_stall_snapshot(
                        scheduler_gap_us,
                        receive_us,
                        previous_copy_in_us,
                        previous_process_pdo_us,
                        previous_process_lock_wait_us,
                        previous_process_body_us,
                        previous_process_body_cpu_us,
                        previous_copy_out_us,
                        previous_send_us,
                        raw_pdo_gap_us,
                        raw_pdo_gap_us,
                        wkc_.load());
                }
            }
            last_raw_pdo_observation = raw_pdo_observation;
            raw_pdo_observation_initialized = true;

            // transfer data from ecat stack into buffer managed by ourselves
            const auto copy_in_start = raw_pdo_observation;
            for (const auto &slave: get_slave_devices()) {
                std::lock_guard lock(slave->mtx_);
                slave->receive_from_slave();
            }
            const auto copy_in_end = std::chrono::steady_clock::now();

            const auto process_pdo_start = copy_in_end;
            int64_t process_lock_wait_us = 0;
            int64_t process_body_us = 0;
            int64_t process_body_cpu_us = 0;
            bool process_body_cpu_valid = true;

            // check if all slaves are all ready
            if (!all_slave_ready) {
                // initially true
                bool all_ready = true;
                // check state of all slaves
                for (const auto &slave: get_slave_devices()) {
                    std::lock_guard lock(slave->mtx_);
                    if (*slave->get_slave_status_ptr()
                        < SLAVE_CONFIRM_READY
                        || !slave->is_ready()) {
                        // any one not ready, mark the final result as not ready
                        all_ready = false;
                        break;
                    }
                }
                // if all ready, log ready
                if (all_ready) {
                    all_slave_ready = true;
                    RCLCPP_INFO(*logging::get_data_logger(),
                                "========== All %d slave(s) ready, system started ==========",
                                ec_slavecount);
                }
            }

            // process pdo device by devices. Time mutex acquisition separately from
            // the body, then compare body wall time with per-thread CPU time.
            for (const auto &slave: get_slave_devices()) {
                const auto process_lock_start = std::chrono::steady_clock::now();
                std::unique_lock lock(slave->mtx_);
                const auto process_lock_acquired = std::chrono::steady_clock::now();
                process_lock_wait_us += to_us(process_lock_acquired - process_lock_start);

                const int64_t body_cpu_start_us = thread_cpu_now_us();
                const auto body_start = std::chrono::steady_clock::now();

                if (slave->is_conf_ros_done() != 0 && slave->is_ecat_conf_done() != 0) {
                    // slave report that all args are well-received
                    if (*slave->get_slave_status_ptr() == SLAVE_CONFIRM_READY
                        && !slave->is_ready()) {
                        RCLCPP_INFO(*logging::get_data_logger(), "Slave id=%d confirmed ready", slave->get_index());
                        slave->set_ready(true);
                    }

                    // sending args
                    // master will send arg bytes one by one
                    // slave will send what it receives back to the master
                    // to ensure the data is correct
                    if (*slave->get_master_status_ptr() == MASTER_SENDING_ARGUMENTS
                        && !slave->is_arg_sent()) {
                        slave->send_arg();
                    }

                    // if slave not ready before
                    // but updated to ready in this cycle
                    if (!slave->is_ready()
                        && slave->is_arg_sent()
                        && *slave->get_slave_status_ptr() == SLAVE_READY) {
                        // write initial value for each app
                        // only write in first initialization
                        if (*slave->get_master_status_ptr() != MASTER_READY) {
                            if (slave->get_reconnected_times() == 0) {
                                slave->write_init_values();
                            } else {
                                slave->recover_master_to_slave_buf();
                                RCLCPP_INFO(*logging::get_health_checker_logger(),
                                            "Slave id=%d master to slave buf recovered", slave->get_index());
                            }

                            // after this slave will go into normal working state
                            RCLCPP_INFO(*logging::get_data_logger(),
                                        "Slave id=%d sdo confirmed received", slave->get_index());
                        }

                        *slave->get_master_status_ptr() = MASTER_READY;
                    }

                    // if slave is ready/working
                    if (slave->is_ready()) {
                        current_time = rclcpp::Clock().now();
                        slave->process_pdo(current_time);
                    }
                }

                const auto body_end = std::chrono::steady_clock::now();
                const int64_t body_cpu_end_us = thread_cpu_now_us();
                process_body_us += to_us(body_end - body_start);
                if (body_cpu_start_us >= 0 && body_cpu_end_us >= body_cpu_start_us) {
                    process_body_cpu_us += body_cpu_end_us - body_cpu_start_us;
                } else {
                    process_body_cpu_valid = false;
                }
            }

            // if configuration is finished and exiting
            // then override all tasks with the init value
            // thereby resetting all the actuators in the slave
            if (exiting_ && !exiting_reset_called_) {
                for (const auto &slave: get_slave_devices()) {
                    if (slave->is_arg_sent()) {
                        slave->write_init_values();
                        RCLCPP_INFO(*logging::get_data_logger(), "Slave id=%d exit reset command sent",
                                    slave->get_index());
                    }
                }
                exiting_reset_called_ = true;
            }
            const auto process_pdo_end = std::chrono::steady_clock::now();

            // transfer pdo data from buffer managed by ourselves info ecat stack
            const auto copy_out_start = process_pdo_end;
            for (const auto &slave: get_slave_devices()) {
                std::lock_guard lock(slave->mtx_);
                slave->transfer_to_slave();
            }
            const auto copy_out_end = std::chrono::steady_clock::now();

            // send ecat frame
            const auto send_start = copy_out_end;
            ec_send_processdata();
            const auto send_end = std::chrono::steady_clock::now();

            previous_copy_in_us = to_us(copy_in_end - copy_in_start);
            previous_process_pdo_us = to_us(process_pdo_end - process_pdo_start);
            previous_process_lock_wait_us = process_lock_wait_us;
            previous_process_body_us = process_body_us;
            previous_process_body_cpu_us = process_body_cpu_valid ? process_body_cpu_us : -1;
            previous_copy_out_us = to_us(copy_out_end - copy_out_start);
            previous_send_us = to_us(send_end - send_start);
            previous_send_end = send_end;
            previous_cycle_timing_initialized = true;
        }

        // destroy all publisher and subscriber
        for (const auto &slave: get_slave_devices()) {
            std::lock_guard lock(slave->mtx_);
            slave->cleanup();
        }
        RCLCPP_INFO(*logging::get_data_logger(), "DATA thread exiting...");
    }

    void EthercatNode::state_check_callback() {
        // pre-define var outside the loop
        // to save time and improve perf
        int slave_idx{};
        uint64_t last_reported_loop_stall_generation = 0;

        while (running_ && rclcpp::ok()) {
            report_loop_stall_snapshot(last_reported_loop_stall_generation);

            if (in_operational_ && (wkc_ < expectedWkc_ || ec_group[0].docheckstate)) {
                RCLCPP_WARN_THROTTLE(*logging::get_health_checker_logger(),
                                     *get_clock(),
                                     1500,
                                     "Enter state check, wkc=%d, expected wkc=%d, lastFailed=%d",
                                     wkc_.load(),
                                     expectedWkc_,
                                     ec_group[0].docheckstate);
                ec_group[0].docheckstate = FALSE;
                ec_readstate();

                // ReSharper disable once CppJoinDeclarationAndAssignment
                for (const auto &slave: get_slave_devices()) {
                    slave_idx = slave->get_index();

                    RCLCPP_WARN_THROTTLE(
                        *logging::get_health_checker_logger(),
                        *get_clock(),
                        1500,
                        "Checking slave idx=%d, "
                        "state = %d",
                        slave_idx,
                        ec_slave[slave_idx].state);

                    if (ec_slave[slave_idx].state != EC_STATE_OPERATIONAL) {
                        ec_group[0].docheckstate = TRUE;

                        // reconnected but slave restarted
                        // resend all args
                        if (ec_slave[slave_idx].state == EC_STATE_SAFE_OP
                            && !slave->is_recover_rejected()) {
                            RCLCPP_INFO(*logging::get_health_checker_logger(),
                                        "Slave idx=%d back to safe-op, state to op", slave_idx);
                            {
                                std::lock_guard lock(slave->mtx_);
                                slave->pre_recover();
                            }

                            ec_slave[slave_idx].state = EC_STATE_OPERATIONAL;
                            ec_writestate(slave_idx);
                            ec_statecheck(slave_idx, EC_STATE_OPERATIONAL, EC_TIMEOUTSTATE);
                            RCLCPP_INFO(*logging::get_health_checker_logger(),
                                        "Slave idx=%d back to op, resending sdo", slave_idx);
                        } else if (ec_slave[slave_idx].state == EC_STATE_INIT) {
                            // double check state
                            if (ec_statecheck(slave_idx, EC_STATE_INIT, 1000)) {
                                if (ec_reconfig_slave(slave_idx, 500)) {
                                    // another slave reconnected at the old position
                                    if (slave->is_recover_rejected()) {
                                        RCLCPP_ERROR_THROTTLE(
                                            *logging::get_health_checker_logger(),
                                            *get_clock(),
                                            1500,
                                            "Slave idx=%d connected with different board, recover rejected",
                                            slave_idx);
                                        ec_slave[slave_idx].state = EC_STATE_INIT;
                                        ec_writestate(slave_idx);
                                    } else {
                                        // same slave reconnected
                                        ec_slave[slave_idx].islost = FALSE;
                                        RCLCPP_INFO(*logging::get_health_checker_logger(),
                                                    "Slave idx=%d reconfigured", slave_idx);
                                    }
                                }

                                std::lock_guard lock(slave->mtx_);
                                slave->reset_state();
                            }
                        } else if (!ec_slave[slave_idx].islost) {
                            if (ec_slave[slave_idx].state == EC_STATE_NONE) {
                                RCLCPP_ERROR(*logging::get_health_checker_logger(), "Slave idx=%d lost", slave_idx);
                                ec_slave[slave_idx].islost = TRUE;

                                std::lock_guard lock(slave->mtx_);
                                slave->reset_state();
                                slave->on_connection_lost();
                                slave->backup_master_to_slave_buf();
                            }
                        }
                    }

                    if (ec_slave[slave_idx].islost) {
                        if (ec_slave[slave_idx].state == EC_STATE_NONE) {
                            if (ec_recover_slave(slave_idx, 500)) {
                                ec_slave[slave_idx].islost = FALSE;
                                RCLCPP_INFO(*logging::get_health_checker_logger(), "Slave idx=%d recovered", slave_idx);
                                slave->recover_state();
                            }
                        } else {
                            ec_slave[slave_idx].islost = FALSE;

                            std::lock_guard lock(slave->mtx_);
                            slave->recover_state();
                            RCLCPP_INFO(*logging::get_health_checker_logger(), "Slave idx=%d found", slave_idx);
                        }
                    }
                }
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }

    void EthercatNode::report_loop_stall_snapshot(uint64_t &last_reported_generation) {
        const uint64_t generation_before = loop_stall_generation_.load();
        if (generation_before == 0U ||
            (generation_before & 1U) != 0U ||
            generation_before == last_reported_generation) {
            return;
        }

        const int64_t scheduler_gap_us = loop_stall_snapshot_.scheduler_gap_us.load();
        const int64_t receive_us = loop_stall_snapshot_.receive_us.load();
        const int64_t copy_in_us = loop_stall_snapshot_.copy_in_us.load();
        const int64_t process_pdo_us = loop_stall_snapshot_.process_pdo_us.load();
        const int64_t process_lock_wait_us = loop_stall_snapshot_.process_lock_wait_us.load();
        const int64_t process_body_us = loop_stall_snapshot_.process_body_us.load();
        const int64_t process_body_cpu_us = loop_stall_snapshot_.process_body_cpu_us.load();
        const int64_t copy_out_us = loop_stall_snapshot_.copy_out_us.load();
        const int64_t send_us = loop_stall_snapshot_.send_us.load();
        const int64_t cycle_us = loop_stall_snapshot_.cycle_us.load();
        const int64_t raw_pdo_gap_us = loop_stall_snapshot_.raw_pdo_gap_us.load();
        const int observed_wkc = loop_stall_snapshot_.observed_wkc.load();

        const uint64_t generation_after = loop_stall_generation_.load();
        if (generation_before != generation_after || (generation_after & 1U) != 0U) {
            return;
        }
        last_reported_generation = generation_after;

        if (raw_pdo_gap_us >= sequenced_imu_period_us_) {
            RCLCPP_WARN_THROTTLE(
                *logging::get_health_checker_logger(),
                *get_clock(),
                1000,
                "RAW PDO GAP: %.3f ms between ec_receive_processdata returns; wkc=%d expected=%d",
                static_cast<double>(raw_pdo_gap_us) / 1000.0,
                observed_wkc,
                expectedWkc_);
        }

        if (cycle_us >= loop_stall_profile_threshold_us_) {
            const int64_t accounted_us = scheduler_gap_us + receive_us + copy_in_us +
                                         process_pdo_us + copy_out_us + send_us;
            const int64_t unaccounted_us = cycle_us > accounted_us ? cycle_us - accounted_us : 0;
            const int64_t process_offcpu_us = process_body_cpu_us >= 0
                                                  ? (process_body_us > process_body_cpu_us
                                                         ? process_body_us - process_body_cpu_us
                                                         : 0)
                                                  : -1;

            RCLCPP_WARN(
                *logging::get_health_checker_logger(),
                "ECAT LOOP STALL: cycle=%.3f ms scheduler_gap=%.3f ms receive=%.3f ms "
                "copy_in=%.3f ms process_pdo=%.3f ms process_lock_wait=%.3f ms "
                "process_body=%.3f ms process_body_cpu=%.3f ms process_offcpu=%.3f ms "
                "copy_out=%.3f ms send=%.3f ms unaccounted=%.3f ms "
                "raw_pdo_gap=%.3f ms wkc=%d expected=%d",
                static_cast<double>(cycle_us) / 1000.0,
                static_cast<double>(scheduler_gap_us) / 1000.0,
                static_cast<double>(receive_us) / 1000.0,
                static_cast<double>(copy_in_us) / 1000.0,
                static_cast<double>(process_pdo_us) / 1000.0,
                static_cast<double>(process_lock_wait_us) / 1000.0,
                static_cast<double>(process_body_us) / 1000.0,
                static_cast<double>(process_body_cpu_us) / 1000.0,
                static_cast<double>(process_offcpu_us) / 1000.0,
                static_cast<double>(copy_out_us) / 1000.0,
                static_cast<double>(send_us) / 1000.0,
                static_cast<double>(unaccounted_us) / 1000.0,
                static_cast<double>(raw_pdo_gap_us) / 1000.0,
                observed_wkc,
                expectedWkc_);
        }
    }

    bool EthercatNode::setup_ecat() {
        if (!ec_init(interface_.c_str())) {
            RCLCPP_ERROR(*logging::get_sys_logger(), "No socket connection on %s. \n", interface_.c_str());
            return false;
        }
        RCLCPP_INFO(*logging::get_sys_logger(), "ec_init on %s succeeded.", interface_.c_str());

        if (ec_config_init(FALSE) <= 0) {
            RCLCPP_ERROR(*logging::get_cfg_logger(), "No slaves found!");
            return false;
        }
        RCLCPP_INFO(*logging::get_cfg_logger(), "%d slaves found", ec_slavecount);
        init_slave_devices_vector(ec_slavecount);
        // write back to init state
        for (int i = 1; i <= ec_slavecount; i++) {
            ec_slave[i].state = EC_STATE_INIT;
            ec_writestate(i);
        }
        ec_statecheck(0, EC_STATE_INIT, EC_TIMEOUTSTATE);

        RCLCPP_INFO(*logging::get_cfg_logger(), "all slaves backed to init, restarting mapping");
        const int reconf_slaves = ec_config_init(FALSE);
        RCLCPP_INFO(*logging::get_cfg_logger(), "detected %d slaves", reconf_slaves);
        // setup conf func
        for (int i = 1; i <= ec_slavecount; i++) {
            ec_slave[i].PO2SOconfigx = config_ec_slave;
        }

        // conf io map
        ec_config_map(&IOmap_);
        ec_configdc();

        for (const auto &device: get_slave_devices()) {
            if (!device->init_task_list()) {
                return false;
            }
        }

        // change slave state to op
        RCLCPP_INFO(*logging::get_cfg_logger(), "Slaves mapped, state to SAFE_OP.");
        ec_statecheck(0, EC_STATE_SAFE_OP, EC_TIMEOUTSTATE * 4);

        RCLCPP_INFO(*logging::get_cfg_logger(), "All slaves reached SAFE_OP, state to OP");
        expectedWkc_ = ec_group[0].outputsWKC * 2 + ec_group[0].inputsWKC;

        RCLCPP_INFO(*logging::get_cfg_logger(), "Calculated expected wkc = %d", expectedWkc_);
        ec_slave[0].state = EC_STATE_OPERATIONAL;
        ec_send_processdata();
        ec_receive_processdata(EC_TIMEOUTRET);
        ec_writestate(0);

        // mock data process
        int chk = 50;
        do {
            ec_send_processdata();
            ec_receive_processdata(EC_TIMEOUTRET);
            ec_statecheck(0, EC_STATE_OPERATIONAL, EC_TIMEOUTSTATE * 4);
        } while (chk-- && ec_slave[0].state != EC_STATE_OPERATIONAL);

        // pre-final-op state check
        if (ec_slave[0].state == EC_STATE_OPERATIONAL) {
            RCLCPP_INFO(*logging::get_cfg_logger(), "Operational state reached for all slaves.");
            data_thread_ = std::thread(&EthercatNode::datacycle_callback, this);
            checker_thread_ = std::thread(&EthercatNode::state_check_callback, this);
        }

        return true;
    }

    void EthercatNode::register_components() {
        // deprecated
        // register_module(1, "FlightModule", 16, 40, 001);
        // register_module(2, "MotorModule", 56, 80, 001);
        register_module(3, "H750UniversalModule", 80, 80, 8);
        register_module(4, "H750UniversalModule (Large PDO V.)", 80, 112, 8);
        register_module(5, "H750UniversalModule (6-IMU Large PDO V.)", 80, 160, 8);
        register_module(6, "H750UniversalModule (6-IMU + RC + DSHOT)", 80, 192, 8);
    }

    void EthercatNode::register_module(const uint32_t eep_id,
                                       const std::string &module_name,
                                       const int master_to_slave_buf_len,
                                       const int slave_to_master_buf_len,
                                       const int min_sw_rev) {
        RCLCPP_INFO(*logging::get_wrapper_logger(),
                    "Registered new module, eepid=%d, name=%s, m2slen=%d, s2mlen=%d",
                    eep_id,
                    module_name.c_str(),
                    master_to_slave_buf_len,
                    slave_to_master_buf_len);
        registered_module_names[eep_id] = module_name;
        registered_module_buf_lens[eep_id] =
                std::make_pair(master_to_slave_buf_len, slave_to_master_buf_len);
        registered_module_sw_rev[eep_id] = min_sw_rev;
    }
}
