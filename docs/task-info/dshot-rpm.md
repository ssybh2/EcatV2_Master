# DSHOT_RPM: experimental read-only ESC feedback task

**Development status (2026-10-11): software message + PDO plumbing only.**
The H750 receiver **has not yet been enabled** and the RPM topic will
publish `valid_mask=0` until a supported ESC, GPIO turnaround and RX capture
implementation have been validated on hardware. Do NOT treat this as a
working motor-speed sensor.

This feature lives only on `feature/dshot600-esc-rpm-telemetry` and does
not modify the original `DSHOT` command task.

## Two related, separate EtherCAT tasks

- **DSHOT task type 4**: four 16-bit **commands**; *ROS -> master -> H750 -> ESC*.
- **DSHOT_RPM task type 16**: four 12-bit e-period **telemetry values** and
  a validity byte; *ESC -> H750 -> master -> ROS* (once RX firmware exists).

An instance of `DSHOT_RPM` takes a single `sdowrite_dshot_id` (1 or 2)
as **uint8** SDO configuration, and needs **nine input PDO bytes**. It
publishes `custom_msgs/msg/ReadDSHOTRpm`.

```text
uint8 dshot_id                  # 1 or 2
uint8 valid_mask                # bit i = fresh CRC-checked channel i
uint16[4] period_us             # 0 for stopped / invalid; examine mask!
uint32[4] electrical_rpm        # UNSIGNED eRPM, not mechanical RPM
```

The underlying PDO layout is nine bytes:

```
offset +0..1 : uint16 raw e-period payload, channel 1
offset +2..3 : uint16 raw e-period payload, channel 2
offset +4..5 : uint16 raw e-period payload, channel 3
offset +6..7 : uint16 raw e-period payload, channel 4
offset +8    : uint8 valid_mask
```

All multibyte integers are little endian. A valid payload `0xFFF`
means *motor stopped*, whereas `0xFFFF` means invalid/unavailable.
Stale frames (> 100 ms on the H750) have their bit cleared from the
validity mask. This is crucial: `electrical_rpm=0` with mask=0 **does not
mean a stopped motor**.

## Illustrative six-motor task layout

For two DShot groups of four channels each, use two write tasks and
two read tasks. **This is a fragment, not a ready-to-run YAML file**:
the real board serial number, SDO length, PDO sizes and task ordering
must agree with the generated full config and actual firmware build.

```yaml
tasks:
  - app_1:       # first four DShot commands
      sdowrite_task_type: !uint8_t 4
      sdowrite_connection_lost_write_action: !uint8_t 2
      sdowrite_dshot_id: !uint8_t 1
      sdowrite_init_value: !uint16_t 0
      sub_topic: !std::string '/ecat/dshot1/write'
      pdowrite_offset: !uint16_t 0
  - app_2:       # other four DShot commands (only CH1/CH2 for motors 5/6)
      sdowrite_task_type: !uint8_t 4
      sdowrite_connection_lost_write_action: !uint8_t 2
      sdowrite_dshot_id: !uint8_t 2
      sdowrite_init_value: !uint16_t 0
      sub_topic: !std::string '/ecat/dshot2/write'
      pdowrite_offset: !uint16_t 8
  - app_3:       # group 1 RPM read
      sdowrite_task_type: !uint8_t 16
      sdowrite_dshot_id: !uint8_t 1
      pub_topic: !std::string '/ecat/dshot1/rpm'
      pdoread_offset: !uint16_t 0
  - app_4:       # group 2 RPM read
      sdowrite_task_type: !uint8_t 16
      sdowrite_dshot_id: !uint8_t 2
      pub_topic: !std::string '/ecat/dshot2/rpm'
      pdoread_offset: !uint16_t 9
```

When only these four tasks exist:
- 2 DSHOT commands: 16 output PDO bytes total.
- 2 RPM reads: 18 input PDO bytes total.
- `task_count = 4`.
- With the correct uint8/uint16 field widths shown, task argument bytes
  should be **15** total: one byte task count, plus
  2 × (type 1 + fail action 1 + dshot ID 1 + initial command 2),
  plus 2 × (type 1 + dshot ID 1).
  Check the EEPROM/SDO handshake used by your installed firmware before
  applying this value.

**Important:** the original H750 firmware maps software
`dshot_id=1` to TIM3, `dshot_id=2` to TIM2, **opposite the net names**
shown in the provided PCB schematic. Do not assume the printed schematic
label corresponds to your current software ID until checked physically.

## Compatibility and safe deployment

- BLHeli `Bidirectional 3D` is motor reversing, **not** bidirectional
  DShot feedback. Exact Flycolor Raptor 35A model + firmware support must
  be verified using the ESC configurator.
- Genuine bidirectional DShot requires inverted TX signal and checksum,
  a high-impedance line turnaround and a 750 kbit/s RX decoder for
  DShot600. This firmware currently **does not capture replies**.
- The eRPM value has **no rotation sign**. A signed `omega_rad_s` for
  Rolling-ZLT requires a separate reliable reversal-state estimator,
  or another sensor/ESC protocol supplying direction.
- Before actual bench spin: set the initial/disconnect command to 0,
  remove the propellers, test watchdog, verify DMA and port mappings.
- Never infer a valid sensor reading solely from a nonzero numeric RPM.
- Check total slave input/output PDO budgets. Firmware's default
  `slave2master` and `master2slave` buffers are 80 bytes each.

See the companion H750 branch:
`docs/DSHOT_RPM_H750_SCHEMATIC_REVIEW.md`.
