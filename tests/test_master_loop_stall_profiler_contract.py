from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECAT_NODE_CPP = (ROOT / "src/soem_wrapper/src/ecat_node.cpp").read_text()
ECAT_NODE_HPP = (ROOT / "src/soem_wrapper/include/soem_wrapper/ecat_node.hpp").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


# The realtime EtherCAT data thread must capture where long loop stalls occur
# without doing ROS logging from the SCHED_FIFO path itself. The non-realtime
# checker thread is responsible for reporting the latest coherent snapshot.
require(
    "loop_stall_profile_threshold_us" in ECAT_NODE_CPP,
    "Loop-stall profiler must expose a configurable profiling threshold",
)
require(
    "5000" in ECAT_NODE_CPP,
    "Default detailed profiler threshold must catch >=5 ms stalls, including a 6 ms two-sample miss at 333 Hz",
)
require(
    "record_loop_stall_snapshot" in ECAT_NODE_CPP,
    "Realtime data loop must record a stall timing snapshot",
)
require(
    "report_loop_stall_snapshot" in ECAT_NODE_CPP,
    "Non-realtime checker must report recorded stall snapshots",
)
require(
    "loop_stall_generation_" in ECAT_NODE_HPP,
    "Profiler handoff must use a generation counter rather than a realtime mutex",
)

for field in (
    "scheduler_gap_us",
    "receive_us",
    "copy_in_us",
    "process_pdo_us",
    "copy_out_us",
    "send_us",
    "cycle_us",
    "raw_pdo_gap_us",
):
    require(field in ECAT_NODE_CPP or field in ECAT_NODE_HPP, f"Missing profiler field: {field}")

start = ECAT_NODE_CPP.index("void EthercatNode::datacycle_callback")
checker = ECAT_NODE_CPP.index("void EthercatNode::state_check_callback")
data_cycle_body = ECAT_NODE_CPP[start:checker]
checker_body = ECAT_NODE_CPP[checker:]

require(
    "ECAT LOOP STALL" not in data_cycle_body,
    "SCHED_FIFO data thread must not emit the detailed stall ROS log directly",
)
require(
    "ECAT LOOP STALL" in checker_body,
    "Checker thread must emit the detailed ECAT LOOP STALL diagnostic",
)
require(
    "std::chrono::steady_clock" in data_cycle_body,
    "Stage timing must use steady_clock rather than ROS/wall time",
)

print("Master loop stall profiler regression contract OK")
