# Part 1 | Basic System and Real-Time Environment Preparation

**Language / 语言：** [English (current)](environment-before-ros2-workspace-en.md) | [简体中文](environment-before-ros2-workspace.md)

[← Back to Environment Setup Contents](environment-setup-en.md) · [Back to Course Homepage](../../readme.md)

> **Teaching draft (English version):** This document is based on the sections **before Setup ROS2 Workspace** in the [original AIMEtherCAT Environment Setup tutorial](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md). Because the laptops for this class have not arrived yet, the BIOS menus, CPU numbering, network adapter model, and other details must be confirmed on the actual machines. **Do not treat the example parameters in this document as final hardware settings.**

## Learning Objectives

Complete the following preparations in order before moving on to the ROS 2 workspace and EtherCAT project deployment:

1. **BIOS Setup:** Understand BIOS settings that can affect real-time performance.
2. **System Setup:** Install Ubuntu and identify the compatible ROS 2 version.
3. **Ubuntu Pro:** Attach an Ubuntu Pro subscription.
4. **Realtime Kernel:** Install and verify the Linux real-time kernel.
5. **CPU Isolation:** Isolate a CPU core for real-time tasks according to the actual processor topology.

**Recommended system combination: Ubuntu 24.04 LTS + ROS 2 Jazzy.** The original tutorial also says Ubuntu 22.04 + ROS 2 Humble works, but this class should ideally standardize on one environment so that students do not need different commands.

---

## 1. BIOS Setup

BIOS/UEFI is the hardware configuration interface that runs before the operating system starts. Different brands and BIOS versions can present different options. **If an option is not available, you can skip it.**

For the HP ProBook planned for the class, a common way to enter BIOS is to repeatedly press `Esc` during startup to open the startup menu, then press `F10`. Always follow the prompts shown on the actual laptop when it arrives.

According to the original tutorial, the settings worth checking include:

| Setting | Optimization suggested in original tutorial | Recommendation for beginners |
| --- | --- | --- |
| Race To Halt (RTH) | Disable | Consider disabling only if the option is available; otherwise skip it. |
| Hyper-Threading | Originally recommended disabling; later changed to allowing it to remain enabled | **Leave the default enabled for now**; when isolating a CPU core, identify all logical threads belonging to the same physical core. |
| Virtualization Support / VT-x | Disable | You may consider disabling it if no virtual machines are needed; it is **not** a strict requirement for running EtherCAT. |
| C-State / CPU Idle States | Disable | May reduce wake-up latency but increases power consumption and heat; decide after testing. |
| Turbo Boost / SpeedStep / Speed Shift | Try disabling when the CPU frequency can be locked | Adjust only when the BIOS really supports a fixed frequency and there is a reason to test it. |

> **Tip:** These are real-time performance tuning options. **Not every one of them must be disabled to run EtherCAT.** During the first installation, you can record the default BIOS settings, then adjust them one by one after the system is working. It is best to photograph the settings before changing them.

## 2. System Setup (Installing Ubuntu)

### 2.1 Select a System Version

- **Recommended:** Ubuntu 22.04 LTS + ROS 2 Humble
- **Alternative:** [Ubuntu 24.04 LTS Desktop](https://ubuntu.com/download/desktop) + [ROS 2 Jazzy](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html).

- This project does not recommend running Ubuntu through a virtual machine installed on Windows or macOS. A native Linux system is supported to reduce bugs arising from architecture and bootloader incompatibilities.

### 2.2 Overview of Installation Steps

1. Update installed software:

~~~bash
sudo apt update
sudo apt upgrade -y
~~~

**Terminal basics:** `sudo` executes a command with administrator privileges. When you type your password, characters normally do not appear on the screen; that is expected behavior.

The default password for the classroom computer is the digit "1".

## 3. Ubuntu Pro (Attaching Your Account)

The original tutorial uses Ubuntu Pro as the way to install a real-time kernel.

1. Register or sign in to [Ubuntu One](https://login.ubuntu.com/).
2. After installing Ubuntu, open a terminal (press Ctrl+Alt+T) and run:

~~~bash
sudo pro attach
~~~

3. Follow the web address or instructions displayed by the terminal to link the device.

![Ubuntu Pro account attachment example (from the original repository)](../img/pro-attach.png)

## 4. Enable Realtime-Kernel (Enable the Real-Time Kernel)

### 4.1 Why Do We Need a Real-Time Kernel?

Regular Linux generally prioritizes overall throughput and responsiveness. The **PREEMPT_RT real-time kernel** can improve the predictability of task scheduling latency and jitter, which helps with periodic EtherCAT control tasks.

After attaching Ubuntu Pro, run:

~~~bash
sudo pro enable realtime-kernel
~~~

Confirm the installation as prompted and let it finish.

![Real-time kernel installation example (from the original repository)](../img/rt-kernel.png)

Restart your computer:

~~~bash
sudo reboot
~~~

### 4.2 Verify the Running Kernel

After restarting, open a terminal:

~~~bash
uname -r
~~~

Then inspect the configuration of the currently running kernel:

~~~bash
grep '^CONFIG_PREEMPT_RT=' /boot/config-$(uname -r)
~~~

If it outputs `CONFIG_PREEMPT_RT=y`, the currently booted kernel has PREEMPT_RT enabled.

> The original tutorial previously discussed a special kernel variant for certain Intel CPUs, but later recommended the generic option. Since the classroom laptops' CPU specifications have not yet been confirmed, **this tutorial uses the generic `realtime-kernel`** until it can be tuned based on testing.

## 5. Isolate a CPU Core

### 5.1 What Is CPU Isolation?

To minimize interference from other programs, some logical CPUs can be reserved for high-priority EtherCAT/SOEM tasks. In simple terms, it is like reserving one CPU core specifically for EtherCAT, rather than making EtherCAT compete with other programs for CPU time.

### 5.2 First Find Out the CPU Numbers

View processor information:

~~~bash
lscpu
~~~

List the relationship between logical CPUs and physical cores:

~~~bash
lscpu -e=CPU,CORE,SOCKET,ONLINE
~~~

**Pay special attention to Hyper-Threading / SMT:** One physical core may correspond to two logical CPUs. Their numbers are not necessarily adjacent. **Do not assume that CPU0 and CPU1 belong to the same physical core.**

For example, check the sibling threads of a particular logical CPU (3 is only used as an example here):

~~~bash
cat /sys/devices/system/cpu/cpu3/topology/thread_siblings_list
~~~

If it outputs `3,7`, and you intend to isolate that entire physical core, you would normally need to consider both CPU3 and CPU7. **Once you have the actual machine, choose the CPU IDs based on its real output.**

### 5.3 What Are GRUB Boot Parameters?

GRUB is a bootloader commonly used by Ubuntu. The original tutorial gives this format for CPU isolation parameters:

~~~text
nohz=on nohz_full=X rcu_nocbs=X isolcpus=X irqaffinity=Y
~~~

Here:

- `X`: A list of logical CPU IDs to isolate.
- `Y`: The other CPU IDs that are allowed to carry normal interrupt loads.
- `nohz_full`, `rcu_nocbs`, `isolcpus`: Reduce certain system scheduling and background activities on the specified CPUs.
- `irqaffinity`: Specifies the default IRQ interrupt affinity range.

**Example for understanding only:** Suppose the machine has CPU0 through CPU7, and you have confirmed that CPU3 and CPU7 belong to the same physical core. Then you might use `X=3,7` and `Y=0-2,4-6`. **Do not directly copy these example CPU IDs onto your laptop.**

### 5.4 Edit GRUB (Only After Checking the Real CPU Topology)

First, back up the original configuration:

~~~bash
sudo cp /etc/default/grub /etc/default/grub.backup-before-ethercat
~~~

Open the file in a terminal editor:

~~~bash
sudo nano /etc/default/grub
~~~

Find `GRUB_CMDLINE_LINUX_DEFAULT`, and append the isolation parameters confirmed on your actual machine **inside the quotation marks** of the existing settings. **Do not boot using the X and Y placeholders shown above.**

The following image from the original tutorial shows the interface:

![Example of GRUB parameter settings (from the original repository)](../img/grub-cmd.png)

In nano, press `Ctrl + O` and Enter to save, then press `Ctrl + X` to exit. After saving, run:

~~~bash
sudo update-grub
sudo reboot
~~~

> Changing GRUB settings can cause startup problems. Always make a backup first, and have the course instructor confirm the CPU IDs once the actual machines are available. This guide **does not require** you to perform this step before the hardware has been checked.

### 5.5 Check Whether the Configuration Took Effect

Display the current boot parameters:

~~~bash
cat /proc/cmdline
~~~

![Example of checking kernel boot parameters (from the original repository)](../img/cmdline.png)

Install the process monitoring tool and view the load on each CPU:

~~~bash
sudo apt install -y htop
htop
~~~

![htop showing CPU load (from the original repository)](../img/htop.png)

Very low idle load on the isolated CPU can be a useful observation. However, **you cannot conclude that isolation succeeded solely because htop shows 0%–1% usage**. You should also verify the boot parameters and measure real latency and jitter during the subsequent EtherCAT tests.

If you need to restore the original GRUB configuration and Ubuntu can still boot normally, run:

~~~bash
sudo cp /etc/default/grub.backup-before-ethercat /etc/default/grub
sudo update-grub
~~~

Then restart the system. If it no longer boots normally, recover it using the GRUB boot menu or recovery media rather than repeatedly changing settings blindly.

---

## Part 1 Checklist

- [ ] The Ubuntu / ROS 2 version combination has been chosen.
- [ ] Ubuntu is installed and the terminal and network work.
- [ ] Relevant BIOS settings have been checked (unavailable options can be skipped).
- [ ] Ubuntu Pro has been attached.
- [ ] The PREEMPT_RT kernel has been installed and verified.
- [ ] **Pending verification on actual hardware:** CPU topology, isolation parameters, and runtime behavior.

> **Current status:** Since the exact classroom laptops have not yet arrived, this is a **general teaching draft** based on the upstream repository. Once the actual BIOS, processor, and network adapter are available, the screenshots, exact parameters, and common troubleshooting notes will be updated accordingly.

## Next Step

After finishing the basic environment preparation above, proceed to Part 2, starting with **Setup ROS2 Workspace**, to configure the ROS 2 project and EtherCAT environment.

### **[→ Part 2: Setup ROS2 Workspace and Subsequent Deployment](setup-ros2-workspace-and-after-en.md)**

[← Back to Environment Setup Contents](environment-setup-en.md) · [Back to Course Homepage](../../readme.md)

---

<sub>Reference: [AIMEtherCAT / EcatV2_Master — Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md). Images are reused from the current repository's `docs/img/`; copyright and licensing remain with their respective owners.</sub>
