# SimCheck - similarity_engine.py
# Pendeteksi Kemiripan Tugas Mahasiswa
import re
import os
from collections import Counter

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

def extract_text(filepath):
    """Ekstrak teks dari berbagai format: .docx, .pdf, .txt, .md, .csv"""
    ext = os.path.splitext(filepath)[1].lower()
    text = ""
    try:
        if ext == '.docx':
            try:
                from docx import Document
                doc = Document(filepath)
                text = "\n".join([p.text for p in doc.paragraphs])
            except Exception:
                text = ""
        elif ext == '.pdf':
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(filepath)
                pages = []
                for page in reader.pages:
                    pages.append(page.extract_text() or "")
                text = "\n".join(pages)
            except Exception:
                text = ""
        elif ext in ['.txt', '.md', '.csv']:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
        else:
            # fallback coba baca sebagai txt
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
    except Exception as e:
        text = ""
    return text.strip()

def preprocess(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\u00C0-\u024f\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def tokenize(text):
    return preprocess(text).split()

def jaccard_similarity(a, b):
    set_a = set(tokenize(a))
    set_b = set(tokenize(b))
    if not set_a and not set_b:
        return 0.0
    inter = len(set_a & set_b)
    union = len(set_a | set_b)
    return inter / union if union else 0.0

def ngram_tokens(text, n=3):
    tokens = tokenize(text)
    if len(tokens) < n:
        return set([' '.join(tokens)]) if tokens else set()
    return set([' '.join(tokens[i:i+n]) for i in range(len(tokens)-n+1)])

def ngram_similarity(a, b, n=3):
    ga = ngram_tokens(a, n)
    gb = ngram_tokens(b, n)
    if not ga and not gb:
        return 0.0
    inter = len(ga & gb)
    union = len(ga | gb)
    return inter / union if union else 0.0

def cosine_tfidf(a, b):
    if not SKLEARN_AVAILABLE:
        # fallback simple cosine
        ta = Counter(tokenize(a))
        tb = Counter(tokenize(b))
        all_keys = set(ta.keys()) | set(tb.keys())
        va = [ta.get(k,0) for k in all_keys]
        vb = [tb.get(k,0) for k in all_keys]
        dot = sum(x*y for x,y in zip(va,vb))
        na = sum(x*x for x in va) ** 0.5
        nb = sum(x*x for x in vb) ** 0.5
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na*nb)
    try:
        vec = TfidfVectorizer().fit_transform([a, b])
        sim = cosine_similarity(vec[0:1], vec[1:2])[0][0]
        return float(sim)
    except:
        return 0.0

def split_sentences(text):
    # pecah kalimat sederhana Indonesia
    sents = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sents if len(s.strip()) > 10]

def find_similar_fragments(text_a, text_b, threshold=0.55, mode='normal'):
    # mode mempengaruhi threshold
    mode_thresh = {'normal': threshold, 'sedang': threshold-0.08, 'ketat': threshold-0.15}
    th = max(0.25, mode_thresh.get(mode, threshold))
    sa = split_sentences(text_a)
    sb = split_sentences(text_b)
    matches = []
    # batasi agar tidak berat
    sa = sa[:120]
    sb = sb[:120]
    for i, a in enumerate(sa):
        best = (0, "")
        pa = preprocess(a)
        if len(pa) < 15: 
            continue
        for b in sb:
            pb = preprocess(b)
            if abs(len(pa)-len(pb)) > 80:
                continue
            # cepat: jaccard kata
            ja = jaccard_similarity(pa, pb)
            if ja < th - 0.15:
                continue
            co = cosine_tfidf(pa, pb)
            score = 0.6*co + 0.4*ja
            if score > best[0]:
                best = (score, b)
        if best[0] >= th:
            matches.append({
                'kalimat_a': a,
                'kalimat_b': best[1],
                'skor': round(best[0]*100,1),
                'index_a': i
            })
    # urutkan top
    matches.sort(key=lambda x: x['skor'], reverse=True)
    return matches[:25]

MODE_CONFIG = {
    'normal': {'w_cos':0.45, 'w_jac':0.30, 'w_ng':0.25, 'boost':1.0, 'label':'Normal'},
    'sedang': {'w_cos':0.40, 'w_jac':0.30, 'w_ng':0.30, 'boost':1.12, 'label':'Sedang'},
    'ketat' : {'w_cos':0.35, 'w_jac':0.25, 'w_ng':0.40, 'boost':1.25, 'label':'Ketat'}
}

def compute_pair_score(text_a, text_b, mode='normal'):
    cfg = MODE_CONFIG.get(mode, MODE_CONFIG['normal'])
    a = preprocess(text_a)
    b = preprocess(text_b)
    if not a or not b:
        return 0.0
    cos = cosine_tfidf(a, b)
    jac = jaccard_similarity(a, b)
    ng = ngram_similarity(a, b, 3)
    score = cfg['w_cos']*cos + cfg['w_jac']*jac + cfg['w_ng']*ng
    score *= cfg['boost']
    return min(1.0, max(0.0, score))

def analyze_documents(documents, mode='normal'):
    """
    documents: list of {'name':..., 'text':..., 'path':...}
    return matrix, pairs
    """
    n = len(documents)
    matrix = [[0.0]*n for _ in range(n)]
    pairs = []
    for i in range(n):
        matrix[i][i] = 1.0
        for j in range(i+1, n):
            score = compute_pair_score(documents[i]['text'], documents[j]['text'], mode)
            matrix[i][j] = matrix[j][i] = round(score, 4)
            frag = find_similar_fragments(documents[i]['text'], documents[j]['text'], mode=mode)
            pairs.append({
                'doc_a': documents[i]['name'],
                'doc_b': documents[j]['name'],
                'idx_a': i,
                'idx_b': j,
                'similarity': round(score*100,2),
                'level': similarity_level(score*100),
                'fragments': frag,
                'common_words': get_common_words(documents[i]['text'], documents[j]['text'])
            })
    # sort pairs desc
    pairs.sort(key=lambda x: x['similarity'], reverse=True)
    return matrix, pairs

def similarity_level(pct):
    if pct >= 70: return {'label':'Mirip Tinggi','color':'high','class':'high'}
    if pct >= 35: return {'label':'Sedang','color':'medium','class':'medium'}
    return {'label':'Rendah','color':'low','class':'low'}

def get_common_words(a, b, top=20):
    ta = Counter(tokenize(a))
    tb = Counter(tokenize(b))
    common = set(ta.keys()) & set(tb.keys())
    # filter stopwords sederhana
    stop = set(['dan','yang','di','ke','dari','dengan','untuk','pada','adalah','ini','itu','atau','sebagai','dalam','akan','dapat','tidak','juga','oleh','karena','the','of','to','and','in','a','is','are'])
    common = [w for w in common if w not in stop and len(w)>3]
    scored = [(w, min(ta[w], tb[w])) for w in common]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [w for w,_ in scored[:top]]
