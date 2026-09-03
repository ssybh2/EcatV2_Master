# ProductCode 0x06：6 IMU + DJI RC + DShot 部署说明

## 1. Profile

| 项目 | 0x05 legacy | 0x06 current |
|---|---:|---:|
| M→S application | 80 B | 80 B |
| S→M application | 160 B | 192 B |
| EtherCAT Outputs | 81 B | 81 B |
| EtherCAT Inputs | 161 B | 193 B |
| task_count | 6 | 8 |
| sdo_len | 85 B | 91 B |

0x06 S→M：6 × 21 B IMU（0..125）+ 34 B diagnostics（126..159）+ 19 B DJI RC（160..178）+ 13 B reserved。

0x06 M→S：DShot 4 × uint16（0..7）+ 72 B reserved。

## 2. Slave 必须包含的两个实机修复

S→M 为 24 × uint64_t，加上 `slave_status` 后 SM3 共 25 个 mappings，所以：

```c
#define MAX_MAPPINGS_SM3 25
```

旧值 21 会导致 PREOP→SAFEOP 报 `0x001E Invalid input configuration`。

链接脚本 DMA 区：

```ld
.dma_buffer (NOLOAD) :
```

否则 RAM_D2 DMA 区会进入裸 `.bin`，导致 binary 异常膨胀。

## 3. EEPROM / SII：真机验证后的正确方法

当前已知可工作的 2048-byte AX58100 SII EEPROM **没有静态 RxPDO / TxPDO category**。实际 PDO mapping 与 SM2/SM3 长度由 H750 上 SOES object dictionary / CoE 动态提供。

因此 0x06 镜像采用：

1. 备份已知可工作的 ProductCode `0x05` EEPROM。
2. 复制为新镜像。
3. 只修改 SII ProductCode byte offset `0x14`：`0x05 → 0x06`。
4. 验证两个 2048-byte 镜像只差这一字节。
5. 用 `eepromtool` 写入、读回并逐字节比较。
6. 整块 H750 + AX58100 完全断电再上电。

不要用旧 ProductCode `0x03` 的 `slave.bin` 作为 0x06 烧写基线，也不要为了 0x06 强行添加当前已验证 SII 中不存在的静态 PDO category。

Master 中最终镜像：

```text
eeproms/58100H750_UniversalModule_6IMU_RC_DSHOT.bin
```

检查：

```bash
python3 - <<'PY'
from pathlib import Path
import struct
b = Path('eeproms/58100H750_UniversalModule_6IMU_RC_DSHOT.bin').read_bytes()
assert len(b) == 2048
assert struct.unpack_from('<I', b, 0x14)[0] == 6
print('EEPROM OK: ProductCode 0x06, 2048 bytes')
PY
```

烧写：

```bash
sudo ./tools/eepromtool enp1s0 1 -i
sudo ./tools/slaveinfo enp1s0
./tools/flash_6imu_rc_dshot_eeprom.sh enp1s0 1
```

烧写后整板断电重启。真机已验证：

```text
Product Code     : 00000006
Checksum         : 009C
calculated       : 009C
Output size      : 648bits
Input size       : 1544bits
State            : 4
SM2              : 81 B
SM3              : 193 B
```

EEPROM String category 仍可能显示旧的 `58100_H750_UniversalModule_6IMU_PDO` 名称，这是预期；0x06 区分依据为 ProductCode / ID。

## 4. Master 8-task 配置

```text
Task 1..6 HIPNUC IMU read @ 0,21,42,63,84,105
Task 7    DJI RC      read @ 160
Task 8    DShot       write @ 0
sdo_len = 91
task_count = 8
```

DShot 推荐安全默认值：

```text
connection_lost_write_action = 2
dshot_id = 1
init_value = 0
```

通用模板：`src/soem_wrapper/config/config_6imu_rc_dshot_template.yaml`

在线 Editor：<https://ssybh2.github.io/EcatV2_Master/>

## 5. 本机 bringup

真实 Serial/NIC/CPU 属于机器本地配置，不提交到公共模板：

```bash
./tools/prepare_6imu_rc_dshot_bringup.sh <serial> <interface> <rt-cpu> <non-rt-cpus>
source /opt/ros/humble/setup.bash
colcon build
source install/setup.bash
```

启动前用 `ros2 pkg prefix soem_wrapper` / `soem_bringup` 确认没有误加载旧 workspace。

## 6. Git

不要未经检查就 `git add -A`。推荐：

```bash
git status --short
git diff --check
git add <明确的通用文件>
git diff --cached --stat
git diff --cached --check
git commit ...
git push
```

`src/soem_bringup/`、EEPROM backup/readback、build/install/log 均保持本地。
