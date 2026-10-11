# RPM loss diagnosis without changing legacy DShot

The confirmed DShot300 receive proof-of-concept intermittently obtains
nonzero RPM on TIM2/PA0, but the user's 20-second stationary bench
measurement had 71,117 ROS messages with only 9,708 carrying
`valid_mask & 1` (13.65%), and 44 validity transitions. A **100 ms
sample cache** means that percentage is NOT the instantaneous success
rate of returned ESC packets. RPM was 0 because the motor was stopped
during that monitoring interval.

## New optional read-only type 18

Type 4: original DShot600 (unchanged).
Type 17: experimental bidirectional DShot300 with 8-byte command PDO
(unchanged).
Type 16: existing 9-byte eRPM PDO (unchanged).
Type 18: new 40-byte H750 receiver diagnostics; **LAB build only**.

New message: `custom_msgs/msg/ReadDSHOTRpmDiag`
Best-effort publication topic:
`/ecat/sn4653120/app3/rpm_diagnostics`

Fields in transmitted 40-byte PDO order (all uint32):
- tx_complete
- capture_calls
- no_start_edge
- edge_overflow
- decode_ok
- decode_fail
- total_edges
- last_edge_count
- last_ok_age_ms
- no_capture_window

Counters are cumulative since boot. `last_ok_age_ms == 4294967295`
means no successful decoded reply since boot.

## Separate test YAML

`src/soem_wrapper/config/dshot300_rpm_diagnostics.yaml`

This is the ONLY config to use for type18 testing, and ONLY with the
matching H750 LAB firmware:
`feature/dshot300-rpm-diagnostics` /
`-DAIM_DSHOT_RPM_LAB_RX=ON`.

- `sdo_len=10` (2 bytes more than the original 2-task configuration)
- `task_count=3`
- app1 type17, dshot_id2, motor output PDO offset0
- app2 type16, dshot_id2, RPM input PDO offset0
- app3 type18, dshot_id2, diagnostics input PDO offset9
- RPM and diagnostics occupy 49 bytes; original slave buffer is 80 bytes

No production YAML is altered.

## Ubuntu ROS2 Humble build

```bash
cd /home/hby/Rolling_ZLT/src/EcatV2_Master
git fetch rpmfork
git switch -c feature/dshot300-rpm-diagnostics \
  --track rpmfork/feature/dshot300-rpm-diagnostics
cd /home/hby/Rolling_ZLT
source /opt/ros/humble/setup.bash
colcon --log-base log_dshot300_diag build \
  --base-paths src/EcatV2_Master/src \
  --build-base build_dshot300_diag \
  --install-base install_dshot300_diag \
  --packages-select custom_msgs soem soem_wrapper \
  --cmake-args -DCMAKE_BUILD_TYPE=Release
source install_dshot300_diag/setup.bash
```

To run after hardware safety gate (no props, safe waveform, power cutoff):

```bash
ros2 run soem_wrapper soem_backend --ros-args \
  -p interface:=enp2s0 \
  -p config_file:=/home/hby/Rolling_ZLT/src/EcatV2_Master/src/soem_wrapper/config/dshot300_rpm_diagnostics.yaml
```

Inspect read-only diagnostics with `BEST_EFFORT`:

```bash
ros2 topic echo /ecat/sn4653120/app3/rpm_diagnostics \
  --qos-reliability best_effort
```

Compare two readings a few seconds apart; delta counters identify if
missing TX completion, no ESC reply edges, or CRC/GCR decoding failures
dominate. Do not treat 13.65% cached-mask availability as a per-frame
ESC telemetry loss percentage.

H750 source and CI:
https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/tree/feature/dshot300-rpm-diagnostics
