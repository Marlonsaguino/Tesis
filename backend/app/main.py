"""Punto de entrada principal de la aplicación FastAPI para el Agente IA Outlook."""

import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import secrets
from app.api.gmail import router as gmail_router
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.health import router as health_router
from app.api.agent import router as agent_router

# Configuración básica de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("agente-ia-outlook")

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API REST del Agente de IA para la gestión segura del correo electrónico en Outlook / Microsoft 365.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Both packaged interfaces call this loopback-only companion server.
app.add_middleware(TrustedHostMiddleware,allowed_hosts=['127.0.0.1','localhost','testserver'])
@app.middleware('http')
async def protect_local_api(request:Request,call_next):
    if request.method=='OPTIONS':return await call_next(request)
    if request.url.path.startswith('/api/'):
        expected=settings.EXTENSION_ACCESS_TOKEN.get_secret_value()
        supplied=request.headers.get('X-EmailAgent-Token','')
        if not expected:return JSONResponse(status_code=503,content={'message':'Configura EXTENSION_ACCESS_TOKEN con CONFIGURAR_SERVIDOR.cmd.'})
        if not secrets.compare_digest(supplied,expected):return JSONResponse(status_code=401,content={'message':'La clave de enlace de la extensión no coincide.'})
        if request.method=='POST' and 'application/json' not in request.headers.get('content-type',''):return JSONResponse(status_code=415,content={'message':'Se requiere JSON.'})
        length=request.headers.get('content-length','0')
        if not length.isdigit() or int(length)>262144:return JSONResponse(status_code=413,content={'message':'Solicitud demasiado grande.'})
    return await call_next(request)
app.add_middleware(CORSMiddleware,allow_origins=[],allow_origin_regex=r'^chrome-extension://[a-p]{32}$',allow_credentials=False,allow_methods=['GET','POST','OPTIONS'],allow_headers=['Content-Type','X-EmailAgent-Token'])

# Manejador global de excepciones para proteger la seguridad y no exponer trazas internas
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error no controlado en {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "Se produjo un error interno en el servidor. Por razones de seguridad los detalles técnicos están restringidos."
        }
    )

# Inclusión de enrutadores con prefijo /api
app.include_router(gmail_router, prefix=settings.API_PREFIX)
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(agent_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["Root"])
async def root():
    """Redirección informativa en la raíz de la API."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health"
    }
