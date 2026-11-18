import asyncio
import os

import httpx

MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


async def complete(messages: list[dict], **options) -> dict:
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise OpenRouterError("AI chat needs OPENROUTER_API_KEY in the project .env file.", 503)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                URL,
                headers={"Authorization": f"Bearer {key}"},
                json={"model": MODEL, "messages": messages, **options},
            )
        if response.status_code == 429:
            raise OpenRouterError("OpenRouter is rate limiting requests. Try again later.", 429)
        response.raise_for_status()
        message = response.json()["choices"][0]["message"]
        if not isinstance(message, dict):
            raise ValueError("Expected a completion message.")
        return message
    except httpx.TimeoutException:
        raise OpenRouterError("OpenRouter timed out. Try again.", 504) from None
    except httpx.HTTPStatusError as error:
        raise OpenRouterError(
            f"OpenRouter returned HTTP {error.response.status_code}. Check the key and model availability."
        ) from None
    except (httpx.RequestError, ValueError, LookupError, TypeError):
        raise OpenRouterError("OpenRouter returned no usable response. Try again.") from None


async def smoke_check():
    try:
        message = await complete([{"role": "user", "content": "What is 2+2? Reply with only the digit."}])
    except OpenRouterError as error:
        raise SystemExit(str(error)) from None
    if str(message.get("content", "")).strip().rstrip(".") != "4":
        raise SystemExit("OpenRouter did not answer with 4.")
    print(f"{MODEL} answered 2+2 with 4.")


if __name__ == "__main__":
    asyncio.run(smoke_check())
