import { useEffect, useState } from 'react'
import { createOrgMember, getOrgMembers, updateOrgMember } from './api'
const empty = { name: '', title: '', email: '', department: '' }
export default function OrgPage() {
  const [members, setMembers] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function load() { setMembers(await getOrgMembers()) }
  useEffect(() => { load().catch(e => setError(e.message)) }, [])
  function reset() { setForm(empty); setEditing(null) }
  function edit(member) {
    setEditing(member.id)
    setForm(Object.fromEntries(Object.keys(empty).map(key => [key, member[key] || ''])))
    setError(''); setNotice('')
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      if (editing == null) await createOrgMember(form)
      else await updateOrgMember(editing, form)
      setNotice(editing == null ? '조직원을 등록했습니다.' : '조직원 정보를 수정했습니다.')
      reset()
      try { await load() } catch (e) { setError(`저장은 완료됐지만 목록을 불러오지 못했습니다: ${e.message}`) }
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">조직원 관리</h2><p className="text-sm text-slate-500 mt-1">조직원의 이름·부서·직급·연락 이메일을 관리합니다. 계정 연결은 사용자 관리에서 진행하세요.</p></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status" className="text-emerald-700">{notice}</p>}
    <form className="panel space-y-4" onSubmit={save}>
      <h3 className="font-semibold">{editing == null ? '조직원 추가' : `조직원 #${editing} 수정`}</h3>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[['name', '이름'], ['department', '부서'], ['title', '직급'], ['email', '조직원 이메일']].map(([key, label]) =>
          <label className="text-sm" key={key}>{label}<input className="field mt-2" required={key !== 'department'}
            type={key === 'email' ? 'email' : 'text'} maxLength={key === 'email' ? 255 : 100} disabled={busy}
            value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></label>)}
      </div>
      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>{busy ? '저장 중…' : editing == null ? '조직원 등록' : '수정 저장'}</button>
        {editing != null && <button className="btn" type="button" disabled={busy} onClick={reset}>수정 취소</button>}</div>
    </form>
    <section className="panel overflow-auto">
      <div className="flex justify-between items-center mb-3"><h3 className="font-semibold">등록된 조직원 {members.length}명</h3>
        <button className="btn" disabled={busy} onClick={() => load().catch(e => setError(e.message))}>새로고침</button></div>
      <table className="w-full text-sm"><thead><tr className="text-left border-b">{['번호', '이름', '부서', '직급', '조직원 이메일', '관리'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead>
        <tbody>{members.map(m => <tr key={m.id} className="border-b">{[m.id, m.name, m.department, m.title, m.email].map((v, i) => <td className="p-3" key={i}>{v || '-'}</td>)}
          <td className="p-3"><button className="btn" disabled={busy} onClick={() => edit(m)}>수정</button></td></tr>)}</tbody></table>
      {!members.length && <p className="text-sm text-slate-500 p-3">등록된 조직원이 없습니다.</p>}
    </section>
  </div>
}
