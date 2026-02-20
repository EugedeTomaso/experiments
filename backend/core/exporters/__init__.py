from .markdown_exporter import MarkdownExporter
from .html_exporter import HtmlExporter
from .pdf_exporter import PdfExporter
from .docx_exporter import DocxExporter
from .epub_exporter import EpubExporter
from .screenplay_pdf import ScreenplayPdfExporter

FORMAT_EXPORTERS = {
    "md": MarkdownExporter,
    "html": HtmlExporter,
    "pdf": PdfExporter,
    "docx": DocxExporter,
    "epub": EpubExporter,
    "screenplay_pdf": ScreenplayPdfExporter,
}

FORMATS_BY_TYPE = {
    "novel": ["epub", "pdf", "docx", "md"],
    "short-story": ["epub", "pdf", "docx", "md"],
    "screenplay": ["screenplay_pdf"],
    "tv-series": ["screenplay_pdf"],
    "youtube": ["pdf", "docx"],
    "article": ["html", "pdf", "md"],
    "academic": ["pdf", "docx"],
    "product": ["pdf", "docx"],
    "freeform": ["md", "pdf"],
    "custom": ["md", "pdf"],
}
