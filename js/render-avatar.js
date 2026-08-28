// render-avatar.js — фото-аватар: конвертер у частинки, ефекти, анімація

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
      const prof = await readApiFile(p.login, p.repo, 'data/profile.json');
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

