# SimCheck — Pendeteksi Kemiripan Tugas Mahasiswa

Plagiarism & Similarity Checker untuk bazar kampus.
Desain Dark Neon Purple — profesional, siap demo.

## Fitur Utama
- **Skor Persentase** — Gabungan Jaccard, Cosine TF-IDF, & N-gram
- **Bagian yang Mirip** — Sorot kalimat & kata yang sama antar dokumen
- **Heatmap Matrix** — Peta panas kemiripan seluruh dokumen
- **Export Detail** — Unduh laporan Excel (.xlsx), PDF, & Word (.docx) — betul bisa diunduh
- **3 Mode Deteksi**:
  - Normal — Seimbang, pengecekan harian
  - Sedang — Lebih sensitif frasa
  - Ketat — Mendeteksi kata per kata
- **Multi-file** — Bandingkan banyak tugas sekaligus
- **Dark / Light Mode**
- **Animasi**: Navbar sticky glass, Sidebar mobile slide, Footer topbar animasi

## Format didukung
- Word (.docx)
- PDF (.pdf)
- TXT / CSV / MD

## Struktur Folder
```
cek_tugas/
  app.py
  requirements.txt
  README.md
  src/
    similarity_engine.py
    exporter.py
  web/
    templates/index.html
    static/css/style.css
    static/js/app.js
  uploads/
  exports/
  assets/
    icon.png / icon.ico / poster_bazar.png
  build_tools/
```

## Install & Jalankan
```bash
pip install -r requirements.txt
python app.py
```
Buka: http://127.0.0.1:5000

## Export Bazar
- Laporan Word via python-docx (benar-benar .docx siap print)
- Excel via pandas+openpyxl
- PDF via reportlab

## Kontak
WhatsApp:
- 0852-4628-7198
- 0821-9684-7193

© 2026 SimCheck — Build Bazar 1.3
