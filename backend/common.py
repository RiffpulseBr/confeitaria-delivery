import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import HTTPException, status
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

supabase_client: Optional[Client] = None

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_supabase_client() -> Client:
    global supabase_client

    if supabase_client is not None:
        return supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL e SUPABASE_SERVICE_KEY/SUPABASE_KEY precisam estar configurados no backend.",
        )

    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase_client
