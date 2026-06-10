import io

from PIL import Image

from app.services.image_utils import downscale_for_ocr


def _make_jpeg(width: int, height: int) -> bytes:
    img = Image.new("RGB", (width, height), color=(200, 200, 200))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90)
    return out.getvalue()


def test_large_image_is_downscaled():
    original = _make_jpeg(4000, 3000)
    result = downscale_for_ocr(original, "image/jpeg")

    assert len(result) < len(original)
    img = Image.open(io.BytesIO(result))
    assert max(img.size) <= 1568
    # Mantiene la relación de aspecto 4:3
    assert abs(img.width / img.height - 4 / 3) < 0.01


def test_small_image_untouched():
    original = _make_jpeg(800, 600)
    assert downscale_for_ocr(original, "image/jpeg") is original


def test_pdf_passthrough():
    pdf_bytes = b"%PDF-1.4 fake content"
    assert downscale_for_ocr(pdf_bytes, "application/pdf") is pdf_bytes


def test_corrupt_image_returns_original():
    garbage = b"\xff\xd8\xff" + b"not really a jpeg"
    assert downscale_for_ocr(garbage, "image/jpeg") is garbage


def test_png_with_alpha_downscaled_keeps_png():
    img = Image.new("RGBA", (3000, 2000), color=(10, 20, 30, 128))
    out = io.BytesIO()
    img.save(out, format="PNG")
    result = downscale_for_ocr(out.getvalue(), "image/png")

    reopened = Image.open(io.BytesIO(result))
    assert reopened.format == "PNG"
    assert max(reopened.size) <= 1568
