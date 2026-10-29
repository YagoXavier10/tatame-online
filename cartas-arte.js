// Luta de cartas: os desenhos. Dois lutadores de traço grosso em SVG, um esqueleto de juntas por posição.
// Você é o kimono azul; o rival, o branco. A troca de posição anima as juntas de uma pose para a outra.
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const W = 320;
  // juntas: h cabeça, n ombros, p quadril, e/w cotovelo e mão, k/f joelho e pé. "1" é o lado da frente, "2" o de trás.
  const J = (h, n, p, e1, w1, e2, w2, k1, f1, k2, f2) => ({ h, n, p, e1, w1, e2, w2, k1, f1, k2, f2 });
  // em pé: quem está à esquerda, olhando para a direita
  const EMPE = J([118, 50], [120, 64], [116, 102], [138, 76], [156, 70], [134, 86], [152, 84], [130, 124], [138, 150], [104, 126], [96, 150]);
  // no chão: quem está por baixo deitado com a cabeça à esquerda, quem está por cima virado para ele
  const POSES = {
    fechada: {
      baixo: J([64, 138], [80, 140], [134, 140], [104, 122], [150, 100], [100, 128], [146, 108], [168, 112], [198, 120], [164, 118], [194, 128]),
      cima: J([170, 70], [176, 84], [184, 124], [158, 102], [140, 124], [162, 108], [126, 128], [162, 146], [204, 148], [168, 146], [210, 148]),
    },
    aberta: {
      baixo: J([64, 138], [80, 140], [132, 138], [102, 120], [130, 104], [98, 128], [124, 116], [150, 108], [178, 102], [156, 118], [184, 124]),
      cima: J([166, 64], [178, 74], [200, 100], [160, 88], [150, 104], [166, 92], [156, 116], [186, 126], [184, 150], [212, 124], [214, 150]),
    },
    meia: {
      baixo: J([66, 138], [82, 140], [136, 140], [92, 124], [110, 112], [96, 130], [118, 124], [160, 126], [184, 136], [158, 132], [186, 142]),
      cima: J([92, 114], [106, 120], [160, 114], [90, 136], [76, 146], [118, 134], [100, 140], [176, 138], [196, 146], [180, 126], [208, 146]),
    },
    cem: {
      baixo: J([66, 138], [82, 140], [136, 140], [96, 122], [108, 110], [92, 128], [102, 118], [164, 128], [190, 146], [160, 134], [186, 148]),
      cima: J([74, 122], [90, 122], [140, 102], [74, 138], [60, 146], [118, 128], [134, 138], [158, 146], [194, 148], [166, 140], [204, 148]),
    },
    montada: {
      baixo: J([66, 138], [82, 140], [136, 140], [94, 120], [106, 100], [90, 126], [100, 108], [164, 134], [194, 146], [160, 138], [190, 148]),
      cima: J([112, 74], [114, 89], [118, 128], [100, 102], [88, 132], [104, 104], [94, 136], [94, 144], [140, 146], [98, 142], [146, 146]),
    },
    costas: {
      baixo: J([184, 84], [176, 98], [168, 138], [194, 110], [188, 96], [196, 116], [186, 100], [204, 126], [232, 146], [208, 132], [236, 148]),
      cima: J([166, 80], [160, 100], [146, 140], [188, 98], [174, 90], [154, 80], [170, 76], [186, 122], [200, 134], [182, 128], [196, 140]),
    },
  };
  const espelho = (j) => Object.fromEntries(Object.entries(j).map(([k, [x, y]]) => [k, [W - x, y]]));

  // onde cada lutador fica, para a posição e quem está por cima
  function juntas(pos, cima) {
    if (pos === "empe") return { eu: EMPE, ia: espelho(EMPE), frente: "ia" };
    const P = POSES[pos];
    const vira = cima === "ia";
    const top = vira ? espelho(P.cima) : P.cima, bot = vira ? espelho(P.baixo) : P.baixo;
    // quem está por cima fica na frente do desenho (nas costas, os ganchos e o braço no pescoço aparecem)
    const frente = cima;
    return cima === "eu" ? { eu: top, ia: bot, frente } : { eu: bot, ia: top, frente };
  }

  const CORES = {
    eu: { gi: "#2f62d8", giFundo: "#1d45a8", pele: "#c98b5a", faixa: "#111" },
    ia: { gi: "#f4f4f4", giFundo: "#c7c7cc", pele: "#e3b48c", faixa: "#6a2fb3" },
  };
  const svg = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  };
  // partes na ordem de desenho: braço e perna de trás, tronco, perna e braço da frente
  const PARTES = [["n", "e2", "w2", 9, "giFundo"], ["p", "k2", "f2", 10, "giFundo"], ["n", "p", null, 17, "gi"], ["p", "k1", "f1", 10, "gi"], ["n", "e1", "w1", 9, "gi"]];

  function lutador(quem) {
    const c = CORES[quem];
    const g = svg("g", { class: `ct-lutador ${quem}` });
    const partes = PARTES.map(([, , , larg, cor]) => {
      const borda = svg("polyline", { fill: "none", stroke: "#0b0b10", "stroke-width": larg + 4, "stroke-linecap": "round", "stroke-linejoin": "round" });
      const pano = svg("polyline", { fill: "none", stroke: c[cor], "stroke-width": larg, "stroke-linecap": "round", "stroke-linejoin": "round" });
      g.append(borda, pano);
      return [borda, pano];
    });
    const faixa = svg("circle", { r: 5.5, fill: c.faixa, stroke: "#0b0b10", "stroke-width": 2 });
    const cabeca = svg("circle", { r: 10.5, fill: c.pele, stroke: "#0b0b10", "stroke-width": 3 });
    g.append(faixa, cabeca);
    return {
      g,
      pintar(j) {
        PARTES.forEach(([a, b, d], i) => {
          const pts = [j[a], j[b], d && j[d]].filter(Boolean).map((p) => p.join(",")).join(" ");
          partes[i][0].setAttribute("points", pts);
          partes[i][1].setAttribute("points", pts);
        });
        faixa.setAttribute("cx", j.p[0]); faixa.setAttribute("cy", j.p[1]);
        cabeca.setAttribute("cx", j.h[0]); cabeca.setAttribute("cy", j.h[1]);
      },
    };
  }

  function tatameFundo(alvo) {
    const defs = svg("defs");
    const grad = svg("linearGradient", { id: "ct-chao", x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(svg("stop", { offset: 0, "stop-color": "#2a5d3c" }), svg("stop", { offset: 1, "stop-color": "#173a25" }));
    defs.append(grad);
    alvo.append(defs,
      // o chão passa das bordas para cobrir a largura toda em telas largas
      svg("rect", { x: -400, y: 148, width: W + 800, height: 30, fill: "url(#ct-chao)" }),
      svg("rect", { x: -400, y: 146, width: W + 800, height: 4, fill: "#b3121b" }),
      svg("ellipse", { class: "ct-sombra", cx: 150, cy: 151, rx: 90, ry: 5, fill: "#0006" }));
  }

  const suave = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const mistura = (a, b, t) => Object.fromEntries(Object.keys(a).map((k) => [k, [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t]]));

  // a cena grande do tatame, que anima de uma posição para a outra
  function cena(alvo) {
    const raiz = svg("svg", { viewBox: "20 30 280 140", class: "ct-cena", role: "img" });
    tatameFundo(raiz);
    const L = { eu: lutador("eu"), ia: lutador("ia") };
    raiz.append(L.ia.g, L.eu.g);
    alvo.append(raiz);
    let atual = null, raf;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return {
      el: raiz,
      ir(pos, cima, rotulo) {
        const destino = juntas(pos, cima);
        raiz.setAttribute("aria-label", rotulo || pos);
        raiz.append(L[destino.frente].g); // quem fica na frente vai por último
        const sombra = raiz.querySelector(".ct-sombra");
        const xs = [...Object.values(destino.eu), ...Object.values(destino.ia)].map((p) => p[0]);
        sombra.setAttribute("cx", (Math.min(...xs) + Math.max(...xs)) / 2);
        sombra.setAttribute("rx", (Math.max(...xs) - Math.min(...xs)) / 2 + 10);
        cancelAnimationFrame(raf);
        if (!atual || reduz) {
          atual = destino;
          L.eu.pintar(destino.eu); L.ia.pintar(destino.ia);
          return;
        }
        const de = { eu: atual.eu, ia: atual.ia }, t0 = performance.now(), dur = 520;
        // no meio do caminho os dois "saltam" um pouco, como numa raspagem
        const passo = (agora) => {
          const t = Math.min(1, (agora - t0) / dur), k = suave(t), pulo = Math.sin(t * Math.PI) * 10;
          for (const q of ["eu", "ia"]) {
            const j = mistura(de[q], destino[q], k);
            for (const key in j) j[key][1] -= pulo;
            L[q].pintar(j);
          }
          if (t < 1) raf = requestAnimationFrame(passo);
        };
        atual = destino;
        raf = requestAnimationFrame(passo);
      },
    };
  }

  // desenho pequeno, parado, para a arte das cartas
  function miniatura(pos, cima, destaque) {
    const raiz = svg("svg", { viewBox: "44 40 232 116", class: "ct-mini-cena", "aria-hidden": "true" });
    raiz.append(svg("rect", { x: 0, y: 147, width: W, height: 20, fill: "#00000022" }));
    const d = juntas(pos, cima);
    const L = { eu: lutador("eu"), ia: lutador("ia") };
    L.eu.pintar(d.eu); L.ia.pintar(d.ia);
    const atras = d.frente === "eu" ? "ia" : "eu";
    raiz.append(L[atras].g, L[d.frente].g);
    // finalização: um anel vermelho na cabeça de quem está sendo finalizado
    if (destaque) {
      const vitima = d[destaque];
      raiz.append(svg("circle", { cx: vitima.h[0], cy: vitima.h[1], r: 17, fill: "none", stroke: "#e5484d", "stroke-width": 4, "stroke-dasharray": "6 4" }));
    }
    return raiz;
  }

  // vitrine do destaque no menu: os lutadores vão trocando de posição sozinhos
  const ROTEIRO = [["empe", null], ["fechada", "ia"], ["meia", "eu"], ["cem", "eu"], ["montada", "eu"], ["costas", "eu"],
    ["empe", null], ["aberta", "eu"], ["cem", "ia"], ["fechada", "eu"]];
  function vitrine(alvo) {
    const c = cena(alvo);
    let i = 0, timer = null;
    c.ir(...ROTEIRO[0], "Dois lutadores trocando de posição");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anda = () => { i = (i + 1) % ROTEIRO.length; c.ir(...ROTEIRO[i], "Dois lutadores trocando de posição"); };
    // só anima quando está na tela
    new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) timer = setInterval(anda, 1500);
    }).observe(alvo);
  }
  document.querySelectorAll("[data-vitrine]").forEach(vitrine);

  window.CartasArte = { POSES, juntas, cena, miniatura, vitrine };
})();
