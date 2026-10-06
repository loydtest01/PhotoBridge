/**
 * aukce.js — aukce v Obchodě (aukce.sql)
 *  • formulář Nová nabídka: typ „🔨 Aukce" (vyvolávací cena, min. příhoz, délka, rezerva, Kup hned)
 *  • seznam a mřížka: pruh s aktuální cenou, odpočtem a počtem příhozů
 *  • detail: přihazování (i automaticky do maxima), Kup hned, sledování s připomínkou, historie příhozů,
 *    po konci stav pro vítěze / prodejce, „Vítěz nereaguje" (po 48 h)
 * Barvy přes CSS proměnné (kvůli budoucímu světlému vzhledu).
 */
(function () {
  if (window.PTAukce) return;
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const kc = n => Math.round(Number(n) || 0).toLocaleString('cs-CZ') + ' Kč';
  const tok = () => (typeof token !== 'undefined' && token) || localStorage.getItem('sb_token') || '';
  const uid = () => (typeof userId !== 'undefined' && userId) || '';
  async function rpc(fn, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + (tok() || SUPABASE_ANON), 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (_) {}
    if (!r.ok) throw new Error((d && (d.message || d.hint)) || 'HTTP ' + r.status);
    return d;
  }
  function presne(konec) {
    return new Date(konec).toLocaleString('cs', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function zbyva(konec) {
    const ms = new Date(konec) - Date.now();
    if (ms <= 0) return 'skončila';
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    // víc než den: „2 dny 5 h"; posledních 24 h: živý odpočet h:mm:ss; posledních 5 min: m:ss
    if (d) return `${d} ${d === 1 ? 'den' : d < 5 ? 'dny' : 'dní'} ${h} h`;
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── CSS ──
  const st = document.createElement('style');
  st.textContent = `
    .auk-pruh{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12px;padding:4px 10px;border-radius:20px;
      background:color-mix(in srgb, var(--yellow,#f5c842) 12%, transparent);border:1px solid color-mix(in srgb, var(--yellow,#f5c842) 40%, transparent);color:var(--yellow,#f5c842)}
    .auk-pruh b{color:var(--text,#f0ece4)} .auk-pruh.konci{color:var(--red,#f87171);border-color:currentColor}
    .auk-box{margin:12px 0;padding:14px;border-radius:14px;background:var(--card,rgba(255,255,255,.03));border:1px solid color-mix(in srgb, var(--yellow,#f5c842) 35%, transparent)}
    .auk-box h4{margin:0 0 8px;font-size:15px;color:var(--yellow,#f5c842)}
    .auk-cena{font-size:26px;font-weight:800;color:var(--text,#f0ece4)} .auk-sub{font-size:12px;color:var(--text3,#9b95a6)}
    .auk-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
    .auk-inp{padding:9px 10px;border-radius:9px;border:1px solid var(--border,rgba(255,255,255,.15));background:var(--bg,#0f0c16);color:var(--text,#fff);width:130px;font-family:inherit}
    .auk-btn{padding:9px 14px;border-radius:9px;border:none;background:var(--yellow,#f5c842);color:#1a1410;font-weight:800;cursor:pointer;font-family:inherit}
    .auk-btn.obrys{background:transparent;color:var(--yellow,#f5c842);border:1px solid currentColor}
    .auk-hist{margin-top:10px;max-height:180px;overflow:auto;font-size:12px}
    .auk-hist div{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border,rgba(255,255,255,.06));color:var(--text2,#cbc6d4)}
    .auk-stav{margin-top:8px;font-size:13px}
    #addAukceRow .fs-label{margin-top:8px}`;
  document.head.appendChild(st);

  // ── Formulář: typ Aukce ──
  let aukceZvolena = false;
  function pripravFormular() {
    const both = document.getElementById('addTypeBoth');
    if (!both || document.getElementById('addTypeAukce')) return;
    const b = document.createElement('button');
    b.className = 'tv-btn'; b.id = 'addTypeAukce'; b.textContent = '🔨 Aukce';
    b.onclick = () => zvolAukci(true);
    both.insertAdjacentElement('afterend', b);
    const row = document.createElement('div');
    row.id = 'addAukceRow'; row.style.cssText = 'display:none;margin-top:10px';
    row.innerHTML = `
      <div class="fs-label">Délka aukce</div>
      <select id="aukDni" class="panel-inp" style="width:180px"><option value="1">1 den</option><option value="3">3 dny</option><option value="5">5 dní</option><option value="7" selected>7 dní</option><option value="14">14 dní</option><option value="30">30 dní</option></select>
      <div class="fs-label">Minimální příhoz (Kč)</div>
      <input id="aukMin" class="panel-inp" type="number" min="1" value="10" style="width:180px">
      <div class="fs-label">Minimální cena — rezerva (nepovinné, kupující ji nevidí; pod ní se neprodá)</div>
      <input id="aukRez" class="panel-inp" type="number" min="1" placeholder="např. 400" style="width:180px">
      <div class="fs-label">Kup hned (nepovinné — kdo ji zaplatí, aukci hned vyhraje)</div>
      <input id="aukKup" class="panel-inp" type="number" min="1" placeholder="např. 900" style="width:180px">
      <div style="font-size:11px;opacity:.65;margin-top:8px">Cena výše = <b>vyvolávací cena</b>. Po konci vás systém spojí ve chatu. Vítěz má 48 h na odpověď.</div>`;
    const priceRow = document.getElementById('addPriceRow');
    if (priceRow) priceRow.insertAdjacentElement('afterend', row);
    ['addTypeSell', 'addTypeTrade', 'addTypeBoth'].forEach(id => document.getElementById(id)?.addEventListener('click', () => zvolAukci(false)));
  }
  function zvolAukci(on) {
    aukceZvolena = on;
    if (on && typeof window.setAddType === 'function') window.setAddType('sell');
    ['addTypeSell', 'addTypeTrade', 'addTypeBoth'].forEach(id => { if (on) document.getElementById(id)?.classList.remove('act'); });
    document.getElementById('addTypeAukce')?.classList.toggle('act', on);
    const r = document.getElementById('addAukceRow'); if (r) r.style.display = on ? '' : 'none';
    const lbl = document.querySelector('#addPriceRow .fs-label'); if (lbl) lbl.textContent = on ? 'Vyvolávací cena (Kč)' : 'Cena (Kč)';
  }
  // Po uložení nabídky z ní udělat aukci (konec počítá server)
  const _sbReq = window.sbReq;
  if (typeof _sbReq === 'function') {
    window.sbReq = async function (path, method, body, t) {
      const res = await _sbReq.apply(this, arguments);
      try {
        if (aukceZvolena && method === 'POST' && /^rest\/v1\/listings(\?|$)/.test(path) && Array.isArray(res) && res[0] && res[0].id && body && body.listing_type !== 'bulk') {
          const start = Number(body.price_czk) || 0;
          const d = await rpc('aukce_zalozit', { p_listing: res[0].id, p_dni: +document.getElementById('aukDni').value || 7, p_start: start,
            p_min_prihoz: +document.getElementById('aukMin').value || 10,
            p_rezerva: +document.getElementById('aukRez').value || null, p_kup_hned: +document.getElementById('aukKup').value || null });
          if (!d || !d.ok) (window.showMktToast || alert)('⚠️ Nabídka uložena, ale aukci se nepodařilo spustit: ' + ((d && d.chyba) || ''));
          zvolAukci(false);
        }
      } catch (e) { (window.showMktToast || alert)('⚠️ Aukci se nepodařilo spustit: ' + e.message); }
      return res;
    };
  }

  // ── Seznam a mřížka ──
  function pruh(l) {
    if (!l.je_aukce) return '';
    const bezi = l.aukce_stav === 'bezi' && new Date(l.aukce_konec) > Date.now();
    const konci = bezi && new Date(l.aukce_konec) - Date.now() < 3e5;   // posledních 5 minut červeně
    return `<div class="auk-pruh${konci ? ' konci' : ''}" data-auk-konec="${esc(l.aukce_konec)}">🔨 Aukce ·
      ${bezi ? `<b>${kc(l.aukce_aktualni)}</b> · končí za <span class="auk-odp">${zbyva(l.aukce_konec)}</span> (${presne(l.aukce_konec)}) · ${l.aukce_prihozu || 0} příhozů`
             : l.aukce_stav === 'skoncila' ? `vyhrál <b>${esc(l.aukce_vitez_jmeno || '')}</b> za ${kc(l.aukce_aktualni)}` : 'skončila bez vítěze'}</div>`;
  }
  const _single = window._renderSingleListing;
  if (typeof _single === 'function') {
    window._renderSingleListing = function (l) {
      let h = _single.apply(this, arguments);
      if (l && l.je_aukce) h = h.replace(/(<div class="listing-title">[\s\S]*?<\/div>)/, '$1' + pruh(l));
      return h;
    };
  }
  setInterval(() => {
    document.querySelectorAll('[data-auk-konec] .auk-odp').forEach(e => { const k = e.parentElement.getAttribute('data-auk-konec');
      e.textContent = zbyva(k); e.parentElement.classList.toggle('konci', new Date(k) - Date.now() < 3e5); });
    const d = document.getElementById('aukOdpocet'); if (d) d.textContent = zbyva(d.getAttribute('data-konec'));
  }, 1000);

  // ── Detail ──
  async function vykresliDetail(l) {
    document.getElementById('aukBox')?.remove();
    const akce = document.querySelector('#detailView .detail-actions');
    ['dBtnBuy', 'dBtnOffer', 'dBtnTrade'].forEach(id => { const b = document.getElementById(id); if (b && l.je_aukce) b.style.display = 'none'; });
    if (!l.je_aukce) return;
    const box = document.createElement('div'); box.id = 'aukBox'; box.className = 'auk-box';
    (akce || document.getElementById('dTags'))?.insertAdjacentElement('beforebegin', box);
    const muj = l.user_id === uid(), bezi = l.aukce_stav === 'bezi' && new Date(l.aukce_konec) > Date.now();
    const min = (l.aukce_prihozu || 0) ? Number(l.aukce_aktualni) + Number(l.aukce_min_prihoz) : Number(l.aukce_start);
    let hist = [];
    try { hist = await rpc('aukce_historie', { p_listing: l.id }) || []; } catch (_) {}
    const vedu = hist.length && hist[0].ja;
    let html = `<h4>🔨 Aukce</h4>
      <div class="auk-cena">${kc(l.aukce_aktualni)}</div>
      <div class="auk-sub">${l.aukce_prihozu || 0} příhozů · min. příhoz ${kc(l.aukce_min_prihoz)}${l.aukce_rezerva ? (Number(l.aukce_aktualni) >= Number(l.aukce_rezerva) ? ' · ✓ minimální cena dosažena' : ' · minimální cena zatím nedosažena') : ''}</div>`;
    if (bezi) {
      html += `<div class="auk-sub" style="margin-top:4px">Končí za <b id="aukOdpocet" data-konec="${esc(l.aukce_konec)}" style="color:var(--text,#f0ece4)">${zbyva(l.aukce_konec)}</b>
               (${esc(new Date(l.aukce_konec).toLocaleString('cs'))})</div>`;
      if (vedu) html += `<div class="auk-stav" style="color:var(--green,#4ade80)">✓ Vedeš!</div>`;
      if (!muj) {
        html += `<div class="auk-row"><input id="aukCastka" class="auk-inp" type="number" min="${min}" value="${min}">
                 <button class="auk-btn" onclick="PTAukce.prihodit('${esc(l.id)}')">Přihodit</button>
                 ${l.aukce_kup_hned ? `<button class="auk-btn obrys" onclick="PTAukce.kupHned('${esc(l.id)}', ${Number(l.aukce_kup_hned)})">Kup hned ${kc(l.aukce_kup_hned)}</button>` : ''}</div>
                 <label class="auk-sub" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="aukAutoChk"> Přihazovat automaticky až do
                   <input id="aukMax" class="auk-inp" type="number" min="${min}" placeholder="max. Kč" style="width:110px"></label>
                 <div class="auk-row"><button class="auk-btn obrys" onclick="PTAukce.sledovat('${esc(l.id)}')">⭐ Sledovat</button>
                   <span class="auk-sub">připomenout</span><select id="aukPred" class="auk-inp" style="width:120px"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="60">1 h</option><option value="180">3 h</option><option value="1440">1 den</option></select><span class="auk-sub">před koncem</span></div>
                 <div id="aukZprava" class="auk-stav"></div>`;
      }
    } else if (l.aukce_stav === 'skoncila') {
      html += `<div class="auk-stav">🏆 Vyhrál <b>${esc(l.aukce_vitez_jmeno || '')}</b> za ${kc(l.aukce_aktualni)}.</div>`;
      if (l.aukce_vitez === uid()) html += `<div class="auk-stav" style="color:var(--green,#4ade80)">To jsi ty! Prodejce ti napsal do chatu — ozvi se do 48 hodin.</div>`;
      if (muj) {
        const lze = new Date(l.aukce_vitez_od).getTime() + 48 * 36e5;
        html += `<div class="auk-row"><button class="auk-btn obrys" onclick="PTAukce.nereaguje('${esc(l.id)}')" ${Date.now() < lze ? 'disabled title="Vítěz má 48 h na odpověď"' : ''}>⛔ Vítěz nereaguje → nabídnout dalšímu</button>
                 <span class="auk-sub">${Date.now() < lze ? 'možné od ' + esc(new Date(lze).toLocaleString('cs')) : ''}</span></div>
                 <div class="auk-sub">Nereagující vítěz dostane 1★ hodnocení a dočasný zákaz obchodu. Používej jen když opravdu neodpovídá.</div><div id="aukZprava" class="auk-stav"></div>`;
      }
    } else {
      html += `<div class="auk-stav">Aukce skončila bez vítěze.</div>`;
      if (muj) html += `<div class="auk-sub" style="margin-top:8px">Vystav ji znovu — klidně s jinou cenou:</div>
        <div class="auk-row"><span class="auk-sub">vyvolávací</span><input id="aukZnStart" class="auk-inp" type="number" min="1" value="${Number(l.aukce_start) || ''}">
          <span class="auk-sub">min. příhoz</span><input id="aukZnMin" class="auk-inp" type="number" min="1" value="${Number(l.aukce_min_prihoz) || 10}" style="width:90px"></div>
        <div class="auk-row"><span class="auk-sub">rezerva</span><input id="aukZnRez" class="auk-inp" type="number" min="1" placeholder="nepovinné" value="${l.aukce_rezerva ? Number(l.aukce_rezerva) : ''}">
          <span class="auk-sub">Kup hned</span><input id="aukZnKup" class="auk-inp" type="number" min="1" placeholder="nepovinné" value="${l.aukce_kup_hned ? Number(l.aukce_kup_hned) : ''}"></div>
        <div class="auk-row"><select id="aukZnDni" class="auk-inp"><option value="3">3 dny</option><option value="7" selected>7 dní</option><option value="14">14 dní</option><option value="30">30 dní</option></select>
          <button class="auk-btn" onclick="PTAukce.znovu('${esc(l.id)}')">🔁 Vystavit znovu</button></div><div id="aukZprava" class="auk-stav"></div>`;
    }
    if (hist.length) html += `<div class="auk-hist">${hist.map(h => `<div><span>${esc(h.jmeno)}${h.ja ? ' (ty)' : ''}${h.auto ? ' · auto' : ''}</span><span>${kc(h.castka)} · ${esc(new Date(h.cas).toLocaleString('cs'))}</span></div>`).join('')}</div>`;
    box.innerHTML = html;
  }
  const _open = window.openDetail;
  if (typeof _open === 'function') {
    window.openDetail = async function (id) {
      const r = await _open.apply(this, arguments);
      try { const l = (typeof currentListing !== 'undefined' && currentListing) || null; if (l) vykresliDetail(l); } catch (_) {}
      return r;
    };
  }
  async function obnov(id) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}&select=*`, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + (tok() || SUPABASE_ANON) } });
      const d = await r.json(); if (d && d[0]) { if (typeof currentListing !== 'undefined') try { Object.assign(currentListing, d[0]); } catch (_) {} vykresliDetail(d[0]); }
    } catch (_) {}
  }
  const zprava = (t, ok) => { const z = document.getElementById('aukZprava'); if (z) { z.textContent = t; z.style.color = ok ? 'var(--green,#4ade80)' : 'var(--red,#f87171)'; } };

  window.PTAukce = {
    async prihodit(id) {
      if (!tok()) return zprava('🔒 Pro přihazování se přihlas.');
      const c = +document.getElementById('aukCastka').value;
      const max = document.getElementById('aukAutoChk')?.checked ? (+document.getElementById('aukMax').value || null) : null;
      if (max && max < c) return zprava('Maximum musí být aspoň tolik, kolik přihazuješ.');
      try {
        const d = await rpc('prihodit', { p_listing: id, p_castka: c, p_max: max });
        if (!d.ok) return zprava(d.chyba || 'Nepodařilo se.');
        zprava(d.kup_hned ? '🏆 Koupeno! Prodejce ti napíše do chatu.' : d.vedes ? `✓ Vedeš — aktuální cena ${kc(d.cena)}` : `Někdo má vyšší maximum — cena je teď ${kc(d.cena)}. Přihoď víc.`, d.vedes || d.kup_hned);
        obnov(id);
      } catch (e) { zprava('❌ ' + e.message); }
    },
    async kupHned(id, cena) {
      if (!confirm(`Koupit hned za ${kc(cena)}? Aukce tím skončí.`)) return;
      document.getElementById('aukCastka').value = cena; this.prihodit(id);
    },
    async sledovat(id) {
      if (!tok()) return zprava('🔒 Přihlas se.');
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/aukce_sledovani`, { method: 'POST',
          headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + tok(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ listing_id: id, user_id: uid(), pred_koncem: +document.getElementById('aukPred').value || 30, upozorneno: false }) });
        zprava(r.ok ? '⭐ Sleduješ — připomeneme ti konec aukce.' : 'Sledování se nepodařilo.', r.ok);
      } catch (e) { zprava('❌ ' + e.message); }
    },
    async znovu(id) {
      const v = n => +document.getElementById(n).value || null;
      try {
        const d = await rpc('aukce_znovu', { p_listing: id, p_dni: v('aukZnDni') || 7, p_start: v('aukZnStart'), p_min_prihoz: v('aukZnMin') || 10, p_rezerva: v('aukZnRez'), p_kup_hned: v('aukZnKup') });
        if (!d.ok) return zprava(d.chyba || 'Nepodařilo se.');
        zprava('🔁 Aukce znovu běží.', true); obnov(id);
      } catch (e) { zprava('❌ ' + e.message); }
    },
    async nereaguje(id) {
      if (!confirm('Opravdu vítěz neodpovídá? Dostane 1★ hodnocení a dočasný zákaz obchodu a aukce přejde na dalšího v pořadí.')) return;
      try {
        const d = await rpc('aukce_vitez_nereaguje', { p_listing: id });
        if (!d.ok) return zprava(d.chyba || 'Nepodařilo se.');
        zprava(d.dalsi ? `Nabídnuto dalšímu v pořadí za ${kc(d.cena)} — dostal zprávu do chatu.` : 'Další zájemce není — nabídka je znovu volná.', true);
        obnov(id);
      } catch (e) { zprava('❌ ' + e.message); }
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pripravFormular); else pripravFormular();
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[onclick*="openAddListing"], #btnAddListing')) setTimeout(pripravFormular, 50); });
})();
