// src/TemplateManager.jsx
// 결재서류 양식 관리 페이지
// - DOCX 업로드 → 셀 매핑 → DB 저장
// - 저장된 양식 목록 조회 / 상세 미리보기

import { useEffect, useRef, useState, useMemo } from 'react'
import SafeHtmlFrame from './SafeHtmlFrame'
import { mappingPreview, validateMapping, configureCompositeFields } from './template-utils'
import {
  previewTemplateFields,
  recommendTemplateFields,
  saveTemplateWithFields,
  getTemplates,
  getTemplateDetail,
  deactivateTemplate,
  updateTemplate,
} from './api'

// =================== 작은 UI 부품 ===================
function Spinner({ size = 4 }) {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
    </svg>
  )
}

function Button({ onClick, loading, children, variant = 'primary', disabled, className = '' }) {
  const base =
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
  }
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className={`${base} ${styles[variant] || styles.primary} ${className}`}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}

function Label({ children }) {
  return <div className="text-sm font-medium text-slate-700 mb-1">{children}</div>
}

function Input(props) {
  return (
    <input {...props}
      className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
    />
  )
}

function Toast({ kind = 'info', children, onClose }) {
  if (!children) return null
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  }
  return (
    <div className={`mt-3 border rounded-md px-3 py-2 text-sm flex items-start justify-between gap-2 ${styles[kind]}`}>
      <span className="whitespace-pre-wrap break-words">{children}</span>
      {onClose && (
        <button className="text-current opacity-60 hover:opacity-100" onClick={onClose}>×</button>
      )}
    </div>
  )
}

function DropZone({ accept, onFiles, hint, file }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)
  const handleFiles = (list) => {
    if (!list || list.length === 0) return
    onFiles(Array.from(list)[0])
  }
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
      className={`cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition ${
        drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400'
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />
      <div className="text-2xl mb-1">📂</div>
      <div className="text-slate-600 text-xs">{hint}</div>
      {file && <div className="mt-2 text-blue-700 text-xs font-medium break-all">{file.name}</div>}
    </div>
  )
}

// 필드 사이 삽입 버튼
function InsertDivider({ onClick }) {
  return (
    <div className="flex items-center gap-1 my-1 group">
      <div className="flex-1 h-px bg-slate-200 group-hover:bg-indigo-300 transition" />
      <button
        onClick={onClick}
        className="text-[11px] text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 border border-transparent group-hover:border-indigo-200 rounded px-2 py-0.5 transition"
      >
        + 여기에 삽입
      </button>
      <div className="flex-1 h-px bg-slate-200 group-hover:bg-indigo-300 transition" />
    </div>
  )
}

// ===================== 메인 컴포넌트 =====================
export default function TemplateManager() {
  // 입력 상태
  const [templateName, setTemplateName] = useState('')
  const [docxFile, setDocxFile] = useState(null)
  const [uploadKey, setUploadKey] = useState(0)

  // 분석 결과
  const fileVersion = useRef(0)
  const [showMapped, setShowMapped] = useState(false)
  const [importSaved, setImportSaved] = useState(false)
  const [analysis, setAnalysis] = useState(null)        // { html_template, preview_html, fields, ... }
  const [fields, setFields] = useState([])              // 사용자가 수정 가능한 fields
  const [cellTexts, setCellTexts] = useState({})        // cell_id → 원본 셀 텍스트

  // cell_id 클릭 입력 모드: 현재 포커스된 필드 인덱스
  const [focusedCellIdIndex, setFocusedCellIdIndex] = useState(null)
  const [multiAddMode, setMultiAddMode] = useState(false)
  const [manualKey, setManualKey] = useState('')
  const [manualLabel, setManualLabel] = useState('')

  // 로딩/메시지
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // 목록 / 상세
  const [list, setList] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)

  // ============== 목록 새로고침 ==============
  const refreshList = async () => {
    setListLoading(true)
    try {
      const items = await getTemplates()
      setList(items)
    } catch (e) {
      setErrorMsg(`목록 조회 실패: ${e.message || e}`)
    } finally {
      setListLoading(false)
    }
  }
  useEffect(() => { refreshList() }, [])

  // ============== DOCX 미리보기 (AI 호출 없음) ==============
  const handleAnalyze = async () => {
    setErrorMsg(''); setSuccessMsg('')
    if (!docxFile) { setErrorMsg('DOCX 파일을 업로드해주세요.'); return }
    if (!docxFile.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg('DOCX 파일만 업로드 가능합니다. (HWP/HWPX 미지원)'); return
    }
    if (!templateName.trim()) { setErrorMsg('양식 이름을 입력해주세요.'); return }

    setAiResult(null)
    setAnalyzing(true)
    const version = fileVersion.current
    try {
      const data = await previewTemplateFields({
        template: docxFile,
        template_name: templateName,
      })
      if (version !== fileVersion.current) return
      setAnalysis(data)
      setImportSaved(false)
      setFocusedCellIdIndex(null)
      // 분석된 fields 에 description 빈 칸 부여
      const enriched = (data.fields || []).map((f) => ({
        _id: crypto.randomUUID(),
        label: f.label || '',
        key: f.key || '',
        type: f.type || 'string',
        required: !!f.required,
        cell_id: (f.cell_ids && f.cell_ids[0]) || f.cell_id || '',
        cell_ids: f.cell_ids || (f.cell_id ? [f.cell_id] : []),
        cell_template: f.cell_template || '',
        description: f.description || '',
      }))
      setFields(enriched)
      setCellTexts(data.cell_texts || {})
    } catch (e) {
      setErrorMsg(e.message || String(e))
    } finally {
      if (version === fileVersion.current) setAnalyzing(false)
    }
  }

  const handleAiRecommend = async () => {
    if (!analysis || !docxFile || editingTemplate || aiBusy || analyzing || saving || importSaved) return
    const version = fileVersion.current
    setAiBusy(true); setAiResult(null); setErrorMsg(''); setSuccessMsg('')
    try {
		const body = new FormData()
		body.append('file', docxFile)
		body.append('template_name', templateName || '')
		body.append('source_sha256', analysis.source_sha256)

		const result = await recommendTemplateFields(body)
      if (version !== fileVersion.current) return
      if (result.source_sha256 !== analysis.source_sha256) throw new Error('양식 파일이 변경되었습니다. 미리보기를 다시 실행하세요.')
      const recommended = (result.fields || []).map(f => ({ ...f, _id: crypto.randomUUID() }))
      // 기존 수동 매핑 검증을 그대로 통과한 추천만 적용 후보로 표시합니다.
      if (recommended.length) validateMapping(recommended, analysis.cells || [])
      setAiResult({ fields: recommended, warnings: result.warnings || [] })
    } catch (e) {
      if (version === fileVersion.current) setErrorMsg(e.message || String(e))
    } finally {
      if (version === fileVersion.current) setAiBusy(false)
    }
  }
  const applyAiFields = () => {
    if (!aiResult || saving || importSaved) return
    if (fields.length && !window.confirm('현재 필드 연결을 AI 추천으로 교체할까요?')) return
    setFields(aiResult.fields); setFocusedCellIdIndex(null); setShowMapped(true)
    setSuccessMsg('AI 추천을 적용했습니다. 표의 연결 위치와 필수 여부를 확인한 뒤 저장하세요.')
    setAiResult(null)
  }

  // ============== DB 저장 ==============
  const handleSave = async () => {
    if (saving) return
    setErrorMsg(''); setSuccessMsg('')
    if (!docxFile && !editingTemplate) { setErrorMsg('DOCX 파일이 필요합니다.'); return }
    if (!analysis) { setErrorMsg('먼저 DOCX 미리보기를 생성하세요.'); return }
    if (importSaved) { setErrorMsg('이미 저장한 양식입니다. 새로 시작 버튼을 사용하세요.'); return }
    try { validateMapping(fields, analysis.cells || []) } catch (e) { setErrorMsg(e.message); return }
    if (!templateName.trim()) { setErrorMsg('양식 이름이 필요합니다.'); return }

    // normalize: key 비어있는 항목 제거
    const normalized = (fields || [])
      .filter((f) => f.key && String(f.key).trim())
      .map((f) => ({
        label: f.label || f.key,
        key: String(f.key).trim(),
        type: f.type || 'string',
        required: !!f.required,
        description: f.description || '',
        cell_id: (f.cell_ids && f.cell_ids[0]) || f.cell_id || '',
        cell_ids: f.cell_ids || (f.cell_id ? [f.cell_id] : []),
        cell_template: f.cell_template || '',
      }))

    setSaving(true)
    try {
      let data
      if (editingTemplate) {
        // 기존 양식의 셀 연결은 JSON PATCH 요청으로 수정합니다.
        data = await updateTemplate(editingTemplate.id, {
          template_name: templateName,
          template_fields: normalized,
          remap_fields: true,
          expected_updated_at: editingTemplate.updated_at,
        })
      } else {
        // 신규 DOCX 등록에 필요한 FormData는 페이지에서 구성합니다.
        const body = new FormData()
        body.append('file', docxFile)
        body.append('template_name', templateName)
        body.append('fields', JSON.stringify(normalized))
        body.append('source_sha256', analysis.source_sha256)
        data = await saveTemplateWithFields(body)
      }
      resetAll()
      setDetail(null)
      setSuccessMsg(`저장되었습니다 (id: ${data.id}, 키 ${data.placeholder_keys?.length ?? 0}개). 입력란을 비웠습니다.`)
      await refreshList()
    } catch (e) {
      setErrorMsg(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  // ============== 상세 보기 ==============
  const handleViewDetail = async (id) => {
    setDetail(null)
    setDetailLoading(true)
    setErrorMsg('')
    try {
      const data = await getTemplateDetail(id)
      setDetail(data)
    } catch (e) {
      setErrorMsg(`상세 조회 실패: ${e.message || e}`)
    } finally {
      setDetailLoading(false)
    }
  }
  const handleEdit = async (id) => {
    if (saving || detailLoading) return
    setErrorMsg(''); setSuccessMsg(''); setDetailLoading(true)
    try {
      const data = await getTemplateDetail(id)
      if (!data.mapping_preview_html || !Array.isArray(data.cells)) {
        throw new Error('셀 연결 편집용 정보를 받지 못했습니다. 백엔드 패치를 먼저 적용하세요.')
      }
      resetAll()
      setDetail(null)
      setEditingTemplate({ id: data.id, updated_at: data.updated_at })
      setTemplateName(data.template_name || '')
      const next = (data.template_fields || []).map(f => ({ ...f, _id: crypto.randomUUID(),
        cell_ids: f.cell_ids?.length ? f.cell_ids : f.cell_id ? [f.cell_id] : [],
        cell_id: f.cell_ids?.[0] || f.cell_id || '', cell_template: f.cell_template || '' }))
      setFields(next)
      setAnalysis({ preview_html: data.mapping_preview_html, cells: data.cells,
        warnings: data.mapping_warnings || [], fields: next })
      setCellTexts(Object.fromEntries(data.cells.map(c => [c.cell_id, c.text || ''])))
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
    } catch (e) { setErrorMsg(e.message || String(e)) }
    finally { setDetailLoading(false) }
  }
  const closeDetail = () => setDetail(null)

  // ============== 필드 편집 헬퍼 ==============
  const updateField = (i, patch) =>
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const removeField = (i) => {
    setFields((fs) => fs.filter((_, j) => j !== i))
    setFocusedCellIdIndex(null)
  }
  const removeCellFromField = (i, cid) =>
    setFields((fs) => fs.map((f, j) => {
      if (j !== i) return f
      const newIds = (f.cell_ids || []).filter((c) => c !== cid)
      return { ...f, cell_ids: newIds, cell_id: newIds[0] || '' }
    }))
  // 특정 위치에 새 필드 삽입
  const insertFieldAt = (index, key = '', label = '') => {
    const newField = {
      _id: crypto.randomUUID(),
      label: label || '새 필드',
      key,
      type: 'string',
      required: false,
      description: '',
      cell_ids: [],
      cell_id: '',
      cell_template: '',
    }
    setFields((fs) => [
      ...fs.slice(0, index),
      newField,
      ...fs.slice(index),
    ])
    setFocusedCellIdIndex(index)
    setShowMapped(false)
    setErrorMsg('')
  }
  const addManualField = () => {
    const key = manualKey.trim()
    setErrorMsg(''); setSuccessMsg('')
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(key)) {
      setErrorMsg('key는 중괄호 없이 입력하세요. 영문 소문자로 시작하고 소문자·숫자·밑줄을 사용할 수 있습니다.'); return
    }
    if (fields.some(f => f.key === key)) { setErrorMsg(`이미 등록된 key입니다: ${key}`); return }
    insertFieldAt(fields.length, key, manualLabel.trim() || key)
    setManualKey(''); setManualLabel('')
    setSuccessMsg(`${key}를 추가했습니다. 왼쪽 표에서 연결할 셀을 클릭하거나, 다른 필드의 셀 템플릿에서 {{${key}}}로 사용하세요.`)
  }
  const configureComposite = (i) => {
    setErrorMsg(''); setSuccessMsg('')
    try {
      const next = configureCompositeFields(fields, i).map(f => ({ ...f, _id: f._id || crypto.randomUUID() }))
      setFields(next)
      setSuccessMsg(`셀 템플릿의 key로 필드를 구성했습니다. 셀에 연결된 key: ${next[i].key}. 추가된 필드의 라벨·타입·필수 여부를 확인하세요.`)
    } catch (e) { setErrorMsg(e.message) }
  }

  // ============== 미리보기 셀 클릭 → cell_id 자동 입력 ==============
  const handleCellPick = (cellId) => {
    if (saving || focusedCellIdIndex === null || !fields[focusedCellIdIndex]) return
    const f = fields[focusedCellIdIndex]
    const ids = multiAddMode ? [...new Set([...(f.cell_ids || []), cellId])] : [cellId]
    updateField(focusedCellIdIndex, { cell_ids: ids, cell_id: ids[0] || '' })
  }
  const handleDeactivate = async (id) => {
    if (!window.confirm('이 양식을 비활성화할까요? 기존 문서는 유지됩니다.')) return
    try { await deactivateTemplate(id); await refreshList(); if (detail?.id === id) setDetail(null) }
    catch (e) { setErrorMsg(e.message) }
  }
  const mappedHtml = useMemo(() => analysis ? mappingPreview(analysis.preview_html, fields) : '', [analysis, fields])

  const resetAll = () => {
    setTemplateName(''); setEditingTemplate(null); setDocxFile(null); setUploadKey(v => v + 1)
    setMultiAddMode(false)
    fileVersion.current++; setAiBusy(false); setAiResult(null); setImportSaved(false); setShowMapped(false); setAnalyzing(false)
    setFocusedCellIdIndex(null); setAnalysis(null); setFields([]); setCellTexts({})
    setManualKey(''); setManualLabel('')
    setErrorMsg(''); setSuccessMsg('')
  }

  // ===================== 렌더 =====================
  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">결재서류 양식 관리</h2>
          <p className="text-sm text-slate-500 mt-1">
            DOCX 양식을 미리보고 입력 셀을 연결한 뒤 저장하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={saving} onClick={resetAll}>새로 시작</Button>
          <Button variant="secondary" onClick={refreshList} loading={listLoading}>목록 새로고침</Button>
        </div>
      </div>

      {/* 3열 레이아웃 */}
      <fieldset disabled={saving} className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* ---------- 왼쪽: 입력 폼 ---------- */}
        <aside className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 h-fit">
          <h3 className="text-base font-semibold text-slate-800 mb-3">1. 양식 입력</h3>

          <div className="space-y-3">
            <div>
              <Label>양식 이름 *</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                placeholder="예: 출장 신청서" />
            </div>
            {editingTemplate ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              양식 #{editingTemplate.id}의 셀 연결을 수정하고 있습니다. 필드를 선택한 뒤 미리보기의 셀을 클릭하세요.
              <p className="mt-2 text-xs">새 DOCX로 등록하려면 새로 시작을 누르세요.</p>
            </div> : <>
            <div>
              <Label>DOCX 파일 *</Label>
              <DropZone
                key={uploadKey}
                accept=".docx"
                file={docxFile}
                onFiles={(f) => {
                  if (saving) return
                  fileVersion.current++; setAiBusy(false); setAiResult(null); setDocxFile(f); setAnalysis(null); setFields([])
                  setCellTexts({}); setFocusedCellIdIndex(null); setImportSaved(false); setShowMapped(false); setAnalyzing(false)
                }}
                hint="DOCX 파일을 끌어다 놓거나 클릭해서 선택"
              />
            </div>
            </>}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={handleAnalyze} loading={analyzing} disabled={aiBusy || saving || Boolean(editingTemplate)} className="w-full">
              {analyzing ? '변환 중...' : 'DOCX 미리보기'}
            </Button>
            <p className="text-xs text-slate-500">AI 추천 시 양식 내용이 OpenAI로 전송됩니다. 저장된 양식의 셀 연결 수정은 AI 없이 사용할 수 있습니다.</p>
            <Button onClick={handleAiRecommend} loading={aiBusy} variant="secondary"
              disabled={!analysis || importSaved || analyzing || saving || Boolean(editingTemplate)} className="w-full">
              {aiBusy ? 'AI 분석 중...' : 'AI 필드 추천'}
            </Button>
            <Button onClick={handleSave} loading={saving} variant="success" disabled={!analysis || importSaved || aiBusy || analyzing} className="w-full">
              {saving ? '저장 중...' : editingTemplate ? '양식 변경사항 저장' : 'DB에 양식 저장'}
            </Button>
          </div>

          {aiResult && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm space-y-2">
            <p className="font-semibold">AI 추천 {aiResult.fields.length}개</p>
            <ul className="space-y-1 max-h-64 overflow-auto">{aiResult.fields.map(f =>
              <li key={f.key}>{f.label} ({f.key}) → {f.cell_ids.join(', ')}</li>)}</ul>
            {aiResult.warnings.map((warning, i) => <p key={i} className="text-amber-800">{warning}</p>)}
            <p className="text-xs text-slate-600">추천 적용 시 현재 필드 연결이 교체됩니다. 적용 후 미리보기를 확인하세요.</p>
            <Button onClick={applyAiFields} disabled={!aiResult.fields.length || saving || importSaved}>추천 적용</Button>
            <Button variant="secondary" onClick={() => setAiResult(null)}>닫기</Button>
          </div>}
          <Toast kind="error" onClose={() => setErrorMsg('')}>{errorMsg}</Toast>
          <Toast kind="success" onClose={() => setSuccessMsg('')}>{successMsg}</Toast>
        </aside>

        {/* ---------- 가운데: HTML 미리보기 ---------- */}
        <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-800">2. HTML 미리보기</h3>
            <div className="flex items-center gap-2">
              {analysis && (
                <button
                  onClick={() => setMultiAddMode((v) => !v)}
                  className={[
                    'text-xs px-2 py-0.5 rounded-full border font-medium transition',
                    multiAddMode
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400',
                  ].join(' ')}
                >
                  {multiAddMode ? '다중추가 ON' : '다중추가 OFF'}
                </button>
              )}
              {focusedCellIdIndex !== null && (
                <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5 animate-pulse">
                  {multiAddMode ? '셀 클릭 → 추가' : '셀 클릭 → 교체'}
                </span>
              )}
            </div>
          </div>
          {!analysis ? (
            <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-10 text-center">
              아직 미리보기가 없습니다. 왼쪽에서 DOCX를 올리고 [DOCX 미리보기]을 눌러주세요.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button className="btn" onClick={() => setShowMapped(false)}>원본 셀 선택</button>
                <button className="btn" onClick={() => setShowMapped(true)}>매핑 결과 확인</button>
              </div>
              <SafeHtmlFrame html={showMapped ? mappedHtml : analysis.preview_html}
                title="양식 셀 매핑 미리보기"
                onCellPick={focusedCellIdIndex !== null && !showMapped ? handleCellPick : undefined}
                selectedCells={fields[focusedCellIdIndex]?.cell_ids || []} />
              {(analysis.warnings || []).map((warning, i) => <p key={i} className="text-xs text-amber-800">{warning}</p>)}
            </div>
          )}
        </section>

        {/* ---------- 오른쪽: 필드 리스트 ---------- */}
        <aside className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-800">3. 수동 placeholder 설정</h3>
          </div>

          {analysis && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-xs text-slate-700">직접 key를 추가한 뒤 왼쪽 표의 입력 칸을 클릭하세요. AI 없이 설정할 수 있습니다.</p>
            <input aria-label="추가할 key" className="w-full border rounded px-2 py-1 text-sm font-mono"
              placeholder="key: application_date" value={manualKey} onChange={e => setManualKey(e.target.value)} />
            <input aria-label="추가할 라벨" className="w-full border rounded px-2 py-1 text-sm"
              placeholder="라벨: 신청일 (선택)" value={manualLabel} onChange={e => setManualLabel(e.target.value)} />
            <Button variant="secondary" onClick={addManualField}>수동 key 추가</Button>
          </div>}

          {!analysis ? (
            <div className="text-sm text-slate-400">DOCX 미리보기 후 필드를 추가하세요.</div>
          ) : fields.length === 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-slate-500">등록한 key가 없습니다. 위 입력란에서 추가하세요.</div>
              <button
                onClick={() => insertFieldAt(0)}
                className="w-full text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-md py-1 hover:bg-indigo-50 transition"
              >
                + 여기에 삽입
              </button>
            </div>
          ) : (
            <div className="max-h-[36rem] overflow-auto pr-1">
              {/* 맨 위 삽입 버튼 */}
              <InsertDivider onClick={() => insertFieldAt(0)} />

              {fields.map((f, i) => (
                <div key={f._id || i}>
                  <div className={[
                    'bg-slate-50 rounded-lg p-3 border transition',
                    focusedCellIdIndex === i
                      ? 'border-indigo-400 ring-1 ring-indigo-100'
                      : 'border-slate-200',
                  ].join(' ')}>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>라벨</Label>
                        <input className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-sm"
                          value={f.label || ''} onChange={(e) => updateField(i, { label: e.target.value })} />
                      </div>
                      <div>
                        <Label>key (중괄호 없이)</Label>
                        <input className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-sm font-mono"
                          placeholder="application_date"
                          value={f.key || ''} onChange={(e) => updateField(i, { key: e.target.value })} />
                      </div>
                      <div>
                        <Label>타입</Label>
                        <select className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-sm"
                          value={f.type || 'string'} onChange={(e) => updateField(i, { type: e.target.value })}>
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="date">date</option>
                          <option value="textarea">textarea</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-3">
                        <label className="flex items-center gap-1 text-xs text-slate-700">
                          <input type="checkbox" checked={!!f.required}
                            onChange={(e) => updateField(i, { required: e.target.checked })} /> 필수
                        </label>
                        <button onClick={() => removeField(i)}
                          className="ml-auto text-xs text-red-500 hover:text-red-700">삭제</button>
                      </div>
                    </div>
                    {/*<div className="mt-2">
                      <Label>설명 (AI 힌트)</Label>
                      <input className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-sm"
                        value={f.description || ''}
                        onChange={(e) => updateField(i, { description: e.target.value })}
                        placeholder="예: 출장 목적을 한 문장으로" />
                    </div>*/}
                    {/* 연결된 셀 위치 (cell_ids) */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <Label>연결된 셀 위치</Label>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setFocusedCellIdIndex(focusedCellIdIndex === i ? null : i) }}
                          className={[
                            'text-[10px] px-2 py-0.5 rounded border font-medium transition',
                            focusedCellIdIndex === i
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-400',
                          ].join(' ')}
                        >
                          {focusedCellIdIndex === i ? (multiAddMode ? '추가 중...' : '교체 중...') : '셀 선택'}
                        </button>
                      </div>
                      <div
                        className={[
                          'min-h-[2rem] rounded-md border p-1 flex flex-wrap gap-1 items-start transition',
                          focusedCellIdIndex === i
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-slate-200 bg-white',
                        ].join(' ')}
                      >
                        {(f.cell_ids || []).length === 0 ? (
                          <span className="text-[11px] text-slate-400 px-1">
                            미리보기에서 셀을 클릭해 연결하세요
                          </span>
                        ) : (
                          (f.cell_ids || []).map((cid) => (
                            <span key={cid} className="inline-flex items-center gap-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-mono rounded px-1.5 py-0.5">
                              {cid}
                              {cellTexts[cid] && (
                                <span className="text-indigo-400 max-w-[60px] truncate" title={cellTexts[cid]}>
                                  ·{cellTexts[cid].slice(0, 8)}
                                </span>
                              )}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => removeCellFromField(i, cid)}
                                className="text-indigo-400 hover:text-red-500 ml-0.5 font-bold"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* cell_template — 한 셀에 여러 {{key}} 가 들어가는 경우 */}
                    {(f.cell_ids || []).length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between">
                          <Label>셀 템플릿 (선택, 날짜 등 복수 key용)</Label>
                          {(f.cell_ids || []).length > 0 && cellTexts[f.cell_ids[0]] && !f.cell_template && (
                            <button
                              type="button"
                              onClick={() => updateField(i, { cell_template: cellTexts[f.cell_ids[0]] })}
                              className="text-[10px] text-indigo-500 hover:text-indigo-700 mb-1"
                            >
                              원본으로 채우기
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono resize-y"
                          value={f.cell_template || ''}
                          placeholder={`비워두면 셀 전체를 {{${f.key || 'key'}}}로 교체\n날짜 예: {{year}}년 {{month}}월 {{day}}일`}
                          onChange={(e) => updateField(i, { cell_template: e.target.value })}
                        />
                        {f.cell_template && (
                          <div className="mt-1 space-y-1">
                            <button type="button" className="btn text-xs" onClick={() => configureComposite(i)}>
                              셀 템플릿의 key로 구성
                            </button>
                            <p className="text-xs text-slate-600">입력한 placeholder를 필드로 등록합니다. 셀이 하나이고 현재 key를 템플릿에서 쓰지 않으면 첫 placeholder의 key로 변경합니다.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 카드 아래 삽입 버튼 */}
                  <InsertDivider onClick={() => insertFieldAt(i + 1)} />
                </div>
              ))}
            </div>
          )}
        </aside>
      </fieldset>

      {/* ====================== 저장된 양식 목록 ====================== */}
      <section className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">저장된 결재서류 양식</h3>
          <span className="text-sm text-slate-500">총 {list.length}개</span>
        </div>

        {listLoading ? (
          <div className="text-sm text-slate-500 flex items-center gap-2"><Spinner /> 불러오는 중...</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-10 text-center">
            저장된 양식이 없습니다. 위에서 양식을 변환하고 [DB에 양식 저장]을 눌러보세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-xl p-4 hover:border-blue-400 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-800 break-all">{t.template_name}</div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-2 py-0.5 shrink-0">#{t.id}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 break-all">{t.file_name || '-'}</div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    {t.is_active === false ? '비활성' : '활성'}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => handleViewDetail(t.id)}>상세 보기</Button>
                    <Button disabled={saving || detailLoading} onClick={() => handleEdit(t.id)}>수정</Button>
                    <Button variant="danger" disabled={t.is_active === false} onClick={() => handleDeactivate(t.id)}>비활성화</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ====================== 상세 모달 ====================== */}
      {detail !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={closeDetail}>
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">템플릿 #{detail.id}</div>
                <h4 className="text-xl font-bold text-slate-800">{detail.template_name}</h4>
              </div>
              <button onClick={closeDetail}
                className="text-slate-500 hover:text-slate-800 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-5">
              <Button disabled={saving || detailLoading} onClick={() => handleEdit(detail.id)}>셀 연결·필드 수정</Button>
              <div>
                <h5 className="font-semibold text-slate-700 mb-2">필드 ({(detail.fields || []).length}개)</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {(detail.fields || []).map((f, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-md p-2">
                      <div className="font-medium text-slate-800">{f.label || f.key}</div>
                      <div className="text-xs text-slate-500 font-mono break-all">{f.key} · {f.type}</div>
                      {f.description && <div className="text-xs text-slate-500 mt-1">{f.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="font-semibold text-slate-700 mb-2">HTML 미리보기</h5>
                <SafeHtmlFrame html={detail.html_content || ''} title="저장된 양식 미리보기" />
                <details className="mt-3"><summary>저장된 JSON 매핑 확인</summary>
                  <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify({ template_schema: detail.template_schema, placeholder_keys: detail.placeholder_keys, template_fields: detail.template_fields }, null, 2)}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-xl">
            <Spinner /> 상세 정보를 불러오는 중...
          </div>
        </div>
      )}
    </div>
  )
}
