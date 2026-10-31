"""Render a Lone Wolf ("Yolg'iz bo'ri usuli") task as a branded poster.

Usage:
  python3 poster/render_lonewolf.py task.json out.png
  echo '<task json>' | python3 poster/render_lonewolf.py - out.png

task.json is one entry of content/lone_wolf_queue.json with a "poster" block:
  {"index": 13, "skill": "listening", "title": "...",
   "poster": {"hook": "...", "steps": ["...", "..."]}}

The poster carries the steps; the caption carries the rest (resource,
result, self-check), so the two never repeat each other.
"""
import json
import sys
from pathlib import Path

from PIL import ImageDraw

from render_genz import NAVY, ORANGE, WHITE, avatar, card, emoji, fit, wrap
from render_post import BRAND, HANDLE, INSTAGRAM, MUTED, PAD, SOFT, H, W, background, font

SKILLS = {
    "listening": ("🎧", "LISTENING"),
    "reading": ("📖", "READING"),
    "writing": ("✍️", "WRITING"),
    "speaking": ("🗣️", "SPEAKING"),
}


def steps_layout(d, steps, size, max_w):
    f = font("semibold", size)
    blocks = [wrap(d, s, f, max_w) for s in steps]
    line_h = int(size * 1.32)
    height = sum(len(b) * line_h for b in blocks) + (len(blocks) - 1) * int(size * 0.9)
    return f, blocks, line_h, height


def render(task):
    poster = task["poster"]
    img = background()
    d = ImageDraw.Draw(img)

    bf = font("black", 40)
    d.text((PAD, 82), BRAND, font=bf, fill=WHITE)
    d.text((PAD + d.textlength(BRAND + " ", font=bf), 82), "| IELTS", font=bf, fill=ORANGE)
    avatar(img)

    # series pill + skill badge
    pill = f"YOLG‘IZ BO‘RI · #{task['index']}"
    pf = font("bold", 26)
    pw = d.textlength(pill, font=pf)
    d.rounded_rectangle([PAD, 146, PAD + pw + 104, 196], radius=25, fill=ORANGE)
    emoji(img, "🐺", PAD + 18, 151, 40)
    d.text((PAD + 74, 158), pill, font=pf, fill=WHITE)
    icon, label = SKILLS[task["skill"].lower()]
    sx = PAD + pw + 124
    lw = d.textlength(label, font=pf)
    d.rounded_rectangle([sx, 146, sx + lw + 92, 196], radius=25, outline=(90, 104, 140), width=2)
    emoji(img, icon, sx + 16, 152, 38)
    d.text((sx + 66, 158), label, font=pf, fill=SOFT)

    # title + hook
    y = 230
    tf = font("black", 58)
    for line in wrap(d, task["title"], tf, W - 2 * PAD)[:2]:
        d.text((PAD, y), line, font=tf, fill=WHITE)
        y += 70
    hf = font("medium", 30)
    for line in wrap(d, poster["hook"], hf, W - 2 * PAD)[:2]:
        d.text((PAD, y + 6), line, font=hf, fill=SOFT)
        y += 40

    # steps card
    top, bottom = y + 40, H - 230
    card(img, [PAD, top, W - PAD, bottom])
    d = ImageDraw.Draw(img)
    d.text((PAD + 44, top + 34), "QADAM-BAQADAM", font=font("black", 30), fill=ORANGE)
    area_top, area_bottom = top + 100, bottom - 36
    text_x, max_w = PAD + 124, W - 2 * PAD - 168
    size = 34
    while True:
        f, blocks, line_h, height = steps_layout(d, poster["steps"], size, max_w)
        if height <= area_bottom - area_top or size <= 22:
            break
        size -= 2
    sy = area_top + max(0, (area_bottom - area_top - height) // 2)
    for n, block in enumerate(blocks, 1):
        r = int(size * 0.78)
        cy = sy + line_h // 2
        d.ellipse([PAD + 44, cy - r, PAD + 44 + 2 * r, cy + r], fill=NAVY)
        nf = font("black", int(size * 0.8))
        d.text((PAD + 44 + r - d.textlength(str(n), font=nf) / 2, cy - nf.size * 0.62), str(n), font=nf, fill=WHITE)
        for line in block:
            d.text((text_x, sy), line, font=f, fill=NAVY)
            sy += line_h
        sy += int(size * 0.9)

    note = "Manba, natija va tekshiruv: post matnida 👇".replace(" 👇", "")
    nf = font("bold", 30)
    d.text(((W - d.textlength(note, font=nf)) / 2, bottom + 30), note, font=nf, fill=WHITE)

    d.line([PAD, H - 150, W - PAD, H - 150], fill=(52, 62, 92), width=2)
    d.text((PAD, H - 108), HANDLE, font=font("bold", 32), fill=WHITE)
    sf = font("medium", 26)
    d.text((W - PAD - d.textlength(INSTAGRAM, font=sf), H - 102), INSTAGRAM, font=sf, fill=MUTED)
    return img


def main():
    source = sys.stdin.read() if sys.argv[1] == "-" else Path(sys.argv[1]).read_text(encoding="utf-8")
    task = json.loads(source)
    render(task).save(sys.argv[2])


if __name__ == "__main__":
    main()
