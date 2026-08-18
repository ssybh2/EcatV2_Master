# 6-IMU EtherCAT TaskEditor

A small static configuration generator dedicated to the custom `ProductCode 0x05` H750 + AX58100 slave used by this branch.

## Why this editor exists

The upstream AIMEtherCAT TaskEditor currently knows the standard H750 module (`0x03`) and the 112-byte Large PDO module (`0x04`). Our six-IMU slave uses:

- ProductCode/eepid `0x05`
- Master -> Slave PDO: 80 bytes
- Slave -> Master PDO: 160 bytes
- Six fixed HIPNUC CAN IMU tasks, 21 bytes each
- A fixed 34-byte diagnostic tail at bytes 126..159

The upstream HIPNUC task field format remains compatible, but its old board-size check cannot represent this 160-byte profile.

## What this page generates

The page generates the ROS2/SOEM `config.yaml` only. It does **not** program the AX58100 EEPROM. ProductCode `0x05` comes from the EEPROM image and Master module registration.

The generated module contains:

- `sdo_len: !uint16_t 85`
- `task_count: !uint8_t 6`
- six `HIPNUC_IMU_CAN` tasks (`sdowrite_task_type = 3`)
- fixed CAN1/CAN2 placement
- fixed PDO read offsets: `0, 21, 42, 63, 84, 105`
- editable CAN packet IDs, ROS2 topics and frame names

## Local use

This implementation has no npm dependency. Open `index.html` in a browser, or serve this folder with any static HTTP server.

## Test

```bash
node test-generator.js
```

## Credits

The interaction concept is inspired by the MIT-licensed [AIMEtherCAT/TaskEditor](https://github.com/AIMEtherCAT/TaskEditor). This ProductCode `0x05` implementation is written as a separate static editor for the `ssybh2/EcatV2_Master` fork and does not modify the upstream project.
