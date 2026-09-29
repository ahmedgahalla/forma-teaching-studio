"""Shared model base, schema tweak, and provider error mapping."""

import os
from urllib.parse import urlparse

from fastapi import HTTPException
from openai import APIConnectionError, APIError, APITimeoutError
from pydantic import BaseModel, ConfigDict

def discriminator_first_schema(schema: dict) -> None:
    """Put action identity before inherited fields for constrained JSON generation."""
    properties = schema.get("properties")
    if properties:
        names = [name for name in ("kind", "type", "action") if name in properties]
        names.extend(name for name in properties if name not in names)
        schema["properties"] = {name: properties[name] for name in names}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False,
                              json_schema_extra=discriminator_first_schema)


def provider_label() -> str:
    host = urlparse(os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")).hostname
    return "OpenRouter" if host == "openrouter.ai" else "OpenAI" if host == "api.openai.com" else "Configured AI provider"


def provider_error(error: APIError) -> HTTPException:
    """Translate only allowlisted status/code fields; never expose provider text or keys."""
    status = getattr(error, "status_code", None)
    provider = provider_label()
    if isinstance(error, APITimeoutError):
        return HTTPException(502, f"{provider} timed out. Try again or use a local command.")
    if isinstance(error, APIConnectionError):
        return HTTPException(502, f"{provider} could not be reached. Check the backend computer's internet connection and provider availability, then retry. Local commands still work.")
    if status == 400:
        return HTTPException(502, f"{provider} rejected the configured model or request settings. Check that the backend model supports Responses and structured outputs, then restart the backend after any configuration change. Local commands still work.")
    if status == 403:
        return HTTPException(503, f"{provider} denied access to the configured model. Check the backend API key's project permissions, model access and provider availability in your region. Local commands still work.")
    if status == 404:
        return HTTPException(503, f"{provider} could not find the configured model or API endpoint. Check OPENAI_MODEL and OPENAI_BASE_URL on the backend, then restart it. Local commands still work.")
    if status == 401:
        return HTTPException(503, f"{provider} rejected the backend API key. Replace OPENAI_API_KEY on the computer running Nael Teaching Studio and restart its backend. Local commands still work.")
    if status == 429:
        if getattr(error, "code", None) in (
            "insufficient_quota", "billing_hard_limit_reached",
            "organization_spend_limit_exceeded", "project_spend_limit_exceeded",
            "organization_usage_limit_exceeded",
        ):
            return HTTPException(429, f"{provider} has no available quota. Check its API billing and usage limits; ChatGPT subscription usage is separate. Local commands still work.")
        return HTTPException(429, f"{provider} is temporarily rate limiting requests. Wait briefly and try again, or use a local command.")
    if status == 402:
        return HTTPException(402, f"{provider} needs available API credits. Check the provider's billing settings. Local commands still work.")
    return HTTPException(502, "AI interpretation failed. Try again or use a local command.")
