/* ============================================================
   Спільнота — суспільна мережа в стилі класичних соцмереж
   Децентралізована: у кожного СВІЙ репо spilnota-<нік>.
   ============================================================ */

// ================= КОНФІГ =================
const CONFIG = {
  topic: 'spilnota',
  repoPrefix: 'spilnota-',
  pollMs: 8000,
  searchMs: 300000,
};
const LS_TOKEN = 'spilnota_token';
const LS_LOGIN = 'spilnota_login';
const LS_READ = 'spilnota_read_';
const LS_CFG = 'spilnota_cfg';
const LS_HIDDEN = 'spilnota_hidden';
const LS_PROJ_FILTER = 'spilnota_proj_filter';
const LS_PROJ_ORDER = 'spilnota_proj_order';
let projSortMode = false;
let pageIndex = { categories: [] };
let pagesSortMode = false;
let avatarsCache = {};
let activeAnim = null;
let currentPhotoImg = null;
let currentEffect = 'particles';
let currentGrid = 36;
const API = 'https://api.github.com';

// ================= ТЕМИ ТА ШРИФТИ =================
const THEMES = {
  classic: {
    name: 'Класична',
    css: {
      '--header-top': '#5E81A8', '--header-bottom': '#45688E', '--header-border': '#3A5B7C',
      '--bg': '#EDEEF0', '--card': '#FFFFFF', '--border': '#D8DFEA',
      '--link': '#2B587A', '--text': '#000', '--text2': '#666', '--text3': '#999',
      '--btn-top': '#729BC8', '--btn-bottom': '#6383A8', '--btn-border': '#4E7291',
      '--green': '#4BB34B', '--mine-bubble': '#E3EFF9', '--mine-border': '#B9CDE3', '--comment-bg': '#F0F3F7'
    }
  },
  dark: {
    name: 'Темна',
    css: {
      '--header-top': '#1A1D33', '--header-bottom': '#12152A', '--header-border': '#000',
      '--bg': '#0B0D19', '--card': '#1E2240', '--border': '#262B50',
      '--link': '#00F0FF', '--text': '#E0E4F0', '--text2': '#8890B0', '--text3': '#505570',
      '--btn-top': '#00F0FF', '--btn-bottom': '#00A8B8', '--btn-border': '#006B78',
      '--green': '#00FF88', '--mine-bubble': '#00A8B8', '--mine-border': '#006B78', '--comment-bg': '#1A1D33'
    }
  },
  forest: {
    name: 'Лісова',
    css: {
      '--header-top': '#4C8C6C', '--header-bottom': '#2E6B50', '--header-border': '#1F4A38',
      '--bg': '#EAF2EC', '--card': '#FFFFFF', '--border': '#CFE0D4',
      '--link': '#2E6B50', '--text': '#1A2E22', '--text2': '#5C7567', '--text3': '#8FA69A',
      '--btn-top': '#6BAE8C', '--btn-bottom': '#4C8C6C', '--btn-border': '#2E6B50',
      '--green': '#3A8C5C', '--mine-bubble': '#D8EFE0', '--mine-border': '#9FC8B0', '--comment-bg': '#F0F7F2'
    }
  },
  sunset: {
    name: 'Захід сонця',
    css: {
      '--header-top': '#E07B54', '--header-bottom': '#C25A38', '--header-border': '#8F3D24',
      '--bg': '#FDF1EA', '--card': '#FFFFFF', '--border': '#F0D5C5',
      '--link': '#C25A38', '--text': '#3A241A', '--text2': '#8A6A5A', '--text3': '#B49A8C',
      '--btn-top': '#E8986F', '--btn-bottom': '#D0784F', '--btn-border': '#C25A38',
      '--green': '#6BA85C', '--mine-bubble': '#FBE3D3', '--mine-border': '#E8BEA4', '--comment-bg': '#FBF3ED'
    }
  },
  ocean: {
    name: 'Океан',
    css: {
      '--header-top': '#3E7CB1', '--header-bottom': '#2B5E8C', '--header-border': '#1C4470',
      '--bg': '#EAF2F8', '--card': '#FFFFFF', '--border': '#C9DCEA',
      '--link': '#2B5E8C', '--text': '#16283A', '--text2': '#5A768C', '--text3': '#8FA9BC',
      '--btn-top': '#5E9CD0', '--btn-bottom': '#3E7CB1', '--btn-border': '#2B5E8C',
      '--green': '#3E9C7C', '--mine-bubble': '#D8EAF7', '--mine-border': '#A4C8E0', '--comment-bg': '#F0F6FA'
    }
  }
};
const FONTS = {
  ptsans: { name: 'PT Sans', family: "'PT Sans', Tahoma, Arial, sans-serif" },
  tahoma: { name: 'Tahoma', family: "Tahoma, Verdana, Arial, sans-serif" },
  georgia: { name: 'Georgia', family: "Georgia, 'Times New Roman', serif" },
  mono: { name: 'Моноширинний', family: "'Courier New', Courier, monospace" },
  comic: { name: 'Comic Sans', family: "'Comic Sans MS', 'Comic Sans', cursive" }
};

// ================= МОДУЛІ =================
// Кожен модуль: id, назва, опис, дефолт, список екранів, поллінг
const MODULE_DEFS = [
  { id: 'profile', name: 'Профіль', icon: '🏠', desc: 'Моя сторінка, редагування, сторінки користувачів', def: true, screens: ['me', 'edit', 'user'], poll: 'wall' },
  { id: 'wall', name: 'Стіна (стрічка)', icon: '📰', desc: 'Пости, лайки, коментарі — стрічка всіх', def: true, screens: ['feed'], poll: 'wall' },
  { id: 'chat', name: 'Повідомлення', icon: '💬', desc: 'Приватні діалоги між користувачами', def: true, screens: ['messages', 'dialog'], poll: 'dialogs' },
  { id: 'people', name: 'Люди', icon: '👥', desc: 'Список учасників спільноти', def: true, screens: ['people'], poll: null },
  { id: 'projects', name: 'Мої проекти', icon: '📁', desc: 'Сторінки та проекти з GitHub: фільтри, описи, приховування', def: true, screens: ['projects'], poll: null },
  { id: 'pages', name: 'Сторінки', icon: '🌐', desc: 'Навігатор задеплоєних сторінок: категорії, описи, порядок', def: true, screens: ['pages'], poll: null },
  { id: 'avatar', name: 'Фото-аватар', icon: '📸', desc: 'Ваше фото з ефектом частинок замість аватара', def: true, screens: ['avatar'], poll: null },
  { id: 'settings', name: 'Налаштування', icon: '⚙️', desc: 'Модулі, шрифт, тема', def: true, screens: ['settings'], poll: null, locked: true }
];

// ================= СТАН =================
let me = null;
let token = null;
let myProfile = {};
let participants = [];
let wallCache = { posts: [] };
let likesCache = [];
let commentsCache = [];
let dialogsCache = {};
let currentDialogPeer = null;
let lastRenderSig = '';
let lastSearch = 0;
let projectsCache = null;
let projectsLoading = false;
const AVATAR_COLORS = ['#45688E','#4C6E99','#5E81A8','#2B7A6E','#7A5E8E','#8E5E5E','#5E8E6E','#8E7A5E','#4E7291','#6E4E91'];
const EMOJIS = ['🦊','🐱','🐶','🐻','🐼','🦁','🐸','🐵','🐨','🐰','🦄','🐲','🐳','🦉','🐺','🦋','🐝','🐢','🐙','🦀','🌻','🍀','🔥','⭐','🌙','⚡','🎮','🎬','🎵','📚','🎨','🧩'];

// ================= НАЛАШТУВАННЯ (cfg) =================
function defaultCfg() {
  const enabled = {};
  for (const m of MODULE_DEFS) enabled[m.id] = m.def;
  return { enabled, font: 'ptsans', theme: 'classic' };
}
function getCfg() {
  try {
    const cfg = { ...defaultCfg(), ...JSON.parse(localStorage.getItem(LS_CFG) || '{}') };
    if (cfg.theme === 'vk2013') { cfg.theme = 'classic'; saveCfg(cfg); }
    return cfg;
  } catch (e) { return defaultCfg(); }
}
function saveCfg(cfg) {
  localStorage.setItem(LS_CFG, JSON.stringify(cfg));
}
function moduleEnabled(id) {
  const cfg = getCfg();
  const m = MODULE_DEFS.find(x => x.id === id);
  if (m && m.locked) return true;
  return cfg.enabled[id] !== false;
}
function applyTheme(themeId) {
  const t = THEMES[themeId] || THEMES.classic;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.css)) root.style.setProperty(k, v);
}
function applyFont(fontId) {
  const f = FONTS[fontId] || FONTS.ptsans;
  document.documentElement.style.setProperty('--font', f.family);
}
function applyCfg() {
  const cfg = getCfg();
  applyTheme(cfg.theme);
  applyFont(cfg.font);
}

// ================= УТИЛІТИ =================
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const MONTHS = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
function fmtClock(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function timeAgo(ts) {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 10e3) return 'тільки що';
  if (diff < 60e3) return Math.floor(diff/1e3) + ' сек тому';
  if (diff < 3600e3) return Math.floor(diff/60e3) + ' хв тому';
  const d = new Date(ts), n = new Date(now);
  const sameDay = d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  if (sameDay) return 'сьогодні о ' + fmtClock(ts);
  const yest = new Date(now - 86400e3);
  if (d.getDate() === yest.getDate() && d.getMonth() === yest.getMonth() && d.getFullYear() === yest.getFullYear()) return 'вчора о ' + fmtClock(ts);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' о ' + fmtClock(ts);
}
function fmtDate(ts) {
  const d = new Date(ts);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function avatarDataFor(name) {
  if (name === me && myProfile.avatar) return myProfile.avatar;
  return avatarsCache[name] || null;
}
function avatarHtml(name, emoji, size) {
  const cls = size === 'sm' ? ' avatar sm' : size === 'xs' ? ' avatar xs' : ' avatar';
  const av = avatarDataFor(name);
  if (av) {
    const px = size === 'sm' ? 32 : size === 'xs' ? 24 : 50;
    return `<canvas class="${cls} av-canvas" width="${px * 2}" height="${px * 2}" data-av="${esc(name)}"></canvas>`;
  }
  return `<div class="${cls}" style="background:${avatarColor(name)}">${emoji || '🙂'}</div>`;
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add('hidden'), 2500);
}
function myRepoName() { return CONFIG.repoPrefix + me; }

// ================= GITHUB API =================
async function gh(url, opts = {}) {
  const headers = { Accept: 'application/vnd.github.v3+json', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(API + url, { ...opts, headers });
  return r;
}
async function ghJson(url, opts) {
  const r = await gh(url, opts);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}
async function readFile(owner, repo, path) {
  const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`);
  if (!r.ok) return null;
  return r.json();
}
async function readMyFile(path, fallback) {
  try {
    const d = await readFile(me, myRepoName(), path);
    return d ?? fallback;
  } catch (e) { return fallback; }
}
async function writeMyFile(path, data) {
  const url = `/repos/${me}/${myRepoName()}/contents/${path}`;
  const getR = await gh(url);
  let sha = null;
  if (getR.ok) sha = (await getR.json()).sha;
  const payload = {
    message: '✍ Спільнота: ' + path,
    content: toBase64(JSON.stringify(data, null, 1)),
    sha: sha
  };
  let r = await gh(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (r.ok) return true;
  if (r.status === 409) {
    const rr = await gh(url);
    if (rr.ok) {
      payload.sha = (await rr.json()).sha;
      const r2 = await gh(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return r2.ok;
    }
  }
  return false;
}

// ================= ПОШУК УЧАСНИКІВ =================
async function searchParticipants(force) {
  if (!force && Date.now() - lastSearch < CONFIG.searchMs && participants.length) return participants;
  try {
    const q = encodeURIComponent('topic:' + CONFIG.topic);
    const r = await ghJson(`/search/repositories?q=${q}&per_page=100`);
    if (r && Array.isArray(r.items)) {
      participants = r.items
        .filter(it => !it.fork && it.name.startsWith(CONFIG.repoPrefix))
        .map(it => ({ login: it.owner.login, repo: it.name }));
      lastSearch = Date.now();
    }
  } catch (e) { }
  return participants;
}

// ================= СТРІЧКА =================
async function refreshWall() {
  const list = await searchParticipants();
  const posts = [];
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const w = await readFile(p.login, p.repo, 'data/wall.json');
      if (w && Array.isArray(w.posts)) posts.push(...w.posts.map(x => ({ ...x, repoOwner: p.login })));
    } catch (e) { }
  }
  const myW = await readMyFile('data/wall.json', { posts: [] });
  if (myW && Array.isArray(myW.posts)) posts.push(...myW.posts.map(x => ({ ...x, repoOwner: me })));
  wallCache.posts = posts.sort((a, b) => b.ts - a.ts);
}
async function refreshLikes() {
  const list = await searchParticipants();
  const likes = [];
  // свій файл — завжди, незалежно від participants (як refreshWall)
  const myD = await readMyFile('data/likes.json', { likes: [] });
  if (myD && Array.isArray(myD.likes)) likes.push(...myD.likes.map(x => ({ ...x, liker: me })));
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const d = await readFile(p.login, p.repo, 'data/likes.json');
      if (d && Array.isArray(d.likes)) likes.push(...d.likes.map(x => ({ ...x, liker: p.login })));
    } catch (e) { }
  }
  likesCache = likes;
}
async function refreshComments() {
  const list = await searchParticipants();
  const comments = [];
  // свій файл — завжди
  const myD = await readMyFile('data/comments.json', { comments: [] });
  if (myD && Array.isArray(myD.comments)) comments.push(...myD.comments.map(x => ({ ...x, author: me })));
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const d = await readFile(p.login, p.repo, 'data/comments.json');
      if (d && Array.isArray(d.comments)) comments.push(...d.comments.map(x => ({ ...x, author: p.login })));
    } catch (e) { }
  }
  commentsCache = comments;
}
async function profileOf(login) {
  if (login === me) return myProfile;
  try {
    const p = await readFile(login, CONFIG.repoPrefix + login, 'data/profile.json');
    return p || { name: login, emoji: '🙂' };
  } catch (e) { return { name: login, emoji: '🙂' }; }
}
async function loadMyProfile() {
  myProfile = await readMyFile('data/profile.json', null);
  if (!myProfile) myProfile = { name: me, emoji: '🦊', status: '', city: '', about: '', joined: Date.now() };
}

// ================= ДІАЛОГИ =================
async function refreshDialogs() {
  const list = await searchParticipants();
  dialogsCache = {};
  for (const p of list) {
    if (p.login === me) continue;
    const msgs = await readMyFile('data/outbox/' + p.login + '.json', []);
    if (Array.isArray(msgs) && msgs.length) dialogsCache[p.login] = [...(dialogsCache[p.login] || []), ...msgs];
  }
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const msgs = await readFile(p.login, p.repo, 'data/outbox/' + me + '.json');
      if (Array.isArray(msgs) && msgs.length) dialogsCache[p.login] = [...(dialogsCache[p.login] || []), ...msgs];
    } catch (e) { }
  }
  for (const k in dialogsCache) dialogsCache[k].sort((a, b) => a.ts - b.ts);
}
async function sendMessage(peer, text) {
  const path = 'data/outbox/' + peer + '.json';
  const msgs = await readMyFile(path, []);
  const msg = { id: uid(), from: me, to: peer, text: text, ts: Date.now() };
  msgs.push(msg);
  const ok = await writeMyFile(path, msgs.slice(-500));
  if (ok) dialogsCache[peer] = [...(dialogsCache[peer] || []), msg].sort((a, b) => a.ts - b.ts);
  return ok;
}
function readTs(peer) { return +(localStorage.getItem(LS_READ + peer) || 0); }
function setRead(peer, ts) { localStorage.setItem(LS_READ + peer, String(ts)); }
function unreadFor(peer) {
  const msgs = dialogsCache[peer] || [];
  return msgs.filter(m => m.from === peer && m.ts > readTs(peer)).length;
}
function unreadCount() {
  let n = 0;
  for (const k in dialogsCache) n += unreadFor(k);
  return n;
}

// ================= РОУТЕР =================
function parseHash() {
  let h = location.hash.replace(/^#\/?/, '') || 'me';
  const parts = h.split('/');
  return { screen: parts[0] || 'me', param: decodeURIComponent(parts[1] || '') };
}
function go(url) { location.hash = url; }
function moduleOfScreen(screen) {
  return MODULE_DEFS.find(m => m.screens.includes(screen));
}
function firstEnabledScreen() {
  const m = MODULE_DEFS.find(x => moduleEnabled(x.id));
  return m ? m.screens[0] : 'settings';
}

// ================= РЕНДЕР =================
const CONTENT = () => $('content');
function currentSig(screen) {
  return screen + '|' + wallCache.posts.length + '|' + Object.keys(dialogsCache).length + '|' + unreadCount();
}
function renderNav() {
  const { screen } = parseHash();
  const cfg = getCfg();
  // ліве меню
  const menu = $('sidebar').querySelector('.menu');
  menu.innerHTML = MODULE_DEFS
    .filter(m => moduleEnabled(m.id))
    .map(m => {
      const counter = m.id === 'chat' && unreadCount() ? `<span class="counter">${unreadCount()}</span>` : '';
      return `<li><a href="#/${m.screens[0]}" data-nav="${m.id}" class="${m.screens.includes(screen) ? 'active' : ''}"><span class="mi">${m.icon}</span> ${m.name}${counter}</a></li>`;
    }).join('');
  // нижня навігація
  const bn = $('bottom-nav');
  bn.innerHTML = MODULE_DEFS
    .filter(m => moduleEnabled(m.id))
    .map(m => `<a href="#/${m.screens[0]}" data-nav="${m.id}" class="${m.screens.includes(screen) ? 'active' : ''}">${m.icon}<br><small>${m.name.replace(/ \(.*/, '')}</small></a>`)
    .join('');
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === moduleOfScreen(screen)?.id);
  });
}
function renderScreen() {
  const { screen, param } = parseHash();
  if (!me) { renderAuthGate(); return; }
  const mod = moduleOfScreen(screen);
  if (!mod || !moduleEnabled(mod.id)) { go(firstEnabledScreen()); return; }
  switch (screen) {
    case 'me': renderMyPage(); break;
    case 'edit': renderEdit(); break;
    case 'feed': renderFeed(); break;
    case 'messages': renderMessages(); break;
    case 'dialog': renderDialog(param); break;
    case 'people': renderPeople(); break;
    case 'projects': renderProjects(); break;
    case 'pages': renderPages(); break;
    case 'avatar': renderAvatar(); break;
    case 'user': renderUserPage(param); break;
    case 'settings': renderSettings(); break;
    default: renderMyPage();
  }
  renderNav();
  drawAvatars();
  // синхронізуємо лічильник: поллінг не перерендерить екран, поки дані не зміняться
  lastRenderSig = currentSig(screen);
}

// ---- Сторінка користувача (моя) ----
function renderMyPage() {
  const p = myProfile;
  const myPosts = wallCache.posts.filter(x => x.repoOwner === me);
  const bigAvatar = p.avatar
    ? `<canvas class="profile-avatar" id="profile-avatar-canvas" width="240" height="240" data-av="${esc(me)}"></canvas>`
    : `<div class="profile-avatar" style="background:${avatarColor(me)}">${p.emoji || '🦊'}</div>`;
  CONTENT().innerHTML = `
    <div class="card">
      <div class="profile-head">
        ${bigAvatar}
        <div class="profile-info">
          <div class="profile-name">${esc(p.name || me)} <span class="online">● в мережі</span></div>
          <div class="profile-status">${p.status ? '«' + esc(p.status) + '»' : ''}</div>
          <div class="profile-dt"><b>Місто:</b> ${esc(p.city || '—')}</div>
          <div class="profile-dt"><b>Про себе:</b> ${esc(p.about || '—')}</div>
          <div class="profile-dt"><b>У Спільноті з:</b> ${p.joined ? fmtDate(p.joined) : '—'}</div>
          <div class="profile-dt"><b>Мій репозиторій:</b> <a href="https://github.com/${esc(me)}/${esc(myRepoName())}" target="_blank">${esc(myRepoName())} ↗</a></div>
          <div class="btn-row">
            <button class="btn gray" onclick="go('edit')">✏ Редагувати</button>
            ${moduleEnabled('avatar') ? '<button class="btn gray" onclick="go(\'avatar\')">📸 Фото-аватар</button>' : ''}
            <button class="btn gray" onclick="go('settings')">⚙️ Налаштування</button>
          </div>
        </div>
      </div>
    </div>
    ${moduleEnabled('wall') ? `
    <div class="card">
      <div class="card-title">Моя стіна</div>
      <div class="quick-post">
        ${avatarHtml(me, p.emoji, 'sm')}
        <input class="input" id="new-post" placeholder="Що у вас нового?" maxlength="2000">
        <button class="btn" onclick="submitPost()">Написати</button>
      </div>
      ${renderPostList(myPosts)}
    </div>` : ''}`;
  const pav = $('profile-avatar-canvas');
  if (pav) initAvatarAnim(pav);
}

// ---- Стрічка ----
function renderFeed() {
  const posts = [...wallCache.posts].sort((a, b) => b.ts - a.ts);
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Стрічка</div>
      <div class="quick-post">
        ${avatarHtml(me, myProfile.emoji, 'sm')}
        <input class="input" id="new-post" placeholder="Поділіться новиною..." maxlength="2000">
        <button class="btn" onclick="submitPost()">Написати</button>
      </div>
    </div>
    ${renderPostList(posts)}`;
}
function renderPostList(posts) {
  if (!posts.length) return `<div class="empty">Поки що тут порожньо. Напишіть перший пост!</div>`;
  return posts.map(postHtml).join('');
}
function postLikes(post) {
  return likesCache.filter(l => l.postOwner === post.repoOwner && l.postId === post.id);
}
function postComments(post) {
  return commentsCache.filter(c => c.postOwner === post.repoOwner && c.postId === post.id).sort((a, b) => a.ts - b.ts);
}
function postHtml(post) {
  const owner = post.repoOwner;
  const liked = likesCache.some(l => l.postOwner === owner && l.postId === post.id && l.liker === me);
  const likes = postLikes(post);
  const comments = postComments(post);
  return `
  <div class="post">
    <div class="post-head">
      ${avatarHtml(owner, (owner === me ? myProfile.emoji : '🙂'))}
      <div class="post-info">
        <div><a class="post-author" href="#/user/${encodeURIComponent(owner)}">${esc(owner)}</a>
        <span class="post-time"> · ${timeAgo(post.ts)}</span></div>
        <div class="post-text">${esc(post.text)}</div>
      </div>
    </div>
    <div class="post-actions">
      <a href="javascript:void(0)" class="${liked ? 'liked' : ''}" onclick="toggleLike('${owner}','${post.id}')">👍 Мені подобається${likes.length ? ' (' + likes.length + ')' : ''}</a>
      <a href="javascript:void(0)" onclick="focusComment('${owner}','${post.id}')">💬 Коментувати${comments.length ? ' (' + comments.length + ')' : ''}</a>
    </div>
    ${comments.length ? `<div class="comments">${comments.map(c => `
      <div class="comment">${avatarHtml(c.author, '🙂', 'xs')}
        <div class="c-body"><span class="c-author">${esc(c.author)}</span> ${esc(c.text)}
        <div class="c-time">${timeAgo(c.ts)}</div></div></div>`).join('')}</div>` : ''}
    <div class="comments hidden" id="cmt-${owner}-${post.id}">
      <div class="comment-input">
        ${avatarHtml(me, myProfile.emoji, 'xs')}
        <input class="input" id="cmt-in-${owner}-${post.id}" placeholder="Написати коментар..." maxlength="500">
        <button class="btn gray" onclick="submitComment('${owner}','${post.id}')">OK</button>
      </div>
    </div>
  </div>`;
}

// ---- Люди ----
function renderPeople() {
  const list = participants.filter(p => p.login !== me);
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Люди у Спільноті (${list.length + 1})</div>
      <div class="people-grid">
        <div class="person" onclick="go('me')">
          ${avatarHtml(me, myProfile.emoji)}
          <div class="p-name">${esc(myProfile.name || me)}</div>
          <div class="offline">це ви</div>
        </div>
        ${list.map(p => `
          <div class="person" onclick="go('user/' + encodeURIComponent('${p.login}'))">
            ${avatarHtml(p.login, '🙂')}
            <div class="p-name">${esc(p.login)}</div>
            <div class="offline">${esc(p.repo)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

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

// ================= ФОТО-АВАТАР =================
// Конвертер: фото → сітка частинок (як particle-портфоліо) прямо в браузері
const AV_EFFECTS = [
  { id: 'particles', name: 'Частинки', desc: 'Як у портфоліо: кольорові точки злітаються в обличчя' },
  { id: 'pixel', name: 'Пікселі', desc: 'Мозаїка з квадратиків середнього кольору' },
  { id: 'halftone', name: 'Точки', desc: 'Точки різного розміру — чим темніше, тим більша' },
  { id: 'mono', name: 'Моно', desc: 'Чорно-біла бінарізація: квадрати' }
];
function photoToParticles(img, grid) {
  const c = document.createElement('canvas');
  c.width = grid; c.height = grid;
  const cx = c.getContext('2d');
  const s = Math.min(img.width, img.height);
  cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, grid, grid);
  const d = cx.getImageData(0, 0, grid, grid).data;
  const pts = [];
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
    const i = (y * grid + x) * 4;
    if (d[i + 3] < 40) continue;
    pts.push([+(x / (grid - 1)).toFixed(3), +(y / (grid - 1)).toFixed(3), d[i], d[i + 1], d[i + 2]]);
  }
  return { effect: currentEffect, grid: grid, data: pts };
}
function monoColor() {
  const t = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  return /^#/.test(t) ? t : '#000';
}
function drawEffectOn(ctx, avatar, W, H, animParts) {
  const grid = avatar.grid || 36;
  const data = avatar.data || [];
  const cw = W / grid, ch = H / grid;
  ctx.clearRect(0, 0, W, H);
  if (avatar.effect === 'pixel') {
    for (const p of data) {
      ctx.fillStyle = `rgb(${p[2]},${p[3]},${p[4]})`;
      ctx.fillRect(p[0] * W, p[1] * H, cw + 0.5, ch + 0.5);
    }
  } else if (avatar.effect === 'mono') {
    const col = monoColor();
    for (const p of data) {
      const lum = 0.299 * p[2] + 0.587 * p[3] + 0.114 * p[4];
      ctx.fillStyle = lum < 128 ? col : 'rgba(0,0,0,0)';
      ctx.fillRect(p[0] * W, p[1] * H, cw + 0.5, ch + 0.5);
    }
  } else if (avatar.effect === 'halftone') {
    for (const p of data) {
      const lum = 0.299 * p[2] + 0.587 * p[3] + 0.114 * p[4];
      const rad = Math.max(0.8, (1 - lum / 255) * cw * 0.8);
      ctx.fillStyle = `rgb(${p[2]},${p[3]},${p[4]})`;
      ctx.beginPath(); ctx.arc(p[0] * W + cw / 2, p[1] * H + ch / 2, rad, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // particles
    const r = Math.max(1, cw * 0.5);
    for (const p of data) {
      ctx.fillStyle = `rgb(${p[2]},${p[3]},${p[4]})`;
      if (animParts) {
        ctx.beginPath(); ctx.arc(animParts.x, animParts.y, r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
function drawAvatarStatic(cv) {
  const av = avatarDataFor(cv.dataset.av);
  if (!av) return;
  const ctx = cv.getContext('2d');
  drawEffectOn(ctx, av, cv.width, cv.height, null);
}
function drawAvatars() {
  document.querySelectorAll('.av-canvas').forEach(drawAvatarStatic);
}
function stopAvatarAnim() {
  if (activeAnim) { cancelAnimationFrame(activeAnim.raf); activeAnim = null; }
}
function initAvatarAnim(cv) {
  stopAvatarAnim();
  const av = avatarDataFor(cv.dataset.av);
  if (!av || av.effect !== 'particles') { drawAvatarStatic(cv); return; }
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const grid = av.grid || 36;
  const r = Math.max(1, (W / grid) * 0.5);
  const parts = av.data.map(p => ({
    x: Math.random() * W, y: Math.random() * H, tx: p[0] * W, ty: p[1] * H,
    c: `rgb(${p[2]},${p[3]},${p[4]})`
  }));
  let t = 0;
  const CYCLE = 260, SCATTER = 300;
  const frame = () => {
    if (!cv.isConnected) { stopAvatarAnim(); return; }
    t++;
    ctx.clearRect(0, 0, W, H);
    const ph = t % CYCLE;
    for (const p of parts) {
      let tx = p.tx, ty = p.ty;
      if (ph > SCATTER) {
        tx = (Math.random() - 0.5) * W * 3; ty = (Math.random() - 0.5) * H * 3;
      }
      p.x += (tx - p.x) * 0.055;
      p.y += (ty - p.y) * 0.055;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    activeAnim = { canvas: cv, raf: requestAnimationFrame(frame) };
  };
  activeAnim = { canvas: cv, raf: requestAnimationFrame(frame) };
}
async function refreshAvatars() {
  const list = await searchParticipants();
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const prof = await readFile(p.login, p.repo, 'data/profile.json');
      if (prof && prof.avatar) avatarsCache[p.login] = prof.avatar;
      else delete avatarsCache[p.login];
    } catch (e) { }
  }
  drawAvatars();
}
function onAvatarFile(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const img = new Image();
  const url = URL.createObjectURL(f);
  img.onload = () => {
    currentPhotoImg = img;
    URL.revokeObjectURL(url);
    renderAvatar();
  };
  img.onerror = () => { toast('❌ Не вдалося прочитати фото'); };
  img.src = url;
}
function pickAvatarEffect(id) {
  currentEffect = id;
  renderAvatar();
}
function setAvatarGrid(v) {
  currentGrid = +v;
  renderAvatar();
}
function renderEffectPreview(cv) {
  if (!currentPhotoImg) return;
  const avatar = photoToParticles(currentPhotoImg, currentGrid);
  const ctx = cv.getContext('2d');
  drawEffectOn(ctx, avatar, cv.width, cv.height, null);
}
function renderAvatarPreview(cv) {
  if (!currentPhotoImg) return;
  const avatar = photoToParticles(currentPhotoImg, currentGrid);
  const ctx = cv.getContext('2d');
  if (currentEffect === 'particles') {
    initAvatarAnim(cv);
  } else {
    stopAvatarAnim();
    drawEffectOn(ctx, avatar, cv.width, cv.height, null);
  }
}
async function saveAvatar() {
  if (!currentPhotoImg) { toast('📸 Спочатку завантажте фото'); return; }
  const avatar = photoToParticles(currentPhotoImg, currentGrid);
  myProfile.avatar = avatar;
  const ok = await writeMyFile('data/profile.json', myProfile);
  if (!ok) { toast('❌ Не вдалося зберегти'); return; }
  avatarsCache[me] = avatar;
  stopAvatarAnim();
  renderHeader();
  toast('✅ Аватар збережено');
  go('me');
}
async function removeAvatar() {
  if (!myProfile.avatar) return;
  delete myProfile.avatar;
  const ok = await writeMyFile('data/profile.json', myProfile);
  if (ok) {
    delete avatarsCache[me];
    renderHeader();
    toast('👋 Фото прибрано, повернувся емодзі');
    go('me');
  } else toast('❌ Не вдалося зберегти');
}
function renderAvatar() {
  const hasAvatar = !!myProfile.avatar;
  const hasPhoto = !!currentPhotoImg;
  const previewHtml = hasPhoto ? `
    <div class="av-preview-row">
      <div class="av-preview">
        <div class="av-preview-label">Попередній перегляд</div>
        <canvas id="av-preview" width="240" height="240" data-av-preview="1"></canvas>
      </div>
      <div class="av-options">
        <div class="set-group-title">Ефект</div>
        <div class="av-effects">
          ${AV_EFFECTS.map(e => `
            <div class="av-effect ${currentEffect === e.id ? 'sel' : ''}" onclick="pickAvatarEffect('${e.id}')">
              <canvas class="av-eff-prev" width="72" height="72" data-eff="${e.id}"></canvas>
              <small>${e.name}</small>
            </div>`).join('')}
        </div>
        <div class="set-group-title" style="margin-top:10px">Деталізація: ${currentGrid}×${currentGrid}</div>
        <input type="range" min="20" max="48" step="2" value="${currentGrid}" oninput="setAvatarGrid(this.value)" style="width:100%">
        <div class="btn-row">
          <button class="btn" onclick="saveAvatar()">💾 Зберегти аватар</button>
          <button class="btn gray" onclick="go('me')">Скасувати</button>
        </div>
      </div>
    </div>` : '';
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">📸 Фото-аватар</div>
      <div class="set-desc" style="margin-bottom:8px">Завантажте фото — воно перетвориться на кольорові частинки (як у портфоліо) і замінить емодзі-аватар. Фото зберігається у вашому репо, нікуди більше не надсилається.</div>
      ${hasAvatar ? `
        <div class="av-current">
          <span>Поточний аватар:</span>
          <canvas class="av-canvas avatar" width="100" height="100" data-av="${esc(me)}"></canvas>
          <button class="btn gray" onclick="removeAvatar()">Прибрати фото</button>
        </div>` : ''}
      <div class="av-upload ${hasPhoto ? 'hidden' : ''}" id="av-drop">
        <input type="file" id="av-file" accept="image/*" onchange="onAvatarFile(this)" class="hidden">
        <button class="btn" onclick="$('av-file').click()">📁 Обрати фото</button>
        <div class="set-desc" style="margin-top:6px">Або перетягніть фото сюди (JPG, PNG)</div>
      </div>
      ${previewHtml}
    </div>`;
  if (hasPhoto) {
    // прев'ю ефектів
    document.querySelectorAll('.av-eff-prev').forEach(cv => {
      const old = currentEffect;
      currentEffect = cv.dataset.eff;
      renderEffectPreview(cv);
      currentEffect = old;
    });
    // велике прев'ю
    renderAvatarPreview($('av-preview'));
  }
  drawAvatars();
}

// ---- Профіль іншого користувача ----
function renderUserPage(nick) {
  const posts = wallCache.posts.filter(x => x.repoOwner === nick).sort((a, b) => b.ts - a.ts);
  const canMsg = me && me !== nick && moduleEnabled('chat');
  const av = avatarDataFor(nick);
  const bigAvatar = av
    ? `<canvas class="profile-avatar" id="profile-avatar-canvas" width="240" height="240" data-av="${esc(nick)}"></canvas>`
    : `<div class="profile-avatar" style="background:${avatarColor(nick)}">🙂</div>`;
  CONTENT().innerHTML = `
    <div class="card">
      <div class="profile-head">
        ${bigAvatar}
        <div class="profile-info">
          <div class="profile-name">${esc(nick)} <span class="online">● в мережі</span></div>
          <div class="profile-dt"><b>Репозиторій:</b> <a href="https://github.com/${esc(nick)}/${esc(CONFIG.repoPrefix + nick)}" target="_blank">${esc(CONFIG.repoPrefix + nick)} ↗</a></div>
          ${canMsg ? `<div class="btn-row"><button class="btn" onclick="go('dialog/' + encodeURIComponent('${nick}'))">💬 Написати повідомлення</button></div>` : ''}
        </div>
      </div>
    </div>
    ${moduleEnabled('wall') ? `
    <div class="card">
      <div class="card-title">Стіна ${esc(nick)}</div>
      ${renderPostList(posts)}
    </div>` : ''}`;
  const pav = $('profile-avatar-canvas');
  if (pav) initAvatarAnim(pav);
}

// ---- Редагування профілю ----
function renderEdit() {
  const p = myProfile;
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Редагування профілю</div>
      <label>Ім'я / нік (відображається)</label>
      <input class="input" id="e-name" maxlength="24" value="${esc(p.name || me)}">
      <div style="height:8px"></div>
      <label>Аватар</label>
      <div class="emoji-grid">${EMOJIS.map(e => `<div class="em ${e === p.emoji ? 'sel' : ''}" data-em="${e}" onclick="pickEditEmoji('${e}', this)">${e}</div>`).join('')}</div>
      <div style="height:8px"></div>
      <label>Статус</label>
      <input class="input" id="e-status" maxlength="120" value="${esc(p.status || '')}" placeholder="Статус">
      <div style="height:8px"></div>
      <label>Місто</label>
      <input class="input" id="e-city" maxlength="60" value="${esc(p.city || '')}" placeholder="Місто">
      <div style="height:8px"></div>
      <label>Про себе</label>
      <textarea class="textarea" id="e-about" maxlength="500" placeholder="Кілька слів про себе">${esc(p.about || '')}</textarea>
      <div class="btn-row">
        <button class="btn" onclick="saveEdit()">Зберегти</button>
        <button class="btn gray" onclick="go('me')">Скасувати</button>
      </div>
      <div class="err" id="e-err"></div>
    </div>`;
}
let editEmoji = null;

// ---- Повідомлення ----
function renderMessages() {
  const peers = Object.keys(dialogsCache)
    .filter(k => dialogsCache[k] && dialogsCache[k].length)
    .sort((a, b) => {
      const la = dialogsCache[a][dialogsCache[a].length - 1];
      const lb = dialogsCache[b][dialogsCache[b].length - 1];
      return (lb.ts || 0) - (la.ts || 0);
    });
  const items = peers.map(peer => {
    const msgs = dialogsCache[peer];
    const last = msgs[msgs.length - 1];
    const un = unreadFor(peer);
    return `
    <div class="dialog-item ${currentDialogPeer === peer ? 'active' : ''}" onclick="go('dialog/' + encodeURIComponent('${peer}'))">
      ${avatarHtml(peer, '🙂', 'sm')}
      <div class="d-info">
        <div class="d-name">${esc(peer)}</div>
        <div class="d-prev">${last.from === me ? 'Ви: ' : ''}${esc(last.text || '')}</div>
      </div>
      <div style="text-align:right">
        <div class="d-time">${last.ts ? timeAgo(last.ts) : ''}</div>
        ${un ? '<div class="d-unread">' + un + '</div>' : ''}
      </div>
    </div>`;
  }).join('');
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Повідомлення</div>
      ${items || '<div class="empty">Немає діалогів. Оберіть людину на сторінці «Люди».</div>'}
    </div>`;
}

// ---- Діалог ----
function renderDialog(peer) {
  currentDialogPeer = peer;
  setRead(peer, Date.now());
  const msgs = dialogsCache[peer] || [];
  const html = msgs.map(m => {
    const mine = m.from === me;
    return `<div class="msg ${mine ? 'mine' : 'theirs'}">
      <div class="m-bubble">
        ${mine ? '' : `<div class="m-author">${esc(m.from)}</div>`}
        <div>${esc(m.text)}</div>
        <div class="m-time">${fmtClock(m.ts)}</div>
      </div>
    </div>`;
  }).join('');
  CONTENT().innerHTML = `
    <div class="card">
      <div class="msgs-wrap">
        <div class="chat-pane">
          <div class="chat-head">
            <a href="#/user/${encodeURIComponent(peer)}">${avatarHtml(peer, '🙂', 'xs')}</a>
            <a href="#/user/${encodeURIComponent(peer)}">${esc(peer)}</a>
          </div>
          <div class="chat-messages" id="chat-msgs">${html || '<div class="empty">Напишіть перше повідомлення</div>'}</div>
          <div class="chat-input-row">
            <input class="input" id="msg-in" placeholder="Повідомлення..." maxlength="2000">
            <button class="btn" onclick="submitMsg('${encodeURIComponent(peer)}')">Надіслати</button>
          </div>
        </div>
      </div>
    </div>`;
  const box = $('chat-msgs');
  if (box) box.scrollTop = box.scrollHeight;
  const inp = $('msg-in');
  if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === 'Enter') submitMsg(encodeURIComponent(peer)); }; }
}

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

// ================= ПОЛЛІНГ =================
let pollTimer = null;
let socialTimer = null;
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const { screen } = parseHash();
    if (!me) return;
    const mod = moduleOfScreen(screen);
    if (!mod || !moduleEnabled(mod.id)) return;
    try {
      await searchParticipants();
      if (mod.poll === 'wall' || screen === 'me' || screen === 'user') await refreshWall();
      if (mod.poll === 'dialogs' || screen === 'messages') await refreshDialogs();
      const sig = currentSig(screen);
      if (sig !== lastRenderSig) { lastRenderSig = sig; renderScreen(); }
      else renderNav();
    } catch (e) { }
  }, CONFIG.pollMs);
  if (socialTimer) clearInterval(socialTimer);
  socialTimer = setInterval(async () => {
    if (!me) return;
    if (!moduleEnabled('wall')) return;
    try {
      const c0 = commentsCache.length, l0 = likesCache.length;
      await refreshLikes();
      await refreshComments();
      const { screen } = parseHash();
      if (screen === 'me' || screen === 'feed' || screen === 'user') {
        // рендеримо тільки якщо дані змінились — інакше стирається введений текст у полях
        if (commentsCache.length !== c0 || likesCache.length !== l0) renderScreen();
        else renderNav();
      }
    } catch (e) { }
  }, 15000);
}

// ================= ДІЇ =================
async function submitPost() {
  const inp = $('new-post');
  const text = inp.value.trim();
  if (!text) { toast('✏ Напишіть щось'); return; }
  inp.value = '';
  const post = { id: uid(), author: me, text: text, ts: Date.now() };
  const w = await readMyFile('data/wall.json', { posts: [] });
  w.posts = w.posts || [];
  w.posts.push(post);
  const ok = await writeMyFile('data/wall.json', w);
  if (!ok) { toast('❌ Не вдалося зберегти'); return; }
  wallCache.posts.push({ ...post, repoOwner: me });
  renderScreen();
}
async function toggleLike(postOwner, postId) {
  if (postOwner === me) { toast('Свої пости не лайкають 😉'); return; }
  const d = await readMyFile('data/likes.json', { likes: [] });
  d.likes = d.likes || [];
  const i = d.likes.findIndex(l => l.postOwner === postOwner && l.postId === postId);
  if (i >= 0) d.likes.splice(i, 1); else d.likes.push({ postOwner: postOwner, postId: postId, ts: Date.now() });
  const ok = await writeMyFile('data/likes.json', d);
  if (ok) { await refreshLikes(); renderScreen(); }
  else toast('❌ Не вдалося зберегти');
}
function focusComment(postOwner, postId) {
  const el = $('cmt-' + postOwner + '-' + postId);
  if (el) el.classList.remove('hidden');
  const inp = $('cmt-in-' + postOwner + '-' + postId);
  if (inp) inp.focus();
}
async function submitComment(postOwner, postId) {
  const inp = $('cmt-in-' + postOwner + '-' + postId);
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  const d = await readMyFile('data/comments.json', { comments: [] });
  d.comments = d.comments || [];
  d.comments.push({ id: uid(), postOwner: postOwner, postId: postId, text: text, ts: Date.now() });
  const ok = await writeMyFile('data/comments.json', d);
  if (ok) { await refreshComments(); renderScreen(); }
  else toast('❌ Не вдалося зберегти');
}
async function submitMsg(encPeer) {
  const peer = decodeURIComponent(encPeer);
  const inp = $('msg-in');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  const ok = await sendMessage(peer, text);
  if (ok) renderScreen();
  else { inp.value = text; toast('❌ Не вдалося надіслати'); }
}
function pickEditEmoji(em, el) {
  editEmoji = em;
  document.querySelectorAll('#content .emoji-grid .em').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
}
async function saveEdit() {
  const name = $('e-name').value.trim();
  if (!name) { $('e-err').textContent = 'Вкажіть ім\u0027я'; return; }
  const updated = {
    ...myProfile,
    name: name,
    emoji: editEmoji || myProfile.emoji || '🦊',
    status: $('e-status').value.trim(),
    city: $('e-city').value.trim(),
    about: $('e-about').value.trim(),
    joined: myProfile.joined || Date.now()
  };
  const ok = await writeMyFile('data/profile.json', updated);
  if (!ok) { $('e-err').textContent = 'Не вдалося зберегти (перевірте інтернет)'; return; }
  myProfile = updated;
  toast('✅ Профіль збережено');
  go('me');
}
function logout() {
  if (!confirm('Вийти зі Спільноти?')) return;
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_LOGIN);
  location.reload();
}

// ================= ВХІД ЧЕРЕЗ ТОКЕН =================
function buildEmojiGrid() {
  $('reg-emojis').innerHTML = EMOJIS.map(e =>
    `<div class="em ${e === regEmoji ? 'sel' : ''}" data-em="${e}" onclick="regPickEmoji('${e}', this)">${e}</div>`).join('');
}
let regEmoji = '🦊';
function regPickEmoji(em, el) {
  regEmoji = em;
  document.querySelectorAll('#reg-emojis .em').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
}
function openTokenStep() {
  $('reg-title').textContent = 'Вхід у Спільноту';
  $('reg-sub').innerHTML = '1. <a href="https://github.com/settings/tokens/new?scopes=repo&description=spilnota" target="_blank">Створіть токен на GitHub</a> — галочка <b>repo</b> вже стоїть<br>2. Скопіюйте токен і вставте сюди<br><small>Токен зберігається тільки у вашому браузері.</small>';
  $('reg-step1').classList.remove('hidden');
  $('reg-step2').classList.add('hidden');
  $('reg-err').textContent = '';
}
async function tryLogin() {
  const raw = $('token-input').value.trim();
  if (!raw) { $('reg-err').textContent = 'Вставте токен'; return; }
  $('reg-btn').disabled = true;
  $('reg-err').textContent = '';
  try {
    const r = await fetch(API + '/user', { headers: { Authorization: 'Bearer ' + raw, Accept: 'application/vnd.github.v3+json' } });
    if (!r.ok) {
      $('reg-btn').disabled = false;
      $('reg-err').textContent = 'Токен недійсний (' + r.status + '). Спробуйте ще раз.';
      return;
    }
    const user = await r.json();
    token = raw;
    me = user.login;
    const repoName = CONFIG.repoPrefix + me;
    const exists = await ghJson(`/repos/${me}/${repoName}`);
    if (!exists) {
      const cr = await ghJson('/user/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repoName, description: 'Моя сторінка у Спільноті', private: false, auto_init: true })
      });
      if (!cr) {
        $('reg-btn').disabled = false;
        $('reg-err').textContent = 'Не вдалося створити репо. Перевірте, що токен має галочку repo.';
        return;
      }
    }
    try {
      await gh(`/repos/${me}/${repoName}/topics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github.mercy-preview+json' },
        body: JSON.stringify({ names: [CONFIG.topic] })
      });
    } catch (e) { }
    const existingProfile = await readFile(me, repoName, 'data/profile.json');
    if (!existingProfile) {
      myProfile = { name: user.name || user.login, emoji: regEmoji, status: '', city: '', about: '', joined: Date.now() };
      await writeMyFile('data/profile.json', myProfile);
      await writeMyFile('data/wall.json', { posts: [] });
      await writeMyFile('data/likes.json', { likes: [] });
      await writeMyFile('data/comments.json', { comments: [] });
    } else {
      myProfile = existingProfile;
    }
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_LOGIN, me);
    $('reg-title').textContent = 'Майже готово!';
    $('reg-sub').innerHTML = 'Оберіть аватар для вашої сторінки';
    $('reg-step1').classList.add('hidden');
    $('reg-step2').classList.remove('hidden');
    regEmoji = myProfile.emoji || '🦊';
    buildEmojiGrid();
  } catch (e) {
    $('reg-btn').disabled = false;
    $('reg-err').textContent = 'Помилка: ' + e.message;
  }
}
async function finishRegistration() {
  myProfile = { ...myProfile, emoji: regEmoji };
  try { await writeMyFile('data/profile.json', myProfile); } catch (e) { }
  $('reg-mask').classList.add('hidden');
  renderHeader();
  await refreshAll();
  renderScreen();
  startPolling();
  toast('👋 Вітаємо у Спільноті, ' + me + '!');
}

// ================= СТАРТ =================
async function refreshAll() {
  await searchParticipants(true);
  await Promise.all([refreshWall(), refreshLikes(), refreshComments(), refreshDialogs(), loadMyProfile(), refreshAvatars()]);
}
function renderHeader() {
  const hu = $('header-user');
  if (me) {
    hu.innerHTML = avatarHtml(me, myProfile.emoji, 'sm') +
      `<span class="hu-name" onclick="go('me')">${esc(myProfile.name || me)}</span>`;
  } else hu.innerHTML = '';
  const mf = $('menu-foot');
  if (me) mf.innerHTML = `Ви увійшли як <b>${esc(me)}</b><br><a href="javascript:void(0)" onclick="logout()" style="font-size:11px">Вийти</a>`;
}
async function init() {
  applyCfg();
  buildEmojiGrid();
  token = localStorage.getItem(LS_TOKEN);
  me = localStorage.getItem(LS_LOGIN);
  if (me && token) {
    try {
      const r = await fetch(API + '/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.v3+json' } });
      if (!r.ok) { token = null; me = null; localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_LOGIN); }
    } catch (e) { }
  }
  if (!me || !token) {
    openTokenStep();
    $('reg-mask').classList.remove('hidden');
    renderHeader();
    renderScreen();
  } else {
    renderHeader();
    await refreshAll();
    renderScreen();
    startPolling();
  }
  window.addEventListener('hashchange', () => {
    if (!me) return;
    const { screen } = parseHash();
    const mod = moduleOfScreen(screen);
    if (!mod || !moduleEnabled(mod.id)) { go(firstEnabledScreen()); return; }
    if (screen === 'dialog') { refreshDialogs().then(() => renderScreen()); }
    else renderScreen();
  });
}
window.addEventListener('load', init);
