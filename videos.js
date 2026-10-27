// Vídeos de aulas (data/videos.json): filtros, busca e player que só carrega ao clicar
(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ORDER = ["Iniciantes", "Guarda", "Passagem", "Raspagem", "Finalizações", "Quedas", "Defesa e saídas", "Costas e montada", "Dicas e treino"];
  const state = { lang: "all", topic: "all", q: "", limit: 24 };
  let videos = [];

  const chips = (box, key) => box.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    state[key] = b.dataset.v;
    state.limit = 24;
    draw();
  });

  function card(v) {
    const fig = el("figure", "video-card");
    const btn = el("button", "video-thumb");
    btn.type = "button";
    btn.setAttribute("aria-label", `Assistir: ${v.title}`);
    const img = el("img");
    img.src = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
    img.alt = "";
    img.loading = "lazy";
    btn.append(img, el("span", "play", "▶"));
    // o vídeo só carrega quando a pessoa clica (a página fica leve)
    btn.addEventListener("click", () => {
      const frame = el("iframe");
      frame.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1`;
      frame.title = v.title;
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      const wrap = el("div", "video-frame");
      wrap.append(frame);
      btn.replaceWith(wrap);
    });
    const cap = el("figcaption");
    const date = v.published ? new Date(v.published).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
    cap.append(el("strong", "", v.title), el("span", "", `${v.channel} · ${date}`), el("span", "tier", v.topic));
    fig.append(btn, cap);
    return fig;
  }

  function draw() {
    const q = norm(state.q);
    const rows = videos.filter((v) =>
      (state.lang === "all" || v.lang === state.lang) &&
      (state.topic === "all" || v.topic === state.topic) &&
      (!q || norm(`${v.title} ${v.channel} ${v.topic}`).includes(q)));
    $("#v-summary").textContent = rows.length ? `${rows.length} vídeos` : "Nenhum vídeo com esses filtros.";
    const list = $("#v-list");
    list.replaceChildren(...rows.slice(0, state.limit).map(card));
    const more = $("#v-more");
    more.hidden = rows.length <= state.limit;
    more.textContent = `Mostrar mais vídeos (${rows.length - state.limit})`;
  }

  fetch("data/videos.json", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      videos = d.videos;
      $("#v-updated").textContent = `Atualizado em ${new Date(d.updated).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}`;
      const box = $("#v-topic");
      const topics = ORDER.filter((t) => videos.some((v) => v.topic === t));
      [["all", "Todos os assuntos"], ...topics.map((t) => [t, t])].forEach(([v, label], i) => {
        const b = el("button", "", label);
        b.dataset.v = v;
        b.setAttribute("aria-pressed", i === 0);
        box.append(b);
      });
      chips(box, "topic");
      chips($("#v-lang"), "lang");
      $("#v-search").addEventListener("input", (e) => { state.q = e.target.value.trim(); state.limit = 24; draw(); });
      $("#v-more").addEventListener("click", () => { state.limit += 24; draw(); });
      draw();
    })
    .catch(() => { $("#v-summary").textContent = "Não foi possível carregar os vídeos agora."; });
})();
