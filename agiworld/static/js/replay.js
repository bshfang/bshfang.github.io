/* "Inside the loop": the temple rollout replayed with the agent's world state after every chunk.
   Data: static/data/replay.json, built by tools/build_replay.py. */

(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const HFOV = 93.1;          // horizontal field of view of the temple input camera (fx 394 px, width 832 px), degrees
  const CHUNK_S = 5;

  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function init() {
    const root = document.getElementById('replay');
    if (!root) return;
    const data = await fetch('static/data/replay.json').then((r) => r.json());
    const video = document.getElementById('replay-video');
    const svg = document.getElementById('plan-svg');
    const cloud = document.getElementById('plan-cloud');
    const tip = document.getElementById('plan-tip');
    const [W, H] = data.image_size;
    const { x0, x1, z1 } = data.extent;
    const s = W / (x1 - x0);
    const P = (x, z) => [(x - x0) * s, (z1 - z) * s];
    const pt = (x, z) => P(x, z).map((v) => v.toFixed(1)).join(',');
    const nChunks = data.chunks.length;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    document.getElementById('plan-scale').remove();
    document.getElementById('plan').style.aspectRatio = `${W} / ${H}`;
    data.chunks.forEach((c) => { new Image().src = `static/img/replay/cloud_c${String(c.k).padStart(2, '0')}.webp`; });

    const gEls = el('g', {}, svg);
    const gPath = el('g', {}, svg);
    const gScale = el('g', { transform: `translate(${W - 24 - 5 * s} ${H - 22})` }, svg);
    el('path', { d: `M0 -6 V0 H${5 * s} V-6`, fill: 'none', stroke: '#3f444e', 'stroke-width': 2 }, gScale);
    const lbl = el('text', { x: 5 * s / 2, y: -10, 'text-anchor': 'middle', 'font-size': 18, fill: '#3f444e', 'font-family': 'Inter, sans-serif' }, gScale);
    lbl.textContent = '5 m';

    // origin marker = the input camera
    const [ox, oz] = P(0, 0);
    el('circle', { cx: ox, cy: oz, r: 6, fill: '#fff', stroke: '#15171c', 'stroke-width': 2.5 }, gPath);
    const traveled = el('polyline', { fill: 'none', stroke: '#15171c', 'stroke-width': 3.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.85 }, gPath);
    const wedge = el('path', { fill: 'rgba(47,85,200,.22)', stroke: '#2f55c8', 'stroke-width': 2, 'stroke-linejoin': 'round' }, gPath);
    const cam = el('circle', { r: 7, fill: '#2f55c8', stroke: '#fff', 'stroke-width': 2.5 }, gPath);

    function shapeOf(e, g) {
      const geom = e.geom || {};
      const fill = /surface|terrain|zone/.test(e.kind);
      const common = { class: `el ${e.region}${fill ? ' area' : ''}` };
      let node;
      if ((e.shape === 'polygon') && geom.pts) {
        node = el('polygon', { ...common, points: geom.pts.map((p) => pt(p[0], p[1])).join(' ') }, g);
      } else if ((e.shape === 'polyline' || e.shape === 'path') && geom.pts) {
        node = el('polyline', { ...common, points: geom.pts.map((p) => pt(p[0], p[1])).join(' '), fill: 'none' }, g);
      } else if (e.shape === 'circle') {
        const [cx, cy] = P(geom.x, geom.z);
        node = el('circle', { ...common, cx, cy, r: Math.max(geom.r * s, 3) }, g);
      } else if (e.shape === 'box') {
        const a = (geom.yaw || 0) * Math.PI / 180;
        const d = [Math.sin(a), Math.cos(a)], n = [Math.cos(a), -Math.sin(a)];
        const c = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) =>
          pt(geom.x + d[0] * i * geom.l / 2 + n[0] * j * geom.w / 2, geom.z + d[1] * i * geom.l / 2 + n[1] * j * geom.w / 2));
        node = el('polygon', { ...common, points: c.join(' ') }, g);
      } else if (e.shape === 'point' && geom.x !== undefined) {
        const [cx, cy] = P(geom.x, geom.z);
        node = el('circle', { ...common, cx, cy, r: 4 }, g);
      }
      if (!node) return null;
      // Fill only the ground and objects; walls, columns and overhead structures are outlines.
      const color = e.region === 'imagined' ? '224,120,15' : e.region === 'dropped' ? '210,58,58' : '18,128,90';
      const alpha = fill ? 0.07 : e.kind === 'object' ? 0.16 : 0;
      node.setAttribute('fill', node.getAttribute('fill') === 'none' ? 'none' : `rgba(${color},${alpha})`);
      node.setAttribute('stroke-width', fill ? 1.4 : e.kind === 'structure' ? 2.6 : 2);
      node.style.pointerEvents = node.getAttribute('fill') === 'none' ? 'stroke' : 'all';
      node.classList.add('hit');
      node.addEventListener('mouseenter', () => showTip(e));
      node.addEventListener('mousemove', moveTip);
      node.addEventListener('mouseleave', () => { tip.hidden = true; });
      return node;
    }

    function showTip(e) {
      const label = e.region === 'dropped' ? 'retired' : e.region;
      const color = e.region === 'imagined' ? 'var(--imagined)' : e.region === 'dropped' ? 'var(--dropped)' : '#5fd3a3';
      tip.innerHTML = `<em style="color:${color}">${label}</em><b>${esc(e.name)}</b>${e.caption ? esc(e.caption) : ''}`;
      tip.hidden = false;
    }
    function moveTip(ev) {
      const r = svg.getBoundingClientRect();
      let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
      if (x + 270 > r.width) x = ev.clientX - r.left - 270;
      if (y + 120 > r.height) y = ev.clientY - r.top - 120;
      tip.style.left = `${Math.max(4, x)}px`;
      tip.style.top = `${Math.max(4, y)}px`;
    }

    /* ---------- timeline ---------- */
    const tl = document.getElementById('replay-timeline');
    tl.style.gridTemplateColumns = `repeat(${nChunks}, minmax(0, 1fr))`;
    const bars = data.chunks.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl-chunk';
      b.title = `Chunk ${c.k} (${c.t0}–${c.t1} s)`;
      b.innerHTML = `<div class="tl-bar"><i></i></div><span>${c.t0}s</span>`;
      b.addEventListener('click', () => {
        video.currentTime = c.t0 + 0.05;
        render(c.k, true);
        update();
      });
      tl.appendChild(b);
      return b;
    });

    /* ---------- per-chunk render ---------- */
    let current = -1;
    function render(k, force) {
      if (k === current && !force) return;
      current = k;
      const c = data.chunks[k];
      const prev = k > 0 ? data.chunks[k - 1].elements : [];
      cloud.src = `static/img/replay/cloud_c${String(k).padStart(2, '0')}.webp`;

      gEls.innerHTML = '';
      const fresh = new Set([...c.diff.confirmed, ...c.diff.confirmed_added, ...c.diff.imagined_added]);
      const order = (e) => (/surface|terrain|zone/.test(e.kind) ? 0 : 1);
      [...c.elements].sort((a, b) => order(a) - order(b)).forEach((e) => {
        const n = shapeOf(e, gEls);
        if (n && fresh.has(e.name)) n.classList.add('fresh');
      });
      const dropped = new Set(c.diff.dropped);
      prev.filter((e) => dropped.has(e.name)).forEach((e) => shapeOf({ ...e, region: 'dropped' }, gEls));

      const nConf = c.elements.filter((e) => e.region === 'confirmed').length;
      document.getElementById('plan-title').textContent =
        `World state after chunk ${k} · ${nConf} confirmed, ${c.elements.length - nConf} imagined`;

      bars.forEach((b, i) => b.classList.toggle('on', i === k));

      const icon = { done: '✓', active: '▶', pending: '○', skipped: '–' };
      document.getElementById('p-stages').innerHTML = c.stages.map((st) =>
        `<li class="${st.status}" title="${st.status}"><i>${icon[st.status] || '○'}</i><span>${esc(st.goal)}</span></li>`).join('');
      const active = c.stages.find((st) => st.status === 'active');
      document.getElementById('journey-now').textContent = active ? active.goal : '';
    }

    /* ---------- per-frame update ---------- */
    function update() {
      const t = Math.min(video.currentTime || 0, nChunks * CHUNK_S - 0.001);
      const k = Math.min(nChunks - 1, Math.floor(t / CHUNK_S));
      render(k);
      const within = (t - k * CHUNK_S) / CHUNK_S;
      bars.forEach((b, i) => {
        b.querySelector('i').style.width = i < k ? '100%' : i === k ? `${(within * 100).toFixed(1)}%` : '0%';
      });
      const idx = Math.min(data.path.length - 1, Math.floor(t * data.fps));
      traveled.setAttribute('points', data.path.slice(0, idx + 1).map((p) => pt(p[0], p[1])).join(' '));
      const [x, z, yaw] = data.path[idx];
      const [cx, cy] = P(x, z);
      cam.setAttribute('cx', cx);
      cam.setAttribute('cy', cy);
      const len = 2.2 * s;
      const ray = (deg) => {
        const a = (yaw + deg) * Math.PI / 180;
        return [cx + Math.sin(a) * len, cy - Math.cos(a) * len];
      };
      const [ax, ay] = ray(-HFOV / 2), [bx, by] = ray(HFOV / 2);
      wedge.setAttribute('d', `M${cx},${cy} L${ax},${ay} L${bx},${by} Z`);
    }

    let raf = 0;
    const loop = () => { update(); raf = video.paused ? 0 : requestAnimationFrame(loop); };
    video.addEventListener('play', () => { if (!raf) raf = requestAnimationFrame(loop); });
    ['seeked', 'timeupdate', 'loadedmetadata'].forEach((e) => video.addEventListener(e, update));

    // play while in view, as the other videos do
    const io = new IntersectionObserver(([entry]) => {
      video._visible = entry.isIntersecting;
      if (entry.isIntersecting && !video._userPaused) video.play().catch(() => {});
      else if (!entry.isIntersecting) video.pause();
    }, { threshold: 0.35 });
    video.addEventListener('pause', () => { if (video._visible && !video.seeking) video._userPaused = true; });
    video.addEventListener('play', () => { video._userPaused = false; });
    io.observe(video);

    render(0, true);
    update();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
