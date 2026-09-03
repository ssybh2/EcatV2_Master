# Documentation

## 当前推荐：ProductCode 0x06

`feature/6imu-rc-dshot-pdo-v006` 支持：

- 6 × HIPNUC IMU
- DJI RC / DBUS read
- DShot write
- application PDO `80 B M→S / 192 B S→M`
- EtherCAT `81 B Outputs / 193 B Inputs`
- `task_count=8`
- `sdo_len=91`

入口：

- [`6imu-dji-rc-dshot-deployment-cn.md`](6imu-dji-rc-dshot-deployment-cn.md)
- [`6imu-task-editor.md`](6imu-task-editor.md)
- [`../src/soem_wrapper/config/config_6imu_rc_dshot_template.yaml`](../src/soem_wrapper/config/config_6imu_rc_dshot_template.yaml)
- [`../tools/prepare_6imu_rc_dshot_bringup.sh`](../tools/prepare_6imu_rc_dshot_bringup.sh)
- [`../tools/flash_6imu_rc_dshot_eeprom.sh`](../tools/flash_6imu_rc_dshot_eeprom.sh)

在线 TaskEditor：<https://ssybh2.github.io/EcatV2_Master/>

## Legacy：ProductCode 0x05

旧 `feature/6imu-large-pdo` 内容对应 `0x05 / 80 B / 160 B / task_count 6 / sdo_len 85`，仅用于 legacy profile。

## 真机基线

0x06 已验证 ProductCode `0x06`、SAFE_OP State 4、SM2 `81 B`、SM3 `193 B`，Master 能进入 OP。
