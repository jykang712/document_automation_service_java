import { useState } from 'react'
import { signup } from './api'

export default function SignupPage({ onBack, onComplete }) {
  const [form, setForm] = useState({ name: '', loginId: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function change(key, value) { setForm(f => ({ ...f, [key]: value })) }
  async function submit(e) {
    e.preventDefault(); setError('')
    if (form.password !== form.confirm) { setError('비밀번호 확인이 일치하지 않습니다.'); return }
    if (new TextEncoder().encode(form.password).length > 72) { setError('비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.'); return }
    setBusy(true)
    try {
      await signup({ name: form.name.trim(), loginId: form.loginId.trim(), password: form.password })
      onComplete(form.loginId.trim().toLowerCase())
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen grid place-items-center px-4 bg-slate-50">
    <form onSubmit={submit} className="panel w-full max-w-md space-y-5 shadow-sm">
      <h1 className="text-xl font-bold">회원가입</h1>
      <p className="text-sm text-slate-500">아이디로 가입한 후 관리자가 조직원과 연결합니다. 가입 권한은 USER입니다.</p>
      <label className="block text-sm">이름<input className="field mt-2" autoComplete="name" required maxLength={100} value={form.name} disabled={busy} onChange={e => change('name', e.target.value)} /></label>
      <label className="block text-sm">로그인 아이디<input className="field mt-2" type="text" autoComplete="username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9]([A-Za-z0-9._]|-){2,49}" value={form.loginId} disabled={busy} onChange={e => change('loginId', e.target.value)} /></label>
      <p className="text-xs text-slate-500">아이디는 3~50자의 영문·숫자·점·밑줄·하이픈을 사용합니다. 영문 대문자는 소문자로 저장됩니다.</p>
      <label className="block text-sm">비밀번호<input className="field mt-2" type="password" autoComplete="new-password" required minLength={8} value={form.password} disabled={busy} onChange={e => change('password', e.target.value)} /></label>
      <label className="block text-sm">비밀번호 확인<input className="field mt-2" type="password" autoComplete="new-password" required minLength={8} value={form.confirm} disabled={busy} onChange={e => change('confirm', e.target.value)} /></label>
      <p className="text-xs text-slate-500">비밀번호는 8자 이상으로 설정하세요. 한글 등 멀티바이트 문자는 길이 제한이 달라질 수 있습니다.</p>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? '가입 중…' : '회원가입 완료'}</button>
      <button className="btn w-full" type="button" disabled={busy} onClick={onBack}>로그인으로 돌아가기</button>
    </form>
  </main>
}
