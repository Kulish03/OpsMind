import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "OpsMind ML & AI Service"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:5000")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

settings = Settings()
