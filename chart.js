/* ================================================================
   Green Charging – Dynamic Oblique-3D Energy Chart
   Built with D3.js v7
   ================================================================ */

(function () {
  "use strict";

  /* ── Data ──────────────────────────────────────────────── */
  const hours = d3.range(6, 23);

  const weatherByHour = {
    6: "night",   7: "overcast", 8: "overcast",
    9: "partly", 10: "partly",  11: "peak",
    12: "peak",  13: "peak",    14: "partly",
    15: "partly",16: "partly",  17: "overcast",
    18: "overcast",19:"evening",20: "evening",
    21: "evening",22: "night",
  };

  const weatherLabels = {
    night: "Night", peak: "Peak Sun", partly: "Partly Cloudy",
    overcast: "Overcast", evening: "Evening",
  };

  const weatherBandColors = {
    night:    "rgba(186,199,219,.16)",
    peak:     "rgba(255,193,59,.14)",
    partly:   "rgba(96,165,250,.14)",
    overcast: "rgba(186,199,219,.12)",
    evening:  "rgba(186,199,219,.10)",
  };

  const weatherSwatchColors = {
    night: "#c5d0df", peak: "#f6c842", partly: "#5b9cf5",
    overcast: "#bdc7d7", evening: "#c5d0df",
  };

  const weatherEmoji = {
    night: "☁️", peak: "☀️", partly: "⛅", overcast: "☁️", evening: "🌙",
  };

  function generateData(seed) {
    const rng = seed ?? Math.random() * 100;
    return hours.map(h => {
      const t = (h - 6) / 16;
      const jitter = 1 + .12 * Math.sin(rng + h * .7) * Math.cos(rng * .3 + h);
      const pvRaw  = 8.2 * Math.exp(-Math.pow((h - 12.5) / 3.2, 2));
      const pv     = Math.max(0, pvRaw * (.85 + .15 * Math.sin(h * 1.1)) * jitter);

      let evPv = 0;
      if (h >= 10 && h <= 18) {
        evPv = 5.5 * Math.exp(-Math.pow((h - 13) / 2.8, 2)) * jitter;
        if (h >= 16) evPv *= .25;
      }

      const hh = (1.8 + .5 * Math.sin(t * Math.PI * 2.4) + .3 * Math.cos(t * Math.PI)) * (1 + .08 * Math.sin(rng + h));

      return {
        hour: h,
        pvProduction: +pv.toFixed(2),
        evChargePV:   +Math.max(0, evPv).toFixed(2),
        evChargeGrid: 0,
        household:    +hh.toFixed(2),
      };
    });
  }

  let data = generateData(42);

  const SERIES = [
    { key: "pvProduction", label: "PV production",          shortLabel: "PV production",  color: "#c8a44e", fill: "rgba(200,164,78,.32)",  patId: "pat-diag",  patternLabel: "Diagonal /",  depth: 0 },
    { key: "evChargePV",   label: "EV charge (PV power)",   shortLabel: "EV charge (PV …",color: "#3aaa5b", fill: "rgba(58,170,91,.28)",   patId: "pat-dots",  patternLabel: "Dots",        depth: 1 },
    { key: "evChargeGrid", label: "EV charge (grid power)", shortLabel: "EV charge (gri…",color: "#8c9aab", fill: "rgba(140,154,171,.22)", patId: "pat-horiz", patternLabel: "Horizontal",  depth: 2 },
    { key: "household",    label: "Household consumption",  shortLabel: "Household con…",  color: "#1d6b3a", fill: "rgba(29,107,58,.28)",   patId: "pat-diagb", patternLabel: "Diagonal \\", depth: 3 },
  ];

  const ANNOTATIONS = [
    { hour: 10, text: "Starts charging", cls: "" },
    { hour: 16, text: "Charging paused", cls: "pause" },
  ];

  /* ── Dimensions ────────────────────────────────────────── */
  const M   = { top: 70, right: 24, bottom: 44, left: 44 };
  const W   = 640;
  const H   = 380;
  const iW  = W - M.left - M.right;
  const iH  = H - M.top  - M.bottom;
  const DX  = 7;
  const DY  = -6;

  /* ── Scales ────────────────────────────────────────────── */
  const xScale = d3.scaleLinear().domain([6, 22]).range([0, iW]);
  const yScale = d3.scaleLinear().domain([0, 10]).range([iH, 0]).nice();

  /* ── Container & SVG ───────────────────────────────────── */
  const container = d3.select("#chart");

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const defs = svg.append("defs");

  /* ── SVG Patterns ──────────────────────────────────────── */
  function pat(id, w, h, bg, fn) {
    const p = defs.append("pattern")
      .attr("id", id).attr("patternUnits", "userSpaceOnUse")
      .attr("width", w).attr("height", h);
    p.append("rect").attr("width", w).attr("height", h).attr("fill", bg);
    fn(p);
  }

  pat("pat-diag", 6, 6, "rgba(200,164,78,.28)", p => {
    p.append("line").attr("x1",0).attr("y1",6).attr("x2",6).attr("y2",0)
     .attr("stroke","rgba(200,164,78,.50)").attr("stroke-width",1);
  });

  pat("pat-dots", 5, 5, "rgba(58,170,91,.22)", p => {
    p.append("circle").attr("cx",2.5).attr("cy",2.5).attr("r",.9)
     .attr("fill","rgba(58,170,91,.55)");
  });

  pat("pat-horiz", 6, 4, "rgba(140,154,171,.15)", p => {
    p.append("line").attr("x1",0).attr("y1",2).attr("x2",6).attr("y2",2)
     .attr("stroke","rgba(140,154,171,.40)").attr("stroke-width",.7);
  });

  pat("pat-diagb", 6, 6, "rgba(29,107,58,.20)", p => {
    p.append("line").attr("x1",0).attr("y1",0).attr("x2",6).attr("y2",6)
     .attr("stroke","rgba(29,107,58,.45)").attr("stroke-width",1);
  });

  /* Glow filter for hover dots */
  const glow = defs.append("filter").attr("id","glow")
    .attr("x","-80%").attr("y","-80%").attr("width","260%").attr("height","260%");
  glow.append("feGaussianBlur").attr("in","SourceGraphic").attr("stdDeviation",3).attr("result","b");
  const merge = glow.append("feMerge");
  merge.append("feMergeNode").attr("in","b");
  merge.append("feMergeNode").attr("in","SourceGraphic");

  /* Clip path for reveal animation */
  const clipRect = defs.append("clipPath").attr("id","reveal-clip")
    .append("rect").attr("x",0).attr("y",-80).attr("width",0).attr("height", H + 80);

  /* ── Main group ────────────────────────────────────────── */
  const g = svg.append("g").attr("transform",`translate(${M.left},${M.top})`);

  /* ── Time-zone bands ───────────────────────────────────── */
  const bands = [];
  let bStart = 6, bType = weatherByHour[6];
  for (let h = 7; h <= 22; h++) {
    const wt = weatherByHour[h] || bType;
    if (wt !== bType || h === 22) {
      bands.push({ s: bStart, e: h, t: bType });
      bStart = h; bType = wt;
    }
  }
  if (bStart < 22) bands.push({ s: bStart, e: 22, t: bType });

  const bandGroup = g.append("g");
  bandGroup.selectAll("rect").data(bands).join("rect")
    .attr("x", d => xScale(d.s)).attr("y", 0)
    .attr("width", d => xScale(d.e) - xScale(d.s))
    .attr("height", iH).attr("rx", 3)
    .attr("fill", d => weatherBandColors[d.t])
    .attr("opacity", 0);

  /* ── Grid + Axes ───────────────────────────────────────── */
  const yAxisG = g.append("g").call(
    d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(d3.format("d"))
  );
  yAxisG.select(".domain").remove();
  yAxisG.selectAll(".tick line").attr("stroke","#e8ecf1").attr("stroke-dasharray","2,3");
  yAxisG.selectAll(".tick text").attr("fill","#94a3b8").attr("font-size",11);

  const xAxisG = g.append("g").attr("transform",`translate(0,${iH})`).call(
    d3.axisBottom(xScale)
      .tickValues(hours.filter(h => h % 2 === 0))
      .tickFormat(h => `${h}:00`)
  );
  xAxisG.select(".domain").attr("stroke","#e8ecf1");
  xAxisG.selectAll(".tick line").remove();
  xAxisG.selectAll(".tick text").attr("fill","#94a3b8").attr("font-size",11).attr("dy",12);

  g.append("text").attr("x",-8).attr("y",-12)
    .attr("fill","#94a3b8").attr("font-size",12).attr("font-weight",600).text("kW");

  /* ── Curve generators ──────────────────────────────────── */
  const curveType = d3.curveCatmullRom.alpha(.5);

  const makeArea = key => d3.area()
    .x(d => xScale(d.hour)).y0(iH).y1(d => yScale(d[key]))
    .curve(curveType);

  const makeLine = key => d3.line()
    .x(d => xScale(d.hour)).y(d => yScale(d[key]))
    .curve(curveType);

  /* ── Draw series (painter's order: back → front) ─────── */
  const seriesGroups = {};
  const areaLayer = g.append("g").attr("clip-path","url(#reveal-clip)");

  SERIES.forEach((s, i) => {
    const ox = (SERIES.length - 1 - i) * DX;
    const oy = (SERIES.length - 1 - i) * DY;

    const sg = areaLayer.append("g").attr("transform",`translate(${ox},${oy})`);

    sg.append("path").datum(data).attr("d", makeArea(s.key))
      .attr("fill", `url(#${s.patId})`);

    sg.append("path").datum(data).attr("d", makeArea(s.key))
      .attr("fill", s.fill);

    sg.append("path").datum(data).attr("d", makeLine(s.key))
      .attr("fill","none").attr("stroke", s.color)
      .attr("stroke-width", 2.2).attr("stroke-linecap","round");

    seriesGroups[s.key] = sg;
  });

  /* ── Reveal animation (clip-rect wipe) ─────────────── */
  clipRect.transition()
    .duration(1400).ease(d3.easeCubicOut)
    .attr("width", W + 80);

  /* ── Stroke dash animation ─────────────────────────────── */
  areaLayer.selectAll("path[stroke]").each(function () {
    const len = this.getTotalLength();
    d3.select(this)
      .attr("stroke-dasharray", len)
      .attr("stroke-dashoffset", len)
      .transition().delay(200).duration(1600).ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);
  });

  /* ── Band fade-in ──────────────────────────────────────── */
  bandGroup.selectAll("rect")
    .transition().delay((_,i) => 200 + i * 100).duration(600)
    .attr("opacity", 1);

  /* ── Weather icons (SVG text) ──────────────────────────── */
  const iconHours = [7, 9, 11, 13, 15, 17, 19];

  iconHours.forEach((h, i) => {
    g.append("text")
      .attr("x", xScale(h)).attr("y", -24)
      .attr("text-anchor","middle").attr("font-size",16)
      .attr("opacity", 0)
      .text(weatherEmoji[weatherByHour[h]])
      .transition().delay(800 + i * 70).duration(500).ease(d3.easeCubicOut)
      .attr("opacity", .55);
  });

  /* "PARTLY CLOUDY" badge */
  const badge = g.append("g").attr("transform",`translate(${xScale(13)},-46)`).attr("opacity",0);
  badge.append("rect").attr("x",-52).attr("y",-11).attr("width",104).attr("height",22)
    .attr("rx",4).attr("fill","#5b9cf5");
  badge.append("text").attr("text-anchor","middle").attr("dy",4)
    .attr("fill","#fff").attr("font-size",9).attr("font-weight",700)
    .attr("letter-spacing",".05em").text("PARTLY CLOUDY");
  badge.transition().delay(1300).duration(500).attr("opacity",1);

  /* ── Annotations (SVG-based for correct scaling) ──────── */
  ANNOTATIONS.forEach((a, idx) => {
    const dp = data.find(d => d.hour === a.hour);
    const ax = xScale(a.hour);
    const topVal = Math.max(dp.pvProduction, dp.evChargePV, dp.household);
    const ay = yScale(topVal) - 22;
    const bg = a.cls === "pause" ? "#fef3cd" : "#e8f5ed";
    const fg = a.cls === "pause" ? "#856404" : "#1d6b3a";

    const ag = g.append("g")
      .attr("transform",`translate(${ax},${ay})`)
      .attr("opacity", 0);

    const textEl = ag.append("text")
      .attr("text-anchor","middle").attr("dy",4)
      .attr("fill", fg).attr("font-size",10.5).attr("font-weight",600)
      .text(a.text);

    const bbox = textEl.node().getBBox();
    const px = 14, py = 6;

    ag.insert("rect","text")
      .attr("x", bbox.x - px).attr("y", bbox.y - py)
      .attr("width", bbox.width + px * 2).attr("height", bbox.height + py * 2)
      .attr("rx", 14).attr("fill", bg);

    /* connector dot */
    ag.append("circle")
      .attr("cy", bbox.height / 2 + py + 6)
      .attr("r", 3).attr("fill", fg).attr("opacity", .4);

    ag.transition().delay(1200 + idx * 250).duration(500)
      .ease(d3.easeBackOut.overshoot(1.4))
      .attr("opacity", 1);
  });

  /* ── Interactive Layer ─────────────────────────────────── */
  const cursorLine = g.append("line")
    .attr("y1",0).attr("y2",iH)
    .attr("stroke","#94a3b8").attr("stroke-width",1)
    .attr("stroke-dasharray","3,3").attr("opacity",0);

  const hoverDots = SERIES.map(s =>
    g.append("circle").attr("r",5)
      .attr("fill",s.color).attr("stroke","#fff").attr("stroke-width",2)
      .attr("filter","url(#glow)").attr("opacity",0)
  );

  /* Tooltip (HTML for rich content) */
  const tipEl = document.createElement("div");
  tipEl.className = "chart-tooltip";
  container.node().appendChild(tipEl);

  function renderTip(d) {
    const wt = weatherByHour[d.hour] || "overcast";
    let h = `<div class="tooltip-header">
      <span class="tooltip-time">\u25CF ${d.hour}:00</span>
      <span class="tooltip-badge">${weatherLabels[wt].toUpperCase()}</span>
    </div>`;
    SERIES.forEach(s => {
      h += `<div class="tooltip-row">
        <span class="tooltip-dot" style="background:${s.color}"></span>
        <span class="tooltip-series-name">${s.shortLabel}</span>
        <span class="tooltip-line" style="background:${s.color}"></span>
        <span class="tooltip-value">${d[s.key].toFixed(1)} kW</span>
      </div>`;
    });
    return h;
  }

  const bisect = d3.bisector(d => d.hour).center;
  let highlighted = null;

  const overlay = g.append("rect")
    .attr("width",iW).attr("height",iH)
    .attr("fill","none").attr("pointer-events","all")
    .style("cursor","crosshair");

  function handlePointer(event) {
    const [mx] = d3.pointer(event, overlay.node());
    const idx = bisect(data, xScale.invert(mx));
    const d = data[idx];
    if (!d) return;

    const cx = xScale(d.hour);

    cursorLine.attr("x1",cx).attr("x2",cx)
      .transition().duration(80).attr("opacity",.5);

    hoverDots.forEach((dot, i) => {
      const s = SERIES[i];
      const ox = (SERIES.length - 1 - i) * DX;
      const oy = (SERIES.length - 1 - i) * DY;
      dot.transition().duration(100).ease(d3.easeCubicOut)
        .attr("cx", cx + ox).attr("cy", yScale(d[s.key]) + oy)
        .attr("opacity", highlighted && highlighted !== s.key ? .12 : 1);
    });

    tipEl.innerHTML = renderTip(d);
    tipEl.classList.add("visible");

    const svgNode = svg.node();
    const svgBB = svgNode.getBoundingClientRect();
    const scale = svgBB.width / W;

    let tx = (M.left + cx) * scale + 18;
    let ty = (M.top + yScale(d.pvProduction)) * scale - 10;

    const tipW = tipEl.offsetWidth;
    const tipH = tipEl.offsetHeight;
    if (tx + tipW > svgBB.width) tx = (M.left + cx) * scale - tipW - 18;
    if (ty + tipH > svgBB.height) ty = svgBB.height - tipH - 8;
    if (ty < 0) ty = 8;

    tipEl.style.left = tx + "px";
    tipEl.style.top  = ty + "px";
  }

  overlay.on("mousemove touchmove", handlePointer);

  overlay.on("mouseleave touchend", () => {
    cursorLine.transition().duration(200).attr("opacity",0);
    hoverDots.forEach(dot => dot.transition().duration(200).attr("opacity",0));
    tipEl.classList.remove("visible");
  });

  /* ── Legend ─────────────────────────────────────────────── */
  const lp = d3.select("#legend");

  SERIES.forEach(s => {
    const item = lp.append("div").attr("class","legend-item").attr("data-key",s.key);

    const sw = item.append("div").attr("class","legend-swatch");
    const swSvg = sw.append("svg").attr("viewBox","0 0 32 32");
    swSvg.append("circle").attr("cx",16).attr("cy",16).attr("r",14).attr("fill",s.fill);
    swSvg.append("circle").attr("cx",16).attr("cy",16).attr("r",14)
      .attr("fill",`url(#${s.patId})`);
    swSvg.append("circle").attr("cx",16).attr("cy",16).attr("r",14)
      .attr("fill","none").attr("stroke",s.color).attr("stroke-width",1.5);

    const lb = item.append("div").attr("class","legend-label");
    lb.append("span").attr("class","legend-label-name").text(s.label);
    lb.append("span").attr("class","legend-label-pattern").text(s.patternLabel);

    item.on("mouseenter", () => setHighlight(s.key));
    item.on("mouseleave", () => setHighlight(null));
  });

  lp.append("hr").attr("class","legend-divider");
  lp.append("div").attr("class","legend-section-title").text("Time Zones");

  const seenTz = new Set();
  Object.values(weatherByHour).forEach(tz => {
    if (seenTz.has(tz)) return;
    seenTz.add(tz);
    const row = lp.append("div").attr("class","tz-item");
    row.append("div").attr("class","tz-swatch").style("background", weatherSwatchColors[tz]);
    row.append("span").attr("class","tz-label").text(weatherLabels[tz]);
  });

  /* ── Highlight ─────────────────────────────────────────── */
  function setHighlight(key) {
    highlighted = key;
    SERIES.forEach(s => {
      const dim = key && key !== s.key;
      seriesGroups[s.key].transition().duration(350).ease(d3.easeCubicOut)
        .style("opacity", dim ? .12 : 1);
      d3.select(`.legend-item[data-key="${s.key}"]`).classed("dimmed", dim);
    });
  }

  /* ── Hover on areas themselves ──────────────────────────── */
  const hitAreas = {};
  SERIES.slice().reverse().forEach(s => {
    const ox = (SERIES.length - 1 - s.depth) * DX;
    const oy = (SERIES.length - 1 - s.depth) * DY;

    const hitArea = areaLayer.append("path")
      .datum(data).attr("d", makeArea(s.key))
      .attr("transform",`translate(${ox},${oy})`)
      .attr("fill","transparent").attr("stroke","none")
      .style("cursor","pointer");

    hitArea.on("mouseenter", () => setHighlight(s.key));
    hitArea.on("mouseleave", () => setHighlight(null));
    hitAreas[s.key] = hitArea;
  });

  /* ── Dynamic data refresh with morphing transitions ───── */
  function refreshData() {
    data = generateData();
    const dur = 900;
    const ease = d3.easeCubicInOut;

    SERIES.forEach(s => {
      const sg = seriesGroups[s.key];
      const paths = sg.selectAll("path").nodes();

      d3.select(paths[0]).datum(data)
        .transition().duration(dur).ease(ease)
        .attr("d", makeArea(s.key));

      d3.select(paths[1]).datum(data)
        .transition().duration(dur).ease(ease)
        .attr("d", makeArea(s.key));

      d3.select(paths[2]).datum(data)
        .transition().duration(dur).ease(ease)
        .attr("d", makeLine(s.key))
        .attr("stroke-dasharray", "none")
        .attr("stroke-dashoffset", 0);

      if (hitAreas[s.key]) {
        hitAreas[s.key].datum(data)
          .transition().duration(dur).ease(ease)
          .attr("d", makeArea(s.key));
      }
    });
  }

  /* Auto-refresh every 6 seconds for a living data feel */
  let autoRefreshId = setInterval(refreshData, 6000);

  /* Pause auto-refresh on hover for uninterrupted exploration */
  overlay.on("mouseenter", () => clearInterval(autoRefreshId));
  overlay.on("mouseleave.autorefresh", () => {
    autoRefreshId = setInterval(refreshData, 6000);
  });

})();
