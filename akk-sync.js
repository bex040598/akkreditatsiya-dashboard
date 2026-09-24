// Portal → Dashboard sinxron (xatcho'p orqali yuklanadi). Tampermonkey shart emas.
(function () {
  'use strict';
  const DASH_URL = '__DASH_URL__';
  const EVERY_MIN = 10;
  if (window.__AKK_SYNC) { window.__AKK_SYNC.run(true); return; }
  if (location.hostname !== 'accreditation.nqaae.uz') { alert('Bu tugmani akkreditatsiya portalida (accreditation.nqaae.uz) bosing.'); return; }
  const serial = (location.pathname.match(/\/(KAO\d+)/) || [])[1] || localStorage.getItem('akk_serial') || 'KAO260075';
  localStorage.setItem('akk_serial', serial);

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;background:#0E6E75;color:#fff;font:600 13px system-ui,sans-serif;padding:10px 14px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:8px;max-width:330px';
  box.innerHTML = '<div style="display:flex;gap:8px;align-items:center"><span id="akkDot" style="width:8px;height:8px;border-radius:50%;background:#9fe0b8;flex:none"></span><span id="akkTxt">Dashboard sinxron</span></div>'
    + '<div id="akkTok" style="display:none;gap:6px"><input id="akkTokIn" type="password" placeholder="PUSH_TOKEN" style="flex:1;min-width:0;border:0;border-radius:8px;padding:6px 8px;font:13px system-ui;color:#152A33"><button id="akkTokBtn" style="border:0;border-radius:8px;padding:6px 10px;font:600 13px system-ui;background:#fff;color:#0E6E75;cursor:pointer">Saqlash</button></div>';
  document.body.appendChild(box);
  const $ = id => box.querySelector('#' + id);
  const setTxt = (t, col) => { $('akkTxt').textContent = t; if (col) $('akkDot').style.background = col; };
  const getTok = () => localStorage.getItem('akk_token') || '';
  function askTok(msg) { $('akkTok').style.display = 'flex'; setTxt(msg || 'Render’dagi PUSH_TOKEN ni kiriting:', '#f6d58a'); $('akkTokIn').focus(); }
  $('akkTokBtn').onclick = () => { const v = $('akkTokIn').value.trim(); if (!v) return; localStorage.setItem('akk_token', v); $('akkTok').style.display = 'none'; run(true); };
  $('akkTokIn').onkeydown = e => { if (e.key === 'Enter') $('akkTokBtn').click(); };
  $('akkTxt').style.cursor = 'pointer'; $('akkTxt').onclick = e => e.shiftKey ? askTok() : run(true);

  async function post(data) {
    const r = await fetch(DASH_URL + '/api/push', { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': getTok() }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }

  async function collect(onProgress) {
    const base = '/uz/accreditation/application';
    const P = new DOMParser();
    const getHtml = async url => P.parseFromString(await (await fetch(url, { credentials: 'include' })).text(), 'text/html');
    const getJson = async url => (await fetch(url, { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } })).json();
    const clean = s => (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

    function parsePage(doc, draft) {
      const chapters = {}, titles = {}, rows = [];
      doc.querySelectorAll('.direction-title').forEach(h => {
        const m = clean(h.textContent).match(/^(\d+)-bob\.?\s*(.*)$/);
        if (m) chapters[m[1]] = m[2];
      });
      const ind = (draft && draft.indicators) || {};
      doc.querySelectorAll('.indicator-card[data-indicator-id]').forEach(card => {
        const id = card.dataset.indicatorId, n = card.dataset.indicatorNumber;
        let t = clean(card.dataset.indicatorTitle || '').replace(new RegExp('^' + n.replace(/\./g, '\\.') + '\\s*'), '');
        const star = /\*\s*$/.test(t); t = t.replace(/\*\s*$/, '').trim();
        titles[n] = [t, star];
        const req = [], seen = new Set();
        card.querySelectorAll('[data-document-id]').forEach(d => {
          const k = d.dataset.documentId;
          if (!seen.has(k)) { seen.add(k); req.push({ id: k, t: '' }); }
          if (d.dataset.documentTitle) req.find(r => r.id === k).t = clean(d.dataset.documentTitle);
        });
        const v = ind[id] || {};
        const c = clean(v.comment || '').length;
        const up = v.documents || {};
        const have = req.filter(r => up[r.id]).length;
        const miss = req.filter(r => !up[r.id]).map(r => r.t || ('Hujjat #' + r.id));
        const x = (v.additional_documents || []).length;
        // 0 = to'liq (izoh + barcha hujjatlar), 2 = bo'sh (hech narsa yo'q), 1 = qisman
        const s = (c > 0 && have === req.length) ? 0 : (c === 0 && have === 0 && (req.length > 0 || x === 0)) ? 2 : 1;
        rows.push([n, s, c, have, req.length, miss, x]);
      });
      const pf = (draft && draft.program_files) || {};
      const ex = [...doc.querySelectorAll('[data-program-file]')].map(e => {
        const key = e.dataset.programFile;
        const up = Array.isArray(pf) ? pf.some(f => f && (f.key === key || f.name === key)) : !!pf[key];
        return [clean(e.dataset.programFileLabel), e.classList.contains('required-v2') ? 1 : 0, up ? 1 : 0];
      });
      const concl = clean(draft && draft.program_fields && draft.program_fields.conclusion) ? 1 : 0;
      return { chapters, titles, rows, ex, concl };
    }

    const first = await getHtml(`${base}/step-8/${serial}?layout=main`);
    const items = [...first.querySelectorAll('#programList .program-item')].map(a => {
      const u = new URL(a.getAttribute('href'), location.origin).searchParams;
      const pid = u.get('programId'), gid = u.get('groupId');
      const head = clean(a.querySelector('.fs-6') ? a.querySelector('.fs-6').textContent : a.textContent);
      const m = head.match(/^(\d+)\s*-\s*(.*)$/) || [null, '', head];
      const form = clean(a.querySelector('.fs-8') ? a.querySelector('.fs-8').textContent : '');
      return {
        id: pid || (gid ? 'g' + gid : null), q: pid ? `programId=${pid}` : `groupId=${gid}`,
        code: m[1], name: m[2], form, level: /^7/.test(m[1]) ? 'Magistratura' : 'Bakalavriat',
      };
    }).filter(p => p.id);
    if (!items.length) throw new Error('dasturlar ro‘yxati topilmadi (tizimga kirilganmi?)');

    const out = { programs: [], titles: { c: {}, p: {} }, chapters: { c: {}, p: {} }, complex: null };
    let done = 0; const total = items.length + 1; const queue = items.slice();
    async function worker() {
      while (queue.length) {
        const p = queue.shift();
        try {
          const [doc, draft] = await Promise.all([
            getHtml(`${base}/step-8/${serial}?${p.q}&layout=main`),
            getJson(`${base}/get-draft?applicationSerial=${serial}&${p.q}&language=uz`),
          ]);
          const r = parsePage(doc, draft);
          if (!r.rows.length) throw new Error('indikator topilmadi');
          Object.assign(out.chapters.p, r.chapters); Object.assign(out.titles.p, r.titles);
          const { q, ...meta } = p;
          out.programs.push({ ...meta, rows: r.rows, ex: r.ex, concl: r.concl });
        } catch (e) { console.warn('[AKK]', p.id, e); }
        onProgress(++done, total);
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    out.programs.sort((a, b) => items.findIndex(x => x.id === a.id) - items.findIndex(x => x.id === b.id));
    // yuklanmagan dasturlar ham ro'yxatda qolsin
    items.forEach(p => { if (!out.programs.find(x => x.id === p.id)) { const { q, ...meta } = p; out.programs.push(meta); } });

    try {
      const [doc, draft] = await Promise.all([
        getHtml(`${base}/step-8/${serial}?complex=1&layout=main`),
        getJson(`${base}/get-draft?applicationSerial=${serial}&complex=1&language=uz`),
      ]);
      const r = parsePage(doc, draft);
      if (r.rows.length) { out.chapters.c = r.chapters; out.titles.c = r.titles; out.complex = { rows: r.rows, ex: r.ex, concl: r.concl }; }
    } catch (e) { console.warn('[AKK] complex', e); }
    onProgress(++done, total);
    return out;
  }


  let busy = false, last = 0;
  async function run(manual) {
    if (busy) return;
    if (!manual && Date.now() - last < (EVERY_MIN - 1) * 60e3) return;
    if (!getTok()) return askTok();
    busy = true; last = Date.now();
    try {
      setTxt('Yig‘ilmoqda…', '#f6d58a');
      const data = await collect((d, t) => setTxt(`Yig‘ilmoqda ${d}/${t}`, '#f6d58a'));
      setTxt('Yuborilmoqda…', '#f6d58a');
      await post(data);
      setTxt(`✓ Dashboard yangilandi · ${new Date().toTimeString().slice(0, 5)} (har ${EVERY_MIN} daq.)`, '#9fe0b8');
    } catch (e) {
      if (/401/.test(e.message)) { localStorage.removeItem('akk_token'); askTok('Token noto‘g‘ri. Qaytadan kiriting:'); }
      else setTxt('Xato: ' + e.message.slice(0, 70) + ' — bosib qayta urining', '#f3b0a8');
    } finally { busy = false; }
  }
  window.__AKK_SYNC = { run };
  run(true);
  setInterval(() => run(false), 60e3);
})();
