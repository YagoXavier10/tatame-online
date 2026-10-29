// Página do ranking: pódio e lista de cada jogo, sua posição e o quadro de medalhas somando todos os jogos.
(() => {
  const box = document.getElementById("rp");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const num = (n) => Number(n).toLocaleString("pt-BR");
  const cfg = () => window.siteConfig?.() || {};
  const bloqueado = (nick) => (cfg().nicksBloqueados || []).some((n) => String(nick).toLowerCase().includes(n.trim().toLowerCase()));

  // as abas do ranking dos jogos ligados, com o emoji e a página de cada um
  function abas(R) {
    const jogos = window.SITE?.JOGOS || [];
    return Object.keys(R.GAMES).map((k) => {
      const j = jogos.find((x) => x.ranking.includes(k));
      return { k, nome: R.GAMES[k].name, curto: R.GAMES[k].short, emoji: j?.emoji || "🎮", pagina: j?.pagina || "solo.html", id: j?.id };
    }).filter((a) => !a.id || cfg().jogos?.[a.id]?.ativo !== false);
  }

  function init() {
    const R = window.cohabRanking;
    if (cfg().rankingAtivo === false) {
      box.append(el("p", "rp-vazio", "O ranking está desligado no momento."));
      return;
    }
    const lista = abas(R);
    const pedido = new URLSearchParams(location.search).get("jogo");
    let atual = lista.find((a) => a.k === pedido) || lista[0];
    let modo = new URLSearchParams(location.search).get("ver") === "medalhas" ? "medalhas" : "jogo";

    // ---------- topo: por jogo / medalhas ----------
    const modos = el("div", "rp-modos");
    modos.setAttribute("role", "tablist");
    const bJogo = el("button", "", "🎮 Por jogo"), bMed = el("button", "", "🏅 Quadro de medalhas");
    for (const [b, m] of [[bJogo, "jogo"], [bMed, "medalhas"]]) {
      b.type = "button";
      b.setAttribute("role", "tab");
      b.addEventListener("click", () => { modo = m; endereco(); desenhar(); });
      modos.append(b);
    }
    const status = el("p", "muted rp-status");
    const corpo = el("div", "rp-corpo");
    box.append(modos, status, corpo);

    function endereco() {
      const q = modo === "medalhas" ? "?ver=medalhas" : `?jogo=${atual.k}`;
      history.replaceState(null, "", q);
    }

    function desenhar() {
      bJogo.setAttribute("aria-selected", modo === "jogo");
      bMed.setAttribute("aria-selected", modo === "medalhas");
      corpo.replaceChildren();
      if (modo === "jogo") porJogo(); else medalhas();
    }

    // ---------- por jogo ----------
    function porJogo() {
      const seletor = el("div", "rp-jogos");
      seletor.setAttribute("aria-label", "Escolha o jogo");
      for (const a of lista) {
        const b = el("button", a === atual ? "on" : "");
        b.type = "button";
        b.append(el("span", "rp-jogo-ico", a.emoji), el("span", "", a.curto.replace(/\s*\p{Extended_Pictographic}+\s*$/u, "") || a.nome));
        b.setAttribute("aria-pressed", a === atual);
        b.addEventListener("click", () => { atual = a; endereco(); desenhar(); });
        seletor.append(b);
      }
      const titulo = el("div", "rp-titulo");
      const jogar = el("a", "button rp-jogar", "Jogar →");
      jogar.href = atual.pagina;
      titulo.append(el("h2", "", `${atual.emoji} ${atual.nome}`), jogar);
      const area = el("div", "rp-area");
      area.append(el("p", "muted rp-carregando", "Carregando…"));
      corpo.append(seletor, titulo, area);
      seletor.querySelector(".on")?.scrollIntoView({ inline: "center", block: "nearest" });
      carregarJogo(atual, area);
    }

    async function carregarJogo(a, area) {
      try {
        const [todas, info] = await Promise.all([R.top(a.k, 20), R.info()]);
        if (a !== atual || modo !== "jogo") return;
        status.textContent = info.online ? "Ranking online, igual para todo mundo" : info.problem ? "⚠️ Sem conexão com o ranking online: mostrando só este aparelho" : "Ranking deste aparelho";
        const rows = todas.filter((r) => !bloqueado(r.nick));
        area.replaceChildren();
        if (!rows.length) {
          const v = el("div", "rp-vazio");
          v.append(el("p", "", "Ninguém pontuou ainda."));
          const ir = el("a", "button", "Seja o primeiro →");
          ir.href = a.pagina;
          v.append(ir);
          area.append(v);
          return;
        }
        const unidade = (n) => R.unit(a.k, Number(n));
        // pódio: 2º, 1º, 3º
        const podio = el("ol", "rp-podio");
        [1, 0, 2].forEach((i) => {
          const r = rows[i];
          const li = el("li", `rp-degrau rp-p${i + 1}${r ? "" : " vago"}${r && r.id === info.me ? " me" : ""}`);
          if (r) {
            li.append(el("span", "rp-av", String(r.nick).slice(0, 1).toUpperCase()), el("span", "rp-medalha", ["🥇", "🥈", "🥉"][i]),
              el("strong", "rp-podio-nick", r.nick), el("span", "rp-podio-pts", `${num(r.score)} ${unidade(r.score)}`));
          }
          li.append(el("span", "rp-bloco", `${i + 1}º`));
          podio.append(li);
        });
        area.append(podio);
        if (rows.length > 3) {
          const ol = el("ol", "rp-lista");
          ol.start = 4;
          rows.slice(3).forEach((r, i) => {
            const li = el("li", r.id === info.me ? "me" : "");
            li.append(el("span", "rp-pos", `${i + 4}º`), el("span", "rp-nick", r.nick + (r.id === info.me ? " (você)" : "")), el("span", "rp-pts", `${num(r.score)} ${unidade(r.score)}`));
            ol.append(li);
          });
          area.append(ol);
        }
        // sua posição, mesmo fora do top 20
        if (info.online && R.nick() && !rows.some((r) => r.id === info.me)) {
          const meu = await R.best(a.k).catch(() => null);
          if (meu > 0 && a === atual) {
            const pos = await R.rank(a.k, meu);
            const voce = el("div", "rp-voce");
            voce.append(el("span", "rp-pos", `${pos}º`), el("span", "rp-nick", `${R.nick()} (você)`), el("span", "rp-pts", `${num(meu)} ${unidade(meu)}`));
            area.append(voce);
          }
        } else if (!R.nick()) {
          const dica = el("p", "muted rp-dica");
          dica.append(document.createTextNode("Quer aparecer aqui? "));
          const ir = el("a", "", "Escolha um nickname no menu solo →");
          ir.href = "solo.html#rk-profile";
          dica.append(ir);
          area.append(dica);
        }
      } catch (e) {
        console.warn(e);
        area.replaceChildren(el("p", "rp-vazio", "Não deu para carregar o ranking agora. Tente de novo em instantes."));
      }
    }

    // ---------- quadro de medalhas ----------
    async function medalhas() {
      const area = el("div", "rp-area");
      area.append(el("p", "muted rp-carregando", "Contando as medalhas de todos os jogos…"));
      corpo.append(area);
      const tops = await Promise.all(lista.map((a) => R.top(a.k, 3).then((rows) => ({ a, rows: rows.filter((r) => !bloqueado(r.nick)).slice(0, 3) })).catch(() => ({ a, rows: [] }))));
      if (modo !== "medalhas") return;
      const info = await R.info();
      status.textContent = "Medalhas pelo pódio de cada jogo · o mesmo nickname soma junto";
      // soma por nickname (sem diferenciar maiúsculas)
      const quadro = new Map();
      for (const { a, rows } of tops) {
        rows.forEach((r, i) => {
          const k = String(r.nick).trim().toLowerCase();
          const q = quadro.get(k) || { nick: r.nick, m: [0, 0, 0], jogos: [], me: false };
          q.m[i]++;
          q.jogos.push(`${["🥇", "🥈", "🥉"][i]} ${a.emoji}`);
          if (r.id === info.me) q.me = true;
          quadro.set(k, q);
        });
      }
      const linhas = [...quadro.values()].sort((x, y) => y.m[0] - x.m[0] || y.m[1] - x.m[1] || y.m[2] - x.m[2] || x.nick.localeCompare(y.nick));
      area.replaceChildren();
      if (!linhas.length) { area.append(el("p", "rp-vazio", "Ninguém pontuou ainda.")); return; }
      const tab = el("ol", "rp-quadro");
      linhas.forEach((q, i) => {
        const li = el("li", q.me ? "me" : "");
        const quem = el("div", "rp-quem");
        quem.append(el("strong", "", q.nick), el("small", "muted", q.jogos.join("  ")));
        li.append(el("span", "rp-pos", i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}º`), quem,
          el("span", "rp-m ouro", String(q.m[0])), el("span", "rp-m prata", String(q.m[1])), el("span", "rp-m bronze", String(q.m[2])));
        tab.append(li);
      });
      const cab = el("div", "rp-quadro-cab");
      cab.append(el("span", "", ""), el("span", "", "Jogador"), el("span", "", "🥇"), el("span", "", "🥈"), el("span", "", "🥉"));
      area.append(cab, tab);
      // campeões de cada jogo
      area.append(el("h3", "rp-sub", "👑 Campeões de cada jogo"));
      const grade = el("div", "rp-campeoes");
      for (const { a, rows } of tops) {
        const c = el("button", "rp-campeao");
        c.type = "button";
        c.append(el("span", "rp-jogo-ico", a.emoji), el("small", "muted", a.nome),
          el("strong", "", rows[0] ? rows[0].nick : "—"), el("span", "rp-pts", rows[0] ? `${num(rows[0].score)} ${R.unit(a.k, Number(rows[0].score))}` : "ninguém ainda"));
        c.addEventListener("click", () => { atual = a; modo = "jogo"; endereco(); desenhar(); window.scrollTo({ top: box.offsetTop - 70, behavior: "smooth" }); });
        grade.append(c);
      }
      area.append(grade);
    }

    desenhar();
  }

  if (window.cohabRanking) init();
  else window.addEventListener("cohab-ranking", init, { once: true });
})();
