import logging

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "👋 Bienvenido a *Ledger Bot*\\.\n\n"
        "Puedo ayudarte a registrar gastos de viaje\\. "
        "Usa /ayuda para ver los comandos disponibles\\.",
        parse_mode="MarkdownV2",
    )


async def ayuda(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "*Comandos disponibles:*\n"
        "/start \\- Iniciar el bot\n"
        "/viaje \\- Ver viaje activo\n"
        "/viajes \\- Listar todos tus viajes\n"
        "/resumen \\- Resumen de gastos del viaje activo\n"
        "/ayuda \\- Mostrar esta ayuda\n\n"
        "También puedes *enviar una foto* de un ticket para registrar el gasto automáticamente\\."
    )
    await update.message.reply_text(text, parse_mode="MarkdownV2")


async def viaje(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("🚧 Funcionalidad disponible en FASE 8.")


async def viajes(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("🚧 Funcionalidad disponible en FASE 8.")


async def resumen(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("🚧 Funcionalidad disponible en FASE 8.")


def register(app: Application) -> None:
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("ayuda", ayuda))
    app.add_handler(CommandHandler("viaje", viaje))
    app.add_handler(CommandHandler("viajes", viajes))
    app.add_handler(CommandHandler("resumen", resumen))
