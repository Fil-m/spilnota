// app.js — поллінг і старт застосунку

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
      const ov = (mod.custom ? SPILNOTA.customs[mod.id] : SPILNOTA.overrides[mod.id]) || null;
      if (ov && typeof ov.poll === 'function') {
        await ov.poll();
      } else {
        if (mod.poll === 'wall' || screen === 'me' || screen === 'user') await refreshWall();
        if (mod.poll === 'dialogs' || screen === 'messages') await refreshDialogs();
        if (mod.poll === 'groups' || screen === 'groups' || screen === 'group') {
          await refreshGroups();
          if (screen === 'group') await refreshGroupWall();
        }
        if (mod.poll === 'apps' || screen === 'apps' || screen === 'app') { await refreshApps(); await refreshAppCats(); }
      }
      if (screen === 'settings') await refreshModules();
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
// ================= СТАРТ =================
async function refreshAll() {
  await searchParticipants(true);
  await Promise.all([refreshWall(), refreshLikes(), refreshComments(), refreshDialogs(), loadMyProfile(), refreshAvatars(), refreshGroups(), refreshApps(), refreshAppCats(), refreshModules()]);
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
    await applyModuleVersions();
    renderScreen();
    startPolling();
  }
  window.addEventListener('hashchange', () => {
    if (!me) return;
    const { screen } = parseHash();
    const mod = moduleOfScreen(screen);
    if (!mod || !moduleEnabled(mod.id)) { go(firstEnabledScreen()); return; }
    if (screen === 'dialog') { refreshDialogs().then(() => renderScreen()); }
    else if (screen === 'group') { refreshGroups().then(() => refreshGroupWall()).then(() => renderScreen()); }
    else if (screen === 'app') { refreshApps().then(() => refreshAppCats()).then(() => renderScreen()); }
    else if (screen === 'settings') { refreshModules().then(() => renderScreen()); }
    else renderScreen();
  });
}
window.addEventListener('load', init);
