# DShot600 eRPM feedback (EXPERIMENTAL - no hardware RX yet)

This page documents the paired development branch `feature/dshot600-esc-rpm-telemetry` on:

- Master: https://github.com/ssybh2/EcatV2_Master/tree/feature/dshot600-esc-rpm-telemetry
- Slave: https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/tree/feature/dshot600-esc-rpm-telemetry

## Current status

The master can parse and publish a separate `DSHOT_RPM` read-only task (app type 16). The H750 slave **does not yet capture bidirectional DShot responses**: the RPM fields are invalid until RX firmware, pin-mode turnaround and oscilloscope tests are complete. Existing `WriteDSHOT` output behavior is unchanged.

`ReadDSHOTRpm.msg` fields:
- `dshot_id`: DShot hardware group (1 TIM2 / 2 TIM3).
- `valid_mask`: bit i is 1 only when group motor i has a fresh, valid eRPM measurement; invalid fields are *not* zero-RPM measurements.
- `period_us[4]`: decoded ESC electrical period in microseconds.
- `electrical_rpm[4]`: absolute electrical RPM (not shaft RPM, not signed).

Mechanical RPM magnitude = electrical RPM / (motor pole count / 2). Signed RPM needs separate direction estimation in 3D reverse operation. Do not derive physical rotation direction directly from the last DShot command during reversal.

## Example: single H750 slave, six motors, two groups

**Example only**. Replace `sn1234567` with the real serial number and choose topic names. The four tasks must keep unique PDO offsets. The `sub_topic` routes ROS commands to four channels each.

```yaml
slaves:
  - sn1234567:
      sdo_len: !uint16_t 15
      task_count: !uint8_t 4
      latency_pub_topic: !std::string '/ecat/sn1234567/latency'
      tasks:
        - app_1:
            sdowrite_task_type: !uint8_t 4
            sdowrite_connection_lost_write_action: !uint8_t 2
            sdowrite_dshot_id: !uint8_t 1
            sdowrite_init_value: !uint16_t 0
            sub_topic: !std::string '/ecat/sn1234567/dshot_group1/write'
            pdowrite_offset: !uint16_t 0
        - app_2:
            sdowrite_task_type: !uint8_t 4
            sdowrite_connection_lost_write_action: !uint8_t 2
            sdowrite_dshot_id: !uint8_t 2
            sdowrite_init_value: !uint16_t 0
            sub_topic: !std::string '/ecat/sn1234567/dshot_group2/write'
            pdowrite_offset: !uint16_t 8
        - app_3:
            sdowrite_task_type: !uint8_t 16
            sdowrite_dshot_id: !uint8_t 1
            pub_topic: !std::string '/ecat/sn1234567/dshot_group1/rpm'
            pdoread_offset: !uint16_t 0
        - app_4:
            sdowrite_task_type: !uint8_t 16
            sdowrite_dshot_id: !uint8_t 2
            pub_topic: !std::string '/ecat/sn1234567/dshot_group2/rpm'
            pdoread_offset: !uint16_t 9
```

The four `WriteDSHOT` channels in group 2 include two unused physical channels for a six-motor robot. Keep them at **0/disarmed**. All propellers must be removed for the first PDO and GPIO tests.

Protocol RX PDO layout per 4-channel task: `uint16 payload[4]` (8 bytes) + `uint8 valid_mask` (1 byte). Group 1 reads offset 0 and group 2 reads offset 9. Total RX 18 bytes, TX 16 bytes.

**Caution:** the original sample config uses `!uint16_t` for `dshot_id`, but H750 parses one byte. This example deliberately uses `!uint8_t` to match the firmware.

## Rolling-ZLT integration later

Publish two read groups; aggregate the first 4 + first 2 channels into Rolling-ZLT's `/sensors/esc` only after confirming:
- all six motor pole counts, RPM conversion and channel numbering;
- fresh samples and explicit validity, and behavior on feedback loss;
- real shaft spin direction during 3D reversal (not provided by eRPM magnitude alone).

There is deliberately **no zero-filled RPM ROS bridge** in this development phase: a missing sample is invalid, not a measured stop. A signed-RPM bridge must not advertise it as `EscTelemetry` without a qualified direction source.

Protocol documentation: https://betaflight.com/docs/development/API/Dshot
