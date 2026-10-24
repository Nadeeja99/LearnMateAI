"""
Typed application settings, read once from the environment (and backend/.env).

Every tunable lives here; modules import `settings` instead of calling os.getenv.
Field names map to upper-case env vars, e.g. `max_upload_size` <- MAX_UPLOAD_SIZE.
"""

from typing import List, Literal

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Populate os.environ from backend/.env (never overriding real environment variables)
load_dotenv()

DEV_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8501",
]
# Used in production only when CORS_ORIGINS is unset, so existing deploys keep working
DEFAULT_PRODUCTION_ORIGINS = ["https://learnmate-frontend.onrender.com"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    environment: str = "development"

    # OpenAI
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-5.4-mini"
    openai_max_tokens: int = 500
    openai_summary_max_tokens: int = 1500
    openai_quiz_max_tokens: int = 3500  # 20 questions with explanations

    # Observability
    langfuse_enabled: bool = False
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"
    log_level: str = "INFO"
    log_format: Literal["text", "json"] = "text"

    # Storage
    data_dir: str = "data"
    session_ttl_days: float = 30

    # HTTP
    cors_origins: str = ""  # comma-separated
    enable_debug_endpoints: bool = False

    # Abuse & cost limits (0 disables a rate limit)
    max_upload_size: int = 20 * 1024 * 1024
    max_documents_per_session: int = 25
    max_chunks_per_document: int = 2000  # ~1,000 chars per chunk => ~2M chars
    rate_limit_ai_per_minute: int = 20
    rate_limit_ai_per_ip_per_minute: int = 60
    rate_limit_uploads_per_hour: int = 20
    rate_limit_uploads_per_ip_per_hour: int = 60
    # Share rate limits across workers/instances (e.g. redis://host:6379/0); empty = per-process
    redis_url: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def allowed_origins(self) -> List[str]:
        configured = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if self.is_production:
            return configured or DEFAULT_PRODUCTION_ORIGINS
        # Development: local dev servers are always allowed, plus anything configured
        return list(dict.fromkeys(DEV_ORIGINS + configured))

    @property
    def database_path(self) -> str:
        return f"{self.data_dir}/learnmate.db"

    @property
    def sessions_dir(self) -> str:
        return f"{self.data_dir}/sessions"


settings = Settings()
