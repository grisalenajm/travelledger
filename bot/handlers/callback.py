import logging

from telegram import Update
from telegram.ext import Application, CallbackQueryHandler, ContextTypes

logger = logging.getLogger(__name__)


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    # FASE 8: ✅ confirmar | ✏️ editar | ❌ cancelar
    await query.edit_message_text("🚧 Inline keyboards disponibles en FASE 8.")


def register(app: Application) -> None:
    app.add_handler(CallbackQueryHandler(handle_callback))
