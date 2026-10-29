// Luta de cartas: a tela do jogo. As regras ficam em cartas-engine.js.
(() => {
  const E = window.CartasEngine;
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
      el("p", "muted", "Pontos da IBJJF: queda e raspagem 2, joelho na barriga 2, passagem 3, montada e costas 4. Quase deu? Vantagem. Finalizou, acabou. 5 minutos de luta."));
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
    s = E.novaLuta();
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
    ui.pos = el("strong", "ct-pos");
    ui.papel = el("span", "ct-papel");
    ui.barra = el("div", "ct-barra");
    ui.marca = el("i");
    ui.barra.append(ui.marca);
    const rotulos = el("div", "ct-barra-rot");
    rotulos.append(el("span", "", "ele domina"), el("span", "", "você domina"));
    ui.tatame.append(ui.pos, ui.papel, ui.barra, rotulos);

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

    box.append(ui.placar, ui.relogio, ui.tatame, ui.msg, ui.vez, ui.mao, ui.acoes, det);
    mensagem(`🤝 Toca as mãos! Você contra ${rival[0]} ${rival[1]}.`, "neutro");
    desenhar();
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

  function cartaEl(id, a) {
    const c = E.CARTAS[id];
    const t = tipoDe(c);
    const b = el("button", `ct-carta t-${t}${a && !a.ok ? " off" : ""}`);
    b.type = "button";
    b.append(el("span", "ct-custo", String(c.custo)));
    if (c.pontos) b.append(el("span", "ct-ganha", `+${c.pontos}`));
    if (c.finaliza) b.append(el("span", "ct-ganha fin", "FIM"));
    b.append(el("span", "ct-arte", c.arte), el("strong", "ct-cnome", c.nome), el("span", "ct-tipo", ROTULO[t]),
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
    ui.relogio.textContent = `⏱️ ${relogio(E.tempo(s))} · round ${s.round}/${E.CONFIG.rounds}`;
    const p = E.papel(s, "eu");
    ui.pos.textContent = E.POSICOES[s.pos].nome;
    if (s.pos !== "empe") ui.pos.append(el("i", "ct-aqui", E.PAPEIS[p].curto));
    ui.papel.textContent = s.pos === "empe" ? "Os dois em pé, brigando pela pegada" : E.PAPEIS[p].nome.replace(/\bdele\b/, `de ${rival[0]}`).replace(/\b[Ee]le\b/, rival[0]);
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
    if (ev.tipo === "carta" && !ev.ok && ev.quem === "eu") { ui.msg.classList.add("treme"); vibrar(60); }
    if (ev.tipo === "carta" && ev.ok && ev.pontos) vibrar(ev.quem === "eu" ? [20, 30, 20] : 80);
  }

  // ---------- jogadas ----------
  async function tocarCarta(b, i, a) {
    if (ocupado || s.vez !== "eu" || s.fim) return;
    if (!a.ok) { mensagem(`🚫 ${E.CARTAS[a.id].nome}: ${a.motivo.toLowerCase()}`, "neutro"); return; }
    ocupado = true;
    b.classList.add("jogada");
    ui.mao.querySelectorAll("button").forEach((x) => { x.disabled = true; });
    await espera(260);
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
    await espera(700);
    // a IA joga uma ação de cada vez, com uma pausa para dar para ver
    for (let n = 0; n < 12 && !s.fim; n++) {
      const ev = E.iaPasso(s, "ia");
      if (!ev) break;
      anotar(ev);
      desenhar();
      await espera(ev.tipo === "carta" ? 1300 : 800);
    }
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
