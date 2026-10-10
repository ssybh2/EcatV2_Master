<div align="center">

# EtherCAT Deployment Guide

### A beginner-friendly introduction to Linux · ROS 2 · EtherCAT

**Salman Control Course | Teaching Class**

**Language:** [简体中文（默认）](readme.md) · **English**

</div>

---

## Welcome

Welcome to the **EtherCAT Deployment Guide** for **Salman's control course**.

This is the course entry point for students who are new to Linux, the Ubuntu terminal, ROS 2, or EtherCAT. The aim is to provide a clear, step-by-step learning path: **prepare the working environment → run the first EtherCAT communication test → customize the configuration for your own hardware**.

The teaching branch is based on [AIMEtherCAT/EcatV2_Master](https://github.com/AIMEtherCAT/EcatV2_Master), an EtherCAT master project built around **ROS 2** and **SOEM (Simple Open EtherCAT Master)**. This branch focuses on **beginner-friendly deployment and course exercises**; it is not a replacement for the upstream project's technical documentation.

> **Documentation status:** The three course chapters below have been created as navigation pages only. Their step-by-step instructions are intentionally blank and will be written after the course content is agreed upon.

## Course roadmap

Start with Chapter 01 and proceed in order. You do **not** need prior EtherCAT experience or advanced Linux/ROS 2 skills.

| Chapter | Course page | What it will cover |
| :---: | --- | --- |
| **01** | **[Environment Setup →](docs/teaching-class/environment-setup.md)** | Preparing Linux, the ROS 2 workspace, and the dependencies needed for EtherCAT development. |
| **02** | **[First Run Test →](docs/teaching-class/first-run-test.md)** | Starting the system and checking basic EtherCAT communication between the master and slave devices. |
| **03** | **[Customize configuration →](docs/teaching-class/customize-configuration.md)** | Understanding and adapting the configuration to your own hardware and control tasks. |

**The chapter links work, but the chapters intentionally contain only their titles for now.**

## Who is this guide for?

- Students taking **Salman's control course**.
- Beginners using **Ubuntu/Linux** or the **command-line terminal** for the first time.
- Learners who have not yet used **ROS 2**, ROS topics, or ROS workspaces.
- Anyone who wants a structured introduction to deploying an **EtherCAT master** for a robotics or control project.

The course is designed to introduce the required concepts as they become relevant; you do not need to master them all in advance.

## What is EtherCAT, and how does it fit into this project?

**EtherCAT** is an industrial Ethernet communication technology used to exchange data between a **master** and connected **slave devices** (such as I/O modules, motor controllers, and sensor interfaces).

In this repository, the EtherCAT communication layer is built with **SOEM**, while **ROS 2** provides an interface for integrating communication into robotics and control software. The intended learning path is:

```text
Ubuntu / Linux
      ↓
ROS 2 workspace and project build
      ↓
EcatV2_Master (ROS 2 + SOEM)
      ↓
EtherCAT network and slave devices
      ↓
Data exchange for control experiments
```

## Repository at a glance

| Location | Purpose |
| --- | --- |
| `src/` | ROS 2 packages and master-related source code. |
| `src/soem/` | SOEM library source (Git submodule). |
| `src/soem_wrapper/` | EtherCAT/ROS 2 integration code. |
| `src/custom_msgs/` | Project-specific ROS 2 message definitions. |
| `eeproms/` | EEPROM-related files for slave devices. |
| `tools/` | Auxiliary EtherCAT utilities. |
| `docs/teaching-class/` | Three dedicated course chapters (currently empty). |

## Before you begin

The required Ubuntu/ROS 2 versions, hardware list, terminal commands, build steps, and verification procedures will be specified in the corresponding chapters after the course setup has been finalized. **Please do not treat this homepage as a complete installation procedure.**

For hardware exercises, check wiring and power supplies first. Keep actuators and motor outputs in a safe state until the relevant test procedure and safety checks have been established.

---

<sub>**Course:** Salman Control Course · **Branch:** `Teaching_Class` · **Upstream project:** [AIMEtherCAT/EcatV2_Master](https://github.com/AIMEtherCAT/EcatV2_Master) · **中文版:** [readme.md](readme.md)</sub>
