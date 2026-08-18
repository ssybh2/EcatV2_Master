# 6 个 IMU × 500 Hz EtherCAT 完整部署教程（小白版）

> 这是一份从 **空 Ubuntu 环境** 一直走到 **6 个 HI92 IMU 全部 500 Hz 工作** 的完整教程。
>
> 它不是另起炉灶，而是把原版 AIMEtherCAT 的三条教程路线：
>
> 1. [Environment Setup（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md)
> 2. [First Run Test（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)
> 3. [Configuration Generator（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)
>
> 与我们新增的 **6-IMU 固件、ProductCode 0x05、160B PDO、6-IMU TaskEditor 和压力测试** 合并成一条完整流程。
>
> 最终启动命令与原仓库保持一致：
>
> ```bash
> ros2 launch soem_bringup bringup.launch.py
> ```
>
> 适用分支：
>
> - Master：`ssybh2/EcatV2_Master -> feature/6imu-large-pdo`
> - H750 Slave：`ssybh2/EcatV2_AX58100_H750_Universal -> feature/6imu-large-pdo`
> - HIPNUC bridge：`ssybh2/hipnucimu -> feature/6imu-500hz-stable`

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
ProductCode / eepid = 0x00000005
Master -> Slave PDO = 80 B
Slave  -> Master PDO = 160 B
```

Slave→Master 160B：

```text
0..20     IMU1
21..41    IMU2
42..62    IMU3
63..83    IMU4
84..104   IMU5
105..125  IMU6
126..159  diagnostics
```

六个 IMU 的原始数据占 126B，后 34B 是序号、CAN FIFO 和完整性诊断。

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

我们的 `feature/6imu-large-pdo` CI 当前就是在：

```text
Ubuntu 22.04
ROS 2 Humble
```

完整编译验证，所以这份小白教程优先按：

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

原版特别提醒：如果一个物理核心对应多个逻辑线程，应尽量隔离**完整物理核心**，不要只隔离其中一个 sibling thread。

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

例如建立：

```bash
mkdir -p ~/ecat_ws/src
cd ~/ecat_ws
git init
```

最终我们希望得到：

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
git checkout feature/6imu-large-pdo
git submodule update --init --recursive
```

确认：

```bash
git branch --show-current
```

应该输出：

```text
feature/6imu-large-pdo
```

### 以后更新 Master

如果仍然把它作为父 workspace 的 submodule 管理，可以进入：

```bash
cd ~/ecat_ws/src/EcatV2_Master
git pull
git submodule update --init --recursive
```

不要切回 `main` 来部署本次 6-IMU 版本。

---

## 7. 安装 workspace 依赖

回到 workspace：

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

到这里还不需要 `colcon build`，因为我们后面还要创建 `soem_bringup`。

---

# Part C：烧录 6 个 IMU 转接板

## 8. 下载 3 种 HIPNUC 固件

打开自己的仓库 Actions：

https://github.com/ssybh2/hipnucimu/actions

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

---

## 9. 给 6 个转接板贴标签

先贴：

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

### 成功标准

看到 Program / Verify 成功。

不要再手动修改 `main.c` 的 CAN ID；三种固件已经分别构建好。

---

# Part D：烧录 STM32H750 + AX58100

## 11. 下载 H750 从站固件

打开：

https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/actions

选择 `feature/6imu-large-pdo` 最新绿色：

```text
Build 6-IMU Slave Firmware
```

下载：

```text
six-imu-slave-firmware
```

应包含：

```text
EcatV2_AX58100_H750_Universal.elf
EcatV2_AX58100_H750_Universal.hex
EcatV2_AX58100_H750_Universal.bin
```

第一次推荐 `.elf` 或 `.hex`。

---

## 12. 烧 H750 MCU

CubeProgrammer：

```text
ST-LINK / SWD
→ Connect
→ Open File
→ EcatV2_AX58100_H750_Universal.elf
→ Download
→ Verify
→ Reset
```

### 注意

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

一条 CAN 总线通常只在最远两端放 120Ω。

断电测量 CANH 与 CANL，如果两端各一个 120Ω，通常约：

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

Ubuntu：

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

# Part F：刷 ProductCode 0x05 EEPROM

这一部分对应原版 [Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md) 的 EEPROM 步骤，但我们用安全脚本替代直接 `eepromtool -w`。

## 16. 先确认能看到从站

```bash
cd ~/ecat_ws/src/EcatV2_Master

chmod +x tools/*
sudo ./tools/slaveinfo enp3s0
```

### 成功标准

至少看到一个 EtherCAT slave。

如果显示 0：

```text
先停下来，不要刷 EEPROM。
```

检查：

```text
网卡名
网线是否插 Slave IN
AX58100/H750 是否供电
LINK 灯
```

---

## 17. 安全刷 0x05 EEPROM

第一次只有一块 slave 时，slave id 通常是：

```text
1
```

执行：

```bash
cd ~/ecat_ws/src/EcatV2_Master

chmod +x tools/flash_6imu_eeprom.sh tools/eepromtool
./tools/flash_6imu_eeprom.sh enp3s0 1
```

脚本会：

```text
检查 2048B 镜像
确认 ProductCode = 0x05
确认 6IMU_PDO 标记
读取当前 EEPROM
备份原 EEPROM
要求输入 WRITE
写新 EEPROM
重新读回
逐字节 cmp
再次显示 EEPROM 信息
```

输入 `WRITE` 前再次确认：

```text
interface = enp3s0
slave     = 1
target    = ProductCode 0x00000005
```

### 刷完必须断电重启从站

不是只重启 ROS：

```text
Slave power OFF
等待几秒
Slave power ON
```

---

## 18. 确认 ProductCode

重新执行：

```bash
sudo ./tools/eepromtool enp3s0 1 -i
```

目标：

```text
Product Code: 0x00000005
```

如果还是旧值，先检查是否真的断电重启。

---

# Part G：First Run Test —— 按原仓库方式创建 soem_bringup

这一部分对应原版 [First Run Test 教程](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)。

原版做法是手工：

```text
ros2 pkg create soem_bringup
→ 创建 config/
→ 创建 launch/
→ 修改 CMakeLists.txt
→ 写 config.yaml
→ 写 bringup.launch.py
```

为了避免小白手改文件出错，我们的 6-IMU 分支提供脚本自动完成**同样的最终结构**。

## 19. 第一次先用假 SN 创建 bringup package

我们还不知道板子的真实 SN。

先假设：

```text
SN = 1234567
```

执行：

```bash
cd ~/ecat_ws/src/EcatV2_Master

chmod +x tools/prepare_6imu_bringup.sh

./tools/prepare_6imu_bringup.sh \
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

这就是原仓库 [First Run Test](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md) 的 bringup package，只是我们替你自动生成。

---

## 20. 理解 bringup.launch.py 的作用

最终 launch 文件做的事情是：

```text
启动 package = soem_wrapper
executable    = soem_backend
```

同时传入：

```text
interface
rt_cpu
non_rt_cpus
config_file
```

而 `config_file` 来自：

```text
soem_bringup/config/config.yaml
```

所以注意：

```text
soem_wrapper  = 真正的 EtherCAT Master 程序
soem_bringup  = 你的项目启动包
```

最终命令因此是：

```bash
ros2 launch soem_bringup bringup.launch.py
```

---

## 21. 第一次 colcon build

回 workspace：

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

### workspace 最终结构

```text
ecat_ws/
├── src/
│   ├── EcatV2_Master/
│   │   ├── src/
│   │   │   ├── soem_wrapper/
│   │   │   ├── soem/
│   │   │   └── custom_msgs/
│   │   ├── tools/
│   │   ├── eeproms/
│   │   └── web/
│   │
│   └── soem_bringup/
│       ├── CMakeLists.txt
│       ├── package.xml
│       ├── config/
│       │   └── config.yaml
│       └── launch/
│           └── bringup.launch.py
│
├── build/
├── install/
└── log/
```

---

## 22. 第一次启动：故意用假 SN 找真实 SN

原版教程的关键技巧就是：

> 先让 Master 发现 slave，再从日志读出真实 SN；即使后面因为 YAML 中 SN 不匹配而退出，这次启动仍然有价值。

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

最终正确命令就是：

```bash
ros2 launch soem_bringup bringup.launch.py
```

### 你要找的日志

类似：

```text
Found slave id=1, sn=2883658, eepid=5, type=H750UniversalModule (6-IMU Large PDO V.)
```

其中：

```text
2883658
```

就是实际 Slave SN。

因为当前 config 还是假 SN `1234567`，后面可能出现 key-not-found/找不到配置，这在**第一次找 SN 的阶段是预期现象**。

记下真实 SN。

---

# Part H：Generate Config File —— 生成最终 config.yaml

这一部分对应原版 [Configuration Generator 教程](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)。

你有两种方法。

---

## 23A. 推荐：使用我们的 6-IMU TaskEditor

在线网页：

https://ssybh2.github.io/EcatV2_Master/

源码：

https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor

### Step 1：Module Settings

输入刚才日志得到的真实 SN，例如：

```text
2883658
```

默认六个 IMU 应该是：

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

### Step 2：Config Generator

确认：

```text
task_count = 6
sdo_len = 85
Slave -> Master = 160B
```

并且没有红色错误。

### Step 3：Download config.yaml

点击下载：

```text
config.yaml
```

### Step 4：放进 bringup package

文件应该放到：

```text
~/ecat_ws/src/soem_bringup/config/config.yaml
```

不是：

```text
src/soem_wrapper/config/
```

这点与原仓库 [Configuration Generator](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md) 的思想完全一致：

```text
配置文件属于 bringup package。
```

---

## 23B. 更省事：重新运行 helper

如果你使用默认 6-IMU 拓扑，不想从网页下载：

```bash
cd ~/ecat_ws/src/EcatV2_Master

./tools/prepare_6imu_bringup.sh \
  2883658 \
  enp3s0 \
  0 \
  1-7
```

它会直接重新生成：

```text
~/ecat_ws/src/soem_bringup/config/config.yaml
~/ecat_ws/src/soem_bringup/launch/bringup.launch.py
```

并保留旧文件备份。

---

## 24. 再 build 一次

因为 bringup package 的 config/launch 是 install 到 `install/soem_bringup/share/...` 的，所以每次改完需要：

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

### 成功日志重点

应看到类似：

```text
1 slaves found
Found slave id=1, sn=<真实SN>, eepid=5
SDO configured ...
Slaves mapped, state to SAFE_OP.
All slaves reached SAFE_OP, state to OP
Operational state reached for all slaves.
Initialization succeeded
slave id 1 confirmed ready
```

重点是：

```text
eepid=5
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

---

## 28. 检查 500 Hz

例如：

```bash
ros2 topic hz /imu/can1/slot1
```

等待几秒。

目标：

```text
average rate 接近 500 Hz
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

不要执着于每一秒精确 `500.000 Hz`；重点是稳定接近目标，而且没有持续掉线/大幅波动。

---

# Part J：中文压力测试

完整中英双语版本见：

[6-IMU / 500 Hz 压力测试计划](6imu-500hz-test-plan.md)

这里给第一次部署所需的中文执行顺序。

## 29. 不要第一步就上 6 个

测试顺序：

| 阶段 | 接法 | 最短时间 | 目的 |
| --- | --- | ---: | --- |
| A | CAN1 只接 Slot1 | 5 分钟 | 验证最小链路 |
| B | CAN1 接 Slot1+Slot2 | 10 分钟 | 验证双 IMU |
| C | CAN1 接 Slot1+Slot2+Slot3 | 15~30 分钟 | **重点验证单总线 3×500Hz** |
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
接近 500 Hz
稳定
不周期性掉到 0
```

### 30.2 数据内容

```bash
ros2 topic echo <topic> --once
```

轻轻转动某个 IMU，确认对应 topic 的姿态/角速度/加速度会变化。

### 30.3 EtherCAT 主站日志

我们的 Master 会监测 160B PDO 诊断区。

正常情况下不应该持续出现：

```text
6-IMU CAN RX diagnostics changed
6-IMU #N incomplete P1/P2/P3 sample(s)
6-IMU #N sample sequence jumped
```

这些 warning 的含义见后面。

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

先不要怀疑 160B PDO。

### 情况 2：incomplete P1/P2/P3 增长，但 FIFO clean

日志：

```text
6-IMU #N incomplete P1/P2/P3 sample(s)
```

而 FIFO lost/full 没增长：

```text
H750 没得到完整的 P1 -> P2 -> P3
```

检查顺序：

```text
IMU bridge TX
→ CAN 接线
→ 终端电阻
→ 共地
→ 收发器供电
```

### 情况 3：IMU bridge can_tx_group_deferred_count 增长

说明：

```text
前一个样本的 3 个 CAN frame 还没发完
下一个 2ms 样本又来了
```

这说明该 CAN 总线已经开始逼近实际吞吐极限。

### 情况 4：can_tx_fail / Bus-Off 增长

优先检查物理 CAN：

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

这说明错误发生在：

```text
HI92 -> STM32G431 UART
```

还没到 CAN，更没到 EtherCAT。

不要先调 SOEM。

### 情况 6：sample sequence jumped，但 CAN diagnostics clean

Master 日志：

```text
6-IMU #N sample sequence jumped by ...
```

而 CAN incomplete/FIFO 都正常：

```text
Slave 已经正确提交了样本，
但 Master 没观察到每一份样本。
```

检查：

```text
EtherCAT cycle
CPU isolation
实时线程
WKC/state warning
Master CPU load
```

---

# Part K：最终验收标准

## 32. 6-IMU 系统通过的最低标准

满载运行至少 30 分钟：

```text
CAN1 = 3 IMU
CAN2 = 3 IMU
```

并满足：

```text
6 个 ROS topic 都持续存在
6 个 topic 都接近 500 Hz
数据随传感器运动正常变化
incomplete counter 不持续增长
CAN FIFO lost 不持续增长
CAN FIFO full 不持续增长
CAN read error 不持续增长
无持续 Bus-Off
无持续 EtherCAT state/WKC 异常
Slave 稳定保持 OP
```

如果只是在启动瞬间出现一次非持续 warning，不要立刻判定失败；关键是观察计数是否**持续增长**。

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

./tools/prepare_6imu_bringup.sh \
  <真实SN> \
  <EtherCAT网卡> \
  <RT_CPU> \
  <NON_RT_CPUS>
```

---

# Part M：相关入口

## 6-IMU TaskEditor

https://ssybh2.github.io/EcatV2_Master/

## TaskEditor 源码

https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor

## Master 分支

https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo

## 原版 AIMEtherCAT 教程

- [Environment Setup（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md)
- [First Run Test（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)
- [Configuration Generator（原版）](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)

## 压力测试

[6-IMU / 500 Hz 压力测试计划（中英双语）](6imu-500hz-test-plan.md)

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

最终启动命令永远是：

```bash
ros2 launch soem_bringup bringup.launch.py
```
