// Optional read-only DShot RPM task; legacy WriteDSHOT is unchanged.
// Wire layout: 4 little-endian uint16 e-period payloads + uint8 valid mask.
// 0xFFF payload is a valid stopped motor (0 eRPM), 0xFFFF = invalid.
#include "soem_wrapper/ecat_node.hpp"
#include "soem_wrapper/task_defs.hpp"
#include "soem_wrapper/wrapper.hpp"
#include "soem_wrapper/utils/config_utils.hpp"
#include "soem_wrapper/utils/io_utils.hpp"

namespace aim::ecat::task {
    using namespace io::little_endian;
    using namespace utils::config;
    using namespace pwm;

    void DSHOT_RPM::init_sdo(uint8_t *buf, int *offset, const uint16_t slave_id,
                             const std::string &prefix) {
        auto [sdo_buf, sdo_len] = get_configuration_data()->build_buf(
            fmt::format("{}sdowrite_", prefix), {"dshot_id"});
        memcpy(buf + *offset, sdo_buf, sdo_len);
        *offset += sdo_len;
        load_slave_info(slave_id, prefix);
        dshot_id_ = get_field_as<uint8_t>(*get_configuration_data(),
                                        fmt::format("{}sdowrite_dshot_id", prefix));
        publisher_ = get_node()->create_publisher<custom_msgs::msg::ReadDSHOTRpm>(
            get_field_as<std::string>(*get_configuration_data(), fmt::format("{}pub_topic", prefix)),
            rclcpp::SensorDataQoS());
    }

    void DSHOT_RPM::publish_empty_message() {
        custom_msgs::msg::ReadDSHOTRpm msg{};
        msg.header.stamp = rclcpp::Clock().now();
        msg.dshot_id = dshot_id_;
        msg.valid_mask = 0;
        publisher_->publish(msg);
    }

    void DSHOT_RPM::read() {
        custom_msgs::msg::ReadDSHOTRpm msg{};
        msg.header.stamp = slave_device_->get_current_data_stamp();
        msg.dshot_id = dshot_id_;
        int offset = pdoread_offset_;
        uint16_t payloads[4]{};
        for (int i = 0; i < 4; ++i) {
            payloads[i] = read_uint16(slave_device_->get_slave_to_master_buf().data(), &offset);
        }
        const uint8_t mask = read_uint8(slave_device_->get_slave_to_master_buf().data(), &offset);
        for (int i = 0; i < 4; ++i) {
            if (!(mask & (1U << i)) || payloads[i] > 0x0FFF) {
                continue;
            }
            const uint16_t value = payloads[i];
            if (value == 0x0FFF) {
                msg.valid_mask |= static_cast<uint8_t>(1U << i);
                continue;  // valid stopped motor
            }
            const uint32_t period = static_cast<uint32_t>(value & 0x01FF) << (value >> 9);
            if (period == 0) {
                continue;
            }
            msg.period_us[i] = static_cast<uint16_t>(period);
            msg.electrical_rpm[i] = (60000000UL + period / 2) / period;
            msg.valid_mask |= static_cast<uint8_t>(1U << i);
        }
        publisher_->publish(msg);
    }
}
