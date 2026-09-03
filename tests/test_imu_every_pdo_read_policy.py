from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TASK_DEFS = (ROOT / "src/soem_wrapper/include/soem_wrapper/task_defs.hpp").read_text()
HIPNUC_CPP = (ROOT / "src/soem_wrapper/src/tasks/hipnuc_imu_can.cpp").read_text()
WRAPPER_CPP = (ROOT / "src/soem_wrapper/src/soem_backend.cpp").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


# Contract 1: read cadence is a per-task policy, defaulting to the legacy
# status-ack cadence so old tasks keep their current behavior.
require(
    "virtual bool read_every_pdo_cycle() const" in TASK_DEFS,
    "TaskWrapper must expose a per-task every-PDO read policy",
)
require(
    "bool read_every_pdo_cycle() const override" in TASK_DEFS,
    "HIPNUC_IMU_CAN must override the every-PDO read policy",
)

# Contract 2: only the 6-IMU Large-PDO layouts (0x05=160B and 0x06=192B)
# opt into every-PDO reads. Older 80/112-byte modules have no sequence
# counters and must stay on the legacy status-ack cadence.
require(
    "get_slave_to_master_buf_len() >= SIX_IMU_PDO_SIZE" in HIPNUC_CPP,
    "HIPNUC every-PDO mode must be gated by the 160-byte sequence-counter PDO layout",
)

# Contract 3: process_pdo must inspect every-PDO tasks before the
# slave_status/master_status latency handshake, while status-ack tasks remain
# inside the handshake path.
start = WRAPPER_CPP.index("void SlaveDevice::process_pdo")
body = WRAPPER_CPP[start:]
ack = body.index("if (slave_status_ == master_status_)")
pre_ack = body[:ack]
post_ack = body[ack:]

require(
    "task->read_every_pdo_cycle()" in pre_ack and "task->read();" in pre_ack,
    "Every-PDO tasks must be read before the status-ack gate",
)
require(
    "!task->read_every_pdo_cycle()" in post_ack,
    "Legacy/status-ack tasks must remain gated by the status handshake",
)

print("6-IMU every-PDO read policy regression contract OK")
