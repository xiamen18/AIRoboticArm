import { useEffect, useState } from 'react'
import { CommandNav } from './components/CommandNav'
import { CommandWorkspace } from './components/CommandWorkspace'
import { ConnectionBar } from './components/ConnectionBar'
import { SessionLog } from './components/SessionLog'
import { DEFAULT_RESPONSE_TIMEOUT_MS } from './shared/types'
import type { CommandRequest, ConnectionState, SocketMessage, Transaction, TransactionStatus } from './shared/types'

export function App() {
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('5001')
  const [timeoutSeconds, setTimeoutSeconds] = useState(String(DEFAULT_RESPONSE_TIMEOUT_MS / 1_000))
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [selectedCommand, setSelectedCommand] = useState('heartbeat')
  const [messages, setMessages] = useState<SocketMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [pulse, setPulse] = useState<TransactionStatus | 'idle'>('idle')

  useEffect(() => {
    void window.nmrApi.getConnectionState().then(setConnectionState)
    const removeState = window.nmrApi.onConnectionStateChanged((state) => {
      setConnectionState(state)
      if (state === 'disconnected' || state === 'error') setPulse('transport-error')
    })
    const removeMessage = window.nmrApi.onSocketMessage((message) => {
      setMessages((current) => [...current, message])
      if (message.status) setPulse(message.status)
      else if (message.direction === 'tx') setPulse('pending')
    })
    return () => { removeState(); removeMessage() }
  }, [])

  const connect = async () => {
    try {
      await window.nmrApi.connect({
        host: host.trim(),
        port: Number(port),
        timeoutMs: Math.round(Number(timeoutSeconds) * 1_000),
      })
      setPulse('idle')
    } catch (error) {
      setPulse('transport-error')
      setMessages((current) => [...current, localSystemMessage(error instanceof Error ? error.message : '连接失败', 'transport-error')])
    }
  }

  const disconnect = async () => { await window.nmrApi.disconnect() }
  const send = async (request: CommandRequest) => {
    setBusy(true)
    setTransaction(null)
    setPulse('pending')
    try {
      const result = await window.nmrApi.sendCommand(request)
      setTransaction(result.transaction)
      setPulse(result.transaction.status)
    } catch (error) {
      setMessages((current) => [...current, localSystemMessage(error instanceof Error ? error.message : '命令发送失败', 'transport-error')])
      setPulse('transport-error')
    } finally {
      setBusy(false)
    }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#command-workspace">跳到命令工作区</a>
    <ConnectionBar host={host} port={port} timeoutSeconds={timeoutSeconds} state={connectionState} pulse={pulse} onHostChange={setHost} onPortChange={setPort} onTimeoutChange={setTimeoutSeconds} onConnect={connect} onDisconnect={disconnect} />
    <div className="workbench-grid">
      <CommandNav selected={selectedCommand} onSelect={(cmd) => { setSelectedCommand(cmd); setTransaction(null) }} />
      <CommandWorkspace cmd={selectedCommand} connected={connectionState === 'connected'} busy={busy} transaction={transaction} onSend={send} />
      <SessionLog messages={messages} onClear={() => setMessages([])} />
    </div>
  </div>
}

function localSystemMessage(detail: string, status: TransactionStatus): SocketMessage {
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), direction: 'system', raw: '', detail, status }
}
