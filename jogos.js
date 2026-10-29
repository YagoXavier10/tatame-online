// Aba Jogos: nickname do jogador e ranking de cada jogo
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function init() {
    const R = window.cohabRanking;
    const profile = document.getElementById("rk-profile");
    const tabs = document.getElementById("rk-tabs");
    const list = document.getElementById("rk-list");
    const status = document.getElementById("rk-status");
    const wanted = new URLSearchParams(location.search).get("ranking");
    let current = R.GAMES[wanted] ? wanted : "posicoes-relogio";

    // ---------- perfil ----------
    function drawProfile() {
      profile.replaceChildren();
      const nick = R.nick();
      if (!nick) return drawForm("");
      const hello = el("div", "rk-hello");
      const avatar = el("span", "rk-avatar", nick.slice(0, 1).toUpperCase());
      const text = el("div");
      text.append(el("span", "muted", "Jogando como"), el("strong", "", nick));
      // logado como admin: avisa que as pontuações somam em todos os aparelhos
      R.info().then((i) => { if (i.admin) text.append(el("small", "muted", "🔐 Conta de admin: seus recordes somam em todos os aparelhos")); }).catch(() => null);
      const change = el("button", "share-btn", "✏️ Trocar");
      change.type = "button";
      change.setAttribute("aria-label", "Trocar nickname");
      change.addEventListener("click", () => drawForm(nick));
      hello.append(avatar, text, change);
      profile.append(hello);
    }

    function drawForm(value) {
      profile.replaceChildren();
      const form = el("form", "rk-form");
      const title = el("div");
      title.append(el("strong", "", value ? "Trocar nickname" : "🥋 Escolha seu nickname"),
        el("span", "muted", "É o nome que aparece no ranking. Seus recordes deste aparelho entram junto."));
      const row = el("div", "rk-inline-row");
      const input = el("input");
      input.value = value;
      input.maxLength = 16;
      input.placeholder = "Ex.: Yago Faixa Azul";
      input.autocomplete = "nickname";
      input.setAttribute("aria-label", "Seu nickname");
      const save = el("button", "button", "Salvar");
      save.type = "submit";
      row.append(input, save);
      if (value) {
        const cancel = el("button", "share-btn", "Cancelar");
        cancel.type = "button";
        cancel.addEventListener("click", drawProfile);
        row.append(cancel);
      }
      const msg = el("p", "rk-error");
      msg.setAttribute("aria-live", "polite");
      form.append(title, row, msg);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = R.setNick(input.value);
        if (err) { msg.textContent = err; input.focus(); return; }
        drawProfile();
        status.textContent = "Enviando seus recordes…";
        await R.sync();
        drawList();
      });
      profile.append(form);
      if (value) input.select();
    }

    // ---------- ranking ----------
    Object.entries(R.GAMES).forEach(([id, g]) => {
      const b = el("button", "", g.short);
      b.type = "button";
      b.dataset.game = id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-pressed", id === current);
      b.addEventListener("click", () => {
        current = id;
        tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        drawList();
      });
      tabs.append(b);
    });
    // se a aba pedida é de um jogo desligado, abre a primeira que aparece
    const visivel = () => [...tabs.children].find((b) => getComputedStyle(b).display !== "none");
    const atual = tabs.querySelector(`[data-game="${current}"]`);
    if (atual && getComputedStyle(atual).display === "none" && visivel()) {
      current = visivel().dataset.game;
      tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.game === current));
    }

    async function drawList() {
      const g = R.GAMES[current];
      const asked = current;
      list.replaceChildren(el("li", "rk-empty", "Carregando…"));
      try {
        const [todas, { online, me, problem }] = await Promise.all([R.top(current, 20), R.info()]);
        // esconde quem o admin bloqueou no painel
        const bloq = (window.siteConfig?.().nicksBloqueados || []).map((n) => n.trim().toLowerCase());
        const rows = todas.filter((r) => !bloq.some((n) => String(r.nick).toLowerCase().includes(n)));
        if (asked !== current) return;
        status.textContent = online ? `${g.name} · ranking online`
          : problem ? "⚠️ Sem conexão com o ranking online agora. Mostrando só este aparelho." : "Ranking deste aparelho";
        list.replaceChildren();
        if (!rows.length) {
          const empty = el("li", "rk-empty");
          empty.append(document.createTextNode("Ninguém pontuou ainda. "));
          const a = el("a", "", "Seja o primeiro →");
          a.href = { "posicoes-relogio": "posicoes.html", "posicoes-morte": "posicoes.html", regras: "regras.html", arbitro: "arbitro.html", caminho: "caminho.html", quiz: "quiz.html", torre: "torre.html", esquiva: "esquiva.html", palavras: "palavras.html", pares: "pares.html", deslize: "deslize.html", labirinto: "labirinto.html", alvo: "alvo.html", cartas: "cartas.html", luta: "luta.html" }[current];
          empty.append(a);
          list.append(empty);
          return;
        }
        rows.forEach((r, i) => {
          const li = el("li", r.id === me ? "rk-row me" : "rk-row");
          li.append(el("span", "rk-pos", i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}º`),
            el("span", "rk-nick", r.nick + (r.id === me ? " (você)" : "")),
            el("span", "rk-score", `${Number(r.score).toLocaleString("pt-BR")} ${R.unit(current, Number(r.score))}`));
          list.append(li);
        });
        // se você não aparece no top 20, mostra sua posição embaixo
        const mine = R.nick() && !rows.some((r) => r.id === me) ? R.localBests()[current] : 0;
        if (mine > 0 && online) {
          const pos = await R.rank(current, mine);
          if (asked !== current) return;
          const li = el("li", "rk-row me");
          li.append(el("span", "rk-pos", `${pos}º`), el("span", "rk-nick", `${R.nick()} (você)`),
            el("span", "rk-score", `${mine.toLocaleString("pt-BR")} ${R.unit(current, mine)}`));
          list.append(el("li", "rk-gap", "⋯"), li);
        }
      } catch (e) {
        console.warn(e);
        status.textContent = "";
        list.replaceChildren(el("li", "rk-empty", "Não foi possível carregar o ranking agora. Tente de novo em instantes."));
      }
    }

    drawProfile();
    drawList();
    if (wanted && R.GAMES[wanted]) document.getElementById("ranking").scrollIntoView({ block: "start" });
  }

  if (window.cohabRanking) init();
  else window.addEventListener("cohab-ranking", init, { once: true });
})();
