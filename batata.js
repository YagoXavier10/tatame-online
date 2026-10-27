// Batata quente: de 2 a 10 pessoas passando o mesmo celular. Aparece um tema; quem está com o celular fala em voz alta
// uma palavra do tema (sem repetir) e toca em "Passar". A batata explode numa hora sorteada (entre 15 e 40 s):
// quem estiver com ela leva uma 🔥. Depois das rodadas, ganha quem se queimou menos. Não precisa de internet.
(() => {
  const box = document.getElementById("batata");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const btn = (cls, text, onClick) => {
    const b = el("button", cls, text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  };
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };
  const vibrar = (p) => { try { navigator.vibrate?.(p); } catch { /* sem vibração */ } };
  const shuffle = (l) => l.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

  const TEMAS = [
    "Uma fruta", "Um animal", "Uma cor", "Um país", "Uma cidade do Brasil", "Uma profissão", "Algo que tem na cozinha",
    "Um esporte", "Um time de futebol", "Uma comida brasileira", "Uma parte do corpo", "Um meio de transporte",
    "Algo que tem na praia", "Um nome de menina", "Um nome de menino", "Uma marca de carro", "Um instrumento musical",
    "Algo que tem na escola", "Um bicho do mar", "Uma posição ou golpe do jiu-jitsu", "Um doce", "Algo que voa",
    "Uma bebida", "Uma palavra que começa com A", "Uma palavra que começa com M", "Algo que tem na academia",
    "Um personagem de desenho", "Um estado do Brasil", "Uma verdura ou legume", "Algo que é redondo",
  ];
  const MIN = 2, MAX = 10;
  let jogo = null, pavio = null;

  function inicio() {
    clearTimeout(pavio);
    box.replaceChildren();
    const nomes = store.get("bt-nomes", ["", "", ""]);
    const card = el("div", "ex-inicio bt-inicio");
    card.append(el("span", "ex-ico", "🥔"), el("h2", "", "Batata quente"),
      el("p", "muted", "Passem o celular de mão em mão. Na sua vez, fale em voz alta uma palavra do tema (sem repetir o que já falaram) e toque em “Passar”. A batata explode numa hora surpresa: quem estiver com ela se queima. Ganha quem se queimar menos."));
    const lista = el("ol", "bt-nomes");
    const linha = (v = "") => {
      const li = el("li");
      const input = el("input", "bt-nome");
      Object.assign(input, { value: v, maxLength: 14, placeholder: "Nome", autocomplete: "off" });
      input.setAttribute("aria-label", "Nome do jogador");
      const tirar = btn("share-btn", "✕", () => { if (lista.children.length > MIN) li.remove(); });
      tirar.setAttribute("aria-label", "Tirar jogador");
      li.append(input, tirar);
      lista.append(li);
    };
    nomes.forEach(linha);
    const mais = btn("share-btn", "+ Jogador", () => { if (lista.children.length < MAX) { linha(); lista.lastChild.querySelector("input").focus(); } });
    const rodadas = el("div", "chips rl-quantos");
    let n = 3;
    [3, 5, 7].forEach((k) => {
      const b = btn("", `${k} rodadas`, () => { n = k; rodadas.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
      b.setAttribute("aria-pressed", k === n);
      rodadas.append(b);
    });
    const erro = el("p", "rk-error");
    const go = btn("button lt-go", "Começar 🥔", () => {
      const ns = [...lista.querySelectorAll("input")].map((i, k) => i.value.trim().replace(/\s+/g, " ") || `Jogador ${k + 1}`)
        // nomes repetidos ganham um número para não confundir ("Caio" e "Caio 2")
        .map((nm, k, todos) => { const antes = todos.slice(0, k).filter((x) => x === nm).length; return antes ? `${nm} ${antes + 1}` : nm; });
      if (ns.length < MIN) { erro.textContent = `Precisa de pelo menos ${MIN} jogadores.`; return; }
      store.set("bt-nomes", ns);
      jogo = { nomes: ns, queimou: ns.map(() => 0), rodada: 0, total: n, temas: shuffle(TEMAS), vez: Math.floor(Math.random() * ns.length) };
      rodada();
    });
    card.append(el("p", "ex-escolha", "Quem vai jogar?"), lista, mais, el("p", "ex-escolha", "Quantas rodadas?"), rodadas, go, erro);
    box.append(card);
  }

  function rodada() {
    clearTimeout(pavio);
    const tema = jogo.temas[jogo.rodada % jogo.temas.length];
    jogo.passes = 0;
    jogo.explodiu = false;
    box.replaceChildren();
    const topo = el("div", "ex-topo");
    topo.append(el("span", "lt-sala", `Rodada ${jogo.rodada + 1} de ${jogo.total}`), el("span", "muted", "🔥 " + jogo.nomes.map((nm, i) => `${nm} ${jogo.queimou[i]}`).join(" · ")));
    const temaEl = el("div", "bt-tema");
    temaEl.append(el("small", "", "Fale em voz alta"), el("strong", "", tema));
    jogo.ui = { vez: el("p", "bt-vez"), batata: el("div", "bt-batata", "🥔"), passar: btn("button lt-go bt-passar", "Passar ➜", passar) };
    const comecar = btn("button lt-go", "Acender a batata 🔥", () => {
      comecar.remove();
      jogo.ui.passar.hidden = false;
      // tempo surpresa: ninguém sabe quando vai explodir
      pavio = setTimeout(explodir, 15000 + Math.random() * 25000);
      jogo.t0 = Date.now();
      esquentar();
    });
    jogo.ui.passar.hidden = true;
    box.append(topo, temaEl, jogo.ui.batata, jogo.ui.vez, comecar, jogo.ui.passar);
    mostrarVez();
  }

  function mostrarVez() {
    jogo.ui.vez.replaceChildren(el("span", "", "Com a batata: "), el("strong", "", jogo.nomes[jogo.vez]));
  }

  // a batata treme mais rápido conforme o tempo passa (mas sem entregar a hora exata)
  function esquentar() {
    if (!jogo || jogo.explodiu || !jogo.ui.batata.isConnected) return;
    const s = (Date.now() - jogo.t0) / 1000;
    jogo.ui.batata.style.animationDuration = `${Math.max(0.12, 0.6 - s * 0.012)}s`;
    jogo.ui.batata.classList.add("quente");
    setTimeout(esquentar, 1000);
  }

  function passar() {
    if (jogo.explodiu) return;
    jogo.passes++;
    jogo.vez = (jogo.vez + 1) % jogo.nomes.length;
    mostrarVez();
    vibrar(15);
    jogo.ui.batata.classList.remove("pula");
    void jogo.ui.batata.offsetWidth;
    jogo.ui.batata.classList.add("pula");
  }

  function explodir() {
    jogo.explodiu = true;
    const quem = jogo.vez;
    jogo.queimou[quem]++;
    vibrar([300, 100, 300]);
    jogo.ui.batata.textContent = "💥";
    jogo.ui.batata.classList.remove("quente");
    jogo.ui.batata.classList.add("explodiu");
    jogo.ui.passar.hidden = true;
    jogo.rodada++;
    const ultima = jogo.rodada >= jogo.total;
    const over = el("div", "ex-fim");
    over.append(el("p", "eyebrow", `Explodiu depois de ${jogo.passes} ${jogo.passes === 1 ? "passe" : "passes"}!`),
      el("h2", "", `🔥 ${jogo.nomes[quem]} se queimou!`),
      el("p", "muted", "Placar de queimaduras: " + jogo.nomes.map((nm, i) => `${nm} ${jogo.queimou[i]}`).join(" · ")),
      btn("button lt-go", ultima ? "Ver quem ganhou" : "Próxima rodada", () => (ultima ? fim() : rodada())));
    box.append(over);
  }

  function fim() {
    box.replaceChildren();
    const menor = Math.min(...jogo.queimou);
    const ordem = jogo.nomes.map((nm, i) => ({ nm, q: jogo.queimou[i] })).sort((a, b) => a.q - b.q);
    const vencedores = ordem.filter((o) => o.q === menor).map((o) => o.nm);
    const card = el("div", "ex-inicio");
    card.append(el("p", "eyebrow", `${jogo.total} rodadas`), el("h2", "", vencedores.length > 1 ? `Empate: ${vencedores.join(" e ")}!` : `🏆 ${vencedores[0]} venceu!`),
      el("p", "muted", "Quem se queimou menos ganha."));
    const ol = el("ol", "rl-rank pequeno bt-final");
    ordem.forEach((o, k) => {
      const li = el("li");
      li.append(el("span", "rl-pos", `${k + 1}º`), el("span", "rl-av", o.q === menor ? "😎" : "🥵"), el("span", "rl-nick", o.nm), el("b", "", `🔥 ${o.q}`));
      ol.append(li);
    });
    const acoes = el("div", "quiz-actions");
    acoes.append(btn("button lt-go", "Jogar de novo", () => {
      jogo = { ...jogo, queimou: jogo.nomes.map(() => 0), rodada: 0, temas: shuffle(TEMAS), vez: Math.floor(Math.random() * jogo.nomes.length) };
      rodada();
    }), btn("share-btn", "Trocar jogadores", inicio));
    card.append(ol, acoes);
    box.append(card);
  }

  window.__batata = { estado: () => jogo, explodir: () => { clearTimeout(pavio); explodir(); } }; // usado nos testes automáticos
  inicio();
})();
