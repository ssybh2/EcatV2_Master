# Part 4 | Customize Configuration (EtherCAT Configuration)

**Language / 语言：** [English (current)](customize-configuration-en.md) | [简体中文](customize-configuration.md)

[← Previous lesson: First Run Test](first-run-test-en.md) · [Back to Course Homepage](../../readme.md)

## What are we going to do in this lesson?

In the previous lesson, we got the SOEM master on Ubuntu to identify the EtherCAT board, read its real SN, and run our first simple `config.yaml`. However, the board can do more than communicate: it can receive remote-control signals, read sensors such as IMUs and remote-control receivers, or control devices using DSHOT / PWM.

The goal of this lesson is: **You will not need to write complicated YAML by hand. Instead, we will use the official online configuration generator to create our own `config.yaml`.** In other words, we will configure the tasks we need next.

## 1. Visit the Online Configuration File Generator

### Step 1: Open the TaskEditor website

First, make sure your computer is connected to the Internet. Then open the following website in your browser:

### **[→ AIMEtherCAT TaskEditor Online Configuration Generator](https://aimethercat.github.io/TaskEditor)**

This is the online configuration generator recommended in the original tutorial. You can click buttons on the website to select modules and tasks. Finally, it will generate a YAML configuration file for you.

**Image from the original tutorial: TaskEditor webpage example**

![TaskEditor online configuration page (original webpage.jpg)](../img/webpage.jpg)

**Note:** TaskEditor generates a **configuration file**. It does not remotely control the physical EtherCAT board through the webpage. Changing settings in the browser will not immediately affect the SOEM master that is already running. Later, you must download the file, replace the existing one, compile, and restart the master.

---

## 2. Add Module

### Step 1: Understand what a Module is

In this project, a **Module** usually refers to a physical EtherCAT hardware board, whereas a **Task** is a specific function that the module performs.

For example, suppose the EtherCAT board you have is the **H750 Universal Module**. You should select this type of module first, and only then add tasks such as reading a remote controller, collecting IMU data, or outputting DSHOT signals.

### Step 2: Add a module on the webpage

In TaskEditor, find the button named after the module model and click **H750 Universal Module**.

After you add it, a configuration area for the module will appear on the webpage.

---

## 3. Basic Configuration

### Step 1: Fill in Module SN

Click the module's configuration area and find the input field:

**`Module SN`**

This SN is the board's serial number shown in your terminal during the previous First Run Test lesson. For example, the sample log might be:

~~~text
[EthercatNode_CFG]: Found slave id=1, sn=12345678, eepid=3, type=H750UniversalModule
~~~

You should enter:

~~~text
12345678
~~~

---

## 4. Add Task

### Step 1: Expand the task list

In TaskEditor, click the small arrow on the left side of the table to expand the tasks supported by this module.

**Image from the original tutorial: Expanding the available tasks**

![TaskEditor task list (original tasks.jpg)](../img/tasks.jpg)

Here we need three tasks:  
1. SBUS RC
2. HIPNUC IMU (CAN)
3. Onboard PWM

These represent remote-control commands, IMU sensing, and motor output control, respectively. Together, they cover the three basic elements of drone control.

### Step 2: Copy and paste the following content directly into config.yaml

To prevent mistakes, you can simply copy the following content into `config.yaml` to replace its existing content. The file is located at `ethercat_ws/src/soem_bringup/config/config.yaml`.

~~~bash
slaves:
  - sn2228293:
      sdo_len: !uint16_t 23
      task_count: !uint8_t 3
      latency_pub_topic: !std::string '/ecat/sn2228293/latency'

      tasks:
        - app_1:
            sdowrite_task_type: !uint8_t 11
            conf_connection_lost_read_action: !uint8_t 0x01
            pub_topic: !std::string '/ecat/sn2228293/app1/read'
            pdoread_offset: !uint16_t 0
        - app_2:
            sdowrite_task_type: !uint8_t 3
            conf_connection_lost_read_action: !uint8_t 0x01
            pub_topic: !std::string '/ecat/sn2228293/app2/read'
            pdoread_offset: !uint16_t 24
            sdowrite_can_inst: !uint8_t 1
            sdowrite_packet1_id: !uint32_t 0x01
            sdowrite_packet2_id: !uint32_t 0x02
            sdowrite_packet3_id: !uint32_t 0x03
            conf_frame_name: !std::string 'imu_link'
        - app_3:
            sdowrite_task_type: !uint8_t 6
            sdowrite_connection_lost_write_action: !uint8_t 0x01
            sub_topic: !std::string '/ecat/sn2228293/app3/write'
            pdowrite_offset: !uint16_t 0
            sdowrite_port_id: !uint8_t 1
            sdowrite_pwm_period: !uint16_t 0
            sdowrite_init_value: !uint16_t 1000
~~~

**Important: You must change the number in `slaves: -sn2228293` near the top to the actual number of your own EtherCAT board. Do not copy it without changing it.**

## 5. Upload Your Configuration File (Place It in the Workspace and Enable It)

### Step 1: Locate the original config folder

The ROS 2 bringup package that we created in the last lesson has this configuration file path:

~~~text
~/ethercat_ws/src/soem_bringup/config/config.yaml
~~~

**Image from the original tutorial: Putting the configuration file into the config folder**

![soem_bringup config folder example (original config-folder.png)](../img/config-folder.png)

### Step 2: Delete the old content in config.yaml, paste the content given above, and press Ctrl+S to save

### Step 3: Rebuild the workspace

After modifying the configuration, you must return to the **root directory** of the workspace and execute the build command.

**Important: Run the compilation as a normal user, meaning in the terminal with blue and green text.**

~~~bash
cd ~/ethercat_ws
colcon build
~~~

If `colcon build` fails, raise your hand and tell Salman or Teddy.

---

## 7. Done (Run the Customized Configuration and Check Topics)

### Step 1: Restart the SOEM master

Follow the procedure from the previous lesson: open a root terminal (`sudo su`), **enter the actual workspace root directory**, and run:

~~~bash
source install/setup.bash
ros2 launch soem_bringup bringup.launch.py
~~~

**Important:** Run these two commands **from the workspace root directory**. For the root user, `~` refers to `/root`. If your workspace is inside a normal user's home directory, first use `cd` to go to the correct absolute path.

Observe the terminal logs and confirm that the connected slave has completed initialization. If you have multiple slaves, check that every expected slave is ready.

### Step 2: List the new ROS 2 topics

Open a new terminal and load the workspace environment:

~~~bash
cd ~/ethercat_ws
source install/setup.bash
ros2 topic list
~~~

You should now be able to see topics corresponding to the tasks you added (publishers or subscribers, depending on the task).

---

## End of This Lesson

You have now learned that **First Run Test is about connecting the master to the slave for the first time; Customize Configuration determines which real tasks the slave will perform.**

[← Back to the previous lesson: First Run Test](first-run-test-en.md) · [Back to Course Homepage](../../readme.md)

---

<sub>Main reference: [AIMEtherCAT / EcatV2_Master — Configuration Generator](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md). Images reuse the originals `webpage.jpg`, `tasks.jpg`, `task-details.jpg`, `tag.png`, `overflow-tag.png`, and `config-folder.png` from this repository's `docs/img/` directory. For detailed hardware usage, see the upstream `task-info` documents. Actual support and real-hardware results depend on the code and firmware versions used.</sub>
