// Labirinto: cada fase gera um labirinto novo, cada vez maior. Leve o 🥋 até a 🏁.
// Anda com as setas (ou WASD), deslizando o dedo na tela ou pelos botões. Rapidez dá pontos; a soma das 3 fases vai para o ranking.
(() => {
  const box = document.getElementById("labirinto");
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
  const FASES = [9, 13, 17]; // lado do labirinto em casas
  const DIRS = { cima: [0, -1], baixo: [0, 1], esq: [-1, 0], dir: [1, 0] };
  let jogo = null, timer = null, cv, ctx;

  // labirinto perfeito (um caminho só entre duas casas): busca em profundidade com paredes entre as casas
  function gerar(n) {
    // paredes[y][x] = { n, s, l, o } (norte, sul, leste, oeste)
    const p = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ n: true, s: true, l: true, o: true })));
    const visto = Array.from({ length: n }, () => Array(n).fill(false));
    const pilha = [[0, 0]];
    visto[0][0] = true;
    while (pilha.length) {
      const [x, y] = pilha[pilha.length - 1];
      const viz = [[x, y - 1, "n", "s"], [x, y + 1, "s", "n"], [x + 1, y, "l", "o"], [x - 1, y, "o", "l"]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !visto[b][a]);
      if (!viz.length) { pilha.pop(); continue; }
      const [a, b, d1, d2] = viz[Math.floor(Math.random() * viz.length)];
      p[y][x][d1] = false;
      p[b][a][d2] = false;
      visto[b][a] = true;
      pilha.push([a, b]);
    }
    return p;
  }

  function inicio() {
    clearInterval(timer);
    box.replaceChildren();
    const rec = store.get("lb-recorde", 0);
    const card = el("div", "ex-inicio");
    const go = el("button", "button lt-go", "Começar");
    go.type = "button";
    go.addEventListener("click", () => { jogo = { fase: 0, total: 0 }; fase(); });
    card.append(el("span", "ex-ico", "🌀"), el("h2", "", "Labirinto"),
      el("p", "muted", "Leve o 🥋 até a 🏁. São 3 labirintos, cada um maior que o outro, e cada partida tem labirintos novos. Use as setas (ou W A S D), deslize o dedo na tela ou toque nos botões. Quanto mais rápido, mais pontos."),
      el("p", "ex-recorde", rec ? `🏆 Seu recorde: ${rec.toLocaleString("pt-BR")} pontos` : "Sem recorde ainda"), go);
    box.append(card);
  }

  function fase() {
    const n = FASES[jogo.fase];
    Object.assign(jogo, { n, mapa: gerar(n), x: 0, y: 0, passos: 0, rastro: new Set(["0,0"]), t0: performance.now(), acabou: false });
    box.replaceChildren();
    const topo = el("div", "ex-topo");
    const relogio = el("strong", "ex-relogio", "0:00");
    topo.append(el("span", "lt-sala", `Fase ${jogo.fase + 1} de ${FASES.length} · ${n}×${n}`), el("span", "muted", `total: ${jogo.total.toLocaleString("pt-BR")}`), relogio);
    cv = el("canvas", "ex-canvas lb-canvas");
    cv.width = 720;
    cv.height = 720;
    cv.setAttribute("aria-label", "Labirinto. Use as setas para andar.");
    ctx = cv.getContext("2d");
    // deslizar o dedo na tela
    let ini = null;
    cv.addEventListener("pointerdown", (e) => { ini = [e.clientX, e.clientY]; });
    cv.addEventListener("pointerup", (e) => {
      if (!ini) return;
      const dx = e.clientX - ini[0], dy = e.clientY - ini[1];
      ini = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      andar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "dir" : "esq") : (dy > 0 ? "baixo" : "cima"), true);
    });
    const pad = el("div", "lb-pad");
    [["cima", "▲"], ["esq", "◀"], ["baixo", "▼"], ["dir", "▶"]].forEach(([d, t]) => {
      const b = el("button", `lb-b ${d}`, t);
      b.type = "button";
      b.setAttribute("aria-label", { cima: "Para cima", baixo: "Para baixo", esq: "Para a esquerda", dir: "Para a direita" }[d]);
      b.addEventListener("click", () => andar(d, false));
      pad.append(b);
    });
    box.append(topo, cv, pad, el("p", "muted ex-dica", "Deslizar o dedo anda até a próxima curva"));
    desenhar();
    timer = setInterval(() => {
      const s = Math.floor((performance.now() - jogo.t0) / 1000);
      relogio.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 250);
  }

  const parede = { cima: "n", baixo: "s", esq: "o", dir: "l" };
  // anda uma casa; "correndo" anda até chegar numa curva ou bifurcação
  function andar(d, correndo) {
    if (!jogo || jogo.acabou) return;
    let andou = 0;
    do {
      if (jogo.mapa[jogo.y][jogo.x][parede[d]]) break;
      jogo.x += DIRS[d][0];
      jogo.y += DIRS[d][1];
      jogo.rastro.add(`${jogo.x},${jogo.y}`);
      andou++;
      if (jogo.x === jogo.n - 1 && jogo.y === jogo.n - 1) break;
      const c = jogo.mapa[jogo.y][jogo.x];
      const saidas = ["n", "s", "l", "o"].filter((k) => !c[k]).length;
      if (correndo && saidas !== 2) break;
    } while (correndo && andou < jogo.n * 2);
    if (!andou) { vibrar(15); return; }
    jogo.passos += andou;
    desenhar();
    if (jogo.x === jogo.n - 1 && jogo.y === jogo.n - 1) chegou();
  }

  function desenhar() {
    const { n, mapa } = jogo;
    const t = 720 / n;
    const escuro = !document.documentElement.dataset.theme ? matchMedia("(prefers-color-scheme: dark)").matches : document.documentElement.dataset.theme === "dark";
    ctx.fillStyle = escuro ? "#16161b" : "#fafaf8";
    ctx.fillRect(0, 0, 720, 720);
    ctx.fillStyle = "#1a9a5c33";
    jogo.rastro.forEach((k) => { const [x, y] = k.split(",").map(Number); ctx.fillRect(x * t + 2, y * t + 2, t - 4, t - 4); });
    ctx.strokeStyle = escuro ? "#ececf1" : "#16161a";
    ctx.lineWidth = Math.max(3, t / 9);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = mapa[y][x], X = x * t, Y = y * t;
      if (c.n) { ctx.moveTo(X, Y); ctx.lineTo(X + t, Y); }
      if (c.o) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + t); }
      if (y === n - 1 && c.s) { ctx.moveTo(X, Y + t); ctx.lineTo(X + t, Y + t); }
      if (x === n - 1 && c.l) { ctx.moveTo(X + t, Y); ctx.lineTo(X + t, Y + t); }
    }
    ctx.stroke();
    ctx.font = `${t * 0.7}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏁", (n - 0.5) * t, (n - 0.5) * t);
    ctx.fillText("🥋", (jogo.x + 0.5) * t, (jogo.y + 0.5) * t);
  }

  function chegou() {
    jogo.acabou = true;
    clearInterval(timer);
    vibrar([40, 30, 80]);
    const s = Math.round((performance.now() - jogo.t0) / 1000);
    const n = jogo.n;
    // cada fase vale mais; perde pontos com o tempo
    const pontos = Math.max(n * 20, n * n * 6 - s * 15);
    jogo.total += pontos;
    const ultima = jogo.fase === FASES.length - 1;
    const over = el("div", "ex-fim");
    over.append(el("p", "eyebrow", `Fase ${jogo.fase + 1} completa!`), el("h2", "", `+${pontos.toLocaleString("pt-BR")} pontos`),
      el("p", "muted", `${s} s e ${jogo.passos} passos. Total: ${jogo.total.toLocaleString("pt-BR")} pontos.`));
    const prox = el("button", "button lt-go", ultima ? "Ver resultado" : "Próximo labirinto →");
    prox.type = "button";
    prox.addEventListener("click", () => { if (ultima) fim(); else { jogo.fase++; fase(); } });
    over.append(prox);
    box.append(over);
    prox.focus();
  }

  function fim() {
    const pontos = jogo.total;
    const rec = store.get("lb-recorde", 0);
    if (pontos > rec) store.set("lb-recorde", pontos);
    box.replaceChildren();
    const card = el("div", "ex-inicio");
    card.append(el("p", "eyebrow", pontos > rec ? "🎉 Novo recorde!" : "Fim de jogo"), el("h2", "", `${pontos.toLocaleString("pt-BR")} pontos`),
      el("p", "muted", `Os 3 labirintos completos. Recorde: ${Math.max(pontos, rec).toLocaleString("pt-BR")}.`));
    const rk = window.cohabRanking?.badge("labirinto", Math.max(pontos, rec));
    if (rk) card.append(rk);
    const de = el("button", "button lt-go", "Jogar de novo");
    de.type = "button";
    de.addEventListener("click", () => { jogo = { fase: 0, total: 0 }; fase(); });
    card.append(de);
    box.append(card);
  }

  document.addEventListener("keydown", (e) => {
    if (!jogo || jogo.acabou || !cv?.isConnected) return;
    const d = { ArrowUp: "cima", ArrowDown: "baixo", ArrowLeft: "esq", ArrowRight: "dir", w: "cima", s: "baixo", a: "esq", d: "dir" }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!d) return;
    e.preventDefault();
    andar(d, false);
  });

  window.__labirinto = { estado: () => jogo, andar: (d, c) => andar(d, c) }; // usado nos testes automáticos
  inicio();
})();
