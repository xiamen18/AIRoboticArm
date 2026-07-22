export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ConnectionConfig {
  host: string
  port: number
}

export interface CommandRequest {
  msg_type: 'command'
  cmd: string
  request_id: string
  params: Record<string, unknown>
}

export interface CommandResponse {
  msg_type: 'response'
  cmd: string
  request_id: string
  code: number
  message: string
  data: Record<string, unknown>
}

export type TransactionStatus =
  | 'pending'
  | 'success'
  | 'device-error'
  | 'timeout'
  | 'protocol-error'
  | 'transport-error'

export interface Transaction {
  id: string
  request: CommandRequest
  response?: CommandResponse
  startedAt: string
  durationMs?: number
  status: TransactionStatus
  error?: string
}

export interface SocketMessage {
  id: string
  timestamp: string
  direction: 'tx' | 'rx' | 'system'
  raw: string
  cmd?: string
  requestId?: string
  status?: TransactionStatus
  durationMs?: number
  detail?: string
}

export interface SendResult {
  transaction: Transaction
}

export interface NmrApi {
  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  sendCommand(request: CommandRequest): Promise<SendResult>
  getConnectionState(): Promise<ConnectionState>
  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void
  onSocketMessage(callback: (message: SocketMessage) => void): () => void
}
