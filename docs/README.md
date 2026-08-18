# EcatV2 Master 教程导航

如果你是第一次部署这套 EtherCAT 系统，建议不要直接看源码，按照下面的顺序完成。

## 普通 EtherCAT 教程

1. [Environment Setup](environment-setup.md)  
   配置 Ubuntu、ROS 2、实时内核和 CPU 隔离。

2. [First Run Test](first-run-test.md)  
   学习 EtherCAT 从站发现、SN、EEPROM、YAML 和第一次启动。

3. [Configuration Generator](configuration-generator.md)  
   了解普通设备和 6-IMU ProductCode 0x05 应该分别使用哪个配置生成器。

## 6 个 IMU × 500 Hz 专用工具

### 6-IMU TaskEditor 网页

在线地址（GitHub Pages 启用后）：

```text
https://ssybh2.github.io/EcatV2_Master/
```

- [6-IMU TaskEditor 使用说明](6imu-task-editor.md)
- 网页源码：`web/6imu-task-editor/`

这个网页专门生成：

```text
ProductCode 0x05
6 × HIPNUC IMU
sdo_len = 85
task_count = 6
PDO offset = 0 / 21 / 42 / 63 / 84 / 105
160B Slave -> Master PDO
```

### 推荐：第一次部署直接看这里

[6 个 IMU × 500 Hz EtherCAT 部署教程（小白版）](6imu-deployment-beginner-cn.md)

内容包括：

```text
3 种 hipnucimu 固件怎么烧
H750 固件怎么烧
CAN1/CAN2 六个 IMU 怎么分配
AX58100 ProductCode 0x05 EEPROM 怎么安全刷
怎么找 EtherCAT 网卡和 Slave SN
怎么用网页或脚本生成 6-IMU Master 配置
怎么 colcon build / launch
怎么检查 6 个 ROS IMU topic
怎么从 1 → 2 → 3 → 6 个 IMU 做压力测试
怎么通过诊断计数判断到底是 UART、CAN、H750 还是 EtherCAT 出问题
```

### 其他 6-IMU 文档

- [6-IMU Bringup Guide（简版）](6imu-bringup.md)
- [6-IMU / 500 Hz 压力测试计划](6imu-500hz-test-plan.md)

## 当前测试分支

在真机验证完成之前，请使用：

```text
ssybh2/hipnucimu
└── feature/6imu-500hz-stable

ssybh2/EcatV2_AX58100_H750_Universal
└── feature/6imu-large-pdo

ssybh2/EcatV2_Master
└── feature/6imu-large-pdo
```

不要提前把测试版本合并进 `main`。
