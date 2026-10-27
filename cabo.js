// Cabo de guerra: dois jogadores no mesmo celular. A tela se divide; cada um toca no seu lado o mais rápido
// que puder e a corda anda para quem toca mais. Quem trouxer o nó até a sua linha vence a rodada. Melhor de 3.
// No computador: tecla A (Azul) e tecla L (Branco). Não precisa de internet.
(() => {
  const box = document.getElementById("cabo");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const vibrar = (p) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate?.(p); } catch { /* sem vibração */ }
  };
  const PASSO = 2.4; // quanto cada toque puxa (a linha de vitória fica em 50)
  let jogo = null;

  function inicio() {
    jogo = null;
    box.replaceChildren();
    const card = el("div", "ex-inicio");
    const go = el("button", "button lt-go", "Começar");
    go.type = "button";
    go.addEventListener("click", () => { jogo = { placar: { azul: 0, branco: 0 }, rodada: 0 }; rodada(); });
    card.append(el("span", "ex-ico", "🪢"), el("h2", "", "Cabo de guerra"),
      el("p", "muted", "Para 2 pessoas no mesmo celular. Deixe o celular deitado na mesa, cada um de um lado. Quando aparecer “PUXA!”, toque no seu lado da tela o mais rápido que puder. Quem trouxer o nó até a sua linha vence a rodada. Melhor de 3."),
      el("p", "muted ex-dica", "No computador: tecla A puxa para o Azul e tecla L puxa para o Branco."), go);
    box.append(card);
  }

  function rodada() {
    jogo.pos = 0; // −50 = Azul vence, +50 = Branco vence
    jogo.toques = { azul: 0, branco: 0 };
    jogo.valendo = false;
    box.replaceChildren();
    const campo = el("div", "cb-campo");
    jogo.lado = {};
    for (const cor of ["branco", "azul"]) {
      const lado = el("div", `cb-lado ${cor}`);
      lado.append(el("strong", "cb-nome", cor === "azul" ? "AZUL" : "BRANCO"), el("span", "cb-pts", "●".repeat(jogo.placar[cor]) + "○".repeat(2 - jogo.placar[cor])), el("span", "cb-toques", "0"));
      lado.addEventListener("pointerdown", (e) => { e.preventDefault(); puxar(cor); });
      jogo.lado[cor] = lado;
      campo.append(lado);
    }
    // corda no meio, na horizontal entre as duas metades
    const corda = el("div", "cb-corda");
    jogo.no = el("span", "cb-no", "🪢");
    corda.append(el("i", "cb-linha azul"), el("i", "cb-linha branco"), jogo.no);
    jogo.aviso = el("div", "cb-aviso", "3");
    campo.append(corda, jogo.aviso);
    box.append(campo, el("p", "muted ex-dica", `Rodada ${jogo.rodada + 1} · Azul ${jogo.placar.azul} × ${jogo.placar.branco} Branco`));
    desenhar();
    // contagem regressiva
    [["3", 0], ["2", 700], ["1", 1400], ["PUXA!", 2100]].forEach(([t, ms]) => setTimeout(() => {
      if (!jogo || !jogo.aviso.isConnected) return;
      jogo.aviso.textContent = t;
      if (t === "PUXA!") { jogo.valendo = true; vibrar(60); setTimeout(() => jogo?.aviso && (jogo.aviso.hidden = true), 500); }
    }, ms));
  }

  function puxar(cor) {
    if (!jogo?.valendo) return;
    jogo.toques[cor]++;
    jogo.pos += cor === "azul" ? -PASSO : PASSO;
    jogo.lado[cor].querySelector(".cb-toques").textContent = String(jogo.toques[cor]);
    jogo.lado[cor].classList.remove("pulso");
    void jogo.lado[cor].offsetWidth;
    jogo.lado[cor].classList.add("pulso");
    desenhar();
    if (Math.abs(jogo.pos) >= 50) venceu(jogo.pos < 0 ? "azul" : "branco");
  }

  // o nó anda de cima (Branco) para baixo (Azul)
  function desenhar() { jogo.no.style.top = `${50 - jogo.pos}%`; }

  function venceu(cor) {
    jogo.valendo = false;
    jogo.placar[cor]++;
    jogo.rodada++;
    vibrar([80, 40, 120]);
    const acabou = jogo.placar[cor] === 2;
    const over = el("div", "ex-fim cb-fim");
    over.append(el("p", "eyebrow", acabou ? "Fim de jogo" : `Rodada ${jogo.rodada}`),
      el("h2", "", `${cor === "azul" ? "🔵 Azul" : "⚪ Branco"} ${acabou ? "venceu o cabo de guerra!" : "venceu a rodada!"}`),
      el("p", "muted", `Placar: Azul ${jogo.placar.azul} × ${jogo.placar.branco} Branco · toques nesta rodada: ${jogo.toques.azul} × ${jogo.toques.branco}`));
    const prox = el("button", "button lt-go", acabou ? "Jogar de novo" : "Próxima rodada");
    prox.type = "button";
    prox.addEventListener("click", () => {
      if (acabou) jogo = { placar: { azul: 0, branco: 0 }, rodada: 0 };
      rodada();
    });
    over.append(prox);
    box.append(over);
  }

  document.addEventListener("keydown", (e) => {
    if (!jogo || e.repeat) return;
    if (e.key === "a" || e.key === "A") puxar("azul");
    if (e.key === "l" || e.key === "L") puxar("branco");
  });

  window.__cabo = { estado: () => jogo, puxar: (c) => puxar(c) }; // usado nos testes automáticos
  inicio();
})();
