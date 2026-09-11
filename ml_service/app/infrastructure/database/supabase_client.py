"""
OptiFleet B2B — Infrastructure: Supabase Client
=================================================
Singleton pentru clientul Supabase.
Pattern: Singleton via @lru_cache — o singură instanță per process.
"""
from functools import lru_cache
from supabase import create_client, AsyncClient
from app.core.config import get_settings


@lru_cache
def get_supabase_sync():
    """Client sincron (pentru operații simple)."""
    s = get_settings()
    return create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY)


async def get_supabase() -> AsyncClient:
    """Client async (pentru FastAPI endpoints)."""
    from supabase import acreate_client
    s = get_settings()
    return await acreate_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY)
