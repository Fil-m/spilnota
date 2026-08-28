// render-apps.js — рендер «Застосунки»: каталог + iframe-вбудова + postMessage

// ================= ЗАСТОСУНКИ (каталог = сторінки учасників + вбудова) =================
// Застосунок = задеплоєна сторінка (GitHub Pages) будь-якого учасника. Нічого додавати не треба:
// каталог збирається АВТОМАТИЧНО зі сторінок усіх учасників. Категорії — з навігатора
// «Сторінки» (data/pages.json кожного: які сторінки до яких категорій прикріплені).
// Популярність 🔥 = скільки учасників прикріпили цю сторінку до категорій.
// Вбудова — iframe всередині Спільноти; через postMessage передається ТІЛЬКИ нік (токен — ніколи).
let appsCache = [];
let appPageCats = {};   // repoName -> [catName...]
let appPageOwners = {};  // repoName -> Set(login) — хто прикріпив (для популярності)
let memberPagesCache = {}; // login -> {ts, pages}

// Сторінки учасника: свої через projectsCache, чужі через публічні репо (кеш 5 хв)
async function memberPages(login) {
  const c = memberPagesCache[login];
  if (c && Date.now() - c.ts < CONFIG.searchMs) return c.pages;
  let repos = null;
  try {
    if (login === me) {
      repos = await fetchProjects();
    } else {
      const r = await ghJson('/users/' + encodeURIComponent(login) + '/repos?per_page=100&sort=updated');
      repos = Array.isArray(r) ? r : null;
    }
  } catch (e) { repos = null; }
  const pages = (Array.isArray(repos) ? repos : [])
    .filter(p => !p.fork && (p.has_pages || (p.page && /github\.io/.test(p.page))))
    .map(p => ({
      id: 'pg-' + login + '-' + p.name,
      name: p.name,
      url: p.page || ('https://' + login + '.github.io/' + p.name + '/'),
      desc: p.desc || p.description || '',
      lang: p.lang || p.language || '',
      repo: p.name,
      repoOwner: login
    }));
  memberPagesCache[login] = { ts: Date.now(), pages };
  return pages;
}
async function refreshApps() {
  const list = await searchParticipants();
  const fresh = {};   // normUrl -> запис
  for (const p of list) {
    try {
      const pages = await memberPages(p.login);
      for (const pg of pages) {
        const norm = pg.url.replace(/\/$/, '');
        if (!fresh[norm]) fresh[norm] = { ...pg, url: norm, repoOwner: p.login };
      }
    } catch (e) { }
  }
  // merge зі старим кешем — щойно задеплоєна сторінка не зникає поки CDN не оновиться
  for (const a of appsCache) { const norm = String(a.url).replace(/\/$/, ''); if (!fresh[norm]) fresh[norm] = a; }
  appsCache = Object.values(fresh);
  appsCache.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
// Категорії — з data/pages.json учасників (їх навігатор «Сторінки»).
// appPageOwners: repoName -> Set(login) — хто прикріпив сторінку до категорій (популярність).
async function refreshAppCats() {
  const list = await searchParticipants();
  const pageCats = {};
  const pageOwners = {};
  const collect = (pd, owner) => {
    if (!pd || !Array.isArray(pd.categories)) return;
    for (const c of pd.categories) {
      if (!c || !c.name || !Array.isArray(c.pages)) continue;
      const cn = String(c.name).trim();
      if (!cn) continue;
      for (const rn of c.pages) {
        if (!rn) continue;
        const key = String(rn);
        (pageCats[key] = pageCats[key] || new Set()).add(cn);
        (pageOwners[key] = pageOwners[key] || new Set()).add(owner);
      }
    }
  };
  const myP = await readMyFile('data/pages.json', null);
  if (myP) collect(myP, me);
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const d = await readApiFile(p.login, p.repo, 'data/pages.json');
      if (d) collect(d, p.login);
    } catch (e) { }
  }
  appPageCats = {};
  for (const rn in pageCats) appPageCats[rn] = [...pageCats[rn]];
  appPageOwners = pageOwners;
}
// популярність сторінки = скільки учасників прикріпили її до категорій у «Сторінках»
function appPop(a) {
  const s = appPageOwners[a.repo];
  return s ? s.size : 1;
}
function appCatsFor(a) { return appPageCats[a.repo] || []; }
function appCard(a) {
  const pop = appPop(a) > 1 ? `<span class="pop-badge">🔥${appPop(a)}</span>` : '';
  const cats = appCatsFor(a);
  const catTag = cats.length ? `<div class="app-tags">${cats.slice(0, 2).map(c => `<span class="app-tag">${esc(c)}</span>`).join('')}${cats.length > 2 ? `<span class="app-tag">+${cats.length - 2}</span>` : ''}</div>` : '';
  return `
    <div class="person app-card" onclick="go('app/' + encodeURIComponent('${a.id}'))">
      <div class="p-avatar g-emoji">${esc(a.icon || '🧩')}</div>
      <div class="p-name">${esc(a.name)}${pop}</div>
      <div class="offline">${esc(a.desc || '')}${a.repoOwner ? '<br>➕ ' + esc(a.repoOwner) : ''}</div>
      ${catTag}
    </div>`;
}
// групування за категоріями; сторінка може бути в КІЛЬКОХ категоріях (як у «Сторінки»)
function appCats() {
  const map = {};
  for (const a of appsCache) {
    const cats = appCatsFor(a);
    if (!cats.length) { (map['Без категорії'] = map['Без категорії'] || []).push(a); }
    else for (const cn of cats) (map[cn] = map[cn] || []).push(a);
  }
  return Object.entries(map)
    .map(([name, apps]) => ({ name, apps, pop: apps.reduce((s, a) => s + appPop(a), 0) }))
    .sort((x, y) => y.pop - x.pop || y.apps.length - x.apps.length);
}
function openCat(name) {
  const d = document.querySelector(`details.app-cat[data-cat="${CSS.escape(name)}"]`);
  if (d) d.open = true;
}
function renderApps() {
  const cats = appCats();
  const topApps = [...appsCache].sort((a, b) => appPop(b) - appPop(a) || (a.name || '').localeCompare(b.name || '')).slice(0, 3);
  const topCats = [...cats].sort((a, b) => b.pop - a.pop).slice(0, 3);
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">🧩 Застосунки</div>
      <div class="set-desc">Застосунок = задеплоєна сторінка учасника. Все збирається автоматично — нічого додавати не треба. Застосунок бачить твій нік — токен не передається ніколи.</div>
    </div>
    ${appsCache.length ? `
    <div class="card">
      <div class="card-title">🔥 Популярне в спільноті</div>
      <div class="pop-row">${topApps.map(a => `<span class="pop-chip" onclick="go('app/' + encodeURIComponent('${a.id}'))">${esc(a.icon || '🧩')} ${esc(a.name)} <b>${appPop(a)}</b></span>`).join('')}</div>
      <div class="pop-row">${topCats.map(c => `<span class="pop-chip pop-cat" onclick="openCat('${esc(c.name.replace(/'/g, "\\'"))}')">📂 ${esc(c.name)} <b>${c.pop}</b></span>`).join('')}</div>
      <div class="set-desc" style="font-size:11px">🔥 = скільки учасників прикріпили сторінку до категорій у «Сторінках»</div>
    </div>
    <div class="card">
      <div class="card-title">Каталог за категоріями (${appsCache.length})</div>
      ${cats.map((c, i) => `
      <details class="app-cat" data-cat="${esc(c.name)}" ${i === 0 ? 'open' : ''}>
        <summary><span class="ac-name">📂 ${esc(c.name)}</span><span class="ac-count">${c.apps.length} · 🔥${c.pop}</span></summary>
        <div class="people-grid">${c.apps.map(appCard).join('')}</div>
      </details>`).join('')}
    </div>` : '<div class="card"><div class="empty">Сторінок поки немає. Задеплойте сайт на GitHub Pages — і він з\'явиться тут.</div></div>'}`;
}
function renderApp(id) {
  const a = appsCache.find(x => x.id === id);
  if (!a) {
    CONTENT().innerHTML = `<div class="card"><div class="card-title">Застосунок</div><div class="empty">Завантаження застосунку...</div></div>`;
    refreshApps().then(() => refreshAppCats()).then(() => renderScreen());
    return;
  }
  CONTENT().innerHTML = `
    <div class="card app-wrap">
      <div class="app-bar">
        <button class="btn gray" onclick="go('apps')">← Назад</button>
        <span class="app-title">${esc(a.icon || '🧩')} ${esc(a.name)}</span>
        <a class="btn gray" href="${esc(a.url)}" target="_blank" rel="noopener">↗ Відкрити</a>
      </div>
      <div id="app-frame-slot"></div>
    </div>`;
  // iframe створюємо через createElement і підписуємось на load ДО встановлення src —
  // інакше швидке завантаження може статись до підписки і нік не передасться
  const slot = $('app-frame-slot');
  const f = document.createElement('iframe');
  f.className = 'app-frame';
  f.id = 'app-frame';
  f.allow = 'fullscreen; autoplay; encrypted-media';
  f.setAttribute('allowfullscreen', '');
  f.referrerPolicy = 'no-referrer';
  f.addEventListener('load', () => sendAppUser(f));
  f.src = a.url;
  slot.appendChild(f);
}
// Передача ніка застосунку через postMessage. ТОКЕН НІКОЛИ НЕ ПЕРЕДАЄМО — тільки login/ім'я.
function sendAppUser(frame) {
  try {
    frame.contentWindow.postMessage({ type: 'spilnota', action: 'user', login: me, name: myProfile.name || me, emoji: myProfile.emoji || '' }, '*');
  } catch (e) { }
}
// Застосунок може сам попросити дані: шле {type:'spilnota', action:'hello'} — відповідаємо.
window.addEventListener('message', (ev) => {
  if (!me || !ev.data || ev.data.type !== 'spilnota') return;
  const f = $('app-frame');
  if (!f || ev.source !== f.contentWindow) return;
  if (ev.data.action === 'hello') sendAppUser(f);
});
