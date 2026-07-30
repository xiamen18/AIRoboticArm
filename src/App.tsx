import { useEffect, useState } from 'react'
import { CommandNav } from './components/CommandNav'
import { CommandWorkspace } from './components/CommandWorkspace'
import { ConnectionBar } from './components/ConnectionBar'
import { createFloorStatusPreview, FloorControl, floorStatusKey, platformTestStateFromMode, type FloorAreaStatus, type FloorAreaType, type FloorDeviceParameters, type FloorQrDecodeState, type FloorSampleQr, type FloorSampleTestState, type FloorSelection } from './components/FloorControl'
import { SessionLog } from './components/SessionLog'
import { buildRequest } from './protocol/commands'
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
  const [view, setView] = useState<'floor' | 'debugger'>('floor')
  const [floorStatuses, setFloorStatuses] = useState<Record<string, FloorAreaStatus>>(createFloorStatusPreview)

  useEffect(() => {
    void window.nmrApi.getConnectionState().then(setConnectionState)
    const removeState = window.nmrApi.onConnectionStateChanged((state) => {
      setConnectionState(state)
      if (state === 'connected') setFloorStatuses(removePreviewStatuses)
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
  const executeRequest = async (request: CommandRequest): Promise<Transaction> => {
    setTransaction(null)
    setPulse('pending')
    try {
      const result = await window.nmrApi.sendCommand(request)
      setTransaction(result.transaction)
      setPulse(result.transaction.status)
      return result.transaction
    } catch (error) {
      setMessages((current) => [...current, localSystemMessage(error instanceof Error ? error.message : '命令发送失败', 'transport-error')])
      setPulse('transport-error')
      throw error
    }
  }

  const send = async (request: CommandRequest) => {
    setBusy(true)
    try { await executeRequest(request) } catch { /* Error is reflected in the shared status and log. */ }
    finally { setBusy(false) }
  }

  const refreshFloor = async (areaType: FloorAreaType) => {
    setBusy(true)
    try {
      const result = await executeRequest(buildRequest('get_area_sample_status', { area_type: areaType }))
      applyFloorStatus(areaType, result, setFloorStatuses)
      if (areaType === 'platform') {
        const lights = await executeRequest(buildRequest('get_rgb_light_status', {}))
        applyPlatformLights(lights, setFloorStatuses)
      }
    } catch { /* Error is reflected in the shared status and log. */ }
    finally { setBusy(false) }
  }

  const scanFloorQr = async (selection: FloorSelection) => {
    setBusy(true)
    try {
      const result = await executeRequest(buildRequest('scan_qrcode', {
        area_type: selection.areaType,
        area_id: selection.areaId,
      }))
      applyFloorQrCodes(result, setFloorStatuses)
    } catch { /* Error is reflected in the shared status and log. */ }
    finally { setBusy(false) }
  }

  const moveFloorSampleIn = async (selection: FloorSelection, sample: FloorSampleQr) => {
    const trayStatus = floorStatuses[floorStatusKey(selection.areaType, selection.areaId)]
    const plateQrCode = usableQrCode(trayStatus?.plateQrCode)
    const sampleQrCode = usableQrCode(sample.sampleQrCode)
    const targetAreaId = findEmptyTestArea(floorStatuses)
    if (!plateQrCode || !sampleQrCode || targetAreaId === null) {
      reportFloorActionError('进样条件不足：请读取样品架、样品和空测试区状态。', setMessages, setPulse)
      return
    }

    setBusy(true)
    try {
      const result = await executeRequest(buildRequest('move_sample', {
        source: {
          area_type: selection.areaType,
          area_id: selection.areaId,
          plate_qr_code: plateQrCode,
          hole_id: sample.positionId,
          sample_qr_code: sampleQrCode,
        },
        target: { area_type: 'test_area', area_id: targetAreaId, plate_qr_code: 'NULL', hole_id: 'NULL' },
      }))
      if (result.status === 'success') {
        await refreshFloor(selection.areaType)
        await refreshFloor('test_area')
      }
    } catch { /* Error is reflected in the shared status and log. */ }
    finally { setBusy(false) }
  }

  const moveFloorSampleOut = async (selection: FloorSelection, sample: FloorSampleQr) => {
    const trayStatus = floorStatuses[floorStatusKey(selection.areaType, selection.areaId)]
    const plateQrCode = usableQrCode(trayStatus?.plateQrCode)
    const source = findOccupiedTestSample(floorStatuses)
    if (!plateQrCode || !source) {
      reportFloorActionError('退样条件不足：请读取样品架和测试区样品二维码。', setMessages, setPulse)
      return
    }

    setBusy(true)
    try {
      const result = await executeRequest(buildRequest('move_sample', {
        source: {
          area_type: 'test_area',
          area_id: source.areaId,
          plate_qr_code: 'NULL',
          hole_id: 'NULL',
          sample_qr_code: source.sampleQrCode,
        },
        target: {
          area_type: selection.areaType,
          area_id: selection.areaId,
          plate_qr_code: plateQrCode,
          hole_id: sample.positionId,
        },
      }))
      if (result.status === 'success') {
        await refreshFloor(selection.areaType)
        await refreshFloor('test_area')
      }
    } catch { /* Error is reflected in the shared status and log. */ }
    finally { setBusy(false) }
  }

  const readDeviceParameters = async (): Promise<FloorDeviceParameters | null> => {
    setBusy(true)
    try {
      const result = await executeRequest(buildRequest('get_machine_param', { modules: ['robot', 'safety_radar'] }))
      const robot = result.response?.data?.robot
      const safetyRadar = result.response?.data?.safety_radar
      if (!robot || typeof robot !== 'object') {
        reportFloorActionError('机械臂参数响应缺少 robot 模块。', setMessages, setPulse)
        return null
      }
      const speed = (robot as Record<string, unknown>).speed
      if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 1 || speed > 100) {
        reportFloorActionError('机械臂速度必须在 1 到 100 之间。', setMessages, setPulse)
        return null
      }
      if (!safetyRadar || typeof safetyRadar !== 'object') {
        reportFloorActionError('设备参数响应缺少 safety_radar 模块。', setMessages, setPulse)
        return null
      }
      const nearAlarmMasked = (safetyRadar as Record<string, unknown>).near_alarm_masked
      const farAlarmMasked = (safetyRadar as Record<string, unknown>).far_alarm_masked
      if (typeof nearAlarmMasked !== 'boolean' || typeof farAlarmMasked !== 'boolean') {
        reportFloorActionError('安全雷达屏蔽参数响应不完整。', setMessages, setPulse)
        return null
      }
      return { robotSpeed: Math.round(speed), safetyRadarMasked: nearAlarmMasked && farAlarmMasked }
    } catch {
      return null
    } finally {
      setBusy(false)
    }
  }

  const saveDeviceParameters = async ({ robotSpeed, safetyRadarMasked }: FloorDeviceParameters): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await executeRequest(buildRequest('set_machine_param', {
        robot: { enabled: true, speed: robotSpeed, save: true },
        safety_radar: {
          enabled: true,
          near_alarm_masked: safetyRadarMasked,
          far_alarm_masked: safetyRadarMasked,
          save: true,
        },
      }))
      const responseData = result.response?.data
      const failedModule = ['robot', 'safety_radar'].map((module) => responseData?.[module]).find((module) =>
        module && typeof module === 'object' && (module as Record<string, unknown>).action_status === 'failed')
      if (failedModule && typeof failedModule === 'object') {
        const reason = (failedModule as Record<string, unknown>).failed_reason
        reportFloorActionError(typeof reason === 'string' && reason !== 'NULL' ? reason : '设备参数设置失败。', setMessages, setPulse)
        return false
      }
      return result.status === 'success'
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }

  if (view === 'floor') {
    return <FloorControl
      busy={busy}
      statuses={floorStatuses}
      onReadDeviceParameters={readDeviceParameters}
      onSaveDeviceParameters={saveDeviceParameters}
      onScanQr={scanFloorQr}
      onSampleIn={moveFloorSampleIn}
      onSampleOut={moveFloorSampleOut}
      onOpenDebugger={() => setView('debugger')}
    />
  }

  return <div className="app-shell debug-app">
      <button type="button" className="debug-floor-button" onClick={() => setView('floor')}>返回平面控制</button>
      <a className="skip-link" href="#command-workspace">跳到命令工作区</a>
      <ConnectionBar host={host} port={port} timeoutSeconds={timeoutSeconds} state={connectionState} pulse={pulse} onHostChange={setHost} onPortChange={setPort} onTimeoutChange={setTimeoutSeconds} onConnect={connect} onDisconnect={disconnect} />
      <div className="workbench-grid">
        <CommandNav selected={selectedCommand} onSelect={(cmd) => { setSelectedCommand(cmd); setTransaction(null) }} />
        <CommandWorkspace cmd={selectedCommand} connected={connectionState === 'connected'} busy={busy} transaction={transaction} onSend={send} />
        <SessionLog messages={messages} onClear={() => setMessages([])} />
      </div>
    </div>
}

function applyFloorStatus(
  areaType: FloorAreaType,
  transaction: Transaction,
  setStatuses: React.Dispatch<React.SetStateAction<Record<string, FloorAreaStatus>>>,
): void {
  const data = transaction.response?.data
  const areas = Array.isArray(data?.areas) ? data.areas : []
  setStatuses((current) => {
    const next = { ...current }
    for (const item of areas) {
      if (!item || typeof item !== 'object') continue
      const area = item as Record<string, unknown>
      if (typeof area.area_id !== 'number') continue
      const recognition = area.recognition_status
      const key = floorStatusKey(areaType, area.area_id)
      const previous = next[key]
      next[key] = {
        ...(previous?.demo ? {} : previous),
        occupancy: recognition !== 'success' ? 'error' : area.sample_empty === true ? 'empty' : 'occupied',
        demo: false,
      }
    }
    return next
  })
}

function applyPlatformLights(
  transaction: Transaction,
  setStatuses: React.Dispatch<React.SetStateAction<Record<string, FloorAreaStatus>>>,
): void {
  const body = transaction.response?.data
  const lights = Array.isArray(body?.body) ? body.body : []
  setStatuses((current) => {
    const next = { ...current }
    for (const item of lights) {
      if (!item || typeof item !== 'object') continue
      const light = item as Record<string, unknown>
      if (typeof light.area_id !== 'number') continue
      const key = floorStatusKey('platform', light.area_id)
      const previous = next[key]
      next[key] = {
        ...(previous?.demo ? {} : previous),
        occupancy: previous?.demo ? 'unknown' : previous?.occupancy ?? 'unknown',
        testState: platformTestStateFromMode(light.mode),
        lightFlashing: typeof light.mode === 'string' && light.mode.endsWith('_flash'),
        demo: false,
      }
    }
    return next
  })
}

function applyFloorQrCodes(
  transaction: Transaction,
  setStatuses: React.Dispatch<React.SetStateAction<Record<string, FloorAreaStatus>>>,
): void {
  const data = transaction.response?.data
  if (!data || typeof data !== 'object') return
  const areaType = data.area_type
  const areaId = data.area_id
  if (!isFloorAreaType(areaType) || typeof areaId !== 'number') return
  const samples = Array.isArray(data.samples)
    ? data.samples.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const sample = item as Record<string, unknown>
        if (typeof sample.position_id !== 'number') return []
        return [{
          positionId: sample.position_id,
          sampleQrCode: typeof sample.sample_qr_code === 'string' && sample.sample_qr_code !== 'NULL' ? sample.sample_qr_code : null,
          decodeState: qrDecodeState(sample.decode_status),
          hasSample: samplePresenceFromQrResult(sample),
          testState: sampleTestStateFromResult(sample.test_status ?? sample.test_state),
        }]
      })
    : []

  setStatuses((current) => {
    const key = floorStatusKey(areaType, areaId)
    const previous = current[key]
    return {
      ...current,
      [key]: {
        ...(previous?.demo ? {} : previous),
        occupancy: previous?.demo ? 'unknown' : previous?.occupancy ?? 'unknown',
        demo: false,
        plateQrCode: typeof data.plate_qr_code === 'string' && data.plate_qr_code !== 'NULL' ? data.plate_qr_code : null,
        samples,
      },
    }
  })
}

function isFloorAreaType(value: unknown): value is FloorAreaType {
  return value === 'platform' || value === 'transfer' || value === 'test_area'
}

function qrDecodeState(value: unknown): FloorQrDecodeState {
  if (value === 'success' || value === 'no_code' || value === 'failed' || value === 'blocked' || value === 'low_quality') return value
  return 'unknown'
}

function samplePresenceFromQrResult(sample: Record<string, unknown>): boolean | null {
  if (typeof sample.sample_present === 'boolean') return sample.sample_present
  if (sample.decode_status === 'no_code') return false
  if (sample.decode_status === 'success' || sample.decode_status === 'failed' || sample.decode_status === 'blocked' || sample.decode_status === 'low_quality') return true
  return null
}

function sampleTestStateFromResult(value: unknown): FloorSampleTestState {
  if (value === 'completed' || value === 'complete' || value === 'passed' || value === 'success' || value === 'green') return 'completed'
  if (value === 'problem' || value === 'fault' || value === 'failed' || value === 'error' || value === 'red') return 'problem'
  return 'unknown'
}

function usableQrCode(value: string | null | undefined): string | null {
  if (!value || value === 'NULL') return null
  return value
}

function findEmptyTestArea(statuses: Record<string, FloorAreaStatus>): number | null {
  for (const areaId of [1, 2]) {
    if (statuses[floorStatusKey('test_area', areaId)]?.occupancy === 'empty') return areaId
  }
  return null
}

function findOccupiedTestSample(statuses: Record<string, FloorAreaStatus>): { areaId: number; sampleQrCode: string } | null {
  for (const areaId of [1, 2]) {
    const status = statuses[floorStatusKey('test_area', areaId)]
    if (status?.occupancy !== 'occupied') continue
    const sampleQrCode = usableQrCode(status.samples?.[0]?.sampleQrCode)
    if (sampleQrCode) return { areaId, sampleQrCode }
  }
  return null
}

function reportFloorActionError(
  detail: string,
  setMessages: React.Dispatch<React.SetStateAction<SocketMessage[]>>,
  setPulse: React.Dispatch<React.SetStateAction<TransactionStatus | 'idle'>>,
): void {
  setMessages((current) => [...current, localSystemMessage(detail, 'protocol-error')])
  setPulse('protocol-error')
}

function removePreviewStatuses(current: Record<string, FloorAreaStatus>): Record<string, FloorAreaStatus> {
  return Object.fromEntries(Object.entries(current).filter(([, status]) => !status.demo))
}

function localSystemMessage(detail: string, status: TransactionStatus): SocketMessage {
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), direction: 'system', raw: '', detail, status }
}
