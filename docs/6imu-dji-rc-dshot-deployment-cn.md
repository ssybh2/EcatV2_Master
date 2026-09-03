# ProductCode 0x06：6 IMU + DJI RC + DShot 部署说明

本配置在原 `feature/6imu-large-pdo` 的 ProductCode `0x05` 基础上新增一个兼容 profile，而不是改变 0x05 的含义。

| 项目 | 0x05（保留） | 0x06（新增） |
|---|---:|---:|
| Master → Slave application data | 80 B | 80 B |
| Slave → Master application data | 160 B | 192 B |
| EtherCAT Outputs（含 status） | 81 B | 81 B |
| EtherCAT Inputs（含 status） | 161 B | 193 B |

## 0x06 PDO 布局

Slave → Master：

| Offset | Length | 内容 |
|---:|---:|---|
| 0 | 21 | IMU 1 |
| 21 | 21 | IMU 2 |
| 42 | 21 | IMU 3 |
| 63 | 21 | IMU 4 |
| 84 | 21 | IMU 5 |
| 105 | 21 | IMU 6 |
| 126 | 34 | 6-IMU/CAN diagnostics |
| 160 | 19 | DJI RC/DBUS：18 B 原始帧 + 1 B online |
| 179 | 13 | reserved |

Master → Slave：

| Offset | Length | 内容 |
|---:|---:|---|
| 0 | 8 | DShot：4 × `uint16_t` |
| 8 | 72 | reserved |

六个 HIPNUC task 必须排在 DJI RC 前。Slave 在写指针到达 126 B 时立刻插入 34 B diagnostics，这样原 6-IMU/diagnostics offset 全部保持不变。

## 应用源码升级

从升级包目录运行：

```bash
python3 apply_ecat_v006_upgrade.py \
  --slave /path/to/EcatV2_AX58100_H750_Universal \
  --master /path/to/EcatV2_Master
```

默认在两个 repo 中创建 `feature/6imu-rc-dshot-pdo-v006`。运行后：

```bash
git -C /path/to/EcatV2_AX58100_H750_Universal diff --check
git -C /path/to/EcatV2_Master diff --check
```

## EEPROM：不要跳过重新生成

`ecat/device/patch_esi.py` 是 post-process 脚本，不是 ESI/SII compiler。必须使用该从站项目原本的 EtherCAT SDK / ESX code generator，根据更新后的 `slave.esx` 重新生成真正的 `slave.bin`。

推荐流程：

```text
更新后的 slave.esx
  -> EtherCAT SDK / ESX generator
  -> 新的 slave.bin / generated ESI
  -> 检查 ProductCode=0x06、0x6001/0x1A01 共 24 项
  -> python3 ecat/device/patch_esi.py
  -> eeprom.bin
```

注意 generator 可能覆盖 `slave_objectlist.c` / `utypes.h`。生成后必须再次确认：

```text
slave2master[24]
ProductCode 0x06
0x1A01 MaxSubIndex = 24
0x6001 MaxSubIndex = 24
SLAVE_TO_MASTER_PDO_SIZE = 192
```

验证新二进制：

```bash
python3 - <<'PY'
from pathlib import Path
import struct
b = Path("ecat/device/eeprom.bin").read_bytes()
assert len(b) == 2048
assert struct.unpack_from("<I", b, 0x14)[0] == 0x06
assert b"6IMU_RC_DSHOT" in b
print("EEPROM basic validation OK")
PY
```

然后复制到 Master：

```bash
cp ecat/device/eeprom.bin \
  /path/to/EcatV2_Master/eeproms/58100H750_UniversalModule_6IMU_RC_DSHOT.bin
```

## Master 配置

Master 注册新模块：

```cpp
register_module(6, "H750UniversalModule (6-IMU + RC + DSHOT)", 80, 192, 8);
```

新配置：

```yaml
sdo_len: !uint16_t 91
task_count: !uint8_t 8
```

DJI RC：

```yaml
sdowrite_task_type: !uint8_t 1
pdoread_offset: !uint16_t 160
pub_topic: !std::string '/dji_rc'
```

DShot：

```yaml
sdowrite_task_type: !uint8_t 4
sdowrite_connection_lost_write_action: !uint8_t 2
sdowrite_dshot_id: !uint8_t 1
sdowrite_init_value: !uint16_t 0
pdowrite_offset: !uint16_t 0
sub_topic: !std::string '/dshot'
```

SDO 长度：`1 + 6*14 + 1 + 5 = 91 B`。

生成 bringup：

```bash
tools/prepare_6imu_rc_dshot_bringup.sh \
  <slave-serial> <ethercat-interface> <rt-cpu> <non-rt-cpus>
```

烧 EEPROM：

```bash
tools/flash_6imu_rc_dshot_eeprom.sh <interface> <slave-number>
```

## 真机验收

断电重启从站后，应确认：

```text
Product Code = 0x00000006
Outputs = 81 bytes
Inputs  = 193 bytes
```

ROS 2：

```bash
ros2 topic echo /dji_rc
ros2 topic info /dshot
```

DShot 第一次测试请拆桨或确保机械系统没有运动风险，保持 `init_value=0`，先验证 EtherCAT OP、topic、PDO 和断线归零，再发非零值。

## Git 提交

Slave：

```bash
git add -A
git commit -m "feat: add ProductCode 0x06 192B PDO profile with RC and DShot"
git push -u origin feature/6imu-rc-dshot-pdo-v006
```

Master：

```bash
git add -A
git commit -m "feat: add ProductCode 0x06 6IMU RC DShot bringup"
git push -u origin feature/6imu-rc-dshot-pdo-v006
```

真机完整验证前建议不要 merge 到 `main`。
