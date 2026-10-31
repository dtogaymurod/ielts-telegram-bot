"""Render a daily "1 MINUTE HACK" post (Telegram HTML) as a branded poster.

Usage:
  python3 poster/render_post.py post.html out.png
  echo "<post html>" | python3 poster/render_post.py - out.png

The text is drawn from a fixed template, so it is always sharp and spelled
exactly as in the post (no AI image generation involved).
"""
import html
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

FONTS = Path(__file__).parent / "fonts"

W, H = 1080, 1350
PAD = 84
BRAND = "DILSHOD USTOZ"
HANDLE = "@dilshod_english"
INSTAGRAM = "instagram.com/dilshod.ustoz"

NAVY_TOP = (16, 22, 38)
NAVY_BOTTOM = (22, 30, 58)
ORANGE = (226, 83, 42)
WHITE = (255, 255, 255)
SOFT = (196, 205, 222)
MUTED = (138, 150, 175)
PANEL = (32, 42, 70)
GREEN = (52, 199, 120)
RED = (235, 77, 75)

_font_cache = {}


def font(style, size):
    key = (style, size)
    if key not in _font_cache:
        name = {
            "regular": "Inter-Regular", "medium": "Inter-Medium", "semibold": "Inter-SemiBold",
            "bold": "Inter-Bold", "black": "Inter-ExtraBold",
            "italic": "Inter-Italic", "bolditalic": "Inter-MediumItalic",
        }[style]
        _font_cache[key] = ImageFont.truetype(str(FONTS / f"{name}.otf"), size)
    return _font_cache[key]


# ---------------------------------------------------------------- parsing

EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍⃣]"
)
FOOTER_HINTS = ("ulashing", "telegram:", "instagram", "@dilshod")


def clean(text):
    """Turn arrows into a glyph Inter has and drop the remaining emoji."""
    text = text.replace("➡️", "→").replace("➡", "→")
    return EMOJI_RE.sub("", text)


def parse_runs(line):
    """Split a Telegram-HTML line into (text, bold, italic) runs."""
    runs, bold, italic = [], False, False
    for part in re.split(r"(</?[biu]>)", line):
        if part in ("<b>", "</b>"):
            bold = part == "<b>"
        elif part in ("<i>", "</i>"):
            italic = part == "<i>"
        elif part in ("<u>", "</u>"):
            continue
        elif part:
            text = html.unescape(re.sub(r"<[^>]+>", "", part))
            if text:
                runs.append((text, bold, italic))
    return runs


def plain(line):
    return html.unescape(re.sub(r"<[^>]+>", "", line)).strip()


def parse_post(text):
    lines = [ln.rstrip() for ln in text.replace("\r", "").split("\n")]
    label = "IELTS"
    for ln in lines:
        m = re.search(r"IELTS\s+([A-Z]+)", plain(ln))
        if m:
            label = m.group(1)
            break

    blocks, cur = [], []
    for ln in lines:
        if not ln.strip():
            if cur:
                blocks.append(cur)
                cur = []
        else:
            cur.append(ln)
    if cur:
        blocks.append(cur)

    sections = []
    for block in blocks:
        head = plain(block[0])
        if "1 MINUTE HACK" in head.upper() or set(head) <= set("━─-— "):
            # header block: drop the title and separator lines, keep anything after
            block = [b for b in block if "MINUTE HACK" not in plain(b).upper() and not set(plain(b)) <= set("━─-— ")]
            if not block:
                continue
            head = plain(block[0])
        if any(h in head.lower() for h in FOOTER_HINTS):
            continue
        heading_match = re.match(r"^\s*\S*\s*<b>(.+?)</b>\s*$", block[0])
        if heading_match:
            heading = clean(plain(heading_match.group(1))).strip().rstrip(":").strip()
            body = block[1:]
        else:
            heading, body = "", block
        items = []
        for ln in body:
            raw = ln.strip()
            kind = "text"
            for mark, k in (("•", "bullet"), ("❌", "wrong"), ("✅", "right"), ("-", "bullet")):
                if raw.startswith(mark):
                    kind, raw = k, raw[len(mark):].lstrip("️ ").strip()
                    break
            runs = [(clean(t), b, i) for t, b, i in parse_runs(raw)]
            runs = [r for r in runs if r[0].strip()]
            if runs:
                items.append((kind, runs))
        sections.append({"heading": heading, "items": items})
    return label, sections


# ---------------------------------------------------------------- layout

def run_font(bold, italic, size, base="regular"):
    if bold and italic:
        return font("bolditalic", size)
    if bold:
        return font("bold", size)
    if italic:
        return font("italic", size)
    return font(base, size)


def layout_runs(draw, runs, size, max_w, base="regular", fixed=None):
    """Word-wrap styled runs. Returns lines of [(x, word, font)]."""
    words = []
    for text, bold, italic in runs:
        f = fixed or run_font(bold, italic, size, base)
        for i, w in enumerate(re.split(r"(\s+)", text)):
            if w and not w.isspace():
                words.append((w, f))
            elif w:
                words.append((" ", f))
    lines, line, x = [], [], 0
    for w, f in words:
        if w == " ":
            if line:
                x += draw.textlength(" ", font=f)
            continue
        wl = draw.textlength(w, font=f)
        if line and x + wl > max_w:
            lines.append(line)
            line, x = [], 0
        line.append((x, w, f))
        x += wl
    if line:
        lines.append(line)
    return lines


def wrap_plain(draw, text, f, max_w):
    return layout_runs(draw, [(text, False, False)], f.size, max_w, fixed=f)


class Canvas:
    def __init__(self, scale):
        self.s = scale
        self.img = Image.new("RGB", (W, H))
        self.d = ImageDraw.Draw(self.img)

    def px(self, v):
        return int(round(v * self.s))


def background():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        c = tuple(int(NAVY_TOP[i] + (NAVY_BOTTOM[i] - NAVY_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-260, -260, 420, 380], fill=(90, 34, 24))
    gd.ellipse([W - 360, H - 420, W + 300, H + 200], fill=(26, 44, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    return ImageChops.screen(img, glow)


def draw_lines(d, lines, x0, y, line_h, fill):
    for line in lines:
        for x, w, f in line:
            d.text((x0 + x, y), w, font=f, fill=fill)
        y += line_h
    return y


def render_sections(d, sections, scale, dry=False, top=310):
    """Draw (or just measure, if dry) the content area. Returns bottom y."""
    s = lambda v: int(round(v * scale))
    y = top
    inner_w = W - 2 * PAD
    for idx, sec in enumerate(sections):
        is_rule = idx > 0
        if is_rule:
            box_top = y
            x0, max_w = PAD + 48, inner_w - 84
            y += 40
        else:
            x0, max_w = PAD, inner_w

        if sec["heading"]:
            hf = font("black" if not is_rule else "bold", s(62 if not is_rule else 44))
            hlines = wrap_plain(d, sec["heading"], hf, max_w)
            if not dry:
                draw_lines(d, hlines, x0, y, int(hf.size * 1.18), ORANGE if is_rule else WHITE)
            y += int(hf.size * 1.18) * len(hlines) + s(22)

        size = s(36 if not is_rule else 34)
        line_h = int(size * 1.42)
        for kind, runs in sec["items"]:
            indent = 0 if kind == "text" else s(52)
            lines = layout_runs(d, runs, size, max_w - indent)
            if not dry and kind != "text":
                cy = y + size * 0.62
                r = s(15) if kind != "bullet" else s(7)
                cx = x0 + s(16)
                if kind == "bullet":
                    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ORANGE)
                else:
                    col = GREEN if kind == "right" else RED
                    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
                    if kind == "right":
                        d.line([(cx - r * .45, cy), (cx - r * .1, cy + r * .4), (cx + r * .5, cy - r * .4)], fill=WHITE, width=max(3, s(4)))
                    else:
                        k = r * .42
                        d.line([(cx - k, cy - k), (cx + k, cy + k)], fill=WHITE, width=max(3, s(4)))
                        d.line([(cx - k, cy + k), (cx + k, cy - k)], fill=WHITE, width=max(3, s(4)))
            if not dry:
                color = WHITE if is_rule else SOFT
                draw_lines(d, lines, x0 + indent, y, line_h, color)
            y += line_h * len(lines) + s(14)

        if is_rule:
            y += 26
            if not dry:
                # panel goes behind the text: draw it on a separate layer later
                d._rule_boxes.append((box_top, y))
        y += s(46)
    return y - s(46)


def render(text):
    label, sections = parse_post(text)
    if not sections:
        raise ValueError("Post has no content sections to draw")

    img = background()
    d = ImageDraw.Draw(img)
    d._rule_boxes = []

    # pick the largest scale that fits above the footer
    area_top, area_bottom = 300, H - 200
    scale = 1.0
    while scale > 0.6 and render_sections(d, sections, scale, dry=True, top=area_top) > area_bottom:
        scale -= 0.04
    # the caption no longer repeats the post, so the poster must show all of it
    if render_sections(d, sections, scale, dry=True, top=area_top) > area_bottom:
        raise ValueError("Post is too long to fit on the poster")
    # centre the content block vertically in the free area
    height = render_sections(d, sections, scale, dry=True, top=0)
    top = area_top + max(0, (area_bottom - area_top - height) // 2)

    # panels first, then text on top
    probe = ImageDraw.Draw(Image.new("RGB", (W, H)))
    probe._rule_boxes = []
    render_sections(probe, sections, scale, top=top)
    for box_top, box_bottom in probe._rule_boxes:
        d.rounded_rectangle([PAD, box_top, W - PAD, box_bottom], radius=28, fill=PANEL, outline=(60, 72, 108), width=2)
    render_sections(d, sections, scale, top=top)

    # header
    bf = font("black", 40)
    d.text((PAD, 96), BRAND, font=bf, fill=WHITE)
    x = PAD + d.textlength(BRAND + " ", font=bf)
    d.text((x, 96), "| IELTS", font=bf, fill=ORANGE)
    pill = f"{label} · 1 MINUTE HACK"
    pf = font("bold", 26)
    pw = d.textlength(pill, font=pf)
    d.rounded_rectangle([PAD, 180, PAD + pw + 52, 236], radius=28, fill=ORANGE)
    d.text((PAD + 26, 193), pill, font=pf, fill=WHITE)

    # footer
    d.line([PAD, H - 150, W - PAD, H - 150], fill=(52, 62, 92), width=2)
    hf = font("bold", 32)
    d.text((PAD, H - 108), HANDLE, font=hf, fill=WHITE)
    sf = font("medium", 26)
    d.text((W - PAD - d.textlength(INSTAGRAM, font=sf), H - 102), INSTAGRAM, font=sf, fill=MUTED)
    return img


def main():
    src, out = sys.argv[1], sys.argv[2]
    text = sys.stdin.read() if src == "-" else Path(src).read_text(encoding="utf-8")
    render(text).save(out, optimize=True)
    print(out)


if __name__ == "__main__":
    main()
