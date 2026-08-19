/* ============================================================
   Спільнота — суспільна мережа в стилі ВК 2013
   Механіка: JSON-файли в GitHub-репо + GitHub Contents API
   (поллінг + merge по sha, retry на 409) — як у Habitat OS.
   ============================================================ */

// ================= КОНФІГ =================
const CONFIG = {
  owner: 'Fil-m',
  repo: 'spilnota',
  // XOR-обфускація токена (як у habitat) — токен із repo-скоупом
  token: (() => { const h = 'ccc3c4f498daffe6d8ea9be0e1fce1ffc4f3e9dec59dd1faeddad3f1e099faf8c2fb9add9b9eedd3', k = 0xAB, r = []; for (let i = 0; i < h.length; i += 2) r.push(String.fromCharCode(parseInt(h.substr(i, 2), 16) ^ k)); return r.join('') })(),
  pollMs: 5000,
  maxPosts: 300,
  maxMsgs: 500
};
const LS_USER = 'spilnota_user';
const LS_READ = 'spilnota_read_';

const API = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents`;

// ================= СТАН =================
let me = null;                  // нік поточного користувача
let myProfile = null;
let profiles = {};              // nick -> profile
let wall = { posts: [] };       // всі пости стіни
let dialogsIndex = {};          // key -> {lastTs,lastFrom,lastText,lastId}
let currentDialogKey = null;    // key відкритого діалогу
let currentDialogMsgs = [];     // повідомлення відкритого діалогу
const shaCache = {};            // path -> sha
let lastRenderSig = '';         // для уникнення зайвих рендерів
let regEmoji = '🦊';
const AVATAR_COLORS = ['#45688E','#4C6E99','#5E81A8','#2B7A6E','#7A5E8E','#8E5E5E','#5E8E6E','#8E7A5E','#4E7291','#6E4E91'];
const EMOJIS = ['🦊','🐱','🐶','🐻','🐼','🦁','🐸','🐵','🐨','🐰','🦄','🐲','🐳','🦉','🐺','🦋','🐝','🐢','🐙','🦀','🌻','🍀','🔥','⭐','🌙','⚡','🎮','🎬','🎵','📚','🎨','🧩'];

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
function avatarHtml(name, emoji, size) {
  const cls = size === 'sm' ? ' avatar sm' : size === 'xs' ? ' avatar xs' : ' avatar';
  return `<div class="${cls}" style="background:${avatarColor(name)}">${emoji || '🙂'}</div>`;
}
function dialogKey(a, b) { return [a, b].sort().join('__'); }
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add('hidden'), 2500);
}

// ================= GITHUB SYNC (механіка habitat) =================
async function ghGet(path) {
  const r = await fetch(`${API}/${path}`, {
    headers: { Authorization: 'Bearer ' + CONFIG.token, Accept: 'application/vnd.github.v3+json' }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GET ' + path + ' -> ' + r.status);
  const d = await r.json();
  shaCache[path] = d.sha;
  return JSON.parse(fromBase64(d.content));
}
async function ghPut(path, data) {
  const getR = await fetch(`${API}/${path}`, {
    headers: { Authorization: 'Bearer ' + CONFIG.token, Accept: 'application/vnd.github.v3+json' }
  });
  if (getR.ok) shaCache[path] = (await getR.json()).sha;
  const payload = {
    message: '✍ Спільнота: ' + path,
    content: toBase64(JSON.stringify(data, null, 1)),
    sha: shaCache[path]
  };
  let r = await fetch(`${API}/${path}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + CONFIG.token, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
    body: JSON.stringify(payload)
  });
  if (r.ok) { shaCache[path] = (await r.json()).content.sha; return true; }
  if (r.status === 409) {  // retry once: re-read sha
    const rr = await fetch(`${API}/${path}`, {
      headers: { Authorization: 'Bearer ' + CONFIG.token, Accept: 'application/vnd.github.v3+json' }
    });
    if (rr.ok) {
      shaCache[path] = (await rr.json()).sha;
      payload.sha = shaCache[path];
      const r2 = await fetch(`${API}/${path}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + CONFIG.token, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
        body: JSON.stringify(payload)
      });
      if (r2.ok) { shaCache[path] = (await r2.json()).content.sha; return true; }
    }
  }
  return false;
}
// Читає JSON з репо або дефолт (для першого запуску)
async function loadJson(path, fallback) {
  try {
    const d = await ghGet(path);
    return d ?? fallback;
  } catch (e) { return fallback; }
}

// ================= ПРОФІЛІ =================
async function loadProfiles() {
  const d = await loadJson('data/profiles.json', {});
  if (d && typeof d === 'object') profiles = d;
}
async function saveProfiles() {
  return ghPut('data/profiles.json', profiles);
}
function registerOnGitHub(profile) {
  return loadProfiles().then(() => {
    profiles[me] = profile;
    return saveProfiles();
  });
}

// ================= СТІНА =================
async function loadWall() {
  const d = await loadJson('data/wall.json', { posts: [] });
  if (d && Array.isArray(d.posts)) wall = d;
}
async function saveWall() {
  wall.posts = wall.posts.slice(-CONFIG.maxPosts);
  return ghPut('data/wall.json', wall);
}
// Оновлення стіни зі злиттям (читаємо свіже з репо, застосовуємо зміну, пишемо)
async function mutateWall(mutator) {
  await loadWall();                       // свіжий стан з репо
  const changed = mutator(wall);          // мутація: додати пост / лайк / коментар
  if (changed === false) return false;
  const ok = await saveWall();
  if (ok) renderScreen();
  else toast('❌ Не вдалося зберегти (перевірте інтернет)');
  return ok;
}

// ================= ДІАЛОГИ =================
async function loadDialogsIndex() {
  const d = await loadJson('data/dialogs.json', {});
  if (d && typeof d === 'object') dialogsIndex = d;
}
async function saveDialogsIndex() {
  return ghPut('data/dialogs.json', dialogsIndex);
}
async function loadDialogMsgs(key) {
  const d = await loadJson('data/dialogs/' + key + '.json', []);
  if (Array.isArray(d)) currentDialogMsgs = d;
}
async function saveDialogMsgs(key) {
  currentDialogMsgs = currentDialogMsgs.slice(-CONFIG.maxMsgs);
  return ghPut('data/dialogs/' + key + '.json', currentDialogMsgs);
}
// Надіслати повідомлення: читаємо діалог, додаємо, пишемо + оновлюємо індекс
async function sendMessage(peer, text) {
  const key = dialogKey(me, peer);
  await loadDialogMsgs(key);
  const msg = { id: uid(), from: me, text: text, ts: Date.now() };
  currentDialogMsgs.push(msg);
  const ok = await saveDialogMsgs(key);
  if (!ok) { toast('❌ Не вдалося надіслати'); return false; }
  // оновити індекс діалогів (для списку та непрочитаних)
  await loadDialogsIndex();
  dialogsIndex[key] = { lastTs: msg.ts, lastFrom: me, lastText: text.slice(0, 80), lastId: msg.id };
  await saveDialogsIndex();
  return true;
}
function readTs(key) { return +(localStorage.getItem(LS_READ + key) || 0); }
function setRead(key, ts) { localStorage.setItem(LS_READ + key, String(ts)); }
function isUnread(key) {
  const d = dialogsIndex[key];
  if (!d || !me || d.lastFrom === me) return false;
  return d.lastTs > readTs(key);
}
function unreadCount() {
  let n = 0;
  for (const k in dialogsIndex) if (isUnread(k)) n++;
  return n;
}

// ================= РОУТЕР =================
function parseHash() {
  let h = location.hash.replace(/^#\/?/, '') || 'me';
  const parts = h.split('/');
  return { screen: parts[0] || 'me', param: decodeURIComponent(parts[1] || '') };
}
function navigate(screen, param) {
  location.hash = param ? '#/' + screen + '/' + encodeURIComponent(param) : '#/' + screen;
}
function go(url) { location.hash = url; }

// ================= РЕНДЕР =================
const CONTENT = () => $('content');
function renderHeader() {
  const hu = $('header-user');
  if (me && myProfile) {
    hu.innerHTML = avatarHtml(me, myProfile.emoji, 'sm') +
      `<span class="hu-name" onclick="go('me')">${esc(myProfile.name)}</span>`;
  } else if (me) {
    hu.innerHTML = `<span class="hu-name" onclick="go('me')">${esc(me)}</span>`;
  } else hu.innerHTML = '';
  const mf = $('menu-foot');
  if (me) mf.textContent = 'Ви увійшли як ' + me;
}
function renderNav() {
  const { screen } = parseHash();
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === screen);
  });
  const cnt = $('msg-counter');
  const n = unreadCount();
  cnt.textContent = n > 0 ? String(n) : '';
}
function renderScreen() {
  const { screen, param } = parseHash();
  if (!me) { renderAuthGate(); return; }
  switch (screen) {
    case 'me': renderMyPage(); break;
    case 'feed': renderFeed(); break;
    case 'messages': renderMessages(); break;
    case 'dialog': renderDialog(param); break;
    case 'people': renderPeople(); break;
    case 'user': renderUserPage(param); break;
    default: renderMyPage();
  }
  renderNav();
}

// ---- Сторінка користувача (моя) ----
function renderMyPage() {
  const p = profiles[me] || myProfile || { name: me, emoji: '🦊', status: '', about: '', city: '' };
  const myPosts = wall.posts.filter(x => x.author === me).sort((a, b) => b.ts - a.ts);
  CONTENT().innerHTML = `
    <div class="card">
      <div class="profile-head">
        <div class="profile-avatar" style="background:${avatarColor(me)}">${p.emoji || '🦊'}</div>
        <div class="profile-info">
          <div class="profile-name">${esc(p.name || me)} <span class="online">● в мережі</span></div>
          <div class="profile-status">${p.status ? '«' + esc(p.status) + '»' : ''}</div>
          <div class="profile-dt"><b>Місто:</b> ${esc(p.city || '—')}</div>
          <div class="profile-dt"><b>Про себе:</b> ${esc(p.about || '—')}</div>
          <div class="profile-dt"><b>У Спільноті з:</b> ${p.joined ? fmtDate(p.joined) : '—'}</div>
          <div class="btn-row">
            <button class="btn gray" onclick="go('edit')">✏ Редагувати</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Моя стіна</div>
      <div class="quick-post">
        ${avatarHtml(me, p.emoji, 'sm')}
        <input class="input" id="new-post" placeholder="Що у вас нового?" maxlength="2000">
        <button class="btn" onclick="submitPost()">Написати</button>
      </div>
      ${renderPostList(myPosts)}
    </div>`;
}

// ---- Стрічка ----
function renderFeed() {
  const p = profiles[me] || myProfile || { name: me, emoji: '🦊' };
  const posts = [...wall.posts].sort((a, b) => b.ts - a.ts);
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Стрічка</div>
      <div class="quick-post">
        ${avatarHtml(me, p.emoji, 'sm')}
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
function postHtml(post) {
  const author = profiles[post.author] || { name: post.author, emoji: '🦊' };
  const liked = me && (post.likes || []).includes(me);
  const likes = post.likes || [];
  const comments = post.comments || [];
  return `
  <div class="post">
    <div class="post-head">
      ${avatarHtml(post.author, author.emoji)}
      <div class="post-info">
        <div><a class="post-author" href="#/user/${encodeURIComponent(post.author)}">${esc(author.name || post.author)}</a>
        <span class="post-time"> · ${timeAgo(post.ts)}</span></div>
        <div class="post-text">${esc(post.text)}</div>
      </div>
    </div>
    <div class="post-actions">
      <a href="javascript:void(0)" class="${liked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">👍 Мені подобається${likes.length ? ' (' + likes.length + ')' : ''}</a>
      <a href="javascript:void(0)" onclick="focusComment('${post.id}')">💬 Коментувати${comments.length ? ' (' + comments.length + ')' : ''}</a>
    </div>
    ${comments.length ? `<div class="comments">${comments.map(c => {
      const ca = profiles[c.author] || { name: c.author, emoji: '🦊' };
      return `<div class="comment">${avatarHtml(c.author, ca.emoji, 'xs')}
        <div class="c-body"><span class="c-author">${esc(ca.name || c.author)}</span> ${esc(c.text)}
        <div class="c-time">${timeAgo(c.ts)}</div></div></div>`;
    }).join('')}</div>` : ''}
    <div class="comments hidden" id="cmt-${post.id}">
      <div class="comment-input">
        ${avatarHtml(me, (myProfile||{}).emoji || '🦊', 'xs')}
        <input class="input" id="cmt-in-${post.id}" placeholder="Написати коментар..." maxlength="500">
        <button class="btn gray" onclick="submitComment('${post.id}')">OK</button>
      </div>
    </div>
  </div>`;
}

// ---- Люди ----
function renderPeople() {
  const list = Object.entries(profiles).sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Люди у Спільноті (${list.length})</div>
      <div class="people-grid">
        ${list.map(([nick, p]) => `
          <div class="person" onclick="go('user/' + encodeURIComponent('${nick}'))">
            ${avatarHtml(nick, p.emoji)}
            <div class="p-name">${esc(p.name || nick)}</div>
            <div class="offline">${p.city || ''}</div>
          </div>`).join('')}
        ${!list.length ? '<div class="empty">Поки що тут порожньо.</div>' : ''}
      </div>
    </div>`;
}

// ---- Профіль іншого користувача ----
function renderUserPage(nick) {
  const p = profiles[nick];
  if (!p) {
    CONTENT().innerHTML = `<div class="card"><div class="empty">Користувача «${esc(nick)}» не знайдено</div></div>`;
    return;
  }
  const posts = wall.posts.filter(x => x.author === nick).sort((a, b) => b.ts - a.ts);
  const canMsg = me && me !== nick;
  CONTENT().innerHTML = `
    <div class="card">
      <div class="profile-head">
        <div class="profile-avatar" style="background:${avatarColor(nick)}">${p.emoji || '🦊'}</div>
        <div class="profile-info">
          <div class="profile-name">${esc(p.name || nick)} <span class="online">● в мережі</span></div>
          <div class="profile-status">${p.status ? '«' + esc(p.status) + '»' : ''}</div>
          <div class="profile-dt"><b>Місто:</b> ${esc(p.city || '—')}</div>
          <div class="profile-dt"><b>Про себе:</b> ${esc(p.about || '—')}</div>
          <div class="profile-dt"><b>У Спільноті з:</b> ${p.joined ? fmtDate(p.joined) : '—'}</div>
          ${canMsg ? `<div class="btn-row"><button class="btn" onclick="go('dialog/' + encodeURIComponent('${nick}'))">💬 Написати повідомлення</button></div>` : ''}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Стіна ${esc(p.name || nick)}</div>
      ${renderPostList(posts)}
    </div>`;
}

// ---- Редагування профілю ----
function renderEdit() {
  const p = profiles[me] || { name: me, emoji: '🦊', status: '', about: '', city: '' };
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Редагування профілю</div>
      <label>Ім'я / нік</label>
      <input class="input" id="e-name" maxlength="24" value="${esc(p.name || me)}">
      <div style="height:8px"></div>
      <label>Аватар</label>
      <div class="emoji-grid">${EMOJIS.map(e => `<div class="em ${e === p.emoji ? 'sel' : ''}" data-em="${e}" onclick="pickEditEmoji('${e}', this)">${e}</div>`).join('')}</div>
      <div style="height:8px"></div>
      <label>Статус</label>
      <input class="input" id="e-status" maxlength="120" value="${esc(p.status || '')}" placeholder="Статус (як у ВК)">
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

// ---- Повідомлення (список діалогів) ----
function renderMessages() {
  const list = Object.entries(dialogsIndex)
    .filter(([k, d]) => d && k.split('__').includes(me))
    .sort((a, b) => (b[1].lastTs || 0) - (a[1].lastTs || 0));
  const items = list.map(([key, d]) => {
    const peer = key.split('__').find(x => x !== me);
    const pp = profiles[peer] || { name: peer, emoji: '🦊' };
    const un = isUnread(key);
    return `
    <div class="dialog-item ${currentDialogKey === key ? 'active' : ''}" onclick="go('dialog/' + encodeURIComponent('${peer}'))">
      ${avatarHtml(peer, pp.emoji, 'sm')}
      <div class="d-info">
        <div class="d-name">${esc(pp.name || peer)}</div>
        <div class="d-prev">${d.lastFrom === me ? 'Ви: ' : ''}${esc(d.lastText || '')}</div>
      </div>
      <div style="text-align:right">
        <div class="d-time">${d.lastTs ? timeAgo(d.lastTs) : ''}</div>
        ${un ? '<div class="d-unread">1</div>' : ''}
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
  const key = dialogKey(me, peer);
  currentDialogKey = key;
  setRead(key, Date.now());
  const pp = profiles[peer] || { name: peer, emoji: '🦊' };
  const msgs = [...currentDialogMsgs];
  const html = msgs.map(m => {
    const mine = m.from === me;
    return `<div class="msg ${mine ? 'mine' : 'theirs'}">
      <div class="m-bubble">
        ${mine ? '' : `<div class="m-author">${esc((profiles[m.from] || {}).name || m.from)}</div>`}
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
            <a href="#/user/${encodeURIComponent(peer)}">${avatarHtml(peer, pp.emoji, 'xs')}</a>
            <a href="#/user/${encodeURIComponent(peer)}">${esc(pp.name || peer)}</a>
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

// ---- Авторизація (гейт, поки не зареєстровані) ----
function renderAuthGate() {
  CONTENT().innerHTML = `<div class="card"><div class="empty">Будь ласка, увійдіть до Спільноти.</div></div>`;
}

// ================= ПОЛЛІНГ (як habitat: тільки активний екран) =================
let pollTimer = null;
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const { screen, param } = parseHash();
    if (!me) return;
    try {
      if (screen === 'me' || screen === 'feed' || screen === 'user') {
        await loadWall();
      } else if (screen === 'messages') {
        await loadDialogsIndex();
      } else if (screen === 'dialog') {
        const key = dialogKey(me, decodeURIComponent(param));
        const prev = JSON.stringify(currentDialogMsgs);
        await loadDialogMsgs(key);
        if (JSON.stringify(currentDialogMsgs) !== prev) { renderScreen(); return; }
        // оновити непрочитані після відкриття
        setRead(key, Date.now());
        renderNav();
      }
      if (screen === 'people' || screen === 'messages' || screen === 'me' || screen === 'feed' || screen === 'user' || screen === 'dialog') {
        await loadProfiles();
      }
      const sig = screen + '|' + JSON.stringify(wall.posts.map(p => p.id + (p.likes||[]).length + (p.comments||[]).length).slice(-40)) + '|' + JSON.stringify(dialogsIndex) + '|' + Object.keys(profiles).length;
      if (sig !== lastRenderSig) { lastRenderSig = sig; renderScreen(); }
      else renderNav();
    } catch (e) { /* мовчки — офлайн */ }
  }, CONFIG.pollMs);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

// ================= ДІЇ =================
async function submitPost() {
  const inp = $('new-post');
  const text = inp.value.trim();
  if (!text) { toast('✏ Напишіть щось'); return; }
  inp.value = '';
  const post = { id: uid(), author: me, text: text, ts: Date.now(), likes: [], comments: [] };
  await mutateWall(w => { w.posts.push(post); });
}
async function toggleLike(postId) {
  await mutateWall(w => {
    const post = w.posts.find(p => p.id === postId);
    if (!post) return false;
    post.likes = post.likes || [];
    const i = post.likes.indexOf(me);
    if (i >= 0) post.likes.splice(i, 1); else post.likes.push(me);
    return true;
  });
}
function focusComment(postId) {
  const el = $('cmt-' + postId);
  if (el) el.classList.remove('hidden');
  const inp = $('cmt-in-' + postId);
  if (inp) inp.focus();
}
async function submitComment(postId) {
  const inp = $('cmt-in-' + postId);
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  await mutateWall(w => {
    const post = w.posts.find(p => p.id === postId);
    if (!post) return false;
    post.comments = post.comments || [];
    post.comments.push({ id: uid(), author: me, text: text, ts: Date.now() });
    return true;
  });
}
async function submitMsg(encPeer) {
  const peer = decodeURIComponent(encPeer);
  const inp = $('msg-in');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  const ok = await sendMessage(peer, text);
  if (ok) { await loadDialogMsgs(dialogKey(me, peer)); renderScreen(); }
  else { inp.value = text; }
}
function pickEditEmoji(em, el) {
  editEmoji = em;
  document.querySelectorAll('#content .emoji-grid .em').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
}
async function saveEdit() {
  const name = $('e-name').value.trim();
  if (!name) { $('e-err').textContent = 'Вкажіть ім\u0027я'; return; }
  const p = profiles[me] || {};
  const updated = {
    name: name,
    emoji: editEmoji || p.emoji || '🦊',
    status: $('e-status').value.trim(),
    city: $('e-city').value.trim(),
    about: $('e-about').value.trim(),
    joined: p.joined || Date.now()
  };
  await loadProfiles();
  profiles[me] = updated;
  myProfile = updated;
  const ok = await saveProfiles();
  if (!ok) { $('e-err').textContent = 'Не вдалося зберегти (перевірте інтернет)'; return; }
  toast('✅ Профіль збережено');
  go('me');
}

// ================= РЕЄСТРАЦІЯ =================
function buildEmojiGrid() {
  $('reg-emojis').innerHTML = EMOJIS.map(e =>
    `<div class="em ${e === regEmoji ? 'sel' : ''}" data-em="${e}" onclick="regPickEmoji('${e}', this)">${e}</div>`).join('');
}
function regPickEmoji(em, el) {
  regEmoji = em;
  document.querySelectorAll('#reg-emojis .em').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
}
async function tryRegister() {
  const raw = $('reg-name').value.trim();
  if (!raw) { $('reg-err').textContent = 'Вкажіть ім\u0027я або нік'; return; }
  const name = raw.replace(/__/g, '_').replace(/["'<>]/g, '').slice(0, 24);
  if (!name) { $('reg-err').textContent = 'Ім\u0027я містить неприпустимі символи'; return; }
  $('reg-btn').disabled = true;
  $('reg-err').textContent = '';
  // Перевірка колізії імен до запису
  await loadProfiles();
  if (profiles[name]) {
    $('reg-btn').disabled = false;
    $('reg-err').textContent = 'Це ім\u0027я вже зайняте. Оберіть інше.';
    return;
  }
  me = name;
  const profile = { name: name, emoji: regEmoji, status: '', city: '', about: '', joined: Date.now() };
  const ok = await registerOnGitHub(profile);
  if (!ok) {
    // можливо ім'я зайняте — перевіримо і підкажемо
    const exists = profiles[name];
    me = null;
    $('reg-btn').disabled = false;
    $('reg-err').textContent = exists ? 'Це ім\u0027я вже зайняте. Оберіть інше.' : 'Не вдалося зберегти профіль. Перевірте інтернет і спробуйте ще раз.';
    return;
  }
  myProfile = profile;
  localStorage.setItem(LS_USER, me);
  $('reg-mask').classList.add('hidden');
  renderHeader();
  await refreshAll();
  renderScreen();
  toast('👋 Вітаємо у Спільноті, ' + name + '!');
}

// ================= СТАРТ =================
async function refreshAll() {
  await Promise.all([loadProfiles(), loadWall(), loadDialogsIndex()]);
}
async function init() {
  buildEmojiGrid();
  me = localStorage.getItem(LS_USER);
  if (me && profiles[me]) myProfile = profiles[me];
  await refreshAll();
  if (me && profiles[me]) myProfile = profiles[me];
  if (!me) {
    $('reg-mask').classList.remove('hidden');
    renderHeader();
    renderScreen();
  } else {
    renderHeader();
    renderScreen();
  }
  startPolling();
  window.addEventListener('hashchange', () => {
    if (!me) return;
    // при відкритті діалогу — завантажити повідомлення
    const { screen, param } = parseHash();
    if (screen === 'dialog') {
      const key = dialogKey(me, decodeURIComponent(param));
      loadDialogMsgs(key).then(() => renderScreen());
    } else {
      renderScreen();
    }
  });
}
window.addEventListener('load', init);
