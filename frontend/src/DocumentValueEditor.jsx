import { useMemo, useRef, useState } from 'react'
import SafeHtmlFrame from './SafeHtmlFrame'

const validKey = key => /^[a-z][a-z0-9_]{0,79}$/.test(key || '')
const parseDocument = html => new DOMParser().parseFromString(html || '', 'text/html')
const serialize = doc => doc.head.innerHTML + doc.body.innerHTML
// 신규 문서는 바깥쪽 ph 안에 key가 있는 ph가 포함될 수 있으므로 잎 노드만 편집합니다.
function valueNodes(doc) {
  return [...doc.querySelectorAll('span.ph')].filter(n => !n.querySelector('span.ph') && !n.closest('style,script'))
}
function rawValue(node) {
  const text = node.textContent || ''
  if (node.getAttribute('data-field-type') !== 'date') return text
  const m = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/.exec(text)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : text
}
function displayValue(value, node) {
  const text = String(value ?? '')
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  return m && node.getAttribute('data-field-type') === 'date' ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : text
}
function objectValues(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { value = {} } }
  return Object.fromEntries(Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
    .filter(([key, v]) => validKey(key) && (v == null || ['string', 'number', 'boolean'].includes(typeof v)))
    .map(([key, v]) => [key, String(v ?? '')]))
}
export function recoverDocumentValues(html, saved) {
  const result = objectValues(saved), recovered = new Map(), ambiguous = new Set()
  for (const node of valueNodes(parseDocument(html))) {
    const key = node.getAttribute('data-field-key')
    if (!validKey(key)) continue
    const value = rawValue(node)
    if (recovered.has(key) && recovered.get(key) !== value) ambiguous.add(key)
    recovered.set(key, value)
  }
  for (const [key, value] of recovered) if (!Object.hasOwn(result, key) && !ambiguous.has(key)) result[key] = value
  return result
}
export function documentValues(html, saved = {}) {
  const values = recoverDocumentValues(html, saved), fields = [], seen = new Set()
  valueNodes(parseDocument(html)).forEach((node, index) => {
    const candidate = node.getAttribute('data-field-key'), key = validKey(candidate) ? candidate : ''
    if (key && seen.has(key)) return
    if (key) seen.add(key)
    const cell = node.closest('td,th')
    const label = node.getAttribute('data-field-label') || (key || cell?.previousElementSibling?.textContent?.trim().slice(0, 80) || `입력 내용 ${index + 1}`)
    fields.push({ index, key, label, value: key && Object.hasOwn(values, key) ? values[key] : rawValue(node),
      cellId: cell?.getAttribute('data-cell-id') || '' })
  })
  // 본문에 표시되지 않는 저장 값도 손실 없이 편집합니다.
  for (const [key, value] of Object.entries(values)) if (!seen.has(key)) fields.push({ index: -1, key, label: key, value, cellId: '', unbound: true })
  return fields
}
export function replaceDocumentValue(html, index, value) {
  const doc = parseDocument(html), node = valueNodes(doc)[index]
  if (!node) throw new Error('편집할 입력 항목을 찾을 수 없습니다.')
  node.textContent = String(value)
  return serialize(doc)
}
export function updateDocumentField(html, values, field, value) {
  const next = { ...recoverDocumentValues(html, values) }
  if (!field.key) return { html: replaceDocumentValue(html, field.index, value), values: next }
  next[field.key] = value
  const doc = parseDocument(html)
  for (const node of valueNodes(doc)) {
    const key = node.getAttribute('data-field-key')
    if (Object.hasOwn(next, key)) node.textContent = displayValue(next[key], node)
  }
  return { html: serialize(doc), values: next }
}

export default function DocumentValueEditor({ html, values = {}, editable, onChange, disabled = false }) {
  const fields = useMemo(() => documentValues(html, values), [html, values])
  const inputs = useRef({})
  const [selectedCell, setSelectedCell] = useState(''), [error, setError] = useState('')
  function change(field, value) {
    if (disabled || field.unbound) return
    try { const next = updateDocumentField(html, values, field, value); onChange(next.html, next.values); setError('') }
    catch (e) { setError(e.message) }
  }
  function focusCell(id) {
    const field = fields.find(f => f.cellId === id)
    if (!field) return
    setSelectedCell(id)
    inputs.current[field.key || field.index]?.focus({ preventScroll: true })
    inputs.current[field.key || field.index]?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }
  return <div className={editable ? 'grid lg:grid-cols-2 gap-4 items-start min-w-0' : ''}>
    <section className="min-w-0 lg:sticky lg:top-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="font-semibold mb-2">문서 미리보기</h3>
      <SafeHtmlFrame html={html || ''} title="문서 내용 미리보기" height="min(64vh, 720px)"
        onCellPick={editable && !disabled && fields.length ? focusCell : undefined}
        selectedCells={editable && selectedCell ? [selectedCell] : []} />
    </section>
    {editable && <section className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="문서 내용 입력">
      <h3 className="font-semibold mb-2">작성 내용 수정</h3>
      <p className="text-sm text-slate-700 mb-3">입력한 내용이 왼쪽 미리보기에 바로 반영됩니다. 셀을 클릭하면 해당 입력란으로 이동합니다.</p>
      {!fields.length && <p className="text-sm text-amber-800">이 문서에는 편집할 입력 항목 표식이 없습니다. 제목은 수정할 수 있습니다.</p>}
      {fields.some(f => !f.key) && <p className="text-sm text-amber-800 mb-3">이전 문서의 일부 항목은 placeholder key가 남아 있지 않습니다. 해당 내용은 편집할 수 있지만 key·값 JSON으로 자동 복구할 수 없습니다.</p>}
      {fields.some(f => f.unbound) && <p className="text-sm text-amber-800 mb-3">본문 위치를 확인할 수 없는 저장 값은 읽기 전용으로 표시됩니다.</p>}
      <fieldset disabled={disabled} className="space-y-3 lg:max-h-[64vh] lg:overflow-y-auto pr-2 min-w-0">
        {fields.map(field => <label key={field.key || `legacy-${field.index}`} className="block text-sm font-medium text-slate-700">
          {field.label}{field.key && <span className="ml-2 text-xs text-slate-500">{field.key}</span>}
          <textarea ref={node => { inputs.current[field.key || field.index] = node }} className="field mt-1 bg-white" rows={3}
            aria-label={field.label} readOnly={Boolean(field.unbound)} value={field.value} onFocus={() => setSelectedCell(field.cellId)}
            onChange={e => change(field, e.target.value)} />
        </label>)}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>}
  </div>
}
