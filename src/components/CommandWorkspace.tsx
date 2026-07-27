import { zodResolver } from '@hookform/resolvers/zod'
import { Braces, CodeXml, RotateCcw, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import type { CommandRequest, Transaction } from '../shared/types'
import { buildRequest, COMMAND_MAP, createRequestId, parseRawRequest, syncSampleNulls } from '../protocol/commands'
import { CommandFields } from './CommandFields'
import type { FormValues } from './FieldParts'
import { ResponsePanel } from './ResponsePanel'

const SAMPLE_MOVE_COMMANDS = new Set(['move_sample', 'move_sample_in_out'])

interface Props {
  cmd: string
  connected: boolean
  busy: boolean
  transaction: Transaction | null
  onSend(request: CommandRequest): Promise<void>
}

export function CommandWorkspace({ cmd, connected, busy, transaction, onSend }: Props) {
  const definition = COMMAND_MAP.get(cmd)!
  const [mode, setMode] = useState<'form' | 'raw'>('form')
  const [raw, setRaw] = useState('')
  const [rawError, setRawError] = useState('')
  const resolver = useMemo(
    () => zodResolver(definition.schema as never) as Resolver<FormValues>,
    [definition.schema],
  )
  const form = useForm<FormValues>({ resolver, defaultValues: structuredClone(definition.defaults), mode: 'onSubmit' })

  useEffect(() => {
    form.reset(structuredClone(definition.defaults))
    setMode('form')
    setRaw(JSON.stringify(buildRequest(definition.cmd, definition.defaults, createRequestId()), null, 2))
    setRawError('')
  }, [definition, form])

  const switchMode = (next: 'form' | 'raw') => {
    if (next === 'raw' && mode === 'form') {
      const formParams = SAMPLE_MOVE_COMMANDS.has(cmd) ? syncSampleNulls(form.getValues()) : form.getValues()
      const parsed = definition.schema.safeParse(formParams)
      const params = parsed.success ? parsed.data : formParams
      setRaw(JSON.stringify(buildRequest(cmd, params, createRequestId()), null, 2))
    }
    setRawError('')
    setMode(next)
  }

  const submitForm = form.handleSubmit(async (values) => {
    const normalized = SAMPLE_MOVE_COMMANDS.has(cmd) ? syncSampleNulls(values) : values
    await onSend(buildRequest(cmd, normalized))
  })

  const submitRaw = async () => {
    try {
      const request = parseRawRequest(raw)
      setRawError('')
      await onSend(request)
    } catch (error) {
      setRawError(error instanceof Error ? error.message : '原始报文不合法')
    }
  }

  return (
    <main className="workspace panel" id="command-workspace">
      <div className="workspace-heading">
        <div>
          <div className="title-line"><span className={`kind-tag kind-${definition.kind}`}>{definition.kind === 'query' ? '查询' : definition.kind === 'critical' ? '关键控制' : '控制'}</span><code>{definition.cmd}</code></div>
          <h2>{definition.name}</h2>
          <p>{definition.description}</p>
        </div>
        <div className="mode-tabs" role="tablist" aria-label="编辑模式">
          <button type="button" role="tab" aria-selected={mode === 'form'} className={mode === 'form' ? 'active' : ''} onClick={() => switchMode('form')}><Braces size={15} />专用表单</button>
          <button type="button" role="tab" aria-selected={mode === 'raw'} className={mode === 'raw' ? 'active' : ''} onClick={() => switchMode('raw')}><CodeXml size={15} />原始 JSON</button>
        </div>
      </div>

      <section className="editor-zone">
        {mode === 'form' ? (
          <form id="command-form" onSubmit={submitForm}>
            <CommandFields cmd={cmd} register={form.register} control={form.control} setValue={form.setValue} errors={form.formState.errors} />
          </form>
        ) : (
          <div className="raw-editor">
            <textarea name="raw-command" autoComplete="off" aria-label="原始 JSON 报文" value={raw} onChange={(event) => setRaw(event.target.value)} spellCheck={false} />
            {rawError ? <p className="form-error">{rawError}</p> : <p className="editor-hint">发送前校验通用字段；换行结束符由系统自动追加 CRLF。</p>}
          </div>
        )}
      </section>

      <div className="send-strip">
        <div className="send-rule"><span>STRICT SERIAL</span><i /></div>
        <button className="mini-button" type="button" onClick={() => form.reset(structuredClone(definition.defaults))}><RotateCcw size={14} />重置参数</button>
        <button
          className={`send-button send-${definition.kind}`}
          type={mode === 'form' ? 'submit' : 'button'}
          form={mode === 'form' ? 'command-form' : undefined}
          disabled={!connected || busy}
          onClick={mode === 'raw' ? submitRaw : undefined}
        >
          <Send size={17} />{busy ? '等待设备响应…' : connected ? '发送命令' : '连接后发送'}
        </button>
      </div>

      <ResponsePanel transaction={transaction} />
    </main>
  )
}
