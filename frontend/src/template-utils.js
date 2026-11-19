const token = /\{\{([a-z][a-z0-9_]{0,79})\}\}/g
export function configureCompositeFields(fields, index) {
  const source = fields[index]
  if (!source?.cell_ids?.length) throw new Error('먼저 이 필드에 셀을 연결하세요.')
  const names = [...new Set([...String(source.cell_template || '').matchAll(token)].map(m => m[1]))]
  if (!names.length) throw new Error('셀 템플릿에 {{year}}처럼 key를 입력하세요.')
  const next = fields.map(f => ({ ...f }))
  const otherUsesOldKey = fields.some((f, i) => i !== index &&
    [...String(f.cell_template || '').matchAll(token)].some(m => m[1] === source.key))
  // A single cell's custom pattern replaces its normal {{key}} placeholder.
  // Use the first manually entered key as the owner, avoiding an unused wrapper field.
  if (source.cell_ids.length === 1 && !names.includes(source.key) && !otherUsesOldKey) {
    if (fields.some((f, i) => i !== index && f.key === names[0])) {
      throw new Error(`${names[0]} 필드가 이미 있습니다. 현재 필드의 key를 셀 템플릿에서 사용하거나, 기존 필드를 정리한 뒤 다시 구성하세요.`)
    }
    next[index].key = names[0]
  }
  const known = new Set(next.map(f => f.key))
  for (const key of names) {
    if (known.has(key)) continue
    next.push({ key, label: key, type: 'string', required: false, description: '',
      cell_id: '', cell_ids: [], cell_template: '' })
    known.add(key)
  }
  return next
}
export function mappingPreview(html, fields) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const used = new Set()
  for (const f of fields) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(f.key || '')) continue
    for (const [i, id] of (f.cell_ids || []).entries()) {
      if (used.has(id)) continue
      const cell = doc.getElementById(id)
      if (!cell || cell.querySelector('table')) continue
      used.add(id); cell.replaceChildren()
      const pattern = i === 0 && f.cell_template ? f.cell_template : `{{${f.key}}}`
      let last = 0
      for (const match of pattern.matchAll(token)) {
        cell.append(document.createTextNode(pattern.slice(last, match.index)))
        const span = doc.createElement('span'); span.className = 'ph'; span.textContent = match[0]; cell.append(span)
        last = match.index + match[0].length
      }
      cell.append(document.createTextNode(pattern.slice(last)))
    }
  }
  return doc.head.innerHTML + doc.body.innerHTML
}
// "2026-10-19" → "2026년 10월 19일"
function formatDateForDocument(value) {
  const text = String(value ?? '')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)

  if (!match) return text

  const [, year, month, day] = match

  return `${year}년 ${Number(month)}월 ${Number(day)}일`
  /*return `${year}년 ${month}월 ${day}일`*/
}
export function fillTemplate(html, values, fields = []) {
  const dateKeys = new Set(
    fields
      .filter(field => field.type === 'date')
      .map(field => field.key)
  )

  const doc = new DOMParser().parseFromString(
    html || '',
    'text/html'
  )

  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT
  )

  const nodes = []
  while (walker.nextNode()) {
    nodes.push(walker.currentNode)
  }

  const definitions = new Map(fields.map(field => [field.key, field]))
  for (const node of nodes) {
    if (node.parentElement?.closest('style,script')) continue
    const matches = [...node.textContent.matchAll(token)]
    if (!matches.length) continue
    const fragment = doc.createDocumentFragment()
    let last = 0
    for (const match of matches) {
      fragment.append(doc.createTextNode(node.textContent.slice(last, match.index)))
      const key = match[1], field = definitions.get(key)
      const span = doc.createElement('span')
      span.className = 'ph'
      span.setAttribute('data-field-key', key)
      span.setAttribute('data-field-label', field?.label || key)
      span.setAttribute('data-field-type', dateKeys.has(key) ? 'date' : 'string')
      span.style.whiteSpace = 'pre-wrap'
      span.textContent = dateKeys.has(key) ? formatDateForDocument(values[key]) : String(values[key] ?? '')
      fragment.append(span)
      last = match.index + match[0].length
    }
    fragment.append(doc.createTextNode(node.textContent.slice(last)))
    node.replaceWith(fragment)
  }

  return doc.head.innerHTML + doc.body.innerHTML
}
export function validateMapping(fields, cells) {
  if (!fields.length) throw new Error('매핑 필드를 하나 이상 추가하세요.')
  const keys = new Set(), used = new Set(), known = new Set(cells.map(c => c.cell_id))
  for (const f of fields) {
    if (f.cell_template && !(f.cell_ids || []).length) throw new Error(`${f.key}: 셀 템플릿을 적용할 셀을 선택하세요.`)
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(f.key || '')) throw new Error(`key 형식을 확인하세요: ${f.key || '(빈 값)'}`)
    if (keys.has(f.key)) throw new Error(`중복 key: ${f.key}. 반복 위치는 다중추가로 연결하세요.`)
    keys.add(f.key)
    for (const id of f.cell_ids || []) {
      if (!known.has(id)) throw new Error(`미리보기에 없는 셀: ${id}`)
      if (used.has(id)) throw new Error(`두 필드가 같은 셀을 선택했습니다: ${id}`)
      used.add(id)
    }
  }
  const tokens = new Set()
  for (const f of fields) {
    if ((f.cell_ids || []).length) {
      if (f.cell_template) {
        for (const match of f.cell_template.matchAll(token)) tokens.add(match[1])
        if (f.cell_ids.length > 1) tokens.add(f.key)
      } else tokens.add(f.key)
    }
  }
  for (const key of keys) if (!tokens.has(key)) {
    const field = fields.find(f => f.key === key)
    if (field.cell_ids?.length && field.cell_template) {
      throw new Error(`${key}: 셀 템플릿에 {{${key}}}가 없습니다. 이 key를 템플릿에 넣거나, [셀 템플릿의 key로 구성]을 눌러 입력한 key들로 바꾸세요.`)
    }
    throw new Error(`${key}: [셀 선택] 후 왼쪽 표의 입력 칸을 클릭하세요. 다른 필드의 셀 템플릿에서 {{${key}}}로 사용하는 경우에는 별도 셀 연결이 필요 없습니다.`)
  }
  for (const key of tokens) if (!keys.has(key)) throw new Error(`${key}: 아직 등록하지 않은 key입니다. [수동 key 추가] 또는 [셀 템플릿의 key로 구성]으로 등록하세요.`)
}
