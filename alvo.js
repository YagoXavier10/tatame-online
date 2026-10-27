// Acerta-alvo: 30 segundos de alvos aparecendo e sumindo. 🥋 vale 10, ⭐ (rápida) vale 25 e 💣 tira 30 e quebra o combo.
// Acertos seguidos aumentam o combo (até ×4). Errar o toque (tocar no vazio) tira 2. Fica mais rápido com o tempo.
(() => {
  const box = document.getElementById("alvo");
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
  const DURACAO = 30000;
  const TIPOS = {
    faixa: { ico: "🥋", pts: 10, vida: [1300, 750] },
    estrela: { ico: "⭐", pts: 25, vida: [800, 480] },
    bomba: { ico: "💣", pts: -30, vida: [1500, 1100] },
  };
  let jogo = null;

  function inicio() {
    box.replaceChildren();
    const rec = store.get("av-recorde", 0);
    const card = el("div", "ex-inicio");
    const go = el("button", "button lt-go", "Começar");
    go.type = "button";
    go.addEventListener("click", jogar);
    card.append(el("span", "ex-ico", "🎯"), el("h2", "", "Acerta-alvo"),
      el("p", "muted", "30 segundos! Toque nos alvos antes de sumirem: 🥋 vale 10 e ⭐ vale 25, mas é rápida. Fuja da 💣, que tira 30 e quebra o combo. Acertos seguidos multiplicam os pontos até ×4. Tocar no vazio tira 2."),
      el("p", "ex-recorde", rec ? `🏆 Seu recorde: ${rec.toLocaleString("pt-BR")} pontos` : "Sem recorde ainda"), go);
    box.append(card);
  }

  function jogar() {
    box.replaceChildren();
    const topo = el("div", "ex-topo");
    const pontos = el("strong", "ex-relogio", "0");
    const combo = el("span", "av-combo", "");
    const tempo = el("span", "muted", "30 s");
    topo.append(pontos, combo, tempo);
    const campo = el("div", "av-campo");
    const barra = el("div", "lt-tempo");
    barra.append(el("i"));
    box.append(topo, barra, campo);
    jogo = { pontos: 0, combo: 0, acertos: 0, erros: 0, t0: performance.now(), vivos: new Set(), ui: { pontos, combo, tempo, campo, barra }, acabou: false, proximo: 0 };
    campo.addEventListener("pointerdown", (e) => {
      if (jogo.acabou) return;
      const a = e.target.closest(".av-alvo");
      if (a) acertar(a);
      else { mudar(-2, e.offsetX, e.offsetY, "erro"); jogo.combo = 0; jogo.erros++; }
    });
    jogo.raf = requestAnimationFrame(passo);
  }

  const resta = () => Math.max(0, DURACAO - (performance.now() - jogo.t0));
  const nivel = () => 1 - resta() / DURACAO; // 0 no começo, 1 no fim

  function passo(agora) {
    if (jogo.acabou) return;
    const r = resta();
    jogo.ui.tempo.textContent = `${Math.ceil(r / 1000)} s`;
    jogo.ui.barra.firstChild.style.transform = `scaleX(${r / DURACAO})`;
    jogo.ui.barra.classList.toggle("urgente", r < 8000);
    if (r <= 0) { fim(); return; }
    if (agora >= jogo.proximo) {
      surgir();
      jogo.proximo = agora + 700 - nivel() * 420 + Math.random() * 250;
    }
    jogo.raf = requestAnimationFrame(passo);
  }

  function surgir() {
    const sorteio = Math.random();
    const tipo = sorteio < 0.18 + nivel() * 0.08 ? "bomba" : sorteio < 0.42 ? "estrela" : "faixa";
    const T = TIPOS[tipo];
    const a = el("button", `av-alvo ${tipo}`, T.ico);
    a.type = "button";
    a.dataset.tipo = tipo;
    a.setAttribute("aria-label", tipo === "bomba" ? "Bomba, não toque" : "Alvo");
    a.style.left = `${5 + Math.random() * 82}%`;
    a.style.top = `${5 + Math.random() * 80}%`;
    const vida = T.vida[0] - (T.vida[0] - T.vida[1]) * nivel();
    a.style.setProperty("--vida", `${vida}ms`);
    jogo.ui.campo.append(a);
    jogo.vivos.add(a);
    a._fim = setTimeout(() => {
      // deixar a faixa ou a estrela sumir quebra o combo
      if (tipo !== "bomba" && jogo && !jogo.acabou) jogo.combo = 0;
      sumir(a);
    }, vida);
  }

  function sumir(a) {
    clearTimeout(a._fim);
    jogo?.vivos.delete(a);
    a.remove();
  }

  function acertar(a) {
    const tipo = a.dataset.tipo;
    const x = a.offsetLeft + a.offsetWidth / 2, y = a.offsetTop;
    sumir(a);
    if (tipo === "bomba") {
      jogo.combo = 0;
      jogo.erros++;
      mudar(TIPOS.bomba.pts, x, y, "erro");
      vibrar(150);
      jogo.ui.campo.classList.remove("treme");
      void jogo.ui.campo.offsetWidth;
      jogo.ui.campo.classList.add("treme");
      return;
    }
    jogo.combo++;
    jogo.acertos++;
    const mult = Math.min(4, 1 + Math.floor(jogo.combo / 5));
    mudar(TIPOS[tipo].pts * mult, x, y, tipo);
    vibrar(10);
  }

  function mudar(pts, x, y, cls) {
    jogo.pontos = Math.max(0, jogo.pontos + pts);
    jogo.ui.pontos.textContent = jogo.pontos.toLocaleString("pt-BR");
    const mult = Math.min(4, 1 + Math.floor(jogo.combo / 5));
    jogo.ui.combo.textContent = jogo.combo >= 5 ? `combo ×${mult}` : "";
    const t = el("span", `av-pop ${cls}`, pts > 0 ? `+${pts}` : String(pts));
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
    jogo.ui.campo.append(t);
    setTimeout(() => t.remove(), 700);
  }

  function fim() {
    jogo.acabou = true;
    cancelAnimationFrame(jogo.raf);
    [...jogo.vivos].forEach(sumir);
    const pontos = jogo.pontos;
    const rec = store.get("av-recorde", 0);
    if (pontos > rec) store.set("av-recorde", pontos);
    vibrar([60, 40, 60]);
    const over = el("div", "ex-fim");
    over.append(el("p", "eyebrow", pontos > rec && pontos > 0 ? "🎉 Novo recorde!" : "Tempo esgotado!"), el("h2", "", `${pontos.toLocaleString("pt-BR")} pontos`),
      el("p", "muted", `${jogo.acertos} acertos e ${jogo.erros} erros. Recorde: ${Math.max(pontos, rec).toLocaleString("pt-BR")}.`));
    if (pontos > 0) {
      const rk = window.cohabRanking?.badge("alvo", Math.max(pontos, rec));
      if (rk) over.append(rk);
    }
    const de = el("button", "button lt-go", "Jogar de novo");
    de.type = "button";
    de.addEventListener("click", jogar);
    over.append(de);
    box.append(over);
  }

  window.__alvo = { estado: () => jogo }; // usado nos testes automáticos
  inicio();
})();
