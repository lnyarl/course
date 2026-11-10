"""Connect the shared light course design. Safe to rerun after HTML generation."""
from pathlib import Path
import os
import re

ROOT = Path(__file__).resolve().parents[1]


def connect(page):
    source = page.read_text()
    source = re.sub(r'(<html\b[^>]*?)\sdata-theme=["\'][^"\']*["\']', r'\1', source, count=1)
    source = re.sub(r'(<html\b)', r'\1 data-theme="light"', source, count=1)
    source = re.sub(r'(<meta\s+name="color-scheme"\s+content=")[^"]*', r'\1light', source)
    # Remove only our own tags before appending them at the end of the head.
    source = re.sub(r'\n?<link\b[^>]*href="[^"]*shared/course-design\.css"[^>]*>', '', source)
    source = re.sub(r'\n?<script\b[^>]*src="[^"]*shared/course-design\.js"[^>]*></script>', '', source)
    css = os.path.relpath(ROOT / 'shared/course-design.css', page.parent)
    js = os.path.relpath(ROOT / 'shared/course-design.js', page.parent)
    tags = f'\n<link rel="stylesheet" href="{css}">\n<script src="{js}"></script>'
    source = source.replace('</head>', tags + '</head>', 1)
    if source != page.read_text():
        page.write_text(source)
        return 1
    return 0


def main():
    pages = [ROOT / 'index.html', ROOT / 'CSharp_GC_학습자료.html']
    for course in sorted(ROOT.glob('*-course')):
        pages.extend(sorted(course.glob('*.html')))
    changed = sum(connect(page) for page in pages)
    print(f'Course design: {len(pages)} pages connected; {changed} updated')


if __name__ == '__main__':
    main()
