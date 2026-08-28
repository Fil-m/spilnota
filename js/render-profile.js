// render-profile.js — рендер профілю: моя сторінка, редагування, повідомлення

// ---- Профіль іншого користувача ----
function renderUserPage(nick) {
  const data = userPageCache[nick];
  const posts = wallCache.posts.filter(x => x.repoOwner === nick).sort((a, b) => b.ts - a.ts);
  const canMsg = me && me !== nick && moduleEnabled('chat');
  const av = avatarDataFor(nick);
  const bigAvatar = av
    ? `<canvas class="profile-avatar" id="profile-avatar-canvas" width="240" height="240" data-av="${esc(nick)}"></canvas>`
    : `<div class="profile-avatar" style="background:${avatarColor(nick)}">🙂</div>`;
  const profile = data ? data.profile : null;
  const displayName = (profile && profile.name && profile.name !== nick) ? profile.name : nick;
  const hidden = profile && profile.showProjects === false;
  const projects = data ? data.projects : null;
  let projectsBlock = '';
  if (hidden) {
    projectsBlock = `<div class="card"><div class="card-title">Проекти та сторінки</div><div class="empty">🙈 ${esc(nick)} приховав свої проекти</div></div>`;
  } else if (projects === null) {
    projectsBlock = `<div class="card"><div class="card-title">Проекти та сторінки</div><div class="empty">Завантаження проектів з GitHub...</div></div>`;
  } else if (projects.length) {
    projectsBlock = `
    <div class="card">
      <div class="card-title">Проекти та сторінки (${projects.length})
        <button class="btn gray proj-refresh" onclick="refreshUserProjects('${esc(nick)}')" title="Оновити">⟳</button>
      </div>
      ${projects.map(userProjectCard).join('')}
    </div>`;
  } else {
    projectsBlock = `<div class="card"><div class="card-title">Проекти та сторінки</div><div class="empty">Немає публічних проектів</div></div>`;
  }
  CONTENT().innerHTML = `
    <div class="card">
      <div class="profile-head">
        ${bigAvatar}
        <div class="profile-info">
          <div class="profile-name">${esc(displayName)} <span class="online">● в мережі</span></div>
          <div class="profile-dt"><b>Репозиторій:</b> <a href="https://github.com/${esc(nick)}/${esc(CONFIG.repoPrefix + nick)}" target="_blank">${esc(CONFIG.repoPrefix + nick)} ↗</a></div>
          ${canMsg ? `<div class="btn-row"><button class="btn" onclick="go('dialog/' + encodeURIComponent('${nick}'))">💬 Написати повідомлення</button></div>` : ''}
        </div>
      </div>
    </div>
    ${projectsBlock}
    ${moduleEnabled('wall') ? `
    <div class="card">
      <div class="card-title">Стіна ${esc(nick)}</div>
      ${renderPostList(posts)}
    </div>` : ''}`;
  const pav = $('profile-avatar-canvas');
  if (pav) initAvatarAnim(pav);
  // асинхронне довантаження профілю + проектів (кеш 60с)
  if (!data) {
    loadUserPage(nick).then(() => {
      if (parseHash().screen === 'user' && parseHash().param === nick) renderUserPage(nick);
    });
  }
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
      <div style="height:8px"></div>
      <label>Приватність</label>
      <div class="set-row">
        <div class="set-info">
          <div class="set-name">Проекти та сторінки</div>
          <div class="set-desc">Показувати мої проекти та сторінки іншим учасникам</div>
        </div>
        <label class="switch"><input type="checkbox" id="e-showprojects" ${p.showProjects === false ? '' : 'checked'}><span class="slider"></span></label>
      </div>
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

