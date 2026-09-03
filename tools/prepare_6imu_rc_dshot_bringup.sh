#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT_DIR/src/soem_wrapper/config/config_6imu_rc_dshot_template.yaml"
BACKUP_DIR="$ROOT_DIR/.local_6imu_rc_dshot_backups"

if [[ $# -ne 4 ]]; then
  echo "Usage: $0 <slave-serial> <ethercat-interface> <rt-cpu> <non-rt-cpus>"
  echo "Example: $0 1234567 enp1s0 7 0,1,2,3,4,5,6"
  exit 2
fi

SERIAL="$1"; IFACE="$2"; RT_CPU="$3"; NON_RT_CPUS="$4"
[[ "$SERIAL" =~ ^[0-9]+$ ]] || { echo "ERROR: serial must be digits." >&2; exit 2; }
[[ "$IFACE" =~ ^[A-Za-z0-9_.:-]+$ ]] || { echo "ERROR: invalid interface." >&2; exit 2; }
[[ "$RT_CPU" =~ ^[0-9]+$ ]] || { echo "ERROR: invalid RT CPU." >&2; exit 2; }
[[ "$NON_RT_CPUS" =~ ^[0-9,-]+$ ]] || { echo "ERROR: invalid non-RT CPU set." >&2; exit 2; }
[[ -f "$TEMPLATE" ]] || { echo "ERROR: missing $TEMPLATE" >&2; exit 1; }

REPO_PARENT="$(dirname "$ROOT_DIR")"
if [[ "$(basename "$REPO_PARENT")" == "src" ]]; then
  WORKSPACE_ROOT="$(dirname "$REPO_PARENT")"
  BRINGUP_DIR="$REPO_PARENT/soem_bringup"
else
  WORKSPACE_ROOT="$ROOT_DIR"
  BRINGUP_DIR="$ROOT_DIR/src/soem_bringup"
fi
CONFIG_DIR="$BRINGUP_DIR/config"; LAUNCH_DIR="$BRINGUP_DIR/launch"
CONFIG_OUT="$CONFIG_DIR/config.yaml"; LAUNCH_OUT="$LAUNCH_DIR/bringup.launch.py"
mkdir -p "$CONFIG_DIR" "$LAUNCH_DIR" "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
for f in "$CONFIG_OUT" "$LAUNCH_OUT"; do
  [[ ! -f "$f" ]] || cp -a "$f" "$BACKUP_DIR/$(basename "$f").${STAMP}.bak"
done

cat > "$BRINGUP_DIR/CMakeLists.txt" <<'EOF'
cmake_minimum_required(VERSION 3.8)
project(soem_bringup)
find_package(ament_cmake REQUIRED)
install(DIRECTORY launch config DESTINATION share/${PROJECT_NAME}/)
ament_package()
EOF

cat > "$BRINGUP_DIR/package.xml" <<'EOF'
<?xml version="1.0"?>
<package format="3">
  <name>soem_bringup</name>
  <version>0.0.0</version>
  <description>EcatV2 ProductCode 0x06 bringup.</description>
  <maintainer email="ssybh2@nottingham.edu.cn">ssybh2</maintainer>
  <license>MIT</license>
  <buildtool_depend>ament_cmake</buildtool_depend>
  <exec_depend>soem_wrapper</exec_depend>
  <export><build_type>ament_cmake</build_type></export>
</package>
EOF

python3 - "$TEMPLATE" "$CONFIG_OUT" "$SERIAL" <<'PY'
from pathlib import Path
import sys
t, o, serial = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
s = t.read_text(encoding="utf-8")
if "sn1234567" not in s:
    raise SystemExit("ERROR: template serial placeholder not found")
o.write_text(s.replace("sn1234567", f"sn{serial}"), encoding="utf-8")
PY

cat > "$LAUNCH_OUT" <<EOF
from launch import LaunchDescription
from launch_ros.actions import Node
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    config_file = os.path.join(
        get_package_share_directory('soem_bringup'), 'config', 'config.yaml')
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

python3 - "$CONFIG_OUT" "$LAUNCH_OUT" <<'PY'
from pathlib import Path
import sys
c = Path(sys.argv[1]).read_text()
l = Path(sys.argv[2]).read_text()
for x in ["sdo_len: !uint16_t 91", "task_count: !uint8_t 8",
          "pdoread_offset: !uint16_t 160", "pdowrite_offset: !uint16_t 0",
          "sdowrite_connection_lost_write_action: !uint8_t 2"]:
    if x not in c: raise SystemExit("ERROR: missing config field: " + x)
if "'config.yaml'" not in l: raise SystemExit("ERROR: launch validation failed")
print("0x06 bringup validation PASSED")
PY

echo "Prepared $BRINGUP_DIR"
echo "Next: colcon build && source install/setup.bash"
echo "Then: ros2 launch soem_bringup bringup.launch.py"
