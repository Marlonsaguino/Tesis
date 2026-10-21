from contextlib import contextmanager
from pathlib import Path
import threading
from fastapi import HTTPException
from app.core.config import settings

_ready = False
_lock = threading.Lock()

def connect():
    # Import lazily: AI remains available when optional database support isn't configured.
    import psycopg
    from psycopg.rows import dict_row
    if settings.DB_HOST not in ('127.0.0.1','localhost','::1'):
        raise ValueError('La instalación actual solo admite PostgreSQL local.')
    if settings.DB_USER == 'postgres':
        raise ValueError('Utiliza el usuario exclusivo de NexoMail.')
    return psycopg.connect(host=settings.DB_HOST,port=settings.DB_PORT,
        dbname=settings.DB_NAME,user=settings.DB_USER,
        password=settings.DB_PASSWORD.get_secret_value(),connect_timeout=5,
        options='-c search_path=nexomail -c statement_timeout=10000',row_factory=dict_row)

def initialize():
    global _ready
    if _ready:return
    with _lock:
        if _ready:return
        with connect() as connection:
            connection.execute('SELECT pg_advisory_xact_lock(73180621)')
            connection.execute(Path(__file__).with_name('schema.sql').read_text(encoding='utf-8'))
        _ready=True

@contextmanager
def database():
    if not settings.DB_ENABLED:
        raise HTTPException(503,'Activa PostgreSQL ejecutando CONFIGURAR_BASE_DATOS.cmd.')
    try:
        initialize()
        connection=connect()
    except Exception:
        # Never include connection strings, passwords or provider response bodies.
        raise HTTPException(503,'No se pudo conectar con PostgreSQL. Revisa el servicio y la configuración local de la base de datos.') from None
    try:
        with connection:
            yield connection
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503,'No se pudo guardar o recuperar la información. Los cambios no están confirmados en PostgreSQL.') from None
