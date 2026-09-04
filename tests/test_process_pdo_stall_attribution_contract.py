from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECAT_NODE_CPP = (ROOT / "src/soem_wrapper/src/ecat_node.cpp").read_text()
ECAT_NODE_HPP = (ROOT / "src/soem_wrapper/include/soem_wrapper/ecat_node.hpp").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


# A long wall-time interval attributed to process_pdo is ambiguous: the realtime
# DATA thread may be waiting for the slave mutex, blocked/preempted while inside
# process_pdo, or actually consuming CPU. Require diagnostics that distinguish
# these cases without changing EtherCAT scheduling behavior.
for field in (
    "process_lock_wait_us",
    "process_body_us",
    "process_body_cpu_us",
):
    require(field in ECAT_NODE_CPP or field in ECAT_NODE_HPP, f"Missing process stall field: {field}")

require(
    "CLOCK_THREAD_CPUTIME_ID" in ECAT_NODE_CPP,
    "Profiler must use the DATA thread CPU clock to distinguish off-CPU time from execution time",
)
require(
    "process_offcpu_us" in ECAT_NODE_CPP,
    "Checker log must expose the estimated off-CPU portion of process_pdo",
)
require(
    "ECAT LOOP STALL" in ECAT_NODE_CPP,
    "Detailed stall report must remain available",
)

print("Process-PDO stall attribution regression contract OK")
