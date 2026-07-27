import net from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type { CommandRequest, ConnectionConfig, SocketMessage } from '../src/shared/types'
import { NmrTcpClient } from './tcp-client'

const servers: net.Server[] = []
const clients: NmrTcpClient[] = []
const sockets = new Set<net.Socket>()

afterEach(async () => {
  clients.forEach((client) => client.disconnect())
  sockets.forEach((socket) => socket.destroy())
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
  servers.length = 0
  clients.length = 0
  sockets.clear()
})

async function listen(handler: (socket: net.Socket) => void): Promise<number> {
  const server = net.createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    handler(socket)
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return (server.address() as net.AddressInfo).port
}

function request(id = 'REQ-TEST-1'): CommandRequest {
  return { msg_type: 'command', cmd: 'heartbeat', request_id: id, params: {} }
}

function connectionConfig(port: number, timeoutMs = 500): ConnectionConfig {
  return { host: '127.0.0.1', port, timeoutMs }
}

describe('NmrTcpClient', () => {
  it('使用 CRLF 发送并解析拆分到达的响应', async () => {
    let received = ''
    const port = await listen((socket) => socket.on('data', (chunk) => {
      received += chunk.toString()
      if (!received.endsWith('\r\n')) return
      socket.write('{"msg_type":"response","cmd":"heart')
      socket.write('beat","request_id":"REQ-TEST-1","code":0,"message":"OK","data":{"status":"online"}}\r\n')
    }))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))
    const result = await client.send(request())
    expect(received).toBe(`${JSON.stringify(request())}\r\n`)
    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data).toEqual({ status: 'online' })
  })

  it('可从一个数据块解析多个帧，并记录未知帧', async () => {
    const messages: SocketMessage[] = []
    const port = await listen((socket) => socket.on('data', () => socket.write(
      '{"msg_type":"response","cmd":"heartbeat","request_id":"OTHER","code":0,"message":"OK","data":{}}\n' +
      '{"msg_type":"response","cmd":"heartbeat","request_id":"REQ-TEST-1","code":0,"message":"OK","data":{}}\n',
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    client.on('message', (message) => messages.push(message))
    await client.connect(connectionConfig(port))
    const result = await client.send(request())
    expect(result.transaction.status).toBe('success')
    expect(messages.some((message) => message.status === 'protocol-error' && message.detail?.includes('不匹配'))).toBe(true)
  })

  it('非法 JSON 不结束等待，随后正确帧可完成请求', async () => {
    const messages: SocketMessage[] = []
    const port = await listen((socket) => socket.on('data', () => {
      socket.write('{invalid}\r\n')
      socket.write('{"msg_type":"response","cmd":"heartbeat","request_id":"REQ-TEST-1","code":0,"message":"OK","data":{}}\r\n')
    }))
    const client = new NmrTcpClient()
    clients.push(client)
    client.on('message', (message) => messages.push(message))
    await client.connect(connectionConfig(port))
    expect((await client.send(request())).transaction.status).toBe('success')
    expect(messages.some((message) => message.detail?.includes('合法 JSON'))).toBe(true)
  })

  it('超时返回结果未知，且等待期间拒绝并发请求', async () => {
    const port = await listen(() => undefined)
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port, 30))
    const pending = client.send(request())
    await expect(client.send(request('REQ-TEST-2'))).rejects.toThrow('上一条命令')
    const result = await pending
    expect(result.transaction.status).toBe('timeout')
    expect(result.transaction.error).toContain('结果未知')
  })

  it('拒绝超出范围的响应超时配置', async () => {
    const client = new NmrTcpClient()
    clients.push(client)
    await expect(client.connect({ host: '127.0.0.1', port: 5001, timeoutMs: 9 })).rejects.toThrow('响应超时')
    await expect(client.connect({ host: '127.0.0.1', port: 5001, timeoutMs: 3_600_001 })).rejects.toThrow('响应超时')
  })

  it('接受协议定义的 unreset 设备状态', async () => {
    const statusRequest: CommandRequest = {
      msg_type: 'command', cmd: 'get_device_status', request_id: 'REQ-STATUS-1', params: { status_type: 'UN' },
    }
    const port = await listen((socket) => socket.on('data', () => socket.write(
      '{"msg_type":"response","cmd":"get_device_status","request_id":"REQ-STATUS-1","code":0,"message":"OK","data":{"status_type":"UN","un":{"device_status":"unreset","device_mode":"auto"}}}\r\n',
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))
    const result = await client.send(statusRequest)
    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data.un).toEqual({ device_status: 'unreset', device_mode: 'auto' })
  })

  it('保留 CM 多流程数组、整数流程码和告警信息', async () => {
    const statusRequest: CommandRequest = {
      msg_type: 'command', cmd: 'get_device_status', request_id: 'REQ-STATUS-CM-1', params: { status_type: 'CM' },
    }
    const cm = [
      { flow_name: 'move_plate', flow_code: 1, flow_step: '抓取样品盘', flow_status: 'BUSY', alarm_info: 'NULL' },
      { flow_name: 'scan_qrcode', flow_code: 2, flow_step: '二维码识别', flow_status: 'ERROR', alarm_info: '二维码识别失败' },
    ]
    const port = await listen((socket) => socket.on('data', () => socket.write(
      `${JSON.stringify({
        msg_type: 'response',
        cmd: 'get_device_status',
        request_id: 'REQ-STATUS-CM-1',
        code: 0,
        message: 'OK',
        data: { status_type: 'CM', cm },
      })}\r\n`,
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))

    const result = await client.send(statusRequest)

    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data.cm).toEqual(cm)
  })

  it('横移杆移动保留统一动作响应', async () => {
    const crossbarRequest: CommandRequest = {
      msg_type: 'command', cmd: 'move_crossbar', request_id: 'REQ-CROSSBAR-1', params: { position: 2 },
    }
    const actionData = { action_status: 'success', failed_reason: 'NULL' }
    const port = await listen((socket) => socket.on('data', () => socket.write(
      `${JSON.stringify({
        msg_type: 'response',
        cmd: 'move_crossbar',
        request_id: 'REQ-CROSSBAR-1',
        code: 0,
        message: 'OK',
        data: actionData,
      })}\r\n`,
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))

    const result = await client.send(crossbarRequest)

    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data).toEqual(actionData)
  })

  it('顶针控制保留统一动作响应', async () => {
    const ejectorRequest: CommandRequest = {
      msg_type: 'command', cmd: 'release_crossbar_sample', request_id: 'REQ-EJECTOR-1', params: { release: true },
    }
    const actionData = { action_status: 'success', failed_reason: 'NULL' }
    const port = await listen((socket) => socket.on('data', () => socket.write(
      `${JSON.stringify({
        msg_type: 'response',
        cmd: 'release_crossbar_sample',
        request_id: 'REQ-EJECTOR-1',
        code: 0,
        message: 'OK',
        data: actionData,
      })}\r\n`,
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))

    const result = await client.send(ejectorRequest)

    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data).toEqual(actionData)
  })

  it('完整保留安全雷达触发和告警屏蔽状态', async () => {
    const radarRequest: CommandRequest = {
      msg_type: 'command', cmd: 'get_safety_radar_status', request_id: 'REQ-RADAR-STATUS-1', params: {},
    }
    const radarData = {
      near_triggered: false,
      far_triggered: true,
      near_alarm_masked: false,
      far_alarm_masked: true,
    }
    const port = await listen((socket) => socket.on('data', () => socket.write(
      `${JSON.stringify({
        msg_type: 'response',
        cmd: 'get_safety_radar_status',
        request_id: 'REQ-RADAR-STATUS-1',
        code: 0,
        message: 'OK',
        data: radarData,
      })}\r\n`,
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))

    const result = await client.send(radarRequest)

    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data).toEqual(radarData)
  })

  it('安全雷达屏蔽参数通过整机参数设置并保留统一动作响应', async () => {
    const radarRequest: CommandRequest = {
      msg_type: 'command',
      cmd: 'set_machine_param',
      request_id: 'REQ-RADAR-PARAM-1',
      params: { safety_radar: { near_alarm_masked: false, far_alarm_masked: true, save: false } },
    }
    const actionData = { safety_radar: { action_status: 'success', failed_reason: 'NULL' } }
    const port = await listen((socket) => socket.on('data', () => socket.write(
      `${JSON.stringify({
        msg_type: 'response',
        cmd: 'set_machine_param',
        request_id: 'REQ-RADAR-PARAM-1',
        code: 0,
        message: 'OK',
        data: actionData,
      })}\r\n`,
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))

    const result = await client.send(radarRequest)

    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data).toEqual(actionData)
  })

  it('完整保留机械臂故障状态和 X/Y/Z/RZ 坐标响应', async () => {
    const robotRequest: CommandRequest = {
      msg_type: 'command', cmd: 'get_robot_status', request_id: 'REQ-ROBOT-STATUS-1', params: {},
    }
    const coordinatePosition = { X: 0, Y: 10, Z: 100, RZ: 0 }
    const port = await listen((socket) => socket.on('data', () => socket.write(
      `${JSON.stringify({
        msg_type: 'response',
        cmd: 'get_robot_status',
        request_id: 'REQ-ROBOT-STATUS-1',
        code: 0,
        message: 'OK',
        data: { robot_state: 'idle', enabled: true, fault_status: 'NULL', coordinate_position: coordinatePosition },
      })}\r\n`,
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))

    const result = await client.send(robotRequest)

    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data).toEqual({
      robot_state: 'idle',
      enabled: true,
      fault_status: 'NULL',
      coordinate_position: coordinatePosition,
    })
  })

  it('完整保留电爪运行、动作、故障、位置和力矩状态', async () => {
    const gripperRequest: CommandRequest = {
      msg_type: 'command', cmd: 'get_gripper_status', request_id: 'REQ-GRIPPER-STATUS-1', params: {},
    }
    const gripperData = {
      run_status: 'idle',
      action_status: 'closed_tube',
      fault_status: 'NULL',
      position: 25,
      torque: 12.5,
    }
    const port = await listen((socket) => socket.on('data', () => socket.write(
      `${JSON.stringify({
        msg_type: 'response',
        cmd: 'get_gripper_status',
        request_id: 'REQ-GRIPPER-STATUS-1',
        code: 0,
        message: 'OK',
        data: gripperData,
      })}\r\n`,
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))

    const result = await client.send(gripperRequest)

    expect(result.transaction.status).toBe('success')
    expect(result.transaction.response?.data).toEqual(gripperData)
  })

  it('设备错误码保留响应并标记 device-error', async () => {
    const port = await listen((socket) => socket.on('data', () => socket.write(
      '{"msg_type":"response","cmd":"heartbeat","request_id":"REQ-TEST-1","code":2001,"message":"设备忙","data":{}}\r\n',
    )))
    const client = new NmrTcpClient()
    clients.push(client)
    await client.connect(connectionConfig(port))
    const result = await client.send(request())
    expect(result.transaction.status).toBe('device-error')
    expect(result.transaction.response?.code).toBe(2001)
  })
})
