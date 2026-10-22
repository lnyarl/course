// UAI: 코스 전체가 공유하는 교육용 효용 기반 시뮬레이션 엔진
// 각 챕터가 이 파일의 모듈을 하나씩 소개하고, 12장 캡스톤에서 전부 합쳐진다.
//   03장 → curve / normalize      04장 → combine / compensate
//   05장 → select / rng           06장 → Reasoner의 inertia·cooldown
//   07장 → Hamlet의 needs·smart object   08장 → targets(컨텍스트)
//   09장 → World.tick 루프·스케줄링      11장 → trace(디버그 기록)
(function (root) {
  "use strict";
  const UAI = {};

  // ───────────────────────── 0. 공통 ─────────────────────────
  const clamp01 = x => (x > 1 ? 1 : x > 0 ? x : 0); // NaN → 0
  UAI.clamp01 = clamp01;

  // bookend 정규화: [lo, hi] 구간을 [0, 1]로. 범위를 벗어나면 끝값에 고정 (GAP3 13장)
  UAI.normalize = (v, lo, hi) => (hi === lo ? 0 : clamp01((v - lo) / (hi - lo)));

  // ───────────────────────── 1. 반응 커브 (03장) ─────────────────────────
  // 파라미터 관례: m=기울기/세기, k=지수, b=수직 이동, c=수평 이동
  const CURVES = {
    linear: (x, p) => p.m * (x - p.c) + p.b,
    // 다항: 음수 밑에 비정수 지수를 쓰면 NaN이 되므로 부호를 보존해 계산
    poly: (x, p) => {
      const d = x - p.c;
      return p.m * Math.sign(d) ** (Number.isInteger(p.k) ? p.k : 1) * Math.pow(Math.abs(d), p.k) + p.b;
    },
    // 로지스틱: c가 변곡점, m이 가파름, k가 높이
    logistic: (x, p) => p.k / (1 + Math.exp(-p.m * (x - p.c))) + p.b,
    // 로짓: 로지스틱의 역함수 꼴. 가운데가 평평하고 양 끝이 가파르다 (IAUS 구현과 같은 /5 스케일)
    logit: (x, p) => {
      const z = Math.min(Math.max(x - p.c, 1e-4), 1 - 1e-4);
      return p.m * Math.log(z / (1 - z)) / 5 + 0.5 + p.b;
    },
    // 정규(종형): c가 봉우리 위치, k가 폭(작을수록 좁음), m이 높이
    normal: (x, p) => p.m * Math.exp(-((x - p.c) ** 2) / (2 * p.k * p.k)) + p.b,
    // 사인: 주기적 선호 (하루 주기 등)
    sine: (x, p) => p.m * 0.5 * Math.sin(2 * Math.PI * p.k * (x - p.c)) + 0.5 + p.b,
    // 스위치: x ≥ c 이면 1, 아니면 0 (m < 0 이면 반대)
    step: (x, p) => ((p.m >= 0 ? x >= p.c : x < p.c) ? 1 : 0),
    constant: (x, p) => p.b,
  };
  UAI.CURVES = CURVES;
  const DEFAULTS = { m: 1, k: 1, b: 0, c: 0 };

  // 구간 선형 커브: points = [[x0,y0],[x1,y1],...] (x 오름차순)
  function piecewise(points) {
    return x => {
      if (x <= points[0][0]) return points[0][1];
      for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i];
        if (x <= x1) {
          const [x0, y0] = points[i - 1];
          return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
        }
      }
      return points[points.length - 1][1];
    };
  }
  UAI.piecewise = piecewise;

  // spec → (x∈[0,1]) → y∈[0,1]. spec.invert면 입력을 1−x로 뒤집는다
  UAI.curve = function (spec) {
    if (typeof spec === "function") return x => clamp01(spec(x));
    if (typeof spec === "string") spec = UAI.PRESETS[spec];
    const f = spec.type === "piecewise" ? piecewise(spec.points) : null;
    const p = Object.assign({}, DEFAULTS, spec);
    const g = f || (x => CURVES[p.type](x, p));
    return x => clamp01(g(p.invert ? 1 - x : x));
  };

  // 프리셋 팔레트: "소수의 프리셋 + 고급 모드" (GAP3 13장 권고)
  UAI.PRESETS = {
    "선형 증가": { type: "linear", m: 1, b: 0, c: 0 },
    "선형 감소": { type: "linear", m: -1, b: 1, c: 0 },
    "2차 증가 (x²)": { type: "poly", m: 1, k: 2 },
    "2차 감소 (1−x²)": { type: "poly", m: -1, k: 2, b: 1 },
    "제곱근 (√x)": { type: "poly", m: 1, k: 0.5 },
    "3차 지연 (x³)": { type: "poly", m: 1, k: 3 },
    "로지스틱 중앙": { type: "logistic", m: 12, k: 1, c: 0.5 },
    "로지스틱 감소": { type: "logistic", m: -12, k: 1, c: 0.5 },
    "로짓": { type: "logit", m: 1, c: 0 },
    "종형 (적정값)": { type: "normal", m: 1, k: 0.15, c: 0.5 },
    "스위치 (≥0.5)": { type: "step", m: 1, c: 0.5 },
    "회피: 1−(x−1)⁴": { type: "poly", m: -1, k: 4, b: 1, c: 1 },
    "runtime: 1−x⁶": { type: "poly", m: -1, k: 6, b: 1 },
    "cooldown: x⁵": { type: "poly", m: 1, k: 5 },
  };

  // ───────────────────────── 2. 결합 (04장) ─────────────────────────
  // 곱셈 결합은 consideration이 많을수록 점수가 깎이므로 보정한다 (IAUS make-up value)
  //   modification = 1 − 1/n,  makeUp = (1 − s)·modification,  s' = s + makeUp·s
  UAI.compensate = function (s, n) {
    if (n <= 1) return s;
    const mod = 1 - 1 / n;
    return s + (1 - s) * mod * s;
  };
  UAI.combine = function (vals, method) {
    const n = vals.length;
    if (!n) return 0;
    switch (method || "product") {
      case "product": return vals.reduce((a, v) => a * v, 1);
      case "compensated": return vals.reduce((a, v) => a * UAI.compensate(v, n), 1);
      case "mean": return vals.reduce((a, v) => a + v, 0) / n;
      case "min": return Math.min(...vals);
      case "max": return Math.max(...vals);
      case "geomean": return Math.pow(vals.reduce((a, v) => a * v, 1), 1 / n);
    }
    throw new Error("unknown combine: " + method);
  };

  // ───────────────────────── 3. 난수 (05장) ─────────────────────────
  // 시드 고정 RNG(mulberry32): 같은 시드면 같은 시뮬레이션 → 재현 가능한 디버깅 (09장)
  UAI.rng = function (seed) {
    let a = seed >>> 0 || 1;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next, seed,
      range: (lo, hi) => lo + (hi - lo) * next(),
      int: n => Math.floor(next() * n),
      pick: arr => arr[Math.floor(next() * arr.length)],
    };
  };

  // ───────────────────────── 4. 선택 (05장) ─────────────────────────
  // cands: [{score, rank?}, ...]
  // opt.strategy: "best" | "weighted" | "topN" | "topPct" | "dual"
  //   topN: 상위 n개 중 가중 랜덤 / topPct: 최고점의 (1−pct) 이상만 가중 랜덤
  //   dual: 최고 rank만 남기고 → (pct 있으면) 최고 weight 대비 필터 → 가중 랜덤 (GAP2 3장)
  // 반환: { chosen, pool: [{cand, p}] }  — p는 선택 확률(위젯 시각화용)
  UAI.select = function (cands, opt, rng) {
    opt = opt || {};
    const r = rng ? rng.next : Math.random;
    let pool = cands.filter(c => c.score > 0);
    if (!pool.length) return { chosen: null, pool: [] };
    const st = opt.strategy || "best";
    if (st === "dual") {
      const top = Math.max(...pool.map(c => c.rank || 0));
      pool = pool.filter(c => (c.rank || 0) === top);
    }
    const maxS = Math.max(...pool.map(c => c.score));
    if (st === "best") {
      const best = pool.find(c => c.score === maxS);
      return { chosen: best, pool: [{ cand: best, p: 1 }] };
    }
    if (st === "topN") pool = [...pool].sort((a, b) => b.score - a.score).slice(0, opt.n || 3);
    if (st === "topPct" || (st === "dual" && opt.pct)) pool = pool.filter(c => c.score >= maxS * (1 - (opt.pct || 0.1)));
    const sum = pool.reduce((a, c) => a + c.score, 0);
    const probs = pool.map(c => ({ cand: c, p: c.score / sum }));
    let x = r() * sum;
    for (const c of pool) { x -= c.score; if (x <= 0) return { chosen: c, pool: probs }; }
    return { chosen: pool[pool.length - 1], pool: probs };
  };

  // ───────────────────────── 5. Reasoner (04·06·08장) ─────────────────────────
  // action = {
  //   id, label, weight=1, rank=0,
  //   targets?: (ctx) => [target, ...]           // 08장: 행동 × 대상 평가
  //   considerations: [{ name, input: (ctx) => raw, lo=0, hi=1, curve }],
  //   cooldown?: 초, duration?: 초
  // }
  // ctx = { agent, world, target }
  class Reasoner {
    constructor(actions, opt) {
      this.actions = actions.map(a => Object.assign({ weight: 1, rank: 0 }, a, {
        considerations: (a.considerations || []).map(c => Object.assign({ lo: 0, hi: 1 }, c, { fn: UAI.curve(c.curve || "선형 증가") })),
      }));
      this.opt = Object.assign({ combine: "compensated", strategy: "best", inertia: 0, pct: 0.1, n: 3 }, opt);
    }
    // 모든 (행동, 대상) 쌍을 점수화. 점수 0이 되는 순간 나머지 consideration은 생략(early-out)
    evaluate(agent, world) {
      const rows = [];
      const now = world ? world.time : 0;
      for (const a of this.actions) {
        const targets = a.targets ? a.targets({ agent, world }) : [null];
        for (const target of targets) {
          const ctx = { agent, world, target };
          const parts = [];
          let alive = true;
          const cdLeft = a.cooldown && agent.lastUsed && agent.lastUsed[a.id] != null
            ? a.cooldown - (now - agent.lastUsed[a.id]) : 0;
          if (cdLeft > 0) alive = false;
          for (const c of a.considerations) {
            if (!alive) { parts.push({ name: c.name, raw: null, x: null, y: null, skipped: true }); continue; }
            const raw = c.input(ctx);
            const x = UAI.normalize(raw, c.lo, c.hi);
            const y = c.fn(x);
            parts.push({ name: c.name, raw, x, y });
            if (y <= 0) alive = false;
          }
          const ys = parts.filter(p => !p.skipped).map(p => p.y);
          let score = alive ? UAI.combine(ys, this.opt.combine) * a.weight : 0;
          const cur = agent.current;
          const isCurrent = cur && cur.action === a.id && cur.target === target;
          if (isCurrent && score > 0) score += this.opt.inertia;
          rows.push({ action: a, target, parts, score, rank: a.rank, isCurrent, cooldown: Math.max(0, cdLeft) });
        }
      }
      return rows;
    }
    decide(agent, world, rng) {
      const rows = this.evaluate(agent, world);
      const res = UAI.select(rows, this.opt, rng);
      return { rows, chosen: res.chosen, pool: res.pool };
    }
  }
  UAI.Reasoner = Reasoner;

  // ───────────────────────── 6. Hamlet 마을 시뮬레이션 (07·08·09·12장) ─────────────────────────
  // 욕구(needs)는 0(완전 결핍)~100(완전 충족). 시간이 지나면 감소한다.
  UAI.NEEDS = ["hunger", "energy", "fun", "social"];
  UAI.NEED_LABEL = { hunger: "배고픔", energy: "기력", fun: "재미", social: "사교" };
  UAI.NEED_DECAY = { hunger: 0.2, energy: 0.11, fun: 0.16, social: 0.12 }; // 게임 분당 감소량

  // 스마트 오브젝트: 자기가 어떤 욕구를 얼마나 채워 주는지 광고(advertise)한다 (The Sims 방식)
  UAI.OBJECT_TYPES = {
    bakery: { label: "빵집", icon: "🍞", ads: { hunger: 60 }, duration: 20, capacity: 2 },
    farm: { label: "밭", icon: "🌾", ads: { hunger: 25, fun: -5 }, duration: 25, capacity: 3 },
    house: { label: "집", icon: "🏠", ads: { energy: 80 }, duration: 60, capacity: 2 },
    bench: { label: "벤치", icon: "🪑", ads: { energy: 20, social: 10 }, duration: 15, capacity: 2 },
    tavern: { label: "선술집", icon: "🍺", ads: { fun: 45, social: 40, hunger: 10, energy: -10 }, duration: 30, capacity: 4 },
    well: { label: "우물", icon: "⛲", ads: { social: 20, fun: 5 }, duration: 10, capacity: 3 },
    stage: { label: "광장 무대", icon: "🎭", ads: { fun: 60 }, duration: 25, capacity: 5 },
  };

  // 욕구 → 긴급도 커브: 결핍이 클수록 급격히 중요해진다 (07장)
  UAI.NEED_CURVE = {
    hunger: { type: "piecewise", points: [[0, 1], [0.3, 0.85], [0.6, 0.25], [0.85, 0.02], [1, 0]] },
    energy: { type: "poly", m: 1, k: 2.5, invert: true },
    fun: { type: "poly", m: 1, k: 1.5, invert: true },
    social: { type: "poly", m: 1, k: 2, invert: true },
  };

  class World {
    constructor(opt) {
      opt = opt || {};
      this.w = opt.w || 24; this.h = opt.h || 16;
      this.rng = UAI.rng(opt.seed || 7);
      this.time = 0; // 게임 시간(분)
      this.dt = opt.dt || 1; // tick당 분
      this.objects = []; this.agents = []; this.log = [];
      this.thinkEvery = opt.thinkEvery || 5; // 바쁠 때 몇 tick마다 인터럽트 검사를 할지 (09장 time-slicing)
      this.threat = null; // 늑대 {x,y,until}
      this.tickCount = 0;
      this.reasoner = opt.reasoner || new Reasoner(UAI.hamletActions(opt), opt.reasonerOpt || { combine: "compensated", strategy: "dual", pct: 0.15, inertia: 0.1 });
    }
    addObject(type, x, y) {
      const o = Object.assign({ id: type + this.objects.length, type, x, y, users: 0 }, UAI.OBJECT_TYPES[type]);
      this.objects.push(o); return o;
    }
    addAgent(name, x, y, traits) {
      const needs = {};
      for (const n of UAI.NEEDS) needs[n] = 40 + this.rng.int(50);
      const a = { id: "a" + this.agents.length, name, x, y, needs, traits: Object.assign({ hunger: 1, energy: 1, fun: 1, social: 1 }, traits),
        current: null, path: null, busyUntil: 0, lastUsed: {}, trace: [], thinkOffset: this.agents.length };
      this.agents.push(a); return a;
    }
    dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    hour() { return (this.time / 60 + 6) % 24; } // 06:00 시작
    tick() {
      this.time += this.dt; this.tickCount++;
      if (this.threat && this.time >= this.threat.until) this.threat = null;
      for (const a of this.agents) {
        // 1) 욕구 감소
        for (const n of UAI.NEEDS) a.needs[n] = Math.max(0, a.needs[n] - UAI.NEED_DECAY[n] * this.dt * (n === "energy" && this.hour() >= 22 ? 1.8 : 1));
        // 2) 결정 (06장, GAP1 11장): 숙고는 할 일이 끝났을 때만, 반응(인터럽트)은 주기적으로 검사
        const due = (this.tickCount + a.thinkOffset) % this.thinkEvery === 0;
        if (!a.current) this.think(a);
        else if (due) this.think(a, true);
        // 3) 실행
        this.act(a);
      }
    }
    // interruptOnly=true: 실행 중인 행동보다 rank가 높은 후보가 생겼을 때만 갈아탄다
    think(a, interruptOnly) {
      const res = this.reasoner.decide(a, this, this.rng);
      a.lastEval = res;
      const c = res.chosen;
      if (!c) return;
      if (a.current && a.current.action === c.action.id && a.current.target === c.target) return;
      if (interruptOnly) {
        const curAct = this.reasoner.actions.find(x => x.id === a.current.action);
        if (c.rank <= curAct.rank) return;
      }
      if (a.current && a.current.using) this.release(a);
      a.current = { action: c.action.id, target: c.target, label: c.action.label, started: this.time, using: false };
      a.trace.push({ t: this.time, action: c.action.id, target: c.target && (c.target.id || c.target.name), score: c.score });
      if (a.trace.length > 60) a.trace.shift();
      this.log.push(`[${UAI.clock(this.time)}] ${a.name} → ${c.action.label}${c.target ? " @" + (c.target.label || c.target.name) : ""} (${c.score.toFixed(2)})`);
      if (this.log.length > 200) this.log.shift();
    }
    release(a) { if (a.current && a.current.using && a.current.target) a.current.target.users--; a.current.using = false; }
    step(a, tx, ty) { a.x += Math.sign(tx - a.x) || 0; if (a.x === tx) a.y += Math.sign(ty - a.y) || 0; }
    act(a) {
      const cur = a.current; if (!cur) return;
      const act = this.reasoner.actions.find(x => x.id === cur.action);
      if (act.run) act.run(this, a, cur);
    }
  }
  UAI.World = World;
  UAI.clock = t => { const m = Math.floor(t + 360) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

  // Hamlet 기본 행동 세트. 욕구 행동은 rank 0, 위협 회피는 rank 10 (dual utility)
  UAI.hamletActions = function () {
    const useObject = {
      id: "use", label: "이용하기", rank: 0,
      targets: ({ world }) => world.objects.filter(o => o.users < o.capacity || false),
      considerations: [
        // 광고된 욕구 충족량 × 그 욕구의 긴급도 합 → 0~1 (07장)
        { name: "광고 가치", input: ({ agent, target }) => UAI.adValue(agent, target), lo: 0, hi: 1, curve: "선형 증가" },
        // 거리: 가까울수록 좋다. 너무 멀면 0 근처 (08장)
        { name: "거리", input: ({ agent, target }) => Math.abs(agent.x - target.x) + Math.abs(agent.y - target.y), lo: 0, hi: 30, curve: { type: "poly", m: -1, k: 2, b: 1 } },
        // 이미 사용 중이면 붐빔 감점
        { name: "혼잡", input: ({ target }) => target.users / target.capacity, lo: 0, hi: 1, curve: { type: "linear", m: -0.7, b: 1 } },
      ],
      duration: null,
      run(world, a, cur) {
        const o = cur.target;
        if (a.x !== o.x || a.y !== o.y) return world.step(a, o.x, o.y);
        if (!cur.using) { if (o.users >= o.capacity) { a.current = null; return; } o.users++; cur.using = true; cur.until = world.time + o.duration; }
        for (const n in o.ads) a.needs[n] = Math.min(100, Math.max(0, a.needs[n] + (o.ads[n] / o.duration) * world.dt));
        if (world.time >= cur.until) { world.release(a); a.lastUsed["use:" + o.id] = world.time; a.current = null; }
      },
    };
    const chat = {
      id: "chat", label: "수다 떨기", rank: 0,
      targets: ({ agent, world }) => world.agents.filter(b => b !== agent),
      considerations: [
        { name: "사교 결핍", input: ({ agent }) => 100 - agent.needs.social, lo: 0, hi: 100, curve: { type: "poly", m: 1, k: 2 } },
        { name: "상대와 거리", input: ({ agent, target }) => Math.abs(agent.x - target.x) + Math.abs(agent.y - target.y), lo: 0, hi: 12, curve: "선형 감소" },
        { name: "상대 한가함", input: ({ target }) => (target.current && target.current.action === "flee" ? 0 : 1), curve: "스위치 (≥0.5)" },
      ],
      run(world, a, cur) {
        const b = cur.target;
        if (world.dist(a, b) > 1) return world.step(a, b.x, b.y);
        a.needs.social = Math.min(100, a.needs.social + 3 * world.dt);
        a.needs.fun = Math.min(100, a.needs.fun + 0.8 * world.dt);
        if (world.time - cur.started > 15) a.current = null;
      },
    };
    const wander = {
      id: "wander", label: "산책", rank: 0, weight: 0.12,
      considerations: [{ name: "기본값", input: () => 1, curve: "선형 증가" }],
      run(world, a, cur) {
        if (!cur.dest) cur.dest = { x: world.rng.int(world.w), y: world.rng.int(world.h) };
        world.step(a, cur.dest.x, cur.dest.y);
        if (a.x === cur.dest.x && a.y === cur.dest.y) a.current = null;
      },
    };
    const flee = {
      id: "flee", label: "도망치기", rank: 10,
      considerations: [
        { name: "위협 존재", input: ({ world }) => (world.threat ? 1 : 0), curve: "스위치 (≥0.5)" },
        { name: "위협 거리", input: ({ agent, world }) => (world.threat ? Math.abs(agent.x - world.threat.x) + Math.abs(agent.y - world.threat.y) : 99), lo: 0, hi: 14, curve: "선형 감소" },
      ],
      run(world, a) {
        const t = world.threat; if (!t || world.dist(a, t) >= 14) { a.current = null; return; }
        if (a.current.using) world.release(a);
        const nx = Math.max(0, Math.min(world.w - 1, a.x + Math.sign(a.x - t.x || 1)));
        const ny = Math.max(0, Math.min(world.h - 1, a.y + Math.sign(a.y - t.y || 1)));
        a.x = nx; a.y = ny;
      },
    };
    return [useObject, chat, wander, flee];
  };

  // 오브젝트 광고 가치: Σ (충족량/100 × 그 욕구의 긴급도 × 성격 가중치), 0~1로 제한
  UAI.adValue = function (agent, obj) {
    let v = 0;
    for (const n in obj.ads) {
      const urgency = UAI.curve(UAI.NEED_CURVE[n])(agent.needs[n] / 100);
      const room = Math.min(obj.ads[n], 100 - agent.needs[n]); // 한계효용: 이미 찬 만큼은 의미 없음
      v += (Math.max(room, Math.min(0, obj.ads[n])) / 100) * urgency * (agent.traits[n] || 1);
    }
    return clamp01(v);
  };

  // 기본 마을 생성
  UAI.makeHamlet = function (opt) {
    const w = new World(opt);
    [["bakery", 4, 3], ["farm", 2, 12], ["house", 20, 2], ["house", 21, 13], ["bench", 11, 8], ["tavern", 15, 9], ["well", 9, 4], ["stage", 13, 13]]
      .forEach(([t, x, y]) => w.addObject(t, x, y));
    const names = (opt && opt.names) || ["아리", "보람", "찬", "두리", "은솔", "파랑"];
    names.forEach((n, i) => w.addAgent(n, 3 + ((i * 5) % 18), 2 + ((i * 3) % 12)));
    return w;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = UAI;
  else root.UAI = UAI;
})(this);
