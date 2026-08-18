# 6-IMU / 500 Hz Bringup Guide

This guide is for the `feature/6imu-large-pdo` stack:

- 6 Hipnuc IMUs at 500 Hz
- STM32H750 + AX58100 EtherCAT slave
- ProductCode / EEPROM ID `0x00000005`
- Master -> Slave PDO: 80 bytes
- Slave -> Master PDO: 160 bytes
- ROS 2 Humble + SOEM master

The intended physical IMU layout is:

```text
CAN1
  Slot1: CAN IDs 0x01 / 0x02 / 0x03
  Slot2: CAN IDs 0x04 / 0x05 / 0x06
  Slot3: CAN IDs 0x07 / 0x08 / 0x09

CAN2
  Slot1: CAN IDs 0x01 / 0x02 / 0x03
  Slot2: CAN IDs 0x04 / 0x05 / 0x06
  Slot3: CAN IDs 0x07 / 0x08 / 0x09
```

Each IMU occupies 21 bytes in the slave-to-master PDO. The six read offsets are:

```text
0, 21, 42, 63, 84, 105
```

## 1. Keep the three software pieces matched

Use the matching 6-IMU feature versions for:

1. Hipnuc IMU firmware
2. `EcatV2_AX58100_H750_Universal`
3. `EcatV2_Master`

Do not mix the ProductCode `0x05` master with an older 80-byte-only slave EEPROM image.

## 2. Flash the IMU firmware

Program the three IMU slot variants so their CAN IDs do not overlap on the same CAN bus.

Before installing all six IMUs, test them in stages according to `docs/6imu-500hz-test-plan.md`.

## 3. Flash the H750 application firmware

Use the firmware produced by the H750 GitHub Actions workflow named:

```text
six-imu-slave-firmware
```

The artifact contains:

```text
EcatV2_AX58100_H750_Universal.elf
EcatV2_AX58100_H750_Universal.hex
EcatV2_AX58100_H750_Universal.bin
```

Use the normal STM32 flashing method for the board. This is the H750 MCU application firmware; it is not the AX58100 EEPROM image.

## 4. Back up and flash the AX58100 EEPROM

The target EEPROM image is:

```text
eeproms/58100H750_UniversalModule_6IMU_LargePDOV.bin
```

The safe helper script validates ProductCode `0x05`, backs up the current EEPROM, asks for an explicit confirmation, writes the new image, reads it back, and compares every byte.

Example:

```bash
cd ~/foot_ws
chmod +x tools/flash_6imu_eeprom.sh
./tools/flash_6imu_eeprom.sh enx000ec6c1d02b 1
```

Replace the interface and slave number with the real values on the machine.

After a successful EEPROM write, power-cycle the EtherCAT slave before doing final discovery/mapping tests.

## 5. Check the slave identity before ROS 2 bringup

First inspect the slave without starting the ROS 2 backend:

```bash
sudo ./tools/slaveinfo enx000ec6c1d02b
```

and/or:

```bash
sudo ./tools/eepromtool enx000ec6c1d02b 1 -i
```

The target identity is ProductCode `0x00000005`.

Record the actual board serial number printed during discovery. The serial number is used as the key in the ROS 2 configuration file.

## 6. Generate the 6-IMU ROS 2 configuration automatically

Do not manually edit the six task blocks unless necessary. Use:

```bash
chmod +x tools/prepare_6imu_bringup.sh
./tools/prepare_6imu_bringup.sh <slave-serial> <ethercat-interface> <rt-cpu> <non-rt-cpus>
```

Example:

```bash
./tools/prepare_6imu_bringup.sh 2883658 enx000ec6c1d02b 1 0,2-15
```

It generates two local machine-specific files:

```text
src/soem_wrapper/config/dev-config.yaml
src/soem_wrapper/launch/bringup.launch.py
```

These files are ignored by Git.

The generated configuration contains:

```text
sdo_len    = 85 bytes
task_count = 6
CAN1 slots = app_1 / app_2 / app_3
CAN2 slots = app_4 / app_5 / app_6
PDO offsets = 0 / 21 / 42 / 63 / 84 / 105
```

## 7. Build the master

From the workspace root:

```bash
source /opt/ros/humble/setup.bash
colcon build
source install/setup.bash
```

The generated config and launch files must be built/installed before launching.

## 8. Start the ROS 2 EtherCAT backend

The EtherCAT backend needs permission to use the raw network interface. Use the same root/capability method already used for this project.

Typical root workflow:

```bash
sudo su
source /opt/ros/humble/setup.bash
source install/setup.bash
ros2 launch soem_wrapper bringup.launch.py
```

A healthy startup should progress through slave discovery, configuration, SAFE_OP and OP, and finally report that the slave is ready.

For ProductCode `0x05`, the master registers the module as:

```text
H750UniversalModule (6-IMU Large PDO V.)
Master -> Slave: 80 bytes
Slave  -> Master: 160 bytes
```

## 9. Verify all six ROS 2 IMU topics

The generated topics are:

```text
/imu/can1/slot1
/imu/can1/slot2
/imu/can1/slot3
/imu/can2/slot1
/imu/can2/slot2
/imu/can2/slot3
```

Check they exist:

```bash
ros2 topic list | grep '^/imu/'
```

Check each one is updating:

```bash
ros2 topic echo /imu/can1/slot1 --once
```

Then measure rate, one topic at a time:

```bash
ros2 topic hz /imu/can1/slot1
```

Repeat for the other five topics.

Do not treat one successful packet as a stability result. Use the staged durations in `docs/6imu-500hz-test-plan.md`.

## 10. Staged hardware test order

Use this order so a fault can be localized instead of hidden inside the full six-IMU system:

```text
CAN1: 1 IMU
  -> CAN1: 2 IMUs
  -> CAN1: 3 IMUs
  -> CAN1: 3 + CAN2: 1
  -> CAN1: 3 + CAN2: 2
  -> CAN1: 3 + CAN2: 3
```

At every stage record:

- ROS 2 topic frequency and jitter
- missing/stale IMU values
- H750 FDCAN FIFO lost/full counters
- incomplete sample counters
- CAN RX read errors
- IMU-side CAN TX deferred/fail counters
- CAN error state / Bus-Off events

If the full software diagnostic counters remain clean but the physical CAN bus shows errors, then move the investigation toward termination, wiring, grounding, transceiver power and stub length.

## Stop conditions

Stop the test and fix the fault before adding more IMUs if any of the following begins increasing continuously:

```text
FDCAN FIFO lost/full
incomplete sample count
CAN RX error count
CAN TX fail count
Bus-Off count
```

The purpose of staged testing is to find the first topology/load level where the system changes from stable to unstable.
