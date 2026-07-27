// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandWorkspace } from './CommandWorkspace'

afterEach(cleanup)

function renderWorkspace(cmd: string, connected = false) {
  const onSend = vi.fn().mockResolvedValue(undefined)
  render(
    <CommandWorkspace
      cmd={cmd}
      connected={connected}
      busy={false}
      transaction={null}
      onSend={onSend}
    />,
  )
  return onSend
}

function readRawParams(): Record<string, any> {
  fireEvent.click(screen.getByRole('tab', { name: '原始 JSON' }))
  return JSON.parse((screen.getByRole('textbox', { name: '原始 JSON 报文' }) as HTMLTextAreaElement).value).params
}

describe('命令表单数值类型', () => {
  it('专用表单发送的 area_id 为 number', async () => {
    const onSend = renderWorkspace('scan_qrcode', true)

    fireEvent.change(screen.getByRole('spinbutton', { name: '区域编号' }), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: '发送命令' }))

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce())
    expect(onSend.mock.calls[0][0].params.area_id).toBe(12)
  })

  it('顶层 area_id 切换到原始 JSON 后仍为 number', () => {
    renderWorkspace('scan_qrcode')

    fireEvent.change(screen.getByRole('spinbutton', { name: '区域编号' }), { target: { value: '12' } })

    expect(readRawParams().area_id).toBe(12)
  })

  it('嵌套和数组中的 area_id 切换到原始 JSON 后仍为 number', () => {
    renderWorkspace('move_sample_in_out')

    const sampleInSource = screen.getByRole('group', { name: '进样源位置' })
    const sampleInTarget = screen.getByRole('group', { name: '进样目标位置' })
    const sampleOutSource = screen.getByRole('group', { name: '退样源位置' })
    const sampleOutTarget = screen.getByRole('group', { name: '退样目标位置' })
    fireEvent.change(within(sampleInSource).getByRole('spinbutton', { name: '区域编号' }), { target: { value: '5' } })
    fireEvent.change(within(sampleInTarget).getByRole('spinbutton', { name: '区域编号' }), { target: { value: '2' } })
    fireEvent.change(within(sampleOutSource).getByRole('spinbutton', { name: '区域编号' }), { target: { value: '1' } })
    fireEvent.change(within(sampleOutTarget).getByRole('spinbutton', { name: '区域编号' }), { target: { value: '8' } })

    const params = readRawParams()
    expect(params.sample_in.source.area_id).toBe(5)
    expect(params.sample_in.target.area_id).toBe(2)
    expect(params.sample_out.source.area_id).toBe(1)
    expect(params.sample_out.target.area_id).toBe(8)

    cleanup()
    renderWorkspace('set_rgb_light')
    fireEvent.change(screen.getByRole('spinbutton', { name: '区域' }), { target: { value: '9' } })
    expect(readRawParams().body[0].area_id).toBe(9)
  })

  it('安全雷达屏蔽状态通过整机参数设置生成报文', () => {
    renderWorkspace('set_machine_param')

    fireEvent.click(screen.getByRole('checkbox', { name: 'robot · 机械臂' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'safety_radar · 安全雷达' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '近端告警屏蔽' }))

    expect(readRawParams()).toEqual({
      safety_radar: {
        near_alarm_masked: true,
        far_alarm_masked: false,
        save: false,
      },
    })
  })
})
