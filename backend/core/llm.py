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
