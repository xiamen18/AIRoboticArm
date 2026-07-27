// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandNav } from './CommandNav'

afterEach(cleanup)

describe('CommandNav', () => {
  it('展示 8 个模块和全部 24 条命令', () => {
    render(<CommandNav selected="heartbeat" onSelect={() => undefined} />)
    expect(screen.getAllByRole('button')).toHaveLength(24)
    expect(screen.getByText('24 CMD')).toBeInTheDocument()
    expect(screen.getByText('通用控制')).toBeInTheDocument()
    expect(screen.getByText('整机参数')).toBeInTheDocument()
    expect(screen.getByText('四轴运动')).toBeInTheDocument()
    expect(screen.getByText('机械臂点控')).toBeInTheDocument()
    expect(screen.getByText('点动控制')).toBeInTheDocument()
    expect(screen.getByText('三色灯状态')).toBeInTheDocument()
    expect(screen.getByText('顶针控制')).toBeInTheDocument()
    expect(screen.getByText('样品搬运（单进样/单退样）')).toBeInTheDocument()
    expect(screen.getByText('样品进退样')).toBeInTheDocument()
    expect(screen.queryByText('样品释放')).not.toBeInTheDocument()
    expect(screen.getByText('安全雷达')).toBeInTheDocument()
    expect(screen.getByText('安全雷达状态')).toBeInTheDocument()
    expect(screen.queryByText('安全雷达屏蔽')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      '通用控制',
      '样品流程',
      '横移杆',
      '三色灯',
      '机械臂',
      '电爪',
      '安全雷达',
      '整机参数',
    ])
  })

  it('点击命令时返回协议 cmd', () => {
    const onSelect = vi.fn()
    render(<CommandNav selected="heartbeat" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /二维码识别/ }))
    expect(onSelect).toHaveBeenCalledWith('scan_qrcode')
  })
})
