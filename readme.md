# EcatV2 Master — 6-IMU Extension

> 基于 `AIMEtherCAT/EcatV2_Master` 的个人 6-IMU 扩展分支。  
> 目标：`STM32H750 + AX58100 + 2×CAN + 6×HIPNUC HI92 @ 500 Hz`。

## 🚀 Quick Links

| 入口 | 链接 |
| --- | --- |
| 🌐 6-IMU TaskEditor 在线版 | https://ssybh2.github.io/EcatV2_Master/ |
| 💻 TaskEditor 源码 | https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor |
| 📘 完整小白部署教程 | [docs/6imu-deployment-beginner-cn.md](docs/6imu-deployment-beginner-cn.md) |
| 🧪 6-IMU 压力测试（中英双语） | [docs/6imu-500hz-test-plan.md](docs/6imu-500hz-test-plan.md) |
| ⚙️ Config Generator | [docs/configuration-generator.md](docs/configuration-generator.md) |
| 🧭 Docs 导航 | [docs/README.md](docs/README.md) |

## Branches

| Branch | 用途 |
| --- | --- |
| `main` | 保留上游基线，方便对照 |
| `feature/6imu-large-pdo` | 当前 6-IMU 开发、部署与真机验证分支 |

`feature/6imu-task-editor` 只是网页开发时留下的 staging branch；网页代码已经完整进入 `feature/6imu-large-pdo/web/6imu-task-editor/`。

## 最终 ROS 2 Workspace 结构

本分支继续遵循原仓库 `first-run-test.md` 的 bringup 思路：

```text
<workspace>/
├── src/
│   ├── EcatV2_Master/
│   │   ├── src/
│   │   │   ├── soem_wrapper/
│   │   │   ├── soem/
│   │   │   └── custom_msgs/
│   │   ├── tools/
│   │   ├── eeproms/
│   │   └── web/6imu-task-editor/
│   │
│   └── soem_bringup/
│       ├── CMakeLists.txt
│       ├── package.xml
│       ├── config/
│       │   └── config.yaml
│       └── launch/
│           └── bringup.launch.py
│
├── build/
├── install/
└── log/
```

角色：

```text
soem_wrapper  = EtherCAT Master 程序
soem_bringup  = 你的配置与启动包
```

**最终启动命令：**

```bash
ros2 launch soem_bringup bringup.launch.py
```

## Target System

```text
CAN1 @ 1 Mbps                       CAN2 @ 1 Mbps
├─ IMU1 Slot1 01/02/03             ├─ IMU4 Slot1 01/02/03
├─ IMU2 Slot2 04/05/06             ├─ IMU5 Slot2 04/05/06
└─ IMU3 Slot3 07/08/09             └─ IMU6 Slot3 07/08/09
              \                     /
               \                   /
                STM32H750 + AX58100
                         │
                     EtherCAT
                         │
                    ROS 2 + SOEM
                         │
                 6 × sensor_msgs/Imu
```

EtherCAT identity：

```text
ProductCode = 0x00000005
Master -> Slave = 80 B
Slave  -> Master = 160 B
```

160B Slave→Master：

```text
0..125    6 × IMU payload
126..137  6 × sample_seq
138..149  6 × incomplete_samples
150..159  CAN FIFO lost/full/read-error diagnostics
```

## 本分支新增

- 6 个 HIPNUC CAN IMU：CAN1/CAN2 各 3 个。
- ProductCode `0x05` / 160B Slave→Master PDO。
- P1→P2→P3 完整组包后才提交 sample。
- H750 FDCAN RX FIFO 扩容与 FIFO drain。
- FIFO lost/full/read-error diagnostics。
- `sample_seq` 去重：只有真正的新 IMU sample 才发布 ROS2 topic。
- 6-IMU TaskEditor。
- `flash_6imu_eeprom.sh`：EEPROM 备份/刷写/读回验证。
- `prepare_6imu_bringup.sh`：自动创建原版风格的 `soem_bringup` package。

## 推荐部署顺序

```text
Environment Setup
→ Realtime kernel / CPU isolation
→ 建 ROS 2 workspace
→ 烧 3 种 G431 Slot 固件
→ 烧 H750 固件
→ CAN / EtherCAT 接线
→ slaveinfo
→ 备份并刷 ProductCode 0x05 EEPROM
→ 自动创建 soem_bringup（先用假 SN）
→ colcon build
→ ros2 launch soem_bringup bringup.launch.py
→ 从日志读取真实 SN
→ TaskEditor / helper 生成正式 config.yaml
→ 再次 colcon build
→ 正式进入 OP
→ 检查 6 个 ROS2 IMU topic
→ 1 → 2 → 3 → 3+1 → 3+2 → 3+3 压力测试
```

完整步骤、命令、成功标准和错误判断：

**[6 个 IMU × 500 Hz EtherCAT 完整部署教程（小白版）](docs/6imu-deployment-beginner-cn.md)**

## Related Firmware

- H750 + AX58100: https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/tree/feature/6imu-large-pdo
- HIPNUC bridge: https://github.com/ssybh2/hipnucimu/tree/feature/6imu-500hz-stable

## Upstream

所有 6-IMU 修改都只在 `ssybh2` Fork 内。

- https://github.com/AIMEtherCAT/EcatV2_Master
- https://github.com/AIMEtherCAT/EcatV2_AX58100_H750_Universal
- https://github.com/AIMEtherCAT/hipnucimu
