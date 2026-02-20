import httpx

from .base import BasePublisher


class LinkedInPublisher(BasePublisher):
    API_BASE = "https://api.linkedin.com"

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

    def get_user_info(self):
        resp = httpx.get(
            f"{self.API_BASE}/v2/me",
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        user_id = data["id"]
        first = data.get("localizedFirstName", "")
        last = data.get("localizedLastName", "")
        return {"user_id": user_id, "username": f"{first} {last}".strip()}

    def publish(self, title, content, options=None):
        options = options or {}
        user_info = self.get_user_info()
        person_urn = f"urn:li:person:{user_info['user_id']}"

        # For short content (<3000 chars), use share API
        # For long content, use article API
        if len(content) < 3000 and not options.get("force_article"):
            return self._publish_share(person_urn, title, content)
        else:
            return self._publish_article(person_urn, title, content)

    def _publish_share(self, person_urn, title, content):
        """Publish as a LinkedIn share/post."""
        payload = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": f"{title}\n\n{content}"},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        resp = httpx.post(
            f"{self.API_BASE}/v2/ugcPosts",
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        post_id = data.get("id", "")
        # LinkedIn doesn't return a direct URL in the response
        url = f"https://www.linkedin.com/feed/update/{post_id}/" if post_id else ""
        return {"url": url, "post_id": post_id}

    def _publish_article(self, person_urn, title, content):
        """Publish as a LinkedIn article (long-form)."""
        import markdown as md_lib

        html_content = md_lib.markdown(content, extensions=["extra", "smarty"])

        payload = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "visibility": "PUBLIC",
            "content": {
                "title": title,
                "body": html_content,
            },
        }

        resp = httpx.post(
            f"{self.API_BASE}/rest/articles",
            json=payload,
            headers={
                **self._headers(),
                "LinkedIn-Version": "202401",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        post_id = data.get("id", "")
        url = data.get("url", "")
        return {"url": url, "post_id": post_id}
