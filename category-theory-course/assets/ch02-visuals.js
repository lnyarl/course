(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  function svgOpen(title, height) {
    return `<svg class="ct02-live" viewBox="0 0 760 ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><defs><marker id="ct02-${height}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:context-stroke"/></marker></defs>`;
  }
  const text = (x, y, value, cls = "", anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(value)}</text>`;
  const rect = (x, y, w, h, cls = "node", radius = 9) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" class="${cls}"/>`;
  const arrow = (path, height, cls = "", motion = false) => `<path d="${path}" class="edge ${cls}${motion ? " travel" : ""}" marker-end="url(#ct02-${height}-arrow)"/>`;

  function renderPartialVisual(motion = false) {
    const mode = $("partial-mode").value, selected = Number($("partial-x").value), height = 420;
    let svg = svgOpen(`역수의 정의역과 결과: ${mode === "raw" ? "부분함수" : mode === "restrict" ? "0을 제외한 정의역" : "실패를 반환값으로 표현"}, 선택 입력 ${selected}`, height);
    svg += rect(25, 46, 130, 324, "set") + rect(505, 46, 230, 324, "set");
    svg += text(90, 27, mode === "restrict" ? "A′ = A ∖ {0}" : "A = {−3,…,3}");
    svg += text(620, 27, mode === "result" ? "Success(ℚ) + Failure" : "공역 ℚ의 일부");
    for (let n = -3; n <= 3; n++) {
      const y = 77 + (n + 3) * 43, active = n === selected, excluded = n === 0 && mode === "restrict";
      const value = n === 0 ? null : Math.abs(n) === 1 ? String(n) : `${n < 0 ? "−" : ""}1/${Math.abs(n)}`;
      svg += rect(43, y - 17, 94, 31, excluded ? "node excluded" : active ? "selected" : "node");
      svg += text(90, y + 4, n, excluded ? "excluded" : "");
      if (n === 0 && mode !== "result") {
        svg += text(620, y + 4, mode === "restrict" ? "0은 정의역 밖" : "대응할 유리수가 없음", "small muted");
        if (!excluded) svg += arrow(`M143 ${y}H438`, height, "is-failure", active && motion) + text(462, y + 6, "×", "");
      } else {
        svg += rect(526, y - 17, 188, 31, n === 0 ? "failure" : active ? "selected" : "node");
        svg += text(620, y + 4, n === 0 ? "Failure(Zero)" : mode === "result" ? `Success(${value})` : value);
        svg += arrow(`M143 ${y}H520`, height, active ? "is-active" : "", active && motion);
      }
    }
    svg += text(380, 397, mode === "raw" ? "0의 화살표가 끊깁니다. 정상 결과가 없는 부분함수입니다." : mode === "restrict" ? "회색 0은 입력 집합에 포함하지 않습니다." : "0도 Failure로 도착합니다. 실패 역시 반환 데이터입니다.", "small");
    $("partial-live-diagram").innerHTML = svg + "</svg>";
    $("partial-live-caption").textContent = `입력 ${selected}의 화살표를 강조했습니다. ${mode === "raw" && selected === 0 ? "×는 공역의 값이 아니라 대응이 없다는 표시입니다." : "슬라이더와 모델 선택을 바꾸며 입력 집합과 도착점의 변화를 비교하세요."}`;
  }
  ["partial-mode", "partial-x"].forEach(id => $(id).addEventListener("input", () => renderPartialVisual()));
  renderPartialVisual();

  function finiteState() {
    const a = Number($("finite-a").value), b = Number($("finite-b").value), raw = $("finite-index").value.trim();
    const count = BigInt(b) ** BigInt(a);
    if (count === 0n) return { a, b, count, index: 0n, mapping: [] };
    if (!/^\d+$/.test(raw) || BigInt(raw) >= count) return { a, b, count, invalid: true };
    const index = BigInt(raw), mapping = [];
    let code = index;
    for (let i = 0; i < a; i++) { mapping.push(Number(code % BigInt(b))); code /= BigInt(b); }
    return { a, b, count, index, mapping };
  }
  function renderFiniteVisual(motion = false) {
    const state = finiteState(), { a, b, count } = state, height = 330;
    $("finite-prev-map").disabled = state.invalid || count <= 1n || state.index === 0n;
    $("finite-next-map").disabled = state.invalid || count <= 1n || state.index === count - 1n;
    let svg = svgOpen(`유한 함수 대응도: 정의역 ${a}개, 공역 ${b}개, 함수 ${count}개`, height);
    svg += rect(35, 58, 170, 222, "set") + rect(555, 58, 170, 222, "set");
    svg += text(120, 35, `A · ${a}개`) + text(640, 35, `B · ${b}개`);
    const position = (index, size) => 169 + (index - (size - 1) / 2) * 49;
    if (a === 0) svg += text(120, 174, "∅", "");
    if (b === 0) svg += text(640, 174, "∅", "");
    for (let i = 0; i < a; i++) {
      const y = position(i, a);
      svg += rect(68, y - 16, 104, 32) + text(120, y + 5, `a${i}`);
    }
    for (let j = 0; j < b; j++) {
      const y = position(j, b), used = state.mapping && state.mapping.includes(j);
      svg += rect(588, y - 16, 104, 32, used ? "selected" : "node") + text(640, y + 5, `b${j}`);
    }
    if (!state.invalid && count > 0n) {
      state.mapping.forEach((output, input) => {
        const y1 = position(input, a), y2 = position(output, b);
        svg += arrow(`M178 ${y1}C310 ${y1} 450 ${y2} 582 ${y2}`, height, "is-active", motion);
      });
    }
    const caption = state.invalid ? "함수 번호가 유효하지 않아 화살표를 표시하지 않습니다." : count === 0n ? "필요한 입력 화살표를 보낼 곳이 없습니다. 함수 0개." : a === 0 ? "입력 화살표를 정할 일이 없습니다. 빈 대응표 하나가 함수입니다." : `함수 #${state.index}: 각 입력에서 정확히 한 화살표. 같은 출력으로 모여도 됩니다.`;
    svg += text(380, 310, caption, "small");
    $("finite-live-diagram").innerHTML = svg + "</svg>";
    $("finite-live-caption").textContent = `${b}^${a} = ${count}. ${caption}`;
    $("finite-picks").innerHTML = !state.invalid && count > 0n && a > 0 && b > 1 ? state.mapping.map((output, input) => `<button class="btn" type="button" data-map-input="${input}">a${input}의 결과 바꾸기 · b${output}</button>`).join("") : "";
  }
  function setFiniteIndex(index) {
    $("finite-index").value = String(index);
    $("finite-index").dispatchEvent(new Event("input", { bubbles: true }));
  }
  $("finite-prev-map").addEventListener("click", () => { const state = finiteState(); if (!state.invalid && state.index > 0n) setFiniteIndex(state.index - 1n); });
  $("finite-next-map").addEventListener("click", () => { const state = finiteState(); if (!state.invalid && state.index + 1n < state.count) setFiniteIndex(state.index + 1n); });
  $("finite-picks").addEventListener("click", event => {
    const button = event.target.closest("button[data-map-input]");
    if (!button) return;
    const state = finiteState(), input = Number(button.dataset.mapInput);
    if (state.invalid || !state.mapping || !Number.isInteger(input) || input < 0 || input >= state.a || state.b < 2) return;
    const old = state.mapping[input], next = (old + 1) % state.b;
    setFiniteIndex(state.index + BigInt(next - old) * (BigInt(state.b) ** BigInt(input)));
    // Rendering replaces the mapping buttons; keep keyboard focus on the edited input.
    $("finite-picks").querySelector(`button[data-map-input="${input}"]`).focus();
  });
  ["finite-a", "finite-b", "finite-index"].forEach(id => $(id).addEventListener("input", () => renderFiniteVisual()));
  renderFiniteVisual();

  function memoInputs() {
    const parts = $("memo-input").value.split(",");
    if (parts.length > 8 || parts.some(value => !/^-?\d+$/.test(value.trim()))) return null;
    const inputs = parts.map(value => Number(value.trim()));
    return inputs.every(value => Number.isInteger(value) && value >= -20 && value <= 20) ? inputs : null;
  }
  function memoSnapshot(mode, inputs, count, memoized) {
    const cache = new Map(), results = [], logs = [];
    let state = 0, calculations = 0, lastHit = false;
    for (let i = 0; i < count; i++) {
      const n = inputs[i];
      lastHit = memoized && cache.has(n);
      if (lastHit) { results.push(cache.get(n)); continue; }
      calculations++;
      let result;
      if (mode === "counter") { state += n; result = state; }
      else if (mode === "logging") { logs.push(n); result = true; }
      else result = n * n;
      results.push(result);
      if (memoized) cache.set(n, result);
    }
    return { cache, results, logs, state, calculations, lastHit };
  }
  let memoStep = 0, memoTimer = null;
  function pauseMemo() {
    if (memoTimer !== null) clearInterval(memoTimer);
    memoTimer = null;
    $("memo-play").textContent = "▶ 재생";
    $("memo-play").setAttribute("aria-pressed", "false");
  }
  function renderMemoVisual(motion = false) {
    const inputs = memoInputs(), mode = $("memo-mode").value;
    $("memo-prev").disabled = !inputs || memoStep === 0;
    $("memo-next").disabled = !inputs || memoStep >= inputs.length;
    $("memo-play").disabled = !inputs;
    $("memo-position").textContent = inputs ? `${memoStep} / ${inputs.length} 요청 처리` : "입력 오류";
    if (!inputs) {
      pauseMemo();
      $("memo-live-diagram").textContent = "−20~20의 정수 1~8개를 쉼표로 구분하세요.";
      $("memo-step-output").textContent = "입력이 유효해지면 새 초기 상태에서 시작합니다.";
      return;
    }
    const direct = memoSnapshot(mode, inputs, memoStep, false), cached = memoSnapshot(mode, inputs, memoStep, true), current = memoStep ? inputs[memoStep - 1] : "—";
    const height = 520, running = memoStep > 0, hit = running && cached.lastHit;
    let svg = svgOpen(`요청 ${memoStep}/${inputs.length}, 직접 계산과 메모이제이션 비교${running ? `, 현재 입력 ${current}, 캐시 ${hit ? "적중" : "미스"}` : ""}`, height);
    svg += text(30, 25, "입력 순서", "small", "start");
    inputs.forEach((input, i) => {
      const x = 110 + i * 76;
      svg += rect(x, 7, 63, 31, i === memoStep - 1 ? "selected" : i < memoStep ? "hit" : "node") + text(x + 31, 28, input);
    });
    const fn = mode === "square" ? "n²" : mode === "counter" ? "S += n" : "Log → true";
    svg += text(30, 77, "직접 호출", "", "start");
    svg += rect(30, 95, 130, 49, running ? "selected" : "node") + text(95, 126, `n = ${current}`);
    svg += rect(277, 95, 170, 49, running ? "miss" : "node") + text(362, 126, fn);
    svg += rect(590, 95, 140, 49, running ? "selected" : "node") + text(660, 126, running ? direct.results.at(-1) : "결과 대기");
    svg += arrow("M164 120H271", height, running ? "is-active" : "", running && motion) + arrow("M451 120H584", height, running ? "is-active" : "", running && motion);
    svg += text(30, 173, `원래 계산 ${direct.calculations}회 · S=${direct.state} · 로그 ${direct.logs.length}개`, "small", "start");
    svg += text(30, 207, "메모이제이션", "", "start");
    svg += rect(30, 246, 130, 49, running ? "selected" : "node") + text(95, 277, `n = ${current}`);
    svg += rect(237, 246, 140, 49, running ? hit ? "hit" : "miss" : "node") + text(307, 277, !running ? "캐시 조회" : hit ? "HIT · 재사용" : "MISS · 계산");
    svg += rect(448, 246, 145, 49, running && !hit ? "miss" : "node") + text(520, 277, fn);
    const different = running && direct.results.at(-1) !== cached.results.at(-1);
    svg += rect(646, 246, 94, 49, different ? "failure" : running ? "selected" : "node") + text(693, 277, running ? cached.results.at(-1) : "대기");
    svg += arrow("M164 271H231", height, running ? "is-active" : "", running && motion);
    svg += arrow("M381 271H442", height, running && !hit ? "is-miss" : "", running && !hit && motion);
    svg += arrow("M597 271H640", height, running && !hit ? "is-miss" : "", running && !hit && motion);
    if (hit) svg += arrow("M307 241V222H693V240", height, "is-hit", motion) + text(525, 213, "함수 본문을 건너뜀", "small");
    svg += text(30, 326, `원래 계산 ${cached.calculations}회 · S=${cached.state} · 로그 ${cached.logs.length}개`, "small", "start");
    svg += text(30, 365, "요청 처리 후 캐시 · 입력 → 결과", "small", "start");
    if (!cached.cache.size) svg += text(380, 408, "비어 있음", "muted");
    [...cached.cache].forEach(([key, value], i) => {
      const x = 30 + (i % 4) * 182, y = 383 + Math.floor(i / 4) * 50;
      svg += rect(x, y, 169, 39, key === current ? hit ? "hit" : "miss" : "node") + text(x + 84, y + 25, `${key} → ${value}`);
    });
    svg += text(380, 498, running ? hit ? "초록 경로: 같은 인수의 캐시 값을 재사용. 상태 변경·로그도 실행하지 않습니다." : "노란 경로: 원래 함수를 실행하고 결과를 캐시에 저장합니다." : "다음 단계를 눌러 첫 요청부터 진행하세요.", "small");
    $("memo-live-diagram").innerHTML = svg + "</svg>";
    const sameValues = JSON.stringify(direct.results) === JSON.stringify(cached.results), sameLogs = JSON.stringify(direct.logs) === JSON.stringify(cached.logs);
    $("memo-step-output").textContent = `처리한 요청 ${memoStep}개\n직접 결과 [${direct.results.join(", ")}]\n캐시 결과 [${cached.results.join(", ")}]\n${running ? `이번 요청 n=${current}: ${hit ? "HIT → 본문 생략" : "MISS → 본문 실행"}` : "두 실행 모두 캐시·상태·로그가 빈 초기 상태입니다."}\n반환값 ${sameValues ? "같음" : "다름"} / 로그 ${sameLogs ? "같음" : "다름"}${mode === "counter" ? ` / 최종 상태 직접=${direct.state}, 캐시=${cached.state}` : ""}`;
  }
  function resetMemoVisual() { pauseMemo(); memoStep = 0; renderMemoVisual(); }
  $("memo-play").addEventListener("click", () => {
    if (memoTimer !== null) { pauseMemo(); return; }
    const inputs = memoInputs(); if (!inputs) return;
    if (memoStep >= inputs.length) { memoStep = 0; renderMemoVisual(); }
    $("memo-play").textContent = "⏸ 일시정지";
    $("memo-play").setAttribute("aria-pressed", "true");
    memoTimer = setInterval(() => {
      memoStep++; renderMemoVisual(true);
      if (memoStep >= inputs.length) pauseMemo();
    }, Number($("memo-speed").value));
  });
  $("memo-next").addEventListener("click", () => { pauseMemo(); const inputs = memoInputs(); if (inputs) memoStep = Math.min(inputs.length, memoStep + 1); renderMemoVisual(true); });
  $("memo-prev").addEventListener("click", () => { pauseMemo(); memoStep = Math.max(0, memoStep - 1); renderMemoVisual(); });
  $("memo-reset").addEventListener("click", resetMemoVisual);
  ["memo-mode", "memo-input"].forEach(id => $(id).addEventListener("input", resetMemoVisual));
  $("memo-run").addEventListener("click", resetMemoVisual);
  $("memo-speed").addEventListener("input", pauseMemo);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseMemo(); });
  window.addEventListener("pagehide", pauseMemo);
  renderMemoVisual();
})();
