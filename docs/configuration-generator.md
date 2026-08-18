# EtherCAT Configuration Generator

这一页同时说明两种配置生成方式。**请先确认你的 EtherCAT Slave ProductCode。**

## 先选对生成器

| Slave 类型 | ProductCode / eepid | Slave -> Master PDO | 推荐生成器 |
| --- | ---: | ---: | --- |
| H750 Universal Module | `0x03` | 80B | [AIMEtherCAT 原版 TaskEditor](https://aimethercat.github.io/TaskEditor/) |
| H750 Universal Module (Large PDO V.) | `0x04` | 112B | [AIMEtherCAT 原版 TaskEditor](https://aimethercat.github.io/TaskEditor/) |
| **H750 6-IMU Large PDO** | **`0x05`** | **160B** | **[ssybh2 6-IMU TaskEditor](https://ssybh2.github.io/EcatV2_Master/)** |

> 如果你使用本项目 `feature/6imu-large-pdo` 的 6 个 HIPNUC IMU 版本，请不要用原版 TaskEditor 判断 PDO 是否溢出。原版网页目前只认识 0x03/0x04 的 80B/112B 容量，而我们的 0x05 固定使用 160B。

---

# ProductCode 0x05：6-IMU TaskEditor

源码位置：

```text
web/6imu-task-editor/
```

详细教程：

[6-IMU TaskEditor 使用说明](6imu-task-editor.md)

在线网页（GitHub Pages 启用后）：

```text
https://ssybh2.github.io/EcatV2_Master/
```

## 这个网页为什么是专用版本？

我们的 0x05 从站固定布局是：

```text
Master -> Slave PDO: 80B

Slave -> Master PDO: 160B
  0..125    6 * 21B HIPNUC IMU
  126..137  6 * sample_seq
  138..149  6 * incomplete_count
  150..159  CAN FIFO / read-error diagnostics
```

所以网页固定创建 6 个 HIPNUC CAN IMU task，而不是允许任意增加其他 read task。

## 默认 CAN 拓扑

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

对应 PDO read offset：

```text
0 / 21 / 42 / 63 / 84 / 105
```

网页会自动生成：

```text
task_count = 6
sdo_len = 85
```

并检查同一条 CAN 总线上的 CAN ID 是否冲突。

## ProductCode 0x05 为什么没有写进 config.yaml？

`config.yaml` 负责 Master task 配置，不负责 EtherCAT 设备身份。

ProductCode `0x05` 来自：

```text
AX58100 EEPROM
+
EcatV2_Master 中的 module registration
```

因此网页不会额外生成 `product_code: 0x05` 这样的 YAML 字段。这是正常设计。

## 生成步骤

1. 打开 6-IMU TaskEditor。
2. 在 `Module Settings` 输入真实 Slave SN。
3. 检查 CAN1/CAN2 六个 IMU 的 CAN ID、ROS2 topic 和 frame name。
4. 切到 `Config Generator`。
5. 确认状态为 `Ready to download`。
6. 点击 `Download config.yaml`。
7. 把文件放到 Master 的 `src/soem_wrapper/config/` 中。
8. `colcon build` 后重新启动 Master。

也可以不用网页，直接使用：

```bash
./tools/prepare_6imu_bringup.sh <SN> <EtherCAT网卡> <RT_CPU> <NON_RT_CPUS>
```

---

# ProductCode 0x03 / 0x04：原版 AIMEtherCAT TaskEditor

如果你使用普通 H750 Universal Module 或原来的 112B Large PDO，可以继续使用：

[AIMEtherCAT TaskEditor](https://aimethercat.github.io/TaskEditor/)

原版网页的主要流程是：

## Add Module

选择对应的 H750 module，然后填写 `Module SN`。SN 一般来自第一次 `slaveinfo` / first-run test。

## Basic configuration

### Serial Number

填写从站真实 SN。通常是 7 位数字。

### Module Latency Topic

默认会根据 SN 自动生成，也可以手动修改。

## Add Task

展开 module 后添加需要的 task，例如：

- DJI RC
- SBUS RC
- HIPNUC IMU (CAN)
- DSHOT600
- DJI Motor
- DM Motor
- LkTech Motor
- DD Motor
- Onboard PWM
- 其他实验性 task

不同 task 会产生不同 SDO 参数、PDO read/write 长度和 ROS2 topic。

原版 TaskEditor 会自动计算 PDO offset，并在 module 容量不足时提示 overflow。

## Download Configuration File

完成配置以后进入 `Config Generator` 页面，检查 module PDO 状态，然后下载：

```text
config.yaml
```

## Upload Your Configuration File

把生成的 YAML 放进 bringup package 的 `config` 文件夹，例如：

```text
src/soem_wrapper/config/config.yaml
```

如果修改了文件名，也要同步修改 `bringup.launch.py`。

最后回到 workspace 根目录：

```bash
colcon build
source install/setup.bash
```

然后启动 EtherCAT Master。

---

# 相关文档

- [First Run Test](first-run-test.md)
- [6 个 IMU × 500 Hz 小白部署教程](6imu-deployment-beginner-cn.md)
- [6-IMU TaskEditor 使用说明](6imu-task-editor.md)
- [6-IMU / 500 Hz 压力测试计划](6imu-500hz-test-plan.md)
