"""One-off: set channel descriptions, post the welcome poster and pin it.
Runs from .github/workflows/channel-setup.yml. Does not stop on one failed step."""
import json, os, sys, urllib.request, urllib.error, uuid
from pathlib import Path

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
API = f"https://api.telegram.org/bot{TOKEN}/"
HERE = Path(__file__).parent


def call(method, data=None, files=None):
    if files:
        b = uuid.uuid4().hex
        body = b""
        for k, v in (data or {}).items():
            body += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
        for k, path in files.items():
            body += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
            body += path.read_bytes() + b"\r\n"
        body += f"--{b}--\r\n".encode()
        req = urllib.request.Request(API + method, body, {"Content-Type": f"multipart/form-data; boundary={b}"})
    else:
        req = urllib.request.Request(API + method, json.dumps(data or {}).encode(), {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e)


me = call("getMe")["result"]
failed = False
for ch in json.loads((HERE / "channels.json").read_text()):
    chat = ch["chat"]
    m = call("getChatMember", {"chat_id": chat, "user_id": me["id"]})
    r = m.get("result", {})
    print(chat, "rights:", {k: r.get(k) for k in ("status", "can_change_info", "can_post_messages", "can_edit_messages")})
    d = call("setChatDescription", {"chat_id": chat, "description": ch["description"]})
    print(chat, "description:", d.get("ok"), d.get("description", ""))
    p = call("sendPhoto", {"chat_id": chat, "caption": ch["caption"]}, {"photo": HERE / ch["photo"]})
    print(chat, "welcome post:", p.get("ok"), p.get("description", ""))
    if p.get("ok"):
        mid = p["result"]["message_id"]
        pin = call("pinChatMessage", {"chat_id": chat, "message_id": mid, "disable_notification": True})
        print(chat, "pin:", pin.get("ok"), pin.get("description", ""))
        failed |= not pin.get("ok")
    failed |= not (d.get("ok") or "not modified" in d.get("description", "")) or not p.get("ok")
sys.exit(1 if failed else 0)
