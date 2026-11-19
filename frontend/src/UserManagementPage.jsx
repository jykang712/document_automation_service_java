import { useEffect, useState } from 'react'
import { getManagedUsers, getLinkableOrgMembers, setUserOrgMember, changeManagedUserRole } from './api'

export default function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [members, setMembers] = useState([])
  const [choices, setChoices] = useState({})
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function load() {
    const [nextUsers, nextMembers] = await Promise.all([getManagedUsers(), getLinkableOrgMembers()])
    setUsers(nextUsers); setMembers(nextMembers)
    setChoices(Object.fromEntries(nextUsers.map(u => [u.id, u.org_member_id == null ? '' : String(u.org_member_id)])))
    setReady(true)
  }
  useEffect(() => { load().catch(e => setError(e.message)) }, [])
  async function run(action, text, roleChanged = false) {
    setBusy(true); setError(''); setNotice('')
    try {
      await action(); setNotice(text)
      if (roleChanged) window.dispatchEvent(new Event('app:refresh-role'))
      try { await load() } catch (e) { setError(`변경은 완료됐지만 목록을 불러오지 못했습니다: ${e.message}`) }
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  function link(user) {
    const member = members.find(m => String(m.id) === choices[user.id])
    if (!member || !window.confirm(`${user.login_id} 계정을 ${member.name} (${member.email}) 조직원과 연결할까요? 같은 사람인지 확인하세요.`)) return
    run(() => setUserOrgMember(user.id, member.id), '조직원을 연결했습니다.')
  }
  function unlink(user) {
    if (!window.confirm(`${user.login_id} 계정의 조직원 연결을 해제할까요?`)) return
    run(() => setUserOrgMember(user.id, null), '조직원 연결을 해제했습니다.')
  }
  function role(user) {
    const next = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    if (!window.confirm(`${user.login_id} 권한을 ${next}으로 변경할까요?`)) return
    run(() => changeManagedUserRole(user.id, next), `권한을 ${next}으로 변경했습니다.`, true)
  }
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">사용자 관리</h2><p className="text-sm text-slate-500 mt-1">회원가입한 계정의 권한과 조직원 연결을 관리합니다.</p></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status" className="text-emerald-700">{notice}</p>}
    <section className="panel overflow-auto">
      <div className="flex justify-between items-center mb-4"><h3 className="font-semibold">계정 {users.length}개</h3>
        <button className="btn" disabled={busy} onClick={() => run(async () => {}, '목록을 새로 불러왔습니다.')}>새로고침</button></div>
      <table className="w-full text-sm"><thead><tr className="text-left border-b">{['번호', '이름', '로그인 아이디', '상태', '계정 권한', '연결된 조직원', '조직원 연결 관리'].map(h => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{users.map(u => {
          const options = members.filter(m => m.user_id == null || m.user_id === u.id)
          const selected = choices[u.id] || ''
          const canConnect = options.some(m => String(m.id) === selected) && selected !== String(u.org_member_id)
          return <tr className="border-b" key={u.id}>
            {[u.id, u.name, u.login_id, u.active ? '활성' : '비활성'].map((v, i) => <td className="p-3" key={i}>{v}</td>)}
            <td className="p-3 whitespace-nowrap"><div className="mb-2">{u.role}</div><button className="btn" disabled={busy || !ready || !u.active || !['USER', 'ADMIN'].includes(u.role)} onClick={() => role(u)}>{u.role === 'ADMIN' ? 'USER로 변경' : 'ADMIN 권한 부여'}</button></td>
            <td className="p-3">{u.org_member_id == null ? '연동 대기' : <><div>{u.org_member_name} · #{u.org_member_id}</div><div className="text-xs text-slate-500">{u.org_member_email}{u.org_member_active === false ? ' · 비활성 조직원' : ''}</div></>}</td>
            <td className="p-3 min-w-72"><select className="field mb-2" aria-label={`${u.login_id} 연결 조직원`} disabled={busy || !ready || !u.active} value={selected} onChange={e => setChoices(v => ({ ...v, [u.id]: e.target.value }))}>
              <option value="">조직원을 선택하세요</option>
              {u.org_member_id != null && !options.some(m => m.id === u.org_member_id) && <option value={String(u.org_member_id)} disabled>현재 조직원 #{u.org_member_id} (비활성)</option>}
              {options.map(m => <option key={m.id} value={String(m.id)}>{m.name} · {m.department || '부서 없음'} · {m.email}</option>)}
            </select><div className="flex gap-2">
              <button className="btn" disabled={busy || !u.active || !canConnect} onClick={() => link(u)}>조직원 연결</button>
              <button className="btn" disabled={busy || u.org_member_id == null} onClick={() => unlink(u)}>연결 해제</button>
            </div></td>
          </tr>
        })}</tbody></table>
      {!ready && !error && <p className="p-3 text-slate-500">목록을 불러오는 중…</p>}
      {ready && !users.length && <p className="p-3 text-slate-500">가입한 계정이 없습니다.</p>}
    </section>
  </div>
}
