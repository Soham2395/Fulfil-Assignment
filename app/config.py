from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    app_name: str = Field(default="Acme Products Importer")
    environment: str = Field(default="development")

    # CORS
    cors_origins: str = Field(default="*")

    # Database
    database_url: str = Field(default="postgresql+psycopg2://user:password@localhost:5432/acme")

    # Redis / Celery
    redis_url: str = Field(default="redis://localhost:6379/0")
    broker_url: str = Field(default="redis://localhost:6379/1")
    result_backend: str = Field(default="redis://localhost:6379/2")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
