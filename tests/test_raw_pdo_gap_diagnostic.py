from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECAT_NODE_CPP = (ROOT / "src/soem_wrapper/src/ecat_node.cpp").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


# The current ProductCode 0x06 test setup forwards sequenced IMU samples every
# 3 ms (~333.33 Hz). A raw PDO observation gap becomes a direct sample-loss risk
# only once it reaches that configured sample period. Keep the threshold
# configurable so 500 Hz firmware can still select 2000 us when needed.
require(
    "std::chrono::steady_clock" in ECAT_NODE_CPP,
    "Raw-PDO gap timing must use steady_clock rather than wall/ROS time",
)
require(
    "sequenced_imu_period_us" in ECAT_NODE_CPP,
    "Raw-PDO gap sample-risk threshold must be configurable",
)
require(
    "3000" in ECAT_NODE_CPP,
    "333 Hz ProductCode 0x06 setup must default to a 3 ms sample period",
)
require(
    "raw_pdo_gap_us" in ECAT_NODE_CPP and "sequenced_imu_period_us_" in ECAT_NODE_CPP,
    "Raw-PDO gap diagnostic must compare the observed gap with the configured sample period",
)
require(
    "RAW PDO GAP" in ECAT_NODE_CPP,
    "Data loop must retain the distinctive RAW PDO GAP diagnostic",
)
require(
    "wkc" in ECAT_NODE_CPP[ECAT_NODE_CPP.index("RAW PDO GAP") - 400:ECAT_NODE_CPP.index("RAW PDO GAP") + 400],
    "RAW PDO GAP diagnostic should include WKC for transport correlation",
)

print("Raw PDO gap diagnostic regression contract OK")
