// Esquiva: arraste o dedo (ou use as setas) para desviar do que cai. Estrelas dão pontos e o escudo aguenta uma batida.
// Quanto mais tempo vivo, mais rápido e mais cheio fica: blocos, blocos em zigue-zague e lasers com aviso.
(() => {
  const box = document.getElementById("esquiva");
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
  const rand = (a, b) => a + Math.random() * (b - a);

  const W = 360, H = 560, RAIO = 13;
  let cv, ctx, raf, jogo;
  const teclas = { esq: false, dir: false };

  function novo() {
    return { x: W / 2, alvoX: W / 2, t: 0, pontos: 0, estrelas: 0, coisas: [], brilhos: [], escudo: 0, vivo: true, proxBloco: 0.6, proxExtra: 4, ultimo: performance.now() };
  }

  // dificuldade sobe com o tempo (em segundos)
  const nivel = () => Math.min(1, jogo.t / 90);
  const velQueda = () => 170 + nivel() * 330;

  function criar(dt) {
    jogo.proxBloco -= dt;
    if (jogo.proxBloco <= 0) {
      jogo.proxBloco = Math.max(0.22, 0.75 - nivel() * 0.5) * rand(0.7, 1.3);
      const w = rand(28, 70 + nivel() * 60);
      const zig = jogo.t > 15 && Math.random() < 0.15 + nivel() * 0.25;
      jogo.coisas.push({ tipo: "bloco", x: rand(0, W - w), y: -30, w, h: rand(16, 26), vy: velQueda() * rand(0.85, 1.2), zig, fase: rand(0, 6), amp: rand(40, 90) });
    }
    jogo.proxExtra -= dt;
    if (jogo.proxExtra <= 0) {
      jogo.proxExtra = rand(2.2, 4.5) - nivel() * 1.2;
      const r = Math.random();
      if (jogo.t > 15 && r < 0.45) {
        // laser: avisa a coluna antes de disparar
        const w = rand(40, 70);
        jogo.coisas.push({ tipo: "laser", x: rand(0, W - w), w, aviso: 1.1 - nivel() * 0.35, dura: 0.45 });
      } else if (r < 0.85) {
        jogo.coisas.push({ tipo: "estrela", x: rand(20, W - 20), y: -20, vy: velQueda() * 0.75 });
      } else {
        jogo.coisas.push({ tipo: "escudo", x: rand(20, W - 20), y: -20, vy: velQueda() * 0.7 });
      }
    }
  }

  function bate(c) {
    const py = H - 70, px = jogo.x;
    if (c.tipo === "bloco") {
      const cx = Math.max(c.x, Math.min(px, c.x + c.w)), cy = Math.max(c.y, Math.min(py, c.y + c.h));
      return (px - cx) ** 2 + (py - cy) ** 2 < RAIO ** 2;
    }
    if (c.tipo === "laser") return c.aviso <= 0 && px + RAIO > c.x && px - RAIO < c.x + c.w;
    return (px - c.x) ** 2 + (py - c.y) ** 2 < (RAIO + 14) ** 2;
  }

  function passo(agora) {
    const dt = Math.min(0.04, (agora - jogo.ultimo) / 1000);
    jogo.ultimo = agora;
    if (jogo.vivo) {
      jogo.t += dt;
      jogo.pontos = Math.floor(jogo.t * 10) + jogo.estrelas * 50;
      // movimento: dedo/mouse ou setas
      if (teclas.esq) jogo.alvoX -= 380 * dt;
      if (teclas.dir) jogo.alvoX += 380 * dt;
      jogo.alvoX = Math.max(RAIO, Math.min(W - RAIO, jogo.alvoX));
      jogo.x += (jogo.alvoX - jogo.x) * Math.min(1, dt * 18);
      if (jogo.escudo > 0) jogo.escudo -= dt;
      criar(dt);
      for (const c of jogo.coisas) {
        if (c.tipo === "laser") { if (c.aviso > 0) c.aviso -= dt; else c.dura -= dt; }
        else {
          c.y += c.vy * dt;
          if (c.zig) c.x += Math.cos(jogo.t * 3 + c.fase) * c.amp * dt;
        }
        if (!c.foi && bate(c)) {
          if (c.tipo === "estrela") { c.foi = true; jogo.estrelas++; brilho(c.x, c.y, "#f5c542", "+50"); vibrar(15); }
          else if (c.tipo === "escudo") { c.foi = true; jogo.escudo = 6; brilho(c.x, c.y, "#5ad1ff", "ESCUDO"); vibrar(15); }
          else if (jogo.escudo > 0) { c.foi = true; jogo.escudo = 0; brilho(jogo.x, H - 70, "#5ad1ff", "Ufa!"); vibrar(60); }
          else { perder(); break; }
        }
      }
      jogo.coisas = jogo.coisas.filter((c) => !c.foi && (c.tipo === "laser" ? c.dura > 0 : c.y < H + 40));
    }
    jogo.brilhos.forEach((b) => { b.vida -= dt * 1.4; b.y -= 40 * dt; });
    jogo.brilhos = jogo.brilhos.filter((b) => b.vida > 0);
    desenhar();
    if (jogo.vivo || jogo.brilhos.length) raf = requestAnimationFrame(passo);
  }

  function brilho(x, y, cor, texto) { jogo.brilhos.push({ x, y, cor, texto, vida: 1 }); }

  function desenhar() {
    const k = nivel();
    ctx.fillStyle = `hsl(${230 - k * 220} 30% ${10 + k * 4}%)`;
    ctx.fillRect(0, 0, W, H);
    // linhas de velocidade
    ctx.strokeStyle = "#ffffff10";
    for (let i = 0; i < 6; i++) {
      const y = ((jogo.t * velQueda() * 0.6 + i * 100) % (H + 100)) - 50;
      ctx.beginPath(); ctx.moveTo(i * 67 + 20, y); ctx.lineTo(i * 67 + 20, y + 40); ctx.stroke();
    }
    for (const c of jogo.coisas) {
      if (c.tipo === "bloco") {
        ctx.fillStyle = c.zig ? "#f76b15" : "#e5484d";
        ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 5); ctx.fill();
      } else if (c.tipo === "laser") {
        if (c.aviso > 0) {
          ctx.fillStyle = `rgba(229,72,77,${0.12 + 0.18 * Math.abs(Math.sin(c.aviso * 14))})`;
          ctx.fillRect(c.x, 0, c.w, H);
          ctx.fillStyle = "#e5484d";
          ctx.font = '700 22px "Space Grotesk", Inter, sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("!", c.x + c.w / 2, 40);
        } else {
          ctx.fillStyle = "#ff3b3b";
          ctx.fillRect(c.x, 0, c.w, H);
          ctx.fillStyle = "#fff";
          ctx.fillRect(c.x + c.w / 2 - 3, 0, 6, H);
        }
      } else {
        ctx.font = "26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(c.tipo === "estrela" ? "⭐" : "🛡️", c.x, c.y);
        ctx.textBaseline = "alphabetic";
      }
    }
    // jogador
    const py = H - 70;
    if (jogo.escudo > 0) {
      ctx.strokeStyle = jogo.escudo < 1.5 && Math.floor(jogo.escudo * 8) % 2 ? "#5ad1ff44" : "#5ad1ff";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(jogo.x, py, RAIO + 7, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = jogo.vivo ? "#f2f2f2" : "#777";
    ctx.beginPath(); ctx.arc(jogo.x, py, RAIO, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1f4fbf";
    ctx.fillRect(jogo.x - RAIO, py - 2, RAIO * 2, 5);
    for (const b of jogo.brilhos) {
      ctx.globalAlpha = Math.max(0, b.vida);
      ctx.fillStyle = b.cor;
      ctx.font = '700 16px "Space Grotesk", Inter, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(b.texto, b.x, b.y);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.font = '700 26px "Space Grotesk", Inter, sans-serif';
    ctx.fillText(String(jogo.pontos), 14, 36);
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillStyle = "#ffffffaa";
    ctx.fillText(`⭐ ${jogo.estrelas} · ${Math.floor(jogo.t)} s`, 14, 56);
  }

  // ---------- telas ----------
  function inicio() {
    cancelAnimationFrame(raf);
    box.replaceChildren();
    const rec = store.get("eq-recorde", 0);
    const card = el("div", "ex-inicio");
    card.append(el("span", "ex-ico", "💨"), el("h2", "", "Esquiva"),
      el("p", "muted", "Arraste o dedo na tela (ou use as setas ← →) para desviar dos blocos. Os laranjas fazem zigue-zague e a coluna vermelha avisa antes do laser. Pegue ⭐ para ganhar pontos e 🛡️ para aguentar uma batida. Fica cada vez mais rápido!"),
      el("p", "ex-recorde", rec ? `🏆 Seu recorde: ${rec.toLocaleString("pt-BR")} pontos` : "Sem recorde ainda"));
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
    cv.setAttribute("aria-label", "Esquiva. Arraste o dedo para desviar.");
    ctx = cv.getContext("2d");
    ctx.scale(2, 2);
    box.append(cv, el("p", "muted ex-dica", "Arraste o dedo na tela ou use as setas ← →"));
    const mover = (e) => {
      const r = cv.getBoundingClientRect();
      jogo.alvoX = ((e.clientX - r.left) / r.width) * W;
    };
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* sem captura */ } mover(e); });
    cv.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType !== "mouse") mover(e); });
    jogo = novo();
    raf = requestAnimationFrame(passo);
  }

  function perder() {
    jogo.vivo = false;
    vibrar(250);
    brilho(jogo.x, H - 90, "#e5484d", "PAH!");
    const pontos = jogo.pontos;
    const rec = store.get("eq-recorde", 0);
    if (pontos > rec) store.set("eq-recorde", pontos);
    setTimeout(() => {
      const over = el("div", "ex-fim");
      over.append(el("p", "eyebrow", pontos > rec ? "🎉 Novo recorde!" : "Fim de jogo"),
        el("h2", "", `${pontos.toLocaleString("pt-BR")} pontos`),
        el("p", "muted", `${Math.floor(jogo.t)} segundos vivo e ${jogo.estrelas} ${jogo.estrelas === 1 ? "estrela" : "estrelas"}. Recorde: ${Math.max(pontos, rec).toLocaleString("pt-BR")}.`));
      const rk = window.cohabRanking?.badge("esquiva", Math.max(pontos, rec));
      if (rk) over.append(rk);
      const de = el("button", "button lt-go", "Jogar de novo");
      de.type = "button";
      de.addEventListener("click", jogar);
      over.append(de);
      box.append(over);
      de.focus();
    }, 800);
  }

  document.addEventListener("keydown", (e) => {
    if (!jogo?.vivo || !cv?.isConnected) return;
    if (e.key === "ArrowLeft") { teclas.esq = true; e.preventDefault(); }
    if (e.key === "ArrowRight") { teclas.dir = true; e.preventDefault(); }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") teclas.esq = false;
    if (e.key === "ArrowRight") teclas.dir = false;
  });

  window.__esquiva = { estado: () => jogo }; // usado nos testes automáticos
  inicio();
})();
