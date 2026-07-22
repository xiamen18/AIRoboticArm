import { EventEmitter } from 'node:events'
import net from 'node:net'
import { randomUUID } from 'node:crypto'
import type {
  CommandRequest,
  CommandResponse,
  ConnectionConfig,
  ConnectionState,
  SendResult,
  SocketMessage,
  Transaction,
  TransactionStatus,
} from '../src/shared/types'

interface PendingRequest {
  request: CommandRequest
  startedAt: number
  transactionId: string
  timer: NodeJS.Timeout
  resolve: (result: SendResult) => void
}

export interface TcpClientOptions {
  timeoutMs?: number
  socketFactory?: () => net.Socket
  now?: () => number
}

export class NmrTcpClient extends EventEmitter {
  private socket: net.Socket | null = null
  private state: ConnectionState = 'disconnected'
  private receiveBuffer = ''
  private pending: PendingRequest | null = null
  private readonly timeoutMs: number
  private readonly socketFactory: () => net.Socket
  private readonly now: () => number

  constructor(options: TcpClientOptions = {}) {
    super()
    this.timeoutMs = options.timeoutMs ?? 5_000
    this.socketFactory = options.socketFactory ?? (() => new net.Socket())
    this.now = options.now ?? Date.now
  }

  get connectionState(): ConnectionState {
    return this.state
  }

  async connect(config: ConnectionConfig): Promise<void> {
    if (this.state === 'connecting') throw new Error('正在连接设备')
    if (this.state === 'connected') throw new Error('设备已经连接')
    this.validateConfig(config)
    this.cleanupSocket()
    this.setState('connecting')

    const socket = this.socketFactory()
    this.socket = socket
    socket.setEncoding('utf8')
    socket.setNoDelay(true)
    socket.setKeepAlive(true, 10_000)
    socket.on('data', (chunk: string) => this.handleData(chunk))
    socket.on('error', (error) => this.handleSocketError(error))
    socket.on('close', () => this.handleClose())

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        socket.off('error', onInitialError)
        this.setState('connected')
        this.emitSystem(`已连接 ${config.host}:${config.port}`)
        resolve()
      }
      const onInitialError = (error: Error) => {
        socket.off('connect', onConnect)
        reject(error)
      }
      socket.once('connect', onConnect)
      socket.once('error', onInitialError)
      socket.connect(config.port, config.host)
    }).catch((error: unknown) => {
      this.setState('error')
      throw error
    })
  }

  disconnect(): void {
    if (!this.socket) {
      this.setState('disconnected')
      return
    }
    this.emitSystem('主动断开设备连接')
    this.failPending('transport-error', '连接已由用户断开')
    this.socket.destroy()
    this.socket = null
    this.receiveBuffer = ''
    this.setState('disconnected')
  }

  send(request: CommandRequest): Promise<SendResult> {
    if (this.state !== 'connected' || !this.socket) {
      return Promise.reject(new Error('设备未连接'))
    }
    if (this.pending) {
      return Promise.reject(new Error('上一条命令仍在等待响应'))
    }
    this.validateRequest(request)

    const startedAt = this.now()
    const transactionId = randomUUID()
    const raw = JSON.stringify(request)
    this.emitMessage({
      direction: 'tx',
      raw,
      cmd: request.cmd,
      requestId: request.request_id,
      status: 'pending',
    })

    return new Promise<SendResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.pending
        if (!pending || pending.transactionId !== transactionId) return
        this.pending = null
        const transaction = this.makeTransaction(pending, 'timeout', undefined, '等待响应超时，设备执行结果未知')
        this.emitMessage({
          direction: 'system',
          raw: '',
          cmd: request.cmd,
          requestId: request.request_id,
          status: 'timeout',
          durationMs: transaction.durationMs,
          detail: transaction.error,
        })
        resolve({ transaction })
      }, this.timeoutMs)

      this.pending = { request, startedAt, transactionId, timer, resolve }
      this.socket?.write(`${raw}\r\n`, 'utf8', (error) => {
        if (!error) return
        this.failPending('transport-error', error.message)
        reject(error)
      })
    })
  }

  private handleData(chunk: string): void {
    this.receiveBuffer += chunk
    let newlineIndex = this.receiveBuffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const frame = this.receiveBuffer.slice(0, newlineIndex).replace(/\r$/, '')
      this.receiveBuffer = this.receiveBuffer.slice(newlineIndex + 1)
      if (frame.trim()) this.handleFrame(frame)
      newlineIndex = this.receiveBuffer.indexOf('\n')
    }
  }

  private handleFrame(raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.emitMessage({ direction: 'rx', raw, status: 'protocol-error', detail: '收到的报文不是合法 JSON' })
      return
    }

    if (!this.isResponse(parsed)) {
      this.emitMessage({ direction: 'rx', raw, status: 'protocol-error', detail: '报文不符合响应通用格式' })
      return
    }

    const pending = this.pending
    if (!pending) {
      this.emitMessage({
        direction: 'rx', raw, cmd: parsed.cmd, requestId: parsed.request_id,
        status: 'protocol-error', detail: '收到未知响应，当前没有等待中的请求',
      })
      return
    }
    if (parsed.request_id !== pending.request.request_id || parsed.cmd !== pending.request.cmd) {
      this.emitMessage({
        direction: 'rx', raw, cmd: parsed.cmd, requestId: parsed.request_id,
        status: 'protocol-error', detail: '响应的 cmd 或 request_id 与当前请求不匹配',
      })
      return
    }

    clearTimeout(pending.timer)
    this.pending = null
    const status: TransactionStatus = parsed.code === 0 ? 'success' : 'device-error'
    const transaction = this.makeTransaction(pending, status, parsed)
    this.emitMessage({
      direction: 'rx', raw, cmd: parsed.cmd, requestId: parsed.request_id,
      status, durationMs: transaction.durationMs,
      detail: parsed.code === 0 ? parsed.message : `设备错误 ${parsed.code}: ${parsed.message}`,
    })
    pending.resolve({ transaction })
  }

  private handleSocketError(error: Error): void {
    this.emitSystem(`TCP 错误：${error.message}`, 'transport-error')
    this.failPending('transport-error', error.message)
    this.setState('error')
  }

  private handleClose(): void {
    this.failPending('transport-error', '设备连接已关闭')
    this.socket = null
    this.receiveBuffer = ''
    if (this.state !== 'disconnected') {
      this.emitSystem('设备连接已关闭', 'transport-error')
      this.setState('disconnected')
    }
  }

  private failPending(status: TransactionStatus, error: string): void {
    const pending = this.pending
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending = null
    const transaction = this.makeTransaction(pending, status, undefined, error)
    pending.resolve({ transaction })
  }

  private makeTransaction(
    pending: PendingRequest,
    status: TransactionStatus,
    response?: CommandResponse,
    error?: string,
  ): Transaction {
    return {
      id: pending.transactionId,
      request: pending.request,
      response,
      startedAt: new Date(pending.startedAt).toISOString(),
      durationMs: this.now() - pending.startedAt,
      status,
      error,
    }
  }

  private isResponse(value: unknown): value is CommandResponse {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const response = value as Record<string, unknown>
    return response.msg_type === 'response'
      && typeof response.cmd === 'string'
      && typeof response.request_id === 'string'
      && typeof response.code === 'number'
      && typeof response.message === 'string'
      && !!response.data
      && typeof response.data === 'object'
      && !Array.isArray(response.data)
  }

  private validateConfig(config: ConnectionConfig): void {
    if (!config.host.trim()) throw new Error('设备 IP/主机名不能为空')
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
      throw new Error('端口必须是 1–65535 的整数')
    }
  }

  private validateRequest(request: CommandRequest): void {
    if (request.msg_type !== 'command') throw new Error('msg_type 必须为 command')
    if (!request.cmd.trim()) throw new Error('cmd 不能为空')
    if (!request.request_id.trim()) throw new Error('request_id 不能为空')
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      throw new Error('params 必须是对象')
    }
  }

  private cleanupSocket(): void {
    this.socket?.destroy()
    this.socket = null
    this.receiveBuffer = ''
    this.failPending('transport-error', '连接已重置')
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.emit('state', state)
  }

  private emitSystem(detail: string, status?: TransactionStatus): void {
    this.emitMessage({ direction: 'system', raw: '', detail, status })
  }

  private emitMessage(message: Omit<SocketMessage, 'id' | 'timestamp'>): void {
    this.emit('message', {
      id: randomUUID(),
      timestamp: new Date(this.now()).toISOString(),
      ...message,
    } satisfies SocketMessage)
  }
}
