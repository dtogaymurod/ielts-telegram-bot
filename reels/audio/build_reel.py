"""Ustoz ovozi bilan tayyor premium reel: ovoz tozalanadi, sahnalar va subtitr gaplarga moslanadi, fon musiqa qo'yiladi.
  python3 design/audio/build_reel.py spec.json voice.ogg out.mp4
spec.json: design/reel.mjs spec'i ("style": "premium"). Skript qatorlari = hook, beats[].text, cta.
"""
import sys, json, re, os, subprocess, tempfile
here = os.path.dirname(os.path.abspath(__file__))
spec_path, voice, out = sys.argv[1:4]
spec = json.load(open(spec_path, encoding='utf-8'))
LEAD, TAIL, EARLY = 0.45, 1.6, 0.15   # ovozdan oldin, yakuniy kartada, sahna gapdan sal oldin almashadi
MUSIC = float(os.environ.get('MUSIC', '0.50'))   # musiqa balandligi ovoz ostida
w = tempfile.mkdtemp(prefix='reel-')
plain = lambda t: re.sub(r'<[^>]+>', '', str(t or '')).strip()
lines = [plain(spec['hook'])] + [plain(b['text']) for b in spec['beats']] + [plain(spec['cta'])]
open(f'{w}/script.txt', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
def sh(c): subprocess.run(c, shell=True, check=True)
sh(f'python3 {here}/voice.py "{voice}" {w}/script.txt {w}')
v = json.load(open(f'{w}/voice.json'))
cuts = [0] + [LEAD + s - EARLY for s in v['lines'][1:]]
total = LEAD + v['dur'] + TAIL
spec.update(style='premium', durations=[round((b - a) * 1000) for a, b in zip(cuts, cuts[1:] + [total])],
            words=[[x, round(s + LEAD, 3), round(e + LEAD, 3)] for x, s, e in v['words']], line_of=v['line_of'], audio=f'{w}/master.wav')
# musiqa: sahna almashişida yumşoq swell, yakundan oldin riser
sh(f'python3 {here}/music_premium.py {total + 0.5:.2f} {w}/music.wav {" ".join(f"{c:.2f}" for c in cuts[1:-1])} --cta {cuts[-1]:.2f}')
# miks: ovoz markazda; musiqa ovoz paytida pasayadi (sidechain), boşida va yakunda ko'tariladi; -14 LUFS (Instagram)
cta = cuts[-1]
fc = (f"[0]aresample=48000,adelay={int(LEAD*1000)}:all=1,apad=whole_dur={total},asplit=2[vo][sc];"
      f"[1]aresample=48000,volume='{MUSIC}*(1+0.6*max(0,1-t/{LEAD+0.3:.2f})+0.5*min(1,max(0,(t-{cta+0.6:.2f})/0.8)))':eval=frame[m];"
      f"[m][sc]sidechaincompress=threshold=0.04:ratio=3:attack=25:release=300[md];"
      f"[vo][md]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=8,atrim=0:{total:.2f}[o]")
sh(f'ffmpeg -v error -y -i {w}/voice.wav -i {w}/music.wav -filter_complex "{fc}" -map "[o]" -ar 48000 -ac 2 {w}/master.wav')
json.dump(spec, open(f'{w}/spec.json', 'w', encoding='utf-8'), ensure_ascii=False)
sh(f'node {os.path.dirname(here)}/reel.mjs {w}/spec.json "{out}"')
print('ok', out, f'{total:.1f}s', 'work:', w)
