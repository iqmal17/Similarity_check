// SimCheck Frontend — Matcha Elegant Edition (Heatmap Matcha Tuned)
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let selectedFiles = [];
let lastResult = null;

// Theme
const themeToggle = $('#themeToggle');
if(themeToggle){
  themeToggle.onclick = () => {
    const html = document.documentElement;
    const cur = html.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('simcheck_theme', next);
    themeToggle.querySelector('.sun').style.display = next==='dark' ? '' : 'none';
    themeToggle.querySelector('.moon').style.display = next==='dark' ? 'none' : '';
  };
  const saved = localStorage.getItem('simcheck_theme');
  if(saved){ document.documentElement.setAttribute('data-theme', saved); 
    themeToggle.querySelector('.sun').style.display = saved==='dark' ? '' : 'none';
    themeToggle.querySelector('.moon').style.display = saved==='dark' ? 'none' : '';
  }
}

// Navbar scroll effect
window.addEventListener('scroll', ()=>{
  $('#navbar')?.classList.toggle('scrolled', window.scrollY > 10);
  $('#scrollTop')?.classList.toggle('show', window.scrollY > 500);
});
$('#scrollTop')?.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));

// Sidebar
const sidebar = $('#sidebar');
const backdrop = $('#sidebarBackdrop');
$('#hamburger')?.addEventListener('click', ()=>{ sidebar.classList.add('open'); backdrop.classList.add('show'); });
$('#closeSidebar')?.addEventListener('click', closeSide);
backdrop?.addEventListener('click', closeSide);
function closeSide(){ sidebar.classList.remove('open'); backdrop.classList.remove('show'); }
$$('.slink').forEach(a=>a.addEventListener('click', closeSide));

// Upload handling
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const pickBtn = $('#pickBtn');
const fileList = $('#fileList');
const btnAnalyze = $('#btnAnalyze');

pickBtn?.addEventListener('click', ()=> fileInput.click());
fileInput?.addEventListener('change', e => addFiles(e.target.files));

['dragenter','dragover'].forEach(ev=>{
  dropzone?.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.add('dragover'); });
});
['dragleave','drop'].forEach(ev=>{
  dropzone?.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.remove('dragover'); });
});
dropzone?.addEventListener('drop', e=>{
  const files = e.dataTransfer.files;
  addFiles(files);
});

function addFiles(files){
  for(const f of files){
    if(selectedFiles.length >= 20) break;
    // filter duplicates
    if(!selectedFiles.find(x=>x.name===f.name && x.size===f.size)){
      selectedFiles.push(f);
    }
  }
  renderFileList();
}
function renderFileList(){
  fileList.innerHTML = selectedFiles.map((f,i)=>`
    <div class="file-item">
      <div>📄 <b>${escapeHtml(f.name)}</b><br><small>${(f.size/1024).toFixed(1)} KB</small></div>
      <button onclick="removeFile(${i})" style="background:none;border:none;color:#ef7a7a;cursor:pointer;font-weight:700">✕</button>
    </div>
  `).join('') || '<div style="color:var(--muted);text-align:center">Belum ada file.</div>';
  btnAnalyze.disabled = selectedFiles.length < 2;
}
window.removeFile = (i)=>{ selectedFiles.splice(i,1); renderFileList(); };

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Analyze — DIMODIFIKASI dengan Loading Spinner
btnAnalyze?.addEventListener('click', async ()=>{
  if(selectedFiles.length < 2) return alert('Minimal 2 file.');
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'normal';
  const fd = new FormData();
  selectedFiles.forEach(f=> fd.append('files', f));
  fd.append('mode', mode);
  
  // === LOADING SPINNER ===
  btnAnalyze.innerHTML = '<span class="spinner"></span><span class="btn-text">Menganalisis…</span>';
  btnAnalyze.disabled = true;
  btnAnalyze.classList.add('btn-loading');
  
  try{
    const res = await fetch('/analyze', {method:'POST', body:fd});
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'Gagal');
    lastResult = data;
    renderResult(data);
    document.querySelector('#hasil')?.scrollIntoView({behavior:'smooth'});
  }catch(err){
    alert('Error: '+err.message);
  }finally{
    // === KEMBALI KE SEMULA ===
    btnAnalyze.innerHTML = 'Analisis Kemiripan';
    btnAnalyze.disabled = selectedFiles.length < 2;
    btnAnalyze.classList.remove('btn-loading');
  }
});

// Sample
$('#btnSample')?.addEventListener('click', async ()=>{
  const btn = $('#btnSample');
  btn.textContent = 'Memuat contoh…';
  try{
    const res = await fetch('/sample');
    const data = await res.json();
    lastResult = data;
    renderResult(data);
    document.querySelector('#hasil')?.scrollIntoView({behavior:'smooth'});
  }catch(e){ alert(e.message) }
  btn.textContent = '⚡ Coba Contoh';
});

function renderResult(data){
  $('#resultEmpty').style.display='none';
  $('#resultWrap').style.display='block';
  $('#exportBtns').style.display='flex';

  const sum = data.summary;
  $('#summaryCards').innerHTML = `
    <div class="sum-card"><div class="k">Total Dokumen</div><div class="v">${sum.total_docs}</div></div>
    <div class="sum-card"><div class="k">Total Pasangan</div><div class="v">${sum.total_pairs}</div></div>
    <div class="sum-card"><div class="k">Rata-rata</div><div class="v">${sum.average}%</div></div>
    <div class="sum-card"><div class="k">Tertinggi</div><div class="v" style="color:${sum.highest ? (sum.highest.similarity>=70?'#ef7a7a':sum.highest.similarity>=35?'#e0b86a':'#7ed4a8') : 'inherit'}">${sum.highest ? sum.highest.similarity+'%' : '-'}</div></div>
  `;

  const pairsHtml = data.pairs.map(p=>`
    <div class="pair-card reveal">
      <div class="pair-head">
        <div>
          <b>${escapeHtml(p.doc_a)}</b> <span style="color:var(--muted)"> ↔ </span> <b>${escapeHtml(p.doc_b)}</b>
          <div style="font-size:.85rem;color:var(--muted)">Fragmen mirip: ${p.fragments?.length||0} • kata kunci: ${(p.common_words||[]).slice(0,6).join(', ')||'-'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.4rem;font-weight:800">${p.similarity}%</div>
          <span class="badge ${p.level.class}">${p.level.label}</span>
        </div>
      </div>
      ${p.fragments && p.fragments.length ? `
        <div class="fragments">
          ${p.fragments.slice(0,5).map(f=>`
            <div class="frag">
              <div class="sc">Skor ${f.skor}%</div>
              <div class="side"><b>A:</b> ${escapeHtml(f.kalimat_a)}</div>
              <div class="side"><b>B:</b> ${escapeHtml(f.kalimat_b)}</div>
            </div>
          `).join('')}
        </div>` : `<div style="margin-top:10px;color:var(--muted);font-size:.9rem">Tidak ditemukan fragmen signifikan pada ambang mode <b>${data.mode}</b>.</div>`
      }
      ${p.common_words?.length ? `<div class="common-words">Kata sama: ${p.common_words.map(w=>`<code>${escapeHtml(w)}</code>`).join(' • ')}</div>`:''}
    </div>
  `).join('');
  $('#pairList').innerHTML = pairsHtml || '<div class="empty-state">Tidak ada pasangan.</div>';

  drawHeatmap(data.matrix, data.doc_names);
}

// Heatmap – Responsive Desktop / Tablet / Mobile
// - Desktop standar: 440px grid
// - Tablet: auto fit
// - Mobile: compact labels, scroll horizontal jika perlu
function drawHeatmap(matrix, names){
  const canvas = $('#heatmapCanvas');
  const wrap = document.querySelector('.heatmap-wrap');
  if(!canvas || !matrix?.length || !names?.length) return;
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
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,padL+size+padR, padT+size+padB);

  // styles
  const cs = getComputedStyle(document.documentElement);
  const muted = cs.getPropertyValue('--muted').trim() || '#a3a9c2';
  const textCol = cs.getPropertyValue('--text').trim() || '#e9ecf5';

  // left labels
  ctx.fillStyle = muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labelFont = isMobile ? 10 : 11.5;
  ctx.font = `${labelFont}px Inter`;
  names.forEach((name,i)=>{
    const y = padT + i*cell + cell/2;
    const label = trunc(name, isMobile ? 12 : isTablet ? 16 : 20);
    ctx.fillText(label, padL - 7, y);
  });

  // top labels – rotated
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  names.forEach((name,i)=>{
    const x = padL + i*cell + cell/2;
    ctx.save();
    ctx.translate(x, padT - 10);
    ctx.rotate(-Math.PI/4.2);
    ctx.fillStyle = muted;
    ctx.font = `${labelFont}px Inter`;
    ctx.fillText(trunc(name, isMobile ? 10 : 14), 0, 0);
    ctx.restore();
  });
  ctx.restore();

  // grid cells
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){
      const v = matrix[i]?.[j] ?? 0;
      const x = padL + j*cell;
      const y = padT + i*cell;
      ctx.fillStyle = heatColor(v);
      const r = Math.max(4, Math.min(9, cell*0.18));
      roundRect(ctx, x+0.8, y+0.8, cell-1.6, cell-1.6, r);
      ctx.fill();
      // text
      const tc = v < 0.33 ? '#d7ffea' : v < 0.60 ? '#1b1235' : '#ffffff';
      ctx.fillStyle = tc;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fs = Math.max(9, Math.min(13, cell*0.30));
      ctx.font = `700 ${fs}px Inter`;
      ctx.fillText(Math.round(v*100)+'%', x+cell/2, y+cell/2+0.5);
    }
  }

  const empty = document.getElementById('heatmapEmpty');
  if(empty) empty.remove();
}

// rounded rect helper
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

// redraw on resize – debounced
let _hmTimer=null;
window.addEventListener('resize', ()=>{
  if(!lastResult?.matrix) return;
  clearTimeout(_hmTimer);
  _hmTimer = setTimeout(()=> drawHeatmap(lastResult.matrix, lastResult.doc_names), 180);
});

// =============================================
// MATCHA HEATMAP — Soft Green to Dark Matcha
// (Disesuaikan dengan tema Matcha Elegant)
// =============================================
function heatColor(v){
  // v: 0.0 ~ 1.0
  if(v < 0.35) {
    // Krim Matcha / Hijau sangat muda untuk similarity rendah
    return `rgba(212, 232, 209, ${0.20 + v * 1.0})`; // #D4E8D1
  }
  if(v < 0.7) {
    // Matcha Muda / Hijau Sage untuk similarity menengah
    return `rgba(107, 156, 120, ${0.25 + v * 0.85})`; // #6B9C78
  }
  // Matcha Pekat / Hijau Tua untuk similarity tinggi (yang paling mirip)
  return `rgba(47, 77, 59, ${0.35 + v * 0.55})`;     // #2F4D3B
}
// =============================================

function trunc(s,n){ return s.length>n ? s.slice(0,n-1)+'…' : s }

// Export
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-exp]');
  if(!btn || !lastResult) return;
  const fmt = btn.dataset.exp;
  btn.textContent = 'Mempersiapkan…';
  try{
    const res = await fetch('/export/'+fmt, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        result_id: lastResult.result_id,
        pairs: lastResult.pairs,
        matrix: lastResult.matrix,
        doc_names: lastResult.doc_names,
        mode: lastResult.mode
      })
    });
    if(!res.ok) throw new Error('Export gagal');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = fmt==='excel' ? 'xlsx' : fmt==='word' ? 'docx' : 'pdf';
    a.download = `SimCheck_${lastResult.mode}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }catch(err){ alert(err.message) }
  btn.textContent = fmt==='excel' ? 'Excel (.xlsx)' : fmt==='pdf' ? 'PDF' : 'Word (.docx)';
});

// smooth anchor
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const id = a.getAttribute('href');
    const el = document.querySelector(id);
    if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
  });
});

// ============================================
// ANIMASI TAMBAHAN — Scroll Reveal, Typing, Counter, Loading Spinner
// (DITAMBAHKAN TANPA MENGURANGI SATUPUN KODE DI ATAS)
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

// Jalankan typing pada elemen dengan selector .hero-copy h1 (atau sesuaikan)
document.addEventListener('DOMContentLoaded', () => {
  const target = document.querySelector('.hero-copy h1');
  if (target) {
    // Ambil teks asli (jika ada child, ambil textContent)
    const originalText = target.innerText.trim();
    // Kosongkan elemen dan mulai mengetik
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

// Jalankan counter saat elemen dengan [data-counter] terlihat
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