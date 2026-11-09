(function () {
  "use strict";
  const $ = id => document.getElementById(id), names = ["A", "B", "C"];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const text = (x, y, value, cls = "", anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(value)}</text>`;
  const box = (x, y, w, h, cls = "node") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="${cls}"/>`;
  const circle = (x, y, cls = "node", radius = 27) => `<circle cx="${x}" cy="${y}" r="${radius}" class="${cls}"/>`;
  function openSvg(label, type, height) {
    return `<svg class="c03-live" viewBox="0 0 760 ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><defs><marker id="c03-${type}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:context-stroke"/></marker></defs>`;
  }
  const arrow = (path, type, cls = "") => `<path d="${path}" class="arrow ${cls}" marker-end="url(#c03-${type}-arrow)"/>`;

  const generators = [
    { name: "a", from: 0, to: 1, shape: "M132 196L354 119", x: 235, y: 140 },
    { name: "b", from: 1, to: 2, shape: "M406 119L628 196", x: 525, y: 140 },
    { name: "c", from: 0, to: 2, shape: "M130 230Q380 335 630 230", x: 380, y: 296 },
    { name: "l", from: 1, to: 1, shape: "M360 82C285 0 475 0 400 82", x: 380, y: 24 }
  ];
  const activeEdges = () => generators.filter(edge => $("edge-" + edge.name).checked);
  function pathsUpTo(edges, bound) {
    let frontier = names.map((_, i) => ({ from: i, to: i, word: [] }));
    const paths = [...frontier];
    for (let length = 0; length < bound; length++) {
      const next = [];
      for (const path of frontier) for (const edge of edges) if (path.to === edge.from) next.push({ from: path.from, to: edge.to, word: [...path.word, edge.name] });
      paths.push(...next); frontier = next;
    }
    return paths;
  }
  const pathName = path => path.word.length ? path.word.join("·") : `id_${names[path.from]}`;
  const pathKey = path => `${path.from}:${path.word.join(",")}`;
  let paths = [], step = 0, timer = null;
  function pausePath() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    $("path-play").textContent = "▶ 재생";
    $("path-play").setAttribute("aria-pressed", "false");
  }
  function selectedPath() { return paths[Number($("path-choice").value)] || paths[0]; }
  function buildPaths() {
    pausePath();
    const old = paths.length ? pathKey(selectedPath()) : null;
    paths = pathsUpTo(activeEdges(), Number($("path-bound").value));
    let index = paths.findIndex(path => pathKey(path) === old);
    if (old === null) index = paths.findIndex(path => path.word.join("") === "ab");
    if (index < 0) index = 0;
    $("path-choice").innerHTML = paths.map((path, i) => `<option value="${i}">${esc(pathName(path))} : ${names[path.from]} → ${names[path.to]}</option>`).join("");
    $("path-choice").value = String(index); step = 0; renderPath();
  }
  function renderPath(motion = false) {
    const path = selectedPath(), traversed = path.word.slice(0, step), current = step ? generators.find(edge => edge.name === traversed.at(-1)).to : path.from;
    let svg = openSvg(`자유 범주 경로 ${pathName(path)}, ${step}/${path.word.length} 변을 지남`, "path", 420);
    const idLoops = ["M85 190C12 115 12 285 85 230", "M403 86C493 20 493 174 403 123", "M675 190C748 115 748 285 675 230"];
    const nodePositions = [[105, 210], [380, 105], [655, 210]];
    idLoops.forEach((loop, i) => { svg += arrow(loop, "path", "faint") + text(i === 0 ? 43 : i === 1 ? 466 : 717, i === 1 ? 87 : 176, `id_${names[i]}`, "small muted"); });
    for (const edge of activeEdges()) {
      const used = traversed.includes(edge.name), latest = step > 0 && path.word[step - 1] === edge.name;
      svg += arrow(edge.shape, "path", `${used ? "active-edge" : ""}${latest && motion ? " travel" : ""}`) + text(edge.x, edge.y, edge.name);
    }
    nodePositions.forEach(([x, y], i) => { svg += circle(x, y, i === current ? "selected" : "node") + text(x, y + 6, names[i]); });
    svg += text(30, 341, "선택한 사상", "small", "start");
    svg += box(30, 355, 83, 38, "selected") + text(71, 380, names[path.from]);
    if (!path.word.length) svg += text(330, 379, "길이 0 · 같은 객체에 머무름", "muted");
    path.word.forEach((edge, i) => {
      const x = 140 + i * 141;
      svg += arrow(`M${x - 22} 374H${x - 4}`, "path", i < step ? "active-edge" : "faint");
      svg += box(x, 355, 116, 38, i < step ? "done" : "node") + text(x + 58, 380, `${i + 1}. ${edge}`);
    });
    $("path-diagram").innerHTML = svg + "</svg>";
    $("path-position").textContent = `${step} / ${path.word.length} 변 · 현재 ${names[current]}`;
    $("path-prev").disabled = step === 0;
    $("path-next").disabled = step >= path.word.length;
    $("path-play").disabled = path.word.length === 0;
    const hom = paths.filter(p => p.from === 0 && p.to === 2);
    $("path-output").textContent = `길이 ≤ ${$("path-bound").value} 표시 목록: ${paths.length}개 사상\n선택: ${pathName(path)} : ${names[path.from]} → ${names[path.to]}\n지나간 변: ${traversed.length ? traversed.join(" → ") : "아직 없음 (길이 0)"}\n현재 객체: ${names[current]}\n표시한 Hom(A,C): ${hom.length ? hom.map(pathName).join(", ") : "없음"}\n${$("edge-l").checked ? "고리 l이 있어 전체 자유 범주의 사상은 무한합니다. 지금은 길이 한도 안의 일부만 표시합니다." : "표시 한도 밖의 경로가 있을 수 있습니다. 생성 그래프와 합성 경로를 구분하세요."}`;
    $("path-list").innerHTML = paths.map((p, i) => `<button class="btn${p === path ? " current" : ""}" type="button" data-path-index="${i}" aria-pressed="${p === path}">${esc(pathName(p))} (${names[p.from]}→${names[p.to]})</button>`).join("");
  }
  generators.forEach(edge => $("edge-" + edge.name).addEventListener("input", buildPaths));
  $("path-bound").addEventListener("input", buildPaths);
  $("path-choice").addEventListener("input", () => { pausePath(); step = 0; renderPath(); });
  $("path-list").addEventListener("click", event => {
    const button = event.target.closest("button[data-path-index]"); if (!button) return;
    const index = Number(button.dataset.pathIndex); if (!Number.isInteger(index) || index < 0 || index >= paths.length) return;
    $("path-choice").value = String(index); pausePath(); step = 0; renderPath();
    $("path-list").querySelector(`button[data-path-index="${index}"]`).focus();
  });
  $("path-reset").addEventListener("click", () => { pausePath(); step = 0; renderPath(); });
  $("path-prev").addEventListener("click", () => { pausePath(); step = Math.max(0, step - 1); renderPath(); });
  $("path-next").addEventListener("click", () => { pausePath(); step = Math.min(selectedPath().word.length, step + 1); renderPath(true); });
  $("path-play").addEventListener("click", () => {
    if (timer !== null) { pausePath(); return; }
    const path = selectedPath(); if (!path.word.length) return;
    if (step >= path.word.length) { step = 0; renderPath(); }
    $("path-play").textContent = "⏸ 일시정지"; $("path-play").setAttribute("aria-pressed", "true");
    timer = setInterval(() => { step++; renderPath(true); if (step >= path.word.length) pausePath(); }, 1100);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pausePath(); });
  window.addEventListener("pagehide", pausePath);
  buildPaths();

  const relationInputs = [...$("relation-widget").querySelectorAll("input[data-row]")];
  const readRelation = () => {
    const relation = Array.from({ length: 3 }, () => [false, false, false]);
    relationInputs.forEach(input => { relation[Number(input.dataset.row)][Number(input.dataset.col)] = input.checked; });
    return relation;
  };
  function writeRelation(relation) { relationInputs.forEach(input => { input.checked = relation[Number(input.dataset.row)][Number(input.dataset.col)]; }); }
  function classify(relation) {
    const missingIds = [], missingCompositions = [], cycles = [], incomparable = [];
    for (let a = 0; a < 3; a++) {
      if (!relation[a][a]) missingIds.push(a);
      for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) if (relation[a][b] && relation[b][c] && !relation[a][c]) missingCompositions.push([a, b, c]);
      for (let b = a + 1; b < 3; b++) {
        if (relation[a][b] && relation[b][a]) cycles.push([a, b]);
        if (!relation[a][b] && !relation[b][a]) incomparable.push([a, b]);
      }
    }
    const preorder = !missingIds.length && !missingCompositions.length, poset = preorder && !cycles.length, total = poset && !incomparable.length;
    return { missingIds, missingCompositions, cycles, incomparable, preorder, poset, total };
  }
  function closeRelation(relation) {
    const result = relation.map(row => [...row]);
    for (let i = 0; i < 3; i++) result[i][i] = true;
    for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) result[a][b] = result[a][b] || (result[a][k] && result[k][b]);
    return result;
  }
  const presets = {
    chain: [[true, true, true], [false, true, true], [false, false, true]],
    fork: [[true, true, true], [false, true, false], [false, false, true]],
    cycle: [[true, true, false], [true, true, false], [false, false, true]],
    missing: [[false, true, false], [false, false, true], [false, false, false]],
    discrete: [[true, false, false], [false, true, false], [false, false, true]]
  };
  function renderRelation() {
    const relation = readRelation(), status = classify(relation), from = names.indexOf($("hom-from").value), to = names.indexOf($("hom-to").value);
    const points = [[120, 245], [380, 105], [640, 245]];
    let svg = openSvg(`관계의 분류: 준순서 ${status.preorder}, 부분순서 ${status.poset}, 선형순서 ${status.total}`, "relation", 380);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (relation[a][b]) {
      const chosen = a === from && b === to;
      if (a === b) {
        const [x, y] = points[a];
        svg += arrow(`M${x - 18} ${y - 23}C${x - 87} ${y - 110} ${x + 87} ${y - 110} ${x + 18} ${y - 23}`, "relation", chosen ? "active-edge" : "") + text(x, y - 94, `id_${names[a]}`, "small");
      } else {
        const [x1, y1] = points[a], [x2, y2] = points[b], dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
        const sx = x1 + dx * 32 / length, sy = y1 + dy * 32 / length, ex = x2 - dx * 32 / length, ey = y2 - dy * 32 / length;
        const mx = (x1 + x2) / 2 + nx * 35, my = (y1 + y2) / 2 + ny * 35;
        svg += arrow(`M${sx} ${sy}Q${mx} ${my} ${ex} ${ey}`, "relation", chosen ? "active-edge" : "") + text(mx, my - 6, `${names[a]}→${names[b]}`, "small");
      }
    }
    points.forEach(([x, y], i) => { svg += circle(x, y, !relation[i][i] ? "failure" : i === from || i === to ? "selected" : "node") + text(x, y + 6, names[i]); });
    svg += text(380, 326, `준순서: ${status.preorder ? "✓" : "✗"}   부분순서: ${status.poset ? "✓" : "✗"}   선형순서: ${status.total ? "✓" : "✗"}`);
    svg += text(380, 357, `Hom(${names[from]},${names[to]}) = ${relation[from][to] ? "{유일한 사상}" : "∅"} · 원소 ${relation[from][to] ? 1 : 0}개`, "small");
    $("relation-diagram").innerHTML = svg + "</svg>";
    const missing = [...new Set(status.missingCompositions.map(([a, , c]) => `${names[a]}→${names[c]}`))];
    $("relation-output").textContent = `준순서(preorder): ${status.preorder ? "성립" : "불성립"}\n부분순서(poset): ${status.poset ? "성립" : "불성립"}\n선형순서(total order): ${status.total ? "성립" : "불성립"}\n빠진 항등사상: ${status.missingIds.length ? status.missingIds.map(a => `id_${names[a]}`).join(", ") : "없음"}\n빠진 합성 결과: ${missing.length ? missing.join(", ") : "없음"}\n서로 다른 객체의 양방향 관계: ${status.cycles.length ? status.cycles.map(([a, b]) => `${names[a]}⇄${names[b]}`).join(", ") : "없음"}\n비교 불가능한 쌍: ${status.incomparable.length ? status.incomparable.map(([a, b]) => `${names[a]},${names[b]}`).join(" / ") : "없음"}\nHom(${names[from]},${names[to]}) 크기 = ${relation[from][to] ? 1 : 0}\n${status.cycles.length ? "양방향 관계는 준순서에서 허용하지만 부분순서의 반대칭성에는 어긋납니다." : "부분순서라고 모든 객체 쌍을 비교할 수 있는 것은 아닙니다."}`;
  }
  relationInputs.forEach(input => input.addEventListener("change", renderRelation));
  $("relation-preset").addEventListener("input", () => { writeRelation(presets[$("relation-preset").value]); renderRelation(); });
  $("relation-identities").addEventListener("click", () => { const relation = readRelation(); for (let i = 0; i < 3; i++) relation[i][i] = true; writeRelation(relation); renderRelation(); });
  $("relation-closure").addEventListener("click", () => { writeRelation(closeRelation(readRelation())); renderRelation(); });
  ["hom-from", "hom-to"].forEach(id => $(id).addEventListener("input", renderRelation));
  writeRelation(presets.chain); renderRelation();

  function parseMonoid(mode) {
    const raw = ["a", "b", "c", "unit"].map(id => $("monoid-" + id).value);
    if (mode === "concat") return { values: raw, op: (a, b) => a + b };
    if (mode === "and") {
      if (raw.some(value => !/^(true|false)$/i.test(value.trim()))) return { error: "AND의 a,b,c,e는 true 또는 false로 입력하세요." };
      return { values: raw.map(value => value.trim().toLowerCase() === "true"), op: (a, b) => a && b };
    }
    if (raw.some(value => !/^-?\d+$/.test(value.trim()))) return { error: "숫자는 빈칸·소수 없이 정수로 입력하세요." };
    const values = raw.map(value => Number(value.trim()));
    const min = mode === "mod3" ? 0 : -100, max = mode === "mod3" ? 2 : 100;
    if (values.some(value => !Number.isInteger(value) || value < min || value > max)) return { error: `${mode === "mod3" ? "mod 3의 원소는 0,1,2" : "이 위젯의 정수는 −100~100"}만 입력하세요.` };
    return { values, op: mode === "add" ? (a, b) => a + b : mode === "subtract" ? (a, b) => a - b : (a, b) => (a + b) % 3 };
  }
  const show = value => typeof value === "string" ? `"${value}"` : String(value);
  const short = value => { const label = show(value); return label.length > 20 ? label.slice(0, 17) + "…" : label; };
  function renderMonoid(motion = false) {
    const mode = $("monoid-mode").value, data = parseMonoid(mode);
    if (data.error) { $("monoid-diagram").textContent = data.error; $("monoid-output").textContent = data.error; return; }
    const [a, b, c, unit] = data.values, op = data.op, ab = op(a, b), bc = op(b, c), left = op(ab, c), right = op(a, bc), assoc = left === right, before = op(unit, a), after = op(a, unit);
    const lawful = mode !== "subtract" && unit === (mode === "concat" ? "" : mode === "and" ? true : 0);
    let svg = openSvg(`모노이드 법칙: 왼쪽 ${show(left)}, 오른쪽 ${show(right)}, 합성 규약g∘f=g⋆f`, "monoid", 430);
    svg += circle(119, 182, "selected", 34) + text(119, 188, "⋆");
    svg += arrow("M95 157C1 54 236 54 143 157", "monoid", motion ? "travel" : "") + text(118, 71, `f = ${short(a)}`, "small");
    svg += arrow("M148 164C263 89 263 276 148 201", "monoid", motion ? "travel" : "") + text(220, 150, "g = b", "small");
    svg += arrow("M90 200C10 288 10 85 90 165".replaceAll("−", "-"), "monoid", "faint") + text(40, 226, "id = e", "small");
    svg += text(119, 300, "객체는 ⋆ 하나", "small") + text(119, 326, "a,b,c,e는 사상 후보", "small");
    svg += text(119, 350, lawful ? "한 객체 범주" : "법칙 불충족 · 범주 아님", "small");
    svg += text(490, 34, "괄호만 바꾸어 비교하기");
    svg += box(295, 55, 390, 49, "node") + text(490, 85, `(a ⋆ b) ⋆ c = ${short(ab)} ⋆ ${short(c)}`, "small");
    svg += arrow("M490 109V135", "monoid", motion ? "travel" : "") + box(350, 141, 280, 44, assoc ? "done" : "failure") + text(490, 169, short(left));
    svg += box(295, 205, 390, 49, "node") + text(490, 235, `a ⋆ (b ⋆ c) = ${short(a)} ⋆ ${short(bc)}`, "small");
    svg += arrow("M490 259V285", "monoid", motion ? "travel" : "") + box(350, 291, 280, 44, assoc ? "done" : "failure") + text(490, 319, short(right));
    svg += text(490, 367, assoc ? "이 삼중쌍에서 결합 결과 같음 ✓" : "결합법칙의 반례 발견 ✗", "small");
    svg += text(380, 409, `g ∘ f := b ⋆ a = ${short(op(b, a))}  (순서를 바꾸는 교환법칙은 요구하지 않음)`, "small");
    $("monoid-diagram").innerHTML = svg + "</svg>";
    const composition = mode === "concat" ? `\n문자열 사상은 앞에 붙입니다. f 다음 g: P_b(P_a(x)) = ${show(b + a)} + x\ng ∘ f = b ⋆ a = ${show(op(b, a))}` : `\ng ∘ f := b ⋆ a = ${show(op(b, a))}`;
    $("monoid-output").textContent = `${lawful ? "이 연산과 항등원은 모노이드의 한 객체 범주를 만듭니다." : "범주 후보: 이 연산·항등원은 모노이드 법칙을 모두 만족하지 않아 범주가 아닙니다."}\n(a ⋆ b) ⋆ c = ${show(left)}\na ⋆ (b ⋆ c) = ${show(right)}\n결합 결과: ${assoc ? "이 삼중쌍에서는 같음" : "다름 · 반례"}\ne ⋆ a = ${show(before)} ${before === a ? "✓" : "✗"}\na ⋆ e = ${show(after)} ${after === a ? "✓" : "✗"}\n이 a에서 양쪽 항등법칙: ${before === a && after === a ? "성립" : "실패"}${composition}\n${mode === "subtract" ? "뺄셈은 어떤 표본에서 우연히 같아도 전체 정수에 대한 모노이드 연산이 아닙니다." : "표본의 성립만으로 일반 법칙을 증명한 것은 아닙니다."}`;
  }
  const defaults = { concat: ["a", "b", "c", ""], add: ["2", "3", "4", "0"], subtract: ["2", "3", "4", "0"], mod3: ["1", "2", "2", "0"], and: ["true", "false", "true", "true"] };
  $("monoid-mode").addEventListener("input", () => { ["a", "b", "c", "unit"].forEach((id, index) => { $("monoid-" + id).value = defaults[$("monoid-mode").value][index]; }); renderMonoid(); });
  ["a", "b", "c", "unit"].forEach(id => $("monoid-" + id).addEventListener("input", () => renderMonoid()));
  renderMonoid();
})();
