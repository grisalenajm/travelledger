import io
import logging
from pathlib import Path
from uuid import UUID

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_effective_user_id, require_not_guest
from app.database import get_db
from app.models.trip_leg import TripLeg
from app.models.user import User
from app.schemas.boarding_pass import BoardingPassOcrResult
from app.schemas.trip_leg import TripLegCreate, TripLegRead, TripLegUpdate
from app.services import boarding_pass_service, leg_service, settings_service
from app.services.ocr_providers.base import OcrProviderNotConfiguredError
from app.services.trip_service import get_or_404 as get_trip_or_404

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trips", tags=["legs"], redirect_slashes=False)


@router.get("/{trip_id}/legs", response_model=list[TripLegRead])
async def list_legs(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await leg_service.list_legs(db, trip_id, effective_id)


@router.post("/{trip_id}/legs", response_model=TripLegRead, status_code=status.HTTP_201_CREATED)
async def create_leg(
    trip_id: UUID,
    data: TripLegCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    leg = await leg_service.create(db, trip_id, user.id, data)
    background_tasks.add_task(leg_service.geocode_leg_bg, leg.id)
    return leg


@router.post("/{trip_id}/legs/geocode-pending")
async def geocode_pending_legs(
    trip_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    """Queue background geocoding for all legs missing coordinates in this trip."""
    pending = await leg_service.geocode_pending(db, trip_id, user.id)
    for leg_id in pending:
        background_tasks.add_task(leg_service.geocode_leg_bg, leg_id)
    return {"queued": len(pending)}


@router.put("/{trip_id}/legs/{leg_id}", response_model=TripLegRead)
async def update_leg(
    trip_id: UUID,
    leg_id: UUID,
    data: TripLegUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    leg = await leg_service.update(db, trip_id, leg_id, user.id, data)
    background_tasks.add_task(leg_service.geocode_leg_bg, leg.id)
    return leg


@router.post("/{trip_id}/legs/{leg_id}/geocode", response_model=TripLegRead)
async def geocode_leg(
    trip_id: UUID,
    leg_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    await leg_service.geocode_leg_bg(leg_id)
    return await leg_service._get_leg_or_404(db, trip_id, leg_id, user.id)


@router.delete("/{trip_id}/legs/{leg_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leg(
    trip_id: UUID,
    leg_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    await leg_service.delete(db, trip_id, leg_id, user.id)


@router.post("/{trip_id}/legs/{leg_id}/document", response_model=TripLegRead)
async def upload_leg_document(
    trip_id: UUID,
    leg_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    return await leg_service.upload_document(db, trip_id, leg_id, user.id, file)


@router.get("/{trip_id}/legs/{leg_id}/document")
async def get_leg_document(
    trip_id: UUID,
    leg_id: UUID,
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    doc_path = await leg_service.get_document_path(db, trip_id, leg_id, effective_id)
    path = Path(doc_path)
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Archivo no encontrado en disco")

    suffix = path.suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
        ".webp": "image/webp",
    }
    media_type = media_types.get(suffix, "application/octet-stream")

    async def _stream():
        async with aiofiles.open(doc_path, "rb") as f:
            while chunk := await f.read(65536):
                yield chunk

    return StreamingResponse(_stream(), media_type=media_type)


@router.post("/{trip_id}/legs/{leg_id}/boarding-pass", response_model=BoardingPassOcrResult)
async def upload_boarding_pass(
    trip_id: UUID,
    leg_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_not_guest),
):
    """OCR de tarjeta de embarque con Haiku Vision.

    - Valida que el leg existe, pertenece al trip y es mode=flight.
    - Valida MIME por magic bytes (jpg/png/webp/pdf).
    - Guarda la imagen como documento del leg (igual que /document).
    - Devuelve los campos extraídos — el frontend confirma antes de hacer PUT al leg.
    """
    # Validar que el leg existe y es tipo flight
    await get_trip_or_404(db, trip_id, current_user.id)
    result = await db.execute(
        select(TripLeg).where(TripLeg.id == leg_id, TripLeg.trip_id == trip_id)
    )
    leg = result.scalar_one_or_none()
    if not leg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leg no encontrado")
    if leg.mode != "flight":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Solo se puede escanear boarding pass en legs de tipo flight",
        )

    # Leer bytes y validar tamaño
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Archivo demasiado grande. Máximo 10 MB")

    # Validar MIME por magic bytes (igual que leg_service._validate_and_get_ext)
    h = image_bytes[:12]
    if h[:3] == b"\xff\xd8\xff":
        media_type = "image/jpeg"
    elif h[:4] == b"\x89PNG":
        media_type = "image/png"
    elif h[:4] == b"%PDF":
        media_type = "application/pdf"
    elif h[:4] == b"RIFF" and h[8:12] == b"WEBP":
        media_type = "image/webp"
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Formato no soportado. Usa JPG, PNG, WebP o PDF.",
        )

    # OCR con el motor configurado por el usuario
    try:
        ocr_result = await boarding_pass_service.extract_boarding_pass(
            image_bytes, media_type, db, current_user.id
        )
    except OcrProviderNotConfiguredError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    except Exception as exc:
        logger.error("Boarding pass OCR error leg=%s: %s", leg_id, exc)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Error procesando la tarjeta de embarque",
        )

    # Guardar imagen como documento del leg (misma lógica que /document)
    fake_file = UploadFile(
        filename=file.filename or "boarding_pass",
        file=io.BytesIO(image_bytes),
        headers=file.headers,
    )
    await leg_service.upload_document(db, trip_id, leg_id, current_user.id, fake_file)

    return ocr_result
