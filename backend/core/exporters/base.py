from abc import ABC, abstractmethod


class BaseExporter(ABC):
    """Abstract base class for all exporters.

    Can operate in two modes:
    - Single node: pass ``content_md`` directly.
    - Project: pass ``nodes_with_depth`` (list of ``(node, depth)`` tuples).
    """

    def __init__(self, title, project_type="freeform", content_md="", nodes_with_depth=None):
        self.title = title
        self.project_type = project_type
        self.content_md = content_md
        self.nodes_with_depth = nodes_with_depth or []

    @abstractmethod
    def export(self) -> bytes:
        """Return the exported content as bytes."""

    @property
    @abstractmethod
    def content_type(self) -> str:
        """MIME type for the exported file."""

    @property
    @abstractmethod
    def file_extension(self) -> str:
        """File extension without leading dot."""
