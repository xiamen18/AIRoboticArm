import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bug,
  Gauge,
  Map as MapIcon,
  QrCode,
  ScanLine,
  Settings2,
  TestTube2,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState, type MouseEvent } from 'react'

export type FloorAreaType = 'platform' | 'transfer' | 'test_area'
export type FloorOccupancyState = 'unknown' | 'empty' | 'occupied' | 'error'
export type FloorTestState = 'unknown' | 'idle' | 'completed' | 'problem' | 'testing'
export type FloorSampleTestState = 'unknown' | 'completed' | 'problem'
export type FloorQrDecodeState = 'success' | 'no_code' | 'failed' | 'blocked' | 'low_quality' | 'unknown'

export interface FloorSampleQr {
  positionId: number
  sampleQrCode: string | null
  decodeState: FloorQrDecodeState
  hasSample: boolean | null
  testState: FloorSampleTestState
}

export interface FloorAreaStatus {
  occupancy: FloorOccupancyState
  testState?: FloorTestState
  lightFlashing?: boolean
  demo?: boolean
  plateQrCode?: string | null
  samples?: FloorSampleQr[]
}

export interface FloorSelection {
  areaType: FloorAreaType
  areaId: number
}

export interface FloorDeviceParameters {
  robotSpeed: number
  safetyRadarMasked: boolean
}

interface FloorControlProps {
  busy: boolean
  statuses: Record<string, FloorAreaStatus>
  onReadDeviceParameters(): Promise<FloorDeviceParameters | null>
  onSaveDeviceParameters(parameters: FloorDeviceParameters): Promise<boolean>
  onScanQr(selection: FloorSelection): Promise<void>
  onSampleIn(selection: FloorSelection, sample: FloorSampleQr): Promise<void>
  onSampleOut(selection: FloorSelection, sample: FloorSampleQr): Promise<void>
  onOpenDebugger(): void
}

interface SlotPosition {
  id: number
  column: number
  row: number
}

// Coordinates are the top projection of YS25009-03-00 instances in the GLB.
// IDs run left-to-right within each row, starting from the bottom row.
const PLATFORM_SLOTS: SlotPosition[] = [
  { id: 23, column: 1, row: 1 }, { id: 24, column: 2, row: 1 }, { id: 25, column: 3, row: 1 },
  { id: 26, column: 5, row: 1 }, { id: 27, column: 6, row: 1 }, { id: 28, column: 7, row: 1 },
  { id: 16, column: 1, row: 2 }, { id: 17, column: 2, row: 2 }, { id: 18, column: 3, row: 2 },
  { id: 19, column: 4, row: 2 }, { id: 20, column: 5, row: 2 }, { id: 21, column: 6, row: 2 }, { id: 22, column: 7, row: 2 },
  { id: 9, column: 1, row: 3 }, { id: 10, column: 2, row: 3 }, { id: 11, column: 3, row: 3 },
  { id: 12, column: 4, row: 3 }, { id: 13, column: 5, row: 3 }, { id: 14, column: 6, row: 3 }, { id: 15, column: 7, row: 3 },
  { id: 4, column: 2, row: 4 }, { id: 5, column: 3, row: 4 }, { id: 6, column: 4, row: 4 },
  { id: 7, column: 5, row: 4 }, { id: 8, column: 6, row: 4 },
  { id: 1, column: 3, row: 5 }, { id: 2, column: 4, row: 5 }, { id: 3, column: 5, row: 5 },
]

const TRANSFER_SLOTS: SlotPosition[] = [
  { id: 3, column: 1, row: 1 }, { id: 4, column: 2, row: 1 },
  { id: 1, column: 1, row: 2 }, { id: 2, column: 2, row: 2 },
]

const TEST_AREA_SLOTS: SlotPosition[] = [
  { id: 1, column: 1, row: 1 }, { id: 2, column: 2, row: 1 },
]

const AREA_NAMES: Record<FloorAreaType, string> = {
  platform: '平台区',
  transfer: '中转区',
  test_area: '测试区',
}

const TEST_STATE_LABELS: Record<FloorTestState, string> = {
  unknown: '测试状态未读取',
  idle: '未测试',
  completed: '测试完成',
  problem: '盘位有问题',
  testing: '正在测试',
}

export function floorStatusKey(areaType: FloorAreaType, areaId: number): string {
  return `${areaType}-${areaId}`
}

export function createFloorStatusPreview(): Record<string, FloorAreaStatus> {
  return {
    [floorStatusKey('platform', 1)]: {
      occupancy: 'occupied',
      testState: 'completed',
      demo: true,
      plateQrCode: 'PLATE-01',
      samples: createPreviewSamples('S01', 10, [10]),
    },
    [floorStatusKey('platform', 2)]: {
      occupancy: 'occupied',
      testState: 'problem',
      demo: true,
      plateQrCode: 'PLATE-02',
      samples: createPreviewSamples('S02', 10, [10]),
    },
    [floorStatusKey('platform', 3)]: {
      occupancy: 'occupied',
      testState: 'testing',
      lightFlashing: true,
      demo: true,
      plateQrCode: 'PLATE-03',
      samples: createPreviewSamples('S03'),
    },
    [floorStatusKey('platform', 4)]: { occupancy: 'empty', testState: 'idle', demo: true },
    [floorStatusKey('platform', 5)]: { occupancy: 'occupied', testState: 'idle', demo: true },
    [floorStatusKey('transfer', 1)]: { occupancy: 'occupied', demo: true, plateQrCode: 'PLATE-T01', samples: createPreviewSamples('T01') },
    [floorStatusKey('transfer', 2)]: { occupancy: 'empty', demo: true },
    [floorStatusKey('test_area', 1)]: { occupancy: 'occupied', demo: true, samples: createPreviewSamples('TEST', 1) },
    [floorStatusKey('test_area', 2)]: { occupancy: 'empty', demo: true },
  }
}

export function FloorControl(props: FloorControlProps) {
  const {
    busy,
    statuses,
    onReadDeviceParameters,
    onSaveDeviceParameters,
    onScanQr,
    onSampleIn,
    onSampleOut,
    onOpenDebugger,
  } = props
  const [selection, setSelection] = useState<FloorSelection | null>(null)
  const [displaySelection, setDisplaySelection] = useState<FloorSelection>({ areaType: 'platform', areaId: 1 })
  const [selectedSamplePosition, setSelectedSamplePosition] = useState(1)
  const [showParameterSettings, setShowParameterSettings] = useState(false)
  const [robotSpeed, setRobotSpeed] = useState(50)
  const [safetyRadarMasked, setSafetyRadarMasked] = useState(false)
  const activeSelection = selection ?? displaySelection
  const selectedStatus = statuses[floorStatusKey(activeSelection.areaType, activeSelection.areaId)] ?? { occupancy: 'unknown' as const }
  const selectedTestState = selectedStatus.testState ?? 'unknown'
  const areaName = AREA_NAMES[activeSelection.areaType]
  const isSampleTray = activeSelection.areaType !== 'test_area'
  const canMoveSamples = activeSelection.areaType === 'platform'
  const rackSamples = fillRackSamples(selectedStatus.samples, isSampleTray ? 10 : 1)
  const selectedRackSample = rackSamples.find((sample) => sample.positionId === selectedSamplePosition) ?? rackSamples[0]

  useEffect(() => {
    if (!selection) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selection])

  const selectSlot = (next: FloorSelection) => {
    setDisplaySelection(next)
    setSelection(next)
    setSelectedSamplePosition(1)
  }

  const closeFromBlankArea = (event: MouseEvent<HTMLElement>) => {
    if (!selection) return
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, label')) return
    setSelection(null)
  }

  const readDeviceParameters = async () => {
    try {
      const parameters = await onReadDeviceParameters()
      if (parameters === null) return
      setRobotSpeed(parameters.robotSpeed)
      setSafetyRadarMasked(parameters.safetyRadarMasked)
    } catch {}
  }

  const toggleParameterSettings = () => {
    if (showParameterSettings) {
      setShowParameterSettings(false)
      return
    }
    setShowParameterSettings(true)
    void readDeviceParameters()
  }

  const saveDeviceParameters = async (parameters: FloorDeviceParameters) => {
    try {
      await onSaveDeviceParameters(parameters)
    } catch {}
  }

  const toggleSafetyRadarMasked = () => {
    const nextSafetyRadarMasked = !safetyRadarMasked
    setSafetyRadarMasked(nextSafetyRadarMasked)
    void saveDeviceParameters({ robotSpeed, safetyRadarMasked: nextSafetyRadarMasked })
  }

  return (
    <div className={`control-app${showParameterSettings ? ' parameter-settings-open' : ''}`}>
      <header className="control-header">
        <div className="control-brand">
          <span className="control-brand-mark" aria-hidden="true"><MapIcon size={24} /></span>
          <div>
            <h1>自动送样控制</h1>
          </div>
        </div>

        <nav className="view-switch" aria-label="工作视图">
          <button type="button" className="active" aria-current="page"><MapIcon size={18} />平面</button>
          <button type="button" onClick={onOpenDebugger}><Bug size={18} />调试</button>
        </nav>

        <div className="control-connection">
          <button
            type="button"
            className="square-button"
            aria-label="设备参数设置"
            title="设备参数设置"
            aria-pressed={showParameterSettings}
            disabled={busy}
            onClick={toggleParameterSettings}
          >
            <Settings2 size={20} />
          </button>
        </div>
      </header>

      {showParameterSettings ? (
        <section className="parameter-settings" aria-label="设备参数设置">
          <div className="parameter-settings-heading">
            <Gauge size={22} />
            <h2>设备参数</h2>
          </div>
          <label className="robot-speed-control">
            <span className="parameter-control-label"><span>机械臂速度</span><output>{robotSpeed}%</output></span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={robotSpeed}
              aria-label="机械臂速度"
              aria-valuetext={`${robotSpeed}%`}
              disabled={busy}
              onChange={(event) => setRobotSpeed(Number(event.target.value))}
              onPointerUp={() => void saveDeviceParameters({ robotSpeed, safetyRadarMasked })}
              onKeyUp={() => void saveDeviceParameters({ robotSpeed, safetyRadarMasked })}
            />
          </label>
          <div className="safety-radar-control">
            <span>安全雷达屏蔽</span>
            <button
              type="button"
              className="safety-radar-switch"
              role="switch"
              aria-label="安全雷达屏蔽"
              aria-checked={safetyRadarMasked}
              disabled={busy}
              onClick={toggleSafetyRadarMasked}
            >
              <span className="switch-track" aria-hidden="true"><i /></span>
              <strong>{safetyRadarMasked ? '屏蔽' : '不屏蔽'}</strong>
            </button>
          </div>
        </section>
      ) : null}

      <main className={`floor-main${selection ? ' drawer-open' : ''}`} onClick={closeFromBlankArea}>
        <section className="plan-workspace" aria-label="样品位平面">
          <div className="floor-stage">
            <div className="auxiliary-zones">
              <section className="transfer-zone" aria-labelledby="transfer-title">
                <div className="zone-heading">
                  <h3 id="transfer-title">中转区</h3>
                </div>
                <div className="transfer-deck">
                  {TRANSFER_SLOTS.map((slot) => (
                    <FloorSlot
                      key={slot.id}
                      areaType="transfer"
                      slot={slot}
                      status={statuses[floorStatusKey('transfer', slot.id)]}
                      selected={selection?.areaType === 'transfer' && selection.areaId === slot.id}
                      onSelect={selectSlot}
                    />
                  ))}
                </div>
              </section>

              <section className="test-zone" aria-labelledby="test-area-title">
                <div className="zone-heading">
                  <h3 id="test-area-title">测试区</h3>
                </div>
                <div className="test-deck">
                  {TEST_AREA_SLOTS.map((slot) => (
                    <FloorSlot
                      key={slot.id}
                      areaType="test_area"
                      slot={slot}
                      status={statuses[floorStatusKey('test_area', slot.id)]}
                      selected={selection?.areaType === 'test_area' && selection.areaId === slot.id}
                      onSelect={selectSlot}
                    />
                  ))}
                </div>
              </section>
            </div>

            <section className="platform-zone" aria-labelledby="platform-title">
              <div className="zone-heading platform-heading">
                <h3 id="platform-title">平台区</h3>
              </div>
              <div className="machine-deck">
                <div className="platform-grid">
                  {PLATFORM_SLOTS.map((slot) => (
                    <FloorSlot
                      key={slot.id}
                      areaType="platform"
                      slot={slot}
                      status={statuses[floorStatusKey('platform', slot.id)]}
                      selected={selection?.areaType === 'platform' && selection.areaId === slot.id}
                      onSelect={selectSlot}
                    />
                  ))}
                  <div className="robot-footprint" aria-label="机械臂基座"><span /><strong>机械臂</strong></div>
                </div>
              </div>
            </section>
          </div>

          <div className="slot-legend floor-legend" aria-label="位置状态图例">
            <div className="legend-group occupancy-legend">
              <b>样品</b>
              <span><i className="occupancy-mark occupied" />有</span>
              <span><i className="occupancy-mark empty" />无</span>
            </div>
            <div className="legend-group light-legend">
              <b>平台测试灯</b>
              <span><i className="legend-dot completed" />完成</span>
              <span><i className="legend-dot problem" />问题</span>
              <span><i className="legend-dot testing" />测试中</span>
            </div>
          </div>
        </section>

        <aside
          data-testid="slot-inspector"
          className={`slot-inspector${selection ? ' open' : ''}`}
          aria-label="选中位置"
          aria-hidden={!selection}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="section-kicker">{selectedStatus.demo ? '选中位置 · 样式示意' : '选中位置'}</p>
          <div className={`selection-title${isSampleTray ? ' has-plate-qr' : ''}`}>
            <span>{String(activeSelection.areaId).padStart(2, '0')}</span>
            <div>
              <h2>{areaName}</h2>
              {activeSelection.areaType === 'platform' ? (
                <p className={`selection-test-state test-${selectedTestState}`}>
                  {selectedTestState === 'completed' || selectedTestState === 'problem' || selectedTestState === 'testing' ? <i /> : null}
                  {testStateSummary(selectedTestState)}
                </p>
              ) : null}
            </div>
            {isSampleTray ? <PlateQrInfo plateQrCode={selectedStatus.plateQrCode} /> : null}
          </div>

          <section className={`sample-rack${isSampleTray ? '' : ' single-sample'}`} aria-labelledby="sample-rack-title">
            <div className="sample-rack-heading">
              <div><TestTube2 size={17} /><h3 id="sample-rack-title">{isSampleTray ? '样品架' : '样品信息'}</h3></div>
              <span>{isSampleTray ? '10 个孔位' : '测试位样品'}</span>
            </div>
            <ol className="sample-rack-grid">
              {rackSamples.map((sample) => (
                <SampleTube
                  key={sample.positionId}
                  sample={sample}
                  selected={sample.positionId === selectedRackSample.positionId}
                  onSelect={setSelectedSamplePosition}
                />
              ))}
            </ol>
            <SampleQrDetail sample={selectedRackSample} />
          </section>

          <div className={`inspector-actions${canMoveSamples ? '' : ' single-action'}`}>
            <button
              type="button"
              className="inspector-action qr-action"
              aria-label={`扫描${areaName}二维码`}
              disabled={busy}
              tabIndex={selection ? 0 : -1}
              onClick={() => void onScanQr(activeSelection)}
            >
              <ScanLine className={busy ? 'scan-pulse' : ''} size={20} />
              <span><strong>扫码</strong></span>
            </button>
            {canMoveSamples ? (
              <>
                <button
                  type="button"
                  className="inspector-action sample-in-action"
                  aria-label="进样"
                  disabled={busy || selectedRackSample.hasSample !== true}
                  tabIndex={selection ? 0 : -1}
                  onClick={() => void onSampleIn(activeSelection, selectedRackSample)}
                >
                  <ArrowDownToLine size={20} />
                  <span><strong>进样</strong><small>送入测试区</small></span>
                </button>
                <button
                  type="button"
                  className="inspector-action sample-out-action"
                  aria-label="退样"
                  disabled={busy || selectedRackSample.hasSample !== false}
                  tabIndex={selection ? 0 : -1}
                  onClick={() => void onSampleOut(activeSelection, selectedRackSample)}
                >
                  <ArrowUpFromLine size={20} />
                  <span><strong>退样</strong><small>放回当前空孔</small></span>
                </button>
              </>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  )
}

interface FloorSlotProps {
  areaType: FloorAreaType
  slot: SlotPosition
  status?: FloorAreaStatus
  selected: boolean
  onSelect(selection: FloorSelection): void
}

function FloorSlot({ areaType, slot, status, selected, onSelect }: FloorSlotProps) {
  const occupancy = status?.occupancy ?? 'unknown'
  const testState = areaType === 'platform' ? status?.testState ?? 'unknown' : 'na'
  const areaName = AREA_NAMES[areaType]
  const sampleLabel = occupancyLabel(occupancy, areaType)
  const testLabel = areaType === 'platform' ? TEST_STATE_LABELS[testState as FloorTestState] : null
  const isTestArea = areaType === 'test_area'
  const showTestLamp = testState === 'completed' || testState === 'problem' || testState === 'testing'
  return (
    <button
      type="button"
      className={`floor-slot${isTestArea ? ' test-area-slot' : ''} occupancy-${occupancy} test-${testState}${status?.lightFlashing ? ' test-flashing' : ''}${selected ? ' selected' : ''}`}
      style={{ gridColumn: slot.column, gridRow: slot.row }}
      aria-label={`${areaName} ${slot.id}号，${sampleLabel}${testLabel ? `，${testLabel}` : ''}`}
      aria-pressed={selected}
      data-area-type={areaType}
      data-testid={`${areaType}-slot`}
      onClick={() => onSelect({ areaType, areaId: slot.id })}
    >
      {isTestArea
        ? <TestTube2 className="test-tube-icon" size={20} aria-hidden="true" />
        : <span className="tray-holes" aria-hidden="true"><i /><i /><i /><i /></span>}
      {showTestLamp ? <span className={`slot-lamp lamp-${testState}`} aria-hidden="true" /> : null}
      <strong>{String(slot.id).padStart(2, '0')}</strong>
    </button>
  )
}

function SampleTube({ sample, selected, onSelect }: { sample: FloorSampleQr; selected: boolean; onSelect(positionId: number): void }) {
  const presence = samplePresence(sample.hasSample)
  const testState = sample.hasSample ? sample.testState : 'unknown'
  return (
    <li>
      <button
        type="button"
        className={`rack-tube sample-${presence} test-${testState} decode-${sample.decodeState}${selected ? ' selected' : ''}`}
        aria-label={`孔位 ${sample.positionId}，${samplePresenceLabel(sample.hasSample)}${testState !== 'unknown' ? `，${sampleTestStateLabel(testState)}` : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(sample.positionId)}
      >
        <span className="sample-position-orb" aria-hidden="true"><strong>{String(sample.positionId).padStart(2, '0')}</strong></span>
      </button>
    </li>
  )
}

function PlateQrInfo({ plateQrCode }: { plateQrCode?: string | null }) {
  const code = normalizeQrCode(plateQrCode)
  return (
    <section className="plate-qr-info" aria-label="样品架二维码信息">
      <h4>样品架二维码</h4>
      <div className="plate-qr-preview">
        {code ? (
          <span role="img" aria-label={`样品架二维码 ${code}`}>
            <QRCodeSVG value={code} size={88} marginSize={2} bgColor="#ffffff" fgColor="#213029" />
          </span>
        ) : <QrCode size={28} aria-hidden="true" />}
      </div>
      <strong title={code ?? undefined}>{code ?? '—'}</strong>
    </section>
  )
}

function SampleQrDetail({ sample }: { sample: FloorSampleQr }) {
  const code = normalizeQrCode(sample.sampleQrCode)
  const presence = samplePresence(sample.hasSample)
  return (
    <section className={`sample-qr-detail sample-${presence}`} aria-label={`孔位 ${sample.positionId} 样品信息`}>
      <div className="sample-qr-preview">
        {code ? (
          <span role="img" aria-label={`孔位 ${sample.positionId} 样品二维码 ${code}`}>
            <QRCodeSVG value={code} size={76} marginSize={2} bgColor="#ffffff" fgColor="#213029" />
          </span>
        ) : <QrCode size={30} aria-hidden="true" />}
      </div>
      <div className="sample-qr-copy">
        <h4>孔位 {String(sample.positionId).padStart(2, '0')}</h4>
        <dl>
          <dt>样品二维码</dt><dd title={code ?? undefined}>{code ?? '—'}</dd>
          <dt>测试状态</dt>
          <dd className={`sample-detail-test test-${sample.hasSample ? sample.testState : 'unknown'}`}>
            {sample.hasSample && (sample.testState === 'completed' || sample.testState === 'problem') ? <i /> : null}
            {sample.hasSample ? sampleTestStateLabel(sample.testState) : '—'}
          </dd>
        </dl>
      </div>
    </section>
  )
}

function occupancyLabel(state: FloorOccupancyState, areaType: FloorAreaType): string {
  if (state === 'unknown') return '占用状态未读取'
  if (state === 'error') return '占用识别异常'
  if (areaType === 'test_area') return state === 'occupied' ? '有样品' : '无样品'
  return state === 'occupied' ? '有样品盘' : '无样品盘'
}

function testStateSummary(state: FloorTestState): string {
  if (state === 'unknown') return '—'
  return TEST_STATE_LABELS[state]
}

function createPreviewSamples(prefix: string, count = 10, unknownPositions: number[] = []): FloorSampleQr[] {
  const emptyPositions = new Set(count === 10 ? [4, 7, 9] : [])
  const unreadablePositions = new Set(count === 10 ? [6] : [])
  const unknownPositionSet = new Set(unknownPositions)
  return Array.from({ length: count }, (_, index) => {
    const positionId = index + 1
    const empty = emptyPositions.has(positionId)
    const unreadable = unreadablePositions.has(positionId)
    const unknown = unknownPositionSet.has(positionId)
    return {
      positionId,
      sampleQrCode: empty || unreadable || unknown ? null : `${prefix}-${String(positionId).padStart(2, '0')}`,
      decodeState: unknown ? 'unknown' : empty ? 'no_code' : unreadable ? 'blocked' : 'success',
      hasSample: unknown ? null : !empty,
      testState: unknown ? 'unknown' : previewSampleTestState(positionId, empty),
    }
  })
}

function fillRackSamples(samples: FloorSampleQr[] | undefined, count: number): FloorSampleQr[] {
  const byPosition = new Map(samples?.map((sample) => [sample.positionId, sample]))
  return Array.from({ length: count }, (_, index) => byPosition.get(index + 1) ?? {
    positionId: index + 1,
    sampleQrCode: null,
    decodeState: 'unknown',
    hasSample: null,
    testState: 'unknown',
  })
}

function normalizeQrCode(value: string | null | undefined): string | null {
  if (!value || value === 'NULL') return null
  return value
}

function samplePresence(value: boolean | null): 'present' | 'empty' | 'unknown' {
  if (value === true) return 'present'
  if (value === false) return 'empty'
  return 'unknown'
}

function samplePresenceLabel(value: boolean | null): string {
  if (value === true) return '有样品'
  if (value === false) return '无样品'
  return '未知孔位'
}

function sampleTestStateLabel(state: FloorSampleTestState): string {
  if (state === 'completed') return '测试完成'
  if (state === 'problem') return '样品故障'
  return '—'
}

function previewSampleTestState(positionId: number, empty: boolean): FloorSampleTestState {
  if (empty) return 'unknown'
  if (positionId === 2 || positionId === 8) return 'problem'
  return 'completed'
}

export function platformTestStateFromMode(mode: unknown): FloorTestState {
  if (mode === 'off') return 'idle'
  if (mode === 'green' || mode === 'green_flash') return 'completed'
  if (mode === 'red' || mode === 'red_flash') return 'problem'
  if (mode === 'blue' || mode === 'blue_flash') return 'testing'
  return 'unknown'
}
