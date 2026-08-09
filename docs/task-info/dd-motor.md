## EtherCAT Task Introduction

### DD Motor

#### Hardware preparation

Connect your motor to any ``CAN`` port of your EtherCAT module.

> **Note:** all motors will be disabled before receiving any command.

#### Configuration items

* Control Period
    * This controls the frequency at which control frames are sent to the CAN network. For DD Motors, this task will
      forward control commands at this frequency.
* CAN
    * The CAN port you connected to.
* CAN Baudrate
    * The baudrate of the CAN network, should match the setting of your motors.
* Motor Control Packet ID
    * The packet ID of the control frame.
        * 0x32 for motor id 1-4
        * 0x33 for motor id 5-8
* Motor<n> Enable
    * Should this motor be monitored and controlled.
* Motor<n> CAN ID
    * This should be set within the range of the corresponding control packet ID.
* Motor<n> Control Type
    * The control type of motor.

You can change the publisher topic name by inputting a new name in the ``Motor Feedback Publisher Topic Name`` input
box.

You can change the subscriber topic name by inputting a new name in the ``Motor Command Subscriber Topic Name`` input
box.

#### Related ROS2 Message Types

```c
/* Message type: custom_msgs/msg/ReadDDMotor */

std_msgs/Header header

uint8 motor1_online     // 0 or 1
uint16 motor1_ecd
// Please refer to the documentation for the corresponding motor regarding the units of the values
int16 motor1_rpm
int16 motor1_current
uint8 motor1_mode
uint8 motor1_error_code

uint8 motor2_online
uint16 motor2_ecd
int16 motor2_rpm
int16 motor2_current
uint8 motor2_mode
uint8 motor2_error_code

uint8 motor3_online
uint16 motor3_ecd
int16 motor3_rpm
int16 motor3_current
uint8 motor3_mode
uint8 motor3_error_code

uint8 motor4_online
uint16 motor4_ecd
int16 motor4_rpm
int16 motor4_current
uint8 motor4_mode
uint8 motor4_error_code
```

```c
/* Message type: custom_msgs/msg/WriteDDMotor */

uint8 motor1_enable     // 0 or 1
int16 motor1_cmd

uint8 motor2_enable     // 0 or 1
int16 motor2_cmd

uint8 motor3_enable     // 0 or 1
int16 motor3_cmd

uint8 motor4_enable     // 0 or 1
int16 motor4_cmd
```
