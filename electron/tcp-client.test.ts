import net from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type { CommandRequest, SocketMessage } from '../src/shared/types'
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

describe('NmrTcpClient', () => {
  it('使用 CRLF 发送并解析拆分到达的响应', async () => {
    let received = ''
    const port = await listen((socket) => socket.on('data', (chunk) => {
      received += chunk.toString()
      if (!received.endsWith('\r\n')) return
      socket.write('{"msg_type":"response","cmd":"heart')
      socket.write('beat","request_id":"REQ-TEST-1","code":0,"message":"OK","data":{"status":"online"}}\r\n')
    }))
    const client = new NmrTcpClient({ timeoutMs: 500 })
    clients.push(client)
    await client.connect({ host: '127.0.0.1', port })
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
    const client = new NmrTcpClient({ timeoutMs: 500 })
    clients.push(client)
    client.on('message', (message) => messages.push(message))
    await client.connect({ host: '127.0.0.1', port })
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
    const client = new NmrTcpClient({ timeoutMs: 500 })
    clients.push(client)
    client.on('message', (message) => messages.push(message))
    await client.connect({ host: '127.0.0.1', port })
    expect((await client.send(request())).transaction.status).toBe('success')
    expect(messages.some((message) => message.detail?.includes('合法 JSON'))).toBe(true)
  })

  it('超时返回结果未知，且等待期间拒绝并发请求', async () => {
    const port = await listen(() => undefined)
    const client = new NmrTcpClient({ timeoutMs: 30 })
    clients.push(client)
    await client.connect({ host: '127.0.0.1', port })
    const pending = client.send(request())
    await expect(client.send(request('REQ-TEST-2'))).rejects.toThrow('上一条命令')
    const result = await pending
    expect(result.transaction.status).toBe('timeout')
    expect(result.transaction.error).toContain('结果未知')
  })

  it('设备错误码保留响应并标记 device-error', async () => {
    const port = await listen((socket) => socket.on('data', () => socket.write(
      '{"msg_type":"response","cmd":"heartbeat","request_id":"REQ-TEST-1","code":2001,"message":"设备忙","data":{}}\r\n',
    )))
    const client = new NmrTcpClient({ timeoutMs: 500 })
    clients.push(client)
    await client.connect({ host: '127.0.0.1', port })
    const result = await client.send(request())
    expect(result.transaction.status).toBe('device-error')
    expect(result.transaction.response?.code).toBe(2001)
  })
})
