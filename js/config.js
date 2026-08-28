// config.js — константи, теми, шрифти, MODULE_DEFS, налаштування (cfg)

// ================= КОНФІГ =================
const CONFIG = {
  topic: 'spilnota',
  repoPrefix: 'spilnota-',
  pollMs: 8000,
  searchMs: 300000,
};
const LS_TOKEN = 'spilnota_token';
const LS_LOGIN = 'spilnota_login';
const LS_READ = 'spilnota_read_';
const LS_CFG = 'spilnota_cfg';
const LS_THEME_MIG = 'spilnota_theme_mig';
const LS_HIDDEN = 'spilnota_hidden';
const LS_PROJ_FILTER = 'spilnota_proj_filter';
const LS_PROJ_ORDER = 'spilnota_proj_order';
let projSortMode = false;
let pageIndex = { categories: [] };
let pagesSortMode = false;
let avatarsCache = {};
let activeAnim = null;
let currentPhotoImg = null;
let currentEffect = 'particles';
let currentGrid = 36;
const API = 'https://api.github.com';

// ================= ТЕМИ ТА ШРИФТИ =================
const THEMES = {
  classic: {
    name: 'Класична',
    css: {
      '--header-top': '#5E81A8', '--header-bottom': '#45688E', '--header-border': '#3A5B7C',
      '--bg': '#EDEEF0', '--card': '#FFFFFF', '--border': '#D8DFEA',
      '--link': '#2B587A', '--text': '#000', '--text2': '#666', '--text3': '#999',
      '--btn-top': '#729BC8', '--btn-bottom': '#6383A8', '--btn-border': '#4E7291',
      '--green': '#4BB34B', '--mine-bubble': '#E3EFF9', '--mine-border': '#B9CDE3', '--comment-bg': '#F0F3F7'
    }
  },
  dark: {
    name: 'Темна',
    css: {
      '--header-top': '#1A1D33', '--header-bottom': '#12152A', '--header-border': '#000',
      '--bg': '#0B0D19', '--card': '#1E2240', '--border': '#262B50',
      '--link': '#00F0FF', '--text': '#E0E4F0', '--text2': '#8890B0', '--text3': '#505570',
      '--btn-top': '#00F0FF', '--btn-bottom': '#00A8B8', '--btn-border': '#006B78',
      '--green': '#00FF88', '--mine-bubble': '#00A8B8', '--mine-border': '#006B78', '--comment-bg': '#1A1D33'
    }
  },
  forest: {
    name: 'Лісова',
    css: {
      '--header-top': '#4C8C6C', '--header-bottom': '#2E6B50', '--header-border': '#1F4A38',
      '--bg': '#EAF2EC', '--card': '#FFFFFF', '--border': '#CFE0D4',
      '--link': '#2E6B50', '--text': '#1A2E22', '--text2': '#5C7567', '--text3': '#8FA69A',
      '--btn-top': '#6BAE8C', '--btn-bottom': '#4C8C6C', '--btn-border': '#2E6B50',
      '--green': '#3A8C5C', '--mine-bubble': '#D8EFE0', '--mine-border': '#9FC8B0', '--comment-bg': '#F0F7F2'
    }
  },
  sunset: {
    name: 'Захід сонця',
    css: {
      '--header-top': '#E07B54', '--header-bottom': '#C25A38', '--header-border': '#8F3D24',
      '--bg': '#FDF1EA', '--card': '#FFFFFF', '--border': '#F0D5C5',
      '--link': '#C25A38', '--text': '#3A241A', '--text2': '#8A6A5A', '--text3': '#B49A8C',
      '--btn-top': '#E8986F', '--btn-bottom': '#D0784F', '--btn-border': '#C25A38',
      '--green': '#6BA85C', '--mine-bubble': '#FBE3D3', '--mine-border': '#E8BEA4', '--comment-bg': '#FBF3ED'
    }
  },
  ocean: {
    name: 'Океан',
    css: {
      '--header-top': '#3E7CB1', '--header-bottom': '#2B5E8C', '--header-border': '#1C4470',
      '--bg': '#EAF2F8', '--card': '#FFFFFF', '--border': '#C9DCEA',
      '--link': '#2B5E8C', '--text': '#16283A', '--text2': '#5A768C', '--text3': '#8FA9BC',
      '--btn-top': '#5E9CD0', '--btn-bottom': '#3E7CB1', '--btn-border': '#2B5E8C',
      '--green': '#3E9C7C', '--mine-bubble': '#D8EAF7', '--mine-border': '#A4C8E0', '--comment-bg': '#F0F6FA'
    }
  }
};
const FONTS = {
  ptsans: { name: 'PT Sans', family: "'PT Sans', Tahoma, Arial, sans-serif" },
  tahoma: { name: 'Tahoma', family: "Tahoma, Verdana, Arial, sans-serif" },
  georgia: { name: 'Georgia', family: "Georgia, 'Times New Roman', serif" },
  mono: { name: 'Моноширинний', family: "'Courier New', Courier, monospace" },
  comic: { name: 'Comic Sans', family: "'Comic Sans MS', 'Comic Sans', cursive" }
};
// ================= МОДУЛІ (базові) =================
// Кожен модуль: id, назва, опис, дефолт, список екранів, поллінг
const MODULE_DEFS = [
  { id: 'profile', name: 'Профіль', icon: '🏠', desc: 'Моя сторінка, редагування, фото-аватар, сторінки користувачів', def: true, screens: ['me', 'edit', 'user', 'avatar'], poll: 'wall' },
  { id: 'wall', name: 'Стіна (стрічка)', icon: '📰', desc: 'Пости, лайки, коментарі — стрічка всіх', def: true, screens: ['feed'], poll: 'wall' },
  { id: 'chat', name: 'Повідомлення', icon: '💬', desc: 'Приватні діалоги між користувачами', def: true, screens: ['messages', 'dialog'], poll: 'dialogs' },
  { id: 'people', name: 'Люди', icon: '👥', desc: 'Список учасників спільноти', def: true, screens: ['people'], poll: null },
  { id: 'groups', name: 'Групи', icon: '👪', desc: 'Спільноти за інтересами: своя стіна, учасники, адмін', def: true, screens: ['groups', 'group'], poll: 'groups' },
  { id: 'projects', name: 'Мої проекти', icon: '📁', desc: 'Сторінки та проекти з GitHub: фільтри, описи, приховування', def: true, screens: ['projects'], poll: null },
  { id: 'pages', name: 'Сторінки', icon: '🌐', desc: 'Навігатор задеплоєних сторінок: категорії, описи, порядок', def: true, screens: ['pages'], poll: null },
  { id: 'apps', name: 'Застосунки', icon: '🧩', desc: 'Каталог застосунків спільноти: ігри та сервіси у вбудові, з передачею ніка', def: true, screens: ['apps', 'app'], poll: 'apps' },
  { id: 'settings', name: 'Налаштування', icon: '⚙️', desc: 'Модулі, шрифт, тема', def: true, screens: ['settings'], poll: null, locked: true }
];
// ================= НАЛАШТУВАННЯ (cfg) =================
function defaultCfg() {
  const enabled = {};
  for (const m of MODULE_DEFS) enabled[m.id] = m.def;
  return { enabled, font: 'ptsans', theme: 'sunset', moduleVersions: {} };
}
function getCfg() {
  try {
    const cfg = { ...defaultCfg(), ...JSON.parse(localStorage.getItem(LS_CFG) || '{}') };
    if (cfg.theme === 'vk2013') { cfg.theme = 'classic'; saveCfg(cfg); }
    // одноразова міграція на новий дефолт (померанчова); пізніший вибір користувача не чіпаємо
    if (cfg.theme === 'classic' && !localStorage.getItem(LS_THEME_MIG)) {
      cfg.theme = 'sunset';
      localStorage.setItem(LS_THEME_MIG, '1');
      saveCfg(cfg);
    }
    return cfg;
  } catch (e) { return defaultCfg(); }
}
function saveCfg(cfg) {
  localStorage.setItem(LS_CFG, JSON.stringify(cfg));
}
function moduleEnabled(id) {
  const cfg = getCfg();
  const m = MODULE_DEFS.find(x => x.id === id);
  if (m) {
    if (m.locked) return true;
    return cfg.enabled[id] !== false;
  }
  // кастомний модуль спільноти — тільки ЯВНЕ увімкнення
  return cfg.enabled[id] === true;
}
function applyTheme(themeId) {
  const t = THEMES[themeId] || THEMES.classic;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.css)) root.style.setProperty(k, v);
}
function applyFont(fontId) {
  const f = FONTS[fontId] || FONTS.ptsans;
  document.documentElement.style.setProperty('--font', f.family);
}
function applyCfg() {
  const cfg = getCfg();
  applyTheme(cfg.theme);
  applyFont(cfg.font);
}
