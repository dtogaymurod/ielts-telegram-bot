"""Builders for Multilevel bank posts.

Mixed text convention: Uzbek is written in the old spelling and converted to
the new alphabet; English must be inside **bold** or {plain}; __x__ is bold Uzbek.
"""
import re

PAIRS = [("O'", "Ö"), ("o'", "ö"), ("G'", "Ğ"), ("g'", "ğ"), ("SH", "Ş"), ("Sh", "Ş"), ("sh", "ş"),
         ("CH", "Ç"), ("Ch", "Ç"), ("ch", "ç")]
PROTECT = re.compile(r"\b(Listening|Reading|Speaking|Writing|Audio|Task|Part|Multilevel|IELTS|Telegram)'")
ENGLISH = set("""english check such much which teacher teachers she should show short school change choose cheap
child children each watch shop fish wish with finish catch lunch research technology shall share chair church
wash push fresh shirt shoes shower chat chess chapter character o'clock english's""".split())
ENGLISH = {w for w in ENGLISH if any(x in w for x in ("sh", "ch", "o'", "g'"))}


ERR = []


def conv(t):
    for a, b in PAIRS:
        t = t.replace(a, b)
    return t


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _parts(text):
    return re.split(r"(\*\*.+?\*\*|\{.+?\}|__.+?__)", text)


def _uz(seg):
    for w in re.findall(r"[A-Za-z']+", seg):
        if w.lower() in ENGLISH:
            ERR.append(f"{w!r} in {seg!r}")
    out, pos = "", 0
    for m in PROTECT.finditer(seg):
        out += conv(seg[pos:m.start()]) + m.group(0)
        pos = m.end()
    return out + conv(seg[pos:])


def cap(text):
    """Mixed text -> caption HTML."""
    out = ""
    for p in _parts(text):
        if p.startswith("**"):
            out += f"<b>{esc(p[2:-2])}</b>"
        elif p.startswith("{"):
            out += esc(p[1:-1])
        elif p.startswith("__"):
            out += f"<b>{esc(_uz(p[2:-2]))}</b>"
        else:
            out += esc(_uz(p))
    return out


def plain(text):
    """Mixed text -> poster text."""
    out = ""
    for p in _parts(text):
        if p.startswith("**") or p.startswith("__"):
            out += p[2:-2] if p.startswith("**") else _uz(p[2:-2])
        elif p.startswith("{"):
            out += p[1:-1]
        else:
            out += _uz(p)
    return out


def post(pill, title, sub, art, lines):
    return {"pill": plain(pill), "title": plain(title), "subtitle": plain(sub), "art": art,
            "caption": f"<b>{cap(title)}</b>\n\n" + "\n".join(lines)}


def V(title, sub, items, intro):
    art = {"type": "grid", "items": [[i, en, conv(uz)] for i, en, uz, ex in items]}
    lines = [cap(intro), ""]
    for i, en, uz, ex in items:
        lines += [f"{i} <b>{esc(en)}</b> = {esc(conv(uz))}", f"<i>{esc(ex)}</i>", ""]
    return post("SO'Z BOYLIGI", title, sub, art, lines[:-1])


def PH(pill, title, sub, q, answers, intro, tips=()):
    art = {"type": "bubbles", "items": [["q", q]] + [["a", a] for a in answers]}
    lines = [cap(intro), "", f"❓ {esc(q)}"] + [f"💬 <b>{esc(a)}</b>" for a in answers]
    if tips:
        lines += [""] + [f"💡 {cap(t)}" for t in tips]
    return post(pill, title, sub, art, lines)


def _note(t):
    return re.sub(r"\(([^)]*)\)", lambda m: "(" + conv(m.group(1)) + ")", t)


def GR(title, sub, wrongs, rights, rules, intro):
    wrongs, rights = [_note(w) for w in wrongs], [_note(r) for r in rights]
    art = {"type": "versus", "left": {"head": "Xato", "items": [["🙈", w] for w in wrongs]},
           "right": {"head": conv("To'g'ri"), "items": [["👍", r] for r in rights]}}
    lines = [cap(intro), ""]
    for w, r in zip(wrongs, rights):
        lines += [f"❌ {esc(w)}", f"✅ <b>{esc(r)}</b>", ""]
    lines += [f"📌 {cap(r)}" for r in rules]
    return post("GRAMMATIKA", title, sub, art, lines)


def _rows(kind, pill, title, sub, items, intro, numbered):
    art = {"type": kind, "items": [[i, plain(l)] + ([plain(s)] if s else []) for i, l, s, e in items]}
    lines = [cap(intro), ""]
    for n, (i, l, s, e) in enumerate(items, 1):
        head = f"{n}." if numbered else i
        name = cap(l).replace('<b>', '').replace('</b>', '')
        extra = f" ({cap(s)})" if s else ""
        lines.append(f"{head} <b>{name}</b>{extra}: {cap(e)}")
    return post(pill, title, sub, art, lines)


def STP(pill, title, sub, items, intro):
    return _rows("steps", pill, title, sub, items, intro, True)


def GRD(pill, title, sub, items, intro):
    return _rows("grid", pill, title, sub, items, intro, False)


def VSN(pill, title, sub, left, right, intro, lines, marks=None):
    (lh, li), (rh, ri) = left, right
    l = {"head": plain(lh), "items": [[i, plain(t)] for i, t in li]}
    r = {"head": plain(rh), "items": [[i, plain(t)] for i, t in ri]}
    if marks:
        l["mark"], r["mark"] = marks
    return post(pill, title, sub, {"type": "versus", "left": l, "right": r}, [cap(intro), ""] + [cap(x) for x in lines])


def LTR(pill, title, sub, rows, intro, lines):
    art = {"type": "letter", "lines": [[t] + ([conv(tag)] if tag else []) for t, tag in rows]}
    return post(pill, title, sub, art, [cap(intro), ""] + [cap(x) for x in lines])


def TL(title, sub, marks, span, flag, chips, intro, lines):
    art = {"type": "timeline", "marks": marks, "span": span, "flag": flag, "chips": [[i, plain(t)] for i, t in chips]}
    return post("GRAMMATIKA", title, sub, art, [cap(intro), ""] + [cap(x) for x in lines])
