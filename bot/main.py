import asyncio
import json
import logging
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from telegram.ext import Application

import session
from config import settings
from handlers import callback, commands, message, photo

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
)
logger = logging.getLogger(__name__)

HEALTH_PORT = 8080


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            body = json.dumps({"status": "ok", "service": "ledger-bot"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass


def _start_health_server():
    server = HTTPServer(("0.0.0.0", HEALTH_PORT), _HealthHandler)
    logger.info("Health server listening on :%d", HEALTH_PORT)
    server.serve_forever()


async def _post_init(app: Application) -> None:
    asyncio.create_task(session.cleanup_loop())
    logger.info("Session cleanup task started")


def main():
    t = threading.Thread(target=_start_health_server, daemon=True)
    t.start()

    app = (
        Application.builder()
        .token(settings.TELEGRAM_BOT_TOKEN)
        .post_init(_post_init)
        .build()
    )

    commands.register(app)
    message.register(app)
    photo.register(app)
    callback.register(app)

    if settings.BOT_MODE == "webhook":
        logger.info("Starting in webhook mode")
        app.run_webhook(
            listen="0.0.0.0",
            port=8443,
            url_path="/webhook",
            webhook_url=f"{settings.BOT_WEBHOOK_URL}/webhook",
        )
    else:
        logger.info("Starting in polling mode")
        app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
