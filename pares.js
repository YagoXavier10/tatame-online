// Pares: jogo da memória em 3 fases (6, 8 e 10 pares). Vire duas cartas; se forem iguais, ficam abertas.
// Pontos por fase: pares achados, poucas jogadas e rapidez. A soma das 3 fases vai para o ranking.
(() => {
  const box = document.getElementById("pares");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };
  const vibrar = (p) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate?.(p); } catch { /* sem vibração */ }
  };
  const shuffle = (l) => l.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

  const FIGURAS = ["🥋", "🥇", "🦁", "🐯", "🦊", "🐼", "🐸", "🦉", "🐙", "🦄", "🍉", "🍌", "🍇", "🍓", "🍕", "⚽", "🏀", "🎸", "🚀", "⭐", "🌈", "🔥", "💎", "🎈", "🐢", "🦈", "🌵", "🍩", "🎯", "🧩"];
  const FASES = [{ pares: 6, colunas: 4 }, { pares: 8, colunas: 4 }, { pares: 10, colunas: 5 }];
  let jogo = null, timer = null;

  function inicio() {
    clearInterval(timer);
    box.replaceChildren();
    const rec = store.get("pr-recorde", 0);
    const card = el("div", "ex-inicio");
    const go = el("button", "button lt-go", "Começar");
    go.type = "button";
    go.addEventListener("click", () => { jogo = { fase: 0, total: 0 }; fase(); });
    card.append(el("span", "ex-ico", "🃏"), el("h2", "", "Pares"),
      el("p", "muted", "Vire duas cartas por vez. Se forem iguais, ficam abertas; se não, viram de novo, então guarde onde cada figura está. São 3 fases, cada uma com mais cartas. Quanto menos jogadas e mais rápido, mais pontos."),
      el("p", "ex-recorde", rec ? `🏆 Seu recorde: ${rec.toLocaleString("pt-BR")} pontos` : "Sem recorde ainda"), go);
    box.append(card);
  }

  function fase() {
    const { pares, colunas } = FASES[jogo.fase];
    const figs = shuffle(FIGURAS).slice(0, pares);
    const cartas = shuffle([...figs, ...figs]);
    Object.assign(jogo, { cartas, abertas: [], achados: 0, jogadas: 0, travado: false, t0: performance.now() });
    box.replaceChildren();
    const topo = el("div", "ex-topo");
    const info = el("span", "muted", `0 de ${pares} pares · 0 jogadas`);
    const relogio = el("strong", "ex-relogio", "0:00");
    topo.append(el("span", "lt-sala", `Fase ${jogo.fase + 1} de ${FASES.length}`), info, relogio);
    const grade = el("div", "pr-grade");
    grade.style.setProperty("--col", colunas);
    jogo.els = cartas.map((f, i) => {
      const c = el("button", "pr-carta");
      c.type = "button";
      c.setAttribute("aria-label", `Carta ${i + 1}`);
      c.append(el("span", "pr-verso", "?"), el("span", "pr-frente", f));
      c.addEventListener("click", () => virar(i));
      grade.append(c);
      return c;
    });
    jogo.info = info;
    box.append(topo, grade);
    timer = setInterval(() => {
      const s = Math.floor((performance.now() - jogo.t0) / 1000);
      relogio.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 250);
  }

  function virar(i) {
    const c = jogo.els[i];
    if (jogo.travado || c.classList.contains("aberta")) return;
    c.classList.add("aberta");
    c.setAttribute("aria-label", `Carta ${i + 1}: ${jogo.cartas[i]}`);
    jogo.abertas.push(i);
    if (jogo.abertas.length < 2) return;
    jogo.jogadas++;
    const [a, b] = jogo.abertas;
    jogo.abertas = [];
    const { pares } = FASES[jogo.fase];
    if (jogo.cartas[a] === jogo.cartas[b]) {
      jogo.achados++;
      [a, b].forEach((k) => jogo.els[k].classList.add("par"));
      vibrar(20);
      if (jogo.achados === pares) setTimeout(fimFase, 500);
    } else {
      jogo.travado = true;
      setTimeout(() => {
        [a, b].forEach((k) => { jogo.els[k].classList.remove("aberta"); jogo.els[k].setAttribute("aria-label", `Carta ${k + 1}`); });
        jogo.travado = false;
      }, 750);
    }
    jogo.info.textContent = `${jogo.achados} de ${pares} pares · ${jogo.jogadas} ${jogo.jogadas === 1 ? "jogada" : "jogadas"}`;
  }

  function fimFase() {
    clearInterval(timer);
    const { pares } = FASES[jogo.fase];
    const s = Math.round((performance.now() - jogo.t0) / 1000);
    // o mínimo possível de jogadas é o número de pares; cada jogada a mais e cada segundo custam pontos
    const pontos = pares * 100 + Math.max(0, pares * 2 - (jogo.jogadas - pares)) * 30 + Math.max(0, pares * 6 - s) * 10;
    jogo.total += pontos;
    const ultima = jogo.fase === FASES.length - 1;
    const over = el("div", "ex-fim");
    over.append(el("p", "eyebrow", `Fase ${jogo.fase + 1} completa!`), el("h2", "", `+${pontos.toLocaleString("pt-BR")} pontos`),
      el("p", "muted", `${jogo.jogadas} jogadas em ${s} s. Total: ${jogo.total.toLocaleString("pt-BR")} pontos.`));
    const prox = el("button", "button lt-go", ultima ? "Ver resultado" : "Próxima fase →");
    prox.type = "button";
    prox.addEventListener("click", () => { if (ultima) fim(); else { jogo.fase++; fase(); } });
    over.append(prox);
    box.append(over);
    prox.focus();
  }

  function fim() {
    const pontos = jogo.total;
    const rec = store.get("pr-recorde", 0);
    if (pontos > rec) store.set("pr-recorde", pontos);
    box.replaceChildren();
    const card = el("div", "ex-inicio");
    card.append(el("p", "eyebrow", pontos > rec ? "🎉 Novo recorde!" : "Fim de jogo"), el("h2", "", `${pontos.toLocaleString("pt-BR")} pontos`),
      el("p", "muted", `As 3 fases completas. Recorde: ${Math.max(pontos, rec).toLocaleString("pt-BR")}.`));
    const rk = window.cohabRanking?.badge("pares", Math.max(pontos, rec));
    if (rk) card.append(rk);
    const de = el("button", "button lt-go", "Jogar de novo");
    de.type = "button";
    de.addEventListener("click", () => { jogo = { fase: 0, total: 0 }; fase(); });
    card.append(de);
    box.append(card);
  }

  window.__pares = { estado: () => jogo, virar: (i) => virar(i) }; // usado nos testes automáticos
  inicio();
})();
