import httpx

from .base import BasePublisher


class MediumPublisher(BasePublisher):
    BASE_URL = "https://api.medium.com/v1"

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def get_user_info(self):
        resp = httpx.get(f"{self.BASE_URL}/me", headers=self._headers())
        resp.raise_for_status()
        data = resp.json()["data"]
        return {"user_id": data["id"], "username": data["username"]}

    def publish(self, title, content, options=None):
        options = options or {}
        user_info = self.get_user_info()
        user_id = user_info["user_id"]

        payload = {
            "title": title,
            "contentFormat": options.get("content_format", "markdown"),
            "content": content,
            "publishStatus": options.get("publish_status", "draft"),
        }
        tags = options.get("tags")
        if tags:
            payload["tags"] = tags[:5]  # Medium allows max 5 tags

        resp = httpx.post(
            f"{self.BASE_URL}/users/{user_id}/posts",
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        return {"url": data["url"], "post_id": data["id"]}
