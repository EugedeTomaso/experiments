import io

import markdown as md_lib
from ebooklib import epub

from .base import BaseExporter
from ..export_utils import build_combined_markdown
from ..models import Node


EPUB_CSS = """\
body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1em;
  line-height: 1.75;
  color: #1a1a1a;
}
h1 { font-size: 1.8em; margin-top: 2em; page-break-before: always; }
h2 { font-size: 1.4em; margin-top: 1.5em; }
h3 { font-size: 1.2em; margin-top: 1.2em; }
blockquote {
  border-left: 3px solid #ccc;
  padding-left: 1em;
  color: #555;
  margin: 1em 0;
}
"""


class EpubExporter(BaseExporter):
    @property
    def content_type(self):
        return "application/epub+zip"

    @property
    def file_extension(self):
        return "epub"

    def export(self) -> bytes:
        book = epub.EpubBook()
        book.set_identifier(f"jakarta-export-{id(self)}")
        book.set_title(self.title)
        book.set_language("en")

        # Add default stylesheet
        style = epub.EpubItem(
            uid="default_style",
            file_name="style/default.css",
            media_type="text/css",
            content=EPUB_CSS.encode("utf-8"),
        )
        book.add_item(style)

        if self.nodes_with_depth:
            chapters = self._build_chapters_from_tree(style)
        else:
            chapters = self._build_single_chapter(style)

        for ch in chapters:
            book.add_item(ch)

        # Table of contents and spine
        book.toc = chapters
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav"] + chapters

        buf = io.BytesIO()
        epub.write_epub(buf, book)
        return buf.getvalue()

    def _build_single_chapter(self, style):
        """Build a single chapter from content_md."""
        ch = epub.EpubHtml(title=self.title, file_name="ch1.xhtml")
        body = md_lib.markdown(self.content_md, extensions=["extra", "smarty"])
        ch.content = f"<h1>{self.title}</h1>{body}"
        ch.add_item(style)
        return [ch]

    def _build_chapters_from_tree(self, style):
        """Build chapters from the node tree.

        Top-level folders become chapters; their children become chapter content.
        Top-level files become standalone chapters.
        """
        chapters = []
        current_chapter_title = None
        current_chapter_parts = []

        def flush_chapter():
            nonlocal current_chapter_title, current_chapter_parts
            if current_chapter_title and current_chapter_parts:
                idx = len(chapters) + 1
                ch = epub.EpubHtml(
                    title=current_chapter_title,
                    file_name=f"ch{idx}.xhtml",
                )
                content = f"<h1>{current_chapter_title}</h1>" + "".join(current_chapter_parts)
                ch.content = content
                ch.add_item(style)
                chapters.append(ch)
            current_chapter_title = None
            current_chapter_parts = []

        for node, depth in self.nodes_with_depth:
            if depth == 0 and node.type == Node.NodeType.FOLDER:
                # New top-level chapter
                flush_chapter()
                current_chapter_title = node.title
            elif depth == 0 and node.type == Node.NodeType.FILE:
                # Standalone top-level file → its own chapter
                flush_chapter()
                current_chapter_title = node.title
                if node.content_md:
                    body = md_lib.markdown(node.content_md, extensions=["extra", "smarty"])
                    current_chapter_parts.append(body)
            else:
                # Nested content
                if node.type == Node.NodeType.FOLDER:
                    heading_level = min(depth + 1, 6)
                    current_chapter_parts.append(f"<h{heading_level}>{node.title}</h{heading_level}>")
                elif node.type == Node.NodeType.FILE and node.content_md:
                    body = md_lib.markdown(node.content_md, extensions=["extra", "smarty"])
                    current_chapter_parts.append(body)

        flush_chapter()
        return chapters
