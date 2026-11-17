"""Regenerates the PDFs in corpus/ from the sources in corpus/sources/.

Each document is produced by a different tool, so the converter is tested against
the quirks of several PDF writers:

  artigo-duas-colunas.pdf   Chrome (print to PDF)      two columns, links, italic
  relatorio-tabela.pdf      Chrome (print to PDF)      table, lists
  memorando.pdf             LibreOffice Writer         table, lists, italic
  artigo-latex.pdf          pdfLaTeX                   two columns, hyphenation, table
  exemplo-reportlab.pdf     ReportLab                  headings, lists, headers/footers

Requirements: Python 3 with playwright and reportlab, Google Chrome, LibreOffice, TeX Live.
Usage: python3 scripts/build_corpus.py
"""

import asyncio
import shutil
import subprocess
import tempfile
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "corpus" / "sources"
OUT = ROOT / "corpus"


async def chrome(names: list[str]) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shutil.which("google-chrome") or None, channel=None if shutil.which("google-chrome") else "chrome")
        page = await browser.new_page()
        for name in names:
            await page.goto((SOURCES / f"{name}.html").as_uri())
            await page.pdf(path=str(OUT / f"{name}.pdf"), prefer_css_page_size=True, print_background=True)
        await browser.close()


def libreoffice(name: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["soffice", "--headless", "--infilter=HTML (StarWriter)", "--convert-to", "pdf",
             "--outdir", tmp, str(SOURCES / f"{name}.html")],
            check=True, capture_output=True,
        )
        shutil.copy(Path(tmp) / f"{name}.pdf", OUT / f"{name}.pdf")


def latex(name: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        for _ in range(2):  # twice, so cross references settle
            subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", "-output-directory", tmp, str(SOURCES / f"{name}.tex")],
                check=True, capture_output=True,
            )
        shutil.copy(Path(tmp) / f"{name}.pdf", OUT / f"{name}.pdf")


def reportlab() -> None:
    subprocess.run(["python3", str(ROOT / "scripts" / "make_sample.py"), str(ROOT / "public" / "exemplo.pdf")], check=True)
    shutil.copy(ROOT / "public" / "exemplo.pdf", OUT / "exemplo-reportlab.pdf")


if __name__ == "__main__":
    asyncio.run(chrome(["artigo-duas-colunas", "relatorio-tabela"]))
    libreoffice("memorando")
    latex("artigo-latex")
    reportlab()
    print("Corpus regenerado em", OUT)
