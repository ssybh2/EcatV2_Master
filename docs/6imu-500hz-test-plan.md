# 6 IMU @ 500 Hz 压力测试计划 / Validation Plan

> 适用设备：ProductCode `0x05`，STM32H750 + AX58100，CAN1 三个 HIPNUC IMU，CAN2 三个 HIPNUC IMU。
>
> 本文件同时提供 **中文版** 和 **English version**。第一次真机测试建议先看中文版。
>
> 不要一上来就插满 6 个 IMU。必须逐级加负载，否则一旦失败很难判断到底是哪一层出了问题。

---

# 中文版

## 1. 测试目标

验证下面整条链路在 6×500 Hz 满载下稳定工作：

```text
HI92
 ↓ UART
STM32G431 bridge
 ↓ 3 个 classic CAN frame / sample
CAN1 / CAN2
 ↓
STM32H750
 ↓ 160B PDO
AX58100
 ↓ EtherCAT
SOEM
 ↓
ROS 2
```

每个 IMU 每 2 ms 产生一个逻辑样本：

```text
P1 = 8B
P2 = 8B
P3 = 5B
总计 = 21B
```

500 Hz 时：

```text
1 个 IMU = 1500 CAN frame/s
3 个 IMU = 4500 CAN frame/s / 每条 CAN
```

CAN1 与 CAN2 独立，因此两条总线可以重复使用 Slot1/2/3 的 CAN ID。

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

## 3. ProductCode 0x05 PDO 布局

Master → Slave application buffer：

```text
80B
```

Slave → Master：

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

EtherCAT `slave_status` 是另外的 PDO object，不算在 160B application buffer 里面。

---

## 4. 测试前置条件

开始压力测试前，先确认：

```text
H750 已烧 feature/6imu-large-pdo 固件
AX58100 EEPROM ProductCode = 0x05
6 个 G431 bridge 使用 slot1/slot2/slot3 正确固件
CAN1/CAN2 都是 1 Mbps
两条 CAN 终端电阻正确
Master 使用 feature/6imu-large-pdo
soem_bringup 中 config.yaml SN 正确
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
频率接近 500 Hz
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
不能出现“其中一个稳定、另一个随机消失”
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

这是最关键的一关，因为它直接验证：

```text
单条 1 Mbps CAN
3 个 IMU
每个 500 Hz
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

目的：

```text
确认 FDCAN2 与 CAN1 同时工作时没有共享资源问题
```

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

建议最终正式验收时跑：

```text
30~60 分钟
```

如果机器人以后需要长期工作，可以再做更长 soak test。

---

## 6. 每个阶段固定检查 5 项

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
```

---

### 6.2 Topic rate

逐个执行：

```bash
ros2 topic hz /imu/can1/slot1
```

目标：

```text
接近 500 Hz
```

判断重点不是某一瞬间必须 `500.000`，而是：

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

### 6.4 Master 诊断 warning

我们的 Master 会直接解析 160B PDO 的诊断区。

正常运行时，不应持续出现：

```text
6-IMU CAN RX diagnostics changed
6-IMU #N incomplete P1/P2/P3 sample(s)
6-IMU #N sample sequence jumped
```

一次偶发 warning 与持续增长不是同一个概念。

压力测试要看的是：

```text
计数是否一直增长
```

---

### 6.5 EtherCAT 状态

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

每一级都填一行：

| 阶段 | 接入数量 | 运行时间 | 6 个 topic rate | incomplete | FIFO lost/full | Bus-Off | EtherCAT state | 结论 |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| A | 1 | 5 min | | | | | | |
| B | 2 | 10 min | | | | | | |
| C | 3 | 15~30 min | | | | | | |
| D | 4 | 10 min | | | | | | |
| E | 5 | 15 min | | | | | | |
| F | 6 | 30~60 min | | | | | | |

这样如果阶段 C 通过、阶段 D 失败，就能非常快地把问题范围缩到 CAN2 或双 FDCAN 并行路径。

---

## 8. 健康系统标准

稳定系统应该满足：

```text
6 个 sample_seq 持续增长
6 个 ROS IMU topic 接近 500 Hz
incomplete_samples 不持续增长
CAN1/CAN2 FIFO lost 不持续增长
CAN1/CAN2 FIFO full 不持续增长
CAN1/CAN2 read_error 不持续增长
IMU bridge can_tx_fail 不持续增长
IMU bridge Bus-Off recovery 不持续增长
UART CRC/header/length/tag errors 不持续增长
EtherCAT 稳定 OP
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

说明：

```text
H750 RX FIFO 曾经装满或丢消息
```

优先检查：

```text
H750 中断延迟
CPU/FreeRTOS 调度
FDCAN RX 处理速度
```

这不是“160B PDO 太大”的直接证据。

---

### B. incomplete_samples 增长，但 FIFO clean

日志：

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

说明：

```text
旧的 3-frame group 还没完全进 TX FIFO
新的 2ms sample 又到了
```

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

还没有进入 CAN。

此时先不要调 EtherCAT。

---

### F. `sample sequence jumped`，但 CAN 诊断 clean

Master 日志：

```text
6-IMU #N sample sequence jumped by N
```

说明：

```text
H750 已经提交了多个完整 sample
但 Master 没有观察到其中每一个
```

优先检查：

```text
EtherCAT cycle time
SOEM realtime scheduling
CPU isolation
Master load
WKC/state
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
6 个 topic 全部持续
6 个 topic 平均频率接近 500 Hz
无随机消失
无持续 incomplete 增长
无持续 FIFO lost/full 增长
无持续 read_error
无持续 Bus-Off
EtherCAT 不掉 OP
```

满足这些条件后，才建议把这个 6-IMU 分支视为“通过真机基础通信压力测试”。

---

# English Version

## 1. Purpose

Validate the complete six-IMU communication chain at 500 Hz per IMU:

```text
HI92
 -> UART
STM32G431 bridge
 -> 3 classic CAN frames per sample
CAN1 / CAN2
 -> STM32H750
 -> 160-byte PDO
AX58100
 -> EtherCAT
SOEM
 -> ROS 2
```

Each IMU logical sample is:

```text
P1 = 8 bytes
P2 = 8 bytes
P3 = 5 bytes
Total = 21 bytes
```

At 500 Hz, each IMU produces 1500 CAN frames/s. Three IMUs therefore produce 4500 CAN frames/s on each 1 Mbps CAN bus.

CAN1 and CAN2 are independent, so Slot1/Slot2/Slot3 CAN IDs are intentionally reused between the two buses.

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

## 3. ProductCode 0x05 PDO layout

Master → Slave application buffer remains 80 bytes.

Slave → Master is 160 bytes:

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

The EtherCAT `slave_status` byte is a separate PDO object.

---

## 4. Preconditions

Before stress testing, confirm:

```text
H750 firmware = feature/6imu-large-pdo
AX58100 EEPROM ProductCode = 0x05
G431 bridges use correct slot1/slot2/slot3 images
CAN1 and CAN2 = 1 Mbps
CAN termination is correct
Master = feature/6imu-large-pdo
soem_bringup config uses the real slave SN
```

Start with:

```bash
ros2 launch soem_bringup bringup.launch.py
```

The master should reach OP and report initialization success.

---

## 5. Load sequence

Do not start with all six IMUs.

1. CAN1 Slot1 only, at least 5 minutes.
2. CAN1 Slot1 + Slot2, at least 10 minutes.
3. CAN1 Slot1 + Slot2 + Slot3, 15–30 minutes.
4. CAN1 three IMUs + CAN2 Slot1, at least 10 minutes.
5. CAN1 three IMUs + CAN2 two IMUs, at least 15 minutes.
6. Full 3+3 configuration, at least 30 minutes; 60 minutes recommended for final acceptance.

Stage 3 is especially important because it proves three 500 Hz IMUs on one 1 Mbps CAN bus.

---

## 6. Check the same items at every stage

### ROS topic rate

```bash
ros2 topic hz /imu/can1/slot1
```

Expected: stable and close to 500 Hz.

### Data content

```bash
ros2 topic echo /imu/can1/slot1 --once
```

Move the corresponding sensor and verify orientation, angular velocity and linear acceleration change.

### Master diagnostics

There should not be continuously increasing warnings such as:

```text
6-IMU CAN RX diagnostics changed
6-IMU #N incomplete P1/P2/P3 sample(s)
6-IMU #N sample sequence jumped
```

### EtherCAT state

The slave should remain in OP without repeated WKC/state/reconnect warnings.

---

## 7. Healthy result

A healthy full-load system should show:

- all six `sample_seq` counters continuously increasing;
- all six ROS IMU topics close to 500 Hz;
- no continuously increasing `incomplete_samples`;
- no continuously increasing CAN1/CAN2 FIFO lost counters;
- no continuously increasing FIFO full counters;
- no continuously increasing HAL read-error counters;
- no continuously increasing bridge CAN Tx failures;
- no continuously increasing Bus-Off recovery count;
- UART framing/CRC/tag errors remaining zero or non-growing after startup;
- EtherCAT remaining in OP.

---

## 8. Failure interpretation

### H750 FIFO lost/full increases

The H750 receive side is under pressure or interrupt latency is too high. Investigate FDCAN receive handling and slave-side scheduling before blaming PDO size.

### `incomplete_samples` increases while FIFO counters remain clean

The H750 did not receive a complete P1 → P2 → P3 group. Check bridge CAN Tx diagnostics, then CAN physical wiring.

### `can_tx_group_deferred_count` increases

The previous three-frame group has not cleared the local Tx queue before the next 2 ms sample arrives. This indicates the local CAN Tx path is approaching its practical throughput limit.

### CAN Tx failure or Bus-Off recovery increases

Check CANH/CANL, common ground, termination, transceiver supply, connector quality, stub lengths and bitrate consistency.

### UART CRC/header/length/tag errors increase

The problem is before CAN, on the HI92 → STM32G431 UART path.

### Sample sequence jumps while CAN diagnostics remain clean

The slave committed complete samples, but the master did not observe every sample. Inspect EtherCAT cycle timing, CPU isolation, realtime scheduling, WKC/state warnings and master load.

---

## 9. Final acceptance

Run all six IMUs for at least 30 minutes, preferably 60 minutes.

Pass only if:

```text
all six topics remain present
all six rates remain close to 500 Hz
no random sensor disappears
diagnostic counters do not continuously increase
no sustained CAN Bus-Off occurs
EtherCAT remains in OP
```

Only after this stage should the six-IMU feature branch be considered hardware-validated for basic communication stability.
