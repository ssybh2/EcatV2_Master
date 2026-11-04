# 第三部分｜First Run Test：第一次运行 EtherCAT（SOEM）测试

[← 上一篇：Setup ROS2 Workspace 与后续部署](setup-ros2-workspace-and-after.md) · [返回课程主页](../../readme.md)

## 1. Create Bringup Package（创建 ROS 2 启动包）

### 步骤 1：进入 src 目录

打开终端，输入：

~~~bash
cd ~/ethercat_ws/src
ls
~~~

`cd` 用于进入指定目录；`ls` 列出当前文件夹内容。你应该能看到之前添加的 `EcatV2_Master`。

### 步骤 2：创建 soem_bringup 包

在 `src` 内执行命令：

~~~bash
ros2 pkg create --build-type ament_cmake soem_bringup
~~~

它的含义是：使用 `ament_cmake` 构建类型，创建名称为 `soem_bringup` 的 ROS 2 功能包。成功后，`src` 中会出现 `soem_bringup` 文件夹。

### 步骤 3：创建 config 与 launch 文件夹

~~~bash
cd ~/ethercat_ws/src/soem_bringup
mkdir -p config launch
~~~

- `config`：用于保存主站的 YAML 配置文件；
- `launch`：用于保存 ROS 2 启动脚本。

### 步骤 4：修改 CMakeLists.txt

点开屏幕最左边靠上位置的files文件夹

按原教程加入以下内容：

~~~cmake
install(DIRECTORY
        launch
        config
        DESTINATION share/${PROJECT_NAME}/
)
~~~

**应放在 `ament_package()` 前面。** 原版教程提到第 13 行，但不同版本生成的文件行数可能不一样，位置以 `ament_package()` 为准。

作用：编译安装时，把 `launch` 与 `config` 目录复制到 ROS 2 包的共享目录，否则运行 `ros2 launch` 时可能无法找到启动文件，或者程序找不到配置文件。

在 nano 编辑器里，按 `Ctrl + O` → `Enter` 保存，按 `Ctrl + X` 退出。

### 步骤 5：确认目录结构

此时的关键目录应如下（这里只列出本教程需要的文件）：

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

**原版配图：工作空间目录结构**

![原教程的文件夹结构图 tree.png](../img/tree.png)

<sub>原版图片 `docs/img/tree.png`，本仓库使用 `docs/img/tree.png`。</sub>

---

## 2. Config File（创建 config.yaml）

### 步骤 1：创建文件

~~~bash
cd ~/ethercat_ws/src/soem_bringup/config
nano config.yaml
~~~

将**原教程的示例 YAML 原样粘贴**到文件里：

~~~yaml
slaves:
  - sn2228293:
      sdo_len: !uint16_t 2
      task_count: !uint8_t 1
      latency_pub_topic: !std::string '/latency'

      tasks:
        - app_1:
            sdowrite_task_type: !uint8_t 3
            pub_topic: !std::string '/imu'
            pdoread_offset: !uint16_t 0
~~~

保存后退出：`Ctrl + O` → `Enter` → `Ctrl + X`。

**特别注意：** YAML 依靠空格缩进表示层级关系；不要随便调整空格、删去 `!uint16_t` / `!uint8_t` / `!std::string` 这样的类型标签，或将它们写成中文标点。

### 步骤 2：理解各字段

| 配置 | 作用 | 示例值 |
| --- | --- | --- |
| `slaves` | EtherCAT 从站配置列表 | — |
| `sn2228293` | 从站 SN（序列号）对应的配置键，格式为 `sn` + 序列号 | `2228293` |
| `sdo_len` | 本示例的 SDO 数据长度 | `2` |
| `task_count` | 本示例的任务数量 | `1` |
| `latency_pub_topic` | 发布通信延迟的 ROS 2 话题名 | `/latency` |
| `app_1` | 第 1 个应用任务 | — |
| `sdowrite_task_type` | 此示例所使用的任务类型编号 | `3` |
| `pub_topic` | 示例应用的话题名 | `/imu` |
| `pdoread_offset` | PDO 读取偏移 | `0` |

**重点：** `sn2228293` 只是原作者的设备编号，**不是你的设备一定拥有的 SN**。这一章会先执行一次 Launch 来读取真实 SN，再修改这个字段。

如果后面连接多块 EtherCAT 从站，每块板的 SN 都需要单独确认并配置。

---

## 3. Launch File（创建 bringup.launch.py）

### 步骤 1：打开 launch 文件

~~~bash
cd ~/ethercat_ws/src/soem_bringup/launch
nano bringup.launch.py
~~~

按原教程粘贴下列 Python 代码，保存并退出：

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
                'interface': "enp2s0",
                'rt_cpu': 0,
                'non_rt_cpus': "1,2,3,4,5,6",
                'config_file': config_file
            }],
            output='screen'
        )
    ])
~~~

**上面是原版完整示例**，其中必须修改三个参数才能适配自己的电脑。

### 步骤 2：修改 interface / rt_cpu / non_rt_cpus

| 参数 | 原教程示例 | 你应该填写什么 |
| --- | --- | --- |
| `interface` | `enp2s0` | **连接 EtherCAT 从站 IN 口**的真实 Linux 有线网卡名 |
| `rt_cpu` | `0` | 实际隔离的 CPU 逻辑编号（对应第一部分的 X） |
| `non_rt_cpus` | `1,2,3,4,5,6` | 实际未隔离的其余逻辑 CPU 编号列表（对应第一部分的 Y） |

#### 如何确定 EtherCAT 的网卡名？

打开终端：

~~~bash
ip -br link
~~~

可能会看到 `eno1`、`enp2s0`、`enp3s0` 或 `enx...`。可以进一步检查（网口名请按实际替换）：

~~~bash
sudo ethtool enp2s0
~~~

如果显示 `Link detected: yes`，说明物理链路已建立，但**不能仅凭此项确定另一端一定是 EtherCAT 从站**。可通过确认连接位置，以及拔插 EtherCAT 网线后查看网口变化来识别。

例如实际连接的网卡叫 `eno1`，就把 Launch 文件中这一行改成：

~~~python
'interface': "eno1",
~~~

#### 如何确定 CPU 参数？

回顾[第一部分的 CPU 隔离步骤](environment-before-ros2-workspace.md)。可以查看：

~~~bash
lscpu -e=CPU,CORE,SOCKET,ONLINE
cat /proc/cmdline
~~~

**不要照抄原版 CPU0 和 1～6 的数字。** 不同 CPU 的逻辑编号和超线程拓扑不相同；`rt_cpu` 和 `non_rt_cpus` 应与你实际生效的隔离配置一致。

#### config_file 要修改吗？

一般不必。原教程使用 `get_package_share_directory('soem_bringup')` 自动定位已安装的 `config/config.yaml`，所以前面必须修改 CMakeLists.txt 并重新编译。

---

## 4. Do First-run Test（第一次编译和启动）

### 步骤 1：返回工作空间根目录

打开**终端 A（普通用户）**：

~~~bash
cd ~/ethercat_ws
pwd
~~~

确保当前在 `ethercat_ws` 根目录，而非 `src`、`config` 或 `launch`。

### 步骤 2：执行 colcon build

原教程要求：

~~~bash
colcon build
~~~

请使用**普通用户**编译，不要用 root。编译成功后，工作空间根目录通常会生成 `build`、`install` 和 `log`。

如果看到 `colcon: command not found`，需要先检查 ROS 2 构建工具是否已经安装；不能直接跳过这一步。

### 步骤 3：另开一个 root 终端

原版教程说明，此项目启动时需要 root 权限，但建议普通用户构建。推荐分工：

| 终端 | 权限 | 操作 |
| --- | --- | --- |
| A | 普通用户 | 修改文件、`colcon build` |
| B | root | 加载工作空间、运行 `soem_backend` |

在**终端 B** 执行原版命令：

~~~bash
sudo su root
~~~

输入密码后切换至 root。**不要忽略工作目录：** root 用户的 `~` 代表 `/root`，不再代表你的普通用户 Home。

假如你普通用户名叫 `hby`，且工作空间建在该用户的 Home：

~~~bash
cd /home/hby/ethercat_ws
~~~

这里 `hby` 只是**举例**，请换成真实用户名。可以运行 `pwd` 核对当前目录。

### 步骤 4：加载已编译的工作空间

在 root 终端、工作空间根目录执行：

~~~bash
source install/setup.bash
~~~

此命令让 ROS 2 找到刚刚编译安装的 `soem_bringup`、`soem_wrapper` 等包。

### 步骤 5：启动 SOEM

再执行原版教程的标准命令：

~~~bash
ros2 launch soem_bringup bringup.launch.py
~~~

**提示：** 原版教程展示的旧日志里有一行 `ros2 launch stewart_bringup bringup.launch.py`，那是作者当时的包名，与本节创建的 `soem_bringup` 不同。**你应该使用上面这一条命令，不要复制旧日志里的 stewart_bringup。**

### 步骤 6：第一次运行可能出现 key not found

如果网线、网卡和从站供电正确，主站可能先发现硬件，但因为 `config.yaml` 内使用的还是原作者的 SN，报错后退出。

**原版日志关键片段（已省略时间戳与其他调试信息）：**

~~~text
[soem_node]: ec_init on enp2s0 succeeded.
[soem_node]: 1 slaves found
[soem_node]: detected 1 slaves
[EthercatNode_CFG]: Found slave id=1, sn=2228293, eepid=3, type=H750UniversalModule
terminate called after throwing an instance of 'std::runtime_error'
what():  get Key not found: sn2228293_sdo_len
~~~

如何理解：

- `ec_init ... succeeded`：网卡上的 EtherCAT 初始化成功进入这一步。
- `1 slaves found`：发现了 **1 个从站**。
- `Found slave id=1, sn=2228293`：最关键，说明日志读出了从站的 **真实 SN**。
- `Key not found`：通常需要检查配置项是否按实际 SN 建立，以及 YAML 是否正确加载。

**重要：** 原版示例日志里的 SN/配置键还存在不完全一致的片段；上面的错误是说明要**根据实际日志检查配置**，不是说所有硬件都一定会报这条错误。

如果启动失败发生在 `ec_init` 或显示 `0 slaves found`，应该先排查网卡名、供电、EtherCAT IN 接线和物理链路，而不是贸然修改 SN。

---

## 5. 找到自己的 SN，修改配置并重新运行

### 步骤 1：从日志读出实际 SN

寻找类似这一行：

~~~text
[EthercatNode_CFG]: Found slave id=1, sn=2228293, eepid=3, type=H750UniversalModule
~~~

- `slave id=1`：主站链路中的第 1 个从站；
- `sn=2228293`：此板的 SN（序列号）；
- `eepid=3` 和 `type=H750UniversalModule`：模块类型相关信息。

**slave id 是从站顺序编号，SN 是设备序列号，绝对不要混为一谈。**

### 步骤 2：修改 config.yaml 中的 SN

回到**普通用户终端 A**：

~~~bash
nano ~/ethercat_ws/src/soem_bringup/config/config.yaml
~~~

将原版配置里的：

~~~yaml
  - sn2228293:
~~~

修改成你**自己日志中读到的真实 SN**。

例如仅用于演示，假设实际 SN 是 `12345678`，改成：

~~~yaml
  - sn12345678:
~~~

保留前缀 `sn`。这里的 12345678 是虚构的格式例子，不是你的板子的 SN。其余字段先继续保持原教程示例。

**原版配图：按日志中的 SN 修改配置**

![原版 SN 配置教程图 sn.png](../img/sn.png)

<sub>原版图片 `docs/img/sn.png`；当前仓库已包含同名文件。</sub>

### 步骤 3：重新编译，使修改后的配置安装生效

原教程要求**修改 YAML 后再次执行 `colcon build`**：

~~~bash
cd ~/ethercat_ws
colcon build
~~~

这是因为 `CMakeLists.txt` 中的 `install(DIRECTORY ...)` 会将源代码目录内的 `config` 安装到 `install` 中。如果只编辑源文件不重新编译，主站可能仍读取旧配置。

### 步骤 4：再启动一次

如果主站进程仍运行，先在其终端按 `Ctrl + C` 停止。然后回到 **root 终端 B** 的实际工作空间根目录，重新执行：

~~~bash
source install/setup.bash
ros2 launch soem_bringup bringup.launch.py
~~~

---

## 6. Done（如何判断测试成功）

### 步骤 1：确认所有从站进入 Ready

原版教程展示的成功日志很长；以下是其中的**关键标志性输出节选**：

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

**最重要的结果是：**

~~~text
slave id 1 confirmed ready
~~~

这表示该从站已通过示例初始化流程。如果连接多块从站，原教程要求每块从站都应该分别出现 `slave id n confirmed ready`，不能只看到一块板 ready 就判定全部完成。

### 步骤 2：查看 /latency 话题

保持主站启动的 root 终端运行，**再开一个普通终端**：

~~~bash
cd ~/ethercat_ws
source install/setup.bash
ros2 topic list
~~~

如果能看到 `/latency`，就可以订阅查看：

~~~bash
ros2 topic echo /latency
~~~

原版教程说明：`/latency` 用于观察电脑到 EtherCAT 模块之间的通信延迟，单位是 **毫秒（ms）**。原教程指出大部分情况下延迟应 **小于 1.0 ms**；明显大于 1.0 ms 时，首先检查 CPU 隔离配置，并结合实时内核、网卡和链路状态排查。

**注意：** 1.0 ms 是原作者给出的经验参考，不是所有场景绝对适用的判定标准；实际实时控制还要关注通信周期、抖动等。

---

## 7. 常见问题：出现这些提示怎么处理？

| 现象 | 首先检查 |
| --- | --- |
| `ros2: command not found` | ROS 2 是否正确安装，当前终端是否加载了环境 |
| `colcon: command not found` | 是否安装 `colcon` 构建工具 |
| `package 'soem_bringup' not found` | 是否 `colcon build` 成功、是否执行 `source install/setup.bash` |
| `bringup.launch.py` 找不到 | `launch` 文件夹是否存在，`CMakeLists.txt` 是否包含安装命令，是否重新编译 |
| `config.yaml` 找不到 | `config` 文件路径、`CMakeLists.txt` 的安装规则、编译后的安装文件 |
| `Device does not exist` / `ec_init` 失败 | `interface` 是否真实存在，网口名是否正确，`ip -br link` 和 `ethtool` 输出 |
| `0 slaves found` | 从站是否供电，EtherCAT IN 是否接好，是否连接到正确网卡 |
| `get Key not found: sn...` | 实际从站 SN 与 `config.yaml` 的配置键是否一致，是否重新编译 |
| `rt_cpu` 配置或绑核失败 | CPU 编号与隔离参数是否对应，是否为正确的原生 Linux 实时环境 |
| 没有 `/latency` | 主站是否运行、是否初始化成功、YAML 是否设置该话题 |

> **硬件安全**：本节先验证 SOEM 与从站通信。如板上连接电机等执行器，请确认不会意外运动。原版的 `/imu` 示例只对应其示例应用配置，不代表任何实际模块都可不加修改地使用。

---

## 本节完成检查清单

- [ ] 已在 `src` 创建 `soem_bringup`。
- [ ] 已创建 `config`、`launch`，并修改 `CMakeLists.txt`。
- [ ] 已创建 `config.yaml` 与 `bringup.launch.py`。
- [ ] 已核对实际 `interface`、`rt_cpu` 和 `non_rt_cpus`。
- [ ] 已用**普通用户**执行 `colcon build`。
- [ ] 已在 **root** 终端加载 `install/setup.bash` 并启动主站。
- [ ] 已从日志识别真实 SN，修改 `config.yaml` 并重新编译。
- [ ] 日志显示对应从站 `confirmed ready`。
- [ ] 可以查看 `/latency` 话题，理解延迟单位与意义。

> **课程状态说明**：本文根据原版教程编写，不表示已在课程实际电脑及 EtherCAT 板上执行成功；网卡、CPU、SN 和日志均须在实机上核对。

## 下一步

完成此步骤后，继续参考 [AIMEtherCAT 官方文档目录](https://github.com/AIMEtherCAT/EcatV2_Master/tree/main/docs)，学习 `soem_wrapper` 的其他应用。

[← 上一篇：Setup ROS2 Workspace 与后续部署](setup-ros2-workspace-and-after.md) · [返回课程主页](../../readme.md)

---

<sub>来源：[AIMEtherCAT / EcatV2_Master — First Run Tutorial](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)。图片复用原版的 `docs/img/tree.png` 与 `docs/img/sn.png`；原项目版权及许可归其各自权利人所有。</sub>
