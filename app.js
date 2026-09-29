/* =====================================================================
   คุมงานก่อสร้าง (PWA) — ใช้งานคนเดียว ข้อมูลเก็บในเครื่อง (IndexedDB)
   ===================================================================== */
'use strict';
var APP_VERSION = '1.0.0';

/* ---------------- IndexedDB ---------------- */
var DB_NAME = 'sitecontrol', DB_VER = 1;
var STORES = ['projects', 'tasks', 'progress', 'daily', 'weekly', 'submittals', 'files', 'meta'];
var _db = null;
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise(function (res, rej) {
    var r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = function () {
      var db = r.result;
      STORES.forEach(function (s) {
        if (db.objectStoreNames.contains(s)) return;
        var os = db.createObjectStore(s, { keyPath: s === 'meta' ? 'key' : 'id' });
        if (s !== 'projects' && s !== 'meta') os.createIndex('projectId', 'projectId');
      });
    };
    r.onsuccess = function () { _db = r.result; res(_db); };
    r.onerror = function () { rej(r.error); };
    r.onblocked = function () { rej(new Error('ฐานข้อมูลถูกใช้งานในแท็บอื่น กรุณาปิดแท็บอื่นของแอปก่อน')); };
  });
}
function tx(store, mode, fn) {
  return openDB().then(function (db) {
    return new Promise(function (res, rej) {
      var t = db.transaction(store, mode), os = t.objectStore(store), out;
      var r = fn(os); if (r) r.onsuccess = function () { out = r.result; };
      t.oncomplete = function () { res(out); };
      t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error('ยกเลิกการบันทึก')); };
    });
  });
}
var DB = {
  get: function (s, id) { return tx(s, 'readonly', function (os) { return os.get(id); }); },
  put: function (s, o) { return tx(s, 'readwrite', function (os) { return os.put(o); }).then(function () { return o; }); },
  del: function (s, id) { return tx(s, 'readwrite', function (os) { return os.delete(id); }); },
  all: function (s) { return tx(s, 'readonly', function (os) { return os.getAll(); }); },
  byProject: function (s, pid) { return tx(s, 'readonly', function (os) { return os.index('projectId').getAll(pid); }); },
  putMany: function (s, arr) { return tx(s, 'readwrite', function (os) { arr.forEach(function (o) { os.put(o); }); }); },
  delMany: function (s, ids) { return tx(s, 'readwrite', function (os) { ids.forEach(function (id) { os.delete(id); }); }); },
  clear: function (s) { return tx(s, 'readwrite', function (os) { return os.clear(); }); }
};
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function meta(key, val) {
  if (val === undefined) return DB.get('meta', key).then(function (r) { return r ? r.value : null; });
  return DB.put('meta', { key: key, value: val });
}

/* ---------------- utilities ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function D(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function iso(d) { if (!d) return ''; var m = d.getMonth() + 1, x = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x; }
function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function diffDays(a, b) { return Math.round((a - b) / 86400000); }
function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
var TM = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var TMS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TDAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
function th(d, short) { if (typeof d === 'string') d = D(d); if (!d) return '-'; return d.getDate() + ' ' + (short ? TMS : TM)[d.getMonth()] + ' ' + (short ? String(d.getFullYear() + 543).slice(-2) : d.getFullYear() + 543); }
function pct(v, dp) { return (v * 100).toFixed(dp == null ? 2 : dp) + '%'; }
function money(v) { return num(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function jparse(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }
function toast(msg, err, ms) {
  $$('.toast').forEach(function (x) { x.remove(); });
  var t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(function () { t.remove(); }, ms || 3000);
}
function badge(o) { return '<span class="badge b-' + o.k + '">' + esc(o.t) + '</span>'; }
function parseDateAny(s) {
  s = String(s || '').trim(); if (!s) return '';
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) { var y = +m[1]; if (y > 2400) y -= 543; return iso(new Date(y, +m[2] - 1, +m[3])); }
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s);
  if (m) { var yy = +m[3]; if (yy < 100) yy += yy > 50 ? 2500 : 2000; if (yy > 2400) yy -= 543; return iso(new Date(yy, +m[2] - 1, +m[1])); }
  m = /^(\d{1,2})[\s\-]([A-Za-z]{3})[a-z]*[\s\-](\d{2,4})$/.exec(s);
  if (m) { var mi = 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m[2].toLowerCase()) / 3, y2 = +m[3]; if (y2 < 100) y2 += y2 > 50 ? 1957 : 2000; if (y2 > 2400) y2 -= 543; if (mi >= 0) return iso(new Date(y2, mi, +m[1])); }
  return 'X';
}

/* ---------------- state ---------------- */
var S = { projects: [], P: null, tasks: [], progress: [], daily: [], weekly: [], submittals: [], files: [], route: [], urls: {}, deferredInstall: null };

/* ---------------- calculations (ยกมาจากเว็บแอปที่ทดสอบแล้ว) ---------------- */
function parts() { return (S.P && S.P.parts) || []; }
function cats() { return (S.P && S.P.cats) || []; }
function projStart() { return D(S.P.start) || today(); }
function projDur() { return Math.max(1, num(S.P.duration)); }
function projEnd() { return addDays(projStart(), projDur() + num(S.P.eot_days) - 1); }
function weightFn(tasks) {
  tasks = tasks || S.tasks;
  var sb = tasks.reduce(function (a, t) { return a + num(t.boq); }, 0);
  return function (t) { return String(t.weight == null ? '' : t.weight).trim() !== '' && !isNaN(parseFloat(t.weight)) ? num(t.weight) / 100 : (sb ? num(t.boq) / sb : 0); };
}
function spanPct(s, f, d) { if (!s || !f) return 0; if (d >= f) return 1; if (d < s) return 0; return (diffDays(d, s) + 1) / (diffDays(f, s) + 1); }
function planAt(d, rev, tasks) {
  tasks = tasks || S.tasks; var w = weightFn(tasks);
  return tasks.reduce(function (a, t) { return a + w(t) * spanPct(D(rev && t.rs ? t.rs : t.bs), D(rev && t.rf ? t.rf : t.bf), d); }, 0);
}
function actualNow(tasks) { tasks = tasks || S.tasks; var w = weightFn(tasks); return tasks.reduce(function (a, t) { return a + w(t) * num(t.pct) / 100; }, 0); }
// ประวัติผลงาน: % ของรายการ ณ วันที่ d = บันทึกล่าสุดที่วันที่ ≤ d
function histIndex() {
  var m = {};
  S.progress.forEach(function (p) { (m[p.taskId] = m[p.taskId] || []).push(p); });
  Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0); }); });
  return m;
}
function taskPctAt(hist, taskId, dIso) { var a = hist[taskId], v = 0; if (!a) return 0; for (var i = 0; i < a.length && a[i].date <= dIso; i++) v = num(a[i].pct); return v; }
function actualAt(d, hist) {
  hist = hist || histIndex(); var w = weightFn(), di = iso(d);
  return S.tasks.reduce(function (a, t) { return a + w(t) * taskPctAt(hist, t.id, di) / 100; }, 0);
}
function weekRange(n) { var s = addDays(projStart(), 7 * (n - 1)); return { n: n, start: s, end: addDays(s, 6) }; }
function weekOf(d) { return Math.max(1, Math.floor(diffDays(d, projStart()) / 7) + 1); }
function lastFullWeek() { return Math.max(1, Math.floor((diffDays(today(), projStart()) + 1) / 7)); }
function totalWeeks() { return Math.max(1, Math.ceil((diffDays(projEnd(), projStart()) + 1) / 7)); }
function isMulti() { return S.P && S.P.type === 'multi'; }
function wbsList() {
  var P = parts(), C = cats(), seq = {};
  var rank = function (x, L) { var i = L.indexOf(x); return i < 0 ? 999 : i; };
  var sorted = S.tasks.map(function (t, i) { return { t: t, i: num(t.order) || i }; }).sort(function (a, b) {
    return (rank(a.t.part, P) - rank(b.t.part, P)) || (rank(a.t.cat, C) - rank(b.t.cat, C)) || (a.i - b.i); }).map(function (o) { return o.t; });
  return sorted.map(function (t) {
    var pi = P.indexOf(t.part) + 1, ci = C.indexOf(t.cat) + 1, k = pi + '.' + ci; seq[k] = (seq[k] || 0) + 1;
    var code = isMulti() ? (pi || '?') + '.' + (ci || '?') + '.' + (seq[k] < 10 ? '0' : '') + seq[k] : (ci || '?') + '.' + (seq[k] < 10 ? '0' : '') + seq[k];
    return { t: t, wbs: code };
  });
}
function wbsOf(id) { var x = wbsList().filter(function (o) { return o.t.id === id; })[0]; return x ? x.wbs : ''; }
function taskById(id) { return S.tasks.filter(function (t) { return t.id === id; })[0]; }
function taskStatus(t, d) {
  d = d || today(); var bs = D(t.bs), bf = D(t.bf), s = D(t.rs || t.bs), p = num(t.pct) / 100;
  if (!bs || !bf) return { k: 'na', t: '-' };
  if (t.af) return D(t.af) <= bf ? { k: 'ok', t: 'เสร็จ' } : { k: 'warn', t: 'เสร็จช้า' };
  if (!t.as && d < s) return { k: 'na', t: 'ยังไม่ถึงกำหนด' };
  if (p >= spanPct(bs, bf, d)) return { k: 'ok', t: 'ตามแผน' };
  return d > bf ? { k: 'bad', t: 'เกินกำหนด' } : { k: 'bad', t: 'ล่าช้า' };
}
function subRisk(s) {
  var t = taskById(s.taskId), d = today();
  if (s.status === 'อนุมัติ') return { k: 'ok', t: '✓ อนุมัติแล้ว' };
  if (!t) return { k: 'na', t: 'ไม่ได้ผูกกับรายการงาน' };
  var need = addDays(D(t.rs || t.bs), -num(s.lead_days)), left = diffDays(need, d);
  if (s.status === 'ไม่อนุมัติ') return { k: 'bad', t: '⚠ ไม่อนุมัติ – ต้องเสนอใหม่', need: need };
  if (left < 0) return { k: 'bad', t: '⚠ เลยกำหนดอนุมัติ ' + (-left) + ' วัน', need: need };
  if (left <= 14) return { k: 'warn', t: '⚠ ต้องอนุมัติภายใน ' + left + ' วัน', need: need };
  return { k: 'na', t: 'ติดตาม (เหลือ ' + left + ' วัน)', need: need };
}
function spiState(ac, pl) {
  if (ac >= 1) return { k: 'ok', t: 'แล้วเสร็จ' };
  if (!pl && !ac) return { k: 'na', t: 'ยังไม่เริ่ม' };
  if (ac >= pl) return { k: 'ok', t: 'ตามแผน' };
  return ac / pl >= 0.9 ? { k: 'warn', t: 'เฝ้าระวัง' } : { k: 'bad', t: 'ล่าช้า' };
}
// สรุปของโครงการ (ใช้ในหน้าหลัก โดยไม่ต้องสลับโครงการ)
function projectSummary(p, tasks) {
  var keep = S.P; S.P = p;
  try {
    var d = today(), pl = planAt(d, false, tasks), ac = actualNow(tasks);
    return { plan: pl, act: ac, st: spiState(ac, pl), end: projEnd(), n: tasks.length };
  } finally { S.P = keep; }
}

/* ---------------- routing & shell ---------------- */
function go(path) { if (location.hash !== '#' + path) location.hash = path; else render(); }
function parseRoute() { return (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent); }
var NAV_P = [['dash', '📊', 'ภาพรวม'], ['tasks', '🧱', 'ผลงาน'], ['daily', '📝', 'รายวัน'], ['weekly', '🗓️', 'รายสัปดาห์'], ['mat', '📦', 'วัสดุ']];
function renderNav() {
  var r = S.route, inP = r[0] === 'p' && S.P, cur = inP ? (r[2] || 'dash') : (r[0] || 'home');
  if (cur === 'print') cur = r[3] === 'mat' ? 'mat' : r[3];
  var items = inP ? NAV_P.map(function (n) { return ['/p/' + S.P.id + (n[0] === 'dash' ? '' : '/' + n[0]), n[1], n[2], n[0]]; })
    : [['/', '🏠', 'โครงการ', 'home'], ['/app', '⚙️', 'ตั้งค่าแอป', 'app']];
  var btn = function (n) { return '<button data-go="' + esc(n[0]) + '" class="' + (cur === n[3] ? 'on' : '') + '"' + (cur === n[3] ? ' aria-current="page"' : '') + '><b>' + n[1] + '</b>' + esc(n[2]) + '</button>'; };
  $('#bottomNav').innerHTML = items.map(btn).join('');
  $('#sideNav').innerHTML = items.map(btn).join('') + (inP ? '<div class="sep"></div>' + btn(['/p/' + S.P.id + '/set', '⚙️', 'ตั้งค่าโครงการ', 'set']) + btn(['/', '🏠', 'ทุกโครงการ', 'home']) : '');
  $('#brandText').innerHTML = inP ? esc(S.P.name) + '<small>' + (S.P.type === 'multi' ? 'โครงการหลายงานส่วน' : 'งานก่อสร้าง') + '</small>' : 'คุมงานก่อสร้าง<small>ทุกโครงการ</small>';
  document.title = inP ? S.P.name + ' – คุมงานก่อสร้าง' : 'คุมงานก่อสร้าง';
}
var chart = null;
async function render() {
  S.route = parseRoute();
  var r = S.route, m = $('#main');
  if (chart) { chart.destroy(); chart = null; }
  try {
    if (r[0] === 'p') {
      if (!S.P || S.P.id !== r[1]) await loadProject(r[1]);
      if (!S.P) { go('/'); return; }
      var v = r[2] || 'dash';
      var views = { dash: vDash, tasks: vTasks, daily: vDaily, weekly: vWeekly, mat: vMat, set: vProjSet, print: vPrint };
      renderNav();
      m.innerHTML = await (views[v] || vDash)(r.slice(3));
    } else {
      S.P = null; renderNav();
      m.innerHTML = r[0] === 'app' ? await vApp() : await vHome();
    }
  } catch (e) { console.error(e); m.innerHTML = '<div class="card"><h2>เกิดข้อผิดพลาด</h2><p>' + esc(e.message) + '</p><button class="btn" data-go="/">กลับหน้าหลัก</button></div>'; }
  afterRender();
}
var _after = [];
function after(fn) { _after.push(fn); }
function afterRender() { var q = _after; _after = []; q.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); hydrateImgs(); }
async function loadProject(id) {
  var p = await DB.get('projects', id); S.P = p || null; if (!p) return;
  var res = await Promise.all(['tasks', 'progress', 'daily', 'weekly', 'submittals', 'files'].map(function (s) { return DB.byProject(s, id); }));
  S.tasks = res[0]; S.progress = res[1]; S.daily = res[2]; S.weekly = res[3]; S.submittals = res[4]; S.files = res[5];
  Object.keys(S.urls).forEach(function (k) { URL.revokeObjectURL(S.urls[k]); }); S.urls = {};
}
async function saveProject() { S.P.updated = new Date().toISOString(); await DB.put('projects', S.P); }

/* ---------------- modal ---------------- */
function modal(html, onOk, okText, wide) {
  var bg = document.createElement('div'); bg.className = 'mbg';
  bg.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '<div class="mfoot"><button class="btn sec" data-x>' + (onOk ? 'ยกเลิก' : 'ปิด') + '</button>' +
    (onOk ? '<button class="btn" data-ok>' + (okText || 'บันทึก') + '</button>' : '') + '</div></div>';
  document.body.appendChild(bg);
  var close = function () { bg.remove(); document.removeEventListener('keydown', key); };
  var key = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  bg.addEventListener('click', function (e) { if (e.target === bg || e.target.hasAttribute('data-x')) close(); });
  var ok = bg.querySelector('[data-ok]');
  if (ok) ok.addEventListener('click', async function () {
    ok.disabled = true;
    try { if ((await onOk(bg)) !== false) close(); } catch (e) { toast(e.message, true); } finally { ok.disabled = false; }
  });
  var first = bg.querySelector('input:not([type=hidden]):not([disabled]),select,textarea'); if (first) setTimeout(function () { first.focus(); }, 30);
  return bg;
}
function val(bg, id) { var e = bg.querySelector('#' + id); return e ? String(e.value).trim() : ''; }
function inp(id, lab, v, type, extra) { return '<div><label class="f" for="' + id + '">' + lab + '</label><input id="' + id + '" class="i" ' + (type ? 'type="' + type + '" ' : '') + 'value="' + esc(v == null ? '' : v) + '" ' + (extra || '') + '></div>'; }
function opts(list, cur, blank) { return (blank != null ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (x) { var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); }
function confirmBox(msg, okText) {
  return new Promise(function (res) {
    var done = false;
    var bg = modal('<h2>ยืนยัน</h2><p>' + esc(msg) + '</p>', function () { done = true; res(true); }, okText || 'ยืนยัน');
    new MutationObserver(function (m, o) { if (!document.body.contains(bg)) { o.disconnect(); if (!done) res(false); } }).observe(document.body, { childList: true });
  });
}

/* ---------------- files (รูปภาพ/PDF เก็บเป็น Blob ในเครื่อง) ---------------- */
function filesOf(kind, ref) { return S.files.filter(function (f) { return f.kind === kind && String(f.ref) === String(ref); }).sort(function (a, b) { return (a.created || '') < (b.created || '') ? -1 : 1; }); }
function fileUrl(f) { if (!S.urls[f.id]) S.urls[f.id] = URL.createObjectURL(f.blob); return S.urls[f.id]; }
function hydrateImgs() {
  $$('[data-fimg]').forEach(function (el) {
    var f = S.files.filter(function (x) { return x.id === el.dataset.fimg; })[0]; if (!f) return;
    var u = fileUrl(f); if (el.tagName === 'IMG') el.src = u; else { el.style.backgroundImage = 'url("' + u + '")'; el.textContent = ''; }
    el.removeAttribute('data-fimg');
  });
}
function compressImage(file, doc) {
  var max = doc ? 2400 : 1600, q = doc ? 0.9 : 0.82;
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, max / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) {
        // ถ้าไฟล์เดิมเล็กกว่าผลที่ย่อ และไม่ต้องย่อขนาด ใช้ไฟล์เดิม (ไม่ทำให้ใหญ่ขึ้นหรือคมชัดลดลง)
        if (sc === 1 && /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= b.size) return res({ blob: file, mime: file.type, name: file.name || 'photo' });
        res({ blob: b, mime: 'image/jpeg', name: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg' });
      }, 'image/jpeg', q);
    };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('อ่านรูป ' + file.name + ' ไม่ได้ (รองรับ JPG/PNG/WEBP)')); };
    img.src = url;
  });
}
async function addFiles(kind, ref, list, allowPdf) {
  var arr = Array.prototype.slice.call(list || []), ok = 0;
  for (var i = 0; i < arr.length; i++) {
    var f = arr[i];
    try {
      var r;
      if (f.type === 'application/pdf') { if (!allowPdf) throw new Error('แนบได้เฉพาะรูปภาพ'); if (f.size > 20 * 1024 * 1024) throw new Error(f.name + ' ใหญ่เกิน 20 MB'); r = { blob: f, mime: f.type, name: f.name }; }
      else if (/^image\//.test(f.type)) r = await compressImage(f, kind === 'submittal');
      else throw new Error(f.name + ': รองรับเฉพาะรูปภาพ' + (allowPdf ? ' และ PDF' : ''));
      var rec = { id: uid(), projectId: S.P.id, kind: kind, ref: String(ref), caption: '', mime: r.mime, name: r.name, size: r.blob.size, blob: r.blob, created: new Date().toISOString() };
      await DB.put('files', rec); S.files.push(rec); ok++;
    } catch (e) { toast(e.message, true); await new Promise(function (z) { setTimeout(z, 1200); }); }
  }
  if (ok) toast('เพิ่มแล้ว ' + ok + ' ไฟล์');
  return ok;
}
function filesBlock(kind, ref, editable, allowPdf) {
  var list = filesOf(kind, ref);
  var h = editable ? '<label class="drop">📷 ' + (allowPdf ? 'เพิ่มรูปถ่าย หรือไฟล์ PDF (สเปก/แคตตาล็อก/ใบรับรอง)' : 'เพิ่มรูปถ่ายหน้างาน') + ' – แตะเพื่อเลือก หรือถ่ายจากกล้อง' +
    '<input type="file" class="hidden" multiple accept="' + (allowPdf ? 'image/*,application/pdf' : 'image/*') + '" data-up="' + kind + '" data-ref="' + esc(ref) + '" data-pdf="' + (allowPdf ? 1 : 0) + '"></label>' : '';
  if (!list.length) return h + (editable ? '' : '<div class="muted">ไม่มีไฟล์แนบ</div>');
  return h + '<div class="files">' + list.map(function (f) {
    var pdf = f.mime === 'application/pdf';
    return '<div class="fcard"><div class="fthumb" ' + (pdf ? '' : 'data-fimg="' + f.id + '"') + ' data-open="' + f.id + '" title="' + esc(f.name) + '">' + (pdf ? '📄' : '') + '</div>' +
      (editable ? '<input class="fcap" data-cap="' + f.id + '" placeholder="คำอธิบาย…" value="' + esc(f.caption) + '">' : '<div class="fcap">' + esc(f.caption || f.name) + '</div>') +
      (editable ? '<button class="fdel" data-fdel="' + f.id + '" aria-label="ลบไฟล์">🗑 ลบ</button>' : '') + '</div>';
  }).join('') + '</div>';
}
function openFile(id) {
  var f = S.files.filter(function (x) { return x.id === id; })[0]; if (!f) return;
  var u = fileUrl(f);
  if (f.mime === 'application/pdf') { window.open(u, '_blank', 'noopener'); return; }
  var lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = '<img src="' + u + '" alt="' + esc(f.caption) + '">'; lb.onclick = function () { lb.remove(); }; document.body.appendChild(lb);
}

/* ---------------- HOME: รายการโครงการ ---------------- */
async function vHome() {
  S.projects = (await DB.all('projects')).sort(function (a, b) { return (b.updated || '') < (a.updated || '') ? -1 : 1; });
  var allTasks = await DB.all('tasks'), lastBk = await meta('lastBackup');
  var h = '';
  var old = !lastBk || diffDays(today(), D(lastBk.slice(0, 10))) >= 7;
  if (S.projects.length && old) h += '<div class="banner warn">💾 <span class="grow">' + (lastBk ? 'สำรองข้อมูลครั้งล่าสุด ' + th(lastBk.slice(0, 10), true) : 'ยังไม่เคยสำรองข้อมูล') + ' – ข้อมูลอยู่ในเครื่องนี้เท่านั้น ควรสำรองสัปดาห์ละครั้ง</span><button class="btn sm acc" data-act="backup">สำรองเดี๋ยวนี้</button></div>';
  h += '<div class="between" style="margin-bottom:12px"><div class="h2" style="margin:0">โครงการทั้งหมด (' + S.projects.filter(function (p) { return !p.archived; }).length + ')</div><div class="row">' +
    '<button class="btn sec" data-act="importXlsx">📗 นำเข้าจาก Excel v4</button><button class="btn" data-act="newProject">＋ โครงการใหม่</button></div></div>';
  if (!S.projects.length) return h + '<div class="card empty"><div style="font-size:40px">🏗️</div><p><b>ยังไม่มีโครงการ</b></p><p>เริ่มจากสร้างโครงการใหม่ นำเข้าจากไฟล์ Excel v4 ที่มีอยู่ หรือลองโครงการตัวอย่างเพื่อดูการทำงาน</p>' +
    '<div class="row" style="justify-content:center"><button class="btn" data-act="newProject">＋ โครงการใหม่</button><button class="btn sec" data-act="sample">ลองโครงการตัวอย่าง</button></div></div>';
  var act = S.projects.filter(function (p) { return !p.archived; }), arc = S.projects.filter(function (p) { return p.archived; });
  var card = function (p) {
    var ts = allTasks.filter(function (t) { return t.projectId === p.id; }), s = projectSummary(p, ts), left = diffDays(s.end, today());
    return '<div class="card pcard" data-go="/p/' + p.id + '" tabindex="0"><div class="between"><div class="grow"><div class="t" style="font-weight:700;font-size:16px">' + esc(p.name) + '</div>' +
      '<div class="muted">' + (p.type === 'multi' ? 'หลายงานส่วน (' + (p.parts || []).length + ' งานส่วน)' : 'งานเดียว') + ' • ' + s.n + ' รายการ • ' + (left >= 0 ? 'เหลือ ' + left + ' วัน' : 'เลยกำหนด ' + (-left) + ' วัน') + '</div></div>' + badge(s.st) + '</div>' +
      '<div class="bar"><i style="width:' + Math.min(100, s.act * 100).toFixed(1) + '%"></i><b style="left:' + Math.min(100, s.plan * 100).toFixed(1) + '%"></b></div>' +
      '<div class="muted">ผลงานจริง <b>' + pct(s.act) + '</b> • แผน ' + pct(s.plan) + ' • สิ้นสุดสัญญา ' + th(s.end, true) + '</div></div>';
  };
  h += act.map(card).join('') || '<div class="card empty">ไม่มีโครงการที่กำลังดำเนินการ</div>';
  if (arc.length) h += '<details class="pgroup"><summary>โครงการที่เก็บเข้าคลัง (' + arc.length + ')</summary>' + arc.map(card).join('') + '</details>';
  return h;
}
var PROJ_FIELDS = [['employer', 'ผู้ว่าจ้าง'], ['contractor', 'ผู้รับจ้าง'], ['contract_no', 'เลขที่สัญญา'], ['contract_date', 'วันที่ลงนามสัญญา', 'date'],
  ['bac', 'มูลค่าสัญญา (บาท)', '', 'inputmode="decimal"'], ['start', 'วันเริ่มสัญญา', 'date'], ['duration', 'ระยะเวลาสัญญา (วัน)', '', 'inputmode="numeric"'], ['eot_days', 'ขยายเวลาที่อนุมัติแล้ว (วัน)', '', 'inputmode="numeric"'],
  ['org', 'ส่วนราชการ (หัวบันทึกข้อความ)'], ['doc_prefix', 'เลขที่หนังสือ (ที่)'], ['supervisor_name', 'ชื่อผู้ควบคุมงาน'], ['supervisor_pos', 'ตำแหน่งผู้ควบคุมงาน'],
  ['chair', 'ประธานกรรมการตรวจรับ'], ['member1', 'กรรมการ คนที่ 1'], ['member2', 'กรรมการ คนที่ 2']];
function projectForm(p) {
  p = p || { type: 'single', start: iso(today()), duration: 180, eot_days: 0, supervisor_pos: 'ผู้ควบคุมงาน',
    parts: ['งานก่อสร้างอาคาร'], cats: ['งานเตรียมการ', 'งานโครงสร้าง', 'งานสถาปัตยกรรม', 'งานระบบ'] };
  return '<label class="f" for="pName">ชื่อโครงการ</label><input id="pName" class="i" value="' + esc(p.name) + '">' +
    '<label class="f">ลักษณะงาน</label><div class="seg" id="pType">' +
    '<button type="button" data-t="single" class="' + (p.type !== 'multi' ? 'on' : '') + '">🏢 งานก่อสร้างงานเดียว</button><button type="button" data-t="multi" class="' + (p.type === 'multi' ? 'on' : '') + '">🏘️ โครงการหลายงานส่วน</button></div>' +
    '<p class="muted" id="pTypeHelp"></p>' +
    '<div class="grid2">' + PROJ_FIELDS.map(function (f) { return inp('pf_' + f[0], f[1], p[f[0]], f[2], f[3]); }).join('') + '</div>' +
    '<div class="grid2"><div id="pPartsBox"><label class="f" for="pParts">งานส่วน (บรรทัดละ 1 รายการ) เช่น อาคาร รั้ว ถนน</label><textarea id="pParts" class="i" rows="5">' + esc((p.parts || []).join('\n')) + '</textarea></div>' +
    '<div><label class="f" for="pCats">หมวดงาน (บรรทัดละ 1 รายการ)</label><textarea id="pCats" class="i" rows="5">' + esc((p.cats || []).join('\n')) + '</textarea></div></div>';
}
function wireProjectForm(bg) {
  var setType = function (t) {
    $$('#pType button', bg).forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    bg.querySelector('#pPartsBox').classList.toggle('hidden', t !== 'multi');
    bg.querySelector('#pTypeHelp').textContent = t === 'multi' ? 'เช่น โครงการที่มีอาคาร รั้ว รางระบายน้ำ ถนน ทำพร้อมกันได้ – สรุปผลแยกรายงานส่วนให้อัตโนมัติ' : 'อาคารหรืองานก่อสร้างเดียว – รายการงานแบ่งตามหมวดงาน';
    bg.dataset.type = t;
  };
  $$('#pType button', bg).forEach(function (b) { b.onclick = function () { setType(b.dataset.t); }; });
  setType($('#pType button.on', bg).dataset.t);
}
function readProjectForm(bg, p) {
  p = p || { id: uid(), created: new Date().toISOString() };
  p.name = val(bg, 'pName'); if (!p.name) throw new Error('กรอกชื่อโครงการ');
  p.type = bg.dataset.type || 'single';
  PROJ_FIELDS.forEach(function (f) { p[f[0]] = val(bg, 'pf_' + f[0]); });
  if (!D(p.start)) throw new Error('กรอกวันเริ่มสัญญา');
  if (num(p.duration) <= 0) throw new Error('ระยะเวลาสัญญาต้องมากกว่า 0');
  var lines = function (id) { return val(bg, id).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
  p.cats = lines('pCats'); if (!p.cats.length) p.cats = ['งานทั่วไป'];
  p.parts = p.type === 'multi' ? lines('pParts') : (p.parts && p.parts.length ? [p.parts[0]] : ['งานหลัก']);
  if (!p.parts.length) throw new Error('โครงการหลายงานส่วนต้องมีอย่างน้อย 1 งานส่วน');
  return p;
}
function newProject() {
  var bg = modal('<h2>โครงการใหม่</h2>' + projectForm(), async function (bg) {
    var p = readProjectForm(bg); p.updated = new Date().toISOString();
    await DB.put('projects', p); toast('สร้างโครงการแล้ว – เพิ่มรายการงานได้เลย'); go('/p/' + p.id + '/tasks');
  }, 'สร้างโครงการ', true);
  wireProjectForm(bg);
}

/* ---------------- นำเข้าไฟล์ Excel v4 (สร้างเป็นโครงการใหม่) ---------------- */
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  var tryLoad = function (src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); };
  return tryLoad('vendor/xlsx.full.min.js').catch(function () { return tryLoad('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); })
    .catch(function () { throw new Error('โหลดตัวอ่านไฟล์ Excel ไม่ได้'); });
}
function sheetRows(ws) { if (!ws || !ws['!ref']) return []; var r = XLSX.utils.decode_range(ws['!ref']); r.s.c = 0; r.s.r = 0; return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', range: r }); }
function xDate(v) { if (v === '' || v == null) return ''; if (typeof v === 'number') { var p = XLSX.SSF.parse_date_code(v); return p ? iso(new Date(p.y, p.m - 1, p.d)) : ''; } var r = parseDateAny(v); return r === 'X' ? '' : r; }
function xPct(v) { if (v === '' || v == null) return ''; var n = typeof v === 'number' ? v : num(String(v).replace('%', '')) / (String(v).indexOf('%') >= 0 ? 100 : 1); return n > 1 ? +n.toPrecision(12) : +(n * 100).toPrecision(12); }
function hdrKey(h) { return String(h == null ? '' : h).split('\n')[0].trim(); }
function parseV4(wb) {
  var out = { tasks: [], settings: {}, warnings: [] };
  var sn = wb.SheetNames.filter(function (n) { return /แผนงาน|Schedule/i.test(n); })[0];
  if (!sn) throw new Error('ไม่พบชีต "แผนงาน" – ไฟล์นี้ไม่ใช่แม่แบบ v4 หรือไฟล์ที่ส่งออกจากแอปนี้');
  var rows = sheetRows(wb.Sheets[sn]);
  var hr = rows.findIndex(function (r) { return r.some(function (c) { return hdrKey(c) === 'รายการงาน'; }); });
  if (hr < 0) throw new Error('ไม่พบหัวตาราง "รายการงาน" ในชีตแผนงาน');
  var H = rows[hr].map(hdrKey), col = function (n) { return H.indexOf(n); };
  var all = function (n) { return H.map(function (h, i) { return h === n ? i : -1; }).filter(function (i) { return i >= 0; }); };
  var st = all('เริ่ม'), fi = all('เสร็จ'), cPart = col('งานส่วน'), cCat = col('หมวดงาน'), cDesc = col('รายการงาน'), cBoq = col('มูลค่า BOQ'), cW = col('น้ำหนักกำหนดเอง'), cP = col('% งานนี้'), cRm = col('หมายเหตุ / ปัญหา');
  if (st.length < 3 && col('เริ่มแผน') >= 0) { st = [col('เริ่มแผน'), col('เริ่มเร่งรัด'), col('เริ่มจริง')]; fi = [col('เสร็จแผน'), col('เสร็จเร่งรัด'), col('เสร็จจริง')]; cW = col('น้ำหนัก'); cP = col('% จริง'); cRm = col('หมายเหตุ'); }
  if (st.length < 3 || fi.length < 3 || cDesc < 0 || st.concat(fi).some(function (x) { return x < 0; })) throw new Error('โครงสร้างคอลัมน์ในชีตแผนงานไม่ตรงกับแม่แบบ v4');
  for (var i = hr + 1; i < rows.length; i++) {
    var r = rows[i], desc = String(r[cDesc] || '').trim();
    if (!desc) continue; if (/^รวม/.test(desc)) break;
    var t = { part: cPart >= 0 ? String(r[cPart] || '').trim() : '', cat: cCat >= 0 ? String(r[cCat] || '').trim() : '', desc: desc,
      boq: r[cBoq] === '' || cBoq < 0 ? '' : String(num(r[cBoq])), weight: cW >= 0 ? String(xPct(r[cW])) : '',
      bs: xDate(r[st[0]]), bf: xDate(r[fi[0]]), rs: xDate(r[st[1]]), rf: xDate(r[fi[1]]), as: xDate(r[st[2]]), af: xDate(r[fi[2]]),
      pct: cP >= 0 && r[cP] !== '' ? String(+xPct(r[cP]).toFixed(2)) : '0', remark: cRm >= 0 ? String(r[cRm] || '') : '' };
    if (!t.bs || !t.bf) { out.warnings.push('แถว ' + (i + 1) + ' "' + desc.slice(0, 30) + '" ไม่มีวันแผน – ข้าม'); continue; }
    out.tasks.push(t);
  }
  var ssn = wb.SheetNames.filter(function (n) { return /ตั้งค่า|Setup/i.test(n); })[0];
  if (ssn) {
    var map = [['ชื่อโครงการ (ไทย)', 'name', 't'], ['ผู้ว่าจ้าง', 'employer', 't'], ['ผู้รับจ้าง', 'contractor', 't'], ['เลขที่สัญญา', 'contract_no', 't'],
      ['มูลค่าสัญญา', 'bac', 'n'], ['วันเริ่มสัญญา', 'start', 'd'], ['ระยะเวลาสัญญา', 'duration', 'n']];
    sheetRows(wb.Sheets[ssn]).forEach(function (r) { var lab = String(r[1] || ''); map.forEach(function (m) {
      if (lab.indexOf(m[0]) === 0 && r[2] !== '' && out.settings[m[1]] == null) { var v = r[2]; out.settings[m[1]] = m[2] === 'n' ? String(num(v)) : m[2] === 'd' ? xDate(v) : String(v).trim(); } }); });
  }
  var smn = wb.SheetNames.filter(function (n) { return n === 'สรุป'; })[0];
  if (!ssn && smn) sheetRows(wb.Sheets[smn]).forEach(function (r) { var lab = String(r[0] || ''), v = r[1]; if (v === '' || v == null) return;
    if (lab === 'โครงการ') out.settings.name = String(v); else if (lab === 'ผู้รับจ้าง') out.settings.contractor = String(v); else if (lab === 'ผู้ว่าจ้าง') out.settings.employer = String(v);
    else if (lab === 'มูลค่าสัญญาเดิม') out.settings.bac = String(num(v)); else if (lab === 'วันเริ่มสัญญา') out.settings.start = xDate(v); else if (lab === 'ระยะเวลาสัญญา (วัน)') out.settings.duration = String(num(v)); });
  return out;
}
function importXlsx() {
  var parsed = null;
  var bg = modal('<h2>สร้างโครงการจากไฟล์ Excel</h2><p class="muted">รองรับไฟล์แม่แบบ v4 (Plan_vs_Actual หรือ MultiPackage) และไฟล์ที่ส่งออกจากแอปนี้ • อ่านรายการงาน วันแผน วันจริง % ผลงาน และข้อมูลสัญญา</p>' +
    '<label class="drop">📗 เลือกไฟล์ .xlsx<input type="file" id="xf" class="hidden" accept=".xlsx"></label><div id="xPrev"></div>', async function () {
      if (!parsed) throw new Error('เลือกไฟล์ก่อน');
      var s = parsed.settings, multi = parsed.tasks.some(function (t) { return t.part; }) && new Set(parsed.tasks.map(function (t) { return t.part; })).size > 1;
      var p = { id: uid(), created: new Date().toISOString(), updated: new Date().toISOString(), name: val(bg, 'xName') || s.name || 'โครงการจาก Excel', type: multi ? 'multi' : 'single',
        employer: s.employer || '', contractor: s.contractor || '', contract_no: s.contract_no || '', bac: s.bac || '', start: s.start || iso(today()), duration: s.duration || '180', eot_days: '0',
        supervisor_pos: 'ผู้ควบคุมงาน', parts: [], cats: [] };
      parsed.tasks.forEach(function (t) { t.part = t.part || 'งานหลัก'; t.cat = t.cat || 'งานทั่วไป'; if (p.parts.indexOf(t.part) < 0) p.parts.push(t.part); if (p.cats.indexOf(t.cat) < 0) p.cats.push(t.cat); });
      var now = new Date().toISOString(), tasks = parsed.tasks.map(function (t, i) { return Object.assign({ id: uid() + i, projectId: p.id, order: i + 1, updated: now }, t); });
      var prog = tasks.filter(function (t) { return num(t.pct) > 0; }).map(function (t) {
        return { id: uid() + t.id, projectId: p.id, taskId: t.id, date: t.af || (t.as && D(t.as) > today() ? t.as : iso(today())), pct: num(t.pct), note: 'นำเข้าจาก Excel', source: 'import', ts: Date.now() }; });
      await DB.put('projects', p); await DB.putMany('tasks', tasks); await DB.putMany('progress', prog);
      toast('สร้างโครงการ "' + p.name + '" แล้ว (' + tasks.length + ' รายการ)'); go('/p/' + p.id);
    }, 'สร้างโครงการ', true);
  bg.querySelector('#xf').addEventListener('change', async function (e) {
    var f = e.target.files[0], box = bg.querySelector('#xPrev'); if (!f) return;
    box.innerHTML = '<p class="muted"><span class="spin"></span> กำลังอ่านไฟล์…</p>';
    try {
      await loadXlsx(); parsed = parseV4(XLSX.read(await f.arrayBuffer(), { type: 'array' }));
      var p = parsed, started = p.tasks.filter(function (t) { return num(t.pct) > 0; }).length, nParts = new Set(p.tasks.map(function (t) { return t.part; }).filter(Boolean)).size;
      box.innerHTML = inp('xName', 'ชื่อโครงการ', p.settings.name || f.name.replace(/\.xlsx$/i, '')) +
        '<p style="margin-top:10px">พบ <b>' + p.tasks.length + '</b> รายการงาน' + (nParts > 1 ? ' ใน <b>' + nParts + '</b> งานส่วน' : '') + ' • มีผลงานแล้ว ' + started + ' รายการ' +
        (p.settings.bac ? ' • มูลค่าสัญญา ' + money(p.settings.bac) : '') + (p.settings.start ? ' • เริ่ม ' + th(p.settings.start, true) + ' ' + (p.settings.duration || '') + ' วัน' : '') + '</p>' +
        (p.warnings.length ? '<p class="warn-t">⚠ ' + p.warnings.map(esc).join('<br>⚠ ') + '</p>' : '') +
        '<div class="tw" style="max-height:230px;overflow:auto"><table><tr><th>งานส่วน/หมวด</th><th>รายการ</th><th>แผน</th><th class="num">% จริง</th></tr>' +
        p.tasks.slice(0, 50).map(function (t) { return '<tr><td>' + esc(t.part ? t.part + ' • ' : '') + esc(t.cat) + '</td><td>' + esc(t.desc) + '</td><td>' + th(t.bs, true) + ' – ' + th(t.bf, true) + '</td><td class="num">' + num(t.pct) + '%</td></tr>'; }).join('') + '</table></div>' +
        '<p class="muted">ผลงานที่มีอยู่จะบันทึกเป็นประวัติ ณ วันนำเข้า (หรือวันเสร็จจริง) – ประวัติรายงวดใน Excel ไม่ถูกนำเข้า</p>';
    } catch (er) { parsed = null; box.innerHTML = '<p class="bad-t">' + esc(er.message) + '</p>'; }
  });
}

/* ---------------- DASHBOARD ---------------- */
function kpi(l, v, s, cls) { return '<div class="kpi"><div class="l">' + l + '</div><div class="v ' + (cls || '') + '">' + v + '</div><div class="s">' + (s || '') + '</div></div>'; }
function groupStats(filterFn, d, hist) {
  var w = weightFn(), ts = S.tasks.filter(filterFn), W = ts.reduce(function (a, t) { return a + w(t); }, 0);
  if (!W) return null;
  var pl = ts.reduce(function (a, t) { return a + w(t) * spanPct(D(t.bs), D(t.bf), d); }, 0) / W;
  var ac = ts.reduce(function (a, t) { return a + w(t) * num(t.pct) / 100; }, 0) / W;
  var s = ts.map(function (t) { return D(t.bs); }).filter(Boolean).sort(function (a, b) { return a - b; })[0];
  var f = ts.map(function (t) { return D(t.bf); }).filter(Boolean).sort(function (a, b) { return b - a; })[0];
  return { n: ts.length, W: W, pl: pl, ac: ac, st: spiState(ac, pl), s: s, f: f, behind: ts.filter(function (t) { return taskStatus(t, d).k === 'bad'; }).length };
}
async function vDash() {
  var d = today(), pid = S.P.id;
  if (!S.tasks.length) return '<div class="card empty"><div style="font-size:40px">🧱</div><p><b>ยังไม่มีรายการงาน</b></p><p>เพิ่มรายการงานพร้อมวันเริ่ม-เสร็จตามแผน แล้วระบบจะคำนวณแผนงานและ S-Curve ให้</p>' +
    '<button class="btn" data-go="/p/' + pid + '/tasks">ไปที่แท็บผลงาน</button></div>';
  var pl = planAt(d), ac = actualNow(), rv = planAt(d, true), el = diffDays(d, projStart()) + 1, tot = projDur() + num(S.P.eot_days), rem = diffDays(projEnd(), d);
  var spi = pl ? ac / pl : 0, vd = Math.round((ac - pl) * projDur());
  var behind = S.tasks.filter(function (t) { return taskStatus(t).k === 'bad'; });
  var risk = S.submittals.filter(function (s) { var k = subRisk(s).k; return k === 'bad' || k === 'warn'; }).length;
  var todayRep = S.daily.filter(function (x) { return x.date === iso(d); })[0];
  var h = '';
  if (!todayRep && d >= projStart() && d <= addDays(projEnd(), 60)) h += '<div class="banner info">📝 <span class="grow">ยังไม่ได้บันทึกรายงานประจำวันของวันนี้</span><button class="btn sm" data-go="/p/' + pid + '/daily/' + iso(d) + '">บันทึกเลย</button></div>';
  h += '<div class="card"><div class="between"><h2 style="margin:0">ภาพรวม ณ ' + th(d) + '</h2>' + badge(spiState(ac, pl)) + '</div><div class="kpis" style="margin-top:10px">' +
    kpi('ผลงานตามแผน', pct(pl), (S.tasks.some(function (t) { return t.rs || t.rf; }) ? 'แผนเร่งรัด ' + pct(rv) : '&nbsp;')) +
    kpi('ผลงานจริง', pct(ac), S.tasks.length + ' รายการ', ac >= pl ? 'ok-t' : 'bad-t') +
    kpi('เร็ว/ช้ากว่าแผน', (ac - pl >= 0 ? '+' : '') + pct(ac - pl), 'ประมาณ ' + (vd >= 0 ? '+' : '') + vd + ' วัน', ac >= pl ? 'ok-t' : 'bad-t') +
    kpi('SPI', spi.toFixed(2), spi >= 1 ? 'ตามแผน' : spi >= 0.9 ? 'เฝ้าระวัง' : 'ล่าช้ามาก', spi >= 1 ? 'ok-t' : spi >= 0.9 ? 'warn-t' : 'bad-t') +
    kpi('ระยะเวลา', Math.max(0, el) + ' / ' + tot + ' วัน', rem >= 0 ? 'คงเหลือ ' + rem + ' วัน' : 'เลยกำหนด ' + (-rem) + ' วัน', rem < 0 ? 'bad-t' : '') +
    kpi('ต้องติดตาม', behind.length + ' รายการ', 'วัสดุเสี่ยงกระทบแผน ' + risk + ' รายการ', behind.length ? 'bad-t' : 'ok-t') + '</div></div>';
  h += '<div class="card"><h2>S-Curve แผนเทียบผลงานจริง</h2><div class="chartbox"><canvas id="curve" aria-label="กราฟ S-Curve"></canvas></div>' +
    '<p class="muted">เส้นผลงานจริงสร้างจากประวัติการอัปเดต % ของแต่ละรายการโดยอัตโนมัติ</p></div>';
  after(function () { drawCurve($('#curve')); });
  if (isMulti()) {
    h += '<div class="card"><h2>ความก้าวหน้ารายงานส่วน</h2><div class="tw"><table><tr><th>งานส่วน</th><th class="num">น้ำหนัก</th><th class="hide-m">ช่วงแผน</th><th class="num">แผน</th><th class="num">จริง</th><th class="num">SPI</th><th>สถานะ</th></tr>';
    parts().forEach(function (p) { var g = groupStats(function (t) { return t.part === p; }, d); if (!g) return;
      h += '<tr><td>' + esc(p) + (g.behind ? '<div class="muted bad-t">ล่าช้า ' + g.behind + ' รายการ</div>' : '') + '</td><td class="num">' + pct(g.W, 1) + '</td><td class="hide-m">' + th(g.s, true) + ' – ' + th(g.f, true) + '</td><td class="num">' + pct(g.pl, 1) + '</td><td class="num">' + pct(g.ac, 1) + '</td><td class="num">' + (g.pl ? (g.ac / g.pl).toFixed(2) : '-') + '</td><td>' + badge(g.st) + '</td></tr>'; });
    h += '</table></div></div>';
  }
  h += '<div class="card"><h2>ความก้าวหน้ารายหมวดงาน</h2><div class="tw"><table><tr><th>หมวดงาน</th><th class="num">น้ำหนัก</th><th class="num">แผน</th><th class="num">จริง</th><th>สถานะ</th></tr>';
  cats().forEach(function (c) { var g = groupStats(function (t) { return t.cat === c; }, d); if (!g) return;
    h += '<tr><td>' + esc(c) + '</td><td class="num">' + pct(g.W, 1) + '</td><td class="num">' + pct(g.pl, 1) + '</td><td class="num">' + pct(g.ac, 1) + '</td><td>' + badge(g.st) + '</td></tr>'; });
  h += '</table></div></div>';
  if (behind.length) {
    var w = wbsList().filter(function (o) { return taskStatus(o.t).k === 'bad'; }).map(function (o) {
      var t = o.t, p = spanPct(D(t.bs), D(t.bf), d); return { o: o, gap: p - num(t.pct) / 100 }; }).sort(function (a, b) { return b.gap - a.gap; }).slice(0, 8);
    h += '<div class="card"><h2>รายการที่ต้องติดตาม</h2>' + w.map(function (x) { var t = x.o.t;
      return '<div class="item"><div class="between"><div class="grow"><span class="muted">' + esc(x.o.wbs) + '</span> <span class="t">' + esc(t.desc) + '</span>' + (isMulti() ? '<div class="m">' + esc(t.part) + '</div>' : '') + '</div>' + badge(taskStatus(t)) + '</div>' +
        '<div class="m">จริง ' + num(t.pct) + '% • ควรได้ ' + (spanPct(D(t.bs), D(t.bf), d) * 100).toFixed(0) + '% • กำหนดเสร็จ ' + th(t.rf || t.bf, true) + '</div>' +
        '<div style="margin-top:6px"><button class="btn sm" data-prog="' + t.id + '">อัปเดตผลงาน</button></div></div>'; }).join('') + '</div>';
  }
  return h;
}
function drawCurve(canvas, upTo) {
  if (!canvas || !window.Chart) return;
  var n = totalWeeks(), hist = histIndex(), labels = [], plan = [], rev = [], act = [], d = today(), hasRev = S.tasks.some(function (t) { return t.rs || t.rf; });
  var stop = upTo || d;
  for (var i = 1; i <= n; i++) {
    var r = weekRange(i); labels.push(th(r.end, true));
    plan.push(+(planAt(r.end) * 100).toFixed(2)); if (hasRev) rev.push(+(planAt(r.end, true) * 100).toFixed(2));
    if (r.end <= stop && r.end >= projStart()) act.push(+(actualAt(r.end, hist) * 100).toFixed(2));
    else if (r.start <= stop && stop < r.end) act.push(+(actualAt(stop, hist) * 100).toFixed(2));
    else act.push(null);
  }
  var dark = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#0f141c';
  var grid = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)', tick = dark ? '#9aa6ba' : '#5d6778';
  var ds = [{ label: 'แผน', data: plan, borderColor: '#2E6BC6', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2.5, tension: .2 }];
  if (hasRev) ds.push({ label: 'แผนเร่งรัด', data: rev, borderColor: '#2E9D5B', borderDash: [6, 4], pointRadius: 0, borderWidth: 2, tension: .2 });
  ds.push({ label: 'ผลงานจริง', data: act, borderColor: '#D33A2C', backgroundColor: '#D33A2C', pointRadius: 2.5, borderWidth: 2.5, spanGaps: false, tension: .1 });
  chart = new Chart(canvas, { type: 'line', data: { labels: labels, datasets: ds },
    options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      scales: { y: { min: 0, max: 100, grid: { color: grid }, ticks: { color: tick, callback: function (v) { return v + '%'; } } }, x: { grid: { color: grid }, ticks: { color: tick, maxTicksLimit: 9, autoSkip: true } } },
      plugins: { legend: { position: 'bottom', labels: { color: tick } }, tooltip: { callbacks: { label: function (x) { return x.dataset.label + ': ' + (x.parsed.y == null ? '-' : x.parsed.y.toFixed(2) + '%'); } } } } } });
}

/* ---------------- TASKS ---------------- */
var TF = { part: '', st: '', q: '' };
async function vTasks() {
  var pid = S.P.id, d = today(), w = weightFn();
  var h = '<div class="card"><div class="between"><h2 style="margin:0">รายการงานและผลงาน</h2><div class="row">' +
    '<button class="btn sm sec" data-act="pasteTasks">📋 วางจาก Excel</button><button class="btn sm" data-task="">＋ เพิ่มรายการ</button></div></div>' +
    '<div class="row" style="margin-top:10px"><input class="i grow" id="tq" placeholder="🔍 ค้นหารายการงาน…" value="' + esc(TF.q) + '" style="max-width:340px">' +
    '<div class="chips">' + [['', 'ทั้งหมด'], ['active', 'กำลังทำ'], ['bad', 'ล่าช้า'], ['todo', 'ยังไม่เริ่ม'], ['done', 'เสร็จ']].map(function (x) {
      return '<button class="chip' + (TF.st === x[0] ? ' on' : '') + '" data-tf="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
    (isMulti() ? '<div class="chips" style="margin-top:8px">' + [''].concat(parts()).map(function (p) { return '<button class="chip' + (TF.part === p ? ' on' : '') + '" data-tp="' + esc(p) + '">' + esc(p || 'ทุกงานส่วน') + '</button>'; }).join('') + '</div>' : '') +
    '<p class="muted" style="margin:8px 0 0">ผลงานรวม <b>' + pct(actualNow()) + '</b> • แผน ' + pct(planAt(d)) + ' • แตะ "อัปเดต" เพื่อบันทึก % พร้อมวันที่ (เก็บเป็นประวัติ)</p></div>';
  var list = wbsList().filter(function (o) {
    var t = o.t, st = taskStatus(t, d);
    if (TF.part && t.part !== TF.part) return false;
    if (TF.q && (t.desc + ' ' + o.wbs + ' ' + t.cat).toLowerCase().indexOf(TF.q.toLowerCase()) < 0) return false;
    if (TF.st === 'active') return t.as && !t.af; if (TF.st === 'bad') return st.k === 'bad'; if (TF.st === 'todo') return !t.as && num(t.pct) === 0; if (TF.st === 'done') return !!t.af;
    return true;
  });
  if (!S.tasks.length) return h + '<div class="card empty">ยังไม่มีรายการงาน – กด "＋ เพิ่มรายการ" หรือ "วางจาก Excel"</div>';
  if (!list.length) return h + '<div class="card empty">ไม่พบรายการที่ตรงกับตัวกรอง</div>';
  var item = function (o) {
    var t = o.t, st = taskStatus(t, d), pl = spanPct(D(t.bs), D(t.bf), d);
    return '<div class="item"><div class="between"><div class="grow"><span class="muted">' + esc(o.wbs) + '</span> <span class="t">' + esc(t.desc) + '</span>' +
      '<div class="m">' + esc(t.cat) + ' • น้ำหนัก ' + pct(w(t)) + '</div></div>' + badge(st) + '</div>' +
      '<div class="bar"><i style="width:' + Math.min(100, num(t.pct)) + '%"></i><b style="left:' + (pl * 100).toFixed(1) + '%"></b></div>' +
      '<div class="between"><div class="m">จริง <b>' + num(t.pct) + '%</b> • ควรได้ ' + (pl * 100).toFixed(0) + '% • แผน ' + th(t.bs, true) + ' – ' + th(t.bf, true) +
      (t.rs || t.rf ? ' • เร่งรัด ' + th(t.rs || t.bs, true) + ' – ' + th(t.rf || t.bf, true) : '') + (t.as ? ' • เริ่มจริง ' + th(t.as, true) : '') + (t.af ? ' • เสร็จจริง ' + th(t.af, true) : '') + '</div>' +
      '<div class="row"><button class="btn sm" data-prog="' + t.id + '">อัปเดต</button><button class="btn sm sec" data-task="' + t.id + '" aria-label="แก้ไขรายการ">แก้ไข</button></div></div>' +
      (t.remark ? '<div class="m">📝 ' + esc(t.remark) + '</div>' : '') + '</div>';
  };
  if (isMulti() && !TF.part) {
    parts().forEach(function (p) { var L = list.filter(function (o) { return o.t.part === p; }); if (!L.length) return;
      var g = groupStats(function (t) { return t.part === p; }, d);
      h += '<details class="pgroup" open><summary>' + esc(p) + ' <span class="muted">(' + L.length + ' รายการ • จริง ' + pct(g.ac, 1) + ' / แผน ' + pct(g.pl, 1) + ')</span> ' + badge(g.st) + '</summary>' + L.map(item).join('') + '</details>'; });
    var orphan = list.filter(function (o) { return parts().indexOf(o.t.part) < 0; });
    if (orphan.length) h += '<details class="pgroup" open><summary>ไม่ระบุงานส่วน</summary>' + orphan.map(item).join('') + '</details>';
    return h;
  }
  return h + list.map(item).join('');
}
function openTask(id) {
  var t = id ? taskById(id) : { part: TF.part || parts()[0], cat: cats()[0] };
  var bg = modal('<h2>' + (id ? 'แก้ไขรายการงาน' : 'เพิ่มรายการงาน') + '</h2><div class="grid2">' +
    (isMulti() ? '<div><label class="f" for="tPart">งานส่วน</label><select id="tPart" class="i">' + opts(parts(), t.part) + '</select></div>' : '') +
    '<div><label class="f" for="tCat">หมวดงาน</label><select id="tCat" class="i">' + opts(cats(), t.cat) + '</select></div></div>' +
    '<label class="f" for="tDesc">รายการงาน</label><input id="tDesc" class="i" value="' + esc(t.desc) + '">' +
    '<div class="grid2">' + inp('tBoq', 'มูลค่า BOQ (บาท)', t.boq, '', 'inputmode="decimal"') + inp('tW', 'น้ำหนักกำหนดเอง (%) – เว้นว่างเพื่อคิดจาก BOQ', t.weight, '', 'inputmode="decimal"') +
    inp('tBs', 'เริ่ม (แผนตามสัญญา)', t.bs, 'date') + inp('tBf', 'เสร็จ (แผนตามสัญญา)', t.bf, 'date') +
    inp('tRs', 'เริ่ม (แผนเร่งรัด – ไม่บังคับ)', t.rs, 'date') + inp('tRf', 'เสร็จ (แผนเร่งรัด – ไม่บังคับ)', t.rf, 'date') + '</div>' +
    '<p class="muted">น้ำหนักงาน: ใส่มูลค่า BOQ ทุกรายการ ระบบคิดสัดส่วนให้เอง (หรือกำหนด % เองให้รวมกันได้ 100%)</p>' +
    (id ? '<div style="margin-top:8px"><button class="btn sm bad" id="tDel">ลบรายการนี้</button></div>' : ''),
    async function (bg) {
      var o = Object.assign({}, t, { id: id || uid(), projectId: S.P.id, part: isMulti() ? val(bg, 'tPart') : (parts()[0] || 'งานหลัก'), cat: val(bg, 'tCat'), desc: val(bg, 'tDesc'),
        boq: val(bg, 'tBoq').replace(/,/g, ''), weight: val(bg, 'tW').replace('%', ''), bs: val(bg, 'tBs'), bf: val(bg, 'tBf'), rs: val(bg, 'tRs'), rf: val(bg, 'tRf'), updated: new Date().toISOString() });
      if (!o.desc || !o.bs || !o.bf) throw new Error('กรอกรายการงานและวันเริ่ม-เสร็จตามแผน');
      if (o.bf < o.bs) throw new Error('วันเสร็จต้องไม่ก่อนวันเริ่ม');
      if ((o.rs && !o.rf) || (!o.rs && o.rf)) throw new Error('แผนเร่งรัดต้องมีทั้งวันเริ่มและวันเสร็จ');
      if (!id) { o.pct = 0; o.order = S.tasks.length + 1; }
      await DB.put('tasks', o); if (id) Object.assign(t, o); else S.tasks.push(o);
      toast('บันทึกแล้ว'); render();
    }, null, true);
  var del = bg.querySelector('#tDel');
  if (del) del.onclick = async function () {
    var used = S.submittals.filter(function (s) { return s.taskId === id; }).length;
    if (!(await confirmBox('ลบรายการ "' + t.desc + '" และประวัติผลงานทั้งหมดของรายการนี้?' + (used ? ' (มีรายการขออนุมัติวัสดุผูกอยู่ ' + used + ' รายการ จะถูกปลดการเชื่อมโยง)' : ''), 'ลบ'))) return;
    var ph = S.progress.filter(function (x) { return x.taskId === id; }).map(function (x) { return x.id; });
    await DB.del('tasks', id); await DB.delMany('progress', ph);
    S.tasks = S.tasks.filter(function (x) { return x.id !== id; }); S.progress = S.progress.filter(function (x) { return x.taskId !== id; });
    bg.remove(); toast('ลบแล้ว'); render();
  };
}
// บันทึกผลงาน: เพิ่มประวัติ แล้วคำนวณ % ปัจจุบัน = บันทึกที่วันที่ล่าสุด
async function recordProgress(t, dateIso, p, note, source) {
  var e = { id: uid(), projectId: S.P.id, taskId: t.id, date: dateIso, pct: p, note: note || '', source: source || 'manual', ts: Date.now() };
  await DB.put('progress', e); S.progress.push(e);
  await syncTaskPct(t);
}
async function syncTaskPct(t) {
  var a = S.progress.filter(function (x) { return x.taskId === t.id; }).sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : (x.ts || 0) - (y.ts || 0); });
  t.pct = a.length ? num(a[a.length - 1].pct) : 0;
  var firstPos = a.filter(function (x) { return num(x.pct) > 0; })[0];
  if (!t.as && firstPos) t.as = firstPos.date;
  if (!t.af && t.pct >= 100) { t.af = a[a.length - 1].date; t.autoAf = true; }
  if (t.pct < 100 && t.af && t.autoAf) { t.af = ''; }
  t.updated = new Date().toISOString(); await DB.put('tasks', t);
}
function openProgress(id, presetDate) {
  var t = taskById(id); if (!t) return;
  var hist = S.progress.filter(function (x) { return x.taskId === id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var bg = modal('<h2>อัปเดตผลงาน</h2><p><span class="muted">' + esc(wbsOf(id)) + '</span> <b>' + esc(t.desc) + '</b></p>' +
    '<div class="grid2">' + inp('pDate', 'ณ วันที่', presetDate || iso(today()), 'date') + inp('pPct', '% ความคืบหน้าของรายการนี้', num(t.pct), 'number', 'min="0" max="100" step="1" inputmode="numeric"') + '</div>' +
    '<input id="pRange" type="range" min="0" max="100" value="' + num(t.pct) + '" style="width:100%" aria-label="% ผลงาน">' +
    '<div class="chips" style="margin:4px 0">' + [0, 10, 25, 50, 75, 90, 100].map(function (v) { return '<button type="button" class="chip" data-pp="' + v + '">' + v + '%</button>'; }).join('') + '</div>' +
    '<div class="grid2">' + inp('pAs', 'วันเริ่มจริง', t.as, 'date') + inp('pAf', 'วันเสร็จจริง (ถ้าเสร็จแล้ว)', t.af, 'date') + '</div>' +
    '<label class="f" for="pNote">หมายเหตุ / ปัญหา</label><textarea id="pNote" class="i" rows="2">' + esc(t.remark) + '</textarea>' +
    '<p class="muted">วัด % จากปริมาณงานจริง เช่น ตอกเข็ม 45 จาก 60 ต้น = 75% ไม่ใช้เวลาหรือเงินที่จ่ายไป</p>' +
    (hist.length ? '<details class="pgroup"><summary>ประวัติผลงาน (' + hist.length + ')</summary><table><tr><th>วันที่</th><th class="num">%</th><th>ที่มา</th><th></th></tr>' +
      hist.map(function (x) { return '<tr><td>' + th(x.date, true) + '</td><td class="num">' + num(x.pct) + '%</td><td class="muted">' + esc(x.source === 'daily' ? 'รายงานรายวัน' : x.source === 'import' ? 'นำเข้า' : 'อัปเดต') + (x.note && x.source !== 'import' ? ' – ' + esc(x.note) : '') + '</td><td><button class="fdel" data-hdel="' + x.id + '" aria-label="ลบประวัตินี้">ลบ</button></td></tr>'; }).join('') + '</table></details>' : ''),
    async function (bg) {
      var p = num(val(bg, 'pPct')), dt = val(bg, 'pDate'), as = val(bg, 'pAs'), af = val(bg, 'pAf');
      if (!D(dt)) throw new Error('ระบุวันที่'); if (p < 0 || p > 100) throw new Error('% ต้องอยู่ระหว่าง 0–100');
      if (af && p < 100) throw new Error('ใส่วันเสร็จจริงแล้ว % ต้องเป็น 100');
      if (D(dt) > today()) throw new Error('บันทึกผลงานล่วงหน้าไม่ได้');
      t.as = as || (p > 0 ? (t.as || dt) : t.as); t.af = af; t.autoAf = !af; t.remark = val(bg, 'pNote');
      await recordProgress(t, dt, p, '', 'manual');
      if (af) { t.af = af; t.autoAf = false; await DB.put('tasks', t); }
      toast('บันทึกผลงาน ' + p + '% แล้ว'); render();
    }, 'บันทึกผลงาน');
  var P = bg.querySelector('#pPct'), R = bg.querySelector('#pRange');
  R.oninput = function () { P.value = R.value; }; P.oninput = function () { R.value = P.value; };
  $$('[data-pp]', bg).forEach(function (b) { b.onclick = function () { P.value = R.value = b.dataset.pp; }; });
  $$('[data-hdel]', bg).forEach(function (b) { b.onclick = async function () {
    await DB.del('progress', b.dataset.hdel); S.progress = S.progress.filter(function (x) { return x.id !== b.dataset.hdel; });
    await syncTaskPct(t); bg.remove(); toast('ลบประวัติแล้ว'); render(); openProgress(id); }; });
}
function pasteTasks() {
  var bg = modal('<h2>วางรายการงานจาก Excel</h2><p class="muted">คัดลอกแถวจาก Excel แล้ววาง (ไม่ต้องมีหัวตาราง) เรียงคอลัมน์:<br><b>' + (isMulti() ? 'งานส่วน | ' : '') + 'หมวดงาน | รายการงาน | มูลค่า BOQ | น้ำหนัก % | เริ่มแผน | เสร็จแผน</b><br>วันที่ใช้ได้ทั้ง 20/02/2569, 20/02/2026, 2026-02-20 • งานส่วน/หมวดใหม่จะเพิ่มให้อัตโนมัติ</p>' +
    '<textarea id="imp" class="i" rows="9"></textarea><div id="impPrev" class="muted"></div>', async function (bg) {
      var r = parse(val(bg, 'imp')); if (!r.ok.length) throw new Error('ไม่พบข้อมูลที่ใช้ได้');
      var base = S.tasks.length, now = new Date().toISOString();
      var rows = r.ok.map(function (x, i) { if (parts().indexOf(x.part) < 0) S.P.parts.push(x.part); if (cats().indexOf(x.cat) < 0) S.P.cats.push(x.cat);
        return Object.assign({ id: uid() + i, projectId: S.P.id, order: base + i + 1, pct: 0, updated: now }, x); });
      await saveProject(); await DB.putMany('tasks', rows); S.tasks = S.tasks.concat(rows);
      toast('เพิ่ม ' + rows.length + ' รายการ' + (r.bad.length ? ' (ข้าม ' + r.bad.length + ' แถวที่อ่านไม่ได้)' : '')); render();
    }, 'นำเข้า', true);
  var parse = function (txt) {
    var ok = [], bad = [], mp = isMulti() ? 1 : 0;
    String(txt).split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return; var c = line.split('\t');
      var r = { part: mp ? (c[0] || '').trim() : (parts()[0] || 'งานหลัก'), cat: (c[mp] || '').trim() || cats()[0], desc: (c[mp + 1] || '').trim(), boq: String(num(c[mp + 2]) || ''),
        weight: (c[mp + 3] || '').replace('%', '').trim(), bs: parseDateAny(c[mp + 4]), bf: parseDateAny(c[mp + 5]) };
      if (!r.part || !r.desc || !r.bs || !r.bf || r.bs === 'X' || r.bf === 'X' || r.bf < r.bs) bad.push(i + 1); else ok.push(r);
    });
    return { ok: ok, bad: bad };
  };
  bg.querySelector('#imp').oninput = function (e) { var r = parse(e.target.value); bg.querySelector('#impPrev').textContent = 'อ่านได้ ' + r.ok.length + ' แถว' + (r.bad.length ? ' • อ่านไม่ได้ ' + r.bad.length + ' แถว (แถวที่ ' + r.bad.slice(0, 6).join(', ') + ')' : ''); };
}

/* ---------------- PROJECT SETTINGS ---------------- */
async function vProjSet() {
  var p = S.P;
  after(function () { var box = $('#projFormBox'); if (box) wireProjectForm(box); });
  return '<div class="card" id="projFormBox"><h2>ข้อมูลโครงการ</h2>' + projectForm(p) +
    '<div class="row" style="margin-top:14px"><button class="btn" data-act="saveProj">บันทึก</button></div></div>' +
    '<div class="card"><h2>ข้อมูลและไฟล์</h2><div class="row"><button class="btn sec" data-act="exportXlsx">📥 ส่งออก Excel (โครงการนี้)</button><button class="btn sec" data-act="backup">💾 สำรองข้อมูลทั้งหมด</button></div>' +
    '<p class="muted">ส่งออก Excel ใช้เปิดดู/ส่งต่อ และนำเข้าเป็นโครงการใหม่ได้ • การสำรองข้อมูลเก็บทุกโครงการรวมรูปภาพเป็นไฟล์เดียว</p></div>' +
    '<div class="card"><h2>จัดการโครงการ</h2><div class="row"><button class="btn sec" data-act="archive">' + (p.archived ? '📤 นำออกจากคลัง' : '🗄️ เก็บเข้าคลัง (โครงการจบแล้ว)') + '</button>' +
    '<button class="btn bad" data-act="delProject">ลบโครงการ</button></div><p class="muted">ลบโครงการจะลบรายการงาน ประวัติผลงาน รายงาน รูปภาพ และรายการวัสดุของโครงการนี้ทั้งหมด (กู้คืนได้จากไฟล์สำรองเท่านั้น)</p></div>';
}

/* ---------------- DAILY REPORT ---------------- */
var WEATHER = ['☀️ แจ่มใส', '⛅ มีเมฆ', '🌦️ ฝนเล็กน้อย', '🌧️ ฝนตกหนัก'];
var WORK_ST = ['ทำงานได้ตามปกติ', 'ทำงานได้บางส่วน', 'หยุดงาน (ฝนตก)', 'หยุดงาน (วันหยุด/อื่นๆ)'];
var TRADES = ['โฟร์แมน', 'ช่างไม้', 'ช่างเหล็ก', 'ช่างปูน', 'ช่างไฟฟ้า', 'ช่างประปา', 'ช่างเชื่อม', 'ช่างทาสี', 'กรรมกร'];
function dailyOf(dIso) { return S.daily.filter(function (x) { return x.date === dIso; })[0]; }
function manTotal(r) { return (r && r.manpower || []).reduce(function (a, x) { return a + num(x.count); }, 0); }
function isWorkDay(r) { return r && /^ทำงาน/.test(r.status || WORK_ST[0]); }
async function vDaily(args) {
  var pid = S.P.id;
  if (args[0]) return dailyEditor(args[0]);
  var list = S.daily.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var h = '<div class="card"><div class="between"><h2 style="margin:0">รายงานประจำวัน</h2><div class="row"><input type="date" class="i" id="dPick" value="' + iso(today()) + '" style="width:170px" aria-label="เลือกวันที่">' +
    '<button class="btn" data-act="openDay">เปิด / สร้าง</button></div></div><p class="muted">บันทึกสภาพอากาศ คนงาน เครื่องจักร งานที่ทำ ผลงานรายรายการ และรูปถ่าย – บันทึกอัตโนมัติขณะพิมพ์ • รายงานรายสัปดาห์จะรวบรวมจากรายงานประจำวันให้เอง</p></div>';
  if (!list.length) return h + '<div class="card empty">ยังไม่มีรายงานประจำวัน – เลือกวันที่แล้วกด "เปิด / สร้าง"</div>';
  var month = '';
  list.forEach(function (r) {
    var d = D(r.date), m = TM[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    if (m !== month) { h += '<div class="h3">' + m + '</div>'; month = m; }
    var ph = filesOf('daily', r.date).length, pc = S.progress.filter(function (x) { return x.date === r.date && x.source === 'daily'; }).length;
    h += '<div class="item pcard" data-go="/p/' + pid + '/daily/' + r.date + '" tabindex="0"><div class="between"><div><span class="t">' + TDAY[d.getDay()] + ' ' + th(r.date) + '</span>' +
      '<div class="m">' + esc((r.weatherAM || '').split(' ')[0] + ' ' + (r.weatherPM || '').split(' ')[0]) + ' ' + esc(r.status || '') + ' • คนงาน ' + manTotal(r) + ' คน' + (pc ? ' • อัปเดตผลงาน ' + pc + ' รายการ' : '') + (ph ? ' • 📷 ' + ph : '') + '</div></div>' +
      '<span class="muted">›</span></div>' + (r.work ? '<div class="m" style="margin-top:4px">' + esc(r.work.slice(0, 140)) + (r.work.length > 140 ? '…' : '') + '</div>' : '') + '</div>';
  });
  return h;
}
function listRows(key, arr, nameLab) {
  return '<div id="' + key + 'Rows">' + (arr || []).map(function (x, i) {
    return '<div class="lrow"><input class="i" data-l="' + key + '" data-i="' + i + '" data-f="n" value="' + esc(x.trade || x.name) + '" placeholder="' + nameLab + '" aria-label="' + nameLab + '">' +
      '<input class="i" data-l="' + key + '" data-i="' + i + '" data-f="c" type="number" min="0" inputmode="numeric" value="' + esc(x.count) + '" aria-label="จำนวน">' +
      '<button class="xbtn" data-ldel="' + key + '" data-i="' + i + '" aria-label="ลบแถว">✕</button></div>'; }).join('') + '</div>';
}
function activeTasksOn(dIso) {
  var d = D(dIso);
  return wbsList().filter(function (o) { var t = o.t, s = D(t.rs || t.bs), f = D(t.rf || t.bf);
    if (t.af && t.af < dIso) return false;
    return (t.as && t.as <= dIso) || (s && s <= addDays(d, 7) && f && f >= addDays(d, -30)) || S.progress.some(function (x) { return x.taskId === t.id && x.date === dIso; }); });
}
async function dailyEditor(dIso) {
  if (!D(dIso)) throw new Error('วันที่ไม่ถูกต้อง');
  var r = dailyOf(dIso), pid = S.P.id, d = D(dIso), hist = histIndex();
  var draft = r || { id: pid + '_' + dIso, projectId: pid, date: dIso, weatherAM: WEATHER[0], weatherPM: WEATHER[0], status: WORK_ST[0], manpower: [], machinery: [] };
  S.dailyDraft = JSON.parse(JSON.stringify(draft)); S.dailySaved = !!r;
  var prev = S.daily.filter(function (x) { return x.date < dIso; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
  var act = activeTasksOn(dIso);
  var dayBefore = iso(addDays(d, -1));
  var sel = function (id, list, v) { return '<select id="' + id + '" class="i" data-dd="' + id + '">' + opts(list, v) + '</select>'; };
  var ta = function (k, lab, ph) { return '<label class="f" for="d_' + k + '">' + lab + '</label><textarea id="d_' + k + '" class="i" data-dd="' + k + '" rows="3" placeholder="' + (ph || '') + '">' + esc(draft[k]) + '</textarea>'; };
  var h = '<div class="card noprint"><div class="between"><div class="row"><button class="btn sm sec" data-go="/p/' + pid + '/daily/' + iso(addDays(d, -1)) + '" aria-label="วันก่อนหน้า">‹</button>' +
    '<div><div class="h2" style="margin:0">' + TDAY[d.getDay()] + ' ' + th(dIso) + '</div><div class="muted">สัปดาห์ที่ ' + weekOf(d) + ' • วันที่ ' + (diffDays(d, projStart()) + 1) + ' ของสัญญา</div></div>' +
    '<button class="btn sm sec" data-go="/p/' + pid + '/daily/' + iso(addDays(d, 1)) + '" aria-label="วันถัดไป">›</button></div>' +
    '<div class="row"><span id="saveState" class="muted">' + (r ? '✓ บันทึกแล้ว' : 'ยังไม่บันทึก') + '</span><button class="btn sm sec" data-go="/p/' + pid + '/daily">รายการ</button>' +
    '<button class="btn sm sec" data-act="printDaily" data-date="' + dIso + '">🖨️ พิมพ์</button>' + (r ? '<button class="btn sm ghost bad-t" data-act="delDaily" data-date="' + dIso + '">ลบ</button>' : '') + '</div></div></div>';
  h += '<div class="card"><h2>สภาพอากาศและการทำงาน</h2><div class="grid3"><div><label class="f" for="weatherAM">ช่วงเช้า</label>' + sel('weatherAM', WEATHER, draft.weatherAM) + '</div>' +
    '<div><label class="f" for="weatherPM">ช่วงบ่าย</label>' + sel('weatherPM', WEATHER, draft.weatherPM) + '</div><div><label class="f" for="status">สถานะการทำงาน</label>' + sel('status', WORK_ST, draft.status) + '</div></div></div>';
  h += '<div class="card"><div class="between"><h2 style="margin:0">คนงาน <span class="muted" id="manSum">รวม ' + manTotal(draft) + ' คน</span></h2>' +
    (prev ? '<button class="btn sm sec" data-act="copyPrev" data-date="' + prev.date + '">คัดลอกจาก ' + th(prev.date, true) + '</button>' : '') + '</div>' +
    listRows('manpower', draft.manpower, 'ประเภทช่าง') + '<div class="chips" style="margin-top:6px">' + TRADES.map(function (x) { return '<button class="chip" data-addrow="manpower" data-name="' + x + '">＋ ' + x + '</button>'; }).join('') + '</div>' +
    '<h2 style="margin:16px 0 6px">เครื่องจักร / เครื่องมือ</h2>' + listRows('machinery', draft.machinery, 'ชื่อเครื่องจักร') +
    '<button class="btn sm sec" data-addrow="machinery" data-name="">＋ เพิ่มเครื่องจักร</button></div>';
  h += '<div class="card"><h2>ผลงานรายรายการ ณ วันนี้</h2><p class="muted">แก้ % ของรายการที่ทำวันนี้ – ระบบบันทึกเป็นประวัติผลงานของวันที่ ' + th(dIso, true) + ' ทันที (ใช้สร้าง S-Curve)</p>' +
    (act.length ? '<div class="tw"><table><tr><th>รายการ</th><th class="num">เมื่อวาน</th><th class="num" style="width:110px">วันนี้ (%)</th></tr>' + act.map(function (o) {
      var t = o.t, y = taskPctAt(hist, t.id, dayBefore), n = taskPctAt(hist, t.id, dIso), ch = S.progress.some(function (x) { return x.taskId === t.id && x.date === dIso; });
      return '<tr><td><span class="muted">' + esc(o.wbs) + '</span> ' + esc(t.desc) + (isMulti() ? '<div class="muted">' + esc(t.part) + '</div>' : '') + '</td><td class="num">' + y + '%</td>' +
        '<td><input class="i" type="number" min="0" max="100" inputmode="numeric" data-dp="' + t.id + '" value="' + n + '" aria-label="% วันนี้" style="' + (ch ? 'border-color:var(--pri2);font-weight:700' : '') + '"></td></tr>'; }).join('') + '</table></div>' :
      '<p class="muted">ไม่มีรายการที่อยู่ในช่วงดำเนินการ</p>') +
    '<button class="btn sm ghost" data-go="/p/' + pid + '/tasks">ดูรายการงานทั้งหมด ›</button></div>';
  h += '<div class="card"><h2>บันทึกการปฏิบัติงาน</h2>' + ta('work', 'งานที่ดำเนินการวันนี้', 'เช่น ตอกเสาเข็มอาคาร 6 ต้น (แนว C) • เทคอนกรีตฐานราก F1 จำนวน 12 ลบ.ม.') +
    '<div class="grid2"><div>' + ta('materials', 'วัสดุเข้าหน่วยงาน', 'เช่น เหล็ก DB16 5 ตัน') + '</div><div>' + ta('tests', 'การทดสอบ / ตรวจสอบ', 'เช่น เก็บตัวอย่างคอนกรีต 6 ก้อน') + '</div>' +
    '<div>' + ta('issues', 'ปัญหา อุปสรรค', '') + '</div><div>' + ta('instructions', 'คำสั่ง / ข้อแนะนำของผู้ควบคุมงาน', '') + '</div></div>' +
    '<div class="grid2"><div>' + ta('visitors', 'ผู้เข้าตรวจ / ประชุม', '') + '</div><div>' + ta('safety', 'ความปลอดภัย / สิ่งแวดล้อม', '') + '</div></div></div>';
  h += '<div class="card"><h2>รูปถ่ายประจำวัน (' + filesOf('daily', dIso).length + ')</h2>' + filesBlock('daily', dIso, true, false) + '</div>';
  return h;
}
var _dTimer = null;
function dailyChanged() {
  var st = $('#saveState'); if (st) st.textContent = 'กำลังบันทึก…';
  clearTimeout(_dTimer); _dTimer = setTimeout(saveDaily, 600);
}
async function saveDaily() {
  var dr = S.dailyDraft; if (!dr) return;
  dr.manpower = (dr.manpower || []).filter(function (x) { return (x.trade || '').trim() || num(x.count); });
  dr.machinery = (dr.machinery || []).filter(function (x) { return (x.name || '').trim() || num(x.count); });
  dr.updated = new Date().toISOString();
  await DB.put('daily', JSON.parse(JSON.stringify(dr)));
  var i = S.daily.findIndex(function (x) { return x.id === dr.id; }); if (i >= 0) S.daily[i] = JSON.parse(JSON.stringify(dr)); else S.daily.push(JSON.parse(JSON.stringify(dr)));
  S.dailySaved = true; var st = $('#saveState'); if (st) st.textContent = '✓ บันทึกแล้ว';
}
async function setDailyProgress(taskId, dIso, p) {
  var t = taskById(taskId); if (!t) return;
  if (p < 0 || p > 100 || isNaN(p)) throw new Error('% ต้องอยู่ระหว่าง 0–100');
  if (D(dIso) > today()) throw new Error('บันทึกผลงานล่วงหน้าไม่ได้');
  var ex = S.progress.filter(function (x) { return x.taskId === taskId && x.date === dIso && x.source === 'daily'; })[0];
  if (ex) { ex.pct = p; ex.ts = Date.now(); await DB.put('progress', ex); await syncTaskPct(t); }
  else await recordProgress(t, dIso, p, '', 'daily');
  if (!S.dailySaved) await saveDaily();
}

/* ---------------- WEEKLY REPORT ---------------- */
function weekStats(n) {
  var r = weekRange(n), a = iso(r.start), b = iso(r.end), hist = histIndex();
  var days = S.daily.filter(function (x) { return x.date >= a && x.date <= b; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  var men = days.map(manTotal), work = days.filter(isWorkDay).length, rain = days.filter(function (x) { return /ฝน/.test(x.status || ''); }).length;
  var mach = {}; days.forEach(function (x) { (x.machinery || []).forEach(function (m) { if (!m.name) return; mach[m.name] = Math.max(mach[m.name] || 0, num(m.count) || 1); }); });
  var endD = r.end > today() ? today() : r.end, prevEnd = addDays(r.start, -1);
  var plan = planAt(r.end), act = actualAt(endD, hist), actPrev = actualAt(prevEnd, hist);
  var moved = wbsList().map(function (o) { return { o: o, from: taskPctAt(hist, o.t.id, iso(prevEnd)), to: taskPctAt(hist, o.t.id, iso(endD)) }; }).filter(function (x) { return x.to !== x.from; });
  var photos = S.files.filter(function (f) { return f.kind === 'daily' && f.ref >= a && f.ref <= b && f.mime !== 'application/pdf'; }).sort(function (x, y) { return x.ref < y.ref ? -1 : 1; });
  return { r: r, days: days, menAvg: men.length ? men.reduce(function (x, y) { return x + y; }, 0) / men.length : 0, menMax: men.length ? Math.max.apply(null, men) : 0,
    manDays: men.reduce(function (x, y) { return x + y; }, 0), work: work, rain: rain, mach: mach, plan: plan, act: act, actPrev: actPrev, moved: moved, photos: photos, partial: r.end > today() };
}
function compileText(st, key) {
  return st.days.filter(function (x) { return (x[key] || '').trim(); }).map(function (x) { return th(x.date, true) + ': ' + x[key].trim(); }).join('\n');
}
function weekRec(n) { return S.weekly.filter(function (w) { return String(w.week) === String(n); })[0]; }
async function vWeekly(args) {
  var pid = S.P.id;
  if (args[0]) return weeklyEditor(+args[0]);
  var cur = weekOf(today()), last = Math.min(Math.max(cur, 1), totalWeeks() + 8);
  var h = '<div class="card"><h2>รายงานรายสัปดาห์</h2><p class="muted">รวบรวมจากรายงานประจำวันและประวัติผลงานให้อัตโนมัติ – เพิ่มสรุป แผนสัปดาห์หน้า และความเห็น แล้วพิมพ์เป็นบันทึกข้อความเสนอคณะกรรมการตรวจรับ</p></div>';
  for (var n = last; n >= 1; n--) {
    var r = weekRange(n), a = iso(r.start), b = iso(r.end), nd = S.daily.filter(function (x) { return x.date >= a && x.date <= b; }).length, w = weekRec(n);
    h += '<div class="item pcard" data-go="/p/' + pid + '/weekly/' + n + '" tabindex="0"><div class="between"><div><span class="t">สัปดาห์ที่ ' + n + '</span> <span class="muted">' + th(r.start, true) + ' – ' + th(r.end, true) + '</span>' +
      '<div class="m">รายงานประจำวัน ' + nd + ' วัน' + (n === cur ? ' • สัปดาห์ปัจจุบัน' : '') + '</div></div>' + (w && w.final ? badge({ k: 'ok', t: 'จัดทำแล้ว' }) : w ? badge({ k: 'warn', t: 'ร่าง' }) : nd ? badge({ k: 'na', t: 'ยังไม่จัดทำ' }) : '') + '</div></div>';
  }
  return h;
}
async function weeklyEditor(n) {
  if (!(n >= 1)) throw new Error('สัปดาห์ไม่ถูกต้อง');
  var st = weekStats(n), pid = S.P.id, w = weekRec(n) || { id: pid + '_w' + n, projectId: pid, week: n, photos: null };
  S.weekDraft = JSON.parse(JSON.stringify(w));
  var selPhotos = w.photos || st.photos.slice(0, 12).map(function (f) { return f.id; });
  S.weekDraft.photos = selPhotos;
  var ta = function (k, lab, rows, fill) { return '<div class="between"><label class="f" for="w_' + k + '">' + lab + '</label>' + (fill ? '<button class="btn sm ghost" data-fill="' + k + '">↺ ดึงจากรายงานประจำวัน</button>' : '') + '</div>' +
    '<textarea id="w_' + k + '" class="i" data-wd="' + k + '" rows="' + (rows || 4) + '">' + esc(w[k] != null ? w[k] : (fill ? compileText(st, fill) : '')) + '</textarea>'; };
  if (w.work_done == null) { S.weekDraft.work_done = compileText(st, 'work'); S.weekDraft.issues = compileText(st, 'issues'); S.weekDraft.materials = compileText(st, 'materials') + (compileText(st, 'tests') ? '\n' + compileText(st, 'tests') : ''); }
  var h = '<div class="card noprint"><div class="between"><div class="row"><button class="btn sm sec" data-go="/p/' + pid + '/weekly/' + Math.max(1, n - 1) + '" aria-label="สัปดาห์ก่อน">‹</button>' +
    '<div><div class="h2" style="margin:0">สัปดาห์ที่ ' + n + '</div><div class="muted">' + th(st.r.start) + ' – ' + th(st.r.end) + (st.partial ? ' (ยังไม่ครบสัปดาห์)' : '') + '</div></div>' +
    '<button class="btn sm sec" data-go="/p/' + pid + '/weekly/' + (n + 1) + '" aria-label="สัปดาห์ถัดไป">›</button></div>' +
    '<div class="row"><span id="saveState" class="muted">' + (weekRec(n) ? '✓ บันทึกแล้ว' : 'ยังไม่บันทึก') + '</span><button class="btn sm sec" data-go="/p/' + pid + '/weekly">รายการ</button>' +
    '<button class="btn sm" data-act="printWeekly" data-week="' + n + '">🖨️ พิมพ์บันทึกข้อความ</button></div></div></div>';
  h += '<div class="card"><h2>สรุปอัตโนมัติ</h2><div class="kpis">' +
    kpi('ผลงานตามแผนสะสม', pct(st.plan), 'ณ สิ้นสัปดาห์') + kpi('ผลงานจริงสะสม', pct(st.act), 'สัปดาห์นี้ +' + pct(st.act - st.actPrev), st.act >= st.plan ? 'ok-t' : 'bad-t') +
    kpi('เร็ว/ช้ากว่าแผน', (st.act - st.plan >= 0 ? '+' : '') + pct(st.act - st.plan), Math.round((st.act - st.plan) * projDur()) + ' วัน', st.act >= st.plan ? 'ok-t' : 'bad-t') +
    kpi('วันทำงาน', st.work + ' / ' + st.days.length + ' วัน', 'ฝนตกหยุดงาน ' + st.rain + ' วัน') + kpi('คนงานเฉลี่ย', st.menAvg.toFixed(1) + ' คน/วัน', 'สูงสุด ' + st.menMax + ' • รวม ' + st.manDays + ' แรง') + '</div>' +
    (st.days.length ? '' : '<p class="warn-t">ยังไม่มีรายงานประจำวันในสัปดาห์นี้ – สถิติคนงาน/สภาพอากาศจะว่าง</p>') +
    (st.moved.length ? '<div class="h3">รายการที่มีความก้าวหน้าในสัปดาห์นี้</div><div class="tw"><table><tr><th>รายการ</th><th class="num">ต้นสัปดาห์</th><th class="num">สิ้นสัปดาห์</th></tr>' +
      st.moved.map(function (x) { return '<tr><td><span class="muted">' + esc(x.o.wbs) + '</span> ' + esc(x.o.t.desc) + '</td><td class="num">' + x.from + '%</td><td class="num"><b>' + x.to + '%</b></td></tr>'; }).join('') + '</table></div>' : '') + '</div>';
  h += '<div class="card"><h2>เนื้อหารายงาน</h2>' + ta('work_done', 'งานที่ดำเนินการในสัปดาห์นี้', 6, 'work') + ta('next_plan', 'แผนงานสัปดาห์หน้า', 4) +
    '<div class="grid2"><div>' + ta('materials', 'วัสดุเข้าหน่วยงาน / การทดสอบ', 4, 'materials') + '</div><div>' + ta('issues', 'ปัญหา อุปสรรค', 4, 'issues') + '</div></div>' +
    ta('opinion', 'ความเห็นของผู้ควบคุมงาน', 3) +
    '<label class="row" style="margin-top:10px"><input type="checkbox" data-wd="final" ' + (w.final ? 'checked' : '') + '><span>จัดทำรายงานสัปดาห์นี้เสร็จแล้ว</span></label></div>';
  h += '<div class="card"><h2>รูปถ่ายแนบรายงาน (' + selPhotos.length + ' จาก ' + st.photos.length + ')</h2>' +
    (st.photos.length ? '<p class="muted">แตะรูปเพื่อเลือก/ไม่เลือก – รูปที่เลือกจะอยู่ในภาคผนวกของบันทึกข้อความ</p><div class="files">' + st.photos.map(function (f) {
      var on = selPhotos.indexOf(f.id) >= 0;
      return '<div class="fcard" style="' + (on ? 'outline:3px solid var(--pri2)' : 'opacity:.55') + '"><div class="fthumb" data-fimg="' + f.id + '" data-wph="' + f.id + '" role="checkbox" aria-checked="' + on + '" tabindex="0"></div><div class="fcap">' + (on ? '✓ ' : '') + th(f.ref, true) + (f.caption ? ' • ' + esc(f.caption) : '') + '</div></div>'; }).join('') + '</div>' :
      '<p class="muted">ยังไม่มีรูปในรายงานประจำวันของสัปดาห์นี้</p>') + '</div>';
  return h;
}
var _wTimer = null;
function weeklyChanged() { var st = $('#saveState'); if (st) st.textContent = 'กำลังบันทึก…'; clearTimeout(_wTimer); _wTimer = setTimeout(saveWeekly, 600); }
async function saveWeekly() {
  var w = S.weekDraft; if (!w) return; w.updated = new Date().toISOString();
  await DB.put('weekly', JSON.parse(JSON.stringify(w)));
  var i = S.weekly.findIndex(function (x) { return x.id === w.id; }); if (i >= 0) S.weekly[i] = JSON.parse(JSON.stringify(w)); else S.weekly.push(JSON.parse(JSON.stringify(w)));
  var st = $('#saveState'); if (st) st.textContent = '✓ บันทึกแล้ว';
}

/* ---------------- PRINT DOCUMENTS ---------------- */
async function vPrint(args) {
  var kind = args[0], key = args[1], back = kind === 'daily' ? '/daily/' + key : kind === 'weekly' ? '/weekly/' + key : '/mat/' + key;
  var bar = '<div class="card noprint"><div class="row"><button class="btn sm sec" data-go="/p/' + S.P.id + back + '">← กลับ</button><button class="btn" data-act="print">🖨️ พิมพ์ / บันทึกเป็น PDF</button>' +
    '<span class="muted">เลือกเครื่องพิมพ์ "บันทึกเป็น PDF" เพื่อได้ไฟล์ส่งต่อ</span></div></div>';
  if (kind === 'daily') return bar + docDaily(key);
  if (kind === 'weekly') { after(function () { drawCurve($('#wcurve'), weekRange(+key).end > today() ? today() : weekRange(+key).end); }); return bar + docWeekly(+key); }
  if (kind === 'mat') return bar + docMat(key);
  return bar;
}
function docHead(title) {
  var p = S.P;
  return '<table style="margin-bottom:10px"><tr><td style="width:24%">โครงการ</td><td colspan="3"><b>' + esc(p.name) + '</b></td></tr>' +
    '<tr><td>ผู้รับจ้าง</td><td>' + esc(p.contractor || '-') + '</td><td style="width:18%">เลขที่สัญญา</td><td>' + esc(p.contract_no || '-') + '</td></tr>' +
    '<tr><td>ระยะเวลาสัญญา</td><td>' + th(projStart(), true) + ' – ' + th(projEnd(), true) + ' (' + (projDur() + num(p.eot_days)) + ' วัน)</td><td>ผู้ว่าจ้าง</td><td>' + esc(p.employer || '-') + '</td></tr></table>';
}
function photoGrid(list, label) {
  if (!list.length) return '';
  return '<div class="pgrid">' + list.map(function (f, i) { return '<figure><img data-fimg="' + f.id + '" alt=""><figcaption>' + label + ' ' + (i + 1) + (f.ref && /^\d{4}-/.test(f.ref) ? ' (' + th(f.ref, true) + ')' : '') + (f.caption ? ' ' + esc(f.caption) : '') + '</figcaption></figure>'; }).join('') + '</div>';
}
function docDaily(dIso) {
  var r = dailyOf(dIso) || { manpower: [], machinery: [] }, d = D(dIso), p = S.P, hist = histIndex(), prev = iso(addDays(d, -1));
  var moved = wbsList().map(function (o) { return { o: o, from: taskPctAt(hist, o.t.id, prev), to: taskPctAt(hist, o.t.id, dIso) }; }).filter(function (x) { return x.to !== x.from; });
  var box = function (lab, v) { return '<h3>' + lab + '</h3><div class="box">' + esc(v || '-') + '</div>'; };
  return '<div class="doc"><h1>บันทึกการปฏิบัติงานประจำวันของผู้ควบคุมงาน</h1><p style="text-align:center;margin-top:-4px">' + esc(p.org || '') + '</p>' + docHead() +
    '<table><tr><td style="width:24%">วันที่</td><td><b>' + TDAY[d.getDay()] + ' ' + th(dIso) + '</b></td><td style="width:18%">วันที่ของสัญญา</td><td>' + (diffDays(d, projStart()) + 1) + ' / ' + (projDur() + num(p.eot_days)) + '</td></tr>' +
    '<tr><td>สภาพอากาศ</td><td>เช้า ' + esc(r.weatherAM || '-') + ' • บ่าย ' + esc(r.weatherPM || '-') + '</td><td>การทำงาน</td><td>' + esc(r.status || '-') + '</td></tr></table>' +
    '<h3>คนงานและเครื่องจักร</h3><div class="pgrid" style="gap:10px"><table><tr><th>ประเภทช่าง</th><th class="num">จำนวน (คน)</th></tr>' + ((r.manpower || []).map(function (x) { return '<tr><td>' + esc(x.trade) + '</td><td class="num">' + num(x.count) + '</td></tr>'; }).join('') || '<tr><td colspan="2">-</td></tr>') +
    '<tr><th>รวม</th><th class="num">' + manTotal(r) + '</th></tr></table><table><tr><th>เครื่องจักร / เครื่องมือ</th><th class="num">จำนวน</th></tr>' + ((r.machinery || []).map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="num">' + num(x.count) + '</td></tr>'; }).join('') || '<tr><td colspan="2">-</td></tr>') + '</table></div>' +
    box('งานที่ดำเนินการ', r.work) +
    (moved.length ? '<h3>ความก้าวหน้ารายรายการ</h3><table><tr><th>รายการ</th><th class="num">ก่อนหน้า</th><th class="num">วันนี้</th></tr>' + moved.map(function (x) { return '<tr><td>' + esc(x.o.wbs + ' ' + x.o.t.desc) + '</td><td class="num">' + x.from + '%</td><td class="num">' + x.to + '%</td></tr>'; }).join('') + '</table>' : '') +
    box('วัสดุเข้าหน่วยงาน', r.materials) + box('การทดสอบ / ตรวจสอบ', r.tests) + box('ปัญหา อุปสรรค', r.issues) + box('คำสั่ง / ข้อแนะนำของผู้ควบคุมงาน', r.instructions) +
    ((r.visitors || r.safety) ? box('ผู้เข้าตรวจ / ประชุม', r.visitors) + box('ความปลอดภัย / สิ่งแวดล้อม', r.safety) : '') +
    '<div class="sig1">ลงชื่อ ..........................................<br>(' + esc(p.supervisor_name || '..........................................') + ')<br>' + esc(p.supervisor_pos || 'ผู้ควบคุมงาน') + '</div>' +
    (filesOf('daily', dIso).length ? '<div class="pb"></div><h3>ภาพถ่ายประจำวันที่ ' + th(dIso) + '</h3>' + photoGrid(filesOf('daily', dIso).filter(function (f) { return f.mime !== 'application/pdf'; }), 'รูปที่') : '') + '</div>';
}
function docWeekly(n) {
  var st = weekStats(n), w = weekRec(n) || {}, p = S.P, r = st.r;
  var status = st.act >= st.plan ? 'เป็นไปตามแผน / เร็วกว่าแผน' : (st.plan && st.act / st.plan >= 0.9 ? 'ล่าช้ากว่าแผนเล็กน้อย' : 'ล่าช้ากว่าแผนมาก');
  var el = diffDays(r.end, projStart()) + 1, tot = diffDays(projEnd(), projStart()) + 1, remD = diffDays(projEnd(), r.end);
  var photos = (w.photos || st.photos.slice(0, 12).map(function (f) { return f.id; })).map(function (id) { return S.files.filter(function (f) { return f.id === id; })[0]; }).filter(Boolean);
  var box = function (t) { return '<div class="box">' + esc(t || '-') + '</div>'; };
  var subs = S.submittals.filter(function (s) { return s.status !== 'อนุมัติ'; }).slice(0, 8);
  var nxt = wbsList().filter(function (o) { var t = o.t; if (t.af) return false; var s = D(t.rs || t.bs); return t.as || (s && diffDays(s, r.end) <= 14); }).slice(0, 10);
  return '<div class="doc"><h1>บันทึกข้อความ</h1><div class="mh"><b>ส่วนราชการ</b><div>' + esc(p.org || '-') + '</div><b>ที่</b><div>' + esc(p.doc_prefix || '-') + ' &nbsp; <b>วันที่</b> ' + th(today()) + '</div>' +
    '<b>เรื่อง</b><div>รายงานผลการปฏิบัติงานของผู้รับจ้าง ประจำสัปดาห์ที่ ' + n + ' (' + th(r.start, true) + ' – ' + th(r.end, true) + ')</div><b>เรียน</b><div>ประธานกรรมการตรวจรับพัสดุ</div></div>' +
    '<p class="para">ตามที่ ' + esc(p.employer || '(ผู้ว่าจ้าง)') + ' ได้ทำสัญญาจ้าง ' + esc(p.contractor || '(ผู้รับจ้าง)') + ' ดำเนินการ' + esc(p.name) + ' ตามสัญญาเลขที่ ' + esc(p.contract_no || '……') +
    ' ลงวันที่ ' + (p.contract_date ? th(p.contract_date) : '……') + (num(p.bac) ? ' วงเงิน ' + money(p.bac) + ' บาท' : '') + ' ระยะเวลา ' + projDur() + ' วัน เริ่มสัญญาวันที่ ' + th(projStart()) + ' สิ้นสุดสัญญาวันที่ ' + th(projEnd()) +
    (num(p.eot_days) ? ' (รวมขยายเวลา ' + num(p.eot_days) + ' วัน)' : '') + ' นั้น</p><p class="para">ข้าพเจ้าในฐานะผู้ควบคุมงาน ขอรายงานผลการปฏิบัติงานของผู้รับจ้าง ประจำสัปดาห์ที่ ' + n + ' ดังนี้</p>' +
    '<h3>1. ความก้าวหน้าของงาน</h3><table><tr><td>ผลงานตามแผนสะสม</td><td class="num">' + pct(st.plan) + '</td><td>ผลงานจริงสะสม</td><td class="num"><b>' + pct(st.act) + '</b></td></tr>' +
    '<tr><td>เร็ว (+) / ช้า (−) กว่าแผน</td><td class="num">' + (st.act - st.plan >= 0 ? '+' : '') + pct(st.act - st.plan) + ' (' + Math.round((st.act - st.plan) * projDur()) + ' วัน)</td><td>ผลงานสัปดาห์นี้</td><td class="num">' + pct(st.act - st.actPrev) + '</td></tr>' +
    '<tr><td>ระยะเวลาดำเนินการแล้ว</td><td class="num">' + el + ' วัน (' + pct(el / tot, 1) + ')</td><td>ระยะเวลาคงเหลือ</td><td class="num">' + (remD >= 0 ? remD + ' วัน' : 'เลยกำหนด ' + (-remD) + ' วัน') + '</td></tr>' +
    '<tr><td>สถานะ</td><td colspan="3"><b>' + status + '</b></td></tr></table>' +
    '<div class="chartbox" style="height:230px;margin-top:8px"><canvas id="wcurve"></canvas></div>' +
    '<h3>2. ข้อมูลการปฏิบัติงาน</h3><table><tr><td style="width:34%">วันทำงาน</td><td>' + st.work + ' วัน จากที่บันทึก ' + st.days.length + ' วัน • หยุดเนื่องจากฝนตก ' + st.rain + ' วัน</td></tr>' +
    '<tr><td>คนงาน</td><td>เฉลี่ย ' + st.menAvg.toFixed(1) + ' คน/วัน • สูงสุด ' + st.menMax + ' คน • รวม ' + st.manDays + ' แรงงาน</td></tr>' +
    '<tr><td>เครื่องจักร</td><td>' + (Object.keys(st.mach).map(function (k) { return esc(k) + ' ' + st.mach[k]; }).join(', ') || '-') + '</td></tr></table>' +
    '<h3>3. งานที่ดำเนินการในสัปดาห์นี้</h3>' + box(w.work_done != null ? w.work_done : compileText(st, 'work')) +
    (st.moved.length ? '<table style="margin-top:6px"><tr><th>รายการที่มีความก้าวหน้า</th><th class="num">ต้นสัปดาห์</th><th class="num">สิ้นสัปดาห์</th></tr>' + st.moved.map(function (x) { return '<tr><td>' + esc(x.o.wbs + ' ' + x.o.t.desc) + '</td><td class="num">' + x.from + '%</td><td class="num">' + x.to + '%</td></tr>'; }).join('') + '</table>' : '') +
    '<h3>4. แผนงานสัปดาห์หน้า</h3>' + box(w.next_plan) +
    (nxt.length ? '<table style="margin-top:6px"><tr><th>งานที่กำลังดำเนินการ / ต้องเริ่มใน 14 วัน</th><th class="num">% ผลงาน</th><th>กำหนดเสร็จ</th></tr>' + nxt.map(function (o) { return '<tr><td>' + esc(o.wbs + ' ' + o.t.desc) + '</td><td class="num">' + num(o.t.pct) + '%</td><td>' + th(o.t.rf || o.t.bf, true) + '</td></tr>'; }).join('') + '</table>' : '') +
    '<h3>5. วัสดุเข้าหน่วยงาน / การทดสอบ</h3>' + box(w.materials != null ? w.materials : compileText(st, 'materials')) +
    (subs.length ? '<h3>6. การขออนุมัติวัสดุที่ต้องติดตาม</h3><table><tr><th>เลขที่</th><th>วัสดุ</th><th>ผลพิจารณา</th><th>สถานะ</th></tr>' + subs.map(function (s) { return '<tr><td>' + esc(s.doc_no) + '</td><td>' + esc(s.material) + '</td><td>' + esc(s.status) + '</td><td>' + esc(subRisk(s).t) + '</td></tr>'; }).join('') + '</table>' : '') +
    '<h3>' + (subs.length ? 7 : 6) + '. ปัญหา อุปสรรค</h3>' + box(w.issues != null ? w.issues : compileText(st, 'issues')) + '<h3>' + (subs.length ? 8 : 7) + '. ความเห็นของผู้ควบคุมงาน</h3>' + box(w.opinion) +
    '<p class="para" style="margin-top:14px">จึงเรียนมาเพื่อโปรดทราบ</p><div class="sig1">ลงชื่อ ..........................................<br>(' + esc(p.supervisor_name || '..........................................') + ')<br>' + esc(p.supervisor_pos || 'ผู้ควบคุมงาน') + '</div>' +
    '<h3>ความเห็นของคณะกรรมการตรวจรับพัสดุ</h3><div class="box" style="min-height:60px">☐ รับทราบ &nbsp; ☐ ให้ผู้รับจ้างเร่งรัดงาน &nbsp; ☐ อื่นๆ ........................................................</div>' +
    '<div class="sig">' + [[p.chair, 'ประธานกรรมการ'], [p.member1, 'กรรมการ'], [p.member2, 'กรรมการ']].map(function (x) { return '<div>ลงชื่อ ...........................<br>(' + esc(x[0] || '...........................') + ')<br>' + x[1] + '</div>'; }).join('') + '</div>' +
    (photos.length ? '<div class="pb"></div><h3>ภาคผนวก: ภาพถ่ายประกอบรายงาน ประจำสัปดาห์ที่ ' + n + '</h3>' + photoGrid(photos, 'รูปที่') : '') + '</div>';
}

/* ---------------- MATERIAL SUBMITTALS ---------------- */
var VERD = ['ผ่าน', 'ไม่ผ่าน', 'ไม่พบข้อมูล', 'ไม่เกี่ยวข้อง'];
var SUB_ST = ['รอพิจารณา', 'ขอเอกสารเพิ่มเติม', 'อนุมัติ', 'ไม่อนุมัติ'];
function specSections() {
  if (S._secs) return S._secs; var m = {}, order = [];
  ((window.SPEC && SPEC.items) || []).forEach(function (r) { if (!m[r[0]]) { m[r[0]] = { sec: r[0], th: r[1], n: 0 }; order.push(r[0]); } m[r[0]].n++; });
  return (S._secs = order.sort().map(function (k) { return m[k]; }));
}
function specName(sec) { var x = specSections().filter(function (y) { return y.sec === sec; })[0]; return x ? x.sec + ' ' + x.th : sec; }
function specOpts(cur) {
  var divs = (window.SPEC && SPEC.divs) || {}, g = {};
  specSections().forEach(function (x) { var d = x.sec.slice(0, 2); (g[d] = g[d] || []).push(x); });
  return '<option value="">- ไม่ใช้รายการประกอบแบบ (พิมพ์ข้อกำหนดเอง) -</option>' + Object.keys(g).sort().map(function (d) {
    return '<optgroup label="' + esc(d + ' ' + (divs[d] || '')) + '">' + g[d].map(function (x) { return '<option value="' + esc(x.sec) + '"' + (x.sec === cur ? ' selected' : '') + '>' + esc(x.sec + ' ' + x.th + ' (' + x.n + ' ข้อ)') + '</option>'; }).join('') + '</optgroup>'; }).join('');
}
function criteriaOf(s) {
  if (s.spec_sec) return ((window.SPEC && SPEC.items) || []).filter(function (r) { return r[0] === s.spec_sec; })
    .map(function (r) { return { key: r[2] + '|' + r[3], cl: r[2], mat: r[3], kind: r[4], req: r[5], pg: r[6] }; });
  return String(s.criteria_text || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean)
    .map(function (x, i) { return { key: 'c' + (i + 1), cl: String(i + 1), mat: s.material, kind: '', req: x, pg: '' }; });
}
function checkSummary(s) {
  var cr = criteriaOf(s), ch = s.checks || {}, c = { 'ผ่าน': 0, 'ไม่ผ่าน': 0, 'ไม่พบข้อมูล': 0, 'ไม่เกี่ยวข้อง': 0, none: 0 };
  cr.forEach(function (x) { var v = ch[x.key] && ch[x.key].v; if (v) c[v]++; else c.none++; });
  var rel = cr.length - c['ไม่เกี่ยวข้อง'];
  var sug = !cr.length ? null : c['ไม่ผ่าน'] ? 'ไม่อนุมัติ' : (c['ไม่พบข้อมูล'] || c.none) ? 'ขอเอกสารเพิ่มเติม' : rel ? 'อนุมัติ' : null;
  return { n: cr.length, c: c, sug: sug, done: cr.length - c.none };
}
async function vMat(args) {
  if (args[0]) return matDetail(args[0]);
  var list = S.submittals.slice().sort(function (a, b) { return (a.doc_no || '').localeCompare(b.doc_no || '', 'th'); }), pid = S.P.id;
  var cnt = function (f) { return list.filter(f).length; };
  var h = '<div class="card"><div class="between"><h2 style="margin:0">ขออนุมัติใช้วัสดุ</h2><button class="btn" data-sub="new">＋ ยื่นขออนุมัติ</button></div>' +
    '<div class="kpis" style="margin-top:10px">' + kpi('ทั้งหมด', list.length) + kpi('อนุมัติแล้ว', cnt(function (s) { return s.status === 'อนุมัติ'; }), '', 'ok-t') +
    kpi('รอพิจารณา / ขอเอกสาร', cnt(function (s) { return s.status === 'รอพิจารณา' || s.status === 'ขอเอกสารเพิ่มเติม'; }), '', 'warn-t') +
    kpi('เสี่ยงกระทบแผนงาน', cnt(function (s) { var k = subRisk(s).k; return k === 'bad' || k === 'warn'; }), '', 'bad-t') + '</div>' +
    '<p class="muted">ต้องอนุมัติภายใน = วันเริ่มของรายการงานที่ใช้วัสดุ − ระยะเวลาสั่งผลิต/จัดส่ง • ตรวจสเปกทีละข้อเทียบ' + esc((window.SPEC && SPEC.source) || 'รายการประกอบแบบ') + '</p></div>';
  if (!list.length) return h + '<div class="card empty">ยังไม่มีรายการขออนุมัติวัสดุ</div>';
  return h + list.map(function (s) { var r = subRisk(s), t = taskById(s.taskId), cs = checkSummary(s);
    return '<div class="item pcard" data-go="/p/' + pid + '/mat/' + s.id + '" tabindex="0"><div class="between"><div class="grow"><span class="muted">' + esc(s.doc_no) + '</span> <span class="t">' + esc(s.material) + '</span>' +
      '<div class="m">' + esc(s.brand || '') + (s.spec_sec ? ' • ' + esc(specName(s.spec_sec)) : '') + (t ? ' • ใช้กับ ' + esc(wbsOf(t.id) + ' ' + t.desc) : '') + '</div></div>' +
      '<div style="text-align:right">' + badge({ k: s.status === 'อนุมัติ' ? 'ok' : s.status === 'ไม่อนุมัติ' ? 'bad' : 'warn', t: s.status }) + '</div></div>' +
      '<div class="m" style="margin-top:4px">' + badge(r) + (r.need ? ' ต้องอนุมัติภายใน ' + th(r.need, true) : '') + ' • ตรวจแล้ว ' + cs.done + '/' + cs.n + ' ข้อ • 📎 ' + filesOf('submittal', s.id).length + '</div></div>'; }).join('');
}
function openSub(id) {
  var s = id ? S.submittals.filter(function (x) { return x.id === id; })[0] : { status: 'รอพิจารณา', submitted_date: iso(today()), lead_days: 14 };
  var bg = modal('<h2>' + (id ? 'แก้ไขข้อมูลการขออนุมัติ' : 'ยื่นขออนุมัติใช้วัสดุ') + '</h2><div class="grid2">' + inp('sDoc', 'เลขที่เอกสาร', s.doc_no) + inp('sSubD', 'วันที่ยื่น', s.submitted_date, 'date') +
    inp('sMat', 'รายการวัสดุ', s.material) + inp('sBr', 'ยี่ห้อ / รุ่นที่เสนอ', s.brand) + '</div>' +
    '<label class="f" for="sTask">ใช้กับรายการงาน (ใช้คำนวณกำหนดอนุมัติ)</label><select id="sTask" class="i">' + opts(wbsList().map(function (o) { return [o.t.id, o.wbs + ' ' + o.t.desc]; }), s.taskId, '- ไม่ระบุ -') + '</select>' +
    '<div class="grid2">' + inp('sLead', 'ระยะเวลาสั่งผลิต/จัดส่ง (วัน)', s.lead_days, 'number', 'min="0" inputmode="numeric"') + '</div>' +
    '<label class="f" for="sSpec">เกณฑ์ตรวจตามรายการประกอบแบบ</label><select id="sSpec" class="i">' + specOpts(s.spec_sec) + '</select>' +
    '<label class="f" for="sCrit">หรือพิมพ์ข้อกำหนดเอง (บรรทัดละ 1 ข้อ) – ใช้เมื่อไม่เลือกหมวด</label><textarea id="sCrit" class="i" rows="3" placeholder="เช่น เหล็กข้ออ้อย SD40 ตาม มอก. 24-2559&#10;มีใบรับรองผลการทดสอบ (Mill Certificate)">' + esc(s.criteria_text) + '</textarea>' +
    (id ? '<div style="margin-top:8px"><button class="btn sm bad" id="sDel">ลบรายการนี้</button></div>' : ''),
    async function (bg) {
      var o = Object.assign({}, s, { id: id || uid(), projectId: S.P.id, doc_no: val(bg, 'sDoc'), submitted_date: val(bg, 'sSubD'), material: val(bg, 'sMat'), brand: val(bg, 'sBr'),
        taskId: val(bg, 'sTask'), lead_days: val(bg, 'sLead'), spec_sec: val(bg, 'sSpec'), criteria_text: val(bg, 'sCrit'), updated: new Date().toISOString() });
      if (!o.doc_no || !o.material) throw new Error('กรอกเลขที่เอกสารและรายการวัสดุ');
      if (s.spec_sec && s.spec_sec !== o.spec_sec && Object.keys(s.checks || {}).length && !(await confirmBox('เปลี่ยนหมวดเกณฑ์ตรวจจะล้างผลการตรวจเดิม ดำเนินการต่อ?', 'เปลี่ยน'))) return false;
      if (s.spec_sec !== o.spec_sec) o.checks = {};
      await DB.put('submittals', o);
      if (id) Object.assign(s, o); else S.submittals.push(o);
      toast('บันทึกแล้ว'); if (!id) go('/p/' + S.P.id + '/mat/' + o.id); else render();
    }, id ? 'บันทึก' : 'ยื่นขออนุมัติ', true);
  var del = bg.querySelector('#sDel');
  if (del) del.onclick = async function () {
    if (!(await confirmBox('ลบรายการขออนุมัติ ' + s.doc_no + ' และไฟล์แนบทั้งหมด?', 'ลบ'))) return;
    var fids = filesOf('submittal', id).map(function (f) { return f.id; });
    await DB.del('submittals', id); await DB.delMany('files', fids);
    S.submittals = S.submittals.filter(function (x) { return x.id !== id; }); S.files = S.files.filter(function (f) { return fids.indexOf(f.id) < 0; });
    bg.remove(); toast('ลบแล้ว'); go('/p/' + S.P.id + '/mat');
  };
}
async function matDetail(sid) {
  var s = S.submittals.filter(function (x) { return x.id === sid; })[0], pid = S.P.id;
  if (!s) return '<div class="card empty">ไม่พบรายการ <button class="btn sm sec" data-go="/p/' + pid + '/mat">กลับ</button></div>';
  var r = subRisk(s), t = taskById(s.taskId), cr = criteriaOf(s), cs = checkSummary(s), ch = s.checks || {};
  var h = '<div class="card"><div class="between"><button class="btn sm sec" data-go="/p/' + pid + '/mat">← ทะเบียน</button><div class="row"><button class="btn sm sec" data-go="/p/' + pid + '/print/mat/' + sid + '">🖨️ รายงานขออนุมัติ</button>' +
    '<button class="btn sm" data-sub="' + sid + '">แก้ไข</button></div></div><h2 style="margin:10px 0 0">' + esc(s.doc_no) + ' • ' + esc(s.material) + '</h2>' +
    '<div class="muted">' + esc(s.brand || '') + (s.spec_sec ? ' • ' + esc(specName(s.spec_sec)) : '') + '</div>' +
    '<div class="kpis" style="margin-top:10px">' + kpi('ใช้กับงาน', t ? esc(wbsOf(t.id)) : '-', t ? esc(t.desc) : '') +
    kpi('ต้องอนุมัติภายใน', r.need ? th(r.need, true) : '-', badge(r)) + kpi('ผลการตรวจ', cs.done + ' / ' + cs.n + ' ข้อ', 'ผ่าน ' + cs.c['ผ่าน'] + ' • ไม่ผ่าน ' + cs.c['ไม่ผ่าน'] + ' • ไม่พบ ' + cs.c['ไม่พบข้อมูล']) +
    kpi('ผลพิจารณา', esc(s.status), s.approved_date ? 'เมื่อ ' + th(s.approved_date, true) : '', s.status === 'อนุมัติ' ? 'ok-t' : s.status === 'ไม่อนุมัติ' ? 'bad-t' : 'warn-t') + '</div></div>';
  h += '<div class="card"><h2>เอกสารและภาพที่แนบ</h2>' + filesBlock('submittal', sid, true, true) + '</div>';
  h += '<div class="card"><div class="between"><h2 style="margin:0">ตรวจเทียบข้อกำหนด (' + cr.length + ' ข้อ)</h2><div class="row">' +
    (cr.length ? '<button class="btn sm sec" data-chkall="ไม่เกี่ยวข้อง">ข้อที่ยังไม่ตรวจ = ไม่เกี่ยวข้อง</button>' : '') + '</div></div>' +
    (!cr.length ? '<p class="muted">ยังไม่ได้กำหนดเกณฑ์ – กด "แก้ไข" เพื่อเลือกหมวดตามรายการประกอบแบบ หรือพิมพ์ข้อกำหนดเอง</p>' :
      '<p class="muted">เลือกผลทีละข้อหลังเปิดดูเอกสารแนบ • ข้อที่ไม่ใช่วัสดุนี้ (เช่น วัสดุอื่นในหมวดเดียวกัน หรือขั้นตอนทำงานหน้างาน) เลือก "ไม่เกี่ยวข้อง"</p><div class="tw"><table><tr><th>ข้อ</th><th>ข้อกำหนด</th><th style="width:150px">ผล</th></tr>' +
      cr.map(function (x) { var c = ch[x.key] || {};
        return '<tr><td>' + esc(x.cl) + '</td><td>' + esc(x.req) + '<div class="muted">' + esc(x.mat) + (x.kind ? ' • ' + esc(x.kind) : '') + (x.pg ? ' • หน้า ' + esc(x.pg) : '') + '</div>' +
          '<input class="i" data-cnote="' + esc(x.key) + '" placeholder="สิ่งที่พบ / หมายเหตุ" value="' + esc(c.note) + '" style="margin-top:4px;padding:5px 8px;font-size:13px"></td>' +
          '<td><select class="i v-' + esc(c.v || '') + '" data-chk="' + esc(x.key) + '" aria-label="ผลข้อ ' + esc(x.cl) + '">' + opts(VERD, c.v, '- ยังไม่ตรวจ -') + '</select></td></tr>'; }).join('') + '</table></div>') + '</div>';
  h += '<div class="card"><h2>ผลพิจารณา</h2>' + (cs.sug ? '<p>ผลตามการตรวจ: ' + badge({ k: cs.sug === 'อนุมัติ' ? 'ok' : cs.sug === 'ไม่อนุมัติ' ? 'bad' : 'warn', t: 'แนะนำ: ' + cs.sug }) +
    (cs.c.none ? ' <span class="muted">(ยังไม่ตรวจ ' + cs.c.none + ' ข้อ)</span>' : '') + '</p>' : '') +
    '<div class="grid3"><div><label class="f" for="dSt">ผลพิจารณา</label><select id="dSt" class="i">' + opts(SUB_ST, s.status) + '</select></div>' + inp('dAp', 'วันที่อนุมัติ', s.approved_date, 'date') + '</div>' +
    '<label class="f" for="dRm">หมายเหตุ / เอกสารที่ต้องขอเพิ่ม</label><textarea id="dRm" class="i" rows="2">' + esc(s.remark) + '</textarea>' +
    '<div class="row" style="margin-top:10px"><button class="btn" data-act="subDecide" data-sid="' + sid + '">บันทึกผลพิจารณา</button>' + (cs.sug && cs.sug !== s.status ? '<button class="btn sec" data-act="subSuggest" data-sug="' + cs.sug + '">ใช้ผลตามการตรวจ</button>' : '') + '</div></div>';
  return h;
}
function docMat(sid) {
  var s = S.submittals.filter(function (x) { return x.id === sid; })[0]; if (!s) return '<div class="card empty">ไม่พบรายการ</div>';
  var p = S.P, t = taskById(s.taskId), cr = criteriaOf(s), ch = s.checks || {}, cs = checkSummary(s), fl = filesOf('submittal', sid);
  var imgs = fl.filter(function (f) { return f.mime !== 'application/pdf'; }).slice(0, 6), rows = cr.filter(function (x) { return !ch[x.key] || ch[x.key].v !== 'ไม่เกี่ยวข้อง'; });
  return '<div class="doc"><h1>รายงานผลการตรวจสอบและขออนุมัติใช้วัสดุ</h1><p style="text-align:center;margin-top:-4px">' + esc(p.org || '') + '</p>' + docHead() +
    '<table><tr><td style="width:24%">เลขที่เอกสาร</td><td>' + esc(s.doc_no) + '</td><td style="width:18%">วันที่ยื่น</td><td>' + th(s.submitted_date) + '</td></tr>' +
    '<tr><td>วัสดุ</td><td>' + esc(s.material) + '</td><td>ยี่ห้อ / รุ่น</td><td>' + esc(s.brand || '-') + '</td></tr>' +
    '<tr><td>เกณฑ์ที่ใช้ตรวจ</td><td colspan="3">' + esc(s.spec_sec ? specName(s.spec_sec) + ' (' + ((window.SPEC && SPEC.source) || '') + ')' : 'ข้อกำหนดเฉพาะรายการ') + '</td></tr>' +
    '<tr><td>ใช้กับงาน</td><td colspan="3">' + (t ? esc(wbsOf(t.id) + ' ' + t.desc) : '-') + '</td></tr>' +
    '<tr><td>เอกสารแนบ</td><td colspan="3">' + (fl.length ? fl.map(function (f, i) { return (i + 1) + '. ' + esc(f.name) + (f.caption ? ' – ' + esc(f.caption) : ''); }).join('<br>') : '-') + '</td></tr></table>' +
    '<h3>ผลการตรวจเทียบข้อกำหนด (ผ่าน ' + cs.c['ผ่าน'] + ' • ไม่ผ่าน ' + cs.c['ไม่ผ่าน'] + ' • ไม่พบข้อมูล ' + cs.c['ไม่พบข้อมูล'] + (cs.c.none ? ' • ยังไม่ตรวจ ' + cs.c.none : '') + ')</h3>' +
    (rows.length ? '<table><tr><th style="width:8%">ข้อ</th><th>ข้อกำหนด</th><th style="width:28%">สิ่งที่พบ</th><th style="width:13%">ผล</th></tr>' + rows.map(function (x) { var c = ch[x.key] || {};
      return '<tr><td>' + esc(x.cl) + '</td><td>' + esc(x.req) + '</td><td>' + esc(c.note || '') + '</td><td class="v-' + esc(c.v || '') + '">' + esc(c.v || '-') + '</td></tr>'; }).join('') + '</table>' : '<p>-</p>') +
    '<h3>ผลการพิจารณาของผู้ควบคุมงาน</h3><p><b>' + esc(s.status) + '</b>' + (s.approved_date ? ' เมื่อ ' + th(s.approved_date) : '') + (s.remark ? '<br>หมายเหตุ: ' + esc(s.remark) : '') + '</p>' +
    (imgs.length ? '<h3>ภาพประกอบ</h3>' + photoGrid(imgs, 'ภาพที่') : '') +
    '<div class="sig"><div>ลงชื่อ ...........................<br>(...........................)<br>ผู้เสนอขออนุมัติ (ผู้รับจ้าง)</div><div>ลงชื่อ ...........................<br>(' + esc(p.supervisor_name || '...........................') + ')<br>' + esc(p.supervisor_pos || 'ผู้ควบคุมงาน') + '</div>' +
    '<div>ลงชื่อ ...........................<br>(' + esc(p.chair || '...........................') + ')<br>ประธานกรรมการตรวจรับพัสดุ</div></div></div>';
}

/* ---------------- APP SETTINGS ---------------- */
async function vApp() {
  var lastBk = await meta('lastBackup'), est = null, persisted = null;
  try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted(); } catch (e) {}
  var theme = document.documentElement.dataset.theme || 'auto';
  var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return '<div class="card"><h2>การแสดงผล</h2><div class="seg" id="themeSeg">' + [['auto', '🌓 ตามเครื่อง'], ['light', '☀️ สว่าง'], ['dark', '🌙 มืด']].map(function (x) {
      return '<button data-theme="' + x[0] + '" class="' + (theme === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="card"><h2>💾 สำรองและกู้คืนข้อมูล</h2><p>ข้อมูลทั้งหมดเก็บในเครื่องนี้เท่านั้น (ไม่ได้ส่งขึ้นอินเทอร์เน็ต) ถ้าล้างข้อมูลเบราว์เซอร์ เปลี่ยนเครื่อง หรือเครื่องเสีย ข้อมูลจะหาย – <b>ควรสำรองสัปดาห์ละครั้ง</b> แล้วเก็บไฟล์ไว้ใน Google Drive/OneDrive</p>' +
    '<p class="muted">สำรองครั้งล่าสุด: ' + (lastBk ? th(lastBk.slice(0, 10)) + ' ' + lastBk.slice(11, 16) + ' น.' : '<span class="bad-t">ยังไม่เคยสำรอง</span>') + '</p>' +
    '<div class="row"><button class="btn acc" data-act="backup">💾 สำรองข้อมูลทั้งหมด (รวมรูป)</button><button class="btn sec" data-act="backupLite">สำรองแบบไม่รวมรูป</button>' +
    '<label class="btn sec" style="display:inline-block">📂 กู้คืนจากไฟล์<input type="file" class="hidden" id="restoreFile" accept=".json,application/json"></label></div>' +
    '<p class="muted">ย้ายไปเครื่องใหม่: สำรองในเครื่องเดิม → เปิดแอปในเครื่องใหม่ → กู้คืนจากไฟล์</p></div>' +
    '<div class="card"><h2>พื้นที่จัดเก็บ</h2><p>' + (est ? 'ใช้ไป ' + (est.usage / 1048576).toFixed(1) + ' MB จากที่ใช้ได้ประมาณ ' + (est.quota / 1073741824).toFixed(1) + ' GB' : 'ไม่ทราบขนาด') + '</p>' +
    '<p class="muted">การป้องกันการลบอัตโนมัติ: ' + (persisted ? '<span class="ok-t">✓ เปิดแล้ว</span>' : 'ยังไม่เปิด <button class="btn sm sec" data-act="persist">ขอเปิด</button>') + ' – ช่วยไม่ให้เบราว์เซอร์ลบข้อมูลเองเมื่อพื้นที่เครื่องเหลือน้อย</p></div>' +
    '<div class="card"><h2>ติดตั้งเป็นแอป</h2>' + (standalone ? '<p class="ok-t">✓ กำลังใช้งานแบบแอปที่ติดตั้งแล้ว</p>' :
      (S.deferredInstall ? '<button class="btn" data-act="install">⬇ ติดตั้งลงเครื่องนี้</button>' : '') +
      '<p class="muted">' + (ios ? 'iPhone/iPad: เปิดใน Safari → ปุ่มแชร์ ⬆ → "เพิ่มไปยังหน้าจอโฮม"' : 'คอมพิวเตอร์ (Chrome/Edge): กดไอคอน ⊕ ท้ายช่องที่อยู่เว็บ หรือเมนู ⋮ → "ติดตั้งแอป" • Android (Chrome): เมนู ⋮ → "ติดตั้งแอป" / "เพิ่มลงในหน้าจอหลัก"') + '</p>') +
    '<p class="muted">ติดตั้งแล้วเปิดจากไอคอนได้เหมือนโปรแกรม และใช้งานได้แม้ไม่มีอินเทอร์เน็ต</p></div>' +
    '<div class="card"><h2>เกี่ยวกับ</h2><p>คุมงานก่อสร้าง เวอร์ชัน ' + APP_VERSION + ' • ข้อมูลรายการประกอบแบบ: ' + esc((window.SPEC && SPEC.source) || '-') + ' (' + ((window.SPEC && SPEC.items.length) || 0) + ' ข้อ)</p>' +
    '<button class="btn sec" data-act="sample">➕ สร้างโครงการตัวอย่าง</button> <button class="btn sm ghost bad-t" data-act="wipe">ล้างข้อมูลทั้งหมด</button></div>';
}
function b64FromBlob(b) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(b); }); }
function blobFromB64(b64, mime) { var bin = atob(b64), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); }
async function saveBlob(name, blob) {
  if (window.claude && typeof window.claude.use === 'function') {
    var dl = null; try { dl = await window.claude.use('downloads'); } catch (e) {}
    if (dl) { try { await dl.save({ filename: name, data: await blob.arrayBuffer() }); return true; } catch (e) { if (e && e.code === 'declined') return false; throw new Error('ดาวน์โหลดไม่สำเร็จ'); } }
  }
  var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(u); }, 30000); return true;
}
async function doBackup(withFiles) {
  toast('กำลังเตรียมไฟล์สำรอง…', false, 8000);
  var out = { app: 'sitecontrol', version: APP_VERSION, exported: new Date().toISOString(), withFiles: withFiles, stores: {} };
  for (var i = 0; i < STORES.length; i++) {
    var s = STORES[i]; if (s === 'meta') continue;
    var rows = await DB.all(s);
    if (s === 'files') {
      var arr = [];
      for (var j = 0; j < rows.length; j++) { var f = Object.assign({}, rows[j]); var b = f.blob; delete f.blob; if (withFiles) f.data = await b64FromBlob(b); arr.push(f); }
      rows = arr;
    }
    out.stores[s] = rows;
  }
  var stamp = new Date(), name = 'สำรอง_คุมงาน_' + iso(stamp) + (withFiles ? '' : '_ไม่รวมรูป') + '.json';
  if (await saveBlob(name, new Blob([JSON.stringify(out)], { type: 'application/json' }))) {
    await meta('lastBackup', stamp.toISOString()); toast('สำรองข้อมูลแล้ว: ' + name, false, 4500);
  }
}
async function doRestore(file) {
  var data; try { data = JSON.parse(await file.text()); } catch (e) { throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอป'); }
  if (!data || data.app !== 'sitecontrol' || !data.stores) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอป');
  var np = (data.stores.projects || []).length;
  var bg = modal('<h2>กู้คืนข้อมูล</h2><p>ไฟล์สำรองวันที่ <b>' + th((data.exported || '').slice(0, 10)) + '</b> มี ' + np + ' โครงการ' + (data.withFiles ? ' (รวมรูป)' : ' (ไม่รวมรูป)') + '</p>' +
    '<label class="row"><input type="radio" name="rm" value="merge" checked><span><b>รวมกับข้อมูลเดิม</b> – รายการที่ซ้ำจะใช้ข้อมูลจากไฟล์</span></label>' +
    '<label class="row" style="margin-top:6px"><input type="radio" name="rm" value="replace"><span><b>แทนที่ทั้งหมด</b> – ลบข้อมูลในเครื่องแล้วใช้ข้อมูลจากไฟล์</span></label>', async function (bg) {
      var mode = bg.querySelector('input[name=rm]:checked').value;
      if (mode === 'replace') for (var i = 0; i < STORES.length; i++) if (STORES[i] !== 'meta') await DB.clear(STORES[i]);
      for (var s in data.stores) {
        if (STORES.indexOf(s) < 0 || s === 'meta') continue;
        var rows = data.stores[s];
        if (s === 'files') rows = rows.filter(function (f) { return f.data; }).map(function (f) { var o = Object.assign({}, f); o.blob = blobFromB64(f.data, f.mime); delete o.data; return o; });
        await DB.putMany(s, rows);
      }
      S.P = null; toast('กู้คืนข้อมูลแล้ว (' + np + ' โครงการ)'); go('/');
    }, 'กู้คืน');
}
function exportXlsx() {
  return loadXlsx().then(async function () {
    var p = S.P, d = today(), w = weightFn(), wb = XLSX.utils.book_new(), dt = function (x) { return x ? D(x) : null; }, hist = histIndex();
    var add = function (name, rows, widths) { var sh = XLSX.utils.aoa_to_sheet(rows, { cellDates: true }); sh['!cols'] = widths.map(function (x) { return { wch: x }; }); XLSX.utils.book_append_sheet(wb, sh, name); return sh; };
    var pl = planAt(d), ac = actualNow();
    var s1 = add('สรุป', [['โครงการ', p.name], ['ผู้ว่าจ้าง', p.employer], ['ผู้รับจ้าง', p.contractor], ['เลขที่สัญญา', p.contract_no], ['ข้อมูล ณ วันที่', d], ['มูลค่าสัญญาเดิม', num(p.bac)],
      ['วันเริ่มสัญญา', projStart()], ['ระยะเวลาสัญญา (วัน)', projDur()], ['วันสิ้นสุด (รวมขยายเวลา)', projEnd()], ['ผลงานตามแผน', pl], ['ผลงานจริง', ac], ['ผลต่าง', ac - pl], ['SPI', pl ? ac / pl : '']], [24, 50]);
    ['B10', 'B11', 'B12'].forEach(function (a) { if (s1[a]) s1[a].z = '0.00%'; });
    var s2 = add('แผนงาน', [['WBS', 'งานส่วน', 'หมวดงาน', 'รายการงาน', 'มูลค่า BOQ', 'น้ำหนัก', 'เริ่มแผน', 'เสร็จแผน', 'เริ่มเร่งรัด', 'เสร็จเร่งรัด', 'เริ่มจริง', 'เสร็จจริง', '% จริง', '% ควรได้', 'สถานะ', 'หมายเหตุ']].concat(
      wbsList().map(function (o) { var t = o.t; return [o.wbs, t.part, t.cat, t.desc, num(t.boq), w(t), dt(t.bs), dt(t.bf), dt(t.rs), dt(t.rf), dt(t.as), dt(t.af), num(t.pct) / 100, spanPct(D(t.bs), D(t.bf), d), taskStatus(t).t, t.remark || '']; })),
      [8, 20, 16, 40, 14, 9, 11, 11, 11, 11, 11, 11, 9, 9, 14, 30]);
    var rg = XLSX.utils.decode_range(s2['!ref']); for (var R = 1; R <= rg.e.r; R++) [5, 12, 13].forEach(function (C) { var c = s2[XLSX.utils.encode_cell({ r: R, c: C })]; if (c && c.t === 'n') c.z = '0.00%'; });
    var curve = [['สัปดาห์', 'สิ้นสัปดาห์', 'แผนสะสม', 'จริงสะสม']];
    for (var n = 1; n <= totalWeeks(); n++) { var r = weekRange(n); curve.push([n, r.end, planAt(r.end), r.end <= d ? actualAt(r.end, hist) : '']); }
    var s3 = add('S-Curve', curve, [9, 12, 10, 10]); var r3 = XLSX.utils.decode_range(s3['!ref']); for (var R3 = 1; R3 <= r3.e.r; R3++) [2, 3].forEach(function (C) { var c = s3[XLSX.utils.encode_cell({ r: R3, c: C })]; if (c && c.t === 'n') c.z = '0.00%'; });
    add('ประวัติผลงาน', [['วันที่', 'WBS', 'รายการงาน', '% ผลงาน', 'ที่มา']].concat(S.progress.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (x) { var t = taskById(x.taskId);
      return [dt(x.date), t ? wbsOf(t.id) : '', t ? t.desc : '(ลบแล้ว)', num(x.pct), x.source === 'daily' ? 'รายงานประจำวัน' : x.source === 'import' ? 'นำเข้า' : 'อัปเดต']; })), [11, 8, 40, 9, 16]);
    add('รายงานประจำวัน', [['วันที่', 'อากาศเช้า', 'อากาศบ่าย', 'การทำงาน', 'คนงาน (คน)', 'รายละเอียดคนงาน', 'เครื่องจักร', 'งานที่ทำ', 'วัสดุเข้า', 'การทดสอบ', 'ปัญหา', 'คำสั่งผู้ควบคุมงาน', 'รูป']].concat(
      S.daily.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (x) { return [dt(x.date), x.weatherAM, x.weatherPM, x.status, manTotal(x),
        (x.manpower || []).map(function (m) { return m.trade + ' ' + m.count; }).join(', '), (x.machinery || []).map(function (m) { return m.name + ' ' + m.count; }).join(', '), x.work || '', x.materials || '', x.tests || '', x.issues || '', x.instructions || '', filesOf('daily', x.date).length]; })),
      [11, 12, 12, 16, 9, 30, 26, 40, 24, 24, 30, 30, 6]);
    add('ขออนุมัติวัสดุ', [['เลขที่', 'วัสดุ', 'ยี่ห้อ', 'หมวดเกณฑ์', 'ใช้กับงาน', 'วันที่ยื่น', 'ต้องอนุมัติภายใน', 'ผลพิจารณา', 'วันที่อนุมัติ', 'ตรวจแล้ว (ข้อ)', 'สถานะ']].concat(
      S.submittals.map(function (s) { var r = subRisk(s), cs = checkSummary(s); return [s.doc_no, s.material, s.brand, s.spec_sec ? specName(s.spec_sec) : 'กำหนดเอง', wbsOf(s.taskId), dt(s.submitted_date), r.need || '', s.status, dt(s.approved_date), cs.done + '/' + cs.n, r.t]; })),
      [10, 26, 16, 30, 10, 11, 12, 16, 11, 10, 26]);
    var ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
    if (await saveBlob(p.name.replace(/[\\\/:*?"<>|]/g, '_').slice(0, 60) + '_' + iso(d) + '.xlsx', new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))) toast('ส่งออก Excel แล้ว');
  });
}

/* ---------------- EVENTS ---------------- */
document.addEventListener('click', async function (e) {
  var el = e.target.closest('[data-go],[data-act],[data-prog],[data-task],[data-tf],[data-tp],[data-open],[data-fdel],[data-sub],[data-addrow],[data-ldel],[data-fill],[data-wph],[data-chkall],[data-theme]');
  if (!el) return;
  try {
    if (el.dataset.open) return openFile(el.dataset.open);
    if (el.dataset.wph) { var ph = S.weekDraft.photos, i = ph.indexOf(el.dataset.wph); if (i >= 0) ph.splice(i, 1); else ph.push(el.dataset.wph); await saveWeekly(); return render(); }
    if (el.dataset.go != null) return go(el.dataset.go);
    if (el.dataset.prog) return openProgress(el.dataset.prog);
    if (el.dataset.task != null) return openTask(el.dataset.task || null);
    if (el.dataset.tf != null) { TF.st = el.dataset.tf; return render(); }
    if (el.dataset.tp != null) { TF.part = el.dataset.tp; return render(); }
    if (el.dataset.sub) return openSub(el.dataset.sub === 'new' ? null : el.dataset.sub);
    if (el.dataset.theme) { var t = el.dataset.theme; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; try { localStorage.setItem('sc_theme', t); } catch (x) {} return render(); }
    if (el.dataset.fdel) {
      if (!(await confirmBox('ลบไฟล์นี้?', 'ลบ'))) return;
      await DB.del('files', el.dataset.fdel); S.files = S.files.filter(function (f) { return f.id !== el.dataset.fdel; });
      if (S.weekDraft && S.weekDraft.photos) { S.weekDraft.photos = S.weekDraft.photos.filter(function (x) { return x !== el.dataset.fdel; }); }
      toast('ลบแล้ว'); return render();
    }
    if (el.dataset.addrow) { var L = S.dailyDraft[el.dataset.addrow]; L.push(el.dataset.addrow === 'manpower' ? { trade: el.dataset.name, count: '' } : { name: el.dataset.name, count: 1 }); await saveDaily(); render(); setTimeout(function () { var ins = $$('[data-l="' + el.dataset.addrow + '"][data-f=c]'); if (ins.length) ins[ins.length - 1].focus(); }, 50); return; }
    if (el.dataset.ldel) { S.dailyDraft[el.dataset.ldel].splice(+el.dataset.i, 1); await saveDaily(); return render(); }
    if (el.dataset.fill) { var st = weekStats(S.weekDraft.week), k = el.dataset.fill, src = { work_done: 'work', issues: 'issues', materials: 'materials' }[k];
      var txt = compileText(st, src) + (k === 'materials' && compileText(st, 'tests') ? '\n' + compileText(st, 'tests') : ''); $('#w_' + k).value = S.weekDraft[k] = txt; await saveWeekly(); return; }
    if (el.dataset.chkall) { var s = S.submittals.filter(function (x) { return x.id === S.route[3]; })[0]; s.checks = s.checks || {};
      criteriaOf(s).forEach(function (x) { if (!s.checks[x.key] || !s.checks[x.key].v) s.checks[x.key] = { v: el.dataset.chkall, note: (s.checks[x.key] || {}).note || '' }; }); await DB.put('submittals', s); return render(); }
    var a = el.dataset.act;
    if (a === 'newProject') newProject();
    else if (a === 'importXlsx') importXlsx();
    else if (a === 'sample') { var id = await createSample(); go('/p/' + id); }
    else if (a === 'backup') await doBackup(true);
    else if (a === 'backupLite') await doBackup(false);
    else if (a === 'persist') { var ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? 'เปิดการป้องกันแล้ว' : 'เบราว์เซอร์ไม่อนุญาต – ติดตั้งเป็นแอปจะช่วยได้', !ok); render(); }
    else if (a === 'install') { if (S.deferredInstall) { S.deferredInstall.prompt(); await S.deferredInstall.userChoice; S.deferredInstall = null; $('#installBtn').classList.add('hidden'); render(); } }
    else if (a === 'wipe') { if (await confirmBox('ลบข้อมูลทุกโครงการในเครื่องนี้? (กู้คืนได้จากไฟล์สำรองเท่านั้น)', 'ลบทั้งหมด')) { for (var q = 0; q < STORES.length; q++) await DB.clear(STORES[q]); S.P = null; toast('ล้างข้อมูลแล้ว'); go('/'); } }
    else if (a === 'pasteTasks') pasteTasks();
    else if (a === 'saveProj') { var box = $('#projFormBox'); readProjectForm(box, S.P); await saveProject(); toast('บันทึกแล้ว'); render(); }
    else if (a === 'archive') { S.P.archived = !S.P.archived; await saveProject(); toast(S.P.archived ? 'เก็บเข้าคลังแล้ว' : 'นำออกจากคลังแล้ว'); render(); }
    else if (a === 'delProject') {
      var name = S.P.name;
      var bg = modal('<h2>ลบโครงการ</h2><p>พิมพ์ชื่อโครงการ <b>' + esc(name) + '</b> เพื่อยืนยัน</p><input class="i" id="cn">', async function (bg) {
        if (val(bg, 'cn') !== name) throw new Error('ชื่อไม่ตรง'); var pid = S.P.id;
        for (var i = 0; i < STORES.length; i++) { var s = STORES[i]; if (s === 'projects' || s === 'meta') continue; var rows = await DB.byProject(s, pid); await DB.delMany(s, rows.map(function (r) { return r.id; })); }
        await DB.del('projects', pid); S.P = null; toast('ลบโครงการแล้ว'); go('/');
      }, 'ลบถาวร');
    }
    else if (a === 'exportXlsx') await exportXlsx();
    else if (a === 'openDay') { var dv = $('#dPick').value; if (D(dv)) go('/p/' + S.P.id + '/daily/' + dv); }
    else if (a === 'copyPrev') { var pr = dailyOf(el.dataset.date); S.dailyDraft.manpower = JSON.parse(JSON.stringify(pr.manpower || [])); S.dailyDraft.machinery = JSON.parse(JSON.stringify(pr.machinery || [])); await saveDaily(); toast('คัดลอกคนงานและเครื่องจักรแล้ว'); render(); }
    else if (a === 'delDaily') { var di = el.dataset.date; if (!(await confirmBox('ลบรายงานประจำวันที่ ' + th(di) + ' (รวมรูป และผลงานที่บันทึกจากรายงานนี้)?', 'ลบ'))) return;
      var fids = filesOf('daily', di).map(function (f) { return f.id; }), pids = S.progress.filter(function (x) { return x.date === di && x.source === 'daily'; });
      await DB.del('daily', S.P.id + '_' + di); await DB.delMany('files', fids); await DB.delMany('progress', pids.map(function (x) { return x.id; }));
      S.daily = S.daily.filter(function (x) { return x.date !== di; }); S.files = S.files.filter(function (f) { return fids.indexOf(f.id) < 0; }); S.progress = S.progress.filter(function (x) { return pids.indexOf(x) < 0; });
      for (var z = 0; z < pids.length; z++) { var tt = taskById(pids[z].taskId); if (tt) await syncTaskPct(tt); }
      toast('ลบแล้ว'); go('/p/' + S.P.id + '/daily'); }
    else if (a === 'printDaily') { if (S.dailyDraft) await saveDaily(); go('/p/' + S.P.id + '/print/daily/' + el.dataset.date); }
    else if (a === 'printWeekly') { await saveWeekly(); go('/p/' + S.P.id + '/print/weekly/' + el.dataset.week); }
    else if (a === 'print') { hydrateImgs(); await Promise.all($$('.doc img').map(function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); })); setTimeout(function () { window.print(); }, 150); }
    else if (a === 'subDecide' || a === 'subSuggest') {
      var sb = S.submittals.filter(function (x) { return x.id === S.route[3]; })[0];
      if (a === 'subSuggest') { $('#dSt').value = el.dataset.sug; if (el.dataset.sug === 'อนุมัติ' && !$('#dAp').value) $('#dAp').value = iso(today()); return; }
      sb.status = $('#dSt').value; sb.approved_date = $('#dAp').value || (sb.status === 'อนุมัติ' ? iso(today()) : ''); sb.remark = $('#dRm').value.trim(); sb.updated = new Date().toISOString();
      await DB.put('submittals', sb); toast('บันทึกผลพิจารณาแล้ว'); render();
    }
  } catch (err) { console.error(err); toast(err.message, true); }
});
document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pcard')) { e.preventDefault(); e.target.click(); } });
var _qT = null;
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.id === 'tq') { clearTimeout(_qT); _qT = setTimeout(function () { TF.q = t.value; render().then(function () { var q = $('#tq'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }); }, 300); return; }
  if (t.dataset.dd && S.dailyDraft) { S.dailyDraft[t.id.replace(/^d_/, '')] = t.value; dailyChanged(); return; }
  if (t.dataset.l && S.dailyDraft) { var row = S.dailyDraft[t.dataset.l][+t.dataset.i]; if (t.dataset.f === 'n') row[t.dataset.l === 'manpower' ? 'trade' : 'name'] = t.value; else row.count = t.value;
    var ms = $('#manSum'); if (ms) ms.textContent = 'รวม ' + manTotal(S.dailyDraft) + ' คน'; dailyChanged(); return; }
  if (t.dataset.wd && S.weekDraft && t.type !== 'checkbox') { S.weekDraft[t.dataset.wd] = t.value; weeklyChanged(); return; }
});
document.addEventListener('change', async function (e) {
  var t = e.target;
  try {
    if (t.dataset.up) { var n = await addFiles(t.dataset.up, t.dataset.ref, t.files, t.dataset.pdf === '1'); if (n && t.dataset.up === 'daily' && !S.dailySaved) await saveDaily(); render(); return; }
    if (t.dataset.cap) { var f = S.files.filter(function (x) { return x.id === t.dataset.cap; })[0]; if (f) { f.caption = t.value.trim(); await DB.put('files', f); toast('บันทึกคำอธิบายแล้ว'); } return; }
    if (t.dataset.dd && S.dailyDraft && t.tagName === 'SELECT') { S.dailyDraft[t.id] = t.value; await saveDaily(); return; }
    if (t.dataset.dp) { await setDailyProgress(t.dataset.dp, S.dailyDraft.date, num(t.value)); t.style.borderColor = 'var(--pri2)'; t.style.fontWeight = '700'; toast('บันทึกผลงาน ' + num(t.value) + '% แล้ว'); return; }
    if (t.dataset.wd === 'final' && S.weekDraft) { S.weekDraft.final = t.checked; await saveWeekly(); return; }
    if (t.dataset.chk || t.dataset.cnote != null) {
      var s = S.submittals.filter(function (x) { return x.id === S.route[3]; })[0]; s.checks = s.checks || {};
      var key = t.dataset.chk || t.dataset.cnote, c = s.checks[key] = s.checks[key] || {};
      if (t.dataset.chk) { c.v = t.value; t.className = 'i v-' + t.value; } else c.note = t.value.trim();
      s.updated = new Date().toISOString(); await DB.put('submittals', s); return;
    }
    if (t.id === 'restoreFile' && t.files[0]) { await doRestore(t.files[0]); t.value = ''; return; }
  } catch (err) { console.error(err); toast(err.message, true); }
});
window.addEventListener('hashchange', function () {
  var pend = [];
  if (_dTimer) { clearTimeout(_dTimer); _dTimer = null; pend.push(saveDaily()); }
  if (_wTimer) { clearTimeout(_wTimer); _wTimer = null; pend.push(saveWeekly()); }
  Promise.all(pend).then(function () { S.dailyDraft = null; S.weekDraft = null; render(); window.scrollTo(0, 0); });
});
$('#brand').addEventListener('click', function () { go('/'); });
$('#installBtn').addEventListener('click', function () { if (S.deferredInstall) { S.deferredInstall.prompt(); S.deferredInstall.userChoice.then(function () { S.deferredInstall = null; $('#installBtn').classList.add('hidden'); }); } });
$('#menuBtn').addEventListener('click', function () {
  var inP = !!S.P, pid = inP ? S.P.id : '';
  var b = function (go_, t) { return '<button class="btn sec" style="width:100%;text-align:left;margin-bottom:6px" ' + go_ + '>' + t + '</button>'; };
  var bg = modal('<h2>เมนู</h2>' + b('data-go="/"', '🏠 ทุกโครงการ') + (inP ? b('data-go="/p/' + pid + '/set"', '⚙️ ตั้งค่าโครงการนี้') + b('data-act="exportXlsx"', '📥 ส่งออก Excel (โครงการนี้)') : '') +
    b('data-act="backup"', '💾 สำรองข้อมูลทั้งหมด') + b('data-go="/app"', '🔧 ตั้งค่าแอป / กู้คืนข้อมูล / ติดตั้ง'));
  bg.addEventListener('click', function (e) { if (e.target.closest('[data-go],[data-act]')) setTimeout(function () { bg.remove(); }, 0); });
});
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.deferredInstall = e; $('#installBtn').classList.remove('hidden'); });
window.addEventListener('appinstalled', function () { S.deferredInstall = null; $('#installBtn').classList.add('hidden'); toast('ติดตั้งแอปแล้ว'); });

/* ---------------- SAMPLE PROJECT ---------------- */
async function createSample() {
  var t0 = today(), start = addDays(t0, -119), sd = function (n) { return iso(addDays(start, n)); };
  var pid = uid(), P = ['งานถมดินและปรับพื้นที่', 'งานก่อสร้างอาคาร', 'งานรางระบายน้ำ', 'งานถนนและลาน', 'งานรั้ว', 'งานโรงจอดรถ'], C = ['งานเตรียมการ', 'งานดิน', 'งานโครงสร้าง', 'งานสถาปัตยกรรม', 'งานระบบ', 'งานภายนอก'];
  var p = { id: pid, name: '(ตัวอย่าง) ก่อสร้างอาคารพร้อมงานภายนอก', type: 'multi', employer: '(ตัวอย่าง) หน่วยงานผู้ว่าจ้าง', contractor: '(ตัวอย่าง) หจก.ผู้รับจ้าง', contract_no: 'ตย. 01/2569',
    contract_date: sd(-7), bac: '24200000', start: iso(start), duration: '300', eot_days: '0', org: '(ตัวอย่าง) กองช่าง', doc_prefix: 'ตย 0001/2569', supervisor_name: 'นายช่างผู้ควบคุมงาน', supervisor_pos: 'ผู้ควบคุมงาน',
    chair: 'ประธานกรรมการตรวจรับ', member1: 'กรรมการ 1', member2: 'กรรมการ 2', parts: P, cats: C, created: new Date().toISOString(), updated: new Date().toISOString() };
  var T = [[0, 0, 'งานเตรียมพื้นที่ รื้อถอน', 350000, 0, 19, 100, 2, 24], [0, 1, 'งานถมดินและบดอัดแน่น', 2400000, 14, 75, 100, 17, 90], [0, 1, 'งานปรับระดับและทดสอบความแน่น', 300000, 70, 91, 80, 88],
    [1, 2, 'งานเสาเข็มอาคาร', 1800000, 92, 136, 35, 99], [1, 2, 'งานฐานราก คานคอดิน พื้นชั้นล่าง', 1500000, 122, 167, 0], [1, 2, 'งานโครงสร้างชั้น 1–2', 3200000, 153, 228, 0],
    [1, 3, 'งานหลังคา', 1100000, 214, 254, 0], [1, 3, 'งานผนังและฉาบปูน', 1600000, 197, 272, 0], [1, 3, 'งานพื้น ฝ้า สี ประตูหน้าต่าง', 2200000, 245, 292, 0], [1, 4, 'งานระบบไฟฟ้า ประปา', 1500000, 183, 287, 0],
    [1, 4, 'ทดสอบระบบและส่งมอบ', 300000, 282, 299, 0], [2, 2, 'งานวางรางระบายน้ำ คสล.', 1300000, 61, 121, 55, 70], [2, 2, 'งานบ่อพักและท่อลอด', 600000, 92, 152, 0],
    [3, 1, 'งานชั้นรองพื้นทาง', 900000, 122, 167, 0], [3, 2, 'งานถนนและลาน คสล.', 2100000, 162, 228, 0], [3, 5, 'งานขอบคันหินและตีเส้น', 250000, 223, 244, 0],
    [4, 2, 'งานฐานรากและเสารั้ว', 700000, 92, 136, 30, 103], [4, 3, 'งานผนังรั้วและประตูรั้ว', 900000, 131, 197, 0], [5, 2, 'งานฐานรากโรงจอดรถ', 450000, 183, 213, 0],
    [5, 3, 'งานหลังคาโรงจอดรถ', 550000, 214, 259, 0], [5, 4, 'งานไฟฟ้าโรงจอดรถ', 200000, 254, 282, 0]];
  var tasks = [], prog = [], now = new Date().toISOString();
  T.forEach(function (x, i) {
    var t = { id: pid + 't' + i, projectId: pid, part: P[x[0]], cat: C[x[1]], desc: x[2], boq: String(x[3]), weight: '', bs: sd(x[4]), bf: sd(x[5]), pct: x[6], order: i + 1, updated: now };
    if (x[6] > 0) {
      t.as = sd(x[7]); if (x[6] >= 100) t.af = sd(x[8]);
      var a = x[7], b = x[6] >= 100 ? x[8] : 119;
      for (var dd = a + 3, k = 0; dd <= b; dd += 4, k++) { var v = Math.min(x[6], Math.round(x[6] * (dd - a) / Math.max(1, b - a))); prog.push({ id: t.id + 'p' + k, projectId: pid, taskId: t.id, date: sd(dd), pct: v, source: 'manual', ts: k }); }
      prog.push({ id: t.id + 'pz', projectId: pid, taskId: t.id, date: sd(b), pct: x[6], source: 'manual', ts: 999 });
    }
    tasks.push(t);
  });
  var pic = function (title, kind) {
    var c = document.createElement('canvas'); c.width = 1200; c.height = 900; var g = c.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, 500); sky.addColorStop(0, '#8fb8e8'); sky.addColorStop(1, '#dbe8f5'); g.fillStyle = sky; g.fillRect(0, 0, 1200, 520);
    g.fillStyle = kind ? '#9a8a70' : '#8a6d4b'; g.fillRect(0, 520, 1200, 380); g.fillStyle = '#b9b9b9';
    if (kind) { g.fillRect(100, 600, 1000, 90); } else { for (var i = 0; i < 6; i++) g.fillRect(170 + i * 160, 380, 40, 230); g.fillStyle = '#e0a020'; g.fillRect(840, 120, 30, 420); g.fillRect(760, 120, 240, 26); }
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 800, 1200, 100); g.fillStyle = '#fff'; g.font = 'bold 40px Tahoma, sans-serif'; g.fillText('ภาพตัวอย่าง: ' + title, 30, 865);
    return new Promise(function (res) { c.toBlob(function (b) { res(b); }, 'image/jpeg', 0.8); });
  };
  var daily = [], files = [];
  for (var k = 5; k >= 0; k--) {
    var d = addDays(t0, -k); if (d.getDay() === 0) continue;
    var rain = k === 3, di = iso(d);
    daily.push({ id: pid + '_' + di, projectId: pid, date: di, weatherAM: rain ? '🌧️ ฝนตกหนัก' : '☀️ แจ่มใส', weatherPM: rain ? '🌦️ ฝนเล็กน้อย' : '⛅ มีเมฆ', status: rain ? 'หยุดงาน (ฝนตก)' : 'ทำงานได้ตามปกติ',
      manpower: rain ? [{ trade: 'โฟร์แมน', count: 1 }] : [{ trade: 'โฟร์แมน', count: 1 }, { trade: 'ช่างเหล็ก', count: 6 }, { trade: 'ช่างปูน', count: 5 }, { trade: 'กรรมกร', count: 14 + k }],
      machinery: rain ? [] : [{ name: 'ปั้นจั่นตอกเข็ม', count: 1 }, { name: 'รถแบ็คโฮ', count: 2 }],
      work: rain ? 'หยุดงานเนื่องจากฝนตกหนัก' : 'ตอกเสาเข็มอาคาร ' + (4 + k) + ' ต้น • วางรางระบายน้ำ คสล. ' + (10 + k * 2) + ' ม. • หล่อฐานรากรั้ว ' + (2 + k % 3) + ' ฐาน',
      materials: k === 2 ? 'เหล็ก DB16 จำนวน 12 ตัน' : '', tests: k === 1 ? 'เก็บตัวอย่างคอนกรีตรางระบายน้ำ 6 ก้อน' : '', issues: k === 1 ? 'ยังไม่ได้รับแบบแก้ไขบ่อพักจากผู้ว่าจ้าง' : '',
      instructions: k === 1 ? 'ให้ผู้รับจ้างเพิ่มชุดทำงานรางระบายน้ำอีก 1 ชุด' : '', updated: now });
    if (!rain && k <= 2) {
      files.push({ id: pid + 'f' + k + 'a', projectId: pid, kind: 'daily', ref: di, caption: 'งานตอกเสาเข็มอาคาร', mime: 'image/jpeg', name: 'pile.jpg', blob: await pic('งานตอกเสาเข็มอาคาร', 0), created: now });
      files.push({ id: pid + 'f' + k + 'b', projectId: pid, kind: 'daily', ref: di, caption: 'งานวางรางระบายน้ำ', mime: 'image/jpeg', name: 'drain.jpg', blob: await pic('งานวางรางระบายน้ำ', 1), created: now });
    }
  }
  files.forEach(function (f) { f.size = f.blob.size; });
  var subs = [{ id: pid + 's1', projectId: pid, doc_no: 'SM-001', material: 'คอนกรีตผสมเสร็จ 240 ksc', brand: '(ตัวอย่าง) ยี่ห้อ A', taskId: pid + 't4', lead_days: '7', spec_sec: '03 31 00', submitted_date: sd(105), status: 'อนุมัติ', approved_date: sd(110), checks: {}, updated: now },
    { id: pid + 's2', projectId: pid, doc_no: 'SM-002', material: 'เหล็กข้ออ้อย SD40', brand: '(ตัวอย่าง) ยี่ห้อ B', taskId: pid + 't4', lead_days: '14', spec_sec: '03 21 00', submitted_date: sd(108), status: 'ขอเอกสารเพิ่มเติม', remark: 'ขอใบ Mill Certificate', checks: {}, updated: now }];
  var cr = criteriaOf(subs[1]); if (cr[0]) subs[1].checks[cr[0].key] = { v: 'ผ่าน', note: 'แคตตาล็อกระบุ มอก. 24 ชั้นคุณภาพ SD40' }; if (cr[1]) subs[1].checks[cr[1].key] = { v: 'ไม่พบข้อมูล', note: 'ไม่มีใบรับรองผลการทดสอบ' };
  await DB.put('projects', p); await DB.putMany('tasks', tasks); await DB.putMany('progress', prog); await DB.putMany('daily', daily); await DB.putMany('files', files); await DB.putMany('submittals', subs);
  toast('สร้างโครงการตัวอย่างแล้ว'); return pid;
}

/* ---------------- START ---------------- */
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || /claudeusercontent|claude\.ai/.test(location.host)) return;
  navigator.serviceWorker.register('sw.js').then(function (reg) {
    reg.addEventListener('updatefound', function () {
      var nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', function () {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          var bn = document.createElement('div'); bn.className = 'toast'; bn.innerHTML = 'มีเวอร์ชันใหม่ <button class="btn sm" id="updNow" style="margin-left:8px">อัปเดต</button>'; document.body.appendChild(bn);
          $('#updNow').onclick = function () { nw.postMessage('skipWaiting'); };
        }
      });
    });
  }).catch(function (e) { console.warn('SW', e); });
  var reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (!reloaded) { reloaded = true; location.reload(); } });
}
(async function start() {
  try { await openDB(); } catch (e) { $('#main').innerHTML = '<div class="card"><h2>เปิดฐานข้อมูลไม่ได้</h2><p>' + esc(e.message) + '</p><p class="muted">ถ้าใช้โหมดไม่ระบุตัวตน (Incognito) ให้เปิดแบบปกติ</p></div>'; return; }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { if (!p) navigator.storage.persist(); }); } catch (e) {}
  registerSW();
  var tries = 0; while (!window.Chart && tries++ < 20) await new Promise(function (r) { setTimeout(r, 50); });
  render();
})();

