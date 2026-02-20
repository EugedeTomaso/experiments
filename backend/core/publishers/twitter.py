import re

import httpx

from .base import BasePublisher


def split_into_tweets(text, max_len=280, add_numbering=True):
    """Split text into tweet-sized chunks at sentence boundaries."""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    tweets = []
    current = ""

    for sentence in sentences:
        candidate = f"{current} {sentence}".strip() if current else sentence

        if len(candidate) <= max_len:
            current = candidate
        else:
            if current:
                tweets.append(current)
            # Handle sentence longer than max_len
            if len(sentence) > max_len:
                words = sentence.split()
                current = ""
                for word in words:
                    candidate = f"{current} {word}".strip() if current else word
                    if len(candidate) <= max_len:
                        current = candidate
                    else:
                        if current:
                            tweets.append(current)
                        current = word
            else:
                current = sentence

    if current:
        tweets.append(current)

    if add_numbering and len(tweets) > 1:
        total = len(tweets)
        numbered = []
        for i, t in enumerate(tweets):
            suffix = f" ({i + 1}/{total})"
            # Trim if adding numbering would exceed limit
            max_content = max_len - len(suffix)
            if len(t) > max_content:
                t = t[: max_content - 1] + "\u2026"
            numbered.append(t + suffix)
        tweets = numbered

    return tweets


class TwitterPublisher(BasePublisher):
    BASE_URL = "https://api.twitter.com/2"

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def get_user_info(self):
        resp = httpx.get(
            f"{self.BASE_URL}/users/me",
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        return {"user_id": data["id"], "username": data["username"]}

    def publish(self, title, content, options=None):
        """Publish as a tweet or thread.

        For short content, posts a single tweet.
        For long content, posts a thread (series of replies).
        """
        options = options or {}
        full_text = f"{title}\n\n{content}" if title else content
        add_numbering = options.get("add_numbering", True)

        tweets = split_into_tweets(full_text, add_numbering=add_numbering)

        posted = []
        reply_to = None

        for tweet_text in tweets:
            payload = {"text": tweet_text}
            if reply_to:
                payload["reply"] = {"in_reply_to_tweet_id": reply_to}

            resp = httpx.post(
                f"{self.BASE_URL}/tweets",
                json=payload,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            tweet_id = data["id"]
            posted.append(tweet_id)
            reply_to = tweet_id

        first_id = posted[0] if posted else ""
        # We need the username to build the URL
        try:
            user_info = self.get_user_info()
            username = user_info["username"]
            url = f"https://x.com/{username}/status/{first_id}"
        except Exception:
            url = ""

        return {"url": url, "post_id": first_id}

    def preview_thread(self, title, content, options=None):
        """Return the thread preview without posting."""
        options = options or {}
        full_text = f"{title}\n\n{content}" if title else content
        add_numbering = options.get("add_numbering", True)

        tweets = split_into_tweets(full_text, add_numbering=add_numbering)
        return [{"text": t, "char_count": len(t)} for t in tweets]
