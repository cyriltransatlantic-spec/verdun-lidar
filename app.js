'use strict';

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let toastTimer;
function toast(msg, ms = 2500) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

function fmtDist(m) { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`; }
function bearing(a, b) {
  const r = Math.PI / 180, y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
const compass = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

/* ---------- layer definitions ---------- */
const VERDUN_CENTER = [49.2055, 5.4300];
const BATTLEFIELD = L.latLngBounds([49.14, 5.30], [49.28, 5.52]);
const IGN_ATTR = '&copy; <a href="https://geoservices.ign.fr" target="_blank" rel="noopener">IGN</a>';

function ignUrl(layer, tms, format, style = 'normal') {
  return 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
    + `&LAYER=${layer}&STYLE=${style}&TILEMATRIXSET=${tms}&FORMAT=${format}`
    + '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
}

const BASES = {
  satellite: { id: 'satellite', name: 'Satellite', url: ignUrl('ORTHOIMAGERY.ORTHOPHOTOS', 'PM_0_19', 'image/jpeg'), maxNativeZoom: 19, kb: 20 },
  plan: { id: 'plan', name: 'IGN map', url: ignUrl('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'PM_0_19', 'image/png'), maxNativeZoom: 19, kb: 15 },
};
const LIDAR = { id: 'lidar', name: 'LiDAR relief', url: ignUrl('IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW', 'PM_0_18', 'image/png'), maxNativeZoom: 18, kb: 60 };

const OVERLAYS = (window.HISTORIC_OVERLAYS || []).map((o) => ({
  ...o,
  url: o.type === 'wmts' ? ignUrl(o.layer, o.tms, o.format, o.style) : o.url,
}));

function makeLayer(def, extra = {}) {
  if (def.type === 'image') return L.imageOverlay(def.url, def.bounds, { opacity: def.opacity ?? 1, ...extra });
  return L.tileLayer(def.url, {
    maxZoom: 21,
    maxNativeZoom: def.maxNativeZoom ?? 18,
    minNativeZoom: def.minNativeZoom ?? 0,
    crossOrigin: def.type === 'xyz' ? undefined : true,
    attribution: def.type === 'xyz' ? '' : IGN_ATTR,
    keepBuffer: 4,
    ...extra,
  });
}

/* ---------- map ---------- */
const state = load('verdun.state', {});
state.base ??= 'satellite';
state.lidar ??= 1;
state.overlays ??= {};

const view = load('verdun.view', null);
const map = L.map('map', { zoomControl: false, maxZoom: 21, minZoom: 6, worldCopyJump: false })
  .setView(view ? [view.lat, view.lng] : VERDUN_CENTER, view ? view.z : 15);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
map.attributionControl.setPrefix('');

map.on('moveend', () => { const c = map.getCenter(); save('verdun.view', { lat: c.lat, lng: c.lng, z: map.getZoom() }); });
map.on('zoomend', () => map.getContainer().classList.toggle('show-labels', map.getZoom() >= 15));
map.getContainer().classList.toggle('show-labels', map.getZoom() >= 15);

map.createPane('overlays').style.zIndex = 250;
map.createPane('lidar').style.zIndex = 300;

const baseLayers = { satellite: makeLayer(BASES.satellite), plan: makeLayer(BASES.plan) };
const lidarLayer = makeLayer(LIDAR, { pane: 'lidar' });
const overlayLayers = {};
OVERLAYS.forEach((o) => { overlayLayers[o.id] = makeLayer(o, { pane: 'overlays' }); });

function applyLayers() {
  const op = state.lidar;
  // Base is hidden when LiDAR is fully opaque: fewer downloads, faster offline.
  for (const [id, layer] of Object.entries(baseLayers)) {
    const want = id === state.base && op < 1;
    if (want && !map.hasLayer(layer)) layer.addTo(map);
    if (!want && map.hasLayer(layer)) map.removeLayer(layer);
  }
  if (op > 0) { if (!map.hasLayer(lidarLayer)) lidarLayer.addTo(map); lidarLayer.setOpacity(op); }
  else if (map.hasLayer(lidarLayer)) map.removeLayer(lidarLayer);

  for (const o of OVERLAYS) {
    const s = state.overlays[o.id] || { on: false, opacity: o.opacity ?? 1 };
    const layer = overlayLayers[o.id];
    if (s.on) { if (!map.hasLayer(layer)) layer.addTo(map); layer.setOpacity(s.opacity); }
    else if (map.hasLayer(layer)) map.removeLayer(layer);
  }

  $('#lidarOpacity').value = Math.round(op * 100);
  $('#modeSat').classList.toggle('active', op === 0);
  $('#modeLidar').classList.toggle('active', op === 1);
  $('#modeSat').textContent = BASES[state.base].name;
  save('verdun.state', state);
}

$('#modeSat').onclick = () => { state.lidar = 0; applyLayers(); };
$('#modeLidar').onclick = () => { state.lidar = 1; applyLayers(); };
$('#lidarOpacity').oninput = (e) => { state.lidar = +e.target.value / 100; applyLayers(); };

document.querySelectorAll('input[name=base]').forEach((r) => {
  r.checked = r.value === state.base;
  r.onchange = () => { state.base = r.value; if (state.lidar === 1) state.lidar = 0; applyLayers(); };
});

function buildOverlayList() {
  const box = $('#overlayList'); box.innerHTML = '';
  if (!OVERLAYS.length) { box.innerHTML = '<p class="hint">None configured.</p>'; return; }
  for (const o of OVERLAYS) {
    const s = (state.overlays[o.id] ??= { on: false, opacity: o.opacity ?? 1 });
    const row = document.createElement('div'); row.className = 'overlay-row';
    row.innerHTML = `<input type="checkbox" ${s.on ? 'checked' : ''}><span>${esc(o.name)}</span>
      <input type="range" min="0" max="100" step="5" value="${Math.round(s.opacity * 100)}" aria-label="Opacity">`;
    const [cb, , range] = row.children;
    cb.onchange = () => { s.on = cb.checked; applyLayers(); };
    range.oninput = () => { s.opacity = range.value / 100; s.on = true; cb.checked = true; applyLayers(); };
    box.appendChild(row);
  }
}
buildOverlayList();
applyLayers();

/* ---------- sheets ---------- */
const sheets = { layers: $('#sheetLayers'), points: $('#sheetPoints'), offline: $('#sheetOffline') };
function openSheet(name) {
  for (const [n, el] of Object.entries(sheets)) el.classList.toggle('hidden', n !== name || !el.classList.contains('hidden'));
  $('#btnLayers').classList.toggle('active', !sheets.layers.classList.contains('hidden'));
  $('#btnPoints').classList.toggle('active', !sheets.points.classList.contains('hidden'));
  $('#btnOffline').classList.toggle('active', !sheets.offline.classList.contains('hidden'));
  if (!sheets.points.classList.contains('hidden')) renderPointList();
  if (!sheets.offline.classList.contains('hidden')) { updateEstimate(); updateStorage(); }
}
const closeSheets = () => openSheet(null);
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheets));
$('#btnLayers').onclick = () => openSheet('layers');
$('#btnPoints').onclick = () => openSheet('points');
$('#btnOffline').onclick = () => openSheet('offline');
map.on('click', closeSheets);

/* ---------- GPS ---------- */
const gps = { watchId: null, follow: false, fix: null, heading: null, marker: null, circle: null, wakeLock: null, centered: false };

function meIcon() {
  return L.divIcon({ className: 'me', html: '<div class="me-cone hidden"></div><div class="me-dot"></div>', iconSize: [0, 0] });
}

function setLocateButton() {
  const b = $('#btnLocate');
  b.classList.toggle('on', gps.watchId !== null);
  b.classList.toggle('follow', gps.watchId !== null && gps.follow);
}

function startGps() {
  if (!('geolocation' in navigator)) { toast('GPS not available on this device'); return; }
  gps.follow = true; gps.centered = false;
  gps.watchId = navigator.geolocation.watchPosition(onFix, onFixError, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
  startCompass(); requestWakeLock(); setLocateButton();
  $('#status').textContent = 'Waiting for GPS…'; $('#status').classList.remove('hidden');
}

function stopGps() {
  if (gps.watchId !== null) navigator.geolocation.clearWatch(gps.watchId);
  gps.watchId = null; gps.follow = false; gps.fix = null;
  if (gps.marker) { map.removeLayer(gps.marker); map.removeLayer(gps.circle); gps.marker = gps.circle = null; }
  releaseWakeLock(); $('#status').classList.add('hidden'); $('#placeGps').classList.add('hidden'); setLocateButton();
}

function onFix(pos) {
  const { latitude, longitude, accuracy, altitude, heading, speed } = pos.coords;
  const ll = L.latLng(latitude, longitude);
  gps.fix = { lat: latitude, lng: longitude, accuracy, altitude, time: pos.timestamp };
  if (heading != null && !Number.isNaN(heading) && speed > 0.8) gps.moveHeading = heading; else gps.moveHeading = null;

  if (!gps.marker) {
    gps.circle = L.circle(ll, { radius: accuracy, color: '#3d8bff', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
    gps.marker = L.marker(ll, { icon: meIcon(), interactive: false, zIndexOffset: 1000 }).addTo(map);
  } else { gps.marker.setLatLng(ll); gps.circle.setLatLng(ll).setRadius(accuracy); }
  updateHeading();

  if (gps.follow) {
    if (!gps.centered) { map.setView(ll, Math.max(map.getZoom(), 17)); gps.centered = true; }
    else map.panTo(ll, { animate: true, duration: 0.4 });
  }
  const alt = altitude != null ? ` · alt ${Math.round(altitude)} m` : '';
  $('#status').textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · ±${Math.round(accuracy)} m${alt}`;
  $('#placeGps').classList.remove('hidden');
  if (!sheets.points.classList.contains('hidden')) renderPointList();
}

function onFixError(err) {
  if (err.code === 1) { toast('Location permission denied'); stopGps(); }
  else toast(err.code === 3 ? 'GPS timeout, still trying…' : 'GPS signal lost');
}

// Stop following when the user drags the map; tapping the button re-centres.
map.on('dragstart', () => { if (gps.follow) { gps.follow = false; setLocateButton(); } });

$('#btnLocate').onclick = () => {
  if (gps.watchId === null) startGps();
  else if (!gps.follow) { gps.follow = true; setLocateButton(); if (gps.fix) map.setView([gps.fix.lat, gps.fix.lng], Math.max(map.getZoom(), 16)); }
  else stopGps();
};

// Compass heading (Android Chrome supports deviceorientationabsolute).
function onOrientation(e) {
  let h = null;
  if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
  else if (e.absolute && e.alpha != null) h = 360 - e.alpha;
  if (h == null) return;
  const screenAngle = (screen.orientation && screen.orientation.angle) || 0;
  gps.heading = (h + screenAngle + 360) % 360;
  updateHeading();
}
let compassOn = false;
function startCompass() {
  if (compassOn) return; compassOn = true;
  if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrientation);
  else window.addEventListener('deviceorientation', onOrientation);
}
function updateHeading() {
  if (!gps.marker) return;
  const el = gps.marker.getElement(); if (!el) return;
  const h = gps.moveHeading ?? gps.heading;
  const cone = el.querySelector('.me-cone');
  cone.classList.toggle('hidden', h == null);
  if (h != null) cone.style.setProperty('--h', `${h}deg`);
}

async function requestWakeLock() {
  try { if ('wakeLock' in navigator) gps.wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function releaseWakeLock() { try { gps.wakeLock && gps.wakeLock.release(); } catch {} gps.wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && gps.watchId !== null) requestWakeLock(); });

/* ---------- points ---------- */
const COLORS = ['#e8c14f', '#e5533d', '#4fb3e8', '#6fcf6a', '#c77dff', '#ffffff'];
const SEED = [
  ['Fort de Douaumont', 49.21682, 5.43882],
  ['Fort de Vaux', 49.20049, 5.47014],
  ['Ossuaire de Douaumont', 49.20825, 5.42369],
  ['Ouvrage de Thiaumont', 49.20674, 5.41965],
  ['Ouvrage de Froideterre', 49.19761, 5.40312],
  ['Tranchée des Baïonnettes', 49.21408, 5.42555],
  ['Fleury devant Douaumont (destroyed village)', 49.19851, 5.42831],
].map(([name, lat, lng]) => ({ id: uid() + name.length, name, note: 'Reference point', lat, lng, color: '#ffffff', created: Date.now() }));

let points = load('verdun.points', null);
if (!points) { points = SEED; save('verdun.points', points); }
const savePoints = () => save('verdun.points', points);

const pointLayer = L.layerGroup().addTo(map);
const markers = new Map();

function pointIcon(p) {
  return L.divIcon({ className: 'pin', iconSize: [0, 0],
    html: `<div class="pin-dot" style="--c:${esc(p.color)}"></div><div class="pin-label">${esc(p.name)}</div>` });
}

function popupHtml(p) {
  let dist = '';
  if (gps.fix) { const me = L.latLng(gps.fix.lat, gps.fix.lng), d = me.distanceTo(p); dist = `<p class="hint">${fmtDist(d)} ${compass(bearing(me, L.latLng(p)))} of you</p>`; }
  return `<h4>${esc(p.name)}</h4>${p.note ? `<p>${esc(p.note)}</p>` : ''}
    <p class="hint mono">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</p>${dist}
    <div class="row"><button class="btn" data-act="edit">Edit</button>
    <a class="btn" href="geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${encodeURIComponent(p.name)})">Open in…</a></div>`;
}

function renderMarkers() {
  pointLayer.clearLayers(); markers.clear();
  for (const p of points) {
    const m = L.marker([p.lat, p.lng], { icon: pointIcon(p) });
    m.bindPopup(() => popupHtml(p));
    m.on('popupopen', (e) => {
      const btn = e.popup.getElement().querySelector('[data-act=edit]');
      if (btn) btn.onclick = () => { map.closePopup(); editPoint(p); };
    });
    m.addTo(pointLayer); markers.set(p.id, m);
  }
}

function renderPointList() {
  const q = $('#pointSearch').value.trim().toLowerCase();
  const me = gps.fix ? L.latLng(gps.fix.lat, gps.fix.lng) : null;
  let list = points.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q));
  list = list.map((p) => ({ p, d: me ? me.distanceTo(p) : null }));
  list.sort((a, b) => (a.d != null ? a.d - b.d : b.p.created - a.p.created));
  $('#pointCount').textContent = `(${points.length})`;
  const ul = $('#pointList'); ul.innerHTML = '';
  for (const { p, d } of list) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot" style="background:${esc(p.color)}"></span>
      <div class="info"><div class="name">${esc(p.name)}</div><div class="sub">${esc(p.note || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`)}</div></div>
      ${d != null ? `<div class="dist">${fmtDist(d)}<br>${compass(bearing(me, L.latLng(p)))}</div>` : ''}`;
    li.onclick = () => { closeSheets(); gps.follow = false; setLocateButton(); map.setView([p.lat, p.lng], Math.max(map.getZoom(), 17)); markers.get(p.id)?.openPopup(); };
    ul.appendChild(li);
  }
  if (!list.length) ul.innerHTML = '<li class="hint">No points yet.</li>';
}
$('#pointSearch').oninput = renderPointList;

/* point editor dialog */
const dlg = $('#pointDialog');
let editing = null;
let pickedColor = COLORS[0];
function buildColors() {
  const box = $('#pColors'); box.innerHTML = '';
  for (const c of COLORS) {
    const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', c);
    b.classList.toggle('sel', c === pickedColor);
    b.onclick = () => { pickedColor = c; buildColors(); };
    box.appendChild(b);
  }
}

function editPoint(p, latlng) {
  editing = p || { id: null, lat: latlng.lat, lng: latlng.lng };
  $('#pointDialogTitle').textContent = p ? 'Edit point' : 'New point';
  $('#pName').value = p ? p.name : '';
  $('#pNote').value = p ? p.note || '' : '';
  pickedColor = p ? p.color : load('verdun.lastColor', COLORS[0]);
  $('#pCoords').textContent = `${editing.lat.toFixed(6)}, ${editing.lng.toFixed(6)}`;
  $('#pDelete').classList.toggle('hidden', !p);
  buildColors(); dlg.showModal();
  if (!p) setTimeout(() => $('#pName').focus(), 50);
}

$('#pointForm').onsubmit = () => {
  const name = $('#pName').value.trim(); if (!name) return;
  if (editing.id) Object.assign(editing, { name, note: $('#pNote').value.trim(), color: pickedColor });
  else points.push({ id: uid(), name, note: $('#pNote').value.trim(), color: pickedColor, lat: editing.lat, lng: editing.lng, created: Date.now() });
  save('verdun.lastColor', pickedColor);
  savePoints(); renderMarkers(); renderPointList(); toast(`Saved “${name}”`);
};
$('#pCancel').onclick = () => dlg.close();
$('#pDelete').onclick = () => {
  if (!editing?.id || !confirm(`Delete “${editing.name}”?`)) return;
  points = points.filter((x) => x.id !== editing.id); savePoints(); renderMarkers(); renderPointList(); dlg.close();
};

/* placing mode */
function setPlacing(on) {
  $('#crosshair').classList.toggle('hidden', !on);
  $('#placebar').classList.toggle('hidden', !on);
  $('#blend').classList.toggle('hidden', on);
  $('#btnAdd').classList.toggle('active', on);
  $('#placeGps').classList.toggle('hidden', !gps.fix);
  if (on) closeSheets();
}
$('#btnAdd').onclick = () => setPlacing($('#placebar').classList.contains('hidden'));
$('#placeCancel').onclick = () => setPlacing(false);
$('#placeOk').onclick = () => { setPlacing(false); editPoint(null, map.getCenter()); };
$('#placeGps').onclick = () => { setPlacing(false); markMyPosition(); };
function markMyPosition() {
  if (!gps.fix) { toast('Turn on GPS first (bottom right button)'); return; }
  editPoint(null, L.latLng(gps.fix.lat, gps.fix.lng));
}
$('#markMe').onclick = markMyPosition;
map.on('contextmenu', (e) => editPoint(null, e.latlng)); // long press

/* import / export */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const xmlEsc = (s) => esc(s);
$('#exportGpx').onclick = () => {
  const wpts = points.map((p) => `  <wpt lat="${p.lat}" lon="${p.lng}"><name>${xmlEsc(p.name)}</name>${p.note ? `<desc>${xmlEsc(p.note)}</desc>` : ''}</wpt>`).join('\n');
  download('verdun-points.gpx', `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Verdun LiDAR" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n</gpx>\n`, 'application/gpx+xml');
};
$('#exportJson').onclick = () => {
  const fc = { type: 'FeatureCollection', features: points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.name, note: p.note, color: p.color, created: p.created } })) };
  download('verdun-points.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
};
$('#importFile').onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text(); let added = [];
  try {
    if (/^\s*</.test(text)) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      added = [...doc.getElementsByTagName('wpt')].map((w) => ({
        name: w.getElementsByTagName('name')[0]?.textContent || 'Point',
        note: w.getElementsByTagName('desc')[0]?.textContent || '',
        lat: +w.getAttribute('lat'), lng: +w.getAttribute('lon') }));
    } else {
      const gj = JSON.parse(text);
      added = (gj.features || []).filter((f) => f.geometry?.type === 'Point').map((f) => ({
        name: f.properties?.name || 'Point', note: f.properties?.note || f.properties?.description || '',
        color: f.properties?.color, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
    }
  } catch { toast('Could not read that file'); return; }
  added = added.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  points.push(...added.map((p) => ({ ...p, id: uid(), created: Date.now(), color: p.color || COLORS[0] })));
  savePoints(); renderMarkers(); renderPointList(); toast(`Imported ${added.length} points`); e.target.value = '';
};

renderMarkers();

/* ---------- offline download ---------- */
const TILE_CACHE = 'tiles-v1';
const DL_MIN_ZOOM = 10;
const dlDefs = [
  { ...BASES.satellite, checked: true },
  { ...LIDAR, checked: true },
  { ...BASES.plan, checked: false },
  ...OVERLAYS.filter((o) => o.type !== 'image').map((o) => ({ ...o, checked: false })),
];
(function buildDlLayers() {
  const box = $('#dlLayers');
  dlDefs.forEach((d, i) => {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox" ${d.checked ? 'checked' : ''}> ${esc(d.name)}`;
    l.firstChild.onchange = (e) => { dlDefs[i].checked = e.target.checked; updateEstimate(); };
    box.appendChild(l);
  });
})();
document.querySelectorAll('input[name=area]').forEach((r) => (r.onchange = updateEstimate));
$('#dlZoom').onchange = updateEstimate;

function dlBounds() { return document.querySelector('input[name=area]:checked').value === 'battlefield' ? BATTLEFIELD : map.getBounds(); }

function tileRange(bounds, z) {
  const nw = map.project(bounds.getNorthWest(), z).divideBy(256).floor();
  const se = map.project(bounds.getSouthEast(), z).divideBy(256).floor();
  return { x0: nw.x, x1: se.x, y0: nw.y, y1: se.y, n: (se.x - nw.x + 1) * (se.y - nw.y + 1) };
}

function plan() {
  const bounds = dlBounds(), maxZ = +$('#dlZoom').value, jobs = [];
  let total = 0, mb = 0;
  for (const d of dlDefs.filter((x) => x.checked)) {
    const z0 = Math.max(DL_MIN_ZOOM, d.minNativeZoom ?? 0), z1 = Math.min(maxZ, d.maxNativeZoom ?? 18);
    for (let z = z0; z <= z1; z++) { const r = tileRange(bounds, z); jobs.push({ d, z, r }); total += r.n; mb += (r.n * (d.kb || 30)) / 1024; }
  }
  return { jobs, total, mb };
}

function updateEstimate() {
  const { total, mb } = plan();
  const el = $('#dlEstimate');
  el.textContent = `${total.toLocaleString()} tiles, about ${mb < 1000 ? Math.round(mb) + ' MB' : (mb / 1024).toFixed(1) + ' GB'}`;
  el.classList.toggle('warn', total > 30000);
}

let dlAbort = null;
$('#dlStart').onclick = async () => {
  if (!('caches' in window)) { toast('Offline storage not supported here'); return; }
  const { jobs, total } = plan();
  if (!total) return;
  if (total > 30000 && !confirm(`That is ${total.toLocaleString()} tiles. It will take a long time and a lot of storage. Continue?`)) return;
  try { await navigator.storage?.persist?.(); } catch {}
  const cache = await caches.open(TILE_CACHE);
  const ctrl = (dlAbort = { stop: false });
  let done = 0, failed = 0, skipped = 0;
  $('#dlStart').classList.add('hidden'); $('#dlCancel').classList.remove('hidden');
  const prog = $('#dlProgress'); prog.classList.remove('hidden'); prog.max = total; prog.value = 0;

  function* urls() {
    for (const { d, z, r } of jobs)
      for (let x = r.x0; x <= r.x1; x++)
        for (let y = r.y0; y <= r.y1; y++) yield L.Util.template(d.url, { x, y, z, s: 'a' });
  }
  const it = urls();
  async function worker() {
    for (let n = it.next(); !n.done && !ctrl.stop; n = it.next()) {
      const url = n.value;
      try {
        if (await cache.match(url)) skipped++;
        else {
          const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 20000);
          try {
            const res = await fetch(url, { mode: 'cors', signal: ac.signal });
            if (res.ok) await cache.put(url, res); else if (res.status !== 404) failed++;
          } finally { clearTimeout(timer); }
        }
      } catch { failed++; }
      done++;
      if (done % 10 === 0 || done === total) {
        prog.value = done;
        $('#dlStatus').textContent = `${done.toLocaleString()} / ${total.toLocaleString()} (already saved: ${skipped}, failed: ${failed})`;
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  $('#dlStatus').textContent = ctrl.stop ? `Stopped after ${done.toLocaleString()} tiles.` : `Done. ${total.toLocaleString()} tiles checked, ${failed} failed.`;
  $('#dlStart').classList.remove('hidden'); $('#dlCancel').classList.add('hidden'); prog.classList.add('hidden');
  dlAbort = null; updateStorage();
};
$('#dlCancel').onclick = () => { if (dlAbort) dlAbort.stop = true; };

async function updateStorage() {
  const el = $('#storageInfo');
  try {
    const est = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.();
    el.textContent = `Used ${(est.usage / 1048576).toFixed(0)} MB of ${(est.quota / 1073741824).toFixed(1)} GB available.${persisted ? ' Protected from automatic cleanup.' : ''}`;
  } catch { el.textContent = ''; }
}
$('#dlClear').onclick = async () => {
  if (!confirm('Delete all downloaded map tiles from this phone?')) return;
  await caches.delete(TILE_CACHE); toast('Offline tiles deleted'); updateStorage();
};

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e));
}
