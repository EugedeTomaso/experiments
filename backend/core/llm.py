import json
from typing import Dict, Iterable

import httpx

PROVIDERS: Dict[str, Dict[str, str]] = {
    "openai": {"type": "openai_compatible", "base_url": "https://api.openai.com/v1"},
    "openrouter": {"type": "openai_compatible", "base_url": "https://openrouter.ai/api/v1"},
    "deepseek": {"type": "openai_compatible", "base_url": "https://api.deepseek.com/v1"},
    "cerebras": {"type": "openai_compatible", "base_url": "https://api.cerebras.ai/v1"},
    "groq": {"type": "openai_compatible", "base_url": "https://api.groq.com/openai/v1"},
    "anthropic": {"type": "anthropic", "base_url": "https://api.anthropic.com/v1"},
}


SUMMARY_SYSTEM_PROMPT = (
    "You are a writing assistant. Generate a concise 1-2 sentence summary "
    "of the following document content. Focus on the key theme and main argument. "
    "Do not use markdown formatting. Keep it under 200 characters."
)


def generate_summary_sync(provider: str, api_key: str, model: str, title: str, content_md: str) -> str:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    messages = [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": f'Summarize this document titled "{title}":\n\n{content_md[:3000]}'},
    ]

    if config["type"] == "anthropic":
        return _sync_anthropic(api_key, config["base_url"], model, messages)
    else:
        return _sync_openai_compatible(api_key, config["base_url"], model, messages)


ROUTE_AGENT_SYSTEM_PROMPT = (
    "You are a routing assistant. Given a user's message and a list of available AI assistants, "
    "pick the one that best fits. Respond with ONLY the number (e.g. '1'). "
    "If none is clearly the best fit, respond with '0'."
)


def route_agent_sync(provider: str, api_key: str, model: str, query: str, agents_desc: str) -> str:
    """Pick the best agent for a query. Returns the raw LLM response (a number string)."""
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    messages = [
        {"role": "system", "content": ROUTE_AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Available assistants:\n{agents_desc}\n\nUser message: \"{query}\""},
    ]

    if config["type"] == "anthropic":
        return _sync_anthropic(api_key, config["base_url"], model, messages)
    else:
        return _sync_openai_compatible(api_key, config["base_url"], model, messages)


AUTOCOMPLETE_SYSTEM_PROMPT = (
    "Complete the user's sentence about their writing project. "
    "Output ONLY the completion text — no quotes, no explanation, no markdown. "
    "Complete the current thought in 10-30 words. Do not repeat what the user already wrote."
)

AUTOCOMPLETE_MODEL = "openai/gpt-4.1-nano"
AUTOCOMPLETE_PROVIDER = "openrouter"


def generate_autocomplete_sync(api_key: str, text: str, context: str = "") -> str:
    """Call GPT-4.1 Nano via OpenRouter for fast inline autocomplete."""
    config = PROVIDERS[AUTOCOMPLETE_PROVIDER]
    user_content = text
    if context:
        user_content = f"[Context: {context}]\n\n{text}"

    messages = [
        {"role": "system", "content": AUTOCOMPLETE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    return _sync_openai_compatible(api_key, config["base_url"], AUTOCOMPLETE_MODEL, messages)


def _sync_openai_compatible(api_key: str, base_url: str, model: str, messages: list) -> str:
    url = f"{base_url}/chat/completions"
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 256,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = httpx.post(url, headers=headers, json=body, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def _sync_anthropic(api_key: str, base_url: str, model: str, messages: list) -> str:
    url = f"{base_url}/messages"
    # Anthropic expects system prompt separate from messages
    system_content = ""
    user_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_content = msg["content"]
        else:
            user_messages.append(msg)

    body = {
        "model": model,
        "max_tokens": 256,
        "messages": user_messages,
        "temperature": 0.3,
        "stream": False,
    }
    if system_content:
        body["system"] = system_content

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    response = httpx.post(url, headers=headers, json=body, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data["content"][0]["text"].strip()


REVIEW_SYSTEM_PROMPT_TEMPLATE = (
    "You are an expert writing editor. Your job is to carefully review text and provide "
    "actionable feedback. Always find at least 3 suggestions — even polished writing can "
    "be improved in clarity, word choice, rhythm, or conciseness.\n\n"
    "Focus: {focus}\n\n"
    "For EACH suggestion, return a JSON object with exactly these keys:\n"
    '- "quoted_text": the exact substring from the document (must match character-for-character)\n'
    '- "body": a brief explanation of why you suggest the change\n'
    '- "suggested_text": your proposed replacement text (must not be empty)\n\n'
    "Return ONLY a JSON array. No markdown, no code fences, no explanation outside the array.\n\n"
    "Example:\n"
    '[{{"quoted_text": "She was very tired", "body": "Replace weak modifier with vivid language", '
    '"suggested_text": "Exhaustion pulled at her limbs"}}]'
)

FOCUS_DESCRIPTIONS = {
    "all": "grammar, clarity, style, and overall writing quality",
    "grammar": "grammar, spelling, and punctuation only",
    "clarity": "clarity, readability, and conciseness",
    "style": "style, tone, and flow",
}


CRITIQUE_SYSTEM_PROMPT = (
    "You are a professional writing critic. Analyze the following document "
    "and provide a comprehensive critique.\n\n"
    "For each aspect you evaluate, return a JSON object with:\n"
    '- "title": the aspect name (e.g., "Structure", "Clarity", "Tone", "Argument")\n'
    '- "score": a rating from 1 to 10\n'
    '- "body": your detailed evaluation (2-4 sentences)\n\n'
    "Choose the aspects that are most relevant to THIS specific document. "
    "Typically 4-7 aspects.\n\n"
    "Also provide:\n"
    '- "overall_score": a single 1-10 rating for the document\n'
    '- "summary": a 1-2 sentence executive summary\n\n'
    "Return ONLY valid JSON in this format:\n"
    '{"overall_score": 7, "summary": "...", "sections": [{"title": "...", "score": 7, "body": "..."}, ...]}'
)

MARKETPLACE_SCORE_SYSTEM_PROMPT = """You are a professional fiction reviewer evaluating a manuscript for a reviewer marketplace.

Read the text and return a single JSON object with exactly these keys:
- "overall": float from 0 to 10
- "prose_quality": float from 0 to 10
- "structure": float from 0 to 10
- "consistency": float from 0 to 10
- "completeness": float from 0 to 10
- "summary": string, 2-3 sentence assessment

Return ONLY valid JSON, no markdown fences."""


def generate_review_sync(
    provider: str, api_key: str, model: str, content_md: str, focus: str = "all"
) -> list:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    focus_desc = FOCUS_DESCRIPTIONS.get(focus, FOCUS_DESCRIPTIONS["all"])
    system_prompt = REVIEW_SYSTEM_PROMPT_TEMPLATE.format(focus=focus_desc)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": content_md[:8000]},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
        return []
    except json.JSONDecodeError:
        # LLMs often wrap JSON in markdown code fences — extract the array
        start = raw.find("[")
        end = raw.rfind("]")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                pass
        return []


def generate_critique_sync(
    provider: str, api_key: str, model: str, content_md: str
) -> dict:
    """Generate a holistic document critique. Returns dict with overall_score, summary, sections."""
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    messages = [
        {"role": "system", "content": CRITIQUE_SYSTEM_PROMPT},
        {"role": "user", "content": content_md[:12000]},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, dict) and "sections" in result:
            return result
    except json.JSONDecodeError:
        pass

    # Try extracting JSON object from markdown fences
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            result = json.loads(raw[start : end + 1])
            if isinstance(result, dict) and "sections" in result:
                return result
        except json.JSONDecodeError:
            pass

    return {"overall_score": 0, "summary": "Failed to generate critique.", "sections": []}


def generate_marketplace_score(provider: str, api_key: str, model: str, content_md: str) -> dict:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    truncated = content_md[:30000]
    messages = [
        {"role": "system", "content": MARKETPLACE_SCORE_SYSTEM_PROMPT},
        {"role": "user", "content": truncated},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, dict) and "overall" in result:
            result["model"] = model
            return result
    except json.JSONDecodeError:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            result = json.loads(raw[start : end + 1])
            if isinstance(result, dict) and "overall" in result:
                result["model"] = model
                return result
        except json.JSONDecodeError:
            pass

    return {
        "overall": 0,
        "prose_quality": 0,
        "structure": 0,
        "consistency": 0,
        "completeness": 0,
        "summary": "Failed to generate score.",
        "model": model,
    }


def _sync_openai_compatible_review(api_key: str, base_url: str, model: str, messages: list) -> str:
    url = f"{base_url}/chat/completions"
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": 4096,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = httpx.post(url, headers=headers, json=body, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def _sync_anthropic_review(api_key: str, base_url: str, model: str, messages: list) -> str:
    url = f"{base_url}/messages"
    system_content = ""
    user_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_content = msg["content"]
        else:
            user_messages.append(msg)

    body = {
        "model": model,
        "max_tokens": 4096,
        "messages": user_messages,
        "temperature": 0.5,
        "stream": False,
    }
    if system_content:
        body["system"] = system_content

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    response = httpx.post(url, headers=headers, json=body, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data["content"][0]["text"].strip()


CLAIM_EXTRACTION_PROMPT = (
    "You are a fact-checker. Extract all verifiable factual claims from the text below.\n\n"
    "A verifiable claim is a statement that can be checked against external sources — "
    "dates, statistics, named events, scientific facts, historical assertions, attributions, etc.\n\n"
    "Do NOT extract opinions, subjective judgments, or hypotheticals.\n\n"
    "For each claim, return a JSON object with:\n"
    '- "claim": the factual assertion in a clear, searchable form\n'
    '- "quoted_text": the exact substring from the document (must match character-for-character)\n\n'
    "Return ONLY a JSON array. No markdown, no code fences.\n\n"
    "Example:\n"
    '[{"claim": "The Eiffel Tower was built in 1889", '
    '"quoted_text": "built in 1889"}]'
)


def extract_claims_sync(
    provider: str, api_key: str, model: str, content_md: str
) -> list:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    messages = [
        {"role": "system", "content": CLAIM_EXTRACTION_PROMPT},
        {"role": "user", "content": content_md[:8000]},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
        return []
    except json.JSONDecodeError:
        start = raw.find("[")
        end = raw.rfind("]")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                pass
        return []


VERDICT_PROMPT = (
    "You are a fact-checker. Given a claim and search results from the web, "
    "determine whether the claim is accurate.\n\n"
    "Respond with a JSON object with exactly these keys:\n"
    '- "verdict": one of "verified", "dubious", or "false"\n'
    '  - "verified": the claim is confirmed by reliable sources\n'
    '  - "dubious": sources are contradictory, insufficient, or the claim is misleading\n'
    '  - "false": the claim is clearly incorrect according to sources\n'
    '- "explanation": a brief explanation (1-3 sentences) of why you reached this verdict, citing specific sources\n'
    '- "suggested_text": if the verdict is "false", provide a corrected version of the quoted text. '
    'If "verified" or "dubious", set to empty string.\n\n'
    "Return ONLY the JSON object. No markdown, no code fences."
)


def verify_claim_sync(
    provider: str, api_key: str, model: str, claim: str, quoted_text: str, sources: list
) -> dict:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    sources_text = "\n\n".join(
        f"Source: {s.get('title', 'Untitled')} ({s.get('url', '')})\n{s.get('text', '')}"
        for s in sources
    )

    user_content = (
        f"Claim: {claim}\n\n"
        f"Original text: \"{quoted_text}\"\n\n"
        f"Search results:\n{sources_text}"
    )

    messages = [
        {"role": "system", "content": VERDICT_PROMPT},
        {"role": "user", "content": user_content},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, dict):
            return result
        return {"verdict": "dubious", "explanation": "Could not parse verdict.", "suggested_text": ""}
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                pass
        return {"verdict": "dubious", "explanation": "Could not parse verdict.", "suggested_text": ""}


def stream_chat(provider: str, api_key: str, payload: dict) -> Iterable[bytes]:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    provider_type = config["type"]
    base_url = payload.get("base_url") or config["base_url"]

    if provider_type == "anthropic":
        yield from _stream_anthropic(api_key, base_url, payload)
    else:
        yield from _stream_openai_compatible(api_key, base_url, payload)


def _stream_openai_compatible(api_key: str, base_url: str, payload: dict) -> Iterable[bytes]:
    url = f"{base_url}/chat/completions"
    body = {
        "model": payload.get("model"),
        "messages": payload.get("messages", []),
        "temperature": payload.get("temperature", 0.7),
        "stream": True,
    }
    if payload.get("max_tokens"):
        body["max_tokens"] = payload["max_tokens"]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.stream("POST", url, headers=headers, json=body, timeout=None) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                if line.startswith("data:"):
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        yield b"event: done\ndata: [DONE]\n\n"
                        break
                    try:
                        payload_json = json.loads(data)
                        delta = payload_json["choices"][0]["delta"].get("content")
                    except (KeyError, IndexError, json.JSONDecodeError):
                        delta = None
                    if delta:
                        message = json.dumps({"delta": delta})
                        yield f"data: {message}\n\n".encode("utf-8")
    except httpx.HTTPStatusError as exc:
        error_msg = json.dumps({"error": f"Provider returned {exc.response.status_code}"})
        yield f"data: {error_msg}\n\n".encode("utf-8")
        yield b"event: done\ndata: [DONE]\n\n"


def _stream_anthropic(api_key: str, base_url: str, payload: dict) -> Iterable[bytes]:
    url = f"{base_url}/messages"
    body = {
        "model": payload.get("model"),
        "max_tokens": payload.get("max_tokens", 1024),
        "messages": payload.get("messages", []),
        "temperature": payload.get("temperature", 0.7),
        "stream": True,
    }

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    try:
        with httpx.stream("POST", url, headers=headers, json=body, timeout=None) as response:
            response.raise_for_status()
            event = None
            for line in response.iter_lines():
                if not line:
                    continue
                if line.startswith("event:"):
                    event = line[len("event:"):].strip()
                    continue
                if line.startswith("data:"):
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        yield b"event: done\ndata: [DONE]\n\n"
                        break
                    try:
                        payload_json = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if event == "content_block_delta":
                        delta = payload_json.get("delta", {}).get("text")
                        if delta:
                            message = json.dumps({"delta": delta})
                            yield f"data: {message}\n\n".encode("utf-8")
                    elif event == "message_stop":
                        yield b"event: done\ndata: [DONE]\n\n"
                        break
    except httpx.HTTPStatusError as exc:
        error_msg = json.dumps({"error": f"Provider returned {exc.response.status_code}"})
        yield f"data: {error_msg}\n\n".encode("utf-8")
        yield b"event: done\ndata: [DONE]\n\n"
