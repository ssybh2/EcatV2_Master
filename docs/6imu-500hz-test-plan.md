# ProductCode 0x06 · 6 IMU 压力测试计划 / Validation Plan

> 文件名为了兼容旧链接仍保留 `6imu-500hz-test-plan.md`，但本文件已经从旧的 ProductCode `0x05` / 160B PDO 测试计划迁移到当前 ProductCode `0x06`。
>
> 当前系统：STM32H750 + AX58100，CAN1 三个 HIPNUC IMU，CAN2 三个 HIPNUC IMU，并同时包含 DJI RC / DBUS 与 DShot。
>
> 本文件同时提供 **中文版** 和 **English version**。第一次真机测试建议先看中文版。
>
> 不要一上来就插满 6 个 IMU。必须逐级加负载，否则一旦失败很难判断到底是哪一层出了问题。

---

# 中文版

## 1. 测试目标

验证下面整条链路在当前 ProductCode 0x06 配置下稳定工作：

```text
HI92
 ↓ UART
STM32G431 bridge
 ↓ 3 个 classic CAN frame / sample
CAN1 / CAN2
 ↓
STM32H750
 ↓ 192B S->M application PDO
AX58100
 ↓ EtherCAT
SOEM
 ↓
ROS 2
```

同时验证：

```text
6 × HIPNUC IMU
DJI RC / DBUS
DShot ROS 2 interface
EtherCAT OP stability
Master raw-PDO / loop-stall diagnostics
```

每个 IMU 逻辑样本仍是：

```text
P1 = 8B
P2 = 8B
P3 = 5B
总计 = 21B
```

CAN1 与 CAN2 独立，因此两条总线可以重复使用 Slot1/2/3 的 CAN ID。

### 频率说明

本文件不再把“所有 ProductCode 0x06 系统都必须固定 500 Hz”作为唯一前提。

正确做法是：

```text
ROS topic rate 应稳定接近本次实际部署配置的 IMU 输出频率
```

如果本次真机确实使用 500 Hz bridge / slave 配置：

```text
目标 topic rate ≈ 500 Hz
样本周期 = 2000 us
Master sequenced_imu_period_us 建议 = 2000
```

如果本次测试基线按约 333.33 Hz / 3 ms：

```text
目标 topic rate ≈ 333.33 Hz
样本周期 = 3000 us
Master sequenced_imu_period_us = 3000
```

`sequenced_imu_period_us` 是 Master 的 raw-PDO gap 样本风险判定参数，不负责给 G431/H750 生成采样频率。最终实际频率仍以 `ros2 topic hz` 和从站/bridge 配置为准。

---

## 2. 目标拓扑

```text
CAN1 @ 1 Mbps                     CAN2 @ 1 Mbps
  IMU1 slot1: 0x01/02/03           IMU4 slot1: 0x01/02/03
  IMU2 slot2: 0x04/05/06           IMU5 slot2: 0x04/05/06
  IMU3 slot3: 0x07/08/09           IMU6 slot3: 0x07/08/09
            \                         /
             \                       /
              STM32H750 + AX58100
                       |
                    EtherCAT
                       |
                    SOEM/ROS2
```

---

## 3. ProductCode 0x06 PDO 布局

Master → Slave application buffer：

```text
80 B
```

Slave → Master application buffer：

```text
192 B
```

| Byte | 内容 |
| --- | --- |
| 0..20 | IMU1，21B |
| 21..41 | IMU2，21B |
| 42..62 | IMU3，21B |
| 63..83 | IMU4，21B |
| 84..104 | IMU5，21B |
| 105..125 | IMU6，21B |
| 126..137 | 6 个 `uint16 sample_seq` |
| 138..149 | 6 个 `uint16 incomplete_samples` |
| 150..151 | CAN1 RX FIFO lost low16 |
| 152..153 | CAN2 RX FIFO lost low16 |
| 154..155 | CAN1 RX FIFO full low16 |
| 156..157 | CAN2 RX FIFO full low16 |
| 158 | CAN1 HAL RX read error low8 |
| 159 | CAN2 HAL RX read error low8 |
| 160..178 | DJI RC / DBUS，19B |
| 179..191 | reserved |

Master → Slave：

| Byte | 内容 |
| --- | --- |
| 0..7 | DShot，4 × `uint16` |
| 8..79 | reserved |

EtherCAT process data 最终为：

```text
Outputs = 81 B
Inputs  = 193 B
SM2     = 81 B
SM3     = 193 B
```

EtherCAT 自身的状态字节不计入上面的 application buffer 长度。

---

## 4. 测试前置条件

开始压力测试前，先确认：

```text
H750 使用 ProductCode 0x06 固件
推荐正式 Release = v0.6.1
AX58100 EEPROM ProductCode = 0x06
6 个 G431 bridge 使用 slot1/slot2/slot3 正确固件
CAN1/CAN2 都是 1 Mbps
两条 CAN 终端电阻正确
Master 使用 feature/6imu-rc-dshot-pdo-v006
soem_bringup 中 config.yaml SN 正确
task_count = 8
sdo_len = 91
```

推荐先检查：

```bash
cd ~/ecat_ws/src/EcatV2_Master
sudo ./tools/eepromtool enp3s0 1 -i
sudo ./tools/slaveinfo enp3s0
```

应确认：

```text
Product Code = 00000006
SM2 = 81 B
SM3 = 193 B
```

正式启动：

```bash
ros2 launch soem_bringup bringup.launch.py
```

Master 应达到：

```text
SAFE_OP
→ OP
→ Initialization succeeded
→ slave confirmed ready
```

如果本次明确做 500 Hz timing validation，建议 launch 参数中有：

```python
'sequenced_imu_period_us': 2000,
```

当前 Master 默认值是：

```text
sequenced_imu_period_us = 3000 us
loop_stall_profile_threshold_us = 5000 us
```

---

## 5. 测试阶段

### 阶段 A：CAN1 只接 Slot1

```text
CAN1: IMU1
CAN2: empty
```

持续：

```text
至少 5 分钟
```

目的：

```text
验证最基础的 UART -> CAN -> H750 -> EtherCAT -> ROS 链路
```

检查：

```bash
ros2 topic hz /imu/can1/slot1
ros2 topic echo /imu/can1/slot1 --once
```

通过标准：

```text
频率稳定接近本次实际配置目标
数据随 IMU 运动变化
Master 无持续 warning
```

---

### 阶段 B：CAN1 两个 IMU

```text
CAN1: Slot1 + Slot2
CAN2: empty
```

持续：

```text
至少 10 分钟
```

检查：

```bash
ros2 topic hz /imu/can1/slot1
ros2 topic hz /imu/can1/slot2
```

重点：

```text
不能出现其中一个稳定、另一个随机消失
```

---

### 阶段 C：CAN1 三个 IMU

```text
CAN1: Slot1 + Slot2 + Slot3
CAN2: empty
```

持续：

```text
建议 15~30 分钟
```

这是最关键的一关，因为它直接验证单条 1 Mbps CAN 上同时承载 3 个 IMU。

如果本次明确做 500 Hz 验收，这一阶段就是验证：

```text
单条 1 Mbps CAN
3 个 IMU
每个约 500 Hz
```

检查：

```bash
ros2 topic hz /imu/can1/slot1
ros2 topic hz /imu/can1/slot2
ros2 topic hz /imu/can1/slot3
```

如果这一关不稳定，不要继续加 CAN2。

---

### 阶段 D：3 + 1

```text
CAN1: Slot1 + Slot2 + Slot3
CAN2: Slot1
```

持续：

```text
至少 10 分钟
```

目的：确认 FDCAN2 与 CAN1 同时工作时没有明显共享资源问题。

---

### 阶段 E：3 + 2

```text
CAN1: 3 IMU
CAN2: 2 IMU
```

持续：

```text
至少 15 分钟
```

这是接近满载状态。

---

### 阶段 F：3 + 3 满载

```text
CAN1: 3 IMU
CAN2: 3 IMU
```

持续：

```text
至少 30 分钟
```

建议最终正式验收：

```text
30~60 分钟
```

如果机器人以后需要长期工作，可以再做更长 soak test。

---

## 6. 每个阶段固定检查 7 项

### 6.1 ROS topic 是否存在

```bash
ros2 topic list
```

满载时应有：

```text
/imu/can1/slot1
/imu/can1/slot2
/imu/can1/slot3
/imu/can2/slot1
/imu/can2/slot2
/imu/can2/slot3
/dji_rc
/dshot
```

---

### 6.2 Topic rate

逐个执行：

```bash
ros2 topic hz /imu/can1/slot1
```

目标：

```text
稳定接近本次实际配置频率
```

判断重点不是某一瞬间必须精确等于目标，而是：

```text
长期稳定
不掉到 0
不突然只剩几十 Hz
不周期性消失
```

---

### 6.3 数据内容

```bash
ros2 topic echo /imu/can1/slot1 --once
```

轻轻转动该 IMU，观察：

```text
orientation
angular_velocity
linear_acceleration
```

确认变化对应的是正确物理 IMU，避免 Slot 接反。

---

### 6.4 DJI RC

```bash
ros2 topic echo /dji_rc
ros2 topic hz /dji_rc
```

操作摇杆/拨杆，数据应实时变化。

---

### 6.5 DShot interface

```bash
ros2 topic info /dshot -v
ros2 interface show custom_msgs/msg/WriteDSHOT
```

压力测试阶段首先确认 ROS 2 接口存在和类型正确。真正发送非零 DShot 输出时应拆桨或解除机械负载。

---

### 6.6 Master 诊断 warning

Master 会直接解析 192B S→M PDO 的诊断区。

正常运行时，不应持续出现：

```text
6-IMU CAN RX diagnostics changed
6-IMU #N incomplete P1/P2/P3 sample(s)
6-IMU #N sample sequence jumped
RAW PDO GAP
ECAT LOOP STALL
```

一次偶发 warning 与持续增长不是同一个概念。压力测试要看的是：

```text
计数是否持续增长
告警是否持续重复
```

---

### 6.7 EtherCAT 状态

Master 应持续保持 OP。

如果出现：

```text
lost connection
SAFE_OP
PRE_OP
WKC warning
reconnect
```

记录发生时间和当时接入的 IMU 数量。

---

## 7. 建议记录表

| 阶段 | 接入数量 | 运行时间 | topic rate | incomplete | FIFO lost/full | RAW PDO GAP | LOOP STALL | Bus-Off | EtherCAT state | 结论 |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 1 | 5 min | | | | | | | | |
| B | 2 | 10 min | | | | | | | | |
| C | 3 | 15~30 min | | | | | | | | |
| D | 4 | 10 min | | | | | | | | |
| E | 5 | 15 min | | | | | | | | |
| F | 6 | 30~60 min | | | | | | | | |

这样如果阶段 C 通过、阶段 D 失败，就能快速把问题范围缩到 CAN2 或双 FDCAN 并行路径。

---

## 8. 健康系统标准

稳定系统应该满足：

```text
6 个 sample_seq 持续增长
6 个 ROS IMU topic 稳定接近本次实际配置频率
incomplete_samples 不持续增长
CAN1/CAN2 FIFO lost 不持续增长
CAN1/CAN2 FIFO full 不持续增长
CAN1/CAN2 read_error 不持续增长
IMU bridge can_tx_fail 不持续增长
IMU bridge Bus-Off recovery 不持续增长
UART CRC/header/length/tag errors 不持续增长
DJI RC 数据正常变化
DShot ROS 2 interface 正常
无持续 RAW PDO GAP
无持续 ECAT LOOP STALL
EtherCAT 稳定 OP
```

如果本次明确做 500 Hz 验收，再额外要求：

```text
6 个 ROS IMU topic 平均频率接近 500 Hz
sequenced_imu_period_us = 2000 us
```

---

## 9. 故障定位

### A. H750 FIFO lost/full 增长

Master 日志类似：

```text
6-IMU CAN RX diagnostics changed:
CAN1 lost=...
CAN1 full=...
```

说明 H750 RX FIFO 曾经装满或丢消息。

优先检查：

```text
H750 中断延迟
CPU/FreeRTOS 调度
FDCAN RX 处理速度
```

这不是“192B PDO 太大”的直接证据。

---

### B. incomplete_samples 增长，但 FIFO clean

```text
6-IMU #N incomplete P1/P2/P3 sample(s)
```

说明 H750 没有得到完整的：

```text
P1 -> P2 -> P3
```

检查顺序：

```text
G431 CAN TX
→ CAN physical layer
→ termination
→ ground
→ transceiver
```

---

### C. G431 `can_tx_group_deferred_count` 增长

说明前一个 3-frame group 还没完全进 TX FIFO，新的样本又到了。

这是 CAN TX 队列/总线负载接近极限的直接信号。

---

### D. G431 `can_tx_fail_count` / Bus-Off recovery 增长

优先查物理层：

```text
CANH / CANL
共地
120Ω 终端
收发器电源
线缆/接插件
stub 长度
bitrate
```

---

### E. UART CRC/header/length/tag error 增长

问题发生在：

```text
HI92 -> G431 UART
```

还没有进入 CAN。此时先不要调 EtherCAT。

---

### F. `sample sequence jumped`，但 CAN 诊断 clean

```text
6-IMU #N sample sequence jumped by N
```

说明 H750 已经提交了完整 sample，但 Master 没有观察到每一个 sample。

优先检查：

```text
EtherCAT cycle time
SOEM realtime scheduling
CPU isolation
Master load
WKC/state
RAW PDO GAP
ECAT LOOP STALL
```

---

### G. `RAW PDO GAP`

日志类似：

```text
RAW PDO GAP: ... ms between ec_receive_processdata returns; wkc=... expected=...
```

这表示两次 `ec_receive_processdata` 返回之间的间隔已经达到当前 `sequenced_imu_period_us` 定义的样本风险时间尺度。

判断：

```text
WKC 同时异常
→ 优先检查 EtherCAT transport / NIC / slave state

WKC 正常
→ 继续看 ECAT LOOP STALL，判断是否为主机调度/锁等待/抢占
```

---

### H. `ECAT LOOP STALL`

当前 Master 会把长周期拆分成：

```text
scheduler_gap
receive
copy_in
process_pdo
process_lock_wait
process_body
process_body_cpu
process_offcpu
copy_out
send
unaccounted
raw_pdo_gap
wkc
```

重点解释：

```text
scheduler_gap 大
→ DATA realtime thread 没及时获得 CPU 的可能性更高

process_lock_wait 大
→ slave mutex contention 的可能性更高

process_body 很大，但 process_body_cpu 很小
→ process_pdo 内被抢占/阻塞/off-CPU 的可能性更高

process_body_cpu 本身很大
→ 更像实际 CPU 计算耗时
```

---

## 10. 最终通过条件

最终 3+3 满载：

```text
至少 30 分钟
推荐 60 分钟
```

满足：

```text
6 个 IMU topic 全部持续
6 个 IMU topic rate 稳定接近本次实际配置频率
无随机 sensor 消失
DJI RC 正常
DShot interface 正常
无持续 incomplete 增长
无持续 FIFO lost/full 增长
无持续 read_error
无持续 Bus-Off
无持续 RAW PDO GAP / ECAT LOOP STALL
EtherCAT 不掉 OP
```

如果本次目标就是 500 Hz，则再要求：

```text
6 个 topic 平均频率接近 500 Hz
sequenced_imu_period_us = 2000 us
```

满足这些条件后，才建议把当前 ProductCode 0x06 系统视为“通过本次真机基础通信压力测试”。

---

# English Version

## 1. Purpose

Validate the current ProductCode `0x06` six-IMU communication chain:

```text
HI92
 -> UART
STM32G431 bridge
 -> 3 classic CAN frames per sample
CAN1 / CAN2
 -> STM32H750
 -> 192-byte S->M application PDO
AX58100
 -> EtherCAT
SOEM
 -> ROS 2
```

The current profile also includes DJI RC / DBUS and DShot.

Each IMU logical sample remains:

```text
P1 = 8 bytes
P2 = 8 bytes
P3 = 5 bytes
Total = 21 bytes
```

CAN1 and CAN2 are independent, so Slot1/Slot2/Slot3 CAN IDs are intentionally reused between the two buses.

### Rate convention

Do not assume that every ProductCode 0x06 deployment must be judged against one hard-coded rate.

The ROS topic rate should remain stable and close to the actual configured IMU output rate.

For an explicitly configured 500 Hz validation:

```text
target topic rate ~= 500 Hz
sample period = 2000 us
recommended sequenced_imu_period_us = 2000
```

For a 3 ms / ~333.33 Hz timing baseline:

```text
target topic rate ~= 333.33 Hz
sample period = 3000 us
sequenced_imu_period_us = 3000
```

`sequenced_imu_period_us` is a Master-side raw-PDO gap risk threshold. It does not generate the bridge or slave sampling frequency.

---

## 2. Target topology

```text
CAN1 @ 1 Mbps                     CAN2 @ 1 Mbps
  IMU1 slot1: 0x01/02/03           IMU4 slot1: 0x01/02/03
  IMU2 slot2: 0x04/05/06           IMU5 slot2: 0x04/05/06
  IMU3 slot3: 0x07/08/09           IMU6 slot3: 0x07/08/09
            \                         /
             \                       /
              STM32H750 + AX58100
                       |
                    EtherCAT
                       |
                    SOEM/ROS2
```

---

## 3. ProductCode 0x06 PDO layout

Master → Slave application buffer: 80 bytes.

Slave → Master application buffer: 192 bytes.

| Byte range | Meaning |
| --- | --- |
| 0..20 | IMU1, 21B |
| 21..41 | IMU2, 21B |
| 42..62 | IMU3, 21B |
| 63..83 | IMU4, 21B |
| 84..104 | IMU5, 21B |
| 105..125 | IMU6, 21B |
| 126..137 | six `uint16 sample_seq` counters |
| 138..149 | six `uint16 incomplete_samples` counters |
| 150..151 | CAN1 RX FIFO lost, low 16 bits |
| 152..153 | CAN2 RX FIFO lost, low 16 bits |
| 154..155 | CAN1 RX FIFO full, low 16 bits |
| 156..157 | CAN2 RX FIFO full, low 16 bits |
| 158 | CAN1 HAL RX read error, low 8 bits |
| 159 | CAN2 HAL RX read error, low 8 bits |
| 160..178 | DJI RC / DBUS, 19B |
| 179..191 | reserved |

Master → Slave uses bytes 0..7 for four DShot `uint16` values and reserves 8..79.

Final EtherCAT process-data sizes are:

```text
Outputs = 81 B
Inputs  = 193 B
SM2     = 81 B
SM3     = 193 B
```

---

## 4. Preconditions

Before stress testing, confirm:

```text
H750 firmware = ProductCode 0x06
recommended release = v0.6.1
AX58100 EEPROM ProductCode = 0x06
G431 bridges use the correct slot1/slot2/slot3 images
CAN1 and CAN2 = 1 Mbps
CAN termination is correct
Master = feature/6imu-rc-dshot-pdo-v006
soem_bringup config uses the real slave SN
task_count = 8
sdo_len = 91
```

Start with:

```bash
ros2 launch soem_bringup bringup.launch.py
```

The master should reach OP and report initialization success.

For an explicit 500 Hz timing validation, set:

```python
'sequenced_imu_period_us': 2000,
```

The current Master defaults are:

```text
sequenced_imu_period_us = 3000 us
loop_stall_profile_threshold_us = 5000 us
```

---

## 5. Load sequence

Do not start with all six IMUs.

1. CAN1 Slot1 only, at least 5 minutes.
2. CAN1 Slot1 + Slot2, at least 10 minutes.
3. CAN1 Slot1 + Slot2 + Slot3, 15–30 minutes.
4. CAN1 three IMUs + CAN2 Slot1, at least 10 minutes.
5. CAN1 three IMUs + CAN2 two IMUs, at least 15 minutes.
6. Full 3+3 configuration, at least 30 minutes; 60 minutes recommended for final acceptance.

Stage 3 is especially important because it proves three IMUs on one 1 Mbps CAN bus. If this run is specifically a 500 Hz validation, it proves the three-IMU / 500 Hz-per-IMU case on one CAN bus.

---

## 6. Check the same items at every stage

### ROS topic rate

```bash
ros2 topic hz /imu/can1/slot1
```

Expected: stable and close to the actual configured rate.

### Data content

```bash
ros2 topic echo /imu/can1/slot1 --once
```

Move the corresponding sensor and verify orientation, angular velocity and linear acceleration change.

### DJI RC

```bash
ros2 topic echo /dji_rc
ros2 topic hz /dji_rc
```

The data should change with stick/switch movement.

### DShot interface

```bash
ros2 topic info /dshot -v
ros2 interface show custom_msgs/msg/WriteDSHOT
```

For non-zero motor testing, remove propellers or otherwise unload the actuator safely.

### Master diagnostics

There should not be continuously repeating/increasing warnings such as:

```text
6-IMU CAN RX diagnostics changed
6-IMU #N incomplete P1/P2/P3 sample(s)
6-IMU #N sample sequence jumped
RAW PDO GAP
ECAT LOOP STALL
```

### EtherCAT state

The slave should remain in OP without repeated WKC/state/reconnect warnings.

---

## 7. Healthy result

A healthy full-load system should show:

- all six `sample_seq` counters continuously increasing;
- all six ROS IMU topics stable and close to the actual configured rate;
- no continuously increasing `incomplete_samples`;
- no continuously increasing CAN1/CAN2 FIFO lost counters;
- no continuously increasing FIFO full counters;
- no continuously increasing HAL read-error counters;
- no continuously increasing bridge CAN Tx failures;
- no continuously increasing Bus-Off recovery count;
- UART framing/CRC/tag errors remaining zero or non-growing after startup;
- DJI RC data responding normally;
- the DShot ROS 2 interface remaining available;
- no sustained `RAW PDO GAP` or `ECAT LOOP STALL` warnings;
- EtherCAT remaining in OP.

For an explicit 500 Hz acceptance, additionally require all six topic rates to remain close to 500 Hz and set `sequenced_imu_period_us = 2000`.

---

## 8. Failure interpretation

### H750 FIFO lost/full increases

The H750 receive side is under pressure or interrupt latency is too high. Investigate FDCAN receive handling and slave-side scheduling before blaming the 192-byte PDO size.

### `incomplete_samples` increases while FIFO counters remain clean

The H750 did not receive a complete P1 → P2 → P3 group. Check bridge CAN Tx diagnostics, then CAN physical wiring.

### `can_tx_group_deferred_count` increases

The previous three-frame group has not cleared the local Tx queue before the next sample arrives. This indicates the local CAN Tx path is approaching its practical throughput limit.

### CAN Tx failure or Bus-Off recovery increases

Check CANH/CANL, common ground, termination, transceiver supply, connector quality, stub lengths and bitrate consistency.

### UART CRC/header/length/tag errors increase

The problem is before CAN, on the HI92 → STM32G431 UART path.

### Sample sequence jumps while CAN diagnostics remain clean

The slave committed complete samples, but the master did not observe every sample. Inspect EtherCAT cycle timing, CPU isolation, realtime scheduling, WKC/state warnings, master load, `RAW PDO GAP` and `ECAT LOOP STALL`.

### `RAW PDO GAP`

This means the interval between two `ec_receive_processdata` returns reached the configured `sequenced_imu_period_us` sample-risk timescale.

If WKC is also abnormal, investigate transport/NIC/slave state first. If WKC is normal, correlate the event with the loop-stall breakdown.

### `ECAT LOOP STALL`

The current Master breaks a long cycle down into:

```text
scheduler_gap
receive
copy_in
process_pdo
process_lock_wait
process_body
process_body_cpu
process_offcpu
copy_out
send
unaccounted
raw_pdo_gap
wkc
```

Interpretation:

```text
large scheduler_gap
-> realtime DATA thread did not get CPU time promptly

large process_lock_wait
-> likely slave-mutex contention

large process_body but small process_body_cpu
-> likely preemption/blocking/off-CPU time inside process_pdo

large process_body_cpu
-> actual CPU work is more likely the dominant cost
```

---

## 9. Final acceptance

Run all six IMUs for at least 30 minutes, preferably 60 minutes.

Pass only if:

```text
all six topics remain present
all six rates remain stable and close to the configured target
no random sensor disappears
DJI RC behaves normally
DShot interface remains valid
diagnostic counters do not continuously increase
no sustained CAN Bus-Off occurs
no sustained RAW PDO GAP / ECAT LOOP STALL occurs
EtherCAT remains in OP
```

For an explicit 500 Hz test, additionally require:

```text
all six rates remain close to 500 Hz
sequenced_imu_period_us = 2000 us
```

Only after this stage should the current ProductCode 0x06 setup be considered hardware-validated for the tested communication rate and configuration.
