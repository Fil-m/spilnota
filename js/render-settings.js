// render-settings.js — рендер налаштувань: модулі, теми, шрифти, модулі спільноти

// ---- Налаштування ----
function renderSettings() {
  const cfg = getCfg();
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Налаштування</div>

      <div class="set-group">
        <div class="set-group-title">Модулі</div>
        ${MODULE_DEFS.map(m => `
          <div class="set-row">
            <div class="set-info">
              <div class="set-name">${m.icon} ${m.name}</div>
              <div class="set-desc">${m.desc}</div>
            </div>
            <label class="switch">
              <input type="checkbox" ${cfg.enabled[m.id] !== false ? 'checked' : ''} ${m.locked ? 'disabled' : ''} onchange="toggleModule('${m.id}', this.checked)">
              <span class="slider"></span>
            </label>
          </div>`).join('')}
        <div class="set-desc" style="margin-top:6px">Нові модулі з'являтимуться тут автоматично.</div>
      </div>

      <div class="set-group">
        <div class="set-group-title">Модулі спільноти (чужі версії)</div>
        ${renderCommunityModules()}
      </div>

      <div class="set-group">
        <div class="set-group-title">Шрифт</div>
        <div class="font-options">
          ${Object.entries(FONTS).map(([id, f]) => `
            <div class="font-option ${cfg.font === id ? 'sel' : ''}" onclick="setFont('${id}')" style="font-family:${f.family}">
              ${f.name}<small>Аа Бб 123</small>
            </div>`).join('')}
        </div>
      </div>

      <div class="set-group">
        <div class="set-group-title">Кольори (тема)</div>
        <div class="theme-options">
          ${Object.entries(THEMES).map(([id, t]) => `
            <div class="theme-option ${cfg.theme === id ? 'sel' : ''}" onclick="setTheme('${id}')">
              <div class="theme-swatch">
                <i style="background:${t.css['--header-bottom']}"></i>
                <i style="background:${t.css['--bg']}"></i>
                <i style="background:${t.css['--card']}"></i>
                <i style="background:${t.css['--btn-bottom']}"></i>
              </div>
              <small>${t.name}</small>
            </div>`).join('')}
        </div>
      </div>

      <div class="set-group">
        <div class="set-group-title">Акаунт</div>
        <div class="set-row">
          <div class="set-info">
            <div class="set-name">${esc(me)}</div>
            <div class="set-desc">GitHub-логін · репо ${esc(myRepoName())}</div>
          </div>
          <button class="btn gray" onclick="logout()">Вийти</button>
        </div>
      </div>
    </div>`;
}
function toggleModule(id, on) {
  const cfg = getCfg();
  cfg.enabled[id] = on;
  saveCfg(cfg);
  if (!on) {
    // якщо вимкнули поточний екран — перейти на перший доступний
    const { screen } = parseHash();
    const mod = moduleOfScreen(screen);
    if (mod && mod.id === id) go(firstEnabledScreen());
  }
  renderNav();
  renderScreen();
  toast(on ? '✅ Модуль увімкнено' : '⏻ Модуль вимкнено');
}
// ================= МОДУЛІ СПІЛЬНОТИ: налаштування =================
// Секція «Модулі спільноти»: заміни базових модулів (select) і нові кастомні (перемикач).
// Попередження показується при КОЖНОМУ переході на чужий код (навіть якщо вже вмикав раніше).
function renderCommunityModules() {
  const cfg = getCfg();
  if (!modulesCache.length) return '<div class="set-desc">Поки ніхто не опублікував свій код. Якщо учасник додасть модуль у свій репо — версія з\'явиться тут.</div>';
  const byId = {};
  for (const d of modulesCache) (byId[d.id] = byId[d.id] || []).push(d);
  const repl = Object.keys(byId).filter(id => MODULE_DEFS.some(m => m.id === id));
  const fresh = Object.keys(byId).filter(id => !MODULE_DEFS.some(m => m.id === id));
  let html = '';
  if (repl.length) {
    html += repl.map(id => {
      const base = MODULE_DEFS.find(m => m.id === id);
      const versions = byId[id];
      const cur = cfg.moduleVersions[id] || '';
      return `
      <div class="set-row">
        <div class="set-info">
          <div class="set-name">${base.icon} ${base.name} — версія</div>
          <div class="set-desc">${versions.map(v => `від <b>${esc(v.repoOwner)}</b> (v${esc(v.version || '?')}): ${esc(v.desc || v.name || '')}`).join('<br>')}</div>
        </div>
        <select class="input mod-ver-sel" onchange="pickModuleVersion('${id}', this.value)">
          <option value="" ${cur === '' ? 'selected' : ''}>Базова</option>
          ${versions.map(v => `<option value="${esc(v.repoOwner)}" ${cur === v.repoOwner ? 'selected' : ''}>${esc(v.repoOwner)} v${esc(v.version || '?')}</option>`).join('')}
        </select>
      </div>`;
    }).join('');
  }
  if (fresh.length) {
    html += fresh.map(id => {
      const v = byId[id][0];
      const on = cfg.enabled[id] === true;
      return `
      <div class="set-row">
        <div class="set-info">
          <div class="set-name">${esc(v.icon || '🧩')} ${esc(v.name || id)} <small style="color:var(--text3)">від ${esc(v.repoOwner)}</small></div>
          <div class="set-desc">${esc(v.desc || '')}</div>
        </div>
        <label class="switch">
          <input type="checkbox" ${on ? 'checked' : ''} onchange="toggleCustomModule('${id}', this.checked)">
          <span class="slider"></span>
        </label>
      </div>`;
    }).join('');
  }
  html += '<div class="set-desc" style="margin-top:6px">⚠️ Чужий код виконується у твоєму браузері і бачить твій токен. Підтвердження питається при кожному переході.</div>';
  return html;
}
// Перемикання версії базового модуля. value = login автора або '' (базова).
function pickModuleVersion(id, value) {
  const base = MODULE_DEFS.find(m => m.id === id);
  const baseName = (base || {}).name || id;
  if (value === '') {
    unloadModule(id);
    const cfg = getCfg();
    delete cfg.moduleVersions[id];
    saveCfg(cfg);
    toast('↩ ' + baseName + ': базова версія');
    renderScreen();
    renderSettings();
    return;
  }
  const decl = modulesCache.find(d => d.id === id && d.repoOwner === value);
  if (!decl) return;
  const ok = confirm('⚠️ УВАГА: ти перемикаєш «' + baseName + '» на версію від ' + value + ' (v' + (decl.version || '?') + ').\n\nКод цього модуля виконуватиметься у ТВОЄМУ браузері і матиме доступ до твого токена GitHub. Вмикай, тільки якщо довіряєш автору.\n\nПродовжити?');
  if (!ok) { renderSettings(); return; }
  loadModuleCode(decl).then(loaded => {
    if (!loaded) { renderSettings(); return; }
    const cfg = getCfg();
    cfg.moduleVersions[id] = value;
    saveCfg(cfg);
    toast('✅ ' + baseName + ': ' + value + ' v' + (decl.version || '?'));
    renderScreen();
    renderSettings();
  });
}
// Увімкнення/вимкнення НОВОГО кастомного модуля (не заміна базового)
function toggleCustomModule(id, checked) {
  const decl = modulesCache.find(d => d.id === id);
  if (checked) {
    if (!decl) return;
    const ok = confirm('⚠️ УВАГА: ти вмикаєш модуль «' + (decl.name || id) + '» від ' + decl.repoOwner + '.\n\nКод цього модуля виконуватиметься у ТВОЄМУ браузері і матиме доступ до твого токена GitHub. Вмикай, тільки якщо довіряєш автору.\n\nПродовжити?');
    if (!ok) { renderSettings(); return; }
    loadModuleCode(decl).then(loaded => {
      if (!loaded) { renderSettings(); return; }
      const cfg = getCfg();
      cfg.enabled[id] = true;
      saveCfg(cfg);
      toast('✅ Модуль «' + (decl.name || id) + '» увімкнено');
      renderScreen();
      renderSettings();
    });
  } else {
    unloadModule(id);
    const cfg = getCfg();
    cfg.enabled[id] = false;
    saveCfg(cfg);
    toast('⏻ Модуль вимкнено');
    renderScreen();
    renderSettings();
  }
}
function setFont(id) {
  const cfg = getCfg();
  cfg.font = id;
  saveCfg(cfg);
  applyFont(id);
  renderSettings();
}
function setTheme(id) {
  const cfg = getCfg();
  cfg.theme = id;
  saveCfg(cfg);
  applyTheme(id);
  renderSettings();
}

// ---- Гейт ----
function renderAuthGate() {
  CONTENT().innerHTML = `<div class="card"><div class="empty">Будь ласка, увійдіть до Спільноти.</div></div>`;
}
