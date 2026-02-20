from .medium import MediumPublisher
from .linkedin import LinkedInPublisher
from .twitter import TwitterPublisher

PUBLISHERS = {
    "medium": MediumPublisher,
    "linkedin": LinkedInPublisher,
    "twitter": TwitterPublisher,
}

# OAuth configuration per platform
OAUTH_CONFIG = {
    "medium": {
        "authorize_url": "https://medium.com/m/oauth/authorize",
        "token_url": "https://api.medium.com/v1/tokens",
        "scopes": ["basicProfile", "publishPost"],
    },
    "linkedin": {
        "authorize_url": "https://www.linkedin.com/oauth/v2/authorization",
        "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
        "scopes": ["w_member_social", "r_liteprofile"],
    },
    "twitter": {
        "authorize_url": "https://twitter.com/i/oauth2/authorize",
        "token_url": "https://api.twitter.com/2/oauth2/token",
        "scopes": ["tweet.read", "tweet.write", "users.read"],
    },
}
