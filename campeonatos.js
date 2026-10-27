// Lista os próximos campeonatos (data/campeonatos.json) com filtros e contagem regressiva
(() => {
  const box = document.getElementById("events");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const day = (iso) => new Date(iso + "T12:00:00");
  const fmt = (iso, opts) => day(iso).toLocaleDateString("pt-BR", opts);
  const daysTo = (iso) => Math.ceil((day(iso) - new Date()) / 86_400_000);

  let events = [];
  let filter = "all";

  const draw = () => {
    const rows = events.filter((e) =>
      filter === "all" || (filter === "cbjje" && e.cbjje) || (filter === "sp" && e.state === "SP") || (filter === "open" && e.open));
    box.replaceChildren();
    if (!rows.length) {
      box.append(el("p", "muted", "Nenhum campeonato com esse filtro agora."));
      return;
    }
    rows.forEach((e) => {
      const a = el("a", "event");
      a.href = e.url;
      a.target = "_blank";
      a.rel = "noopener";
      const date = el("div", "event-date");
      date.append(el("strong", "", fmt(e.first_day, { day: "2-digit" })), el("span", "", fmt(e.first_day, { month: "short" }).replace(".", "")));
      const main = el("div", "event-main");
      const when = e.first_day === e.last_day
        ? fmt(e.first_day, { weekday: "long", day: "numeric", month: "long" })
        : `${fmt(e.first_day, { day: "numeric", month: "long" })} a ${fmt(e.last_day, { day: "numeric", month: "long" })}`;
      main.append(el("strong", "", e.name), el("span", "", `${when} · ${[e.city, e.state].filter(Boolean).join(" - ") || "local a definir"}`));
      const tags = el("div", "event-tags");
      const d = daysTo(e.first_day);
      tags.append(el("span", "tier", d <= 0 ? "acontecendo" : d === 1 ? "amanhã" : `em ${d} dias`));
      tags.append(el("span", `tier ${e.open ? "is-open" : ""}`, e.open ? "inscrições abertas" : "em breve"));
      if (e.cbjje) tags.append(el("span", "tier", "CBJJE"));
      a.append(date, main, tags);
      box.append(a);
    });
  };

  document.getElementById("ev-filter").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    document.querySelectorAll("#ev-filter button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    filter = b.dataset.v;
    draw();
  });

  fetch("data/campeonatos.json", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => { events = d.events; draw(); })
    .catch(() => { box.textContent = "Não foi possível carregar os campeonatos agora."; });
})();
