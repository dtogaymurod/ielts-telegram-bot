# Premium reels (copy of smm-agents `design/`)

When an agent reel in `content/agent-queue.json` carries `reel_spec`, the teacher's voice message makes the bot render the reel again around the voice (`src/agent-reels.js` → `reels/audio/build_reel.py`):

1. `audio/voice.py`: the voice is cleaned (rumble, noise, muffled mids out; clarity in; even level), long pauses are shortened, 1.06× tempo; pocketsphinx gives every word's time.
2. `audio/music_premium.py`: a calm 96 BPM music bed, soft swells at scene changes, a riser before the closing card. It ducks under the voice; master at -14 LUFS.
3. `reel.mjs` + `reel-premium.html`: graphite background, real iPhone with the real exam screen, the camera glides to each `focus`, subtitles follow the voice word by word.

These files are copies of `dilshodustoz/smm-agents` `design/`. Change them there first, then copy here. Without `reel_spec`, or if the render fails, the old mix (`mixVoice`) is used, now with the same voice cleaning.
