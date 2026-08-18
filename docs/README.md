# EcatV2 Master 教程导航

如果你是第一次部署这套 EtherCAT 系统，建议不要直接看源码，按照下面的顺序完成。

## 普通 EtherCAT 教程

1. [Environment Setup](environment-setup.md)  
   配置 Ubuntu、ROS 2、实时内核和 CPU 隔离。

2. [First Run Test](first-run-test.md)  
   学习 EtherCAT 从站发现、SN、EEPROM、YAML 和第一次启动。

3. [Configuration Generator](configuration-generator.md)  
   了解普通设备如何生成和修改配置。

## 6 个 IMU × 500 Hz 专用教程

### 推荐：第一次部署直接看这里

[6 个 IMU × 500 Hz EtherCAT 部署教程（小白版）](6imu-deployment-beginner-cn.md)

内容包括：

```text
3 种 hipnucimu 固件怎么烧
H750 固件怎么烧
CAN1/CAN2 六个 IMU 怎么分配
AX58100 ProductCode 0x05 EEPROM 怎么安全刷
怎么找 EtherCAT 网卡和 Slave SN
怎么一键生成 6-IMU Master 配置
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
