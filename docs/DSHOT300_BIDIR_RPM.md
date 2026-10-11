# DShot300 bidirectional eRPM: additive EtherCAT task

**LAB-ONLY: the H750 receiver has not been validated on hardware. Do not
use for flight or loaded actuators.** This change does NOT replace any
existing AIMEtherCAT task or alter the legacy DShot600 command layout.

## Wire protocol and application IDs

| Task type | Meaning | Master-to-slave PDO | Slave-to-master PDO |
| --- | --- | --- | --- |
| 4 | Legacy DSHOT600 (unchanged) | four uint16 DShot commands | none |
| 16 | Read-only DSHOT_RPM (unchanged) | none | 4 x uint16 encoded e-periods, uint8 validity mask |
| 17 | **NEW** DSHOT300_BIDIR (lab only) | same four uint16 DShot commands as type 4 | none |

The ROS command message remains `custom_msgs/msg/WriteDSHOT`.
The ROS read message remains `custom_msgs/msg/ReadDSHOTRpm`.
No existing topic or task type has been removed or renumbered.
The source on the H750 must be compiled with
`-DAIM_DSHOT_RPM_LAB_RX=ON` to recognize task 17. The default
firmware intentionally rejects task 17 (without generating any motor
output). Do NOT select task 17 when running default firmware.
Type 17 currently supports only `dshot_id: 2` (TIM2 PA0-PA3), and
**only channel 1 on PA0 is captured**: all other RPM channels report
invalid. It is an electrical feasibility test, not a production driver.

## Ubuntu ROS2 Humble configuration example (sn4653120)

Do not modify your existing working configuration until both host and
slave firmware have been tested on a propeller-free setup.
Use this as a *separate* test YAML:

```yaml
slaves:
  - sn4653120:
      sdo_len: !uint16_t 8
      task_count: !uint8_t 2
      latency_pub_topic: !std::string '/ecat/sn4653120/latency'
      tasks:
        - app_1:
            sdowrite_task_type: !uint8_t 17
            sdowrite_connection_lost_write_action: !uint8_t 0x02
            sub_topic: !std::string '/ecat/sn4653120/app1/write'
            pdowrite_offset: !uint16_t 0
            sdowrite_dshot_id: !uint8_t 2
            sdowrite_init_value: !uint16_t 0
        - app_2:
            sdowrite_task_type: !uint8_t 16
            sdowrite_dshot_id: !uint8_t 2
            pdoread_offset: !uint16_t 0
            pub_topic: !std::string '/ecat/sn4653120/app2/rpm'
```

## Safety, test matrix and scope

1. Leave existing task type 4 configuration unchanged for normal operation.
2. Confirm the ESC eRPM reply over DShot300 on Betaflight (done by operator).
3. Connect oscilloscope/logic analyzer to PA0 DShot line and check idle high,
   inverted command CRC, and that the H750 is tri-stated during ESC reply.
4. Only then try lab firmware with NO PROPELLERS and a physical power cutoff.
5. With only channel 1 connected, require that `valid_mask & 1` toggles
   only for CRC-checked and recent replies. An unconnected/missing ESC MUST
   produce invalid data, never simulated RPM.
6. Validate DShot600 task 4 + other EtherCAT tasks against baseline before
   any broader deployment.

The returned `electrical_rpm` magnitude is not a signed mechanical RPM.
Mechanical RPM = eRPM / number_of_pole_pairs. Reversal direction needs an
independent verified state.

H750 firmware branch:
https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/tree/feature/dshot300-bidir-rpm
