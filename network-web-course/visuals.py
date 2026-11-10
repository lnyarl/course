"""Concept-specific, accessible network lesson diagrams.

No rendering dependencies or external assets. The caller supplies page typography
and the course CSS variables. Figures intentionally retain readable coordinates in
an overflow container on narrow screens rather than shrinking their labels.
"""
from html import escape


def _e(value):
    return escape(str(value), quote=True)


class _Canvas:
    def __init__(self, prefix):
        self.prefix = prefix
        self.parts = []

    def text(self, x, y, value, *, size=16, color="ink", anchor="start", weight=400):
        self.parts.append(
            f'<text x="{x}" y="{y}" font-size="{size}" fill="var(--{color})" '
            f'text-anchor="{anchor}" font-weight="{weight}">{_e(value)}</text>'
        )

    def lines(self, x, y, values, *, size=16, gap=24, color="ink", anchor="start", weight=400):
        for i, value in enumerate(values):
            self.text(x, y + i * gap, value, size=size, color=color, anchor=anchor, weight=weight)

    def rect(self, x, y, width, height, *, fill="paper", stroke="line", radius=8, dash=False):
        self.parts.append(
            f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" '
            f'fill="var(--{fill})" stroke="var(--{stroke})" stroke-width="1.5"'
            + (' stroke-dasharray="6 5"' if dash else '') + '/>'
        )

    def box(self, x, y, width, height, heading, sub=None, *, fill="paper", color="ink"):
        self.rect(x, y, width, height, fill=fill)
        values = [heading] if isinstance(heading, str) else heading
        start = y + (height - (len(values) - 1) * 23 - (23 if sub else 0)) / 2 + 6
        self.lines(x + width / 2, start, values, anchor="middle", size=16, gap=23, color=color, weight=500)
        if sub:
            self.text(x + width / 2, start + len(values) * 23, sub, anchor="middle", size=14, color="muted")

    def line(self, x1, y1, x2, y2, *, color="line", dash=False, width=2):
        self.parts.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="var(--{color})" stroke-width="{width}"'
            + (' stroke-dasharray="5 5"' if dash else '') + '/>'
        )

    def arrow(self, points, *, color="accent", dash=False):
        assert len(points) > 1
        assert all(a[0] == b[0] or a[1] == b[1] for a, b in zip(points, points[1:])), points
        d = 'M' + ' L'.join(f'{x},{y}' for x, y in points)
        self.parts.append(
            f'<path d="{d}" fill="none" stroke="var(--{color})" stroke-width="2" '
            f'stroke-linejoin="round" marker-end="url(#{self.prefix}-arrow-{color})"'
            + (' stroke-dasharray="6 5"' if dash else '') + '/>'
        )

    def message(self, x1, x2, y, label, *, color="accent", reply=False, size=15):
        self.arrow([(x1, y), (x2, y)], color=color, dash=reply)
        self.text((x1 + x2) / 2, y - 12, label, anchor="middle", size=size, color=color)

    def actor(self, x, label, sub, bottom):
        self.line(x, 98, x, bottom, dash=True)
        self.box(x - 66, 25, 132, 72, label, sub)

    def band(self, x, y, width, height, label, *, fill="soft", color="accent"):
        self.rect(x, y, width, height, fill=fill, stroke=fill, radius=6)
        self.text(x + 14, y + 23, label, color=color, size=14, weight=500)

    def svg(self, height, title, desc):
        defs = ''.join(
            f'<marker id="{self.prefix}-arrow-{color}" viewBox="0 0 10 10" '
            f'refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
            f'<path d="M1,1 L9,5 L1,9 Z" fill="var(--{color})"/></marker>'
            for color in ('accent', 'blue', 'red', 'muted', 'orange')
        )
        return (
            f'<svg class="lesson-svg" style="min-width:720px;width:100%;height:auto" '
            f'viewBox="0 0 900 {height}" role="img" '
            f'aria-labelledby="{self.prefix}-title {self.prefix}-desc">'
            f'<title id="{self.prefix}-title">{_e(title)}</title>'
            f'<desc id="{self.prefix}-desc">{_e(desc)}</desc>'
            f'<defs>{defs}</defs><g font-family="inherit">' + ''.join(self.parts) + '</g></svg>'
        )


def _figure(cid, key, kind, title, desc, reading, height, draw):
    canvas = _Canvas(f'ch{cid}-{key}')
    draw(canvas)
    svg = canvas.svg(height, title, desc)
    return (
        f'<figure class="concept-figure" data-diagram-kind="{_e(kind)}">'
        f'<figcaption><strong>{_e(title)}</strong><span>{_e(desc)}</span></figcaption>'
        f'<div class="figure-scroll" role="region" tabindex="0" aria-label="{_e(title)}">{svg}</div>'
        f'<p class="figure-reading">{_e(reading)}</p></figure>'
    )


def _journey(c):
    # DNS is a side exchange with the browser. HTTP travels through the proxy.
    c.rect(345, 205, 525, 205, dash=True)
    c.text(365, 395, '업스트림 보호는 클라이언트 TLS와 별도로 설정', size=15, color='muted')
    c.arrow([(110, 260), (110, 155)], color='blue')
    c.text(35, 198, '이름 질의', size=14, color='blue')
    c.arrow([(150, 155), (150, 260)], color='blue', dash=True)
    c.text(165, 230, '주소 결과', size=14, color='blue')
    c.message(230, 385, 290, 'TLS 연결 A', size=14)
    c.message(385, 230, 335, 'HTTP 응답', reply=True, size=14)
    c.message(575, 685, 290, '연결 B', size=14)
    c.message(685, 575, 335, '응답', reply=True, size=14)
    c.box(40, 60, 180, 95, 'DNS 리졸버', '이름 → 주소')
    c.box(40, 260, 190, 100, '브라우저', 'URL · origin · 정책')
    c.box(385, 260, 190, 100, '리버스 프록시', 'TLS 종료 · HTTP 처리')
    c.box(685, 260, 170, 100, '애플리케이션', 'API 처리')
    c.text(350, 160, 'DNS 성공 → 연결 성공 → TLS 검증 → HTTP 처리', size=16, color='accent')
    c.text(350, 186, '각 단계의 성공 여부는 별도로 확인한다.', size=15, color='muted')


def _dns_tree(c):
    c.arrow([(450, 105), (450, 140), (220, 140), (220, 175)], color='blue')
    c.arrow([(450, 105), (450, 140), (680, 140), (680, 175)], color='muted')
    c.arrow([(220, 235), (220, 295)], color='blue')
    c.text(245, 273, '하위 zone 위임', size=15, color='blue')
    c.arrow([(220, 365), (220, 410)], color='blue')
    c.box(360, 40, 180, 65, '.', '루트 이름 공간')
    c.box(130, 175, 180, 60, 'com.', '최상위 도메인')
    c.box(590, 175, 180, 60, 'org.', '다른 최상위 도메인')
    c.box(70, 295, 300, 70, 'example.com.', '이 zone의 권한 데이터')
    c.box(50, 410, 340, 70, 'api.example.com.  A', '교육용 결과: 192.0.2.10')
    c.lines(485, 305, ['이 그림은 이름 공간의 포함·위임 관계다.', '루트가 HTTP를 전달하거나,', '권한 서버끼리 질의를 넘기는 경로가 아니다.'], gap=28, size=16)
    c.text(485, 425, '실제 질의를 수행하는 주체는 다음 그림에서 구분한다.', size=15, color='muted')


def _dns_sequence(c):
    for x, heading, sub in [(75, '클라이언트', '최종 결과 요청'), (255, '재귀 리졸버', '조회·캐시'), (440, '루트 서버', '.com 안내'), (620, 'TLD 서버', 'zone 위임'), (810, '권한 서버', 'A 레코드')]:
        c.actor(x, heading, sub, 560)
    c.message(75, 255, 145, '1. 주소 조회', size=14)
    c.message(255, 440, 205, '2. TLD 조회', size=14)
    c.message(440, 255, 250, '.com NS 안내', reply=True, size=14)
    c.message(255, 620, 310, '3. example.com 위임 조회')
    c.message(620, 255, 355, '권한 서버 NS 안내', reply=True)
    c.message(255, 810, 415, '4. A api.example.com 조회')
    c.message(810, 255, 460, '192.0.2.10 · TTL 60초', reply=True)
    c.message(255, 75, 525, '5. 최종 결과', reply=True, size=14)
    c.box(150, 570, 290, 60, '리졸버가 결과를 캐시', '다음 조회는 위임 탐색을 생략할 수 있음', fill='soft')
    c.text(500, 605, '캐시 없는 대표 경로 · 재시도·DNSSEC 등은 생략', size=14, color='muted')


def _ttl(c):
    # Every vertical guide shares the same temporal coordinate.
    for x, t in [(180, 0), (380, 20), (480, 30), (780, 60)]:
        c.line(x, 70, x, 335, dash=True)
        c.text(x, 380, f'{t}초', anchor='middle', size=15)
    c.text(25, 120, '권한 데이터', weight=500)
    c.text(25, 220, '리졸버 캐시', weight=500)
    c.text(25, 310, '조회 결과', weight=500)
    c.rect(180, 90, 200, 52, fill='soft', stroke='soft', radius=0)
    c.rect(380, 90, 400, 52, fill='paper', stroke='blue', radius=0)
    c.text(280, 122, 'v1: 이전 주소', anchor='middle', size=15)
    c.text(580, 122, 'v2: 새 주소', anchor='middle', size=15, color='blue')
    c.rect(180, 190, 600, 55, fill='soft', stroke='soft', radius=0)
    c.text(480, 224, 'v1 유지 · 남은 TTL 60초 → 0초', anchor='middle', size=16)
    c.box(125, 280, 110, 45, 'v1 저장', fill='soft')
    c.box(425, 280, 110, 45, 'v1 HIT', fill='soft')
    c.box(710, 280, 140, 45, 'v2 재조회', fill='paper', color='blue')
    c.text(380, 52, '원본만 v2로 변경', anchor='middle', size=15, color='blue')
    c.text(780, 52, '만료 후 새 조회', anchor='middle', size=15, color='blue')
    c.arrow([(180, 350), (835, 350)], color='muted')
    c.text(835, 406, '시간', size=14, color='muted')


def _existing_connection(c):
    c.text(40, 43, 'DNS 재조회 결과는 v2여도, 기존 연결을 자동으로 끊지는 않는다.', size=17, color='accent')
    c.arrow([(250, 170), (525, 170), (525, 95), (640, 95)], color='orange')
    c.text(380, 151, '기존 연결: v1 유지', anchor='middle', size=16, color='orange')
    c.arrow([(250, 205), (525, 205), (525, 275), (640, 275)], color='blue')
    c.text(380, 236, '새 연결: 새 조회 결과 사용', anchor='middle', size=16, color='blue')
    c.box(40, 145, 210, 90, '클라이언트', '연결마다 목적지가 정해짐')
    c.box(640, 50, 210, 90, '이전 서버 v1', '192.0.2.10')
    c.box(640, 230, 210, 90, '새 서버 v2', '192.0.2.20')


def _http_message(c):
    c.rect(35, 50, 470, 385, radius=5)
    c.rect(36, 51, 468, 70, fill='soft', stroke='soft', radius=0)
    c.rect(36, 287, 468, 28, fill='soft', stroke='soft', radius=0)
    c.lines(56, 91, ['POST /orders HTTP/1.1'], size=19)
    c.lines(56, 160, ['Host: api.example.test', 'Content-Type: application/json', 'Content-Length: 12'], size=17, gap=42)
    c.text(56, 309, '빈 줄', size=14, color='muted')
    c.text(56, 372, '{"item":"A"}', size=21, color='blue')
    for y in (88, 201, 301, 366):
        c.line(505, y, 550, y, color='muted')
    c.lines(570, 82, ['요청 줄', '메서드 · 요청 대상 · 버전'], gap=26, size=17)
    c.lines(570, 187, ['헤더', '메시지와 본문을 해석할 정보'], gap=26, size=17)
    c.lines(570, 296, ['경계', '헤더가 끝나고 본문이 시작됨'], gap=26, size=17)
    c.lines(570, 361, ['본문', '이 ASCII 예시는 12바이트'], gap=26, size=17)
    c.text(35, 472, 'HTTP/1.1 표현 예제. HTTP/2·3는 이 텍스트 줄을 그대로 전송하지 않는다.', size=15, color='muted')


def _cache_decision(c):
    c.arrow([(450, 80), (450, 125)])
    c.arrow([(310, 160), (150, 160), (150, 220)])
    c.text(230, 144, '없음', anchor='middle', size=15)
    c.arrow([(450, 195), (450, 270)])
    c.text(474, 238, '있음', size=15)
    c.arrow([(330, 305), (280, 305), (280, 425)])
    c.lines(180, 350, ['stale 또는', 'no-cache'], size=15, gap=23, color='orange')
    c.arrow([(650, 305), (770, 305), (770, 425)])
    c.text(712, 287, '예', size=15)
    c.box(325, 25, 250, 55, '같은 URL로 GET')
    c.box(310, 125, 280, 70, '저장된 응답이 있는가?', fill='soft')
    c.box(40, 220, 220, 110, ['원본 요청', '200 + 새 본문'], 'no-store면 저장하지 않음')
    c.box(330, 270, 320, 70, ['fresh이고', '재검증 의무가 없는가?'], fill='soft')
    c.box(150, 425, 260, 100, '조건부 요청', '검증자: If-None-Match')
    c.box(670, 425, 200, 100, ['저장 본문', '바로 사용'], '원본 왕복 생략')
    c.text(35, 568, '전제: ETag가 있는 캐시 가능 GET. 검증자가 없다면 조건부 요청 대신 전체 응답을 요청한다.', size=15, color='muted')


def _cache_validation(c):
    for x, label, sub in [(150, '브라우저', '새 요청'), (450, '저장 응답', '본문 v1 + ETag'), (750, '원본 서버', '현재 표현 v1')]:
        c.actor(x, label, sub, 365)
    c.message(150, 450, 145, '저장 응답 재사용 가능 여부 확인')
    c.message(450, 750, 215, 'If-None-Match: "v1"')
    c.message(750, 450, 285, '304 · 새 본문 없음', reply=True)
    c.message(450, 150, 355, '저장된 본문 v1을 사용', reply=True)


def _cors(c):
    # Panels are independent traces, not serial stages of a single request.
    c.text(225, 32, 'A. preflight 없는 교차 출처 GET', anchor='middle', size=17, weight=500)
    c.text(675, 32, 'B. preflight가 필요한 PUT', anchor='middle', size=17, weight=500)
    c.line(450, 15, 450, 530)
    for x, label in [(100, '브라우저'), (345, '서버'), (555, '브라우저'), (800, '서버')]:
        c.box(x - 63, 65, 126, 58, label)
        c.line(x, 123, x, 430, dash=True)
    c.message(100, 345, 175, 'GET 전송')
    c.box(278, 204, 134, 55, '실제 요청 처리', fill='soft')
    c.message(345, 100, 300, '200 · ACAO 없음', reply=True)
    c.box(30, 357, 310, 70, 'JS 응답 읽기 차단', '서버 처리는 이미 일어날 수 있음', color='red')
    c.message(555, 800, 175, 'OPTIONS 먼저 전송')
    c.message(800, 555, 270, '허용 헤더 없음', reply=True)
    c.line(525, 355, 835, 355, color='red', width=3)
    c.text(680, 389, '실제 PUT을 보내지 않음', anchor='middle', size=18, color='red')
    c.text(225, 485, '응답 공개 실패 ≠ 서버 실행 취소', anchor='middle', size=16, color='red')
    c.text(675, 485, '사전 허용 실패 → 실제 요청 생략', anchor='middle', size=16, color='red')
    c.text(40, 548, 'ACAO = Access-Control-Allow-Origin. 허용 preflight 이후에도 실제 응답의 공개 조건을 검사한다.', size=15, color='muted')


def _tls(c):
    # Protected bands deliberately begin after ServerHello, not after the certificate.
    c.band(55, 220, 790, 277, 'ServerHello 이후: 핸드셰이크 키로 보호', fill='soft')
    c.band(55, 520, 790, 85, 'Application data: 애플리케이션 트래픽 키로 보호', fill='soft')
    for x, label, sub in [(160, '클라이언트', '브라우저'), (735, 'TLS 서버', '프록시 또는 앱')]:
        c.actor(x, label, sub, 605)
    c.message(160, 735, 135, 'ClientHello · 버전/키 공유 제안')
    c.message(735, 160, 198, 'ServerHello · 선택한 키 공유', reply=True)
    c.message(735, 160, 292, 'EncryptedExtensions · Certificate', reply=True)
    c.message(735, 160, 350, 'CertificateVerify · Finished', reply=True)
    c.box(40, 375, 270, 64, '클라이언트의 로컬 검증', '이름 · 유효기간 · 신뢰 · 서명')
    c.message(160, 735, 475, 'Finished · 핸드셰이크 무결성 확인')
    c.message(160, 735, 580, '보호된 HTTP 요청')
    c.text(40, 648, '인증서 공개키는 서버 인증에 사용된다. HTTP 본문 전체를 그 공개키로 직접 암호화하지 않는다.', size=15, color='muted')


def _versions(c):
    # All lanes share the same horizontal arbitrary-time scale.
    start, scale = 220, 7.5
    for t in (0, 20, 40, 60, 80):
        x = start + t * scale
        c.line(x, 52, x, 455, dash=True)
        c.text(x, 35, str(t), anchor='middle', size=15, color='muted')
    c.text(25, 120, 'HTTP/1.1', weight=500)
    c.text(25, 146, '연결 1개 · 순차', size=14, color='muted')
    c.text(25, 257, 'HTTP/2', weight=500)
    c.text(25, 283, '하나의 TCP', size=14, color='muted')
    c.text(25, 394, 'HTTP/3', weight=500)
    c.text(25, 420, '독립 스트림 전달', size=14, color='muted')
    bars = [
        ('A', 0, 20, 85, 'accent'), ('B', 20, 60, 117, 'orange'), ('C', 60, 80, 149, 'blue'),
        ('A', 0, 50, 220, 'orange'), ('B', 0, 50, 252, 'orange'), ('C', 0, 50, 284, 'orange'),
        ('A', 0, 20, 355, 'accent'), ('B', 0, 50, 387, 'orange'), ('C', 0, 20, 419, 'blue'),
    ]
    for label, a, b, y, color in bars:
        c.text(195, y + 20, label, anchor='middle', size=15)
        c.rect(start + a * scale, y, (b - a) * scale, 26, fill=color, stroke=color, radius=3)
    c.text(632, 244, 'TCP의 빈 바이트 뒤', size=15, color='orange')
    c.text(632, 269, '여러 스트림이 함께 대기', size=15, color='orange')
    c.text(632, 387, 'B의 손실 복구가', size=15, color='orange')
    c.text(632, 412, 'A/C의 전달을 직접 막지 않음', size=15, color='orange')
    c.text(25, 500, 'B 중간 데이터 손실을 가정한 완료 지연 예시 · 시간은 임의 단위이며 실제 성능 비교가 아니다.', size=15, color='muted')


def _proxy_connections(c):
    c.rect(325, 30, 555, 290, dash=True)
    c.text(345, 302, '프록시 이후의 연결과 타임아웃은 별도 상태', size=15, color='muted')
    c.message(230, 355, 120, 'TLS A', size=15)
    c.arrow([(555, 120), (625, 120), (625, 90), (690, 90)], color='blue')
    c.text(620, 59, 'TLS B', anchor='middle', size=15, color='blue')
    c.arrow([(555, 170), (625, 170), (625, 225), (690, 225)], color='blue')
    c.text(620, 262, 'TLS C', anchor='middle', size=15, color='blue')
    c.box(40, 80, 190, 100, '브라우저', '클라이언트 연결')
    c.box(355, 80, 200, 130, ['리버스 프록시', 'TLS 종료 · 대상 선택'], 'HTTP 내용을 읽을 수 있음', fill='soft')
    c.box(690, 50, 165, 80, '서버 A', 'healthy')
    c.box(690, 185, 165, 80, '서버 B', 'healthy')
    c.lines(45, 375, ['TLS A의 연결 성공이 TLS B/C의 성공을 보장하지 않는다.', '그림의 두 업스트림 화살표는 가능한 분배 경로다. 한 요청을 두 서버에 복제한다는 뜻이 아니다.'], gap=28, size=16)


def _tls_boundaries(c):
    for y, mode in [(60, '프록시 종료 + HTTP'), (200, '프록시 종료 + 재암호화'), (340, 'TLS passthrough')]:
        c.text(25, y - 15, mode, size=17, weight=500)
        c.box(45, y + 20, 155, 65, '브라우저')
        c.box(375, y + 20, 155, 65, '프록시', '통과' if y == 340 else 'TLS 종료')
        c.box(705, y + 20, 155, 65, '앱', 'HTTP' if y == 60 else 'TLS 종료')
        if y == 340:
            c.arrow([(200, y + 52), (375, y + 52)], color='blue')
            c.arrow([(530, y + 52), (705, y + 52)], color='blue')
            c.line(200, y + 107, 705, y + 107, color='blue')
            c.line(200, y + 99, 200, y + 107, color='blue')
            c.line(705, y + 99, 705, y + 107, color='blue')
            c.text(452, y + 7, '하나의 TLS 연결 · 프록시에서 복호화하지 않음', anchor='middle', color='blue', size=15)
            # The two network segments share one end-to-end TLS scope; no connector crosses the proxy label.
        else:
            c.message(200, 375, y + 52, 'TLS A', size=15)
            c.message(530, 705, y + 52, 'HTTP' if y == 60 else 'TLS B', color='red' if y == 60 else 'blue', size=15)
    c.text(25, 470, 'TLS 연결의 끝점이 곧 평문을 볼 수 있는 지점이다. 재암호화는 별도의 인증서 검증을 포함한다.', size=15, color='muted')


def _nat(c):
    c.message(270, 375, 110, '요청', size=14)
    c.message(375, 270, 155, '복원', reply=True, size=14)
    c.message(545, 670, 110, '요청', size=14)
    c.message(670, 545, 155, '응답', reply=True, size=14)
    c.box(40, 75, 230, 110, '내부 소켓', '10.0.0.2:51000')
    c.box(375, 75, 170, 110, ['SNAT', '매핑 상태 조회'], fill='soft')
    c.box(670, 75, 195, 110, '목적지 서비스', '203.0.113.80:443')
    c.text(40, 242, '이 연결의 변환 상태', size=17, weight=500)
    cols = [(40, 210, '프로토콜', 'TCP'), (250, 220, '내부 출발지', '10.0.0.2:51000'), (470, 220, '외부 출발지', '198.51.100.5:62001'), (690, 175, '목적지', '203.0.113.80:443')]
    for x, width, head, value in cols:
        c.rect(x, 260, width, 100, fill='soft', stroke='line', radius=0)
        c.text(x + width / 2, 289, head, anchor='middle', size=15, color='muted')
        c.text(x + width / 2, 332, value, anchor='middle', size=14)
    c.lines(40, 410, ['반환 패킷은 외부 포트 62001에 대한 매핑을 찾아 내부 소켓 51000으로 복원된다.', '주소·포트 변환과 방화벽의 허용·차단 정책은 서로 다른 기능이다.'], gap=28, size=16)


def _waterfall(c):
    x0, scale = 190, 2
    for t in range(0, 301, 50):
        x = x0 + t * scale
        c.line(x, 65, x, 370, dash=True)
        c.text(x, 410, f'{t}', anchor='middle', size=15, color='muted')
    c.line(630, 65, 630, 370, color='blue', dash=True)
    c.text(630, 40, '첫 바이트 220ms', anchor='middle', size=16, color='blue')
    c.text(790, 64, '완료 300ms', anchor='middle', size=15)
    current = 0
    for y, label, duration, color in [(90, 'DNS', 20, 'accent'), (150, '연결', 40, 'accent'), (210, 'TLS', 40, 'accent'), (270, '요청~첫 바이트', 120, 'orange'), (330, '본문 전송', 80, 'blue')]:
        c.text(25, y + 23, label, size=16)
        c.rect(x0 + current * scale, y, duration * scale, 32, fill=color, stroke=color, radius=3)
        c.text(x0 + current * scale + duration * scale / 2, y + 23, str(duration), anchor='middle', size=14, color='paper')
        current += duration
    c.arrow([(190, 385), (825, 385)], color='muted')
    c.text(840, 410, 'ms', size=14, color='muted')
    c.text(25, 465, '대기 120ms는 요청 전송·왕복·큐·앱·업스트림 작업을 포함할 수 있다. 앱 실행 시간으로 단정하지 않는다.', size=15, color='muted')


def _diagnosis(c):
    # Outcomes are next investigation steps, never asserted root causes.
    c.arrow([(450, 135), (450, 215)])
    c.text(474, 180, '예', size=15)
    c.arrow([(310, 100), (245, 100)], color='orange')
    c.text(276, 85, '아니오', anchor='middle', size=14, color='orange')
    c.arrow([(450, 285), (450, 365)])
    c.text(474, 330, '예', size=15)
    c.arrow([(310, 250), (245, 250)], color='orange')
    c.text(276, 235, '아니오', anchor='middle', size=14, color='orange')
    c.arrow([(310, 400), (245, 400)], color='orange')
    c.text(277, 383, '없음', anchor='middle', size=14, color='orange')
    c.arrow([(590, 400), (650, 400)], color='blue')
    c.text(620, 383, '2xx', anchor='middle', size=14, color='blue')
    c.arrow([(450, 435), (450, 535)], color='orange')
    c.text(475, 490, '4xx / 5xx', size=15, color='orange')
    c.box(310, 65, 280, 70, '주소를 확보했는가?', fill='soft')
    c.box(25, 65, 220, 70, ['DNS 조회 결과', '리졸버·캐시부터 확인'])
    c.box(310, 215, 280, 70, '연결·TLS가 성공했는가?', fill='soft')
    c.box(25, 215, 220, 70, ['연결 또는 TLS', '포트·오류 원문·인증서 확인'])
    c.box(310, 365, 280, 70, 'HTTP 응답은 어떤 상태인가?', fill='soft')
    c.box(25, 365, 220, 70, ['응답 대기·타임아웃', '어느 구간에서 기다렸는가?'])
    c.box(650, 355, 225, 105, ['JS가 응답을 읽을 수 있나?', '차단이면 CORS 검사'], '업무 성공 여부도 별도 확인')
    c.box(310, 535, 280, 85, ['어느 계층이 응답을 만들었나?', '요청 ID로 프록시·앱 로그 대조'])
    c.text(25, 665, '분기는 다음 조사 위치를 고르는 기준이다. 상태 코드 하나만으로 실제 원인을 확정하지 않는다.', size=15, color='muted')


# A chapter may use more than one representation when each answers a different
# question (hierarchy versus temporal sequence, cache lifetime versus connection).
_FIGURES = {
    '01': [('request-boundaries', 'architecture', '주소 조회와 웹 요청은 같은 경로를 지날까?',
            'DNS는 브라우저와 별도로 주소를 교환하고, 프록시는 앱에 별도 연결을 만든다.',
            'DNS를 HTTP 본문 경로에 놓지 마세요. 프록시 앞·뒤 연결의 실패와 암호화는 각각 확인합니다.', 445, _journey)],
    '02': [('name-tree', 'hierarchy', '이름 공간의 어느 부분을 누가 담당할까?',
            '점(.)에서 com., example.com., api 레코드로 내려가는 이름과 위임의 계층이다.',
            '아래로 내려가는 것은 이름의 포함·위임 관계입니다. 실제 네트워크 질의의 주체는 재귀 리졸버입니다.', 510, _dns_tree),
           ('query-sequence', 'sequence', '권한 서버까지 실제로 질의하는 주체는 누구일까?',
            '캐시가 없는 리졸버가 루트·TLD·권한 서버에 각각 질의하고 결과를 돌려준다.',
            '시간은 위에서 아래로 읽습니다. 루트가 TLD에 질의를 전달하는 것이 아니라, 리졸버가 안내를 받아 다시 묻습니다.', 660, _dns_sequence)],
    '03': [('ttl-time', 'timeline', '원본 주소를 바꿨는데 왜 이전 주소를 응답할까?',
            '0초에 TTL 60초로 v1을 저장하고, 20초에 원본만 v2로 바꾼 같은 리졸버의 시간축이다.',
            '30초 조회는 v1 캐시를 재사용합니다. 60초에 만료된 뒤 조회하면 원본의 새 결과를 가져옵니다. 실제 값은 리졸버 정책에 따라 다를 수 있습니다.', 430, _ttl),
           ('connection-lifetime', 'architecture', 'TTL 만료는 기존 연결도 새 서버로 옮길까?',
            '이전 서버에 이미 열린 연결과 새 DNS 결과를 사용해 만드는 연결은 다른 상태다.',
            'DNS 변경과 연결 종료는 별도 사건입니다. 캐시를 비우는 것만으로 기존 keep-alive 연결을 이전시킬 수 없습니다.', 350, _existing_connection)],
    '04': [('message-anatomy', 'anatomy', '본문 데이터와 본문을 설명하는 헤더는 어떻게 구분할까?',
            'HTTP/1.1 POST 메시지를 요청 줄·헤더·빈 줄·본문으로 나누어 읽는다.',
            'Content-Length는 본문의 바이트 수입니다. Content-Type은 본문을 해석할 형식이며, 둘 다 본문 자체와는 구분됩니다.', 505, _http_message)],
    '05': [('cache-branches', 'decision', '같은 GET인데 언제 서버에 다시 요청할까?',
            '저장 응답의 존재와 freshness, 재검증 의무에 따라 요청 경로가 달라진다.',
            'no-cache는 저장 금지가 아닙니다. 저장한 응답이 있어도 사용 전에 검증해야 하므로 조건부 요청 경로로 갑니다.', 600, _cache_decision),
           ('etag-revalidation', 'sequence', '304를 받으면 화면에 쓸 본문은 어디서 올까?',
            '저장된 ETag와 원본을 비교하고, 변경이 없으면 기존 본문을 재사용한다.',
            '저장 응답은 브라우저 내부의 논리 요소입니다. 304 검증에는 서버 왕복이 있지만 새 본문은 없고, 본문은 저장소에서 가져옵니다.', 400, _cache_validation)],
    '06': [('cors-comparison', 'paired-sequence', 'CORS 실패는 항상 서버 요청을 막을까?',
            'preflight 없는 GET의 응답 읽기 차단과 preflight 실패로 PUT을 보내지 않는 경우를 나란히 비교한다.',
            '“서버가 처리했는가”와 “JS가 응답을 읽는가”를 따로 질문하세요. 이 그림은 두 독립 사례이며 GET 다음 PUT을 순서대로 실행한 과정이 아닙니다.', 580, _cors)],
    '07': [('tls-handshake', 'sequence', 'TLS의 어느 메시지부터 보호되고, 언제 서버를 검증할까?',
            '일반적인 TLS 1.3 인증서 기반 full handshake의 메시지와 보호 구간을 표시했다.',
            'ClientHello·ServerHello 뒤에는 키가 유도됩니다. 인증서는 보호된 핸드셰이크 안에서 전달되고, 검증 후 애플리케이션 데이터로 진행합니다. 재개·0-RTT·클라이언트 인증은 생략했습니다.', 680, _tls)],
    '08': [('stream-delivery', 'aligned-lanes', 'B의 데이터 손실이 다른 응답까지 기다리게 할까?',
            '세 전송 모델의 A·B·C 응답 완료 지연을 같은 임의 시간축에 놓고 비교했다.',
            'HTTP/2는 한 TCP 연결의 순서 보장 영향을 공유합니다. HTTP/3는 스트림별 전달 순서가 분리되지만 공유 혼잡 제어·대역폭 영향까지 사라지는 것은 아닙니다.', 535, _versions)],
    '09': [('proxy-connections', 'deployment', '클라이언트 연결과 업스트림 연결은 어디에서 나뉠까?',
            '리버스 프록시가 TLS A를 종료하고 선택한 서버에 별도 TLS B 또는 C 연결을 사용한다.',
            '프록시는 두 연결의 종단입니다. 클라이언트 측 성공을 업스트림 연결 성공으로 해석하지 말고 어느 쪽에서 실패했는지 구분합니다.', 450, _proxy_connections),
           ('tls-termination', 'trust-boundary', 'TLS 종료 위치를 바꾸면 누가 평문을 볼 수 있을까?',
            '프록시 종료 후 HTTP, 재암호화, passthrough의 연결 끝점을 비교한다.',
            '재암호화는 독립 TLS 연결 두 개이고 프록시는 HTTP를 읽습니다. passthrough는 클라이언트와 앱 사이 TLS를 중간 장비가 그대로 전달합니다.', 505, _tls_boundaries)],
    '10': [('nat-state', 'mapping', '공유 출구로 돌아온 응답은 어떤 내부 소켓으로 갈까?',
            'IPv4 SNAT의 요청·응답 방향과 이 연결이 사용하는 주소·포트 변환 상태를 함께 보여준다.',
            '반환 경로는 연결의 매핑 상태를 사용합니다. NAT 매핑이 있다는 사실과 통신을 허용한다는 방화벽 정책을 같은 의미로 해석하지 마세요.', 480, _nat)],
    '11': [('request-waterfall', 'waterfall', '첫 바이트 220ms 중 앱 실행 시간은 얼마일까?',
            'DNS 20ms, 연결 40ms, TLS 40ms, 첫 바이트 대기 120ms, 본문 전송 80ms의 순차 예시다.',
            '이 관찰만으로 앱 실행 시간은 알 수 없습니다. 기존 연결을 재사용하면 앞 구간이 생략될 수 있지만 서버·업스트림 대기와 본문 전송은 남습니다.', 500, _waterfall)],
    '12': [('evidence-branches', 'diagnostic-flow', '어디까지 성공했는지 알면 다음 조사가 어떻게 달라질까?',
            '주소·연결·TLS·HTTP 응답의 확인 결과에 따라 추가로 모을 증거를 나누었다.',
            '대표 실패 경로만 표시했습니다. 리다이렉트 등은 생략합니다. 관찰 지점·응답 생성 계층·동일 요청 ID를 확인한 뒤 가설을 검사합니다.', 700, _diagnosis)],
}


def render_visuals(chapter_id):
    """Return complete, static HTML figures for one chapter (01 through 12)."""
    cid = str(chapter_id).zfill(2)
    if cid not in _FIGURES:
        raise ValueError(f'Unknown network chapter: {chapter_id}')
    return ''.join(_figure(cid, *spec) for spec in _FIGURES[cid])
