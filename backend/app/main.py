import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.core.limiter import limiter
from app.database import engine
from app.routers import airlines as airlines_router, airports, auth, currencies, email as email_router, expenses, health, legs, loyalty_cards, notifications as notifications_router, payment_methods as payment_methods_router, pending_legs as pending_legs_router, places as places_router, receipts, reports, settings as settings_router, stats as stats_router, trips, users, webhooks as webhooks_router

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Ledger backend starting")
    from app.services.email_processor import process_pending_emails
    _scheduler.add_job(
        process_pending_emails,
        "interval",
        minutes=settings.IMAP_POLL_INTERVAL_MINUTES,
        id="imap_poll",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
    )
    _scheduler.start()
    logger.info("IMAP scheduler started, interval=%d min", settings.IMAP_POLL_INTERVAL_MINUTES)
    yield
    _scheduler.shutdown(wait=False)
    await engine.dispose()
    logger.info("Ledger backend stopped")


app = FastAPI(
    title="Ledger API",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False,
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.ENV != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middlewares — el último añadido es el más externo (primera capa que ve la request)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    max_age=600,
)
if settings.ALLOWED_HOSTS != "*":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_hosts_list,
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if settings.ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(airports.router)
app.include_router(airlines_router.router)
app.include_router(users.router)
app.include_router(loyalty_cards.router)
app.include_router(trips.router)
app.include_router(legs.router)
app.include_router(expenses.router)
app.include_router(currencies.router)
app.include_router(reports.router)
app.include_router(settings_router.router)
app.include_router(receipts.router)
app.include_router(stats_router.router)
app.include_router(payment_methods_router.router)
app.include_router(notifications_router.router)
app.include_router(webhooks_router.router)
app.include_router(email_router.router)
app.include_router(pending_legs_router.router)
app.include_router(places_router.router)
