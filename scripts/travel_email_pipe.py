#!/usr/bin/env python3
"""Postfix pipe filter: reenvía emails de confirmación de viaje al webhook de Ledger.

Configuración en Postfix:
  1. Crear alias: travel@yourdomain.com → pipe a este script
  2. En /etc/postfix/master.cf:
       travel_email_pipe unix  -  n  n  -  -  pipe
         flags=DRhu user=ledger argv=/usr/local/bin/travel_email_pipe.py
  3. En /etc/postfix/main.cf (transport_maps o aliases):
       travel@yourdomain.com  travel_email_pipe:

  Con Mailcow: crear un script en /opt/mailcow-dockerized/data/hooks/
  que ejecute este script cuando llegue un email a la dirección configurada.

Variables de entorno:
  LEDGER_WEBHOOK_URL    URL del webhook (default: http://YOUR_SERVER:8000/api/webhooks/email)
  LEDGER_WEBHOOK_SECRET Secreto compartido (WEBHOOK_SECRET del .env de Ledger)

Instalar dependencias:
  pip3 install requests
"""
import email
import email.policy
import json
import logging
import os
import sys
import urllib.request
import urllib.error

WEBHOOK_URL = os.environ.get(
    "LEDGER_WEBHOOK_URL",
    "http://YOUR_SERVER:8000/api/webhooks/email",
)
WEBHOOK_SECRET = os.environ.get("LEDGER_WEBHOOK_SECRET", "")

logging.basicConfig(
    filename="/var/log/travel_email_pipe.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("travel_email_pipe")


def main() -> int:
    raw = sys.stdin.buffer.read()
    try:
        msg = email.message_from_bytes(raw, policy=email.policy.default)
    except Exception as exc:
        log.error("Error parseando email: %s", exc)
        return 75  # EX_TEMPFAIL → Postfix reintentará

    message_id = msg.get("Message-ID", "").strip()
    subject = msg.get("Subject", "").strip()
    sender = msg.get("From", "").strip()

    if not message_id:
        import hashlib
        message_id = "<hash-" + hashlib.md5(raw[:512]).hexdigest() + "@local>"

    body_text, body_html, ics_content = _extract_parts(msg)

    payload = {
        "message_id": message_id,
        "sender": sender,
        "subject": subject,
        "body_text": body_text,
    }
    if body_html:
        payload["body_html"] = body_html
    if ics_content:
        payload["ics_content"] = ics_content

    try:
        _post_webhook(payload)
        log.info("OK: %s — %s", message_id, subject)
        return 0
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        log.error("HTTP %d de webhook: %s", exc.code, body)
        return 75 if exc.code >= 500 else 69  # 5xx → retry, 4xx → permanent fail
    except Exception as exc:
        log.error("Error enviando webhook: %s", exc)
        return 75


def _extract_parts(msg: email.message.Message) -> tuple[str, str | None, str | None]:
    """Extrae texto plano, HTML y primer adjunto .ics del mensaje."""
    body_text = ""
    body_html = None
    ics_content = None

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd and not body_text:
                body_text = _decode_part(part)
            elif ct == "text/html" and "attachment" not in cd and not body_html:
                body_html = _decode_part(part)
            elif ct == "text/calendar" or part.get_filename("").endswith(".ics"):
                ics_content = _decode_part(part)
    else:
        body_text = _decode_part(msg)

    return body_text, body_html, ics_content


def _decode_part(part: email.message.Message) -> str:
    try:
        payload = part.get_payload(decode=True)
        if payload is None:
            return ""
        charset = part.get_content_charset("utf-8") or "utf-8"
        return payload.decode(charset, errors="replace")
    except Exception:
        return ""


def _post_webhook(payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Secret": WEBHOOK_SECRET,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


if __name__ == "__main__":
    sys.exit(main())
