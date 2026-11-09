(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const text = (x, y, value, cls = "", anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(value)}</text>`;
  const box = (x, y, w, h, cls = "node") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="${cls}"/>`;
  function openSvg(label, kind, height) {
    return `<svg class="c05-live" viewBox="0 0 760 ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><defs><marker id="c05-${kind}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:context-stroke"/></marker></defs>`;
  }
  const arrow = (path, kind, cls = "") => `<path d="${path}" class="arrow ${cls}" marker-end="url(#c05-${kind}-arrow)"/>`;

  function renderHom(motion = false) {
    const kind = $("hom-kind").value, size = Number($("hom-size").value), initial = kind === "initial";
    const counts = [0, 1, 2, 3].map(n => BigInt(initial ? n : size) ** BigInt(initial ? size : n));
    let svg = openSvg(`${initial ? "초기" : "말단"} 후보 K, 원소 ${size}개, 표시한 Hom 개수 ${counts.join(",")}`, "hom", 440);
    svg += box(35, 174, 180, 80, "selected") + text(125, 204, `후보 K · ${size}개`) + text(125, 232, initial ? "출발 객체" : "도착 객체", "small");
    const labels = ["Empty · 0개", "Unit · 1개", "Bool · 2개", "Three · 3개"];
    counts.forEach((count, n) => {
      const y = 68 + n * 96, cls = count === 1n ? "done" : count === 0n ? "failure" : "warn";
      svg += box(545, y - 29, 190, 58, cls) + text(640, y + 5, `X = ${labels[n]}`);
      const shape = initial ? `M220 214C365 214 391 ${y} 539 ${y}` : `M539 ${y}C391 ${y} 365 214 220 214`;
      svg += arrow(shape, "hom", (count === 1n ? "good-arrow" : count === 0n ? "bad-arrow" : "") + (motion ? " travel" : ""));
      svg += text(392, y - 11, `${initial ? n : size}^${initial ? size : n} = ${count}개`, "small");
    });
    svg += text(380, 422, `조건: ${initial ? "Hom(K,X)" : "Hom(X,K)"}가 모든 X에서 정확히 1개`, "small");
    $("hom-diagram").innerHTML = svg + "</svg>";
    const passed = counts.every(count => count === 1n);
    $("hom-output").textContent = `${initial ? "초기" : "말단"} 후보 K의 크기 = ${size}\n${counts.map((count, n) => `${initial ? `K → X(${n})` : `X(${n}) → K`}: ${count}개 ${count === 1n ? "✓" : count === 0n ? "존재 실패" : "유일성 실패"}`).join("\n")}\n표시한 검사 집합에서: ${passed ? "모두 정확히 하나" : "조건 실패"}\n${passed ? "전체 Set에 대한 근거는 본문의 빈 대응표·유일한 값 논증입니다. 이 도식만으로 임의 범주의 정리를 증명한 것은 아닙니다." : "반례 하나만 있어도 이 후보는 해당 초기·말단 조건을 만족하지 않습니다."}`;
  }
  ["hom-kind", "hom-size"].forEach(id => $(id).addEventListener("input", () => renderHom()));
  renderHom();

  const coordinates = [{ f: 0, g: 1, m: 1 }, { f: 1, g: 0, m: 2 }];
  function candidateElements() {
    const pairs = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const kind = $("product-candidate").value;
    if (kind === "missing") return [[0, 0], [1, 1]];
    if (kind === "extra") return pairs.flatMap(pair => [[...pair, 0], [...pair, 1]]);
    return pairs;
  }
  const tuple = item => `(${item.join(",")})`;
  function buildProductControls() {
    const count = Number($("product-domain").value), elements = candidateElements();
    $("product-coordinate-controls").innerHTML = coordinates.slice(0, count).map((point, i) => {
      const match = elements.findIndex(item => item[0] === point.f && item[1] === point.g);
      point.m = match >= 0 ? match : 0;
      const binaryOptions = selected => [0, 1].map(value => `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`).join("");
      return `<div class="c05-product-row"><b>x${i} ∈ X</b><div class="controls"><label for="product-f-${i}">목표 f(x${i})<select id="product-f-${i}" data-row="${i}" data-kind="f">${binaryOptions(point.f)}</select></label><label for="product-g-${i}">목표 g(x${i})<select id="product-g-${i}" data-row="${i}" data-kind="g">${binaryOptions(point.g)}</select></label><label for="product-m-${i}">직접 고르는 m(x${i})<select id="product-m-${i}" data-row="${i}" data-kind="m">${elements.map((item, index) => `<option value="${index}"${index === point.m ? " selected" : ""}>${tuple(item)}</option>`).join("")}</select></label></div></div>`;
    }).join("");
    renderProduct();
  }
  function renderProduct(motion = false) {
    const domain = Number($("product-domain").value), points = coordinates.slice(0, domain), elements = candidateElements();
    const choices = points.map(point => elements.filter(item => item[0] === point.f && item[1] === point.g));
    const total = choices.reduce((product, list) => product * list.length, 1);
    let svg = openSvg(`곱 후보의 매개사상 ${total}개, X의 원소 ${domain}개`, "product", domain === 2 ? 490 : 300);
    svg += text(380, 26, `이 f,g를 재현하는 전체 매개함수: ${total}개`);
    let currentOK = true;
    points.forEach((point, i) => {
      const y = 130 + i * 184, selected = elements[point.m], firstOK = selected[0] === point.f, secondOK = selected[1] === point.g;
      currentOK = currentOK && firstOK && secondOK;
      svg += box(25, y - 28, 115, 56, "selected") + text(82, y + 6, `x${i} ∈ X`);
      svg += arrow(`M146 ${y}H267`, "product", motion ? "travel" : "") + text(205, y - 12, "m", "small");
      svg += box(273, y - 36, 200, 72, firstOK && secondOK ? "done" : "failure") + text(373, y - 10, `m(x${i}) ∈ P`, "small") + text(373, y + 19, tuple(selected));
      svg += box(580, y - 74, 155, 55, firstOK ? "done" : "failure") + text(657, y - 52, `p(m(x${i})) = ${selected[0]}`, "small") + text(657, y - 30, `목표 f(x${i}) = ${point.f} ${firstOK ? "✓" : "✗"}`, "small");
      svg += box(580, y + 19, 155, 55, secondOK ? "done" : "failure") + text(657, y + 42, `q(m(x${i})) = ${selected[1]}`, "small") + text(657, y + 64, `목표 g(x${i}) = ${point.g} ${secondOK ? "✓" : "✗"}`, "small");
      svg += arrow(`M479 ${y - 14}L574 ${y - 46}`, "product", firstOK ? "good-arrow" : "bad-arrow") + text(521, y - 44, "p", "small");
      svg += arrow(`M479 ${y + 14}L574 ${y + 46}`, "product", secondOK ? "good-arrow" : "bad-arrow") + text(521, y + 48, "q", "small");
      svg += text(373, y + 92, `이 입력의 올바른 후보 출력: ${choices[i].length}개`, "small");
    });
    const status = total === 0 ? "존재 실패 · 매개함수 없음" : total === 1 ? "이 원뿔에서는 유일한 매개함수" : "유일성 실패 · 여러 매개함수";
    svg += text(380, domain === 2 ? 465 : 282, status, "small");
    $("product-diagram").innerHTML = svg + "</svg>";
    let functions = [[]];
    choices.forEach(list => { functions = functions.flatMap(previous => list.map(value => [...previous, value])); });
    $("product-output").textContent = `후보 P의 원소 ${elements.length}개 / |X|=${domain}\n${points.map((point, i) => `x${i}: 목표 (${point.f},${point.g}), 맞는 P 출력 ${choices[i].map(tuple).join(" 또는 ") || "없음"}`).join("\n")}\n전체 매개함수 수 = ${choices.map(list => list.length).join(" × ")} = ${total}\n현재 선택한 m: ${currentOK ? "두 사영 식을 모두 만족" : "일부 사영 식 불만족"}\n${functions.length ? functions.map((fn, i) => `해 ${i + 1}: ${fn.map((value, index) => `m(x${index})=${tuple(value)}`).join(", ")}`).join("\n") : "해 없음"}\n${$("product-candidate").value === "pair" ? "표준 곱은 모든 X,f,g에서 m(x)=(f(x),g(x))가 유일합니다. 이 도식은 선택한 유한 예입니다." : $("product-candidate").value === "extra" ? `무시된 비트 때문에 전체 해가 2^${domain}=${2 ** domain}개입니다. 식을 만족해도 유일성이 없습니다.` : "이 후보는 빠진 쌍을 요구하는 f,g에서 존재에 실패합니다. 현재 원뿔이 통과하더라도 보편적 곱은 아닙니다."}`;
  }
  $("product-coordinate-controls").addEventListener("input", event => {
    const target = event.target, row = Number(target.dataset.row), kind = target.dataset.kind, value = Number(target.value);
    if (!Number.isInteger(row) || row < 0 || row >= Number($("product-domain").value) || !["f", "g", "m"].includes(kind) || !Number.isInteger(value)) return;
    const max = kind === "m" ? candidateElements().length - 1 : 1;
    if (value < 0 || value > max) return;
    coordinates[row][kind] = value; renderProduct();
  });
  ["product-candidate", "product-domain"].forEach(id => $(id).addEventListener("input", buildProductControls));
  buildProductControls();

  let sumStep = 0, sumTimer = null;
  function pauseSum() {
    if (sumTimer !== null) clearInterval(sumTimer);
    sumTimer = null;
    $("sum-play").textContent = "▶ 재생"; $("sum-play").setAttribute("aria-pressed", "false");
  }
  function sumState() {
    const raw = ["f0", "f1", "g0", "g1"].map(id => $("sum-" + id).value.trim());
    if (raw.some(value => !/^-?\d+$/.test(value))) return null;
    const values = raw.map(Number);
    if (values.some(value => !Number.isInteger(value) || value < -99 || value > 99)) return null;
    const side = $("sum-side").value, input = Number($("sum-value").value), row = (side === "left" ? 0 : 2) + input;
    return { side, input, row, values, result: values[row], collision: values[input] !== values[input + 2] };
  }
  const phaseNames = ["출처와 값을 고릅니다.", "출처 태그를 붙여 주입합니다.", "태그를 확인해 처리 함수를 선택합니다.", "선택한 처리 함수 하나를 호출해 결과를 반환합니다."];
  function renderSum(motion = false) {
    const state = sumState();
    $("sum-play").disabled = !state;
    $("sum-prev").disabled = !state || sumStep === 0;
    $("sum-next").disabled = !state || sumStep === 3;
    $("sum-position").textContent = state ? `${sumStep} / 3 단계` : "입력 오류";
    if (!state) {
      pauseSum(); $("sum-diagram").textContent = "f(0),f(1),g(0),g(1)은 −99~99의 정수로 입력하세요. 빈칸·소수는 허용하지 않습니다.";
      $("sum-output").textContent = "입력값이 유효해지면 처음 단계에서 다시 시작합니다."; return;
    }
    const { side, input, row, values, result, collision } = state, tag = side === "left" ? "Left" : "Right";
    let svg = openSvg(`쌍대곱 분기 단계 ${sumStep}/3, ${tag}(${input}), 결과 ${sumStep === 3 ? result : "대기"}`, "sum", 485);
    svg += text(98, 29, "A 또는 B의 값") + text(350, 29, "S = A+B · 출처 태그") + text(635, 29, "m = Cases(f,g)");
    for (let i = 0; i < 4; i++) {
      const y = 88 + i * 76, branch = i < 2 ? "Left" : "Right", payload = i % 2, fn = i < 2 ? "f" : "g", selected = i === row;
      svg += box(25, y - 23, 145, 46, selected ? "selected" : "node") + text(97, y + 6, `${i < 2 ? "A" : "B"}의 ${payload}`);
      svg += arrow(`M176 ${y}H258`, "sum", selected && sumStep >= 1 ? "good-arrow" + (motion ? " travel" : "") : "faint") + text(217, y - 12, i < 2 ? "i" : "j", "small");
      svg += box(264, y - 23, 172, 46, selected && sumStep >= 1 ? "selected" : "node") + text(350, y + 6, `${branch}(${payload})`);
      svg += arrow(`M442 ${y}H538`, "sum", selected && sumStep >= 2 ? "good-arrow" + (motion ? " travel" : "") : "faint");
      svg += box(544, y - 23, 190, 46, selected && sumStep >= 3 ? "done" : selected && sumStep >= 2 ? "selected" : "node") + text(639, y + 6, selected && sumStep >= 3 ? `${fn}(${payload}) = ${values[i]}` : `${fn}(${payload})`, "");
    }
    svg += box(25, 383, 710, 74, collision ? "failure" : "warn") + text(380, 408, `태그 없이 값 ${input}만 남기면?`, "small") + text(380, 435, collision ? `f(${input})=${values[input]}, g(${input})=${values[input + 2]}를 한 출력으로 동시에 재현할 수 없음` : "이 payload의 결과는 우연히 같음 · 임의의 f,g에 대한 보편성은 보장되지 않음", "small");
    $("sum-diagram").innerHTML = svg + "</svg>";
    $("sum-output").textContent = `단계 ${sumStep}: ${phaseNames[sumStep]}\n원래 입력: ${side === "left" ? "A" : "B"}의 ${input}\n${sumStep >= 1 ? `주입 결과: ${tag}(${input})` : "태그 주입 전"}\n${sumStep >= 2 ? `선택한 처리 함수: ${side === "left" ? "f" : "g"}` : "처리 함수 선택 전"}\n${sumStep === 3 ? `최종 결과: ${result}` : "최종 결과: 대기"}\n제거 함수의 전체 대응표: Left(0)↦${values[0]}, Left(1)↦${values[1]}, Right(0)↦${values[2]}, Right(1)↦${values[3]}\n이 네 값은 f,g로 모두 결정되어 매개함수 m은 유일합니다.\n${collision ? "태그를 버리면 이번 payload에서 실제로 모순된 결과 요구가 생깁니다." : "지금 두 결과가 같다는 사실만으로 태그 없는 합집합이 쌍대곱이 되지는 않습니다."}`;
  }
  function resetSum() { pauseSum(); sumStep = 0; renderSum(); }
  ["sum-side", "sum-value", "sum-f0", "sum-f1", "sum-g0", "sum-g1"].forEach(id => $(id).addEventListener("input", resetSum));
  $("sum-reset").addEventListener("click", resetSum);
  $("sum-prev").addEventListener("click", () => { pauseSum(); sumStep = Math.max(0, sumStep - 1); renderSum(); });
  $("sum-next").addEventListener("click", () => { pauseSum(); if (sumState()) sumStep = Math.min(3, sumStep + 1); renderSum(true); });
  $("sum-play").addEventListener("click", () => {
    if (sumTimer !== null) { pauseSum(); return; }
    if (!sumState()) return;
    if (sumStep === 3) { sumStep = 0; renderSum(); }
    $("sum-play").textContent = "⏸ 일시정지"; $("sum-play").setAttribute("aria-pressed", "true");
    sumTimer = setInterval(() => { sumStep++; renderSum(true); if (sumStep >= 3) pauseSum(); }, 1200);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseSum(); });
  window.addEventListener("pagehide", pauseSum);
  renderSum();
})();
