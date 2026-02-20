from .base import BaseExporter
from ..export_utils import build_combined_markdown


class MarkdownExporter(BaseExporter):
    @property
    def content_type(self):
        return "text/markdown"

    @property
    def file_extension(self):
        return "md"

    def export(self) -> bytes:
        if self.nodes_with_depth:
            text = build_combined_markdown(self.nodes_with_depth)
        else:
            text = self.content_md
        return text.encode("utf-8")
