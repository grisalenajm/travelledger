"""
email_service.py — Envío de emails transaccionales vía SMTP.

La configuración SMTP se lee de la tabla user_settings (claves mail_*) del
usuario que invita, no de variables de entorno.  Si mail_host no está
configurado se loguea advertencia y se omite el envío sin lanzar excepción.

Claves esperadas en user_settings:
    mail_host          — servidor SMTP (ej. "smtp.gmail.com")
    mail_smtp_port     — puerto (int, default 587)
    mail_user          — usuario SMTP
    mail_password      — contraseña (cifrada con Fernet en BD)
    mail_smtp_from     — dirección remitente; si vacío usa mail_user
    mail_smtp_tls      — "true" → STARTTLS (default); "false" → SMTP_SSL
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.settings_service import get as get_setting

logger = logging.getLogger(__name__)


async def _get_smtp_config(db: AsyncSession, user_id: UUID) -> dict | None:
    """Lee configuración SMTP de la BD (claves mail_*).

    Devuelve None si mail_host no está configurado para ese usuario.
    """
    host = await get_setting(db, user_id, "mail_host")
    if not host:
        logger.warning(
            "SMTP no configurado — mail_host vacío para user %s. "
            "Configura mail_host en Settings > Correo para activar el envío.",
            user_id,
        )
        return None

    port_raw = await get_setting(db, user_id, "mail_smtp_port")
    port = int(port_raw) if port_raw and port_raw.isdigit() else 587

    user = await get_setting(db, user_id, "mail_user")
    password = await get_setting(db, user_id, "mail_password")
    from_addr = await get_setting(db, user_id, "mail_smtp_from") or user or "ledger@localhost"

    tls_raw = await get_setting(db, user_id, "mail_smtp_tls")
    # STARTTLS por defecto (True); solo False si se configura explícitamente "false"
    use_tls = (tls_raw or "true").lower() != "false"

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from_addr": from_addr,
        "use_tls": use_tls,
    }


async def send_invite_email(
    db: AsyncSession,
    inviter_id: UUID,
    to_email: str,
    to_name: str,
    invite_url: str,
) -> None:
    """Envía un email de invitación con el enlace de activación.

    Args:
        db:         sesión de base de datos.
        inviter_id: UUID del usuario admin que invita (propietario de la config SMTP).
        to_email:   dirección de destino.
        to_name:    nombre del destinatario (para personalizar el saludo).
        invite_url: URL completa de activación.
    """
    cfg = await _get_smtp_config(db, inviter_id)
    if not cfg:
        return  # Sin SMTP configurado — omitir silenciosamente

    from_addr = cfg["from_addr"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Invitación a Ledger"
    msg["From"] = from_addr
    msg["To"] = to_email

    text_body = (
        f"Hola {to_name},\n\n"
        f"Has sido invitado/a a Ledger.\n\n"
        f"Activa tu cuenta aquí:\n{invite_url}\n\n"
        f"Este enlace expira en 7 días.\n\n"
        f"Si no esperabas esta invitación, puedes ignorar este email."
    )
    html_body = f"""<!DOCTYPE html>
<html lang="es">
<body style="font-family:sans-serif;color:#1c1b1f;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="color:#004d64">Invitación a Ledger</h2>
  <p>Hola <strong>{to_name}</strong>,</p>
  <p>Has sido invitado/a a <strong>Ledger</strong>, la app de gestión de gastos de viaje.</p>
  <p style="margin:32px 0">
    <a href="{invite_url}"
       style="background:#004d64;color:white;padding:12px 28px;text-decoration:none;
              border-radius:24px;font-weight:bold;display:inline-block">
      Activar mi cuenta
    </a>
  </p>
  <p style="font-size:12px;color:#49454f">
    O copia este enlace en tu navegador:<br>
    <code style="word-break:break-all">{invite_url}</code>
  </p>
  <p style="font-size:12px;color:#49454f">Este enlace expira en 7 días.</p>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if cfg["use_tls"]:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                if cfg["password"] and cfg["user"]:
                    smtp.login(cfg["user"], cfg["password"])
                smtp.sendmail(from_addr, to_email, msg.as_string())
        else:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=10) as smtp:
                if cfg["password"] and cfg["user"]:
                    smtp.login(cfg["user"], cfg["password"])
                smtp.sendmail(from_addr, to_email, msg.as_string())

        logger.info("invite_email_sent to=%s url=%s", to_email, invite_url)

    except smtplib.SMTPException as exc:
        logger.error("invite_email_failed to=%s error=%s", to_email, exc)
        raise
    except OSError as exc:
        logger.error("invite_email_network_error to=%s error=%s", to_email, exc)
        raise


async def send_test_email(
    db: AsyncSession,
    user_id: UUID,
    to_email: str,
) -> None:
    """Envía un email de prueba para verificar la configuración SMTP.

    Raises:
        ValueError: si SMTP no está configurado.
        smtplib.SMTPException / OSError: si el envío falla.
    """
    import asyncio

    cfg = await _get_smtp_config(db, user_id)
    if not cfg:
        raise ValueError("SMTP no configurado — mail_host vacío")

    from_addr = cfg["from_addr"]
    subject = "Ledger — Email de prueba"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email

    text_body = (
        "Este es un email de prueba enviado desde Ledger.\n"
        "Si lo recibes, la configuración SMTP es correcta."
    )
    html_body = (
        "<p>Este es un email de prueba enviado desde Ledger.</p>"
        "<p>Si lo recibes, la configuración SMTP es correcta.</p>"
    )

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    def _send_sync() -> None:
        if cfg["use_tls"]:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                if cfg["user"] and cfg["password"]:
                    smtp.login(cfg["user"], cfg["password"])
                smtp.sendmail(from_addr, to_email, msg.as_string())
        else:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=10) as smtp:
                if cfg["user"] and cfg["password"]:
                    smtp.login(cfg["user"], cfg["password"])
                smtp.sendmail(from_addr, to_email, msg.as_string())

    await asyncio.to_thread(_send_sync)
    logger.info("test_email_sent to=%s", to_email)
