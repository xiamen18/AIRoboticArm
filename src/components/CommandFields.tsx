import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useWatch, type FieldErrors, type UseFormRegister, type UseFormSetValue, type Control } from 'react-hook-form'
import { DEVICE_COMMANDS, GRIPPER_ACTIONS, GRIPPER_DEVICES, MACHINE_PARAM_MODULES, TRICOLOR_LIGHT_MODES } from '../protocol/commands'
import { AREA_OPTIONS, Field, PLATE_AREA_OPTIONS, SelectField, type FormValues } from './FieldParts'

interface Props {
  cmd: string
  register: UseFormRegister<FormValues>
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  errors: FieldErrors<FormValues>
}

const enumOptions = (values: readonly string[]) => values.map((value) => ({ value, label: value }))
const errorAt = (errors: FieldErrors<FormValues>, path: string) => path.split('.').reduce<any>((value, key) => value?.[key], errors)
const TRICOLOR_LIGHT_MODE_LABELS: Record<(typeof TRICOLOR_LIGHT_MODES)[number], string> = {
  off: '灭',
  red: '红灯亮',
  green: '绿灯亮',
  blue: '蓝灯亮',
  red_flash: '红灯闪',
  green_flash: '绿灯闪',
  blue_flash: '蓝灯闪',
}
const TRICOLOR_LIGHT_MODE_OPTIONS = TRICOLOR_LIGHT_MODES.map((value) => ({
  value,
  label: `${TRICOLOR_LIGHT_MODE_LABELS[value]} · ${value}`,
}))
const POINT_TYPE_OPTIONS = [
  { value: 'photo', label: 'photo · 拍照点' },
  { value: 'grab', label: 'grab · 抓取点' },
]
const JOG_AXIS_OPTIONS = enumOptions(['X', 'Y', 'Z', 'RZ'])
const JOG_DIRECTION_OPTIONS = [
  { value: 'positive', label: 'positive · 正向' },
  { value: 'negative', label: 'negative · 负向' },
  { value: 'stop', label: 'stop · 停止' },
]
const GRIPPER_DEVICE_OPTIONS = [
  { value: GRIPPER_DEVICES[0], label: `${GRIPPER_DEVICES[0]} · 样品架` },
  { value: GRIPPER_DEVICES[1], label: `${GRIPPER_DEVICES[1]} · 试管` },
]
const GRIPPER_ACTION_OPTIONS = [
  { value: GRIPPER_ACTIONS[0], label: `${GRIPPER_ACTIONS[0]} · 开` },
  { value: GRIPPER_ACTIONS[1], label: `${GRIPPER_ACTIONS[1]} · 合` },
]
const TEST_AREA_OPTIONS = AREA_OPTIONS.slice(2)
const MACHINE_PARAM_MODULE_LABELS: Record<(typeof MACHINE_PARAM_MODULES)[number], string> = {
  robot: '机械臂',
  gripper: '电爪',
  camera: '摄像头',
  crossbar: '横移杆',
  safety_radar: '安全雷达',
  move_plate: '样品盘搬运',
  move_sample: '样品搬运',
  move_sample_in_out: '样品进退样',
}

function AreaFields({ prefix, legend, plateOnly, areaOptions, register, control, errors, includeQr = false, includeHole = false, includeSampleQr = false }: any) {
  const areaType = useWatch({ control, name: `${prefix}.area_type` })
  const isTest = areaType === 'test_area'
  return (
    <fieldset className="field-cluster">
      <legend>{legend ?? (prefix === 'source' ? '源位置' : '目标位置')}</legend>
      <div className="form-grid cols-2">
        <SelectField label="区域类型" name={`${prefix}.area_type`} register={register} options={areaOptions ?? (plateOnly ? PLATE_AREA_OPTIONS : AREA_OPTIONS)} error={errorAt(errors, `${prefix}.area_type`)} />
        <Field label="区域编号" name={`${prefix}.area_id`} register={register} type="number" min={1} max={isTest ? 2 : areaType === 'transfer' ? 4 : 29} error={errorAt(errors, `${prefix}.area_id`)} />
        {includeQr ? <Field label="样品盘二维码" name={`${prefix}.plate_qr_code`} register={register} disabled={isTest} error={errorAt(errors, `${prefix}.plate_qr_code`)} /> : null}
        {includeHole ? <Field label="孔位 ID" name={`${prefix}.hole_id`} register={register} type={isTest ? 'text' : 'number'} disabled={isTest} min={1} max={10} error={errorAt(errors, `${prefix}.hole_id`)} /> : null}
        {includeSampleQr ? <Field label="样品二维码" name={`${prefix}.sample_qr_code`} register={register} error={errorAt(errors, `${prefix}.sample_qr_code`)} /> : null}
      </div>
    </fieldset>
  )
}

function SampleInOutFields({ register, control, errors }: Props) {
  return <div className="sample-in-out-editor">
    <section className="sample-task">
      <div className="sample-task-heading"><span>IN</span><h3>进样任务</h3></div>
      <div className="paired-clusters">
        <AreaFields prefix="sample_in.source" legend="进样源位置" areaOptions={PLATE_AREA_OPTIONS} includeQr includeHole includeSampleQr register={register} control={control} errors={errors} />
        <AreaFields prefix="sample_in.target" legend="进样目标位置" areaOptions={TEST_AREA_OPTIONS} includeQr includeHole register={register} control={control} errors={errors} />
      </div>
    </section>
    <section className="sample-task">
      <div className="sample-task-heading"><span>OUT</span><h3>退样任务</h3></div>
      <div className="paired-clusters">
        <AreaFields prefix="sample_out.source" legend="退样源位置" areaOptions={TEST_AREA_OPTIONS} includeQr includeHole includeSampleQr register={register} control={control} errors={errors} />
        <AreaFields prefix="sample_out.target" legend="退样目标位置" areaOptions={PLATE_AREA_OPTIONS} includeQr includeHole register={register} control={control} errors={errors} />
      </div>
    </section>
  </div>
}

function TricolorLightFields({ register, control, errors }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'body' })
  return <div className="array-editor">
    <div className="array-heading"><span>灯光控制项</span><button type="button" className="mini-button" onClick={() => append({ area_id: fields.length + 1, mode: 'green' })}><Plus size={14} />添加区域</button></div>
    {fields.map((field, index) => <div className="array-row light-row" key={field.id}>
      <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
      <Field label="区域" name={`body.${index}.area_id`} register={register} type="number" min={1} max={29} error={errorAt(errors, `body.${index}.area_id`)} />
      <SelectField label="模式" name={`body.${index}.mode`} register={register} options={TRICOLOR_LIGHT_MODE_OPTIONS} error={errorAt(errors, `body.${index}.mode`)} />
      <button type="button" className="icon-button" aria-label={`删除第 ${index + 1} 行`} disabled={fields.length === 1} onClick={() => remove(index)}><Trash2 size={15} /></button>
    </div>)}
    {errorAt(errors, 'body')?.message ? <p className="form-error">{errorAt(errors, 'body').message}</p> : null}
  </div>
}

function RobotPointFields({ register, control, errors }: Props) {
  const areaType = useWatch({ control, name: 'area_type' })
  const areaIdMax = areaType === 'transfer' ? 4 : areaType === 'test_area' ? 2 : 29
  return <div className="form-grid cols-3">
    <SelectField label="区域" name="area_type" register={register} options={AREA_OPTIONS} error={errorAt(errors, 'area_type')} />
    <Field label="编号" name="area_id" register={register} type="number" min={1} max={areaIdMax} error={errorAt(errors, 'area_id')} />
    <SelectField label="类型" name="point_type" register={register} options={POINT_TYPE_OPTIONS} error={errorAt(errors, 'point_type')} />
  </div>
}

function ModuleToggle({ name, label, register, children }: any) {
  return <fieldset className="module-box"><legend><label className="check-label"><input type="checkbox" {...register(`${name}.enabled`)} />{label}</label></legend><div className="form-grid cols-2">{children}</div></fieldset>
}

function SaveDefaultToggle({ name, register }: { name: string; register: UseFormRegister<FormValues> }) {
  return <label className="check-label"><input type="checkbox" {...register(`${name}.save`)} />保存默认值</label>
}

function MachineParamFields({ register, errors }: Props) {
  return <div className="module-grid">
    <ModuleToggle name="robot" label="robot · 机械臂" register={register}>
      <Field label="速度" name="robot.speed" register={register} type="number" />
      <SaveDefaultToggle name="robot" register={register} />
    </ModuleToggle>
    <ModuleToggle name="gripper" label="gripper · 电爪" register={register}>
      <Field label="速度" name="gripper.speed" register={register} type="number" />
      <Field label="样品架力度" name="gripper.rack_force" register={register} type="number" />
      <Field label="试管力度" name="gripper.tube_force" register={register} type="number" />
      <Field label="样品架位置" name="gripper.rack_position" register={register} type="number" />
      <Field label="试管位置" name="gripper.tube_position" register={register} type="number" />
      <Field label="松开位置" name="gripper.release_position" register={register} type="number" />
      <SaveDefaultToggle name="gripper" register={register} />
    </ModuleToggle>
    <ModuleToggle name="camera" label="camera · 摄像头" register={register}>
      <Field label="曝光" name="camera.exposure" register={register} type="number" />
      <Field label="增益" name="camera.gain" register={register} type="number" step={0.1} />
      <SaveDefaultToggle name="camera" register={register} />
    </ModuleToggle>
    <ModuleToggle name="crossbar" label="crossbar · 横移杆" register={register}>
      <Field label="动作超时时间 (s)" name="crossbar.action_timeout" register={register} type="number" min={0} step={0.1} />
      <SaveDefaultToggle name="crossbar" register={register} />
    </ModuleToggle>
    <ModuleToggle name="safety_radar" label="safety_radar · 安全雷达" register={register}>
      <label className="check-label"><input type="checkbox" {...register('safety_radar.near_alarm_masked')} />近端告警屏蔽</label>
      <label className="check-label"><input type="checkbox" {...register('safety_radar.far_alarm_masked')} />远端告警屏蔽</label>
      <SaveDefaultToggle name="safety_radar" register={register} />
    </ModuleToggle>
    <ModuleToggle name="move_plate" label="move_plate · 样品盘搬运" register={register}>
      <Field label="样品盘夹取高度 (mm)" name="move_plate.plate_pick_height" register={register} type="number" step={0.01} />
      <Field label="抬升高度 (mm)" name="move_plate.lift_height" register={register} type="number" step={0.01} />
      <SaveDefaultToggle name="move_plate" register={register} />
    </ModuleToggle>
    <ModuleToggle name="move_sample" label="move_sample · 样品搬运" register={register}>
      <Field label="试管夹取高度 (mm)" name="move_sample.tube_pick_height" register={register} type="number" step={0.01} />
      <Field label="抬升高度 (mm)" name="move_sample.lift_height" register={register} type="number" step={0.01} />
      <Field label="磁体测试区试管夹取高度 (mm)" name="move_sample.test_area_tube_pick_height" register={register} type="number" step={0.01} />
      <Field label="磁体测试区试管抬升高度 (mm)" name="move_sample.test_area_tube_lift_height" register={register} type="number" step={0.01} />
      <SaveDefaultToggle name="move_sample" register={register} />
    </ModuleToggle>
    <ModuleToggle name="move_sample_in_out" label="move_sample_in_out · 样品进退样" register={register}>
      <Field label="位置 3 等待时间 (s)" name="move_sample_in_out.position_3_wait_time" register={register} type="number" min={0} step={0.1} />
      <SaveDefaultToggle name="move_sample_in_out" register={register} />
    </ModuleToggle>
    {errors.root?.message ? <p className="form-error">{errors.root.message}</p> : null}
  </div>
}

export function CommandFields(props: Props) {
  const { cmd, register, control, errors } = props
  if (['heartbeat', 'get_crossbar_status', 'get_rgb_light_status', 'get_robot_status', 'get_gripper_status', 'get_safety_radar_status'].includes(cmd)) return <div className="empty-params"><code>{'{}'}</code><p>此命令不需要参数，可直接发送。</p></div>
  if (cmd === 'get_device_status') return <SelectField label="状态类型" name="status_type" register={register} options={enumOptions(['UN', 'CM', 'EM', 'all'])} error={errorAt(errors, 'status_type')} />
  if (cmd === 'set_device_mode') return <SelectField label="运行模式" name="mode" register={register} options={enumOptions(['auto', 'maintenance'])} error={errorAt(errors, 'mode')} />
  if (cmd === 'device_command') return <SelectField label="整机命令" name="command" register={register} options={enumOptions(DEVICE_COMMANDS)} error={errorAt(errors, 'command')} />
  if (cmd === 'get_area_sample_status') return <SelectField label="区域类型" name="area_type" register={register} options={AREA_OPTIONS} error={errorAt(errors, 'area_type')} />
  if (cmd === 'scan_qrcode') return <div className="form-grid cols-2"><SelectField label="区域类型" name="area_type" register={register} options={AREA_OPTIONS} error={errorAt(errors, 'area_type')} /><Field label="区域编号" name="area_id" register={register} type="number" min={1} max={29} error={errorAt(errors, 'area_id')} /></div>
  if (cmd === 'move_plate') return <div className="paired-clusters"><AreaFields prefix="source" plateOnly includeQr register={register} control={control} errors={errors} /><AreaFields prefix="target" plateOnly register={register} control={control} errors={errors} /></div>
  if (cmd === 'move_sample') return <div className="paired-clusters"><AreaFields prefix="source" includeQr includeHole includeSampleQr register={register} control={control} errors={errors} /><AreaFields prefix="target" includeQr includeHole register={register} control={control} errors={errors} /></div>
  if (cmd === 'move_sample_in_out') return <SampleInOutFields {...props} />
  if (cmd === 'move_crossbar') return <Field label="目标位置" name="position" register={register} type="number" min={1} max={3} error={errorAt(errors, 'position')} />
  if (cmd === 'release_crossbar_sample') return <label className="switch-field"><input type="checkbox" {...register('release')} /><span className="switch" /><span><strong>顶针释放样品</strong><small>true：D3 上电，样品掉落；false：断电保持</small></span></label>
  if (cmd === 'set_rgb_light') return <TricolorLightFields {...props} />
  if (cmd === 'robot_control') return <SelectField label="机械臂动作" name="action" register={register} options={enumOptions(['enable', 'disable', 'home', 'pause', 'resume', 'stop', 'reset'])} error={errorAt(errors, 'action')} />
  if (cmd === 'robot_axis_move') return <div className="form-grid cols-3">
    <SelectField label="模式" name="mode" register={register} options={enumOptions(['absolute', 'relative'])} error={errorAt(errors, 'mode')} />
    <Field label="X (mm)" name="x" register={register} type="number" step={0.01} error={errorAt(errors, 'x')} />
    <Field label="Y (mm)" name="y" register={register} type="number" step={0.01} error={errorAt(errors, 'y')} />
    <Field label="Z (mm)" name="z" register={register} type="number" step={0.01} error={errorAt(errors, 'z')} />
    <Field label="RZ (°)" name="rz" register={register} type="number" step={0.01} error={errorAt(errors, 'rz')} />
    <Field label="速度" name="speed" register={register} type="number" step={0.01} error={errorAt(errors, 'speed')} />
  </div>
  if (cmd === 'robot_point_control') return <RobotPointFields {...props} />
  if (cmd === 'robot_jog_control') return <div className="form-grid cols-3">
    <SelectField label="坐标轴" name="axis" register={register} options={JOG_AXIS_OPTIONS} error={errorAt(errors, 'axis')} />
    <SelectField label="运动方向" name="direction" register={register} options={JOG_DIRECTION_OPTIONS} error={errorAt(errors, 'direction')} />
    <Field label="速度 (%)" name="speed" register={register} type="number" min={0} max={100} step={0.1} error={errorAt(errors, 'speed')} />
  </div>
  if (cmd === 'gripper_control') return <div className="form-grid cols-2"><SelectField label="设备" name="device" register={register} options={GRIPPER_DEVICE_OPTIONS} error={errorAt(errors, 'device')} /><SelectField label="动作" name="action" register={register} options={GRIPPER_ACTION_OPTIONS} error={errorAt(errors, 'action')} /></div>
  if (cmd === 'get_machine_param') return <fieldset className="module-query"><legend>查询模块（不选表示全部）</legend>{MACHINE_PARAM_MODULES.map((module) => <label className="check-label" key={module}><input type="checkbox" value={module} {...register('modules')} />{module} · {MACHINE_PARAM_MODULE_LABELS[module]}</label>)}</fieldset>
  if (cmd === 'set_machine_param') return <MachineParamFields {...props} />
  return null
}
