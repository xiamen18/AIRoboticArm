import { Check, Clipboard, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import type { SocketMessage } from '../shared/types'

type LogFilter = 'all' | 'tx' | 'rx' | 'error'

export function SessionLog({ messages, onClear }: { messages: SocketMessage[]; onClear(): void }) {
  const [filter, setFilter] = useState<LogFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search.toLowerCase())
  const visible = useMemo(() => messages.filter((message) => {
    if (filter === 'error' && !['device-error', 'timeout', 'protocol-error', 'transport-error'].includes(message.status ?? '')) return false
    if (filter !== 'all' && filter !== 'error' && message.direction !== filter) return false
    return !deferredSearch || `${message.cmd} ${message.requestId} ${message.raw} ${message.detail}`.toLowerCase().includes(deferredSearch)
  }), [messages, filter, deferredSearch])

  const copy = async (message: SocketMessage) => {
    await navigator.clipboard.writeText(message.raw || message.detail || '')
    setCopied(message.id)
    window.setTimeout(() => setCopied(null), 1200)
  }

  return <aside className="session-log panel">
    <div className="panel-heading log-heading"><div><span className="section-index">03</span><h2>会话总线</h2></div><button type="button" className="icon-button" onClick={onClear} disabled={!messages.length} aria-label="清空日志"><Trash2 size={14} /></button></div>
    <div className="log-tools">
      <label><Search size={14} /><input name="log-search" autoComplete="off" spellCheck={false} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 cmd / ID / 内容…" /></label>
      <div className="filter-row">{(['all', 'tx', 'rx', 'error'] as const).map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? '全部' : item.toUpperCase()}</button>)}</div>
    </div>
    <div className="log-list" aria-live="polite">
      {visible.length ? visible.map((message) => {
        const isExpanded = expanded === message.id
        return <article className={`log-item log-${message.direction} log-status-${message.status ?? 'neutral'}`} key={message.id}>
          <button type="button" className="log-summary" onClick={() => setExpanded(isExpanded ? null : message.id)}>
            <span className="log-time">{new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}</span>
            <span className="direction-chip">{message.direction.toUpperCase()}</span>
            <span className="log-command"><strong>{message.cmd ?? 'SYSTEM'}</strong><code>{message.requestId ?? message.detail}</code></span>
            <span className="log-duration">{message.durationMs !== undefined ? `${message.durationMs} ms` : ''}</span>
          </button>
          {isExpanded ? <div className="log-detail"><button onClick={() => copy(message)}>{copied === message.id ? <Check size={13} /> : <Clipboard size={13} />}{copied === message.id ? '已复制' : '复制'}</button>{message.detail ? <p>{message.detail}</p> : null}{message.raw ? <pre>{formatRaw(message.raw)}</pre> : null}</div> : null}
        </article>
      }) : <div className="empty-log"><span>NO BUS TRAFFIC</span><p>{messages.length ? '没有符合筛选条件的报文。' : '连接设备并发送第一条命令。'}</p></div>}
    </div>
    <footer className="log-footer"><span>SESSION ONLY</span><b>{visible.length}/{messages.length}</b></footer>
  </aside>
}

function formatRaw(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}
