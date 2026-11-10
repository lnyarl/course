"""Attach the shared annotation widget to course HTML; safe to rerun after generation."""
from pathlib import Path
import os
root = Path(__file__).resolve().parents[1]
pages = [root / 'index.html', root / 'CSharp_GC_학습자료.html']
for course in sorted(root.glob('*-course')):
    pages.extend(sorted(course.glob('*.html')))
for page in pages:
    source = page.read_text()
    if 'shared/course-comments.js' in source:
        continue
    script = os.path.relpath(root / 'shared/course-comments.js', page.parent)
    source = source.replace('</body>', f'<script defer src="{script}"></script>\n</body>')
    page.write_text(source)
print(f'Connected comments: {len(pages)} pages')
