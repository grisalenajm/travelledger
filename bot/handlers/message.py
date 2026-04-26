import logging

from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, filters

logger = logging.getLogger(__name__)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # FASE 8: classify_intent → create | query | export | set_trip | unknown
    await update.message.reply_text(
        "🚧 Procesamiento de texto libre disponible en FASE 8."
    )


def register(app: Application) -> None:
    app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text)
    )
