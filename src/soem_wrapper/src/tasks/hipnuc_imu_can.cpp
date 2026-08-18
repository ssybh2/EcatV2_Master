//
// Created by hang on 12/26/25.
//
#include "soem_wrapper/ecat_node.hpp"
#include "soem_wrapper/task_defs.hpp"
#include "soem_wrapper/wrapper.hpp"
#include "soem_wrapper/utils/config_utils.hpp"
#include "soem_wrapper/utils/io_utils.hpp"

#include <unordered_map>

namespace aim::ecat::task {
    using namespace io::little_endian;
    using namespace utils::config;
    using namespace hipnuc_imu;

    namespace {
        constexpr uint16_t SIX_IMU_PDO_SIZE = 160;
        constexpr uint16_t SIX_IMU_DATA_SIZE = 126;
        constexpr uint16_t HIPNUC_SAMPLE_SIZE = 21;
        constexpr uint8_t HIPNUC_IMU_COUNT = 6;

        struct SampleSequenceState {
            bool initialized{false};
            uint16_t last_seq{0};
        };

        std::unordered_map<const HIPNUC_IMU_CAN *, SampleSequenceState> sequence_states;

        bool has_new_6imu_sample(const HIPNUC_IMU_CAN *owner,
                                 const std::shared_ptr<SlaveDevice> &slave_device,
                                 const uint16_t pdoread_offset) {
            if (slave_device == nullptr || slave_device->get_slave_to_master_buf_len() < SIX_IMU_PDO_SIZE) {
                /* Old 80/112-byte slave types do not contain sequence counters. */
                return true;
            }

            if ((pdoread_offset % HIPNUC_SAMPLE_SIZE) != 0U) {
                return true;
            }

            const uint16_t imu_index = pdoread_offset / HIPNUC_SAMPLE_SIZE;
            if (imu_index >= HIPNUC_IMU_COUNT) {
                return true;
            }

            const uint16_t sequence_offset = SIX_IMU_DATA_SIZE + imu_index * sizeof(uint16_t);
            if (sequence_offset + sizeof(uint16_t) > slave_device->get_slave_to_master_buf().size()) {
                return true;
            }

            int offset = sequence_offset;
            const uint16_t seq = read_uint16(slave_device->get_slave_to_master_buf().data(), &offset);
            auto &state = sequence_states[owner];

            if (!state.initialized) {
                /* Before the first complete P1/P2/P3 sample the slave reports seq=0.
                 * Do not publish an all-zero/stale startup message. */
                if (seq == 0U) {
                    return false;
                }
                state.initialized = true;
                state.last_seq = seq;
                return true;
            }

            if (seq == state.last_seq) {
                return false;
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
