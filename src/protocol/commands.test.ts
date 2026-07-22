import { describe, expect, it } from 'vitest'
import { buildRequest, COMMAND_MAP, COMMANDS, createRequestId, normalizeParams, parseRawRequest, syncSampleNulls } from './commands'

describe('协议命令注册表', () => {
  it('完整注册 19 条唯一命令', () => {
    expect(COMMANDS).toHaveLength(19)
    expect(new Set(COMMANDS.map((command) => command.cmd))).toHaveLength(19)
    expect(COMMAND_MAP.size).toBe(19)
  })

  it.each(COMMANDS.filter((item) => !['move_plate', 'move_sample'].includes(item.cmd)))('$cmd 默认参数可通过 schema', (definition) => {
    expect(definition.schema.safeParse(definition.defaults).success).toBe(true)
  })

  it('搬运命令要求用户填写真实二维码后才能发送', () => {
    expect(COMMAND_MAP.get('move_plate')!.schema.safeParse(COMMAND_MAP.get('move_plate')!.defaults).success).toBe(false)
    expect(COMMAND_MAP.get('move_sample')!.schema.safeParse(COMMAND_MAP.get('move_sample')!.defaults).success).toBe(false)
  })
})

describe('条件参数与数组约束', () => {
  it('限制不同区域类型的区域编号', () => {
    const schema = COMMAND_MAP.get('scan_qrcode')!.schema
    expect(schema.safeParse({ area_type: 'transfer', area_id: 5 }).success).toBe(false)
    expect(schema.safeParse({ area_type: 'platform', area_id: 29 }).success).toBe(true)
    expect(schema.safeParse({ area_type: 'test_area', area_id: 3 }).success).toBe(false)
  })

  it('要求 test_area 使用字符串 NULL', () => {
    const schema = COMMAND_MAP.get('move_sample')!.schema
    const params = syncSampleNulls(COMMAND_MAP.get('move_sample')!.defaults)
    expect(schema.safeParse(params).success).toBe(false)
    const valid = structuredClone(params)
    ;(valid.source as Record<string, unknown>).plate_qr_code = 'PLATE-001'
    ;(valid.source as Record<string, unknown>).sample_qr_code = 'SAMPLE-001'
    expect(schema.safeParse(valid).success).toBe(true)
    expect((valid.target as Record<string, unknown>).hole_id).toBe('NULL')
  })

  it('拒绝重复灯光区域与重复机械轴', () => {
    const rgb = COMMAND_MAP.get('set_rgb_light')!.schema.safeParse({ body: [
      { area_id: 1, r: 0, g: 0, b: 0 }, { area_id: 1, r: 1, g: 1, b: 1 },
    ] })
    const axes = COMMAND_MAP.get('robot_axis_move')!.schema.safeParse({ body: [
      { axis: 'axis1', mode: 'absolute', target: 0 }, { axis: 'axis1', mode: 'relative', target: 1 },
    ] })
    expect(rgb.success).toBe(false)
    expect(axes.success).toBe(false)
  })
})

describe('请求生成', () => {
  it('生成稳定格式且唯一的 request_id', () => {
    const now = new Date('2026-07-17T08:00:00.123Z')
    const first = createRequestId(now)
    const second = createRequestId(now)
    expect(first).toMatch(/^REQ\d{17}\d{4}$/)
    expect(second).not.toBe(first)
  })

  it('将查询模块数组转换为空对象字段', () => {
    expect(normalizeParams('get_machine_param', { modules: ['robot', 'camera'] })).toEqual({ robot: {}, camera: {} })
  })

  it('只发送已启用的参数模块并移除空值', () => {
    const params = normalizeParams('set_machine_param', {
      robot: { enabled: true, speed: 50, acc: '', save: false },
      camera: { enabled: false, exposure: 20, save: false },
    })
    expect(params).toEqual({ robot: { speed: 50, save: false } })
  })

  it('原始模式允许未知命令但校验通用格式', () => {
    const request = parseRawRequest(JSON.stringify({ msg_type: 'command', cmd: 'future_cmd', request_id: 'CUSTOM-1', params: {} }))
    expect(request.cmd).toBe('future_cmd')
    expect(() => parseRawRequest('{bad json')).toThrow('合法 JSON')
  })

  it('构建标准命令报文', () => {
    expect(buildRequest('heartbeat', {}, 'REQ-1')).toEqual({ msg_type: 'command', cmd: 'heartbeat', request_id: 'REQ-1', params: {} })
  })
})
