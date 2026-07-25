import { Activity, Cable, CableIcon, LoaderCircle, Radio } from 'lucide-react'
import type { ConnectionState, TransactionStatus } from '../shared/types'

interface ConnectionBarProps {
  host: string
  port: string
  timeoutSeconds: string
  state: ConnectionState
  pulse: TransactionStatus | 'idle'
  onHostChange(value: string): void
  onPortChange(value: string): void
  onTimeoutChange(value: string): void
  onConnect(): void
  onDisconnect(): void
}

const STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: '未连接', connecting: '连接中', connected: '已连接', error: '连接异常',
}

export function ConnectionBar(props: ConnectionBarProps) {
  const { host, port, timeoutSeconds, state, pulse, onHostChange, onPortChange, onTimeoutChange, onConnect, onDisconnect } = props
  const connected = state === 'connected'
  return (
    <header className="connection-shell">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><Radio size={19} /></div>
        <div>
          <p className="eyebrow">NMR AUTO-SAMPLER / TCP JSON V0.1</p>
          <h1>通信调试台</h1>
        </div>
      </div>

      <div className="connection-controls" aria-label="设备连接">
        <label>
          <span>设备地址</span>
          <input name="device-host" autoComplete="off" spellCheck={false} value={host} disabled={state === 'connecting' || connected} onChange={(event) => onHostChange(event.target.value)} placeholder="例如 192.168.1.10…" />
        </label>
        <label className="port-field">
          <span>端口</span>
          <input name="device-port" autoComplete="off" inputMode="numeric" type="number" min={1} max={65535} value={port} disabled={state === 'connecting' || connected} onChange={(event) => onPortChange(event.target.value)} />
        </label>
        <label className="timeout-field">
          <span>响应超时 (s)</span>
          <input name="response-timeout" autoComplete="off" inputMode="decimal" type="number" min={0.01} max={3600} step={0.1} value={timeoutSeconds} disabled={state === 'connecting' || connected} onChange={(event) => onTimeoutChange(event.target.value)} />
        </label>
        {connected ? (
          <button type="button" className="button disconnect-button" onClick={onDisconnect}><CableIcon size={16} />断开</button>
        ) : (
          <button type="button" className="button connect-button" disabled={state === 'connecting'} onClick={onConnect}>
            {state === 'connecting' ? <LoaderCircle className="spin" size={16} /> : <Cable size={16} />}连接设备
          </button>
        )}
      </div>

      <div className={`state-badge state-${state}`} role="status">
        <span className="state-dot" />
        <div><small>TCP 链路</small><strong>{STATE_LABELS[state]}</strong></div>
      </div>

      <div className={`pulse-track pulse-${pulse}`} aria-label={`通信状态：${pulse}`}>
        <div className="pulse-baseline" />
        <div className="pulse-wave">
          <span /><span /><span /><span /><span />
        </div>
        <div className="pulse-caption"><Activity size={13} /> BUS PULSE <b>{pulse.toUpperCase()}</b></div>
      </div>
    </header>
  )
}
