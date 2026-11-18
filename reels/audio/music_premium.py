"""Premium reels uchun fon musiqa (bepul, o'zimiz yasaymiz): iliq, sokin, zamonaviy.
  python3 design/audio/music_premium.py <soniya> music.wav [sahna_almashish ...] [--cta S]
96 BPM, Am9-Fmaj7-C-G akkordlari: yumşoq elektro-pianino, past bas, yengil baraban, reverb.
Sahna almashganda yumşoq "swell" (keskin whoosh/pop yo'q), --cta dan oldin ko'tariluvçi riser.
"""
import numpy as np, wave, sys
args = sys.argv[1:]; cta = None
if '--cta' in args: k = args.index('--cta'); cta = float(args[k + 1]); args = args[:k] + args[k + 2:]
total, path, cuts = float(args[0]), args[1], [float(x) for x in args[2:]]
sr = 44100; bpm = 96; beat = 60 / bpm; n = int(sr * (total + 0.01))
L = np.zeros(n); R = np.zeros(n); rng = np.random.default_rng(11)
def add(sig, at, g=1.0, pan=0.0):
    i = int(at * sr)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(n, i + len(sig))
    if i < n: L[i:j] += sig[:j - i] * g * (1 - max(0, pan)); R[i:j] += sig[:j - i] * g * (1 + min(0, pan))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def epiano(f, d):
    t = np.arange(int(d * sr)) / sr; e = np.minimum(1, t / 0.006) * np.exp(-2.2 * t)
    mod = np.sin(2 * np.pi * f * 2 * t) * 1.2 * np.exp(-6 * t)
    return (np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * f * 2 * t)) * e * 0.16
def pad(f, d):
    t = np.arange(int(d * sr)) / sr; e = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.6).clip(0)
    x = sum(np.sin(2 * np.pi * f * (1 + dt) * t + p) for dt, p in ((0, 0), (0.003, 1), (-0.004, 2)))
    return x * e * 0.035
def bass(f, d):
    t = np.arange(int(d * sr)) / sr; e = np.minimum(1, t / 0.01) * np.exp(-1.5 * t)
    return np.tanh(1.5 * np.sin(2 * np.pi * f * t)) * e * 0.28
def kick():
    t = np.arange(int(0.4 * sr)) / sr; f = 42 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t * 9) * 0.55
def shaker(g=1.0):
    t = np.arange(int(0.07 * sr)) / sr; x = np.diff(rng.standard_normal(len(t)), prepend=0)
    return x * np.minimum(1, t / 0.01) * np.exp(-t * 60) * 0.05 * g
def snap():
    t = np.arange(int(0.2 * sr)) / sr; x = rng.standard_normal(len(t)); x -= np.convolve(x, np.ones(30) / 30, 'same')
    return x * np.exp(-t * 28) * 0.10
chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]   # Am9 Fmaj7 C G
roots = [45, 41, 48, 43]
bar = 4 * beat
for b in range(int(total / bar) + 2):
    t0 = b * bar; ch = chords[b % 4]
    for m in ch: add(pad(hz(m), bar + 0.4), t0, 1, pan=((m % 5) - 2) * 0.15)
    for k, at in enumerate((0, 1.5, 2.5)):
        for m in ch[1:]: add(epiano(hz(m + 12), 1.6), t0 + at * beat + k * 0.004, 0.8 if at == 0 else 0.5, pan=0.2 if k % 2 else -0.2)
    add(bass(hz(roots[b % 4]), beat * 1.8), t0, 1); add(bass(hz(roots[b % 4]), beat * 1.2), t0 + 2.5 * beat, 0.7)
    if b >= 1:   # baraban 2-taktdan, birinçi takt yumşoq kiriş
        for q in range(4):
            if q in (0, 2): add(kick(), t0 + q * beat)
            if q in (1, 3): add(snap(), t0 + q * beat, 1, pan=0.1)
            for s in range(4): add(shaker(0.6 if s % 2 else 1), t0 + q * beat + s * beat / 4, 1, pan=0.3)
def swell(at, d=0.6, g=0.10):   # sahna almashişi: teskari reverb kabi yumşoq ko'tarilish
    t = np.arange(int(d * sr)) / sr; x = rng.standard_normal(len(t))
    for _ in range(3): x = np.convolve(x, np.ones(40) / 40, 'same')
    x /= np.abs(x).max() + 1e-9; add(x * (t / d) ** 3 * g, at - d, 1)
for c in cuts: swell(c)
if cta is not None:
    d = 1.6; t = np.arange(int(d * sr)) / sr; f = 200 + 1800 * (t / d) ** 2
    x = rng.standard_normal(len(t)); x = np.convolve(x, np.ones(6) / 6, 'same')
    add((x * 0.05 + np.sin(2 * np.pi * np.cumsum(f) / sr) * 0.015) * (t / d) ** 2.5, cta - d, 1)
    t = np.arange(int(1.5 * sr)) / sr; add(np.sin(2 * np.pi * (38 + 30 * np.exp(-t * 8)) * t) * np.exp(-t * 3) * 0.5, cta, 1)   # yumşoq "boom"
# reverb (oddiy: eksponensial so'nuvçi shovqin bilan konvolyutsiya)
ir_t = np.arange(int(1.8 * sr)) / sr
for ch, seed in ((L, 1), (R, 2)):
    ir = np.random.default_rng(seed).standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2); ir[0] = 0
    wet = np.fft.irfft(np.fft.rfft(ch, 2 * n) * np.fft.rfft(ir, 2 * n))[:n]
    ch += wet / np.abs(wet).max() * np.abs(ch).max() * 0.35
st = np.stack([L, R]); fade = int(sr * 1.5); st[:, -fade:] *= np.linspace(1, 0, fade); st[:, :int(sr * .3)] *= np.linspace(0, 1, int(sr * .3))
st = np.tanh(st * 1.1); st /= np.abs(st).max(); st *= 0.85
w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((st.T.reshape(-1) * 32767).astype(np.int16).tobytes()); w.close()
print('ok', path)
