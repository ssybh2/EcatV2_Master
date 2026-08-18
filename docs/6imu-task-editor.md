# 6-IMU TaskEditor 使用说明

这个网页是 `ssybh2/EcatV2_Master:feature/6imu-large-pdo` 专用的 `config.yaml` 生成器。

在线地址（GitHub Pages 启用后）：

```text
https://ssybh2.github.io/EcatV2_Master/
```

源码：

```text
web/6imu-task-editor/
```

## 为什么不用原版 TaskEditor 直接生成？

原版 AIMEtherCAT TaskEditor 的 HIPNUC IMU task 本身和我们的格式兼容：

```text
sdowrite_task_type = 3
sdowrite_can_inst
sdowrite_packet1_id
sdowrite_packet2_id
sdowrite_packet3_id
conf_frame_name
21B PDO read payload
```

但是原版网页目前只认识：

```text
ProductCode 0x03 -> 80B Slave->Master PDO
ProductCode 0x04 -> 112B Slave->Master PDO
```

我们的新从站是：

```text
ProductCode 0x05
Master -> Slave: 80B
Slave  -> Master: 160B
```

其中 160B 固定布局是：

```text
0..125    6 * 21B HIPNUC IMU
126..137  6 * uint16 sample_seq
138..149  6 * uint16 incomplete_count
150..151  CAN1 FIFO lost
152..153  CAN2 FIFO lost
154..155  CAN1 FIFO full
156..157  CAN2 FIFO full
158       CAN1 read error
159       CAN2 read error
```

所以如果继续用原版 TaskEditor，它会把 `6 * 21B = 126B` 按 112B Large PDO 判断为 overflow，而且它不知道后面的 34B diagnostics。

## 网页能做什么？

网页保留 TaskEditor 的核心使用方式，但专门针对 0x05：

1. 添加一块或多块 `H750 Universal Module - 6-IMU Large PDO`。
2. 输入真实 Slave SN。
3. 自动生成 latency topic。
4. 固定创建六个 HIPNUC IMU task。
5. CAN1 固定三个 slot，CAN2 固定三个 slot。
6. 默认 CAN ID：

```text
CAN1 Slot1 -> 0x01 / 0x02 / 0x03
CAN1 Slot2 -> 0x04 / 0x05 / 0x06
CAN1 Slot3 -> 0x07 / 0x08 / 0x09

CAN2 Slot1 -> 0x01 / 0x02 / 0x03
CAN2 Slot2 -> 0x04 / 0x05 / 0x06
CAN2 Slot3 -> 0x07 / 0x08 / 0x09
```

7. 自动锁定 PDO read offset：

```text
0 / 21 / 42 / 63 / 84 / 105
```

8. 自动计算并检查：

```text
task_count = 6
sdo_len = 85
IMU payload = 126B
diagnostics = 34B
Slave -> Master PDO = 160B
```

9. 检查同一 CAN 总线 CAN ID 是否冲突。
10. 检查 SN、ROS2 topic、frame_name。
11. 实时预览最终 YAML。
12. 一键 Copy 或 Download `config.yaml`。
13. 浏览器使用 localStorage 自动保存当前编辑内容。

## ProductCode 0x05 为什么不在 YAML 里面？

这是最容易混淆的地方。

`config.yaml` 负责告诉 ROS2 Master：

```text
这块 slave 上有哪些 task
每个 task 用哪个 CAN
CAN ID 是什么
PDO 数据从哪里读
发布到哪个 ROS2 topic
```

而 EtherCAT Slave 的设备身份：

```text
ProductCode 0x05
```

来自 AX58100 EEPROM，以及 Master 代码里的 module registration。

所以网页不会生成类似：

```yaml
product_code: 0x05
```

这是故意的，不是漏写。

## 使用步骤

### 1. 打开网页

打开：

```text
https://ssybh2.github.io/EcatV2_Master/
```

### 2. Module Settings

默认已经创建一块 6-IMU module。

把：

```text
Module SN = 1234567
```

改成 `slaveinfo` 真正读到的 SN。

例如：

```text
2883658
```

网页会自动把 latency topic 改为：

```text
/ecat/sn2883658/latency
```

### 3. 检查六个 IMU

默认就是最终推荐拓扑：

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

CAN ID 可以修改，但同一条 CAN 上不能重复。

### 4. Config Generator

切换到：

```text
Config Generator
```

如果状态显示：

```text
Ready to download
```

说明基本检查通过。

这里还能看到 160B PDO 内存布局和实时生成的 YAML。

### 5. 下载

点击：

```text
Download config.yaml
```

得到：

```text
config.yaml
```

### 6. 放入 Master

把生成的文件作为：

```text
src/soem_wrapper/config/dev-config.yaml
```

或者根据你的 launch 文件使用其他文件名。

然后：

```bash
colcon build
source install/setup.bash
```

最后启动：

```bash
ros2 launch soem_wrapper bringup.launch.py
```

## 本地离线使用

网页没有 npm 依赖，也不需要服务器后端。

clone 仓库后可以直接打开：

```text
web/6imu-task-editor/index.html
```

也可以在该目录启动任意静态 HTTP server。

生成器测试：

```bash
node web/6imu-task-editor/test-generator.js
```

正常结果：

```text
6-IMU TaskEditor generator tests: PASS
```

## 与 `prepare_6imu_bringup.sh` 的关系

两种方式都能生成可用配置：

```text
网页 TaskEditor
  -> 适合看得见地修改 SN / CAN ID / topic / frame

prepare_6imu_bringup.sh
  -> 适合终端一条命令生成默认配置
```

两者面向的是同一个 ProductCode 0x05 配置格式。
