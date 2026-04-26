from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    TELEGRAM_BOT_TOKEN: str
    ANTHROPIC_API_KEY: str
    LEDGER_API_URL: str = "http://backend:8000"
    BOT_API_KEY: str
    BOT_WEBHOOK_URL: str = ""
    BOT_MODE: str = "polling"
    LOG_LEVEL: str = "info"


settings = BotSettings()
