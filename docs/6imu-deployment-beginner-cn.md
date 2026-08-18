# 6 个 IMU × 500 Hz EtherCAT 部署教程（小白版）

> 目标：在一块 `STM32H750 + AX58100` EtherCAT 从站板上，通过 `CAN1 + CAN2` 接入 6 个 HIPNUC HI92 IMU，每个 IMU 500 Hz，并在 ROS 2 中得到 6 个 `sensor_msgs/msg/Imu` 话题。
>
> 适用分支：
>
> - Master：`ssybh2/EcatV2_Master -> feature/6imu-large-pdo`
> - H750 Slave：`ssybh2/EcatV2_AX58100_H750_Universal -> feature/6imu-large-pdo`
> - HIPNUC bridge：`ssybh2/hipnucimu -> feature/6imu-500hz-stable`

这份教程仿照原版 `docs/first-run-test.md` 的方式编写：**每一步只做一件事，并告诉你看到什么才算成功。**

---

# 0. 最终系统长什么样

```text
CAN1 @ 1 Mbps                       CAN2 @ 1 Mbps
├── IMU1 Slot1 01/02/03            ├── IMU4 Slot1 01/02/03
├── IMU2 Slot2 04/05/06            ├── IMU5 Slot2 04/05/06
└── IMU3 Slot3 07/08/09            └── IMU6 Slot3 07/08/09
              \                     /
               \                   /
                STM32H750 + AX58100
                         │
                     EtherCAT
                         │
                    Ubuntu PC
                         │
                    ROS 2 + SOEM
                         │
                 6 × sensor_msgs/Imu
```

EtherCAT 设备身份：

```text
ProductCode = 0x00000005
Master -> Slave = 80 B
Slave  -> Master = 160 B
```

六个 IMU 一共占 126 B，剩余 34 B 用于诊断。

---

# 1. 准备你要用的 3 个仓库

你只需要使用自己的 Fork，不使用 AIMEtherCAT 原仓库做开发。

```text
Master:
https://github.com/ssybh2/EcatV2_Master
branch: feature/6imu-large-pdo

H750 Slave:
https://github.com/ssybh2/EcatV2_AX58100_H750_Universal
branch: feature/6imu-large-pdo

IMU Bridge:
https://github.com/ssybh2/hipnucimu
branch: feature/6imu-500hz-stable
```

### 成功标准

三个仓库都能看到对应 feature 分支。

---

# 2. 下载 3 种 IMU 固件

打开：

https://github.com/ssybh2/hipnucimu/actions

选择最新一次绿色的：

```text
Build 6-IMU Firmware
```

下载 Artifact：

```text
hipnucimu-500hz-slots
```

解压后应看到：

```text
hipnucimu_slot1.hex
hipnucimu_slot1.bin
hipnucimu_slot2.hex
hipnucimu_slot2.bin
hipnucimu_slot3.hex
hipnucimu_slot3.bin
```

第一次烧录推荐使用 `.hex`。

三种固件对应：

| Firmware | CAN IDs |
| --- | --- |
| `slot1.hex` | `0x01 / 0x02 / 0x03` |
| `slot2.hex` | `0x04 / 0x05 / 0x06` |
| `slot3.hex` | `0x07 / 0x08 / 0x09` |

两条 CAN 总线彼此独立，所以 CAN1 和 CAN2 可以复用同样三套 ID。

---

# 3. 给 6 个 IMU 转接板贴标签

建议先贴标签再烧录：

```text
C1-S1
C1-S2
C1-S3
C2-S1
C2-S2
C2-S3
```

对应关系：

```text
CAN1
C1-S1 -> slot1.hex -> 01/02/03
C1-S2 -> slot2.hex -> 04/05/06
C1-S3 -> slot3.hex -> 07/08/09

CAN2
C2-S1 -> slot1.hex -> 01/02/03
C2-S2 -> slot2.hex -> 04/05/06
C2-S3 -> slot3.hex -> 07/08/09
```

不要再手动进 `main.c` 改 CAN ID。

---

# 4. 烧录 6 个 HIPNUC IMU 转接板

使用 STM32CubeProgrammer + ST-LINK/SWD。

每块板操作：

```text
1. ST-LINK 连接 STM32G431
2. STM32CubeProgrammer 选择 ST-LINK / SWD
3. Connect
4. Open file
5. 选择对应 slotX.hex
6. Download
7. Verify
8. Reset
```

### 成功标准

CubeProgrammer 显示 Program / Verify 成功。

### 如果失败

先检查：

```text
SWDIO
SWCLK
GND
目标板供电
ST-LINK 是否识别
```

---

# 5. 下载并烧录 H750 6-IMU 从站固件

打开：

https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/actions

选择最新绿色：

```text
Build 6-IMU Slave Firmware
```

下载 Artifact：

```text
six-imu-slave-firmware
```

里面应有：

```text
EcatV2_AX58100_H750_Universal.elf
EcatV2_AX58100_H750_Universal.hex
EcatV2_AX58100_H750_Universal.bin
```

第一次烧录推荐直接使用 `.elf` 或 `.hex`。

使用 STM32CubeProgrammer：

```text
1. ST-LINK 连接 H750 SWD
2. Connect
3. Open file
4. 选择 EcatV2_AX58100_H750_Universal.elf
5. Download
6. Verify
7. Reset
```

### 成功标准

H750 固件 Verify 成功。

> 注意：这一步只更新 STM32H750。AX58100 的 EEPROM 身份还没有变成 ProductCode `0x05`，后面还要单独刷 EEPROM。

---

# 6. CAN 硬件接线

最终布局：

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

建议 CAN 使用总线拓扑，不要做很长的星形分叉。

一条 CAN 总线通常只在两个物理最远端各有一个 120 Ω 终端。断电后，如果两端各 120 Ω，并联后 CANH 与 CANL 之间通常应接近：

```text
60 Ω
```

具体仍以你的板子原理图/终端跳帽设计为准。

---

# 7. EtherCAT 第一次只接一块从站

第一次部署不要串多块 EtherCAT 板。

```text
Ubuntu PC 独立有线网口
          │
          │ Cat5e/Cat6
          ↓
EtherCAT Slave IN
```

### 成功标准

网口和从站 LINK 灯正常。

---

# 8. 准备 Ubuntu / ROS 2 环境

本分支 CI 使用 ROS 2 Humble 环境编译通过。推荐第一次部署：

```text
Ubuntu 22.04
ROS 2 Humble
独立 EtherCAT 有线网口
```

实时内核、CPU 隔离等基础配置请先看：

[Environment Setup](environment-setup.md)

如果你只想先验证通信，也可以先完成基础 ROS 2 + 网口环境，再继续做实时优化。

---

# 9. Clone 正确的 Master 分支

在 Ubuntu 终端：

```bash
cd ~
git clone --branch feature/6imu-large-pdo --recursive \
  https://github.com/ssybh2/EcatV2_Master.git EcatV2_6IMU

cd ~/EcatV2_6IMU
git submodule update --init --recursive
```

检查当前分支：

```bash
git branch --show-current
```

应该输出：

```text
feature/6imu-large-pdo
```

如果看到 `main`，先不要继续。

---

# 10. 安装 ROS 依赖

```bash
source /opt/ros/humble/setup.bash
sudo apt update
rosdep update
rosdep install --from-paths src --ignore-src -r -y
```

### 成功标准

`rosdep install` 没有 unresolved dependency 错误。

---

# 11. 找到 EtherCAT 网卡名字

执行：

```bash
ip -br link
```

你可能看到：

```text
enp3s0
enp2s0
enx000ec6c1d02b
```

找出**网线直接连接 EtherCAT Slave IN** 的那张物理网卡。

下面用：

```text
enx000ec6c1d02b
```

举例。你自己的名字不同就替换。

---

# 12. 先用 slaveinfo 验证物理链路

```bash
cd ~/EcatV2_6IMU
chmod +x tools/*
sudo ./tools/slaveinfo enx000ec6c1d02b
```

### 成功标准

至少能发现 `1 slave`。

如果 `slaveinfo` 完全找不到设备，先不要刷 EEPROM，也不要继续 ROS 2。

先检查：

```text
网卡名是否正确
网线是否插 IN
AX58100 是否供电
LINK 灯是否正常
```

---

# 13. 备份并刷 ProductCode 0x05 EEPROM

我们的 EEPROM 文件：

```text
eeproms/58100H750_UniversalModule_6IMU_LargePDOV.bin
```

不要手动直接使用裸 `eepromtool -w`。使用我们准备的安全脚本：

```bash
cd ~/EcatV2_6IMU
chmod +x tools/flash_6imu_eeprom.sh tools/eepromtool

./tools/flash_6imu_eeprom.sh enx000ec6c1d02b 1
```

其中：

```text
enx000ec6c1d02b = EtherCAT 网卡
1                  = 当前从站编号
```

脚本会自动：

```text
检查目标 BIN 是否为 2048 B
检查 ProductCode 是否为 0x05
检查 6IMU_PDO 标记
读取当前 EEPROM
备份完整 EEPROM
要求输入 WRITE
写入新镜像
重新读回
逐字节 cmp 验证
```

只有看到：

```text
EEPROM programming completed and verified.
```

才算成功。

### 刷完必须完全断电重启从站

```text
关从站电源
等待几秒
重新上电
```

不要只重启 ROS 节点。

---

# 14. 再次检查 EtherCAT 从站

重新执行：

```bash
sudo ./tools/slaveinfo enx000ec6c1d02b
```

确认从站仍然能被发现。

ProductCode 0x05 身份由 EEPROM 提供；Master 运行时会注册对应的 80 B / 160 B 模块。

---

# 15. 第一次启动：先用占位 SN 找真实 SN

原版教程也是先启动一次，让 Master 打印真实从站 SN。我们保留同样思路。

先生成一个占位配置：

```bash
cd ~/EcatV2_6IMU
chmod +x tools/prepare_6imu_bringup.sh

./tools/prepare_6imu_bringup.sh \
  1234567 \
  enx000ec6c1d02b \
  1 \
  0,2-15
```

参数含义：

```text
1234567          = 临时占位 SN
EtherCAT 网卡    = enx000ec6c1d02b
RT CPU           = 1
non-RT CPUs      = 0,2-15
```

你的 CPU 隔离配置不同就改后两个参数。

脚本会生成：

```text
src/soem_wrapper/config/dev-config.yaml
src/soem_wrapper/launch/bringup.launch.py
```

---

# 16. 编译 Master

用普通用户编译：

```bash
cd ~/EcatV2_6IMU
source /opt/ros/humble/setup.bash
colcon build
```

### 成功标准

最终看到所有 package build 成功，例如：

```text
custom_msgs    finished
soem           finished
soem_wrapper   finished
```

不要用 root 做日常 `colcon build`。

---

# 17. 第一次启动，读取真实 SN

原项目需要 raw Ethernet 权限，第一次最简单的方式仍然按原版教程使用 root 运行。

打开第二个终端：

```bash
sudo -s
source /opt/ros/humble/setup.bash
source /home/<你的用户名>/EcatV2_6IMU/install/setup.bash
ros2 launch soem_wrapper bringup.launch.py
```

你使用的用户名不是 `<你的用户名>`，请替换。

因为现在 YAML 里的 SN 还是 `1234567`，程序很可能在配置匹配阶段报错，这是**预期行为**。

重点找这一类日志：

```text
Found slave id=1, sn=2883658, eepid=5, type=...
```

把真正的：

```text
sn=2883658
```

记下来。

然后 `Ctrl+C` 停止。

---

# 18. 生成正式 6-IMU 配置

假设真实 SN 是：

```text
2883658
```

重新用普通用户执行：

```bash
cd ~/EcatV2_6IMU

./tools/prepare_6imu_bringup.sh \
  2883658 \
  enx000ec6c1d02b \
  1 \
  0,2-15
```

脚本会自动检查：

```text
sdo_len = 85
task_count = 6
最后一个 pdoread_offset = 105
网卡名
RT CPU
non-RT CPUs
```

### 你也可以用网页生成 YAML

在线 TaskEditor：

**https://ssybh2.github.io/EcatV2_Master/**

源码：

**https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor**

网页会自动固定 6 个 IMU 的 CAN1/CAN2 和 PDO offset，避免手算错误。

---

# 19. 再次 colcon build

因为配置文件已经改变，需要重新安装到 `install/`：

```bash
cd ~/EcatV2_6IMU
source /opt/ros/humble/setup.bash
colcon build
```

然后：

```bash
source install/setup.bash
```

---

# 20. 正式启动 EtherCAT Master

root 终端：

```bash
sudo -s
source /opt/ros/humble/setup.bash
source /home/<你的用户名>/EcatV2_6IMU/install/setup.bash
ros2 launch soem_wrapper bringup.launch.py
```

### 正常启动应该经历

```text
ec_init succeeded
↓
slave detected
↓
SDO configured
↓
SAFE_OP
↓
OP
↓
Initialization succeeded
↓
slave confirmed ready
```

你最想看到的是类似：

```text
Operational state reached for all slaves.
Initialization succeeded
```

如果停在 INIT/PRE-OP/SAFE-OP，不要继续测试 6 个 IMU，先解决 EtherCAT 状态问题。

---

# 21. 检查 6 个 ROS IMU Topic

新开普通用户终端：

```bash
source /opt/ros/humble/setup.bash
source ~/EcatV2_6IMU/install/setup.bash
ros2 topic list
```

默认配置应有：

```text
/imu/can1/slot1
/imu/can1/slot2
/imu/can1/slot3
/imu/can2/slot1
/imu/can2/slot2
/imu/can2/slot3
```

以及从站 latency topic。

---

# 22. 看一个 IMU 的数据

```bash
ros2 topic echo /imu/can1/slot1
```

应该看到标准：

```text
sensor_msgs/msg/Imu
```

包括：

```text
orientation
angular_velocity
linear_acceleration
```

转动对应 IMU 时数据应该变化。

---

# 23. 检查反馈频率

例如：

```bash
ros2 topic hz /imu/can1/slot1
```

稳定后目标应接近：

```text
500 Hz
```

不要要求每一秒都严格等于 500.000 Hz，ROS 调度会有少量波动。

六个都检查：

```bash
ros2 topic hz /imu/can1/slot1
ros2 topic hz /imu/can1/slot2
ros2 topic hz /imu/can1/slot3
ros2 topic hz /imu/can2/slot1
ros2 topic hz /imu/can2/slot2
ros2 topic hz /imu/can2/slot3
```

---

# 24. 不要第一次就 6 个一起上

推荐严格按下面测试：

```text
阶段 1：CAN1 只接 1 个 IMU，运行 >= 5 min
阶段 2：CAN1 接 2 个 IMU，运行 >= 10 min
阶段 3：CAN1 接 3 个 IMU，运行 >= 15 min
阶段 4：CAN1 3 个 + CAN2 1 个
阶段 5：CAN1 3 个 + CAN2 2 个
阶段 6：CAN1 3 个 + CAN2 3 个，运行 >= 30 min
```

每加一个 IMU 前，先确认上一阶段：

```text
ROS topic rate 正常
没有随机掉线
没有持续增长的 incomplete sample
没有 FIFO lost/full
没有 Bus-Off
```

详细压力测试见：

[6-IMU / 500 Hz Test Plan](6imu-500hz-test-plan.md)

---

# 25. 如何判断问题到底在哪里

## 情况 A：H750 FIFO lost/full 增长

更像：

```text
H750 CAN RX 处理不及时
中断延迟过大
CAN 突发压力
```

不是先去怀疑 EtherCAT PDO 长度。

## 情况 B：incomplete_samples 增长，但 FIFO lost/full = 0

说明 H750 没收到完整：

```text
P1 -> P2 -> P3
```

继续往 IMU bridge / CAN 物理层查。

## 情况 C：IMU bridge can_tx_group_deferred_count 增长

说明上一组三个 CAN frame 还没完全腾出发送空间，新 500 Hz sample 又来了。

这说明总线已经接近实际吞吐压力。

## 情况 D：can_tx_fail / Bus-Off 增长

优先检查：

```text
CANH/CANL
120 Ω 终端
共地
收发器供电
线束
stub 长度
1 Mbps 配置是否一致
```

## 情况 E：UART CRC/header/length/tag error 增长

问题在：

```text
HI92 -> STM32G431 UART
```

不是 EtherCAT。

## 情况 F：CAN/IMU 诊断都干净，但 ROS sample_seq 跳

再检查：

```text
EtherCAT 周期
WKC
Master CPU 调度
ROS2 负载
```

---

# 26. 6-IMU TaskEditor 怎么用

在线地址：

**https://ssybh2.github.io/EcatV2_Master/**

源码：

**https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor**

它固定知道：

```text
CAN1 Slot1 -> 01/02/03 -> PDO 0
CAN1 Slot2 -> 04/05/06 -> PDO 21
CAN1 Slot3 -> 07/08/09 -> PDO 42
CAN2 Slot1 -> 01/02/03 -> PDO 63
CAN2 Slot2 -> 04/05/06 -> PDO 84
CAN2 Slot3 -> 07/08/09 -> PDO 105
```

你主要填写：

```text
Slave SN
ROS topic
frame_name
需要调整时的 CAN IDs
```

网页会检查冲突并生成 YAML。

---

# 27. 如果 EEPROM 刷错了怎么办

`flash_6imu_eeprom.sh` 在写之前会自动备份原 EEPROM，备份目录：

```text
eeprom_backups/
```

不要删除第一次成功备份。

如果需要恢复，可用 `eepromtool` 将备份重新写回，再断电重启从站。

---

# 28. 最终成功标准

系统真正部署完成时应该满足：

```text
EtherCAT slave ProductCode = 0x05
EtherCAT 达到 OP
6 个 IMU 都有 ROS topic
每个 IMU topic 约 500 Hz
CAN1 3 个 IMU 稳定
CAN2 3 个 IMU 稳定
incomplete_samples 不持续增长
FIFO lost/full 不持续增长
CAN Bus-Off = 0
UART CRC 错误不持续增长
```

达到这些条件后，才算完成完整的 `6 × IMU @ 500 Hz` 部署。

---

# 29. 你平时真正需要记住的入口

```text
Master branch:
feature/6imu-large-pdo

Online TaskEditor:
https://ssybh2.github.io/EcatV2_Master/

TaskEditor source:
https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor

Beginner deployment tutorial:
docs/6imu-deployment-beginner-cn.md
```
