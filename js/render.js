// render.js — роутер, навігація, renderScreen і базова стіна

// ================= РОУТЕР =================
function parseHash() {
  let h = location.hash.replace(/^#\/?/, '') || 'me';
  const parts = h.split('/');
  return { screen: parts[0] || 'me', param: decodeURIComponent(parts[1] || '') };
}
function go(url) { location.hash = url; }
function moduleOfScreen(screen) {
  const m = MODULE_DEFS.find(m => m.screens.includes(screen));
  if (m) return m;
  for (const id in SPILNOTA.customs) {
    const c = SPILNOTA.customs[id];
    if ((c.screens || []).includes(screen)) return { id, name: c.name, icon: c.icon, screens: c.screens, custom: true };
  }
  return null;
}
function firstEnabledScreen() {
  for (const m of MODULE_DEFS) if (moduleEnabled(m.id)) return m.screens[0];
  for (const id in SPILNOTA.customs) if (moduleEnabled(id)) return SPILNOTA.customs[id].screens[0];
  return 'settings';
}

// ================= РЕНДЕР =================
const CONTENT = () => $('content');
function currentSig(screen) {
  return screen + '|' + wallCache.posts.length + '|' + Object.keys(dialogsCache).length + '|' + unreadCount()
    + '|' + Object.keys(groupsCache).length + '|' + groupWallCache.length + '|' + appsCache.length + '|' + modulesCache.length + '|' + Object.keys(appPageCats).length + '|' + Object.keys(appPageOwners).length;
}
function renderNav() {
  const { screen } = parseHash();
  const cfg = getCfg();
  const customDefs = Object.values(SPILNOTA.customs).filter(m => moduleEnabled(m.id));
  const menuDefs = [...MODULE_DEFS.filter(m => moduleEnabled(m.id)), ...customDefs];
  // ліве меню
  const menu = $('sidebar').querySelector('.menu');
  menu.innerHTML = menuDefs
    .map(m => {
      const counter = m.id === 'chat' && unreadCount() ? `<span class="counter">${unreadCount()}</span>` : '';
      return `<li><a href="#/${m.screens[0]}" data-nav="${m.id}" class="${m.screens.includes(screen) ? 'active' : ''}"><span class="mi">${m.icon}</span> ${m.name}${counter}</a></li>`;
    }).join('');
  // нижня навігація
  const bn = $('bottom-nav');
  bn.innerHTML = menuDefs
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
  // заміна базового модуля чужим кодом (v23)
  const baseMod = MODULE_DEFS.find(m => m.screens.includes(screen));
  if (baseMod && SPILNOTA.overrides[baseMod.id] && typeof SPILNOTA.overrides[baseMod.id].render === 'function') {
    SPILNOTA.overrides[baseMod.id].render(screen, param);
    renderNav(); drawAvatars(); loadScEmbeds();
    lastRenderSig = currentSig(screen);
    return;
  }
  // новий кастомний модуль (v23)
  if (mod.custom && SPILNOTA.customs[mod.id] && typeof SPILNOTA.customs[mod.id].render === 'function') {
    SPILNOTA.customs[mod.id].render(screen, param);
    renderNav(); drawAvatars(); loadScEmbeds();
    lastRenderSig = currentSig(screen);
    return;
  }
  switch (screen) {
    case 'me': renderMyPage(); break;
    case 'edit': renderEdit(); break;
    case 'feed': renderFeed(); break;
    case 'messages': renderMessages(); break;
    case 'dialog': renderDialog(param); break;
    case 'people': renderPeople(); break;
    case 'groups': renderGroups(); break;
    case 'group': renderGroup(param); break;
    case 'projects': renderProjects(); break;
    case 'pages': renderPages(); break;
    case 'apps': renderApps(); break;
    case 'app': renderApp(param); break;
    case 'avatar': renderAvatar(); break;
    case 'user': renderUserPage(param); break;
    case 'settings': renderSettings(); break;
    default: renderMyPage();
  }
  renderNav();
  drawAvatars();
  loadScEmbeds();
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
            <button class="btn gray" onclick="go('avatar')">📸 Фото-аватар</button>
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
        <div class="post-text">${renderPostText(post.text)}</div>
      </div>
    </div>
    <div class="post-actions">
      <a href="javascript:void(0)" class="${liked ? 'liked' : ''}" onclick="toggleLike('${owner}','${post.id}')">👍 Мені подобається${likes.length ? ' (' + likes.length + ')' : ''}</a>
      <a href="javascript:void(0)" onclick="focusComment('${owner}','${post.id}')">💬 Коментувати${comments.length ? ' (' + comments.length + ')' : ''}</a>
    </div>
    ${comments.length ? `<div class="comments">${comments.map(c => `
      <div class="comment">${avatarHtml(c.author, '🙂', 'xs')}
        <div class="c-body"><span class="c-author">${esc(c.author)}</span> <span class="c-text">${renderPostText(c.text)}</span>
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

