import { AlertTriangle, CheckCircle2, Clock3, Copy, Inbox } from 'lucide-react'
import { useState } from 'react'
import { getProtocolError } from '../protocol/errors'
import type { Transaction } from '../shared/types'

export function ResponsePanel({ transaction }: { transaction: Transaction | null }) {
  const [copied, setCopied] = useState(false)
  if (!transaction) return <section className="response-panel empty-response"><Inbox size={22} /><div><h3>等待设备响应</h3><p>发送命令后，这里显示结构化结果与原始数据。</p></div></section>
  const response = transaction.response
  const errorInfo = response && response.code !== 0 ? getProtocolError(response.code) : undefined
  const successful = transaction.status === 'success'
  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(response ?? transaction, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }
  return <section className={`response-panel response-${transaction.status}`}>
    <div className="response-title">
      {successful ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
      <div><h3>{successful ? '设备已响应' : transaction.status === 'timeout' ? '响应超时 · 结果未知' : '命令未成功'}</h3><p><Clock3 size={12} />{transaction.durationMs ?? 0} ms · {transaction.request.request_id}</p></div>
      <button className="icon-button response-copy" onClick={copy} aria-label="复制响应"><Copy size={14} />{copied ? '已复制' : ''}</button>
    </div>
    {response ? <div className="response-body">
      <div className="response-summary"><span>CODE</span><strong>{response.code}</strong><span>MESSAGE</span><strong>{response.message}</strong></div>
      {errorInfo ? <div className="error-guidance"><b>{errorInfo.source} / {errorInfo.message}</b><span>{errorInfo.suggestion}</span></div> : null}
      <pre>{JSON.stringify(response.data, null, 2)}</pre>
    </div> : <div className="response-body"><p className="transport-error-text">{transaction.error}</p></div>}
  </section>
}
