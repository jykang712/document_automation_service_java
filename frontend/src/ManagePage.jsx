// src/ManagePage.jsx
// 문서 관리 페이지
// - 요약 통계 카드
// - 검색 / 필터
// - 문서 목록 테이블
// - 상세 모달 (HTML 미리보기 + 편집 + 삭제)

import { useState, useEffect, useCallback } from 'react'
import DocumentValueEditor, { recoverDocumentValues } from './DocumentValueEditor'
import { downloadHtml } from './SafeHtmlFrame'
import {
  getGeneratedDocuments,
  getGeneratedDocumentDetail,
  updateGeneratedDocument,
  deleteGeneratedDocument,
} from './api'

// ── 상태 배지 ──────────────────────────────────────────────────
function SentBadge({ sent }) {
  return sent ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      발송완료
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      미발송
    </span>
  )
}

// 기안자: 로그인 아이디와 현재 연결된 조직원 정보를 목록/상세에서 동일하게 표시합니다.
function RequesterInfo({ document }) {
  const linked = document.requester_member_linked === true
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">아이디: <span className="font-medium text-slate-800">{document.requester_login_id || '-'}</span></div>
      <div>이름: {linked ? document.requester_member_name || '-' : '미연동'}</div>
      <div className="text-xs text-slate-500">직위: {linked ? document.requester_title || '-' : '미연동'}</div>
    </div>
  )
}

// ── 날짜 포맷 ──────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '-'
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── 요약 카드 ──────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${colors[color] || colors.slate}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  )
}

// ── 상세 모달 ──────────────────────────────────────────────────
function DetailModal({ docId, onClose, onDeleted, onSaved }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editMode, setEditMode] = useState(false)
  const [editedHtml, setEditedHtml] = useState('')
  const [editedTitle, setEditedTitle] = useState('')
  const [editedValues, setEditedValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getGeneratedDocumentDetail(docId)
      .then((d) => {
        if (!cancelled) {
          setDetail(d)
          setEditedHtml(d.html_content || '')
          setEditedValues(recoverDocumentValues(d.html_content, d.extracted_json))
          setEditedTitle(d.document_title || '')
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || '조회 실패')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [docId])

  const handleSave = useCallback(async () => {
    if (!detail || saving || deleting) return
    if (!editedTitle.trim()) { setSaveMsg('문서 제목을 입력하세요.'); return }
    setSaving(true)
    setSaveMsg('')
    try {
      await updateGeneratedDocument({ documentId: detail.id, htmlContent: editedHtml, documentTitle: editedTitle, extractedJson: editedValues })
    } catch (e) {
      setSaveMsg(`저장 실패: ${e.message}`)
      setSaving(false)
      return
    }
    // 저장이 끝난 다음 서버의 실제 수정일시를 다시 조회합니다.
    try {
      const refreshed = await getGeneratedDocumentDetail(detail.id)
      setDetail(refreshed)
      setEditedHtml(refreshed.html_content || '')
      setEditedValues(recoverDocumentValues(refreshed.html_content, refreshed.extracted_json))
      setEditedTitle(refreshed.document_title || '')
      setSaveMsg('저장되었습니다.')
    } catch (e) {
      setDetail(prev => ({ ...prev, html_content: editedHtml, extracted_json: editedValues, document_title: editedTitle, updated_at: '' }))
      setSaveMsg(`저장은 완료됐지만 수정일시를 불러오지 못했습니다. 상세 화면을 다시 열어 확인하세요: ${e.message}`)
    }
    setEditMode(false)
    try { await onSaved?.() }
    catch { setSaveMsg('저장은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.') }
    finally { setSaving(false) }
  }, [detail, editedHtml, editedTitle, editedValues, saving, deleting, onSaved])

  const handleDelete = useCallback(async () => {
    if (!detail || saving || deleting) return
    setDeleting(true)
    try {
      await deleteGeneratedDocument(detail.id)
      onDeleted(detail.id)
      onClose()
    } catch (e) {
      alert(`삭제 실패: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }, [detail, onDeleted, onClose, saving, deleting])

  const handleDownload = useCallback(() => {
    if (!detail) return
    const html = editMode ? editedHtml : detail.html_content
    downloadHtml(detail.document_title || 'document', html)
  }, [detail, editMode, editedHtml])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-[96vw] max-w-[1600px] max-h-[96vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            {loading ? '불러오는 중...' : (detail?.document_title || '문서 상세')}
          </h2>
          <button
            onClick={onClose}
            disabled={saving || deleting}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="text-center py-12 text-slate-500">불러오는 중...</div>
          )}
          {error && (
            <div className="text-red-600 bg-red-50 rounded-lg p-3 text-sm">{error}</div>
          )}
          {!loading && !error && detail && (
            <div className="space-y-4">
              {/* 메타 정보 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">양식명</div>
                  <div className="font-medium text-slate-800">{detail.template_name || '-'}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">작성일시</div>
                  <div className="font-medium text-slate-800">{fmtDate(detail.created_at)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">수정일시</div>
                  <div className="font-medium text-slate-800">{fmtDate(detail.updated_at)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">기안자</div>
                  <div className="font-medium text-slate-800">
                    <RequesterInfo document={detail} />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">1차 결재자</div>
                  <div className="font-medium text-slate-800">
                    {detail.recipient_name
                      ? `${detail.recipient_name} ${detail.recipient_title || ''}`.trim()
                      : '-'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                  <div className="text-xs text-slate-500 mb-1">결재선</div>
                  <div className="font-medium text-slate-800">{detail.approval_line_text || '-'}</div>
                </div>
                {detail.description && (
                  <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                    <div className="text-xs text-slate-500 mb-1">설명</div>
                    <div className="text-slate-700">{detail.description}</div>
                  </div>
                )}
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">발송 상태</div>
                  <SentBadge sent={detail.is_sent} />
                </div>
                {detail.receipt_file_name && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">첨부 영수증</div>
                    <div className="text-slate-700 text-xs truncate">{detail.receipt_file_name}</div>
                  </div>
                )}
              </div>

              {/* HTML 미리보기 / 편집 */}
              <div>
                <div className="sticky top-0 z-10 bg-white py-2 flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-sm font-semibold text-slate-700 mr-auto">문서 내용</div>
                  {editMode && <button type="button" className="btn btn-primary" disabled={saving || deleting} onClick={handleSave}>{saving ? '저장 중...' : '변경사항 저장'}</button>}
                  <button
                    disabled={saving || deleting}
                    onClick={() => {
                      if (editMode) {
                        setEditedHtml(detail.html_content || '')
                        setEditedValues(recoverDocumentValues(detail.html_content, detail.extracted_json))
                        setEditedTitle(detail.document_title || '')
                      }
                      setEditMode((v) => !v)
                      setSaveMsg('')
                    }}
                    className={[
                      'text-xs px-3 py-1 rounded-md font-medium transition',
                      editMode
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700',
                    ].join(' ')}
                  >
                    {editMode ? '편집 취소' : '편집'}
                  </button>
                </div>
                {editMode && <label className="block text-sm mb-3">문서 제목<input className="field mt-2" aria-label="문서 제목 수정" disabled={saving || deleting} value={editedTitle} maxLength={255} onChange={e => setEditedTitle(e.target.value)} /></label>}
                <DocumentValueEditor
                  html={editMode ? editedHtml : detail.html_content}
                  editable={editMode}
                  disabled={saving || deleting}
                  values={editMode ? editedValues : detail.extracted_json}
                  onChange={(nextHtml, nextValues) => { setEditedHtml(nextHtml); setEditedValues(nextValues) }}
                />
                {saveMsg && (
                  <p className={`text-xs mt-1 ${saveMsg === '저장되었습니다.' ? 'text-green-600' : 'text-red-600'}`}>
                    {saveMsg}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        {!loading && !error && detail && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-2 shrink-0">
            {editMode ? (
              <button
                onClick={handleSave}
                disabled={saving || deleting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            ) : (
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition"
              >
                HTML 다운로드
              </button>
            )}
            <div className="flex-1" />
            {confirmDelete ? (
              <>
                <span className="text-sm text-red-600">문서를 비활성화할까요?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {deleting ? '삭제 중...' : '확인 삭제'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 transition"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
                className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition border border-red-200"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────
export default function ManagePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterSent, setFilterSent] = useState('all') // 'all' | 'sent' | 'unsent'

  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return getGeneratedDocuments()
      .then(setData)
      .catch((e) => setError(e.message || '목록 조회 실패'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeleted = useCallback(() => { load() }, [load])

  // 필터링
  const filtered = (data?.documents || []).filter((doc) => {
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      (doc.document_title || '').toLowerCase().includes(q) ||
      (doc.requester_login_id || '').toLowerCase().includes(q) ||
      (doc.requester_member_name || '').toLowerCase().includes(q) ||
      (doc.requester_title || '').toLowerCase().includes(q) ||
      (doc.requester_name || '').toLowerCase().includes(q) ||
      (doc.requester_department || '').toLowerCase().includes(q) ||
      (doc.template_name || '').toLowerCase().includes(q) ||
      (doc.recipient_name || '').toLowerCase().includes(q)
    const matchSent =
      filterSent === 'all' ||
      (filterSent === 'sent' && doc.is_sent) ||
      (filterSent === 'unsent' && !doc.is_sent)
    return matchSearch && matchSent
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">문서 관리</h1>
        <p className="text-sm text-slate-500 mt-0.5">저장된 문서를 조회·편집·비활성화합니다. ADMIN은 비활성 문서도 볼 수 있습니다.</p>
      </div>

      {/* 요약 통계 카드 */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="전체 문서" value={data.total} color="blue" />
          <StatCard label="발송 완료" value={data.sent_count} color="green" />
          <StatCard label="미발송" value={data.unsent_count} color="amber" />
        </div>
      )}

      {/* 검색 / 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="문서명, 기안자 아이디·이름·직위, 양식명, 결재자로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={filterSent}
          onChange={(e) => setFilterSent(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">전체 상태</option>
          <option value="sent">발송완료</option>
          <option value="unsent">미발송</option>
        </select>
        <button
          onClick={load}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition"
        >
          새로고침
        </button>
      </div>

      {/* 오류 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 테이블 */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          {data?.total === 0 ? '작성된 문서가 없습니다.' : '검색 결과가 없습니다.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">번호</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">문서명</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">양식</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">기안자</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">결재선</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">상태</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">작성일시</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">수정일시</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-400 tabular-nums">{doc.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate">
                      {doc.document_title || '-'}<div className="text-xs text-slate-500 mt-1">소유자 #{doc.owner_user_id} · {doc.is_active === false ? '비활성' : '활성'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[120px] truncate">
                      {doc.template_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <RequesterInfo document={doc} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                      <div className="truncate text-xs" title={doc.approval_line_text}>
                        {doc.approval_line_text || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <SentBadge sent={doc.is_sent} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {fmtDate(doc.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {fmtDate(doc.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedId(doc.id)}
                        className="px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedId !== null && (
        <DetailModal
          docId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={handleDeleted}
          onSaved={load}
        />
      )}
    </div>
  )
}
