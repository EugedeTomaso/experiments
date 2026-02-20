import logging
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

_cache = {}

TIMEOUT = 5.0
MAX_BODY = 512_000
USER_AGENT = "Mozilla/5.0 (compatible; Mive/1.0)"


def _extract_metadata(url, html):
    soup = BeautifulSoup(html, "html.parser")

    def og(prop):
        tag = soup.find("meta", attrs={"property": f"og:{prop}"})
        if tag:
            return tag.get("content", "")
        return ""

    def meta_name(name):
        tag = soup.find("meta", attrs={"name": name})
        if tag:
            return tag.get("content", "")
        return ""

    parsed = urlparse(url)
    domain = parsed.netloc.removeprefix("www.")

    title = og("title") or (soup.title.string if soup.title else "") or ""
    description = og("description") or meta_name("description") or ""
    image = og("image") or ""

    if image and not image.startswith(("http://", "https://")):
        if image.startswith("/"):
            image = f"{parsed.scheme}://{parsed.netloc}{image}"
        else:
            image = ""

    favicon = ""
    icon_link = soup.find("link", rel=lambda r: r and "icon" in r)
    if icon_link and icon_link.get("href"):
        fav = icon_link["href"]
        if fav.startswith(("http://", "https://")):
            favicon = fav
        elif fav.startswith("/"):
            favicon = f"{parsed.scheme}://{parsed.netloc}{fav}"
    if not favicon:
        favicon = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

    return {
        "url": url,
        "title": title.strip()[:200],
        "description": description.strip()[:300],
        "image": image,
        "favicon": favicon,
        "domain": domain,
    }


class LinkPreviewView(APIView):
    def get(self, request):
        url = request.query_params.get("url", "").strip()
        if not url:
            return Response(
                {"detail": "url parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return Response(
                {"detail": "Only http/https URLs are supported"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if url in _cache:
            return Response(_cache[url])

        try:
            with httpx.Client(
                timeout=TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": USER_AGENT},
            ) as client:
                resp = client.get(url)
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "")
                if "html" not in content_type:
                    return Response(
                        {"detail": "URL did not return HTML"},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )
                html = resp.text[:MAX_BODY]
        except httpx.HTTPStatusError:
            return Response(
                {"detail": "Failed to fetch URL"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except (httpx.RequestError, Exception) as exc:
            logger.warning("Link preview fetch error: %s", exc)
            return Response(
                {"detail": "Could not connect to URL"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        metadata = _extract_metadata(url, html)
        _cache[url] = metadata
        return Response(metadata)
