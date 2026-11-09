(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const text = (x, y, value, cls = "", anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(value)}</text>`;
  const box = (x, y, w, h, cls = "node") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="${cls}"/>`;
  const show = value => typeof value === "string" ? JSON.stringify(value) : String(value);
  const short = value => { const label = show(value); return label.length > 22 ? label.slice(0, 19) + "…" : label; };
  function openSvg(label, kind, height) {
    return `<svg class="c04-live" viewBox="0 0 760 ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><defs><marker id="c04-${kind}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:context-stroke"/></marker></defs>`;
  }
  const arrow = (path, kind, cls = "") => `<path d="${path}" class="arrow ${cls}" marker-end="url(#c04-${kind}-arrow)"/>`;

  let step = 0, timer = null;
  function pauseWriter() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    $("writer-play").textContent = "▶ 재생";
    $("writer-play").setAttribute("aria-pressed", "false");
  }
  function writerState() {
    const x = Number($("writer-x").value), values = [x + 1, 2 * (x + 1), (2 * (x + 1)) ** 2];
    const logs = ["f", "g", "h"].map(name => $("writer-log-" + name).value);
    const visible = [step >= 1, step >= 2, step >= 4];
    const merged = step >= 5 ? 3 : step >= 3 ? 2 : step >= 1 ? 1 : 0;
    const aggregate = logs.slice(0, merged).join("");
    const value = step >= 4 ? values[2] : step >= 2 ? values[1] : step >= 1 ? values[0] : x;
    const pending = step === 2 ? logs[1] : step === 4 ? logs[2] : null;
    return { x, values, logs, visible, merged, aggregate, value, pending };
  }
  const phases = [
    "입력만 준비합니다. 로그는 빈 문자열입니다.",
    "f를 실행해 값과 f의 로그를 받습니다.",
    "f.Value를 g에 넘깁니다. g의 로그는 아직 따로 보존합니다.",
    "f의 로그 다음 g의 로그를 병합합니다.",
    "g.Value를 h에 넘깁니다. h의 로그는 아직 따로 보존합니다.",
    "누적 로그 뒤에 h의 로그를 붙여 최종 Writer를 만듭니다."
  ];
  function renderWriter(motion = false) {
    const state = writerState(), { x, values, logs, visible, merged, aggregate, value, pending } = state;
    let svg = openSvg(`Writer 합성 단계 ${step}/5, 값 ${value}, 누적 로그 ${show(aggregate)}`, "writer", 440);
    svg += text(25, 28, "값 경로 · f(x)=x+1 → g(x)=2x → h(x)=x²", "small", "start");
    svg += box(18, 75, 92, 42, "selected") + text(64, 102, `x = ${x}`);
    const fnNames = ["f · +1", "g · ×2", "h · 제곱"];
    fnNames.forEach((name, i) => {
      const bx = 160 + i * 200, px = bx - 15, active = visible[i];
      svg += box(bx, 75, 140, 42, active ? "done" : "node") + text(bx + 70, 102, name);
      svg += arrow(`M${bx + 70} 122V137`, "writer", active ? "active-arrow" + (motion ? " travel" : "") : "faint");
      svg += box(px, 143, 170, 100, active ? "selected" : "node");
      svg += text(bx + 70, 169, `Value: ${active ? values[i] : "대기"}`);
      svg += `<path d="M${px + 8} 184H${px + 162}" class="arrow faint"/>`;
      svg += text(bx + 70, 213, `Log: ${active ? short(logs[i]) : "대기"}`, "small");
      svg += arrow(`M${bx + 70} 249V289L380 324`, "writer", i < merged ? "log-arrow" + (motion ? " travel" : "") : "faint");
    });
    svg += arrow("M115 96H154", "writer", step >= 1 ? "active-arrow" : "faint");
    svg += arrow("M320 165H336V96H354", "writer", step >= 2 ? "active-arrow" + (motion ? " travel" : "") : "faint");
    svg += arrow("M520 165H536V96H554", "writer", step >= 4 ? "active-arrow" + (motion ? " travel" : "") : "faint");
    svg += text(30, 292, "로그 경로", "small", "start");
    svg += box(120, 330, 520, 68, "log") + text(380, 354, "누적 로그 · 먼저 실행한 조각부터", "small") + text(380, 382, short(aggregate));
    svg += text(380, 426, pending !== null ? `이번 반환 로그 ${short(pending)}는 보존 중이며 다음 병합 단계에서 이어 붙입니다.` : step === 5 ? `최종 Writer = (${value}, ${short(aggregate)})` : phases[step], "small");
    $("writer-diagram").innerHTML = svg + "</svg>";
    $("writer-position").textContent = `${step} / 5 단계`;
    $("writer-prev").disabled = step === 0;
    $("writer-next").disabled = step === 5;
    $("writer-output").textContent = `단계 ${step}: ${phases[step]}\n현재 값 = ${value}\n누적 로그 = ${show(aggregate)}${pending !== null ? `\n병합 대기 로그 = ${show(pending)}` : ""}\n${step === 5 ? `결과: Writer(Value=${value}, Log=${show(aggregate)})` : "로그가 아직 병합되지 않아도 조각을 버리지는 않습니다."}`;
  }
  function resetWriter() { pauseWriter(); step = 0; renderWriter(); }
  ["writer-x", "writer-log-f", "writer-log-g", "writer-log-h"].forEach(id => $(id).addEventListener("input", resetWriter));
  $("writer-reset").addEventListener("click", resetWriter);
  $("writer-prev").addEventListener("click", () => { pauseWriter(); step = Math.max(0, step - 1); renderWriter(); });
  $("writer-next").addEventListener("click", () => { pauseWriter(); step = Math.min(5, step + 1); renderWriter(true); });
  $("writer-play").addEventListener("click", () => {
    if (timer !== null) { pauseWriter(); return; }
    if (step === 5) { step = 0; renderWriter(); }
    $("writer-play").textContent = "⏸ 일시정지"; $("writer-play").setAttribute("aria-pressed", "true");
    timer = setInterval(() => { step++; renderWriter(true); if (step >= 5) pauseWriter(); }, 1200);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseWriter(); });
  window.addEventListener("pagehide", pauseWriter);
  renderWriter();

  const logPolicies = {
    concat: { combine: (a, b) => a + b, associative: true, unit: true, label: "정상 순서 · 모노이드" },
    reverse: { combine: (a, b) => b + a, associative: true, unit: true, label: "역순 · 여전히 모노이드" },
    overwrite: { combine: (a, b) => b, associative: true, unit: false, label: "결합적이지만 양쪽 항등원 없음" },
    parentheses: { combine: (a, b) => `(${a}|${b})`, associative: false, unit: false, label: "결합·항등법칙 불충족" }
  };
  function renderLogLaw(motion = false) {
    const key = $("law-policy").value, policy = logPolicies[key], op = policy.combine;
    const [f, g, h] = ["f", "g", "h"].map(id => $("law-" + id).value);
    const fg = op(f, g), gh = op(g, h), left = op(fg, h), right = op(f, gh), equal = left === right;
    const before = op("", f), after = op(f, ""), goodUnit = before === f && after === f;
    let svg = openSvg(`로그 결합 정책 ${policy.label}: 두 괄호 결과 ${equal ? "같음" : "다름"}`, "law", 445);
    svg += text(193, 28, "h ∘K (g ∘K f)") + text(567, 28, "(h ∘K g) ∘K f");
    const leaves = [[f, 67], [g, 183], [h, 299], [f, 441], [g, 557], [h, 673]];
    leaves.forEach(([value, x], i) => { svg += box(x - 51, 55, 102, 45, "log") + text(x, 82, short(value), "small") + text(x, 119, ["s_f", "s_g", "s_h"][i % 3], "small muted"); });
    svg += arrow("M67 105L125 148", "law", motion ? "travel" : "") + arrow("M183 105L125 148", "law", motion ? "travel" : "");
    svg += box(35, 155, 180, 45, "node") + text(125, 183, short(fg), "small");
    svg += arrow("M125 205L193 244", "law", motion ? "travel" : "") + arrow("M299 105L230 244", "law", motion ? "travel" : "");
    svg += box(35, 252, 315, 53, equal ? "done" : "failure") + text(193, 284, short(left));
    svg += arrow("M557 105L615 148", "law", motion ? "travel" : "") + arrow("M673 105L615 148", "law", motion ? "travel" : "");
    svg += box(525, 155, 180, 45, "node") + text(615, 183, short(gh), "small");
    svg += arrow("M615 205L567 244", "law", motion ? "travel" : "") + arrow("M441 105L530 244", "law", motion ? "travel" : "");
    svg += box(410, 252, 315, 53, equal ? "done" : "failure") + text(567, 284, short(right));
    svg += text(380, 333, equal ? "이 세 조각의 로그 결과 같음 ✓" : "결합법칙 반례 · 결과 다름 ✗");
    svg += box(35, 352, 690, 49, goodUnit ? "done" : "failure") + text(380, 382, `ε ⋆ s_f = ${short(before)} / s_f ⋆ ε = ${short(after)} / 양쪽 ${goodUnit ? "표본 통과" : "표본 실패"}`, "small");
    svg += text(380, 429, policy.unit ? `Writer 범주 가능: ${policy.label}` : `범주 후보 실패: ${policy.label}`, "small");
    $("law-diagram").innerHTML = svg + "</svg>";
    $("law-output").textContent = `(s_f ⋆ s_g) ⋆ s_h = ${show(left)}\ns_f ⋆ (s_g ⋆ s_h) = ${show(right)}\n이 표본 결합 결과: ${equal ? "같음" : "다름 · 반례"}\n빈 로그를 앞에: ${show(before)} / 뒤에: ${show(after)}\n이 s_f의 양쪽 항등법칙: ${goodUnit ? "통과" : "실패"}\n일반 정책: ${policy.label}\n${key === "reverse" ? "역순 연결은 결합적이고 빈 로그가 항등원입니다. 실행순서와 반대인 로그 의미를 선택한 것입니다." : !policy.unit ? "이 로그 연산과 빈 로그로는 Writer 범주 법칙을 모두 만족하지 못합니다. 일부 표본이 우연히 같아도 일반 법칙이 되지는 않습니다." : "문자열 연결과 빈 문자열이 모노이드 법칙을 만족하므로 Writer 합성의 근거가 됩니다."}`;
  }
  ["law-policy", "law-f", "law-g", "law-h"].forEach(id => $(id).addEventListener("input", () => renderLogLaw()));
  renderLogLaw();

  const typed = {
    length: { name: "Length", from: "String", to: "Int", run: value => ({ value: value.length, log: "length>" }) },
    add: { name: "AddOne", from: "Int", to: "Int", run: value => ({ value: value + 1, log: "add>" }) },
    even: { name: "IsEven", from: "Int", to: "Bool", run: value => ({ value: value % 2 === 0, log: "even>" }) },
    not: { name: "Not", from: "Bool", to: "Bool", run: value => ({ value: !value, log: "not>" }) }
  };
  function parseInput(type, raw) {
    if (type === "String") return { value: raw };
    if (type === "Bool") return /^(true|false)$/i.test(raw.trim()) ? { value: raw.trim().toLowerCase() === "true" } : { error: "Bool은 true 또는 false를 입력하세요." };
    const n = Number(raw.trim());
    return /^-?\d+$/.test(raw.trim()) && Number.isInteger(n) && n >= -100 && n <= 100 ? { value: n } : { error: "Int는 −100~100의 정수를 입력하세요. 빈칸·소수는 허용하지 않습니다." };
  }
  const defaultValue = type => type === "String" ? "" : type === "Int" ? 0 : false;
  const sameWriter = (a, b) => a.value === b.value && a.log === b.log;
  function composeWriter(g, f, x) { const first = f(x), second = g(first.value); return { value: second.value, log: first.log + second.log }; }
  function renderIdentity(motion = false) {
    const f = typed[$("identity-f").value], g = typed[$("identity-g").value], parsed = parseInput(f.from, $("identity-input").value), compatible = f.to === g.from;
    if (parsed.error) { $("identity-diagram").textContent = parsed.error; $("identity-output").textContent = parsed.error; return; }
    const input = parsed.value, idLog = $("identity-log").value, keep = $("identity-value").value === "keep";
    const idA = value => ({ value: keep ? value : defaultValue(f.from), log: idLog }), idB = value => ({ value: keep ? value : defaultValue(f.to), log: idLog });
    const original = f.run(input), before = composeWriter(f.run, idA, input), after = composeWriter(idB, f.run, input);
    const beforeOK = sameWriter(before, original), afterOK = sameWriter(after, original), composed = compatible ? composeWriter(g.run, f.run, input) : null;
    let svg = openSvg(`Writer 타입 연결 ${compatible ? "가능" : "불가"}, 항등 후보 앞 ${beforeOK}, 뒤 ${afterOK}`, "identity", 505);
    svg += text(30, 28, "일반 합성으로는 Writer 반환값을 다음 인수로 바로 전달할 수 없음", "small", "start");
    svg += box(30, 48, 115, 52, "node") + text(87, 80, f.from);
    svg += arrow("M151 74H218", "identity") + text(184, 59, "f", "small");
    svg += box(225, 48, 205, 52, "log") + text(327, 80, `Writer<${f.to}>`);
    svg += `<path d="M437 74H535" class="bad-arrow"/>` + text(553, 81, "×");
    svg += box(580, 48, 150, 52, "node") + text(655, 80, `g 입력 ${g.from}`);
    svg += text(30, 140, "새 합성: Value만 전달하고 로그 조각을 누적", "small", "start");
    svg += box(30, 161, 230, 69, "selected") + text(145, 186, `f.Value = ${short(original.value)}`, "small") + text(145, 212, `f.Log = ${short(original.log)}`, "small");
    svg += arrow("M266 184H420", "identity", compatible ? "active-arrow" + (motion ? " travel" : "") : "bad-arrow") + text(343, 167, `${f.to} ${compatible ? "=" : "≠"} ${g.from}`, "small");
    svg += box(427, 161, 303, 69, compatible ? "done" : "failure") + text(578, 187, compatible ? `결과 ${short(composed.value)}` : "클레이슬리 합성 불가", "small") + text(578, 212, compatible ? `로그 ${short(composed.log)}` : "객체 접점 타입이 다릅니다.", "small");
    svg += text(30, 274, "항등 후보를 f 앞·뒤에 붙여 반환 쌍 비교", "small", "start");
    svg += box(30, 294, 335, 70, beforeOK ? "done" : "failure") + text(197, 319, "f ∘K id_A", "small") + text(197, 347, `${short(before.value)}, ${short(before.log)}`, "small");
    svg += box(395, 294, 335, 70, afterOK ? "done" : "failure") + text(562, 319, "id_B ∘K f", "small") + text(562, 347, `${short(after.value)}, ${short(after.log)}`, "small");
    svg += box(140, 391, 480, 50, "node") + text(380, 422, `원래 f(x): ${short(original.value)}, ${short(original.log)}`, "small");
    svg += text(380, 477, `이 입력의 반환 쌍 비교: 앞 ${beforeOK ? "같음 ✓" : "다름 ✗"} / 뒤 ${afterOK ? "같음 ✓" : "다름 ✗"}`, "small");
    $("identity-diagram").innerHTML = svg + "</svg>";
    const format = result => `(${show(result.value)}, ${show(result.log)})`;
    $("identity-output").textContent = `f : ${f.from} → Writer<${f.to}>\ng : ${g.from} → Writer<${g.to}>\n클레이슬리 객체 접점: ${f.to} ${compatible ? "=" : "≠"} ${g.from}\n${compatible ? `합성 결과: ${format(composed)}` : "타입 불일치로 합성하지 않습니다."}\n\n원래 f(x) = ${format(original)}\nf ∘K id_A = ${format(before)} → ${beforeOK ? "표본 같음" : "표본 다름"}\nid_B ∘K f = ${format(after)} → ${afterOK ? "표본 같음" : "표본 다름"}\n${keep && idLog === "" ? "입력을 유지하고 빈 로그를 반환하는 올바른 항등사상 정의입니다." : "이 후보는 일반적인 항등사상이 아닙니다. 특정 입력에서 우연히 같아도 전체 정의역의 법칙이 되지 않습니다."}`;
  }
  ["identity-f", "identity-g", "identity-input", "identity-value", "identity-log"].forEach(id => $(id).addEventListener("input", () => renderIdentity()));
  renderIdentity();
})();
