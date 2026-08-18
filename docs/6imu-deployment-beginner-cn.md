# 6 个 IMU × 500 Hz EtherCAT 部署教程（小白版）

> 适用版本：`feature/6imu-large-pdo` / `feature/6imu-500hz-stable`
>
> 目标：在一块 `STM32H750 + AX58100` EtherCAT 从站板上，使用 **CAN1 挂 3 个 HI92 IMU、CAN2 挂 3 个 HI92 IMU**，共 6 个 IMU，每个 IMU 以 **500 Hz** 向 ROS 2 Master 提供数据。
>
> 这份教程按“第一次接触这套系统也能照着做”的方式编写。不要跳步骤，尤其不要一开始就同时接 6 个 IMU。

---

## 0. 先看懂整套系统

你最终要搭出来的是：

```text
CAN1 @ 1 Mbps
├── IMU1：Slot1，CAN ID = 0x01 / 0x02 / 0x03
├── IMU2：Slot2，CAN ID = 0x04 / 0x05 / 0x06
└── IMU3：Slot3，CAN ID = 0x07 / 0x08 / 0x09

CAN2 @ 1 Mbps
├── IMU4：Slot1，CAN ID = 0x01 / 0x02 / 0x03
├── IMU5：Slot2，CAN ID = 0x04 / 0x05 / 0x06
└── IMU6：Slot3，CAN ID = 0x07 / 0x08 / 0x09

              6 × HI92
                 │
          两路 1 Mbps CAN
                 │
                 ↓
        STM32H750 + AX58100
                 │
              EtherCAT
                 │
                 ↓
          Ubuntu + ROS 2
                 │
                 ↓
           EcatV2_Master
                 │
                 ↓
          6 个 sensor_msgs/Imu
```

两条 CAN 总线是相互独立的，因此 **CAN1 和 CAN2 可以重复使用 Slot1/Slot2/Slot3 的 CAN ID**。

---

## 1. 你到底需要下载哪些东西？

### 1.1 IMU 转 CAN 小板固件：需要 3 种

仓库：

```text
https://github.com/ssybh2/hipnucimu
branch: feature/6imu-500hz-stable
```

需要：

```text
hipnucimu_slot1.hex
hipnucimu_slot2.hex
hipnucimu_slot3.hex
```

`.bin` 也会一起生成，但如果你使用 STM32CubeProgrammer，第一次部署建议直接使用 `.hex`，因为地址信息已经包含在文件中。

三个版本的 CAN ID：

```text
Slot1 → 0x01 / 0x02 / 0x03
Slot2 → 0x04 / 0x05 / 0x06
Slot3 → 0x07 / 0x08 / 0x09
```

注意：**不是 6 种固件，而是 3 种固件烧两遍。**

```text
CAN1：Slot1 + Slot2 + Slot3
CAN2：Slot1 + Slot2 + Slot3
```

当前已验证的 GitHub Actions：

```text
https://github.com/ssybh2/hipnucimu/actions/runs/32112823947
```

Artifact 名称：

```text
hipnucimu-500hz-slots
```

---

### 1.2 STM32H750 EtherCAT 从站固件：需要 1 个

仓库：

```text
https://github.com/ssybh2/EcatV2_AX58100_H750_Universal
branch: feature/6imu-large-pdo
```

第一次部署建议使用：

```text
EcatV2_AX58100_H750_Universal.elf
```

这是 **STM32H750 的程序**。

它不是 AX58100 EEPROM 文件，千万不要把两者搞混。

当前已验证的 GitHub Actions：

```text
https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/actions/runs/32112834073
```

---

### 1.3 AX58100 EEPROM：需要 1 个

这个文件已经放在 Master 仓库：

```text
eeproms/58100H750_UniversalModule_6IMU_LargePDOV.bin
```

它的 EtherCAT ProductCode 是：

```text
0x00000005
```

它告诉 EtherCAT Master：

```text
我是新的 6-IMU Large PDO 设备
Master -> Slave = 80 Bytes
Slave  -> Master = 160 Bytes
```

这个 `.bin` **不是 STM32H750 固件**，它是写入 EtherCAT 从站 EEPROM 的 SII 镜像。

---

### 1.4 Master 不需要下载“固件”

Master 是 Ubuntu 上运行的 ROS 2 / SOEM 软件。

仓库：

```text
https://github.com/ssybh2/EcatV2_Master
branch: feature/6imu-large-pdo
```

不要用 `main` 部署这次 6-IMU 测试版。

---

## 2. 给 6 个 IMU 做物理标签

强烈建议在烧录之前给 6 个 IMU 转接板贴标签。

```text
C1-S1
C1-S2
C1-S3
C2-S1
C2-S2
C2-S3
```

对应：

| 物理标签 | 接在哪一路 CAN | 烧哪个固件 | CAN IDs |
| --- | --- | --- | --- |
| C1-S1 | CAN1 | slot1 | 01/02/03 |
| C1-S2 | CAN1 | slot2 | 04/05/06 |
| C1-S3 | CAN1 | slot3 | 07/08/09 |
| C2-S1 | CAN2 | slot1 | 01/02/03 |
| C2-S2 | CAN2 | slot2 | 04/05/06 |
| C2-S3 | CAN2 | slot3 | 07/08/09 |

这样后面某个 IMU 有问题时，你不会搞不清它到底是哪一个 CAN ID。

---

## 3. 烧录 6 个 hipnucimu 转接板

### 3.1 打开 STM32CubeProgrammer

把 ST-LINK/SWD 接到第一个 hipnucimu 转接板。

确认目标 MCU 是转接板上的 STM32G431。

### 3.2 连接 MCU

在 STM32CubeProgrammer 中：

```text
选择 ST-LINK
Port = SWD
Connect
```

### 3.3 选择正确的 HEX

例如烧 `C1-S1`：

```text
hipnucimu_slot1.hex
```

然后执行 Download / Program。

看到 Verify 成功才算完成。

### 3.4 六块板的烧录关系

```text
C1-S1 → slot1.hex
C1-S2 → slot2.hex
C1-S3 → slot3.hex

C2-S1 → slot1.hex
C2-S2 → slot2.hex
C2-S3 → slot3.hex
```

不要自己进入 `main.c` 手动改 CAN ID。

我们已经把 3 个 Slot 做成独立构建版本了。

### 3.5 500 Hz 在哪里？

当前稳定分支按照 2 ms 的转发周期工作：

```text
2 ms → 500 Hz
```

同时增加了 UART 完整帧/CRC 检查以及 CAN 发送保护。

---

## 4. 烧录 STM32H750 EtherCAT 从站固件

这一步烧的是：

```text
EcatV2_AX58100_H750_Universal.elf
```

### 4.1 连接 H750 的 SWD

```text
ST-LINK
  ↓
SWDIO
SWCLK
GND
  ↓
STM32H750
```

### 4.2 STM32CubeProgrammer

```text
Connect
→ Open file
→ 选择 EcatV2_AX58100_H750_Universal.elf
→ Download
→ Verify
→ Reset
```

ELF 自己带地址信息，所以第一次测试不用自己填写 Flash 起始地址。

### 4.3 这一步成功只代表 MCU 固件已经更新

这时候 **AX58100 EEPROM 还没有变成 ProductCode 0x05**。

所以还必须继续做下一步。

---

## 5. CAN 硬件接线

### 5.1 CAN1

```text
H750 CAN1
  │
  ├── C1-S1
  ├── C1-S2
  └── C1-S3
```

### 5.2 CAN2

```text
H750 CAN2
  │
  ├── C2-S1
  ├── C2-S2
  └── C2-S3
```

### 5.3 一般 CAN 接线规则

每条 CAN 总线应该形成一条总线，而不是长星形分叉。

正常情况下只在一条 CAN 物理总线的两个最远端使用 120 Ω 终端电阻。

断电后，如果两端都是 120 Ω，通常在 CANH 和 CANL 之间测到约：

```text
60 Ω
```

不要给每一个 IMU 都额外并一个 120 Ω。

如果你的具体硬件已经带可开关终端电阻，以实际原理图/跳帽设置为准。

---

## 6. EtherCAT 网线怎么接

第一次只接一块从站：

```text
Ubuntu 主站电脑独立网口
          │
       网线
          │
          ↓
   EtherCAT Slave IN
```

不要把第一次测试做得太复杂。

先不要串第二块 EtherCAT 从站。

---

## 7. 准备 Ubuntu Master

这套 6-IMU 分支已经在 GitHub CI 使用 **Ubuntu 22.04 / ROS 2 Humble** 完整编译通过。

如果你的实时内核、CPU 隔离还没有配置，先看：

[Environment Setup](environment-setup.md)

本教程下面假设：

```text
Ubuntu 22.04
ROS 2 Humble
EtherCAT 独立有线网口
```

---

## 8. 下载正确的 Master 分支

为了第一次部署最简单，可以直接把这个仓库当一个 ROS 2 workspace：

```bash
cd ~
git clone --branch feature/6imu-large-pdo --recursive \
  https://github.com/ssybh2/EcatV2_Master.git EcatV2_6IMU

cd ~/EcatV2_6IMU
git submodule update --init --recursive
```

确认当前分支：

```bash
git branch --show-current
```

应该看到：

```text
feature/6imu-large-pdo
```

---

## 9. 安装/检查 ROS 依赖

```bash
source /opt/ros/humble/setup.bash

sudo apt update
rosdep update
rosdep install --from-paths src --ignore-src -r -y
```

如果你的系统第一次使用 colcon，还需要确保已经安装常用 ROS 2 构建工具。

---

## 10. 找到 EtherCAT 网卡名字

执行：

```bash
ip -br link
```

常见名字例如：

```text
enp3s0
enp2s0
enx000ec6c1d02b
```

你要找的是 **网线直接连接 EtherCAT Slave IN 的那个物理网口**。

下面教程用：

```text
enx000ec6c1d02b
```

举例。

你自己的名字不一样就替换掉。

---

## 11. 先检查电脑能不能看到 EtherCAT 从站

在 Master 仓库根目录：

```bash
cd ~/EcatV2_6IMU
chmod +x tools/*
```

然后：

```bash
sudo ./tools/slaveinfo enx000ec6c1d02b
```

如果完全找不到从站，先不要刷 EEPROM，也不要继续 ROS 2。

先检查：

```text
网口是不是选错
网线是不是插 IN
AX58100 有没有供电
EtherCAT LINK 灯是否正常
```

---

## 12. 安全刷 ProductCode 0x05 EEPROM

### 12.1 第一次测试只有一块 EtherCAT 从站

那么它的 slave number 通常是：

```text
1
```

### 12.2 使用我们新增的安全脚本

不要直接手敲 `eepromtool -w`。

执行：

```bash
cd ~/EcatV2_6IMU
chmod +x tools/flash_6imu_eeprom.sh tools/eepromtool

./tools/flash_6imu_eeprom.sh enx000ec6c1d02b 1
```

这个脚本会自动：

```text
检查目标 EEPROM 镜像
确认 ProductCode = 0x05
       ↓
读取当前 EEPROM 信息
       ↓
完整备份原 EEPROM
       ↓
要求你手动输入 WRITE
       ↓
刷写新 EEPROM
       ↓
重新读取
       ↓
逐字节比较
```

脚本内部已经固定目标文件：

```text
eeproms/58100H750_UniversalModule_6IMU_LargePDOV.bin
```

### 12.3 输入 WRITE 前再看一次目标

一定确认：

```text
interface = 你真正的 EtherCAT 网口
slave     = 你真正想刷的从站编号
ProductCode target = 0x00000005
```

### 12.4 刷完必须彻底断电重启 EtherCAT 从站

不是只重启 ROS 节点。

建议：

```text
关从站电源
等待几秒
重新上电
```

---

## 13. 确认 EEPROM 已经变成 0x05

重新执行：

```bash
sudo ./tools/eepromtool enx000ec6c1d02b 1 -i
```

目标：

```text
ProductCode = 0x00000005
```

也可以再次执行：

```bash
sudo ./tools/slaveinfo enx000ec6c1d02b
```

确认从站仍然能正常被找到。

---

## 14. 找到真实的 Slave SN

Master 的 YAML 使用 **从站 Serial Number** 作为配置键。

如果 `slaveinfo` 的输出中已经能清楚看到 SN，直接记下来。

如果你不确定哪个数字是 SN，可以按原项目 `first-run-test.md` 的方法：先用一个临时 SN 启动一次 Master，Master 会在配置失败之前打印真实发现的信息：

```text
Found slave id=1, sn=XXXXXXX, eepid=5, ...
```

这个 `XXXXXXX` 就是后面要使用的真实 SN。

参考原教程：

[First Run Test](first-run-test.md)

---

## 15. 一键生成 6-IMU Master 配置

这是这次新增的重要工具之一。

不要自己手动复制 6 个 task。

命令格式：

```bash
./tools/prepare_6imu_bringup.sh \
  <slave-serial> \
  <ethercat-interface> \
  <rt-cpu> \
  <non-rt-cpus>
```

例如：

```bash
cd ~/EcatV2_6IMU
chmod +x tools/prepare_6imu_bringup.sh

./tools/prepare_6imu_bringup.sh \
  2883658 \
  enx000ec6c1d02b \
  1 \
  0,2-15
```

这只是例子。

你必须替换：

```text
2883658          → 你的真实 Slave SN
enx000ec6c1d02b  → 你的 EtherCAT 网口
1                → 你的 RT CPU
0,2-15           → 你的 non-RT CPUs
```

脚本会自动生成：

```text
src/soem_wrapper/config/dev-config.yaml
src/soem_wrapper/launch/bringup.launch.py
```

而且会自动检查：

```text
sdo_len = 85
task_count = 6
最后一个 PDO offset = 105
```

---

## 16. 6 个 IMU 在 Master 里的配置关系

你不用手改，但需要知道它是怎么排的：

```text
IMU1 → PDO offset 0
IMU2 → PDO offset 21
IMU3 → PDO offset 42
IMU4 → PDO offset 63
IMU5 → PDO offset 84
IMU6 → PDO offset 105
```

因为每个 IMU 占：

```text
21 Bytes
```

六个就是：

```text
6 × 21 = 126 Bytes
```

---

## 17. 新的 160B Slave -> Master PDO

ProductCode `0x05` 使用：

```text
Master -> Slave = 80 Bytes
Slave  -> Master = 160 Bytes
```

160B 的布局：

| Bytes | 内容 |
| --- | --- |
| 0..20 | IMU1 |
| 21..41 | IMU2 |
| 42..62 | IMU3 |
| 63..83 | IMU4 |
| 84..104 | IMU5 |
| 105..125 | IMU6 |
| 126..137 | 6 个 sample_seq |
| 138..149 | 6 个 incomplete sample counter |
| 150..151 | CAN1 FIFO lost |
| 152..153 | CAN2 FIFO lost |
| 154..155 | CAN1 FIFO full |
| 156..157 | CAN2 FIFO full |
| 158 | CAN1 read error |
| 159 | CAN2 read error |

前 126B 是数据，后 34B 是诊断信息。

---

## 18. 编译 Master

一定在普通用户终端编译，不建议 root 编译。

```bash
cd ~/EcatV2_6IMU
source /opt/ros/humble/setup.bash

colcon build
```

看到类似：

```text
Summary: ... packages finished
```

并且没有 `Failed`，才继续。

然后：

```bash
source install/setup.bash
```

---

## 19. 启动 EtherCAT Master

这个项目需要 raw Ethernet / 实时调度权限，原项目通常使用 root 运行。

建议保留两个终端：

```text
终端 A：普通用户，用来 build
终端 B：root，用来运行 EtherCAT
```

在终端 B：

```bash
cd ~/EcatV2_6IMU
sudo su
source /opt/ros/humble/setup.bash
source install/setup.bash
ros2 launch soem_wrapper bringup.launch.py
```

正常启动时，你重点找这些意思的输出：

```text
发现 EtherCAT slave
ProductCode / eepid = 5
PDO mapping 成功
SAFE_OP
OP
Initialization succeeded
slave confirmed ready
```

如果停在 INIT / PRE-OP / SAFE-OP，不要直接接更多 IMU。

先解决 EtherCAT 状态问题。

---

## 20. 成功以后应该出现哪 6 个 ROS 2 话题？

```text
/imu/can1/slot1
/imu/can1/slot2
/imu/can1/slot3
/imu/can2/slot1
/imu/can2/slot2
/imu/can2/slot3
```

检查：

```bash
ros2 topic list | grep '^/imu/'
```

应该看到 6 个。

---

## 21. 第一次不要直接接 6 个 IMU

严格按下面顺序测试。

### Test 1：CAN1 只接 Slot1

```text
CAN1: C1-S1
CAN2: 空
```

至少跑 5 分钟。

查看：

```bash
ros2 topic hz /imu/can1/slot1
```

目标接近：

```text
500 Hz
```

同时：

```bash
ros2 topic echo /imu/can1/slot1 --once
```

确认四元数、加速度、角速度不是一直全 0。

### Test 2：CAN1 接 2 个

```text
C1-S1 + C1-S2
```

跑至少 10 分钟。

### Test 3：CAN1 接满 3 个

```text
C1-S1 + C1-S2 + C1-S3
```

跑至少 15 分钟。

这一步非常重要，因为你之前的问题就是单 CAN 上两个 IMU 已经偶发掉线。

### Test 4 ~ 6

继续：

```text
CAN1 3 + CAN2 1
CAN1 3 + CAN2 2
CAN1 3 + CAN2 3
```

全部 6 个以后至少跑 30 分钟。

完整压力测试说明：

[6-IMU 500 Hz Test Plan](6imu-500hz-test-plan.md)

---

## 22. 如何判断到底是哪一层丢数据？

这是这次软件升级最重要的意义。

### 情况 A：H750 的 FIFO lost/full 增加

```text
CAN1/2 FIFO lost > 0
或者
CAN1/2 FIFO full > 0
```

说明 H750 的 CAN 接收端出现压力/丢帧。

优先查：

```text
中断负载
CAN 收包速度
FIFO
CPU 调度
```

### 情况 B：incomplete sample 增加，但是 FIFO lost = 0

说明 H750 没收到完整的：

```text
P1 → P2 → P3
```

优先继续往 IMU 发送端/CAN 物理层查。

### 情况 C：IMU 的 can_tx_group_deferred_count 一直增加

说明：

```text
上一组 CAN 包还没发完
下一次 2 ms 样本已经到了
```

这表示总线正在逼近实际吞吐能力。

### 情况 D：Bus-Off / CAN TX fail 增加

优先检查硬件：

```text
120 Ω 终端
CANH/CANL
线束
接插件
共地
CAN 收发器供电
stub 太长
```

### 情况 E：UART CRC/header/length/tag error 增加

这表示问题甚至还没到 CAN：

```text
HI92
 ↓ UART
STM32G431
```

这一段就已经接收异常。

---

## 23. 为什么 ROS 不再重复发布同一个 IMU 样本？

旧 Master 可能在每个 EtherCAT 周期都重复 publish 同一份 500 Hz IMU 数据。

现在 160B PDO 中带：

```text
sample_seq
```

Master 只有看到 seq 变化才 publish。

因此：

```text
EtherCAT 可以运行得比 500 Hz 更快
但 ROS IMU topic 只跟真实的新 IMU 样本走
```

---

## 24. 如果刷错 EEPROM，怎么恢复？

我们的安全脚本会自动在：

```text
eeprom_backups/
```

保存刷写前镜像，例如：

```text
slave1_20260818_XXXXXX_before_6imu.bin
```

需要恢复时，先确定文件是正确备份，然后可以用 `eepromtool` 写回：

```bash
sudo ./tools/eepromtool \
  enx000ec6c1d02b \
  1 \
  -w eeprom_backups/你的备份文件.bin
```

写完同样需要给 EtherCAT 从站彻底断电再上电。

---

## 25. 最常见的几个错误

### `No slaves found`

先看：

```text
网卡名字
网线
IN/OUT 是否插反
从站供电
AX58100 LINK
```

### 找到 slave，但 Master 报找不到配置 key

大概率：

```text
YAML 里的 SN ≠ 实际 Slave SN
```

重新运行：

```bash
./tools/prepare_6imu_bringup.sh ...
```

然后重新：

```bash
colcon build
```

### 只看到部分 IMU topic

确认：

```text
6 个 task 是否全部生成
对应 IMU 是否接在正确 CAN
Slot 固件有没有烧错
```

### IMU topic 有，但是频率很低/不稳定

先不要怀疑 EtherCAT。

按照第 22 节看诊断计数，从最靠近数据源的一层开始排。

---

## 26. 这次 6-IMU 分支相对原版主要新增了什么？

### hipnucimu

```text
3 个固定 CAN ID Slot
500 Hz 转发
UART ReceiveToIdle 半包保护
5A A5 / LEN / CRC-16 / 0x92 校验
CAN 自动重发
完整三帧 TX 空间检查
TX fail / deferred / Bus-Off 诊断
```

### H750 Slave

```text
CAN RX FIFO 10 → 32
一次中断清空 FIFO
P1/P2/P3 完整后才 commit
CAN FIFO lost/full/read error 统计
6-IMU sample_seq
6-IMU incomplete sample 统计
ProductCode 0x05
160B Slave -> Master PDO
Buffer 边界保护
启动阶段 task-list/CAN 中断竞态保护
```

### Master

```text
注册 ProductCode 0x05
80B -> 160B PDO
6 IMU YAML 模板
根据 sample_seq 只发布真实新数据
CAN/IMU 诊断日志
安全 EEPROM 刷写脚本
一键生成 6-IMU bringup 配置脚本
GitHub Actions 自动构建验证
```

---

## 27. 当前版本状态

在正式真机验证完成之前，请继续使用 feature 分支：

```text
ssybh2/hipnucimu
└── feature/6imu-500hz-stable

ssybh2/EcatV2_AX58100_H750_Universal
└── feature/6imu-large-pdo

ssybh2/EcatV2_Master
└── feature/6imu-large-pdo
```

不要为了方便提前 merge 到 `main`。

软件 CI 已经分别验证过：

```text
3 个 hipnucimu Slot 固件编译       PASS
H750 + AX58100 从站固件编译        PASS
ROS 2 Humble / SOEM Master 编译    PASS
6-IMU helper scripts               PASS
```

接下来真正决定“稳定不稳定”的，是分级真机压力测试。

---

## 28. 最短部署清单

如果你以后已经熟悉了，可以只看这里：

```text
[ ] C1-S1 / C2-S1 → slot1.hex
[ ] C1-S2 / C2-S2 → slot2.hex
[ ] C1-S3 / C2-S3 → slot3.hex

[ ] H750 → EcatV2_AX58100_H750_Universal.elf

[ ] PC NIC → EtherCAT Slave IN
[ ] slaveinfo 能发现从站

[ ] flash_6imu_eeprom.sh → ProductCode 0x05
[ ] 从站断电重启
[ ] eepromtool -i 确认 0x05

[ ] 获取真实 Slave SN
[ ] prepare_6imu_bringup.sh
[ ] colcon build
[ ] source install/setup.bash
[ ] ros2 launch soem_wrapper bringup.launch.py

[ ] 1 IMU 测试
[ ] 2 IMU 测试
[ ] CAN1 3 IMU 测试
[ ] 两路共 6 IMU 测试
[ ] 所有 drop/error 计数保持正常
```

---

## 相关教程

- [环境配置：Environment Setup](environment-setup.md)
- [原版第一次启动教程：First Run Test](first-run-test.md)
- [配置生成教程：Configuration Generator](configuration-generator.md)
- [6-IMU 简版 Bringup](6imu-bringup.md)
- [6-IMU 500 Hz 压力测试计划](6imu-500hz-test-plan.md)
