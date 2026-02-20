"""Screenplay PDF exporter.

Converts markdown written with Fountain-like conventions to an
industry-standard screenplay PDF using WeasyPrint.

Fountain conventions detected:
- Lines starting with INT. or EXT. → scene headings (sluglines)
- Lines in ALL CAPS (>2 words) before dialogue → character names
- Lines in parentheses after character → parentheticals
- Lines starting with > → transitions
- Everything else → action or dialogue depending on context
"""

import re

from weasyprint import HTML

from .base import BaseExporter
from ..export_utils import build_combined_markdown


SCREENPLAY_CSS = """\
@page {
  size: letter;
  margin: 1in 1in 0.5in 1.5in;
  @top-right { content: counter(page) "."; font-family: Courier, monospace; font-size: 12pt; }
}
body {
  font-family: Courier, "Courier New", monospace;
  font-size: 12pt;
  line-height: 1;
  color: #000;
}
.title-page {
  text-align: center;
  margin-top: 3in;
  page-break-after: always;
}
.title-page h1 { font-size: 24pt; text-transform: uppercase; }
.scene-heading {
  text-transform: uppercase;
  font-weight: bold;
  margin-top: 24pt;
  margin-bottom: 12pt;
}
.action {
  margin-bottom: 12pt;
}
.character {
  text-transform: uppercase;
  margin-left: 2.2in;
  margin-top: 12pt;
  margin-bottom: 0;
}
.parenthetical {
  margin-left: 1.6in;
  margin-bottom: 0;
  font-style: italic;
}
.dialogue {
  margin-left: 1in;
  margin-right: 1.5in;
  margin-bottom: 12pt;
}
.transition {
  text-align: right;
  text-transform: uppercase;
  margin-top: 12pt;
  margin-bottom: 12pt;
}
"""

SCENE_HEADING_RE = re.compile(r"^(INT\.|EXT\.|INT\./EXT\.|I/E\.)(.+)", re.IGNORECASE)
TRANSITION_RE = re.compile(r"^>\s*(.+)")
CHARACTER_RE = re.compile(r"^([A-Z][A-Z\s.'-]+)(\s*\(.*\))?$")
PARENTHETICAL_RE = re.compile(r"^\(.+\)$")


def _parse_screenplay(text):
    """Parse markdown/Fountain text into a list of (element_type, text) tuples."""
    lines = text.split("\n")
    elements = []
    i = 0

    while i < len(lines):
        line = lines[i].rstrip()

        # Skip blank lines
        if not line.strip():
            i += 1
            continue

        # Scene headings
        m = SCENE_HEADING_RE.match(line)
        if m:
            elements.append(("scene_heading", line.strip()))
            i += 1
            continue

        # Transitions (> TEXT or common transitions like CUT TO:)
        m = TRANSITION_RE.match(line)
        if m:
            elements.append(("transition", m.group(1).strip()))
            i += 1
            continue
        if line.strip().endswith(":") and line.strip().isupper():
            elements.append(("transition", line.strip()))
            i += 1
            continue

        # Character name (ALL CAPS line that isn't a scene heading)
        m = CHARACTER_RE.match(line.strip())
        if m and len(line.strip()) > 1:
            elements.append(("character", line.strip()))
            i += 1
            # Check for parenthetical and dialogue
            while i < len(lines):
                next_line = lines[i].rstrip()
                if not next_line.strip():
                    break
                if PARENTHETICAL_RE.match(next_line.strip()):
                    elements.append(("parenthetical", next_line.strip()))
                else:
                    elements.append(("dialogue", next_line.strip()))
                i += 1
            continue

        # Default: action
        elements.append(("action", line.strip()))
        i += 1

    return elements


def _elements_to_html(title, elements):
    """Convert parsed elements to HTML."""
    parts = [
        f'<div class="title-page"><h1>{title}</h1></div>',
    ]

    for elem_type, text in elements:
        css_class = elem_type.replace("_", "-")
        parts.append(f'<p class="{css_class}">{text}</p>')

    return "\n".join(parts)


SCREENPLAY_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
{css}
</style>
</head>
<body>
{body}
</body>
</html>
"""


class ScreenplayPdfExporter(BaseExporter):
    @property
    def content_type(self):
        return "application/pdf"

    @property
    def file_extension(self):
        return "pdf"

    def export(self) -> bytes:
        if self.nodes_with_depth:
            raw_md = build_combined_markdown(self.nodes_with_depth)
        else:
            raw_md = self.content_md

        # Strip markdown headings — screenplay uses its own structure
        raw_md = re.sub(r"^#{1,6}\s+", "", raw_md, flags=re.MULTILINE)

        elements = _parse_screenplay(raw_md)
        body_html = _elements_to_html(self.title, elements)
        full_html = SCREENPLAY_HTML_TEMPLATE.format(
            title=self.title, css=SCREENPLAY_CSS, body=body_html
        )
        return HTML(string=full_html).write_pdf()
