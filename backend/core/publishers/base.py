from abc import ABC, abstractmethod


class BasePublisher(ABC):
    """Abstract base class for platform publishers."""

    def __init__(self, access_token):
        self.access_token = access_token

    @abstractmethod
    def publish(self, title, content, options=None):
        """Publish content to the platform.

        Returns:
            dict with keys: url, post_id
        """

    @abstractmethod
    def get_user_info(self):
        """Fetch the authenticated user's profile info.

        Returns:
            dict with keys: user_id, username
        """
