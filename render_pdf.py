#!/usr/bin/env python3
"""Render an HTML resume to a single-page letter PDF via Chromium."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

def render(html_path: str, pdf_path: str):
    html_file = Path(html_path).resolve()
    if not html_file.exists():
        raise SystemExit(f"missing: {html_file}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(f"file://{html_file}", wait_until="networkidle")
        # Give fonts a beat to settle
        page.wait_for_timeout(300)
        page.pdf(
            path=pdf_path,
            format="Letter",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True,
        )
        browser.close()
    print(f"wrote {pdf_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: render_pdf.py <input.html> <output.pdf>")
    render(sys.argv[1], sys.argv[2])
