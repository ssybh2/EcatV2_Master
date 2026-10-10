<div align="center">

# EtherCAT 部署教程

### 从零开始学习 Linux · ROS 2 · EtherCAT

**Salman 控制课程 | Teaching Class**

**语言 / Language：** **简体中文（默认）** · [English — Full Translation](README.en.md)

</div>

---

## 欢迎来到课程

本教程专为 **Salman 控制课程** 的同学编写，尤其适合第一次接触 **Linux、Ubuntu 终端、ROS 2 或 EtherCAT** 的初学者。

我们的目标不是要求你提前掌握所有知识，而是按照清晰的顺序，逐步完成 **开发环境准备 → 首次 EtherCAT 通信测试 → 根据自己的设备自定义配置**。

本教学分支基于原始项目 [AIMEtherCAT/EcatV2_Master](https://github.com/AIMEtherCAT/EcatV2_Master)。该项目使用 **SOEM（Simple Open EtherCAT Master）** 实现 EtherCAT 主站通信，并与 **ROS 2** 集成。本分支重点提供**面向新手的部署路径和课程实践入口**，不代替上游项目的技术文档。

> **文档进度：** 下方三个课程章节已创建并可点击。按照课程安排，**目前只保留章节标题，暂不编写具体操作内容**；后续确定教学步骤后再逐章完善。

## 课程导航

建议按 **01 → 02 → 03** 的顺序学习。无需提前具备 EtherCAT 使用经验，也不要求熟练使用 Linux 或 ROS 2。

| 顺序 | 课程章节 | 即将学习的内容 |
| :---: | --- | --- |
| **01** | **[Environment Setup →](docs/teaching-class/environment-setup.md)** | 配置 Linux、ROS 2 工作空间和 EtherCAT 开发所需的基础环境。 |
| **02** | **[First Run Test →](docs/teaching-class/first-run-test.md)** | 首次启动系统，检查主站与从站之间的基本 EtherCAT 通信。 |
| **03** | **[Customize configuration →](docs/teaching-class/customize-configuration.md)** | 认识配置文件，并逐步适配自己的硬件和控制任务。 |

**提示：** 以上链接均指向课程专用页面，当前页面内**只有标题，没有教程正文**。

## 这份教程适合谁？

- 正在学习 **Salman 控制课程** 的同学。
- 第一次使用 **Ubuntu / Linux** 和**终端命令行**的初学者。
- 对 **ROS 2、Topic（话题）、Workspace（工作空间）** 还不熟悉的同学。
- 希望在机器人或控制系统中部署 **EtherCAT 主站**、但不确定从哪里开始的学习者。

课程会在需要时逐步引入相关概念，不要求你一次性学完所有知识。

## EtherCAT 是什么？与本项目有什么关系？

**EtherCAT** 是一种工业以太网通信技术，用于让一个**主站（Master）** 与多个**从站设备（Slave）** 交换数据。常见从站包括 I/O 模块、电机控制器和传感器接口。

在本项目中，**SOEM** 负责底层 EtherCAT 通信，**ROS 2** 提供机器人软件中的数据接口。我们将沿着下面的学习路径理解整个系统：

```text
Ubuntu / Linux 操作系统
          ↓
ROS 2 工作空间与项目编译
          ↓
EcatV2_Master（ROS 2 + SOEM）
          ↓
EtherCAT 网络与从站设备
          ↓
控制实验中的数据收发
```

## 认识仓库结构

| 路径 | 用途 |
| --- | --- |
| `src/` | ROS 2 功能包及主站相关源代码。 |
| `src/soem/` | SOEM 库源码（Git 子模块）。 |
| `src/soem_wrapper/` | EtherCAT 与 ROS 2 的集成代码。 |
| `src/custom_msgs/` | 项目自定义 ROS 2 消息类型。 |
| `eeproms/` | EtherCAT 从站 EEPROM 相关文件。 |
| `tools/` | EtherCAT 辅助工具。 |
| `docs/teaching-class/` | 本课程的三个独立章节（正文暂留空）。 |

## 开始之前

Ubuntu / ROS 2 的具体版本、需要准备的硬件、终端指令、编译步骤和测试方法，都会在课程方案确定后写入对应章节。**当前主页是学习导航，不是完整安装说明。**

涉及真实硬件时，请先检查接线和供电；在尚未完成相关测试步骤及安全检查前，确保电机等执行器处于安全状态。

---

<sub>**课程：** Salman Control Course · **分支：** `Teaching_Class` · **原始项目：** [AIMEtherCAT/EcatV2_Master](https://github.com/AIMEtherCAT/EcatV2_Master) · **English:** [README.en.md](README.en.md)</sub>
