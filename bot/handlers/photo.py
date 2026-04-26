import logging

from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, filters

logger = logging.getLogger(__name__)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # FASE 8: descargar foto → POST /api/receipts/upload → OcrResultDto → confirmación
    await update.message.reply_text(
        "📷 Foto recibida. El procesamiento OCR estará disponible en FASE 8."
    )


def register(app: Application) -> None:
    app.add_handler(
        MessageHandler(filters.PHOTO | filters.Document.PDF, handle_photo)
    )
