// api.js — транспорт GitHub Contents API + пошук учасників

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
// Чужий файл через Contents API з ETag-кешем: свіжий ОДРАЗУ після PUT,
// а 304 (не змінився) не витрачає rate limit. raw залишаємо fallback-ом
// на випадок, коли токен не має доступу до чужого репо.
// Фікс затримки чату: raw CDN кешує ~5 хв — чужі повідомлення приходили
// з запізненням у хвилини (симптом «чат працює з затримкою ~8 хв»).
const apiFileCache = {};
async function readApiFile(owner, repo, path) {
  const key = owner + '/' + repo + '/' + path;
  const headers = {};
  const hit = apiFileCache[key];
  if (hit) headers['If-None-Match'] = hit.etag;
  try {
    const r = await gh(`/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (r.status === 304 && hit) return hit.data;
    // 404 може означати «файлу нема» АБО «токен без доступу до чужого репо»
    // (GitHub ховає такі запити) — у другому випадку рятує raw (публічне репо).
    if (r.status === 404) return readFile(owner, repo, path);
    if (!r.ok) throw new Error(path + ' -> ' + r.status);
    const d = await r.json();
    const data = (d && d.content) ? JSON.parse(fromBase64(d.content.replace(/\n/g, ''))) : null;
    apiFileCache[key] = { etag: r.headers.get('ETag'), data };
    return data;
  } catch (e) {
    return readFile(owner, repo, path);
  }
}
async function readMyFile(path, fallback) {
  try {
    // Свій файл — через Contents API з токеном: raw.githubusercontent.com — CDN з кешем,
    // після PUT може віддавати СТАРУ версію (свої щойно відправлені повідомлення зникали)
    const d = await ghJson('/repos/' + me + '/' + myRepoName() + '/contents/' + path);
    if (d && d.content) return JSON.parse(fromBase64(d.content.replace(/\n/g, '')));
    return fallback;
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
