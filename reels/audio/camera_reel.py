"""Ustozning özi kadrda: telefonda yozilgan videodan tayyor reel.
  python3 reels/audio/camera_reel.py video.mp4 script.txt out.mp4 [--hook "Ekrandagi hook"]

1. Kadr 1080x1920 ga keltiriladi (vertikal; gorizontal video markazdan kesiladi).
2. Uzun pauzalar kesiladi (jump cut): ovoz ham, kadr ham birga, gap ichidagi qisqa nafas qoladi.
3. Ovoz tozalanadi (voice.py bilan bir xil zanjir).
4. Subtitr: script.txt qatorlari, so'zma-so'z (pocketsphinx; topilmasa taxminiy), aytilayotgan so'z to'q sariq.
   --hook berilsa, birinchi 2,5 soniya tepada hook matni turadi.
5. Fon musiqa (music_premium.py) ovoz ostida pasayadi, -14 LUFS.
Kerak: ffmpeg (libass), python3, numpy; pocketsphinx bo'lmasa subtitr taxminiy.
"""
import sys, os, re, json, subprocess, tempfile

here = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
hook = ''
if '--hook' in args:
    k = args.index('--hook'); hook = args[k + 1]; args = args[:k] + args[k + 2:]
src, script_path, out = args[:3]
w = tempfile.mkdtemp(prefix='camreel-')
W, H, FPS = 1080, 1920, 30
GAP, KEEP, PAD = 0.38, 0.20, 0.12   # shundan uzun jimlik kesiladi; kesilgan joyda qoladigan jimlik; boşi/oxiri
MUSIC = float(os.environ.get('MUSIC', '0.35'))
FONTS = os.path.join(os.path.dirname(here), 'assets', 'fonts')
CHAIN = ("highpass=f=85,highpass=f=85,afftdn=nf=-42:nr=8:tn=1,equalizer=f=220:t=q:w=1.1:g=-4,equalizer=f=500:t=q:w=1.4:g=-1.5,"
         "equalizer=f=3400:t=q:w=1.3:g=4,equalizer=f=6800:t=q:w=1.4:g=2.5,highshelf=f=10000:g=2,deesser=i=0.35,"
         "acompressor=threshold=-22dB:ratio=3.2:attack=6:release=110:makeup=5,alimiter=limit=0.89")


def sh(c):
    subprocess.run(c, shell=True, check=True)


def dur(f):
    return float(subprocess.check_output(f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{f}"', shell=True))


def silences(wav, gap):
    log = subprocess.run(f'ffmpeg -hide_banner -nostats -i "{wav}" -af silencedetect=noise=-36dB:d={gap} -f null -',
                         shell=True, capture_output=True, text=True).stderr
    T = dur(wav)
    ss = [max(0.0, float(x)) for x in re.findall(r'silence_start: (-?[\d.]+)', log)]
    se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    return T, [(a, se[k] if k < len(se) else T) for k, a in enumerate(ss)]


lines = [l.strip() for l in open(script_path, encoding='utf-8') if l.strip()]
if not lines:
    sys.exit('script.txt bo\'sh')

# 1-2. Qaysi bölaklar qoladi
sh(f'ffmpeg -v error -y -i "{src}" -vn -ac 1 -ar 48000 {w}/raw.wav')
T, sil = silences(f'{w}/raw.wav', GAP)
speech_a = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
speech_b = sil[-1][0] if sil and sil[-1][1] > T - 0.05 else T
if speech_b - speech_a < 1:
    sys.exit('videoda gap topilmadi (ovoz juda past yoki yöq)')
keep, a = [], max(0.0, speech_a - PAD)
for x, y in sil:
    if x <= speech_a + 0.01 or y >= speech_b - 0.01:
        continue
    keep.append((a, x + KEEP / 2)); a = y - KEEP / 2
keep.append((a, min(T, speech_b + PAD)))
keep = [(x, y) for x, y in keep if y - x > 0.08]

# kadr: vertikal 1080x1920 ga töldirib kesiladi, rang biroz jonlanadi
vf = (f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps={FPS},'
      'eq=contrast=1.04:saturation=1.06')
parts = []
for i, (x, y) in enumerate(keep):
    parts.append(f'[0:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS,{vf}[v{i}];'
                 f'[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.012,'
                 f'afade=t=out:st={max(0, y - x - 0.02):.3f}:d=0.02[a{i}];')
fc = ''.join(parts) + ''.join(f'[v{i}][a{i}]' for i in range(len(keep))) + f'concat=n={len(keep)}:v=1:a=1[v][a];[a]{CHAIN}[ac]'
open(f'{w}/cut.txt', 'w').write(fc)
sh(f'ffmpeg -v error -y -i "{src}" -filter_complex_script {w}/cut.txt -map "[v]" -map "[ac]" '
   f'-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -c:a pcm_s16le {w}/cut.mov')
sh(f'ffmpeg -v error -y -i {w}/cut.mov -vn -ac 1 -ar 48000 {w}/voice.wav && ffmpeg -v error -y -i {w}/voice.wav -ar 16000 {w}/voice16.wav')
total = dur(f'{w}/voice.wav')

# 4. So'zlar vaqti
allw = [x for l in lines for x in l.split()]
line_of = [i for i, l in enumerate(lines) for _ in l.split()]
toks = [re.sub(r"[^a-z']", '', x.lower()) for x in allw]
words = None
try:
    import wave
    from pocketsphinx import Decoder
    d = Decoder(samprate=16000, bestpath=False); d.set_align_text(' '.join(t for t in toks if t))
    f = wave.open(f'{w}/voice16.wav'); d.start_utt(); d.process_raw(f.readframes(f.getnframes()), full_utt=True); d.end_utt()
    seg = [(s.start_frame / 100, (s.end_frame + 1) / 100) for s in d.seg() if s.word not in ('<s>', '</s>', '<sil>', '[NOISE]')]
    if len(seg) == len([t for t in toks if t]):
        it = iter(seg); words = [[o, *next(it)] if t else None for o, t in zip(allw, toks)]
        for i, x in enumerate(words):
            if x is None:
                words[i] = [allw[i], words[i - 1][2] if i else 0.0, words[i - 1][2] if i else 0.3]
except Exception as e:
    print('align:', e)
aligned = words is not None
if not aligned:
    # zaxira: gaplar ovozdagi nutq bölaklariga, ular içida so'zlar harf soniga qarab
    print('align: zaxira (taxminiy) usul')
    T2, s2 = silences(f'{w}/voice.wav', 0.12)
    a = s2[0][1] if s2 and s2[0][0] < 0.05 else 0.0
    b = s2[-1][0] if s2 and s2[-1][1] > T2 - 0.05 else T2
    size = [len(x) + 1 for x in allw]; k = (b - a) / sum(size); t = a; words = []
    for x, z in zip(allw, size):
        words.append([x, t, t + z * k * 0.92]); t += z * k

# subtitr: 2-4 so'zlik bölaklar (qator ichida), aytilayotgan so'z to'q sariq
def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def esc(x):
    return x.replace('\\', '').replace('{', '(').replace('}', ')')


chunks, cur = [], []
for i, x in enumerate(words):
    if cur and (line_of[i] != line_of[cur[-1]] or len(cur) >= 4 or sum(len(words[j][0]) + 1 for j in cur) + len(x[0]) > 22):
        chunks.append(cur); cur = []
    cur.append(i)
if cur:
    chunks.append(cur)
ORANGE, WHITE = '&H000C58EA&', '&H00FFFFFF&'
ev = []
for n, c in enumerate(chunks):
    start = words[c[0]][1] - 0.05
    end = words[chunks[n + 1][0]][1] - 0.05 if n + 1 < len(chunks) else min(total, words[c[-1]][2] + 0.6)
    for k, j in enumerate(c):
        a = start if k == 0 else words[j][1]
        b = words[c[k + 1]][1] if k + 1 < len(c) else end
        if b - a < 0.02:
            continue
        txt = ' '.join(('{\\c%s}%s{\\c%s}' % (ORANGE, esc(words[q][0]), WHITE)) if q == j else esc(words[q][0]) for q in c)
        ev.append(f'Dialogue: 0,{ts(a)},{ts(b)},Sub,,0,0,0,,{txt}')
if hook:
    ev.append(f'Dialogue: 1,{ts(0)},{ts(min(2.5, total))},Hook,,0,0,0,,{{\\fad(0,250)}}{esc(hook)}')
ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Plus Jakarta Sans,76,&H00FFFFFF,&H00FFFFFF,&H00141418,&H96000000,-1,0,0,0,100,100,0,0,1,5,3,2,90,90,560,1
Style: Hook,Plus Jakarta Sans,72,&H00FFFFFF,&H00FFFFFF,&H00141418,&H7818181B,-1,0,0,0,100,100,0,0,3,26,0,8,80,80,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + '\n'.join(ev) + '\n'
open(f'{w}/subs.ass', 'w', encoding='utf-8').write(ass)

# 5. Musiqa va miks
line_t = sorted({words[k][1] for k in range(1, len(words)) if line_of[k] != line_of[k - 1]})
cta = line_t[-1] if line_t else max(0.0, total - 3)
sh(f'python3 {here}/music_premium.py {total + 0.5:.2f} {w}/music.wav {" ".join(f"{c:.2f}" for c in line_t[:-1])} --cta {cta:.2f}')
fa = (f"[0]aresample=48000,asplit=2[vo][sc];"
      f"[1]aresample=48000,volume='{MUSIC}*(1+0.6*max(0,1-t/0.8)+0.5*min(1,max(0,(t-{cta + 0.6:.2f})/0.8)))':eval=frame[m];"
      f"[m][sc]sidechaincompress=threshold=0.04:ratio=3:attack=25:release=300[md];"
      f"[vo][md]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=8,atrim=0:{total:.2f}[o]")
sh(f'ffmpeg -v error -y -i {w}/voice.wav -i {w}/music.wav -filter_complex "{fa}" -map "[o]" -ar 48000 -ac 2 {w}/master.wav')

fonts = f":fontsdir={FONTS}" if os.path.isdir(FONTS) else ''
sh(f'ffmpeg -v error -y -i {w}/cut.mov -i {w}/master.wav -filter_complex "[0:v]ass={w}/subs.ass{fonts}[v]" -map "[v]" -map 1:a '
   f'-t {total:.2f} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "{out}"')
json.dump({'dur': round(total, 2), 'cuts': len(keep) - 1, 'aligned': aligned, 'cut_seconds': round(T - total, 1)},
          open(out + '.json', 'w'))
print('ok', out, f'{total:.1f}s', f'{len(keep) - 1} cuts', 'aligned' if aligned else 'estimated', 'work:', w)
