# Part 2 | Setup ROS2 Workspace and Subsequent Deployment

**Language / 语言：** [English (current)](setup-ros2-workspace-and-after-en.md) | [简体中文](setup-ros2-workspace-and-after.md)

[← Back to Environment Setup Contents](environment-setup-en.md) · [Back to Course Homepage](../../readme.md)

---

## 1. Setup ROS2 Workspace (Setting Up the ROS 2 Workspace)

### Step 1: Make Sure You Can Access the GitHub Repository

The original tutorial first requires that your computer be able to access:

https://github.com/AIMEtherCAT/EcatV2_Master

The purpose of this step is to avoid permission or network problems when downloading the code later.

### Step 2: Create the EtherCAT Workspace and the src Directory

The original tutorial asks you to enter your own workspace directory and then create an `src` folder.

The following is only an **example workspace name** to make the instructions easy to understand. You may use a different directory:

~~~bash
mkdir -p ~/ethercat_ws/src
cd ~/ethercat_ws
~~~

These two commands mean: first, create a folder named ethercat_ws with another folder named src inside it; then enter ethercat_ws. <br>
"cd" means changing to a particular directory.

The directory structure should now look like this:

~~~text
ethercat_ws/
└── src/
~~~

### Step 3: Initialize the Git Repository

Run this command from the root directory of ethercat_ws:

~~~bash
git init
~~~

`git init` turns the current workspace into a Git repository, making it possible to add a submodule in the next step.

### Step 4: Add the EcatV2_Master Submodule

From the **workspace root directory**, which is ethercat_ws, run the complete command from the original tutorial:

~~~bash
git submodule add https://github.com/AIMEtherCAT/EcatV2_Master.git src/EcatV2_Master
~~~

Explanation:

- `git submodule add`: Adds another Git repository as a **submodule** of the current project.
- `https://github.com/AIMEtherCAT/EcatV2_Master.git`: The upstream project specified in the original tutorial.
- `src/EcatV2_Master`: The location where the project is added inside your workspace.

### Step 5: Fetch Nested Submodules

Next, run:

~~~bash
git submodule update --init --recursive
~~~

What each option means:

| Option | Purpose |
| --- | --- |
| `update` | Checks out submodules at the versions recorded by the parent repository |
| `--init` | Initializes any submodules that have not yet been initialized |
| `--recursive` | Recursively handles submodules nested within other submodules |

**Why run this?** Because this step also fetches the `soem` code used by the project.

### Step 6: Update EcatV2_Master in the Future

If the upstream project is updated later, the original tutorial provides the following command:

~~~bash
git submodule update --remote src/EcatV2_Master
~~~

But you do not need to run this command this time.

### What Should the Directory Look Like After This Section?

Based on the paths used later in the original tutorial, your workspace should at least contain:

~~~text
ethercat_ws/
├── .git/
├── .gitmodules
└── src/
    └── EcatV2_Master/
        ├── tools/
        ├── eeproms/
        └── ... (other project files)
~~~

The diagram only highlights the directories needed later. It does not show every file in the repository.

---

## 2. Flash EEPROM For EtherCAT Module

### Step 1: A Quick Lesson on Useful Linux Commands

These are some simple terminal commands to help you get started with Linux. We will use them frequently in the next steps.

Suppose you are currently inside the ethercat_ws directory. Earlier, you created a folder named src inside it. Now you want to check in the terminal whether src was actually created, and what is inside it. Try the following command:

~~~bash
cd src
~~~

This moves you into the src folder inside ethercat_ws.<br>

Then run:

~~~bash
ls
~~~

This displays the contents of the src folder.<br>

If you want to go back from src to its parent directory, run:

~~~bash
cd ..
~~~

Notice that there is a space after cd, followed by two periods. This means going up one directory level.<br>

Similarly, if you want to go up several directory levels, you can use the following command as an example, **but do not run it right now**:

~~~bash
cd ../..
~~~

This goes up two directory levels.<br>

To go up three levels, use:

~~~bash
cd ../../..
~~~

This is similar to pressing the Back button three times.<br>

You can also run the following command from any directory to return directly to the root of ethercat_ws:

~~~bash
cd ~/ethercat_ws
~~~

It achieves the same result in a different way.<br>

Now let us return to the main topic.

### Step 2: Locate tools and eeproms

The original tutorial asks you to return to the **workspace root directory** and confirm that you can access these two paths:

- `src/EcatV2_Master/tools`: Directory containing the EEPROM flashing tools.
- `src/EcatV2_Master/eeproms`: Directory containing EEPROM files for different module types.

**Image from the original tutorial: tools and EEPROM file directories**

![tools-tree.png: tools and eeproms directories from the original tutorial](../img/tools-tree.png)

<sub>Original image `docs/img/tools-tree.png`; this teaching repository reuses the same file.</sub>

Step 2 is mainly to show you that there are two important .bin files under `src/EcatV2_Master/eeproms`. We will use these .bin files later. Their role is to flash a device ID onto your EtherCAT board, in other words, to give the board a name. The name will probably look like sn12345678 or another string of digits.<br>

Therefore, we can move directly to Step 3.

### Step 3: Switch to root and Make the Tools Executable

First, from the root directory of ethercat_ws, run:

~~~bash
sudo su
~~~

The terminal will then ask you for a password. For the classroom computers described here, the default password is the digit "1". However, you may notice that nothing appears on the screen when you type. This is normal: Linux does not display your password as you enter it.<br>

So, when prompted for the password, enter 1 and press Enter. You may notice that the terminal text, which was originally blue and green, has changed to grey and white, with "root" appearing at the beginning of the prompt. This is expected: root has the highest level of privileges.<br>

Then run:

~~~bash
chmod +x src/EcatV2_Master/tools/*
~~~

`chmod +x` makes the tools inside the tools directory executable.

**Important:** Even after switching to root, you should run commands containing relative paths from the workspace root directory. If you are in the wrong directory, return to the workspace root first.<br>

### Step 3: Choose the EEPROM File That Matches Your Hardware

## Tip 1:

Use a Type-C cable to power your EtherCAT board, and use the Ethernet cable provided to connect the board to the computer provided in the classroom.<br>

The original tutorial states that `src/EcatV2_Master/eeproms` contains EEPROM files for the supported modules. Before flashing, determine the following three parameters:

| Parameter | Meaning | Original tutorial example |
| --- | --- | --- |
| `<NIC name>` | Linux network interface name of the port connected to the EtherCAT module | `enp3s0` |
| `<slave id>` | Position of the slave in the EtherCAT connection chain | `1` |
| `<eeprom file path>` | Path to the EEPROM file to be written | `src/EcatV2_Master/eeproms/58100H750_UniversalModule.bin` |

The example in the original tutorial assumes an **H750 Universal Module** that is the **first EtherCAT slave**, connected directly to the host network card.<br>

So, how can you determine your own network interface name? Enter this in the terminal:

~~~bash
ip -br link
~~~

You will probably see something similar to:

~~~
lo       UNKNOWN    00:00:00:00:00:00
eno1     UP         12:34:56:78:90:AB
enp3s0   UP       12:34:56:78:90:CD
wlp2s0   UP         12:34:56:78:90:EF
~~~

This is an example of the kind of output you may see.

Next, try unplugging the EtherCAT board's Type-C power supply. (At this point, all the lights on the board should turn off.)

Then run the same command again:

~~~bash
ip -br link
~~~

You may find that one of the network interfaces now says DOWN, like this:

~~~bash
lo       UNKNOWN    00:00:00:00:00:00
eno1     UP         12:34:56:78:90:AB
enp3s0   DOWN       12:34:56:78:90:CD
wlp2s0   UP         12:34:56:78:90:EF
~~~

In this example, `enp3s0` changed from UP to DOWN. This indicates that the network interface used for the EtherCAT connection is `enp3s0`.<br>

In other words, we have found the communication "door" between the computer and the EtherCAT board. Later, the computer and EtherCAT will communicate through this interface. Think of it as finding the front door of the EtherCAT device. If you identify the wrong door, communication will naturally fail!

### Step 4: Flash the EEPROM Using the Original Tutorial's Command

**Original general command format:**

~~~text
src/EcatV2_Master/tools/eepromtool <NIC name> <slave id> -w <eeprom file path>
~~~

**Original complete example** (H750 Universal Module, `enp3s0`, first slave):

~~~bash
src/EcatV2_Master/tools/eepromtool enp3s0 1 -w src/EcatV2_Master/eeproms/58100H750_UniversalModule.bin
~~~

**Important: Your network interface is probably not named enp3s0. Replace `enp3s0` in the command above with your own computer's EtherCAT network interface name.**<br>
We already learned how to find the name of your network interface.

> **Operational safety:** EEPROM flashing modifies the physical module's configuration. The original tutorial says you can repeat the command to ensure that the flashing process finishes successfully.<br>
In this classroom tutorial, everyone is reminded to repeat the flashing procedure at least three times to make sure it was written successfully.<br>
> **Tip:** Press the Up Arrow key on your keyboard, then press Enter to repeat the last command you executed.

### Step 5: Check the Flashing Result

**Image from the original tutorial: Example of completed EEPROM flashing**

![flash-done.png: Completed EEPROM flashing in the original tutorial](../img/flash-done.png)

If you can see the following lines near the end:

~~~bash
Busy..........
Total EEPROM write time :3507ms
End, close socket
End program
~~~

it means one flashing attempt has been completed.

### Step 6: Power-Cycle the Module

**Important: After writing the EEPROM, you must unplug the Type-C power cable, wait calmly for 10 seconds, and then reconnect the power so that the new configuration can take effect.**

---

## 3. Flash Firmware for MCU

### You Can Skip This Step and Go Directly to [→ First Run Test](first-run-test-en.md)<br>

However, there is no harm in reading it if you want to.

### Is Firmware Flashing Required?

The original tutorial says MCU firmware is usually already flashed by the manufacturing partner before the module is delivered. Therefore, **this step is usually not required**. Reflashing is considered if the firmware needs to be updated or if there is a firmware problem with the module.

### Where Can You Get the Firmware?

The tutorial describes two options:

1. Build it yourself by following the corresponding firmware repository.
2. Download the prebuilt artifacts from the project's GitHub **Actions** page.

According to the original tutorial, the format of the prebuilt MCU firmware is **`.elf`**.

**Firmware project listed in the original tutorial:**

[H750 Universal Module — EcatV2_AX58100_H750_Universal](https://github.com/AIMEtherCAT/EcatV2_AX58100_H750_Universal)

**Make sure you understand the difference between the two flashing procedures:**

| File type | Purpose |
| --- | --- |
| `.bin` (example: `58100H750_UniversalModule.bin`) | EEPROM file written to the EtherCAT module using `eepromtool` in the previous section |
| `.elf` | MCU firmware artifact; it is not an EEPROM file for the previous step |

The original tutorial explicitly states that there is no universal flashing procedure given here, and that the details must be checked according to the specific module and debugging tool. Therefore, **this guide does not add MCU flashing commands that have not been confirmed by the original tutorial**.

---

## 4. Done (Environment Preparation Complete)

According to the original tutorial, once the environment preparation above is complete, you can move on to **running the first SOEM test**.

> **Classroom hardware status:** These instructions are based on the upstream tutorial. They do not mean that flashing has already been completed on the actual classroom hardware. Hardware names, network interface identifiers, slave ordering, and flashing results must be verified on the actual equipment.

## Next Step

### **[→ First Run Test](first-run-test-en.md)**

[← Back to Environment Setup Contents](environment-setup-en.md) · [Back to Course Homepage](../../readme.md)

---

<sub>Reference: [AIMEtherCAT / EcatV2_Master — Environment Setup](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/environment-setup.md), covering `Setup ROS2 Workspace` through `Done`. Images are reused from the original project's `docs/img/` folder in this repository; copyright and licensing remain with their respective owners.</sub>
