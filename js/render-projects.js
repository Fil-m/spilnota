// render-projects.js — рендер «Мої проекти» та сторінки користувача

// ---- Мої проекти (GitHub) ----
const PROJ_LANG_ICONS = { JavaScript: '🟨', TypeScript: '🟦', HTML: '🟧', CSS: '🎨', Python: '🐍', Java: '☕', 'C#': '🟣', 'C++': '🔷', Go: '🐹', Rust: '🦀', PHP: '🐘', Ruby: '💎', Shell: '🐚', Dart: '🎯', Swift: '🦅', Kotlin: '🟢', Vue: '💚', Svelte: '🔥', Lua: '🌙', 'Objective-C': '🔵', 'Jupyter Notebook': '📓', Dockerfile: '🐳' };
const LANG_COLORS = { JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c', Python: '#3572A5', Java: '#b07219', 'C#': '#178600', 'C++': '#f34b7d', Go: '#00ADD8', Rust: '#dea584', PHP: '#4F5D95', Ruby: '#701516', Shell: '#89e051', Dart: '#00B4AB', Swift: '#F05138', Kotlin: '#A97BFF', Vue: '#41b883', Svelte: '#ff3e00', Lua: '#000080', 'Objective-C': '#438eff', 'Jupyter Notebook': '#DA5B0B', Dockerfile: '#384d54' };
function projectLangIcon(l) { return PROJ_LANG_ICONS[l] || '📁'; }
function langColor(l) { return LANG_COLORS[l] || '#8b949e'; }
function hiddenProjects() { try { return JSON.parse(localStorage.getItem(LS_HIDDEN) || '[]'); } catch (e) { return []; } }
function saveHidden(list) { localStorage.setItem(LS_HIDDEN, JSON.stringify(list)); }
function isProjectHidden(name) { return hiddenProjects().includes(name); }
function toggleProjectHidden(name) {
  const list = hiddenProjects();
  const i = list.indexOf(name);
  if (i >= 0) list.splice(i, 1); else list.push(name);
  saveHidden(list);
  renderProjects();
  toast(i >= 0 ? '👁 Проект знову видно' : '🙈 Проект приховано');
}
async function fetchProjects(force) {
  if (projectsCache && !force) return projectsCache;
  if (projectsLoading) return null;
  projectsLoading = true;
  try {
    let repos = null;
    try {
      repos = await ghJson('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
    } catch (e) { }
    if (!repos || !Array.isArray(repos)) {
      repos = await ghJson('/users/' + encodeURIComponent(me) + '/repos?per_page=100&sort=updated');
    }
    if (Array.isArray(repos)) {
      projectsCache = repos.map(r => ({
        name: r.name,
        desc: r.description || '',
        url: r.html_url,
        page: r.homepage || (r.has_pages ? 'https://' + r.owner.login + '.github.io/' + r.name + '/' : ''),
        lang: r.language,
        stars: r.stargazers_count || 0,
        forks: r.forks_count || 0,
        updated: r.updated_at ? new Date(r.updated_at).getTime() : 0,
        fork: !!r.fork, archived: !!r.archived, priv: !!r.private
      }));
    }
  } catch (e) { }
  projectsLoading = false;
  return projectsCache;
}
// Проекти та сторінки ІНШОГО учасника — публічні репо через GitHub API (кеш 5 хв)
async function fetchUserProjects(login, force) {
  const c = userProjectsCache[login];
  if (c && !force && Date.now() - c.ts < 300000) return c.repos;
  try {
    const repos = await ghJson('/users/' + encodeURIComponent(login) + '/repos?per_page=100&sort=updated');
    if (Array.isArray(repos)) {
      userProjectsCache[login] = {
        ts: Date.now(),
        repos: repos.map(r => ({
          name: r.name,
          desc: r.description || '',
          url: r.html_url,
          page: r.homepage || (r.has_pages ? 'https://' + r.owner.login + '.github.io/' + r.name + '/' : ''),
          lang: r.language,
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          updated: r.updated_at ? new Date(r.updated_at).getTime() : 0,
          fork: !!r.fork, archived: !!r.archived, priv: !!r.private
        }))
      };
      return userProjectsCache[login].repos;
    }
  } catch (e) { }
  return c ? c.repos : [];
}
// Дані чужої сторінки: профіль + проекти (якщо не заборонено). Кеш 60с.
async function loadUserPage(nick, force) {
  const c = userPageCache[nick];
  if (c && !force && Date.now() - c.ts < 60000) return c;
  const profile = await profileOf(nick);
  let projects = [];
  if (profile && profile.showProjects !== false) {
    projects = await fetchUserProjects(nick, force);
  }
  userPageCache[nick] = { profile, projects, ts: Date.now() };
  return userPageCache[nick];
}
async function refreshUserProjects(nick) {
  await loadUserPage(nick, true);
  if (parseHash().screen === 'user' && parseHash().param === nick) renderUserPage(nick);
  toast('⟳ Проекти оновлено');
}
// Картка проекту на чужій сторінці (без 👁 і стрілок — це read-only)
function userProjectCard(p) {
  return `
  <div class="proj">
    <div class="proj-icon">${projectLangIcon(p.lang)}</div>
    <div class="proj-body">
      <div class="proj-name">
        <a href="${esc(p.url)}" target="_blank">${esc(p.name)}</a>
        ${p.archived ? '<span class="proj-badge arch">🗄 архів</span>' : ''}
        ${p.fork ? '<span class="proj-badge fork">⑂ форк</span>' : ''}
      </div>
      <div class="proj-desc">${p.desc ? esc(p.desc) : '<span class="proj-nodesc">Без опису</span>'}</div>
      <div class="proj-meta">
        ${p.lang ? `<span class="proj-lang"><i style="background:${langColor(p.lang)}"></i>${esc(p.lang)}</span>` : ''}
        ${p.stars ? `<span>⭐ ${p.stars}</span>` : ''}
        <span>🕓 ${fmtProjTime(p.updated)}</span>
        ${p.page ? `<a class="proj-page" href="${esc(p.page)}" target="_blank">🌐 Сторінка ↗</a>` : ''}
      </div>
    </div>
  </div>`;
}
function projFilterState() {
  const d = { q: '', lang: '', kind: 'all', sort: 'updated' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(LS_PROJ_FILTER) || '{}') }; } catch (e) { return d; }
}
function saveProjFilter(f) { localStorage.setItem(LS_PROJ_FILTER, JSON.stringify(f)); }
function projFiltered() {
  const f = projFilterState();
  const hidden = hiddenProjects();
  const order = projOrder();
  const hiddenList = (projectsCache || []).filter(p => hidden.includes(p.name));
  let list = (projectsCache || []).filter(p => !hidden.includes(p.name));
  if (f.kind === 'page') list = list.filter(p => p.page);
  if (f.kind === 'repo') list = list.filter(p => !p.page);
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || (p.lang || '').toLowerCase().includes(q));
  }
  if (f.lang) list = list.filter(p => p.lang === f.lang);
  if (f.sort === 'stars') list = [...list].sort((a, b) => b.stars - a.stars);
  else if (f.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  else list = [...list].sort((a, b) => b.updated - a.updated);
  // ручний порядок: спершу впорядковані юзером, решта — за сортуванням
  if (order.length) {
    const ordered = [];
    const rest = [];
    for (const p of list) (order.includes(p.name) ? ordered : rest).push(p);
    ordered.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    list = [...ordered, ...rest];
  }
  const langs = [...new Set((projectsCache || []).map(p => p.lang).filter(Boolean))].sort();
  return { f, list, hiddenList, langs };
}
function projOrder() { try { return JSON.parse(localStorage.getItem(LS_PROJ_ORDER) || '[]'); } catch (e) { return []; } }
function saveProjOrder(list) { localStorage.setItem(LS_PROJ_ORDER, JSON.stringify(list)); }
function toggleProjSortMode() {
  projSortMode = !projSortMode;
  renderProjects();
  toast(projSortMode ? '↕ Режим упорядкування увімкнено — міняйте місця стрілками' : '↕ Режим упорядкування вимкнено');
}
function moveProject(name, dir) {
  const visible = projFiltered().list.map(p => p.name);
  const order = projOrder();
  const full = [...new Set([...order, ...visible])];
  const i = full.indexOf(name);
  // знайти наступного/попереднього ВИДИМОГО сусіда
  let target = null;
  for (let k = i + dir; k >= 0 && k < full.length; k += dir) {
    if (visible.includes(full[k])) { target = full[k]; break; }
  }
  if (!target) return; // нема куди рухатись
  const next = full.filter(n => n !== name);
  next.splice(next.indexOf(target) + (dir > 0 ? 1 : 0), 0, name);
  saveProjOrder(next);
  renderProjects();
}
function resetProjOrder() {
  saveProjOrder([]);
  renderProjects();
  toast('↕ Порядок скинуто');
}
function fmtProjTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts), n = new Date();
  if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()) return 'сьогодні';
  if (d.getFullYear() === n.getFullYear()) return d.getDate() + ' ' + MONTHS[d.getMonth()];
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}
function projectCard(p) {
  const arrows = projSortMode ? `
    <div class="proj-arrows">
      <button class="proj-arrow" title="Вище" onclick="moveProject('${esc(p.name)}',-1)">▲</button>
      <button class="proj-arrow" title="Нижче" onclick="moveProject('${esc(p.name)}',1)">▼</button>
    </div>` : '';
  return `
  <div class="proj">
    <div class="proj-icon">${projectLangIcon(p.lang)}</div>
    <div class="proj-body">
      <div class="proj-name">
        <a href="${esc(p.url)}" target="_blank">${esc(p.name)}</a>
        ${p.priv ? '<span class="proj-badge priv">🔒 приватний</span>' : ''}
        ${p.archived ? '<span class="proj-badge arch">🗄 архів</span>' : ''}
        ${p.fork ? '<span class="proj-badge fork">⑂ форк</span>' : ''}
      </div>
      <div class="proj-desc">${p.desc ? esc(p.desc) : '<span class="proj-nodesc">Без опису</span>'}</div>
      <div class="proj-meta">
        ${p.lang ? `<span class="proj-lang"><i style="background:${langColor(p.lang)}"></i>${esc(p.lang)}</span>` : ''}
        ${p.stars ? `<span>⭐ ${p.stars}</span>` : ''}
        ${p.forks ? `<span>⑂ ${p.forks}</span>` : ''}
        <span>🕓 ${fmtProjTime(p.updated)}</span>
        ${p.page ? `<a class="proj-page" href="${esc(p.page)}" target="_blank">🌐 Сторінка ↗</a>` : ''}
      </div>
    </div>
    ${arrows}
    <button class="proj-eye" title="Приховати / показати" onclick="toggleProjectHidden('${esc(p.name)}')">👁</button>
  </div>`;
}
function updateProjList() {
  const { list, hiddenList } = projFiltered();
  const l = $('proj-list'); if (l) l.innerHTML = list.length ? list.map(projectCard).join('') : '<div class="empty">Нічого не знайдено за цими фільтрами.</div>';
  const h = $('proj-hidden'); if (h) h.innerHTML = hiddenList.map(projectCard).join('');
  const c = $('proj-count'); if (c) c.textContent = 'Мої проекти (' + list.length + ')';
  const hc = $('proj-hcount'); if (hc) hc.textContent = 'Приховані (' + hiddenList.length + ')';
}
function setProjFilter(patch) {
  saveProjFilter({ ...projFilterState(), ...patch });
  updateProjList();
}
async function refreshProjects() {
  projectsCache = null;
  renderProjects();
  await fetchProjects(true);
  if (parseHash().screen === 'projects') renderProjects();
  toast('⟳ Проекти оновлено');
}
function renderProjects() {
  const { f, list, hiddenList, langs } = projFiltered();
  if (!projectsCache) {
    CONTENT().innerHTML = `<div class="card"><div class="card-title">Мої проекти</div><div class="empty">Завантаження проектів з GitHub...</div></div>`;
    fetchProjects().then(() => { if (parseHash().screen === 'projects') renderProjects(); });
    return;
  }
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title" id="proj-count">Мої проекти (${list.length})</div>
      <div class="proj-filters">
        <input class="input proj-search" id="proj-q" placeholder="🔎 Пошук проекту..." value="${esc(f.q)}" oninput="setProjFilter({q:this.value})">
        <select class="input proj-sel" onchange="setProjFilter({lang:this.value})">
          <option value="">Всі мови</option>
          ${langs.map(l => `<option value="${esc(l)}" ${f.lang === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        <select class="input proj-sel" onchange="setProjFilter({kind:this.value})">
          <option value="all" ${f.kind === 'all' ? 'selected' : ''}>Всі проекти</option>
          <option value="page" ${f.kind === 'page' ? 'selected' : ''}>Зі сторінкою 🌐</option>
          <option value="repo" ${f.kind === 'repo' ? 'selected' : ''}>Без сторінки</option>
        </select>
        <select class="input proj-sel" onchange="setProjFilter({sort:this.value})">
          <option value="updated" ${f.sort === 'updated' ? 'selected' : ''}>Нещодавні</option>
          <option value="stars" ${f.sort === 'stars' ? 'selected' : ''}>За зірками</option>
          <option value="name" ${f.sort === 'name' ? 'selected' : ''}>За ім'ям</option>
        </select>
        <button class="btn ${projSortMode ? '' : 'gray'}" onclick="toggleProjSortMode()">${projSortMode ? '✓ Готово' : '↕ Порядок'}</button>
        ${projSortMode ? '<button class="btn gray" onclick="resetProjOrder()">Скинути</button>' : ''}
        <button class="btn gray" onclick="refreshProjects()">⟳ Оновити</button>
      </div>
      ${projSortMode ? '<div class="proj-sort-hint">▲▼ міняйте проекти місцями — порядок збережеться. Сортування в цьому режимі не діє.</div>' : ''}
      <div id="proj-list">${list.length ? list.map(projectCard).join('') : '<div class="empty">Нічого не знайдено за цими фільтрами.</div>'}</div>
    </div>
    ${hiddenList.length ? `
    <div class="card">
      <div class="card-title" id="proj-hcount">Приховані (${hiddenList.length})</div>
      <div id="proj-hidden">${hiddenList.map(projectCard).join('')}</div>
      <div class="set-desc" style="font-size:11px;color:var(--text3);margin-top:6px">Натисніть 👁 на картці, щоб повернути проект у список.</div>
    </div>` : ''}`;
}
