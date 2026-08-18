# 6-IMU TaskEditor 使用说明

这个网页是 `ssybh2/EcatV2_Master:feature/6imu-large-pdo` 专用的 `config.yaml` 生成器。

## 在线地址

https://ssybh2.github.io/EcatV2_Master/

## 源码

https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor

---

## 为什么不用原版 TaskEditor？

原版 HIPNUC CAN IMU task 的字段格式与我们的 Master 兼容，但原版网页主要面向：

```text
ProductCode 0x03 -> 80B Slave->Master
ProductCode 0x04 -> 112B Slave->Master
```

我们的从站是：

```text
ProductCode 0x05
Master -> Slave = 80B
Slave  -> Master = 160B
```

固定布局：

```text
0..125    6 × 21B HIPNUC IMU
126..137  6 × sample_seq
138..149  6 × incomplete_count
150..159  CAN FIFO / read-error diagnostics
```

因此我们的网页直接理解 160B 布局，不会把 6×21B 按 112B 误判为 overflow。

---

## 默认 6-IMU 拓扑

```text
CAN1
  Slot1 -> slot1 firmware -> 0x01/02/03 -> offset 0
  Slot2 -> slot2 firmware -> 0x04/05/06 -> offset 21
  Slot3 -> slot3 firmware -> 0x07/08/09 -> offset 42

CAN2
  Slot1 -> slot1 firmware -> 0x01/02/03 -> offset 63
  Slot2 -> slot2 firmware -> 0x04/05/06 -> offset 84
  Slot3 -> slot3 firmware -> 0x07/08/09 -> offset 105
```

网页自动检查：

```text
SN
CAN ID
同一 CAN 上的 ID 冲突
ROS2 topic
frame_name
task_count = 6
sdo_len = 85
160B PDO
```

---

## 使用步骤

### 1. 先通过 First Run Test 找真实 SN

完整方法见：

[6-IMU 完整小白部署教程](6imu-deployment-beginner-cn.md)

第一次可以用假 SN 启动：

```bash
ros2 launch soem_bringup bringup.launch.py
```

从日志读取：

```text
Found slave id=1, sn=<真实SN>, eepid=5, ...
```

---

### 2. 打开网页

https://ssybh2.github.io/EcatV2_Master/

在 `Module Settings` 把默认：

```text
1234567
```

换成真实 SN。

---

### 3. 检查六个 IMU

如果你使用我们推荐的固定拓扑，一般保持默认值即可。

CAN ID 可以修改，但同一 CAN 总线上不能冲突。

---

### 4. Config Generator

切到：

```text
Config Generator
```

确认：

```text
Ready to download
```

并确认：

```text
task_count = 6
sdo_len = 85
Slave -> Master PDO = 160B
```

---

### 5. 下载 config.yaml

点击：

```text
Download config.yaml
```

得到：

```text
config.yaml
```

---

### 6. 放进 soem_bringup

按照原仓库 `configuration-generator.md` 的方式，配置文件属于 **bringup package**。

正确位置：

```text
<workspace>/src/soem_bringup/config/config.yaml
```

不是：

```text
src/soem_wrapper/config/
```

---

### 7. 重新 build

```bash
cd <workspace>
source /opt/ros/humble/setup.bash

colcon build
source install/setup.bash
```

---

### 8. 正式启动

```bash
ros2 launch soem_bringup bringup.launch.py
```

EtherCAT backend 需要 root/raw socket 时，在 root shell 里重新 source ROS 2 和 workspace 后运行同一条命令。

---

## ProductCode 0x05 为什么不在 YAML？

`config.yaml` 描述：

```text
task
CAN
CAN ID
PDO offset
ROS2 topic
frame_name
```

EtherCAT 设备身份：

```text
ProductCode 0x05
```

来自 AX58100 EEPROM + Master module registration。

所以网页不生成：

```yaml
product_code: 0x05
```

这是故意的。

---

## 与 prepare_6imu_bringup.sh 的关系

网页适合可视化配置。

脚本适合直接生成默认 6-IMU 配置和原版风格的 `soem_bringup`：

```bash
cd <workspace>/src/EcatV2_Master

./tools/prepare_6imu_bringup.sh \
  <SN> \
  <EtherCAT网卡> \
  <RT_CPU> \
  <NON_RT_CPUS>
```

脚本会创建：

```text
<workspace>/src/soem_bringup/
├── CMakeLists.txt
├── package.xml
├── config/config.yaml
└── launch/bringup.launch.py
```

---

## 本地离线使用网页

网页没有 npm/backend 依赖。

clone 仓库后可以直接打开：

```text
web/6imu-task-editor/index.html
```

生成器测试：

```bash
node web/6imu-task-editor/test-generator.js
```

正常：

```text
6-IMU TaskEditor generator tests: PASS
```
