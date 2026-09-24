// ==UserScript==
// @name         Akkreditatsiya → Dashboard (live sinxron)
// @namespace    akkreditatsiya-dashboard
// @version      1.0
// @description  accreditation.nqaae.uz dagi hisobot holatini (izoh, hujjatlar, qo'shimcha fayllar) yig'ib, Render'dagi dashboardga yuboradi.
// @match        https://accreditation.nqaae.uz/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  const DASH_URL = '__DASH_URL__';           // server o'zi to'ldiradi
  const EVERY_MIN = 10;                      // necha daqiqada bir yuborish
  const SERIAL_DEFAULT = 'KAO260075';

  // Faqat tizimga kirilgan sahifalarda ishlaydi
  if (/\/auth\//.test(location.pathname)) return;

  const serial = (location.pathname.match(/\/(KAO\d+)/) || [])[1] || GM_getValue('serial', SERIAL_DEFAULT);
  GM_setValue('serial', serial);

  // ---------- UI ----------
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;background:#0E6E75;color:#fff;font:600 13px system-ui,sans-serif;padding:9px 14px;border-radius:99px;box-shadow:0 4px 16px rgba(0,0,0,.2);cursor:pointer;display:flex;gap:8px;align-items:center';
  box.title = 'Bosing — hozir sinxronlash. Shift+bosish — tokenni o‘zgartirish';
  box.innerHTML = '<span id="akkDot" style="width:8px;height:8px;border-radius:50%;background:#9fe0b8"></span><span id="akkTxt">Dashboard</span>';
  document.body.appendChild(box);
  const setTxt = (t, col) => { box.querySelector('#akkTxt').textContent = t; if (col) box.querySelector('#akkDot').style.background = col; };

  function token(ask) {
    let t = GM_getValue('token', '');
    if (!t || ask) {
      t = prompt('Dashboard PUSH_TOKEN ni kiriting (Render → Environment dagi qiymat):', t || '') || '';
      GM_setValue('token', t.trim());
    }
    return GM_getValue('token', '');
  }

  function post(data) {
    return new Promise((res, rej) => GM_xmlhttpRequest({
      method: 'POST', url: DASH_URL.replace(/\/$/, '') + '/api/push',
      headers: { 'content-type': 'application/json', 'x-token': token() },
      data: JSON.stringify(data), timeout: 60000,
      onload: r => r.status === 200 ? res(r) : rej(new Error('HTTP ' + r.status + ' ' + r.responseText)),
      onerror: () => rej(new Error('tarmoq xatosi')), ontimeout: () => rej(new Error('vaqt tugadi')),
    }));
  }

  // ---------- yig'uvchi ----------
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

  // ---------- ishga tushirish ----------
  let busy = false;
  async function run(manual) {
    if (busy) return;
    // bir nechta tab ochiq bo'lsa, faqat bittasi yuborsin
    const last = +GM_getValue('lastRun', 0);
    if (!manual && Date.now() - last < (EVERY_MIN - 1) * 60e3) return;
    if (!token()) { setTxt('Token kiritilmagan', '#f3b0a8'); return; }
    busy = true; GM_setValue('lastRun', Date.now());
    try {
      setTxt('Yig‘ilmoqda…', '#f6d58a');
      const data = await collect((d, t) => setTxt(`Yig‘ilmoqda ${d}/${t}`, '#f6d58a'));
      setTxt('Yuborilmoqda…', '#f6d58a');
      await post(data);
      const hh = new Date().toTimeString().slice(0, 5);
      GM_setValue('lastOk', hh);
      setTxt(`Dashboard yangilandi · ${hh}`, '#9fe0b8');
    } catch (e) {
      console.error('[AKK]', e);
      setTxt('Xato: ' + e.message.slice(0, 60), '#f3b0a8');
      if (/401/.test(e.message)) GM_setValue('token', '');
    } finally { busy = false; }
  }

  box.addEventListener('click', ev => { if (ev.shiftKey) token(true); run(true); });
  const ok = GM_getValue('lastOk', ''); if (ok) setTxt('Dashboard · oxirgi: ' + ok);
  setTimeout(() => run(false), 5000);
  setInterval(() => run(false), 60e3);
})();
