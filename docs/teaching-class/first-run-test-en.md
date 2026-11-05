# Part 3 | First Run Test: Your First EtherCAT (SOEM) Test

**Language / 语言：** [English (current)](first-run-test-en.md) | [简体中文](first-run-test.md)

[← Previous lesson: Setup ROS2 Workspace and Subsequent Deployment](setup-ros2-workspace-and-after-en.md) · [Back to Course Homepage](../../readme.md)

## 1. Create Bringup Package (Create a ROS 2 Bringup Package)

### Step 1: Exit Root Privileges and Enter the src Directory

Open a terminal and enter:

~~~bash
exit
~~~

You will see that the terminal text, which was previously grey and white, becomes blue and green again. This indicates that you have exited root privileges and returned to normal-user privileges.<br>

Next, run:

~~~bash
cd ~/ethercat_ws/src
ls
~~~

`cd` changes the current directory, and `ls` lists the files and folders in it. You should be able to see the `EcatV2_Master` folder you added earlier.

### Step 2: Create the soem_bringup Package

Inside `src`, run:

~~~bash
ros2 pkg create --build-type ament_cmake soem_bringup
~~~

This creates a ROS 2 package named `soem_bringup` with the `ament_cmake` build type. Once the command succeeds, a folder named `soem_bringup` will appear inside `src`.

### Step 3: Create the config and launch Folders

~~~bash
cd ~/ethercat_ws/src/soem_bringup
mkdir -p config launch
~~~

- `config`: Used to store the YAML configuration file for the master.
- `launch`: Used to store the ROS 2 launch script.

### Step 4: Modify CMakeLists.txt

Open the Files folder icon near the upper-left side of the screen, as shown in the illustration:

/image/to-be-inserted

This is similar to the Windows File Explorer, so it should be easy to understand.<br>

Then open the ethercat_ws folder you created earlier, open src, open soem_bringup, and finally open CMakeLists.txt.

Find line 13 and insert the following content:

~~~cmake
install(DIRECTORY
        launch
        config
        DESTINATION share/${PROJECT_NAME}/
)
~~~

Then press Ctrl+S to save.

**This code should be placed before `ament_package()`.** The original tutorial mentions line 13, but the line numbers may differ depending on the ROS 2 version. Use the location of `ament_package()` as your reference.

Purpose: During build and installation, this rule copies the `launch` and `config` directories into the ROS 2 package's share directory. Without it, `ros2 launch` might be unable to find the launch file, or the program might be unable to find its configuration.

### Step 5: Check the Directory Structure

The important directories should now look like this (only files required for this tutorial are listed):

~~~text
ethercat_ws/
└── src/
    ├── EcatV2_Master/
    └── soem_bringup/
        ├── CMakeLists.txt
        ├── package.xml
        ├── config/
        └── launch/
~~~

**Image from the original tutorial: Workspace directory structure**

![Folder structure from the original tutorial: tree.png](../img/tree.png)

<sub>Original image `docs/img/tree.png`; this repository also uses `docs/img/tree.png`.</sub>

---

## 2. Config File (Create config.yaml)

### Step 1: Create the File

~~~bash
cd ~/ethercat_ws/src/soem_bringup/config
~~~

Then enter:

~~~bash
touch config.yaml
~~~

Next, open the Files file manager and find the corresponding file at: ethercat_ws/src/soem_bringup/config/config.yaml<br>

Now **paste the following YAML example from the original tutorial** into the file:

~~~yaml
slaves:
  - sn2228293:
      sdo_len: !uint16_t 15
      task_count: !uint8_t 1
      latency_pub_topic: !std::string '/ecat/sn2228293/latency'

      tasks:
        - app_1:
            sdowrite_task_type: !uint8_t 3
            conf_connection_lost_read_action: !uint8_t 0x01
            pub_topic: !std::string '/ecat/sn2228293/app1/read'
            pdoread_offset: !uint16_t 0
            sdowrite_can_inst: !uint8_t 1
            sdowrite_packet1_id: !uint32_t 0x01
            sdowrite_packet2_id: !uint32_t 0x02
            sdowrite_packet3_id: !uint32_t 0x03
            conf_frame_name: !std::string 'imu_link'


~~~

Then press Ctrl+S to save. You do not need to understand what all of this means just yet. We will explain it shortly!<br>

For now, just remember that we used a **placeholder slave (EtherCAT) name** here, namely `sn2228293`.<br>

---

## 3. Launch File (Create bringup.launch.py)

### Step 1: Create and Open the Launch File

You are most likely currently in this directory:

~~~bash
cd ~/ethercat_ws/src/soem_bringup/config
~~~

Run:

~~~bash
cd ..
~~~

This takes you back to:

~~~bash
ethercat_ws/src/soem_bringup
~~~

Then run:

~~~bash
cd launch
touch bringup.launch.py
~~~

Next, find this file in the Files file manager at: (ethercat_ws/src/soem_bringup/launch/bringup.launch.py)<br>

Paste the following Python code from the original tutorial and save the file:

~~~python
from launch import LaunchDescription
from launch_ros.actions import Node
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    config_file = os.path.join(
        get_package_share_directory('soem_bringup'),
        'config',
        'config.yaml'
    )

    return LaunchDescription([
        Node(
            package='soem_wrapper',
            executable='soem_backend',
            name='soem_backend',
            parameters=[{
                'interface': "enp3s0",
                'rt_cpu': 0,
                'non_rt_cpus': "1,2,3,4,5,6",
                'config_file': config_file
            }],
            output='screen'
        )
    ])
~~~

**The code above is the complete example from the tutorial.** Three parameters must be changed to match your own computer.

### Step 2: Modify interface / rt_cpu / non_rt_cpus

| Parameter | Original tutorial example | What you should enter |
| --- | --- | --- |
| `interface` | `enp3s0` | The real wired network interface name of the **port connected to the EtherCAT slave**—the same interface we found in the last lesson using `ip -br link` |
| `rt_cpu` | `0` | The actual isolated logical CPU ID (X in Part 1) |
| `non_rt_cpus` | `1,2,3,4,5,6` | The actual list of all other non-isolated logical CPU IDs (Y in Part 1) |

#### How Do You Determine the CPU Parameters?

Review [the CPU isolation steps in Part 1](environment-before-ros2-workspace-en.md). You can run:

~~~bash
lscpu -e=CPU,CORE,SOCKET,ONLINE
cat /proc/cmdline
~~~

**Do not blindly copy CPU0 and CPUs 1–6 from the original example.** Different CPUs have different logical numbering and hyper-threading layouts. Set `rt_cpu` and `non_rt_cpus` to match your actual active isolation configuration.

---

## 4. Do First-run Test (First Build and Startup)

### Step 1: Return to the Workspace Root Directory

Open **Terminal A (normal user)**:

~~~bash
cd ~/ethercat_ws
~~~

Make sure you are in the `ethercat_ws` root directory, not `src`, `config`, or `launch`.

### Step 2: Run colcon build

Make sure to run this from the ethercat_ws root directory:

~~~bash
colcon build
~~~

The build generally takes about five minutes here, so please be patient!

### Step 3: After the Build, Open Another Terminal as root

This project needs root privileges to run (the terminal with grey and white text), but we recommend building as a normal user (the terminal with blue and green text).

Recommended division of work:

| Terminal | Privileges | Purpose |
| --- | --- | --- |
| A | Normal user | Edit files and run `colcon build` |
| B | root | Load the workspace and run `soem_backend` |

Press Ctrl+Alt+T to open a new terminal.

In the **new terminal**, execute:

~~~bash
sudo su
~~~

Enter the password "1" to switch to root.

For example, if your normal username is `hby` and you created the workspace in that user's Home directory:

~~~bash
cd /home/hby/ethercat_ws
~~~

### Step 4: Source the Built Workspace

From the workspace root directory in the root terminal, run:

~~~bash
source install/setup.bash
~~~

This tells ROS 2 where to find the compiled and installed packages such as `soem_bringup` and `soem_wrapper`.

### Step 5: Start SOEM

Make sure that your EtherCAT board is now powered through Type-C (its LEDs should be lit), and that an Ethernet cable connects the computer and the EtherCAT board.

Then execute the standard command from the tutorial:

~~~bash
ros2 launch soem_bringup bringup.launch.py
~~~

### Step 6: The First Run May Report key not found

**Key lines from the original log (timestamps and unrelated debug details omitted):**

~~~text
[soem_node]: ec_init on enp2s0 succeeded.
[soem_node]: 1 slaves found
[soem_node]: detected 1 slaves
[EthercatNode_CFG]: Found slave id=1, sn=2228293, eepid=3, type=H750UniversalModule
terminate called after throwing an instance of 'std::runtime_error'
what():  get Key not found: sn2228293_sdo_len
~~~

How to understand this:

- `ec_init ... succeeded`: EtherCAT initialization on this network interface succeeded up to this point.
- `1 slaves found`: The master found **one slave**.
- `Found slave id=1, sn=1234567`: Most importantly, the log provides the slave's **real SN**.
- `Key not found`: `sn2228293_sdo_len`.

This tells us that the sn2228293 entered in config.yaml earlier was a placeholder name, while the actual name is sn1234567. (sn1234567 is only an example; look at the digits printed in your own terminal.)<br>

---

## 5. Find Your Actual SN, Update the Configuration, and Run Again

### Step 1: Read the Actual SN from the Logs

Look for a line like:

~~~text
[EthercatNode_CFG]: Found slave id=1, sn=1234567, eepid=3, type=H750UniversalModule
~~~

- `slave id=1`: The first slave in the master's connection chain.
- `sn=1234567`: The SN (serial number) of this board.
- `eepid=3` and `type=H750UniversalModule`: Information about the module type.

**The slave id is the position of the slave, while SN is its serial number. Do not confuse them!**

### Step 2: Change the SN in config.yaml

Use the file manager to locate this config.yaml file at:

~~~bash
ethercat_ws/src/soem_bringup/config/config.yaml
~~~

Replace the original configuration key:

~~~yaml
  - sn2228293:
~~~

with the **real SN you found in your own terminal log**.

For example, assuming your actual SN is `12345678`, change it to:

~~~yaml
  - sn12345678:
~~~

Keep the `sn` prefix. Then press Ctrl+S to save.

**Image from the original tutorial: Updating the SN in the configuration**

![Original SN configuration diagram: sn.png](../img/sn.png)

<sub>Original image `docs/img/sn.png`; this repository contains the same file.</sub>

### Step 3: Rebuild So the Updated Configuration Takes Effect

**After updating the YAML file, run `colcon build` again.**<br>

Open the normal-user terminal with blue and green text and run:

~~~bash
cd ~/ethercat_ws
colcon build
~~~

This is to ensure that the changes we made to config.yaml have been saved and applied.

### Step 4: Start It Again

Return to the **root Terminal B** (grey and white text), make sure you are in the actual workspace root directory, and execute:

~~~bash
source install/setup.bash
ros2 launch soem_bringup bringup.launch.py
~~~

---

## 6. Done (How to Know the Test Succeeded)

### Step 1: Confirm That All Slaves Have Reached Ready

The full successful log in the original tutorial is quite long. Here are the **important lines**:

~~~text
[soem_node]: ec_init on enp2s0 succeeded.
[soem_node]: 1 slaves found
[EthercatNode_CFG]: Found slave id=1, sn=2228293, eepid=3, type=H750UniversalModule
[soem_node]: Slaves mapped, state to SAFE_OP.
[soem_node]: All slaves reached SAFE_OP, state to OP
[soem_node]: Operational state reached for all slaves.
[EthercatNode_CFG]: Initialization succeeded
[EthercatNode_DATA]: slave id 1 sdo confirmed received
[EthercatNode_DATA]: slave id 1 confirmed ready
~~~

**The most important result is:**

~~~text
slave id 1 confirmed ready
~~~

This means that the slave has passed the example initialization process. If you connect multiple slaves, the original tutorial expects each slave to show its own `slave id n confirmed ready` message. Seeing only one board become ready does not prove that all boards are ready.

### Step 2: View the /latency Topic

Keep the SOEM master running in its root terminal. **Press Ctrl+Alt+T to open another normal terminal**, then run:

~~~bash
cd ~/ethercat_ws
sudo su
~~~

Enter the digit "1" as the password. Then run:

~~~bash
source install/setup.bash
ros2 topic list
~~~

If you can see `/latency`, you can subscribe to it as follows:

~~~bash
ros2 topic echo /ecat/sn12345678/latency
~~~

This is an example topic name. Replace the digits after sn with your own. If the terminal displays numbers that change in real time, the operation is correct.

---

## Next Step

### **[→ Part 4: Customize Configuration (EtherCAT Configuration)](customize-configuration-en.md)**

After completing your first SOEM runtime test, the next lesson will use the online AIMEtherCAT TaskEditor to add tasks for your EtherCAT module and generate and deploy a new `config.yaml`.

[← Previous lesson: Setup ROS2 Workspace and Subsequent Deployment](setup-ros2-workspace-and-after-en.md) · [Back to Course Homepage](../../readme.md)

---

<sub>Source: [AIMEtherCAT / EcatV2_Master — First Run Tutorial](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md). Images reuse the original `docs/img/tree.png` and `docs/img/sn.png`; copyright and licensing remain with their respective owners.</sub>
