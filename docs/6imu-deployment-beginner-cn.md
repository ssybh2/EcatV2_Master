# ProductCode 0x06：6 IMU + DJI RC + DShot EtherCAT 完整部署教程（小白版）

> 这是一份从 **空 Ubuntu 环境** 一直走到 **6 个 HI92 IMU、DJI RC 和 DShot 全部通过 EtherCAT 工作** 的完整教程。
>
> 它不是另起炉灶，而是把原版 AIMEtherCAT 的三条教程路线：
>
> 1. [Environment Setup（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md)
> 2. [First Run Test（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)
> 3. [Configuration Generator（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)
>
> 与我们新增的 **ProductCode 0x06 固件、192B S→M PDO、6IMU + DJI RC + DShot、8-task TaskEditor、Master timing diagnostics 和压力测试** 合并成一条完整流程。
>
> 最终启动命令与原仓库保持一致：
>
> ```bash
> ros2 launch soem_bringup bringup.launch.py
> ```
>
> 当前适用分支：
>
> - Master：`ssybh2/EcatV2_Master -> feature/6imu-rc-dshot-pdo-v006`
> - H750 Slave：`ssybh2/EcatV2_AX58100_H750_Universal -> feature/6imu-rc-dshot-pdo-v006`
> - HIPNUC bridge：`ssybh2/hipnucimu -> feature/6imu-500hz-stable`
>
> 当前推荐 H750 正式 Release：`v0.6.1`。

---

# 0. 先看最终系统

最终硬件拓扑：

```text
CAN1 @ 1 Mbps                       CAN2 @ 1 Mbps
├── IMU1 Slot1  01/02/03            ├── IMU4 Slot1  01/02/03
├── IMU2 Slot2  04/05/06            ├── IMU5 Slot2  04/05/06
└── IMU3 Slot3  07/08/09            └── IMU6 Slot3  07/08/09
               \                      /
                \                    /
                 STM32H750 + AX58100
                          │
                       EtherCAT
                          │
                    Ubuntu Master
                          │
                      ROS 2 + SOEM
                          │
            ┌─────────────┴─────────────┐
            │                           │
     /imu/can1/slot1 ...         /imu/can2/slot3
```

EtherCAT 设备身份：

```text
ProductCode / eepid = 0x00000006

Application PDO:
Master -> Slave = 80 B
Slave  -> Master = 192 B

EtherCAT process data:
Outputs = 81 B
Inputs  = 193 B
```

Slave→Master 192B application region：

```text
0..20     IMU1
21..41    IMU2
42..62    IMU3
63..83    IMU4
84..104   IMU5
105..125  IMU6
126..159  diagnostics
160..178  DJI RC / DBUS (19 B)
179..191  reserved
```

Master→Slave 80B application region：

```text
0..7      DShot (4 × uint16)
8..79     reserved
```

EtherCAT 自身还各有 1B 状态字段，因此最终是：

```text
SM2 / Outputs = 81 B
SM3 / Inputs  = 193 B
```

前 126B 是六个 IMU 数据，126..159 是诊断区，160..178 是 DJI RC；DShot 使用 M→S offset 0..7。

---

# Part A：Environment Setup —— 先把 Master 电脑准备好

这一部分对应原仓库的 [Environment Setup 原版教程](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md)。

## 1. BIOS 设置

原版教程建议尽量减少 CPU 省电和频率动态变化带来的实时抖动。不同电脑 BIOS 名字不一样，找不到某一项可以跳过。

建议检查：

```text
Race To Halt (RTH)        -> Disable
Virtualization Support    -> Disable
C-State Support           -> Disable
```

Hyper-Threading：

```text
如果系统资源足够，可以关闭；
如果你不想损失一半逻辑线程，也可以保留。
```

如果 BIOS 能锁 CPU 频率，可考虑：

```text
TurboBoost / SpeedStep / SpeedShift -> Disable
CPU frequency -> 固定值
```

### 这一步什么时候算完成？

电脑能正常启动 Ubuntu 即可。不要为了找不到某一个 BIOS 选项卡住整个部署。

---

## 2. Ubuntu / ROS 2 版本

原版仓库推荐：

```text
Ubuntu 24.04 + ROS 2 Jazzy
```

并说明：

```text
Ubuntu 22.04 + ROS 2 Humble
```

也能工作。

当前 `feature/6imu-rc-dshot-pdo-v006` CI 仍包含 Ubuntu 22.04 / ROS 2 Humble 编译验证，所以这份小白教程继续优先按：

```text
Ubuntu 22.04 + ROS 2 Humble
```

写。

确认 ROS 2：

```bash
source /opt/ros/humble/setup.bash
ros2 --help
```

如果能正常显示 ROS 2 命令帮助，继续下一步。

---

## 3. Ubuntu Pro 与 Realtime Kernel

原版教程使用 Ubuntu Pro 提供的 realtime kernel。

先关联 Ubuntu Pro：

```bash
sudo pro attach
```

按照终端提示登录/关联 Ubuntu One。

然后启用实时内核：

```bash
sudo pro enable realtime-kernel
```

完成后重启：

```bash
sudo reboot
```

重启回来查看内核：

```bash
uname -a
```

你应该看到内核名称中带有 realtime/rt 相关信息。

> 原版文档还提到过 Intel 特定 variant，但后来注明实际差别不明显；本教程不要求使用特定 variant。

---

## 4. 隔离一个 CPU 给 SOEM

原版教程建议给 EtherCAT 实时线程单独留一个 CPU。

先看逻辑 CPU：

```bash
lscpu
nproc
```

假设你决定：

```text
RT CPU = 0
其他 CPU = 1,2,3,4,5,6,7
```

那么原版 GRUB 参数思路是：

```text
nohz=on
nohz_full=0
rcu_nocbs=0
isolcpus=0
irqaffinity=1,2,3,4,5,6,7
```

合起来：

```text
nohz=on nohz_full=0 rcu_nocbs=0 isolcpus=0 irqaffinity=1,2,3,4,5,6,7
```

### Hyper-Threading 用户注意

如果一个物理核心对应多个逻辑线程，应尽量隔离**完整物理核心**，不要只隔离其中一个 sibling thread。

修改并重启后检查：

```bash
cat /proc/cmdline
```

确认能看到：

```text
isolcpus=
nohz_full=
rcu_nocbs=
irqaffinity=
```

也可以用：

```bash
htop
```

观察被隔离 CPU 在普通系统负载下是否基本保持空闲。

### 先记住两个值

后面 launch 文件要用：

```text
rt_cpu      = X
non_rt_cpus = Y
```

例如：

```text
rt_cpu      = 0
non_rt_cpus = 1-7
```

---

# Part B：按照原仓库方式建立 ROS 2 Workspace

## 5. 创建 workspace

这里仿照原版 [Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md) 的结构。

```bash
mkdir -p ~/ecat_ws/src
cd ~/ecat_ws
git init
```

最终希望得到：

```text
ecat_ws/
└── src/
    ├── EcatV2_Master/
    └── soem_bringup/
```

---

## 6. 把自己的 EcatV2_Master 加到 workspace

原版教程用 Git submodule。我们继续沿用这个思路，但使用自己的 Fork：

```bash
cd ~/ecat_ws

git submodule add \
  https://github.com/ssybh2/EcatV2_Master.git \
  src/EcatV2_Master
```

进入 Master：

```bash
cd ~/ecat_ws/src/EcatV2_Master
git checkout feature/6imu-rc-dshot-pdo-v006
git submodule update --init --recursive
```

确认：

```bash
git branch --show-current
```

应该输出：

```text
feature/6imu-rc-dshot-pdo-v006
```

### 以后更新 Master

```bash
cd ~/ecat_ws/src/EcatV2_Master
git pull
git submodule update --init --recursive
```

不要切回 `main` 来部署本次 6-IMU 版本。

---

## 7. 安装 workspace 依赖

```bash
cd ~/ecat_ws
source /opt/ros/humble/setup.bash

sudo apt update
sudo apt install -y \
  python3-colcon-common-extensions \
  python3-rosdep
```

如果系统第一次用 rosdep：

```bash
sudo rosdep init
```

如果提示已经初始化过，可以忽略。

然后：

```bash
rosdep update
rosdep install --from-paths src --ignore-src -r -y
```

到这里还不需要 `colcon build`，因为后面还要创建 `soem_bringup`。

---

# Part C：烧录 6 个 IMU 转接板

## 8. 下载 3 种 HIPNUC 固件

打开：

[打开 HIPNUC Firmware Actions 页面](https://github.com/ssybh2/hipnucimu/actions)

选择 `feature/6imu-500hz-stable` 上最新一次绿色的：

```text
Build 6-IMU Firmware
```

下载 Artifact：

```text
hipnucimu-500hz-slots
```

解压后应有：

```text
hipnucimu_slot1.hex
hipnucimu_slot1.bin
hipnucimu_slot2.hex
hipnucimu_slot2.bin
hipnucimu_slot3.hex
hipnucimu_slot3.bin
```

第一次烧录推荐 `.hex`。

固件 ID：

```text
slot1 -> 0x01 / 0x02 / 0x03
slot2 -> 0x04 / 0x05 / 0x06
slot3 -> 0x07 / 0x08 / 0x09
```

> 注意：bridge 分支名字中仍然有 `500hz`。后面 Master 的 `sequenced_imu_period_us` 是**诊断阈值/期望样本周期参数**，不是用来给 G431 生成采样频率的。实际验收频率必须与本次烧录和从站配置的真实输出频率一致。

---

## 9. 给 6 个转接板贴标签

```text
C1-S1
C1-S2
C1-S3
C2-S1
C2-S2
C2-S3
```

烧录关系：

| 标签 | CAN | 固件 | CAN IDs |
| --- | --- | --- | --- |
| C1-S1 | CAN1 | slot1.hex | 01/02/03 |
| C1-S2 | CAN1 | slot2.hex | 04/05/06 |
| C1-S3 | CAN1 | slot3.hex | 07/08/09 |
| C2-S1 | CAN2 | slot1.hex | 01/02/03 |
| C2-S2 | CAN2 | slot2.hex | 04/05/06 |
| C2-S3 | CAN2 | slot3.hex | 07/08/09 |

CAN1 和 CAN2 是两条独立总线，所以可以重复使用 Slot1/2/3 的 ID。

---

## 10. 用 STM32CubeProgrammer 烧 G431

每块 HIPNUC bridge：

```text
ST-LINK
  ↓
SWDIO / SWCLK / GND
  ↓
STM32G431
```

CubeProgrammer：

```text
ST-LINK
→ Port = SWD
→ Connect
→ Open File
→ 选择对应 slotX.hex
→ Download
→ Verify
→ Reset
```

成功标准：看到 Program / Verify 成功。

不要再手动修改 `main.c` 的 CAN ID；三种固件已经分别构建好。

### 如果 G431 提示写保护：先解除保护，再彻底断电后烧录

如果看到：

```text
flash memory write protected
flash write failed
block write failed
timeout waiting for algorithm
```

不要连续反复点 Download。可以在 Ubuntu 上用 OpenOCD 先解除保护。

```bash
sudo apt update
sudo apt install -y openocd
```

假设固件在：

```text
~/Downloads/hipnucimu-500hz-slots
```

执行：

```bash
cd ~/Downloads/hipnucimu-500hz-slots

openocd \
  -f interface/stlink.cfg \
  -f target/stm32g4x.cfg \
  -c "adapter speed 100" \
  -c "init" \
  -c "halt" \
  -c "flash probe 0" \
  -c "flash protect 0 0 last off" \
  -c "stm32l4x option_load 0" \
  -c "shutdown"
```

正常情况下会看到类似：

```text
cleared protection for sectors 0 through 63
stm32l4x option load completed. Power-on reset might be required
```

正确顺序：

```text
解除 Flash 写保护
→ stm32l4x option_load 0
→ G431 完全断电
→ 如果 ST-Link 3.3V 也在给板子供电，ST-Link 供电也一起断开
→ 等待 5~10 秒
→ 重新上电
→ 再执行烧录 + verify
```

以 `slot3` 为例：

```bash
openocd \
  -f interface/stlink.cfg \
  -f target/stm32g4x.cfg \
  -c "adapter speed 100" \
  -c "init" \
  -c "halt" \
  -c "flash write_image erase hipnucimu_slot3.hex" \
  -c "verify_image hipnucimu_slot3.hex" \
  -c "reset run" \
  -c "shutdown"
```

成功重点看：

```text
wrote ... bytes from file hipnucimu_slot3.hex
verified ... bytes
```

只想确认而不重刷，可以使用 `verify_image`。验证完成后建议 reset 或重新断电上电再正式使用。

---

# Part D：烧录 STM32H750 + AX58100

## 11. 下载 ProductCode 0x06 H750 从站固件

当前正式部署优先使用最新 ProductCode 0x06 Release：

[打开 v0.6.1 Release 下载页面](https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/releases/tag/v0.6.1)

当前推荐：

```text
v0.6.1
```

Release 页面当前提供 v0.6.1 固件压缩包附件；以 Release 页面显示的实际附件名为准。下载并解压后，第一次烧 H750 推荐优先使用包内提供的 `.elf`，也可以使用 `.hex`。

### 为什么不再推荐 v0.6.0？

`v0.6.1` 在 ProductCode、EEPROM 和 PDO 布局不变的情况下，修复了 IMU 数据快照一致性问题：

```text
coherent IMU payload + sample sequence publication
ISR-safe double-buffered IMU snapshots
atomic snapshot publication
```

也就是避免出现：

```text
Sample N payload
+
Sample N+1 sequence
```

这种不一致组合。

如果需要最新开发构建，也可以打开：

[打开当前分支的 H750 Actions 构建页面](https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/actions/workflows/build.yml?query=branch%3Afeature%2F6imu-rc-dshot-pdo-v006)

选择当前 `feature/6imu-rc-dshot-pdo-v006` 分支的 `Build ProductCode 0x06 Slave Firmware`，下载 Actions artifact。

> 正式部署优先 Release；调试最新改动时再使用 Actions artifact。

---

## 12. 烧 H750 MCU

CubeProgrammer：

```text
ST-LINK / SWD
→ Connect
→ Open File
→ 选择 v0.6.1 包内 H750 .elf 或 .hex
→ Download
→ Verify
→ Reset
```

这一步只更新：

```text
STM32H750 application firmware
```

还没有更新：

```text
AX58100 EEPROM / ProductCode
```

所以必须继续下一步。

---

# Part E：CAN 和 EtherCAT 物理接线

## 13. CAN 接线

最终：

```text
H750 CAN1
├── C1-S1
├── C1-S2
└── C1-S3

H750 CAN2
├── C2-S1
├── C2-S2
└── C2-S3
```

每条 CAN 都是：

```text
CANH
CANL
GND
```

尽量采用总线结构，不要做很长的星形分叉。

一条 CAN 总线通常只在最远两端放 120Ω。断电测量 CANH 与 CANL，如果两端各一个 120Ω，通常约：

```text
60 Ω
```

具体仍以你的板卡原理图、跳帽和板载终端电阻为准。

---

## 14. EtherCAT 网线

第一次只接一块从站：

```text
Ubuntu PC 独立有线网口
       │
       │ CAT5e/CAT6
       ↓
EtherCAT Slave IN
```

第一次不要串多块 EtherCAT slave。

---

## 15. 找 Master 网卡名字

```bash
ip -br link
```

常见：

```text
enp2s0
enp3s0
enx000ec6c1d02b
```

找到**直接接 Slave IN** 的那个网口。

下面示例统一假设：

```text
EtherCAT NIC = enp3s0
```

你的名字不同就替换。

---

# Part F：刷 ProductCode 0x06 EEPROM

本版本使用 2048-byte AX58100 EEPROM 镜像。

当前板卡的 SII 中没有静态 RxPDO/TxPDO category；81B / 193B 的 process-data mapping 由 H750 上的 SOES / CoE Object Dictionary 动态提供。因此 ProductCode 0x06 EEPROM 基于已知可工作的 0x05 SII，仅修改 ProductCode 字段 `0x05 -> 0x06`，无需为 192B PDO 重新生成静态 SII PDO category。

## 16. 先确认能看到目标从站

```bash
cd ~/ecat_ws/src/EcatV2_Master

chmod +x tools/eepromtool tools/slaveinfo
sudo ./tools/eepromtool enp3s0 1 -i
sudo ./tools/slaveinfo enp3s0
```

如果当前仍是旧 EEPROM，通常会看到：

```text
Product Code     : 00000005
```

在写 EEPROM 前必须能够找到目标 slave。完全找不到 slave 时不要写 EEPROM，先检查网卡、网线、Slave IN、供电和 LINK 状态。

---

## 17. 安全刷 ProductCode 0x06 EEPROM

Master 仓库提供：

```text
eeproms/58100H750_UniversalModule_6IMU_RC_DSHOT.bin
tools/flash_6imu_rc_dshot_eeprom.sh
```

执行：

```bash
cd ~/ecat_ws/src/EcatV2_Master

chmod +x tools/eepromtool tools/flash_6imu_rc_dshot_eeprom.sh
./tools/flash_6imu_rc_dshot_eeprom.sh enp3s0 1
```

脚本会先读取并备份当前 EEPROM，再要求人工输入 `WRITE`，随后写入、完整读回并验证。

输入 `WRITE` 前确认：

```text
interface = enp3s0
slave     = 1
target    = ProductCode 0x00000006
```

成功后检查：

```bash
sudo ./tools/eepromtool enp3s0 1 -i
```

目标：

```text
Product Code     : 00000006
Checksum         : 009C
  calculated     : 009C
Size             : 000F = 2048 bytes
```

### 写完 EEPROM 后必须整块从站彻底断电

不是只 reset H750。

```text
STM32H750 + AX58100 power OFF
等待 2~5 秒
power ON
```

AX58100 会在重新上电后加载 EEPROM/SII。

---

## 18. 最终确认 ProductCode 和 PDO

```bash
cd ~/ecat_ws/src/EcatV2_Master

sudo ./tools/eepromtool enp3s0 1 -i
sudo ./tools/slaveinfo enp3s0
```

最终目标：

```text
Product Code     : 00000006

ID: 00000006
Output size: 648bits
Input size: 1544bits
State: 4

SM2 ... L: 81
SM3 ... L:193
```

也就是：

```text
ProductCode = 0x06
Application M->S = 80 B
Application S->M = 192 B
EtherCAT Outputs = 81 B
EtherCAT Inputs  = 193 B
SAFE_OP 正常
```

后面 ROS 2 Master 正式启动后还应看到：

```text
Found slave id=1, sn=<真实SN>, eepid=6
SDO configured ... sdolen=91
Operational state reached for all slaves.
```

---

# Part G：First Run Test —— 按原仓库方式创建 soem_bringup

这一部分对应原版 [First Run Test 教程](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)。

为了避免小白手改文件出错，6-IMU 分支提供脚本自动完成原版教程最终需要的 bringup package 结构。

## 19. 第一次先用假 SN 创建 bringup package

先假设：

```text
SN = 1234567
```

执行：

```bash
cd ~/ecat_ws/src/EcatV2_Master

chmod +x tools/prepare_6imu_rc_dshot_bringup.sh

./tools/prepare_6imu_rc_dshot_bringup.sh \
  1234567 \
  enp3s0 \
  0 \
  1-7
```

请把：

```text
enp3s0
0
1-7
```

分别替换为你的：

```text
EtherCAT NIC
rt_cpu
non_rt_cpus
```

脚本会自动建立：

```text
~/ecat_ws/src/soem_bringup/
├── CMakeLists.txt
├── package.xml
├── config/
│   └── config.yaml
└── launch/
    └── bringup.launch.py
```

---

## 20. 理解 bringup.launch.py 的作用

最终 launch 文件启动：

```text
package    = soem_wrapper
executable = soem_backend
```

并传入：

```text
interface
rt_cpu
non_rt_cpus
config_file
```

`config_file` 来自：

```text
soem_bringup/config/config.yaml
```

所以：

```text
soem_wrapper  = 真正的 EtherCAT Master 程序
soem_bringup  = 你的项目启动包
```

最终启动命令：

```bash
ros2 launch soem_bringup bringup.launch.py
```

### 当前 Master 新增的 timing 参数

当前 Master 还提供：

```text
sequenced_imu_period_us          默认 3000 us
loop_stall_profile_threshold_us  默认 5000 us
```

这里必须理解清楚：

```text
sequenced_imu_period_us
```

主要用于 Master 判断一次 `RAW PDO GAP` 是否已经达到“可能错过一个 sequenced IMU sample”的时间尺度；它**不会替代 G431/H750 本身的采样与转发频率设置**。

如果本次系统实际按 500 Hz 运行，对应样本周期是：

```text
2000 us
```

这时建议在 `bringup.launch.py` 的 parameters 中显式增加：

```python
'sequenced_imu_period_us': 2000,
```

如果本次测试基线按约 333.33 Hz / 3 ms 运行，则保留默认：

```python
'sequenced_imu_period_us': 3000,
```

不要只根据这个参数推断实际 ROS topic rate；最终还是以真实 `ros2 topic hz` 和从站/bridge 配置为准。

---

## 21. 第一次 colcon build

```bash
cd ~/ecat_ws
source /opt/ros/humble/setup.bash
colcon build
```

成功后：

```bash
source install/setup.bash

ros2 pkg prefix soem_wrapper
ros2 pkg prefix soem_bringup
```

两个命令都应该返回 install 路径。

---

## 22. 第一次启动：故意用假 SN 找真实 SN

打开 root shell：

```bash
sudo su
```

在 root shell 里：

```bash
source /opt/ros/humble/setup.bash
cd /home/<你的用户名>/ecat_ws
source install/setup.bash

ros2 launch soem_bringup bringup.launch.py
```

不要用：

```text
ros2 launch soem_wrapper bringup.launch.py
```

你要找的日志类似：

```text
Found slave id=1, sn=2883658, eepid=6, type=H750UniversalModule (6-IMU + RC + DSHOT)
```

其中：

```text
2883658
```

就是实际 Slave SN。

因为当前 config 还是假 SN `1234567`，后面可能出现 key-not-found/找不到配置，这在**第一次找 SN 的阶段是预期现象**。

---

# Part H：Generate Config File —— 生成最终 config.yaml

这一部分对应原版 [Configuration Generator 教程](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)。

你有两种方法。

## 23A. 推荐：使用 ProductCode 0x06 8-task TaskEditor

在线网页：

[打开 ProductCode 0x06 TaskEditor](https://ssybh2.github.io/EcatV2_Master/)

源码：

[查看 TaskEditor 源码](https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-rc-dshot-pdo-v006/web/6imu-task-editor)

当前 TaskEditor 已经是两页式界面：

```text
01 Module Settings
02 Generated config.yaml
```

### Step 1：Module Settings

输入真实 SN，例如：

```text
2883658
```

默认六个 IMU：

```text
CAN1 Slot1 -> 01/02/03 -> offset 0
CAN1 Slot2 -> 04/05/06 -> offset 21
CAN1 Slot3 -> 07/08/09 -> offset 42

CAN2 Slot1 -> 01/02/03 -> offset 63
CAN2 Slot2 -> 04/05/06 -> offset 84
CAN2 Slot3 -> 07/08/09 -> offset 105
```

默认 topic：

```text
/imu/can1/slot1
/imu/can1/slot2
/imu/can1/slot3
/imu/can2/slot1
/imu/can2/slot2
/imu/can2/slot3
```

当前页面还能直接编辑：

```text
Slave Serial
Latency Topic
IMU CAN ID / topic / frame
DJI RC topic
DShot topic / id / init value / connection lost action
```

### Step 2：确认 Module Settings 状态

确认：

```text
task_count = 8
sdo_len = 91
Slave -> Master = 192B
Master -> Slave = 80B
DJI RC = Task 7 @ read offset 160
DShot  = Task 8 @ write offset 0
```

并且状态为：

```text
Ready
```

不要带着红色 errors 下载最终配置。

### Step 3：打开 Generated config.yaml

点击：

```text
Open Generated config.yaml
```

或者顶部切到：

```text
02 Generated config.yaml
```

这里会显示实时 YAML preview，并提供：

```text
Copy
Download
```

### Step 4：Download config.yaml

下载后放到：

```text
~/ecat_ws/src/soem_bringup/config/config.yaml
```

不是：

```text
src/soem_wrapper/config/
```

配置文件属于 bringup package。

---

## 23B. 更省事：重新运行 helper

如果你使用默认 6-IMU 拓扑：

```bash
cd ~/ecat_ws/src/EcatV2_Master

./tools/prepare_6imu_rc_dshot_bringup.sh \
  2883658 \
  enp3s0 \
  0 \
  1-7
```

它会重新生成：

```text
~/ecat_ws/src/soem_bringup/config/config.yaml
~/ecat_ws/src/soem_bringup/launch/bringup.launch.py
```

并保留旧文件备份。

如果你要进行明确的 500 Hz timing diagnostic 验收，helper 生成完成后再编辑 `bringup.launch.py`，在 parameters 里加入：

```python
'sequenced_imu_period_us': 2000,
```

当前 helper 本身仍保持原来的 4 参数接口。

---

## 24. 再 build 一次

因为 bringup package 的 config/launch 会 install 到 `install/soem_bringup/share/...`，所以每次改完需要：

```bash
cd ~/ecat_ws

source /opt/ros/humble/setup.bash
colcon build
source install/setup.bash
```

---

# Part I：正式启动 EtherCAT Master

## 25. 启动

root shell：

```bash
sudo su
```

然后：

```bash
source /opt/ros/humble/setup.bash
cd /home/<你的用户名>/ecat_ws
source install/setup.bash

ros2 launch soem_bringup bringup.launch.py
```

成功日志重点：

```text
1 slaves found
Found slave id=1, sn=<真实SN>, eepid=6
SDO configured ...
Slaves mapped, state to SAFE_OP.
All slaves reached SAFE_OP, state to OP
Operational state reached for all slaves.
Initialization succeeded
slave id 1 confirmed ready
```

重点是：

```text
eepid=6
SAFE_OP
OP
Initialization succeeded
confirmed ready
```

---

## 26. 检查 ROS 2 topic

另开普通用户终端：

```bash
source /opt/ros/humble/setup.bash
cd ~/ecat_ws
source install/setup.bash

ros2 topic list
```

应该看到：

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

以及 latency topic，例如：

```text
/ecat/sn2883658/latency
```

---

## 27. 先看一个 IMU 是否有真实数据

```bash
ros2 topic echo /imu/can1/slot1 --once
```

正常会看到：

```text
orientation
angular_velocity
linear_acceleration
```

不要只看 topic 名存在；必须确认数值不是一直全 0。

### 同时检查 DJI RC

```bash
ros2 topic echo /dji_rc
ros2 topic hz /dji_rc
```

操作遥控器摇杆、拨杆等控制量，数据应实时变化。

### 检查 DShot ROS 2 接口

```bash
ros2 topic info /dshot -v
ros2 interface show custom_msgs/msg/WriteDSHOT
```

第一次部署先确认 topic/type/QoS 正常。真正进行非零 DShot 输出前，应确保电机、桨叶和执行机构处于安全测试状态。

---

## 28. 检查 IMU 实际频率

先测一个：

```bash
ros2 topic hz /imu/can1/slot1
```

等待几秒。

### 不再把“500 Hz”写死成所有 0x06 系统的唯一标准

正确判断方法是：

```text
ROS topic rate 应稳定接近本次实际部署配置的 IMU 输出频率
```

如果这套真机确实使用 500 Hz bridge / slave 配置：

```text
目标 ≈ 500 Hz
sequenced_imu_period_us 建议 = 2000
```

如果你的当前测试基线是约 333.33 Hz / 3 ms：

```text
目标 ≈ 333.33 Hz
sequenced_imu_period_us = 3000
```

然后六个分别检查：

```bash
ros2 topic hz /imu/can1/slot1
ros2 topic hz /imu/can1/slot2
ros2 topic hz /imu/can1/slot3
ros2 topic hz /imu/can2/slot1
ros2 topic hz /imu/can2/slot2
ros2 topic hz /imu/can2/slot3
```

不要执着于某一秒精确等于目标值；重点是长期稳定、没有持续掉线和大幅波动。

---

# Part J：中文压力测试

完整中英双语版本见：

[ProductCode 0x06 · 6-IMU 压力测试计划](6imu-500hz-test-plan.md)

> 文件名为了兼容旧链接仍保留 `500hz`，但文档内容已按 ProductCode 0x06 / 192B PDO / 当前 Master diagnostics 更新，并区分“实际 500 Hz 测试”和“3 ms timing baseline”。

## 29. 不要第一步就上 6 个

测试顺序：

| 阶段 | 接法 | 最短时间 | 目的 |
| --- | --- | ---: | --- |
| A | CAN1 只接 Slot1 | 5 分钟 | 验证最小链路 |
| B | CAN1 接 Slot1+Slot2 | 10 分钟 | 验证双 IMU |
| C | CAN1 接 Slot1+Slot2+Slot3 | 15~30 分钟 | 重点验证单总线 3 IMU |
| D | CAN1 三个 + CAN2 Slot1 | 10 分钟 | 验证第二路 CAN |
| E | CAN1 三个 + CAN2 两个 | 15 分钟 | 接近满载 |
| F | CAN1 三个 + CAN2 三个 | ≥30 分钟 | 最终满载验收 |

每增加一个 IMU 前，都先确认上一阶段稳定。

---

## 30. 每个阶段都看四类东西

### 30.1 ROS topic rate

```bash
ros2 topic hz <topic>
```

目标：

```text
稳定接近本次实际配置频率
不周期性掉到 0
不随机消失
```

500 Hz 配置就按约 500 Hz 验收；3 ms 基线就按约 333.33 Hz 验收。

### 30.2 数据内容

```bash
ros2 topic echo <topic> --once
```

轻轻转动某个 IMU，确认对应 topic 的姿态/角速度/加速度会变化。

### 30.3 EtherCAT 主站日志

Master 会监测 192B S→M PDO，其中 126..159 是 6-IMU 诊断区。

正常情况下不应该持续出现：

```text
6-IMU CAN RX diagnostics changed
6-IMU #N incomplete P1/P2/P3 sample(s)
6-IMU #N sample sequence jumped
RAW PDO GAP
ECAT LOOP STALL
```

一次启动瞬间 warning 和持续增长/持续出现不是一回事。

### 30.4 物理层

观察：

```text
CAN Bus-Off
从站掉 OP
EtherCAT WKC/state warning
某个 IMU topic 消失
```

---

## 31. 怎么判断问题在哪一层

### 情况 1：H750 FIFO lost/full 增长

如果 Master 日志出现：

```text
6-IMU CAN RX diagnostics changed:
CAN1 lost=...
CAN1 full=...
```

并且数字不断变大：

```text
问题重点 = H750 CAN 接收/FIFO/中断实时性
```

先不要把问题归因于 192B PDO 大小。

### 情况 2：incomplete P1/P2/P3 增长，但 FIFO clean

```text
6-IMU #N incomplete P1/P2/P3 sample(s)
```

而 FIFO lost/full 没增长，说明 H750 没得到完整的：

```text
P1 -> P2 -> P3
```

检查：

```text
IMU bridge TX
→ CAN 接线
→ 终端电阻
→ 共地
→ 收发器供电
```

### 情况 3：IMU bridge can_tx_group_deferred_count 增长

说明前一个样本的 3 个 CAN frame 还没发完，下一个样本又来了。它是 CAN TX 队列/总线负载逼近实际吞吐极限的信号。

### 情况 4：can_tx_fail / Bus-Off 增长

优先检查：

```text
CANH/CANL
两端终端电阻
共地
收发器供电
插头
stub 长度
所有节点 bitrate 是否一致
```

### 情况 5：UART CRC/header/length/tag error 增长

问题发生在：

```text
HI92 -> STM32G431 UART
```

还没到 CAN，更没到 EtherCAT。不要先调 SOEM。

### 情况 6：sample sequence jumped，但 CAN diagnostics clean

```text
6-IMU #N sample sequence jumped by ...
```

而 CAN incomplete/FIFO 都正常，说明 Slave 已经提交了完整样本，但 Master 没观察到每一份样本。

继续检查：

```text
EtherCAT cycle
CPU isolation
实时线程
WKC/state warning
Master CPU load
RAW PDO GAP / ECAT LOOP STALL
```

### 情况 7：出现 RAW PDO GAP

日志类似：

```text
RAW PDO GAP: ... ms between ec_receive_processdata returns; wkc=... expected=...
```

它表示两次 `ec_receive_processdata` 返回之间的间隔已经达到当前 `sequenced_imu_period_us` 所定义的样本风险时间尺度。

判断方法：

```text
WKC 同时异常
→ 优先查 EtherCAT transport / NIC / slave state

WKC 正常
→ 继续结合 ECAT LOOP STALL 判断是不是主机调度/锁等待/抢占造成
```

### 情况 8：出现 ECAT LOOP STALL

当前 Master 会把长周期拆成：

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
WKC
```

重点看：

```text
scheduler_gap 大
→ DATA realtime thread 没及时拿到 CPU 的可能性更高

process_lock_wait 大
→ slave mutex contention 的可能性更高

process_body 很大，但 process_body_cpu 很小
→ process_pdo 内被抢占/阻塞/off-CPU 的可能性更高

process_body_cpu 本身很大
→ 才更像实际 CPU 计算耗时
```

这个诊断比只看总 cycle time 更适合定位当前 Master 的偶发卡顿。

---

# Part K：最终验收标准

## 32. ProductCode 0x06 系统通过的最低标准

满载运行至少 30 分钟：

```text
CAN1 = 3 IMU
CAN2 = 3 IMU
```

并满足：

```text
6 个 IMU ROS topic 都持续存在
6 个 IMU topic 都稳定接近本次实际配置频率
IMU 数据随传感器运动正常变化
DJI RC /dji_rc 数据随遥控器操作正常变化
DShot /dshot ROS 2 接口正常
incomplete counter 不持续增长
CAN FIFO lost 不持续增长
CAN FIFO full 不持续增长
CAN read error 不持续增长
无持续 Bus-Off
无持续 EtherCAT state/WKC 异常
无持续 RAW PDO GAP / ECAT LOOP STALL
Slave 稳定保持 OP
```

如果本次明确按 500 Hz 验收，再额外确认：

```text
6 个 IMU topic 平均频率接近 500 Hz
sequenced_imu_period_us = 2000 us
```

如果只是启动瞬间出现一次非持续 warning，不要立刻判定失败；关键是观察计数和告警是否**持续增长或持续重复**。

---

# Part L：最常用命令速查

## 编译

```bash
cd ~/ecat_ws
source /opt/ros/humble/setup.bash
colcon build
source install/setup.bash
```

## 正式启动

```bash
sudo su

source /opt/ros/humble/setup.bash
cd /home/<你的用户名>/ecat_ws
source install/setup.bash

ros2 launch soem_bringup bringup.launch.py
```

## 查 topic

```bash
ros2 topic list
```

## 看一个 IMU

```bash
ros2 topic echo /imu/can1/slot1 --once
```

## 查频率

```bash
ros2 topic hz /imu/can1/slot1
```

## 查 EtherCAT slave

```bash
cd ~/ecat_ws/src/EcatV2_Master
sudo ./tools/slaveinfo enp3s0
```

## 查 EEPROM

```bash
sudo ./tools/eepromtool enp3s0 1 -i
```

## 生成 soem_bringup

```bash
cd ~/ecat_ws/src/EcatV2_Master

./tools/prepare_6imu_rc_dshot_bringup.sh \
  <真实SN> \
  <EtherCAT网卡> \
  <RT_CPU> \
  <NON_RT_CPUS>
```

## 500 Hz timing diagnostic 时建议额外检查

`bringup.launch.py`：

```python
'sequenced_imu_period_us': 2000,
```

---

# Part M：相关入口

## ProductCode 0x06 · 8-task TaskEditor

[打开 ProductCode 0x06 TaskEditor](https://ssybh2.github.io/EcatV2_Master/)

## TaskEditor 源码

[查看 TaskEditor 源码](https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-rc-dshot-pdo-v006/web/6imu-task-editor)

## Master 分支

[打开 Master feature/6imu-rc-dshot-pdo-v006 分支](https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-rc-dshot-pdo-v006)

## H750 ProductCode 0x06 Releases

[打开 v0.6.1 Release 下载页面](https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/releases/tag/v0.6.1)

当前推荐：`v0.6.1`。

## 原版 AIMEtherCAT 教程

- [Environment Setup（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md)
- [First Run Test（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)
- [Configuration Generator（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)

## 压力测试

[ProductCode 0x06 · 6-IMU 压力测试计划（中英双语）](6imu-500hz-test-plan.md)

## 配置生成器说明

[Configuration Generator](configuration-generator.md)

---

# 最终记住一句话

我们没有改变原仓库的 bringup 思路。

最终结构仍然是：

```text
EcatV2_Master 负责提供 soem_wrapper
soem_bringup   负责你的 config + launch
```

最终启动命令仍然是：

```bash
ros2 launch soem_bringup bringup.launch.py
```
