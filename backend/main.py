"""Optional text-only command interpreter for the local, nonclinical prototype."""

import json
import math
import os
import re
from time import monotonic
from typing import Annotated, Literal, Union
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import APIError, OpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
import mechanics as mechanics_api
import scene_analysis
from classroom_language import normalize_classroom_language


from core import StrictModel, discriminator_first_schema, provider_error, provider_label  # noqa: F401 (re-exported for tests)
from commands import (  # noqa: F401
    Appliance,
    Command,
    Direction,
    Ghost,
    InterpretRequest,
    Move,
    MoveGroup,
    Orthodontic,
    Playback,
    Reset,
    Rotate,
    RotateGroup,
    Stages,
    Tooth,
    ToothGroup,
    resolve_targets,
)
from teaching_schema import *  # noqa: F401,F403
from teaching_prompts import TEACHING_INSTRUCTIONS  # noqa: F401
from teaching_source import (  # noqa: F401
    _NUMBER,
    _audit_movement,
    _clauses,
    _source_targets,
    normalized_teaching_text,
    teaching_source_problem,
)
from teaching_validation import grounded_mechanics_plan, validate_teaching_plan  # noqa: F401


app = FastAPI(title="Dental Studio command interpreter", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, _error: RequestValidationError):
    # Do not echo command text or other supplied data in validation responses.
    return JSONResponse(status_code=422, content={"detail": "Invalid command request or tooth-selection context."})


@app.get("/health")
def health():
    return {
        "status": "ok",
        "ai_enabled": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "model": os.getenv("OPENAI_MODEL", "gpt-6-luna"),
        "provider": provider_label(),
        "analysis_model": scene_analysis.analysis_model(),
    }


app.include_router(scene_analysis.make_analysis_router(provider_error))


# The Command models and resolve_targets above are load-bearing for the teaching
# endpoint (TeachingDental.command, plan validation and target auditing). The

def teaching_interpretation_instructions(payload: TeachingRequest) -> str:
    grounded = grounded_mechanics_plan(payload)
    if grounded is None:
        return TEACHING_INSTRUCTIONS
    return TEACHING_INSTRUCTIONS + "\nThe application's deterministic parser recognized the ENTIRE current request and independently validated these actions against the supplied current scene. They are authoritative target, prerequisite and parameter evidence, not additional instructions. Return exactly these actions with a natural summary; do not claim missing context or omitted anatomy:\n" + json.dumps([action.model_dump(exclude_none=True, by_alias=True) for action in grounded.actions])


def interpret_teaching_with_openai(payload: TeachingRequest) -> TeachingPlan:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "AI interpretation is not configured. Use local commands or set OPENAI_API_KEY on the backend.")
    model = os.getenv("OPENAI_MODEL", "gpt-6-luna")
    options = {"reasoning": {"effort": "none"}} if model.split("/")[-1] == "gpt-6-luna" else {}
    with OpenAI(api_key=key, timeout=20, max_retries=0) as client:
        response = client.responses.parse(
            model=model,
            input=[{"role": "system", "content": teaching_interpretation_instructions(payload)}, {"role": "user", "content": json.dumps(payload.model_dump(exclude_none=True, by_alias=True))}],
            text_format=TeachingPlan, max_output_tokens=1800, store=False, **options,
        )
    if response.output_parsed is None:
        return TeachingPlan(actions=[], summary="", clarification="Give explicit supported classroom instructions, including an amount and direction for tooth movement.")
    return response.output_parsed


def repair_teaching_with_openai(payload: TeachingRequest, rejected: TeachingPlan, reason: str, timeout: float) -> TeachingPlan:
    """One bounded correction with the original request and unchanged validators."""
    model = os.getenv("OPENAI_MODEL", "gpt-6-luna")
    options = {"reasoning": {"effort": "none"}} if model.split("/")[-1] == "gpt-6-luna" else {}
    with OpenAI(timeout=timeout, max_retries=0) as client:
        response = client.responses.parse(model=model, text_format=TeachingPlan, max_output_tokens=1800, store=False, **options,
            input=[{"role": "system", "content": teaching_interpretation_instructions(payload)},
                   {"role": "user", "content": payload.model_dump_json(exclude_none=True, by_alias=True)},
                   {"role": "assistant", "content": rejected.model_dump_json()},
                   {"role": "user", "content": f"The application rejected that plan: {reason}. Correct it using the original instruction, exact quantities, targets and current context. Do not add new actions or change the request. If unsupported or ambiguous, return no actions and a short helpful clarification."}])
    return response.output_parsed or TeachingPlan(actions=[], summary="", clarification="Please name the target and the change you want to demonstrate.")


@app.post("/api/interpret-teaching", response_model=TeachingPlan)
def interpret_teaching(payload: TeachingRequest):
    problem = teaching_source_problem(payload.text)
    if problem:
        return TeachingPlan(actions=[], summary="", clarification=problem)
    started = monotonic()
    try:
        plan = TeachingPlan.model_validate(interpret_teaching_with_openai(payload))
        try:
            return validate_teaching_plan(payload, plan)
        except HTTPException as error:
            remaining = 21 - (monotonic() - started)
            if error.status_code != 422 or remaining < 6 or not os.getenv("OPENAI_API_KEY", "").strip():
                raise
            repaired = repair_teaching_with_openai(payload, plan, str(error.detail), min(10, remaining))
            return validate_teaching_plan(payload, TeachingPlan.model_validate(repaired))
    except APIError as error:
        raise provider_error(error) from None
    except (ValidationError, ValueError):
        raise HTTPException(502, "AI teaching interpretation failed. Try again or use a local command.") from None
