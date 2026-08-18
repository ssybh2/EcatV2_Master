# 6 IMU @ 500 Hz validation plan

This document describes the dedicated ProductCode `0x05` six-IMU configuration.
It is intentionally isolated from ProductCode `0x03` (80/80) and `0x04`
(80/112 Large PDO).

## Target topology

```text
CAN1 @ 1 Mbps                     CAN2 @ 1 Mbps
  IMU1 slot1: 0x01/02/03           IMU4 slot1: 0x01/02/03
  IMU2 slot2: 0x04/05/06           IMU5 slot2: 0x04/05/06
  IMU3 slot3: 0x07/08/09           IMU6 slot3: 0x07/08/09
            \                         /
             \                       /
              STM32H750 + AX58100
                       |
                    EtherCAT
                       |
                    SOEM/ROS2
```

Each IMU forwards one logical sample as three classic CAN frames (8B + 8B +
5B). The forwarding period is 2 ms, giving a target rate of 500 Hz per IMU.
The two CAN buses are independent, so the same three ID slots are intentionally
reused on CAN1 and CAN2.

## Firmware branches

- Slave: `ssybh2/EcatV2_AX58100_H750_Universal`, branch `feature/6imu-large-pdo`
- Master: `ssybh2/EcatV2_Master`, branch `feature/6imu-large-pdo`
- IMU bridge: `ssybh2/hipnucimu`, branch `feature/6imu-500hz-stable`

Do not merge these branches into `main` until the complete hardware validation
below passes.

## ProductCode 0x05 PDO layout

Master -> Slave application buffer remains 80 bytes.

Slave -> Master application buffer is 160 bytes:

| Byte range | Meaning |
| --- | --- |
| 0..20 | IMU1, 21B |
| 21..41 | IMU2, 21B |
| 42..62 | IMU3, 21B |
| 63..83 | IMU4, 21B |
| 84..104 | IMU5, 21B |
| 105..125 | IMU6, 21B |
| 126..137 | six `uint16` sample sequence counters |
| 138..149 | six `uint16` incomplete P1/P2/P3 counters |
| 150..151 | CAN1 RX FIFO message-lost counter, low 16 bits |
| 152..153 | CAN2 RX FIFO message-lost counter, low 16 bits |
| 154..155 | CAN1 RX FIFO-full counter, low 16 bits |
| 156..157 | CAN2 RX FIFO-full counter, low 16 bits |
| 158 | CAN1 HAL FIFO read-error counter, low 8 bits |
| 159 | CAN2 HAL FIFO read-error counter, low 8 bits |

The EtherCAT `slave_status` byte is a separate PDO object and is not included in
the 160-byte application buffer above.

## IMU bridge firmware images

Building target `hipnucimu_all_slots` produces three images:

- `hipnucimu_slot1.hex/.bin`: 0x01 / 0x02 / 0x03
- `hipnucimu_slot2.hex/.bin`: 0x04 / 0x05 / 0x06
- `hipnucimu_slot3.hex/.bin`: 0x07 / 0x08 / 0x09

Flash slot1/slot2/slot3 to the three IMU bridges on CAN1. Repeat the same
slot1/slot2/slot3 images for the three bridges on CAN2.

## Validation sequence

Do not begin with all six IMUs. Increase load in controlled steps:

1. One IMU on CAN1 for at least 5 minutes.
2. Two IMUs on CAN1 for at least 10 minutes.
3. Three IMUs on CAN1 for at least 15 minutes.
4. Three IMUs on CAN1 + one IMU on CAN2.
5. Three IMUs on CAN1 + two IMUs on CAN2.
6. Full six-IMU configuration for at least 30 minutes.

At every step verify the ROS topic rate and all diagnostic counters before
adding another IMU.

## Healthy result

For a healthy system, after initial startup:

- every IMU `sample_seq` continuously increments;
- each ROS IMU topic is close to 500 Hz and is published only when the sequence
  counter changes;
- every `incomplete_samples` counter remains at 0;
- CAN1/CAN2 FIFO lost counters remain at 0;
- CAN1/CAN2 FIFO full counters remain at 0;
- CAN1/CAN2 read-error counters remain at 0;
- IMU bridge `can_tx_fail_count` remains at 0;
- IMU bridge `can_busoff_recovery_count` remains at 0;
- UART CRC/header/length/tag error counters remain at 0 or extremely rare and
  non-growing after startup.

## How to interpret failures

### H750 FIFO lost/full increases

The H750 receive side is not draining CAN fast enough, or interrupt latency is
too high. This points to slave-side software/timing pressure rather than an
EtherCAT PDO-size problem.

### `incomplete_samples` increases but FIFO lost/full stays zero

The H750 did not receive a complete P1 -> P2 -> P3 logical sample. Check the IMU
bridge Tx diagnostics and then the physical CAN bus.

### IMU bridge `can_tx_group_deferred_count` increases

The previous CAN frames are still queued when the next 500 Hz sample arrives.
This is a direct indication that the local CAN transmitter/bus is approaching
its practical throughput limit.

### IMU bridge `can_tx_fail_count` or Bus-Off recovery increases

Check CAN wiring, both end terminations, common ground, transceiver supply,
connector quality, stub lengths, and bitrate consistency before increasing the
number of IMUs.

### UART CRC/header/length/tag errors increase

The fault is before CAN: HI92 -> STM32G431 UART reception/framing is unhealthy.
Do not debug EtherCAT first.

### Sequence jumps but CAN/incomplete counters stay clean

The slave committed samples correctly, but the master did not observe every
sample. Inspect EtherCAT cycle timing, WKC/state warnings, CPU scheduling and
master load.

## Why stale slave XML/SII is not a blocker for the first SOEM test

This master calls `ec_config_map()`. For mailbox slaves supporting CoE, SOEM
first reads the live PDO assignment/mapping from the slave's CoE object
dictionary. It falls back to SII PDO mapping only if CoE does not return an IO
mapping. Therefore the ProductCode 0x05 runtime object dictionary is the source
of truth for the first SOEM hardware test.

The `slave.esx/slave.xml/slave.bin` generation chain still needs to be cleaned
up before calling the ProductCode 0x05 device definition final, especially for
TwinCAT/offline ESI use. Do not treat those generated artifacts as final yet.
