import { useEffect, useMemo, useRef } from 'react'
import DOMPurify from 'dompurify'

export const sanitizeHtml = (html) => DOMPurify.sanitize(html || '', {
  // Keep leading DOCX <style> blocks in the sanitized body fragment.
  FORCE_BODY: true,
  ADD_TAGS: ['style', 'colgroup', 'col'], ADD_ATTR: ['data-cell-id', 'style', 'rowspan', 'colspan'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'base'],
})
// Defaults also make borderless/unstyled table HTML usable in the mapping preview.
const TABLE_PREVIEW_STYLE = `
  body{margin:0;padding:12px;font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:14px;line-height:1.5;background:white;color:#111}
  :where(table){width:100%;max-width:100%;border-collapse:collapse;border-spacing:0;table-layout:fixed;margin:12px 0}
  :where(td,th){border:1px solid #64748b;padding:6px 8px;vertical-align:top;height:28px;overflow-wrap:anywhere}
  :where(th){font-weight:600;background:#f8fafc}
  :where(p){margin:6px 0}
  .doc-wrap td>p,.doc-wrap th>p{margin:0}
  .mapping-mode [data-cell-id]:hover{background:#eff6ff!important;outline:2px solid #93c5fd;outline-offset:-2px}
  .mapping-selected{outline:3px solid #6366f1!important;outline-offset:-3px;background:#dbeafe!important}
`
const escape = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const downloadHtml = (title, html) => {
  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:"><title>${escape(title)}</title><style>${TABLE_PREVIEW_STYLE}</style></head><body>${sanitizeHtml(html)}</body></html>`
  const url = URL.createObjectURL(new Blob([page], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `${String(title || 'document').replace(/[\\/:*?"<>|]/g, '_')}.html`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function SafeHtmlFrame({ html, title = '문서 미리보기', onCellPick, selectedCells = [], height = 520 }) {
  const frame = useRef(null)
  const callback = useRef(onCellPick)
  const config = useRef({ selectedCells, clickable: Boolean(onCellPick) })
  callback.current = onCellPick
  config.current = { selectedCells, clickable: Boolean(onCellPick) }
  const srcDoc = useMemo(() => {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('')
    const bridge = `
      let clickable=false;
      function mark(data){
        clickable=!!data.clickable;
        document.body.classList.toggle('mapping-mode',clickable);
        document.querySelectorAll('[data-cell-id]').forEach(c=>{
          c.classList.toggle('mapping-selected',(data.selectedCells||[]).includes(c.getAttribute('data-cell-id')));
          c.style.cursor=clickable?'crosshair':'';
          c.title='셀 '+c.getAttribute('data-cell-id');
          if(clickable){c.setAttribute('tabindex','0');c.setAttribute('role','button');c.setAttribute('aria-label','셀 '+c.getAttribute('data-cell-id'));}
          else{c.removeAttribute('tabindex');c.removeAttribute('role');}
        });
      }
      addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='mapping:config')mark(e.data);});
      function pick(e){
        if(e.target.closest?.('a'))e.preventDefault();
        if(!clickable)return;
        const cell=e.target.closest?.('td[data-cell-id],th[data-cell-id]');
        if(!cell)return;
        e.preventDefault();
        parent.postMessage({type:'mapping:pick',cellId:cell.getAttribute('data-cell-id')},'*');
      }
      document.addEventListener('click',pick);
      document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')pick(e);});
    `
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data: blob:; base-uri 'none'; form-action 'none'"><style>${TABLE_PREVIEW_STYLE}</style></head><body>${sanitizeHtml(html)}<script nonce="${nonce}">${bridge}<\/script></body></html>`
  }, [html])
  useEffect(() => {
    const receive = (e) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'mapping:pick') return
      if (typeof e.data.cellId === 'string' && /^t\d+_r\d+_c\d+$/.test(e.data.cellId)) callback.current?.(e.data.cellId)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])
  const sync = () => frame.current?.contentWindow?.postMessage({ type: 'mapping:config', ...config.current }, '*')
  useEffect(sync, [selectedCells, onCellPick])
  return <iframe ref={frame} title={title} srcDoc={srcDoc} sandbox="allow-scripts" onLoad={sync}
    className="w-full rounded-lg border border-slate-200 bg-white" style={{ height }} />
}
