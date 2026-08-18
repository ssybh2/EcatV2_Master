# 6-IMU / 500 Hz Bringup Guide

> 这是简版检查表。第一次部署请优先看：
>
> [6 个 IMU × 500 Hz EtherCAT 完整部署教程（小白版）](6imu-deployment-beginner-cn.md)

## Target

```text
ProductCode = 0x00000005
Master -> Slave = 80B
Slave  -> Master = 160B
CAN1 = 3 × HIPNUC @ 500 Hz
CAN2 = 3 × HIPNUC @ 500 Hz
```

最终 ROS 2 启动结构继续遵循原版 `first-run-test.md`：

```text
<workspace>/src/
├── EcatV2_Master/
└── soem_bringup/
    ├── CMakeLists.txt
    ├── package.xml
    ├── config/config.yaml
    └── launch/bringup.launch.py
```

最终启动命令：

```bash
ros2 launch soem_bringup bringup.launch.py
```

---

## 1. 使用匹配的软件分支

```text
Master:
ssybh2/EcatV2_Master
feature/6imu-large-pdo

H750 Slave:
ssybh2/EcatV2_AX58100_H750_Universal
feature/6imu-large-pdo

G431 HIPNUC bridge:
ssybh2/hipnucimu
feature/6imu-500hz-stable
```

---

## 2. 烧 3 种 IMU 固件

```text
slot1 -> 01/02/03
slot2 -> 04/05/06
slot3 -> 07/08/09
```

CAN1 与 CAN2 各使用一套 Slot1/2/3。

---

## 3. 烧 H750 6-IMU 固件

从 H750 仓库 Actions 下载：

```text
six-imu-slave-firmware
```

烧入 STM32H750。

---

## 4. 刷 AX58100 ProductCode 0x05 EEPROM

```bash
cd <workspace>/src/EcatV2_Master
chmod +x tools/flash_6imu_eeprom.sh tools/eepromtool

./tools/flash_6imu_eeprom.sh <EtherCAT网卡> 1
```

完成后彻底断电重启 slave。

确认：

```bash
sudo ./tools/eepromtool <EtherCAT网卡> 1 -i
```

目标：

```text
ProductCode = 0x00000005
```

---

## 5. 创建 soem_bringup

第一次不知道真实 SN 时，可以先用假 SN：

```bash
cd <workspace>/src/EcatV2_Master

./tools/prepare_6imu_bringup.sh \
  1234567 \
  <EtherCAT网卡> \
  <RT_CPU> \
  <NON_RT_CPUS>
```

脚本自动创建：

```text
<workspace>/src/soem_bringup/
├── CMakeLists.txt
├── package.xml
├── config/config.yaml
└── launch/bringup.launch.py
```

---

## 6. Build

```bash
cd <workspace>
source /opt/ros/humble/setup.bash

colcon build
source install/setup.bash
```

---

## 7. First Run：读取真实 SN

在 root/raw-socket-capable 环境中：

```bash
source /opt/ros/humble/setup.bash
cd <workspace>
source install/setup.bash

ros2 launch soem_bringup bringup.launch.py
```

从日志找到：

```text
Found slave id=1, sn=<真实SN>, eepid=5, ...
```

---

## 8. 生成正式 config.yaml

方法 A：网页

https://ssybh2.github.io/EcatV2_Master/

下载后放到：

```text
<workspace>/src/soem_bringup/config/config.yaml
```

方法 B：helper

```bash
cd <workspace>/src/EcatV2_Master

./tools/prepare_6imu_bringup.sh \
  <真实SN> \
  <EtherCAT网卡> \
  <RT_CPU> \
  <NON_RT_CPUS>
```

重新：

```bash
cd <workspace>
colcon build
source install/setup.bash
```

---

## 9. 正式启动

```bash
ros2 launch soem_bringup bringup.launch.py
```

健康启动应看到：

```text
SAFE_OP
OP
Initialization succeeded
slave confirmed ready
```

---

## 10. 检查六个 IMU

```text
/imu/can1/slot1
/imu/can1/slot2
/imu/can1/slot3
/imu/can2/slot1
/imu/can2/slot2
/imu/can2/slot3
```

例如：

```bash
ros2 topic echo /imu/can1/slot1 --once
ros2 topic hz /imu/can1/slot1
```

目标频率接近：

```text
500 Hz
```

---

## 11. 压力测试

不要直接满载。

```text
1
→ 2
→ 3 on CAN1
→ 3+1
→ 3+2
→ 3+3
```

完整中文 + English 测试方案：

[6-IMU / 500 Hz 压力测试计划](6imu-500hz-test-plan.md)
