# Documentation — 6-IMU EtherCAT

这套文档分成两部分：**原版 EtherCAT 基础教程**和**6-IMU 扩展教程**。如果你第一次部署，建议严格按顺序阅读，不要跳步骤。

## ① 先完成原版基础环境

1. [Environment Setup](environment-setup.md)  
   配置 Ubuntu、ROS 2、实时内核、CPU 隔离和 EtherCAT 独立网口。

2. [First Run Test](first-run-test.md)  
   理解 `slaveinfo`、Slave SN、YAML、launch、SAFE_OP/OP 和第一次启动流程。

3. [Configuration Generator](configuration-generator.md)  
   了解普通 TaskEditor 与 6-IMU TaskEditor 的区别。

## ② 6-IMU 扩展从这里开始

### 🌐 6-IMU TaskEditor

在线地址：

**https://ssybh2.github.io/EcatV2_Master/**

网页源码：

**https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor**

使用说明：

- [6-IMU TaskEditor 使用说明](6imu-task-editor.md)

它专门生成：

```text
ProductCode 0x05 对应的 6-IMU 配置
6 × HIPNUC IMU
sdo_len = 85
task_count = 6
PDO offset = 0 / 21 / 42 / 63 / 84 / 105
Slave -> Master application PDO = 160 B
```

> 注意：ProductCode `0x05` 本身来自 AX58100 EEPROM，不是写进 `config.yaml` 的字段。网页只负责生成 Master 的 task/YAML 配置。

## ③ 第一次真机部署

**推荐入口：**

[6 个 IMU × 500 Hz EtherCAT 部署教程（小白版）](6imu-deployment-beginner-cn.md)

这份教程仿照原版 `first-run-test.md` 的形式编写，每一步都会告诉你：

```text
现在要做什么
↓
执行什么命令
↓
看到什么才算成功
↓
失败时先查哪里
```

覆盖范围：

```text
IMU Slot1/2/3 固件下载与烧录
H750 6-IMU 固件烧录
CAN1/CAN2 六个 IMU 接法
AX58100 ProductCode 0x05 EEPROM 备份与刷写
EtherCAT 网卡识别
第一次发现 Slave
读取真实 SN
TaskEditor / 脚本生成 config.yaml
colcon build
ros2 launch
SAFE_OP -> OP
6 个 ROS IMU topic 验证
1 -> 2 -> 3 -> 6 IMU 分级压力测试
UART/CAN/H750/EtherCAT 故障定位
```

## ④ 压力测试与诊断

- [6-IMU / 500 Hz 压力测试计划](6imu-500hz-test-plan.md)
- [6-IMU Bringup Guide（工程简版）](6imu-bringup.md)

## Branch Policy

实际部署时使用：

```text
Master:
ssybh2/EcatV2_Master
└── feature/6imu-large-pdo

Slave:
ssybh2/EcatV2_AX58100_H750_Universal
└── feature/6imu-large-pdo

IMU bridge:
ssybh2/hipnucimu
└── feature/6imu-500hz-stable
```

`feature/6imu-task-editor` 只是网页开发 staging 分支，网页代码已经完整进入 `feature/6imu-large-pdo`，后续不再使用。

在完成真机 6-IMU 验证之前，不建议把实验版本合并到 `main`。
