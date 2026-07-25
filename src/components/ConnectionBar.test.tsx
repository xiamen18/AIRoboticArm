// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectionBar } from './ConnectionBar'

afterEach(cleanup)

describe('ConnectionBar', () => {
  it('允许在连接前配置响应超时', () => {
    const onTimeoutChange = vi.fn()
    render(
      <ConnectionBar
        host="127.0.0.1"
        port="5001"
        timeoutSeconds="5"
        state="disconnected"
        pulse="idle"
        onHostChange={() => undefined}
        onPortChange={() => undefined}
        onTimeoutChange={onTimeoutChange}
        onConnect={() => undefined}
        onDisconnect={() => undefined}
      />,
    )

    const timeout = screen.getByRole('spinbutton', { name: '响应超时 (s)' })
    expect(timeout).toHaveValue(5)
    fireEvent.change(timeout, { target: { value: '12.5' } })
    expect(onTimeoutChange).toHaveBeenCalledWith('12.5')
  })
})
