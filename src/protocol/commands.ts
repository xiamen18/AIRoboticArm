import { z } from 'zod'
import type { CommandRequest } from '../shared/types'

export type CommandGroup = '通用控制' | '样品流程' | '横移杆' | '三色灯' | '机械臂' | '电爪' | '整机参数'
export type CommandKind = 'query' | 'control' | 'critical'

export interface CommandDefinition {
  cmd: string
  name: string
  description: string
  group: CommandGroup
  kind: CommandKind
  schema: z.ZodType<Record<string, unknown>>
  defaults: Record<string, unknown>
}

const numberIn = (min: number, max: number, label: string) =>
  z.coerce.number().min(min, `${label}不能小于 ${min}`).max(max, `${label}不能大于 ${max}`)
const optionalNumber = z.preprocess((value) => value === '' || value === undefined ? undefined : value, z.coerce.number().optional())
const nonEmpty = (label: string) => z.string().trim().min(1, `${label}不能为空`)
const areaType = z.enum(['transfer', 'platform', 'test_area'])
const plateAreaType = z.enum(['transfer', 'platform'])

function maxArea(type: string): number {
  if (type === 'transfer') return 4
  if (type === 'test_area') return 2
  return 29
}

const areaSchema = z.object({
  area_type: areaType,
  area_id: z.coerce.number().int().min(1),
}).superRefine((value, context) => {
  const max = maxArea(value.area_type)
  if (value.area_id > max) context.addIssue({ code: 'custom', path: ['area_id'], message: `${value.area_type} 区域编号范围为 1-${max}` })
})

const plateAreaSchema = z.object({
  area_type: plateAreaType,
  area_id: z.coerce.number().int().min(1),
}).superRefine((value, context) => {
  const max = maxArea(value.area_type)
  if (value.area_id > max) context.addIssue({ code: 'custom', path: ['area_id'], message: `${value.area_type} 区域编号范围为 1-${max}` })
})

const sampleEndpointSchema = z.object({
  area_type: areaType,
  area_id: z.coerce.number().int().min(1),
  plate_qr_code: z.string(),
  hole_id: z.union([z.coerce.number().int(), z.literal('NULL')]),
}).superRefine((value, context) => {
  const max = maxArea(value.area_type)
  if (value.area_id > max) context.addIssue({ code: 'custom', path: ['area_id'], message: `${value.area_type} 区域编号范围为 1-${max}` })
  if (value.area_type === 'test_area') {
    if (value.plate_qr_code !== 'NULL') context.addIssue({ code: 'custom', path: ['plate_qr_code'], message: 'test_area 的样品盘二维码必须为 NULL' })
    if (value.hole_id !== 'NULL') context.addIssue({ code: 'custom', path: ['hole_id'], message: 'test_area 的孔位必须为 NULL' })
  } else {
    if (!value.plate_qr_code.trim() || value.plate_qr_code === 'NULL') context.addIssue({ code: 'custom', path: ['plate_qr_code'], message: '请输入样品盘二维码' })
    if (typeof value.hole_id !== 'number' || value.hole_id < 1 || value.hole_id > 10) context.addIssue({ code: 'custom', path: ['hole_id'], message: '孔位范围为 1-10' })
  }
})

const emptySchema = z.object({})
const actionResultDefaults = {}

export const COMMANDS: CommandDefinition[] = [
  { cmd: 'heartbeat', name: '心跳', description: '检查设备在线状态、时间和设备信息', group: '通用控制', kind: 'query', schema: emptySchema, defaults: {} },
  { cmd: 'get_device_status', name: '设备状态查询', description: '查询总体、流程或模块状态', group: '通用控制', kind: 'query', schema: z.object({ status_type: z.enum(['UN', 'CM', 'EM', 'all']) }), defaults: { status_type: 'all' } },
  { cmd: 'set_device_mode', name: '设置设备模式', description: '切换自动或维护模式', group: '通用控制', kind: 'control', schema: z.object({ mode: z.enum(['auto', 'maintenance']) }), defaults: { mode: 'auto' } },
  { cmd: 'device_command', name: '整机控制', description: '启动、暂停、停止、中止或复位整机', group: '通用控制', kind: 'critical', schema: z.object({ command: z.enum(['start', 'pause', 'stop', 'abort', 'reset']) }), defaults: { command: 'start' } },
  { cmd: 'get_area_sample_status', name: '区域样品状态', description: '读取指定类型下全部区域的空满状态', group: '样品流程', kind: 'query', schema: z.object({ area_type: areaType }), defaults: { area_type: 'transfer' } },
  { cmd: 'scan_qrcode', name: '二维码识别', description: '识别样品盘与样品二维码', group: '样品流程', kind: 'query', schema: areaSchema, defaults: { area_type: 'platform', area_id: 1 } },
  {
    cmd: 'move_plate', name: '样品盘搬运', description: '在中转区和测试平台之间搬运样品盘', group: '样品流程', kind: 'control',
    schema: z.object({
      source: plateAreaSchema.and(z.object({ plate_qr_code: nonEmpty('样品盘二维码') })),
      target: plateAreaSchema,
    }),
    defaults: { source: { area_type: 'transfer', area_id: 1, plate_qr_code: '' }, target: { area_type: 'platform', area_id: 1 } },
  },
  {
    cmd: 'move_sample', name: '样品搬运', description: '在样品盘和磁体测试区之间搬运单只样品', group: '样品流程', kind: 'control',
    schema: z.object({
      source: sampleEndpointSchema.and(z.object({ sample_qr_code: nonEmpty('样品二维码') })),
      target: sampleEndpointSchema,
    }),
    defaults: {
      source: { area_type: 'platform', area_id: 1, plate_qr_code: '', hole_id: 1, sample_qr_code: '' },
      target: { area_type: 'test_area', area_id: 1, plate_qr_code: 'NULL', hole_id: 'NULL' },
    },
  },
  { cmd: 'get_crossbar_status', name: '横移杆状态', description: '读取位置、阀、传感器和储样筒状态', group: '横移杆', kind: 'query', schema: emptySchema, defaults: {} },
  { cmd: 'move_crossbar', name: '横移杆移动', description: '移动横移杆到位置 1、2 或 3', group: '横移杆', kind: 'control', schema: z.object({ position: numberIn(1, 3, '位置').pipe(z.number().int()) }), defaults: { position: 1 } },
  { cmd: 'release_crossbar_sample', name: '样品释放', description: '控制 D3 气缸释放或保持样品', group: '横移杆', kind: 'control', schema: z.object({ release: z.boolean() }), defaults: { release: true } },
  {
    cmd: 'set_rgb_light', name: '三色灯控制', description: '批量设置测试平台区域灯光颜色', group: '三色灯', kind: 'control',
    schema: z.object({ body: z.array(z.object({ area_id: numberIn(1, 29, '区域编号').pipe(z.number().int()), r: numberIn(0, 255, 'R').pipe(z.number().int()), g: numberIn(0, 255, 'G').pipe(z.number().int()), b: numberIn(0, 255, 'B').pipe(z.number().int()) })).min(1) }).superRefine((value, context) => {
      const ids = value.body.map((item) => item.area_id)
      if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['body'], message: '同一请求内区域编号不能重复' })
    }),
    defaults: { body: [{ area_id: 1, r: 0, g: 255, b: 128 }] },
  },
  { cmd: 'get_robot_status', name: '机械臂状态', description: '读取使能、运动参数与四轴位置', group: '机械臂', kind: 'query', schema: emptySchema, defaults: {} },
  {
    cmd: 'robot_axis_move', name: '四轴运动', description: '控制一个或多个轴绝对或相对运动', group: '机械臂', kind: 'control',
    schema: z.object({ body: z.array(z.object({ axis: z.enum(['axis1', 'axis2', 'axis3', 'axis4']), mode: z.enum(['absolute', 'relative']), target: z.coerce.number(), speed: optionalNumber, acc: optionalNumber })).min(1).max(4) }).superRefine((value, context) => {
      const axes = value.body.map((item) => item.axis)
      if (new Set(axes).size !== axes.length) context.addIssue({ code: 'custom', path: ['body'], message: '同一请求内轴不能重复' })
    }),
    defaults: { body: [{ axis: 'axis1', mode: 'absolute', target: 0, speed: 50, acc: 100 }] },
  },
  { cmd: 'robot_control', name: '机械臂控制', description: '使能、回零、暂停、继续、停止或复位', group: '机械臂', kind: 'critical', schema: z.object({ action: z.enum(['enable', 'disable', 'home', 'pause', 'resume', 'stop', 'reset']) }), defaults: { action: 'enable' } },
  { cmd: 'get_gripper_status', name: '电爪状态', description: '读取开度、速度和动作状态', group: '电爪', kind: 'query', schema: emptySchema, defaults: {} },
  {
    cmd: 'gripper_control', name: '电爪控制', description: '打开、关闭或移动到指定开度', group: '电爪', kind: 'control',
    schema: z.object({ action: z.enum(['open', 'close', 'move_to']), position: optionalNumber, speed: optionalNumber }).superRefine((value, context) => {
      if (value.action === 'move_to' && value.position === undefined) context.addIssue({ code: 'custom', path: ['position'], message: 'move_to 必须填写目标开度' })
    }),
    defaults: { action: 'open', position: '', speed: 50 },
  },
  {
    cmd: 'get_machine_param', name: '整机参数查询', description: '查询全部或指定模块参数', group: '整机参数', kind: 'query',
    schema: z.object({ modules: z.array(z.enum(['robot', 'gripper', 'camera', 'crossbar'])) }), defaults: { modules: [] },
  },
  {
    cmd: 'set_machine_param', name: '整机参数设置', description: '按模块修改并选择是否保存默认参数', group: '整机参数', kind: 'control',
    schema: z.object({
      robot: z.object({ enabled: z.boolean(), speed: optionalNumber, acc: optionalNumber, save: z.boolean() }),
      gripper: z.object({ enabled: z.boolean(), speed: optionalNumber, rack_force: optionalNumber, tube_force: optionalNumber, save: z.boolean() }),
      camera: z.object({ enabled: z.boolean(), exposure: optionalNumber, gain: optionalNumber, save: z.boolean() }),
      crossbar: z.object({ enabled: z.boolean(), speed: optionalNumber, save: z.boolean() }),
    }).superRefine((value, context) => {
      if (![value.robot.enabled, value.gripper.enabled, value.camera.enabled, value.crossbar.enabled].some(Boolean)) {
        context.addIssue({ code: 'custom', message: '至少启用一个参数模块' })
      }
    }),
    defaults: {
      robot: { enabled: true, speed: 50, acc: 100, save: false },
      gripper: { enabled: false, speed: 50, rack_force: 20, tube_force: 30, save: false },
      camera: { enabled: false, exposure: 20, gain: 1.5, save: false },
      crossbar: { enabled: false, speed: 50, save: false },
    },
  },
]

export const COMMAND_MAP = new Map(COMMANDS.map((command) => [command.cmd, command]))
export const COMMAND_GROUPS: CommandGroup[] = ['通用控制', '样品流程', '横移杆', '三色灯', '机械臂', '电爪', '整机参数']

let requestSequence = 0
export function createRequestId(now = new Date()): string {
  requestSequence = (requestSequence + 1) % 10_000
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('')
  return `REQ${timestamp}${String(requestSequence).padStart(4, '0')}`
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => item === undefined || item === '' ? [] : [[key, removeUndefined(item)]]))
  }
  return value
}

export function normalizeParams(cmd: string, params: Record<string, unknown>): Record<string, unknown> {
  if (cmd === 'get_machine_param') {
    const modules = (params.modules as string[]) ?? []
    return Object.fromEntries(modules.map((module) => [module, {}]))
  }
  if (cmd === 'set_machine_param') {
    return Object.fromEntries(Object.entries(params).flatMap(([module, value]) => {
      const fields = value as Record<string, unknown>
      if (!fields.enabled) return []
      const { enabled: _enabled, ...rest } = fields
      return [[module, removeUndefined(rest)]]
    }))
  }
  return removeUndefined(params) as Record<string, unknown>
}

export function buildRequest(cmd: string, params: Record<string, unknown>, requestId = createRequestId()): CommandRequest {
  return { msg_type: 'command', cmd, request_id: requestId, params: normalizeParams(cmd, params) }
}

export function parseRawRequest(raw: string): CommandRequest {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('原始报文不是合法 JSON') }
  const schema = z.object({
    msg_type: z.literal('command'),
    cmd: z.string().trim().min(1),
    request_id: z.string().trim().min(1),
    params: z.record(z.string(), z.unknown()),
  })
  const result = schema.safeParse(value)
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? '原始报文通用字段不合法')
  return result.data
}

export function syncSampleNulls(params: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(params)
  for (const side of ['source', 'target']) {
    const endpoint = next[side] as Record<string, unknown> | undefined
    if (!endpoint) continue
    if (endpoint.area_type === 'test_area') {
      endpoint.plate_qr_code = 'NULL'
      endpoint.hole_id = 'NULL'
    } else {
      if (endpoint.plate_qr_code === 'NULL') endpoint.plate_qr_code = ''
      if (endpoint.hole_id === 'NULL') endpoint.hole_id = 1
    }
  }
  return next
}

export const EMPTY_DEFAULTS = actionResultDefaults
