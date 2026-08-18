#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT_DIR/src/soem_wrapper/config/config_6imu_template.yaml"
CONFIG_OUT="$ROOT_DIR/src/soem_wrapper/config/dev-config.yaml"
LAUNCH_OUT="$ROOT_DIR/src/soem_wrapper/launch/bringup.launch.py"
BACKUP_DIR="$ROOT_DIR/.local_6imu_backups"

usage() {
  cat <<'EOF'
Usage:
  tools/prepare_6imu_bringup.sh <slave-serial> <ethercat-interface> <rt-cpu> <non-rt-cpus>

Example:
  tools/prepare_6imu_bringup.sh 2883658 enx000ec6c1d02b 1 0,2-15

This generates the two local files used for a 6-IMU bringup:
  src/soem_wrapper/config/dev-config.yaml
  src/soem_wrapper/launch/bringup.launch.py

The generated files are intentionally ignored by Git so machine-specific
settings do not get committed accidentally.
EOF
}

if [[ $# -ne 4 ]]; then
  usage
  exit 2
fi

SERIAL="$1"
IFACE="$2"
RT_CPU="$3"
NON_RT_CPUS="$4"

if [[ ! "$SERIAL" =~ ^[0-9]+$ ]]; then
  echo "ERROR: slave-serial must contain digits only." >&2
  exit 2
fi

if [[ ! "$IFACE" =~ ^[A-Za-z0-9_.:-]+$ ]]; then
  echo "ERROR: unsupported characters in interface name: $IFACE" >&2
  exit 2
fi

if [[ ! "$RT_CPU" =~ ^[0-9]+$ ]]; then
  echo "ERROR: rt-cpu must be a non-negative integer." >&2
  exit 2
fi

if [[ ! "$NON_RT_CPUS" =~ ^[0-9,-]+$ ]]; then
  echo "ERROR: non-rt-cpus must look like 0,2-15 or 0-5,7-15." >&2
  exit 2
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: missing 6-IMU configuration template: $TEMPLATE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"

for file in "$CONFIG_OUT" "$LAUNCH_OUT"; do
  if [[ -f "$file" ]]; then
    cp -a "$file" "$BACKUP_DIR/$(basename "$file").${STAMP}.bak"
  fi
done

python3 - "$TEMPLATE" "$CONFIG_OUT" "$SERIAL" <<'PY'
from pathlib import Path
import sys

template = Path(sys.argv[1])
out = Path(sys.argv[2])
serial = sys.argv[3]

text = template.read_text(encoding="utf-8")
placeholder = "sn1234567"
if placeholder not in text:
    raise SystemExit(f"ERROR: expected placeholder {placeholder!r} was not found in template")

text = text.replace(placeholder, f"sn{serial}")
if placeholder in text:
    raise SystemExit("ERROR: serial placeholder remains after substitution")

out.write_text(text, encoding="utf-8")
print(f"Generated {out}")
PY

cat > "$LAUNCH_OUT" <<EOF
from launch import LaunchDescription
from launch_ros.actions import Node
import os
from ament_index_python.packages import get_package_share_directory


def generate_launch_description():
    config_file = os.path.join(
        get_package_share_directory('soem_wrapper'),
        'config',
        'dev-config.yaml'
    )

    return LaunchDescription([
        Node(
            package='soem_wrapper',
            executable='soem_backend',
            name='soem_backend',
            parameters=[{
                'interface': '$IFACE',
                'rt_cpu': $RT_CPU,
                'non_rt_cpus': '$NON_RT_CPUS',
                'config_file': config_file
            }],
            output='screen'
        )
    ])
EOF

python3 - "$CONFIG_OUT" "$LAUNCH_OUT" "$SERIAL" "$IFACE" "$RT_CPU" "$NON_RT_CPUS" <<'PY'
from pathlib import Path
import sys

config = Path(sys.argv[1]).read_text(encoding="utf-8")
launch = Path(sys.argv[2]).read_text(encoding="utf-8")
serial, iface, rt_cpu, non_rt = sys.argv[3:]

checks = {
    f"sn{serial}": config,
    "sdo_len: !uint16_t 85": config,
    "task_count: !uint8_t 6": config,
    "pdoread_offset: !uint16_t 105": config,
    f"'interface': '{iface}'": launch,
    f"'rt_cpu': {rt_cpu}": launch,
    f"'non_rt_cpus': '{non_rt}'": launch,
    "'dev-config.yaml'": launch,
}

missing = [needle for needle, haystack in checks.items() if needle not in haystack]
if missing:
    raise SystemExit("ERROR: generated bringup verification failed: " + ", ".join(missing))

print("6-IMU bringup generation verification PASSED")
PY

echo
echo "============================================================"
echo "6-IMU Master bringup prepared"
echo "  slave SN    : $SERIAL"
echo "  interface   : $IFACE"
echo "  RT CPU      : $RT_CPU"
echo "  non-RT CPUs : $NON_RT_CPUS"
echo "  config      : $CONFIG_OUT"
echo "  launch      : $LAUNCH_OUT"
echo "============================================================"
echo
echo "Next commands from the workspace root:"
echo "  source /opt/ros/humble/setup.bash"
echo "  colcon build"
echo "  source install/setup.bash"
echo "  ros2 launch soem_wrapper bringup.launch.py"
echo
echo "The EtherCAT backend normally needs root privileges/raw-socket access."
