(function () {
  'use strict';
  const D = window.GL;
  const HOME = D.schools[D.home];
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The whole season falls in Eastern Standard Time (UTC-5).
  const at = (date, time) => new Date(`${date}T${time || '00:00'}:00-05:00`);
  const endOf = (ev) => at(ev.endDate || ev.date, '23:59');
  const fmt = (date, opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...opts }).format(at(date, '12:00'));
  const fmtTime = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
  };

  // Where an event takes place: { name, address, lat, lng } or null if unknown.
  function place(ev) {
    if (ev.type === 'meet') {
      if (ev.site === 'home') return { ...HOME, name: `${D.homeVenue}, ${HOME.name}`, mapName: HOME.name };
      if (ev.site === 'away') return D.schools[ev.opponent];
      return null;
    }
    return ev.venue ? (D.schools[ev.venue] || D.venues[ev.venue]) : null;
  }
  const directions = (p) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.mapName || p.name}, ${p.address}`)}`;
  function miles(p) {
    const r = Math.PI / 180, a = HOME.lat * r, b = p.lat * r;
    const h = Math.sin((b - a) / 2) ** 2 + Math.cos(a) * Math.cos(b) * Math.sin(((p.lng - HOME.lng) * r) / 2) ** 2;
    return Math.round(3959 * 2 * Math.asin(Math.sqrt(h)));
  }
  function title(ev) {
    if (ev.type !== 'meet') return ev.name;
    const o = D.schools[ev.opponent].short;
    return ev.site === 'away' ? `at ${o}` : `vs ${o}`;
  }
  const siteLabel = { home: 'Home', away: 'Away', tbc: 'Venue / time TBC' };
  const statusLabel = { projected: 'Date projected', 'entry-unconfirmed': 'GL entry not confirmed', 'if-qualified': 'If qualified' };

  const now = new Date();
  const upcoming = D.events.filter((e) => endOf(e) >= now);
  const nextEv = upcoming[0];

  // ---------- Calendar (.ics) ----------
  function icsEvent(ev) {
    const p = place(ev);
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (s) => s.replace(/-/g, '');
    const lines = ['BEGIN:VEVENT', `UID:${ev.id}@gl-fencing`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g, '')}`];
    if (ev.time) {
      const [h, m] = ev.time.split(':').map(Number);
      const endMin = h * 60 + m + 150;
      lines.push(`DTSTART;TZID=America/New_York:${ymd(ev.date)}T${pad(h)}${pad(m)}00`);
      lines.push(`DTEND;TZID=America/New_York:${ymd(ev.date)}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`);
    } else {
      const end = new Date(at(ev.endDate || ev.date, '12:00').getTime() + 864e5);
      lines.push(`DTSTART;VALUE=DATE:${ymd(ev.date)}`);
      lines.push(`DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    const text = (s) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const what = ev.type === 'meet' ? `GL Fencing ${title(ev)}` : `GL Fencing: ${ev.name}`;
    const notes = [];
    if (ev.type === 'meet' && ev.site === 'tbc') notes.push('Venue and time to be confirmed.');
    if (ev.status) notes.push(statusLabel[ev.status] + '.');
    if (ev.who) notes.push(ev.who);
    notes.push('Schedule subject to change.');
    lines.push(`SUMMARY:${text(what)}`, `DESCRIPTION:${text(notes.join(' '))}`);
    if (p) lines.push(`LOCATION:${text(`${p.name}, ${p.address}`)}`);
    lines.push('END:VEVENT');
    return lines.join('\r\n');
  }
  function downloadIcs(events, filename) {
    const tz = ['BEGIN:VTIMEZONE', 'TZID:America/New_York', 'BEGIN:STANDARD', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'END:STANDARD', 'BEGIN:DAYLIGHT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'END:DAYLIGHT', 'END:VTIMEZONE'].join('\r\n');
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GL Fencing//Schedule//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:GL Fencing', tz, ...events.map(icsEvent), 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Results ----------
  const outcome = (r) => (r && r.gl != null && r.opp != null ? (r.gl > r.opp ? 'W' : 'L') : null);
  function record(team) {
    let w = 0, l = 0;
    D.events.forEach((e) => {
      const o = e.type === 'meet' && outcome(e.result && e.result[team]);
      if (o === 'W') w++;
      if (o === 'L') l++;
    });
    return `${w}–${l}`;
  }
  function resultBadges(ev) {
    if (ev.type !== 'meet' || !ev.result) return '';
    return ['boys', 'girls'].map((t) => {
      const r = ev.result[t], o = outcome(r);
      return o ? `<span class="res ${o}">${t === 'boys' ? 'Boys' : 'Girls'} ${o} ${r.gl}–${r.opp}</span>` : '';
    }).join('');
  }

  // ---------- Hero ----------
  function renderHero() {
    $('#season-label').textContent = D.season;
    $('#snapshot').textContent = fmt(D.snapshot, { month: 'long', day: 'numeric', year: 'numeric' });
    $('#link-boys').href = D.links.boys;
    $('#link-girls').href = D.links.girls;
    $('#link-njsiaa').href = D.links.njsiaa;

    const meets = D.events.filter((e) => e.type === 'meet');
    const count = (s) => meets.filter((m) => m.site === s).length;
    $('#season-stats').innerHTML = [
      [record('boys'), 'Boys record'],
      [record('girls'), 'Girls record'],
      [meets.length, 'Dual meets'],
      [`${count('home')} / ${count('away')}`, `Home / away${count('tbc') ? ` · ${count('tbc')} TBC` : ''}`],
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');

    const el = $('#next-up');
    if (!nextEv) {
      el.innerHTML = `<div class="eyebrow">Season complete</div><div class="next-main"><div><h1>That's a wrap</h1><p class="when">Thanks for a great ${esc(D.season)} season, Highlanders.</p></div></div>`;
      return;
    }
    const p = place(nextEv);
    const logo = nextEv.type === 'meet'
      ? `<span class="logo"><img src="${D.schools[nextEv.opponent].logo}" alt=""></span>`
      : '<span class="logo trophy" aria-hidden="true">🏆</span>';
    const whenBits = [fmt(nextEv.date, { weekday: 'long', month: 'long', day: 'numeric' }), fmtTime(nextEv.time), p ? p.name : (nextEv.venueText || 'Venue to be confirmed')].filter(Boolean);
    el.innerHTML = `
      <div class="eyebrow">Next up</div>
      <div class="next-main">${logo}<div><h1>${esc(title(nextEv))}</h1><p class="when">${whenBits.map(esc).join(' · ')}</p></div></div>
      <div class="countdown" id="countdown" aria-live="off"></div>
      <div class="actions">
        ${p ? `<a class="btn light" href="${directions(p)}" target="_blank" rel="noopener">Get directions</a>` : ''}
        <button class="btn ghost" type="button" id="next-ics">Add to calendar</button>
        <a class="btn ghost" href="#ev-${nextEv.id}" id="next-details">Details</a>
      </div>`;
    $('#next-ics').onclick = () => downloadIcs([nextEv], `gl-fencing-${nextEv.id}.ics`);
    $('#next-details').onclick = (e) => { e.preventDefault(); reveal(nextEv.id); };

    const target = at(nextEv.date, nextEv.time || '00:00');
    const tick = () => {
      const ms = target - new Date();
      const cd = $('#countdown');
      if (ms <= 0) { cd.innerHTML = `<div><b>${nextEv.time ? 'Now' : 'Today'}</b><span>${nextEv.time ? 'under way' : 'meet day'}</span></div>`; return; }
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
      cd.innerHTML = `<div><b>${d}</b><span>day${d === 1 ? '' : 's'}</span></div><div><b>${h}</b><span>hr</span></div><div><b>${m}</b><span>min</span></div>`;
    };
    tick();
    setInterval(tick, 30000);
  }

  // ---------- Schedule ----------
  let filter = 'all';
  const filters = [
    ['all', 'All', () => true],
    ['home', 'Home', (e) => e.type === 'meet' && e.site === 'home'],
    ['away', 'Away', (e) => e.type === 'meet' && e.site === 'away'],
    ['tournament', 'Tournaments', (e) => e.type === 'tournament'],
  ];

  function h2hHtml(ev) {
    const opp = D.schools[ev.opponent];
    const games = D.history[ev.opponent] || [];
    if (!games.length) return `<h3>Last three seasons</h3><p>No meetings with ${esc(opp.short)} in the last three seasons. A new opponent.</p>`;
    const sum = ['boys', 'girls'].map((t) => {
      const g = games.filter((x) => x.team === t);
      if (!g.length) return `<span class="res">${t === 'boys' ? 'Boys' : 'Girls'}: no meetings</span>`;
      const w = g.filter((x) => x.result === 'W').length;
      return `<span class="res ${w > g.length - w ? 'W' : w < g.length - w ? 'L' : ''}">${t === 'boys' ? 'Boys' : 'Girls'} ${w}–${g.length - w}</span>`;
    }).join('');
    const rows = games.map((g) => `<li>
        <span class="d">${fmt(g.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span>${g.team === 'boys' ? 'Boys' : 'Girls'}</span>
        <a class="${g.result}" href="${g.url}" target="_blank" rel="noopener">${g.result} ${g.gl}–${g.opp} <em>${g.site}${g.note ? ' · ' + esc(g.note) : ''}</em></a>
      </li>`).join('');
    return `<h3>Last three seasons vs ${esc(opp.short)}</h3><div class="h2h-sum">${sum}</div><ul class="h2h">${rows}</ul>`;
  }

  function detailHtml(ev) {
    const p = place(ev);
    let left = '<h3>Where</h3>';
    if (p) {
      const away = p.lat !== HOME.lat ? `<p class="muted">About ${miles(p)} miles from GL in a straight line.</p>` : '';
      left += `<p><b>${esc(p.name)}</b><br>${esc(p.address)}</p>${away}`;
    } else if (ev.type === 'meet') {
      left += '<p>Venue and time are still to be confirmed. Check with the coaches closer to the date.</p>';
    } else {
      left += `<p>${esc(ev.venueText || 'To be announced')}</p>`;
    }
    if (ev.type === 'meet') {
      const o = D.schools[ev.opponent];
      left += `<h3>Opponent</h3><p><b>${esc(o.name)}</b><br>${esc(o.mascot)} · ${esc(o.town)}, NJ · <a href="${o.website}" target="_blank" rel="noopener">school site</a></p>`;
    } else {
      left += `<h3>Who</h3><p>${esc(ev.who)}</p>`;
    }
    left += `<div class="actions">
        ${p ? `<a class="btn" href="${directions(p)}" target="_blank" rel="noopener">Get directions</a>` : ''}
        <button class="btn ghost" type="button" data-ics="${ev.id}">Add to calendar</button>
      </div>`;

    let right;
    if (ev.type === 'meet') {
      right = h2hHtml(ev);
    } else {
      right = `<h3>About</h3><p>${esc(ev.about)}</p>`;
      if (ev.rounds) right += `<h3>Rounds</h3><ul class="rounds">${ev.rounds.map(([a, b]) => `<li><b>${esc(a)}</b>${esc(b)}</li>`).join('')}</ul>`;
      right += `<p class="muted"><a href="${ev.source}" target="_blank" rel="noopener">Source</a></p>`;
    }
    return `<div>${left}</div><div>${right}</div>`;
  }

  function rowHtml(ev) {
    const past = endOf(ev) < now;
    const isMeet = ev.type === 'meet';
    const opp = isMeet ? D.schools[ev.opponent] : null;
    const p = place(ev);
    const logo = isMeet ? `<span class="logo"><img src="${opp.logo}" alt="" loading="lazy"></span>` : '<span class="logo trophy" aria-hidden="true">🏆</span>';
    const dateEnd = ev.endDate ? `–${fmt(ev.endDate, { day: 'numeric' })}` : '';
    const sub = isMeet
      ? [opp.mascot, fmtTime(ev.time), ev.site === 'home' ? D.homeVenue : ev.site === 'away' ? opp.town : null].filter(Boolean).join(' · ')
      : [ev.who.split(' · ')[0], p ? p.name : ev.venueText].filter(Boolean).join(' · ');
    const pills = [];
    if (ev === nextEv) pills.push('<span class="pill next">Next up</span>');
    if (isMeet) pills.push(`<span class="pill ${ev.site}">${siteLabel[ev.site]}${ev.time ? ' · ' + fmtTime(ev.time) : ''}</span>`);
    else {
      pills.push('<span class="pill tournament">Tournament</span>');
      if (ev.status) pills.push(`<span class="pill note">${statusLabel[ev.status]}</span>`);
    }
    const res = resultBadges(ev);
    const accent = isMeet ? opp.color : '#b7791f';
    return `<article class="event${past ? ' past' : ''}${ev === nextEv ? ' is-next' : ''}" id="ev-${ev.id}" style="--accent:${accent}">
      <button class="row" type="button" aria-expanded="false" aria-controls="d-${ev.id}">
        <span class="date"><small>${fmt(ev.date, { weekday: 'short' })}</small><b>${fmt(ev.date, { day: 'numeric' })}${dateEnd}</b><small>${fmt(ev.date, { month: 'short' })}</small></span>
        ${logo}
        <span class="title"><b>${esc(title(ev))}</b><small>${esc(sub)}</small></span>
        <span class="meta">${pills.join('')}${res ? `<span class="results">${res}</span>` : ''}</span>
        <span class="chev" aria-hidden="true">▾</span>
      </button>
      <div class="detail" id="d-${ev.id}" hidden></div>
    </article>`;
  }

  function renderFilters() {
    $('#filters').innerHTML = filters.map(([k, label, fn]) =>
      `<button class="chip" type="button" data-filter="${k}" aria-pressed="${k === filter}">${label}<span>${D.events.filter(fn).length}</span></button>`).join('');
  }
  function renderSchedule() {
    const fn = filters.find((f) => f[0] === filter)[2];
    let html = '', month = '';
    D.events.filter(fn).forEach((ev) => {
      const m = fmt(ev.date, { month: 'long', year: 'numeric' });
      if (m !== month) { month = m; html += `<h3 class="month">${m}</h3>`; }
      html += rowHtml(ev);
    });
    $('#schedule-list').innerHTML = html;
  }
  function toggle(article, open) {
    const btn = article.querySelector('.row'), det = article.querySelector('.detail');
    const willOpen = open ?? btn.getAttribute('aria-expanded') !== 'true';
    if (willOpen && !det.innerHTML) det.innerHTML = detailHtml(D.events.find((e) => 'ev-' + e.id === article.id));
    btn.setAttribute('aria-expanded', willOpen);
    det.hidden = !willOpen;
  }
  function reveal(id) {
    if (!document.getElementById('ev-' + id)) { filter = 'all'; renderFilters(); renderSchedule(); }
    const article = document.getElementById('ev-' + id);
    toggle(article, true);
    article.scrollIntoView({ block: 'center' });
    article.classList.remove('flash');
    void article.offsetWidth;
    article.classList.add('flash');
  }

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (chip) { filter = chip.dataset.filter; renderFilters(); renderSchedule(); return; }
    const ics = e.target.closest('[data-ics]');
    if (ics) { const ev = D.events.find((x) => x.id === ics.dataset.ics); downloadIcs([ev], `gl-fencing-${ev.id}.ics`); return; }
    const show = e.target.closest('[data-reveal]');
    if (show) { reveal(show.dataset.reveal); return; }
    const row = e.target.closest('.row');
    if (row) toggle(row.parentElement);
  });
  $('#ics-all').onclick = () => downloadIcs(D.events, 'gl-fencing-2026-27.ics');

  // ---------- Map ----------
  function renderMap() {
    if (!window.L) { $('#map').innerHTML = '<p style="padding:16px">The map could not be loaded. Use the directions links in the schedule instead.</p>'; return; }
    const map = L.map('map', { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);

    // One pin per location, listing everything that happens there or involves that school.
    const pins = new Map();
    const add = (key, p, kind, ev, label) => {
      if (!pins.has(key)) pins.set(key, { p, kind, items: [], logo: p.logo });
      const pin = pins.get(key);
      if (kind === 'away' || (kind === 'tourney' && pin.kind === 'visitor' && !pin.logo)) pin.kind = kind;
      if (ev) pin.items.push({ ev, label });
    };
    add(D.home, HOME, 'home');
    D.events.forEach((ev) => {
      const when = fmt(ev.date, { month: 'short', day: 'numeric' });
      if (ev.type === 'meet') {
        const o = D.schools[ev.opponent];
        const where = ev.site === 'away' ? 'GL fences here' : ev.site === 'home' ? 'at GL' : 'venue TBC';
        add(ev.opponent, o, ev.site === 'away' ? 'away' : 'visitor', ev, `${when}: dual meet, ${where}`);
      } else if (ev.venue) {
        const p = D.schools[ev.venue] || D.venues[ev.venue];
        add(ev.venue, p, D.schools[ev.venue] ? 'visitor' : 'tourney', ev, `${when}: ${ev.name}`);
      }
    });

    const bounds = [];
    pins.forEach(({ p, kind, items, logo }, key) => {
      const size = kind === 'home' ? 58 : 44;
      const inner = logo ? `<img src="${logo}" alt="">` : '🏆';
      const icon = L.divIcon({ className: '', html: `<div class="pin ${kind}">${inner}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
      const list = items.map(({ ev, label }) => `<li><button type="button" data-reveal="${ev.id}">${esc(label)}</button></li>`).join('');
      const html = `<div class="pop"><b>${esc(p.name)}</b>${esc(p.address)}
        ${key === D.home ? `<br>Home meets are in the ${esc(D.homeVenue)}.` : `<br>About ${miles(p)} mi from GL (straight line)`}
        ${list ? `<ul>${list}</ul>` : ''}
        <div class="links"><a href="${directions(p)}" target="_blank" rel="noopener">Directions</a></div></div>`;
      L.marker([p.lat, p.lng], { icon, title: p.name, zIndexOffset: kind === 'home' ? 1000 : 0 }).addTo(map).bindPopup(html, { maxWidth: 280 });
      bounds.push([p.lat, p.lng]);
    });
    map.fitBounds(bounds, { padding: [36, 36] });
    map.on('click', () => map.scrollWheelZoom.enable());
  }

  // ---------- Past seasons ----------
  function renderSeasons() {
    $('#seasons').innerHTML = D.seasons.map((s) => {
      const team = (k, label) => {
        const [w, l] = s[k].record.split('-').map(Number);
        return `<div class="team"><div class="lab">${label}</div><div class="rec">${w}–${l}</div>
          <div class="bar" role="img" aria-label="${w} wins, ${l} losses"><i style="width:${(100 * w) / (w + l)}%"></i></div>
          <p>${esc(s[k].postseason)}</p></div>`;
      };
      return `<div class="season"><h3>${s.season.replace('-', '–')}</h3>${team('boys', 'Boys')}${team('girls', 'Girls')}</div>`;
    }).join('');
  }

  renderHero();
  renderFilters();
  renderSchedule();
  renderSeasons();
  renderMap();
  // A link such as index.html#ev-cetrulo opens that event.
  const linked = D.events.find((e) => '#ev-' + e.id === location.hash);
  if (linked) reveal(linked.id);
})();
