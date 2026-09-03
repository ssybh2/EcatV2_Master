from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECAT_NODE_CPP = (ROOT / "src/soem_wrapper/src/ecat_node.cpp").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


# The 500 Hz sequenced IMU path can only miss an intermediate committed sample
# if either the host stops observing raw PDOs long enough or the slave commits
# samples unexpectedly close together. Instrument the host side without changing
# its scheduling so runtime logs can distinguish those two cases.
require(
    "std::chrono::steady_clock" in ECAT_NODE_CPP,
    "Raw-PDO gap timing must use steady_clock rather than wall/ROS time",
)
require(
    "2000" in ECAT_NODE_CPP and "microseconds" in ECAT_NODE_CPP,
    "Raw-PDO gap diagnostic must use a 2 ms threshold for 500 Hz samples",
)
require(
    "RAW PDO GAP" in ECAT_NODE_CPP,
    "Data loop must emit a distinctive RAW PDO GAP diagnostic",
)
require(
    "wkc" in ECAT_NODE_CPP[ECAT_NODE_CPP.index("RAW PDO GAP") - 300:ECAT_NODE_CPP.index("RAW PDO GAP") + 300],
    "RAW PDO GAP diagnostic should include WKC for transport correlation",
)

print("Raw PDO gap diagnostic regression contract OK")
