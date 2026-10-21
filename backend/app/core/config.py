"""Módulo de configuración general del backend utilizando Pydantic Settings."""

from typing import List, Literal
from pydantic import SecretStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "EmailAgent Gmail y Outlook"
    EXTENSION_ACCESS_TOKEN: SecretStr = SecretStr('')
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DB_ENABLED: bool = False
    DB_HOST: str = '127.0.0.1'
    DB_PORT: int = Field(default=5432, ge=1, le=65535)
    DB_NAME: str = 'nexomail'
    DB_USER: str = 'nexomail_app'
    DB_PASSWORD: SecretStr = SecretStr('')
    
    LLM_PROVIDER: Literal['gemini', 'anthropic', 'ollama'] = 'gemini'
    LLM_MODEL: str = 'gemini-3.5-flash-lite'
    GEMINI_API_KEY: SecretStr = SecretStr('')
    LLM_MESSAGE_LIMIT: int = Field(default=6, ge=1, le=12)
    ANTHROPIC_API_KEY: SecretStr = SecretStr('')
    LLM_MAX_OUTPUT_TOKENS: int = Field(default=1200, ge=256, le=4096)
    LLM_CONTEXT_CHARS: int = Field(default=8000, ge=4000, le=48000)
    OLLAMA_URL: str = "http://127.0.0.1:11434"

    # Orígenes permitidos para CORS (Frontend Angular)
    CORS_ORIGINS: List[str] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
