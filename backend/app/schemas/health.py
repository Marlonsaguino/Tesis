"""Esquemas de validación Pydantic para el endpoint de estado de salud."""

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str
    service: str
    message: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "ok",
                "service": "Agente IA Outlook",
                "message": "Backend funcionando correctamente"
            }
        }
    )
