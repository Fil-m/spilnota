// render-pages.js — рендер «Сторінки»: навігатор з категоріями

// ================= СТОРІНКИ (навігатор) =================
// Категорії та прикріплення зберігаються у data/pages.json (репо юзера)
function pagesWithSite() {
  return (projectsCache || []).filter(p => p.page && !hiddenProjects().includes(p.name));
}
async function loadPageIndex() {
  try {
    const d = await readMyFile('data/pages.json', null);
    if (d && Array.isArray(d.categories)) pageIndex = d;
    else pageIndex = { categories: [] };
  } catch (e) { pageIndex = { categories: [] }; }
  return pageIndex;
}
async function savePageIndex(okMsg) {
  const ok = await writeMyFile('data/pages.json', pageIndex);
  if (ok && okMsg) toast(okMsg);
  else if (!ok) toast('❌ Не вдалося зберегти категорії');
  return ok;
}
function catById(id) { return pageIndex.categories.find(c => c.id === id); }
async function addPageCategory() {
  const inp = $('pg-new-cat');
  const name = inp.value.trim();
  if (!name) { toast('✏ Вкажіть назву категорії'); return; }
  pageIndex.categories.push({ id: uid(), name: name, pages: [] });
  const ok = await savePageIndex('✅ Категорію створено');
  if (ok) { inp.value = ''; renderPages(); }
}
function renamePageCategory(id) {
  const head = $('pg-cat-name-' + id);
  const cat = catById(id);
  if (!cat || !head) return;
  const input = document.createElement('input');
  input.className = 'input';
  input.maxLength = 30;
  input.value = cat.name;
  head.replaceWith(input);
  input.focus();
  input.select();
  const commit = async () => {
    const v = input.value.trim();
    if (v) {
      cat.name = v;
      await savePageIndex();
    }
    renderPages();
  };
  input.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') renderPages(); };
  input.onblur = commit;
}
async function deletePageCategory(id) {
  if (!confirm('Видалити категорію? Сторінки залишаться без категорії.')) return;
  pageIndex.categories = pageIndex.categories.filter(c => c.id !== id);
  await savePageIndex('🗑 Категорію видалено');
  renderPages();
}
async function togglePageCat(pageName, catId) {
  const cat = catById(catId);
  if (!cat) return;
  const i = cat.pages.indexOf(pageName);
  if (i >= 0) cat.pages.splice(i, 1); else cat.pages.push(pageName);
  await savePageIndex();
  renderPages();
}
function togglePagesSortMode() {
  pagesSortMode = !pagesSortMode;
  renderPages();
  toast(pagesSortMode ? '↕ Режим упорядкування: стрілками міняйте категорії та сторінки' : '↕ Режим упорядкування вимкнено');
}
function movePageCategory(id, dir) {
  const cats = pageIndex.categories;
  const i = cats.findIndex(c => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  savePageIndex().then(() => renderPages());
}
function movePageInCat(catId, pageName, dir) {
  const cat = catById(catId);
  if (!cat) return;
  const i = cat.pages.indexOf(pageName);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cat.pages.length) return;
  [cat.pages[i], cat.pages[j]] = [cat.pages[j], cat.pages[i]];
  savePageIndex().then(() => renderPages());
}
function togglePageCatMenu(pageName) {
  const el = $('pg-menu-' + pageName);
  if (el) el.classList.toggle('hidden');
}
function pageCardSmall(p, catId, isSortMode) {
  const arrows = isSortMode ? `
    <div class="proj-arrows">
      <button class="proj-arrow" title="Вище" onclick="movePageInCat('${catId}','${esc(p.name)}',-1)">▲</button>
      <button class="proj-arrow" title="Нижче" onclick="movePageInCat('${catId}','${esc(p.name)}',1)">▼</button>
    </div>` : '';
  const cats = pageIndex.categories.map(c => `
    <label class="pg-cat-check">
      <input type="checkbox" ${c.pages.includes(p.name) ? 'checked' : ''} onchange="togglePageCat('${esc(p.name)}','${c.id}')">
      ${esc(c.name)}
    </label>`).join('');
  return `
  <div class="proj pg-card">
    <div class="proj-icon">🌐</div>
    <div class="proj-body">
      <div class="proj-name"><a href="${esc(p.page)}" target="_blank">${esc(p.name)} ↗</a></div>
      <div class="proj-desc">${p.desc ? esc(p.desc) : '<span class="proj-nodesc">Без опису</span>'}</div>
      <div class="proj-meta">${p.lang ? `<span class="proj-lang"><i style="background:${langColor(p.lang)}"></i>${esc(p.lang)}</span>` : ''}<span>🕓 ${fmtProjTime(p.updated)}</span></div>
      <div class="pg-cat-menu hidden" id="pg-menu-${esc(p.name)}">${cats || '<div class="set-desc" style="color:var(--text3)">Категорій ще немає — створіть зверху.</div>'}</div>
    </div>
    ${arrows}
    <button class="proj-eye" title="Категорії" onclick="togglePageCatMenu('${esc(p.name)}')">🗂</button>
  </div>`;
}
function pageCatBlock(cat, isSortMode) {
  const pageMap = {};
  for (const p of pagesWithSite()) pageMap[p.name] = p;
  const items = cat.pages.filter(n => pageMap[n]).map(n => pageMap[n]);
  const arrows = isSortMode ? `
    <span class="pg-cat-arrows">
      <button class="proj-arrow" title="Вище" onclick="movePageCategory('${cat.id}',-1)">▲</button>
      <button class="proj-arrow" title="Нижче" onclick="movePageCategory('${cat.id}',1)">▼</button>
    </span>` : '';
  return `
  <div class="pg-cat">
    <div class="pg-cat-head">
      <span class="pg-cat-name" id="pg-cat-name-${cat.id}">${esc(cat.name)}</span>
      <span class="pg-cat-count">(${items.length})</span>
      ${arrows}
      <span class="pg-cat-actions">
        <button class="btn gray pg-mini" onclick="renamePageCategory('${cat.id}')" title="Перейменувати">✎</button>
        <button class="btn gray pg-mini" onclick="deletePageCategory('${cat.id}')" title="Видалити">🗑</button>
      </span>
    </div>
    ${items.length ? items.map(p => pageCardSmall(p, cat.id, isSortMode)).join('') : '<div class="pg-empty">Порожньо — натисніть 🗂 на сторінці, щоб прикріпити.</div>'}
  </div>`;
}
async function refreshPages() {
  await fetchProjects(true);
  renderPages();
  toast('⟳ Сторінки оновлено');
}
function renderPages() {
  const all = pagesWithSite();
  if (!projectsCache) {
    CONTENT().innerHTML = `<div class="card"><div class="card-title">Сторінки</div><div class="empty">Завантаження сторінок з GitHub...</div></div>`;
    loadPageIndex().then(() => {
      fetchProjects().then(() => { if (parseHash().screen === 'pages') renderPages(); });
    });
    return;
  }
  const isSortMode = pagesSortMode;
  const linked = new Set();
  for (const c of pageIndex.categories) for (const n of c.pages) linked.add(n);
  const unlinked = all.filter(p => !linked.has(p.name));
  const catHtml = pageIndex.categories.map(c => pageCatBlock(c, isSortMode)).join('');
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Сторінки (${all.length})</div>
      <div class="pg-create">
        <input class="input pg-new-cat" id="pg-new-cat" placeholder="Нова категорія..." maxlength="30" onkeydown="if(event.key==='Enter')addPageCategory()">
        <button class="btn" onclick="addPageCategory()">+ Категорія</button>
      </div>
      <div class="pg-tools">
        <button class="btn ${isSortMode ? '' : 'gray'}" onclick="togglePagesSortMode()">${isSortMode ? '✓ Готово' : '↕ Порядок'}</button>
        <button class="btn gray" onclick="refreshPages()">⟳ Оновити</button>
      </div>
      ${isSortMode ? '<div class="proj-sort-hint">▲▼ міняйте місцями категорії (у заголовку) та сторінки. Порядок збережеться.</div>' : ''}
      ${catHtml}
    </div>
    ${unlinked.length ? `
    <div class="card">
      <div class="card-title">Без категорії (${unlinked.length})</div>
      ${unlinked.map(p => pageCardSmall(p, '', false)).join('')}
      <div class="set-desc" style="font-size:11px;color:var(--text3);margin-top:6px">Натисніть 🗂, щоб прикріпити сторінку до категорії.</div>
    </div>` : ''}`;
}
