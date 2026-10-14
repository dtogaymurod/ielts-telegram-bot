"""Render IELTS Writing sample posters in the channel's brand style.

Usage:
  python3 poster/render_writing.py sample.json out.png

sample.json is one entry of content/writing-samples.json:
  task 1 -> draws its "chart" (bar, line or pie) as an exam-style graph
  task 2 -> draws the essay question on a card

Task 1 "chart":
{
  "chart": "bar" | "line" | "pie",
  "title": "Percentage of households with internet access, 2000-2020",
  "unit": "%",                       # optional; "%" adds a % sign to y labels
  "categories": ["2000", "2005", ...],   # x labels (pie: slice names)
  "series": [{"name": "UK", "values": [..]}, ...]   # pie: one series
}
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

from render_post import (
    BRAND, HANDLE, INSTAGRAM, MUTED, ORANGE, PAD, WHITE, H, W,
    PANEL, SOFT, background, font, wrap_plain,
)

SS = 2  # supersampling factor for smooth chart lines
CARD_TEXT = (31, 41, 55)
GRID = (226, 230, 238)
AXIS = (148, 158, 178)
PALETTE = [(226, 83, 42), (37, 99, 235), (16, 163, 127), (234, 179, 8), (139, 92, 246), (100, 116, 139)]


def nice_max(v):
    if v <= 0:
        return 1
    exp = 10 ** math.floor(math.log10(v))
    for m in (1, 2, 2.5, 5, 10):
        if m * exp >= v:
            return m * exp
    return 10 * exp


def fmt(v):
    return f"{v:g}"


def legend(d, series, x, y, max_x, s):
    f = font("semibold", 26 * s)
    for i, ser in enumerate(series):
        w = d.textlength(ser["name"], font=f) + 60 * s
        if x + w > max_x:
            x, y = 40 * s, y + 46 * s
        d.rounded_rectangle([x, y + 6 * s, x + 26 * s, y + 32 * s], radius=6 * s, fill=PALETTE[i % len(PALETTE)])
        d.text((x + 38 * s, y + 2 * s), ser["name"], font=f, fill=CARD_TEXT)
        x += w
    return y + 46 * s


def axes_chart(spec, cw, ch):
    s = SS
    img = Image.new("RGB", (cw * s, ch * s), WHITE)
    d = ImageDraw.Draw(img)
    series, cats = spec["series"], spec["categories"]
    top = legend(d, series, 40 * s, 30 * s, (cw - 40) * s, s) + 10 * s
    left, right, bottom = 110 * s, (cw - 40) * s, (ch - 80) * s
    vmax = nice_max(max(v for ser in series for v in ser["values"]))
    tick_f = font("medium", 24 * s)
    for k in range(6):
        val = vmax * k / 5
        y = bottom - (bottom - top) * k / 5
        d.line([(left, y), (right, y)], fill=GRID, width=2 * s)
        label = fmt(val) + (spec.get("unit", "") if spec.get("unit") == "%" else "")
        d.text((left - 16 * s - d.textlength(label, font=tick_f), y - 14 * s), label, font=tick_f, fill=MUTED)
    d.line([(left, bottom), (right, bottom)], fill=AXIS, width=2 * s)

    n = len(cats)
    slot = (right - left) / n
    for j, c in enumerate(cats):
        cx = left + slot * (j + 0.5)
        d.text((cx - d.textlength(c, font=tick_f) / 2, bottom + 18 * s), c, font=tick_f, fill=CARD_TEXT)

    ypos = lambda v: bottom - (bottom - top) * v / vmax
    if spec["chart"] == "bar":
        group = slot * 0.72
        bw = group / len(series)
        for i, ser in enumerate(series):
            for j, v in enumerate(ser["values"]):
                x0 = left + slot * j + (slot - group) / 2 + bw * i
                d.rounded_rectangle([x0 + 3 * s, ypos(v), x0 + bw - 3 * s, bottom], radius=6 * s,
                                    fill=PALETTE[i % len(PALETTE)], corners=(True, True, False, False))
    else:
        for i, ser in enumerate(series):
            pts = [(left + slot * (j + 0.5), ypos(v)) for j, v in enumerate(ser["values"])]
            col = PALETTE[i % len(PALETTE)]
            d.line(pts, fill=col, width=6 * s, joint="curve")
            for x, y in pts:
                d.ellipse([x - 9 * s, y - 9 * s, x + 9 * s, y + 9 * s], fill=WHITE, outline=col, width=5 * s)
    return img.resize((cw, ch), Image.LANCZOS)


def pie_chart(spec, cw, ch):
    s = SS
    img = Image.new("RGB", (cw * s, ch * s), WHITE)
    d = ImageDraw.Draw(img)
    values = spec["series"][0]["values"]
    total = sum(values)
    r = min(cw * 0.5, ch - 80) / 2 * s
    cx, cy = 40 * s + r, ch * s / 2
    start = -90
    lab_f = font("bold", 26 * s)
    for i, v in enumerate(values):
        ext = 360 * v / total
        col = PALETTE[i % len(PALETTE)]
        d.pieslice([cx - r, cy - r, cx + r, cy + r], start, start + ext, fill=col, outline=WHITE, width=4 * s)
        mid = math.radians(start + ext / 2)
        if ext > 18:
            pct = f"{round(100 * v / total)}%"
            tx, ty = cx + math.cos(mid) * r * 0.65, cy + math.sin(mid) * r * 0.65
            d.text((tx - d.textlength(pct, font=lab_f) / 2, ty - 16 * s), pct, font=lab_f, fill=WHITE)
        start += ext
    # legend to the right
    f = font("semibold", 28 * s)
    lx = cx + r + 50 * s
    ly = cy - len(values) * 30 * s
    for i, (name, v) in enumerate(zip(spec["categories"], values)):
        d.rounded_rectangle([lx, ly + 8 * s, lx + 28 * s, ly + 36 * s], radius=6 * s, fill=PALETTE[i % len(PALETTE)])
        d.text((lx + 42 * s, ly + 2 * s), name, font=f, fill=CARD_TEXT)
        ly += 60 * s
    return img.resize((cw, ch), Image.LANCZOS)


def frame(pill):
    img = background()
    d = ImageDraw.Draw(img)

    bf = font("black", 40)
    d.text((PAD, 96), BRAND, font=bf, fill=WHITE)
    d.text((PAD + d.textlength(BRAND + " ", font=bf), 96), "| IELTS", font=bf, fill=ORANGE)
    pf = font("bold", 26)
    d.rounded_rectangle([PAD, 180, PAD + d.textlength(pill, font=pf) + 52, 236], radius=28, fill=ORANGE)
    d.text((PAD + 26, 193), pill, font=pf, fill=WHITE)

    d.line([PAD, H - 150, W - PAD, H - 150], fill=(52, 62, 92), width=2)
    d.text((PAD, H - 108), HANDLE, font=font("bold", 32), fill=WHITE)
    sf = font("medium", 26)
    d.text((W - PAD - d.textlength(INSTAGRAM, font=sf), H - 102), INSTAGRAM, font=sf, fill=MUTED)
    return img, d


def draw_wrapped(d, text, f, x, y, max_w, line_h, fill):
    for line in wrap_plain(d, text, f, max_w):
        for lx, w, lf in line:
            d.text((x + lx, y), w, font=lf, fill=fill)
        y += line_h
    return y


def render_task1(spec):
    pill = "WRITING TASK 1 · " + {"bar": "BAR CHART", "line": "LINE GRAPH", "pie": "PIE CHART"}[spec["chart"]]
    img, d = frame(pill)
    y = draw_wrapped(d, spec["title"], font("bold", 40), PAD, 290, W - 2 * PAD, 52, WHITE) + 30

    cw, ch = W - 2 * PAD, H - 200 - y
    chart = pie_chart(spec, cw, ch) if spec["chart"] == "pie" else axes_chart(spec, cw, ch)
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=28, fill=255)
    img.paste(chart, (PAD, y), mask)
    return img


def render_task2(sample):
    img, d = frame(f"WRITING TASK 2 · {sample.get('type', 'ESSAY')}")
    inner = W - 2 * PAD - 96
    # shrink the question until the card fits between header and footer
    for size in range(46, 27, -2):
        lines = wrap_plain(d, sample["question"], font("semibold", size), inner)
        card_h = 96 + len(lines) * int(size * 1.4) + 110
        if card_h <= H - 200 - 300:
            break
    top = 300 + (H - 200 - 300 - card_h) // 2
    d.rounded_rectangle([PAD, top, W - PAD, top + card_h], radius=32, fill=PANEL, outline=(60, 72, 108), width=2)
    d.text((PAD + 48, top + 40), "SAVOL", font=font("bold", 24), fill=ORANGE)
    y = draw_wrapped(d, sample["question"], font("semibold", size), PAD + 48, top + 88,
                     inner, int(size * 1.4), WHITE)
    d.text((PAD + 48, y + 34), "Band 8+ namuna javob izohdagi havolada", font=font("medium", 28), fill=SOFT)
    return img


def render(sample):
    return render_task1(sample["chart"]) if sample["task"] == 1 else render_task2(sample)


def main():
    sample = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    render(sample).save(sys.argv[2], optimize=True)
    print(sys.argv[2])


if __name__ == "__main__":
    main()
