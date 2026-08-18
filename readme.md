# EcatV2 Master — 6-IMU Extension

> 基于 [AIMEtherCAT/EcatV2_Master](https://github.com/AIMEtherCAT/EcatV2_Master) 的个人 6-IMU 扩展分支。  
> 本分支用于 `STM32H750 + AX58100 + 2×CAN + 6×HIPNUC HI92 @ 500 Hz` 的开发与真机验证。

## 🚀 Quick Links

| 入口 | 链接 |
| --- | --- |
| 🌐 6-IMU TaskEditor 在线版 | https://ssybh2.github.io/EcatV2_Master/ |
| 💻 6-IMU TaskEditor 源码 | https://github.com/ssybh2/EcatV2_Master/tree/feature/6imu-large-pdo/web/6imu-task-editor |
| 📘 小白部署教程 | [docs/6imu-deployment-beginner-cn.md](docs/6imu-deployment-beginner-cn.md) |
| 🧭 教程导航 | [docs/README.md](docs/README.md) |
| 🧪 6-IMU 压力测试计划 | [docs/6imu-500hz-test-plan.md](docs/6imu-500hz-test-plan.md) |
| ⚙️ 配置生成说明 | [docs/configuration-generator.md](docs/configuration-generator.md) |

## Branches

这个 Fork 现在只需要记住两个有效角色：

| Branch | 用途 |
| --- | --- |
| `main` | 保留原版/上游基线，方便随时对照 |
| `feature/6imu-large-pdo` | 当前真正使用的 6-IMU 开发、部署与测试分支 |

`feature/6imu-task-editor` 是网页开发时留下的 staging 分支。它已经与 `feature/6imu-large-pdo` 同步，**后续不再使用，可以安全删除**；网页源码已经完整保存在 `feature/6imu-large-pdo/web/6imu-task-editor/`。

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

### EtherCAT identity

```text
ProductCode = 0x00000005
Master -> Slave = 80 B
Slave  -> Master = 160 B
```

160 B Slave→Master PDO：

```text
0..125    6 × IMU payload (6 × 21 B)
126..137  6 × sample_seq
138..149  6 × incomplete_samples
150..159  CAN FIFO lost/full/read-error diagnostics
```

## What This Branch Adds

- 6 个 HIPNUC CAN IMU 固定布局，CAN1/CAN2 各 3 个。
- 新的 ProductCode `0x05` / 160 B Large PDO。
- 每个 IMU 的 `P1 -> P2 -> P3` 完整组包后才提交。
- CAN RX FIFO 扩容、一次中断清空 FIFO、FIFO lost/full/read-error 诊断。
- `sample_seq` 去重：Master 只在真正有新 IMU sample 时发布 ROS 话题。
- 6-IMU TaskEditor：网页直接生成兼容本分支的 YAML。
- `flash_6imu_eeprom.sh`：备份、校验、刷写、读回验证 ProductCode 0x05 EEPROM。
- `prepare_6imu_bringup.sh`：根据 Slave SN / 网卡 / CPU 配置自动生成本机 `dev-config.yaml` 与 `bringup.launch.py`。

## Recommended Deployment Order

第一次部署不要直接插满 6 个 IMU。按下面顺序：

```text
1. 配好 Ubuntu / ROS 2 / 实时内核
2. 烧 3 种 hipnucimu Slot 固件
3. 烧 H750 6-IMU 固件
4. 只连接 1 块 EtherCAT 从站
5. slaveinfo 确认物理链路
6. 备份并刷 ProductCode 0x05 EEPROM
7. 先用占位 SN 启动一次，读取真实 SN
8. 用 TaskEditor 或 prepare_6imu_bringup.sh 生成正式配置
9. colcon build
10. 进入 OP
11. 1 → 2 → 3 → 3+1 → 3+2 → 3+3 逐级压力测试
```

完整命令、预期输出和错误判断请直接看：

**[6 个 IMU × 500 Hz EtherCAT 部署教程（小白版）](docs/6imu-deployment-beginner-cn.md)**

## Directory Structure

```text
EcatV2_Master/
├── docs/
│   ├── README.md
│   ├── environment-setup.md
│   ├── first-run-test.md
│   ├── configuration-generator.md
│   ├── 6imu-deployment-beginner-cn.md
│   ├── 6imu-task-editor.md
│   └── 6imu-500hz-test-plan.md
├── eeproms/
│   └── 58100H750_UniversalModule_6IMU_LargePDOV.bin
├── src/
│   ├── custom_msgs/
│   ├── soem/
│   └── soem_wrapper/
│       ├── config/config_6imu_template.yaml
│       ├── launch/
│       └── src/
├── tools/
│   ├── slaveinfo
│   ├── eepromtool
│   ├── flash_6imu_eeprom.sh
│   └── prepare_6imu_bringup.sh
└── web/
    └── 6imu-task-editor/
        ├── index.html
        ├── app.js
        ├── generator.js
        ├── styles.css
        └── test-generator.js
```

## Related Firmware Repositories

- H750 + AX58100 slave: https://github.com/ssybh2/EcatV2_AX58100_H750_Universal/tree/feature/6imu-large-pdo
- HIPNUC IMU bridge: https://github.com/ssybh2/hipnucimu/tree/feature/6imu-500hz-stable

## Upstream

This work is based on the original AIMEtherCAT projects. The upstream repositories remain untouched; all 6-IMU changes live only in the `ssybh2` forks.

- Upstream Master: https://github.com/AIMEtherCAT/EcatV2_Master
- Upstream H750 slave: https://github.com/AIMEtherCAT/EcatV2_AX58100_H750_Universal
- Upstream HIPNUC bridge: https://github.com/AIMEtherCAT/hipnucimu
