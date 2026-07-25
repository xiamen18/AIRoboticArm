// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vitest'
import { COMMAND_MAP, DEVICE_COMMANDS, TRICOLOR_LIGHT_MODES } from '../protocol/commands'
import { CommandFields } from './CommandFields'
import type { FormValues } from './FieldParts'

afterEach(cleanup)

function CommandForm({ cmd }: { cmd: string }) {
  const definition = COMMAND_MAP.get(cmd)!
  const form = useForm<FormValues>({ defaultValues: structuredClone(definition.defaults) })

  return (
    <CommandFields
      cmd={definition.cmd}
      register={form.register}
      control={form.control}
      setValue={form.setValue}
      errors={form.formState.errors}
    />
  )
}

describe('三色灯命令表单', () => {
  it('使用七种模式选项替代 RGB 通道输入', () => {
    render(<CommandForm cmd="set_rgb_light" />)

    expect(screen.getByRole('spinbutton', { name: '区域' })).toHaveValue(1)
    const mode = screen.getByRole('combobox', { name: '模式' })
    expect(mode).toHaveValue('green')
    expect(within(mode).getAllByRole('option')).toHaveLength(TRICOLOR_LIGHT_MODES.length)
    expect(screen.queryByRole('spinbutton', { name: 'R' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'G' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'B' })).not.toBeInTheDocument()
  })

  it('整机命令不再提供中止选项', () => {
    render(<CommandForm cmd="device_command" />)

    const command = screen.getByRole('combobox', { name: '整机命令' })
    expect(within(command).getAllByRole('option')).toHaveLength(DEVICE_COMMANDS.length)
    expect(within(command).queryByRole('option', { name: 'abort' })).not.toBeInTheDocument()
  })

  it('三色灯状态查询使用空参数', () => {
    render(<CommandForm cmd="get_rgb_light_status" />)

    expect(screen.getByText('{}')).toBeInTheDocument()
    expect(screen.getByText('此命令不需要参数，可直接发送。')).toBeInTheDocument()
  })
})

describe('样品进退样命令表单', () => {
  it('分别显示进样和退样的源、目标位置，并固定 test_area 端', () => {
    render(<CommandForm cmd="move_sample_in_out" />)

    const sampleInSource = screen.getByRole('group', { name: '进样源位置' })
    const sampleInTarget = screen.getByRole('group', { name: '进样目标位置' })
    const sampleOutSource = screen.getByRole('group', { name: '退样源位置' })
    const sampleOutTarget = screen.getByRole('group', { name: '退样目标位置' })

    expect(within(sampleInSource).getByRole('combobox', { name: '区域类型' })).toHaveValue('platform')
    expect(within(sampleInTarget).getByRole('combobox', { name: '区域类型' })).toHaveValue('test_area')
    expect(within(sampleOutSource).getByRole('combobox', { name: '区域类型' })).toHaveValue('test_area')
    expect(within(sampleOutTarget).getByRole('combobox', { name: '区域类型' })).toHaveValue('platform')
    expect(within(within(sampleInTarget).getByRole('combobox', { name: '区域类型' })).getAllByRole('option')).toHaveLength(1)
    expect(within(within(sampleOutSource).getByRole('combobox', { name: '区域类型' })).getAllByRole('option')).toHaveLength(1)
    expect(within(sampleInSource).getByRole('textbox', { name: '样品二维码' })).toBeInTheDocument()
    expect(within(sampleOutSource).getByRole('textbox', { name: '样品二维码' })).toBeInTheDocument()
  })
})

describe('机械臂命令表单', () => {
  it('四轴运动直接显示模式、四个坐标和速度', () => {
    render(<CommandForm cmd="robot_axis_move" />)

    expect(screen.getByRole('combobox', { name: '模式' })).toHaveValue('absolute')
    expect(screen.getByRole('spinbutton', { name: 'X (mm)' })).toHaveValue(10)
    expect(screen.getByRole('spinbutton', { name: 'Y (mm)' })).toHaveValue(20)
    expect(screen.getByRole('spinbutton', { name: 'Z (mm)' })).toHaveValue(150)
    expect(screen.getByRole('spinbutton', { name: 'RZ (°)' })).toHaveValue(0)
    expect(screen.getByRole('spinbutton', { name: '速度' })).toHaveValue(50)
    expect(screen.queryByText('同步运动轴')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '加速度' })).not.toBeInTheDocument()
  })

  it('机械臂点控显示区域、动态编号和点位类型', () => {
    render(<CommandForm cmd="robot_point_control" />)

    const area = screen.getByRole('combobox', { name: '区域' })
    const areaId = screen.getByRole('spinbutton', { name: '编号' })
    expect(area).toHaveValue('platform')
    expect(areaId).toHaveAttribute('max', '29')
    expect(screen.getByRole('combobox', { name: '类型' })).toHaveValue('photo')

    fireEvent.change(area, { target: { value: 'test_area' } })
    expect(areaId).toHaveAttribute('max', '2')
  })

  it('点动控制显示坐标轴、方向和可留空的速度', () => {
    render(<CommandForm cmd="robot_jog_control" />)

    const axis = screen.getByRole('combobox', { name: '坐标轴' })
    const direction = screen.getByRole('combobox', { name: '运动方向' })
    const speed = screen.getByRole('spinbutton', { name: '速度 (%)' })
    expect(within(axis).getAllByRole('option')).toHaveLength(4)
    expect(within(direction).getAllByRole('option')).toHaveLength(3)
    expect(speed).toHaveValue(null)
    expect(speed).not.toBeRequired()
    expect(speed).toHaveAttribute('min', '0')
    expect(speed).toHaveAttribute('max', '100')
  })
})

describe('电爪命令与参数表单', () => {
  it('电爪控制只显示设备和开合动作', () => {
    render(<CommandForm cmd="gripper_control" />)

    const device = screen.getByRole('combobox', { name: '设备' })
    const action = screen.getByRole('combobox', { name: '动作' })
    expect(device).toHaveValue('rack')
    expect(within(device).getAllByRole('option')).toHaveLength(2)
    expect(action).toHaveValue('open')
    expect(within(action).getAllByRole('option')).toHaveLength(2)
    expect(screen.queryByRole('spinbutton', { name: '目标开度' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '速度' })).not.toBeInTheDocument()
  })

  it('整机参数设置显示样品架和试管位置', () => {
    render(<CommandForm cmd="set_machine_param" />)

    expect(screen.getByRole('spinbutton', { name: '样品架位置' })).toHaveValue(25)
    expect(screen.getByRole('spinbutton', { name: '试管位置' })).toHaveValue(10)
  })
})

describe('横移杆命令表单', () => {
  it('顶针控制保留 release 布尔参数并显示新名称', () => {
    render(<CommandForm cmd="release_crossbar_sample" />)

    expect(screen.getByRole('checkbox', { name: /顶针释放样品/ })).toBeChecked()
    expect(screen.queryByText('释放样品', { exact: true })).not.toBeInTheDocument()
  })
})

describe('安全雷达命令表单', () => {
  it('状态查询使用空参数', () => {
    render(<CommandForm cmd="get_safety_radar_status" />)

    expect(screen.getByText('{}')).toBeInTheDocument()
    expect(screen.getByText('此命令不需要参数，可直接发送。')).toBeInTheDocument()
  })

  it('屏蔽控制同时显示近端和远端开关', () => {
    render(<CommandForm cmd="set_safety_radar_mask" />)

    expect(screen.getByRole('checkbox', { name: /近端告警屏蔽/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /远端告警屏蔽/ })).not.toBeChecked()
  })
})
