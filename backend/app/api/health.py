"""Enrutador para la verificación del estado de salud del backend."""

from fastapi import APIRouter
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Verificar estado de salud del servicio",
    description="Retorna el estado operativo del backend para verificar conectividad desde el frontend u orquestadores."
)
async def get_health() -> HealthResponse:
    """Endpoint de comprobación de salud del sistema."""
    return HealthResponse(
        status="ok",
        service="Agente IA Outlook",
        message="Backend funcionando correctamente"
    )
