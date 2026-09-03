from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRAPPER_CPP = (ROOT / "src/soem_wrapper/src/soem_backend.cpp").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


# ProductCode 0x05/0x06 expose 160/192-byte S->M buffers containing the
# per-IMU sample sequence counters. Older 80/112-byte layouts do not.
require(
    "slave_to_master_buf_len_ >= 160" in WRAPPER_CPP,
    "Every-PDO reads must be gated to the sequence-counter 6-IMU PDO layouts",
)
require(
    "get_type_id()" in WRAPPER_CPP and "HIPNUC_IMU_CAN_APP_ID" in WRAPPER_CPP,
    "Only HIPNUC IMU tasks should opt into the every-PDO fast path",
)

# process_pdo must inspect sequenced HIPNUC tasks before the latency/status
# handshake so a 500 Hz sample is not hidden behind a ~1.4 ms status round trip.
start = WRAPPER_CPP.index("void SlaveDevice::process_pdo")
body = WRAPPER_CPP[start:]
ack = body.index("if (slave_status_ == master_status_)")
pre_ack = body[:ack]
post_ack = body[ack:]

require(
    "task->read();" in pre_ack or "task_wrapper->read();" in pre_ack,
    "Sequenced HIPNUC tasks must be read before the status-ack gate",
)
require(
    "read_every_pdo" in pre_ack,
    "The pre-ack path must explicitly identify every-PDO tasks",
)
require(
    "!read_every_pdo" in post_ack,
    "Legacy/status-ack tasks must remain inside the status handshake",
)

print("6-IMU every-PDO read policy regression contract OK")
