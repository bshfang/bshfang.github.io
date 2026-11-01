/* AgiWorld project page: video controls, gallery and comparison viewer. */

const $ = (sel, root = document) => root.querySelector(sel);

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

const fmt = (t) => {
  if (!isFinite(t)) return '0:00';
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* ---------- control bar ---------- */

function controls(bar, videos, fullscreenTarget) {
  const master = videos[0];
  bar.innerHTML = `
    <button class="pp" type="button" aria-label="Play">${ICON.play}</button>
    <input type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">
    <span class="time">0:00 / 0:00</span>
    <button class="rate on" type="button" data-rate="1">1×</button>
    <button class="rate" type="button" data-rate="2">2×</button>
    <button class="fs" type="button" aria-label="Full screen">${ICON.full}</button>`;
  const pp = $('.pp', bar), range = $('input', bar), time = $('.time', bar);
  let dragging = false;
  const refresh = () => {
    pp.innerHTML = master.paused ? ICON.play : ICON.pause;
    pp.setAttribute('aria-label', master.paused ? 'Play' : 'Pause');
    if (!dragging && master.duration) range.value = Math.round(1000 * master.currentTime / master.duration);
    time.textContent = `${fmt(master.currentTime)} / ${fmt(master.duration)}`;
  };
  pp.addEventListener('click', () => (master.paused ? master.play().catch(() => {}) : master.pause()));
  range.addEventListener('input', () => {
    dragging = true;
    if (master.duration) master.currentTime = (range.value / 1000) * master.duration;
  });
  range.addEventListener('change', () => { dragging = false; });
  bar.querySelectorAll('.rate').forEach((b) => b.addEventListener('click', () => {
    master.playbackRate = Number(b.dataset.rate);
    bar.querySelectorAll('.rate').forEach((o) => o.classList.toggle('on', o === b));
  }));
  $('.fs', bar).addEventListener('click', () => {
    const el = fullscreenTarget || master;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
    else if (master.webkitEnterFullscreen) master.webkitEnterFullscreen();
  });
  ['play', 'pause', 'timeupdate', 'loadedmetadata', 'seeked', 'emptied'].forEach((e) => master.addEventListener(e, refresh));
  master.addEventListener('click', () => (master.paused ? master.play().catch(() => {}) : master.pause()));
  master.addEventListener('ratechange', () => bar.querySelectorAll('.rate').forEach((o) =>
    o.classList.toggle('on', Number(o.dataset.rate) === master.playbackRate)));
  refresh();
}

/* ---------- play when visible ---------- */

const visibility = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    target._visible = isIntersecting;
    if (isIntersecting && !target._userPaused) target.play().catch(() => {});
    else if (!isIntersecting) target.pause();
  });
}, { threshold: 0.35 });

function autoplayWhenVisible(video) {
  video.addEventListener('pause', () => { if (video._visible && !video.seeking && !video._switching) video._userPaused = true; });
  video.addEventListener('play', () => { video._userPaused = false; });
  visibility.observe(video);
}

/* ---------- data ---------- */

const WORLDS = [
  { id: 'temple', title: 'Temple', dur: 80, gist: 'Sidestep along the temple hall, walk in and look around the hall with its gilded statue, then back out and into the passage on the right.' },
  { id: 'rotunda', title: 'Church', dur: 100, gist: 'Explore the church freely: the columns and niches, the altar ahead, and look up at the high dome.' },
  { id: 'night', title: 'Night lane', dur: 50, gist: 'Walk along the lane at night, follow its bend, and turn right at the intersection.' },
  { id: 'library', title: 'Library', dur: 50, gist: 'Walk along the right aisle to the shelves and make a big loop around the reading area.' },
  { id: 'bookstore', title: 'Bookstore', dur: 35, gist: 'Walk through the bookstore, out of the open shopfront and onto the sidewalk, until the street comes into view.' },
  { id: 'courtyard', title: 'Courtyard', dur: 60, gist: 'Take a walk around the courtyard between these buildings.' },
  { id: 'loft', title: 'Wooden loft', dur: 15, gist: 'Walk to the staircase on the left, go down to the living room, and look around.' },
];

// What the paper observes for specific scene / variant pairs.
const CMP = [
  { id: 'dl3dv_16_39c7fd84f7908d0a', name: 'Supermarket', kind: 'Revisiting' },
  { id: 'dl3dv_34_9bc29652c28b8999', name: 'Stone bridge', kind: 'Revisiting' },
  { id: 'dl3dv_47_f1a05a3e7d1680ca', name: 'Pavilion', kind: 'Revisiting' },
  { id: 'explore40_09_1941457202', name: 'Park path', kind: 'Exploration' },
  { id: 'explore40_29_1950573442', name: 'Lakeside walk', kind: 'Exploration' },
];

function setVideo(video, src, poster) {
  const wasPlaying = !video.paused || video._visible;
  video._switching = true;
  video.poster = poster || '';
  video.src = src;
  video.load();
  video._switching = false;
  if (wasPlaying && !video._userPaused) video.play().catch(() => {});
}

function tablist(container, items, render, onSelect, cls = 'tab') {
  container.innerHTML = '';
  const buttons = items.map((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('role', 'tab');
    b.innerHTML = render(item);
    b.addEventListener('click', () => select(i));
    container.appendChild(b);
    return b;
  });
  function select(i) {
    buttons.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    onSelect(items[i], i);
  }
  return select;
}

/* ---------- sections ---------- */

function initGallery() {
  const video = $('#gallery-video');
  const select = tablist($('#gallery-thumbs'), WORLDS,
    (w) => `<img src="static/media/worlds/${w.id}_input.jpg" alt="${w.title}" loading="lazy">`,
    (w) => {
      setVideo(video, `static/media/worlds/${w.id}.mp4`, `static/media/worlds/${w.id}_poster.jpg`);
      $('#gallery-input').src = `static/media/worlds/${w.id}_input.jpg`;
      $('#gallery-gist').textContent = w.gist;
    }, 'thumb');
  select(0);
}

function initComparison() {
  const video = $('#cmp-video');
  const select = tablist($('#cmp-scenes'), CMP,
    (c) => `<img src="static/media/compare/${c.id}_input.jpg" alt="${c.name}" loading="lazy">`,
    (c) => setVideo(video, `static/media/compare/${c.id}.mp4`, `static/media/compare/${c.id}_poster.jpg`), 'thumb');
  select(0);
}

// Highlight the section the reader is in.
function initToc() {
  const links = [...document.querySelectorAll('.toc li a')];
  const targets = links.map((a) => document.querySelector(a.getAttribute('href')));
  let ticking = false;
  const update = () => {
    ticking = false;
    const line = window.innerHeight * 0.35;
    let current = 0;
    targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top <= line) current = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === current));
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function initBib() {
  const btn = $('#bib-copy');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#bib-text').textContent);
      btn.textContent = 'Copied';
    } catch (e) {
      btn.textContent = 'Select and copy';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.vctl[data-for]').forEach((bar) => {
    const video = document.getElementById(bar.dataset.for);
    controls(bar, [video], video.closest('.player, .replay-video, .video-frame'));
  });
  document.querySelectorAll('video[data-autoplay]').forEach(autoplayWhenVisible);
  document.querySelectorAll('.i2v-grid video').forEach((v) => v.addEventListener('click', () => (v.paused ? v.play().catch(() => {}) : v.pause())));
  initGallery();
  initComparison();
  initBib();
  initToc();
});
