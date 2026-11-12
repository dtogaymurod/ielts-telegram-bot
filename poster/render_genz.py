"""Render the short Gen Z style posts (orange brand design).

Usage:
  python3 poster/render_genz.py post.json out.png [out2.png]

post.json is one entry of content/genz-posts.json plus its "kind":
  upgrade   -> "Oddiy vs Band 9": rows of [plain, band9] word pairs
  slang     -> "TikTok vs IELTS": rows of [slang, formal] pairs
  emoji     -> emoji riddle: "emojis" list + quiz "options"
  truefalse -> "True or false?": one "sentence" + quiz
  redflag   -> three "red" and three "green" habits
  collocation -> "phrase" with a gap + MAKE / DO / TAKE (+ "bonus" line)
  band      -> two slides (album): "question" + "band5", then "band8" with
               its "highlights" in orange; pass two output paths

If poster/assets/avatar.png exists it is drawn as a small round photo in the
top right corner.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from render_post import BRAND, HANDLE, INSTAGRAM, PAD, H, W, font

ASSETS = Path(__file__).parent / "assets"
EMOJI_FONTS = [
    Path(__file__).parent / "fonts" / "NotoColorEmoji.ttf",
    Path("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"),
]

NAVY = (20, 28, 52)
ORANGE = (226, 83, 42)
WHITE = (255, 255, 255)
GREY = (170, 170, 178)
LINE = (236, 232, 228)
GREEN = (52, 199, 120)
RED = (235, 77, 75)

# Colour themes. "orange" is the @dilshod_english look; the Multilevel channel
# has its own colours so the two channels never look the same. A post picks a
# theme with "theme" (render_hack.py, render_visual.py), which also sets the
# exam label, the handle and the round photo: a theme's "avatar" file in
# poster/assets is used when it exists, avatar.png otherwise.
THEMES = {
    "orange": {"top": (240, 100, 50), "bottom": (210, 60, 40), "accent": (226, 83, 42),
               "tint": (255, 238, 226), "soft": (255, 244, 236), "sub": (255, 230, 215),
               "insta": (255, 225, 210), "rule": (255, 170, 140),
               "shadow": (90, 20, 0, 80), "exam": "IELTS", "handle": HANDLE},
    "green": {"top": (22, 163, 120), "bottom": (8, 108, 88), "accent": (8, 138, 98),
              "tint": (220, 245, 235), "soft": (235, 250, 243), "sub": (214, 245, 232),
              "insta": (214, 245, 232), "rule": (120, 210, 175),
              "shadow": (0, 50, 30, 80), "exam": "MULTILEVEL", "handle": "@dilshod_multilevel",
              "avatar": "avatar-multilevel.png"},
}
THEME = THEMES["orange"]
EXAM = "IELTS"


def use_theme(name, exam=None, handle=None):
    """Switch every drawing helper to another colour theme."""
    global THEME, ORANGE, EXAM, HANDLE
    THEME = THEMES[name]
    ORANGE = THEME["accent"]
    EXAM = exam or THEME["exam"]
    HANDLE = handle or THEME["handle"]

PILLS = {
    "upgrade": "BASIC vs BAND 9",
    "slang": "TIKTOK vs IELTS",
    "emoji": "EMOJI RIDDLE",
    "truefalse": "TRUE OR FALSE?",
    "redflag": "RED FLAG / GREEN FLAG",
    "collocation": "MAKE, DO OR TAKE?",
    "band": "BAND 5 vs BAND 8",
}
HEADS = {
    "upgrade": (("😐", "BASIC"), ("😎", "BAND 9")),
    "slang": (("📱", "ON TIKTOK"), ("🎓", "IN IELTS")),
}

_emoji_font = None


def emoji(img, ch, x, y, size):
    """Paste a colour emoji scaled to size x size (Noto only renders at 109px)."""
    global _emoji_font
    if _emoji_font is None:
        path = next((p for p in EMOJI_FONTS if p.exists()), None)
        if path is None:
            raise FileNotFoundError("NotoColorEmoji.ttf not found (apt install fonts-noto-color-emoji)")
        _emoji_font = ImageFont.truetype(str(path), 109)
    tile = Image.new("RGBA", (160, 136), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((0, 0), ch, font=_emoji_font, embedded_color=True)
    box = tile.getbbox()
    if not box:
        return
    tile = tile.crop(box)
    scale = size / max(tile.size)
    tile = tile.resize((max(1, round(tile.width * scale)), max(1, round(tile.height * scale))), Image.LANCZOS)
    img.paste(tile, (int(x + (size - tile.width) / 2), int(y + (size - tile.height) / 2)), tile)


def fit(d, text, style, size, max_w, min_size=22):
    f = font(style, size)
    while d.textlength(text, font=f) > max_w and size > min_size:
        size -= 2
        f = font(style, size)
    return f


def wrap(d, text, f, max_w):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if line and d.textlength(test, font=f) > max_w:
            lines.append(line)
            line = word
        else:
            line = test
    return lines + [line]


def strike(d, x, y, text, f, fill):
    d.text((x, y), text, font=f, fill=fill)
    b = d.textbbox((x, y), text, font=f)
    mid = (b[1] + b[3]) / 2
    d.line([b[0] - 4, mid, b[2] + 4, mid], fill=fill, width=3)


def card(img, box, radius=36):
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [box[0], box[1] + 10, box[2], box[3] + 10], radius=radius, fill=THEME["shadow"])
    img.paste(shadow.filter(ImageFilter.GaussianBlur(20)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(20)))
    ImageDraw.Draw(img).rounded_rectangle(box, radius=radius, fill=WHITE)


def avatar(img):
    path = ASSETS / THEME.get("avatar", "avatar.png")
    if not path.exists():
        path = ASSETS / "avatar.png"
    if not path.exists():
        return
    size = 132
    photo = Image.open(path).convert("RGB")
    side = min(photo.size)
    left, top = (photo.width - side) // 2, max(0, (photo.height - side) // 4)
    photo = photo.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size * 4, size * 4], fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    x, y = W - PAD - size, 64
    ImageDraw.Draw(img).ellipse([x - 6, y - 6, x + size + 6, y + size + 6], fill=WHITE)
    img.paste(photo, (x, y), mask)


def frame(kind, title, subtitle):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        top, bottom = THEME["top"], THEME["bottom"]
        d.line([0, y, W, y], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))

    bf = font("black", 40)
    d.text((PAD, 82), BRAND, font=bf, fill=WHITE)
    d.text((PAD + d.textlength(BRAND + " ", font=bf), 82), f"| {EXAM}", font=bf, fill=NAVY)
    pill = PILLS[kind]
    pf = font("bold", 24)
    pw = d.textlength(pill, font=pf)
    d.rounded_rectangle([PAD, 146, PAD + pw + 44, 192], radius=23, fill=NAVY)
    d.text((PAD + 22, 156), pill, font=pf, fill=WHITE)
    avatar(img)

    d.text((PAD, 226), title, font=fit(d, title, "black", 60, W - 2 * PAD, 40), fill=WHITE)
    d.text((PAD, 304), subtitle, font=fit(d, subtitle, "medium", 30, W - 2 * PAD), fill=THEME["sub"])

    d.line([PAD, H - 150, W - PAD, H - 150], fill=THEME["rule"], width=2)
    d.text((PAD, H - 108), HANDLE, font=font("bold", 32), fill=WHITE)
    sf = font("medium", 26)
    d.text((W - PAD - d.textlength(INSTAGRAM, font=sf), H - 102), INSTAGRAM, font=sf, fill=THEME["insta"])
    return img


def draw_pairs(img, kind, rows):
    d = ImageDraw.Draw(img)
    top, row_h = 380, 104
    bottom = top + 100 + row_h * len(rows)
    card(img, [PAD, top, W - PAD, bottom])
    d = ImageDraw.Draw(img)
    cx = W / 2
    col_w = cx - PAD - 80
    (le, lt), (re_, rt) = HEADS[kind]
    emoji(img, le, PAD + 50, top + 32, 46)
    d.text((PAD + 110, top + 38), lt, font=font("bold", 30), fill=GREY)
    emoji(img, re_, cx + 30, top + 32, 46)
    d.text((cx + 90, top + 38), rt, font=font("bold", 30), fill=ORANGE)
    y = top + 112
    icons = any(len(r) > 2 for r in rows)
    lx = PAD + (128 if icons else 50)
    for i, row in enumerate(rows):
        plain, better = row[0], row[1]
        if i:
            d.line([PAD + 40, y - 12, W - PAD - 40, y - 12], fill=LINE, width=2)
        if len(row) > 2:
            d.rounded_rectangle([PAD + 36, y + 2, PAD + 112, y + 78], radius=20, fill=(255, 238, 226))
            emoji(img, row[2], PAD + 51, y + 17, 46)
            d = ImageDraw.Draw(img)
        strike(d, lx, y + 18, plain, fit(d, plain, "medium", 34, cx - lx - 30), GREY)
        d.text((cx + 30, y + 16), better, font=fit(d, better, "black", 38, col_w), fill=NAVY)
        y += row_h


def draw_emoji(img, post):
    d = ImageDraw.Draw(img)
    top, bottom = 380, 1110
    card(img, [PAD, top, W - PAD, bottom])
    d = ImageDraw.Draw(img)
    items = post["emojis"]
    big, gap = (150, 70) if len(items) <= 2 else (120, 56)
    eq = font("black", 100)
    total = len(items) * big + (len(items) - 1) * gap + 40 + d.textlength("= ?", font=eq)
    x = (W - total) / 2
    for i, e in enumerate(items):
        if i:
            d.text((x - gap / 2 - 22, top + 70 + big / 2 - 66), "+", font=font("black", 90), fill=ORANGE)
        emoji(img, e, x, top + 70, big)
        x += big + gap
    d.text((x - gap + 40, top + 70 + big / 2 - 62), "= ?", font=eq, fill=ORANGE)
    y = top + 300
    for letter, option in zip("ABCD", post["options"]):
        d.rounded_rectangle([PAD + 40, y, W - PAD - 40, y + 82], radius=41, fill=(250, 244, 240), outline=LINE, width=2)
        d.text((PAD + 76, y + 20), f"{letter})", font=font("black", 36), fill=ORANGE)
        d.text((PAD + 140, y + 20), option, font=fit(d, option, "semibold", 36, W - 2 * PAD - 220), fill=NAVY)
        y += 100
    note = "Choose your answer in the quiz below"
    d.text(((W - d.textlength(note, font=font("bold", 30))) / 2, bottom + 30), note, font=font("bold", 30), fill=WHITE)


def draw_truefalse(img, post):
    d = ImageDraw.Draw(img)
    top, bottom = 380, 1110
    card(img, [PAD, top, W - PAD, bottom])
    d = ImageDraw.Draw(img)
    emoji(img, "🤔", (W - 110) / 2, top + 50, 110)
    sentence = f"“{post['sentence']}”"
    size = 56
    while True:
        f = font("bold", size)
        lines = wrap(d, sentence, f, W - 2 * PAD - 120)
        if len(lines) <= 3 or size <= 38:
            break
        size -= 4
    lh = int(size * 1.3)
    y = top + 200 + (3 - len(lines)) * lh // 2
    for line in lines:
        d.text(((W - d.textlength(line, font=f)) / 2, y), line, font=f, fill=NAVY)
        y += lh
    bw = (W - 2 * PAD - 120) // 2
    for i, (label, colour, mark) in enumerate([("CORRECT", GREEN, "✅"), ("WRONG", RED, "❌")]):
        x = PAD + 40 + i * (bw + 40)
        d.rounded_rectangle([x, bottom - 200, x + bw, bottom - 70], radius=32, fill=colour)
        lf = font("black", 44)
        tw = d.textlength(label, font=lf)
        ex = x + (bw - tw - 72) / 2
        d.ellipse([ex - 6, bottom - 167, ex + 58, bottom - 103], fill=WHITE)
        emoji(img, mark, ex + 4, bottom - 157, 44)
        d.text((ex + 72, bottom - 162), label, font=lf, fill=WHITE)
    note = "Answer and explanation in the quiz below"
    d.text(((W - d.textlength(note, font=font("bold", 30))) / 2, bottom + 30), note, font=font("bold", 30), fill=WHITE)


def note(d, bottom, text):
    f = font("bold", 30)
    d.text(((W - d.textlength(text, font=f)) / 2, bottom + 30), text, font=f, fill=WHITE)


def draw_redflag(img, post):
    top, bottom = 380, 1110
    card(img, [PAD, top, W - PAD, bottom])
    d = ImageDraw.Draw(img)
    y = top + 40
    for head, mark, colour, bg, items in [
        ("RED FLAG", "🚩", RED, (255, 241, 240), post["red"]),
        ("GREEN FLAG", "🟢", GREEN, (236, 250, 242), post["green"]),
    ]:
        emoji(img, mark, PAD + 50, y, 50)
        d.text((PAD + 115, y + 4), head, font=font("black", 40), fill=colour)
        y += 72
        for item in items:
            d.rounded_rectangle([PAD + 40, y, W - PAD - 40, y + 66], radius=20, fill=bg)
            d.text((PAD + 70, y + 14), item, font=fit(d, item, "semibold", 34, W - 2 * PAD - 140), fill=NAVY)
            y += 80
        y += 30
    note(d, bottom, "Comment: how many red flags do you have?")


def draw_collocation(img, post):
    top, bottom = 380, 1110
    card(img, [PAD, top, W - PAD, bottom])
    d = ImageDraw.Draw(img)
    emoji(img, "🧩", (W - 110) / 2, top + 50, 110)
    phrase = post["phrase"]
    f = fit(d, phrase, "black", 70, W - 2 * PAD - 100, 44)
    d.text(((W - d.textlength(phrase, font=f)) / 2, top + 210), phrase, font=f, fill=NAVY)
    bw = (W - 2 * PAD - 140) // 3
    for i, verb in enumerate(["MAKE", "DO", "TAKE"]):
        x = PAD + 40 + i * (bw + 30)
        d.rounded_rectangle([x, top + 380, x + bw, top + 510], radius=30, fill=NAVY)
        vf = font("black", 48)
        d.text((x + (bw - d.textlength(verb, font=vf)) / 2, top + 415), verb, font=vf, fill=WHITE)
    if post.get("bonus"):
        bonus = f"Bonus: {post['bonus']}"
        bf = fit(d, bonus, "semibold", 34, W - 2 * PAD - 100)
        d.text(((W - d.textlength(bonus, font=bf)) / 2, top + 580), bonus, font=bf, fill=GREY)
    note(d, bottom, "Answer and explanation in the quiz below")


def draw_answer(img, d, box, label, colour, bg, text, highlights=()):
    d.rounded_rectangle(box, radius=26, fill=bg)
    lf = font("black", 28)
    d.rounded_rectangle([box[0] + 26, box[1] + 26, box[0] + 64 + d.textlength(label, font=lf), box[1] + 76], radius=25, fill=colour)
    d.text((box[0] + 45, box[1] + 36), label, font=lf, fill=WHITE)
    # mark highlighted phrases so they survive word wrapping
    marked = text
    for phrase in highlights:
        marked = marked.replace(phrase, "\x01" + phrase.replace(" ", "\x02") + "\x01")
    size = 54
    while True:
        f = font("medium", size)
        lines = wrap(d, marked.replace("\x01", ""), f, box[2] - box[0] - 80)
        lh = int(size * 1.4)
        if box[1] + 110 + len(lines) * lh <= box[3] - 30 or size <= 28:
            break
        size -= 2
    # re-wrap keeping the markers to know which words are highlighted
    words, on = [], False
    for token in marked.split(" "):
        hl = on or token.startswith("\x01")
        if token.count("\x01") % 2:
            on = not on
        words.append((token.replace("\x01", "").replace("\x02", " "), hl))
    x, y = box[0] + 40, box[1] + 110
    for word, hl in words:
        wf = font("black" if hl else "medium", size)
        w = d.textlength(word, font=wf)
        if x + w > box[2] - 40:
            x, y = box[0] + 40, y + lh
        d.text((x, y), word, font=wf, fill=ORANGE if hl else NAVY)
        x += w + d.textlength(" ", font=wf)


def draw_band(img, post, slide):
    top, bottom = 380, 1110
    card(img, [PAD, top, W - PAD, bottom])
    d = ImageDraw.Draw(img)
    question = f"“{post['question']}”"
    qf = fit(d, question, "black", 42, W - 2 * PAD - 80, 30)
    d.text(((W - d.textlength(question, font=qf)) / 2, top + 40), question, font=qf, fill=NAVY)
    box = [PAD + 40, top + 120, W - PAD - 40, bottom - 40]
    if slide == 0:
        draw_answer(img, d, box, "BAND 5", GREY, (245, 244, 243), post["band5"])
        note(d, bottom, "Band 8 answer in the next picture  →")
    else:
        draw_answer(img, d, box, "BAND 8", ORANGE, (255, 241, 234), post["band8"], post.get("highlights", ()))
        note(d, bottom, "Write down the words in bold")


def render_slides(post):
    kind = post["kind"]
    if kind == "band":
        slides = []
        for i in range(2):
            img = frame(kind, post["title"], post["subtitle"][i] if isinstance(post["subtitle"], list) else post["subtitle"])
            draw_band(img, post, i)
            slides.append(img)
        return slides
    img = frame(kind, post["title"], post["subtitle"])
    if kind in HEADS:
        draw_pairs(img, kind, post["rows"])
    elif kind == "emoji":
        draw_emoji(img, post)
    elif kind == "truefalse":
        draw_truefalse(img, post)
    elif kind == "redflag":
        draw_redflag(img, post)
    elif kind == "collocation":
        draw_collocation(img, post)
    else:
        raise ValueError(f"Unknown post kind: {kind}")
    return [img]


def render(post):
    return render_slides(post)[0]


def main():
    post = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    for img, out in zip(render_slides(post), sys.argv[2:]):
        img.save(out)


if __name__ == "__main__":
    main()
