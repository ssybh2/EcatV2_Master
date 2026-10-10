<div align="center">

# EtherCAT 部署教程

### 从零开始学习 Linux · ROS 2 · EtherCAT

**Salman 控制课程 | 408 Control System Lab**

**语言 / Language：** **简体中文（默认）** · [English — Full Translation](README.en.md)

</div>

---

## 欢迎来到课程

本教程专为 **航空航天专业Salman-2003-控制课程** 的同学编写，尤其适合第一次接触 **Linux、Ubuntu 终端、ROS 2 或 EtherCAT** 的初学者。

我们的目标不是要求你提前掌握所有知识，而是按照清晰的顺序，在短时间内逐步完成 **开发环境准备 → 首次 EtherCAT 通信测试 → 根据自己的设备自定义配置**。

本教学分支基于 **[AIMEtherCAT / EcatV2_Master](https://github.com/AIMEtherCAT/EcatV2_Master)** 开发。特别感谢 **[Control System Lab（UNNC）](https://github.com/ControlSystemLab-UNNC)** 的支持，以及原项目贡献者 **[hangx05](https://github.com/AIMEtherCAT/EcatV2_Master/commits?author=hangx05)** 的工作与贡献。


## 课程导航

建议按 **01 → 02 → 03** 的顺序学习。无需提前具备 EtherCAT 使用经验，也不要求熟练使用 Linux 或 ROS 2。

| 顺序 | 课程章节 | 即将学习的内容 |
| :---: | --- | --- |
| **01** | **[Environment Setup →](docs/teaching-class/environment-setup.md)** | 配置 Linux、ROS 2 工作空间和 EtherCAT 开发所需的基础环境。 |
| **02** | **[First Run Test →](docs/teaching-class/first-run-test.md)** | 首次启动系统，检查主站与从站之间的基本 EtherCAT 通信。 |
| **03** | **[Customize configuration →](docs/teaching-class/customize-configuration.md)** | 认识配置文件，并逐步适配自己的硬件和控制任务。 |

**提示：** 以上链接均指向课程专用页面，当前页面内**只有标题，没有教程正文**。

## EtherCAT 是什么？与本项目有什么关系？

**EtherCAT** 是一种工业以太网通信技术，用于让一个**主站（Master）** 与多个**从站设备（Slave）** 交换数据。常见从站包括关节电机、IMU等。

我们将沿着下面的学习路径理解整个系统：

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

---

<sub>**课程：** Salman Control Course · **分支：** `Teaching_Class` · **原始项目：** [AIMEtherCAT/EcatV2_Master](https://github.com/AIMEtherCAT/EcatV2_Master) · **English:** [README.en.md](README.en.md)</sub>
