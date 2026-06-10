"""Reducción de imágenes antes del OCR — ahorra tokens de visión y latencia.

Una foto de móvil de 12 MP consume ~4x más tokens que la misma imagen
reescalada a 1568 px de lado mayor (el máximo útil para los modelos de
visión), sin pérdida de precisión en tickets y tarjetas de embarque.
"""
import io
import logging

logger = logging.getLogger(__name__)

# Lado mayor máximo que aprovechan los modelos de visión (Claude, GPT-4o, Gemini)
_MAX_SIDE = 1568

_PIL_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def downscale_for_ocr(content: bytes, mime_type: str, max_side: int = _MAX_SIDE) -> bytes:
    """Devuelve la imagen reescalada si su lado mayor supera max_side.

    Solo afecta a los bytes enviados al motor OCR — el archivo original se
    guarda intacto en disco/Paperless. PDFs, formatos desconocidos y errores
    de decodificación devuelven los bytes originales sin tocar.
    """
    fmt = _PIL_FORMATS.get(mime_type)
    if fmt is None:  # PDF u otro formato no rasterizable aquí
        return content

    try:
        from PIL import Image

        img = Image.open(io.BytesIO(content))
        original_size = img.size
        if max(original_size) <= max_side:
            return content

        img.thumbnail((max_side, max_side), Image.LANCZOS)
        if fmt == "JPEG" and img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        out = io.BytesIO()
        save_kwargs = {"quality": 85} if fmt in ("JPEG", "WEBP") else {}
        img.save(out, format=fmt, **save_kwargs)
        result = out.getvalue()

        # Si la re-codificación no compensa (PNGs ya optimizados), usar el original
        if len(result) >= len(content):
            return content

        logger.info(
            "downscale_for_ocr: %dx%d → %dx%d (%.0f KB → %.0f KB)",
            original_size[0], original_size[1], img.width, img.height,
            len(content) / 1024, len(result) / 1024,
        )
        return result
    except Exception as exc:
        logger.warning("downscale_for_ocr: fallo al reescalar (%s) — usando original", exc)
        return content
