#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOL="$ROOT_DIR/tools/eepromtool"
IMAGE="$ROOT_DIR/eeproms/58100H750_UniversalModule_6IMU_LargePDOV.bin"
BACKUP_DIR="$ROOT_DIR/eeprom_backups"

usage() {
  cat <<'EOF'
Usage:
  tools/flash_6imu_eeprom.sh <ethercat-interface> <slave-number>

Example:
  tools/flash_6imu_eeprom.sh enp3s0 1

The script will:
  1. inspect the target slave;
  2. validate the ProductCode 0x05 image;
  3. back up the current EEPROM;
  4. require the exact confirmation word WRITE;
  5. write the new 2048-byte image;
  6. read it back and compare every byte.

It never selects an interface or slave number automatically.
EOF
}

if [[ $# -ne 2 ]]; then
  usage
  exit 2
fi

IFACE="$1"
SLAVE="$2"

if [[ ! "$SLAVE" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: slave-number must be a positive integer (1..n)." >&2
  exit 2
fi

if [[ ! -x "$TOOL" ]]; then
  echo "ERROR: EEPROM tool is missing or not executable: $TOOL" >&2
  exit 2
fi

if [[ ! -f "$IMAGE" ]]; then
  echo "ERROR: 6-IMU EEPROM image is missing: $IMAGE" >&2
  exit 2
fi

python3 - "$IMAGE" <<'PY'
import pathlib
import struct
import sys

path = pathlib.Path(sys.argv[1])
data = path.read_bytes()

if len(data) != 2048:
    raise SystemExit(f"ERROR: expected a 2048-byte EEPROM image, got {len(data)} bytes")

# SOEM eepromtool reports Product Code from bytes 0x14..0x17.
product_code = struct.unpack_from("<I", data, 0x14)[0]
if product_code != 0x05:
    raise SystemExit(f"ERROR: expected ProductCode 0x00000005, got 0x{product_code:08X}")

if b"6IMU_PDO" not in data:
    raise SystemExit("ERROR: the EEPROM image does not contain the 6IMU_PDO device name")

print("EEPROM image validation OK")
print(f"  size         : {len(data)} bytes")
print(f"  ProductCode  : 0x{product_code:08X}")
print("  device tag   : 6IMU_PDO")
PY

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="$BACKUP_DIR/slave${SLAVE}_${STAMP}_before_6imu.bin"
VERIFY="$BACKUP_DIR/slave${SLAVE}_${STAMP}_after_6imu.bin"

if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  EEPROMTOOL=("$TOOL")
else
  EEPROMTOOL=(sudo "$TOOL")
fi

echo
echo "============================================================"
echo "Target EtherCAT EEPROM"
echo "  interface : $IFACE"
echo "  slave     : $SLAVE"
echo "  image     : $IMAGE"
echo "============================================================"
echo

echo "[1/5] Reading current slave EEPROM information..."
"${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -i

echo
echo "[2/5] Backing up the complete current EEPROM..."
"${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -r "$BACKUP"

if [[ ! -s "$BACKUP" ]]; then
  echo "ERROR: EEPROM backup was not created correctly. Nothing will be written." >&2
  exit 1
fi

echo "Backup saved to: $BACKUP"
echo
echo "WARNING: the next step will overwrite slave $SLAVE EEPROM on $IFACE."
echo "The target image is ProductCode 0x00000005 (6-IMU Large PDO)."
read -r -p "Type WRITE exactly to continue: " CONFIRM

if [[ "$CONFIRM" != "WRITE" ]]; then
  echo "Cancelled. EEPROM was NOT modified."
  exit 0
fi

echo
echo "[3/5] Writing ProductCode 0x05 EEPROM image..."
"${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -w "$IMAGE"

echo
echo "[4/5] Reading EEPROM back for byte-for-byte verification..."
"${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -r "$VERIFY"

if ! cmp -s "$IMAGE" "$VERIFY"; then
  echo "ERROR: EEPROM read-back does not match the requested image." >&2
  echo "Original backup is available at: $BACKUP" >&2
  echo "Read-back file is available at: $VERIFY" >&2
  exit 1
fi

echo "Read-back verification PASSED."

echo
echo "[5/5] Displaying the EEPROM contents after programming..."
"${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -i

echo
echo "============================================================"
echo "EEPROM programming completed and verified."
echo "Backup: $BACKUP"
echo "Verify: $VERIFY"
echo
echo "Power-cycle the EtherCAT slave before relying on the new SII"
echo "identity/mapping during the next master discovery."
echo "============================================================"
