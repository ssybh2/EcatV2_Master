# ProductCode 0x06：8-task TaskEditor

在线：<https://ssybh2.github.io/EcatV2_Master/>

源码：`web/6imu-task-editor/`

旧网页只生成 ProductCode `0x05` 的 6 个纯 IMU task。当前版本已升级为：

```text
ProductCode / eepid = 0x06
M→S application PDO = 80 B
S→M application PDO = 192 B
EtherCAT Outputs     = 81 B
EtherCAT Inputs      = 193 B
sdo_len              = 91 B
task_count           = 8
```

## Task 顺序

| Task | 类型 | PDO |
|---:|---|---|
| 1 | HIPNUC IMU / CAN1 Slot1 | read @ 0 |
| 2 | HIPNUC IMU / CAN1 Slot2 | read @ 21 |
| 3 | HIPNUC IMU / CAN1 Slot3 | read @ 42 |
| 4 | HIPNUC IMU / CAN2 Slot1 | read @ 63 |
| 5 | HIPNUC IMU / CAN2 Slot2 | read @ 84 |
| 6 | HIPNUC IMU / CAN2 Slot3 | read @ 105 |
| 7 | DJI RC / DBUS | read @ 160 |
| 8 | DShot | write @ 0 |

可编辑：Serial、IMU CAN ID/topic/frame、DJI RC topic、DShot topic/ID/init value/connection-lost action。

Task 7 生成：

```yaml
- app_7:
    sdowrite_task_type: !uint8_t 1
    pdoread_offset: !uint16_t 160
    pub_topic: !std::string '/dji_rc'
```

Task 8 生成：

```yaml
- app_8:
    sdowrite_task_type: !uint8_t 4
    sdowrite_connection_lost_write_action: !uint8_t 2
    sdowrite_dshot_id: !uint8_t 1
    sdowrite_init_value: !uint16_t 0
    pdowrite_offset: !uint16_t 0
    sub_topic: !std::string '/dshot'
```

GitHub Pages workflow 监听 `feature/6imu-rc-dshot-pdo-v006`。修改 `web/6imu-task-editor/**` 后 push，会先做 Node syntax / generator test，再部署。

本地测试：

```bash
node --check web/6imu-task-editor/generator.js
node --check web/6imu-task-editor/app.js
node --check web/6imu-task-editor/test-generator.js
node web/6imu-task-editor/test-generator.js
```
