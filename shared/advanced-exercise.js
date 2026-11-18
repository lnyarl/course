/* Small deterministic calculations for the advanced network lessons. */
(() => {
  const calculations = {
    "overlay-mtu": ({outer, header}) => {
      const overlay = header + 8 + 8 + 14;
      return `오버헤드 ${overlay}바이트 · 내부 IP 패킷 최대 ${outer - overlay}바이트`;
    },
    "stream-credit": ({connection, a, b}) => {
      const sentA = Math.min(4, a, connection);
      const sentB = Math.min(6, b, connection - sentA);
      return `A부터 전송 · A ${sentA}/4바이트 · B ${sentB}/6바이트 · 연결 여유 ${connection - sentA - sentB}바이트`;
    },
    "deadline-budget": ({budget, queue, duration, front, service}) => {
      const remaining = Math.max(0, budget - queue);
      const bound = front * service;
      const sequential = Math.min(bound, Math.floor(remaining / duration));
      return `잔여 ${remaining}ms · 요청 수만 본 상한 ${bound}회 · 남은 시간에 순차 호출 최대 ${sequential}회`;
    }
  };
  for (const form of document.querySelectorAll("[data-exercise]")) {
    const calculate = calculations[form.dataset.exercise];
    if (!calculate) continue;
    const fields = [...form.querySelectorAll("input")];
    const out = form.querySelector("output");
    const update = () => {
      if (!fields.every(field => field.validity.valid)) {
        out.value = "모든 값을 표시된 범위로 입력하세요.";
        return;
      }
      out.value = calculate(Object.fromEntries(fields.map(field => [field.name, field.valueAsNumber])));
    };
    form.addEventListener("input", update);
    form.addEventListener("submit", event => event.preventDefault());
    update();
    form.hidden = false;
  }
})();
