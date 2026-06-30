import os
import sys
import json
import uuid
import tempfile
import threading
import webbrowser
from flask import (Flask, render_template, request, jsonify,
                   send_file, abort)
from werkzeug.utils import secure_filename

# kode sumber ada di folder src/
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))
import similarity_engine as engine
import exporter

def _resource_base():
    """Lokasi file aplikasi. Saat dibundel PyInstaller, file ada di sys._MEIPASS."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS  # folder sementara hasil ekstraksi bundle
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = _resource_base()
TEMPLATE_DIR = os.path.join(BASE_DIR, "web", "templates")
STATIC_DIR = os.path.join(BASE_DIR, "web", "static")

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, "uploads")
app.config['EXPORT_FOLDER'] = os.path.join(BASE_DIR, "exports")
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'txt','pdf','docx','md','csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.',1)[1].lower() in ALLOWED_EXTENSIONS

# simpan hasil analisis sementara
RESULT_CACHE = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/icon.png')
def icon_png():
    icon_path = os.path.join(BASE_DIR, "assets", "icon.png")
    if os.path.exists(icon_path):
        return send_file(icon_path, mimetype='image/png')
    abort(404)

@app.route('/analyze', methods=['POST'])
def analyze():
    mode = request.form.get('mode', 'normal').lower()
    if mode not in ['normal','sedang','ketat']:
        mode = 'normal'
    files = request.files.getlist('files')
    if len(files) < 2:
        return jsonify({'ok':False, 'error':'Minimal unggah 2 dokumen untuk dibandingkan.'}), 400

    saved_docs = []
    for f in files[:20]:  # batasi 20 file
        if f and allowed_file(f.filename):
            filename = secure_filename(f.filename)
            unique = f"{uuid.uuid4().hex[:8]}_{filename}"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique)
            f.save(save_path)
            text = engine.extract_text(save_path)
            saved_docs.append({
                'name': filename,
                'path': save_path,
                'text': text,
                'chars': len(text),
                'words': len(text.split())
            })

    if len(saved_docs) < 2:
        return jsonify({'ok':False, 'error':'File tidak terbaca atau format tidak didukung.'}), 400

    # filter dokumen kosong
    valid_docs = [d for d in saved_docs if d['chars'] > 30]
    if len(valid_docs) < 2:
        return jsonify({'ok':False, 'error':'Dokumen terlalu pendek / kosong.'}), 400

    matrix, pairs = engine.analyze_documents(valid_docs, mode=mode)
    doc_names = [d['name'] for d in valid_docs]

    result_id = uuid.uuid4().hex
    RESULT_CACHE[result_id] = {
        'mode': mode,
        'matrix': matrix,
        'pairs': pairs,
        'doc_names': doc_names,
        'docs_meta': [{'name':d['name'], 'words':d['words'], 'chars':d['chars']} for d in valid_docs]
    }

    # ringkasan cepat
    if pairs:
        top = pairs[0]
        avg = round(sum(p['similarity'] for p in pairs)/len(pairs),2)
    else:
        top = None
        avg = 0

    return jsonify({
        'ok': True,
        'result_id': result_id,
        'mode': mode,
        'documents': RESULT_CACHE[result_id]['docs_meta'],
        'doc_names': doc_names,
        'matrix': matrix,
        'pairs': pairs,
        'summary': {
            'total_docs': len(valid_docs),
            'total_pairs': len(pairs),
            'highest': top,
            'average': avg
        }
    })

@app.route('/export/<fmt>', methods=['POST'])
def export_fmt(fmt):
    data = request.get_json()
    if not data:
        return jsonify({'ok':False, 'error':'No data'}), 400
    result_id = data.get('result_id')
    if result_id and result_id in RESULT_CACHE:
        cached = RESULT_CACHE[result_id]
        pairs = cached['pairs']
        matrix = cached['matrix']
        doc_names = cached['doc_names']
        mode = cached['mode']
    else:
        pairs = data.get('pairs', [])
        matrix = data.get('matrix', [])
        doc_names = data.get('doc_names', [])
        mode = data.get('mode', 'normal')

    if not pairs:
        return jsonify({'ok':False, 'error':'Tidak ada data untuk diekspor'}), 400

    ts = uuid.uuid4().hex[:8]
    if fmt == 'excel':
        out_path = os.path.join(app.config['EXPORT_FOLDER'], f"SimCheck_{mode}_{ts}.xlsx")
        exporter.export_excel(pairs, matrix, doc_names, out_path)
        return send_file(out_path, as_attachment=True, download_name=os.path.basename(out_path))
    elif fmt == 'word':
        out_path = os.path.join(app.config['EXPORT_FOLDER'], f"SimCheck_{mode}_{ts}.docx")
        exporter.export_word(pairs, matrix, doc_names, mode, out_path)
        return send_file(out_path, as_attachment=True, download_name=os.path.basename(out_path),
                         mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    elif fmt == 'pdf':
        out_path = os.path.join(app.config['EXPORT_FOLDER'], f"SimCheck_{mode}_{ts}.pdf")
        exporter.export_pdf(pairs, matrix, doc_names, mode, out_path)
        return send_file(out_path, as_attachment=True, download_name=os.path.basename(out_path), mimetype='application/pdf')
    else:
        abort(404)

@app.route('/sample', methods=['GET'])
def sample():
    """Coba contoh – mengembalikan data dummy analisis"""
    doc_names = ["Tugas_Andi.docx", "Tugas_Budi.docx", "Tugas_Citra.pdf"]
    matrix = [
        [1.0, 0.82, 0.12],
        [0.82, 1.0, 0.15],
        [0.12, 0.15, 1.0]
    ]
    pairs = [
        {
            'doc_a':'Tugas_Andi.docx','doc_b':'Tugas_Budi.docx','idx_a':0,'idx_b':1,
            'similarity':82.4,'level':{'label':'Mirip Tinggi','color':'high','class':'high'},
            'fragments':[
                {'kalimat_a':'Pemanasan global adalah peningkatan suhu rata-rata atmosfer bumi yang disebabkan oleh efek rumah kaca.','kalimat_b':'Pemanasan global adalah peningkatan suhu rata-rata atmosfer yang disebabkan efek rumah kaca.','skor':94.2,'index_a':0},
                {'kalimat_a':'Algoritma KNN bekerja dengan menghitung jarak terdekat antar data.','kalimat_b':'Algoritma KNN bekerja menghitung jarak terdekat antara data training.','skor':88.1,'index_a':3}
            ],
            'common_words':['pemanasan','global','algoritma','data','suhu','atmosfer']
        },
        {
            'doc_a':'Tugas_Budi.docx','doc_b':'Tugas_Citra.pdf','idx_a':1,'idx_b':2,
            'similarity':15.3,'level':{'label':'Rendah','color':'low','class':'low'},
            'fragments':[],
            'common_words':['data','analisis']
        },
        {
            'doc_a':'Tugas_Andi.docx','doc_b':'Tugas_Citra.pdf','idx_a':0,'idx_b':2,
            'similarity':12.1,'level':{'label':'Rendah','color':'low','class':'low'},
            'fragments':[],
            'common_words':['metode']
        }
    ]
    result_id = 'sample_'+uuid.uuid4().hex[:6]
    RESULT_CACHE[result_id] = {'mode':'sedang','matrix':matrix,'pairs':pairs,'doc_names':doc_names,'docs_meta':[{'name':n,'words':420,'chars':2850} for n in doc_names]}
    return jsonify({'ok':True,'result_id':result_id,'mode':'sedang','doc_names':doc_names,'matrix':matrix,'pairs':pairs,'documents':RESULT_CACHE[result_id]['docs_meta'],
        'summary':{'total_docs':3,'total_pairs':3,'highest':pairs[0],'average':36.6}})

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")

if __name__ == '__main__':
    print("  SimCheck - Pendeteksi Kemiripan Tugas")
    print("  Server berjalan di:  http://127.0.0.1:5000")
    print("  Browser akan terbuka otomatis...")
    print("  (Tutup jendela ini untuk menghentikan aplikasi)")
    print("="*60)
    threading.Timer(1.2, open_browser).start()
    app.run(host='127.0.0.1', port=5000, debug=True)
