# 第一部分｜基础系统与实时环境准备

[← 返回 Environment Setup 目录](environment-setup.md) · [返回课程主页](../../readme.md)

> **教学草稿（中文版）**：本文整理自 [AIMEtherCAT 原始 Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md) 中 **Setup ROS2 Workspace 之前**的内容。由于课程用笔记本尚未到手，BIOS 菜单、CPU 编号、网卡型号等都需要后续实机确认。请不要将本文示例参数直接作为最终硬件配置。

## 本部分学习目标

按下面的顺序完成准备，之后再进入 ROS 2 工作空间和 EtherCAT 项目部署：

1. **BIOS Setup**：认识影响实时性能的 BIOS 选项。
2. **System Setup**：安装 Ubuntu，了解 ROS 2 对应的系统版本。
3. **Ubuntu Pro**：关联 Ubuntu Pro 订阅。
4. **Realtime Kernel**：安装和验证 Linux 实时内核。
5. **CPU Isolation**：按实际处理器拓扑，为实时任务隔离 CPU 核心。

**推荐系统组合：Ubuntu 24.04 LTS + ROS 2 Jazzy。** 原始教程也提到 Ubuntu 22.04 + ROS 2 Humble 可用，但本课程后续应尽量统一一种环境，以免学生使用不同命令。

---

## 1. BIOS Setup（BIOS 设置）

BIOS/UEFI 是操作系统启动前的硬件设置界面。不同品牌、不同版本显示的选项可能不一样，**找不到的选项可以跳过**。

对于待采购的 HP ProBook，常见进入方式是：开机时连续按 `Esc` 打开启动菜单，再按 `F10` 进入 BIOS；最终仍以收到的机器实际提示为准。

参考原始教程，可重点查找下列设置：

| 设置项 | 原教程的优化方向 | 初学者的执行建议 |
| --- | --- | --- |
| Race To Halt (RTH) | Disable | 有对应选项才考虑关闭；没有就跳过。 |
| Hyper-Threading | 早期建议关闭，后续改为可以保留 | **先保持默认开启**；隔离 CPU 时需要识别同一物理核心的所有逻辑线程。 |
| Virtualization Support / VT-x | Disable | 如不使用虚拟机可考虑关闭；它**不是** EtherCAT 运行的硬性要求。 |
| C-State / CPU Idle States | Disable | 可能降低唤醒延迟，但会增加功耗和发热；建议实测后决定。 |
| Turbo Boost / SpeedStep / Speed Shift | 在能够锁定频率时尝试关闭 | 仅在 BIOS 确实支持固定频率且有测试需求时调整。 |

> **提示**：这些是实时性能调优项目，**并非全部必须关闭才可运行 EtherCAT**。第一次安装可以记录 BIOS 默认状态，待系统运行正常后再逐项调整。修改前最好拍照备份当前设置。

## 2. System Setup（安装 Ubuntu）

### 2.1 选择系统版本

- **推荐**：[Ubuntu 24.04 LTS Desktop](https://ubuntu.com/download/desktop) + [ROS 2 Jazzy](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html)。
- **备选**：Ubuntu 22.04 LTS + ROS 2 Humble（需根据课程安排确认）。
- 本教程面向真实 EtherCAT 硬件通信，优先使用**物理机原生 Ubuntu**，不建议初次测试就使用 Windows 虚拟机作为实时主站。

### 2.2 安装步骤概览

1. 备份笔记本中的重要资料，确认是否需要保留 Windows。
2. 从 Ubuntu 官网下载对应的 ISO 镜像，并制作 USB 启动盘。
3. 从 USB 启动，按安装向导安装 Ubuntu；如果采用双系统，请仔细核对分区，避免覆盖现有数据。
4. 安装完成后联网并打开终端：按 `Ctrl + Alt + T`。
5. 更新已安装软件：

```bash
sudo apt update
sudo apt upgrade -y
```

**终端入门：** `sudo` 表示以管理员权限执行命令；输入密码时通常不会显示字符，这属于正常现象。

> ROS 2 Jazzy 的正式安装命令可参考上面的 ROS 2 官方链接。本篇先完成操作系统和实时环境的准备，不在这里创建 ROS 2 工作空间；工作空间建立将在**第二部分**开始。

## 3. Ubuntu Pro（关联账号）

原始教程使用 Ubuntu Pro 提供的实时内核安装方式。

1. 在 [Ubuntu One](https://login.ubuntu.com/) 注册或登录账号。
2. 安装完 Ubuntu 后，在终端执行：

```bash
sudo pro attach
```

3. 根据终端提供的网页登录地址或提示，完成设备绑定。

![Ubuntu Pro 绑定示例（来源：原始仓库）](../img/pro-attach.png)

检查状态：

```bash
pro status
```

> 如果 `pro` 命令不存在，先确认 Ubuntu 版本及 `ubuntu-pro-client` 软件包是否安装。Ubuntu Pro 的订阅规则和服务状态以 [Ubuntu 官方说明](https://ubuntu.com/pro) 为准。

## 4. Enable Realtime-Kernel（启用实时内核）

### 4.1 为什么需要实时内核？

普通 Linux 主要考虑整体吞吐量与交互体验。**PREEMPT_RT 实时内核**可以改善任务调度延迟和抖动的可预测性，对周期性的 EtherCAT 控制任务有帮助，但它**不能单独保证**端到端通信的严格实时性。

完成 Ubuntu Pro 关联后，执行：

```bash
sudo pro enable realtime-kernel
```

按照提示确认安装，等待安装结束。

![安装实时内核示例（来源：原始仓库）](../img/rt-kernel.png)

重启电脑：

```bash
sudo reboot
```

### 4.2 验证当前运行内核

重启后打开终端：

```bash
uname -r
```

然后检查当前内核配置：

```bash
grep '^CONFIG_PREEMPT_RT=' /boot/config-$(uname -r)
```

如果输出 `CONFIG_PREEMPT_RT=y`，表示当前启动的内核启用了 PREEMPT_RT。

> 原教程曾讨论特定 Intel CPU 的内核变体，后续已建议通用方案。由于课程笔记本的 CPU 配置尚未确认，**本教程暂采用通用 `realtime-kernel`**，后续再根据实测调整。

## 5. Isolate a CPU Core（隔离 CPU 核心）

### 5.1 什么是 CPU 隔离？

为了尽量减少其他程序干扰，可以把一部分逻辑 CPU 保留给高优先级的 EtherCAT/SOEM 任务。

**这是后续可选的性能优化，不是确认 Ubuntu 和 ROS 2 安装成功的前提。** 如果刚开始学习，建议先完成系统及实时内核验证，再处理这一节。

### 5.2 首先查清 CPU 编号

查看处理器信息：

```bash
lscpu
```

列出逻辑 CPU 和物理核心的关系：

```bash
lscpu -e=CPU,CORE,SOCKET,ONLINE
```

**尤其注意 Hyper-Threading / SMT：** 一个物理核心可能对应两个逻辑 CPU。它们的编号不一定相邻，**不能默认 CPU0 和 CPU1 属于同一个物理核心**。

例如，先查看某个逻辑 CPU 的兄弟线程（这里的 3 只是演示）：

```bash
cat /sys/devices/system/cpu/cpu3/topology/thread_siblings_list
```

假设输出为 `3,7`，则如果计划完整隔离该物理核心，通常需要同时考虑 CPU3 与 CPU7。**收到实机后，必须依据实际输出重新选择。**

### 5.3 GRUB 启动参数是什么？

GRUB 是 Ubuntu 常用的引导加载程序。原始教程提供的 CPU 隔离参数格式如下：

```text
nohz=on nohz_full=X rcu_nocbs=X isolcpus=X irqaffinity=Y
```

其中：

- `X`：准备隔离的逻辑 CPU 编号列表。
- `Y`：允许承担普通中断负载的其他 CPU 编号列表。
- `nohz_full`、`rcu_nocbs`、`isolcpus`：用于减少指定 CPU 上的部分系统调度与后台活动。
- `irqaffinity`：指定默认的 IRQ 中断亲和性范围。

**只用于理解的例子：** 假设总共只有 CPU0～CPU7，确认 CPU3 和 CPU7 属于同一物理核心，才可以考虑 `X=3,7`、`Y=0-2,4-6`。**不要直接复制这些 CPU 编号到你的笔记本。**

### 5.4 编辑 GRUB（取得实机拓扑后再执行）

先备份原配置：

```bash
sudo cp /etc/default/grub /etc/default/grub.backup-before-ethercat
```

用终端编辑器打开：

```bash
sudo nano /etc/default/grub
```

找到 `GRUB_CMDLINE_LINUX_DEFAULT`，在原有参数的引号内追加经实机确认的隔离参数。**不要直接用上面的 X、Y 占位符启动**。

操作界面参考原始教程配图：

![GRUB 参数设置示例（来源：原始仓库）](../img/grub-cmd.png)

在 Nano 中按 `Ctrl + O` 保存，回车确认，然后按 `Ctrl + X` 退出。保存后执行：

```bash
sudo update-grub
sudo reboot
```

> 更改 GRUB 存在导致启动异常的风险。务必先备份，且在拿到实际硬件后由课程指导确认 CPU 编号。本文**不要求**在尚未确认硬件时执行此步骤。

### 5.5 查看配置是否生效

显示当前启动参数：

```bash
cat /proc/cmdline
```

![检查内核启动参数示例（来源：原始仓库）](../img/cmdline.png)

安装进程监控工具并查看各 CPU 的负载：

```bash
sudo apt install -y htop
htop
```

![htop 查看 CPU 负载（来源：原始仓库）](../img/htop.png)

隔离 CPU 的空闲负载很低是一个可观察的现象，但**不能仅凭 htop 显示 0%～1% 就判定隔离一定成功**。还应核对启动参数，并在后续 EtherCAT 测试中测量实际延迟和抖动。

如需恢复原 GRUB 配置，并且 Ubuntu 仍能正常启动，可执行：

```bash
sudo cp /etc/default/grub.backup-before-ethercat /etc/default/grub
sudo update-grub
```

然后重启。如果无法正常启动，请通过 GRUB 启动菜单或恢复介质处理，避免盲目重复修改。

---

## 第一部分检查清单

- [ ] 已确定要使用的 Ubuntu / ROS 2 版本组合。
- [ ] Ubuntu 已正常安装，终端和网络可以使用。
- [ ] 已检查 BIOS 相关设置（找不到的选项先跳过）。
- [ ] Ubuntu Pro 已完成关联。
- [ ] 已安装并验证 PREEMPT_RT 实时内核。
- [ ] **待实机确认**：CPU 核心拓扑、隔离参数、运行效果。

> **当前进度说明：** 由于课程使用的具体笔记本尚未到手，以上为参考原始仓库整理的**通用教学草稿**。之后将结合真实 BIOS、处理器和网卡进一步补充截图、具体参数与常见错误排查。

## 下一步

完成上述基础环境准备后，继续进入第二部分，从 **Setup ROS2 Workspace** 开始配置 ROS 2 工程和 EtherCAT 项目。

### **[→ 第二部分：Setup ROS2 Workspace 与后续部署](setup-ros2-workspace-and-after.md)**

[← 返回 Environment Setup 目录](environment-setup.md) · [返回课程主页](../../readme.md)

---

<sub>参考来源：[AIMEtherCAT / EcatV2_Master — Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md)。图片复用自当前仓库 `docs/img/`，原项目版权及许可归其各自权利人所有。</sub>
