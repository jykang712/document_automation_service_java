export const APPROVAL_TYPES = ['결재', '합의', '최종승인', '참조']
export const emptyStep = () => ({ _key: crypto.randomUUID(), approver_member_id: '', approval_type: '결재' })
export const emptyRule = () => ({ rule_name: '', rule_text: '', template_id: '', source_excerpt: '', approvers: [emptyStep()] })
export function editableRule(rule) {
  return { ...emptyRule(), ...rule, template_id: rule.template_id == null ? '' : String(rule.template_id),
    source_excerpt: rule.source_excerpt || '', approvers: (rule.approvers?.length ? rule.approvers : [emptyStep()]).map(a => ({ ...a,
      _key: crypto.randomUUID(), approver_member_id: a.approver_member_id == null ? '' : String(a.approver_member_id) })) }
}
// 현재 입력값으로 저장 가능 여부를 계산합니다. 미지정 상태의 초안도 화면에는 표시합니다.
export function getRuleIssues(rule, catalog) {
  const issues = []
  const rule_name = String(rule.rule_name || '').trim(), rule_text = String(rule.rule_text || '').trim()
  if (!rule_name || !rule_text) issues.push('규칙명과 규칙 설명을 입력하세요.')
  if (rule_name.length > 255 || rule_text.length > 10000) issues.push('규칙명 또는 설명의 길이가 너무 깁니다.')
  const template_id = Number(rule.template_id)
  if (!Number.isSafeInteger(template_id) || !catalog.templates.some(t => t.id === template_id)) issues.push('활성 양식을 선택하세요.')
  if (!rule.approvers?.length || rule.approvers.length > 20) issues.push('결재자는 1~20명이어야 합니다.')
  const seen = new Set()
  for (const [i, a] of (rule.approvers || []).entries()) {
    const id = Number(a.approver_member_id)
    if (!Number.isSafeInteger(id) || !catalog.members.some(m => m.id === id)) issues.push(`${i + 1}차 결재자를 활성 조직원에서 선택하세요.`)
    else {
      if (seen.has(id)) issues.push('같은 조직원을 중복 결재자로 지정할 수 없습니다.')
      seen.add(id)
    }
    if (!APPROVAL_TYPES.includes(a.approval_type)) issues.push('결재 유형을 확인하세요.')
  }
  if (String(rule.source_excerpt || '').trim().length > 8000) issues.push('근거 문장은 8,000자 이하여야 합니다.')
  return [...new Set(issues)]
}
export function serializeRule(rule, catalog) {
  const issues = getRuleIssues(rule, catalog)
  if (issues.length) throw new Error(issues[0])
  return {
    rule_name: String(rule.rule_name).trim(), rule_text: String(rule.rule_text).trim(),
    template_id: Number(rule.template_id), source_excerpt: String(rule.source_excerpt || '').trim(),
    approvers: rule.approvers.map((a, i) => ({ approver_member_id: Number(a.approver_member_id),
      approval_order: i + 1, approval_type: a.approval_type }))
  }
}
