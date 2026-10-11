#!/usr/bin/env python3
"""Read-only H750 TIM2/PA0 DShot300 diagnostics; no motor commands are sent.

Run after sourcing ROS2 Humble and install_dshot300_diag/setup.bash.
Topic is SensorDataQoS -> BEST_EFFORT, never default RELIABLE.
"""
import argparse
import time
import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from custom_msgs.msg import ReadDSHOTRpmDiag

COUNTERS = (
    "tx_complete", "capture_calls", "no_start_edge", "edge_overflow",
    "decode_ok", "decode_fail", "total_edges", "no_capture_window"
)


class Monitor(Node):
    def __init__(self, topic):
        super().__init__("dshot300_rx_diag_monitor")
        self.latest = None
        self.create_subscription(ReadDSHOTRpmDiag, topic, self.receive, qos_profile_sensor_data)

    def receive(self, msg):
        self.latest = msg


def snapshot(msg):
    return {name: int(getattr(msg, name)) for name in COUNTERS}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--topic", default="/ecat/sn4653120/app3/rpm_diagnostics")
    parser.add_argument("--duration", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=5.0)
    args = parser.parse_args()
    if args.duration <= 0 or args.interval <= 0:
        parser.error("duration and interval must be positive")
    rclpy.init()
    node = Monitor(args.topic)
    prev = None
    start = time.monotonic()
    next_report = start + args.interval
    print("Listening to", args.topic, "(BEST_EFFORT, read-only)")
    try:
        while time.monotonic() - start < args.duration:
            rclpy.spin_once(node, timeout_sec=0.1)
            now = time.monotonic()
            if now < next_report:
                continue
            next_report = now + args.interval
            if node.latest is None:
                print("No messages: verify the LAB firmware, app18 config and Topic QoS")
                continue
            msg = node.latest
            curr = snapshot(msg)
            if prev is None:
                print("Initial cumulative counters:", curr)
                prev = curr
                continue
            d = {key: (curr[key] - prev[key]) & 0xFFFFFFFF for key in COUNTERS}
            prev = curr
            win = d["capture_calls"]
            pct = (d["decode_ok"] / win * 100.0) if win else 0
            age = "never" if msg.last_ok_age_ms == 0xFFFFFFFF else str(msg.last_ok_age_ms)
            print(
                f"delta TX={d['tx_complete']} windows={win} "
                f"no-start={d['no_start_edge']} no-arm={d['no_capture_window']} "
                f"overflow={d['edge_overflow']} decode-ok={d['decode_ok']} "
                f"decode-fail={d['decode_fail']} edges={d['total_edges']} "
                f"last-edges={msg.last_edge_count} age-ms={age} "
                f"accepted-per-window={pct:.2f}%"
            )
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
