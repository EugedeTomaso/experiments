import httpx

from .models import ProviderKey


def get_exa_api_key() -> str:
    provider_key = ProviderKey.objects.filter(provider="exa").first()
    if provider_key:
        key = provider_key.get_api_key()
        if key:
            return key
    return ""


def search_exa(query: str, num_results: int = 5) -> list[dict]:
    """Search Exa for content relevant to a claim.

    Returns list of {url, title, text} dicts.
    """
    api_key = get_exa_api_key()
    if not api_key:
        return []

    response = httpx.post(
        "https://api.exa.ai/search",
        headers={
            "x-api-key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "query": query,
            "useAutoprompt": True,
            "numResults": num_results,
            "contents": {
                "text": {"maxCharacters": 1000},
            },
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    results = []
    for r in data.get("results", []):
        results.append({
            "url": r.get("url", ""),
            "title": r.get("title", ""),
            "text": r.get("text", ""),
        })
    return results
