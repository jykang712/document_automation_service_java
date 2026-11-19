import SafeHtmlFrame from './SafeHtmlFrame'
export default function EditableHtmlPreview({ html, editable, onChange }) {
  return <div className="space-y-3">
    {editable && <label className="block text-sm text-slate-600">HTML 본문 편집
      <textarea aria-label="HTML 본문 편집" className="field mt-2 min-h-64 font-mono text-xs" value={html || ''} onChange={e => onChange(e.target.value)} />
    </label>}
    <SafeHtmlFrame html={html || ''} title="문서 내용 미리보기" height={420} />
  </div>
}
