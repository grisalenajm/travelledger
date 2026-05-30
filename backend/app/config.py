import logging.config

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    PAPERLESS_URL: str | None = None
    PAPERLESS_TOKEN: str | None = None

    ANTHROPIC_API_KEY: str | None = None

    UNSPLASH_ACCESS_KEY: str | None = None

    BOT_API_KEY: str | None = None

    WEBHOOK_SECRET: str | None = None
    WEBHOOK_USER_EMAIL: str | None = None

    IMAP_HOST: str | None = None
    IMAP_PORT: int = 993
    IMAP_USER: str | None = None
    IMAP_PASSWORD: str | None = None
    IMAP_FOLDER: str = "INBOX"
    IMAP_POLL_INTERVAL_MINUTES: int = 5
    IMAP_SENDER_FILTER: str | None = None

    ALLOW_REGISTRATION: bool = False

    # ── SMTP (envío de emails de invitación) ───────────────────────────
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None   # "Ledger <ledger@dominio.com>" — por defecto usa SMTP_USER
    SMTP_TLS: bool = True          # True → STARTTLS (puerto 587); False → SMTP_SSL (465)

    # ── URL pública de la app (para construir enlaces de invitación) ───
    APP_URL: str = "http://localhost:3000"

    FIREBASE_CREDENTIALS_PATH: str = "/app/secrets/firebase-credentials.json"

    ALLOWED_ORIGINS: str = "http://localhost:3000"
    ALLOWED_HOSTS: str = "*"

    ENV: str = "production"
    LOG_LEVEL: str = "info"

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith(("postgresql+asyncpg://", "postgresql://")):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
        return v

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def allowed_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",")]


settings = Settings()

logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            },
        },
        "root": {
            "level": settings.LOG_LEVEL.upper(),
            "handlers": ["console"],
        },
    }
)
