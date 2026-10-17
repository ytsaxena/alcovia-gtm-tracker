/* ============================================================
   Alcovia · GTM Tracker  —  dummy data + render engine
   Tabbed single-page. Timeline selector re-renders every section.
   ============================================================ */

/* ---------- utils ---------- */
const IN = new Intl.NumberFormat("en-IN");
const n0 = (n) => IN.format(Math.round(n));
const inr0 = (n) => "₹" + IN.format(Math.round(n));
function compactINR(n) {
  const a = Math.abs(n);
  if (a >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  if (a >= 1e3) return "₹" + (n / 1e3).toFixed(1) + "K";
  return "₹" + Math.round(n);
}
function compactNum(n) {
  const a = Math.abs(n);
  if (a >= 1e7) return (n / 1e7).toFixed(2) + "Cr";
  if (a >= 1e5) return (n / 1e5).toFixed(2) + "L";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return "" + Math.round(n);
}
const pct = (x, d = 1) => x.toFixed(d) + "%";

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- timeline config ---------- */
const PERIODS = {
  "7d":  { label: "Last 7 days",  days: 7,   revTarget: 480000,  studentsTarget: 12,  adFactor: 0.25, freqFactor: 0.8, points: 7,  granularity: "day" },
  "30d": { label: "Last 30 days", days: 30,  revTarget: 1900000, studentsTarget: 52,  adFactor: 1.0,  freqFactor: 1.0, points: 10, granularity: "3day" },
  "qtd": { label: "This quarter", days: 91,  revTarget: 5600000, studentsTarget: 158, adFactor: 3.1,  freqFactor: 1.6, points: 13, granularity: "week" },
  "ytd": { label: "This year",    days: 300, revTarget: 18500000,studentsTarget: 520, adFactor: 11.0, freqFactor: 2.6, points: 12, granularity: "month" },
};
const PAGE_TITLES = {
  overview: "Snapshots",
  revenue: "Revenue",
  funnel: "Funnel Journey",
  campaigns: "Campaign Performance",
  rca: "RCA & Actions",
};

function makeLabels(p) {
  if (p.granularity === "day") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (p.granularity === "3day") return Array.from({ length: 10 }, (_, i) => "D" + (i * 3 + 1));
  if (p.granularity === "week") return Array.from({ length: 13 }, (_, i) => "W" + (i + 1));
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

/* ---------- base campaign library (baseline = 30 days) ---------- */
const BASE_CAMPAIGNS = [
  { name: "Workshop – Sept Reel A",        type: "workshop", impr: 96000,  ctr: 3.1, cvr: 13, spend: 68000,  freq: 1.7, lpDrop: 29, lpLoad: 1.8, verdict: "scale",   reason: "Top-of-funnel CTR with low frequency and strong click-to-sign-up intent. Room to pour budget." },
  { name: "Workshop – Static B",           type: "workshop", impr: 74000,  ctr: 1.1, cvr: 7,  spend: 52000,  freq: 3.4, lpDrop: 52, lpLoad: 2.6, verdict: "refresh", reason: "Frequency above 3 signals fatigue. Refresh creative and tighten the landing page (52% drop-off)." },
  { name: "Program – Carousel (Founder)",  type: "program",  impr: 112000, ctr: 2.6, cvr: 9,  spend: 96000,  freq: 2.0, lpDrop: 34, lpLoad: 2.1, verdict: "scale",   reason: "Consistent CTR and healthy frequency. Best scalable program asset for parents." },
  { name: "Program – Static (Testimonial)",type: "program",  impr: 88000,  ctr: 1.6, cvr: 6,  spend: 74000,  freq: 3.2, lpDrop: 47, lpLoad: 2.4, verdict: "refresh", reason: "Fatigued creative and mid conversion. Re-cut as short-form before scaling again." },
  { name: "Workshop – Video C",            type: "workshop", impr: 61000,  ctr: 0.8, cvr: 4,  spend: 46000,  freq: 3.7, lpDrop: 61, lpLoad: 3.2, verdict: "drop",    reason: "Lowest CTR plus the worst landing page (61% drop-off, 3.2s load). Poor spend efficiency." },
  { name: "Program – Reel (Parent POV)",   type: "program",  impr: 128000, ctr: 3.4, cvr: 8,  spend: 104000, freq: 2.5, lpDrop: 31, lpLoad: 1.9, verdict: "scale",   reason: "Best program CTR in the set. Strong proof-of-outcome hook — scale carefully." },
  { name: "Workshop – Lead Ad (Reg Form)", type: "workshop", impr: 69000,  ctr: 2.0, cvr: 11, spend: 50000,  freq: 3.1, lpDrop: 40, lpLoad: 2.2, verdict: "refresh", reason: "Good conversion but frequency above 3. New creative angle and a faster landing page needed." },
  { name: "Program – Static (Offer)",      type: "program",  impr: 58000,  ctr: 0.9, cvr: 3,  spend: 43000,  freq: 3.9, lpDrop: 58, lpLoad: 2.9, verdict: "drop",    reason: "Offer-led creative underperforming on both CTR and conversion. Retire and reallocate." },
];

/* ---------- dataset generator ---------- */
function generate(key) {
  const p = PERIODS[key];
  const r = mulberry32(hashStr(key));
  const rnd = (a, b) => a + r() * (b - a);

  const target = p.revTarget;
  const achieved = Math.round(target * rnd(0.82, 0.95));
  const workshopRev = Math.round(achieved * rnd(0.16, 0.26));
  const programRev = achieved - workshopRev;
  const trialRev = Math.round(programRev * rnd(0.33, 0.44));
  const fullRev = programRev - trialRev;
  const seats = Math.round(workshopRev / 3999);
  const workshopsHeld = Math.max(1, Math.round(seats / rnd(24, 34)));

  const onboardTarget = p.studentsTarget;
  const onboarded = Math.round(onboardTarget * rnd(0.82, 1.0));
  const trialStudents = Math.round(onboarded * rnd(0.4, 0.52));
  const fullStudents = onboarded - trialStudents;

  const labels = makeLabels(p);
  const n = labels.length;
  const weights = Array.from({ length: n }, () => rnd(0.72, 1.32));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const series = labels.map((lab, i) => {
    const total = (achieved * weights[i]) / wsum;
    const prog = Math.round(total * (programRev / achieved));
    return { label: lab, program: prog, workshop: Math.round(total) - prog };
  });
  const targetSeries = labels.map(() => Math.round(target / n));

  const onbWeights = Array.from({ length: n }, () => rnd(0.6, 1.4));
  const onbSum = onbWeights.reduce((a, b) => a + b, 0);
  const onboardSeries = labels.map((lab, i) => Math.round((onboarded * onbWeights[i]) / onbSum));

  const leadsBase = { "7d": 240, "30d": 940, "qtd": 2750, "ytd": 10200 }[key];
  const leads = Math.round(leadsBase * rnd(0.9, 1.12));
  const impressions = Math.round(leads * rnd(48, 66));
  const organic = Math.round(leads * rnd(0.24, 0.34));
  const qualified = Math.round(leads * rnd(0.4, 0.49));
  const callsSet = Math.round(qualified * rnd(0.6, 0.72));
  const callsAttended = Math.round(callsSet * rnd(0.68, 0.8));
  const interviews = Math.round(callsAttended * rnd(0.74, 0.86));
  const architect = Math.round(interviews * rnd(0.58, 0.7));
  const signups = Math.round(architect * rnd(0.45, 0.6));
  const adSpend = Math.round(leads * rnd(120, 175));
  const costPerQualified = adSpend / qualified;
  const avgJourneyDays = Math.round(rnd(8, 17) * 10) / 10;
  const funnel = {
    impressions, leads, organic, qualified, callsSet, callsAttended, interviews, architect, signups,
    adSpend, costPerQualified, avgJourneyDays,
    showUpRate: (callsAttended / callsSet) * 100,
    interviewDrop: (1 - interviews / callsAttended) * 100,
    leadToPaid: (signups / leads) * 100,
    qualToPaid: (signups / qualified) * 100,
  };

  const f = p.adFactor, ff = p.freqFactor;
  const campaigns = BASE_CAMPAIGNS.map((c) => {
    const impr = Math.round(c.impr * f);
    const clicks = Math.round((impr * c.ctr) / 100);
    const conv = Math.max(1, Math.round((clicks * c.cvr) / 100));
    const spend = Math.round(c.spend * f);
    return {
      name: c.name, type: c.type, spend, impr, clicks, conv, ctr: c.ctr,
      freq: Math.round(c.freq * ff * 10) / 10, lpDrop: c.lpDrop, lpLoad: c.lpLoad,
      cpa: spend / conv, verdict: c.verdict, reason: c.reason,
    };
  });

  const clients = ["Kapoor Family", "R. Mehta", "S. Iyer", "D. Nair", "A. Bhatia", "K. Reddy", "M. Singh", "T. Verma"];
  const invoices = Array.from({ length: 6 }, (_, i) => {
    const amount = Math.round(rnd(48000, 360000) / 1000) * 1000;
    const age = Math.round(rnd(4, 62));
    const status = age > 30 ? "Overdue" : age > 14 ? "Due soon" : "Pending";
    return { client: clients[i % clients.length], inv: "ALC-" + (2400 + Math.round(rnd(1, 220))), amount, age, status };
  }).sort((a, b) => b.age - a.age);
  const unpaidTotal = invoices.reduce((s, x) => s + x.amount, 0);

  const teens = ["Aarav", "Zoya", "Ishaan", "Myra", "Kabir", "Ananya", "Vihaan", "Diya"];
  const renewals = Array.from({ length: 6 }, (_, i) => {
    const daysLeft = Math.round(rnd(-6, 34));
    const risk = daysLeft < 0 ? "Churned" : daysLeft <= 7 ? "High" : daysLeft <= 18 ? "Medium" : "Low";
    return { teen: teens[i % teens.length], plan: "3-month trial", daysLeft, risk };
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    key, p, target, achieved, workshopRev, programRev, trialRev, fullRev,
    seats, workshopsHeld, onboarded, onboardTarget, trialStudents, fullStudents,
    labels, series, targetSeries, onboardSeries,
    funnel, campaigns, invoices, unpaidTotal, renewals,
  };
}

/* ---------- chart builders (SVG) ---------- */
function stackedBarChart({ labels, series, target, valueFmt = compactNum, height = 260 }) {
  const W = 780, H = height, P = { t: 18, r: 16, b: 34, l: 58 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + ser.values[i], 0));
  const max = Math.max(...totals, ...(target || [0])) * 1.15 || 1;
  const n = labels.length, step = iw / n, bw = Math.min(40, step * 0.56);
  const y = (v) => P.t + ih - (ih * v) / max;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  for (let k = 0; k <= 4; k++) {
    const gy = P.t + (ih * k) / 4;
    s += `<line x1="${P.l}" x2="${P.l + iw}" y1="${gy}" y2="${gy}" stroke="var(--line-2)" stroke-width="1"/>`;
    s += `<text x="${P.l - 10}" y="${gy + 4}" text-anchor="end">${valueFmt(max * (1 - k / 4))}</text>`;
  }
  labels.forEach((lab, i) => {
    const cx = P.l + step * i + step / 2;
    let acc = 0;
    series.forEach((ser) => {
      const v = ser.values[i];
      const y0 = y(acc), y1 = y(acc + v);
      s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" rx="4" fill="${ser.color}"><title>${ser.name}: ${valueFmt(v)}</title></rect>`;
      acc += v;
    });
    s += `<text x="${cx}" y="${H - 12}" text-anchor="middle">${lab}</text>`;
  });
  if (target) {
    const ty = y(target[0]);
    s += `<line x1="${P.l}" x2="${P.l + iw}" y1="${ty}" y2="${ty}" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="6 5" opacity="0.9"/>`;
  }
  return s + `</svg>`;
}

function barChart({ labels, values, color = "#5b5bf0", valueFmt = compactNum, height = 200 }) {
  const W = 520, H = height, P = { t: 14, r: 10, b: 28, l: 40 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = Math.max(...values) * 1.18 || 1;
  const n = labels.length, step = iw / n, bw = Math.min(30, step * 0.55);
  const y = (v) => P.t + ih - (ih * v) / max;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  for (let k = 0; k <= 3; k++) {
    const gy = P.t + (ih * k) / 3;
    s += `<line x1="${P.l}" x2="${P.l + iw}" y1="${gy}" y2="${gy}" stroke="var(--line-2)"/>`;
    if (k < 3) s += `<text x="${P.l - 8}" y="${gy + 4}" text-anchor="end">${valueFmt(max * (1 - k / 3))}</text>`;
  }
  labels.forEach((lab, i) => {
    const cx = P.l + step * i + step / 2;
    const y1 = y(values[i]);
    s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, (P.t + ih) - y1).toFixed(1)}" rx="3" fill="${color}" opacity="0.9"><title>${lab}: ${valueFmt(values[i])}</title></rect>`;
    s += `<text x="${cx}" y="${H - 10}" text-anchor="middle">${lab}</text>`;
  });
  return s + `</svg>`;
}

function donutChart({ segments, size = 176, thickness = 26, centerTop = "", centerSub = "" }) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const rad = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * rad;
  let off = 0;
  let s = `<svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">`;
  s += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="var(--line-2)" stroke-width="${thickness}"/>`;
  segments.forEach((seg) => {
    const frac = seg.value / total, len = frac * circ;
    s += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${seg.color}" stroke-width="${thickness}" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${c} ${c})"><title>${seg.name}: ${seg.display || seg.value}</title></circle>`;
    off += len;
  });
  s += `<text x="${c}" y="${c - 2}" text-anchor="middle" style="font-size:17px;font-weight:750;fill:var(--ink)">${centerTop}</text>`;
  s += `<text x="${c}" y="${c + 15}" text-anchor="middle" style="font-size:10.5px;fill:var(--muted)">${centerSub}</text>`;
  return s + `</svg>`;
}

/* ---------- helpers ---------- */
function deltaEl(value) {
  const cls = value > 0.5 ? "up" : value < -0.5 ? "down" : "flat";
  const arrow = value > 0.5 ? "▲" : value < -0.5 ? "▼" : "•";
  return `<span class="delta ${cls}">${arrow} ${Math.abs(value).toFixed(1)}%</span>`;
}
function miniBar(v, color) {
  return `<div class="mini-bar"><span style="width:${Math.min(100, v).toFixed(1)}%${color ? ";background:" + color : ""}"></span></div>`;
}
function mcard(label, value, meta, hl, drill) {
  return `<div class="mcard${hl ? " hl" : ""}"${drill ? ` data-drill="${drill}"` : ""}><div class="mlab">${label}</div><div class="mval">${value}</div><div class="mmeta">${meta}</div></div>`;
}
const chartBlock = (svg) => `<div class="chart">${svg}</div>`;
function dtable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h, i) => `<th class="${i > 0 ? "num" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i > 0 ? "num" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function campTable(list) {
  return `<div class="table-wrap"><table><thead><tr><th>Campaign</th><th class="num">Spend</th><th class="num">CTR</th><th class="num">Freq</th><th class="num">Sign-ups</th><th class="num">₹/Sign-up</th><th class="num">LP drop</th><th class="num">Load</th><th>Action</th></tr></thead><tbody>${list.map((c) => `<tr><td><span class="cname">${c.name}</span></td><td class="num">${compactINR(c.spend)}</td><td class="num">${c.ctr.toFixed(1)}%</td><td class="num">${c.freq.toFixed(1)}</td><td class="num">${n0(c.conv)}</td><td class="num">${inr0(c.cpa)}</td><td class="num">${c.lpDrop}%</td><td class="num">${c.lpLoad.toFixed(1)}s</td><td><span class="badge ${c.verdict}">${c.verdict}</span></td></tr>`).join("")}</tbody></table></div>`;
}
function compactFunnel(f) {
  const items = [["Total leads", f.leads], ["Qualified", f.qualified], ["Discovery call set", f.callsSet], ["Call attended", f.callsAttended], ["Ambition interview", f.interviews], ["Architect session", f.architect], ["Program sign-up", f.signups]];
  const max = f.leads;
  return items.map(([name, v]) => `<div class="fstage" style="grid-template-columns:170px 1fr 84px"><div class="fname">${name}</div><div class="fbar" style="height:26px"><span style="width:${Math.max(6, (v / max) * 100)}%">${n0(v)}</span></div><div class="fval">${pct((v / max) * 100, 0)}</div></div>`).join("");
}
const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

/* ---------- renderers ---------- */
function renderKPIs(d) {
  const revPct = (d.achieved / d.target) * 100;
  const onbPct = (d.onboarded / d.onboardTarget) * 100;
  const conv = d.funnel.leadToPaid;
  const cards = [
    { label: "Revenue achieved", val: compactINR(d.achieved), sub: `${pct(revPct, 0)} of ${compactINR(d.target)} ` + deltaEl(revPct - 78), bar: revPct, drill: "revenue" },
    { label: "Students onboarded", val: n0(d.onboarded), sub: `target ${n0(d.onboardTarget)} ` + deltaEl(onbPct - 88), bar: onbPct, drill: "onboarded" },
    { label: "Qualified leads", val: n0(d.funnel.qualified), sub: `${n0(d.funnel.organic)} organic ` + deltaEl(4.1), bar: (d.funnel.qualified / d.funnel.leads) * 100, drill: "qualified" },
    { label: "Cost / qualified lead", val: inr0(d.funnel.costPerQualified), sub: `spend ${compactINR(d.funnel.adSpend)} ` + deltaEl(-6.4), bar: Math.min(100, (d.funnel.costPerQualified / 400) * 100), drill: "cpql" },
    { label: "Lead → Paid conversion", val: pct(conv, 2), sub: `${n0(d.funnel.signups)} sign-ups ` + deltaEl(conv - 4.4), bar: Math.min(100, conv * 9), drill: "conversion" },
    { label: "Unpaid invoices", val: compactINR(d.unpaidTotal), sub: `${d.invoices.length} open ` + deltaEl(8.2), bar: Math.min(100, (d.invoices.length / 8) * 100), drill: "invoices" },
  ];
  setHTML("kpis", cards.map((c) => `<div class="kpi" data-drill="${c.drill}">
    <div class="k-label">${c.label}</div>
    <div class="k-val">${c.val}</div>
    <div class="k-sub">${c.sub}</div>${miniBar(c.bar)}</div>`).join(""));

  const gap = d.target - d.achieved;
  setHTML("topInsight", `<span class="ico">i</span><div><b>${PERIODS[d.key].label}:</b>
    revenue is at <b>${pct(revPct, 0)}</b> of target (gap ${compactINR(gap)}). Funnel converts
    <b>${pct(conv, 2)}</b> of leads to paid, with <b>${n0(d.funnel.organic)}</b> organic leads against
    <b>${inr0(d.funnel.costPerQualified)}</b> cost per qualified lead.</div>`);
}

function renderTVA(d) {
  const revPct = (d.achieved / d.target) * 100;
  const gap = d.target - d.achieved;
  const onbPct = (d.onboarded / d.onboardTarget) * 100;
  setHTML("tvaCard", `<div class="card-head">
      <h3>Target vs achievement</h3>
      <span class="sub">${PERIODS[d.key].label}</span>
    </div>
    <div class="tva">
      <div class="tva-rows">
        <div class="tva-row">
          <span class="lab">Target</span>
          <div class="track"><span class="target" style="width:100%">${compactINR(d.target)}</span></div>
          <span class="val">${compactINR(d.target)}</span>
        </div>
        <div class="tva-row">
          <span class="lab">Achieved</span>
          <div class="track"><span class="achieved" style="width:${revPct.toFixed(1)}%">${compactINR(d.achieved)}</span></div>
          <span class="val">${compactINR(d.achieved)}</span>
        </div>
      </div>
      <div class="tva-hero">
        <div class="tva-pct">
          <span class="big" style="color:${revPct >= 90 ? "var(--success)" : revPct >= 75 ? "var(--warn)" : "var(--danger)"}">${revPct.toFixed(0)}%</span>
          <span class="cap">of revenue target hit</span>
        </div>
        <div class="tva-note">
          ${revPct >= 95 ? "On track." : revPct >= 80 ? "Slightly behind pace." : "Materially behind pace."}
          Need <b>${compactINR(gap)}</b> more to close the gap.
        </div>
      </div>
      <div class="tva-gap">
        <span class="tva-chip"><span class="k">Revenue gap</span><b style="color:var(--danger)">${compactINR(gap)}</b></span>
        <span class="tva-chip"><span class="k">Achieved / Target</span><b>${compactINR(d.achieved)} / ${compactINR(d.target)}</b></span>
        <span class="tva-chip"><span class="k">Students</span><b>${n0(d.onboarded)} / ${n0(d.onboardTarget)}</b> (${onbPct.toFixed(0)}%)</span>
        <span class="tva-chip"><span class="k">Program : Workshop</span><b>${(d.programRev / d.workshopRev).toFixed(1)}×</b></span>
      </div>
    </div>`);
}

function renderRevenue(d) {
  setHTML("revHint", `Target ${compactINR(d.target)} · achieved ${compactINR(d.achieved)} · gap ${compactINR(d.target - d.achieved)}`);
  renderTVA(d);

  setHTML("revChart", stackedBarChart({
    labels: d.labels,
    series: [
      { name: "Program revenue", color: "#5b5bf0", values: d.series.map((x) => x.program) },
      { name: "Workshop revenue", color: "#8b5cf6", values: d.series.map((x) => x.workshop) },
    ],
    target: d.targetSeries,
  }));
  setHTML("revTrendSub", `gap ${compactINR(d.target - d.achieved)} to target`);

  const total = d.achieved;
  setHTML("revDonut", donutChart({
    segments: [
      { name: "Program", value: d.programRev, color: "#5b5bf0", display: compactINR(d.programRev) },
      { name: "Workshop", value: d.workshopRev, color: "#8b5cf6", display: compactINR(d.workshopRev) },
    ],
    centerTop: compactINR(total), centerSub: "total",
  }));
  setHTML("revDonutLegend",
    `<div class="stat-row"><span style="width:10px;height:10px;border-radius:3px;background:#5b5bf0"></span><span class="sr-name">Program</span><span class="sr-val">${compactINR(d.programRev)}</span><span class="sr-meta">${pct((d.programRev / total) * 100, 0)}</span></div>
     <div class="stat-row"><span style="width:10px;height:10px;border-radius:3px;background:#8b5cf6"></span><span class="sr-name">Workshop</span><span class="sr-val">${compactINR(d.workshopRev)}</span><span class="sr-meta">${pct((d.workshopRev / total) * 100, 0)}</span></div>`);

  const tp = (d.trialRev / d.programRev) * 100;
  setHTML("trialSplit", `
    <div class="split"><span class="lab">3-month trials</span><span class="val">${compactINR(d.trialRev)} · ${n0(d.trialStudents)} teens</span>
      <div class="track"><span style="width:${tp.toFixed(1)}%;background:#8b5cf6"></span></div></div>
    <div class="split"><span class="lab">Full program sign-ups</span><span class="val">${compactINR(d.fullRev)} · ${n0(d.fullStudents)} teens</span>
      <div class="track"><span style="width:${(100 - tp).toFixed(1)}%;background:#5b5bf0"></span></div></div>
    <div class="mmeta" style="margin-top:8px">Trials = <b>${pct(tp, 0)}</b> of program revenue. Watch trial→full upgrades as they mature.</div>`);

  setHTML("onboardSub", `${n0(d.onboarded)} of ${n0(d.onboardTarget)} target`);
  setHTML("onboardChart", barChart({ labels: d.labels, values: d.onboardSeries, color: "#12a150", valueFmt: (v) => Math.round(v) }));

  const arps = d.workshopRev / d.seats;
  setHTML("workshopStats", `
    <div class="stat-row"><span class="sr-name">Workshop revenue</span><span class="sr-val">${compactINR(d.workshopRev)}</span></div>
    <div class="stat-row"><span class="sr-name">Seats sold</span><span class="sr-val">${n0(d.seats)}</span><span class="sr-meta">@ ₹3,999</span></div>
    <div class="stat-row"><span class="sr-name">Workshops held</span><span class="sr-val">${n0(d.workshopsHeld)}</span><span class="sr-meta">fortnightly</span></div>
    <div class="stat-row"><span class="sr-name">Avg / seat</span><span class="sr-val">${inr0(arps)}</span></div>`);

  setHTML("invoiceSub", `${compactINR(d.unpaidTotal)} outstanding`);
  setHTML("invoiceRows", d.invoices.map((inv) => {
    const cls = inv.status === "Overdue" ? "drop" : inv.status === "Due soon" ? "refresh" : "scale";
    return `<tr><td><span class="cname">${inv.client}</span></td><td class="muted">${inv.inv}</td><td class="num">${inr0(inv.amount)}</td><td class="num">${inv.age}d</td><td><span class="badge ${cls}">${inv.status}</span></td></tr>`;
  }).join(""));

  setHTML("renewalRows", d.renewals.map((x) => {
    const cls = x.risk === "Churned" || x.risk === "High" ? "drop" : x.risk === "Medium" ? "refresh" : "scale";
    const days = x.daysLeft < 0 ? `${Math.abs(x.daysLeft)}d ago` : `${x.daysLeft}d`;
    return `<tr><td><span class="cname">${x.teen}</span></td><td class="muted">${x.plan}</td><td class="num">${days}</td><td><span class="badge ${cls}">${x.risk}</span></td></tr>`;
  }).join(""));
}

function renderFunnel(d) {
  const f = d.funnel;
  const stages = [
    { k: "impressions", name: "Impressions", note: "Meta ads" },
    { k: "leads", name: "Total leads", note: `${n0(f.organic)} organic` },
    { k: "qualified", name: "Qualified leads", note: "budget · intent fit" },
    { k: "callsSet", name: "Discovery call set", note: "scheduled" },
    { k: "callsAttended", name: "Call attended", note: "show-up" },
    { k: "interviews", name: "Ambition interview", note: "with teen" },
    { k: "architect", name: "Architect session", note: "roadmap w/ parents" },
    { k: "signups", name: "Program sign-up", note: "paid" },
  ];
  const maxV = f.impressions;
  const conv = (a, b) => (b / a) * 100;
  let html = `<div class="funnel">`;
  stages.forEach((s, i) => {
    const v = f[s.k];
    const widthPct = Math.max(4, (v / maxV) * 100);
    const valueFmt = i === 0 ? compactNum(v) : n0(v);
    html += `<div class="fstage">
      <div class="fname">${s.name}<small>${s.note}</small></div>
      <div class="fbar"><span style="width:${widthPct.toFixed(1)}%">${valueFmt}</span></div>
      <div class="fval">${n0(v)}</div></div>`;
    if (i < stages.length - 1) {
      const next = f[stages[i + 1].k];
      const c = conv(v, next);
      let type = c < 30 ? "bad" : c < 55 ? "mid" : "good";
      let label = "rate";
      if (stages[i + 1].k === "callsAttended") label = "show-up rate";
      if (stages[i + 1].k === "interviews") label = "interview drop-off";
      if (stages[i + 1].k === "signups") label = "close rate";
      const shown = stages[i + 1].k === "interviews" ? 100 - c : c;
      html += `<div class="fconv"><div></div><div class="line"><span class="arrow"></span><span class="fpill ${type}">${pct(shown, 0)} ${label}</span></div><div></div></div>`;
    }
  });
  setHTML("funnelViz", html + `</div>`);
  setHTML("funnelSub", `${compactNum(f.impressions)} impressions → ${n0(f.signups)} paid`);

  setHTML("funnelMetricCards", [
    mcard("Cost / qualified lead", inr0(f.costPerQualified), `${compactINR(f.adSpend)} ad spend`, false, "f-cpql"),
    mcard("Program conversion", pct(f.leadToPaid, 2), "lead → paid", false, "f-conv"),
    mcard("Qualified → paid", pct(f.qualToPaid, 1), `${n0(f.signups)} of ${n0(f.qualified)}`, false, "f-qualpaid"),
    mcard("Discovery show-up", pct(f.showUpRate, 1), `${n0(f.callsAttended)} of ${n0(f.callsSet)}`, false, "f-showup"),
    mcard("Interview drop-off", pct(f.interviewDrop, 1), "after discovery call", false, "f-dropoff"),
    mcard("Organic leads", n0(f.organic), pct((f.organic / f.leads) * 100, 0) + " of total", false, "f-organic"),
    mcard("Total leads", n0(f.leads), `${compactNum(f.impressions)} impressions`, false, "f-leads"),
    mcard("Avg lead journey", f.avgJourneyDays + " days", "lead → sign-up", false, "f-journey"),
    mcard("Paid sign-ups", n0(f.signups), `${inr0(f.adSpend / f.signups)} / sign-up`, true, "f-signups"),
  ].join(""));

  const weak = f.showUpRate < 74;
  setHTML("funnelInsight", `<span class="ico">!</span><div>${weak
    ? `Discovery <b>show-up rate is ${pct(f.showUpRate, 0)}</b> — the biggest leak. Confirm calls 24h prior and require a WhatsApp opt-in to lift attendance before adding spend.`
    : `Show-up is healthy at <b>${pct(f.showUpRate, 0)}</b>. Next lever is the <b>architect → close</b> step (${pct(conv(f.architect, f.signups), 0)}).`
  }</div>`);
}

let campFilter = "all";
function renderCampaigns(d) {
  const rows = d.campaigns.filter((c) => campFilter === "all" || c.type === campFilter);
  setHTML("campaignRows", rows.map((c) => {
    const dropColor = c.lpDrop > 50 ? "#e5484d" : c.lpDrop > 38 ? "#f59e0b" : "#12a150";
    const loadColor = c.lpLoad > 2.6 ? "#e5484d" : c.lpLoad > 2.1 ? "#f59e0b" : "#12a150";
    const freqColor = c.freq >= 3 ? "#e5484d" : c.freq > 2.4 ? "#f59e0b" : "#12a150";
    return `<tr>
      <td><span class="cname">${c.name}</span></td>
      <td><span class="type-pill ${c.type}">${c.type === "workshop" ? "Workshop" : "Program"}</span></td>
      <td class="num">${compactINR(c.spend)}</td>
      <td class="num">${compactNum(c.impr)}</td>
      <td class="num"><span class="mbar"><span class="track"><span style="width:${Math.min(100, (c.ctr / 4) * 100).toFixed(0)}%;background:#5b5bf0"></span></span><b>${c.ctr.toFixed(1)}%</b></span></td>
      <td class="num"><span style="color:${freqColor};font-weight:700">${c.freq.toFixed(1)}</span></td>
      <td class="num">${n0(c.conv)}</td>
      <td class="num">${inr0(c.cpa)}</td>
      <td><span class="mbar"><span class="track"><span style="width:${c.lpDrop}%;background:${dropColor}"></span></span>${c.lpDrop}%</span></td>
      <td class="num"><span style="color:${loadColor};font-weight:700">${c.lpLoad.toFixed(1)}</span></td>
      <td><span class="badge ${c.verdict}">${c.verdict}</span></td></tr>`;
  }).join(""));

  const best = [...d.campaigns].sort((a, b) => b.ctr - a.ctr)[0];
  const worst = [...d.campaigns].sort((a, b) => a.ctr - b.ctr)[0];
  const fatigued = d.campaigns.filter((c) => c.freq >= 3);
  const slowLP = d.campaigns.filter((c) => c.lpLoad > 2.4);
  setHTML("campHighlights", [
    mcard("Highest CTR", best.ctr.toFixed(1) + "%", best.name, true, "c-best"),
    mcard("Lowest CTR", worst.ctr.toFixed(1) + "%", worst.name, false, "c-worst"),
    mcard("Fatigued ad sets", n0(fatigued.length), "frequency ≥ 3 · refresh", false, "c-fatigued"),
    mcard("Slow landing pages", n0(slowLP.length), "load > 2.4s · fix speed", false, "c-lp"),
    mcard("Total ad spend", compactINR(d.campaigns.reduce((s, c) => s + c.spend, 0)), "across all sets", false, "c-spend"),
    mcard("Total sign-ups", n0(d.campaigns.reduce((s, c) => s + c.conv, 0)), "attributed", false, "c-signups"),
  ].join(""));

  setHTML("campInsight", `<span class="ico">i</span><div>Highest CTR: <b>${best.name}</b>
    (${best.ctr.toFixed(1)}%). Lowest: <b>${worst.name}</b> (${worst.ctr.toFixed(1)}%).
    <b>${fatigued.length}</b> ad sets are at frequency ≥ 3 and need a creative refresh before spend scales.</div>`);
}

function renderRCA(d) {
  const cols = [
    { key: "scale", title: "Scale" },
    { key: "refresh", title: "Refresh" },
    { key: "drop", title: "Drop" },
  ];
  setHTML("rcaBoard", cols.map((col) => {
    const items = d.campaigns.filter((c) => c.verdict === col.key);
    const body = items.length ? items.map((c) => `<div class="ritem">
        <div class="rname">${c.name}</div>
        <div class="rtag">${c.type === "workshop" ? "Workshop" : "Program"} · ${compactINR(c.spend)} spend</div>
        <div class="reason">${c.reason}</div>
        <div class="rmetrics"><span>CTR ${c.ctr.toFixed(1)}%</span><span>Freq ${c.freq.toFixed(1)}</span><span>${n0(c.conv)} sign-ups</span><span>${inr0(c.cpa)}/sign-up</span></div>
      </div>`).join("") : `<div class="ritem muted" style="font-size:12px">No campaigns in this bucket.</div>`;
    return `<div class="rca-col ${col.key}"><div class="rcol-head">${col.title}<span class="count">${items.length}</span></div>${body}</div>`;
  }).join(""));

  const scaleSpend = d.campaigns.filter((c) => c.verdict === "scale").reduce((s, c) => s + c.spend, 0);
  const dropSpend = d.campaigns.filter((c) => c.verdict === "drop").reduce((s, c) => s + c.spend, 0);
  setHTML("rcaInsight", `<span class="ico">→</span><div>Reallocating spend from the <b>drop</b> bucket
    (<b>${compactINR(dropSpend)}</b>) into the <b>scale</b> bucket (<b>${compactINR(scaleSpend)}</b> currently)
    is the fastest efficiency win. Refresh fatigued sets (freq ≥ 3) in parallel to protect CTR as volume grows.</div>`);
}

/* ---------- drill-down definitions ---------- */
const DRILLS = {
  /* --- KPI cards --- */
  revenue: (d) => ({
    title: "Revenue achieved", sub: PERIODS[d.key].label,
    body: `<div class="modal-hero"><span class="big">${compactINR(d.achieved)}</span><span class="cap">of ${compactINR(d.target)} target · ${pct((d.achieved / d.target) * 100, 0)}</span></div>
      <div class="modal-calc">Achieved = Program revenue + Workshop revenue. Gap = Target − Achieved.</div>
      ${chartBlock(stackedBarChart({ labels: d.labels, series: [{ name: "Program", color: "#5b5bf0", values: d.series.map((x) => x.program) }, { name: "Workshop", color: "#8b5cf6", values: d.series.map((x) => x.workshop) }], target: d.targetSeries }))}
      <div class="drill-h">Breakdown</div>
      ${dtable(["Line", "Value", "Share"], [
        ["Target", compactINR(d.target), "—"],
        ["Achieved", compactINR(d.achieved), pct((d.achieved / d.target) * 100, 0)],
        ["Gap", compactINR(d.target - d.achieved), pct(100 - (d.achieved / d.target) * 100, 0)],
        ["Program revenue", compactINR(d.programRev), pct((d.programRev / d.achieved) * 100, 0)],
        ["Workshop revenue", compactINR(d.workshopRev), pct((d.workshopRev / d.achieved) * 100, 0)],
        ["Trials (program)", compactINR(d.trialRev), pct((d.trialRev / d.programRev) * 100, 0)],
        ["Full program", compactINR(d.fullRev), pct((d.fullRev / d.programRev) * 100, 0)],
      ])}`,
  }),

  onboarded: (d) => ({
    title: "Students onboarded", sub: `${n0(d.onboarded)} of ${n0(d.onboardTarget)} target`,
    body: `<div class="modal-hero"><span class="big">${n0(d.onboarded)}</span><span class="cap">${pct((d.onboarded / d.onboardTarget) * 100, 0)} of target (${n0(d.onboardTarget)})</span></div>
      <div class="modal-calc">Onboarded = new students activated this period. Split into 3-month trials and full-program sign-ups.</div>
      ${chartBlock(barChart({ labels: d.labels, values: d.onboardSeries, color: "#12a150", valueFmt: (v) => Math.round(v) }))}
      <div class="drill-h">Breakdown</div>
      ${dtable(["Line", "Value"], [
        ["Onboarded", n0(d.onboarded)],
        ["Target", n0(d.onboardTarget)],
        ["Achievement", pct((d.onboarded / d.onboardTarget) * 100, 0)],
        ["3-month trials", n0(d.trialStudents)],
        ["Full program", n0(d.fullStudents)],
      ])}`,
  }),

  qualified: (d) => {
    const f = d.funnel, paidLeads = f.leads - f.organic;
    return {
      title: "Qualified leads", sub: `${n0(f.qualified)} of ${n0(f.leads)} leads`,
      body: `<div class="modal-hero"><span class="big">${n0(f.qualified)}</span><span class="cap">qualification rate ${pct((f.qualified / f.leads) * 100, 1)}</span></div>
        <div class="modal-calc">Qualified = leads that pass budget + intent fit. Cost/qualified = ad spend ÷ qualified.</div>
        ${chartBlock(barChart({ labels: ["Leads", "Organic", "Paid", "Qualified"], values: [f.leads, f.organic, paidLeads, f.qualified], color: "#5b5bf0", valueFmt: (v) => Math.round(v), height: 180 }))}
        <div class="drill-h">Source &amp; cost</div>
        ${dtable(["Line", "Value"], [
          ["Total leads", n0(f.leads)],
          ["Organic", n0(f.organic)],
          ["Paid", n0(paidLeads)],
          ["Qualified", n0(f.qualified)],
          ["Qualification rate", pct((f.qualified / f.leads) * 100, 1)],
          ["Ad spend", compactINR(f.adSpend)],
        ])}`,
    };
  },

  cpql: (d) => {
    const f = d.funnel;
    const ranked = [...d.campaigns].sort((a, b) => a.cpa - b.cpa);
    return {
      title: "Cost / qualified lead", sub: `${compactINR(f.adSpend)} spend ÷ ${n0(f.qualified)} qualified`,
      body: `<div class="modal-hero"><span class="big">${inr0(f.costPerQualified)}</span><span class="cap">per qualified lead</span></div>
        <div class="modal-calc">Cost/qualified = total ad spend ÷ qualified leads. Lower is better.</div>
        <div class="drill-h">Campaign efficiency (cost / sign-up, low → high)</div>
        ${dtable(["Campaign", "Spend", "Sign-ups", "₹/Sign-up"], ranked.map((c) => [c.name, compactINR(c.spend), n0(c.conv), inr0(c.cpa)]))}`,
    };
  },

  conversion: (d) => {
    const f = d.funnel;
    return {
      title: "Lead → Paid conversion", sub: `${n0(f.signups)} sign-ups from ${n0(f.leads)} leads`,
      body: `<div class="modal-hero"><span class="big">${pct(f.leadToPaid, 2)}</span><span class="cap">qualified → paid ${pct(f.qualToPaid, 1)}</span></div>
        <div class="modal-calc">Lead → paid = paid sign-ups ÷ total leads. Full journey below (share of total leads).</div>
        <div class="drill-h">Stage-wise</div>
        ${compactFunnel(f)}`,
    };
  },

  invoices: (d) => ({
    title: "Invoices generated · not paid", sub: `${compactINR(d.unpaidTotal)} outstanding · ${d.invoices.length} open`,
    body: `<div class="modal-hero"><span class="big">${compactINR(d.unpaidTotal)}</span><span class="cap">${d.invoices.length} invoices outstanding</span></div>
      <div class="modal-calc">Invoices raised but not yet settled. Age = days since issue.</div>
      ${dtable(["Client", "Invoice", "Amount", "Age", "Status"], d.invoices.map((i) => [i.client, i.inv, inr0(i.amount), i.age + "d", i.status]))}`,
  }),

  /* --- funnel metric cards --- */
  "f-cpql": (d) => ({
    title: "Cost / qualified lead", sub: "ad spend ÷ qualified leads",
    body: `<div class="modal-hero"><span class="big">${inr0(d.funnel.costPerQualified)}</span><span class="cap">per qualified lead</span></div>
      <div class="modal-calc">Fortnightly Meta spend divided by the number of leads that pass qualification.</div>
      ${dtable(["Line", "Value"], [["Ad spend", compactINR(d.funnel.adSpend)], ["Qualified leads", n0(d.funnel.qualified)], ["Cost / qualified", inr0(d.funnel.costPerQualified)], ["Cost / lead", inr0(d.funnel.adSpend / d.funnel.leads)]])}`,
  }),
  "f-conv": (d) => ({
    title: "Program conversion", sub: "lead → paid",
    body: `<div class="modal-hero"><span class="big">${pct(d.funnel.leadToPaid, 2)}</span><span class="cap">${n0(d.funnel.signups)} paid of ${n0(d.funnel.leads)} leads</span></div>
      <div class="modal-calc">Paid sign-ups ÷ total leads across the full Meta-ads journey.</div>
      ${compactFunnel(d.funnel)}`,
  }),
  "f-qualpaid": (d) => ({
    title: "Qualified → paid", sub: "close rate from qualified",
    body: `<div class="modal-hero"><span class="big">${pct(d.funnel.qualToPaid, 1)}</span><span class="cap">${n0(d.funnel.signups)} paid of ${n0(d.funnel.qualified)} qualified</span></div>
      <div class="modal-calc">Paid sign-ups ÷ qualified leads — isolates downstream sales effectiveness.</div>
      ${dtable(["Line", "Value"], [["Qualified leads", n0(d.funnel.qualified)], ["Architect sessions", n0(d.funnel.architect)], ["Paid sign-ups", n0(d.funnel.signups)], ["Close rate", pct(d.funnel.qualToPaid, 1)]])}`,
  }),
  "f-showup": (d) => ({
    title: "Discovery show-up rate", sub: "attended ÷ set",
    body: `<div class="modal-hero"><span class="big">${pct(d.funnel.showUpRate, 1)}</span><span class="cap">${n0(d.funnel.callsAttended)} attended of ${n0(d.funnel.callsSet)} set</span></div>
      <div class="modal-calc">Calls attended ÷ discovery calls set. The classic leak in high-intent funnels.</div>
      ${dtable(["Line", "Value"], [["Calls set", n0(d.funnel.callsSet)], ["Calls attended", n0(d.funnel.callsAttended)], ["No-shows", n0(d.funnel.callsSet - d.funnel.callsAttended)], ["Show-up rate", pct(d.funnel.showUpRate, 1)]])}`,
  }),
  "f-dropoff": (d) => ({
    title: "Interview drop-off", sub: "after discovery call",
    body: `<div class="modal-hero"><span class="big">${pct(d.funnel.interviewDrop, 1)}</span><span class="cap">drop between call and ambition interview</span></div>
      <div class="modal-calc">Drop-off = 1 − (interviews ÷ calls attended). Where qualified interest cools.</div>
      ${dtable(["Line", "Value"], [["Calls attended", n0(d.funnel.callsAttended)], ["Ambition interviews", n0(d.funnel.interviews)], ["Drop-off", pct(d.funnel.interviewDrop, 1)]])}`,
  }),
  "f-organic": (d) => {
    const f = d.funnel;
    return {
      title: "Organic leads", sub: `${pct((f.organic / f.leads) * 100, 0)} of total leads`,
      body: `<div class="modal-hero"><span class="big">${n0(f.organic)}</span><span class="cap">organic of ${n0(f.leads)} total leads</span></div>
        <div class="modal-calc">Leads from non-paid sources (referral, word-of-mouth, social).</div>
        ${dtable(["Source", "Leads", "Share"], [["Organic", n0(f.organic), pct((f.organic / f.leads) * 100, 0)], ["Paid", n0(f.leads - f.organic), pct(((f.leads - f.organic) / f.leads) * 100, 0)], ["Total", n0(f.leads), "100%"]])}`,
    };
  },
  "f-leads": (d) => ({
    title: "Total leads", sub: `${compactNum(d.funnel.impressions)} impressions`,
    body: `<div class="modal-hero"><span class="big">${n0(d.funnel.leads)}</span><span class="cap">from ${compactNum(d.funnel.impressions)} impressions</span></div>
      <div class="modal-calc">All inbound leads (paid + organic) that entered the funnel this period.</div>
      ${dtable(["Line", "Value"], [["Impressions", n0(d.funnel.impressions)], ["Total leads", n0(d.funnel.leads)], ["Lead rate", pct((d.funnel.leads / d.funnel.impressions) * 100, 3)]])}`,
  }),
  "f-journey": (d) => ({
    title: "Average lead journey", sub: "lead → paid",
    body: `<div class="modal-hero"><span class="big">${d.funnel.avgJourneyDays} days</span><span class="cap">average time from first touch to paid</span></div>
      <div class="modal-calc">Mean days a lead spends in the funnel before signing up (or dropping off).</div>
      ${dtable(["Line", "Value"], [["Avg journey (paid)", d.funnel.avgJourneyDays + "d"], ["Funnel stages", "7"], ["Avg per stage", (d.funnel.avgJourneyDays / 7).toFixed(1) + "d"]])}`,
  }),
  "f-signups": (d) => ({
    title: "Paid sign-ups", sub: `${inr0(d.funnel.adSpend / d.funnel.signups)} cost per sign-up`,
    body: `<div class="modal-hero"><span class="big">${n0(d.funnel.signups)}</span><span class="cap">paid sign-ups this period</span></div>
      <div class="modal-calc">Final funnel outcome. Cost/sign-up = ad spend ÷ sign-ups.</div>
      ${dtable(["Line", "Value"], [["Paid sign-ups", n0(d.funnel.signups)], ["Ad spend", compactINR(d.funnel.adSpend)], ["Cost / sign-up", inr0(d.funnel.adSpend / d.funnel.signups)], ["Lead → paid", pct(d.funnel.leadToPaid, 2)]])}`,
  }),

  /* --- campaign highlight cards --- */
  "c-best": (d) => ({ title: "Highest CTR campaigns", sub: "sorted by CTR", body: campTable([...d.campaigns].sort((a, b) => b.ctr - a.ctr)) }),
  "c-worst": (d) => ({ title: "Lowest CTR campaigns", sub: "sorted by CTR", body: campTable([...d.campaigns].sort((a, b) => a.ctr - b.ctr)) }),
  "c-fatigued": (d) => ({ title: "Fatigued ad sets", sub: "frequency ≥ 3 · refresh needed", body: campTable(d.campaigns.filter((c) => c.freq >= 3)) }),
  "c-lp": (d) => ({ title: "Slow landing pages", sub: "load time > 2.4s", body: campTable([...d.campaigns].filter((c) => c.lpLoad > 2.4).sort((a, b) => b.lpLoad - a.lpLoad)) }),
  "c-spend": (d) => ({ title: "Ad spend by campaign", sub: "high → low", body: campTable([...d.campaigns].sort((a, b) => b.spend - a.spend)) }),
  "c-signups": (d) => ({ title: "Sign-ups by campaign", sub: "high → low", body: campTable([...d.campaigns].sort((a, b) => b.conv - a.conv)) }),
};

function openDrill(key) {
  const def = DRILLS[key];
  if (!def) return;
  const d = getData(document.getElementById("period").value);
  const { title, sub, body } = def(d);
  setHTML("modalTitle", `${title}${sub ? `<div class="msub">${sub}</div>` : ""}`);
  setHTML("modalBody", body);
  document.getElementById("modal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeDrill() {
  document.getElementById("modal").hidden = true;
  document.body.style.overflow = "";
}

/* ---------- orchestration + tabs ---------- */
const cache = {};
const getData = (k) => cache[k] || (cache[k] = generate(k));

function render(key) {
  const d = getData(key);
  setHTML("rangeSub", `${PERIODS[key].label} · generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`);
  renderKPIs(d);
  renderRevenue(d);
  renderFunnel(d);
  renderCampaigns(d);
  renderRCA(d);
}

function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.dataset.page === name));
  document.querySelectorAll("#nav .navlink").forEach((b) => b.classList.toggle("active", b.dataset.page === name));
  const heading = document.getElementById("pageHeading");
  if (heading) heading.textContent = PAGE_TITLES[name] || "GTM Tracker";
  window.scrollTo({ top: 0, behavior: "auto" });
}

document.addEventListener("DOMContentLoaded", () => {
  const period = document.getElementById("period");
  period.addEventListener("change", () => render(period.value));

  document.querySelectorAll("#nav .navlink").forEach((b) =>
    b.addEventListener("click", () => showPage(b.dataset.page))
  );

  document.getElementById("campFilter").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    campFilter = btn.dataset.f;
    document.querySelectorAll("#campFilter button").forEach((b) => b.classList.toggle("active", b === btn));
    renderCampaigns(getData(period.value));
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());

  document.addEventListener("click", (e) => {
    const dr = e.target.closest("[data-drill]");
    if (dr && !e.target.closest("#modal")) { openDrill(dr.dataset.drill); return; }
    if (e.target.closest("[data-close]")) closeDrill();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrill(); });

  document.getElementById("themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  });

  const pad = (x) => String(x).padStart(2, "0");
  const now = new Date();
  setHTML("lastUpdated", `Live · dummy dataset · ${pad(now.getHours())}:${pad(now.getMinutes())}`);

  render(period.value);
  showPage("overview");
});
