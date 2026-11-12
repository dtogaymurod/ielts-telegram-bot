"""Small explanatory pictures drawn at the top of the white card.

A post may carry an optional "visual" object:
  {"type": "flow", "sep": "→", "items": [["👀", "Read"], ["🎧", "Listen"]]}
      icons (an emoji or a few letters) with labels; sep is → + = ≠ or vs
  {"type": "swap", "wrong": "March 3th", "right": "3 March"}
  {"type": "form", "heading": "NOTES", "text": "costs ___ per week", "tag": "price?", "icon": "💷"}
  {"type": "lines", "series": [["cars", "up", "🚗"], ["buses", "down", "🚌"]]}
  {"type": "bars", "items": [["men", 100], ["women", 50]]}
  {"type": "pie", "items": [[25, "a quarter"], [33, "a third"], [42, "the largest share"]]}
"""
from PIL import ImageDraw

from render_genz import GREEN, GREY, NAVY, ORANGE, RED, WHITE, emoji, fit
from render_post import font

HEIGHT = 230
TINT = (255, 244, 236)
SOFT_LINE = (238, 222, 212)
COLOURS = [ORANGE, NAVY, GREEN, GREY]


def is_text(icon):
    return all(ord(c) < 0x2300 for c in icon)


def flow(img, d, v, box):
    items, sep = v["items"], v.get("sep", "→")
    n = len(items)
    cell = (box[2] - box[0]) / n
    cy, r = box[1] + 88, 58
    for i, (icon, label) in enumerate(items):
        cx = box[0] + cell * (i + 0.5)
        if is_text(icon):
            f = fit(d, icon, "black", 50, 190, 28)
            w = max(2 * r, d.textlength(icon, font=f) + 48)
            d.rounded_rectangle([cx - w / 2, cy - r, cx + w / 2, cy + r], radius=r, fill=WHITE)
            b = d.textbbox((0, 0), icon, font=f)
            d.text((cx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2), icon, font=f, fill=ORANGE)
        else:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
            emoji(img, icon, cx - 36, cy - 36, 72)
            d = ImageDraw.Draw(img)
        lf = fit(d, label, "bold", 28, cell - 24, 20)
        d.text((cx - d.textlength(label, font=lf) / 2, cy + r + 16), label, font=lf, fill=NAVY)
        if i < n - 1:
            sf = font("black", 34 if sep == "vs" else 44)
            sx = box[0] + cell * (i + 1)
            b = d.textbbox((0, 0), sep, font=sf)
            d.text((sx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2), sep, font=sf, fill=ORANGE)
    return d


def swap(img, d, v, box):
    pairs = ((v["wrong"], RED, (255, 232, 230), "❌"), (v["right"], GREEN, (226, 247, 235), "✅"))
    mid = (box[0] + box[2]) / 2
    half = mid - box[0] - 70
    probe = font("black", 32)
    stacked = any(d.textlength(text, font=probe) > half - 110 for text, *_ in pairs)
    if stacked:  # long phrases: one above the other, full width
        width, tile_h = box[2] - box[0] - 60, 84
        spots = [(box[0] + 30, box[1] + 24 + tile_h / 2), (box[0] + 30, box[3] - 24 - tile_h / 2)]
    else:
        width, tile_h = half, 124
        cy = (box[1] + box[3]) / 2
        spots = [(box[0] + 30, cy), (mid + 40, cy)]
    for (text, colour, tint, mark), (x0, cy) in zip(pairs, spots):
        d.rounded_rectangle([x0, cy - tile_h / 2, x0 + width, cy + tile_h / 2], radius=24, fill=WHITE, outline=tint, width=6)
        emoji(img, mark, x0 + 22, cy - 22, 44)
        d = ImageDraw.Draw(img)
        f = fit(d, text, "black", 44, width - 110, 24)
        b = d.textbbox((0, 0), text, font=f)
        tx, ty = x0 + 84, cy - (b[1] + b[3]) / 2
        d.text((tx, ty), text, font=f, fill=NAVY if colour == GREEN else GREY)
        if colour == RED:
            d.line([tx - 4, cy, tx + b[2] + 4, cy], fill=RED, width=4)
    if not stacked:
        af = font("black", 46)
        b = d.textbbox((0, 0), "→", font=af)
        d.text((mid - 15 - (b[0] + b[2]) / 2, spots[0][1] - (b[1] + b[3]) / 2), "→", font=af, fill=ORANGE)
    return d


def form(img, d, v, box):
    px0, py0, px1, py1 = box[0] + 40, box[1] + 28, box[2] - 40, box[3] - 32
    d.rounded_rectangle([px0, py0 + 6, px1, py1 + 6], radius=14, fill=SOFT_LINE)
    d.rounded_rectangle([px0, py0, px1, py1], radius=14, fill=WHITE)
    d.text((px0 + 30, py0 + 18), v["heading"], font=font("bold", 24), fill=GREY)
    d.line([px0 + 30, py0 + 58, px1 - 30, py0 + 58], fill=SOFT_LINE, width=2)
    f = font("semibold", 40)
    before, after = v["text"].split("___")
    x, y = px0 + 30, py0 + 86
    d.text((x, y), before, font=f, fill=NAVY)
    x += d.textlength(before, font=f)
    tf = font("black", 30)
    gap_w = d.textlength(v["tag"], font=tf) + 84
    d.rounded_rectangle([x, y - 8, x + gap_w, y + 56], radius=10, outline=ORANGE, width=4, fill=TINT)
    emoji(img, v["icon"], x + 14, y + 2, 40)
    d = ImageDraw.Draw(img)
    d.text((x + 64, y + 4), v["tag"], font=tf, fill=ORANGE)
    d.text((x + gap_w + 12, y), after, font=f, fill=NAVY)
    return d


def lines(img, d, v, box):
    x0, y0, x1, y1 = box[0] + 60, box[1] + 30, box[2] - 340, box[3] - 36
    d.line([x0, y0, x0, y1, x1, y1], fill=GREY, width=4)
    for gy in range(1, 4):
        yy = y1 - gy * (y1 - y0) / 4
        d.line([x0 + 4, yy, x1, yy], fill=SOFT_LINE, width=2)
    shapes = {"up": [0.15, 0.3, 0.5, 0.72, 0.92], "down": [0.9, 0.72, 0.6, 0.4, 0.2],
              "flat": [0.5, 0.55, 0.48, 0.52, 0.5], "wave": [0.3, 0.75, 0.35, 0.8, 0.45]}
    series = v["series"]
    ly = (box[1] + box[3]) / 2 - len(series) * 32 + 8
    for (label, trend, icon), col in zip(series, COLOURS):
        pts = [(x0 + 20 + i * (x1 - x0 - 40) / 4, y1 - h * (y1 - y0)) for i, h in enumerate(shapes[trend])]
        d.line(pts, fill=col, width=8, joint="curve")
        for p in pts:
            d.ellipse([p[0] - 9, p[1] - 9, p[0] + 9, p[1] + 9], fill=WHITE, outline=col, width=5)
        lx = x1 + 44
        emoji(img, icon, lx, ly - 4, 44)
        d = ImageDraw.Draw(img)
        d.text((lx + 58, ly - 2), label, font=fit(d, label, "black", 32, 220, 22), fill=col)
        ly += 64
    return d


def bars(img, d, v, box):
    items = v["items"]
    top = max(val for _, val in items)
    x0, x1, y0, y1 = box[0] + 70, box[2] - 70, box[1] + 26, box[3] - 62
    d.line([x0 - 20, y1, x1 + 20, y1], fill=GREY, width=4)
    cell = (x1 - x0) / len(items)
    bw = min(120, cell * 0.55)
    for i, (label, val) in enumerate(items):
        cx = x0 + cell * (i + 0.5)
        h = (y1 - y0) * val / top
        d.rounded_rectangle([cx - bw / 2, y1 - h, cx + bw / 2, y1], radius=12, fill=COLOURS[0] if val == top else NAVY)
        d.rectangle([cx - bw / 2, y1 - min(h, 12), cx + bw / 2, y1], fill=COLOURS[0] if val == top else NAVY)
        lf = fit(d, label, "bold", 26, cell - 16, 18)
        d.text((cx - d.textlength(label, font=lf) / 2, y1 + 14), label, font=lf, fill=NAVY)
    return d


def pie(img, d, v, box):
    r = (box[3] - box[1]) / 2 - 24
    cx, cy = box[0] + 60 + r, (box[1] + box[3]) / 2
    items = v["items"]
    total = sum(p for p, _ in items)
    start = -90
    ly = cy - len(items) * 28 + 4
    for (pct, label), col in zip(items, COLOURS):
        end = start + 360 * pct / total
        d.pieslice([cx - r, cy - r, cx + r, cy + r], start, end, fill=col, outline=TINT, width=5)
        start = end
        lx = cx + r + 60
        d.rounded_rectangle([lx, ly + 6, lx + 30, ly + 36], radius=8, fill=col)
        text = f"{pct}% = {label}"
        d.text((lx + 46, ly), text, font=fit(d, text, "bold", 30, box[2] - lx - 70, 20), fill=NAVY)
        ly += 56
    return d


KINDS = {"flow": flow, "swap": swap, "form": form, "lines": lines, "bars": bars, "pie": pie}


def draw(img, v, box):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=28, fill=TINT)
    return KINDS[v["type"]](img, d, v, box)
