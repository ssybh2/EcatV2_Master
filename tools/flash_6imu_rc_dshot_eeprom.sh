#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOL="$ROOT_DIR/tools/eepromtool"
IMAGE="$ROOT_DIR/eeproms/58100H750_UniversalModule_6IMU_RC_DSHOT.bin"
BACKUP_DIR="$ROOT_DIR/eeprom_backups"

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <ethercat-interface> <slave-number>"
  exit 2
fi
IFACE="$1"; SLAVE="$2"
[[ "$SLAVE" =~ ^[1-9][0-9]*$ ]] || { echo "ERROR: slave-number must be 1..n." >&2; exit 2; }
[[ -x "$TOOL" ]] || { echo "ERROR: missing eepromtool: $TOOL" >&2; exit 1; }
[[ -f "$IMAGE" ]] || {
  echo "ERROR: missing NEW 0x06 image: $IMAGE" >&2
  echo "Use the validated 0x06 image; keep the original 0x05 EEPROM as a separate backup." >&2
  exit 1
}

python3 - "$IMAGE" <<'PY'
from pathlib import Path
import struct, sys
b = Path(sys.argv[1]).read_bytes()
if len(b) != 2048: raise SystemExit(f"ERROR: EEPROM size {len(b)}, expected 2048")
pc = struct.unpack_from("<I", b, 0x14)[0]
if pc != 0x06: raise SystemExit(f"ERROR: ProductCode=0x{pc:08X}, expected 0x00000006")
print("EEPROM image validation PASSED")
PY

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="$BACKUP_DIR/slave${SLAVE}_${STAMP}_before_v006.bin"
VERIFY="$BACKUP_DIR/slave${SLAVE}_${STAMP}_after_v006.bin"
if [[ ${EUID:-$(id -u)} -eq 0 ]]; then EEPROMTOOL=("$TOOL"); else EEPROMTOOL=(sudo "$TOOL"); fi

echo "[1/5] Inspect current EEPROM"; "${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -i
echo "[2/5] Backup"; "${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -r "$BACKUP"
[[ -s "$BACKUP" ]] || { echo "ERROR: backup failed." >&2; exit 1; }
echo "WARNING: writing ProductCode 0x00000006 to slave $SLAVE on $IFACE"
read -r -p "Type WRITE exactly to continue: " CONFIRM
[[ "$CONFIRM" == "WRITE" ]] || { echo "Cancelled."; exit 0; }
echo "[3/5] Write"; "${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -w "$IMAGE"
echo "[4/5] Read-back"; "${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -r "$VERIFY"
cmp -s "$IMAGE" "$VERIFY" || { echo "ERROR: read-back mismatch; backup=$BACKUP" >&2; exit 1; }
echo "[5/5] Inspect programmed EEPROM"; "${EEPROMTOOL[@]}" "$IFACE" "$SLAVE" -i
echo "Done. Power-cycle the EtherCAT slave."
