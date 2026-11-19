/*import { useState } from 'react'
import { updateTemplate } from './api'
import EditableHtmlPreview from './EditableHtmlPreview'

// 기존 셀 위치와 format 등의 추가 정보를 유지합니다.
function editableFields(template) {
  const schema = template.template_schema || {}
  const source = template.template_fields?.length ? template.template_fields : template.fields || []
  const byKey = new Map(source.map(f => [f.key, f]))
  const keys = [...new Set([...byKey.keys(), ...(template.placeholder_keys || []), ...Object.keys(schema.properties || {})])]
  return keys.map(key => {
    const field = byKey.get(key) || {}
    const property = schema.properties?.[key] || {}
    const type = field.type || (property.format === 'date' ? 'date' : property.type === 'number' || property.type === 'integer' ? 'number' : 'string')
    return { ...field, key, label: field.label || property.title || key, type,
      required: Boolean(field.required || schema.required?.includes(key)),
      description: field.description || property.description || '' }
  })
}

export function buildTemplateUpdate(template, { name, description, html, fields }) {
  const title = name.trim()
  if (!title || [...title].length > 255) throw new Error('양식 이름은 1~255자로 입력하세요.')
  if (!html.trim() || html.length > 1000000) throw new Error('본문은 필수이며 최대 1,000,000자입니다.')
  const known = new Set()
  const properties = { ...(template.template_schema?.properties || {}) }
  for (const field of fields) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(field.key) || known.has(field.key)) throw new Error('필드 key가 잘못되었거나 중복되었습니다.')
    known.add(field.key)
    if (!['string', 'textarea', 'number', 'date'].includes(field.type)) throw new Error('필드 타입을 확인하세요.')
    const previous = properties[field.key] || {}
    const original = (template.template_fields || template.fields || []).find(f => f.key === field.key)
    const originalType = original?.type || (previous.format === 'date' ? 'date' : ['integer', 'number'].includes(previous.type) ? 'number' : 'string')
    // 타입이 바뀌면 이전 타입의 전용 제약을 제거합니다. 같은 타입의 추가 규칙은 유지합니다.
    const property = originalType === field.type ? { ...previous } : {}
    property.type = field.type === 'number' ? (originalType === field.type && previous.type === 'integer' ? 'integer' : 'number') : 'string'
    property.title = field.label || field.key
    property.description = field.description || ''
    if (field.type === 'date') property.format = 'date'
    properties[field.key] = property
  }
  for (const match of html.matchAll(/\{\{\s*([a-z][a-z0-9_]{0,79})\s*\}\}/g)) {
    if (!known.has(match[1])) throw new Error(`본문의 {{${match[1]}}에 대응하는 입력 항목이 없습니다.`)
  }
  const originalPlaceholders = [...(template.html_content || '').matchAll(/\{\{\s*([a-z][a-z0-9_]{0,79})\s*\}\}/g)].map(match => match[1])
  const nextPlaceholders = new Set([...html.matchAll(/\{\{\s*([a-z][a-z0-9_]{0,79})\s*\}\}/g)].map(match => match[1]))
  if (originalPlaceholders.some(key => !nextPlaceholders.has(key))) throw new Error('기존 placeholder를 삭제하지 말고 유지해 주세요.')
  const cellIds = new Set([...html.matchAll(/data-cell-id\s*=\s*["']([^"']+)["']/g)].map(match => match[1]))
  const originalIds = new Set([...(template.html_content || '').matchAll(/data-cell-id\s*=\s*["']([^"']+)["']/g)].map(match => match[1]))
  for (const field of fields) {
    for (const id of field.cell_ids || (field.cell_id ? [field.cell_id] : [])) {
      if (originalIds.has(id) && !cellIds.has(id)) throw new Error(`연결된 셀 ${id}의 data-cell-id를 유지해 주세요.`)
    }
  }
  return {
    template_name: title, description, html_content: html,
    template_fields: fields.map(f => ({ ...f, label: f.label || f.key, required: Boolean(f.required) })),
    placeholder_keys: fields.map(f => f.key),
    template_schema: { ...(template.template_schema || {}), type: 'object', properties,
      required: fields.filter(f => f.required).map(f => f.key) },
  }
}

export default function TemplateMetaEditor({ template, onSaved, startEditing = false }) {
  const [editing, setEditing] = useState(startEditing)
  const [name, setName] = useState(template.template_name || '')
  const [description, setDescription] = useState(template.description || '')
  const [html, setHtml] = useState(template.html_content || '')
  const [fields, setFields] = useState(() => editableFields(template))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  function reset() {
    setName(template.template_name || ''); setDescription(template.description || '')
    setHtml(template.html_content || ''); setFields(editableFields(template)); setError(''); setMessage('')
  }
  function changeField(index, patch) { setFields(current => current.map((f, i) => i === index ? { ...f, ...patch } : f)) }
  async function save(e) {
    e.preventDefault()
    if (busy) return
    setError(''); setMessage('')
    let body
    try { body = buildTemplateUpdate(template, { name, description, html, fields }) }
    catch (e) { setError(e.message); return }
    setBusy(true)
    try {
      const updated = await updateTemplate(template.id, body)
      // 갱신 응답이 비어 있어도 방금 저장한 값으로 상세 화면을 갱신합니다.
      await onSaved({ ...template, ...body, ...(updated || {}), fields: updated?.template_fields || body.template_fields })
      setEditing(false); setMessage('변경을 저장했습니다.')
    } catch (e) { setError(e.message || '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  if (!editing) return <div className="space-y-2">
    <button type="button" className="btn btn-primary" onClick={() => { reset(); setEditing(true) }}>이 양식 수정</button>
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
  </div>
  return <form onSubmit={save} className="panel space-y-4">
    <div className="sticky top-0 z-10 bg-white py-2 flex flex-wrap items-center gap-2 border-b border-slate-200">
      <h5 className="font-semibold mr-auto">저장된 양식 수정</h5>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? '저장 중…' : '변경사항 저장'}</button>
      <button type="button" className="btn" disabled={busy} onClick={() => { reset(); setEditing(false) }}>취소</button>
    </div>
    {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    <fieldset disabled={busy} className="space-y-4 min-w-0">
      <label className="block text-sm">양식 이름<input className="field mt-1" value={name} maxLength={255} required onChange={e => setName(e.target.value)} /></label>
      <label className="block text-sm">설명<textarea className="field mt-1" value={description} onChange={e => setDescription(e.target.value)} /></label>
      <section className="space-y-3">
        <h6 className="font-semibold text-sm">입력 항목</h6>
        <p className="text-xs text-slate-500">항목의 라벨·타입·필수 여부·설명을 수정할 수 있습니다. 기존 key와 셀 연결은 유지됩니다.</p>
        {!fields.length && <p className="text-sm text-slate-500">입력 항목이 없는 양식입니다.</p>}
        {fields.map((field, i) => <div key={field.key} className="rounded-lg border border-slate-200 p-3 space-y-2">
          <div className="text-xs font-mono text-slate-500">{field.key}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-sm">라벨<input className="field mt-1" value={field.label} onChange={e => changeField(i, { label: e.target.value })} /></label>
            <label className="text-sm">타입<select className="field mt-1" value={field.type} onChange={e => changeField(i, { type: e.target.value })}>
              <option value="string">문자</option><option value="textarea">긴 글</option><option value="number">숫자</option><option value="date">날짜</option>
            </select></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={e => changeField(i, { required: e.target.checked })} />필수 입력</label>
          <label className="block text-sm">항목 설명<input className="field mt-1" value={field.description} onChange={e => changeField(i, { description: e.target.value })} /></label>
        </div>)}
      </section>
      <details>
        <summary className="cursor-pointer font-semibold text-sm">양식 본문 수정</summary>
        <p className="text-xs text-slate-500 my-2">기존 placeholder와 표의 셀 ID를 유지하면서 문구·서식을 수정하세요. 변경한 본문은 아래 미리보기에서 확인할 수 있습니다.</p>
        <EditableHtmlPreview html={html} editable onChange={setHtml} />
      </details>
      <p className="text-xs text-slate-500">{template.is_active === false ? '비활성 양식입니다.' : '활성 양식입니다.'} 변경 내용은 앞으로 작성하는 문서에 적용됩니다.</p>
    </fieldset>
  </form>
}
*/

// 양식의 셀 연결·필드 편집은 TemplateManager의 공통 편집 화면에서 처리합니다.
export default function TemplateMetaEditor() {
  return <p className="text-sm text-slate-500">양식관리 목록의 수정 버튼에서 필드와 셀 연결을 수정하세요.</p>
}
