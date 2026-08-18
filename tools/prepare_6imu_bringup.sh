#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT_DIR/src/soem_wrapper/config/config_6imu_template.yaml"
BACKUP_DIR="$ROOT_DIR/.local_6imu_backups"

usage() {
  cat <<'EOF'
Usage:
  tools/prepare_6imu_bringup.sh <slave-serial> <ethercat-interface> <rt-cpu> <non-rt-cpus>

Example:
  tools/prepare_6imu_bringup.sh 2883658 enx000ec6c1d02b 1 0,2-15

This creates/updates the ROS 2 bringup package used by the original
EcatV2_Master workflow:

  <workspace>/src/soem_bringup/
  ├── CMakeLists.txt
  ├── package.xml
  ├── config/
  │   └── config.yaml
  └── launch/
      └── bringup.launch.py

The final launch command is:

  ros2 launch soem_bringup bringup.launch.py
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

REPO_PARENT="$(dirname "$ROOT_DIR")"
if [[ "$(basename "$REPO_PARENT")" == "src" ]]; then
  WORKSPACE_ROOT="$(dirname "$REPO_PARENT")"
  BRINGUP_DIR="$REPO_PARENT/soem_bringup"
else
  WORKSPACE_ROOT="$ROOT_DIR"
  BRINGUP_DIR="$ROOT_DIR/src/soem_bringup"
fi

CONFIG_DIR="$BRINGUP_DIR/config"
LAUNCH_DIR="$BRINGUP_DIR/launch"
CONFIG_OUT="$CONFIG_DIR/config.yaml"
LAUNCH_OUT="$LAUNCH_DIR/bringup.launch.py"

mkdir -p "$CONFIG_DIR" "$LAUNCH_DIR" "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
for file in "$CONFIG_OUT" "$LAUNCH_OUT"; do
  if [[ -f "$file" ]]; then
    cp -a "$file" "$BACKUP_DIR/$(basename "$file").${STAMP}.bak"
  fi
done

cat > "$BRINGUP_DIR/CMakeLists.txt" <<'EOF'
cmake_minimum_required(VERSION 3.8)
project(soem_bringup)

find_package(ament_cmake REQUIRED)

install(DIRECTORY
  launch
  config
  DESTINATION share/${PROJECT_NAME}/
)

ament_package()
EOF

cat > "$BRINGUP_DIR/package.xml" <<'EOF'
<?xml version="1.0"?>
<package format="3">
  <name>soem_bringup</name>
  <version>0.0.0</version>
  <description>Bringup package for EcatV2_Master 6-IMU deployment.</description>

  <maintainer email="ssybh2@nottingham.edu.cn">ssybh2</maintainer>
  <license>MIT</license>

  <buildtool_depend>ament_cmake</buildtool_depend>
  <exec_depend>soem_wrapper</exec_depend>

  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
EOF

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
        get_package_share_directory('soem_bringup'),
        'config',
        'config.yaml'
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
    "get_package_share_directory('soem_bringup')": launch,
    "'config.yaml'": launch,
}

missing = [needle for needle, haystack in checks.items() if needle not in haystack]
if missing:
    raise SystemExit("ERROR: generated bringup verification failed: " + ", ".join(missing))

print("6-IMU soem_bringup generation verification PASSED")
PY

echo
echo "============================================================"
echo "6-IMU ROS 2 bringup package prepared"
echo "  workspace    : $WORKSPACE_ROOT"
echo "  bringup pkg  : $BRINGUP_DIR"
echo "  slave SN     : $SERIAL"
echo "  interface    : $IFACE"
echo "  RT CPU       : $RT_CPU"
echo "  non-RT CPUs  : $NON_RT_CPUS"
echo "  config       : $CONFIG_OUT"
echo "  launch       : $LAUNCH_OUT"
echo "============================================================"
echo
echo "Next commands from the workspace root:"
echo "  source /opt/ros/humble/setup.bash"
echo "  colcon build"
echo "  source install/setup.bash"
echo
echo "Run as root/raw-socket-capable user:"
echo "  ros2 launch soem_bringup bringup.launch.py"
