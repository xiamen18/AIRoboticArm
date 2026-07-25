import { describe, expect, it } from 'vitest'
import { getProtocolError } from './errors'

describe('协议错误码映射', () => {
  it('安全保护错误提示包含安全雷达', () => {
    expect(getProtocolError(2004)).toEqual({
      source: 'safety',
      message: '安全门、安全区域或安全雷达触发',
      suggestion: '确认安全门、安全区域和安全雷达状态。',
    })
  })

  it('使用顶针控制失败说明', () => {
    expect(getProtocolError(5003)?.message).toBe('顶针控制失败')
  })

  it('使用新版电爪运行故障说明', () => {
    expect(getProtocolError(8004)).toEqual({
      source: 'gripper',
      message: '电爪运行故障',
      suggestion: '查询电爪状态并根据 fault_status 排查故障。',
    })
  })

  it('整机参数范围提示包含位置', () => {
    expect(getProtocolError(9002)?.suggestion).toContain('位置')
  })
})
