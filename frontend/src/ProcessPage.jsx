import { useEffect, useMemo, useRef, useState } from 'react'
import { getAvailableTemplates, getAvailableTemplateDetail, createGeneratedDocument, generateDocumentDraft, getAvailableApprovalRules } from './api'
import SafeHtmlFrame from './SafeHtmlFrame'
import { fillTemplate } from './template-utils'

export default function ProcessPage({ onCreated }) {
  const [templates, setTemplates] = useState([]), [template, setTemplate] = useState(null)
  const [selected, setSelected] = useState(''), [title, setTitle] = useState(''), [values, setValues] = useState({})
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false)
  const [description, setDescription] = useState(''), [receipt, setReceipt] = useState(null)
  const [aiBusy, setAiBusy] = useState(false), [draft, setDraft] = useState(null)
  const [rules, setRules] = useState([]), [ruleId, setRuleId] = useState('')
  const [rulesLoading, setRulesLoading] = useState(false), [rulesError, setRulesError] = useState('')
  const rulesSequence = useRef(0)
  const sequence = useRef(0), fileInput = useRef(null)
  const locked = busy || aiBusy
  useEffect(() => {
    let active = true
    getAvailableTemplates().then(t => { if (active) setTemplates(t) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false; sequence.current++; rulesSequence.current++ }
  }, [])
  async function select(id) {
    setSelected(id); setTemplate(null); setValues({}); setError(''); setTitle('')
    setDraft(null); setDescription(''); setReceipt(null)
    setRules([]); setRuleId(''); setRulesError(''); setRulesLoading(false); rulesSequence.current++
    if (fileInput.current) fileInput.current.value = ''
    const current = ++sequence.current
    if (!id) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await getAvailableTemplateDetail(id)
      if (current === sequence.current) { setTemplate(data); setTitle(data.template_name); await loadRules(data.id, current) }
    } catch (e) { if (current === sequence.current) setError(e.message) }
    finally { if (current === sequence.current) setLoading(false) }
  }
  async function loadRules(templateId, version = sequence.current) {
    const requestId = ++rulesSequence.current
    setRulesLoading(true); setRulesError(''); setRules([]); setRuleId('')
    try {
      const list = await getAvailableApprovalRules(templateId)
      if (version === sequence.current && requestId === rulesSequence.current) setRules(list)
    } catch (e) {
      if (version === sequence.current && requestId === rulesSequence.current) setRulesError(e.message || '결재 규칙을 불러오지 못했습니다.')
    } finally {
      if (version === sequence.current && requestId === rulesSequence.current) setRulesLoading(false)
    }
  }
  const selectedRule = rules.find(rule => String(rule.id) === ruleId)
  const fields = useMemo(() => template?.template_fields?.length ? template.template_fields
    : (template?.placeholder_keys || []).map(key => ({ key, label: key, type: 'string' })), [template])
  const html = useMemo(() => template ? fillTemplate(template.html_content, values, template.template_fields || []) : '', [template, values])

  async function createDraft() {
    if (!template || locked) return
    setError(''); setDraft(null)
    if (!description.trim() && !receipt) { setError('작성할 내용이나 영수증을 입력하세요.'); return }
    const current = sequence.current
    setAiBusy(true)
    try {
		const body = new FormData()
		body.append('template_id', String(template.id))
		body.append('description', description || '')
		body.append('current_values', JSON.stringify(values || {}))
		if (receipt) body.append('receipt', receipt)

		const result = await generateDocumentDraft(body)
      if (current !== sequence.current) return
      const next = {}
      for (const f of fields) {
        if (typeof result.values?.[f.key] !== 'string') throw new Error('AI 필드 응답을 확인할 수 없습니다.')
        next[f.key] = result.values[f.key]
      }
      setDraft({ values: next, warnings: result.warnings || [] })
    } catch (e) { if (current === sequence.current) setError(e.message) }
    finally { if (current === sequence.current) setAiBusy(false) }
  }
  function changeValue(key, value) { setValues(v => ({ ...v, [key]: value })); setDraft(null) }
  async function save(e) {
    e.preventDefault()
    if (!template || locked || draft || rulesLoading || rulesError) return
    if (ruleId && (!selectedRule || selectedRule.selectable === false)) {
      setError('사용 가능한 결재 규칙을 다시 선택하세요.'); return
    }
    setBusy(true); setError('')
    try {
      const result = await createGeneratedDocument({ template_id: template.id, document_title: title, html_content: html,
        extracted_json: Object.fromEntries(fields.map(field => [field.key, String(values[field.key] ?? '')])),
        applied_rule_id: ruleId ? Number(ruleId) : null })
      onCreated(result.id)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">문서 작성</h2><p className="text-sm text-slate-500 mt-1">양식을 선택하고 직접 입력하거나 AI 초안을 검토해 문서를 작성하세요.</p></div>
    {error && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700">{error}</p>}
    <div className="grid lg:grid-cols-2 gap-5">
      <form onSubmit={save} className="panel space-y-4">
        <label className="block text-sm font-medium">양식<select aria-label="양식 선택" className="field mt-2" value={selected} disabled={locked} required onChange={e => select(e.target.value)}><option value="">양식을 선택하세요</option>{templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}</select></label>
        {loading && <p>양식을 불러오는 중…</p>}
        {template && <>
          <div className="sticky top-3 z-10 rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-700">작성한 문서 저장</span>
            <button type="submit" className="btn btn-primary" disabled={locked || Boolean(draft) || rulesLoading || Boolean(rulesError)}>{busy ? '저장 중…' : '문서 저장'}</button>
            {draft && <p className="w-full text-xs text-slate-500">초안을 적용하거나 닫은 뒤 문서를 저장하세요.</p>}
          </div>
          <section className="space-y-2 rounded-xl border border-slate-200 p-3" aria-label="결재 규칙 선택">
            <label className="block text-sm font-medium">결재 규칙
              <select aria-label="결재 규칙 선택" className="field mt-2" value={ruleId}
                disabled={locked || rulesLoading || Boolean(rulesError)} onChange={e => setRuleId(e.target.value)}>
                <option value="">결재 규칙 없이 작성</option>
                {rules.map(rule => <option key={rule.id} value={String(rule.id)} disabled={rule.selectable === false}>
                  {rule.rule_name}{rule.selectable === false ? ' (사용 불가)' : ''}
                </option>)}
              </select>
            </label>
            {rulesLoading && <p className="text-xs text-slate-500" role="status">결재 규칙을 불러오는 중…</p>}
            {rulesError && <div role="alert" className="text-sm text-red-700">
              <p>{rulesError}</p>
              <button type="button" className="btn mt-2" disabled={locked || rulesLoading} onClick={() => loadRules(template.id)}>다시 불러오기</button>
            </div>}
            {!rulesLoading && !rulesError && !rules.length && <p className="text-xs text-slate-500">이 양식에 연결된 활성 결재 규칙이 없습니다. 규칙 없이 작성할 수 있습니다.</p>}
            {!rulesLoading && !rulesError && rules.filter(rule => rule.selectable === false).map(rule =>
              <p key={rule.id} className="text-xs text-amber-800">{rule.rule_name}: {rule.unavailable_reason}</p>)}
            {selectedRule && <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-2">
              <p className="font-semibold">{selectedRule.rule_name}</p>
              <p className="whitespace-pre-wrap break-words">{selectedRule.rule_text}</p>
              <p className="text-xs text-slate-600">결재선: {selectedRule.approval_line_text || '미등록'}</p>
            </div>}
          </section>
          <label className="block text-sm font-medium">문서 제목<input className="field mt-2" required maxLength={255} value={title} disabled={locked} onChange={e => setTitle(e.target.value)} /></label>
          {fields.length > 0 && <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3" aria-label="AI 문서 초안">
            <h3 className="font-semibold">AI로 초안 작성</h3>
            <label className="block text-sm">작성할 내용<textarea className="field mt-2" rows={4} maxLength={10000}
              placeholder="예: 11월 18일 부산 출장, 목적은 고객사 업무 협의. 교통비는 첨부 영수증 참고."
              value={description} disabled={locked} onChange={e => { setDescription(e.target.value); setDraft(null) }} /></label>
            <label className="block text-sm">영수증·참고자료 (선택, 최대 5MB)
              <input ref={fileInput} className="field mt-2" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={locked}
                onChange={e => {
                  const file = e.target.files?.[0] || null
                  setDraft(null); setError('')
                  if (file && file.size > 5 * 1024 * 1024) { setError('영수증은 최대 5MB입니다.'); e.target.value = ''; setReceipt(null); return }
                  setReceipt(file)
                }} />
            </label>
            <p className="text-xs text-slate-600">설명·현재 입력값·첨부자료가 OpenAI로 전송됩니다. AI가 알 수 없는 값은 비워 두므로 직접 확인하세요.</p>
            <button type="button" className="btn btn-primary" disabled={locked} onClick={createDraft}>{aiBusy ? 'AI 작성 중…' : 'AI 초안 만들기'}</button>
            {draft && <div className="space-y-3" aria-live="polite">
              <h4 className="font-semibold">초안 검토</h4>
              <dl className="space-y-2">{fields.map(f => <div key={f.key}><dt className="text-xs font-semibold">{f.label || f.key}</dt><dd className="text-sm whitespace-pre-wrap break-words">{draft.values[f.key] || '(확인 필요)'}</dd></div>)}</dl>
              {draft.warnings.map((warning, i) => <p className="text-sm text-amber-800" key={i}>{warning}</p>)}
              <button type="button" className="btn btn-primary" disabled={locked} onClick={() => { setValues(draft.values); setDraft(null) }}>초안을 입력란에 적용</button>
              <button type="button" className="btn" disabled={locked} onClick={() => setDraft(null)}>초안 닫기</button>
            </div>}
          </section>}
          {fields.map(f => {
            const required = Boolean(f.required || template.template_schema?.required?.includes(f.key))
            return <label key={f.key} className="block text-sm font-medium">{f.label || f.key}{required ? ' *' : ''}
              {f.type === 'textarea' ? <textarea className="field mt-2" rows={4} value={values[f.key] ?? ''} required={required} disabled={locked} onChange={e => changeValue(f.key, e.target.value)} />
                : <input className="field mt-2" value={values[f.key] ?? ''} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step={f.type === 'number' ? 'any' : undefined} required={required} disabled={locked} onChange={e => changeValue(f.key, e.target.value)} />}
              {f.description && <span className="block mt-1 text-xs text-slate-500">{f.description}</span>}
            </label>
          })}
          {!fields.length && <p className="text-sm text-slate-500">입력 필드가 없는 양식입니다. 본문을 그대로 저장합니다.</p>}

        </>}
      </form>
      <section className="panel"><h3 className="font-semibold mb-3">문서 미리보기</h3>{template ? <SafeHtmlFrame html={html} title="작성 중인 문서 미리보기" height={650} /> : <p className="text-sm text-slate-500">양식을 선택하면 미리보기가 표시됩니다.</p>}</section>
    </div>
  </div>
}
