# Premium reels (copy of smm-agents `design/`)

When an agent reel in `content/agent-queue.json` carries `reel_spec`, the teacher's voice message makes the bot render the reel again around the voice (`src/agent-reels.js` → `reels/audio/build_reel.py`):

1. `audio/voice.py`: the voice is cleaned (rumble, noise, muffled mids out; clarity in; even level), long pauses are shortened, 1.06× tempo; pocketsphinx gives every word's time.
2. `audio/music_premium.py`: a calm 96 BPM music bed, soft swells at scene changes, a riser before the closing card. It ducks under the voice; master at -14 LUFS.
3. `reel.mjs` + `reel-premium.html`: graphite background, real iPhone with the real exam screen, the camera glides to each `focus`, subtitles follow the voice word by word.

These files are copies of `dilshodustoz/smm-agents` `design/`. Change them there first, then copy here. Without `reel_spec`, or if the render fails, the old mix (`mixVoice`) is used, now with the same voice cleaning.

## Camera reels (the teacher on camera, 2026-11-18)

The teacher asked that reels show only him, not generated screens. A queue entry with `"camera": true` needs no `video`:

```json
{ "id": "...", "date": "...", "time": "09:00", "channel": "ig_ustoz", "format": "reels", "camera": true,
  "hook": "On-screen hook, up to 8 words (optional)", "script": "line 1\nline 2\n...", "caption": "plain text" }
```

At 21:00 the bot sends the script as "Kamera matni". The teacher answers it with a vertical video of himself. `audio/camera_reel.py` cuts the long pauses (picture and voice together), cleans the voice, burns word-by-word subtitles (Plus Jakarta Sans ExtraBold from `assets/fonts/`, OFL; the spoken word is brand orange) and the hook for the first 2.5 s, and lays the music bed under it at -14 LUFS. Without a video the reel does not go out; at its time the bot reminds the teacher once and publishes as soon as the video arrives (same day).
