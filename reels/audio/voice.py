"""Ustoz ovozini tozalaydi va gaplarga ajratadi (premium reels uchun).
  python3 design/audio/voice.py voice.ogg script.txt out_dir
Natija: out_dir/voice.wav (toza, pauzalar qisqartirilgan), out_dir/voice.json:
  {"dur": soniya, "words": [[söz, boşi, oxiri], ...], "lines": [qator boşlanişi, ...]}
Tekislash: pocketsphinx (pip install pocketsphinx); yo'q bo'lsa jimlik böyiça taxminiy.
"""
import sys, json, re, subprocess, os
src, script, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
TEMPO = float(os.environ.get('TEMPO', '1.06'))   # bir oz jonliroq
GAP, KEEP, LINE_KEEP, PAD = 0.22, 0.14, 0.30, 0.10
# studiya zanjiri: past gul-gul (rumble) olinadi, shovqin, "bo'g'iq" 250 Hz kesiladi, aniqlik (3-7 kHz) va havo qo'shiladi,
# sibilyant yumşatiladi, kompressor bilan bir tekis, oxirida limiter
CHAIN = ("highpass=f=85,highpass=f=85,afftdn=nf=-42:nr=8:tn=1,equalizer=f=220:t=q:w=1.1:g=-4,equalizer=f=500:t=q:w=1.4:g=-1.5,"
         "equalizer=f=3400:t=q:w=1.3:g=4,equalizer=f=6800:t=q:w=1.4:g=2.5,highshelf=f=10000:g=2,deesser=i=0.35,"
         "acompressor=threshold=-22dB:ratio=3.2:attack=6:release=110:makeup=5,alimiter=limit=0.89")
def sh(c): subprocess.run(c, shell=True, check=True)
def dur(f): return float(subprocess.check_output(f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{f}"', shell=True))
lines = [l.strip() for l in open(script, encoding='utf-8') if l.strip()]
sh(f'ffmpeg -v error -y -i "{src}" -ac 1 -ar 48000 {out}/raw.wav && ffmpeg -v error -y -i {out}/raw.wav -ar 16000 {out}/raw16.wav')
toks = [re.sub(r"[^a-z']", '', w.lower()) for l in lines for w in l.split()]
line_of = [i for i, l in enumerate(lines) for _ in l.split()]
words = None
try:
    import wave
    from pocketsphinx import Decoder
    d = Decoder(samprate=16000, bestpath=False); d.set_align_text(' '.join(t for t in toks if t))
    w = wave.open(f'{out}/raw16.wav'); d.start_utt(); d.process_raw(w.readframes(w.getnframes()), full_utt=True); d.end_utt()
    seg = [(s.start_frame / 100, (s.end_frame + 1) / 100) for s in d.seg() if s.word not in ('<s>', '</s>', '<sil>', '[NOISE]')]
    if len(seg) == len([t for t in toks if t]):
        it = iter(seg); words = [[orig, *next(it)] if t else None for orig, t in zip([w for l in lines for w in l.split()], toks)]
        for i, x in enumerate(words):   # raqam/belgi: oldingi so'zga yopişadi
            if x is None: words[i] = [ [w for l in lines for w in l.split()][i], words[i-1][2], words[i-1][2]]
except Exception as e: print('align:', e)
if words is None:
    # zaxira: so'zlar nutq boşidan oxirigacha harf soniga qarab teng taqsimlanadi (pauzalar qisqartirilmaydi)
    print('align: zaxira (taxminiy) usul')
    log = subprocess.run(f'ffmpeg -hide_banner -nostats -i {out}/raw.wav -af silencedetect=noise=-35dB:d=0.25 -f null -', shell=True, capture_output=True, text=True).stderr
    T = dur(f'{out}/raw.wav'); ss = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]; se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    a = se[0] if ss and ss[0] < 0.05 and se else 0.0; b = ss[-1] if ss and (len(se) < len(ss) or se[-1] > T - 0.05) else T
    allw = [w for l in lines for w in l.split()]; size = [len(w) + 1 for w in allw]; k = (b - a) / sum(size); t = a; words = []
    for w, z in zip(allw, size): words.append([w, t, t + z * k * 0.9]); t += z * k
# jimliklar audioning özidan topiladi (so'z tekislaşi xato bo'lsa ham nutq kesilmaydi)
log = subprocess.run(f'ffmpeg -hide_banner -nostats -i {out}/raw.wav -af silencedetect=noise=-36dB:d={GAP} -f null -', shell=True, capture_output=True, text=True).stderr
T = dur(f'{out}/raw.wav'); ss = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', log)]; se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
sil = [(max(0, a), se[k] if k < len(se) else T) for k, a in enumerate(ss)]
line_t = [words[k][1] for k in range(1, len(words)) if line_of[k] != line_of[k - 1]]
speech_a = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
speech_b = sil[-1][0] if sil and sil[-1][1] > T - 0.05 else T
iv = []; a = max(0, speech_a - PAD)
for x, y in sil:
    if x <= speech_a + 0.01 or y >= speech_b - 0.01: continue
    keep = LINE_KEEP if any(x - 0.25 <= t <= y + 0.25 for t in line_t) else KEEP
    if y - x <= keep: continue
    iv.append((a, x + keep / 2)); a = y - keep / 2
iv.append((a, min(T, speech_b + PAD)))
def remap(t):
    off = 0
    for x, y in iv:
        if t <= y: return (off + max(0, t - x)) / TEMPO
        off += y - x
    return off / TEMPO
fc = ''.join(f'[0]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st={y-x-0.02:.3f}:d=0.02[s{i}];' for i, (x, y) in enumerate(iv))
fc += ''.join(f'[s{i}]' for i in range(len(iv))) + f'concat=n={len(iv)}:v=0:a=1,{CHAIN},atempo={TEMPO}[o]'
sh(f'ffmpeg -v error -y -i {out}/raw.wav -filter_complex "{fc}" -map "[o]" -ar 48000 {out}/voice.wav')
W = [[w, round(remap(s), 3), round(remap(e), 3)] for w, s, e in words]
starts = [next(W[k][1] for k in range(len(W)) if line_of[k] == i) for i in range(len(lines))]
json.dump({'dur': round(dur(f'{out}/voice.wav'), 3), 'words': W, 'line_of': line_of, 'lines': starts}, open(f'{out}/voice.json', 'w'))
print('ok', round(dur(f'{out}/voice.wav'), 2), 's; lines at', [round(s, 2) for s in starts])
