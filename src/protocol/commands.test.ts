import { describe, expect, it } from 'vitest'
import { buildRequest, COMMAND_MAP, COMMANDS, createRequestId, DEVICE_COMMANDS, GRIPPER_ACTIONS, GRIPPER_DEVICES, MACHINE_PARAM_MODULES, normalizeParams, parseRawRequest, syncSampleNulls, TRICOLOR_LIGHT_MODES } from './commands'

describe('协议命令注册表', () => {
  it('完整注册 24 条唯一命令', () => {
    expect(COMMANDS).toHaveLength(24)
    expect(new Set(COMMANDS.map((command) => command.cmd))).toHaveLength(24)
    expect(COMMAND_MAP.size).toBe(24)
    expect(COMMAND_MAP.has('set_safety_radar_mask')).toBe(false)
  })

  it.each(COMMANDS.filter((item) => !['move_plate', 'move_sample', 'move_sample_in_out'].includes(item.cmd)))('$cmd 默认参数可通过 schema', (definition) => {
    expect(definition.schema.safeParse(definition.defaults).success).toBe(true)
  })

  it('搬运命令要求用户填写真实二维码后才能发送', () => {
    expect(COMMAND_MAP.get('move_plate')!.schema.safeParse(COMMAND_MAP.get('move_plate')!.defaults).success).toBe(false)
    expect(COMMAND_MAP.get('move_sample')!.schema.safeParse(COMMAND_MAP.get('move_sample')!.defaults).success).toBe(false)
    expect(COMMAND_MAP.get('move_sample_in_out')!.schema.safeParse(COMMAND_MAP.get('move_sample_in_out')!.defaults).success).toBe(false)
  })

  it.each(DEVICE_COMMANDS)('接受整机命令 %s', (command) => {
    expect(COMMAND_MAP.get('device_command')!.schema.safeParse({ command }).success).toBe(true)
  })

  it('拒绝协议已删除的整机中止命令', () => {
    expect(COMMAND_MAP.get('device_command')!.schema.safeParse({ command: 'abort' }).success).toBe(false)
  })
})

describe('条件参数与数组约束', () => {
  it('所有专用命令都把 area_id 解析为整数', () => {
    const cases: Array<{ cmd: string; params: Record<string, unknown>; count: number }> = [
      { cmd: 'scan_qrcode', params: { area_type: 'platform', area_id: '5' }, count: 1 },
      {
        cmd: 'move_plate',
        params: {
          source: { area_type: 'transfer', area_id: '1', plate_qr_code: 'PLATE-1' },
          target: { area_type: 'platform', area_id: '5' },
        },
        count: 2,
      },
      {
        cmd: 'move_sample',
        params: {
          source: { area_type: 'platform', area_id: '5', plate_qr_code: 'PLATE-1', hole_id: 1, sample_qr_code: 'SAMPLE-1' },
          target: { area_type: 'test_area', area_id: '1', plate_qr_code: 'NULL', hole_id: 'NULL' },
        },
        count: 2,
      },
      {
        cmd: 'move_sample_in_out',
        params: {
          sample_in: {
            source: { area_type: 'platform', area_id: '5', plate_qr_code: 'PLATE-1', hole_id: 1, sample_qr_code: 'SAMPLE-IN' },
            target: { area_type: 'test_area', area_id: '1', plate_qr_code: 'NULL', hole_id: 'NULL' },
          },
          sample_out: {
            source: { area_type: 'test_area', area_id: '1', plate_qr_code: 'NULL', hole_id: 'NULL', sample_qr_code: 'SAMPLE-OUT' },
            target: { area_type: 'platform', area_id: '6', plate_qr_code: 'PLATE-2', hole_id: 2 },
          },
        },
        count: 4,
      },
      { cmd: 'set_rgb_light', params: { body: [{ area_id: '1', mode: 'green' }, { area_id: '2', mode: 'red_flash' }] }, count: 2 },
      { cmd: 'robot_point_control', params: { area_type: 'transfer', area_id: '4', point_type: 'photo' }, count: 1 },
    ]

    const collectAreaIds = (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value.flatMap(collectAreaIds)
      if (!value || typeof value !== 'object') return []
      return Object.entries(value).flatMap(([key, item]) => key === 'area_id' ? [item] : collectAreaIds(item))
    }

    for (const testCase of cases) {
      const parsed = COMMAND_MAP.get(testCase.cmd)!.schema.parse(testCase.params)
      const areaIds = collectAreaIds(parsed)
      expect(areaIds).toHaveLength(testCase.count)
      expect(areaIds.every((areaId) => typeof areaId === 'number' && Number.isInteger(areaId))).toBe(true)
    }
  })

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

  it('样品进退样校验两个任务并同步嵌套 test_area 的 NULL 字段', () => {
    const definition = COMMAND_MAP.get('move_sample_in_out')!
    const params = syncSampleNulls(definition.defaults)
    const sampleIn = params.sample_in as Record<string, Record<string, unknown>>
    const sampleOut = params.sample_out as Record<string, Record<string, unknown>>

    sampleIn.source.plate_qr_code = 'PLATE-IN'
    sampleIn.source.sample_qr_code = 'SAMPLE-IN'
    sampleOut.source.sample_qr_code = 'SAMPLE-OUT'
    sampleOut.target.plate_qr_code = 'PLATE-OUT'

    expect(definition.schema.safeParse(params).success).toBe(true)
    expect(sampleIn.target).toMatchObject({ area_type: 'test_area', plate_qr_code: 'NULL', hole_id: 'NULL' })
    expect(sampleOut.source).toMatchObject({ area_type: 'test_area', plate_qr_code: 'NULL', hole_id: 'NULL' })

    const invalidDirection = structuredClone(params)
    ;(invalidDirection.sample_in as Record<string, Record<string, unknown>>).target = {
      area_type: 'platform', area_id: 1, plate_qr_code: 'PLATE-TARGET', hole_id: 1,
    }
    expect(definition.schema.safeParse(invalidDirection).success).toBe(false)
  })

  it('拒绝重复灯光区域', () => {
    const light = COMMAND_MAP.get('set_rgb_light')!.schema.safeParse({ body: [
      { area_id: 1, mode: 'red' }, { area_id: 1, mode: 'green_flash' },
    ] })
    expect(light.success).toBe(false)
  })

  it.each(TRICOLOR_LIGHT_MODES)('接受三色灯模式 %s', (mode) => {
    const result = COMMAND_MAP.get('set_rgb_light')!.schema.safeParse({ body: [{ area_id: 1, mode }] })
    expect(result.success).toBe(true)
  })

  it('拒绝未定义的三色灯模式', () => {
    const result = COMMAND_MAP.get('set_rgb_light')!.schema.safeParse({ body: [{ area_id: 1, mode: 'purple' }] })
    expect(result.success).toBe(false)
  })

  it('四轴运动直接接受同一 params 下的 X/Y/Z/RZ 坐标', () => {
    const schema = COMMAND_MAP.get('robot_axis_move')!.schema
    expect(schema.safeParse({ mode: 'absolute', x: 10, y: 20, z: 150, rz: 0, speed: 50 }).success).toBe(true)
    expect(schema.safeParse({ mode: 'relative', x: -1, y: 0, z: 2.5, rz: -5 }).success).toBe(true)
  })

  it('四轴运动拒绝旧 body、缺失坐标和已删除的加速度', () => {
    const schema = COMMAND_MAP.get('robot_axis_move')!.schema
    expect(schema.safeParse({ body: [{ axis: 'axis1', target: 10 }] }).success).toBe(false)
    expect(schema.safeParse({ mode: 'absolute', x: 10, y: 20, z: 150 }).success).toBe(false)
    expect(schema.safeParse({ mode: 'absolute', x: 10, y: 20, z: 150, rz: 0, acc: 100 }).success).toBe(false)
  })

  it('机械臂点控按区域类型限制区域编号', () => {
    const schema = COMMAND_MAP.get('robot_point_control')!.schema
    expect(schema.safeParse({ area_type: 'transfer', area_id: 4, point_type: 'photo' }).success).toBe(true)
    expect(schema.safeParse({ area_type: 'transfer', area_id: 5, point_type: 'photo' }).success).toBe(false)
    expect(schema.safeParse({ area_type: 'platform', area_id: 29, point_type: 'grab' }).success).toBe(true)
    expect(schema.safeParse({ area_type: 'test_area', area_id: 3, point_type: 'grab' }).success).toBe(false)
  })

  it('点动速度可省略，填写时范围为 0-100', () => {
    const schema = COMMAND_MAP.get('robot_jog_control')!.schema
    expect(schema.safeParse({ axis: 'X', direction: 'positive' }).success).toBe(true)
    expect(schema.safeParse({ axis: 'RZ', direction: 'stop', speed: '' }).success).toBe(true)
    expect(schema.safeParse({ axis: 'Y', direction: 'negative', speed: 0 }).success).toBe(true)
    expect(schema.safeParse({ axis: 'Z', direction: 'positive', speed: 100 }).success).toBe(true)
    expect(schema.safeParse({ axis: 'X', direction: 'positive', speed: -0.1 }).success).toBe(false)
    expect(schema.safeParse({ axis: 'X', direction: 'positive', speed: 100.1 }).success).toBe(false)
  })

  it.each(GRIPPER_DEVICES.flatMap((device) => GRIPPER_ACTIONS.map((action) => [device, action] as const)))('接受电爪设备 %s 的 %s 动作', (device, action) => {
    expect(COMMAND_MAP.get('gripper_control')!.schema.safeParse({ device, action }).success).toBe(true)
  })

  it('电爪控制拒绝旧的目标位置和速度参数', () => {
    const schema = COMMAND_MAP.get('gripper_control')!.schema
    expect(schema.safeParse({ action: 'move_to', position: 25, speed: 50 }).success).toBe(false)
    expect(schema.safeParse({ device: 'tube', action: 'close', position: 25 }).success).toBe(false)
  })

  it('整机参数设置拒绝已删除的机械臂加速度和横移杆速度', () => {
    const definition = COMMAND_MAP.get('set_machine_param')!
    const withRobotAcc = structuredClone(definition.defaults)
    ;(withRobotAcc.robot as Record<string, unknown>).acc = 100
    expect(definition.schema.safeParse(withRobotAcc).success).toBe(false)

    const withCrossbarSpeed = structuredClone(definition.defaults)
    ;(withCrossbarSpeed.crossbar as Record<string, unknown>).speed = 50
    expect(definition.schema.safeParse(withCrossbarSpeed).success).toBe(false)
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

  it('将八个查询模块转换为空对象字段', () => {
    const params = normalizeParams('get_machine_param', { modules: [...MACHINE_PARAM_MODULES] })
    expect(params).toEqual(Object.fromEntries(MACHINE_PARAM_MODULES.map((module) => [module, {}])))
  })

  it('只发送已启用的参数模块并移除空值', () => {
    const params = normalizeParams('set_machine_param', {
      robot: { enabled: true, speed: 50, save: false },
      camera: { enabled: false, exposure: 20, save: false },
    })
    expect(params).toEqual({ robot: { speed: 50, save: false } })
  })

  it('整机参数设置发送电爪的样品架、试管和松开位置', () => {
    const params = normalizeParams('set_machine_param', {
      gripper: {
        enabled: true,
        speed: 50,
        rack_force: 20,
        tube_force: 30,
        rack_position: 25,
        tube_position: 10,
        release_position: 40,
        save: true,
      },
    })
    expect(params).toEqual({
      gripper: { speed: 50, rack_force: 20, tube_force: 30, rack_position: 25, tube_position: 10, release_position: 40, save: true },
    })
  })

  it('通过整机参数设置发送横移杆、安全雷达和样品流程参数', () => {
    const definition = COMMAND_MAP.get('set_machine_param')!
    const formParams = structuredClone(definition.defaults)
    for (const module of MACHINE_PARAM_MODULES) {
      ;(formParams[module] as Record<string, unknown>).enabled = !['robot', 'gripper', 'camera'].includes(module)
    }

    const request = buildRequest(definition.cmd, definition.schema.parse(formParams), 'REQ-PARAM-1')
    expect(request.params).toEqual({
      crossbar: { action_timeout: 30, save: false },
      safety_radar: { near_alarm_masked: false, far_alarm_masked: false, save: false },
      move_plate: { plate_pick_height: 120, lift_height: 50, place_height: 110, save: false },
      move_sample: { tube_pick_height: 80, lift_height: 40, place_height: 75, test_area_tube_pick_height: 95, test_area_tube_lift_height: 45, test_area_tube_place_height: 90, save: false },
      move_sample_in_out: { position_3_wait_time: 3, save: false },
    })
  })

  it('原始模式允许未知命令但校验通用格式', () => {
    const request = parseRawRequest(JSON.stringify({ msg_type: 'command', cmd: 'future_cmd', request_id: 'CUSTOM-1', params: {} }))
    expect(request.cmd).toBe('future_cmd')
    expect(() => parseRawRequest('{bad json')).toThrow('合法 JSON')
  })

  it('构建标准命令报文', () => {
    expect(buildRequest('heartbeat', {}, 'REQ-1')).toEqual({ msg_type: 'command', cmd: 'heartbeat', request_id: 'REQ-1', params: {} })
  })

  it('样品进退样请求同时保留 sample_in 和 sample_out', () => {
    const definition = COMMAND_MAP.get('move_sample_in_out')!
    const params = syncSampleNulls(definition.defaults)
    const sampleIn = params.sample_in as Record<string, Record<string, unknown>>
    const sampleOut = params.sample_out as Record<string, Record<string, unknown>>
    sampleIn.source.plate_qr_code = 'PLATE-IN'
    sampleIn.source.sample_qr_code = 'SAMPLE-IN'
    sampleOut.source.sample_qr_code = 'SAMPLE-OUT'
    sampleOut.target.plate_qr_code = 'PLATE-OUT'

    const request = buildRequest(definition.cmd, definition.schema.parse(params), 'REQ-SAMPLE-1')
    expect(request.cmd).toBe('move_sample_in_out')
    expect(request.params).toHaveProperty('sample_in')
    expect(request.params).toHaveProperty('sample_out')
  })

  it('三色灯请求只包含区域和模式，不再生成 RGB 通道值', () => {
    const definition = COMMAND_MAP.get('set_rgb_light')!
    const params = definition.schema.parse(definition.defaults)
    expect(buildRequest(definition.cmd, params, 'REQ-LIGHT-1')).toEqual({
      msg_type: 'command',
      cmd: 'set_rgb_light',
      request_id: 'REQ-LIGHT-1',
      params: { body: [{ area_id: 1, mode: 'green' }] },
    })
  })

  it('四轴运动请求直接携带四个坐标，不包含 body 或 acc', () => {
    const definition = COMMAND_MAP.get('robot_axis_move')!
    const params = definition.schema.parse(definition.defaults)
    const request = buildRequest(definition.cmd, params, 'REQ-ROBOT-1')

    expect(request.params).toEqual({ mode: 'absolute', x: 10, y: 20, z: 150, rz: 0, speed: 50 })
    expect(request.params).not.toHaveProperty('body')
    expect(request.params).not.toHaveProperty('acc')
  })

  it('电爪控制请求只包含设备和开合动作', () => {
    const definition = COMMAND_MAP.get('gripper_control')!
    const params = definition.schema.parse({ device: 'tube', action: 'close' })

    expect(buildRequest(definition.cmd, params, 'REQ-GRIPPER-1')).toEqual({
      msg_type: 'command',
      cmd: 'gripper_control',
      request_id: 'REQ-GRIPPER-1',
      params: { device: 'tube', action: 'close' },
    })
  })

})
