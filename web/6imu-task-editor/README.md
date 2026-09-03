# ProductCode 0x06 TaskEditor

目标 profile：

- ProductCode/eepid `0x06`
- application PDO：M→S `80 B`，S→M `192 B`
- EtherCAT process data：Outputs `81 B`，Inputs `193 B`
- `task_count = 8`
- `sdo_len = 91`

固定 task 顺序：

1. HIPNUC IMU 1，read @ 0
2. HIPNUC IMU 2，read @ 21
3. HIPNUC IMU 3，read @ 42
4. HIPNUC IMU 4，read @ 63
5. HIPNUC IMU 5，read @ 84
6. HIPNUC IMU 6，read @ 105
7. DJI RC / DBUS，read @ 160，19 B
8. DShot，write @ 0，8 B（4 × uint16）

网页可编辑 Serial、6 个 IMU 的 CAN ID/topic/frame、DJI RC topic，以及 DShot topic、ID、init value、connection-lost action。Task 类型与 PDO offset 按 0x06 profile 固定。

本地验证：

```bash
node --check generator.js
node --check app.js
node --check test-generator.js
node test-generator.js
```

GitHub Pages 由 `.github/workflows/pages-6imu-task-editor.yml` 从 `feature/6imu-rc-dshot-pdo-v006` 部署。
