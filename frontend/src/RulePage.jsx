import { useEffect, useId, useRef, useState } from 'react'
import { getApprovalRuleCatalog, getApprovalRules, createApprovalRule, updateApprovalRule,
  deleteApprovalRule, getApprovalRuleLine, previewApprovalRulesByGuide, savePreviewApprovalRules } from './api'
import { APPROVAL_TYPES, emptyStep, emptyRule, editableRule, serializeRule, getRuleIssues } from './approval-rule-utils'

function RuleEditor({ value, onChange, catalog, disabled, prefix, excerpt = false, preview = false }) {
  const id = useId()
  const issues = preview ? getRuleIssues(value, catalog) : []
  function change(patch) { onChange({ ...value, ...patch, validation_errors: [] }) }
  function step(index, patch) { change({ approvers: value.approvers.map((a, i) => i === index ? { ...a, ...patch } : a) }) }
  function move(index, offset) {
    const next = [...value.approvers], target = index + offset
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    change({ approvers: next })
  }
  return <fieldset disabled={disabled} aria-label={prefix} className="space-y-4">
    {preview && <div className="text-sm" aria-label={`${prefix} 저장 전 확인`}>
      {issues.length ? <ul className="text-amber-800 list-disc pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
        : <p className="text-emerald-800">필수 항목이 입력되었습니다. 근거와 결재 순서를 검토한 뒤 저장하세요.</p>}
    </div>}
    {preview && value.template_hint && <p className="text-sm text-slate-600 whitespace-pre-wrap">원문 양식/문서 종류: {value.template_hint}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      <label htmlFor={`${id}-name`} className="text-sm">규칙명<input id={`${id}-name`} aria-label="규칙명" className="field mt-2" required maxLength={255} value={value.rule_name} onChange={e => change({ rule_name: e.target.value })} /></label>
      <label htmlFor={`${id}-template`} className="text-sm">적용 양식<select id={`${id}-template`} aria-label="적용 양식" className="field mt-2" required value={value.template_id} onChange={e => change({ template_id: e.target.value })}>
        <option value="">양식을 선택하세요</option>
        {value.template_id && !catalog.templates.some(t => String(t.id) === String(value.template_id)) && <option value={value.template_id} disabled>미등록/비활성 양식 #{value.template_id}</option>}
        {catalog.templates.map(t => <option key={t.id} value={t.id}>{t.template_name} · #{t.id}</option>)}
      </select></label>
    </div>
    <label className="block text-sm">규칙 설명<textarea aria-label="규칙 설명" className="field mt-2" rows={3} required maxLength={10000} value={value.rule_text} onChange={e => change({ rule_text: e.target.value })} /></label>
    {excerpt && <label className="block text-sm">근거 문장<textarea aria-label="근거 문장" className="field mt-2" rows={2} maxLength={8000} value={value.source_excerpt || ''} onChange={e => change({ source_excerpt: e.target.value })} /></label>}
    <div className="flex items-center justify-between gap-2"><span className="font-medium text-sm">결재자와 순서</span>
      <button type="button" className="btn" disabled={disabled || value.approvers.length >= 20} onClick={() => change({ approvers: [...value.approvers, emptyStep()] })}>결재자 추가</button></div>
    {value.approvers.map((a, i) => <div key={a._key} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg p-3">
      {preview && a.approver_hint && <p className="w-full text-sm text-slate-600 whitespace-pre-wrap">원문 승인 역할: {a.approver_hint}</p>}
      <span className="text-sm">{i + 1}차</span>
      <select className="field flex-1 min-w-48" aria-label={`${prefix} ${i + 1}차 결재자`} required value={a.approver_member_id} onChange={e => step(i, { approver_member_id: e.target.value })}>
        <option value="">조직원을 선택하세요</option>
        {a.approver_member_id && !catalog.members.some(m => String(m.id) === String(a.approver_member_id)) && <option value={a.approver_member_id} disabled>미등록/비활성 조직원 #{a.approver_member_id}</option>}
        {catalog.members.map(m => <option key={m.id} value={m.id}>{m.name} · {m.title} · {m.department || '부서 없음'} · #{m.id}</option>)}
      </select>
      <select className="field w-auto" aria-label={`${prefix} ${i + 1}차 유형`} value={a.approval_type} onChange={e => step(i, { approval_type: e.target.value })}>
        {!APPROVAL_TYPES.includes(a.approval_type) && <option value={a.approval_type} disabled>유형을 선택하세요</option>}
        {APPROVAL_TYPES.map(t => <option key={t}>{t}</option>)}
      </select>
      <button type="button" className="btn" aria-label={`${prefix} ${i + 1}차 위로`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>↑</button>
      <button type="button" className="btn" aria-label={`${prefix} ${i + 1}차 아래로`} disabled={disabled || i === value.approvers.length - 1} onClick={() => move(i, 1)}>↓</button>
      <button type="button" className="btn" aria-label={`${prefix} ${i + 1}차 삭제`} onClick={() => change({ approvers: value.approvers.filter((_, j) => j !== i) })}>삭제</button>
    </div>)}
    {!value.approvers.length && <p className="text-sm text-amber-700">결재자를 추가하세요.</p>}
  </fieldset>
}

export default function RulePage() {
  const [catalog, setCatalog] = useState({ templates: [], members: [] })
  const [rules, setRules] = useState([]), [includeInactive, setIncludeInactive] = useState(false)
  const [form, setForm] = useState(emptyRule), [editing, setEditing] = useState(null)
  const [guide, setGuide] = useState(null), [drafts, setDrafts] = useState([]), [source, setSource] = useState('')
  const [busy, setBusy] = useState(''), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [line, setLine] = useState(null)
  const working = useRef(false), fileInput = useRef(null), loadVersion = useRef(0)
  const unavailable = !catalog.templates.length || !catalog.members.length
  async function load() {
    const version = ++loadVersion.current
    setLoading(true)
    try {
      const [nextCatalog, nextRules] = await Promise.all([getApprovalRuleCatalog(), getApprovalRules(includeInactive)])
      if (version === loadVersion.current) { setCatalog(nextCatalog); setRules(nextRules) }
    } finally { if (version === loadVersion.current) setLoading(false) }
  }
  useEffect(() => { load().catch(e => setError(e.message)); return () => { loadVersion.current++ } }, [includeInactive])
  async function operate(name, action) {
    if (working.current) return
    working.current = true; setBusy(name); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e.message) }
    finally { working.current = false; setBusy('') }
  }
  async function refreshAfterSave() {
    try { await load() } catch (e) { setError(`저장은 완료됐지만 목록을 불러오지 못했습니다: ${e.message}`) }
  }
  function save(e) {
    e.preventDefault()
    operate('manual', async () => {
      const body = serializeRule(form, catalog)
      if (editing == null) await createApprovalRule(body)
      else await updateApprovalRule(editing, body)
      setNotice(editing == null ? '규칙을 등록했습니다.' : '규칙을 수정했습니다.')
      setEditing(null); setForm(emptyRule()); setLine(null); await refreshAfterSave()
    })
  }
  function analyze() {
    operate('analyze', async () => {
      if (!guide || !guide.name.toLowerCase().endsWith('.pdf')) throw new Error('PDF 파일을 선택하세요.')
      if (guide.size > 5 * 1024 * 1024) throw new Error('PDF는 5MB 이하여야 합니다.')
      setDrafts([]); setLine(null)
      const result = await previewApprovalRulesByGuide(guide)
      setSource(result.source_name)
      setDrafts((result.rules || []).map(r => ({ ...editableRule(r), _key: crypto.randomUUID() })))
      setNotice(result.rules?.length ? 'AI가 규정 초안을 추출했습니다. 미지정 양식·결재자를 선택하고 근거와 순서를 검토하세요. 아직 DB에는 저장되지 않았습니다.' : '승인·허가·보고 절차의 근거가 있는 규칙을 찾지 못했습니다. PDF 원문을 확인하거나 수동 등록을 이용하세요.')
    })
  }
  function saveDrafts() {
    operate('batch', async () => {
      if (!drafts.length) throw new Error('저장할 초안이 없습니다.')
      const rules = drafts.map((r, i) => {
        try { return serializeRule(r, catalog) } catch (e) { throw new Error(`초안 ${i + 1}: ${e.message}`) }
      })
      const result = await savePreviewApprovalRules({ source_name: source, rules })
      setNotice(`${result.saved_rule_count}개 규칙을 저장했습니다.`)
      setDrafts([]); setGuide(null); setSource(''); if (fileInput.current) fileInput.current.value = ''
      await refreshAfterSave()
    })
  }
  function remove(rule) {
    if (!window.confirm(`${rule.rule_name} 규칙을 비활성화할까요? 기존 생성 문서는 유지됩니다.`)) return
    operate('delete', async () => {
      await deleteApprovalRule(rule.id)
      if (editing === rule.id) { setEditing(null); setForm(emptyRule()) }
      setLine(null); setNotice('규칙을 비활성화했습니다.'); await refreshAfterSave()
    })
  }
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">결재규칙 관리</h2><p className="text-sm text-slate-500 mt-1">양식별 결재자와 순서를 관리합니다. AI는 초안을 제안하며, 저장된 정보로 백엔드가 결재선을 구성합니다.</p></div>
    {error && <p role="alert" className="panel bg-red-50 text-red-700">{error}</p>}
    {notice && <p role="status" className="panel bg-emerald-50 text-emerald-800">{notice}</p>}
    {!loading && unavailable && <p className="panel text-amber-800">규칙을 저장하려면 활성 양식과 조직원이 필요합니다. AI 초안 생성은 먼저 할 수 있습니다. 조직원에게 로그인 계정이 없어도 됩니다.</p>}
    <form className="panel space-y-4" onSubmit={save} aria-label="수동 규칙 폼">
      <h3 className="text-lg font-semibold">{editing == null ? '수동 규칙 등록' : `규칙 #${editing} 수정`}</h3>
      <RuleEditor value={form} onChange={setForm} catalog={catalog} disabled={!!busy || loading || unavailable} prefix="수동" excerpt={form.source_type === 'guide'} />
      <div className="flex gap-2"><button className="btn btn-primary" disabled={!!busy || loading || unavailable}>{busy === 'manual' ? '저장 중…' : editing == null ? '규칙 등록' : '수정 저장'}</button>
        {editing != null && <button type="button" className="btn" disabled={!!busy} onClick={() => { setEditing(null); setForm(emptyRule()) }}>수정 취소</button>}</div>
    </form>
    <section className="panel space-y-4" aria-label="AI 규칙 초안">
      <h3 className="text-lg font-semibold">PDF 지침서로 AI 초안 생성</h3>
      <p className="text-sm text-slate-500">텍스트 PDF, 최대 5MB·100페이지·20,000자. 분석 시 지침서 텍스트와 양식·조직원 기본 정보가 OpenAI API로 전달됩니다. 미지정 양식과 결재자는 분석 후 직접 선택할 수 있습니다.</p>
      <input ref={fileInput} type="file" accept=".pdf,application/pdf" aria-label="PDF 지침서" disabled={!!busy}
        onChange={e => { setGuide(e.target.files?.[0] || null); setDrafts([]); setSource(''); setNotice(''); setError('') }} />
      <button className="btn" disabled={!!busy || loading || !guide} onClick={analyze}>{busy === 'analyze' ? 'AI 분석 중…' : 'AI 초안 생성'}</button>
      {!!drafts.length && <div className="space-y-4">
        <p className="text-sm">출처: {source} · 초안 {drafts.length}개 · 저장 전 수정 가능</p>
        {drafts.map((draft, i) => <article key={draft._key} className="border rounded-xl p-4 space-y-3" aria-label={`초안 ${i + 1}`}>
          <div className="flex justify-between"><h4 className="font-semibold">초안 {i + 1}</h4><button className="btn" disabled={!!busy} onClick={() => setDrafts(v => v.filter((_, j) => j !== i))}>초안 삭제</button></div>
          {draft.review_notes?.length > 0 && <p className="text-sm text-slate-600 whitespace-pre-wrap">AI 추출 참고: {draft.review_notes.join(' ')}</p>}
          <RuleEditor value={draft} onChange={next => setDrafts(v => v.map((r, j) => j === i ? next : r))} catalog={catalog} disabled={!!busy} prefix={`초안 ${i + 1}`} excerpt preview />
        </article>)}
        {drafts.some(d => getRuleIssues(d, catalog).length > 0) && <p className="text-sm text-amber-800">모든 초안의 필수 항목을 입력해야 일괄 저장할 수 있습니다. 필요 없는 초안은 삭제하세요.</p>}
        <button className="btn btn-primary" disabled={!!busy || loading || drafts.some(d => getRuleIssues(d, catalog).length > 0)} onClick={saveDrafts}>{busy === 'batch' ? '저장 중…' : '수정한 초안 일괄 저장'}</button>
      </div>}
    </section>
    <section className="panel space-y-4" aria-label="저장된 규칙">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-semibold">저장된 규칙 {rules.length}개</h3><div className="flex gap-3 items-center">
        <label className="text-sm"><input type="checkbox" checked={includeInactive} disabled={!!busy} onChange={e => { setIncludeInactive(e.target.checked); setError('') }} /> 비활성 포함</label>
        <button className="btn" disabled={!!busy || loading} onClick={() => load().catch(e => setError(e.message))}>새로고침</button>
      </div></div>
      {loading && <p>목록을 불러오는 중…</p>}
      {!loading && !rules.length && <p className="text-sm text-slate-500">저장된 규칙이 없습니다.</p>}
      {rules.map(rule => <article key={rule.id} className="border rounded-xl p-4 space-y-3" aria-label={`규칙 ${rule.id}`}>
        <div className="flex flex-wrap justify-between gap-3"><div><h4 className="font-semibold">{rule.rule_name}</h4><p className="text-xs text-slate-500">#{rule.id} · {rule.template_name} · {rule.is_active ? '활성' : '비활성'} · {rule.source_type === 'guide' ? `지침서: ${rule.source_name || ''}` : '수동 등록'}</p></div>
          <div className="flex gap-2 flex-wrap"><button className="btn" disabled={!!busy || !rule.is_active} onClick={() => { setEditing(rule.id); setForm(editableRule(rule)); setNotice(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>수정</button>
            <button className="btn" disabled={!!busy || !rule.is_active} onClick={() => remove(rule)}>삭제(비활성화)</button>
            <button className="btn" disabled={!!busy || !rule.is_active} onClick={() => operate('line', async () => { setLine(await getApprovalRuleLine(rule.id)) })}>서버 결재선 확인</button></div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{rule.rule_text}</p>
        {rule.source_excerpt && <p className="text-sm text-amber-800 whitespace-pre-wrap">근거: {rule.source_excerpt}</p>}
        {!rule.template_active && <p className="text-sm text-red-700">양식이 비활성 상태입니다.</p>}
        <ol className="flex flex-wrap gap-2">{rule.approvers.map(a => <li key={a.approval_order} className="rounded bg-slate-100 px-3 py-2 text-sm">{a.approval_order}차 · {a.approver_name} {a.approver_title} · {a.approval_type}{a.member_active === false ? ' (비활성 조직원)' : ''}</li>)}</ol>
      </article>)}
    </section>
    {line && <section className="panel space-y-3" aria-label="서버 결재선 결과"><h3 className="font-semibold">서버 결재선 · 규칙 #{line.rule_id}</h3><p className="whitespace-pre-wrap">{line.approval_line_text}</p>
      <details><summary className="cursor-pointer text-sm">서버 결재선 JSON / placeholder 값</summary><pre className="text-xs overflow-auto mt-3">{JSON.stringify(line, null, 2)}</pre></details></section>}
  </div>
}
