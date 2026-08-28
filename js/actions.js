// actions.js — дії: пости, лайки, коментарі, повідомлення, вхід через токен

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
    showProjects: $('e-showprojects') ? $('e-showprojects').checked : (myProfile.showProjects !== false),
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
    const existingProfile = await readApiFile(me, repoName, 'data/profile.json');
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
