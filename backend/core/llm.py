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
