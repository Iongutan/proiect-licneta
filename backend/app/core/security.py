"""
OptiFleet B2B — Securitate JWT & RBAC
=======================================
Autentificare cu JWT (access + refresh tokens).
Autorizare cu RBAC (Role-Based Access Control).
Principiu: Zero Trust — fiecare request e verificat.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from enum import Enum

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
from loguru import logger

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, AuthorizationError


# ─── Roluri ─────────────────────────────────────────────────

class UserRole(str, Enum):
    SUPER_ADMIN    = "SUPER_ADMIN"      # Control total platformă
    CARRIER_ADMIN  = "CARRIER_ADMIN"    # Gestionare flotă proprie
    CARRIER_DRIVER = "CARRIER_DRIVER"   # Vizualizare rută proprie
    SME_ADMIN      = "SME_ADMIN"        # Gestionare comenzi companie
    SME_USER       = "SME_USER"         # Plasare comenzi
    SUPPLIER       = "SUPPLIER"         # Confirmare pick-up


class UserContext(BaseModel):
    """Contextul utilizatorului autentificat, disponibil în orice handler."""
    user_id: UUID
    company_id: UUID
    email: str
    roles: list[UserRole]

    def has_role(self, role: UserRole) -> bool:
        return role in self.roles

    def has_any_role(self, *roles: UserRole) -> bool:
        return any(r in self.roles for r in roles)

    def is_carrier(self) -> bool:
        return self.has_any_role(UserRole.CARRIER_ADMIN, UserRole.CARRIER_DRIVER)

    def is_sme(self) -> bool:
        return self.has_any_role(UserRole.SME_ADMIN, UserRole.SME_USER)


# ─── Token Creation ─────────────────────────────────────────

class TokenPayload(BaseModel):
    sub: str        # user_id
    company_id: str
    email: str
    roles: list[str]
    exp: datetime
    type: str       # "access" | "refresh"


def create_access_token(user_context: UserContext) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_context.user_id),
        "company_id": str(user_context.company_id),
        "email": user_context.email,
        "roles": [r.value for r in user_context.roles],
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: UUID) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ─── Token Verification ─────────────────────────────────────

_bearer_scheme = HTTPBearer(auto_error=False)


def _decode_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {e}")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> UserContext:
    """
    FastAPI Dependency — injectat în orice endpoint protejat.
    Verifică JWT și returnează contextul utilizatorului.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    try:
        return UserContext(
            user_id=UUID(payload["sub"]),
            company_id=UUID(payload["company_id"]),
            email=payload["email"],
            roles=[UserRole(r) for r in payload.get("roles", [])],
        )
    except (KeyError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token payload: {e}",
        )


# ─── RBAC Decorator Factory ──────────────────────────────────

def require_roles(*roles: UserRole):
    """
    Factory pentru dependency de autorizare RBAC.
    Utilizare: current_user: UserContext = Depends(require_roles(UserRole.CARRIER_ADMIN))
    """
    async def _check(
        current_user: UserContext = Depends(get_current_user),
    ) -> UserContext:
        if not current_user.has_any_role(*roles):
            logger.warning(
                f"Unauthorized access attempt: user={current_user.email} "
                f"required={roles} has={current_user.roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required roles: {[r.value for r in roles]}",
            )
        return current_user

    return _check
