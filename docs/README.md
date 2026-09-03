# EcatV2 Master 教程导航

如果你第一次部署这套 EtherCAT 系统，建议按照下面顺序，不要跳步骤。

## 原版基础路线

1. [Environment Setup](environment-setup.md)  
   BIOS、Ubuntu/ROS 2、Realtime kernel、CPU isolation、workspace、EEPROM/MCU。

2. [First Run Test](first-run-test.md)  
   创建 `soem_bringup`、config、launch、第一次启动、从日志读取真实 Slave SN。

3. [Configuration Generator](configuration-generator.md)  
   使用原版 TaskEditor 或我们的 6-IMU TaskEditor 生成 `config.yaml`，放进 `soem_bringup/config/`。

原仓库最终启动方式：

```bash
ros2 launch soem_bringup bringup.launch.py
```

---


## ProductCode 0x06：6-IMU + DJI RC + DShot

[完整部署说明](6imu-dji-rc-dshot-deployment-cn.md)

该配置保留 ProductCode `0x05` 的 80/160 B profile，并新增
ProductCode `0x06`：Master→Slave 80 B、Slave→Master 192 B。

---

# 6-IMU / 500 Hz 专用入口

## 推荐：第一次部署直接看这一篇

[6 个 IMU × 500 Hz EtherCAT 完整部署教程（小白版）](6imu-deployment-beginner-cn.md)

它已经把：

```text
Environment Setup
+
First Run Test
+
Generate Config File
+
G431 / H750 烧录
+
ProductCode 0x05 EEPROM
+
6-IMU TaskEditor
+
soem_bringup
+
500 Hz 验证
+
中文压力测试
```

全部合并成一条完整路线。

## 6-IMU TaskEditor

在线：

https://ssybh2.github.io/EcatV2_Master/

源码：

https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor

说明：

[6-IMU TaskEditor 使用说明](6imu-task-editor.md)

## 压力测试

[6-IMU / 500 Hz 压力测试计划（中英双语）](6imu-500hz-test-plan.md)

## 简版 Bringup

[6-IMU Bringup Guide](6imu-bringup.md)

---

# 当前实验分支

```text
ssybh2/EcatV2_Master
└── feature/6imu-large-pdo

ssybh2/EcatV2_AX58100_H750_Universal
└── feature/6imu-large-pdo

ssybh2/hipnucimu
└── feature/6imu-500hz-stable
```

真机完整验证通过前，不要把实验分支合并进 `main`。
