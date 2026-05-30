import os

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

if os.getenv("SLOWAPI_NO_LIMITS"):
    def _noop(*args, **kwargs):
        def decorator(func):
            return func
        return decorator
    limiter.limit = _noop  # type: ignore[method-assign]
