import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useWatch, type FieldErrors, type UseFormRegister, type UseFormSetValue, type Control } from 'react-hook-form'
import { AREA_OPTIONS, Field, PLATE_AREA_OPTIONS, SelectField, type FormValues } from './FieldParts'

interface Props {
  cmd: string
  register: UseFormRegister<FormValues>
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  errors: FieldErrors<FormValues>
}

const enumOptions = (values: string[]) => values.map((value) => ({ value, label: value }))
const errorAt = (errors: FieldErrors<FormValues>, path: string) => path.split('.').reduce<any>((value, key) => value?.[key], errors)

function AreaFields({ prefix, plateOnly, register, control, errors, includeQr = false, includeHole = false, includeSampleQr = false }: any) {
  const areaType = useWatch({ control, name: `${prefix}.area_type` })
  const isTest = areaType === 'test_area'
  return (
    <fieldset className="field-cluster">
      <legend>{prefix === 'source' ? '源位置' : '目标位置'}</legend>
      <div className="form-grid cols-2">
        <SelectField label="区域类型" name={`${prefix}.area_type`} register={register} options={plateOnly ? PLATE_AREA_OPTIONS : AREA_OPTIONS} error={errorAt(errors, `${prefix}.area_type`)} />
        <Field label="区域编号" name={`${prefix}.area_id`} register={register} type="number" min={1} max={isTest ? 2 : areaType === 'transfer' ? 4 : 29} error={errorAt(errors, `${prefix}.area_id`)} />
        {includeQr ? <Field label="样品盘二维码" name={`${prefix}.plate_qr_code`} register={register} disabled={isTest} error={errorAt(errors, `${prefix}.plate_qr_code`)} /> : null}
        {includeHole ? <Field label="孔位 ID" name={`${prefix}.hole_id`} register={register} type={isTest ? 'text' : 'number'} disabled={isTest} min={1} max={10} error={errorAt(errors, `${prefix}.hole_id`)} /> : null}
        {includeSampleQr ? <Field label="样品二维码" name={`${prefix}.sample_qr_code`} register={register} error={errorAt(errors, `${prefix}.sample_qr_code`)} /> : null}
      </div>
    </fieldset>
  )
}

function RgbFields({ register, control, errors }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'body' })
  return <div className="array-editor">
    <div className="array-heading"><span>灯光控制项</span><button type="button" className="mini-button" onClick={() => append({ area_id: fields.length + 1, r: 0, g: 255, b: 128 })}><Plus size={14} />添加区域</button></div>
    {fields.map((field, index) => <div className="array-row rgb-row" key={field.id}>
      <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
      <Field label="区域" name={`body.${index}.area_id`} register={register} type="number" min={1} max={29} error={errorAt(errors, `body.${index}.area_id`)} />
      <Field label="R" name={`body.${index}.r`} register={register} type="number" min={0} max={255} error={errorAt(errors, `body.${index}.r`)} />
      <Field label="G" name={`body.${index}.g`} register={register} type="number" min={0} max={255} error={errorAt(errors, `body.${index}.g`)} />
      <Field label="B" name={`body.${index}.b`} register={register} type="number" min={0} max={255} error={errorAt(errors, `body.${index}.b`)} />
      <button type="button" className="icon-button" aria-label={`删除第 ${index + 1} 行`} disabled={fields.length === 1} onClick={() => remove(index)}><Trash2 size={15} /></button>
    </div>)}
    {errorAt(errors, 'body')?.message ? <p className="form-error">{errorAt(errors, 'body').message}</p> : null}
  </div>
}

function AxisFields({ register, control, errors }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'body' })
  return <div className="array-editor">
    <div className="array-heading"><span>同步运动轴</span><button type="button" className="mini-button" disabled={fields.length >= 4} onClick={() => append({ axis: `axis${fields.length + 1}`, mode: 'absolute', target: 0, speed: 50, acc: 100 })}><Plus size={14} />添加轴</button></div>
    {fields.map((field, index) => <div className="array-row axis-row" key={field.id}>
      <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
      <SelectField label="轴" name={`body.${index}.axis`} register={register} options={enumOptions(['axis1', 'axis2', 'axis3', 'axis4'])} error={errorAt(errors, `body.${index}.axis`)} />
      <SelectField label="模式" name={`body.${index}.mode`} register={register} options={enumOptions(['absolute', 'relative'])} error={errorAt(errors, `body.${index}.mode`)} />
      <Field label="目标" name={`body.${index}.target`} register={register} type="number" step={0.01} error={errorAt(errors, `body.${index}.target`)} />
      <Field label="速度" name={`body.${index}.speed`} register={register} type="number" step={0.01} error={errorAt(errors, `body.${index}.speed`)} />
      <Field label="加速度" name={`body.${index}.acc`} register={register} type="number" step={0.01} error={errorAt(errors, `body.${index}.acc`)} />
      <button type="button" className="icon-button" aria-label={`删除第 ${index + 1} 行`} disabled={fields.length === 1} onClick={() => remove(index)}><Trash2 size={15} /></button>
    </div>)}
    {errorAt(errors, 'body')?.message ? <p className="form-error">{errorAt(errors, 'body').message}</p> : null}
  </div>
}

function ModuleToggle({ name, label, register, children }: any) {
  return <fieldset className="module-box"><legend><label className="check-label"><input type="checkbox" {...register(`${name}.enabled`)} />{label}</label></legend><div className="form-grid cols-2">{children}</div></fieldset>
}

export function CommandFields(props: Props) {
  const { cmd, register, control, errors } = props
  const gripperAction = useWatch({ control, name: 'action' })
  if (['heartbeat', 'get_crossbar_status', 'get_robot_status', 'get_gripper_status'].includes(cmd)) return <div className="empty-params"><code>{'{}'}</code><p>此命令不需要参数，可直接发送。</p></div>
  if (cmd === 'get_device_status') return <SelectField label="状态类型" name="status_type" register={register} options={enumOptions(['UN', 'CM', 'EM', 'all'])} error={errorAt(errors, 'status_type')} />
  if (cmd === 'set_device_mode') return <SelectField label="运行模式" name="mode" register={register} options={enumOptions(['auto', 'maintenance'])} error={errorAt(errors, 'mode')} />
  if (cmd === 'device_command') return <SelectField label="整机命令" name="command" register={register} options={enumOptions(['start', 'pause', 'stop', 'abort', 'reset'])} error={errorAt(errors, 'command')} />
  if (cmd === 'get_area_sample_status') return <SelectField label="区域类型" name="area_type" register={register} options={AREA_OPTIONS} error={errorAt(errors, 'area_type')} />
  if (cmd === 'scan_qrcode') return <div className="form-grid cols-2"><SelectField label="区域类型" name="area_type" register={register} options={AREA_OPTIONS} error={errorAt(errors, 'area_type')} /><Field label="区域编号" name="area_id" register={register} type="number" min={1} max={29} error={errorAt(errors, 'area_id')} /></div>
  if (cmd === 'move_plate') return <div className="paired-clusters"><AreaFields prefix="source" plateOnly includeQr register={register} control={control} errors={errors} /><AreaFields prefix="target" plateOnly register={register} control={control} errors={errors} /></div>
  if (cmd === 'move_sample') return <div className="paired-clusters"><AreaFields prefix="source" includeQr includeHole includeSampleQr register={register} control={control} errors={errors} /><AreaFields prefix="target" includeQr includeHole register={register} control={control} errors={errors} /></div>
  if (cmd === 'move_crossbar') return <Field label="目标位置" name="position" register={register} type="number" min={1} max={3} error={errorAt(errors, 'position')} />
  if (cmd === 'release_crossbar_sample') return <label className="switch-field"><input type="checkbox" {...register('release')} /><span className="switch" /><span><strong>释放样品</strong><small>true：D3 上电，样品掉落；false：断电保持</small></span></label>
  if (cmd === 'set_rgb_light') return <RgbFields {...props} />
  if (cmd === 'robot_axis_move') return <AxisFields {...props} />
  if (cmd === 'robot_control') return <SelectField label="机械臂动作" name="action" register={register} options={enumOptions(['enable', 'disable', 'home', 'pause', 'resume', 'stop', 'reset'])} error={errorAt(errors, 'action')} />
  if (cmd === 'gripper_control') return <div className="form-grid cols-3"><SelectField label="动作" name="action" register={register} options={enumOptions(['open', 'close', 'move_to'])} error={errorAt(errors, 'action')} /><Field label="目标开度" name="position" register={register} type="number" disabled={gripperAction !== 'move_to'} error={errorAt(errors, 'position')} /><Field label="速度" name="speed" register={register} type="number" error={errorAt(errors, 'speed')} /></div>
  if (cmd === 'get_machine_param') return <fieldset className="module-query"><legend>查询模块（不选表示全部）</legend>{['robot', 'gripper', 'camera', 'crossbar'].map((module) => <label className="check-label" key={module}><input type="checkbox" value={module} {...register('modules')} />{module}</label>)}</fieldset>
  if (cmd === 'set_machine_param') return <div className="module-grid">
    <ModuleToggle name="robot" label="robot · 机械臂" register={register}><Field label="速度" name="robot.speed" register={register} type="number" /><Field label="加速度" name="robot.acc" register={register} type="number" /><label className="check-label"><input type="checkbox" {...register('robot.save')} />保存默认值</label></ModuleToggle>
    <ModuleToggle name="gripper" label="gripper · 电爪" register={register}><Field label="速度" name="gripper.speed" register={register} type="number" /><Field label="样品架力度" name="gripper.rack_force" register={register} type="number" /><Field label="试管力度" name="gripper.tube_force" register={register} type="number" /><label className="check-label"><input type="checkbox" {...register('gripper.save')} />保存默认值</label></ModuleToggle>
    <ModuleToggle name="camera" label="camera · 摄像头" register={register}><Field label="曝光" name="camera.exposure" register={register} type="number" /><Field label="增益" name="camera.gain" register={register} type="number" step={0.1} /><label className="check-label"><input type="checkbox" {...register('camera.save')} />保存默认值</label></ModuleToggle>
    <ModuleToggle name="crossbar" label="crossbar · 横移杆" register={register}><Field label="速度" name="crossbar.speed" register={register} type="number" /><label className="check-label"><input type="checkbox" {...register('crossbar.save')} />保存默认值</label></ModuleToggle>
    {errors.root?.message ? <p className="form-error">{errors.root.message}</p> : null}
  </div>
  return null
}
