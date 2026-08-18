//
// Created by hang on 12/26/25.
//
#include "soem_wrapper/ecat_node.hpp"
#include "soem_wrapper/task_defs.hpp"
#include "soem_wrapper/wrapper.hpp"
#include "soem_wrapper/utils/config_utils.hpp"
#include "soem_wrapper/utils/io_utils.hpp"
#include "soem_wrapper/utils/logger_utils.hpp"

#include <unordered_map>

namespace aim::ecat::task {
    using namespace io::little_endian;
    using namespace utils::config;
    using namespace hipnuc_imu;

    namespace {
        constexpr uint16_t SIX_IMU_PDO_SIZE = 160;
        constexpr uint16_t SIX_IMU_DATA_SIZE = 126;
        constexpr uint16_t SIX_IMU_SEQUENCE_BASE = 126;
        constexpr uint16_t SIX_IMU_INCOMPLETE_BASE = 138;
        constexpr uint16_t CAN1_FIFO_LOST_OFFSET = 150;
        constexpr uint16_t CAN2_FIFO_LOST_OFFSET = 152;
        constexpr uint16_t CAN1_FIFO_FULL_OFFSET = 154;
        constexpr uint16_t CAN2_FIFO_FULL_OFFSET = 156;
        constexpr uint16_t CAN1_READ_ERROR_OFFSET = 158;
        constexpr uint16_t CAN2_READ_ERROR_OFFSET = 159;
        constexpr uint16_t HIPNUC_SAMPLE_SIZE = 21;
        constexpr uint8_t HIPNUC_IMU_COUNT = 6;

        struct SampleSequenceState {
            bool initialized{false};
            uint16_t last_seq{0};
            uint16_t last_incomplete{0};
        };

        struct CanDiagnosticState {
            bool initialized{false};
            uint16_t can1_fifo_lost{0};
            uint16_t can2_fifo_lost{0};
            uint16_t can1_fifo_full{0};
            uint16_t can2_fifo_full{0};
            uint8_t can1_read_error{0};
            uint8_t can2_read_error{0};
        };

        std::unordered_map<const HIPNUC_IMU_CAN *, SampleSequenceState> sequence_states;
        CanDiagnosticState can_diag_state{};

        uint16_t read_diag_u16(const std::shared_ptr<SlaveDevice> &slave_device, const uint16_t offset) {
            int read_offset = offset;
            return read_uint16(slave_device->get_slave_to_master_buf().data(), &read_offset);
        }

        uint8_t read_diag_u8(const std::shared_ptr<SlaveDevice> &slave_device, const uint16_t offset) {
            return slave_device->get_slave_to_master_buf().at(offset);
        }

        void inspect_can_diagnostics(const std::shared_ptr<SlaveDevice> &slave_device) {
            if (slave_device == nullptr || slave_device->get_slave_to_master_buf().size() < SIX_IMU_PDO_SIZE) {
                return;
            }

            const uint16_t can1_lost = read_diag_u16(slave_device, CAN1_FIFO_LOST_OFFSET);
            const uint16_t can2_lost = read_diag_u16(slave_device, CAN2_FIFO_LOST_OFFSET);
            const uint16_t can1_full = read_diag_u16(slave_device, CAN1_FIFO_FULL_OFFSET);
            const uint16_t can2_full = read_diag_u16(slave_device, CAN2_FIFO_FULL_OFFSET);
            const uint8_t can1_read_error = read_diag_u8(slave_device, CAN1_READ_ERROR_OFFSET);
            const uint8_t can2_read_error = read_diag_u8(slave_device, CAN2_READ_ERROR_OFFSET);

            if (!can_diag_state.initialized) {
                can_diag_state.initialized = true;
                can_diag_state.can1_fifo_lost = can1_lost;
                can_diag_state.can2_fifo_lost = can2_lost;
                can_diag_state.can1_fifo_full = can1_full;
                can_diag_state.can2_fifo_full = can2_full;
                can_diag_state.can1_read_error = can1_read_error;
                can_diag_state.can2_read_error = can2_read_error;
                return;
            }

            if (can1_lost != can_diag_state.can1_fifo_lost ||
                can2_lost != can_diag_state.can2_fifo_lost ||
                can1_full != can_diag_state.can1_fifo_full ||
                can2_full != can_diag_state.can2_fifo_full ||
                can1_read_error != can_diag_state.can1_read_error ||
                can2_read_error != can_diag_state.can2_read_error) {
                RCLCPP_WARN_THROTTLE(
                    *logging::get_health_checker_logger(),
                    *get_node()->get_clock(),
                    1000,
                    "6-IMU CAN RX diagnostics changed: CAN1 lost=%u full=%u read_err=%u; CAN2 lost=%u full=%u read_err=%u",
                    can1_lost, can1_full, can1_read_error,
                    can2_lost, can2_full, can2_read_error);
            }

            can_diag_state.can1_fifo_lost = can1_lost;
            can_diag_state.can2_fifo_lost = can2_lost;
            can_diag_state.can1_fifo_full = can1_full;
            can_diag_state.can2_fifo_full = can2_full;
            can_diag_state.can1_read_error = can1_read_error;
            can_diag_state.can2_read_error = can2_read_error;
        }

        bool has_new_6imu_sample(const HIPNUC_IMU_CAN *owner,
                                 const std::shared_ptr<SlaveDevice> &slave_device,
                                 const uint16_t pdoread_offset) {
            if (slave_device == nullptr || slave_device->get_slave_to_master_buf_len() < SIX_IMU_PDO_SIZE) {
                /* Old 80/112-byte slave types do not contain sequence counters. */
                return true;
            }

            if (slave_device->get_slave_to_master_buf().size() < SIX_IMU_PDO_SIZE) {
                return false;
            }

            if ((pdoread_offset % HIPNUC_SAMPLE_SIZE) != 0U) {
                return true;
            }

            const uint16_t imu_index = pdoread_offset / HIPNUC_SAMPLE_SIZE;
            if (imu_index >= HIPNUC_IMU_COUNT) {
                return true;
            }

            const uint16_t sequence_offset = SIX_IMU_SEQUENCE_BASE + imu_index * sizeof(uint16_t);
            const uint16_t incomplete_offset = SIX_IMU_INCOMPLETE_BASE + imu_index * sizeof(uint16_t);

            const uint16_t seq = read_diag_u16(slave_device, sequence_offset);
            const uint16_t incomplete = read_diag_u16(slave_device, incomplete_offset);
            auto &state = sequence_states[owner];

            /* Read global CAN FIFO diagnostics once from the first IMU task. */
            if (imu_index == 0U) {
                inspect_can_diagnostics(slave_device);
            }

            if (!state.initialized) {
                /* Before the first complete P1/P2/P3 sample the slave reports seq=0.
                 * Do not publish an all-zero/stale startup message. */
                if (seq == 0U) {
                    state.last_incomplete = incomplete;
                    return false;
                }
                state.initialized = true;
                state.last_seq = seq;
                state.last_incomplete = incomplete;
                return true;
            }

            if (incomplete != state.last_incomplete) {
                const uint16_t incomplete_delta = static_cast<uint16_t>(incomplete - state.last_incomplete);
                RCLCPP_WARN_THROTTLE(
                    *logging::get_health_checker_logger(),
                    *get_node()->get_clock(),
                    1000,
                    "6-IMU #%u incomplete P1/P2/P3 sample(s): +%u, total(low16)=%u",
                    static_cast<unsigned>(imu_index + 1U),
                    static_cast<unsigned>(incomplete_delta),
                    static_cast<unsigned>(incomplete));
                state.last_incomplete = incomplete;
            }

            if (seq == state.last_seq) {
                return false;
            }

            const uint16_t seq_delta = static_cast<uint16_t>(seq - state.last_seq);
            if (seq_delta > 1U) {
                RCLCPP_WARN_THROTTLE(
                    *logging::get_health_checker_logger(),
                    *get_node()->get_clock(),
                    1000,
                    "6-IMU #%u sample sequence jumped by %u (master did not observe every committed sample)",
                    static_cast<unsigned>(imu_index + 1U),
                    static_cast<unsigned>(seq_delta));
            }

            state.last_seq = seq;
            return true;
        }
    }

    sensor_msgs::msg::Imu HIPNUC_IMU_CAN::sensor_msgs_imu_shared_msg;

    void HIPNUC_IMU_CAN::init_sdo(uint8_t *buf, int *offset, const uint16_t slave_id, const std::string &prefix) {
        auto [sdo_buf, sdo_len] = get_configuration_data()->build_buf(fmt::format("{}sdowrite_", prefix),
                                                                      {
                                                                          "can_inst", "packet1_id", "packet2_id",
                                                                          "packet3_id"
                                                                      });
        memcpy(buf + *offset, sdo_buf, sdo_len);
        *offset += sdo_len;

        load_slave_info(slave_id, prefix);

        conf_frame_name_ = get_field_as<std::string>(
            *get_configuration_data(),
            fmt::format("{}conf_frame_name", prefix),
            "imu_link");

        publisher_ = get_node()->create_publisher<sensor_msgs::msg::Imu>(
            get_field_as<std::string>(
                *get_configuration_data(),
                fmt::format("{}pub_topic", prefix)),
            rclcpp::SensorDataQoS()
        );
    }

    void HIPNUC_IMU_CAN::publish_empty_message() {
        sensor_msgs_imu_shared_msg.header.stamp = rclcpp::Clock().now();
        sensor_msgs_imu_shared_msg.header.frame_id = conf_frame_name_;

        // hipnuc hi92 protocol
        sensor_msgs_imu_shared_msg.orientation.w = 1;
        sensor_msgs_imu_shared_msg.orientation.x = 0;
        sensor_msgs_imu_shared_msg.orientation.y = 0;
        sensor_msgs_imu_shared_msg.orientation.z = 0;

        sensor_msgs_imu_shared_msg.linear_acceleration.x = 0;
        sensor_msgs_imu_shared_msg.linear_acceleration.y = 0;
        sensor_msgs_imu_shared_msg.linear_acceleration.z = 0;

        sensor_msgs_imu_shared_msg.angular_velocity.x = 0;
        sensor_msgs_imu_shared_msg.angular_velocity.y = 0;
        sensor_msgs_imu_shared_msg.angular_velocity.z = 0;

        publisher_->publish(sensor_msgs_imu_shared_msg);
    }

    void HIPNUC_IMU_CAN::read() {
        if (!has_new_6imu_sample(this, slave_device_, pdoread_offset_)) {
            return;
        }

        sensor_msgs_imu_shared_msg.header.stamp = slave_device_->get_current_data_stamp();
        sensor_msgs_imu_shared_msg.header.frame_id = conf_frame_name_;

        int offset = pdoread_offset_;

        // hipnuc hi92 protocol
        sensor_msgs_imu_shared_msg.orientation.w = 0.0001 * read_int16(slave_device_->get_slave_to_master_buf().data(),
                                                                       &offset);
        sensor_msgs_imu_shared_msg.orientation.x = 0.0001 * read_int16(slave_device_->get_slave_to_master_buf().data(),
                                                                       &offset);
        sensor_msgs_imu_shared_msg.orientation.y = 0.0001 * read_int16(slave_device_->get_slave_to_master_buf().data(),
                                                                       &offset);
        sensor_msgs_imu_shared_msg.orientation.z = 0.0001 * read_int16(slave_device_->get_slave_to_master_buf().data(),
                                                                       &offset);

        sensor_msgs_imu_shared_msg.linear_acceleration.x = 0.0048828 * read_int16(
                                                               slave_device_->get_slave_to_master_buf().data(),
                                                               &offset);
        sensor_msgs_imu_shared_msg.linear_acceleration.y = 0.0048828 * read_int16(
                                                               slave_device_->get_slave_to_master_buf().data(),
                                                               &offset);
        sensor_msgs_imu_shared_msg.linear_acceleration.z = 0.0048828 * read_int16(
                                                               slave_device_->get_slave_to_master_buf().data(),
                                                               &offset);

        sensor_msgs_imu_shared_msg.angular_velocity.x = 0.001 * read_int16(
                                                            slave_device_->get_slave_to_master_buf().data(), &offset);
        sensor_msgs_imu_shared_msg.angular_velocity.y = 0.001 * read_int16(
                                                            slave_device_->get_slave_to_master_buf().data(), &offset);
        sensor_msgs_imu_shared_msg.angular_velocity.z = 0.001 * read_int16(
                                                            slave_device_->get_slave_to_master_buf().data(), &offset);

        publisher_->publish(sensor_msgs_imu_shared_msg);
    }
}
