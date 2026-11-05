# 第四部分｜Customize Configuration（自定义 EtherCAT 配置）

[← 上一节：First Run Test](first-run-test.md) · [返回课程主页](../../readme.md)

> **本节依据**：[AIMEtherCAT 官方 Configuration Generator 教程](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)。教学顺序沿用原文的 **Visit Online Generator → Add Module → Basic Configuration → Add Task → Download Configuration File → Upload Configuration File → Done**。所用 6 张配图均为当前仓库已有的原版图片。实际界面、任务选择及参数请以你使用的固件和配置生成器为准。

## 我们这节课要做什么？

上一节已经让 Ubuntu 上的 SOEM 主站识别 EtherCAT 板、读取真实 SN，并运行了第一份简单的 `config.yaml`。但是板子除了通信以外，还可以接收遥控器、读取 IMU / CAN 传感器，或控制 DSHOT / PWM 等设备。**这些功能不是自动全部启用的，需要按你连接的硬件添加任务（Task）。**

本节的目标是：**不要求大家手写复杂的 YAML，而是使用官方在线配置生成器来制作自己的 `config.yaml`**。

具体要完成：

1. 打开官方 TaskEditor，添加正确的 EtherCAT 模块；
2. 填入自己板子的 **SN（序列号）**，理解延迟话题名称；
3. 按实际接入的硬件添加任务并设置参数；
4. 检查 EtherCAT 的 PDO 数据容量，不能有 overflow；
5. 下载 `config.yaml`，放回 `soem_bringup/config`；
6. 重新 `colcon build`、启动主站，查看对应 ROS 2 话题。

**开始之前：** 请先完成 [First Run Test](first-run-test.md)，确保已能看到 `slave id 1 confirmed ready` 等类似日志。以下以教学工作空间 `~/ethercat_ws` 为例，如果你之前使用了其他名称，请替换成自己的实际路径。

---

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

在这个项目中，**Module（模块）**通常对应一种 MCU/硬件板类型，而 **Task（任务）**是这个模块要执行的具体功能。

比如，你手上的 EtherCAT 板是 **H750 Universal Module**。这表示你先要选择的是这类模块；之后才能向它添加读取遥控器、采集 IMU 或输出 DSHOT 等任务。

原版教程列出的模块类型：

- **H750 Universal Module**

### 步骤 2：在网页中添加模块

在 TaskEditor 里，找到以模块型号命名的按钮，点击 **H750 Universal Module**。

添加后，网页会出现对应模块的配置区域。

**这一步必须按实际硬件来选**。不能因为教程使用 H750，就把其他厂家、其他模块型号都当成 H750。

如果你手上接了多个原厂 H750 模块，后续需要为**每一个实际模块**分别添加配置，并填写各自的 SN；本节首先以**一块板**讲解。

---

## 3. Basic Configuration（填写模块基础信息）

### 步骤 1：填写 Module SN

点击模块的配置区域，找到输入框：

**`Module SN`**

这个 SN 就是上一节 First Run Test 中，终端显示的板子序列号。比如示例日志：

~~~text
[EthercatNode_CFG]: Found slave id=1, sn=2228293, eepid=3, type=H750UniversalModule
~~~

这里应填写的是：

~~~text
2228293
~~~

**而不是** `slave id=1`、`eepid=3` 或 `sn2228293` 整个字符串。

| 日志字段 | 意义 | 填入 Module SN 吗？ |
| --- | --- | --- |
| `slave id=1` | 当前 EtherCAT 链路中的从站位置 | **不填** |
| `sn=2228293` | 板子的序列号 | **填数字 2228293** |
| `eepid=3` | 模块产品类型相关标识 | **不填** |

> **重要：** 上面的 2228293 是原作者示例，不是你的真实 SN。请回上一节日志里找到自己板子的 `sn=...` 数字后填写。官方教程说 SN 通常是 7 位数字，但不应该为了凑位数擅自修改你实际读出的 SN。

### 步骤 2：认识 Module Latency Topic

在模块配置中会看到：

**`Module Latency Topic`**

这个字段控制模块通信延迟所发布的 ROS 2 话题名。官方生成器通常会**自动为你生成默认话题名称**，也允许你自己修改。

**注意一个细节：** 原版教程指出，**修改 Module SN 后，Latency Topic 可能被自动重新生成**。因此建议操作顺序是：

1. 先填写并确认 `Module SN`；
2. 再检查 `Module Latency Topic`；
3. 如果需要自定义话题名，**最后**再修改它。

后面查看话题时，优先执行：

~~~bash
ros2 topic list
~~~

请以实际列出的名称为准，不要认定它一定叫 `/latency` 或一定叫 `/ecat/sn1234567/latency`。

---

## 4. Add Task（添加需要的硬件任务）

### 步骤 1：展开任务列表

在 TaskEditor 中，点击表格左侧的小箭头，展开此模块支持的任务列表。

**原教程配图：展开可添加的任务**

![TaskEditor 任务列表（原版 tasks.jpg）](../img/tasks.jpg)

随后选择你需要使用的任务，**点击相应任务名称的按钮**，它就会出现在模块的配置表格里。

### 步骤 2：展开任务详情并修改参数

新添加任务之后，再点击该任务行左侧的小箭头，展开详细设置。

**原教程配图：任务参数编辑区域**

![TaskEditor 任务详情设置（原版 task-details.jpg）](../img/task-details.jpg)

不同任务的参数不一样，常见有：

| 配置类型 | 意义 | 示例 |
| --- | --- | --- |
| `Publisher Topic Name` | 设备**向 ROS 2 发布数据**的话题名 | 遥控器、IMU 数据 |
| `Subscriber Topic Name` | 设备**订阅 ROS 2 控制命令**的话题名 | 电机控制指令 |
| `CAN`、`Packet ID` | 传感器所接 CAN 口、数据包标识 | HIPNUC IMU |
| `TIM` | 具体的 DSHOT/PWM 硬件端口 | DSHOT 输出 |
| `Initial Value` | 主站收到外部控制指令前的初始输出值 | DSHOT/PWM 控制 |

**理解发布和订阅的区别：**

- **Publisher（发布者）**：比如 IMU 把测量数据发布到一个 ROS 2 话题中，主机可以通过 `ros2 topic echo` 读取。
- **Subscriber（订阅者）**：比如 DSHOT 电机控制任务等待 ROS 2 的控制消息，主机需要向对应话题发送符合类型的命令。

> **安全说明：** 电机、PWM、DSHOT 等执行器任务不能仅因为它们出现在生成器里就随意使能。先查看对应硬件准备说明，在机械机构安全、电调与电机未带载或已采取适当防护的条件下，确认初始值和控制语义，再进行实际输出测试。**不要直接照抄别人的电机初始值或向未知执行器发布测试命令。**

### 步骤 3：原版教程有哪些可选任务？

原教程将任务分为 **Tested（已测试）** 与 **Untested（尚未验证）**。这里保留原始分类和说明文档链接，方便大家阅读具体的引脚、参数与 ROS 2 消息类型。

#### A. Tested Tasks（上游标记为已测试）

| 类型 | 任务 | 说明文档 |
| --- | --- | --- |
| 遥控器 RC | DJI RC | [DJI RC](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/dji-rc.md) |
| 遥控器 RC | SBUS RC | [SBUS RC](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/sbus-rc.md) |
| 传感器 | HIPNUC IMU (CAN) | [HIPNUC IMU](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/hipnuc-imu-can.md) |
| 传感器 | PMU (CAN) | [PMU](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/pmu-can.md) |
| 传感器 | SUPER CAP (CAN) | [Super Cap](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/super-cap.md) |
| 传感器 | MS5837 (30BA) | [MS5837 (30BA)](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/ms5837-30ba.md) |
| 执行器 | DSHOT600 | [DSHOT](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/dshot.md) |
| 执行器 | DJI Motor | [DJI Motor](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/dji-motor.md) |
| 执行器 | DM Motor | [DM Motor](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/dm-motor.md) |
| 执行器 | LkTech Motor | [LkTech Motor](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/lk-motor.md) |
| 执行器 | DD Motor | [DD Motor](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/dd-motor.md) |
| 执行器 | Onboard PWM | [Onboard PWM](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/onboard-pwm.md) |
| 执行器 | External PWM | [External PWM](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/external-pwm.md) |

> **注意：** “已测试”是上游教程对相应实现的分类，并不表示它在所有固件版本、所有接线条件或课程实机上都已经验证成功。实际选择时要符合你手上模块、扩展板与固件支持情况。

#### B. Untested Tasks（上游尚未确认）

- [Onboard ADC — 上游原文标记 UNTESTED](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/task-info/onboard-adc.md)

如果是第一次学习，建议先使用已有明确硬件说明并且能安全读取数据的任务，而不是把所有任务一次性加入。

### 步骤 4：以 DJI RC / HIPNUC IMU / DSHOT 为例理解配置

这里仅介绍怎么**读懂任务**，不要求你同时连接这三类设备。

**示例 A：DJI RC（遥控接收机）**

- 官方说明：把 DR16 接收机接到模块的 `DBUS` 端口。
- 任务本身没有额外的功能参数，主要可以修改 **DJI RC Publisher Topic Name**。
- 官方文档给出的 ROS 2 消息类型是 `custom_msgs/msg/ReadDJIRC`，包含摇杆、开关等信息。

**示例 B：HIPNUC IMU (CAN)**

- 官方说明：把对应的 IMU 转发板连接到模块的 `CAN` 端口。
- 可以配置 CAN 端口、Packet1 / Packet2 / Packet3 ID、Frame name、Publisher Topic Name。
- 其 ROS 2 消息类型是 `sensor_msgs/msg/Imu`，包含姿态、角速度和线加速度。
- 如果一条 CAN 网络上有多块 IMU 转发板，还需要注意各板的报文 ID 配置；不能无条件使用相同 Packet ID。

**示例 C：DSHOT600（电调输出）**

- 官方说明：连接到模块的 `DSHOT/TIM` 端口，选择对应的 `TIM` 编号。
- 可设置 `Initial Value`（尚未接收到控制消息时的初始输出值）以及控制命令所订阅的话题名。
- 官方说明的控制消息类型为 `custom_msgs/msg/WriteDSHOT`，包含 `channel1`～`channel4`。
- 官方文档中 DSHOT 数值的基本范围：`0` 表示 disarmed、`1–47` 为保留命令、`48–2047` 为油门数值；**实际电调协议及双向模式必须另行核对**。

> **推荐第一次练习**：先选择与你实际接线一致、仅发布数据的遥控器或传感器任务。可以先验证能否收到 ROS 2 消息，再考虑电机控制任务。

---

## 5. Download Configuration File（下载配置文件）

### 步骤 1：先检查每个模块的 PDO 数据容量

在 TaskEditor 的 **Config Generator** 页面中，每个模块会展示其配置摘要，模块旁边还有表示 PDO 使用情况的标记。

**原教程配图：模块名称旁的 PDO 使用标签**

![模块 PDO 使用标签（原版 tag.png）](../img/tag.png)

为什么会有 PDO 的容量限制？

EtherCAT 模块和主站之间周期交换的数据包空间是有限的。每添加一个任务，都可能使用一部分发送或接收 PDO 空间。如果任务太多，超过该模块所允许的容量，就无法按当前配置容纳所有数据。

**原教程配图：PDO Overflow 的警告标签**

![PDO overflow 警告示例（原版 overflow-tag.png）](../img/overflow-tag.png)

**重要：如果出现任何 PDO Overflow（溢出）警告，请先删除或减少部分任务，直到不再溢出。**

不要因为配置能够下载，就忽略容量溢出。也不要通过随意更改没有核实的长度字段来绕过检查。

### 步骤 2：下载 config.yaml

确认模块、SN、任务及 PDO 容量都符合要求后，在网页的 **Config Generator** 页面点击 **Download**（下载）按钮。

按原版教程，浏览器会下载一个名称为：

~~~text
config.yaml
~~~

的配置文件。

下载完成后可以先在文件管理器的 **Downloads（下载）** 文件夹中找到它。

**请注意：** 网站生成了文件，不代表 Ubuntu 主站已经开始使用它；还需完成下一节的上传/替换操作。

---

## 6. Upload Your Configuration File（放入工作空间并启用配置）

### 步骤 1：找到原来的 config 文件夹

我们在上一课创建的 ROS 2 启动包，路径是：

~~~text
~/ethercat_ws/src/soem_bringup/
~~~

它里面应该包含：

~~~text
soem_bringup/
├── CMakeLists.txt
├── package.xml
├── config/
│   └── config.yaml
└── launch/
    └── bringup.launch.py
~~~

**原教程配图：将配置文件放入 config 文件夹**

![soem_bringup config 文件夹示例（原版 config-folder.png）](../img/config-folder.png)

### 步骤 2：先备份旧配置，再替换

如果你准备让新配置取代之前 First Run Test 使用的 `config.yaml`，**建议先备份旧文件**，防止后面任务配置错误时无法恢复。

在普通用户终端执行：

~~~bash
cd ~/ethercat_ws
cp src/soem_bringup/config/config.yaml src/soem_bringup/config/config.first-run.backup.yaml
~~~

接着，你可以用 Ubuntu 文件管理器打开 `~/Downloads`，找到从网站下载的 `config.yaml`，并**复制**到 `~/ethercat_ws/src/soem_bringup/config/`，同意替换同名旧文件。

也可以用终端复制（仅当下载位置确实是这个路径时）：

~~~bash
cp ~/Downloads/config.yaml ~/ethercat_ws/src/soem_bringup/config/config.yaml
~~~

这里默认你的普通用户下载目录就是 `~/Downloads`。如果浏览器使用了其他下载目录，请自行调整。

**检查文件是否已经在正确位置：**

~~~bash
ls ~/ethercat_ws/src/soem_bringup/config
~~~

如果想打开确认内容：

~~~bash
nano ~/ethercat_ws/src/soem_bringup/config/config.yaml
~~~

请检查里面的 SN、任务及话题名是否和网页上的设置一致；不要把上节课示例 SN 当成实际设备 SN。

### 步骤 3：如果想保留多份不同的配置怎么办？

原版教程允许保留多份配置文件，例如：

~~~text
soem_bringup/
└── config/
    ├── config.yaml
    ├── config_imu.yaml
    └── config_rc.yaml
~~~

但如果你把准备启用的文件从 `config.yaml` 改名为 `config_imu.yaml`，**一定还要修改 `bringup.launch.py`**。

打开：

~~~bash
nano ~/ethercat_ws/src/soem_bringup/launch/bringup.launch.py
~~~

找到构造配置路径的代码：

~~~python
config_file = os.path.join(
    get_package_share_directory('soem_bringup'),
    'config',
    'config.yaml'
)
~~~

例如想启用 `config_imu.yaml`，就把最后的：

~~~python
'config.yaml'
~~~

改成：

~~~python
'config_imu.yaml'
~~~

**原则：Launch 文件中使用的文件名必须和 `config` 目录内真实存在的文件名完全一致。**

> **提醒：** 不要修改代码里 `'config'` 这个目录名，也不要把不同文件名的配置随意混用。

### 步骤 4：重新编译工作空间

原版教程指出，修改配置完成后，必须返回工作空间**根目录**执行：

~~~bash
cd ~/ethercat_ws
colcon build
~~~

**建议使用普通用户进行编译。** 我们在上一节将 `config` 和 `launch` 文件夹写入了 `CMakeLists.txt` 的安装规则，因此重新编译可以让安装目录更新到新的配置。

如果 `colcon build` 失败，请先查看报错并修复；不要直接启动旧的 `install` 结果并误以为新配置已经生效。

---

## 7. Done（运行自定义配置并检查话题）

### 步骤 1：重新启动 SOEM 主站

如果上一课的主站进程还在运行，先到它所在的终端按 `Ctrl + C` 停止。

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

这时应该可以查看与你添加的任务相对应的话题（发布者或订阅者，具体由任务决定）。**不要猜话题名**，以 `ros2 topic list` 的实际输出为准。

### 步骤 3：判断话题类型并查看数据

假设在 `ros2 topic list` 中发现一个传感器话题，先查看它的类型：

~~~bash
ros2 topic info -v /实际话题名
ros2 topic type /实际话题名
~~~

请把 `/实际话题名` 换成终端列出的真实名称，不要把中文占位符直接照抄。

如果该话题有数据发布者，再查看消息：

~~~bash
ros2 topic echo /实际话题名
~~~

例如，官方 HIPNUC IMU 任务使用的是 `sensor_msgs/msg/Imu` 类型，DJI RC 使用的是 `custom_msgs/msg/ReadDJIRC` 类型。你可以通过：

~~~bash
ros2 interface show sensor_msgs/msg/Imu
~~~

查看对应消息包含哪些字段。

**发布控制命令与读取传感器数据不同。** 如果你配置的是 DSHOT 或其他电机控制任务，建议先查看 `ros2 topic info -v` 和对应任务官方文档，确认消息类型、话题方向及电调安全条件后再进行控制。

### 步骤 4：判断是否完成本节

完成以下项目，就代表你已经掌握**从网页配置到 ROS 2 主站部署**的基本流程：

- [ ] 成功打开 [AIMEtherCAT TaskEditor](https://aimethercat.github.io/TaskEditor)。
- [ ] 添加与你实际板子对应的 Module。
- [ ] 从上节课日志读取真实 SN，填写到 `Module SN`。
- [ ] 按实际接线添加一个或多个 Task，并确认其配置参数。
- [ ] 检查 PDO 标签，没有 Overflow 警告。
- [ ] 下载 `config.yaml` 并放到 `src/soem_bringup/config/`。
- [ ] 如果修改了文件名，同步修改 `bringup.launch.py`。
- [ ] 普通用户运行 `colcon build` 成功。
- [ ] root 终端重启 SOEM，所有预期从站正常初始化。
- [ ] 使用 `ros2 topic list` 看到预期话题，并能核对相应消息类型。

---

## 8. 常见问题与排查

| 遇到的问题 | 可能原因 / 处理方法 |
| --- | --- |
| 打不开 TaskEditor | 先确认浏览器联网以及网站地址 `https://aimethercat.github.io/TaskEditor` 正确 |
| 找不到自己需要的模块 / Task | 可能当前生成器或对应固件并未提供支持，不应强行选择不匹配硬件 |
| 修改了 SN，Latency Topic 名称也变了 | 原版说明该字段可能随 SN 自动更新；**先填 SN，最后再检查话题名** |
| 任务参数不知如何填写 | 打开上面的各任务 `task-info` 原版文档，先确认端口、接口、消息类型 |
| 出现 PDO Overflow | 删除或减少任务，确保发送/接收 PDO 容量没有溢出 |
| 下载的配置没有生效 | 是否放到正确的 `config` 目录，是否执行 `colcon build`，是否重新启动主站 |
| 主站提示找不到 YAML 文件 | `bringup.launch.py` 中的文件名与 `config` 目录是否一致 |
| 主站提示找不到 SN 对应配置 | 生成器中填的真实 SN 是否与从站日志一致 |
| 能启动但找不到预期话题 | 检查任务是否已加入、是否使用正确 YAML、从站是否正常 ready，以及真实话题命名 |
| 电机任务没有响应 | 先查看对应官方硬件文档、控制消息类型、初始值与安全条件，**不要盲目发送油门指令** |

---

## 本课结束

现在你已经学会：**First Run Test 负责让主站先连上从站；Customize Configuration 负责决定这个从站要执行哪些实际任务。**

如果你后续想给自己的板子增加 IMU、遥控器或电机任务，就可以按本节流程返回 TaskEditor 编辑，然后重新下载、编译和启动。

[← 返回上一节：First Run Test](first-run-test.md) · [返回课程主页](../../readme.md)

---

<sub>主要参考：[AIMEtherCAT / EcatV2_Master — Configuration Generator](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/configuration-generator.md)。图片沿用原版 `webpage.jpg`、`tasks.jpg`、`task-details.jpg`、`tag.png`、`overflow-tag.png`、`config-folder.png`，均位于本仓库 `docs/img/`。具体硬件使用请参考原版 `task-info` 文档；功能支持与实机结果依实际代码和固件版本为准。</sub>
