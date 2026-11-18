from dataclasses import dataclass
from secrets import token_urlsafe
from time import monotonic

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

SESSION_COOKIE = "kanban_session"
SESSION_TTL_SECONDS = 8 * 60 * 60
DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"

router = APIRouter(prefix="/api/auth")


@dataclass(frozen=True)
class Session:
    username: str
    expires_at: float


class Credentials(BaseModel):
    username: str
    password: str


async def require_user(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE)
    session = request.app.state.sessions.get(token)
    if session is not None:
        if session.expires_at > monotonic():
            return session.username
        request.app.state.sessions.pop(token, None)

    raise HTTPException(status_code=401, detail="Sign in to continue.")


@router.get("/session")
async def session_status(request: Request, response: Response) -> dict[str, str]:
    response.headers["Cache-Control"] = "no-store"
    return {"username": await require_user(request)}


@router.post("/login")
async def login(
    credentials: Credentials, request: Request, response: Response
) -> dict[str, str]:
    if credentials.username != DEMO_USERNAME or credentials.password != DEMO_PASSWORD:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    sessions: dict[str, Session] = request.app.state.sessions
    now = monotonic()
    for token, session in list(sessions.items()):
        if session.expires_at <= now:
            del sessions[token]
    sessions.pop(request.cookies.get(SESSION_COOKIE), None)

    token = token_urlsafe(32)
    sessions[token] = Session(DEMO_USERNAME, now + SESSION_TTL_SECONDS)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"username": DEMO_USERNAME}


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response) -> None:
    request.app.state.sessions.pop(request.cookies.get(SESSION_COOKIE), None)
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="lax")
