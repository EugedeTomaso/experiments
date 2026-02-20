import os
import markdown as md_lib
from weasyprint import HTML

from .base import BaseExporter
from ..export_utils import build_combined_markdown

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")


def _load_css(project_type):
    """Load the CSS template for a given project type, falling back to default."""
    path = os.path.join(TEMPLATES_DIR, f"{project_type}.css")
    if not os.path.isfile(path):
        path = os.path.join(TEMPLATES_DIR, "default.css")
    with open(path) as f:
        return f.read()


PDF_HTML_TEMPLATE = """\
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
<h1 class="doc-title">{title}</h1>
{body}
</body>
</html>
"""


class PdfExporter(BaseExporter):
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

        body_html = md_lib.markdown(
            raw_md,
            extensions=["extra", "codehilite", "smarty"],
        )
        css = _load_css(self.project_type)
        full_html = PDF_HTML_TEMPLATE.format(
            title=self.title, css=css, body=body_html
        )
        pdf_bytes = HTML(string=full_html).write_pdf()
        return pdf_bytes
