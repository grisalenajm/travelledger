"""Servicio IMAP: descarga emails no leídos usando imaplib (stdlib)."""
import asyncio
import email
import email.policy
import imaplib
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}


@dataclass
class RawEmail:
    message_id: str
    sender: str
    subject: str
    body_text: str
    body_html: str | None = None
    ics_content: str | None = None
    image_attachments: list[tuple[str, bytes]] = field(default_factory=list)
    # tuple: (mime_type, content_bytes)


def _connect(host: str, port: int, user: str, password: str) -> imaplib.IMAP4_SSL:
    import ssl
    ssl_context = ssl.create_default_context()
    imap = imaplib.IMAP4_SSL(host, port, ssl_context=ssl_context, timeout=10)
    imap.login(user, password)
    return imap


def _extract_parts(
    msg: email.message.Message,
) -> tuple[str, str | None, str | None, list[tuple[str, bytes]]]:
    """Returns (body_text, body_html, ics_content, image_attachments)."""
    body_text = ""
    body_html: str | None = None
    ics_content: str | None = None
    image_attachments: list[tuple[str, bytes]] = []

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in disp and not body_text:
                try:
                    body_text = part.get_content()
                except Exception:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset("utf-8") or "utf-8"
                        body_text = payload.decode(charset, errors="replace")
            elif ct == "text/html" and "attachment" not in disp:
                try:
                    body_html = part.get_content()
                except Exception:
                    pass
            elif ct in ("text/calendar", "application/ics"):
                try:
                    ics_content = part.get_content()
                except Exception:
                    pass
            elif ct in SUPPORTED_IMAGE_TYPES:
                payload = part.get_payload(decode=True)
                if payload and len(payload) > 1024:
                    image_attachments.append((ct, payload))
    else:
        try:
            body_text = msg.get_content()
        except Exception:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset("utf-8") or "utf-8"
                body_text = payload.decode(charset, errors="replace")

    return body_text or "", body_html, ics_content, image_attachments


def _fetch_sync(
    host: str,
    port: int,
    user: str,
    password: str,
    folder: str,
    sender_filter: str | None,
) -> list[RawEmail]:
    imap = _connect(host, port, user, password)
    results: list[RawEmail] = []
    try:
        imap.select(folder)
        _, data = imap.search(None, "UNSEEN")
        if not data or not data[0]:
            return results

        nums = data[0].split()
        for num in nums:
            try:
                _, msg_data = imap.fetch(num, "(RFC822)")
                if not msg_data or not msg_data[0]:
                    continue
                raw_bytes = msg_data[0][1]
                msg = email.message_from_bytes(raw_bytes, policy=email.policy.compat32)

                sender = msg.get("From", "")
                if sender_filter and sender_filter.lower() not in sender.lower():
                    continue

                message_id = msg.get("Message-ID", f"<unknown-{num.decode()}>").strip()
                subject = str(msg.get("Subject", ""))
                body_text, body_html, ics_content, image_attachments = _extract_parts(msg)

                imap.store(num, "+FLAGS", "\\Seen")
                try:
                    typ, _ = imap.copy(num, "Processed")
                    if typ == "OK":
                        imap.store(num, "+FLAGS", "\\Deleted")
                except Exception:
                    pass  # quedar como leído es suficiente

                results.append(RawEmail(
                    message_id=message_id,
                    sender=sender,
                    subject=subject,
                    body_text=body_text,
                    body_html=body_html,
                    ics_content=ics_content,
                    image_attachments=image_attachments,
                ))
            except Exception as exc:
                logger.warning("imap_service: error procesando mensaje %s: %s", num, exc)

        try:
            imap.expunge()
        except Exception:
            pass
    finally:
        try:
            imap.logout()
        except Exception:
            pass

    return results


def _test_sync(host: str, port: int, user: str, password: str) -> tuple[bool, str | None]:
    try:
        imap = _connect(host, port, user, password)
        imap.logout()
        return True, None
    except imaplib.IMAP4.error as exc:
        return False, str(exc)
    except Exception as exc:
        return False, str(exc)


async def fetch_unseen_emails(
    host: str,
    port: int,
    user: str,
    password: str,
    folder: str = "INBOX",
    sender_filter: str | None = None,
) -> list[RawEmail]:
    return await asyncio.to_thread(_fetch_sync, host, port, user, password, folder, sender_filter)


async def test_connection(
    host: str, port: int, user: str, password: str
) -> tuple[bool, str | None]:
    return await asyncio.to_thread(_test_sync, host, port, user, password)
