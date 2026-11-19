// src/OrgPage.jsx
// 조직도 관리 페이지
// - 수동 조직원 등록 (테이블형 다중 행 입력)
// - 조직도 이미지 AI 자동 분석 + 미리보기 수정 후 저장
// - 저장된 조직도 목록 조회

import { useState, useEffect, useRef } from 'react'
import {
  createOrgMember,
  getOrgMembers,
  previewOrgMembersByImage,
  savePreviewOrgMembers,
} from './api'

const EMPTY_ROW = () => ({ name: '', department: '', title: '', email: '' })

function Alert({ type, msg, onClose }) {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  }
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-2 ${styles[type] || styles.error}`}>
      <span>{msg}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100 shrink-0">✕</button>
      )}
    </div>
  )
}

function EditableTable({ rows, onChange, onRemove }) {
  const cols = [
    { key: 'name',       label: '이름',   placeholder: '홍길동',            required: true },
    { key: 'department', label: '부서',   placeholder: '영업팀',            required: false },
    { key: 'title',      label: '직급',   placeholder: '팀장',              required: true },
    { key: 'email',      label: '이메일', placeholder: 'hong@company.com',  required: true },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {cols.map((c) => (
              <th key={c.key} className="text-left py-2 px-3 font-medium text-slate-600">
                {c.label}{c.required && <span className="text-red-500 ml-0.5">*</span>}
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              {cols.map((c) => (
                <td key={c.key} className="py-1.5 px-3">
                  <input
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={row[c.key] || ''}
                    placeholder={c.placeholder}
                    onChange={(e) => onChange(idx, c.key, e.target.value)}
                  />
                </td>
              ))}
              <td className="py-1.5 px-2 text-center">
                <button
                  onClick={() => onRemove(idx)}
                  className="text-slate-300 hover:text-red-500 transition text-base leading-none"
                  title="행 삭제"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function OrgPage() {
  // ── 저장된 목록 ──────────────────────────────────────────
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // ── 수동 입력 ────────────────────────────────────────────
  const [manualRows, setManualRows] = useState([EMPTY_ROW()])
  const [savingManual, setSavingManual] = useState(false)
  const [manualAlert, setManualAlert] = useState(null)

  // ── 이미지 분석 ──────────────────────────────────────────
  const [imageFile, setImageFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [previewRows, setPreviewRows] = useState([])
  const [savingPreview, setSavingPreview] = useState(false)
  const [imageAlert, setImageAlert] = useState(null)

  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchMembers()
  }, [])

  async function fetchMembers() {
    setLoadingMembers(true)
    try {
      const data = await getOrgMembers()
      setMembers(Array.isArray(data) ? data : [])
    } catch {
      // 목록 조회 실패는 무시
    } finally {
      setLoadingMembers(false)
    }
  }

  // ── 수동 입력 핸들러 ────────────────────────────────────

  function updateManualRow(idx, field, value) {
    setManualRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    )
  }

  function removeManualRow(idx) {
    setManualRows((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSaveManual() {
    const validRows = manualRows.filter(
      (r) => r.name.trim() && r.title.trim() && r.email.trim()
    )
    if (validRows.length === 0) {
      setManualAlert({
        type: 'error',
        msg: '저장할 유효한 행이 없습니다. 이름, 직급, 이메일은 필수입니다.',
      })
      return
    }

    setSavingManual(true)
    setManualAlert(null)

    let savedCount = 0
    const failedMsgs = []

    for (const row of validRows) {
      try {
        await createOrgMember(row)
        savedCount++
      } catch (e) {
        failedMsgs.push(`${row.name}(${row.email}): ${e.message}`)
      }
    }

    setSavingManual(false)

    if (failedMsgs.length > 0) {
      setManualAlert({
        type: 'warning',
        msg: `${savedCount}명 저장됨 / ${failedMsgs.length}명 실패 — ${failedMsgs.join(', ')}`,
      })
    } else {
      setManualAlert({ type: 'success', msg: `${savedCount}명이 저장되었습니다.` })
      setManualRows([EMPTY_ROW()])
    }

    fetchMembers()
  }

  // ── 이미지 분석 핸들러 ──────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreviewRows([])
    setImageAlert(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      setPreviewRows([])
      setImageAlert(null)
    }
  }

  async function handleAnalyzeImage() {
    if (!imageFile) {
      setImageAlert({ type: 'error', msg: '이미지 파일을 먼저 선택해주세요.' })
      return
    }
    setAnalyzing(true)
    setImageAlert(null)
    setPreviewRows([])
    try {
      const result = await previewOrgMembersByImage({ imageFile })
      const rows = result.rows || []
      setPreviewRows(rows)
      if (rows.length === 0) {
        setImageAlert({ type: 'warning', msg: '이미지에서 조직원 정보를 찾을 수 없습니다.' })
      }
    } catch (e) {
      setImageAlert({ type: 'error', msg: e.message || '이미지 분석에 실패했습니다.' })
    } finally {
      setAnalyzing(false)
    }
  }

  function updatePreviewRow(idx, field, value) {
    setPreviewRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    )
  }

  function removePreviewRow(idx) {
    setPreviewRows((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSavePreview() {
    if (previewRows.length === 0) {
      setImageAlert({ type: 'error', msg: '저장할 행이 없습니다.' })
      return
    }
    setSavingPreview(true)
    setImageAlert(null)
    try {
      const result = await savePreviewOrgMembers(previewRows)
      const { saved_count, skipped_count, skipped } = result

      if (skipped_count > 0) {
        const skippedEmails = new Set((skipped || []).map((r) => r.email))
        setPreviewRows((prev) => prev.filter((r) => skippedEmails.has(r.email)))
        setImageAlert({
          type: 'warning',
          msg: `${saved_count}명 저장됨 / ${skipped_count}명 건너뜀 (중복 이메일). 아래 행을 수정 후 다시 저장하세요.`,
        })
      } else {
        setPreviewRows([])
        setImageFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setImageAlert({ type: 'success', msg: `${saved_count}명이 저장되었습니다.` })
      }

      fetchMembers()
    } catch (e) {
      setImageAlert({ type: 'error', msg: e.message || '저장에 실패했습니다.' })
    } finally {
      setSavingPreview(false)
    }
  }

  // ── 렌더 ────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">조직도 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          이름, 부서, 직급, 이메일을 등록하여 결재자 정보를 관리하세요.
        </p>
      </div>

      {/* ── 섹션 1: 수동 조직원 등록 ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">수동 조직원 등록</h2>

        <EditableTable
          rows={manualRows}
          onChange={updateManualRow}
          onRemove={removeManualRow}
        />

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setManualRows((prev) => [...prev, EMPTY_ROW()])}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + 행 추가
          </button>
          <button
            onClick={handleSaveManual}
            disabled={savingManual}
            className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {savingManual ? '저장 중…' : '조직도 저장'}
          </button>
        </div>

        {manualAlert && (
          <div className="mt-3">
            <Alert {...manualAlert} onClose={() => setManualAlert(null)} />
          </div>
        )}
      </div>

      {/* ── 섹션 2: 조직도 이미지 자동 분석 ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">조직도 이미지 자동 분석</h2>

        {/* 드롭존 */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {imageFile ? (
            <p className="text-sm text-slate-700">
              <span className="font-medium text-blue-600">{imageFile.name}</span>
              <span className="ml-2 text-slate-400">
                ({(imageFile.size / 1024).toFixed(1)} KB)
              </span>
            </p>
          ) : (
            <div className="text-slate-400 text-sm space-y-1">
              <div className="text-3xl">🖼️</div>
              <p>조직도 / 인사표 / 주소록 이미지를 드래그하거나 클릭해서 업로드하세요.</p>
              <p className="text-xs">JPG, PNG, WEBP 등 이미지 파일 지원</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleAnalyzeImage}
            disabled={analyzing || !imageFile}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {analyzing ? '분석 중…' : '이미지 분석'}
          </button>
        </div>

        {/* 분석 결과 미리보기 */}
        {previewRows.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-600 mb-2">
              분석 결과 ({previewRows.length}명) — 수정 후 저장하세요
            </p>
            <EditableTable
              rows={previewRows}
              onChange={updatePreviewRow}
              onRemove={removePreviewRow}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSavePreview}
                disabled={savingPreview}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                {savingPreview ? '저장 중…' : '확인 후 저장'}
              </button>
            </div>
          </div>
        )}

        {imageAlert && (
          <div className="mt-3">
            <Alert {...imageAlert} onClose={() => setImageAlert(null)} />
          </div>
        )}
      </div>

      {/* ── 섹션 3: 저장된 조직도 목록 ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">저장된 조직도 목록</h2>
          <button
            onClick={fetchMembers}
            className="text-xs text-slate-400 hover:text-slate-600 transition"
            title="새로고침"
          >
            ↻ 새로고침
          </button>
        </div>

        {loadingMembers ? (
          <div className="text-center py-10 text-slate-400 text-sm">불러오는 중…</div>
        ) : members.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            아직 등록된 조직도가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-2 px-3 font-medium text-slate-600">이름</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">부서</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">직급</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">이메일</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-800">{m.name}</td>
                    <td className="py-2 px-3 text-slate-600">{m.department || '—'}</td>
                    <td className="py-2 px-3 text-slate-600">{m.title}</td>
                    <td className="py-2 px-3 text-slate-500">{m.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
