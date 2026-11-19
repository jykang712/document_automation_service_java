// src/TemplateManager.jsx
// 결재서류 양식 관리 페이지
// - DOCX 업로드 → AI 분석 → fields 편집 → DB 저장
// - 저장된 양식 목록 조회 / 상세 미리보기

import { useEffect, useRef, useState } from 'react'
import {
  previewTemplateFields,
  saveTemplateWithFields,
  getTemplates,
  getTemplateDetail,
} from './api'

// =================== 작은 UI 부품 ===================
function Spinner({ size = 4 }) {
  return (
    <svg className={`animate-spin h-${size} w-${size}`} viewBox="0 0 24 24" fill="none">
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
  const [description, setDescription] = useState('')
  const [docxFile, setDocxFile] = useState(null)

  // 분석 결과
  const [analysis, setAnalysis] = useState(null)        // { html_template, preview_html, fields, ... }
  const [fields, setFields] = useState([])              // 사용자가 수정 가능한 fields
  const [cellTexts, setCellTexts] = useState({})        // cell_id → 원본 셀 텍스트

  // cell_id 클릭 입력 모드: 현재 포커스된 필드 인덱스
  const [focusedCellIdIndex, setFocusedCellIdIndex] = useState(null)
  const [multiAddMode, setMultiAddMode] = useState(false)

  // 로딩/메시지
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // 목록 / 상세
  const [list, setList] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

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

  // ============== AI 분석 ==============
  const handleAnalyze = async () => {
    setErrorMsg(''); setSuccessMsg('')
    if (!docxFile) { setErrorMsg('DOCX 파일을 업로드해주세요.'); return }
    if (!docxFile.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg('DOCX 파일만 업로드 가능합니다. (HWP/HWPX 미지원)'); return
    }
    if (!templateName.trim()) { setErrorMsg('양식 이름을 입력해주세요.'); return }

    setAnalyzing(true)
    try {
      const data = await previewTemplateFields({
        template: docxFile,
        template_name: templateName,
        description,
      })
      setAnalysis(data)
      // 분석된 fields 에 description 빈 칸 부여
      const enriched = (data.fields || []).map((f) => ({
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
      setAnalyzing(false)
    }
  }

  // ============== DB 저장 ==============
  const handleSave = async () => {
    setErrorMsg(''); setSuccessMsg('')
    if (!docxFile) { setErrorMsg('DOCX 파일이 필요합니다.'); return }
    if (!analysis) { setErrorMsg('먼저 AI 분석을 해주세요.'); return }
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
      const data = await saveTemplateWithFields({
        template: docxFile,
        template_name: templateName,
        description,
        fields: normalized,
      })
      setSuccessMsg(`저장되었습니다 (id: ${data.id}, 키 ${data.placeholder_keys?.length ?? 0}개)`)
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
  const insertFieldAt = (index) => {
    const newField = {
      label: '새 필드',
      key: `new_field_${Date.now()}`,
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
  }
  const addField = () => insertFieldAt(fields.length)

  // ============== 미리보기 셀 클릭 → cell_id 자동 입력 ==============
  const handlePreviewMouseDown = (e) => {
    if (focusedCellIdIndex === null) return
    let el = e.target
    let cellId = null
    while (el && el !== e.currentTarget) {
      const cid = el.getAttribute?.('data-cell-id') || ''
      if (cid) { cellId = cid; break }
      el = el.parentElement
    }
    if (!cellId) return
    e.preventDefault()
    const f = fields[focusedCellIdIndex]
    if (multiAddMode) {
      const existing = f.cell_ids || []
      if (!existing.includes(cellId)) {
        updateField(focusedCellIdIndex, {
          cell_ids: [...existing, cellId],
          cell_id: existing[0] || cellId,
        })
      }
    } else {
      updateField(focusedCellIdIndex, { cell_ids: [cellId], cell_id: cellId })
    }
  }

  const resetAll = () => {
    setTemplateName(''); setDescription(''); setDocxFile(null)
    setAnalysis(null); setFields([]); setCellTexts({})
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
            DOCX 양식을 업로드해 AI 분석 결과를 확인하고 DB에 저장하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={resetAll}>새로 시작</Button>
          <Button variant="secondary" onClick={refreshList} loading={listLoading}>목록 새로고침</Button>
        </div>
      </div>

      {/* 3열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ---------- 왼쪽: 입력 폼 ---------- */}
        <aside className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 h-fit">
          <h3 className="text-base font-semibold text-slate-800 mb-3">1. 양식 입력</h3>

          <div className="space-y-3">
            <div>
              <Label>양식 이름 *</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                placeholder="예: 출장 신청서" />
            </div>
            <div>
              <Label>설명</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="이 양식의 용도를 적어주세요."
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <Label>DOCX 파일 *</Label>
              <DropZone
                accept=".docx"
                file={docxFile}
                onFiles={(f) => setDocxFile(f)}
                hint="DOCX 파일을 끌어다 놓거나 클릭해서 선택"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={handleAnalyze} loading={analyzing} className="w-full">
              {analyzing ? '분석 중...' : 'AI로 양식 분석'}
            </Button>
            <Button onClick={handleSave} loading={saving} variant="success" disabled={!analysis} className="w-full">
              {saving ? '저장 중...' : 'DB에 양식 저장'}
            </Button>
          </div>

          <Toast kind="error" onClose={() => setErrorMsg('')}>{errorMsg}</Toast>
          <Toast kind="success" onClose={() => setSuccessMsg('')}>{successMsg}</Toast>
        </aside>

        {/* ---------- 가운데: HTML 미리보기 ---------- */}
        <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-800">2. 분석된 HTML 미리보기</h3>
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
              아직 분석 결과가 없습니다. 왼쪽에서 DOCX를 올리고 [AI로 양식 분석]을 눌러주세요.
            </div>
          ) : (
            <div
              onMouseDown={handlePreviewMouseDown}
              className={[
                'preview-area bg-slate-50 rounded-lg p-4 max-h-[36rem] overflow-auto border transition',
                focusedCellIdIndex !== null
                  ? 'border-indigo-400 ring-2 ring-indigo-100 cursor-crosshair'
                  : 'border-slate-200',
              ].join(' ')}
              dangerouslySetInnerHTML={{ __html: analysis.preview_html || '' }}
            />
          )}
        </section>

        {/* ---------- 오른쪽: 필드 리스트 ---------- */}
        <aside className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-800">3. 자동 입력 항목</h3>
            <Button variant="secondary" onClick={addField} disabled={!analysis}>+ 추가</Button>
          </div>

          {!analysis ? (
            <div className="text-sm text-slate-400">분석 후 표시됩니다.</div>
          ) : fields.length === 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-slate-500">자동 입력 항목이 없습니다. 직접 추가하세요.</div>
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
                <div key={`${i}-${f.key}`}>
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
                        <Label>key</Label>
                        <input className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-sm font-mono"
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
                    <div className="mt-2">
                      <Label>설명 (AI 힌트)</Label>
                      <input className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-sm"
                        value={f.description || ''}
                        onChange={(e) => updateField(i, { description: e.target.value })}
                        placeholder="예: 출장 목적을 한 문장으로" />
                    </div>
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
                          <div className="mt-0.5 text-[10px] text-emerald-600">
                            ✓ 이 셀에 복수 placeholder 가 삽입됩니다
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
      </div>

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
            저장된 양식이 없습니다. 위에서 양식을 분석하고 [DB에 양식 저장]을 눌러보세요.
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
                {t.description && (
                  <div className="text-xs text-slate-600 mt-2 line-clamp-2">{t.description}</div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    필드 {(t.placeholder_keys || []).length}개
                  </span>
                  <Button variant="secondary" onClick={() => handleViewDetail(t.id)}>상세 보기</Button>
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
              {detail.description && (
                <div className="text-sm text-slate-600">{detail.description}</div>
              )}
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
                <div className="preview-area bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[60vh] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: detail.html_content || '' }} />
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