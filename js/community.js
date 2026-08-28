// community.js — модулі спільноти (SPILNOTA.register): чужий код з репо учасників

// ================= МОДУЛІ СПІЛЬНОТИ (v23): код з чужих репо =================
// Будь-який учасник може опублікувати код модуля у СВОЄМУ репо (data/modules.json +
// js/modules/<file>.js). Інші бачать версію в Налаштуваннях → «Модулі спільноти» і можуть
// перемикатися між базовою і чужими версіями. При КОЖНОМУ перемиканні на чужий код —
// попередження (код виконується у браузері і бачить токен).
window.SPILNOTA = {
  overrides: {},   // id базового модуля -> {name, render, poll, ...}
  customs: {},     // id нового модуля -> {id, name, icon, desc, screens, render, poll}
  active: {},      // id -> login автора завантаженого коду
  register: function (id, def) {
    if (!id || !def || typeof def !== 'object') return;
    const isReplace = MODULE_DEFS.some(m => m.id === id);
    if (isReplace) {
      SPILNOTA.overrides[id] = { name: def.name || id, ...def };
    } else {
      SPILNOTA.customs[id] = { id, icon: def.icon || '🧩', desc: def.desc || '', screens: Array.isArray(def.screens) && def.screens.length ? def.screens : [id], name: def.name || id, ...def };
    }
  }
};
let modulesCache = []; // декларації модулів: {id, name, desc, file, version, repoOwner, ts}
let modulesErr = '';

async function refreshModules() {
  const list = await searchParticipants();
  const fresh = {};
  const collect = (d, owner) => {
    if (!d || !d.id || !d.file) return;
    const key = d.id + '@' + owner;
    if (!fresh[key] || (d.ts || 0) > (fresh[key].ts || 0)) fresh[key] = { ...d, repoOwner: owner };
  };
  const myM = await readMyFile('data/modules.json', { modules: [] });
  if (myM && Array.isArray(myM.modules)) for (const d of myM.modules) collect(d, me);
  for (const p of list) {
    if (p.login === me) continue;
    try {
      const d = await readApiFile(p.login, p.repo, 'data/modules.json');
      if (d && Array.isArray(d.modules)) for (const x of d.modules) collect(x, p.login);
    } catch (e) { }
  }
  for (const m of modulesCache) { const k = m.id + '@' + m.repoOwner; if (!fresh[k]) fresh[k] = m; }
  modulesCache = Object.values(fresh).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
// сире читання JS-коду модуля (без JSON.parse): чужий через Contents API з ETag, fallback raw
async function readApiFileText(owner, repo, path) {
  const key = owner + '/' + repo + '/' + path;
  const headers = {};
  const hit = apiFileCache[key];
  if (hit) headers['If-None-Match'] = hit.etag;
  try {
    const r = await gh(`/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (r.status === 304 && hit) return hit.text;
    if (r.status === 404) return readFileText(owner, repo, path);
    if (!r.ok) throw new Error(path + ' -> ' + r.status);
    const d = await r.json();
    const text = (d && d.content) ? fromBase64(d.content.replace(/\n/g, '')) : null;
    apiFileCache[key] = { etag: r.headers.get('ETag'), text };
    return text;
  } catch (e) { return readFileText(owner, repo, path); }
}
async function readFileText(owner, repo, path) {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`);
    if (!r.ok) return null;
    return await r.text();
  } catch (e) { return null; }
}
// Завантажує і ВИКОНУЄ код модуля (код сам реєструється через SPILNOTA.register)
async function loadModuleCode(decl) {
  let code = null;
  try {
    if (decl.repoOwner === me) {
      const d = await ghJson('/repos/' + me + '/' + myRepoName() + '/contents/' + decl.file);
      if (d && d.content) code = fromBase64(d.content.replace(/\n/g, ''));
    } else {
      code = await readApiFileText(decl.repoOwner, CONFIG.repoPrefix + decl.repoOwner, decl.file);
    }
  } catch (e) { }
  if (!code) { toast('⚠️ Не вдалося завантажити код модуля «' + (decl.name || decl.id) + '»'); return false; }
  try {
    (new Function(code))();
  } catch (e) {
    toast('⚠️ Модуль «' + (decl.name || decl.id) + '» помилка: ' + e.message);
    return false;
  }
  SPILNOTA.active[decl.id] = decl.repoOwner;
  return true;
}
// Вимикання чужого коду: прибирає реєстрації, щоб не було «привидів» з минулих завантажень
function unloadModule(id) {
  delete SPILNOTA.overrides[id];
  delete SPILNOTA.customs[id];
  delete SPILNOTA.active[id];
}
// При старті: завантажує збережені у cfg вибори (заміни + увімкнені кастомні)
async function applyModuleVersions() {
  const cfg = getCfg();
  const versions = cfg.moduleVersions || {};
  for (const id in versions) {
    const decl = modulesCache.find(d => d.id === id && d.repoOwner === versions[id]);
    if (decl) await loadModuleCode(decl);
  }
  for (const d of modulesCache) {
    if (SPILNOTA.customs[d.id] || MODULE_DEFS.some(m => m.id === d.id)) continue;
    if (cfg.enabled[d.id] === true) await loadModuleCode(d);
  }
}
