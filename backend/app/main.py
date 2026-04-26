import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.core.limiter import limiter
from app.database import engine
from app.routers import auth, currencies, expenses, health, legs, loyalty_cards, reports, trips, users

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Ledger backend starting")
    yield
    await engine.dispose()
    logger.info("Ledger backend stopped")


app = FastAPI(
    title="Ledger API",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(users.router)
app.include_router(loyalty_cards.router)
app.include_router(trips.router)
app.include_router(legs.router)
app.include_router(expenses.router)
app.include_router(currencies.router)
app.include_router(reports.router)
