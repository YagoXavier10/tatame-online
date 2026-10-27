// Deslize: quebra-cabeça de deslizar. Toque numa peça da mesma linha ou coluna do espaço vazio para empurrar
// (dá para empurrar várias de uma vez) até ordenar de 1 ao último. 3×3 ou 4×4. Menos jogadas e menos tempo, mais pontos.
(() => {
  const box = document.getElementById("deslize");
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
  // cor das peças por faixa, da branca à preta
  const CORES = ["#f2f2f2", "#9aa0a6", "#f5c542", "#f76b15", "#1a9a5c", "#1f4fbf", "#6a2fb3", "#6b3e1e", "#161616"];
  let jogo = null, timer = null;

  function inicio() {
    clearInterval(timer);
    box.replaceChildren();
    const rec = store.get("dz-recorde", 0);
    const card = el("div", "ex-inicio");
    card.append(el("span", "ex-ico", "🧩"), el("h2", "", "Deslize"),
      el("p", "muted", "Empurre as peças pelo espaço vazio até elas ficarem em ordem, do 1 ao último, com o espaço vazio no fim. Toque numa peça da mesma linha ou coluna do espaço para deslizar (dá para empurrar várias de uma vez). No computador, use as setas."),
      el("p", "ex-recorde", rec ? `🏆 Seu recorde: ${rec.toLocaleString("pt-BR")} pontos` : "Sem recorde ainda"),
      el("p", "ex-escolha", "Escolha o tamanho:"));
    const tamanhos = el("div", "ex-temas");
    [[3, "3×3 · fácil"], [4, "4×4 · difícil (vale mais)"]].forEach(([n, t]) => {
      const b = el("button", "ex-tema", t);
      b.type = "button";
      b.addEventListener("click", () => jogar(n));
      tamanhos.append(b);
    });
    card.append(tamanhos);
    box.append(card);
  }

  const resolvido = (n) => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0];

  function jogar(n) {
    // embaralha fazendo movimentos válidos a partir do resolvido (assim sempre tem solução)
    const pecas = resolvido(n);
    let vazio = n * n - 1, anterior = -1;
    for (let k = 0; k < n * n * 40; k++) {
      const viz = vizinhos(vazio, n).filter((v) => v !== anterior);
      const v = viz[Math.floor(Math.random() * viz.length)];
      [pecas[vazio], pecas[v]] = [pecas[v], pecas[vazio]];
      anterior = vazio;
      vazio = v;
    }
    if (pecas.join() === resolvido(n).join()) return jogar(n);
    jogo = { n, pecas, jogadas: 0, t0: performance.now(), acabou: false };
    box.replaceChildren();
    const topo = el("div", "ex-topo");
    jogo.info = el("span", "muted", "0 jogadas");
    const relogio = el("strong", "ex-relogio", "0:00");
    topo.append(el("span", "lt-sala", `${n}×${n}`), jogo.info, relogio);
    jogo.grade = el("div", "dz-grade");
    jogo.grade.style.setProperty("--n", n);
    jogo.grade.addEventListener("click", (e) => {
      const p = e.target.closest(".dz-peca");
      if (p) tocar(Number(p.dataset.pos));
    });
    const voltar = el("button", "share-btn", "Trocar tamanho");
    voltar.type = "button";
    voltar.addEventListener("click", inicio);
    box.append(topo, jogo.grade, voltar);
    desenhar();
    timer = setInterval(() => {
      const s = Math.floor((performance.now() - jogo.t0) / 1000);
      relogio.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 250);
  }

  function vizinhos(i, n) {
    const l = Math.floor(i / n), c = i % n, r = [];
    if (l > 0) r.push(i - n);
    if (l < n - 1) r.push(i + n);
    if (c > 0) r.push(i - 1);
    if (c < n - 1) r.push(i + 1);
    return r;
  }

  function desenhar() {
    const { n, pecas } = jogo;
    jogo.grade.replaceChildren(...pecas.map((v, i) => {
      if (!v) return el("div", "dz-vazio");
      const p = el("button", "dz-peca", String(v));
      p.type = "button";
      p.dataset.pos = String(i);
      // cada linha do resultado final tem a cor de uma faixa
      const cor = CORES[Math.min(CORES.length - 1, Math.floor((v - 1) / n) * Math.floor(CORES.length / n))];
      p.style.background = cor;
      p.style.color = ["#f2f2f2", "#f5c542", "#9aa0a6"].includes(cor) ? "#111" : "#fff";
      p.classList.toggle("certa", v === i + 1);
      return p;
    }));
  }

  // toca numa peça: se estiver na linha ou coluna do vazio, empurra tudo entre ela e o vazio
  function tocar(i) {
    if (jogo.acabou) return;
    const { n, pecas } = jogo;
    const z = pecas.indexOf(0);
    const [li, ci, lz, cz] = [Math.floor(i / n), i % n, Math.floor(z / n), z % n];
    if (li !== lz && ci !== cz) return;
    const passo = li === lz ? Math.sign(i - z) : Math.sign(i - z) * n;
    for (let k = z; k !== i; k += passo) [pecas[k], pecas[k + passo]] = [pecas[k + passo], pecas[k]];
    jogo.jogadas++;
    jogo.info.textContent = `${jogo.jogadas} ${jogo.jogadas === 1 ? "jogada" : "jogadas"}`;
    desenhar();
    if (pecas.join() === resolvido(n).join()) ganhou();
  }

  function ganhou() {
    jogo.acabou = true;
    clearInterval(timer);
    vibrar([40, 30, 80]);
    const { n, jogadas } = jogo;
    const s = Math.round((performance.now() - jogo.t0) / 1000);
    const pontos = n === 3 ? Math.max(100, 3000 - jogadas * 15 - s * 10) : Math.max(300, 9000 - jogadas * 12 - s * 8);
    const rec = store.get("dz-recorde", 0);
    if (pontos > rec) store.set("dz-recorde", pontos);
    const over = el("div", "ex-fim");
    over.append(el("p", "eyebrow", pontos > rec ? "🎉 Novo recorde!" : "Resolvido!"), el("h2", "", `${pontos.toLocaleString("pt-BR")} pontos`),
      el("p", "muted", `${n}×${n} em ${jogadas} jogadas e ${s} s. Recorde: ${Math.max(pontos, rec).toLocaleString("pt-BR")}.`));
    const rk = window.cohabRanking?.badge("deslize", Math.max(pontos, rec));
    if (rk) over.append(rk);
    const de = el("button", "button lt-go", "Jogar de novo");
    de.type = "button";
    de.addEventListener("click", () => jogar(n));
    over.append(de);
    box.append(over);
  }

  document.addEventListener("keydown", (e) => {
    if (!jogo || jogo.acabou || !jogo.grade?.isConnected) return;
    const { n, pecas } = jogo;
    const z = pecas.indexOf(0), l = Math.floor(z / n), c = z % n;
    // a seta move a peça na direção da seta para dentro do vazio
    const alvo = { ArrowUp: l < n - 1 ? z + n : -1, ArrowDown: l > 0 ? z - n : -1, ArrowLeft: c < n - 1 ? z + 1 : -1, ArrowRight: c > 0 ? z - 1 : -1 }[e.key];
    if (alvo === undefined) return;
    e.preventDefault();
    if (alvo >= 0) tocar(alvo);
  });

  window.__deslize = { estado: () => jogo, tocar: (i) => tocar(i) }; // usado nos testes automáticos
  inicio();
})();
