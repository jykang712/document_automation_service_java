// src/ProcessPage.jsx
// 결재서류 자동작성 페이지
// [1] 문서 작성 설정 (템플릿 선택 + 설명 + 이미지 업로드)
// [2] AI 자동작성 결과 (미리보기 + 편집 + 다운로드 + 이메일 발송)
// [3] 템플릿 미리보기 모달

import { useState, useEffect, useRef, useCallback } from 'react'
import EditableHtmlPreview from './EditableHtmlPreview'
import {
  getTemplates,
  getTemplateDetail,
  getOrgMembers,
  processExpense,
  sendExpenseEmail,
  updateGeneratedDocument,
} from './api'

// ──────────────────────────────────────────────────────────────
// 이미지 드롭존 컴포넌트
// ──────────────────────────────────────────────────────────────
function ImageDropZone({ files, onAddFiles, onRemoveFile }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    )
    if (dropped.length > 0) onAddFiles(dropped)
  }

  const handleChange = (e) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length > 0) onAddFiles(selected)
    e.target.value = ''
  }

  return (
    <div>
      {/* 드롭 영역 */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/30',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
        <div className="text-slate-500 text-sm select-none">
          <div className="text-2xl mb-1">📎</div>
          <p className="font-medium">
            이미지를 드래그하거나 클릭해서 업로드
          </p>
          <p className="text-xs text-slate-400 mt-1">
            JPG, PNG, WEBP 등 이미지 파일 (여러 장 가능)
          </p>
        </div>
      </div>

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 text-slate-700 truncate">
                <span>🖼️</span>
                <span className="truncate max-w-xs">{f.name}</span>
                <span className="text-xs text-slate-400 shrink-0">
                  ({(f.size / 1024).toFixed(0)} KB)
                </span>
              </span>
              <button
                onClick={() => onRemoveFile(i)}
                className="ml-2 text-red-400 hover:text-red-600 text-xs shrink-0"
                title="삭제"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────────────────────
export default function ProcessPage() {
  // ── 템플릿 ──
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateDetail, setTemplateDetail] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // ── 입력 폼 ──
  const [description, setDescription] = useState('')
  const [receipts, setReceipts] = useState([])

  // ── 생성 ──
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // ── 결과 ──
  const [result, setResult] = useState(null)
  const [editedHtml, setEditedHtml] = useState('')

  // ── 편집 모드 ──
  const [editMode, setEditMode] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [saveError, setSaveError] = useState('')

  // ── 기안자 정보 (자동작성 + 이메일 공용) ──
  const [orgMembers, setOrgMembers] = useState([])
  const [selectedRequesterId, setSelectedRequesterId] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [requesterDepartment, setRequesterDepartment] = useState('')

  // ── 이메일 발송 ──
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch((e) => console.error('템플릿 로드 실패:', e))
    getOrgMembers()
      .then((d) => setOrgMembers(Array.isArray(d) ? d : (d.members || [])))
      .catch((e) => console.error('조직원 로드 실패:', e))
  }, [])

  // ── 기안자 드롭다운 선택 ──
  function handleRequesterSelect(memberId) {
    setSelectedRequesterId(memberId)
    if (!memberId) {
      setRequesterName('')
      setRequesterDepartment('')
      return
    }
    const member = orgMembers.find((m) => String(m.id) === String(memberId))
    if (member) {
      setRequesterName(member.name || '')
      setRequesterDepartment(member.department || '')
    }
  }

  // ── 템플릿 선택 시 상세 로드 (미리보기용) ──
  async function handleTemplateChange(id) {
    setSelectedTemplateId(id)
    setTemplateDetail(null)
    if (!id) return
    setLoadingPreview(true)
    try {
      const detail = await getTemplateDetail(Number(id))
      setTemplateDetail(detail)
    } catch (e) {
      console.error('템플릿 상세 로드 실패:', e)
    } finally {
      setLoadingPreview(false)
    }
  }

  // ── 이미지 추가/삭제 ──
  const handleAddFiles = useCallback((newFiles) => {
    setReceipts((prev) => [...prev, ...newFiles])
  }, [])

  const handleRemoveFile = useCallback((idx) => {
    setReceipts((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  // ── 자동 작성 실행 ──
  async function handleGenerate() {
    setGenerateError('')
    setResult(null)
    setEditedHtml('')
    setEditMode(false)
    setSaveSuccess('')
    setSaveError('')
    setEmailSuccess('')
    setEmailError('')

    if (!selectedTemplateId) return setGenerateError('결재서류 템플릿을 선택하세요.')
    if (!description.trim() && receipts.length === 0) {
      return setGenerateError('자연어 설명 또는 증빙 이미지를 하나 이상 입력하세요.')
    }

    setGenerating(true)
    try {
      const data = await processExpense({
        templateId: Number(selectedTemplateId),
        description: description.trim(),
        receipts,
        requesterName: requesterName.trim(),
        requesterDepartment: requesterDepartment.trim(),
      })
      setResult(data)
      setEditedHtml(data.filled_html || '')
    } catch (e) {
      setGenerateError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── 편집 저장 ──
  async function handleSaveEdit() {
    if (!result) return
    setSavingEdit(true)
    setSaveSuccess('')
    setSaveError('')
    try {
      await updateGeneratedDocument({
        documentId: result.document_id,
        htmlContent: editedHtml,
      })
      setSaveSuccess('수정 내용이 저장되었습니다.')
      // result의 filled_html도 갱신
      setResult((prev) => ({ ...prev, filled_html: editedHtml }))
    } catch (e) {
      setSaveError(`저장 실패: ${e.message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  // ── 다운로드 ──
  function handleDownload() {
    if (!editedHtml) return
    const blob = new Blob([editedHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result?.template_name || '결재서류'}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── 이메일 발송 ──
  async function handleSendEmail() {
    if (!result) return
    setEmailSuccess('')
    setEmailError('')
    setSendingEmail(true)
    try {
      const res = await sendExpenseEmail({
        documentId: result.document_id,
        toEmail: result.recipient_email,
        toName: result.recipient_name,
        requester: requesterName.trim(),
        templateName: result.template_name,
        filledHtml: editedHtml,   // 편집된 최신 HTML
        expenseData: result.expense_data,
      })
      if (res.email_sent) {
        setEmailSuccess(`이메일이 ${result.recipient_email}로 발송되었습니다.`)
      } else {
        setEmailSuccess(
          res.message ||
            'SMTP 설정이 없어 이메일을 발송하지 않았습니다. DB에는 발송 완료로 기록됩니다.',
        )
      }
    } catch (e) {
      setEmailError(`발송 실패: ${e.message}`)
    } finally {
      setSendingEmail(false)
    }
  }

  // ── 새 문서 작성 ──
  function handleNewDocument() {
    setResult(null)
    setEditedHtml('')
    setEditMode(false)
    setSaveSuccess('')
    setSaveError('')
    setEmailSuccess('')
    setEmailError('')
    setGenerateError('')
    setDescription('')
    setSelectedRequesterId('')
    setRequesterName('')
    setRequesterDepartment('')
    setReceipts([])
    setSelectedTemplateId('')
    setTemplateDetail(null)
  }

  // ── expense_data 표시용 레이블 ──
  function formatKey(key) {
    return key.replace(/_/g, ' ')
  }

  // ──────────────────────────────────────────────────────────────
  // 렌더
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">결재서류 작성</h1>
        <p className="text-slate-500 mt-1">
          저장된 템플릿을 선택한 뒤 자연어 설명과 증빙 이미지를 입력하면 AI가
          문서를 자동 작성합니다.
        </p>
      </div>

      {/* ──────────────────────────────────────────────────────────
          [1] 문서 작성 설정 카드
      ────────────────────────────────────────────────────────── */}
      {!result && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">
            문서 작성 설정
          </h2>

          {/* 템플릿 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              결재서류 템플릿 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">템플릿을 선택하세요</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.template_name}
                    {t.file_name ? ` (${t.file_name})` : ''}
                  </option>
                ))}
              </select>
              {selectedTemplateId && (
                <button
                  onClick={() => setPreviewOpen(true)}
                  disabled={loadingPreview || !templateDetail}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                >
                  {loadingPreview ? '로드 중...' : '양식 미리보기'}
                </button>
              )}
            </div>
            {templates.length === 0 && (
              <p className="text-amber-600 text-xs mt-1">
                ⚠️ 등록된 템플릿이 없습니다. 먼저 [양식 관리] 페이지에서 템플릿을 등록하세요.
              </p>
            )}
          </div>

          {/* 기안자 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              기안자
            </label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedRequesterId}
              onChange={(e) => handleRequesterSelect(e.target.value)}
            >
              <option value="">기안자를 선택하세요</option>
              {orgMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.title ? ` (${m.title}` : ''}
                  {m.department ? ` · ${m.department}` : ''}
                  {m.title ? ')' : ''}
                </option>
              ))}
            </select>
            {/* 선택된 기안자 정보 표시 */}
            {requesterName && (
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 px-1">
                <span className="text-blue-500">✓</span>
                <span>
                  <strong className="text-slate-700">{requesterName}</strong>
                  {requesterDepartment && (
                    <span className="ml-1">· {requesterDepartment}</span>
                  )}
                </span>
              </div>
            )}
            {orgMembers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ 등록된 조직원이 없습니다. [조직도 관리] 페이지에서 먼저 등록하세요.
              </p>
            )}
          </div>

          {/* 자연어 설명 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              작성 요청 설명
            </label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 3월 15일 부산 출장, 교통비 45,000원, 숙박비 120,000원 사용. 영업팀 홍길동이 작성."
            />
          </div>

          {/* 증빙 이미지 업로드 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              증빙 이미지 (영수증 등, 선택)
            </label>
            <ImageDropZone
              files={receipts}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
            />
          </div>

          {/* 에러 메시지 */}
          {generateError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
              {generateError}
            </div>
          )}

          {/* 자동 작성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                AI가 문서를 작성 중입니다...
              </span>
            ) : (
              'AI 자동 작성'
            )}
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          [2] 생성 결과 카드
      ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* 결과 헤더 */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">
                  결재서류 작성 완료
                </h2>
                <p className="text-blue-100 text-sm mt-0.5">
                  {result.template_name}
                  {result.file_name ? ` · ${result.file_name}` : ''}
                </p>
              </div>
              <button
                onClick={handleNewDocument}
                className="text-sm text-blue-100 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-700 transition"
              >
                새 문서 작성
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* 수신자 정보 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                1차 결재자 (이메일 수신자)
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  {(result.recipient_name || '?')[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    {result.recipient_name || '(정보 없음)'}
                    {result.recipient_title && (
                      <span className="ml-1.5 text-xs text-slate-500 font-normal">
                        {result.recipient_title}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {result.recipient_email || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* AI 추출 데이터 요약 */}
            {result.expense_data && Object.keys(result.expense_data).length > 0 && (
              <details className="border border-slate-200 rounded-xl overflow-hidden">
                <summary className="bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none">
                  AI 추출 데이터 보기 ({Object.keys(result.expense_data).length}개 필드)
                </summary>
                <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(result.expense_data).map(([k, v]) => (
                    <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-400">{formatKey(k)}</p>
                      <p className="text-sm text-slate-700 font-medium truncate">
                        {v === '' || v === null || v === undefined
                          ? <span className="text-slate-300 font-normal">-</span>
                          : String(v)}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* 편집 모드 툴바 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 편집 모드 토글 */}
              <button
                onClick={() => {
                  setEditMode((prev) => !prev)
                  setSaveSuccess('')
                  setSaveError('')
                }}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium border transition',
                  editMode
                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                {editMode ? '✏️ 편집 모드 ON' : '✏️ 편집 모드'}
              </button>

              {/* 수정 저장 (편집 모드일 때만) */}
              {editMode && (
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {savingEdit ? '저장 중...' : '💾 수정 저장'}
                </button>
              )}

              {/* 다운로드 */}
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
              >
                ⬇️ HTML 다운로드
              </button>
            </div>

            {/* 편집 모드 안내 배너 */}
            {editMode && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-indigo-800 text-sm">
                ✏️ <strong>현재 편집 모드입니다.</strong> 문서 내용을 직접 수정한 뒤{' '}
                <strong>수정 저장</strong>을 눌러주세요. 저장 전에도 다운로드와 이메일 발송은 편집 내용 기준으로 처리됩니다.
              </div>
            )}

            {/* 저장 성공/실패 알림 */}
            {saveSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
                ✅ {saveSuccess}
              </div>
            )}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                ❌ {saveError}
              </div>
            )}

            {/* HTML 미리보기 / 편집 영역 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-600">
                  {editMode ? '편집 영역' : '결재서류 미리보기'}
                </h3>
                {!editMode && (
                  <span className="text-xs text-slate-400">
                    편집하려면 위의 [편집 모드] 버튼을 누르세요
                  </span>
                )}
              </div>
              <EditableHtmlPreview
                html={editedHtml}
                editable={editMode}
                onChange={setEditedHtml}
              />
            </div>

            {/* 이메일 발송 섹션 */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-600">
                이메일 발송
              </h3>

              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <span>수신:</span>
                <strong>{result.recipient_name}</strong>
                {result.recipient_title && (
                  <span className="text-slate-400">({result.recipient_title})</span>
                )}
                <span className="text-blue-600 ml-1">
                  {result.recipient_email}
                </span>
              </div>

              {requesterName && (
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                  <span>발신:</span>
                  <strong>{requesterName}</strong>
                  {requesterDepartment && (
                    <span className="text-slate-400">({requesterDepartment})</span>
                  )}
                </div>
              )}

              {emailSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-sm">
                  ✅ {emailSuccess}
                </div>
              )}
              {emailError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                  ❌ {emailError}
                </div>
              )}

              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !result.recipient_email}
                className="w-full bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {sendingEmail ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    발송 중...
                  </span>
                ) : (
                  '이메일 발송'
                )}
              </button>

              {!result.recipient_email && (
                <p className="text-xs text-amber-600">
                  ⚠️ 결재 규칙에 등록된 1차 결재자의 이메일이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          [3] 템플릿 미리보기 모달
      ────────────────────────────────────────────────────────── */}
      {previewOpen && templateDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800">
                  {templateDetail.template_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  양식 미리보기 (편집 불가)
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* 모달 본문: iframe으로 안전하게 표시 */}
            <div className="flex-1 overflow-auto p-4">
              <iframe
                srcDoc={templateDetail.html_content || ''}
                title="템플릿 미리보기"
                className="w-full min-h-96 border border-slate-200 rounded-lg"
                sandbox="allow-same-origin"
                style={{ height: 'calc(80vh - 120px)' }}
              />
            </div>

            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
