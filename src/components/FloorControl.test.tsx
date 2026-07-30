// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFloorStatusPreview, FloorControl, floorStatusKey, platformTestStateFromMode } from './FloorControl'

afterEach(cleanup)

function renderFloor(overrides: Partial<React.ComponentProps<typeof FloorControl>> = {}) {
  const props: React.ComponentProps<typeof FloorControl> = {
    busy: false,
    statuses: {},
    onReadDeviceParameters: async () => ({ robotSpeed: 50, safetyRadarMasked: false }),
    onSaveDeviceParameters: async () => true,
    onScanQr: async () => undefined,
    onSampleIn: async () => undefined,
    onSampleOut: async () => undefined,
    onOpenDebugger: () => undefined,
    ...overrides,
  }
  return render(<FloorControl {...props} />)
}

describe('FloorControl', () => {
  it('绘制 28 个平台盘位、4 个中转盘位和 2 个测试位', () => {
    renderFloor()
    expect(screen.getAllByTestId('platform-slot')).toHaveLength(28)
    expect(screen.getAllByTestId('transfer-slot')).toHaveLength(4)
    expect(screen.getAllByTestId('test_area-slot')).toHaveLength(2)
    expect(screen.queryByText(/结构模型仅包含平台 1–28/)).not.toBeInTheDocument()
    expect(screen.queryByText('设备未连接')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '连接' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('位置状态图例')).toHaveClass('floor-legend')
    expect(screen.queryByText('CAN400DM')).not.toBeInTheDocument()
    expect(screen.queryByText('04 个盘位')).not.toBeInTheDocument()
    expect(screen.queryByText('02 个样品位')).not.toBeInTheDocument()
    expect(screen.queryByText('28 个模型盘位')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '刷新全部区域状态' })).not.toBeInTheDocument()
  })

  it('通过右上按钮读取并设置机械臂速度与安全雷达屏蔽', async () => {
    const onReadDeviceParameters = vi.fn(async () => ({ robotSpeed: 65, safetyRadarMasked: false }))
    const onSaveDeviceParameters = vi.fn(async () => true)
    renderFloor({ onReadDeviceParameters, onSaveDeviceParameters })

    fireEvent.click(screen.getByRole('button', { name: '设备参数设置' }))
    const speed = screen.getByRole('slider', { name: '机械臂速度' })
    const radarSwitch = screen.getByRole('switch', { name: '安全雷达屏蔽' })
    await waitFor(() => expect(speed).toHaveValue('65'))
    expect(speed).toHaveAttribute('min', '1')
    expect(speed).toHaveAttribute('max', '100')
    expect(radarSwitch).toHaveAttribute('aria-checked', 'false')
    expect(onReadDeviceParameters).toHaveBeenCalledOnce()
    expect(screen.queryByText('设备地址')).not.toBeInTheDocument()
    expect(screen.queryByText('端口')).not.toBeInTheDocument()
    expect(screen.queryByText('响应超时')).not.toBeInTheDocument()
    expect(screen.queryByText('保存为默认参数')).not.toBeInTheDocument()

    fireEvent.change(speed, { target: { value: '72' } })
    fireEvent.pointerUp(speed)
    await waitFor(() => expect(onSaveDeviceParameters).toHaveBeenCalledWith({ robotSpeed: 72, safetyRadarMasked: false }))

    fireEvent.click(radarSwitch)
    expect(radarSwitch).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(onSaveDeviceParameters).toHaveBeenCalledWith({ robotSpeed: 72, safetyRadarMasked: true }))
    expect(onSaveDeviceParameters).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '读取设备参数' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '应用参数' })).not.toBeInTheDocument()
    expect(screen.queryByText('操作失败')).not.toBeInTheDocument()
  })

  it('平台和中转区均从底部开始逐行横向编号', () => {
    renderFloor()
    expect(screen.getByRole('button', { name: '平台区 1号，占用状态未读取，测试状态未读取' })).toHaveStyle({ gridColumn: 3, gridRow: 5 })
    expect(screen.getByRole('button', { name: '平台区 2号，占用状态未读取，测试状态未读取' })).toHaveStyle({ gridColumn: 4, gridRow: 5 })
    expect(screen.getByRole('button', { name: '平台区 4号，占用状态未读取，测试状态未读取' })).toHaveStyle({ gridColumn: 2, gridRow: 4 })
    expect(screen.getByRole('button', { name: '中转区 1号，占用状态未读取' })).toHaveStyle({ gridColumn: 1, gridRow: 2 })
    expect(screen.getByRole('button', { name: '中转区 2号，占用状态未读取' })).toHaveStyle({ gridColumn: 2, gridRow: 2 })
    expect(screen.getByRole('button', { name: '中转区 3号，占用状态未读取' })).toHaveStyle({ gridColumn: 1, gridRow: 1 })
  })

  it('点选中转盘位后显示对应区域和编号', () => {
    renderFloor()
    fireEvent.click(screen.getByRole('button', { name: '中转区 3号，占用状态未读取' }))
    expect(screen.getByRole('heading', { name: '中转区', level: 2 })).toBeInTheDocument()
    expect(screen.queryByText(/area_id/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '扫描中转区二维码' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '进样' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '退样' })).not.toBeInTheDocument()
  })

  it('点选测试位后显示单个样品二维码位', () => {
    renderFloor()
    fireEvent.click(screen.getByRole('button', { name: '测试区 2号，占用状态未读取' }))
    expect(screen.getByRole('heading', { name: '测试区', level: 2 })).toBeInTheDocument()
    expect(screen.queryByText(/area_id/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '样品信息' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '样品架二维码信息' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '扫描测试区二维码' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '进样' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '退样' })).not.toBeInTheDocument()
  })

  it('可以读取选中样品架的二维码', () => {
    const onScanQr = vi.fn(async () => undefined)
    renderFloor({
      onScanQr,
      statuses: {
        [floorStatusKey('platform', 1)]: {
          occupancy: 'occupied',
          testState: 'completed',
          plateQrCode: 'PLATE-001',
          samples: [{ positionId: 1, sampleQrCode: 'QR123456', decodeState: 'success', hasSample: true, testState: 'completed' }],
        },
      },
    })

    const selected = screen.getByRole('button', { name: '平台区 1号，有样品盘，测试完成' })
    fireEvent.click(selected)
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).toHaveClass('occupancy-occupied', 'test-completed')
    expect(screen.getByRole('region', { name: '孔位 1 样品信息' })).toHaveTextContent('QR123456')
    expect(screen.getByRole('region', { name: '样品架二维码信息' })).toHaveTextContent('PLATE-001')
    expect(screen.getByRole('img', { name: '样品架二维码 PLATE-001' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '孔位 1 样品二维码 QR123456' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '扫描平台区二维码' }))
    expect(onScanQr).toHaveBeenCalledWith({ areaType: 'platform', areaId: 1 })
  })

  it('根据当前孔位有无样品切换进样和退样按钮', () => {
    const statuses = createFloorStatusPreview()
    const onSampleIn = vi.fn(async () => undefined)
    const onSampleOut = vi.fn(async () => undefined)
    renderFloor({ statuses, onSampleIn, onSampleOut })

    fireEvent.click(screen.getByRole('button', { name: '平台区 3号，有样品盘，正在测试' }))
    const qrAction = screen.getByRole('button', { name: '扫描平台区二维码' })
    const sampleIn = screen.getByRole('button', { name: '进样' })
    const sampleOut = screen.getByRole('button', { name: '退样' })
    expect(qrAction).toBeEnabled()
    expect(sampleIn).toBeEnabled()
    expect(sampleOut).toBeDisabled()
    fireEvent.click(sampleIn)
    expect(onSampleIn).toHaveBeenCalledWith({ areaType: 'platform', areaId: 3 }, expect.objectContaining({ positionId: 1, hasSample: true }))

    fireEvent.click(screen.getByRole('button', { name: '孔位 4，无样品' }))
    expect(sampleIn).toBeDisabled()
    expect(sampleOut).toBeEnabled()
    fireEvent.click(sampleOut)
    expect(onSampleOut).toHaveBeenCalledWith({ areaType: 'platform', areaId: 3 }, expect.objectContaining({ positionId: 4, hasSample: false }))
  })

  it('平台 1 和 2 区分空孔与未知孔位，并只允许明确空孔退样', () => {
    renderFloor({ statuses: createFloorStatusPreview() })
    fireEvent.click(screen.getByRole('button', { name: '平台区 1号，有样品盘，测试完成' }))

    const sampleIn = screen.getByRole('button', { name: '进样' })
    const sampleOut = screen.getByRole('button', { name: '退样' })
    const emptyTube = screen.getByRole('button', { name: '孔位 4，无样品' })
    const unknownTube = screen.getByRole('button', { name: '孔位 10，未知孔位' })

    expect(emptyTube).toHaveClass('sample-empty')
    expect(unknownTube).toHaveClass('sample-unknown')
    fireEvent.click(emptyTube)
    expect(sampleIn).toBeDisabled()
    expect(sampleOut).toBeEnabled()
    fireEvent.click(unknownTube)
    expect(sampleIn).toBeDisabled()
    expect(sampleOut).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '平台区 2号，有样品盘，盘位有问题' }))
    fireEvent.click(screen.getByRole('button', { name: '孔位 4，无样品' }))
    expect(sampleOut).toBeEnabled()
  })

  it('详情只保留测试状态，并按 1 到 10 展示样品架孔位和样品号', () => {
    renderFloor({ statuses: createFloorStatusPreview() })
    fireEvent.click(screen.getByRole('button', { name: '平台区 3号，有样品盘，正在测试' }))

    expect(screen.getAllByText('测试状态')).toHaveLength(1)
    expect(screen.getByText('正在测试')).toBeInTheDocument()
    expect(screen.queryByText('样品状态')).not.toBeInTheDocument()
    expect(screen.queryByText('区域用途')).not.toBeInTheDocument()
    expect(screen.queryByText('识别置信度')).not.toBeInTheDocument()
    expect(screen.queryByText('更新时间')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '样品架' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getAllByRole('listitem').every((item) => !item.querySelector('svg'))).toBe(true)
    const completedTube = screen.getByRole('button', { name: '孔位 1，有样品，测试完成' })
    expect(completedTube).toHaveTextContent('01')
    expect(completedTube).not.toHaveTextContent('有样品')
    expect(completedTube).toHaveClass('sample-present', 'test-completed')
    expect(screen.getByRole('button', { name: '孔位 2，有样品，样品故障' })).toHaveClass('test-problem')
    expect(screen.getByRole('button', { name: '孔位 3，有样品，测试完成' })).toHaveClass('test-completed')
    const emptyTube = screen.getByRole('button', { name: '孔位 4，无样品' })
    expect(emptyTube).toHaveClass('sample-empty')
    expect(emptyTube).not.toHaveTextContent('空孔')
    expect(emptyTube.querySelector('.sample-status-lamp')).not.toBeInTheDocument()
    const tubeTen = screen.getByRole('button', { name: '孔位 10，有样品，测试完成' })
    fireEvent.click(tubeTen)
    expect(tubeTen).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: '孔位 10 样品信息' })).toHaveTextContent('S03-10')
    expect(screen.getByRole('region', { name: '样品架二维码信息' })).toHaveTextContent('PLATE-03')
    expect(screen.getByRole('region', { name: '孔位 10 样品信息' })).toHaveTextContent('测试完成')
    fireEvent.click(emptyTube)
    expect(screen.getByRole('region', { name: '孔位 4 样品信息' })).toHaveTextContent('孔位 04')
    expect(screen.getByRole('region', { name: '孔位 4 样品信息' })).not.toHaveTextContent('无样品')
    expect(screen.getByRole('region', { name: '孔位 4 样品信息' }).querySelector('.sample-detail-test i')).not.toBeInTheDocument()
  })

  it('分别呈现样品占用状态和平台测试灯状态', () => {
    renderFloor({
      statuses: {
        [floorStatusKey('platform', 2)]: { occupancy: 'empty', testState: 'testing' },
        [floorStatusKey('test_area', 1)]: { occupancy: 'occupied' },
      },
    })

    expect(screen.getByRole('button', { name: '平台区 2号，无样品盘，正在测试' })).toHaveClass('occupancy-empty', 'test-testing')
    expect(screen.getByRole('button', { name: '测试区 1号，有样品' })).toHaveClass('occupancy-occupied', 'test-na')
  })

  it('把三色灯模式映射为完成、问题和测试中', () => {
    expect(platformTestStateFromMode('green')).toBe('completed')
    expect(platformTestStateFromMode('green_flash')).toBe('completed')
    expect(platformTestStateFromMode('red')).toBe('problem')
    expect(platformTestStateFromMode('blue_flash')).toBe('testing')
    expect(platformTestStateFromMode('off')).toBe('idle')
  })

  it('默认预览覆盖常见的占用与测试状态组合', () => {
    const statuses = createFloorStatusPreview()
    renderFloor({ statuses })

    expect(screen.queryByText('样式预览')).not.toBeInTheDocument()
    const completed = screen.getByRole('button', { name: '平台区 1号，有样品盘，测试完成' })
    fireEvent.click(completed)
    expect(screen.getByText('选中位置 · 样式示意')).toBeInTheDocument()
    expect(completed).toHaveClass('test-completed')
    expect(completed.querySelector('.slot-lamp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '平台区 2号，有样品盘，盘位有问题' })).toHaveClass('test-problem')
    expect(screen.getByRole('button', { name: '平台区 3号，有样品盘，正在测试' })).toHaveClass('test-testing', 'test-flashing')
    const idle = screen.getByRole('button', { name: '平台区 4号，无样品盘，未测试' })
    expect(idle).toHaveClass('occupancy-empty', 'test-idle')
    expect(idle.querySelector('.slot-lamp')).not.toBeInTheDocument()
    fireEvent.click(idle)
    expect(screen.getByText('未测试').querySelector('i')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中转区 1号，有样品盘' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '测试区 2号，无样品' })).toBeInTheDocument()
  })

  it('测试状态未知时不显示中性灯点', () => {
    renderFloor()
    const unknown = screen.getByRole('button', { name: '平台区 10号，占用状态未读取，测试状态未读取' })
    expect(unknown.querySelector('.slot-lamp')).not.toBeInTheDocument()
  })

  it('详情抽屉默认收起，点击盘位打开，点击空白处关闭', () => {
    renderFloor()
    const drawer = screen.getByTestId('slot-inspector')
    const main = screen.getByRole('main')
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(drawer).not.toHaveClass('open')
    expect(main).not.toHaveClass('drawer-open')

    fireEvent.click(screen.getByRole('button', { name: '平台区 10号，占用状态未读取，测试状态未读取' }))
    expect(drawer).toHaveAttribute('aria-hidden', 'false')
    expect(drawer).toHaveClass('open')
    expect(main).toHaveClass('drawer-open')

    fireEvent.click(main)
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(drawer).not.toHaveClass('open')
    expect(main).not.toHaveClass('drawer-open')
  })
})
