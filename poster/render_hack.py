"""Render a 19:30 skill post ("hack") in the orange Gen Z design.

Usage:
  python3 poster/render_hack.py post.json out.png
  echo '<post json>' | python3 poster/render_hack.py - out.png

post.json is one entry of content/daily-posts.json plus its "skill":
  {"skill": "reading", "title": "...", "subtitle": "...",
   "rows": [["❌", "..."], ["✅", "..."], ["💡", "..."]],
   "note": "optional line under the card"}

Each row is a marker (an emoji, or a number shown in an orange circle) and
a short text. **word** is drawn bold in orange. The text shrinks to fit.
An optional "visual" (see visuals.py) adds a small picture above the rows;
it is left out when the text would become too small next to it.
"""
import json
import sys
from pathlib import Path

from PIL import ImageDraw

import render_genz
from render_genz import NAVY, ORANGE, WHITE, card, emoji, frame, note
import visuals
from render_post import PAD, H, W, font

SKILL_PILLS = {
    "listening": "LISTENING HACK",
    "reading": "READING HACK",
    "writing": "WRITING HACK",
    "speaking": "SPEAKING HACK",
}
render_genz.PILLS.update(SKILL_PILLS)

TOP, BOTTOM = 380, 1110
TEXT_X = PAD + 132
TEXT_W = W - PAD - 48 - TEXT_X
DEFAULT_NOTE = "Save this and send it to a friend"


def tokens(text):
    """Split text into (word, highlighted) pairs; **...** marks highlights."""
    out, prev = [], " "
    for i, part in enumerate(text.split("**")):
        hot = i % 2 == 1
        words = part.split()
        # text glued to the previous chunk ("**actually**,") keeps no space
        glue = bool(out) and bool(part) and not part[0].isspace() and not prev[-1:].isspace()
        out += [(w, hot, glue and j == 0) for j, w in enumerate(words)]
        prev = part or prev
    return out


def layout(d, text, size):
    reg, bold = font("semibold", size), font("black", size)
    space = d.textlength(" ", font=reg)
    lines, line, width = [], [], 0
    for word, hot, glue in tokens(text):
        f = bold if hot else reg
        w = d.textlength(word, font=f)
        if line and not glue and width + space + w > TEXT_W:
            lines.append(line)
            line, width = [], 0
        gap = space if line and not glue else 0
        line.append((word, hot, w, gap))
        width += gap + w
    if line:
        lines.append(line)
    return lines, reg, bold, space


def measure(d, rows, size):
    line_h, gap = int(size * 1.34), int(size * 0.95)
    blocks = [layout(d, text, size) for _, text in rows]
    height = sum(len(b[0]) * line_h for b in blocks) + gap * (len(rows) - 1)
    return blocks, line_h, gap, height


def render(post):
    img = frame(post["skill"], post["title"], post["subtitle"])
    card(img, [PAD, TOP, W - PAD, BOTTOM])
    d = ImageDraw.Draw(img)
    rows = post["rows"]
    visual = post.get("visual")
    size = 50
    while True:
        vis_h = visuals.HEIGHT + 30 if visual else 0
        inner = BOTTOM - TOP - 100 - vis_h
        blocks, line_h, gap, height = measure(d, rows, size)
        if height <= inner or size <= 26:
            if visual and (height > inner or size < 32):
                # the picture leaves too little room for this text: drop it
                visual, size = None, 50
                continue
            break
        size -= 2
    if height > inner:
        raise ValueError(f"Post is too long to fit on the poster: {post['title']}")

    if visual:
        d = visuals.draw(img, visual, [PAD + 36, TOP + 36, W - PAD - 36, TOP + 36 + visuals.HEIGHT])
    y = TOP + 50 + vis_h + (inner - height) // 2
    for (marker, _), (lines, reg, bold, space) in zip(rows, blocks):
        mid = y + line_h // 2
        if len(marker) <= 2 and marker.isalnum():
            d.ellipse([PAD + 40, mid - 34, PAD + 108, mid + 34], fill=ORANGE)
            nf = font("black", 36)
            d.text((PAD + 74 - d.textlength(marker, font=nf) / 2, mid - 22), marker, font=nf, fill=WHITE)
        else:
            tint = {"❌": (255, 232, 230), "✅": (226, 247, 235)}.get(marker, (255, 238, 226))
            d.rounded_rectangle([PAD + 36, mid - 40, PAD + 116, mid + 40], radius=22, fill=tint)
            emoji(img, marker, PAD + 52, mid - 24, 48)
        d = ImageDraw.Draw(img)
        for line in lines:
            x = TEXT_X
            for word, hot, w, pad in line:
                x += pad
                d.text((x, y), word, font=bold if hot else reg, fill=ORANGE if hot else NAVY)
                x += w
            y += line_h
        y += gap
    note(d, BOTTOM, post.get("note") or DEFAULT_NOTE)
    return img


def main():
    src = sys.stdin.read() if sys.argv[1] == "-" else Path(sys.argv[1]).read_text(encoding="utf-8")
    render(json.loads(src)).save(sys.argv[2])


if __name__ == "__main__":
    main()
