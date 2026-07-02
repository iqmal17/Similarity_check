// SimCheck Frontend — Matcha Elegant Edition (Heatmap Matcha Tuned)
// + Fitur: Riwayat Analisis (localStorage) & Hapus Riwayat
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let selectedFiles = [];
let lastResult = null;

const HISTORY_KEY = 'simcheck_history_v1';
const HISTORY_MAX = 20; // batas jumlah riwayat yang disimpan

// ============================================
// THEME
// ============================================
const themeToggle = $('#themeToggle');
if (themeToggle) {
  themeToggle.onclick = () => {
    const html = document.documentElement;
    const cur = html.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('simcheck_theme', next);
    themeToggle.querySelector('.sun').style.display = next === 'dark' ? '' : 'none';
    themeToggle.querySelector('.moon').style.display = next === 'dark' ? 'none' : '';
  };
  const saved = localStorage.getItem('simcheck_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.querySelector('.sun').style.display = saved === 'dark' ? '' : 'none';
    themeToggle.querySelector('.moon').style.display = saved === 'dark' ? 'none' : '';
  }
}

// ============================================
// NAVBAR SCROLL EFFECT
// ============================================
window.addEventListener('scroll', () => {
  $('#navbar')?.classList.toggle('scrolled', window.scrollY > 10);
  $('#scrollTop')?.classList.toggle('show', window.scrollY > 500);
});
$('#scrollTop')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ============================================
// SIDEBAR
// ============================================
const sidebar = $('#sidebar');
const backdrop = $('#sidebarBackdrop');
$('#hamburger')?.addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('show'); });
$('#closeSidebar')?.addEventListener('click', closeSide);
backdrop?.addEventListener('click', closeSide);
function closeSide() { sidebar.classList.remove('open'); backdrop.classList.remove('show'); }
$$('.slink').forEach(a => a.addEventListener('click', closeSide));

// ============================================
// UPLOAD HANDLING
// ============================================
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const pickBtn = $('#pickBtn');
const fileList = $('#fileList');
const btnAnalyze = $('#btnAnalyze');

pickBtn?.addEventListener('click', () => fileInput.click());
fileInput?.addEventListener('change', e => addFiles(e.target.files));

['dragenter', 'dragover'].forEach(ev => {
  dropzone?.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(ev => {
  dropzone?.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('dragover'); });
});
dropzone?.addEventListener('drop', e => {
  const files = e.dataTransfer.files;
  addFiles(files);
});

function addFiles(files) {
  for (const f of files) {
    if (selectedFiles.length >= 20) break;
    // filter duplikat
    if (!selectedFiles.find(x => x.name === f.name && x.size === f.size)) {
      selectedFiles.push(f);
    }
  }
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = selectedFiles.map((f, i) => `
    <div class="file-item">
      <div>📄 <b>${escapeHtml(f.name)}</b><br><small>${(f.size / 1024).toFixed(1)} KB</small></div>
      <button onclick="removeFile(${i})" style="background:none;border:none;color:#ef7a7a;cursor:pointer;font-weight:700">✕</button>
    </div>
  `).join('') || '<div style="color:var(--muted);text-align:center">Belum ada file.</div>';
  btnAnalyze.disabled = selectedFiles.length < 2;
}
window.removeFile = (i) => { selectedFiles.splice(i, 1); renderFileList(); };

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ============================================
// ANALYZE — dengan Loading Spinner + simpan ke riwayat
// ============================================
btnAnalyze?.addEventListener('click', async () => {
  if (selectedFiles.length < 2) return alert('Minimal 2 file.');
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'normal';
  const fd = new FormData();
  selectedFiles.forEach(f => fd.append('files', f));
  fd.append('mode', mode);

  // === LOADING SPINNER ===
  btnAnalyze.innerHTML = '<span class="spinner"></span><span class="btn-text">Menganalisis…</span>';
  btnAnalyze.disabled = true;
  btnAnalyze.classList.add('btn-loading');

  try {
    const res = await fetch('/analyze', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Gagal');
    lastResult = data;
    renderResult(data);
    saveToHistory(data);
    document.querySelector('#hasil')?.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    // === KEMBALI KE SEMULA ===
    btnAnalyze.innerHTML = 'Analisis Kemiripan';
    btnAnalyze.disabled = selectedFiles.length < 2;
    btnAnalyze.classList.remove('btn-loading');
  }
});

// ============================================
// SAMPLE
// ============================================
$('#btnSample')?.addEventListener('click', async () => {
  const btn = $('#btnSample');
  btn.textContent = 'Memuat contoh…';
  try {
    const res = await fetch('/sample');
    const data = await res.json();
    lastResult = data;
    renderResult(data);
    saveToHistory(data);
    document.querySelector('#hasil')?.scrollIntoView({ behavior: 'smooth' });
  } catch (e) { alert(e.message) }
  btn.textContent = '⚡ Coba Contoh';
});

// ============================================
// RENDER RESULT
// ============================================
function renderResult(data) {
  $('#resultEmpty').style.display = 'none';
  $('#resultWrap').style.display = 'block';
  $('#exportBtns').style.display = 'flex';

  const sum = data.summary;
  $('#summaryCards').innerHTML = `
    <div class="sum-card"><div class="k">Total Dokumen</div><div class="v">${sum.total_docs}</div></div>
    <div class="sum-card"><div class="k">Total Pasangan</div><div class="v">${sum.total_pairs}</div></div>
    <div class="sum-card"><div class="k">Rata-rata</div><div class="v">${sum.average}%</div></div>
    <div class="sum-card"><div class="k">Tertinggi</div><div class="v" style="color:${sum.highest ? (sum.highest.similarity >= 70 ? '#ef7a7a' : sum.highest.similarity >= 35 ? '#e0b86a' : '#7ed4a8') : 'inherit'}">${sum.highest ? sum.highest.similarity + '%' : '-'}</div></div>
  `;

  const pairsHtml = data.pairs.map(p => `
    <div class="pair-card reveal">
      <div class="pair-head">
        <div>
          <b>${escapeHtml(p.doc_a)}</b> <span style="color:var(--muted)"> ↔ </span> <b>${escapeHtml(p.doc_b)}</b>
          <div style="font-size:.85rem;color:var(--muted)">Fragmen mirip: ${p.fragments?.length || 0} • kata kunci: ${(p.common_words || []).slice(0, 6).join(', ') || '-'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.4rem;font-weight:800">${p.similarity}%</div>
          <span class="badge ${p.level.class}">${p.level.label}</span>
        </div>
      </div>
      ${p.fragments && p.fragments.length ? `
        <div class="fragments">
          ${p.fragments.slice(0, 5).map(f => `
            <div class="frag">
              <div class="sc">Skor ${f.skor}%</div>
              <div class="side"><b>A:</b> ${escapeHtml(f.kalimat_a)}</div>
              <div class="side"><b>B:</b> ${escapeHtml(f.kalimat_b)}</div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="margin-top:10px;color:var(--muted);font-size:.9rem">Tidak ditemukan fragmen signifikan pada ambang mode <b>${data.mode}</b>.</div>
      `}
      ${p.common_words?.length ? `<div class="common-words">Kata sama: ${p.common_words.map(w => `<code>${escapeHtml(w)}</code>`).join(' • ')}</div>` : ''}
    </div>
  `).join('');
  $('#pairList').innerHTML = pairsHtml || '<div class="empty-state">Tidak ada pasangan.</div>';

  drawHeatmap(data.matrix, data.doc_names);
}

// ============================================
// HEATMAP – Responsive Desktop / Tablet / Mobile
// ============================================
function drawHeatmap(matrix, names) {
  const canvas = $('#heatmapCanvas');
  const wrap = document.querySelector('.heatmap-wrap');
  if (!canvas || !matrix?.length || !names?.length) return;
  const ctx = canvas.getContext('2d');
  const n = Math.max(1, names.length);

  // --- responsive sizing ---
  const wrapW = wrap ? wrap.clientWidth - 36 : 720; // padding .heatmap-wrap = 18*2
  const vw = window.innerWidth;
  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 980;

  // label area & top padding adaptif
  const padL = isMobile ? 86 : isTablet ? 110 : 128;
  const padT = isMobile ? 56 : 48;
  const padR = isMobile ? 10 : 20;
  const padB = 14;

  // grid size standar desktop
  let maxGrid = isMobile ? Math.min(300, wrapW - padL - padR)
    : isTablet ? Math.min(420, wrapW - padL - padR)
    : Math.min(440, wrapW - padL - padR);

  // kalau dokumen banyak, tetap muat – minimal cell 28px mobile / 34px desktop
  const minCell = isMobile ? 28 : 34;
  const needed = n * minCell;
  if (needed > maxGrid) maxGrid = Math.min(needed, wrapW - padL - padR);
  maxGrid = Math.max(180, maxGrid);

  const size = Math.round(maxGrid);
  const cell = size / n;

  // set canvas dengan DPR scaling biar tajam
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = (padL + size + padR) + 'px';
  canvas.style.height = (padT + size + padB) + 'px';
  canvas.width = Math.round((padL + size + padR) * dpr);
  canvas.height = Math.round((padT + size + padB) * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, padL + size + padR, padT + size + padB);

  // styles
  const cs = getComputedStyle(document.documentElement);
  const muted = cs.getPropertyValue('--muted').trim() || '#a3a9c2';

  // left labels
  ctx.fillStyle = muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labelFont = isMobile ? 10 : 11.5;
  ctx.font = `${labelFont}px Inter`;
  names.forEach((name, i) => {
    const y = padT + i * cell + cell / 2;
    const label = trunc(name, isMobile ? 12 : isTablet ? 16 : 20);
    ctx.fillText(label, padL - 7, y);
  });

  // top labels – rotated
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  names.forEach((name, i) => {
    const x = padL + i * cell + cell / 2;
    ctx.save();
    ctx.translate(x, padT - 10);
    ctx.rotate(-Math.PI / 4.2);
    ctx.fillStyle = muted;
    ctx.font = `${labelFont}px Inter`;
    ctx.fillText(trunc(name, isMobile ? 10 : 14), 0, 0);
    ctx.restore();
  });
  ctx.restore();

  // grid cells
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = matrix[i]?.[j] ?? 0;
      const x = padL + j * cell;
      const y = padT + i * cell;
      ctx.fillStyle = heatColor(v);
      const r = Math.max(4, Math.min(9, cell * 0.18));
      roundRect(ctx, x + 0.8, y + 0.8, cell - 1.6, cell - 1.6, r);
      ctx.fill();
      // text
      const tc = v < 0.33 ? '#d7ffea' : v < 0.60 ? '#1b1235' : '#ffffff';
      ctx.fillStyle = tc;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fs = Math.max(9, Math.min(13, cell * 0.30));
      ctx.font = `700 ${fs}px Inter`;
      ctx.fillText(Math.round(v * 100) + '%', x + cell / 2, y + cell / 2 + 0.5);
    }
  }

  const empty = document.getElementById('heatmapEmpty');
  if (empty) empty.remove();
}

// rounded rect helper
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// redraw on resize – debounced
let hmTimer = null;
window.addEventListener('resize', () => {
  if (!lastResult?.matrix) return;
  clearTimeout(hmTimer);
  hmTimer = setTimeout(() => drawHeatmap(lastResult.matrix, lastResult.doc_names), 180);
});

// =============================================
// MATCHA HEATMAP — Soft Green to Dark Matcha
// =============================================
function heatColor(v) {
  // v: 0.0 ~ 1.0
  if (v < 0.35) {
    // Krim Matcha / Hijau sangat muda untuk similarity rendah
    return `rgba(212, 232, 209, ${0.20 + v * 1.0})`; // #D4E8D1
  }
  if (v < 0.7) {
    // Matcha Muda / Hijau Sage untuk similarity menengah
    return `rgba(107, 156, 120, ${0.25 + v * 0.85})`; // #6B9C78
  }
  // Matcha Pekat / Hijau Tua untuk similarity tinggi (yang paling mirip)
  return `rgba(47, 77, 59, ${0.35 + v * 0.55})`; // #2F4D3B
}

function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s }

// ============================================
// EXPORT
// ============================================
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-exp]');
  if (!btn || !lastResult) return;
  const fmt = btn.dataset.exp;
  btn.textContent = 'Mempersiapkan…';
  try {
    const res = await fetch('/export/' + fmt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result_id: lastResult.result_id,
        pairs: lastResult.pairs,
        matrix: lastResult.matrix,
        doc_names: lastResult.doc_names,
        mode: lastResult.mode
      })
    });
    if (!res.ok) throw new Error('Export gagal');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = fmt === 'excel' ? 'xlsx' : fmt === 'word' ? 'docx' : 'pdf';
    a.download = `SimCheck_${lastResult.mode}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) { alert(err.message) }
  btn.textContent = fmt === 'excel' ? 'Excel (.xlsx)' : fmt === 'pdf' ? 'PDF' : 'Word (.docx)';
});

// smooth anchor
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = document.querySelector(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// ============================================
// RIWAYAT ANALISIS (localStorage) + HAPUS RIWAYAT
// ============================================

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

// Simpan hasil analisis baru ke riwayat (ditaruh paling atas)
function saveToHistory(data) {
  const list = loadHistory();
  const entry = {
    id: data.result_id || ('h_' + Date.now()),
    date: new Date().toISOString(),
    mode: data.mode,
    doc_names: data.doc_names,
    matrix: data.matrix,
    pairs: data.pairs,
    summary: data.summary
  };
  list.unshift(entry);
  if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
  persistHistory(list);
  renderHistoryList();
}

// Hapus satu item riwayat berdasarkan id
function deleteHistoryItem(id) {
  const list = loadHistory().filter(h => h.id !== id);
  persistHistory(list);
  renderHistoryList();
}

// Hapus SEMUA riwayat
function clearAllHistory() {
  if (!confirm('Yakin ingin menghapus semua riwayat analisis? Tindakan ini tidak bisa dibatalkan.')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistoryList();
}
window.clearAllHistory = clearAllHistory;
window.deleteHistoryItem = deleteHistoryItem;

// Buka kembali salah satu hasil riwayat
window.loadHistoryItem = function (id) {
  const item = loadHistory().find(h => h.id === id);
  if (!item) return;
  lastResult = item;
  renderResult(item);
  document.querySelector('#hasil')?.scrollIntoView({ behavior: 'smooth' });
};

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// Render daftar riwayat ke section #riwayat (#riwayatList / #riwayatEmpty).
// Kalau markup itu belum ada di HTML, fallback: buat panel ringan di dalam sidebar.
function renderHistoryList() {
  const list = loadHistory();
  const listEl = document.getElementById('riwayatList');
  const emptyEl = document.getElementById('riwayatEmpty');

  if (listEl) {
    if (emptyEl) emptyEl.style.display = list.length ? 'none' : 'block';
    listEl.innerHTML = list.map(h => `
      <div class="pair-card">
        <div class="pair-head">
          <div style="cursor:pointer;flex:1;min-width:0;" onclick="loadHistoryItem('${h.id}')">
            <b>${escapeHtml((h.doc_names || []).slice(0, 2).join(', '))}${(h.doc_names || []).length > 2 ? ` +${h.doc_names.length - 2} lainnya` : ''}</b>
            <div style="font-size:.85rem;color:var(--muted)">${fmtDate(h.date)} • mode: ${escapeHtml(h.mode || '-')}</div>
          </div>
          <div style="text-align:right;display:flex;align-items:center;gap:12px">
            <div>
              <div style="font-size:1.2rem;font-weight:800">${h.summary?.average ?? '-'}%</div>
              <span style="font-size:.75rem;color:var(--muted)">rata-rata</span>
            </div>
            <button onclick="deleteHistoryItem('${h.id}')" title="Hapus riwayat ini"
              style="background:none;border:none;color:#ef7a7a;cursor:pointer;font-weight:700;font-size:1.1rem;">✕</button>
          </div>
        </div>
      </div>
    `).join('');
    return;
  }

  // Fallback jika elemen #riwayatList belum ada di HTML
  let panel = document.getElementById('historyPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'historyPanel';
    panel.style.cssText = 'padding:16px;border-top:1px solid var(--border,rgba(0,0,0,.08));margin-top:12px;';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <b style="font-size:.95rem;">🕘 Riwayat Analisis</b>
        <button id="btnClearHistoryFallback" title="Hapus Semua Riwayat"
          style="background:none;border:1px solid #ef7a7a;color:#ef7a7a;border-radius:8px;padding:4px 10px;font-size:.78rem;cursor:pointer;font-weight:600;">
          Hapus Semua Riwayat
        </button>
      </div>
      <div id="historyListFallback" style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto;"></div>
    `;
    const host = document.getElementById('sidebar') || document.body;
    host.appendChild(panel);
    document.getElementById('btnClearHistoryFallback').addEventListener('click', clearAllHistory);
  }
  const fbEl = document.getElementById('historyListFallback');
  if (fbEl) {
    fbEl.innerHTML = list.length ? list.map(h => `
      <div style="border:1px solid var(--border,rgba(0,0,0,.08));border-radius:10px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="cursor:pointer;flex:1;min-width:0;" onclick="loadHistoryItem('${h.id}')">
          <div style="font-weight:700;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml((h.doc_names || []).slice(0, 2).join(', '))}${(h.doc_names || []).length > 2 ? ` +${h.doc_names.length - 2} lainnya` : ''}
          </div>
          <div style="font-size:.75rem;color:var(--muted);">${fmtDate(h.date)} • mode: ${escapeHtml(h.mode || '-')} • rata-rata ${h.summary?.average ?? '-'}%</div>
        </div>
        <button onclick="deleteHistoryItem('${h.id}')" title="Hapus riwayat ini"
          style="background:none;border:none;color:#ef7a7a;cursor:pointer;font-weight:700;flex-shrink:0;">✕</button>
      </div>
    `).join('') : '<div style="color:var(--muted);font-size:.85rem;text-align:center;padding:8px 0;">Belum ada riwayat analisis.</div>';
  }
}

document.getElementById && document.addEventListener('DOMContentLoaded', () => {
  renderHistoryList();
  document.getElementById('btnClearHistory')?.addEventListener('click', clearAllHistory);
});

// ============================================
// ANIMASI TAMBAHAN — Scroll Reveal, Typing, Counter, Loading Spinner
// ============================================

// ——— 1. SCROLL REVEAL (Intersection Observer) ———
document.addEventListener('DOMContentLoaded', () => {
  const els = document.querySelectorAll('.reveal-scroll');
  if (!els.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // stop observing after reveal
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });
  els.forEach(el => observer.observe(el));
});

// ——— 2. TYPING EFFECT ———
function typeWriter(element, text, speed = 55) {
  if (!element) return;
  let i = 0;
  element.textContent = '';
  element.classList.add('typing-cursor');
  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    } else {
      element.classList.remove('typing-cursor');
    }
  }
  type();
}

document.addEventListener('DOMContentLoaded', () => {
  const target = document.querySelector('.hero-copy h1');
  if (target) {
    const originalText = target.innerText.trim();
    typeWriter(target, originalText);
  }
});

// ——— 3. COUNTER ANIMATION (Count Up) ———
function animateCounter(el, target, duration = 1500) {
  const start = 0;
  const startTime = performance.now();
  const isFloat = target % 1 !== 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutQuart
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;

    if (isFloat) {
      el.textContent = current.toFixed(1) + '%';
    } else {
      el.textContent = Math.round(current);
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = isFloat ? target + '%' : target;
    }
  }
  requestAnimationFrame(update);
}

document.addEventListener('DOMContentLoaded', () => {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.counter);
        if (!isNaN(target)) {
          animateCounter(el, target);
        }
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
});
