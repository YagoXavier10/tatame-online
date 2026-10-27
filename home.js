// Página inicial: números, últimos títulos e próximo campeonato
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const countUp = (node, value) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = value.toLocaleString("pt-BR"); return; }
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - start) / 1200));
      node.textContent = Math.round(value * (1 - Math.pow(1 - p, 3))).toLocaleString("pt-BR");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { node.textContent = value.toLocaleString("pt-BR"); }, 1500);
  };

  Promise.all([
    fetch("data/cohab-conquistas.json").then((r) => r.json()),
    fetch("data/cohab-atletas.json").then((r) => r.json()),
  ]).then(([d, a]) => {
    const fpG = d.fpjj.reduce((n, f) => n + (f.gold || 0), 0);
    const fpS = d.fpjj.reduce((n, f) => n + (f.silver || 0), 0);
    const sm = d.smoothcomp.reduce((n, s) => n + s.gold + s.silver + s.bronze, 0);
    const totals = {
      titles: d.team.filter((t) => t.pos === 1).length,
      podiums: d.team.filter((t) => t.pos <= 3).length + d.fpjj.filter((f) => f.pos <= 3).length,
      medals: a.cbjje.length + d.ibjjf.length + fpG + fpS + sm,
      golds: a.cbjje.filter((m) => m.place === 1).length + d.ibjjf.filter((m) => m.place === 1).length + fpG +
        d.smoothcomp.reduce((n, s) => n + s.gold, 0),
    };
    document.querySelectorAll("[data-count]").forEach((n) => countUp(n, totals[n.dataset.count]));

    const list = document.getElementById("last-titles");
    d.team.filter((t) => t.pos === 1).sort((x, y) => y.year - x.year).slice(0, 4).forEach((t) => {
      const row = el("a", "result");
      row.href = t.url; row.target = "_blank"; row.rel = "noopener";
      const main = el("span", "result-main");
      main.append(el("strong", "", t.event), el("span", "", `${t.year} · ${t.gold} ouros, ${t.silver} pratas, ${t.bronze} bronzes`));
      row.append(el("span", "result-pos p1", "🏆"), main);
      list.append(row);
    });
  }).catch(() => {});

  fetch("data/campeonatos.json").then((r) => r.json()).then((d) => {
    const box = document.getElementById("next-event");
    const e = d.events.find((x) => x.cbjje && x.open) || d.events[0];
    if (!e) { box.append(el("p", "muted", "Nenhum campeonato marcado agora.")); return; }
    const day = new Date(e.first_day + "T12:00:00");
    const days = Math.ceil((day - new Date()) / 86_400_000);
    const a = el("a", "card next-event");
    a.href = e.url; a.target = "_blank"; a.rel = "noopener";
    a.append(
      el("span", "news-tag", days <= 0 ? "acontecendo agora" : `faltam ${days} dias`),
      el("h4", "", e.name),
      el("span", "meta", `${day.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} · ${[e.city, e.state].filter(Boolean).join(" - ")}`),
      el("span", "feature-cta", e.open ? "Inscrições abertas ↗" : "Ver detalhes ↗"),
    );
    box.append(a);
  }).catch(() => {});
})();
