export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
let csrfPromise = null
export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status }
}
async function parse(response, path) {
  const text = response.status === 204 ? '' : await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { /* non-JSON error page */ }
  if (!response.ok) {
    const message = typeof data?.detail === 'string' ? data.detail : data?.message
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('app:unauthorized'))
    if (response.status === 403) window.dispatchEvent(new Event('app:refresh-role'))
    throw new ApiError(message || `요청 실패 (${response.status}). 서버 상태와 로그인 권한을 확인하세요.`, response.status)
  }
  return data
}
async function send(path, options = {}) {
  let response
  try { response = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include' }) }
  catch { throw new ApiError('서버에 연결할 수 없습니다. Tomcat 실행 상태를 확인하세요.', 0) }
  return parse(response, path)
}
async function csrf() {
  if (!csrfPromise) {
    csrfPromise = send('/auth/csrf').finally(() => { csrfPromise = null })
  }
  const token = await csrfPromise
  if (!token?.headerName || !token?.token) throw new Error('CSRF 토큰 응답을 확인할 수 없습니다.')
  return token
}
export async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const nextHeaders = new Headers(headers)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await csrf()
    nextHeaders.set(token.headerName, token.token)
  }
  if (body !== undefined && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    nextHeaders.set('Content-Type', 'application/json; charset=utf-8')
    body = JSON.stringify(body)
  }
  return send(path, { method, headers: nextHeaders, body })
}
export const getMe = () => request('/auth/me')
export async function login(loginId, password) {
  const data = await request('/auth/login', {
    method: 'POST', body: new URLSearchParams({ login_id: loginId, password }),
  })
  await csrf() // Authentication rotates the CSRF token; fetch again.
  return data.user
}
export const logout = () => request('/auth/logout', { method: 'POST' })


export async function getTemplates() { return (await request('/templates')).templates || [] }
export async function getTemplateDetail(id) {
  const detail = await request(`/templates/${id}`)
  return { ...detail, fields: detail.template_fields || [] }
}
export const updateTemplate = (id, body) => request(`/templates/${id}`, { method: 'PATCH', body })
export const deactivateTemplate = (id) => request(`/templates/${id}`, { method: 'DELETE' })
export async function getAvailableTemplates() { return (await request('/available-templates')).templates || [] }
export const getAvailableTemplateDetail = (id) => request(`/available-templates/${id}`)
export async function previewTemplateFields({ template }) {
  const body = new FormData(); body.append('file', template)
  const data = await request('/templates/preview-docx', { method: 'POST', body })
  return { ...data, fields: [], cell_texts: Object.fromEntries((data.cells || []).map(c => [c.cell_id, c.text])) }
}
export const saveTemplateWithFields = (body) =>
  request('/templates/save-docx', { method: 'POST', body })


export const createGeneratedDocument = (body) => request('/generated-documents', { method: 'POST', body })
export const getGeneratedDocuments = () => request('/generated-documents')
export const getGeneratedDocumentDetail = (id) => request(`/generated-documents/${id}`)
export const updateGeneratedDocument = ({ documentId, htmlContent, documentTitle, extractedJson }) =>
  request(`/generated-documents/${documentId}`, { method: 'PATCH', body: {
    ...(extractedJson !== undefined ? { extracted_json: extractedJson } : {}),
    ...(htmlContent !== undefined ? { html_content: htmlContent } : {}),
    ...(documentTitle !== undefined ? { document_title: documentTitle } : {}),
  } })
export const deleteGeneratedDocument = (id) => request(`/generated-documents/${id}`, { method: 'DELETE' })
export async function getOrgMembers() {
  const data = await request('/org-members')
  return Array.isArray(data) ? data : data?.members || []
}
export const createOrgMember = (body) => request('/org-members', { method: 'POST', body })

// 회원가입은 본인 입력으로만 진행하며 권한/조직원 ID는 보내지 않습니다.
export const signup = ({ name, loginId, password }) =>
  request('/auth/signup', { method: 'POST', body: { name, login_id: loginId, password } })
export const getManagedUsers = () => request('/admin/user-management')
export const getLinkableOrgMembers = () => request('/admin/user-management/org-members')
export const setUserOrgMember = (userId, memberId) =>
  request(`/admin/user-management/${userId}/org-member`, {
    method: 'PATCH', body: { org_member_id: memberId }
  })
export const changeManagedUserRole = (userId, role) =>
  request(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role } })
export const updateOrgMember = (id, body) =>
  request(`/org-members/${id}`, { method: 'PATCH', body })

// 결재규칙: AI는 미리보기만, 저장은 사용자가 확정한 데이터로 요청합니다.
export const getApprovalRuleCatalog = () => request('/approval-rules/catalog')
export const getApprovalRules = (includeInactive = false) =>
  request(`/approval-rules?includeInactive=${includeInactive}`)
export const createApprovalRule = (body) => request('/approval-rules', { method: 'POST', body })
export const updateApprovalRule = (id, body) => request(`/approval-rules/${id}`, { method: 'PATCH', body })
export const deleteApprovalRule = (id) => request(`/approval-rules/${id}`, { method: 'DELETE' })
export const getApprovalRuleLine = (id) => request(`/approval-rules/${id}/approval-line`)
export const previewApprovalRulesByGuide = (file) => {
  const body = new FormData(); body.append('guide_file', file)
  return request('/approval-rules/preview-guide', { method: 'POST', body })
}
export const savePreviewApprovalRules = (body) => request('/approval-rules/save-preview', { method: 'POST', body })

// 문서 AI: FormData는 각 페이지에서 구성합니다.
export const recommendTemplateFields = (body) =>
  request('/templates/recommend-fields', { method: 'POST', body })
export const generateDocumentDraft = (body) =>
  request('/generated-documents/draft', { method: 'POST', body })

// 문서 작성용 읽기 API (관리자용 규칙 CRUD와 분리)
export async function getAvailableApprovalRules(templateId) {
  return (await request(`/available-approval-rules?template_id=${encodeURIComponent(templateId)}`)).rules || []
}
