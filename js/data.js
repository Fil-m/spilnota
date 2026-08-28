// data.js — стан і синхронізація даних: стіна, лайки, коментарі, діалоги, групи

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
// групи: groupsCache[id] = {id, name, desc, emoji, admin, members:[], created}
// groupWallCache = [{id, groupId, author, text, ts, repoOwner}]
let groupsCache = {};
let groupRegOwners = {}; // gid -> [логіни, у кого група є у СВОЄМУ реєстрі] — для загальних груп
let groupWallCache = [];
let groupLikesCache = [];
let groupCommentsCache = [];
let currentGroupId = null;
let lastRenderSig = '';
let lastSearch = 0;
let projectsCache = null;
let userPageCache = {};    // nick -> {profile, projects, ts} — для сторінки іншого юзера
let userProjectsCache = {}; // nick -> {ts, repos} — публічні репо іншого юзера
let projectsLoading = false;
const AVATAR_COLORS = ['#45688E','#4C6E99','#5E81A8','#2B7A6E','#7A5E8E','#8E5E5E','#5E8E6E','#8E7A5E','#4E7291','#6E4E91'];
const EMOJIS = ['🦊','🐱','🐶','🐻','🐼','🦁','🐸','🐵','🐨','🐰','🦄','🐲','🐳','🦉','🐺','🦋','🐝','🐢','🐙','🦀','🌻','🍀','🔥','⭐','🌙','⚡','🎮','🎬','🎵','📚','🎨','🧩'];
// ================= СТРІЧКА =================
async function refreshWall() {
  const list = await searchParticipants();
  const posts = [];
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const w = await readApiFile(p.login, p.repo, 'data/wall.json');
      if (w && Array.isArray(w.posts)) posts.push(...w.posts.map(x => ({ ...x, repoOwner: p.login })));
    } catch (e) { }
  }
  const myW = await readMyFile('data/wall.json', { posts: [] });
  if (myW && Array.isArray(myW.posts)) posts.push(...myW.posts.map(x => ({ ...x, repoOwner: me })));
  // merge по id зі старим кешем — щойно опубліковане не зникає при CDN-лагу чи 500 від API
  const byId = new Map(wallCache.posts.map(x => [x.id, x]));
  for (const p of posts) byId.set(p.id, p);
  wallCache.posts = [...byId.values()].sort((a, b) => b.ts - a.ts);
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
      const d = await readApiFile(p.login, p.repo, 'data/likes.json');
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
      const d = await readApiFile(p.login, p.repo, 'data/comments.json');
      if (d && Array.isArray(d.comments)) comments.push(...d.comments.map(x => ({ ...x, author: p.login })));
    } catch (e) { }
  }
  commentsCache = comments;
}
async function profileOf(login) {
  if (login === me) return myProfile;
  try {
    const p = await readApiFile(login, CONFIG.repoPrefix + login, 'data/profile.json');
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
  const fresh = {};
  for (const p of list) {
    if (p.login === me) continue;
    const msgs = await readMyFile('data/outbox/' + p.login + '.json', []);
    if (Array.isArray(msgs) && msgs.length) fresh[p.login] = [...(fresh[p.login] || []), ...msgs];
  }
  for (const p of list) {
    if (p.login === me) continue;
    try {
      // Чужі повідомлення — через Contents API (ETag/304), НЕ raw CDN:
      // raw кешує ~5 хв, тому чужі листи приходили з затримкою хвилини.
      const msgs = await readApiFile(p.login, p.repo, 'data/outbox/' + me + '.json');
      if (Array.isArray(msgs) && msgs.length) fresh[p.login] = [...(fresh[p.login] || []), ...msgs];
    } catch (e) { }
  }
  // merge по id зі старим кешем — свої щойно відправлені повідомлення не зникають
  // поки raw CDN або API не віддадуть свіжу версію
  for (const k in dialogsCache) {
    const old = dialogsCache[k] || [];
    const have = new Set((fresh[k] || []).map(m => m.id));
    const missing = old.filter(m => !have.has(m.id));
    if (missing.length) fresh[k] = [...(fresh[k] || []), ...missing];
  }
  for (const k in fresh) fresh[k].sort((a, b) => a.ts - b.ts);
  dialogsCache = fresh;
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
// ================= ГРУПИ =================
// Група = метадані у репо адміна (data/groups/<id>.json: name, desc, emoji, admin, members[]).
// Реєстр груп — кожен учасник тримає у своєму репо data/groups.json (список груп, де він є).
// Стіна групи — data/gwall/<id>.json у кожного учасника; лайки/коментарі аналогічно.
async function refreshGroups() {
  const list = await searchParticipants();
  const fresh = {};
  const owners = {}; // gid -> [logins] — хто має групу у своєму реєстрі (для загальних груп)
  // свій реєстр — завжди
  const myG = await readMyFile('data/groups.json', { groups: [] });
  if (myG && Array.isArray(myG.groups)) for (const g of myG.groups) {
    if (g && g.id) { if (!fresh[g.id]) fresh[g.id] = { ...g }; (owners[g.id] = owners[g.id] || []).push(me); }
  }
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const d = await readApiFile(p.login, p.repo, 'data/groups.json');
      if (d && Array.isArray(d.groups)) for (const g of d.groups) {
        if (g && g.id) { if (!fresh[g.id]) fresh[g.id] = { ...g }; (owners[g.id] = owners[g.id] || []).push(p.login); }
      }
    } catch (e) { }
  }
  // повні метадані (опис, учасники) — з репо АДМІНА: data/groups/<id>.json
  for (const id in fresh) {
    const g = fresh[id];
    const admin = g.admin || me;
    try {
      let full = null;
      if (admin === me) full = await readMyFile('data/groups/' + id + '.json', null);
      else full = await readApiFile(admin, CONFIG.repoPrefix + admin, 'data/groups/' + id + '.json');
      if (full && full.id) fresh[id] = { ...fresh[id], ...full };
    } catch (e) { }
  }
  // merge зі старим кешем: локально створені групи не зникають поки CDN не оновиться
  for (const id in groupsCache) if (!fresh[id]) fresh[id] = groupsCache[id];
  groupRegOwners = owners;
  groupsCache = fresh;
}
function myGroups() {
  return Object.values(groupsCache).filter(g => Array.isArray(g.members) ? g.members.includes(me) : g.admin === me);
}
function groupMembers(g) {
  // Загальна група: учасники = адмін + всі, у кого група у СВОЄМУ реєстрі (вступили самі)
  if (g && g.type === 'public') {
    const owners = groupRegOwners[g.id] || [];
    return g.admin ? [...new Set([g.admin, ...owners])] : owners;
  }
  if (Array.isArray(g.members)) return g.members;
  return g.admin ? [g.admin] : [];
}
async function refreshGroupWall() {
  const gid = currentGroupId;
  if (!gid) { groupWallCache = []; groupLikesCache = []; groupCommentsCache = []; return; }
  const g = groupsCache[gid];
  const members = g ? groupMembers(g) : [me];
  const fresh = [], likes = [], comments = [];
  for (const m of members) {
    if (m === me) {
      const myW = await readMyFile('data/gwall/' + gid + '.json', { posts: [] });
      if (myW && Array.isArray(myW.posts)) fresh.push(...myW.posts.map(x => ({ ...x, repoOwner: m })));
      const myL = await readMyFile('data/glikes/' + gid + '.json', { likes: [] });
      if (myL && Array.isArray(myL.likes)) likes.push(...myL.likes.map(x => ({ ...x, liker: m })));
      const myC = await readMyFile('data/gcomments/' + gid + '.json', { comments: [] });
      if (myC && Array.isArray(myC.comments)) comments.push(...myC.comments.map(x => ({ ...x, author: m })));
    } else {
      try {
        const w = await readApiFile(m, CONFIG.repoPrefix + m, 'data/gwall/' + gid + '.json');
        if (w && Array.isArray(w.posts)) fresh.push(...w.posts.map(x => ({ ...x, repoOwner: m })));
      } catch (e) { }
      try {
        const l = await readApiFile(m, CONFIG.repoPrefix + m, 'data/glikes/' + gid + '.json');
        if (l && Array.isArray(l.likes)) likes.push(...l.likes.map(x => ({ ...x, liker: m })));
      } catch (e) { }
      try {
        const c = await readApiFile(m, CONFIG.repoPrefix + m, 'data/gcomments/' + gid + '.json');
        if (c && Array.isArray(c.comments)) comments.push(...c.comments.map(x => ({ ...x, author: m })));
      } catch (e) { }
    }
  }
  const byId = new Map(groupWallCache.map(x => [x.id, x]));
  for (const p of fresh) byId.set(p.id, p);
  groupWallCache = [...byId.values()].sort((a, b) => b.ts - a.ts);
  groupLikesCache = likes;
  groupCommentsCache = comments;
}
async function createGroup(name, desc, emoji, type) {
  const id = uid();
  const g = { id, name, desc: desc || '', emoji: emoji || '👪', admin: me, members: [me], type: type === 'public' ? 'public' : 'private', created: Date.now() };
  const ok = await writeMyFile('data/groups/' + id + '.json', g);
  if (!ok) { toast('❌ Не вдалося створити групу'); return null; }
  const reg = await readMyFile('data/groups.json', { groups: [] });
  reg.groups = reg.groups || [];
  if (!reg.groups.find(x => x.id === id)) reg.groups.push({ id, name: g.name, emoji: g.emoji, admin: me });
  await writeMyFile('data/groups.json', reg);
  groupsCache[id] = g;
  return id;
}
async function joinGroup(id) {
  const g = groupsCache[id];
  if (!g) return;
  if (g.admin === me) return;
  if (g.type === 'public') {
    // загальна група — вступ миттєвий: додаємо групу у СВІЙ реєстр (data/groups.json)
    const reg = await readMyFile('data/groups.json', { groups: [] });
    reg.groups = reg.groups || [];
    if (!reg.groups.find(x => x.id === id)) {
      reg.groups.push({ id, name: g.name, emoji: g.emoji, admin: g.admin, joined: Date.now() });
      const ok = await writeMyFile('data/groups.json', reg);
      if (!ok) { toast('❌ Не вдалося вступити'); return false; }
    }
    groupRegOwners[id] = [...new Set([...(groupRegOwners[id] || []), me])];
    groupsCache[id] = { ...g };
    await refreshGroupWall();
    renderScreen();
    toast('✅ Ви у групі «' + g.name + '»');
    return true;
  }
  // приватна група — заявка на вступ: пишемо адміну у його репо через outbox (адмін побачить у чаті)
  const ok = await sendMessage(g.admin, '🙋 Заявка у групу «' + g.name + '»: вступ');
  if (ok) toast('📨 Заявку надіслано адміну (' + g.admin + ')');
  return ok;
}
async function leaveGroup(id) {
  const g = groupsCache[id];
  if (!g || g.admin === me) return false;
  if (g.type !== 'public') { toast('Приватну групу можна покинути через адміна'); return false; }
  const reg = await readMyFile('data/groups.json', { groups: [] });
  reg.groups = (reg.groups || []).filter(x => x.id !== id);
  const ok = await writeMyFile('data/groups.json', reg);
  if (!ok) { toast('❌ Не вдалося вийти'); return false; }
  groupRegOwners[id] = (groupRegOwners[id] || []).filter(x => x !== me);
  groupsCache[id] = { ...g };
  if (currentGroupId === id) { groupWallCache = []; groupLikesCache = []; groupCommentsCache = []; }
  renderScreen();
  toast('🚪 Ви вийшли з групи');
  return true;
}
async function addMember(id, login) {
  const g = groupsCache[id];
  if (!g || g.admin !== me) return false;
  const members = groupMembers(g);
  if (members.includes(login)) { toast('Вже учасник'); return true; }
  members.push(login);
  g.members = members;
  const ok = await writeMyFile('data/groups/' + id + '.json', g);
  if (ok) {
    groupsCache[id] = { ...g };
    toast('✅ ' + login + ' додано до групи');
  } else toast('❌ Не вдалося оновити групу');
  return ok;
}
async function removeMember(id, login) {
  const g = groupsCache[id];
  if (!g || g.admin !== me) return false;
  if (login === g.admin) { toast('Адміна не можна видалити'); return false; }
  g.members = groupMembers(g).filter(m => m !== login);
  const ok = await writeMyFile('data/groups/' + id + '.json', g);
  if (ok) { groupsCache[id] = { ...g }; toast('🗑 ' + login + ' видалено з групи'); }
  else toast('❌ Не вдалося оновити групу');
  return ok;
}
async function updateGroup(id, name, desc, emoji) {
  const g = groupsCache[id];
  if (!g || g.admin !== me) return false;
  g.name = name; g.desc = desc || ''; g.emoji = emoji || g.emoji;
  const ok = await writeMyFile('data/groups/' + id + '.json', g);
  if (ok) { groupsCache[id] = { ...g }; toast('✅ Групу оновлено'); }
  else toast('❌ Не вдалося зберегти');
  return ok;
}
async function submitGroupPost(text) {
  const gid = currentGroupId;
  const inp = $('g-new-post');
  const t = (text != null ? text : (inp ? inp.value : '')).trim();
  if (!t) { toast('✏ Напишіть щось'); return; }
  const g = groupsCache[gid];
  if (!g || !groupMembers(g).includes(me)) { toast('Ви не учасник групи'); return; }
  if (inp) inp.value = '';
  const post = { id: uid(), author: me, text: t, ts: Date.now() };
  const w = await readMyFile('data/gwall/' + gid + '.json', { posts: [] });
  w.posts = w.posts || [];
  w.posts.push(post);
  const ok = await writeMyFile('data/gwall/' + gid + '.json', w);
  if (ok) {
    groupWallCache.push({ ...post, repoOwner: me });
    groupWallCache.sort((a, b) => b.ts - a.ts);
    renderScreen();
  } else toast('❌ Не вдалося зберегти');
}
async function toggleGroupLike(postId) {
  const gid = currentGroupId;
  const d = await readMyFile('data/glikes/' + gid + '.json', { likes: [] });
  d.likes = d.likes || [];
  const i = d.likes.findIndex(l => l.postId === postId && l.liker === me);
  if (i >= 0) d.likes.splice(i, 1); else d.likes.push({ postId, liker: me, ts: Date.now() });
  const ok = await writeMyFile('data/glikes/' + gid + '.json', d);
  if (ok) { await refreshGroupWall(); renderScreen(); }
  else toast('❌ Не вдалося зберегти');
}
async function submitGroupComment(postId, text) {
  const gid = currentGroupId;
  const inp = $('gc-in-' + postId);
  const t = (text != null ? text : (inp ? inp.value : '')).trim();
  if (!t) return;
  if (inp) inp.value = '';
  const d = await readMyFile('data/gcomments/' + gid + '.json', { comments: [] });
  d.comments = d.comments || [];
  d.comments.push({ postId, author: me, text: t, ts: Date.now() });
  const ok = await writeMyFile('data/gcomments/' + gid + '.json', d);
  if (ok) { await refreshGroupWall(); renderScreen(); }
}
function focusGroupComment(postId) {
  const el = $('gcmt-' + postId);
  if (el) el.classList.remove('hidden');
  const inp = $('gc-in-' + postId);
  if (inp) inp.focus();
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
