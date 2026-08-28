// embed.js — вбудовування відео/аудіо з посилань (YouTube, TikTok, Spotify, ...)

// ---- Вбудовування відео з посилань у тексті поста ----
function matchYouTube(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
function matchTikTok(url) {
  const m = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d{9,})/);
  return m ? m[1] : null;
}
function matchVimeo(url) {
  const m = url.match(/vimeo\.com\/(\d{6,})/);
  return m ? m[1] : null;
}
function matchInstagram(url) {
  const m = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] + '/' + m[2] : null;
}
function matchFacebook(url) {
  const clean = url.replace(/[),.;!?]+$/, '');
  if (/facebook\.com\//.test(clean) && (clean.includes('/posts/') || clean.includes('/videos/') || clean.includes('/watch') || clean.includes('/photo'))) return clean;
  return null;
}
function matchTwitchVideo(url) {
  const m = url.match(/twitch\.tv\/videos\/(\d+)/);
  return m ? m[1] : null;
}
function matchTwitchClip(url) {
  const m = url.match(/twitch\.tv\/[\w-]+\/clip\/([\w-]+)/);
  return m ? m[1] : null;
}
function matchSpotify(url) {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
  return m ? m[1] + '/' + m[2] : null;
}
function matchSoundCloud(url) {
  // повні лінки soundcloud.com/юзер/трек
  const m = url.match(/soundcloud\.com\/[\w-]+\/[\w-]+/);
  if (m) return m[0];
  // короткі лінки on.soundcloud.com/<code>
  const s = url.match(/on\.soundcloud\.com\/[\w-]+/);
  if (s) return s[0];
  return null;
}
function matchDailymotion(url) {
  const m = url.match(/dailymotion\.com\/video\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}
function embedBlock(url) {
  const clean = url.replace(/[),.;!?]+$/, '');
  const href = /^https?:/.test(clean) ? clean : 'https://' + clean;
  const link = `<a href="${esc(href)}" target="_blank">${esc(clean)}</a>`;
  const yt = matchYouTube(clean);
  if (yt) {
    return `${link}
      <div class="embed-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="YouTube" loading="lazy" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  }
  const tt = matchTikTok(clean);
  if (tt) {
    return `${link}
      <div class="embed-wrap"><iframe src="https://www.tiktok.com/embed/v2/${tt}" title="TikTok" loading="lazy" allowfullscreen></iframe></div>`;
  }
  const vm = matchVimeo(clean);
  if (vm) {
    return `${link}
      <div class="embed-wrap"><iframe src="https://player.vimeo.com/video/${vm}" title="Vimeo" loading="lazy" allowfullscreen></iframe></div>`;
  }
  const ig = matchInstagram(clean);
  if (ig) {
    return `${link}
      <div class="embed-wrap ig"><iframe src="https://www.instagram.com/${ig}/embed/" title="Instagram" loading="lazy" allowfullscreen></iframe></div>`;
  }
  const fb = matchFacebook(clean);
  if (fb) {
    return `${link}
      <div class="embed-wrap fb"><iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(href)}&show_text=true&width=500" title="Facebook" loading="lazy" allowfullscreen style="border:none;overflow:hidden"></iframe></div>`;
  }
  const tv = matchTwitchVideo(clean);
  if (tv) {
    return `${link}
      <div class="embed-wrap"><iframe src="https://player.twitch.tv/?video=${tv}&parent=${encodeURIComponent(location.hostname)}" title="Twitch" loading="lazy" allowfullscreen></iframe></div>`;
  }
  const clip = matchTwitchClip(clean);
  if (clip) {
    return `${link}
      <div class="embed-wrap"><iframe src="https://clips.twitch.tv/embed?clip=${clip}&parent=${encodeURIComponent(location.hostname)}" title="Twitch" loading="lazy" allowfullscreen></iframe></div>`;
  }
  const sp = matchSpotify(clean);
  if (sp) {
    const h = sp.startsWith('track') || sp.startsWith('episode') ? 152 : 352;
    return `${link}
      <div class="embed-wrap sp" style="height:${h}px"><iframe src="https://open.spotify.com/embed/${sp}" title="Spotify" loading="lazy" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>`;
  }
  const sc = matchSoundCloud(clean);
  if (sc) {
    return `${link}
      <div class="sc-embed" data-url="${esc(href)}"><div class="sc-loading">⏳ SoundCloud завантажується…</div></div>`;
  }
  const dm = matchDailymotion(clean);
  if (dm) {
    return `${link}
      <div class="embed-wrap"><iframe src="https://www.dailymotion.com/embed/video/${dm}" title="Dailymotion" loading="lazy" allowfullscreen></iframe></div>`;
  }
  return link;
}
function renderPostText(text) {
  const re = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;
  const parts = [];
  let last = 0, m;
  while ((m = re.exec(text))) {
    parts.push(esc(text.slice(last, m.index)));
    parts.push(embedBlock(m[1]));
    last = m.index + m[0].length;
  }
  parts.push(esc(text.slice(last)));
  return parts.join('');
}
// SoundCloud: старий w.soundcloud.com/player мертвий (404), тепер через офіційний oembed
const scEmbedCache = {};
async function loadScEmbeds() {
  const els = document.querySelectorAll('.sc-embed');
  for (const el of els) {
    if (el.dataset.loaded) continue;
    el.dataset.loaded = '1';
    const url = el.dataset.url;
    let html = scEmbedCache[url];
    if (!html) {
      try {
        const r = await fetch('https://soundcloud.com/oembed?format=json&maxheight=166&url=' + encodeURIComponent(url));
        if (r.ok) {
          const d = await r.json();
          html = d.html || '';
          scEmbedCache[url] = html;
        }
      } catch (e) { }
    }
    if (html) el.innerHTML = html;
    else el.innerHTML = '<div class="sc-fail">SoundCloud не вдалося вбудувати — відкрийте за посиланням ↗</div>';
  }
}
