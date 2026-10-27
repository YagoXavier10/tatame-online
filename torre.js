// Torre de faixas: a faixa desliza de um lado para o outro e você toca para soltar em cima da torre.
// O que passar da borda cai; acertar em cheio ("perfeito") não corta nada e, em sequência, faz a faixa crescer.
(() => {
  const box = document.getElementById("torre");
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

  const W = 360, H = 560, ALT = 26, BASE = 200, PERFEITO = 5;
  // a cor muda a cada 8 andares, da branca à preta (e depois a coral)
  const FAIXAS = [
    ["Branca", "#f2f2f2", "#111"], ["Azul", "#1f4fbf", "#111"], ["Roxa", "#6a2fb3", "#111"],
    ["Marrom", "#6b3e1e", "#111"], ["Preta", "#161616", "#b3121b"], ["Coral", "#b3121b", "#111"],
  ];
  const faixaDo = (andar) => FAIXAS[Math.min(FAIXAS.length - 1, Math.floor(andar / 8))];

  let cv, ctx, raf, jogo;

  function novo() {
    return {
      pilha: [{ x: (W - BASE) / 2, w: BASE }],
      movel: null,
      caindo: [],
      textos: [],
      camera: 0,
      andares: 0,
      combo: 0,
      vivo: true,
      ultimo: performance.now(),
    };
  }

  function proxima() {
    const topo = jogo.pilha[jogo.pilha.length - 1];
    const lado = jogo.andares % 2 === 0 ? -1 : 1;
    const vel = Math.min(560, 150 + jogo.andares * 9);
    jogo.movel = { x: lado < 0 ? -topo.w : W, w: topo.w, dir: -lado, vel };
  }

  function soltar() {
    if (!jogo?.vivo || !jogo.movel) return;
    const topo = jogo.pilha[jogo.pilha.length - 1];
    const m = jogo.movel;
    const y = jogo.pilha.length;
    const esq = Math.max(m.x, topo.x), dir = Math.min(m.x + m.w, topo.x + topo.w);
    const sobra = dir - esq;
    const cor = faixaDo(jogo.andares + 1);
    if (sobra <= 0) {
      jogo.caindo.push({ x: m.x, w: m.w, y, vy: 0, cor });
      jogo.movel = null;
      fim();
      return;
    }
    if (Math.abs(m.x - topo.x) <= PERFEITO) {
      jogo.combo++;
      const cresce = jogo.combo >= 3 ? Math.min(BASE, topo.w + 10) : topo.w;
      const x = topo.x - (cresce - topo.w) / 2;
      jogo.pilha.push({ x: Math.max(0, Math.min(W - cresce, x)), w: cresce });
      jogo.textos.push({ t: jogo.combo >= 2 ? `PERFEITO ×${jogo.combo}` : "PERFEITO!", y, vida: 1 });
      vibrar(25);
    } else {
      jogo.combo = 0;
      jogo.pilha.push({ x: esq, w: sobra });
      // o pedaço que passou da borda cai
      if (m.x < topo.x) jogo.caindo.push({ x: m.x, w: topo.x - m.x, y, vy: 0, cor });
      else jogo.caindo.push({ x: topo.x + topo.w, w: m.x + m.w - (topo.x + topo.w), y, vy: 0, cor });
    }
    jogo.andares++;
    if (jogo.andares % 8 === 0 && jogo.andares <= 40) {
      jogo.textos.push({ t: `Faixa ${faixaDo(jogo.andares)[0].toLowerCase()}!`, y: y + 1.5, vida: 1.6 });
      vibrar([30, 40, 30]);
    }
    proxima();
  }

  // ---------- desenho ----------
  const yTela = (andar) => H - 40 - (andar + 1) * ALT + jogo.camera;

  function faixa(x, y, w, cor) {
    const [, fundo, ponta] = cor;
    ctx.fillStyle = fundo;
    ctx.fillRect(x, y, w, ALT - 2);
    if (fundo === "#f2f2f2") { ctx.strokeStyle = "#cfcfcf"; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, ALT - 3); }
    // ponta da faixa (onde ficam os graus)
    if (w > 40) {
      ctx.fillStyle = ponta;
      ctx.fillRect(x + w - Math.min(36, w * 0.18), y, Math.min(24, w * 0.12), ALT - 2);
    }
  }

  function desenhar(agora) {
    const dt = Math.min(0.05, (agora - jogo.ultimo) / 1000);
    jogo.ultimo = agora;
    // movimento
    const m = jogo.movel;
    if (m) {
      m.x += m.dir * m.vel * dt;
      if (m.x < -m.w * 0.6) { m.x = -m.w * 0.6; m.dir = 1; }
      if (m.x > W - m.w * 0.4) { m.x = W - m.w * 0.4; m.dir = -1; }
    }
    const alvo = Math.max(0, (jogo.pilha.length - 9) * ALT);
    jogo.camera += (alvo - jogo.camera) * Math.min(1, dt * 6);
    jogo.caindo.forEach((p) => { p.vy += 900 * dt; p.y -= (p.vy * dt) / ALT; });
    jogo.caindo = jogo.caindo.filter((p) => yTela(p.y) < H + 50);
    jogo.textos.forEach((t) => { t.vida -= dt * 0.8; });
    jogo.textos = jogo.textos.filter((t) => t.vida > 0);

    // fundo muda com a altura
    const ceu = ctx.createLinearGradient(0, 0, 0, H);
    const k = Math.min(1, jogo.andares / 45);
    ceu.addColorStop(0, `hsl(${220 - k * 200} 45% ${18 + k * 6}%)`);
    ceu.addColorStop(1, "#0d0d10");
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, W, H);
    // chão
    ctx.fillStyle = "#2a2a31";
    ctx.fillRect(0, H - 40 + jogo.camera, W, 40);

    jogo.pilha.forEach((b, i) => {
      const y = yTela(i);
      if (y > -ALT && y < H) faixa(b.x, y, b.w, i === 0 ? ["", "#3a3a42", "#3a3a42"] : faixaDo(i));
    });
    jogo.caindo.forEach((p) => faixa(p.x, yTela(p.y), p.w, p.cor));
    if (m) faixa(m.x, yTela(jogo.pilha.length), m.w, faixaDo(jogo.andares + 1));

    ctx.textAlign = "center";
    jogo.textos.forEach((t) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.vida));
      ctx.fillStyle = "#f5c542";
      ctx.font = '700 22px "Space Grotesk", Inter, sans-serif';
      ctx.fillText(t.t, W / 2, yTela(t.y) - 14 - (1 - t.vida) * 30);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = '700 44px "Space Grotesk", Inter, sans-serif';
    ctx.fillText(String(jogo.andares), W / 2, 62);
    ctx.font = '500 14px Inter, sans-serif';
    ctx.fillStyle = "#ffffffaa";
    ctx.fillText(`faixa ${faixaDo(Math.max(1, jogo.andares)).at(0).toLowerCase()}`, W / 2, 84);

    if (jogo.vivo || jogo.caindo.length) raf = requestAnimationFrame(desenhar);
  }

  // ---------- telas ----------
  function inicio() {
    cancelAnimationFrame(raf);
    box.replaceChildren();
    const rec = store.get("tr-recorde", 0);
    const card = el("div", "ex-inicio");
    card.append(el("span", "ex-ico", "🏗️"), el("h2", "", "Torre de faixas"),
      el("p", "muted", "A faixa desliza de um lado para o outro. Toque (ou aperte espaço) para soltar em cima da torre. O que passar da borda cai e a torre fica mais fina. Acertou em cheio? Perfeito! Três perfeitos seguidos fazem a faixa crescer de novo."),
      el("p", "ex-recorde", rec ? `🏆 Seu recorde: ${rec} ${rec === 1 ? "andar" : "andares"}` : "Sem recorde ainda"));
    const go = el("button", "button lt-go", "Começar");
    go.type = "button";
    go.addEventListener("click", jogar);
    card.append(go);
    box.append(card);
  }

  function jogar() {
    box.replaceChildren();
    cv = el("canvas", "ex-canvas");
    cv.width = W * 2;
    cv.height = H * 2;
    cv.setAttribute("aria-label", "Torre de faixas. Toque para soltar a faixa.");
    ctx = cv.getContext("2d");
    ctx.scale(2, 2);
    box.append(cv, el("p", "muted ex-dica", "Toque na tela ou aperte espaço"));
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); soltar(); });
    jogo = novo();
    proxima();
    raf = requestAnimationFrame(desenhar);
  }

  function fim() {
    jogo.vivo = false;
    vibrar(200);
    const pontos = jogo.andares;
    const rec = store.get("tr-recorde", 0);
    if (pontos > rec) store.set("tr-recorde", pontos);
    setTimeout(() => {
      const over = el("div", "ex-fim");
      over.append(el("p", "eyebrow", pontos > rec && pontos > 0 ? "🎉 Novo recorde!" : "Fim de jogo"),
        el("h2", "", `${pontos} ${pontos === 1 ? "andar" : "andares"}`),
        el("p", "muted", `Chegou na faixa ${faixaDo(Math.max(1, pontos))[0].toLowerCase()}. Recorde: ${Math.max(pontos, rec)}.`));
      if (pontos > 0) {
        const rk = window.cohabRanking?.badge("torre", Math.max(pontos, rec));
        if (rk) over.append(rk);
      }
      const de = el("button", "button lt-go", "Jogar de novo");
      de.type = "button";
      de.addEventListener("click", jogar);
      over.append(de);
      box.append(over);
      de.focus();
    }, 700);
  }

  document.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "Enter") && jogo?.vivo && cv?.isConnected) { e.preventDefault(); soltar(); }
  });

  window.__torre = { estado: () => jogo, soltar: () => soltar() }; // usado nos testes automáticos
  inicio();
})();
