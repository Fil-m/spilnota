// utils.js — утиліти: $, esc, base64, час, toast, аватари-заглушки

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
function avatarDataFor(name) {
  if (name === me && myProfile.avatar) return myProfile.avatar;
  return avatarsCache[name] || null;
}
function avatarHtml(name, emoji, size) {
  const cls = size === 'sm' ? ' avatar sm' : size === 'xs' ? ' avatar xs' : ' avatar';
  const av = avatarDataFor(name);
  if (av) {
    const px = size === 'sm' ? 32 : size === 'xs' ? 24 : 50;
    return `<canvas class="${cls} av-canvas" width="${px * 2}" height="${px * 2}" data-av="${esc(name)}"></canvas>`;
  }
  return `<div class="${cls}" style="background:${avatarColor(name)}">${emoji || '🙂'}</div>`;
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add('hidden'), 2500);
}
function myRepoName() { return CONFIG.repoPrefix + me; }
