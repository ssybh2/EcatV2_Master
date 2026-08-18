# EtherCAT Configuration Generator

这一页说明两种配置生成方式。**请先确认你的 EtherCAT Slave ProductCode。**

## 先选对生成器

| Slave 类型 | ProductCode / eepid | Slave → Master PDO | 推荐生成器 |
| --- | ---: | ---: | --- |
| H750 Universal Module | `0x03` | 80B | [AIMEtherCAT 原版 TaskEditor](https://aimethercat.github.io/TaskEditor/) |
| H750 Universal Module (Large PDO V.) | `0x04` | 112B | [AIMEtherCAT 原版 TaskEditor](https://aimethercat.github.io/TaskEditor/) |
| **H750 6-IMU Large PDO** | **`0x05`** | **160B** | **[ssybh2 6-IMU TaskEditor](https://ssybh2.github.io/EcatV2_Master/)** |

> `feature/6imu-large-pdo` 的 6-IMU 版本不要使用原版 TaskEditor 判断 PDO 是否溢出。原版网页面向 0x03/0x04；我们的 0x05 固定使用 160B Slave→Master PDO。

---

# ProductCode 0x05：6-IMU TaskEditor

在线网页：

https://ssybh2.github.io/EcatV2_Master/

源码：

https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor

详细说明：

[6-IMU TaskEditor 使用说明](6imu-task-editor.md)

## 固定布局

```text
Master -> Slave PDO: 80B

Slave -> Master PDO: 160B
  0..125    6 × 21B HIPNUC IMU
  126..137  6 × sample_seq
  138..149  6 × incomplete_count
  150..159  CAN FIFO / read-error diagnostics
```

默认 CAN 拓扑：

```text
CAN1
  Slot1 -> 0x01 / 0x02 / 0x03
  Slot2 -> 0x04 / 0x05 / 0x06
  Slot3 -> 0x07 / 0x08 / 0x09

CAN2
  Slot1 -> 0x01 / 0x02 / 0x03
  Slot2 -> 0x04 / 0x05 / 0x06
  Slot3 -> 0x07 / 0x08 / 0x09
```

PDO read offset：

```text
0 / 21 / 42 / 63 / 84 / 105
```

网页自动生成：

```text
task_count = 6
sdo_len = 85
```

## ProductCode 0x05 为什么不写进 config.yaml？

`config.yaml` 负责 Master task 配置，不负责 EtherCAT 设备身份。

ProductCode `0x05` 来自：

```text
AX58100 EEPROM
+
EcatV2_Master module registration
```

所以网页不会生成 `product_code: 0x05` 字段。

---

# 按原仓库方式使用生成的 config.yaml

原版 `configuration-generator.md` 的关键原则是：

> 下载 `config.yaml` 后，把它放进 **bringup package 的 config 文件夹**，重新 `colcon build`，再启动 bringup package。

我们的 6-IMU 版本保持同样结构：

```text
<workspace>/
└── src/
    ├── EcatV2_Master/
    └── soem_bringup/
        ├── CMakeLists.txt
        ├── package.xml
        ├── config/
        │   └── config.yaml
        └── launch/
            └── bringup.launch.py
```

## 网页生成步骤

1. 打开 [6-IMU TaskEditor](https://ssybh2.github.io/EcatV2_Master/)。
2. 输入 `first-run test` 中得到的真实 Slave SN。
3. 检查 6 个 IMU 的 CAN ID、ROS2 topic 和 frame name。
4. 进入 `Config Generator`。
5. 确认检查结果全部通过。
6. 下载 `config.yaml`。
7. 放到：

```text
<workspace>/src/soem_bringup/config/config.yaml
```

8. 回到 workspace：

```bash
source /opt/ros/humble/setup.bash
colcon build
source install/setup.bash
```

9. 最终启动：

```bash
ros2 launch soem_bringup bringup.launch.py
```

> EtherCAT backend 需要 raw socket/root 权限时，进入 root shell 后要重新 source ROS 2 和 workspace。

---

# 自动创建 soem_bringup

如果不想手工创建 `CMakeLists.txt/package.xml/config/launch`，运行：

```bash
cd <workspace>/src/EcatV2_Master

./tools/prepare_6imu_bringup.sh \
  <SN> \
  <EtherCAT网卡> \
  <RT_CPU> \
  <NON_RT_CPUS>
```

它会自动生成与原版 `first-run-test.md` 相同职责的：

```text
<workspace>/src/soem_bringup/
├── CMakeLists.txt
├── package.xml
├── config/config.yaml
└── launch/bringup.launch.py
```

---

# ProductCode 0x03 / 0x04：原版 TaskEditor

普通 H750 Universal Module / 112B Large PDO 继续使用：

https://aimethercat.github.io/TaskEditor/

原版流程：

```text
Add Module
→ 填真实 Slave SN
→ Add Task
→ 检查 PDO overflow
→ Download config.yaml
→ 放入 soem_bringup/config/
→ colcon build
→ ros2 launch soem_bringup bringup.launch.py
```

---

# 相关文档

- [Environment Setup](environment-setup.md)
- [First Run Test](first-run-test.md)
- [6 个 IMU × 500 Hz 完整小白部署教程](6imu-deployment-beginner-cn.md)
- [6-IMU TaskEditor 使用说明](6imu-task-editor.md)
- [6-IMU / 500 Hz 压力测试计划（中英双语）](6imu-500hz-test-plan.md)
