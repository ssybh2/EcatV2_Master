// Opt-in read-only Task 18 H750 DShot300 RX health statistics.
// PDO layout: 10 little-endian uint32 values (40 bytes) in .msg order.
#include "soem_wrapper/ecat_node.hpp"
#include "soem_wrapper/task_defs.hpp"
#include "soem_wrapper/wrapper.hpp"
#include "soem_wrapper/utils/config_utils.hpp"
#include "soem_wrapper/utils/io_utils.hpp"

namespace aim::ecat::task::pwm {
    using namespace io::little_endian;
    using namespace utils::config;

    void DSHOT_RPM_DIAG::init_sdo(uint8_t *buf, int *offset, const uint16_t slave_id,
                                 const std::string &prefix) {
        auto [sdo_buf, sdo_len] = get_configuration_data()->build_buf(
            fmt::format("{}sdowrite_", prefix), {"dshot_id"});
        memcpy(buf + *offset, sdo_buf, sdo_len);
        *offset += sdo_len;
        load_slave_info(slave_id, prefix);
        dshot_id_ = get_field_as<uint8_t>(*get_configuration_data(),
                                          fmt::format("{}sdowrite_dshot_id", prefix));
        publisher_ = get_node()->create_publisher<custom_msgs::msg::ReadDSHOTRpmDiag>(
            get_field_as<std::string>(*get_configuration_data(), fmt::format("{}pub_topic", prefix)),
            rclcpp::SensorDataQoS());
    }

    void DSHOT_RPM_DIAG::publish_empty_message() {
        custom_msgs::msg::ReadDSHOTRpmDiag msg{};
        msg.header.stamp = rclcpp::Clock().now();
        msg.dshot_id = dshot_id_;
        msg.last_ok_age_ms = 0xFFFFFFFFUL;
        publisher_->publish(msg);
    }

    void DSHOT_RPM_DIAG::read() {
        custom_msgs::msg::ReadDSHOTRpmDiag msg{};
        msg.header.stamp = slave_device_->get_current_data_stamp();
        msg.dshot_id = dshot_id_;
        int offset = pdoread_offset_;
        msg.tx_complete = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.capture_calls = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.no_start_edge = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.edge_overflow = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.decode_ok = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.decode_fail = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.total_edges = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.last_edge_count = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.last_ok_age_ms = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        msg.no_capture_window = read_uint32(slave_device_->get_slave_to_master_buf().data(), &offset);
        publisher_->publish(msg);
    }
}
