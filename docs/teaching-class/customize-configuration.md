# 第四部分｜Customize Configuration（自定义 EtherCAT 配置）

**语言 / Language：** [简体中文（当前）](customize-configuration.md) | [English](customize-configuration-en.md)
[← 上一节：First Run Test](first-run-test.md) · [返回课程主页](../../readme.md)

## 我们这节课要做什么？


上一节已经让 Ubuntu 上的 SOEM 主站识别 EtherCAT 板、读取真实 SN，并运行了第一份简单的 `config.yaml`。但是板子除了通信以外，还可以接收遥控器、读取 IMU 、遥控器等传感器，或控制 DSHOT / PWM 等设备。
本节的目标是：**不要求大家手写复杂的 YAML，而是使用官方在线配置生成器来制作自己的 `config.yaml`**。也就是配置我们接下来要用到的任务。


## 1. Visit the Online Configuration File Generator（打开在线配置生成器）

### 步骤 1：打开 TaskEditor 网站

先确保电脑已连接互联网，打开浏览器访问：

### **[→ AIMEtherCAT TaskEditor 在线配置生成器](https://aimethercat.github.io/TaskEditor)**

这个页面就是原版教程推荐使用的在线配置生成器。你可以通过点击网页上的按钮选择模块和任务，最后让它帮你生成一个 YAML 配置文件。

**原教程配图：TaskEditor 网页示例**

![TaskEditor 在线配置页面（原版 webpage.jpg）](../img/webpage.jpg)

**注意：** TaskEditor 生成的是**配置文件**，不是在网页上远程控制实体 EtherCAT 板。浏览器中修改配置并不会立即改变正在运行的 SOEM 主站；后面还需要下载文件、替换文件、编译并重启主站。

---

## 2. Add Module（添加 EtherCAT 模块）

### 步骤 1：认识什么叫 Module

在这个项目中，**Module（模块）**通常对应一块硬件ethercat板子，而 **Task（任务）**是这个模块要执行的具体功能。

比如，你手上的 EtherCAT 板是 **H750 Universal Module**。这表示你先要选择的是这类模块；之后才能向它添加读取遥控器、采集 IMU 或输出 DSHOT 等任务。

### 步骤 2：在网页中添加模块

在 TaskEditor 里，找到以模块型号命名的按钮，点击 **H750 Universal Module**。

添加后，网页会出现对应模块的配置区域。

---

## 3. Basic Configuration（填写模块基础信息）

### 步骤 1：填写 Module SN

点击模块的配置区域，找到输入框：

**`Module SN`**

这个 SN 就是上一节 First Run Test 中，终端显示的板子序列号。比如示例日志：

~~~text
[EthercatNode_CFG]: Found slave id=1, sn=12345678, eepid=3, type=H750UniversalModule
~~~

这里应填写的是：

~~~text
12345678
~~~
---

## 4. Add Task（添加需要的硬件任务）

### 步骤 1：展开任务列表

在 TaskEditor 中，点击表格左侧的小箭头，展开此模块支持的任务列表。

**原教程配图：展开可添加的任务**

![TaskEditor 任务列表（原版 tasks.jpg）](../img/tasks.jpg)

我们这里需要用到3个任务，分别是：<br>
1. SBUS RC
2. HIPNUC IMU (CAN)
3. Onboard PWM <br>
这三个分别是 遥控器指令、IMU传感器、电机输出控制。包含了无人机控制的最基本的三要素。

### 步骤 2：直接复制粘贴以下内容进入config.yaml
这里防止大家出错，大家可以直接复制以下内容进入 config.yaml来替换原本已经存在的内容。位置在 ethercat_ws/src/soem_bringup/config/config.yaml
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
**注意：最上面的slaves: -sn2228293这个数字要更改成你手上的那个ecat的具体数字。不能直接照抄**


## 5. Upload Your Configuration File（放入工作空间并启用配置）

### 步骤 1：找到原来的 config 文件夹

我们在上一课创建的 ROS 2 启动包，路径是：

~~~text
~/ethercat_ws/src/soem_bringup/config/config.yaml
~~~


**原教程配图：将配置文件放入 config 文件夹**

![soem_bringup config 文件夹示例（原版 config-folder.png）](../img/config-folder.png)

### 步骤 2：先删除掉config.yaml里面旧的内容，粘贴之前让大家粘贴的那个并 Ctrl+S 保存


### 步骤 3：重新编译工作空间

修改配置完成后，必须返回工作空间**根目录**执行：
**注意，这一步要在普通用户，也就是蓝绿色字母的终端执行编译任务。**

~~~bash
cd ~/ethercat_ws
colcon build
~~~

如果 `colcon build` 失败，请举手并告诉Salman或者Teddy

---

## 7. Done（运行自定义配置并检查话题）

### 步骤 1：重新启动 SOEM 主站

参考上一课的运行方式：打开 root 终端（`sudo su`），**进入实际的工作空间根目录**，再执行：

~~~bash
source install/setup.bash
ros2 launch soem_bringup bringup.launch.py
~~~

**重要：** 上面两条命令是在**工作空间根目录**执行的。root 用户的 `~` 是 `/root`，如果你的工作空间建立在普通用户 Home 中，需先 `cd` 到正确的绝对路径。

观察终端日志，确认所连接的从站已经初始化完成；多块从站时，检查所有预期从站是否分别就绪。

### 步骤 2：列出新的 ROS 2 话题

新开一个终端，加载工作空间环境：

~~~bash
cd ~/ethercat_ws
source install/setup.bash
ros2 topic list
~~~

这时应该可以查看与你添加的任务相对应的话题（发布者或订阅者，具体由任务决定）。


---

## 本课结束

现在你已经学会：**First Run Test 负责让主站先连上从站；Customize Configuration 负责决定这个从站要执行哪些实际任务。**

[← 返回上一节：First Run Test](first-run-test.md) · [返回课程主页](../../readme.md)

---

<sub>主要参考：[AIMEtherCAT / EcatV2_Master — Configuration Generator](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)。图片沿用原版 `webpage.jpg`、`tasks.jpg`、`task-details.jpg`、`tag.png`、`overflow-tag.png`、`config-folder.png`，均位于本仓库 `docs/img/`。具体硬件使用请参考原版 `task-info` 文档；功能支持与实机结果依实际代码和固件版本为准。</sub>
