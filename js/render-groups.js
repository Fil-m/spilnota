// render-groups.js — рендер груп: список, сторінка групи, адмінка

// ---- Групи ----
function renderGroups() {
  const all = Object.values(groupsCache).sort((a, b) => (b.created || 0) - (a.created || 0));
  const mine = myGroups();
  const other = all.filter(g => !mine.some(m => m.id === g.id));
  CONTENT().innerHTML = `
    <div class="card">
      <div class="card-title">Групи</div>
      <div class="quick-post">
        ${avatarHtml(me, myProfile.emoji, 'sm')}
        <input class="input" id="g-name-in" placeholder="Назва нової групи..." maxlength="60">
        <select class="input g-type-sel" id="g-type-sel" title="Тип групи">
          <option value="private">🔒 Приватна</option>
          <option value="public">🌍 Загальна</option>
        </select>
        <button class="btn" onclick="createGroupPrompt()">Створити групу</button>
      </div>
      <div class="err" id="g-create-err"></div>
    </div>
    <div class="card">
      <div class="card-title">Мої групи (${mine.length})</div>
      ${mine.length ? `<div class="people-grid">${mine.map(groupCard).join('')}</div>` : '<div class="empty">Ви ще не в групах</div>'}
    </div>
    ${other.length ? `<div class="card">
      <div class="card-title">Інші групи спільноти (${other.length})</div>
      <div class="people-grid">${other.map(groupCard).join('')}</div>
    </div>` : ''}`;
}
function groupCard(g) {
  const members = groupMembers(g);
  const isMine = g.admin === me;
  return `
    <div class="person" onclick="go('group/' + encodeURIComponent('${g.id}'))">
      <div class="p-avatar g-emoji">${esc(g.emoji || '👪')}</div>
      <div class="p-name">${esc(g.name)} ${g.type === 'public' ? '🌍' : '🔒'}</div>
      <div class="offline">${g.type === 'public' ? 'Загальна' : 'Приватна'} · ${members.length} уч. · ${isMine ? 'я адмін' : 'адмін: ' + esc(g.admin)}</div>
    </div>`;
}
async function createGroupPrompt() {
  const name = ($('g-name-in') || {}).value || '';
  if (!name.trim()) { $('g-create-err').textContent = 'Вкажіть назву групи'; return; }
  $('g-create-err').textContent = '';
  const type = ($('g-type-sel') || {}).value === 'public' ? 'public' : 'private';
  const id = await createGroup(name.trim(), '', '👪', type);
  if (id) go('group/' + encodeURIComponent(id));
}
function renderGroup(gid) {
  currentGroupId = gid;
  const g = groupsCache[gid];
  if (!g) {
    CONTENT().innerHTML = `<div class="card"><div class="card-title">Група</div><div class="empty">Завантаження групи...</div></div>`;
    refreshGroups().then(() => renderScreen());
    return;
  }
  const members = groupMembers(g);
  const isAdmin = g.admin === me;
  const isMember = members.includes(me);
  const posts = groupWallCache.filter(p => p.repoOwner && members.includes(p.repoOwner)).sort((a, b) => b.ts - a.ts);
  CONTENT().innerHTML = `
    <div class="card">
      <div class="profile-head">
        <div class="profile-avatar g-big">${esc(g.emoji || '👪')}</div>
        <div class="profile-info">
          <div class="profile-name">${esc(g.name)} ${isAdmin ? '<span class="g-admin-badge">адмін</span>' : ''} ${g.type === 'public' ? '<span class="g-admin-badge">🌍 загальна</span>' : '<span class="g-admin-badge">🔒 приватна</span>'}</div>
          <div class="profile-status">${esc(g.desc || '')}</div>
          <div class="profile-dt"><b>Адмін:</b> <a href="#/user/${encodeURIComponent(g.admin)}">${esc(g.admin)}</a></div>
          <div class="profile-dt"><b>Учасники (${members.length}):</b> ${members.map(m => `<a href="#/user/${encodeURIComponent(m)}" class="g-member">${esc(m)}</a>`).join(' ')}</div>
          <div class="btn-row">
            ${!isMember && !isAdmin ? `<button class="btn" onclick="joinGroup('${g.id}')">${g.type === 'public' ? '🙋 Вступити' : '🙋 Подати заявку'}</button>` : ''}
            ${isMember && !isAdmin && g.type === 'public' ? `<button class="btn gray" onclick="leaveGroup('${g.id}')">🚪 Вийти</button>` : ''}
            ${isAdmin ? `<button class="btn gray" onclick="toggleGroupEdit('${g.id}')">✏ Редагувати</button>` : ''}
            ${isAdmin && g.type !== 'public' ? `<button class="btn gray" onclick="toggleGroupAdmin('${g.id}')">⚙️ Керування</button>` : ''}
          </div>
          ${isAdmin && g.type !== 'public' ? `
          <div id="g-admin-panel" class="hidden">
            <div class="set-group-title">Додати учасника</div>
            <div class="quick-post">
              <input class="input" id="g-add-in" placeholder="Логін учасника (нік у репо)..." maxlength="40">
              <button class="btn gray" onclick="gAddMember('${g.id}')">Додати</button>
            </div>
            <div class="set-group-title">Видалити учасника</div>
            <div class="g-members-admin">
              ${members.filter(m => m !== g.admin).map(m => `<span class="g-member-admin">${esc(m)} <a href="javascript:void(0)" onclick="gRemoveMember('${g.id}','${m}')" title="Видалити">✕</a></span>`).join(' ') || '<div class="empty">Тільки адмін</div>'}
            </div>
          </div>` : ''}
          <div id="g-edit-panel" class="hidden">
            <div style="height:8px"></div>
            <label>Назва</label>
            <input class="input" id="ge-name" maxlength="60" value="${esc(g.name)}">
            <div style="height:8px"></div>
            <label>Опис</label>
            <textarea class="textarea" id="ge-desc" maxlength="300" placeholder="Про що група?">${esc(g.desc || '')}</textarea>
            <div style="height:8px"></div>
            <button class="btn" onclick="gSaveEdit('${g.id}')">Зберегти</button>
          </div>
        </div>
      </div>
    </div>
    ${isMember || isAdmin ? `
    <div class="card">
      <div class="card-title">Стіна групи</div>
      <div class="quick-post">
        ${avatarHtml(me, myProfile.emoji, 'sm')}
        <input class="input" id="g-new-post" placeholder="Пост у групу..." maxlength="2000">
        <button class="btn" onclick="submitGroupPost()">Написати</button>
      </div>
    </div>
    ${groupPostList(posts, gid)}` : `<div class="card"><div class="empty">Вступіть у групу, щоб бачити стіну</div></div>`}`;
  const inp = $('g-new-post');
  if (inp) inp.onkeydown = e => { if (e.key === 'Enter') submitGroupPost(); };
  const addInp = $('g-add-in');
  if (addInp) addInp.onkeydown = e => { if (e.key === 'Enter') gAddMember(gid); };
}
function groupPostList(posts, gid) {
  if (!posts.length) return `<div class="card"><div class="empty">У групі поки що тихо. Напишіть перший пост!</div></div>`;
  return posts.map(p => {
    const liked = groupLikesCache.some(l => l.postId === p.id && l.liker === me);
    const likes = groupLikesCache.filter(l => l.postId === p.id);
    const comments = groupCommentsCache.filter(c => c.postId === p.id).sort((a, b) => a.ts - b.ts);
    return `
    <div class="card post">
      <div class="post-head">
        ${avatarHtml(p.repoOwner, '🙂')}
        <div class="post-info">
          <div><a class="post-author" href="#/user/${encodeURIComponent(p.repoOwner)}">${esc(p.repoOwner)}</a>
          <span class="post-time"> · ${timeAgo(p.ts)}</span></div>
          <div class="post-text">${renderPostText(p.text)}</div>
        </div>
      </div>
      <div class="post-actions">
        <a href="javascript:void(0)" class="${liked ? 'liked' : ''}" onclick="toggleGroupLike('${p.id}')">👍 Мені подобається${likes.length ? ' (' + likes.length + ')' : ''}</a>
        <a href="javascript:void(0)" onclick="focusGroupComment('${p.id}')">💬 Коментувати${comments.length ? ' (' + comments.length + ')' : ''}</a>
      </div>
      ${comments.length ? `<div class="comments">${comments.map(c => `
        <div class="comment">${avatarHtml(c.author, '🙂', 'xs')}
          <div class="c-body"><span class="c-author">${esc(c.author)}</span> <span class="c-text">${renderPostText(c.text)}</span>
          <div class="c-time">${timeAgo(c.ts)}</div></div></div>`).join('')}</div>` : ''}
      <div class="comments hidden" id="gcmt-${p.id}">
        <div class="comment-input">
          ${avatarHtml(me, myProfile.emoji, 'xs')}
          <input class="input" id="gc-in-${p.id}" placeholder="Написати коментар..." maxlength="500">
          <button class="btn gray" onclick="submitGroupComment('${p.id}')">OK</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function toggleGroupAdmin() {
  const el = $('g-admin-panel');
  if (el) el.classList.toggle('hidden');
}
function toggleGroupEdit() {
  const el = $('g-edit-panel');
  if (el) el.classList.toggle('hidden');
}
async function gAddMember(gid) {
  const inp = $('g-add-in');
  const login = (inp ? inp.value : '').trim();
  if (!login) { toast('Вкажіть логін'); return; }
  if (inp) inp.value = '';
  await addMember(gid, login);
  await refreshGroupWall();
  renderScreen();
}
async function gRemoveMember(gid, login) {
  await removeMember(gid, login);
  await refreshGroupWall();
  renderScreen();
}
async function gSaveEdit(gid) {
  const name = ($('ge-name') || {}).value || '';
  const desc = ($('ge-desc') || {}).value || '';
  if (!name.trim()) { toast('Назва не може бути порожньою'); return; }
  const ok = await updateGroup(gid, name.trim(), desc);
  if (ok) { toggleGroupEdit(); renderScreen(); }
}

