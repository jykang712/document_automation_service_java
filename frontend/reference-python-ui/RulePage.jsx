// src/RulePage.jsx
// 양식 규칙 관리 페이지
// - 수동 결재 규칙 등록
// - PDF 지침서 AI 분석 → 미리보기 → 저장
// - 저장된 결재 규칙 목록 조회

import { useState, useEffect } from 'react'
import {
  getTemplates,
  getOrgMembers,
  createApprovalRule,
  getApprovalRules,
  previewApprovalRulesByGuide,
  savePreviewApprovalRules,
} from './api'

const APPROVAL_TYPES = ['결재', '합의', '최종승인', '참조']

// 빈 결재자 객체
function emptyApprover(order) {
  return { approver_member_id: '', approval_order: order, approval_type: '결재' }
}

export default function RulePage() {
  // ── 공통 데이터 ───────────────────────────────────────────
  const [templates, setTemplates] = useState([])
  const [members, setMembers] = useState([])
  const [rules, setRules] = useState([])

  // ── 수동 등록 폼 ─────────────────────────────────────────
  const [mRuleName, setMRuleName] = useState('')
  const [mRuleText, setMRuleText] = useState('')
  const [mTemplateId, setMTemplateId] = useState('')
  const [mApprovers, setMApprovers] = useState([emptyApprover(1)])
  const [mSaving, setMSaving] = useState(false)
  const [mError, setMError] = useState('')
  const [mSuccess, setMSuccess] = useState('')

  // ── PDF 지침서 AI 분석 ────────────────────────────────────
  const [guideFile, setGuideFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [previewRules, setPreviewRules] = useState([])
  const [sourceName, setSourceName] = useState('')
  const [pSaving, setPSaving] = useState(false)
  const [pError, setPError] = useState('')
  const [pSuccess, setPSuccess] = useState('')

  // ── 초기 데이터 로드 ─────────────────────────────────────
  async function loadData() {
    try {
      const [tpl, mem, rls] = await Promise.all([
        getTemplates(),
        getOrgMembers(),
        getApprovalRules(),
      ])
      setTemplates(tpl || [])
      setMembers(Array.isArray(mem) ? mem : [])
      setRules(Array.isArray(rls) ? rls : [])
    } catch (e) {
      console.error('데이터 로드 실패:', e)
    }
  }

  useEffect(() => { loadData() }, [])

  const noData = templates.length === 0 || members.length === 0

  // ── 수동 등록: 결재자 추가/삭제/수정 ────────────────────
  function addApprover() {
    setMApprovers((prev) => [...prev, emptyApprover(prev.length + 1)])
  }

  function removeApprover(idx) {
    setMApprovers((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((a, i) => ({ ...a, approval_order: i + 1 }))
    )
  }

  function updateApprover(idx, field, value) {
    setMApprovers((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    )
  }

  // ── 수동 등록: 저장 ──────────────────────────────────────
  async function handleManualSave() {
    setMError('')
    setMSuccess('')

    if (!mRuleName.trim()) return setMError('규칙명을 입력하세요.')
    if (!mRuleText.trim()) return setMError('규칙 설명을 입력하세요.')
    if (!mTemplateId) return setMError('적용 양식을 선택하세요.')
    if (mApprovers.length === 0) return setMError('결재자를 1명 이상 추가하세요.')
    if (mApprovers.some((a) => !a.approver_member_id))
      return setMError('결재자를 모두 선택하세요.')

    setMSaving(true)
    try {
      await createApprovalRule({
        rule_name: mRuleName.trim(),
        rule_text: mRuleText.trim(),
        template_id: Number(mTemplateId),
        approvers: mApprovers.map((a) => ({
          approver_member_id: Number(a.approver_member_id),
          approval_order: a.approval_order,
          approval_type: a.approval_type,
        })),
      })
      setMSuccess('결재 규칙이 저장되었습니다.')
      setMRuleName('')
      setMRuleText('')
      setMTemplateId('')
      setMApprovers([emptyApprover(1)])
      await loadData()
    } catch (e) {
      setMError(e.message)
    } finally {
      setMSaving(false)
    }
  }

  // ── 지침서 분석 ──────────────────────────────────────────
  async function handleGuideAnalyze() {
    setAnalyzeError('')
    setPreviewRules([])
    setPSuccess('')
    setPError('')

    if (!guideFile) return setAnalyzeError('PDF 파일을 선택하세요.')
    if (noData)
      return setAnalyzeError(
        '등록된 양식과 조직원이 있어야 분석이 가능합니다.'
      )

    setAnalyzing(true)
    try {
      const res = await previewApprovalRulesByGuide(guideFile)
      setPreviewRules(res.rules || [])
      setSourceName(res.source_name || guideFile.name)
      if ((res.rules || []).length === 0) {
        setAnalyzeError('지침서에서 추출된 결재 규칙이 없습니다. 내용을 확인하세요.')
      }
    } catch (e) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── 미리보기 규칙 수정 ───────────────────────────────────
  function updatePreviewRule(rIdx, field, value) {
    setPreviewRules((prev) =>
      prev.map((r, i) => (i === rIdx ? { ...r, [field]: value } : r))
    )
  }

  function removePreviewRule(rIdx) {
    setPreviewRules((prev) => prev.filter((_, i) => i !== rIdx))
  }

  function addPreviewApprover(rIdx) {
    setPreviewRules((prev) =>
      prev.map((r, i) => {
        if (i !== rIdx) return r
        const maxOrder =
          r.approvers && r.approvers.length > 0
            ? Math.max(...r.approvers.map((a) => a.approval_order))
            : 0
        return {
          ...r,
          approvers: [
            ...(r.approvers || []),
            { approver_member_id: '', approval_order: maxOrder + 1, approval_type: '결재' },
          ],
        }
      })
    )
  }

  function removePreviewApprover(rIdx, aIdx) {
    setPreviewRules((prev) =>
      prev.map((r, i) => {
        if (i !== rIdx) return r
        const approvers = r.approvers
          .filter((_, j) => j !== aIdx)
          .map((a, j) => ({ ...a, approval_order: j + 1 }))
        return { ...r, approvers }
      })
    )
  }

  function updatePreviewApprover(rIdx, aIdx, field, value) {
    setPreviewRules((prev) =>
      prev.map((r, i) => {
        if (i !== rIdx) return r
        const approvers = r.approvers.map((a, j) =>
          j === aIdx ? { ...a, [field]: value } : a
        )
        return { ...r, approvers }
      })
    )
  }

  // ── 미리보기 저장 ────────────────────────────────────────
  async function handlePreviewSave() {
    setPError('')
    setPSuccess('')
    if (previewRules.length === 0) return setPError('저장할 규칙이 없습니다.')

    setPSaving(true)
    try {
      const res = await savePreviewApprovalRules({
        source_name: sourceName,
        rules: previewRules.map((r) => ({
          ...r,
          template_id: r.template_id ? Number(r.template_id) : r.template_id,
          approvers: (r.approvers || []).map((a) => ({
            ...a,
            approver_member_id: a.approver_member_id
              ? Number(a.approver_member_id)
              : a.approver_member_id,
          })),
        })),
      })
      setPSuccess(`${res.saved_rule_count}개 규칙이 저장되었습니다.`)
      setPreviewRules([])
      setGuideFile(null)
      await loadData()
    } catch (e) {
      setPError(e.message)
    } finally {
      setPSaving(false)
    }
  }

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">양식 규칙 관리</h1>
        <p className="text-slate-500 mt-1">
          결재서류 양식별 결재 순서와 결재자를 관리하세요.
        </p>
      </div>

      {/* 양식/조직원 없을 때 경고 */}
      {noData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          ⚠️ 등록된{' '}
          {templates.length === 0 && '결재서류 양식'}
          {templates.length === 0 && members.length === 0 && ' 및 '}
          {members.length === 0 && '조직원'}이 없습니다. 먼저{' '}
          <strong>양식 관리</strong>와 <strong>조직도 관리</strong> 페이지에서
          데이터를 등록하세요.
        </div>
      )}

      {/* ────────────────────────────────────────────────────
          [1] 수동 결재 규칙 등록
      ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">
          수동 결재 규칙 등록
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 규칙명 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              규칙명 <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              value={mRuleName}
              onChange={(e) => setMRuleName(e.target.value)}
              placeholder="예: 출장계 결재 규칙"
              disabled={noData}
            />
          </div>

          {/* 적용 양식 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              적용 양식 <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              value={mTemplateId}
              onChange={(e) => setMTemplateId(e.target.value)}
              disabled={noData}
            >
              <option value="">양식을 선택하세요</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 규칙 설명 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 mb-1">
            규칙 설명 <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            rows={2}
            value={mRuleText}
            onChange={(e) => setMRuleText(e.target.value)}
            placeholder="예: 출장계는 담당자, 팀장, 대표이사 순으로 결재한다."
            disabled={noData}
          />
        </div>

        {/* 결재자 순서 설정 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-600">
              결재자 순서 설정 <span className="text-red-500">*</span>
            </label>
            <button
              onClick={addApprover}
              disabled={noData}
              className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + 결재자 추가
            </button>
          </div>

          <div className="space-y-2">
            {mApprovers.map((a, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-slate-50 rounded-lg p-2"
              >
                <span className="text-xs text-slate-500 w-10 shrink-0 text-center">
                  {idx + 1}차
                </span>

                {/* 결재자 선택 */}
                <select
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={a.approver_member_id}
                  onChange={(e) =>
                    updateApprover(idx, 'approver_member_id', e.target.value)
                  }
                  disabled={noData}
                >
                  <option value="">결재자를 선택하세요</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.title ? ` (${m.title})` : ''}
                      {m.department ? ` · ${m.department}` : ''}
                    </option>
                  ))}
                </select>

                {/* 결재 유형 */}
                <select
                  className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={a.approval_type}
                  onChange={(e) =>
                    updateApprover(idx, 'approval_type', e.target.value)
                  }
                  disabled={noData}
                >
                  {APPROVAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                {/* 삭제 버튼 (1명일 때는 숨김) */}
                {mApprovers.length > 1 && (
                  <button
                    onClick={() => removeApprover(idx)}
                    className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
                    title="결재자 삭제"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {mError && (
          <p className="text-red-500 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">
            {mError}
          </p>
        )}
        {mSuccess && (
          <p className="text-green-600 text-sm mb-3 bg-green-50 rounded-lg px-3 py-2">
            {mSuccess}
          </p>
        )}

        <button
          onClick={handleManualSave}
          disabled={mSaving || noData}
          className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mSaving ? '저장 중...' : '결재 규칙 저장'}
        </button>
      </div>

      {/* ────────────────────────────────────────────────────
          [2] PDF 지침서 AI 분석
      ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-700 mb-1">
          PDF 지침서 AI 분석
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          결재 지침서 PDF를 업로드하면 AI가 결재 규칙 후보를 자동으로 추출합니다.
          결과를 확인·수정한 뒤 저장하세요.
        </p>

        {/* 파일 업로드 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              PDF 지침서 파일
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                setGuideFile(e.target.files[0] || null)
                setPreviewRules([])
                setAnalyzeError('')
                setPSuccess('')
                setPError('')
              }}
              disabled={noData}
              className="block w-full text-sm text-slate-500
                file:mr-3 file:py-1.5 file:px-3
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-indigo-50 file:text-indigo-600
                hover:file:bg-indigo-100
                disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleGuideAnalyze}
            disabled={analyzing || noData || !guideFile}
            className="bg-indigo-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {analyzing ? '분석 중...' : '지침서 분석'}
          </button>
        </div>

        {analyzeError && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">
            {analyzeError}
          </p>
        )}

        {/* ── 분석 결과 미리보기 ── */}
        {previewRules.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-indigo-700">
                AI 분석 결과 ({previewRules.length}건) — 수정 후 저장하세요
              </h3>
            </div>

            <div className="space-y-4">
              {previewRules.map((rule, rIdx) => (
                <div
                  key={rIdx}
                  className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30"
                >
                  {/* 규칙 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 rounded-full px-3 py-0.5">
                      규칙 {rIdx + 1}
                    </span>
                    <button
                      onClick={() => removePreviewRule(rIdx)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-2 py-0.5 hover:bg-red-50"
                    >
                      이 규칙 제거
                    </button>
                  </div>

                  {/* 규칙명 / 양식 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        규칙명
                      </label>
                      <input
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={rule.rule_name || ''}
                        onChange={(e) =>
                          updatePreviewRule(rIdx, 'rule_name', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        적용 양식
                      </label>
                      <select
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={rule.template_id || ''}
                        onChange={(e) =>
                          updatePreviewRule(
                            rIdx,
                            'template_id',
                            Number(e.target.value)
                          )
                        }
                      >
                        <option value="">양식 선택</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.template_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 규칙 설명 */}
                  <div className="mb-3">
                    <label className="block text-xs text-slate-500 mb-1">
                      규칙 설명
                    </label>
                    <textarea
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      rows={2}
                      value={rule.rule_text || ''}
                      onChange={(e) =>
                        updatePreviewRule(rIdx, 'rule_text', e.target.value)
                      }
                    />
                  </div>

                  {/* 근거 문장 */}
                  {(rule.source_excerpt !== undefined) && (
                    <div className="mb-3">
                      <label className="block text-xs text-slate-500 mb-1">
                        근거 문장 (지침서 발췌)
                      </label>
                      <textarea
                        className="w-full border border-amber-200 bg-amber-50 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                        rows={2}
                        value={rule.source_excerpt || ''}
                        onChange={(e) =>
                          updatePreviewRule(
                            rIdx,
                            'source_excerpt',
                            e.target.value
                          )
                        }
                      />
                    </div>
                  )}

                  {/* 결재자 목록 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-500">
                        결재자 순서
                      </label>
                      <button
                        onClick={() => addPreviewApprover(rIdx)}
                        className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-2 py-0.5 hover:bg-indigo-100"
                      >
                        + 결재자 추가
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {(rule.approvers || []).map((a, aIdx) => (
                        <div key={aIdx} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-8 shrink-0">
                            {a.approval_order}차
                          </span>
                          <select
                            className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={a.approver_member_id || ''}
                            onChange={(e) =>
                              updatePreviewApprover(
                                rIdx,
                                aIdx,
                                'approver_member_id',
                                Number(e.target.value)
                              )
                            }
                          >
                            <option value="">결재자 선택</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}{m.title ? ` (${m.title})` : ''}
                              </option>
                            ))}
                          </select>
                          <select
                            className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={a.approval_type || '결재'}
                            onChange={(e) =>
                              updatePreviewApprover(
                                rIdx,
                                aIdx,
                                'approval_type',
                                e.target.value
                              )
                            }
                          >
                            {APPROVAL_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removePreviewApprover(rIdx, aIdx)}
                            className="text-red-400 hover:text-red-600 text-xs px-1"
                            title="결재자 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pError && (
              <p className="text-red-500 text-sm mt-3 bg-red-50 rounded-lg px-3 py-2">
                {pError}
              </p>
            )}
            {pSuccess && (
              <p className="text-green-600 text-sm mt-3 bg-green-50 rounded-lg px-3 py-2">
                {pSuccess}
              </p>
            )}

            <button
              onClick={handlePreviewSave}
              disabled={pSaving}
              className="mt-4 bg-green-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pSaving ? '저장 중...' : '확인 후 저장'}
            </button>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────
          [3] 저장된 결재 규칙 목록
      ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">
          저장된 결재 규칙 목록
        </h2>

        {rules.length === 0 ? (
          <p className="text-slate-400 text-sm">
            저장된 결재 규칙이 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition"
              >
                {/* 규칙 헤더 */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">
                      {rule.rule_name}
                    </h3>
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 mt-1 inline-block">
                      {rule.template_name}
                    </span>
                  </div>
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 ${
                      rule.source_type === 'guide'
                        ? 'bg-purple-50 text-purple-600 border border-purple-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {rule.source_type === 'guide'
                      ? `지침서: ${rule.source_name || ''}`
                      : '수동 등록'}
                  </span>
                </div>

                {/* 규칙 설명 */}
                <p className="text-sm text-slate-600 mb-2">{rule.rule_text}</p>

                {/* 근거 문장 */}
                {rule.source_excerpt && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                    근거: {rule.source_excerpt}
                  </p>
                )}

                {/* 결재선 */}
                {rule.approvers && rule.approvers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400 mr-1">결재선</span>
                    {rule.approvers.map((a, i) => (
                      <span
                        key={i}
                        className="text-xs bg-slate-100 rounded-full px-3 py-1 text-slate-700 flex items-center gap-1"
                      >
                        <span className="text-slate-400">{a.approval_order}차</span>
                        <span className="font-medium">{a.approver_name}</span>
                        {a.approver_title && (
                          <span className="text-slate-500">{a.approver_title}</span>
                        )}
                        <span
                          className={`rounded px-1 ${
                            a.approval_type === '최종승인'
                              ? 'bg-green-100 text-green-700'
                              : a.approval_type === '합의'
                              ? 'bg-yellow-100 text-yellow-700'
                              : a.approval_type === '참조'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {a.approval_type}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
