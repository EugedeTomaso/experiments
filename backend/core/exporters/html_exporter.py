import markdown as md_lib

from .base import BaseExporter
from ..export_utils import build_combined_markdown


HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
body {{
  max-width: 720px;
  margin: 2rem auto;
  padding: 0 1rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 16px;
  line-height: 1.75;
  color: #1a1a1a;
}}
h1 {{ font-size: 2rem; margin-top: 2rem; }}
h2 {{ font-size: 1.5rem; margin-top: 1.75rem; }}
h3 {{ font-size: 1.25rem; margin-top: 1.5rem; }}
blockquote {{
  border-left: 3px solid #ccc;
  padding-left: 1rem;
  color: #555;
  margin: 1rem 0;
}}
code {{
  background: #f4f4f4;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}}
pre code {{
  display: block;
  padding: 1rem;
  overflow-x: auto;
}}
</style>
</head>
<body>
<h1>{title}</h1>
{body}
</body>
</html>
"""


class HtmlExporter(BaseExporter):
    @property
    def content_type(self):
        return "text/html"

    @property
    def file_extension(self):
        return "html"

    def export(self) -> bytes:
        if self.nodes_with_depth:
            raw_md = build_combined_markdown(self.nodes_with_depth)
        else:
            raw_md = self.content_md

        body_html = md_lib.markdown(
            raw_md,
            extensions=["extra", "codehilite", "smarty"],
        )
        html = HTML_TEMPLATE.format(title=self.title, body=body_html)
        return html.encode("utf-8")
