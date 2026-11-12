"""Render a picture-first poster: the card is one big drawing, with only a few
words on it. The explanation lives in the post's caption, not on the picture.
Used by the Multilevel channel (content/multilevel-posts.json).

Usage:
  python3 poster/render_visual.py post.json out.png
  echo '<post json>' | python3 poster/render_visual.py - out.png

post.json:
  {"pill": "SPEAKING", "title": "...", "subtitle": "...", "theme": "green",
   "note": "optional line under the card", "art": {"type": ..., ...}}

art types (every "icon" is one emoji):
  grid     {"items": [[icon, label, small?], ...]}              2, 3, 4 or 6 tiles
  steps    {"items": [[icon, label, small?], ...]}              2-4 numbered steps on a path
  versus   {"left": {"head", "items": [[icon, text]]}, "right": {...}}   ❌ side vs ✅ side;
                                                                a side with "mark" (an emoji) is neutral
  timeline {"marks": ["2020", "now"], "span": "for 5 years", "flag": "since 2020",
            "chips": [[icon, text], ...]}                       a time line with a span and a flag
  letter   {"lines": [[text, tag?], ...]}                       a sheet of paper; tagged lines stand out,
                                                                "" draws a few placeholder lines
  stairs   {"items": [[label, small?], ...], "icon": "🚩"}      rising steps
  bubbles  {"items": [["q" or "a", text], ...]}                 a chat: questions left, answers right
  clock    {"items": [[share, label, icon], ...], "centre": "20 min"}   a ring split into parts
  map      {"items": [[icon, label], ...]}                      a small street map with 4 labelled places
"""
import json
import math
import sys
from pathlib import Path

from PIL import ImageDraw

import render_genz
from render_genz import GREEN, GREY, NAVY, RED, WHITE, card, emoji, fit, frame, note, wrap
from render_post import PAD, W, font

TOP, BOTTOM = 380, 1110
X0, X1, Y0, Y1 = PAD + 36, W - PAD - 36, TOP + 36, BOTTOM - 36
RED_TINT, GREEN_TINT = (255, 232, 230), (226, 247, 235)
PAPER_LINE = (226, 230, 236)


def accent():
    return render_genz.ORANGE


def tint():
    return render_genz.THEME["tint"]


def soft():
    return render_genz.THEME["soft"]


def centred(d, text, cx, y, f, fill):
    d.text((cx - d.textlength(text, font=f) / 2, y), text, font=f, fill=fill)


def icon_disc(img, ch, cx, cy, r, fill=WHITE):
    ImageDraw.Draw(img).ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    size = int(r * 1.22)
    emoji(img, ch, cx - size / 2, cy - size / 2, size)
    return ImageDraw.Draw(img)


def grid(img, d, art):
    items = art["items"]
    n = len(items)
    cols = {2: 2, 3: 3, 4: 2, 6: 3}[n]
    rows = math.ceil(n / cols)
    gap = 24
    tw = (X1 - X0 - gap * (cols - 1)) / cols
    th = (Y1 - Y0 - gap * (rows - 1)) / rows
    for i, item in enumerate(items):
        icon, label, small = (list(item) + [""])[:3]
        x = X0 + (i % cols) * (tw + gap)
        y = Y0 + (i // cols) * (th + gap)
        d.rounded_rectangle([x, y, x + tw, y + th], radius=32, fill=soft())
        r = min(tw, th) * (0.27 if rows > 1 else 0.3)
        text_h = 50 + (36 if small else 0)
        cy = y + (th - text_h) / 2 - 6
        d = icon_disc(img, icon, x + tw / 2, cy, r)
        ty = cy + r + 18
        centred(d, label, x + tw / 2, ty, fit(d, label, "black", 38 if cols == 2 else 30, tw - 28, 20), NAVY)
        if small:
            centred(d, small, x + tw / 2, ty + 48, fit(d, small, "semibold", 26, tw - 28, 18), accent())
    return d


def steps(img, d, art):
    items = art["items"]
    n = len(items)
    row = (Y1 - Y0) / n
    lx = X0 + 52
    for i in range(n - 1):  # dotted path between the numbers
        y = Y0 + row * (i + 0.5) + 50
        while y < Y0 + row * (i + 1.5) - 50:
            d.ellipse([lx - 5, y - 5, lx + 5, y + 5], fill=tint())
            y += 22
    for i, item in enumerate(items):
        icon, label, small = (list(item) + [""])[:3]
        cy = Y0 + row * (i + 0.5)
        d.ellipse([lx - 42, cy - 42, lx + 42, cy + 42], fill=accent())
        nf = font("black", 44)
        b = d.textbbox((0, 0), str(i + 1), font=nf)
        d.text((lx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2), str(i + 1), font=nf, fill=WHITE)
        bx0, half = X0 + 130, min(row / 2 - 12, 76)
        d.rounded_rectangle([bx0, cy - half, X1, cy + half], radius=30, fill=soft())
        d = icon_disc(img, icon, bx0 + 78, cy, min(half - 12, 56))
        tx, tw = bx0 + 160, X1 - bx0 - 190
        lf = fit(d, label, "black", 40, tw, 24)
        if small:
            d.text((tx, cy - 44), label, font=lf, fill=NAVY)
            d.text((tx, cy + 8), small, font=fit(d, small, "semibold", 28, tw, 18), fill=accent())
        else:
            b = d.textbbox((0, 0), label, font=lf)
            d.text((tx, cy - (b[1] + b[3]) / 2), label, font=lf, fill=NAVY)
    return d


def versus(img, d, art):
    gap = 24
    cw = (X1 - X0 - gap) / 2
    sides = ((art["left"], RED, RED_TINT, "❌", X0), (art["right"], GREEN, GREEN_TINT, "✅", X0 + cw + gap))
    for side, colour, bg, mark, x in sides:
        if side.get("mark"):  # two equal sides (not wrong vs right): own icon, theme colours
            colour, bg, mark = GREEN, soft(), side["mark"]
        d.rounded_rectangle([x, Y0, x + cw, Y1], radius=32, fill=bg)
        d.rounded_rectangle([x + 24, Y0 + 24, x + cw - 24, Y0 + 96], radius=36, fill=WHITE)
        emoji(img, mark, x + 44, Y0 + 40, 40)
        d = ImageDraw.Draw(img)
        d.text((x + 98, Y0 + 40), side["head"], font=fit(d, side["head"], "black", 32, cw - 140, 20), fill=NAVY)
        items = side["items"]
        row = (Y1 - Y0 - 130) / len(items)
        for i, (icon, text) in enumerate(items):
            cy = Y0 + 122 + row * (i + 0.5)
            # long sentences wrap onto up to three lines under a smaller icon
            size, f = 34, font("black", 34)
            lines = wrap(d, text, f, cw - 40)
            while len(lines) > 3 and size > 22:
                size -= 2
                f = font("black", size)
                lines = wrap(d, text, f, cw - 40)
            lh = int(size * 1.22)
            r = min(row / 2 - 34, 62) - (len(lines) - 1) * 9
            top = cy - (2 * r + 12 + len(lines) * lh) / 2 + 6
            d = icon_disc(img, icon, x + cw / 2, top + r, r)
            ty = top + 2 * r + 12
            for line in lines:
                centred(d, line, x + cw / 2, ty, f, NAVY if colour == GREEN else (120, 70, 70))
                ty += lh
    # "vs" badge in the middle
    cx, cy = (X0 + X1) / 2, (Y0 + Y1) / 2 + 40
    d.ellipse([cx - 44, cy - 44, cx + 44, cy + 44], fill=NAVY, outline=WHITE, width=6)
    vf = font("black", 32)
    b = d.textbbox((0, 0), "vs", font=vf)
    d.text((cx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2), "vs", font=vf, fill=WHITE)
    return d


def timeline(img, d, art):
    d.rounded_rectangle([X0, Y0, X1, Y0 + 370], radius=32, fill=soft())
    ly = Y0 + 230
    lx0, lx1 = X0 + 60, X1 - 70
    d.line([lx0, ly, lx1, ly], fill=NAVY, width=8)
    d.polygon([(lx1 + 26, ly), (lx1 - 4, ly - 18), (lx1 - 4, ly + 18)], fill=NAVY)
    start, now = lx0 + 110, lx1 - 130
    # the span (for ...): a thick coloured bar over the line with a label above
    d.rounded_rectangle([start, ly - 13, now, ly + 13], radius=13, fill=accent())
    sf = fit(d, art["span"], "black", 38, now - start - 20, 22)
    sw = d.textlength(art["span"], font=sf)
    mid = (start + now) / 2
    d.rounded_rectangle([mid - sw / 2 - 22, ly - 100, mid + sw / 2 + 22, ly - 38], radius=31, fill=WHITE)
    centred(d, art["span"], mid, ly - 94, sf, accent())
    d.line([start + 6, ly - 34, now - 6, ly - 34], fill=accent(), width=4)
    for x in (start + 6, now - 6):
        d.line([x, ly - 46, x, ly - 22], fill=accent(), width=4)
    # the flag (since ...): planted at the starting point
    d.line([start, ly, start, ly - 170], fill=NAVY, width=6)
    ff = fit(d, art["flag"], "black", 30, 260, 20)
    fw = d.textlength(art["flag"], font=ff) + 36
    d.polygon([(start, ly - 172), (start + fw, ly - 172), (start + fw - 20, ly - 145),
               (start + fw, ly - 118), (start, ly - 118)], fill=NAVY)
    d.text((start + 16, ly - 164), art["flag"], font=ff, fill=WHITE)
    for x, label in zip((start, now), art["marks"]):
        d.ellipse([x - 17, ly - 17, x + 17, ly + 17], fill=WHITE, outline=NAVY, width=7)
        centred(d, label, x, ly + 34, font("black", 32), NAVY)
    chips = art.get("chips", [])
    ch = (Y1 - Y0 - 370 - 24) / max(1, len(chips))
    for i, (icon, text) in enumerate(chips):
        y = Y0 + 394 + i * ch
        d.rounded_rectangle([X0, y, X1, y + ch - 16], radius=28, fill=soft())
        cy = y + (ch - 16) / 2
        d = icon_disc(img, icon, X0 + 66, cy, 40)
        f = fit(d, text, "black", 38, X1 - X0 - 160, 22)
        b = d.textbbox((0, 0), text, font=f)
        d.text((X0 + 130, cy - (b[1] + b[3]) / 2), text, font=f, fill=NAVY)
    return d


def letter(img, d, art):
    px0, px1 = X0 + 50, X1 - 250
    d.rounded_rectangle([px0 + 10, Y0 + 12, px1 + 10, Y1 + 8], radius=18, fill=tint())
    d.rounded_rectangle([px0, Y0, px1, Y1], radius=18, fill=WHITE, outline=PAPER_LINE, width=3)
    d.polygon([(px1 - 60, Y0), (px1, Y0 + 60), (px1 - 60, Y0 + 60)], fill=PAPER_LINE)
    lines = art["lines"]
    weights = [1.0 if text else 1.5 for text, *_ in lines]
    unit = (Y1 - Y0 - 70) / sum(weights)
    y = Y0 + 40
    for (text, *tag), weight in zip(lines, weights):
        h = unit * weight
        cy = y + h / 2
        if not text:  # placeholder writing
            for k, w in enumerate((1.0, 0.94, 0.62)):
                ly = cy - 26 + k * 26
                d.rounded_rectangle([px0 + 40, ly - 6, px0 + 40 + (px1 - px0 - 90) * w, ly + 6], radius=6, fill=PAPER_LINE)
        else:
            f = fit(d, text, "black", 34, px1 - px0 - 80, 20)
            b = d.textbbox((0, 0), text, font=f)
            tw = d.textlength(text, font=f)
            if tag and tag[0]:
                d.rounded_rectangle([px0 + 26, cy - 30, px0 + 54 + tw, cy + 30], radius=14, fill=tint())
                d.text((px0 + 40, cy - (b[1] + b[3]) / 2), text, font=f, fill=accent())
                # arrow from the tag chip to the line
                tf = fit(d, tag[0], "black", 26, 190, 16)
                cw = d.textlength(tag[0], font=tf) + 36
                cx0 = X1 - cw
                d.line([px0 + 62 + tw, cy, cx0 - 8, cy], fill=accent(), width=4)
                d.ellipse([px0 + 56 + tw, cy - 7, px0 + 70 + tw, cy + 7], fill=accent())
                d.rounded_rectangle([cx0, cy - 27, X1, cy + 27], radius=27, fill=accent())
                d.text((cx0 + 18, cy - 17), tag[0], font=tf, fill=WHITE)
            else:
                d.text((px0 + 40, cy - (b[1] + b[3]) / 2), text, font=f, fill=NAVY)
        y += h
    return d


def stairs(img, d, art):
    items = art["items"]
    n = len(items)
    gap = 18
    sw = (X1 - X0 - gap * (n - 1)) / n
    base, low, high = Y1, 250, Y1 - Y0 - 110
    for i, item in enumerate(items):
        label, small = (list(item) + [""])[:2]
        h = low + (high - low) * i / max(1, n - 1)
        x = X0 + i * (sw + gap)
        last = i == n - 1
        d.rounded_rectangle([x, base - h, x + sw, base], radius=28, fill=accent() if last else tint())
        lf = fit(d, label, "black", 64 if n <= 3 else 48, sw - 30, 24)
        centred(d, label, x + sw / 2, base - h + 34, lf, WHITE if last else accent())
        if small:
            f = font("semibold", 26)
            lines = wrap(d, small, f, sw - 32)[:4]
            yy = base - 40 - len(lines) * 34
            for line in lines:
                centred(d, line, x + sw / 2, yy, f, WHITE if last else NAVY)
                yy += 34
        if last and art.get("icon"):
            emoji(img, art["icon"], x + sw / 2 - 42, base - h - 96, 84)
            d = ImageDraw.Draw(img)
    return d


def bubbles(img, d, art):
    items = art["items"]
    f = font("bold", 40)
    max_w = 580
    laid = [(side, wrap(d, text, f, max_w)) for side, text in items]
    heights = [len(lines) * 52 + 48 for _, lines in laid]
    gap = min(44, (Y1 - Y0 - sum(heights)) / max(1, len(items) - 1))
    y = Y0 + (Y1 - Y0 - sum(heights) - gap * (len(items) - 1)) / 2
    for (side, lines), h in zip(laid, heights):
        w = max(d.textlength(line, font=f) for line in lines) + 60
        asked = side == "q"
        x = X0 + 96 if asked else X1 - 96 - w
        fill = soft() if asked else accent()
        d.rounded_rectangle([x, y, x + w, y + h], radius=30, fill=fill)
        tail = [(x + 6, y + h - 34), (x - 20, y + h), (x + 34, y + h - 8)] if asked else \
               [(x + w - 6, y + h - 34), (x + w + 20, y + h), (x + w - 34, y + h - 8)]
        d.polygon(tail, fill=fill)
        ty = y + 20
        for line in lines:
            d.text((x + 30, ty), line, font=f, fill=NAVY if asked else WHITE)
            ty += 52
        d = icon_disc(img, "🧑‍🏫" if asked else "🙋", X0 + 40 if asked else X1 - 40, y + h - 36, 40, tint())
        y += h + gap
    return d


def clock(img, d, art):
    items = art["items"]
    r = 215
    cx, cy = X0 + r + 20, (Y0 + Y1) / 2
    total = sum(share for share, *_ in items)
    shades = [accent(), NAVY, GREEN, (245, 180, 60), GREY, RED]
    start = -90
    for (share, label, icon), col in zip(items, shades):
        end = start + 360 * share / total
        d.pieslice([cx - r, cy - r, cx + r, cy + r], start, end, fill=col, outline=WHITE, width=8)
        start = end
    d.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=WHITE)
    words = art.get("centre", "").split()
    cf = font("black", 44)
    yy = cy - len(words) * 26
    for word in words:
        centred(d, word, cx, yy, cf, NAVY)
        yy += 52
    lx = cx + r + 46
    row = min(118, (Y1 - Y0) / len(items))
    y = cy - row * len(items) / 2
    for (share, label, icon), col in zip(items, shades):
        d.rounded_rectangle([lx, y + 8, X1, y + row - 8], radius=24, fill=soft())
        d.rounded_rectangle([lx, y + 8, lx + 14, y + row - 8], radius=7, fill=col)
        emoji(img, icon, lx + 30, y + row / 2 - 28, 56)
        d = ImageDraw.Draw(img)
        d.text((lx + 100, y + row / 2 - 22), label, font=fit(d, label, "black", 34, X1 - lx - 116, 18), fill=NAVY)
        y += row
    return d


def street_map(img, d, art):
    d.rounded_rectangle([X0, Y0, X1, Y1], radius=32, fill=GREEN_TINT)
    road = (214, 220, 228)
    hx, hy = (X0 + X1) / 2, (Y0 + Y1) / 2
    d.rectangle([X0, hy - 46, X1, hy + 46], fill=road)
    d.rectangle([hx - 46, Y0, hx + 46, Y1], fill=road)
    for x in range(int(X0) + 20, int(X1) - 40, 70):
        if abs(x + 20 - hx) > 70:
            d.rounded_rectangle([x, hy - 4, x + 40, hy + 4], radius=4, fill=WHITE)
    for y in range(int(Y0) + 20, int(Y1) - 40, 70):
        if abs(y + 20 - hy) > 70:
            d.rounded_rectangle([hx - 4, y, hx + 4, y + 40], radius=4, fill=WHITE)
    spots = [(X0 + (hx - 46 - X0) / 2, Y0 + (hy - 46 - Y0) / 2), (hx + 46 + (X1 - hx - 46) / 2, Y0 + (hy - 46 - Y0) / 2),
             (X0 + (hx - 46 - X0) / 2, hy + 46 + (Y1 - hy - 46) / 2), (hx + 46 + (X1 - hx - 46) / 2, hy + 46 + (Y1 - hy - 46) / 2)]
    for (icon, label), (cx, cy) in zip(art["items"], spots):
        d.rounded_rectangle([cx - 160, cy - 118, cx + 160, cy + 118], radius=28, fill=WHITE)
        d = icon_disc(img, icon, cx, cy - 34, 58, soft())
        centred(d, label, cx, cy + 42, fit(d, label, "black", 32, 290, 18), NAVY)
    d = icon_disc(img, "🧍", hx, hy, 40, accent())
    return d


KINDS = {"grid": grid, "steps": steps, "versus": versus, "timeline": timeline, "letter": letter,
         "stairs": stairs, "bubbles": bubbles, "clock": clock, "map": street_map}


def render(post):
    render_genz.use_theme(post.get("theme", "orange"), post.get("exam"), post.get("handle"))
    render_genz.PILLS["visual"] = post["pill"]
    img = frame("visual", post["title"], post["subtitle"])
    card(img, [PAD, TOP, W - PAD, BOTTOM])
    d = ImageDraw.Draw(img)
    d = KINDS[post["art"]["type"]](img, d, post["art"])
    if post.get("note"):
        note(d, BOTTOM, post["note"])
    return img


def main():
    src = sys.stdin.read() if sys.argv[1] == "-" else Path(sys.argv[1]).read_text(encoding="utf-8")
    render(json.loads(src)).save(sys.argv[2])


if __name__ == "__main__":
    main()
