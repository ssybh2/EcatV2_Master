# EcatV2 Master

### ProductCode 0x06 · 6 IMU · DJI RC · DShot

> 面向 **STM32H750 + AX58100** EtherCAT 从站的 ROS 2 / SOEM Master。
> 当前版本整合 6 路 HIPNUC IMU、DJI RC / DBUS 输入与 DShot 输出，并提供网页配置工具、部署脚本和运行诊断。

**当前推荐分支：** `feature/6imu-rc-dshot-pdo-v006`

---

## 当前版本

| 项目 | 当前配置 |
| --- | --- |
| EtherCAT Profile | `ProductCode 0x00000006` |
| Application PDO | Master → Slave `80 B` · Slave → Master `192 B` |
| 功能 | 6 × IMU · DJI RC / DBUS · DShot |
| 实机状态 | STM32H750 + AX58100 已进入 OP，6-IMU 链路已运行 |

更详细的 PDO offset、task 配置、EEPROM / SII 和诊断字段不在首页展开，统一放在部署文档中。

---

## 系统结构

```text
6 × HIPNUC IMU
      │
      │ CAN1 / CAN2
      ▼
STM32H750 + AX58100
      │
      │ EtherCAT
      ▼
EcatV2 Master / SOEM
      │
      ▼
     ROS 2
      │
      ├── 6 × IMU topics
      ├── DJI RC / DBUS
      └── DShot
```

---

## 快速开始

### 1. 使用当前分支

```bash
git checkout feature/6imu-rc-dshot-pdo-v006
git submodule update --init --recursive
```

### 2. 生成本机 bringup

```bash
./tools/prepare_6imu_rc_dshot_bringup.sh \
  <slave-serial> \
  <ethercat-interface> \
  <rt-cpu> \
  <non-rt-cpus>
```

脚本会根据当前 ProductCode 0x06 模板创建本机 `soem_bringup` 配置。

### 3. 编译并启动

```bash
source /opt/ros/humble/setup.bash
colcon build
source install/setup.bash

ros2 launch soem_bringup bringup.launch.py
```

---

## TaskEditor

不想手动编辑 YAML 时，可以直接使用在线配置工具：

### [Open ProductCode 0x06 TaskEditor](https://ssybh2.github.io/EcatV2_Master/)

可以配置 Slave Serial、6 个 IMU topic / frame、DJI RC topic 以及 DShot 参数，并直接生成 `config.yaml`。

源码位于：`web/6imu-task-editor/`

---

## 文档入口

第一次部署建议直接从完整教程开始：

- **[完整部署教程（小白版）](docs/6imu-deployment-beginner-cn.md)** — 从 Ubuntu 环境、固件烧录到 ROS 2 验收
- **[ProductCode 0x06 部署说明](docs/6imu-dji-rc-dshot-deployment-cn.md)** — PDO、EEPROM / SII 与当前实机基线
- **[TaskEditor 说明](docs/6imu-task-editor.md)** — 8-task 配置生成器
- **[6-IMU 压力测试计划](docs/6imu-500hz-test-plan.md)** — 多 IMU、诊断与稳定性验证

---

## 配套固件

| 模块 | 推荐版本 |
| --- | --- |
| Master | `ssybh2/EcatV2_Master` · `feature/6imu-rc-dshot-pdo-v006` |
| H750 + AX58100 Slave | `ssybh2/EcatV2_AX58100_H750_Universal` · `feature/6imu-rc-dshot-pdo-v006` · Release `v0.6.1` |
| HIPNUC G431 bridge | `ssybh2/hipnucimu` · `feature/6imu-500hz-stable` |

> Master、Slave、EEPROM 和配置文件必须使用同一套 ProductCode 0x06 profile。

---

## 当前状态

- ✅ ProductCode 0x06 EtherCAT profile
- ✅ 6 × HIPNUC IMU
- ✅ DJI RC / DBUS 软件链路
- ✅ DShot 软件链路
- ✅ 在线 TaskEditor
- ✅ RAW PDO GAP / EtherCAT loop stall diagnostics
- ✅ STM32H750 + AX58100 SAFE_OP / OP 实机验证

DJI RC 和 DShot 的最终实机功能测试仍应按具体硬件和安全条件分别完成。

---

## Legacy

旧 ProductCode `0x05` / 160 B S→M profile 仍保留用于历史兼容，但**不要与当前 0x06 配置混用**。

---

## Safety

首次进行 DShot 实机测试时，请先卸下桨叶或解除机械负载，并准备可靠的断电方式。

---

### Related repositories

- [H750 + AX58100 Slave](https://github.com/ssybh2/EcatV2_AX58100_H750_Universal)
- [HIPNUC IMU Forward Bridge](https://github.com/ssybh2/hipnucimu)
