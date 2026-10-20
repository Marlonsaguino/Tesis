"""Endpoints FastAPI para la interacción con el Agente IA de Outlook."""

from typing import List
from starlette.concurrency import run_in_threadpool
from fastapi import APIRouter, status
from app.schemas.agent import (
    AgentChatRequest,
    AgentChatResponse,
    CategoryMapping,
)
from app.services.agent_service import AgentService

router = APIRouter(prefix="/agent", tags=["Agente IA"])


@router.post(
    "/chat",
    response_model=AgentChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Procesar consulta del usuario y generar propuestas de acciones"
)
async def chat_with_agent(request: AgentChatRequest):
    """Recibe la consulta del usuario junto con el contexto de correos (sin tokens MSAL)

    y genera una respuesta en lenguaje natural junto con propuestas de acciones Human-in-the-Loop.
    """
    return await run_in_threadpool(AgentService.process_chat, request)


@router.get(
    "/categories",
    response_model=List[CategoryMapping],
    status_code=status.HTTP_200_OK,
    summary="Obtener categorías de demostración de Outlook"
)
async def get_categories():
    """Devuelve un catálogo de demostración, independiente de Gmail."""
    return AgentService.get_categories()


@router.get('/config', summary='Consultar estado de configuración de IA sin contactar al proveedor')
async def get_agent_configuration():
    from app.core.config import settings
    key = (settings.GEMINI_API_KEY if settings.LLM_PROVIDER=='gemini' else settings.ANTHROPIC_API_KEY).get_secret_value().strip()
    configured = bool(settings.LLM_MODEL.strip()) and (settings.LLM_PROVIDER == 'ollama' or bool(key and not key.startswith('PEGA_')))
    return {'provider':settings.LLM_PROVIDER,'model':settings.LLM_MODEL,'configured':configured,
            'max_output_tokens':settings.LLM_MAX_OUTPUT_TOKENS,'context_chars':settings.LLM_CONTEXT_CHARS,
            'message_limit':settings.LLM_MESSAGE_LIMIT,'verified':False}


@router.get('/gemini-models', summary='Listar modelos Gemini disponibles sin generar texto')
async def get_gemini_models():
    from app.services.llm_service import list_gemini_models
    return await run_in_threadpool(list_gemini_models)
