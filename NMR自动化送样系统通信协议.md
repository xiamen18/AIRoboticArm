# NMR 自动化送样系统 TCP JSON 通信协议说明书


| 项目   | 内容                            |
| ---- | ----------------------------- |
| 适用范围 | NMR 自动化送样系统设备与上位机通信           |
| 通信模式 | 设备端 TCP Server；上位机 TCP Client |
| 数据格式 | JSON；UTF-8；                   |
| 文档版本 | V0.1                          |

# 1. 通信连接与消息帧

| 项目     | 定义                                     |
| ------ | -------------------------------------- |
| TCP 角色 | 设备端为 TCP Server；上位机为 TCP Client。       |
| 默认端口   | 5001                                   |
| 编码     | UTF-8。                                 |
| 消息边界   | 每条 JSON 消息后追加 LF 换行符 `\r\n`。接收端按换行符拆包。 |
| 超时     | 普通查询 5 秒；动作接收 5 秒；动作完成按动作类型设置独立超时。     |
| 重试     | 命令可重试 3 次；                             |

# 2. 通用报文格式

## 2.1 请求报文

| 字段         | 类型     | 必填  | 说明                               |
| ---------- | ------ | --- | -------------------------------- |
| msg_type   | string | 是   | 固定为 `command`。                   |
| cmd        | string | 是   | 命令名称。                            |
| request_id | string | 是   | 请求唯一编号，同一连接内不得重复；动作类命令用于追溯和幂等判断。 |
| params     | object | 是   | 命令参数对象；无参数时传 `{}`                |

```json
{
  "msg_type": "command",
  "cmd": "get_device_status",
  "request_id": "REQ202606030001",
  "params": {}
}
```

## 2.2 响应报文

响应处理结果统一通过 `code` 判断。所有响应报文中的 `code` 均取自第 11 章错误码定义：`code=0` 表示成功或已接收，`code` 非 0 表示拒绝、失败或异常。

| 字段         | 类型     | 必填  | 说明                                      |
| ---------- | ------ | --- | --------------------------------------- |
| msg_type   | string | 是   | 固定为 `response`。                         |
| cmd        | string | 是   | 对应请求命令。                                 |
| request_id | string | 是   | 必须与请求一致。                                |
| code       | int    | 是   | 响应码，取自第 11 章错误码定义；0 表示成功或已接收。           |
| message    | string | 是   | 错误或状态说明；code 非 0 时应与错误码中文说明一致，也可补充现场信息。 |
| data       | object | 是   | 响应数据对象。                                 |

```json
{
  "msg_type": "response",
  "cmd": "get_device_status",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "device_status": "idle"
  }
}
```

# 3. 命令清单

| 命令                       | 中文名称     | 用途                                                                           |
| ------------------------ | -------- | ---------------------------------------------------------------------------- |
| heartbeat                | 心跳       | 查询设备连接状态和设备信息。                                                               |
| get_device_status        | 设备状态查询   | 按 UN/CM/EM/all 查询设备总体状态、流程状态或设备状态反馈。                                             |
| set_device_mode          | 设备模式     | 设置设备运行模式。                                                                    |
| device_command           | 设备命令     | 下发整机级启动、暂停、停止、中止、复位命令。                                                       |
| get_area_sample_status   | 区域样品状态查询 | 检查中转区、测试平台样品区域、磁体上方测试区的样品是否为空。                                               |
| scan_qrcode              | 二维码识别    | 对指定区域拍照并识别二维码；transfer/platform 返回样品盘二维码和 10 个样品位二维码，test_area 只返回 1 个样品二维码。 |
| move_plate               | 样品盘搬运    | 根据源区域和目的区域搬运样品盘/样品台。                                                         |
| move_sample              | 样品搬运     | 根据源区域/孔位和目的区域/孔位搬运单只样品。                                                      |
| get_crossbar_status      | 横移杆状态    | 读取横移杆位置、阀输出和传感器输入。                                                           |
| move_crossbar            | 横移杆移动    | 控制横移杆到位置 1/2/3。                                                              |
| release_crossbar_sample  | 横移杆释放    | 控制针型气缸释放或保持样品。                                                               |
| set_rgb_light            | 三色灯控制    | 控制测试平台一个或多个区域 RGB 三色灯。                                                       |
| get_robot_status         | 机械臂信息查询  | 读取机械臂信息、默认速度和默认加速度。                                                          |
| robot_axis_move          | 4 轴运动控制  | 控制机械臂 4 轴运动。                                                                 |
| robot_control            | 机械臂基础控制  | 使能、回零、暂停、继续、停止、复位。                                                           |
| get_gripper_status       | 电爪信息查询   | 读取电爪信息、位置和速度。                                                                |
| gripper_control          | 电爪控制     | 打开、关闭或移动到指定开度。                                                               |
| get_machine_param        | 整机参数查询   | 按模块查询整机参数。                                                                   |
| set_machine_param        | 整机参数设置   | 按模块设置整机参数。                                                                   |

# 4. 通用协议

## 4.1 心跳

用于检查 TCP 连接、设备在线状态、设备时间和设备信息。

| 命令        | 说明                            |
| --------- | ----------------------------- |
| heartbeat | 用于检查 TCP 连接、设备在线状态、设备时间和设备信息。 |

### 请求 params 字段

| 字段  | 类型  | 必填  | 说明  |
| --- | --- | --- | --- |

### 响应 data 字段

| 字段          | 类型     | 必填  | 说明                                                                                          |
| ----------- | ------ | --- | ------------------------------------------------------------------------------------------- |
| server_time | string | 是   | 设备时间，ISO 8601 格式。                                                                           |
| status      | string | 是   | online/offline（在线/离线）。                                                        |
| device_info | string | 是   | 设备信息字符串，ASCII，总长度不超过 64 字节，每一项不超过 16 字节。格式：`E-CAN400-ASF-硬件版本号-xxxxxxx-NULL-固件版本号-xxxxxxx`。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "heartbeat",
  "request_id": "REQ202606030001",
  "params": {}
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "heartbeat",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "server_time": "2026-06-04T10:00:00+08:00",
    "status": "online",
    "device_info": "E-CAN400-ASF-V0.1-210330001-NULL-V1.0.0-xx200422002"
  }
}
```

## 4.2 设备状态查询

按模式查询设备状态。上位机通过 `status_type` 指定查询模式：`UN` 查询设备总体状态，`CM` 查询流程状态，`EM` 查询设备状态反馈，`all` 查询全部状态。

| 命令 | 说明 |
| --- | --- |
| get_device_status | 按 UN/CM/EM/all 查询设备总体状态、流程状态或设备状态反馈。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status_type | string | 是 | 查询模式：UN/CM/EM/all（UN=设备总体状态；CM=流程状态；EM=设备状态反馈；all=全部状态）。 |

### 响应 data 字段

| 字段                  | 类型     | 必填                      | 说明                                                                                       |
| ------------------- | ------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| status_type         | string | 是                       | 本次返回的查询模式：UN/CM/EM/all（设备总体状态/流程状态/设备状态反馈/全部状态）。                                         |
| un                  | object | status_type=UN 或 all 时是 | 设备总体状态。                                                                                  |
| un.device_status    | string | 是                       | 设备总体状态：running/paused/stopped/aborted/error/ready/reset（运行/暂停/停止/中止/故障/就绪/复位）。 |
| un.device_mode      | string | 是                       | 设备模式：auto/maintenance（自动模式/维护模式）。 |
| cm                  | object | status_type=CM 或 all 时是 | 流程状态。                                                                                    |
| cm.flow_name        | string | 是                       | 流程名称；无流程时为 "NULL"。                                                                       |
| cm.flow_step        | string | 是                       | 当前流程步；无流程时为 "NULL"。                                                                      |
| cm.flow_status      | string | 是                       | 流程状态：READY/BUSY/DONE/ERROR（就绪/运行/完成/故障）。                                                 |
| em                  | object | status_type=EM 或 all 时是 | 设备状态反馈。                                                                                  |
| em.cylinder         | string | 是                       | 气缸状态：home/work/error（气缸原位/气缸动位/故障）。                                                      |
| em.gripper          | string | 是                       | 夹爪状态：open/closed/error（夹爪打开/夹爪关闭/故障）。                                                    |
| em.camera           | string | 是                       | 相机状态：online/offline/capturing（在线/离线/采图中）。                                                |
| em.robot            | string | 是                       | 机器人状态：enabled/running/paused/stopped/home/error（使能/运行/暂停/停止/原点/故障）。                      |
| em.rgb_light        | string | 是                       | 三色灯状态：off/red/green/blue/error（灭/R 亮/G 亮/B 亮/故障）。                                        |
| em.proximity_switch | string | 是                       | 接近开关状态：triggered/not_triggered/error（触发/未触发/故障）。                                         |
| em.radar            | string | 是                       | 雷达状态：triggered/not_triggered/error（触发/未触发/故障）。                                           |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "get_device_status",
  "request_id": "REQ202606040001",
  "params": {
    "status_type": "UN"
  }
}
```

### 响应示例（UN）

```json
{
  "msg_type": "response",
  "cmd": "get_device_status",
  "request_id": "REQ202606040001",
  "code": 0,
  "message": "OK",
  "data": {
    "status_type": "UN",
    "un": {
      "device_status": "ready",
      "device_mode": "auto"
    }
  }
}
```

### 响应示例（CM）

```json
{
  "msg_type": "response",
  "cmd": "get_device_status",
  "request_id": "REQ202606040002",
  "code": 0,
  "message": "OK",
  "data": {
    "status_type": "CM",
    "cm": {
      "flow_name": "move_plate",
      "flow_step": "抓取样品盘",
      "flow_status": "BUSY"
    }
  }
}
```

### 响应示例（EM）

```json
{
  "msg_type": "response",
  "cmd": "get_device_status",
  "request_id": "REQ202606040003",
  "code": 0,
  "message": "OK",
  "data": {
    "status_type": "EM",
    "em": {
      "cylinder": "home",
      "gripper": "open",
      "camera": "online",
      "robot": "enabled",
      "rgb_light": "green",
      "proximity_switch": "not_triggered",
      "radar": "not_triggered"
    }
  }
}
```

### 响应示例（all）

```json
{
  "msg_type": "response",
  "cmd": "get_device_status",
  "request_id": "REQ202606040004",
  "code": 0,
  "message": "OK",
  "data": {
    "status_type": "all",
    "un": {
      "device_status": "ready",
      "device_mode": "auto"
    },
    "cm": {
      "flow_name": "move_plate",
      "flow_step": "抓取样品盘",
      "flow_status": "BUSY"
    },
    "em": {
      "cylinder": "home",
      "gripper": "open",
      "camera": "online",
      "robot": "enabled",
      "rgb_light": "green",
      "proximity_switch": "not_triggered",
      "radar": "not_triggered"
    }
  }
}
```

## 4.3 设备模式

用于设置设备运行模式。设备模式用于约束设备后续可执行的流程和命令。

| 命令 | 说明 |
| --- | --- |
| set_device_mode | 设置设备运行模式。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| mode | string | 是 | 设备模式：auto/maintenance（自动模式/维护模式）。 |

### 响应 data 字段

| 字段            | 类型     | 必填  | 说明                          |
| ------------- | ------ | --- | --------------------------- |
| action_status | string | 是   | 动作状态：success/failed（成功/失败）。 |
| failed_reason | string | 是   | 失败原因；成功时为 "NULL"。           |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "set_device_mode",
  "request_id": "REQ202606040004",
  "params": {
    "mode": "auto"
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "set_device_mode",
  "request_id": "REQ202606040004",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

## 4.4 设备命令

用于下发整机级运行命令，包括启动、暂停、停止、中止和复位。中止命令应具备较高执行优先级，用于打断当前流程。

| 命令 | 说明 |
| --- | --- |
| device_command | 下发整机级启动、暂停、停止、中止、复位命令。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| command | string | 是 | 设备命令：start/pause/stop/abort/reset（启动/暂停/停止/中止/复位）。 |

### 响应 data 字段

| 字段            | 类型     | 必填  | 说明                          |
| ------------- | ------ | --- | --------------------------- |
| action_status | string | 是   | 动作状态：success/failed（成功/失败）。 |
| failed_reason | string | 是   | 失败原因；成功时为 "NULL"。           |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "device_command",
  "request_id": "REQ202606040005",
  "params": {
    "command": "start"
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "device_command",
  "request_id": "REQ202606040005",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

# 5. 流程协议

## 5.1 区域样品状态查询

检查中转区、测试平台样品区域、磁体上方测试区的样品是否为空。该指令只返回区域样品空满状态，不返回样品盘二维码、孔位二维码或孔位详情。

| 命令 | 说明 |
| --- | --- |
| get_area_sample_status | 查询指定区域类型下所有区域的样品是否为空。 |

### 区域编号说明

| 对象       | 字段        | 取值/说明                                                   |
| -------- | --------- | ------------------------------------------------------- |
| 区域类型     | area_type | `transfer`=中转区；`platform`=测试平台样品区域；`test_area`=磁体上方测试区。 |
| 中转区      | area_id   | 1-4。                                                    |
| 测试平台样品区域 | area_id   | 1-29。                                                   |
| 磁体上方测试区  | area_id   | 1-2。                                                    |

### 请求 params 字段

| 字段        | 类型     | 必填  | 说明                                                     |
| --------- | ------ | --- | ------------------------------------------------------ |
| area_type | string | 是   | 区域类型：transfer/platform/test_area（中转区/测试平台样品区域/磁体上方测试区） |

### 响应 data 字段

| 字段                       | 类型      | 必填  | 说明                                                           |
| ------------------------ | ------- | --- | ------------------------------------------------------------ |
| area_type                | string  | 是   | 本次查询的区域类型：transfer/platform/test_area（中转区/测试平台样品区域/磁体上方测试区）。 |
| timestamp                | string  | 是   | 本次识别或状态更新时间，位于 `areas` 外层。                                   |
| areas                    | array   | 是   | 区域样品状态列表。                                                    |
| areas.area_id            | int     | 是   | 区域编号。                                                        |
| areas.sample_empty       | boolean | 是   | 样品是否为空：true/false（空/有样品）。                                    |
| areas.recognition_status | string  | 是   | 区域识别状态：success/failed/camera_offline（成功/失败/相机离线）。            |
| areas.confidence         | number  | 是   | 识别置信度，0-100。                                                 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "get_area_sample_status",
  "request_id": "REQ202606040002",
  "params": {
    "area_type": "transfer"
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "get_area_sample_status",
  "request_id": "REQ202606040002",
  "code": 0,
  "message": "OK",
  "data": {
    "area_type": "transfer",
    "timestamp": "2026-06-04T10:00:00+08:00",
    "areas": [
      {
        "area_id": 1,
        "sample_empty": false,
        "recognition_status": "success",
        "confidence": 98.6
      },
      {
        "area_id": 2,
        "sample_empty": true,
        "recognition_status": "success",
        "confidence": 97.5
      },
      {
        "area_id": 3,
        "sample_empty": false,
        "recognition_status": "success",
        "confidence": 98.1
      },
      {
        "area_id": 4,
        "sample_empty": true,
        "recognition_status": "success",
        "confidence": 97.9
      }
    ]
  }
}
```

## 5.2 二维码识别

设备对指定区域拍照并识别二维码。`transfer` 和 `platform` 区域对应样品盘，一个样品盘包含 10 只样品，因此返回 10 个样品位的二维码识别结果，并额外返回样品盘二维码 `plate_qr_code`；`test_area` 区域不是样品盘，只返回 1 个样品二维码识别结果，不返回 `plate_qr_code`。

| 命令 | 说明 |
| --- | --- |
| scan_qrcode | 对指定区域拍照并识别二维码。 |

### 请求 params 字段

| 字段        | 类型     | 必填  | 说明                                                      |
| --------- | ------ | --- | ------------------------------------------------------- |
| area_type | string | 是   | 区域类型：transfer/platform/test_area（中转区/测试平台样品区域/磁体上方测试区）。 |
| area_id   | int    | 是   | 区域编号：transfer 为 1-4；platform 为 1-29；test_area 为 1-2。    |

### 响应 data 字段

| 字段                     | 类型          | 必填                   | 说明                                                                 |
| ---------------------- | ----------- | -------------------- | ------------------------------------------------------------------ |
| area_type              | string      | 是                    | 区域类型：transfer/platform/test_area（中转区/测试平台样品区域/磁体上方测试区）。            |
| area_id                | int         | 是                    | 区域编号。                                                              |
| plate_qr_code          | string | transfer/platform 时是 | 样品盘二维码；仅 transfer 和 platform 返回，读码失败或无样品盘时为 "NULL"；test_area 不返回该字段。 |
| image_id               | string      | 是                    | 图像编号。                                                              |
| timestamp              | string      | 是                    | 识别时间。                                                              |
| samples                | array       | 是                    | 样品二维码识别结果列表；transfer/platform 固定返回 10 条，test_area 固定返回 1 条。        |
| samples.position_id    | int/null      | 是                    | 二维码所在位置编号；transfer/platform 表示样品盘孔位号 1-10；test_area 固定为 1；无位置时为 "NULL"。 |
| samples.sample_qr_code | string | 是                    | 样品二维码内容，读码失败或无二维码时为 "NULL"。                                          |
| samples.decode_status  | string      | 是                    | 读码状态：success/no_code/failed/blocked/low_quality（成功/无码/失败/遮挡/质量不足）。 |
| samples.quality        | number      | 是                    | 识别质量，0-100。                                                        |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "scan_qrcode",
  "request_id": "REQ202606040003",
  "params": {
    "area_type": "platform",
    "area_id": 5
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "scan_qrcode",
  "request_id": "REQ202606040003",
  "code": 0,
  "message": "OK",
  "data": {
    "area_type": "platform",
    "area_id": 5,
    "plate_qr_code": "PLATE-QR-0001",
    "image_id": "IMG202606040003",
    "timestamp": "2026-06-04T10:00:00+08:00",
    "samples": [
      {
        "position_id": 1,
        "sample_qr_code": "QR123456",
        "decode_status": "success",
        "quality": 98
      },
      {
        "position_id": 2,
        "sample_qr_code": "NULL",
        "decode_status": "no_code",
        "quality": 97
      },
      {
        "position_id": 3,
        "sample_qr_code": "QR123458",
        "decode_status": "success",
        "quality": 96
      },
      {
        "position_id": 4,
        "sample_qr_code": "NULL",
        "decode_status": "no_code",
        "quality": 95
      },
      {
        "position_id": 5,
        "sample_qr_code": "QR123460",
        "decode_status": "success",
        "quality": 98
      },
      {
        "position_id": 6,
        "sample_qr_code": "NULL",
        "decode_status": "no_code",
        "quality": 96
      },
      {
        "position_id": 7,
        "sample_qr_code": "NULL",
        "decode_status": "no_code",
        "quality": 95
      },
      {
        "position_id": 8,
        "sample_qr_code": "QR123463",
        "decode_status": "success",
        "quality": 97
      },
      {
        "position_id": 9,
        "sample_qr_code": "NULL",
        "decode_status": "no_code",
        "quality": 96
      },
      {
        "position_id": 10,
        "sample_qr_code": "QR123465",
        "decode_status": "success",
        "quality": 98
      }
    ]
  }
}
```

## 5.3 样品盘搬运

将样品盘从源区域搬运到目的区域。该协议用于中转区、测试平台区域之间的样品盘搬运场景，设备根据源区域、目的区域和源样品盘二维码执行动作。

| 命令 | 说明 |
| --- | --- |
| move_plate | 根据源区域和目的区域搬运样品盘/样品台。 |

### 请求 params 字段

| 字段                   | 类型     | 必填  | 说明                                      |
| -------------------- | ------ | --- | --------------------------------------- |
| source               | object | 是   | 源区域信息。                                  |
| source.area_type     | string | 是   | 源区域类型：transfer/platform（中转区/测试平台样品区域）。  |
| source.area_id       | int    | 是   | 源区域编号：transfer 为 1-4；platform 为 1-29。   |
| source.plate_qr_code | string | 是   | 样品盘二维码；用于设备确认搬运对象。                      |
| target               | object | 是   | 目的区域信息。                                 |
| target.area_type     | string | 是   | 目的区域类型：transfer/platform（中转区/测试平台样品区域）。 |
| target.area_id       | int    | 是   | 目的区域编号：transfer 为 1-4；platform 为 1-29。  |

### 响应 data 字段

| 字段            | 类型     | 必填  | 说明                          |
| ------------- | ------ | --- | --------------------------- |
| action_status | string | 是   | 动作状态：success/failed（成功/失败）。 |
| failed_reason | string | 是   | 失败原因。                       |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "move_plate",
  "request_id": "REQ202606040004",
  "params": {
    "source": {
      "area_type": "transfer",
      "area_id": 1,
      "plate_qr_code": "PLATE-QR-0001"
    },
    "target": {
      "area_type": "platform",
      "area_id": 5
    }
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "move_plate",
  "request_id": "REQ202606040004",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

## 5.4 样品搬运

将单只样品从源区域搬运到目的区域。该协议用于中转区、测试平台样品区域、磁体上方测试区之间的单只样品搬运；进样为测试平台样品区域到磁体上方测试区，下料为磁体上方测试区到测试平台样品区域。

| 命令 | 说明 |
| --- | --- |
| move_sample | 根据源区域/孔位和目的区域/孔位搬运单只样品。 |

### 请求 params 字段

| 字段                    | 类型         | 必填  | 说明                                                                        |
| --------------------- | ---------- | --- | ------------------------------------------------------------------------- |
| source                | object     | 是   | 源区域信息。                                                                    |
| source.area_type      | string     | 是   | 源区域类型：transfer/platform/test_area（中转区/测试平台样品区域/磁体上方测试区）。                  |
| source.area_id        | int        | 是   | 源区域编号：transfer 为 1-4；platform 为 1-29；test_area 为 1-2。                     |
| source.plate_qr_code  | string     | 是   | 源样品盘二维码；source.area_type 为 test_area 时为 "NULL"。                           |
| source.hole_id        | int/null   | 是   | 源孔位 ID；source.area_type 为 transfer/platform 时为 1-10，test_area 时为 "NULL"。  |
| source.sample_qr_code | string     | 是   | 样品二维码；用于设备确认搬运样品。                                                         |
| target                | object     | 是   | 目的区域信息。                                                                   |
| target.area_type      | string     | 是   | 目的区域类型：transfer/platform/test_area（中转区/测试平台样品区域/磁体上方测试区）。                 |
| target.area_id        | int        | 是   | 目的区域编号：transfer 为 1-4；platform 为 1-29；test_area 为 1-2。                    |
| target.plate_qr_code  | string     | 是   | 目的样品盘二维码；target.area_type 为 test_area 时为 "NULL"。                          |
| target.hole_id        | int/null   | 是   | 目的孔位 ID；target.area_type 为 transfer/platform 时为 1-10，test_area 时为 "NULL"。 |

### 响应 data 字段

| 字段            | 类型     | 必填  | 说明                          |
| ------------- | ------ | --- | --------------------------- |
| action_status | string | 是   | 动作状态：success/failed（成功/失败）。 |
| failed_reason | string | 是   | 失败原因；成功时为 "NULL"。           |

### 请求示例

进样：

```json
{
  "msg_type": "command",
  "cmd": "move_sample",
  "request_id": "REQ202606040005",
  "params": {
    "source": {
      "area_type": "platform",
      "area_id": 5,
      "plate_qr_code": "PLATE-QR-0001",
      "hole_id": 3,
      "sample_qr_code": "QR123456"
    },
    "target": {
      "area_type": "test_area",
      "area_id": 1,
      "plate_qr_code": "NULL",
      "hole_id": "NULL"
    }
  }
}
```

下料：

```json
{
  "msg_type": "command",
  "cmd": "move_sample",
  "request_id": "REQ202606040006",
  "params": {
    "source": {
      "area_type": "test_area",
      "area_id": 1,
      "plate_qr_code": "NULL",
      "hole_id": "NULL",
      "sample_qr_code": "QR123456"
    },
    "target": {
      "area_type": "platform",
      "area_id": 5,
      "plate_qr_code": "PLATE-QR-0001",
      "hole_id": 3
    }
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "move_sample",
  "request_id": "REQ202606040005",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

# 6. 横移杆协议

| 位置 | D2 | D5 | D11 | C2 | C5 | C10 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 1 | 0 | 遮挡 | 不遮 | 遮挡 |
| 2 | 1 | 1 | 0 | 不遮 | 遮挡 | 遮挡 |
| 3 | 0 | 0 | 1 | 遮挡 | 遮挡 | 不遮 |

## 6.1 横移杆状态查询

读取横移杆当前位置、阀输出、传感器输入和储样筒样品状态。

| 命令 | 说明 |
| --- | --- |
| get_crossbar_status | 读取横移杆当前位置、阀输出、传感器输入和储样筒样品状态。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |

### 响应 data 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| current_position | int/null | 是 | 当前位置，1/2/3；无当前位置时为 "NULL"。 |
| moving | boolean | 是 | 是否运动中。 |
| valves | object | 是 | D2/D3/D5/D11 输出。 |
| sensors | object | 是 | C2/C3/C5/C10 输入。 |
| sample_present | boolean | 是 | C3 判断的储样筒是否有样品。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "get_crossbar_status",
  "request_id": "REQ202606030001",
  "params": {}
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "get_crossbar_status",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "current_position": 2,
    "moving": false,
    "valves": {
      "D2": 1,
      "D3": 0,
      "D5": 1,
      "D11": 0
    },
    "sensors": {
      "C2": 0,
      "C3": 1,
      "C5": 1,
      "C10": 1
    },
    "sample_present": true
  }
}
```

## 6.2 横移杆移动

控制横移杆移动到位置 1/2/3。

| 命令 | 说明 |
| --- | --- |
| move_crossbar | 控制横移杆移动到位置 1/2/3。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| position | int | 是 | 目标位置，1/2/3。 |

### 响应 data 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| accepted | boolean | 是 | 是否接收动作。 |
| action_id | string | 是 | 动作编号。 |
| action_status | string | 是 | 动作状态：accepted/running/done/failed/canceled（已接收/执行中/完成/失败/取消）。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "move_crossbar",
  "request_id": "REQ202606030001",
  "params": {
    "position": 2
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "move_crossbar",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "accepted": true,
    "action_id": "ACT202606030001",
    "action_status": "accepted",
    "reject_reason": "NULL"
  }
}
```

## 6.3 样品释放控制

控制 D3 针型气缸释放或保持样品。D3 上电样品掉落，断电顶塞保持样品。

| 命令 | 说明 |
| --- | --- |
| release_crossbar_sample | 控制 D3 针型气缸释放或保持样品。D3 上电样品掉落，断电顶塞保持样品。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| release | boolean | 是 | true/false（释放样品/保持样品）。 |

### 响应 data 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| D3 | int | 是 | D3 输出状态。 |
| sample_present | boolean | 是 | 释放后储样筒是否仍有样品。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "release_crossbar_sample",
  "request_id": "REQ202606030001",
  "params": {
    "release": true
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "release_crossbar_sample",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "D3": 1,
    "sample_present": false
  }
}
```

# 7. 三色灯控制协议

## 7.1 三色灯控制

控制测试平台 29 个样品区域中一个或多个区域的 RGB 三色灯颜色。`params.body[]` 为控制数组，数组中放 1 个对象表示控制 1 个区域，放多个对象表示同时控制多个区域。

| 命令 | 说明 |
| --- | --- |
| set_rgb_light | 控制测试平台一个或多个区域 RGB 三色灯颜色。 |

### 请求 params 字段

| 字段             | 类型    | 必填  | 说明                    |
| -------------- | ----- | --- | --------------------- |
| body           | array | 是   | 三色灯控制数组，记作 `body[]`。 |
| body[].area_id | int   | 是   | 测试平台样品区域编号，1-29。      |
| body[].r       | int   | 是   | 红色通道值，0-255。          |
| body[].g       | int   | 是   | 绿色通道值，0-255。          |
| body[].b       | int   | 是   | 蓝色通道值，0-255。          |

### 响应 data 字段

| 字段            | 类型     | 必填  | 说明                          |
| ------------- | ------ | --- | --------------------------- |
| action_status | string | 是   | 执行结果：success/failed（成功/失败）。 |
| failed_reason | string | 是   | 失败原因；成功时为 "NULL"。           |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "set_rgb_light",
  "request_id": "REQ202606030001",
  "params": {
    "body": [
      {
        "area_id": 1,
        "r": 255,
        "g": 0,
        "b": 0
      },
      {
        "area_id": 2,
        "r": 0,
        "g": 255,
        "b": 0
      }
    ]
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "set_rgb_light",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

# 8. 机械臂控制协议

## 8.1 机械臂信息查询

读取机械臂使能、运动、报警、默认速度、默认加速度和当前位置信息。

| 命令 | 说明 |
| --- | --- |
| get_robot_status | 读取机械臂使能、运动、报警、默认速度、默认加速度和当前位置信息。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |

### 响应 data 字段

| 字段            | 类型      | 必填  | 说明                                            |
| ------------- | ------- | --- | --------------------------------------------- |
| robot_state   | string  | 是   | 机械臂状态：idle/moving/homed/error（空闲/运动中/已回零/故障）。 |
| enabled       | boolean | 是   | 是否使能。                                         |
| default_speed | number  | 是   | 默认速度。                                         |
| default_acc   | number  | 是   | 默认加速度。                                        |
| axis_position | object  | 是   | 4 轴当前位置。                                      |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "get_robot_status",
  "request_id": "REQ202606030001",
  "params": {}
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "get_robot_status",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "robot_state": "idle",
    "enabled": true,
    "default_speed": 50,
    "default_acc": 100,
    "axis_position": {
      "axis1": 0.0,
      "axis2": 10.0,
      "axis3": 100.0,
      "axis4": 0.0
    }
  }
}
```

## 8.2 4 轴运动控制

控制机械臂指定轴进行绝对或相对运动。`params.body[]` 为轴运动控制数组，支持 1-4 个轴控制项；同一请求内的多个轴控制项同时下发、同时运动。

| 命令              | 说明                 |
| --------------- | ------------------ |
| robot_axis_move | 控制机械臂一个或多个轴同时运动。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| body | array | 是 | 轴运动控制数组，长度 1-4，记作 `body[]`；同一请求内 axis 不得重复。 |
| body[].axis | string | 是 | `axis1`、`axis2`、`axis3`、`axis4`（第 1 轴/第 2 轴/第 3 轴/第 4 轴）。 |
| body[].mode | string | 是 | `absolute` 或 `relative`（绝对运动/相对运动）。 |
| body[].target | number | 是 | 目标位置。 |
| body[].speed | number | 否 | 运动速度。 |
| body[].acc | number | 否 | 加速度。 |

### 响应 data 字段

| 字段            | 类型     | 必填  | 说明                          |
| ------------- | ------ | --- | --------------------------- |
| action_status | string | 是   | 动作状态：success/failed（成功/失败）。 |
| failed_reason | string | 是   | 失败原因；成功时为 "NULL"。           |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "robot_axis_move",
  "request_id": "REQ202606030001",
  "params": {
    "body": [
      {
        "axis": "axis1",
        "mode": "absolute",
        "target": 0.0,
        "speed": 50,
        "acc": 100
      },
      {
        "axis": "axis2",
        "mode": "absolute",
        "target": 10.0,
        "speed": 50,
        "acc": 100
      },
      {
        "axis": "axis3",
        "mode": "absolute",
        "target": 150.0,
        "speed": 50,
        "acc": 100
      },
      {
        "axis": "axis4",
        "mode": "absolute",
        "target": 0.0,
        "speed": 50,
        "acc": 100
      }
    ]
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "robot_axis_move",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

## 8.3 机械臂基础控制

控制机械臂使能、回零、暂停、继续、停止、复位。

| 命令 | 说明 |
| --- | --- |
| robot_control | 控制机械臂使能、回零、暂停、继续、停止、复位。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| action | string | 是 | `enable`、`disable`、`home`、`pause`、`resume`、`stop`、`reset`（使能/去使能/回零/暂停/继续/停止/复位）。 |

### 响应 data 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| action_status | string | 是 | 动作状态：success/failed（成功/失败）。 |
| failed_reason | string | 是 | 失败原因；成功时为 "NULL"。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "robot_control",
  "request_id": "REQ202606030001",
  "params": {
    "action": "home"
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "robot_control",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

# 9. 电爪控制协议

## 9.1 电爪信息查询

读取电爪信息、当前位置和当前速度。

| 命令 | 说明 |
| --- | --- |
| get_gripper_status | 读取电爪信息、当前位置和当前速度。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |

### 响应 data 字段

| 字段            | 类型      | 必填  | 说明                                      |
| ------------- | ------- | --- | --------------------------------------- |
| gripper_state | string  | 是   | open/closed/moving/error（打开/关闭/动作中/故障）。 |
| position      | number  | 是   | 当前开度或位置。                                |
| speed         | number  | 是   | 当前速度。                                   |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "get_gripper_status",
  "request_id": "REQ202606030001",
  "params": {}
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "get_gripper_status",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "gripper_state": "closed",
    "position": 25,
    "speed": 50
  }
}
```

## 9.2 电爪控制

控制电爪打开、关闭或移动到指定开度。

| 命令 | 说明 |
| --- | --- |
| gripper_control | 控制电爪打开、关闭或移动到指定开度。 |

### 请求 params 字段

| 字段       | 类型     | 必填  | 说明                                                              |
| -------- | ------ | --- | --------------------------------------------------------------- |
| action   | string | 是   | `open`、`close`、`move_to`（打开/关闭/移动到指定开度）。 |
| position | number | 否   | 目标开度或位置。                                                        |
| speed    | number | 否   | 动作速度。                                                           |

### 响应 data 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| action_status | string | 是 | 动作状态：success/failed（成功/失败）。 |
| failed_reason | string | 是 | 失败原因；成功时为 "NULL"。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "gripper_control",
  "request_id": "REQ202606030001",
  "params": {
    "action": "move_to",
    "position": 25,
    "speed": 50
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "gripper_control",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "action_status": "success",
    "failed_reason": "NULL"
  }
}
```

# 10. 整机参数协议

整机参数按模块分组，模块包括 `robot`（机械臂）、`gripper`（电爪）、`camera`（摄像头）、`crossbar`（横移杆）。

## 10.1 整机参数查询

查询整机各模块当前参数。`params` 为空对象 `{}` 时查询全部模块；需要指定模块时，按模块传 `{}`。

| 命令 | 说明 |
| --- | --- |
| get_machine_param | 按模块查询整机参数。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| robot | object | 否 | 机械臂参数查询项；传 `{}` 表示查询该模块。 |
| gripper | object | 否 | 电爪参数查询项；传 `{}` 表示查询该模块。 |
| camera | object | 否 | 摄像头参数查询项；传 `{}` 表示查询该模块。 |
| crossbar | object | 否 | 横移杆参数查询项；传 `{}` 表示查询该模块。 |

### 响应 data 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| robot | object | 是 | 机械臂参数。 |
| robot.speed | number | 是 | 默认速度。 |
| robot.acc | number | 是 | 默认加速度。 |
| gripper | object | 是 | 电爪参数。 |
| gripper.speed | number | 是 | 默认速度。 |
| gripper.rack_force | number | 是 | 样品架力度。 |
| gripper.tube_force | number | 是 | 试管力度。 |
| camera | object | 是 | 摄像头参数。 |
| camera.exposure | number | 是 | 曝光参数。 |
| camera.gain | number | 是 | 增益参数。 |
| crossbar | object | 是 | 横移杆参数。 |
| crossbar.speed | number | 是 | 默认速度。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "get_machine_param",
  "request_id": "REQ202606030001",
  "params": {}
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "get_machine_param",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "robot": {
      "speed": 50,
      "acc": 100
    },
    "gripper": {
      "speed": 50,
      "rack_force": 20,
      "tube_force": 30
    },
    "camera": {
      "exposure": 20,
      "gain": 1.5
    },
    "crossbar": {
      "speed": 50
    }
  }
}
```

## 10.2 整机参数设置

按模块设置整机参数。未包含的模块不修改；每个模块内未包含的字段不修改。

| 命令 | 说明 |
| --- | --- |
| set_machine_param | 按模块设置整机参数。 |

### 请求 params 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| robot | object | 否 | 机械臂参数。 |
| robot.speed | number | 否 | 默认速度。 |
| robot.acc | number | 否 | 默认加速度。 |
| robot.save | boolean | 否 | 是否保存为默认参数。 |
| gripper | object | 否 | 电爪参数。 |
| gripper.speed | number | 否 | 默认速度。 |
| gripper.rack_force | number | 否 | 样品架力度。 |
| gripper.tube_force | number | 否 | 试管力度。 |
| gripper.save | boolean | 否 | 是否保存为默认参数。 |
| camera | object | 否 | 摄像头参数。 |
| camera.exposure | number | 否 | 曝光参数。 |
| camera.gain | number | 否 | 增益参数。 |
| camera.save | boolean | 否 | 是否保存为默认参数。 |
| crossbar | object | 否 | 横移杆参数。 |
| crossbar.speed | number | 否 | 默认速度。 |
| crossbar.save | boolean | 否 | 是否保存为默认参数。 |

### 响应 data 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| robot | object | 否 | 机械臂参数设置结果；未设置该模块时可不返回。 |
| robot.action_status | string | 是 | 设置结果：success/failed（成功/失败）。 |
| robot.failed_reason | string | 是 | 失败原因；成功时为 "NULL"。 |
| gripper | object | 否 | 电爪参数设置结果；未设置该模块时可不返回。 |
| gripper.action_status | string | 是 | 设置结果：success/failed（成功/失败）。 |
| gripper.failed_reason | string | 是 | 失败原因；成功时为 "NULL"。 |
| camera | object | 否 | 摄像头参数设置结果；未设置该模块时可不返回。 |
| camera.action_status | string | 是 | 设置结果：success/failed（成功/失败）。 |
| camera.failed_reason | string | 是 | 失败原因；成功时为 "NULL"。 |
| crossbar | object | 否 | 横移杆参数设置结果；未设置该模块时可不返回。 |
| crossbar.action_status | string | 是 | 设置结果：success/failed（成功/失败）。 |
| crossbar.failed_reason | string | 是 | 失败原因；成功时为 "NULL"。 |

### 请求示例

```json
{
  "msg_type": "command",
  "cmd": "set_machine_param",
  "request_id": "REQ202606030001",
  "params": {
    "robot": {
      "speed": 50,
      "acc": 100,
      "save": true
    },
    "gripper": {
      "speed": 50,
      "rack_force": 20,
      "tube_force": 30,
      "save": true
    },
    "camera": {
      "exposure": 20,
      "gain": 1.5,
      "save": true
    },
    "crossbar": {
      "speed": 50,
      "save": true
    }
  }
}
```

### 响应示例

```json
{
  "msg_type": "response",
  "cmd": "set_machine_param",
  "request_id": "REQ202606030001",
  "code": 0,
  "message": "OK",
  "data": {
    "robot": {
      "action_status": "success",
      "failed_reason": "NULL"
    },
    "gripper": {
      "action_status": "success",
      "failed_reason": "NULL"
    },
    "camera": {
      "action_status": "success",
      "failed_reason": "NULL"
    },
    "crossbar": {
      "action_status": "success",
      "failed_reason": "NULL"
    }
  }
}
```

# 11. 错误码定义

所有响应报文中的 `code` 字段均取自本章错误码定义。`code=0` 表示成功或指令已被设备接收；`code` 非 0 表示设备拒绝执行、执行失败或发生异常。`message` 应填写对应中文说明，必要时补充现场信息；`data.failed_reason` 用于补充动作失败原因，成功时为 `"NULL"`。

## 11.1 错误码范围

| 范围        | 分类        | 说明                    |
| --------- | --------- | --------------------- |
| 0         | system    | 成功或已接收。               |
| 1001-1999 | protocol  | 报文格式、字段、命令和参数错误。      |
| 2001-2999 | device    | 整机状态、设备控制、安全保护和气源错误。 |
| 3001-3999 | vision    | 相机、拍照、区域识别和二维码识别错误。  |
| 4001-4999 | motion/area | 区域、样品盘、样品和搬运动作错误。    |
| 5001-5999 | crossbar  | 横移杆和样品释放错误。           |
| 6001-6999 | rgb_light | 三色灯控制错误。              |
| 7001-7999 | robot     | 机械臂控制和运动错误。           |
| 8001-8999 | gripper   | 电爪控制和动作错误。            |
| 9001-9499 | param     | 整机参数查询、设置和保存错误。       |
| 9501-9999 | system    | 执行超时和设备内部异常。           |

## 11.2 错误码表

| 错误码  | 错误来源      | 中文说明            | 建议处理                                  |
| ---- | --------- | --------------- | ------------------------------------- |
| 0    | system    | 成功或已接收          | 无。                                    |
| 1001 | protocol  | JSON 格式错误       | 检查报文是否为合法 JSON，并确认消息以换行符结束。           |
| 1002 | protocol  | `msg_type` 非法   | 固定传 `command`。                        |
| 1003 | protocol  | 不支持的 `cmd`      | 检查命令名称是否在命令清单中。                       |
| 1004 | protocol  | 缺少必填字段          | 检查通用字段和对应指令字段表。                       |
| 1005 | protocol  | 字段类型错误          | 检查字段类型是否与协议表一致。                       |
| 1006 | protocol  | 参数取值非法或超范围      | 检查枚举值、区域编号、孔位 ID、RGB 和速度等参数。          |
| 1007 | protocol  | `request_id` 重复 | 更换请求编号，避免同一连接内重复。                     |
| 1008 | protocol  | `params` 格式错误   | 检查 params 是否为 object；数组类参数应放入 `body[]`。 |
| 2001 | device    | 设备忙，无法接收新动作     | 等待当前动作完成，或查询设备运动状态后重试。                |
| 2002 | device    | 当前设备状态不允许执行     | 检查设备是否处于暂停、保护、故障或维护状态。                |
| 2003 | safety    | 急停触发            | 解除急停后执行恢复或复位。                         |
| 2004 | safety    | 安全门或安全区域触发      | 确认安全门和安全区域状态后恢复。                      |
| 2005 | pneumatic | 气压不足            | 检查气源和气压开关。                            |
| 2006 | device    | 设备自检失败          | 查看模块状态，排除异常后重新自检。                     |
| 2007 | device    | 设备回零失败          | 检查机械臂、横移杆和相关传感器状态后重试。                 |
| 2008 | device    | 设备复位失败          | 检查保护状态和模块报警后重试。                       |
| 2009 | device    | 保护状态未解除         | 解除保护原因后再执行恢复或动作指令。                    |
| 3001 | camera    | 相机离线            | 检查相机连接、供电和通信状态。                       |
| 3002 | camera    | 拍照失败            | 检查相机触发、光源和图像采集状态。                     |
| 3003 | vision    | 区域识别失败          | 重新拍照，检查区域遮挡和光照。                       |
| 3004 | barcode   | 二维码识别失败         | 重新拍照或人工确认二维码。                         |
| 3005 | barcode   | 二维码遮挡或质量不足      | 调整样品姿态、光源或清洁二维码。                      |
| 3006 | vision    | 样品盘二维码不匹配       | 核对上位机记录和视觉识别结果。                       |
| 3007 | vision    | 样品二维码不匹配        | 核对样品二维码与目标样品信息。                       |
| 4001 | area      | `area_type` 非法  | 使用 transfer、platform 或 test_area。     |
| 4002 | area      | `area_id` 不存在   | 检查区域编号范围。                             |
| 4003 | motion    | 源位无样品           | 检查源区域状态或重新识别。                         |
| 4004 | motion    | 目标位占用           | 检查目标区域状态。                             |
| 4005 | motion    | 样品盘不存在或未识别      | 重新执行二维码识别并确认样品盘二维码。                   |
| 4006 | motion    | 孔位 ID 非法        | 样品盘孔位 ID 使用 1-10；test_area 使用 "NULL"。 |
| 4007 | motion    | 搬运动作失败          | 检查机械臂、电爪、样品姿态和路径状态。                   |
| 4008 | motion    | 放置失败            | 检查目标位、电爪释放和样品姿态。                      |
| 5001 | crossbar  | 横移杆不到位          | 检查横移杆驱动和到位传感器。                        |
| 5002 | crossbar  | 横移杆传感器状态异常      | 检查 D2/D5/D11 和 C2/C5/C10 等 IO。        |
| 5003 | crossbar  | 样品释放失败          | 检查针型气缸、D3 输出和储样筒状态。                   |
| 6001 | rgb_light | 三色灯区域不存在        | 检查 area_id 是否为 1-29。                  |
| 6002 | rgb_light | RGB 参数非法        | r/g/b 使用 0-255。                       |
| 6003 | rgb_light | 三色灯输出失败         | 检查灯控模块和通信状态。                          |
| 7001 | robot     | 机械臂离线           | 检查机械臂供电和通信。                           |
| 7002 | robot     | 机械臂未使能          | 执行机械臂使能后重试。                           |
| 7003 | robot     | 机械臂未回零          | 执行回零。                                 |
| 7004 | robot     | 机械臂超软限位         | 检查目标位置和软限位配置。                         |
| 7005 | robot     | 机械臂报警           | 查看机械臂报警信息，排除后复位。                      |
| 7006 | robot     | 机械臂运动失败         | 检查轴参数、速度、加速度和运动路径。                    |
| 8001 | gripper   | 电爪离线            | 检查电爪供电和通信。                            |
| 8002 | gripper   | 电爪打开失败          | 检查电爪状态和开度限制。                          |
| 8003 | gripper   | 电爪关闭失败          | 检查电爪状态、样品姿态和夹持参数。                     |
| 8004 | gripper   | 电爪移动失败          | 检查目标开度和速度参数。                          |
| 8005 | gripper   | 夹取失败            | 检查电爪、样品姿态和夹持力度。                       |
| 9001 | param     | 不支持的参数模块或字段     | 检查整机参数模块和字段名称。                        |
| 9002 | param     | 参数超出允许范围        | 检查速度、加速度、力度、曝光和增益取值。                  |
| 9003 | param     | 参数保存失败          | 检查设备存储状态，必要时重新设置。                     |
| 9501 | system    | 执行超时            | 查询设备状态，确认动作是否卡住后重试。                   |
| 9502 | system    | 设备内部异常          | 查看设备日志或联系设备维护人员。                      |
