// src/api.js
// 백엔드 API 호출 함수 모음

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function _parse(r) {
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = data && (data.detail || data.message)
    throw new Error(msg || `서버 오류 (${r.status})`)
  }
  return data
}

// ── 양식 관리 ────────────────────────────────────────────────

// 1) DOCX 분석
export async function previewTemplateFields({ template, template_name, description }) {
  const fd = new FormData()
  fd.append('template', template)
  fd.append('template_name', template_name)
  fd.append('description', description || '')
  const r = await fetch(`${API_BASE}/api/templates/preview-fields`, {
    method: 'POST',
    body: fd,
  })
  return _parse(r)
}

// 2) DB 저장 (사용자가 확정한 fields 기준)
export async function saveTemplateWithFields({ template, template_name, description, fields }) {
  const fd = new FormData()
  fd.append('template', template)
  fd.append('template_name', template_name)
  fd.append('description', description || '')
  fd.append('fields', JSON.stringify(fields || []))
  const r = await fetch(`${API_BASE}/api/templates/save-with-fields`, {
    method: 'POST',
    body: fd,
  })
  return _parse(r)
}

// 3) 양식 목록
export async function getTemplates() {
  const r = await fetch(`${API_BASE}/api/templates`)
  const data = await _parse(r)
  return data.templates || []
}

// 4) 양식 상세
export async function getTemplateDetail(id) {
  const r = await fetch(`${API_BASE}/api/templates/${id}`)
  return _parse(r)
}

// ── 교육용 자동작성 ──────────────────────────────────────────

// 5) AI 자동작성 (교육용 페이지 전용)
export async function generateOnce({ template_name, html_template, fields, description, receipts }) {
  const fd = new FormData()
  fd.append('template_name', template_name)
  fd.append('html_template', html_template)
  fd.append('fields', JSON.stringify(fields || []))
  fd.append('description', description || '')
  ;(receipts || []).forEach((f) => fd.append('receipts', f))
  const r = await fetch(`${API_BASE}/api/education/generate-once`, {
    method: 'POST',
    body: fd,
  })
  return _parse(r)
}

// ── 조직도 관리 ──────────────────────────────────────────────

// 6) 조직원 수동 등록
export async function createOrgMember({ name, department, title, email }) {
  const r = await fetch(`${API_BASE}/api/org-members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, department, title, email }),
  })
  return _parse(r)
}

// 7) 조직원 목록 조회
export async function getOrgMembers() {
  const r = await fetch(`${API_BASE}/api/org-members`)
  return _parse(r)
}

// 8) 조직도 이미지 AI 분석 미리보기
export async function previewOrgMembersByImage({ imageFile }) {
  const fd = new FormData()
  fd.append('org_image', imageFile)
  const r = await fetch(`${API_BASE}/api/org-members/preview-image`, {
    method: 'POST',
    body: fd,
  })
  return _parse(r)
}

// 9) AI 추출 결과 일괄 저장
export async function savePreviewOrgMembers(rows) {
  const r = await fetch(`${API_BASE}/api/org-members/save-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return _parse(r)
}

// ── 양식 규칙 관리 ───────────────────────────────────────────

// 10) 결재 규칙 수동 저장
export async function createApprovalRule(payload) {
  const r = await fetch(`${API_BASE}/api/approval-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return _parse(r)
}

// 11) 결재 규칙 목록 조회
export async function getApprovalRules() {
  const r = await fetch(`${API_BASE}/api/approval-rules`)
  return _parse(r)
}

// 12) PDF 지침서 업로드 → AI 결재 규칙 후보 추출
export async function previewApprovalRulesByGuide(guideFile) {
  const fd = new FormData()
  fd.append('guide_file', guideFile)
  const r = await fetch(`${API_BASE}/api/approval-rules/preview-guide`, {
    method: 'POST',
    body: fd,
  })
  return _parse(r)
}

// 13) AI 결재 규칙 후보 일괄 저장
export async function savePreviewApprovalRules(payload) {
  const r = await fetch(`${API_BASE}/api/approval-rules/save-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return _parse(r)
}

// ── 결재서류 자동작성 ─────────────────────────────────────────

// 14) 결재서류 자동 작성 요청
// payload: { templateId, description, receipts: File[], requesterName?, requesterDepartment? }
export async function processExpense({ templateId, description, receipts, requesterName, requesterDepartment }) {
  const fd = new FormData()
  fd.append('template_id', String(templateId))
  fd.append('description', description || '')
  fd.append('requester_name', requesterName || '')
  fd.append('requester_department', requesterDepartment || '')
  ;(receipts || []).forEach((f) => fd.append('receipts', f))
  const r = await fetch(`${API_BASE}/api/process`, {
    method: 'POST',
    body: fd,
  })
  return _parse(r)
}

// 15) 결재서류 이메일 발송
// payload: { documentId, toEmail, toName, requester, templateName, filledHtml, expenseData }
export async function sendExpenseEmail({
  documentId,
  toEmail,
  toName,
  requester,
  templateName,
  filledHtml,
  expenseData,
}) {
  const r = await fetch(`${API_BASE}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      to_email: toEmail,
      to_name: toName,
      requester: requester || '',
      template_name: templateName || '',
      filled_html: filledHtml || '',
      expense_data: expenseData || {},
    }),
  })
  return _parse(r)
}

// 16) 사용자 편집 HTML 저장 (PATCH)
// payload: { documentId, htmlContent, extractedJson? }
export async function updateGeneratedDocument({ documentId, htmlContent, extractedJson }) {
  const r = await fetch(`${API_BASE}/api/generated-documents/${documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html_content: htmlContent,
      ...(extractedJson !== undefined ? { extracted_json: extractedJson } : {}),
    }),
  })
  return _parse(r)
}

// ── 자동작성 문서 관리 ─────────────────────────────────────────

// 17) 자동작성 문서 목록 조회
export async function getGeneratedDocuments() {
  const r = await fetch(`${API_BASE}/api/generated-documents`)
  return _parse(r)
}

// 18) 자동작성 문서 상세 조회
export async function getGeneratedDocumentDetail(id) {
  const r = await fetch(`${API_BASE}/api/generated-documents/${id}`)
  return _parse(r)
}

// 19) 자동작성 문서 소프트 삭제
export async function deleteGeneratedDocument(id) {
  const r = await fetch(`${API_BASE}/api/generated-documents/${id}`, {
    method: 'DELETE',
  })
  return _parse(r)
}
