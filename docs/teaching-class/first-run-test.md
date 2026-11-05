# 第三部分｜First Run Test：第一次运行 EtherCAT（SOEM）测试

[← 上一篇：Setup ROS2 Workspace 与后续部署](setup-ros2-workspace-and-after.md) · [返回课程主页](../../readme.md)

## 1. Create Bringup Package（创建 ROS 2 启动包）

### 步骤 1：退出root权限并进入 src 目录

打开终端，输入：
~~~bash
exit
~~~
你会发现原本灰白色的终端又变成了蓝色绿色，拥有了色彩。这说明你退出了root权限，回到了普通用户权限。<br>
之后运行

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

点开屏幕最左边靠上位置的files文件夹，如图所示：
/图片/待插入
这个类似于windows的文件管理器，很好理解。<br>
然后点开你之前创建的ethercat_ws文件夹，再点开里面的src，再点开里面的soem_bringup文件夹，再点开里面的CMakeLists.txt
找到第13行并插入以下内容：

~~~cmake
install(DIRECTORY
        launch
        config
        DESTINATION share/${PROJECT_NAME}/
)
~~~
之后按Ctrl+S进行保存。
**应放在 `ament_package()` 前面。** 原版教程提到第 13 行，但不同版本生成的文件行数可能不一样，位置以 `ament_package()` 为准。

作用：编译安装时，把 `launch` 与 `config` 目录复制到 ROS 2 包的共享目录，否则运行 `ros2 launch` 时可能无法找到启动文件，或者程序找不到配置文件。

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
~~~
之后输入：
~~~bash
touch config.yaml
~~~
之后去files文件管理器里面找到对应路径下的文件：ethercat_ws/src/soem_bringup/config/config.yaml <br>

然后将**原教程的示例 YAML 原样粘贴**到文件里：

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
然后按下 Ctrl+S 保存。现在你还不需要理解这个是什么意思。一会儿讲解~ <br>
你只需要记住我们在这里起了一个假的从站（ethercat）名字，也就是sn2228293 <br>

---

## 3. Launch File（创建 bringup.launch.py）

### 步骤 1：创建并打开 launch 文件
你先在大概率在这个目录下面：
~~~bash
cd ~/ethercat_ws/src/soem_bringup/config
~~~
请你运行
~~~bash
cd ..
~~~
回到
~~~bash
ethercat_ws/src/soem_bringup
~~~
然后运行：
~~~bash
cd launch
touch bringup.launch.py
~~~
之后在files文件管理器里面找到这个文件，位置在（ethercat_ws/src/soem_bringup/launch/bringup.launch.py) <br>
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
                'interface': "enp3s0",
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
| `interface` | `enp3s0` | **连接 EtherCAT 从站的网口**的真实的有线网卡名，也就是我们在上一课通过终端指令ip -br link找的网口名称 |
| `rt_cpu` | `0` | 实际隔离的 CPU 逻辑编号（对应第一部分的 X） |
| `non_rt_cpus` | `1,2,3,4,5,6` | 实际未隔离的其余逻辑 CPU 编号列表（对应第一部分的 Y） |

#### 如何确定 CPU 参数？

回顾[第一部分的 CPU 隔离步骤](environment-before-ros2-workspace.md)。可以查看：

~~~bash
lscpu -e=CPU,CORE,SOCKET,ONLINE
cat /proc/cmdline
~~~

**不要照抄原版 CPU0 和 1～6 的数字。** 不同 CPU 的逻辑编号和超线程拓扑不相同；`rt_cpu` 和 `non_rt_cpus` 应与你实际生效的隔离配置一致。

---

## 4. Do First-run Test（第一次编译和启动）

### 步骤 1：返回工作空间根目录

打开**终端 A（普通用户）**：

~~~bash
cd ~/ethercat_ws
~~~

确保当前在 `ethercat_ws` 根目录，而非 `src`、`config` 或 `launch`。

### 步骤 2：执行 colcon build

一定要在ethercat_ws根目录执行：

~~~bash
colcon build
~~~
这里一般会编译5分钟左右，请耐心等待~

### 步骤 3：等编译好了之后另开一个 root 终端

此项目启动时需要 root 权限（也就是纯灰白色的字母终端），但建议使用普通用户(也就是蓝绿色字母的终端）。推荐分工：

| 终端 | 权限 | 操作 |
| --- | --- | --- |
| A | 普通用户 | 修改文件、`colcon build` |
| B | root | 加载工作空间、运行 `soem_backend` |

按下Ctrl + Alt + t开启一个新的终端。 

在**新终端** 执行命令：

~~~bash
sudo su
~~~

输入密码 1 后切换至 root

假如你普通用户名叫 `hby`，且工作空间建在该用户的 Home：

~~~bash
cd /home/hby/ethercat_ws
~~~

### 步骤 4：加载已编译的工作空间

在 root 终端、工作空间根目录执行：

~~~bash
source install/setup.bash
~~~

此命令让 ROS 2 找到刚刚编译安装的 `soem_bringup`、`soem_wrapper` 等包。

### 步骤 5：启动 SOEM

确保你的ethercat板子现在有typeC供电，也就是上面的灯亮着。同时网线连接着电脑以及ethercat板子。

再执行原版教程的标准命令：

~~~bash
ros2 launch soem_bringup bringup.launch.py
~~~

### 步骤 6：第一次运行可能出现 key not found

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
- `Found slave id=1, sn=1234567`：最关键，说明日志读出了从站的 **真实 SN**。
- `Key not found`：sn2228293_sdo_len
这说明我们之前在config.yaml里面填写的sn2228293是一个假的名字，真实的名字是sn1234567（这个sn1234567 只是一个例子，具体看你终端显示什么数字）<br>
---

## 5. 找到自己的 SN，修改配置并重新运行

### 步骤 1：从日志读出实际 SN

寻找类似这一行：

~~~text
[EthercatNode_CFG]: Found slave id=1, sn=1234567, eepid=3, type=H750UniversalModule
~~~

- `slave id=1`：主站链路中的第 1 个从站；
- `sn=1234567`：此板的 SN（序列号）；
- `eepid=3` 和 `type=H750UniversalModule`：模块类型相关信息。

**slave id 是从站顺序编号，SN 是设备序列号，绝对不要混为一谈。**

### 步骤 2：修改 config.yaml 中的 SN

通过文件管理器找到这个config.yaml文件,位置在：

~~~bash
ethercat_ws/src/soem_bringup/config/config.yaml
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

保留前缀 `sn`。然后按下Ctrl+S进行保存。

**原版配图：按日志中的 SN 修改配置**

![原版 SN 配置教程图 sn.png](../img/sn.png)

<sub>原版图片 `docs/img/sn.png`；当前仓库已包含同名文件。</sub>

### 步骤 3：重新编译，使修改后的配置安装生效

**修改 YAML 后再次执行 `colcon build`**<br>
请你打开那个有蓝绿色的普通用户终端。并在里面执行：

~~~bash
cd ~/ethercat_ws
colcon build
~~~
这是为了彻底保存之前我们针对于config.yaml的修改。

### 步骤 4：再启动一次
然后回到 **root 终端 B** （也就是有灰白色字母）的实际工作空间根目录，重新执行：

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

保持主站启动的 root 终端运行，**通过按下键盘Ctrl+Alt+t再开一个普通终端**然后运行：

~~~bash
cd ~/ethercat_ws
sudo su
~~~
然后输入阿拉伯数字 1 这是密码。然后运行：
~~~bash
source install/setup.bash
ros2 topic list
~~~

如果能看到 `/latency`，就可以订阅查看：

~~~bash
ros2 topic echo /ecat/sn12345678/latency
~~~
类似于这种话题，sn后面的数字改成你自己的。如果能够echo出来实时变化的数字说明操作正确。

---


## 下一步

### **[→ 第四部分：Customize Configuration（自定义 EtherCAT 配置）](customize-configuration.md)**

完成第一次 SOEM 运行测试后，下一课将使用 AIMEtherCAT 在线 TaskEditor，为自己的 EtherCAT 模块添加任务，生成并部署新的 `config.yaml`。



[← 上一篇：Setup ROS2 Workspace 与后续部署](setup-ros2-workspace-and-after.md) · [返回课程主页](../../readme.md)

---

<sub>来源：[AIMEtherCAT / EcatV2_Master — First Run Tutorial](https://github.com/AIMEtherCAT/EcatV2_Master/blob/main/docs/first-run-test.md)。图片复用原版的 `docs/img/tree.png` 与 `docs/img/sn.png`；原项目版权及许可归其各自权利人所有。</sub>
