import { useEffect, useState } from 'react'
import { getMe, login, logout } from './api'
import TemplateManager from './TemplateManager'
import ManagePage from './ManagePage'
import ProcessPage from './ProcessPage'
import OrgPage from './OrgPage'
import RulePage from './RulePage'
import SignupPage from './SignupPage'
import UserManagementPage from './UserManagementPage'

function LoginPage({ onLogin, onSignup, initialError, initialLoginId = '', successMessage = '' }) {
  const [loginId,setLoginId]=useState(initialLoginId), [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false), [error,setError]=useState(initialError || '')
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { const user=await login(loginId,password); setPassword(''); onLogin(user) }
    catch(e){setError(e.message)} finally {setBusy(false)}
  }
  return <main className="min-h-screen grid place-items-center px-4 bg-slate-50">
    <form onSubmit={submit} className="panel w-full max-w-md space-y-5 shadow-sm">
      <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">결재</div><div><h1 className="text-xl font-bold">결재 문서 관리</h1><p className="text-sm text-slate-500">계정으로 로그인하세요</p></div></div>
      <label className="block text-sm font-medium">로그인 아이디<input className="field mt-2" name="login_id" type="text" autoComplete="username" required value={loginId} onChange={e=>setLoginId(e.target.value)}/></label>
      <label className="block text-sm font-medium">비밀번호<input className="field mt-2" name="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {successMessage && <p role="status" className="text-sm text-emerald-700">{successMessage}</p>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy?'로그인 중…':'로그인'}</button>
      <button className="btn w-full" type="button" disabled={busy} onClick={onSignup}>회원가입</button>
    </form>
  </main>
}
export default function App() {
  const [user,setUser]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState('')
  const [tab,setTab]=useState('docs'), [notice,setNotice]=useState('')
  const [authPage, setAuthPage] = useState('login')
  const [signupLoginId, setSignupLoginId] = useState('')
  const [signupNotice, setSignupNotice] = useState('')
  useEffect(()=>{
    let active=true
    getMe().then(u=>{if(active)setUser(u)}).catch(e=>{if(active&&e.status!==401)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
    const unauthorized=()=>{setUser(null);setNotice('로그인이 만료되었습니다. 다시 로그인하세요.')}
    const refresh=()=>getMe().then(setUser).catch(()=>{})
    window.addEventListener('app:unauthorized',unauthorized)
    window.addEventListener('app:refresh-role',refresh)
    return()=>{active=false;window.removeEventListener('app:unauthorized',unauthorized);window.removeEventListener('app:refresh-role',refresh)}
  },[])
  useEffect(()=>{if(user?.role!=='ADMIN'&&['templates','org','rules','users'].includes(tab))setTab('docs')},[user,tab])
  if(loading)return <main className="p-12 text-center text-slate-500">로그인 상태 확인 중…</main>
  if (!user && authPage === 'signup') return <SignupPage onBack={() => setAuthPage('login')} onComplete={loginId => { setSignupLoginId(loginId); setSignupNotice('회원가입이 완료되었습니다. 본인이 설정한 비밀번호로 로그인하세요.'); setError(''); setAuthPage('login') }} />
  if(!user)return <LoginPage initialError={error} initialLoginId={signupLoginId} successMessage={signupNotice} onSignup={() => { setSignupNotice(''); setAuthPage('signup') }} onLogin={u=>{setUser(u);setError('');setNotice('');setSignupNotice('');setTab('docs')}}/>
  const admin=user.role==='ADMIN'
  const tabs=[{key:'docs',label:'문서 관리'},{key:'create',label:'문서 작성'},...(admin?[{key:'templates',label:'양식 관리'},{key:'org',label:'조직원 관리'},{key:'users',label:'사용자 관리'},{key:'rules',label:'결재 규칙'}]:[])]
  async function signOut(){try{await logout();setUser(null);setNotice('')}catch(e){setNotice(e.message)}}
  async function refreshRole(){try{setUser(await getMe());setNotice('계정 권한을 새로 확인했습니다.')}catch(e){setNotice(e.message)}}
  return <div className="min-h-screen">
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-5 py-4 flex flex-wrap justify-between items-center gap-3">
        <div><h1 className="font-bold text-lg">결재 문서 관리</h1><p className="text-xs text-slate-500">양식과 문서를 한곳에서</p></div>
        <div className="flex flex-wrap gap-2 items-center text-sm"><span>{user.name} · {user.role}</span><button className="btn" onClick={refreshRole}>권한 새로고침</button><button className="btn" onClick={signOut}>로그아웃</button></div>
      </div>
      <nav aria-label="주 메뉴" className="max-w-[1600px] mx-auto px-5 flex gap-2 overflow-x-auto">
        {tabs.map(t=><button key={t.key} aria-current={tab===t.key?'page':undefined} onClick={()=>{setTab(t.key);setNotice('')}} className={`whitespace-nowrap px-4 py-3 text-sm border-b-2 ${tab===t.key?'border-indigo-600 text-indigo-700 font-semibold':'border-transparent text-slate-500'}`}>{t.label}</button>)}
      </nav>
    </header>
    <main className="max-w-[1600px] mx-auto px-5 py-6">
      {notice&&<div role="status" className="mb-4 p-3 rounded-lg bg-indigo-50 text-indigo-800 text-sm">{notice}</div>}
      {tab==='docs'&&<ManagePage/>}
      {tab==='create'&&<ProcessPage onCreated={id=>{setNotice(`문서 #${id}가 로그인 계정 소유로 저장되었습니다.`);setTab('docs')}}/>}
      {admin&&tab==='templates'&&<TemplateManager/>}
      {admin&&tab==='org'&&<OrgPage/>}
      {admin&&tab==='users'&&<UserManagementPage/>}
      {admin&&tab==='rules'&&<RulePage/>}
    </main>
  </div>
}
