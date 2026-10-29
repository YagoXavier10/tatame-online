// Luta de cartas: a tela do jogo. As regras ficam em cartas-engine.js.
(() => {
  const E = window.CartasEngine, A = window.CartasArte;
  const box = document.getElementById("cartas");
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
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const espera = (ms) => new Promise((r) => setTimeout(r, reduz ? Math.min(ms, 250) : ms));

  const RIVAIS = [
    ["Tio Pesadão", "🐻"], ["Zé Pegada", "🦍"], ["Mestre Bigorna", "🗿"], ["Dona Chave", "🦂"],
    ["Juca Camarão", "🦐"], ["Kiko Polvo", "🐙"], ["Neném Trator", "🚜"],
  ];
  // cor da borda de cada tipo de carta
  const tipoDe = (c) => c.finaliza ? "fin" : c.tipo === "Queda" ? "queda" : c.tipo === "Raspagem" ? "rasp"
    : c.tipo === "Passagem" ? "pass" : c.pontos ? "dom" : c.de === "todas" ? "def" : "mov";
  const ROTULO = { fin: "Finalização", queda: "Queda", rasp: "Raspagem", pass: "Passagem", dom: "Domínio", def: "Defesa", mov: "Movimento" };
  const relogio = (seg) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, "0")}`;
  const nomeDe = (quem) => (quem === "eu" ? "Você" : rival[0]);

  let s, rival, ocupado = false, ui = {};

  // ---------- telas ----------
  function inicio() {
    box.replaceChildren();
    const vit = store.get("ct-vitorias", 0);
    const card = el("div", "ex-inicio");
    card.append(el("span", "ex-ico", "🎴"), el("h2", "", "Luta de cartas"),
      el("p", "muted", "Jiu-jitsu por turnos. Gaste seus 3 de fôlego ⚡ em cartas: cada uma sai de certas posições e leva a luta para outra. Pegadas ✋ deixam o golpe mais certeiro."),
      el("p", "muted", "Pontos da IBJJF: queda e raspagem 2, joelho na barriga 2, passagem 3, montada e costas 4. Quase deu? Vantagem. Finalizou, acabou."));
    const ponto = el("ul", "ct-regras");
    [["🪢", "Comece em pé: derrube ou puxe pra guarda"], ["🔀", "Por baixo? Raspe ou finalize"], ["🐃", "Por cima? Passe, monte, pegue as costas"], ["🦁", "Finalize ou vença nos pontos"]]
      .forEach(([i, t]) => { const li = el("li"); li.append(el("span", "", i), document.createTextNode(t)); ponto.append(li); });
    card.append(ponto, el("p", "ex-recorde", vit ? `🏆 ${vit} ${vit === 1 ? "vitória" : "vitórias"}` : "Nenhuma vitória ainda"));
    const go = el("button", "button lt-go", "Começar a luta");
    go.type = "button";
    go.addEventListener("click", lutar);
    card.append(go);
    box.append(card);
  }

  function lutar() {
    const ajuste = window.siteConfig?.().cartas || {}; // rounds e dificuldade escolhidos no painel de admin
    s = E.novaLuta({ rounds: Number(ajuste.rounds) || undefined, dificuldade: ajuste.dificuldade });
    rival = RIVAIS[Math.floor(Math.random() * RIVAIS.length)];
    ocupado = false;
    box.replaceChildren();

    ui.placar = el("div", "ct-placar");
    ui.linha = {};
    for (const quem of ["eu", "ia"]) {
      const l = el("div", `ct-lado ${quem}`);
      const nome = el("div", "ct-nome");
      nome.append(el("span", "ct-av", quem === "eu" ? "🥋" : rival[1]), el("strong", "", nomeDe(quem)));
      const rec = el("div", "ct-rec");
      const folego = el("span", "ct-pips folego"), pegada = el("span", "ct-pips pegada");
      folego.title = "Fôlego"; pegada.title = "Pegadas";
      rec.append(folego, pegada);
      const info = el("div", "ct-info");
      info.append(nome, rec);
      const vant = el("span", "ct-vant", "0"), pts = el("span", "ct-pts", "0");
      vant.title = "Vantagens";
      l.append(info, vant, pts);
      ui.placar.append(l);
      ui.linha[quem] = { l, folego, pegada, vant, pts };
    }
    ui.relogio = el("div", "ct-relogio");

    ui.tatame = el("div", "ct-tatame");
    ui.palco = el("div", "ct-palco");
    ui.cena = A.cena(ui.palco);
    ui.fx = el("div", "ct-fx");
    ui.fx.setAttribute("aria-hidden", "true");
    ui.palco.append(ui.fx);
    ui.ultimaPos = null;
    ui.pos = el("strong", "ct-pos");
    ui.papel = el("span", "ct-papel");
    ui.barra = el("div", "ct-barra");
    ui.marca = el("i");
    ui.barra.append(ui.marca);
    const rotulos = el("div", "ct-barra-rot");
    rotulos.append(el("span", "", "ele domina"), el("span", "", "você domina"));
    ui.tatame.append(ui.palco, ui.pos, ui.papel, ui.barra, rotulos);

    ui.msg = el("div", "ct-msg");
    ui.msg.setAttribute("aria-live", "polite");
    ui.vez = el("p", "ct-vez");
    ui.mao = el("div", "ct-mao");
    ui.mao.setAttribute("aria-label", "Suas cartas");

    ui.acoes = el("div", "ct-acoes");
    ui.bPegada = botao("✋ Pegada", "1⚡", () => acao(() => E.pegada(s, "eu")));
    ui.bTrocar = botao("🔄 Trocar mão", "1⚡", () => acao(() => E.trocar(s, "eu")));
    ui.bPassar = botao("Passar a vez", "➜", passar);
    ui.bPassar.classList.add("ct-passar");
    ui.acoes.append(ui.bPegada, ui.bTrocar, ui.bPassar);

    const det = el("details", "ct-log");
    det.append(el("summary", "", "📜 O que aconteceu"));
    ui.log = el("ol");
    det.append(ui.log);

    ui.mapa = el("details", "ct-mapa");
    ui.mapa.open = !window.matchMedia("(max-width: 520px)").matches;
    const sm = el("summary", "", "🗺️ Mapa das posições");
    ui.mapaSvg = el("div", "ct-mapa-svg");
    ui.mapa.append(sm, ui.mapaSvg, el("p", "muted ct-mapa-dica", "As setas mostram para onde as cartas da sua mão levam a luta. Verde: dá para jogar agora."));
    ui.mapa.addEventListener("toggle", () => ui.mapa.open && desenharMapa());

    box.append(ui.placar, ui.relogio, ui.tatame, ui.msg, ui.vez, ui.mao, ui.acoes, ui.mapa, det);
    // quem começa foi sorteado no motor
    const eu = s.vez === "eu";
    mensagem(`🤝 Toca as mãos! Você contra ${rival[0]} ${rival[1]}. 🎲 ${eu ? "Você começa!" : `${rival[0]} começa.`}`, "neutro");
    desenhar();
    if (!eu) { const luta = s; ocupado = true; desenhar(); espera(1400).then(() => vezDaIA(luta)); }
  }

  function botao(texto, extra, fn) {
    const b = el("button", "ct-b");
    b.type = "button";
    b.append(el("span", "", texto), el("small", "", extra));
    b.addEventListener("click", fn);
    return b;
  }

  // ---------- desenho ----------
  function pips(span, n, max, ico) {
    span.replaceChildren();
    for (let i = 0; i < max; i++) span.append(el("i", i < n ? "on" : "", ico));
  }

  // a arte da carta é a posição onde ela deixa a luta (finalização: de onde sai, com o alvo marcado)
  const artes = {};
  function arteDe(id, quem = "eu") {
    const k = id + quem;
    if (!artes[k]) {
      const c = E.CARTAS[id];
      const papel = c.finaliza || c.fica ? c.de[0] : c.de === "todas" ? "empe" : typeof c.para === "string" ? c.para : c.para[c.de[0]];
      const [pos, lado] = papel.split("-");
      const ele = E.outro(quem);
      artes[k] = A.miniatura(pos, pos === "empe" ? null : lado === "cima" ? quem : ele, c.finaliza ? ele : null);
    }
    return artes[k].cloneNode(true);
  }

  function cartaEl(id, a, quem = "eu") {
    const c = E.CARTAS[id];
    const t = tipoDe(c);
    const b = el("button", `ct-carta t-${t}${a && !a.ok ? " off" : ""}`);
    b.type = "button";
    b.append(el("span", "ct-custo", String(c.custo)));
    if (c.pontos) b.append(el("span", "ct-ganha", `+${c.pontos}`));
    if (c.finaliza) b.append(el("span", "ct-ganha fin", "FIM"));
    const arte = el("span", "ct-arte");
    arte.append(arteDe(id, quem), el("span", "ct-emoji", c.arte));
    b.append(arte, el("strong", "ct-cnome", c.nome), el("span", "ct-tipo", ROTULO[t]),
      el("span", "ct-texto", c.texto));
    const de = el("span", "ct-de");
    (c.de === "todas" ? ["Qualquer posição"] : c.de.map((p) => E.PAPEIS[p].curto)).forEach((x) => de.append(el("i", s && x === E.PAPEIS[E.papel(s, "eu")].curto ? "aqui" : "", x)));
    b.append(de);
    const pe = el("span", "ct-pe");
    if (a) pe.append(a.ok ? el("b", "ct-chance", `${a.chance}%`) : el("span", "ct-motivo", a.motivo));
    b.append(pe);
    b.setAttribute("aria-label", `${c.nome}, custa ${c.custo} de fôlego. ${c.texto}${a ? a.ok ? ` Chance ${a.chance}%.` : ` ${a.motivo}.` : ""}`);
    return b;
  }

  function desenhar() {
    for (const quem of ["eu", "ia"]) {
      const l = s.lut[quem], u = ui.linha[quem];
      u.pts.textContent = l.pontos;
      u.vant.textContent = l.vant;
      pips(u.folego, quem === s.vez ? l.folego : 0, E.CONFIG.folego, "⚡");
      pips(u.pegada, l.pegada, E.CONFIG.maxPegada, "✋");
      u.l.classList.toggle("vez", s.vez === quem && !s.fim);
      u.l.classList.toggle("postura", l.postura);
    }
    const resta = s.fim && s.fim.como !== "finalização" ? 0 : E.tempo(s); // acabou o tempo: 0:00
    ui.relogio.textContent = `⏱️ ${relogio(resta)} · round ${s.round}/${s.rounds}`;
    const p = E.papel(s, "eu");
    ui.pos.textContent = E.POSICOES[s.pos].nome;
    if (s.pos !== "empe") ui.pos.append(el("i", "ct-aqui", E.PAPEIS[p].curto));
    ui.papel.textContent = s.pos === "empe" ? "Os dois em pé, brigando pela pegada" : E.PAPEIS[p].nome.replace(/\bdele\b/, `de ${rival[0]}`).replace(/\b[Ee]le\b/, rival[0]);
    const chavePos = s.pos + s.cima;
    if (chavePos !== ui.ultimaPos) {
      ui.cena.ir(s.pos, s.cima, `${E.POSICOES[s.pos].nome}: ${ui.papel.textContent}`);
      ui.ultimaPos = chavePos;
    }
    const v = E.PAPEIS[p].valor; // -9 a 9
    ui.marca.style.left = `${50 + (v / 9) * 46}%`;
    ui.barra.dataset.lado = v > 0 ? "eu" : v < 0 ? "ia" : "";

    const minha = s.vez === "eu" && !s.fim && !ocupado;
    ui.vez.textContent = s.fim ? "" : s.vez === "eu" ? "Sua vez: toque numa carta para jogar" : `Vez de ${rival[0]}…`;
    ui.vez.classList.toggle("dele", s.vez === "ia");
    // as cartas que dá para jogar vêm primeiro
    const mao = s.lut.eu.mao.map((id, i) => ({ id, i, a: E.avaliar(s, "eu", id) }));
    mao.sort((x, y) => (y.a.ok - x.a.ok) || 0);
    // só anima a entrada quando chegam cartas novas
    const chave = s.lut.eu.mao.join();
    ui.mao.classList.toggle("fixa", chave === ui.ultimaMao);
    if (chave !== ui.ultimaMao) ui.mao.scrollLeft = 0;
    ui.ultimaMao = chave;
    ui.mao.replaceChildren(...mao.map(({ id, i, a }) => {
      const b = cartaEl(id, s.vez === "eu" ? a : null);
      if (!minha) b.disabled = true;
      b.addEventListener("click", () => tocarCarta(b, i, a));
      return b;
    }));
    const l = s.lut.eu;
    ui.bPegada.disabled = !minha || l.folego < E.CONFIG.custoPegada || l.pegada >= E.CONFIG.maxPegada;
    ui.bTrocar.disabled = !minha || l.folego < E.CONFIG.custoTrocar || l.trocou;
    ui.bPassar.disabled = !minha;
    if (ui.mapa.open) desenharMapa();
    // sem fôlego e sem jogada: o botão de passar chama atenção
    ui.bPassar.classList.toggle("pulsa", minha && !mao.some((x) => x.a.ok) && ui.bPegada.disabled);
  }

  function mensagem(texto, tipo, carta) {
    ui.msg.replaceChildren();
    ui.msg.className = `ct-msg ${tipo || ""}`;
    if (carta) {
      const mini = el("span", `ct-mini t-${tipoDe(E.CARTAS[carta])}`, E.CARTAS[carta].arte);
      ui.msg.append(mini);
    }
    ui.msg.append(el("span", "", texto));
    void ui.msg.offsetWidth; // recomeça a animação
    ui.msg.classList.add("entra");
  }

  // texto do que aconteceu, para a mensagem e o histórico
  function contar(ev) {
    const quem = nomeDe(ev.quem);
    if (ev.tipo === "pegada") return [`✋ ${quem} ${ev.quem === "eu" ? "pegou" : "pegou"} na gola (${ev.pegada} ${ev.pegada === 1 ? "pegada" : "pegadas"})`, "neutro"];
    if (ev.tipo === "trocar") return [`🔄 ${quem} ${ev.quem === "eu" ? "trocou as cartas" : "mudou o plano de jogo"}`, "neutro"];
    if (ev.tipo !== "carta") return null;
    if (ev.finalizou) return [`🏁 ${ev.nome}! ${quem} ${ev.quem === "eu" ? "finalizou" : "finalizou você"}!`, ev.quem === "eu" ? "bom" : "ruim"];
    const bom = ev.quem === "eu" ? "bom" : "ruim";
    if (ev.ok) {
      const pts = ev.pontos ? ` +${ev.pontos} (${ev.ponto.toLowerCase()})` : "";
      return [`✅ ${quem}: ${ev.nome}${pts}`, ev.pontos || ev.quem === "eu" ? bom : "neutro"];
    }
    return [`❌ ${quem} tentou ${ev.nome} e não deu${ev.vantagem ? ", mas ganhou vantagem" : ""}`, ev.quem === "eu" ? "ruim" : "bom"];
  }

  function anotar(ev) {
    const t = contar(ev);
    if (!t) return;
    const li = el("li", ev.quem);
    li.append(el("time", "", relogio(ev.tempo)), el("span", "", t[0]));
    ui.log.prepend(li);
    mensagem(t[0], t[1], ev.tipo === "carta" ? ev.id : null);
    if (ev.pontos || ev.finalizou) {
      const u = ui.linha[ev.quem].pts;
      u.classList.remove("sobe"); void u.offsetWidth; u.classList.add("sobe");
    }
    if (ev.vantagem) {
      const u = ui.linha[ev.quem].vant;
      u.classList.remove("sobe"); void u.offsetWidth; u.classList.add("sobe");
    }
    if (ev.tipo === "carta") efeito(ev);
    if (ev.tipo === "carta" && !ev.ok && ev.quem === "eu") { ui.msg.classList.add("treme"); vibrar(60); }
    if (ev.tipo === "carta" && ev.ok && ev.pontos) vibrar(ev.quem === "eu" ? [20, 30, 20] : 80);
  }

  // ---------- efeitos ----------
  // a carta sai da mão e voa até o tatame
  async function voar(b) {
    if (reduz || !b.animate) { await espera(120); return; }
    const de = b.getBoundingClientRect(), para = ui.palco.getBoundingClientRect();
    const dx = para.left + para.width / 2 - (de.left + de.width / 2), dy = para.top + para.height / 2 - (de.top + de.height / 2);
    b.style.zIndex = 20;
    await b.animate([
      { transform: "none", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(.8) rotate(-6deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(4deg)`, opacity: 0 },
    ], { duration: 420, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" }).finished;
  }

  // a carta do rival aparece em cima do tatame antes de valer
  async function voarIA(id) {
    const c = cartaEl(id, null, "ia");
    c.classList.add("ct-carta-ia");
    c.dataset.quem = `${rival[1]} ${rival[0]} joga`;
    c.disabled = true;
    ui.tatame.append(c);
    if (reduz || !c.animate) { await espera(500); c.remove(); return; }
    await c.animate([
      { transform: "translate(-50%, -140%) scale(.4) rotate(8deg)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(.72) rotate(-3deg)", opacity: 1, offset: 0.3 },
      { transform: "translate(-50%, -50%) scale(.72) rotate(-3deg)", opacity: 1, offset: 0.8 },
      { transform: "translate(-50%, -40%) scale(.3)", opacity: 0 },
    ], { duration: 1150, easing: "ease-out", fill: "forwards" }).finished;
    c.remove();
  }

  function estoura(grande, pequeno, cls) {
    const b = el("div", `ct-boom ${cls}`);
    b.append(el("strong", "", grande));
    if (pequeno) b.append(el("small", "", pequeno));
    ui.fx.append(b);
    setTimeout(() => b.remove(), 1500);
  }

  function confete() {
    const cores = ["#f5c542", "#1f4fbf", "#e5484d", "#1a9a5c", "#ffffff", "#8b5cf6"];
    for (let i = 0; i < (reduz ? 0 : 36); i++) {
      const c = el("i", "ct-confete");
      c.style.left = `${40 + Math.random() * 20}%`;
      c.style.background = cores[i % cores.length];
      c.style.setProperty("--x", `${(Math.random() - 0.5) * 340}px`);
      c.style.setProperty("--y", `${-80 - Math.random() * 120}px`);
      c.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
      c.style.animationDelay = `${Math.random() * 0.15}s`;
      ui.fx.append(c);
      setTimeout(() => c.remove(), 1800);
    }
  }

  function efeito(ev) {
    const lado = ev.quem === "eu" ? "eu" : "ia";
    const c = E.CARTAS[ev.id];
    if (ev.finalizou) {
      estoura("FINALIZOU!", ev.nome, `${lado} fin`);
      if (ev.quem === "eu") confete();
      sacode("forte");
    } else if (ev.ok && ev.pontos) {
      estoura(`+${ev.pontos}`, ev.ponto, lado);
      sacode(c.tipo === "Queda" ? "forte" : "leve");
    } else if (ev.ok && c.para) {
      sacode("leve");
    } else if (!ev.ok) {
      estoura(ev.vantagem ? "+V" : "✗", ev.vantagem ? "Quase! Vantagem" : "Escapou", `${lado} erro`);
    }
  }

  function sacode(forca) {
    if (reduz) return;
    ui.palco.classList.remove("leve", "forte");
    void ui.palco.offsetWidth;
    ui.palco.classList.add(forca);
  }

  // ---------- mapa das posições ----------
  const NS = "http://www.w3.org/2000/svg";
  const sv = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const COLUNAS = ["empe", "fechada", "aberta", "meia", "cem", "montada", "costas"];
  // no computador o mapa é deitado; no celular, em pé (posições de cima para baixo)
  let mapaEmPe = false;
  const noDe = (papel) => {
    const [pos, lado] = papel.split("-");
    const i = COLUNAS.indexOf(pos), meio = pos === "empe";
    if (mapaEmPe) return { x: meio ? 150 : lado === "cima" ? 226 : 74, y: 26 + i * 54 };
    return { x: 40 + i * 67, y: meio ? 78 : lado === "cima" ? 40 : 116 };
  };

  function desenharMapa() {
    const aqui = E.papel(s, "eu");
    mapaEmPe = ui.mapaSvg.clientWidth < 460;
    const raiz = sv("svg", { viewBox: mapaEmPe ? "0 0 300 400" : "0 0 480 156", class: `ct-mapa-g${mapaEmPe ? " em-pe" : ""}`, role: "img", "aria-label": "Mapa das posições" });
    const defs = sv("defs");
    for (const [id, cor] of [["ct-seta-ok", "#1a9a5c"], ["ct-seta-off", "#8a8a96"]]) {
      const m = sv("marker", { id, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
      m.append(sv("path", { d: "M0,0 L10,5 L0,10 z", fill: cor }));
      defs.append(m);
    }
    raiz.append(defs);
    if (mapaEmPe) raiz.append(sv("text", { x: 74, y: 396, class: "ct-mapa-rot", "text-anchor": "middle" }, "↓ você por baixo"),
      sv("text", { x: 226, y: 396, class: "ct-mapa-rot", "text-anchor": "middle" }, "↑ você por cima"));
    else raiz.append(sv("text", { x: 474, y: 13, class: "ct-mapa-rot", "text-anchor": "end" }, "↑ você por cima"),
      sv("text", { x: 474, y: 152, class: "ct-mapa-rot", "text-anchor": "end" }, "↓ você por baixo"));
    // linhas fracas: todas as passagens possíveis do baralho
    const feitas = new Set();
    for (const c of Object.values(E.CARTAS)) {
      if (c.de === "todas" || c.finaliza || c.fica) continue;
      for (const de of c.de) {
        const para = typeof c.para === "string" ? c.para : c.para[de];
        const k = [de, para].sort().join();
        if (feitas.has(k)) continue;
        feitas.add(k);
        const a = noDe(de), b = noDe(para);
        raiz.append(sv("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "ct-mapa-fundo" }));
      }
    }
    // setas: para onde as cartas da mão levam daqui
    const destinos = {};
    let finaliza = [];
    s.lut.eu.mao.forEach((id) => {
      const c = E.CARTAS[id];
      if (c.de === "todas" || !c.de.includes(aqui)) return;
      const ok = s.vez === "eu" && E.avaliar(s, "eu", id).ok;
      if (c.finaliza) { finaliza.push(c.arte); return; }
      if (c.fica) return;
      const para = typeof c.para === "string" ? c.para : c.para[aqui];
      (destinos[para] ||= { ok: false, artes: [] }).artes.push(c.arte);
      destinos[para].ok ||= ok;
    });
    const setas = sv("g");
    for (const [para, d] of Object.entries(destinos)) {
      const a = noDe(aqui), b = noDe(para);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const cx = mx - ((b.y - a.y) / len) * 22, cy = my + ((b.x - a.x) / len) * 22;
      // para a seta parar na borda da caixa
      const enc = 1 - 30 / len;
      const ex = cx + (b.x - cx) * enc, ey = cy + (b.y - cy) * enc;
      setas.append(sv("path", { d: `M${a.x},${a.y} Q${cx},${cy} ${ex},${ey}`, class: `ct-seta ${d.ok ? "ok" : "off"}`, "marker-end": `url(#ct-seta-${d.ok ? "ok" : "off"})` }));
      const lx = 0.25 * a.x + 0.5 * cx + 0.25 * ex, ly = 0.25 * a.y + 0.5 * cy + 0.25 * ey;
      setas.append(sv("circle", { cx: lx, cy: ly, r: 7 + d.artes.length * 5, class: `ct-seta-bola ${d.ok ? "ok" : ""}` }));
      setas.append(sv("text", { x: lx, y: ly + 4, "text-anchor": "middle", class: "ct-seta-arte" }, d.artes.join("")));
    }
    for (const papel of Object.keys(E.PAPEIS)) {
      const n = noDe(papel);
      const g = sv("g", { class: `ct-no${papel === aqui ? " aqui" : ""}${papel.endsWith("cima") ? " cima" : papel.endsWith("baixo") ? " baixo" : ""}${destinos[papel] ? " alvo" : ""}` });
      g.append(sv("rect", { x: n.x - 31, y: n.y - 14, width: 62, height: 28, rx: 9 }),
        sv("text", { x: n.x, y: n.y + 4, "text-anchor": "middle" }, E.PAPEIS[papel].curto.replace(" ↑", "").replace(" ↓", "")));
      raiz.append(g);
    }
    raiz.append(setas);
    if (finaliza.length) {
      const n = noDe(aqui);
      const pos = mapaEmPe ? { x: n.x + (aqui.endsWith("cima") ? 48 : -48), y: n.y + 4 } : { x: n.x, y: n.y + (aqui.endsWith("baixo") ? 28 : -20) };
      raiz.append(sv("text", { x: pos.x, y: pos.y, "text-anchor": "middle", class: "ct-mapa-fin" }, `🏁${finaliza.join("")}`));
    }
    ui.mapaSvg.replaceChildren(raiz);
  }

  // ---------- jogadas ----------
  async function tocarCarta(b, i, a) {
    if (ocupado || s.vez !== "eu" || s.fim) return;
    if (!a.ok) { mensagem(`🚫 ${E.CARTAS[a.id].nome}: ${a.motivo.toLowerCase()}`, "neutro"); return; }
    ocupado = true;
    ui.mao.querySelectorAll("button").forEach((x) => { x.disabled = true; });
    await voar(b);
    const ev = E.jogar(s, "eu", i);
    anotar(ev);
    ocupado = false;
    desenhar();
    if (s.fim) fim();
  }

  function acao(fn) {
    if (ocupado || s.vez !== "eu") return;
    const ev = fn();
    if (ev.erro) { mensagem(ev.erro, "neutro"); return; }
    anotar(ev);
    desenhar();
  }

  async function passar() {
    if (ocupado || s.vez !== "eu" || s.fim) return;
    ocupado = true;
    E.encerrarVez(s);
    desenhar();
    if (s.fim) { ocupado = false; fim(); return; }
    await espera(700);
    await vezDaIA(s);
  }

  // "luta" é a luta em que o rival ia jogar: se o jogador começou outra no meio, esta para
  async function vezDaIA(luta) {
    if (luta !== s || s.vez !== "ia" || s.fim) return;
    ocupado = true;
    // a IA joga uma ação de cada vez, com uma pausa para dar para ver
    for (let n = 0; n < 12 && !s.fim; n++) {
      const e = E.iaEscolher(s, "ia");
      if (e.acao === "passar") break;
      if (e.acao === "carta") await voarIA(e.id);
      if (luta !== s) return;
      const ev = e.acao === "carta" ? E.jogar(s, "ia", e.i) : e.acao === "pegada" ? E.pegada(s, "ia") : E.trocar(s, "ia");
      if (ev.erro) break;
      anotar(ev);
      desenhar();
      await espera(ev.tipo === "carta" ? 1300 : 800);
    }
    if (luta !== s) return;
    if (!s.fim) E.encerrarVez(s);
    ocupado = false;
    desenhar();
    if (s.fim) { fim(); return; }
    mensagem(`Sua vez! ${relogio(E.tempo(s))} no relógio.`, "neutro");
  }

  function fim() {
    ocupado = true;
    desenhar();
    const f = s.fim;
    const ganhei = f.vencedor === "eu";
    let vit = store.get("ct-vitorias", 0);
    if (ganhei) { vit++; store.set("ct-vitorias", vit); vibrar([40, 60, 40, 60, 120]); } else vibrar(200);
    const e = s.lut.eu, i = s.lut.ia;
    const titulo = f.vencedor === null ? "Empate!" : ganhei ? "Você venceu! 🥇" : `${rival[0]} venceu`;
    const como = f.como === "finalização" ? `por finalização: ${f.detalhe}, faltando ${relogio(E.tempo(s))}`
      : f.como === "pontos" ? `nos pontos, ${Math.max(e.pontos, i.pontos)} a ${Math.min(e.pontos, i.pontos)}`
      : f.como === "vantagens" ? `nas vantagens, ${Math.max(e.vant, i.vant)} a ${Math.min(e.vant, i.vant)} (pontos empatados)`
      : f.como === "decisão" ? "na decisão do árbitro: atacou mais" : "Pontos e vantagens iguais.";
    setTimeout(() => {
      const over = el("div", `ex-fim ct-fim ${ganhei ? "ganhou" : ""}`);
      over.append(el("span", "ex-ico", ganhei ? "🏆" : f.vencedor === null ? "🤝" : rival[1]),
        el("p", "eyebrow", ganhei && f.como === "finalização" ? "Finalizou!" : "Fim de luta"),
        el("h2", "", titulo), el("p", "muted", f.vencedor === null ? como : `${ganhei ? "Venceu" : "Ganhou"} ${como}.`));
      const res = el("p", "ct-resumo");
      res.append(el("span", "", `Você ${e.pontos} pts · ${e.vant} V`), el("span", "", `${rival[0]} ${i.pontos} pts · ${i.vant} V`));
      over.append(res, el("p", "ex-recorde", `🏆 ${vit} ${vit === 1 ? "vitória" : "vitórias"} no total`));
      if (ganhei) {
        const rk = window.cohabRanking?.badge("cartas", vit);
        if (rk) over.append(rk);
      }
      const de = el("button", "button lt-go", "Lutar de novo");
      de.type = "button";
      de.addEventListener("click", lutar);
      over.append(de);
      box.append(over);
      box.scrollIntoView({ block: "start", behavior: reduz ? "auto" : "smooth" });
      de.focus({ preventScroll: true });
    }, 900);
  }

  window.__cartas = { estado: () => s, passar, lutar }; // usado nos testes automáticos
  inicio();
})();
