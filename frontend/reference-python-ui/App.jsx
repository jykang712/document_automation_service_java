// src/App.jsx
// 상단 탭 네비게이션:
//   - "교육용 자동작성"   → EducationGenerator
//   - "양식 관리"         → TemplateManager
//   - "조직도 관리"       → OrgPage
//   - "양식 규칙 관리"    → RulePage
//   - "결재서류 작성"     → ProcessPage

import { useState } from 'react'
import EducationGenerator from './EducationGenerator'
import TemplateManager from './TemplateManager'
import OrgPage from './OrgPage'
import RulePage from './RulePage'
import ProcessPage from './ProcessPage'
import ManagePage from './ManagePage'

const TABS = [
  { key: 'education', label: '교육용 자동작성' },
  { key: 'manage', label: '양식 관리' },
  { key: 'org', label: '조직도 관리' },
  { key: 'rule', label: '양식 규칙 관리' },
  { key: 'process', label: '결재서류 작성' },
  { key: 'docmanage', label: '자동작성 문서 관리' },
]

export default function App() {
  const [tab, setTab] = useState('education')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              AI
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">
                AI 결재서류 자동작성
              </div>
              <div className="text-[11px] text-slate-500">교육용 데모</div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <nav className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  'px-4 py-1.5 rounded-md text-sm font-medium transition',
                  tab === t.key
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'education' && <EducationGenerator />}
        {tab === 'manage' && <TemplateManager />}
        {tab === 'org' && <OrgPage />}
        {tab === 'rule' && <RulePage />}
        {tab === 'process' && <ProcessPage />}
        {tab === 'docmanage' && <ManagePage />}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        AI 결재서류 자동작성 · 교육용 데모
      </footer>
    </div>
  )
}
