# 第二部分｜Setup ROS2 Workspace 与后续部署

[← 返回 Environment Setup 目录](environment-setup.md) · [返回课程主页](../../readme.md)

> **教学依据**：本部分按照 [AIMEtherCAT 原始 Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md) **从 Setup ROS2 Workspace 到 Done** 的原有顺序讲解。保留原版仓库地址、关键命令、EEPROM 示例参数及两张配图，并增加面向初学者的中文操作说明。尚未在课程实机验证的路径、网卡与从站序号均为示例。

## 本部分学习目标

1. **Setup ROS2 Workspace**：创建工作空间，将 EcatV2_Master 添加为 Git 子模块。
2. **Flash EEPROM For EtherCAT Module**：找到 EEPROM 工具和配置文件，并了解烧录流程。
3. **Flash Firmware for MCU**：区分 MCU 固件与 EEPROM，了解固件的获取方式。
4. **Done**：完成检查，进入首次测试教程。

> **开始之前**：先完成[第一部分：基础系统与实时环境准备](environment-before-ros2-workspace.md)。原教程从此处开始介绍**仓库获取与模块部署**，并没有在本节给出 ROS 2 安装或 `colcon build` 指令，因此本页不擅自增加未在原文提供的编译流程。

---

## 1. Setup ROS2 Workspace（设置 ROS 2 工作空间）

### 步骤 1：确认能够访问 GitHub 仓库

原教程首先要求确认：**本机 SSH 公钥已添加到 GitHub 账号**，并且电脑可以访问：

https://github.com/AIMEtherCAT/EcatV2_Master

这一步的目的是避免后续获取代码时遇到权限或网络问题。

> **注意**：原教程确实提到了 SSH 公钥，但其下方 `git submodule add` 命令实际使用 **HTTPS** 仓库地址。二者是不同的访问方式；不要误以为运行该 HTTPS 命令必须使用 SSH 私钥。

### 步骤 2：进入工作空间，创建 src 文件夹

原教程要求进入自己的工作空间目录，然后创建 `src` 文件夹。

以下只是一个可直接理解的**示例工作空间名称**，实际可使用自己的目录：

~~~bash
mkdir -p ~/ethercat_ws/src
cd ~/ethercat_ws
~~~

此时的目录结构：

~~~text
ethercat_ws/
└── src/
~~~

后面的所有 `src/EcatV2_Master/...` 路径都**相对于工作空间根目录**。不要先 `cd src` 再执行原教程的子模块命令，否则路径会发生变化。

### 步骤 3：初始化 Git 仓库

原教程指出：**如果这里尚未初始化 Git 仓库**，先执行：

~~~bash
git init
~~~

`git init` 的作用是把当前工作空间设为 Git 仓库，以便下一步添加子模块。如果已经是 Git 仓库，就无需重复初始化。

### 步骤 4：添加 EcatV2_Master 子模块

在**工作空间根目录**执行原教程的完整命令：

~~~bash
git submodule add https://github.com/AIMEtherCAT/EcatV2_Master.git src/EcatV2_Master
~~~

解释：

- `git submodule add`：将另一个 Git 仓库作为当前工程的**子模块**。
- `https://github.com/AIMEtherCAT/EcatV2_Master.git`：原版教程指定的上游项目。
- `src/EcatV2_Master`：项目被添加到当前工作空间中的位置。

完成后，代码应位于 `src/EcatV2_Master`。父仓库还会记录 `.gitmodules` 等子模块信息。

> **不要重复添加**：如果该路径已经是添加成功的子模块，就不要再次执行这条命令。此处保持原教程的上游仓库地址，不换成其他 fork。

### 步骤 5：拉取嵌套子模块

原教程接着执行：

~~~bash
git submodule update --init --recursive
~~~

逐个理解：

| 参数 | 作用 |
| --- | --- |
| `update` | 按父仓库所记录的版本检出子模块 |
| `--init` | 初始化尚未初始化的子模块 |
| `--recursive` | 递归处理子模块内部的嵌套子模块 |

**为什么要执行？** 原教程说明，此步骤会进一步获取项目使用的 `soem` 代码。只添加最外层 `EcatV2_Master`，不代表嵌套依赖都已拉取完成。

### 步骤 6：以后更新 EcatV2_Master

如果未来上游项目更新，原教程提供：

~~~bash
git submodule update --remote src/EcatV2_Master
~~~

该命令按子模块配置中的远程跟踪设置更新 `src/EcatV2_Master`。**首次安装使用步骤 4、5；这条 `--remote` 命令用于后续主动更新。** 更新可能改变子模块所指向的提交，执行前应确认确实需要升级。

### 完成此节后，目录应该是什么样？

根据原教程后续要用到的路径，工作空间应至少包含：

~~~text
ethercat_ws/
├── .git/
├── .gitmodules
└── src/
    └── EcatV2_Master/
        ├── tools/
        ├── eeproms/
        └── ...（其余项目文件）
~~~

上图仅标出后续需要使用的目录，不代表列出仓库中的全部内容。

---

## 2. Flash EEPROM For EtherCAT Module（烧录 EtherCAT 模块 EEPROM）

### 步骤 1：找到 tools 和 eeproms

原教程要求返回**工作空间根目录**，确认可以访问两个路径：

- `src/EcatV2_Master/tools`：EEPROM 烧录工具所在目录。
- `src/EcatV2_Master/eeproms`：各类模块的 EEPROM 文件所在目录。

**原教程配图：工具和 EEPROM 文件目录**

![tools-tree.png：原版教程的 tools 和 eeproms 目录图](../img/tools-tree.png)

<sub>原版图片 `docs/img/tools-tree.png`；当前教学仓库复用相同文件。</sub>

### 步骤 2：切换 root 并赋予执行权限

原教程首先执行：

~~~bash
sudo su
~~~

然后执行：

~~~bash
chmod +x src/EcatV2_Master/tools/*
~~~

`sudo su` 会切换到 root Shell；`chmod +x` 为工具增加可执行权限。

**必须注意**：即使切换为 root，也应从工作空间根目录执行相对路径命令。如果当前目录不对，请先返回工作空间根目录。完成操作后可使用 `exit` 退出 root Shell。

### 步骤 3：选择与你的硬件匹配的 EEPROM 文件

原教程说明，`src/EcatV2_Master/eeproms` 目录中提供可用模块的 EEPROM 文件。烧录前先确定下面三个参数：

| 参数 | 含义 | 原教程示例 |
| --- | --- | --- |
| `<NIC name>` | Linux 中与 EtherCAT 模块连接的网卡接口名 | `enp3s0` |
| `<slave id>` | 从站在 EtherCAT 链路中的序号 | `1` |
| `<eeprom file path>` | 要写入的 EEPROM 文件路径 | `src/EcatV2_Master/eeproms/58100H750_UniversalModule.bin` |

原教程示例假定使用的是 **H750 Universal Module**，并且模块是直接连接主机网卡的**第一个 EtherCAT 从站**。

### 步骤 4：按原教程命令烧录

**原始通用命令格式**：

~~~text
src/EcatV2_Master/tools/eepromtool <NIC name> <slave id> -w <eeprom file path>
~~~

**原始完整示例**（H750 Universal Module、`enp3s0`、第 1 个从站）：

~~~bash
src/EcatV2_Master/tools/eepromtool enp3s0 1 -w src/EcatV2_Master/eeproms/58100H750_UniversalModule.bin
~~~

`-w` 表示写入 EEPROM。烧录前必须核实模块型号、网卡名、从站序号和文件路径；**不能把示例中的 `enp3s0` 和 `1` 直接视为自己硬件的真实配置**。

> **操作安全**：EEPROM 烧录会修改实体模块的配置。原教程指出可以重复执行烧录命令以确保写入成功；但应先检查工具的输出，如果参数或链路有误，不要盲目连续写入。

### 步骤 5：检查烧录结果

**原教程配图：EEPROM 烧录完成示例**

![flash-done.png：原版教程的 EEPROM 烧录完成示例](../img/flash-done.png)

<sub>原版图片 `docs/img/flash-done.png`；当前教学仓库复用相同文件。</sub>

### 步骤 6：模块断电并重新上电

原教程强调：**EEPROM 写入完成后，必须关闭 EtherCAT 模块电源，再重新供电，才能使新配置生效。**

这意味着对**实体模块断电和重新上电**，而不只是关闭终端窗口。

---

## 3. Flash Firmware for MCU（为 MCU 烧录固件）

### 是否必须进行固件烧录？

原教程说明：MCU 固件通常已经由制造合作方在交付模块前烧录，因此**正常情况下不一定需要执行本节**。如果需要更新固件或模块出现固件问题，才考虑重新烧录。

### 固件从哪里获取？

原教程给出两种方法：

1. 按对应固件仓库的说明自行构建。
2. 从 GitHub **Actions** 页面下载项目提供的构建产物（Artifacts）。

原教程指出，预编译 MCU 固件的文件格式为 **`.elf`**。

**原教程列出的固件项目：**

[H750 Universal Module — EcatV2_AX58100_H750_Universal](https://github.com/AIMEtherCAT/EcatV2_AX58100_H750_Universal)

**注意区分两个刷写步骤：**

| 文件类型 | 用途 |
| --- | --- |
| `.bin`（示例：`58100H750_UniversalModule.bin`） | 上一节中供 `eepromtool` 写入 EtherCAT 模块 EEPROM 的文件 |
| `.elf` | MCU 固件构建产物，不是上一节的 EEPROM 文件 |

原教程明确说明，这一步未提供统一的烧录操作，需要根据具体模块和调试工具自行查阅。因此这里**不添加未经原教程确认的 MCU 烧录命令**。

---

## 4. Done（环境准备完成）

按原版教程，完成上述环境准备后，即可继续学习**运行第一次 SOEM 测试**。

### 第二部分操作检查清单

- [ ] 可以访问原版 EcatV2_Master 仓库。
- [ ] 已进入工作空间根目录并创建 `src`。
- [ ] 如原本不是 Git 仓库，已执行 `git init`。
- [ ] 已通过 `git submodule add` 添加 `src/EcatV2_Master`。
- [ ] 已执行 `git submodule update --init --recursive`，获取嵌套子模块。
- [ ] 已找到 `src/EcatV2_Master/tools` 和 `src/EcatV2_Master/eeproms`。
- [ ] **如需烧录 EEPROM**：已确认型号、网卡、从站编号、文件路径以及烧录结果，并重新为模块上电。
- [ ] **如需更新 MCU 固件**：已查阅对应固件仓库并确认其 `.elf` 文件和烧录流程。

> **课程实机状态**：以上为依照上游教程整理的教学操作步骤，并不表示已经在课程设备上完成实际烧录。硬件名称、网卡编号、链路顺序与刷写结果须在现场核对。

## 下一步

### **[→ 第一次运行与测试（First Run Test）](first-run-test.md)**

[← 返回 Environment Setup 目录](environment-setup.md) · [返回课程主页](../../readme.md)

---

<sub>参考来源：[AIMEtherCAT / EcatV2_Master — Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md)，范围为 `Setup ROS2 Workspace` 至 `Done`。配图复用当前仓库 `docs/img/` 中的原版图片；原项目版权及许可归其各自权利人所有。</sub>
