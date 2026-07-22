// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandNav } from './CommandNav'

afterEach(cleanup)

describe('CommandNav', () => {
  it('展示 7 个模块和全部 19 条命令', () => {
    render(<CommandNav selected="heartbeat" onSelect={() => undefined} />)
    expect(screen.getAllByRole('button')).toHaveLength(19)
    expect(screen.getByText('通用控制')).toBeInTheDocument()
    expect(screen.getByText('整机参数')).toBeInTheDocument()
    expect(screen.getByText('四轴运动')).toBeInTheDocument()
  })

  it('点击命令时返回协议 cmd', () => {
    const onSelect = vi.fn()
    render(<CommandNav selected="heartbeat" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /二维码识别/ }))
    expect(onSelect).toHaveBeenCalledWith('scan_qrcode')
  })
})
