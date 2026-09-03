# EcatV2 Master — ProductCode 0x06：6IMU + DJI RC + DShot

当前真机验证分支：`feature/6imu-rc-dshot-pdo-v006`。

## 当前 Profile

| 项目 | 值 |
|---|---:|
| ProductCode / eepid | `0x00000006` |
| M→S application PDO | `80 B` |
| S→M application PDO | `192 B` |
| EtherCAT Outputs | `81 B / 648 bit` |
| EtherCAT Inputs | `193 B / 1544 bit` |
| task_count | `8` |
| sdo_len | `91 B` |

S→M：`0..125` 六个 IMU，`126..159` diagnostics，`160..178` DJI RC（18 B DBUS + 1 B online），`179..191` reserved。

M→S：`0..7` DShot（4 × uint16），`8..79` reserved。

## 真机验证

已在 STM32H750 + AX58100 上验证：

```text
Product Code     : 00000006
Checksum         : 009C
calculated       : 009C
Output size      : 648 bits
Input size       : 1544 bits
SM2              : 81 B
SM3              : 193 B
SAFE_OP          : State 4
Master           : reached OP
```

Master 已稳定进入数据循环。6-IMU 已运行；DJI RC / DShot 已完成软件集成，实际遥控器/执行器功能仍应按安全条件分别测试。

## 8-task TaskEditor

- 在线：<https://ssybh2.github.io/EcatV2_Master/>
- 源码：`web/6imu-task-editor/`
- 文档：`docs/6imu-task-editor.md`

Editor 现在生成 `0x06 / task_count=8 / sdo_len=91`，包含 Task 7 DJI RC 和 Task 8 DShot。

## 配置

通用模板：

```text
src/soem_wrapper/config/config_6imu_rc_dshot_template.yaml
```

创建本机 bringup：

```bash
./tools/prepare_6imu_rc_dshot_bringup.sh <serial> <interface> <rt-cpu> <non-rt-cpus>
```

本机 `src/soem_bringup/` 含真实 Serial/NIC/CPU，已加入 `.gitignore`，不要作为公共模板提交。

## EEPROM / SII

当前已验证的 2048-byte AX58100 SII 不含静态 RxPDO / TxPDO category；实际 PDO mapping 与 SM 长度由 H750 上 SOES 的 CoE object dictionary 动态提供。

0x06 镜像由已知可工作的 0x05 EEPROM 复制而来，只修改 SII ProductCode 字段（byte offset `0x14`：`0x05 → 0x06`）。实际写入、读回和断电重启后已验证 ProductCode 0x06、checksum 一致、81 B / 193 B PDO。

详见 `docs/6imu-dji-rc-dshot-deployment-cn.md`。

## Legacy

ProductCode `0x05`（80/160 B、6 个纯 IMU task、sdo_len 85）继续保留为 legacy profile，不要与 0x06 配置混用。

## DShot 安全

首次 DShot 实机验证建议卸下桨叶/脱离负载并准备断电。默认：

```text
connection_lost_write_action = 2
dshot_id = 1
init_value = 0
pdowrite_offset = 0
```
