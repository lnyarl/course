#!/usr/bin/env python3
"""Build offline advanced lessons and the contextual navigation on existing lessons."""

import argparse
import html
import json
import os
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
COURSES = (
    "aspnet-core-course", "network-web-course", "concurrency-course",
    "os-memory-course", "windows-kernel-course", "linux-kernel-course",
    "tcpip-course", "nodejs-advanced-course", "gc",
    "container-runtime-course", "distributed-queue-course", "database-course",
    "category-theory-course", "utility-ai-course",
)
GC_PAGE = "CSharp_GC_학습자료.html"


def text(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Expected non-empty text")
    return re.sub(r"`([^`\n]+)`", r"<code>\1</code>", html.escape(value))


def href(value):
    return html.escape(value, quote=True)


def local_link(base, item, file):
    value = item["href"]
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path or parsed.path.startswith("/"):
        raise ValueError(f"{file}: invalid local reference {value}")
    raw = (base / unquote(parsed.path)).resolve()
    target = raw / "index.html" if raw.is_dir() else raw
    if not target.is_relative_to(ROOT) or not target.is_file():
        raise ValueError(f"{file}: missing or external relative reference {value}")
    if parsed.fragment:
        source = target.read_text()
        dynamic = (
            base.name == "concurrency-course" and re.fullmatch(r"week-[1-8]", parsed.fragment)
            or base.name == "aspnet-core-course" and re.fullmatch(r"chapter-([1-9]|1[0-8])", parsed.fragment)
        )
        if not dynamic and not re.search(r'\sid=["\']' + re.escape(unquote(parsed.fragment)) + r'["\']', source):
            raise ValueError(f"{file}: missing fragment {value}")
    text(item["label"])
    return target.relative_to(ROOT).as_posix(), parsed.fragment


def list_sections(unit, where):
    sections = unit["sections"]
    if len(sections) < 2 or any(len(section["body"]) < 2 for section in sections):
        raise ValueError(f"{where}: require two developed sections")
    return "\n".join(
        "<section><h2>" + text(section["title"]) + "</h2>\n"
        + "\n".join("<p>" + text(p) + "</p>" for p in section["body"]) + "</section>"
        for section in sections
    )


def experiment(unit, where):
    cases = unit["experiment"]["cases"]
    if len(cases) < 2:
        raise ValueError(f"{where}: require two experiment cases")
    return (
        '<section class="experiment"><h2>실습과 예상 관찰</h2><p>'
        + text(unit["experiment"]["prompt"])
        + '</p>\n'
        + "\n".join(
            '<details><summary>' + text(case["label"]) + '</summary><p>'
            + text(case["result"]) + '</p></details>' for case in cases
        )
        + interactive(unit.get("exercise"), where) + '</section>'
    )


EXERCISES = {
    "overlay-mtu": (
        "오버레이에 남는 IP 크기",
        (("outer", "외부 IP MTU", 1500, 1280, 9000), ("header", "외부 IP 헤더", 20, 20, 100)),
    ),
    "stream-credit": (
        "메시지를 전송할 수 있는 스트림",
        (("connection", "연결 여유", 6, 0, 50), ("a", "스트림 A 여유", 0, 0, 50),
         ("b", "스트림 B 여유", 6, 0, 50)),
    ),
    "deadline-budget": (
        "요청 한 건의 시도와 시간 예산",
        (("budget", "전체 기한 (ms)", 1000, 0, 10000), ("queue", "대기 (ms)", 300, 0, 10000),
         ("duration", "안쪽 호출 1회 (ms)", 500, 1, 10000), ("front", "바깥 최대 시도", 3, 1, 10),
         ("service", "안쪽 최대 시도", 3, 1, 10)),
    ),
}


def interactive(exercise, where):
    if exercise is None:
        return ""
    if exercise not in EXERCISES:
        raise ValueError(f"{where}: invalid interactive exercise {exercise}")
    title, controls = EXERCISES[exercise]
    fields = "".join(
        f'<label>{text(label)}<input type="number" name="{name}" min="{lower}" '
        f'max="{upper}" value="{default}" required></label>' for name, label, default, lower, upper in controls
    )
    return (
        f'<form class="lab" data-exercise="{exercise}" hidden><h3>{text(title)}</h3>'
        f'<div class="lab-inputs">{fields}</div><p><output aria-live="polite"></output></p></form>'
    )


def page(title, track, body, style, track_link, library_link, exercise=False):
    shared = Path(style).parent.as_posix()
    exercise_script = f'<script defer src="{href(shared + "/advanced-exercise.js")}"></script>\n' if exercise else ""
    track_nav = anchor(track_link, track) if title != track else ""
    return f"""<!doctype html>
<html lang="ko" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{text(title)} · {text(track)}</title>
<link rel="stylesheet" href="{href(style)}">
</head>
<body>
<header><a href="{href(library_link)}">코스 목록</a>{track_nav}</header>
<main>
<h1>{text(title)}</h1>
{body}
</main>
{exercise_script}<script defer src="{href(shared + "/course-comments.js")}" data-root="main"></script>
</body>
</html>
"""


def external_sources(unit, where):
    links = []
    if not unit["sources"]:
        raise ValueError(f"{where}: require a source")
    for item in unit["sources"]:
        value = item["href"]
        link = urlsplit(value)
        if link.scheme != "https" or not link.netloc:
            raise ValueError(f"{where}: invalid source reference {value}")
        links.append(f'<li><a href="{href(value)}">{text(item["label"])}</a></li>')
    return '<section class="sources"><h2>참고 자료</h2><ul>' + "".join(links) + "</ul></section>"


def example_files(unit, base, where):
    files = unit.get("files", [])
    for item in files:
        local_link(base, item, where)
    if not files:
        return ""
    return '<p>실습 코드 · ' + ' · '.join(anchor("../" + item["href"], item["label"]) for item in files) + '</p>'


def anchor(target, label):
    return f'<a href="{href(target)}">{text(label)}</a>'


def build(course, attach):
    base = ROOT if course == "gc" else ROOT / course
    source = base / ("gc-advanced.json" if course == "gc" else "advanced.json")
    relative_base = "" if course == "gc" else course + "/"
    dest = "gc-advanced" if course == "gc" else relative_base + "advanced"
    back = "../" + (GC_PAGE if course == "gc" else "index.html")
    style = os.path.relpath(ROOT / "shared" / "advanced.css", ROOT / dest)
    library = os.path.relpath(ROOT / "index.html", ROOT / dest)
    data = json.loads(source.read_text())
    units = data["units"]
    if not units:
        raise ValueError(f"{source}: require units")
    slugs = [unit["slug"] for unit in units]
    if len(set(slugs)) != len(slugs) or any(not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", slug) for slug in slugs):
        raise ValueError(f"{source}: invalid or duplicate slug")
    cards = []
    generated = {}
    home_key = GC_PAGE if course == "gc" else relative_base + "index.html"
    attach.setdefault(home_key, {}).setdefault("", []).append({
        "href": dest + "/index.html", "label": data["title"],
    })
    for i, unit in enumerate(units):
        filename = unit["slug"] + ".html"
        where = f"{source}:{unit['slug']}"
        before_path, before_fragment = local_link(base, unit["before"], where)
        after_path, after_fragment = local_link(base, unit["after"], where)
        for path, fragment in dict.fromkeys(((before_path, before_fragment), (after_path, after_fragment))):
            attach.setdefault(path, {}).setdefault(fragment, []).append({
                "href": dest + "/" + filename, "label": unit["title"],
            })
        prev_href, prev_name = ("index.html", "심화 목차") if i == 0 else (slugs[i - 1] + ".html", "이전 심화 · " + units[i - 1]["title"])
        next_href, next_name = (back, "기존 코스 목차") if i + 1 == len(units) else (slugs[i + 1] + ".html", "다음 심화 · " + units[i + 1]["title"])
        before = anchor("../" + unit["before"]["href"], unit["before"]["label"])
        after = anchor("../" + unit["after"]["href"], unit["after"]["label"])
        body = (
            f'<p class="connection">선수 장 · {before}</p>\n<p class="lead">{text(unit["opening"])}</p>\n'
            + list_sections(unit, where) + "\n"
            + experiment(unit, where) + example_files(unit, base, where) + "\n"
            + f'<section><h2>실습의 경계와 다음 장</h2><p>{text(unit["limit"])}</p><p>관련 기존 장 · {after}</p></section>\n'
            + external_sources(unit, where)
            + '<nav class="pager" aria-label="심화 단원 이동">'
            + anchor(prev_href, prev_name) + anchor(next_href, next_name) + '</nav>'
        )
        generated[filename] = page(unit["title"], data["title"], body, style, "index.html", library, bool(unit.get("exercise")))
        cards.append(f'<li>{anchor(filename, unit["title"])}<p>{text(unit["opening"])}</p></li>')
    generated["index.html"] = page(
        data["title"], data["title"],
        f'<p class="lead">{text(data["intro"])}</p>\n<p>{anchor(back, "기존 코스 목차")}</p>\n'
        + '<ol class="units">\n' + "\n".join(cards) + "\n</ol>",
        style, "index.html", library,
    )
    return len(units), {Path(dest) / filename: content for filename, content in generated.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT)
    parser.add_argument("--course", choices=COURSES)
    args = parser.parse_args()
    attach, pages, count = {}, {}, 0
    selected = (args.course,) if args.course else COURSES
    for course in selected:
        unit_count, generated = build(course, attach)
        count += unit_count
        pages.update(generated)
    if not args.course:
        pages[Path("shared/advanced-links.generated.js")] = (
            "// Generated by tools/build-advanced.py.\nwindow.CourseAdvancedLinks = "
            + json.dumps(attach, ensure_ascii=False, separators=(",", ":")) + ";\n"
        )
    for filename, content in pages.items():
        path = args.output / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    print(f"{len(selected)} courses, {count} advanced units")


if __name__ == "__main__":
    main()
