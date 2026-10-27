// Blefe: aparece uma frase curiosa com uma lacuna. Cada um inventa uma resposta falsa que pareça verdade;
// depois todos tentam achar a verdadeira no meio das mentiras. Acertou a verdade: +2. Cada amigo que caiu
// na sua mentira: +1 para você. De 3 a 8 jogadores, cada um no seu celular.
// Sala em blefe/{código}; jogadores, respostas e votos em subcoleções. Regras em firestore.rules.
(() => {
  const box = document.getElementById("blefe");
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
  const vibrar = (p) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate?.(p); } catch { /* sem vibração */ }
  };

  const MIN = 3, MAX = 8;
  const ESCREVER = 60000, VOTAR = 40000, PLACAR = 12000;
  const BATIDA = 20000, SUMIU = 50000, VALIDADE = 60 * 60 * 1000;
  const AVATARES = ["🦁", "🐯", "🐻", "🦊", "🐼", "🐸", "🐵", "🦉", "🐙", "🦄", "🐲", "🐺", "🦈", "🐢", "🦅", "🐝"];
  // [frase com ___, resposta, outras formas da mesma resposta]
  const FRASES = [
    ["Um polvo tem ___ corações.", "três", ["3"]],
    ["O animal que dorme cerca de 20 horas por dia é o ___.", "coala", []],
    ["A abelha tem ___ olhos.", "cinco", ["5"]],
    ["O único mamífero que voa de verdade é o ___.", "morcego", []],
    ["A capital da Austrália é ___.", "Camberra", ["canberra"]],
    ["O Brasil faz fronteira com quase todos os países da América do Sul, menos o Chile e o ___.", "Equador", []],
    ["A moeda do Japão se chama ___.", "iene", ["yen"]],
    ["O maior roedor do mundo é a ___.", "capivara", []],
    ["O esqueleto do tubarão é feito de ___.", "cartilagem", []],
    ["No cavalo-marinho, quem carrega os filhotes na barriga é o ___.", "macho", ["pai"]],
    ["O primeiro brasileiro a ir ao espaço foi ___.", "Marcos Pontes", []],
    ["A Torre Eiffel foi construída para uma ___ em 1889.", "exposição universal", ["exposicao", "exposição"]],
    ["A palavra “jiu-jitsu” quer dizer “arte ___”.", "suave", []],
    ["Na faixa preta do jiu-jitsu, a ponta onde ficam os graus é ___.", "vermelha", []],
    ["O bicho-preguiça desce da árvore mais ou menos uma vez por semana para ___.", "fazer cocô", ["cocô", "coco", "fazer coco"]],
    ["A cidade de São Paulo foi fundada no ano de ___.", "1554", []],
    ["Em Vênus, um dia dura mais que um ___.", "ano", []],
    ["Os flamingos são cor-de-rosa por causa da ___.", "comida", ["alimentação", "alimentacao"]],
    ["A Estátua da Liberdade foi um presente da ___ para os Estados Unidos.", "França", []],
    ["O corpo de um adulto tem ___ ossos.", "206", []],
    ["A maior ave do mundo é o ___.", "avestruz", []],
    ["O ponto mais alto do Brasil é o Pico da ___.", "Neblina", []],
    ["A pipoca estoura por causa da ___ que fica dentro do grão.", "água", ["agua", "vapor"]],
    ["O estômago da vaca tem ___ partes.", "quatro", ["4"]],
    ["O som não se propaga no ___.", "vácuo", ["vacuo"]],
    ["A roupa de treino do judô se chama ___.", "judogi", []],
    ["O coração de um adulto bate cerca de ___ vezes por dia.", "100 mil", ["cem mil", "100000", "100.000"]],
    ["A primeira capital do Brasil foi ___.", "Salvador", []],
    ["O animal com listras que são únicas em cada um, como uma impressão digital, é a ___.", "zebra", []],
    ["A luz do Sol leva cerca de ___ minutos para chegar à Terra.", "8", ["oito"]],
    ["O planeta mais perto do Sol é ___.", "Mercúrio", ["mercurio"]],
    ["O nome do arquipélago de Pernambuco famoso pelas praias é Fernando de ___.", "Noronha", []],
  ];
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const BLOQ = ["caralh", "bucet", "arrombad", "vagabund", "desgraca", "xoxota", "punheta", "siririca", "piroca", "cuzao", "porra", "merda", "puta", "viado", "fdp", "pqp", "bosta", "corno"];

  function sorte(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- estado ----------
  let R, C, codigo = null, sala = null;
  let jogadores = {}, respostas = {}, votos = {};
  let offset = 0, batida = 0, pendente = false;
  let desligar = [], tick = null, tela = null, ui = {};
  const feito = new Set();
  const agora = () => Date.now() + offset;
  const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);
  const ref = (...p) => C.fs.doc(C.db, "blefe", ...p);
  const col = (c, nome) => C.fs.collection(C.db, "blefe", c, nome);
  const sortearCodigo = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const souHost = () => sala && C && sala.host === C.uid;
  const lista = () => Object.entries(jogadores).map(([uid, j]) => ({ uid, ...j })).sort((a, b) => (ms(a.entrou) ?? 0) - (ms(b.entrou) ?? 0));
  const nick = (uid) => jogadores[uid]?.nick ?? "Alguém";
  const ativo = (uid) => { const v = ms(jogadores[uid]?.visto); return !v || agora() - v < SUMIU; };
  const frase = (r = sala.rodada) => FRASES[sala.perguntas[r]] ?? FRASES[0];
  const ehVerdade = (texto, r) => { const [, resp, outras] = frase(r); return [resp, ...outras].some((x) => norm(x) === norm(texto)); };

  // opções da votação: a verdade e cada mentira diferente (mentiras iguais viram uma opção só, com vários autores)
  function opcoesDa(r = sala.rodada) {
    const grupos = {};
    sala.ordem.forEach((uid) => {
      const resp = respostas[`${r}-${uid}`];
      if (!resp) return;
      const k = norm(resp.texto);
      (grupos[k] ??= { texto: resp.texto, autores: [] }).autores.push(uid);
    });
    const ops = [{ id: "verdade", texto: frase(r)[1], autores: [] },
      ...Object.values(grupos).map((g) => ({ id: g.autores.slice().sort()[0], texto: g.texto, autores: g.autores }))];
    // mesma ordem embaralhada em todos os celulares
    const rnd = sorte(sala.seed + r * 7919);
    return ops.sort((a, b) => a.id.localeCompare(b.id)).map((o) => [rnd(), o]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }

  function apuracao(r = sala.rodada) {
    const ops = opcoesDa(r);
    const pts = Object.fromEntries(sala.ordem.map((u) => [u, 0]));
    const caiu = {}; // id da opção → quem votou nela
    sala.ordem.forEach((u) => {
      const v = votos[`${r}-${u}`];
      if (!v) return;
      const op = ops.find((o) => o.id === v.escolha);
      if (!op || op.autores.includes(u)) return;
      (caiu[op.id] ??= []).push(u);
      if (op.id === "verdade") pts[u] += 2;
      else op.autores.forEach((a) => { pts[a] += 1; });
    });
    return { ops, pts, caiu };
  }

  function placar() {
    const total = Object.fromEntries(lista().map((j) => [j.uid, 0]));
    const ate = sala.status === "placar" || sala.status === "fim" ? sala.rodada : sala.rodada - 1;
    for (let r = 0; r <= ate; r++) Object.entries(apuracao(r).pts).forEach(([u, p]) => { total[u] = (total[u] ?? 0) + p; });
    return lista().map((j) => ({ ...j, total: total[j.uid] ?? 0 })).sort((a, b) => b.total - a.total);
  }

  // ---------- Firebase ----------
  const salaVazia = (ts) => ({ host: C.uid, status: "espera", rodada: 0, total: 0, inicio: ts, criada: ts, ordem: [], perguntas: [], seed: 0, revanche: null });

  async function limpar() {
    try {
      const { fs, db } = C;
      const velhas = await fs.getDocs(fs.query(fs.collection(db, "blefe"),
        fs.where("criada", "<", fs.Timestamp.fromMillis(Date.now() - VALIDADE - 10 * 60 * 1000)), fs.limit(3)));
      for (const s of velhas.docs) {
        for (const sub of ["jogadores", "respostas", "votos"]) {
          const ds = await fs.getDocs(col(s.id, sub));
          await Promise.all(ds.docs.map((d) => fs.deleteDoc(d.ref)));
        }
        await fs.deleteDoc(s.ref);
      }
    } catch (e) { console.warn("Limpeza de salas antigas não rodou.", e); }
  }

  async function criar() {
    const { fs, db } = C;
    for (let i = 0; i < 12; i++) {
      const c = sortearCodigo();
      const ok = await fs.runTransaction(db, async (t) => {
        if ((await t.get(ref(c))).exists()) return false;
        t.set(ref(c), salaVazia(fs.serverTimestamp()));
        return true;
      });
      if (ok) { await entrarComo(c); limpar(); return c; }
    }
    throw new Error("sem código livre");
  }

  async function entrarComo(c) {
    const ts = C.fs.serverTimestamp();
    const avatar = [...C.uid].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 1000003, 7) % AVATARES.length;
    await C.fs.setDoc(C.fs.doc(col(c, "jogadores"), C.uid), { nick: R.nick(), avatar, entrou: ts, visto: ts });
  }

  async function entrar(c) {
    const { fs } = C;
    const s = await fs.getDoc(ref(c));
    if (!s.exists()) return "Não achamos essa sala. Confira o código.";
    const d = s.data();
    if ((await fs.getDoc(fs.doc(col(c, "jogadores"), C.uid))).exists()) return null;
    if (Date.now() + offset > ms(d.criada) + VALIDADE) return "Essa sala já venceu. Peça um código novo.";
    if (d.status === "fim") return "Esse jogo já terminou. Crie uma sala nova.";
    if (d.status !== "espera") return "Esse jogo já começou. Espere a próxima partida.";
    if ((await fs.getDocs(col(c, "jogadores"))).size >= MAX) return `A sala está cheia (${MAX} jogadores).`;
    await entrarComo(c);
    return null;
  }

  async function mudarFase(de, campos) {
    const { fs, db } = C;
    await fs.runTransaction(db, async (t) => {
      const d = (await t.get(ref(codigo))).data();
      if (d.status !== de.status || d.rodada !== de.rodada) return;
      t.update(ref(codigo), { ...campos, inicio: fs.serverTimestamp() });
    });
  }

  async function revanche() {
    const { fs, db } = C;
    return fs.runTransaction(db, async (t) => {
      const d = (await t.get(ref(codigo))).data();
      if (d.revanche) return d.revanche;
      for (let i = 0; i < 8; i++) {
        const c = sortearCodigo();
        if ((await t.get(ref(c))).exists()) continue;
        t.set(ref(c), salaVazia(fs.serverTimestamp()));
        t.update(ref(codigo), { revanche: c });
        return c;
      }
      throw new Error("sem código livre");
    });
  }

  function bater() {
    if (!codigo || !jogadores[C.uid] || sala?.status === "fim") return;
    batida = Date.now();
    C.fs.updateDoc(C.fs.doc(col(codigo, "jogadores"), C.uid), { visto: C.fs.serverTimestamp() }).catch(() => null);
  }

  // ---------- acompanhar a sala ----------
  function parar() {
    desligar.forEach((f) => f());
    desligar = [];
    clearInterval(tick);
    tick = null;
    tela = null;
    ui = {};
    feito.clear();
  }

  function abrir(c) {
    parar();
    codigo = c;
    sala = null;
    jogadores = {}; respostas = {}; votos = {};
    history.replaceState(null, "", `?sala=${c}`);
    const { fs } = C;
    desligar.push(fs.onSnapshot(ref(c), (snap) => {
      if (!snap.exists()) { codigo = null; history.replaceState(null, "", location.pathname); inicio("Essa sala foi fechada."); return; }
      sala = snap.data({ serverTimestamps: "estimate" });
      desenhar();
    }, (e) => { console.warn(e); inicio("Perdemos a conexão com a sala. Tente entrar de novo."); }));
    desligar.push(fs.onSnapshot(col(c, "jogadores"), { includeMetadataChanges: true }, (snap) => {
      jogadores = {};
      snap.forEach((d) => { jogadores[d.id] = d.data({ serverTimestamps: "estimate" }); });
      const meu = snap.docs.find((d) => d.id === C.uid);
      if (meu?.metadata.hasPendingWrites) pendente = true;
      else if (meu && pendente) {
        pendente = false;
        const v = ms(meu.data().visto);
        if (v && Date.now() - batida < 5000) offset = v - (batida + Date.now()) / 2;
      }
      if (sala && !jogadores[C.uid] && sala.status === "espera") { codigo = null; inicio("Você saiu da sala."); return; }
      desenhar();
    }));
    const seguir = (nome, alvo) => desligar.push(fs.onSnapshot(col(c, nome), (snap) => {
      Object.keys(alvo).forEach((k) => delete alvo[k]);
      snap.forEach((d) => { if (!d.metadata.hasPendingWrites) alvo[d.id] = d.data(); });
      desenhar();
    }));
    seguir("respostas", respostas);
    seguir("votos", votos);
    bater();
    const pulso = setInterval(bater, BATIDA);
    desligar.push(() => clearInterval(pulso));
    tick = setInterval(passo, 300);
  }

  function desenhar() {
    if (!sala || !Object.keys(jogadores).length) return;
    if (!jogadores[C.uid] && sala.status !== "espera") { inicio("Esse jogo já começou sem você. Espere a próxima partida."); return; }
    if (sala.status === "espera") return salaEspera();
    if (sala.status === "fim") return fim();
    return rodadaTela();
  }

  // o anfitrião passa as fases (ou qualquer um, se ele sumir por 2 minutos)
  function passo() {
    if (!sala || ["espera", "fim"].includes(sala.status)) return;
    atualizar();
    const t = agora() - ms(sala.inicio);
    const chave = `${sala.status}-${sala.rodada}`;
    if (feito.has(chave) || !(souHost() || t > 120000)) return;
    const vivos = sala.ordem.filter(ativo);
    const de = { status: sala.status, rodada: sala.rodada };
    let campos = null;
    if (sala.status === "escrever") {
      if ((vivos.every((u) => respostas[`${sala.rodada}-${u}`]) && t > 2500) || t > ESCREVER) campos = { status: "votar" };
    } else if (sala.status === "votar") {
      if ((vivos.every((u) => votos[`${sala.rodada}-${u}`]) && t > 2500) || t > VOTAR) campos = { status: "placar" };
    } else if (sala.status === "placar" && t > PLACAR) {
      campos = sala.rodada + 1 < sala.total ? { status: "escrever", rodada: sala.rodada + 1 } : { status: "fim" };
    }
    if (!campos) return;
    feito.add(chave);
    mudarFase(de, campos).catch((e) => { console.warn(e); setTimeout(() => feito.delete(chave), 2000); });
  }

  // ---------- telas ----------
  function trocar(nome) {
    if (tela === nome) return false;
    tela = nome;
    ui = {};
    box.replaceChildren();
    box.dataset.tela = nome;
    return true;
  }
  const avatar = (uid, grande) => {
    const a = el("span", grande ? "rl-av grande" : "rl-av", AVATARES[jogadores[uid]?.avatar] ?? "🙂");
    a.setAttribute("aria-hidden", "true");
    return a;
  };

  function semNick(depois) {
    const form = el("form", "rk-form");
    const title = el("div");
    title.append(el("strong", "", "🎭 Como você quer aparecer no jogo?"), el("span", "muted", "É o mesmo nickname do ranking dos jogos."));
    const row = el("div", "rk-inline-row");
    const input = el("input");
    Object.assign(input, { maxLength: 16, placeholder: "Seu nickname", autocomplete: "nickname" });
    input.setAttribute("aria-label", "Seu nickname");
    row.append(input, Object.assign(el("button", "button", "Salvar"), { type: "submit" }));
    const msg = el("p", "rk-error");
    form.append(title, row, msg);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = R.setNick(input.value);
      if (err) { msg.textContent = err; input.focus(); return; }
      depois();
    });
    return form;
  }

  function inicio(msgErro) {
    parar();
    tela = "inicio";
    box.dataset.tela = "inicio";
    box.replaceChildren();
    if (!C) { box.append(el("p", "lt-erro", "O Blefe precisa de internet. Confira a conexão e recarregue a página.")); return; }
    const pedido = (new URLSearchParams(location.search).get("sala") || "").replace(/\D/g, "").slice(0, 4);
    if (msgErro) box.append(el("p", "lt-erro", msgErro));
    if (!R.nick()) { box.append(semNick(() => inicio(msgErro))); return; }
    const hello = el("div", "rk-hello lt-hello");
    const txt = el("div");
    txt.append(el("span", "muted", "Jogando como"), el("strong", "", R.nick()));
    hello.append(el("span", "rk-avatar", R.nick().slice(0, 1).toUpperCase()), txt,
      btn("share-btn", "✏️ Trocar", () => box.replaceChildren(semNick(() => inicio()))));
    box.append(hello);
    const portas = el("div", "lt-portas");
    const criarCard = el("div", "lt-porta lt-porta-criar");
    const criarMsg = el("p", "rk-error");
    const criarBtn = btn("button lt-go", "Criar sala", async () => {
      criarBtn.disabled = true;
      try { abrir(await criar()); } catch (e) { console.warn(e); criarMsg.textContent = "Não deu para criar a sala. Tente de novo."; criarBtn.disabled = false; }
    });
    criarCard.append(el("span", "lt-porta-ico", "🎭"), el("h2", "", "Criar sala"), el("p", "muted", `Junte de ${MIN} a ${MAX} pessoas, cada uma no seu celular.`), criarBtn, criarMsg);
    const entrarCard = el("form", "lt-porta");
    const code = el("input", "lt-code-input");
    Object.assign(code, { inputMode: "numeric", maxLength: 4, placeholder: "0000", autocomplete: "off", value: pedido });
    code.setAttribute("aria-label", "Código da sala");
    code.addEventListener("input", () => { code.value = code.value.replace(/\D/g, "").slice(0, 4); });
    const entrarBtn = Object.assign(el("button", "button lt-go", "Entrar"), { type: "submit" });
    const entrarMsg = el("p", "rk-error");
    entrarCard.append(el("span", "lt-porta-ico", "🔑"), el("h2", "", "Entrar com código"), el("p", "muted", "Recebeu um código? Digite aqui."), code, entrarBtn, entrarMsg);
    entrarCard.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (code.value.length !== 4) { entrarMsg.textContent = "O código tem 4 números."; return; }
      entrarBtn.disabled = true;
      try {
        const err = await entrar(code.value);
        if (err) { entrarMsg.textContent = err; entrarBtn.disabled = false; return; }
        abrir(code.value);
      } catch (err) { console.warn(err); entrarMsg.textContent = "Não deu para entrar agora. Tente de novo."; entrarBtn.disabled = false; }
    });
    portas.append(criarCard, entrarCard);
    const regras = el("details", "lt-regras");
    regras.append(el("summary", "", "📜 Como se joga"));
    const ul = el("ul");
    [
      "Aparece uma frase curiosa com uma lacuna (___), e só a verdade preenche certinho.",
      "Cada um inventa uma resposta falsa que pareça verdade. Não vale escrever a resposta certa!",
      "Depois aparecem todas as respostas misturadas, e cada um vota na que acha verdadeira.",
      "Votou na verdade: +2. Cada amigo que cair na sua mentira: +1 para você.",
    ].forEach((t) => ul.append(el("li", "", t)));
    regras.append(ul);
    box.append(portas, regras);
    if (pedido) code.focus();
  }

  const linkSala = () => `${location.origin}${location.pathname}?sala=${codigo}`;

  function salaEspera() {
    if (trocar("espera")) {
      const wrap = el("div", "lt-espera rl-espera");
      wrap.append(el("p", "eyebrow", "Sala de espera"), el("h2", "", "Código da sala"));
      const digits = el("div", "lt-codigo");
      codigo.split("").forEach((d) => digits.append(el("span", "", d)));
      const convite = `🎭 Bora jogar Blefe? Entra na minha sala com o código ${codigo}: ${linkSala()}`;
      const acoes = el("div", "lt-acoes");
      const zap = el("a", "button lt-zap", "Chamar no WhatsApp");
      Object.assign(zap, { href: `https://wa.me/?text=${encodeURIComponent(convite)}`, target: "_blank", rel: "noopener" });
      acoes.append(zap, btn("share-btn", "Copiar link", async () => {
        try { await navigator.clipboard.writeText(linkSala()); window.siteToast?.("Link copiado! 📋"); } catch { window.siteToast?.(`Código: ${codigo}`); }
      }));
      ui.contagem = el("p", "rl-contagem");
      ui.jogadores = el("ul", "rl-jogadores");
      ui.controle = el("div", "rl-controle");
      wrap.append(digits, acoes, ui.contagem, ui.jogadores, ui.controle);
      box.append(wrap);
    }
    const js = lista();
    ui.contagem.textContent = `${js.length} de ${MAX} jogadores (mínimo ${MIN})`;
    ui.jogadores.replaceChildren(...js.map((j) => {
      const li = el("li", j.uid === C.uid ? "eu" : "");
      li.append(avatar(j.uid), el("span", "rl-nick", j.nick));
      if (j.uid === sala.host) li.append(el("small", "rl-tag", "anfitrião"));
      else if (j.uid === C.uid) li.append(el("small", "rl-tag", "você"));
      return li;
    }));
    const chave = `${souHost()}-${js.length >= MIN}`;
    if (ui.chave === chave) return;
    ui.chave = chave;
    ui.controle.replaceChildren();
    if (souHost()) {
      ui.n = ui.n ?? 5;
      const escolha = el("div", "chips rl-quantos");
      [3, 5, 7].forEach((n) => {
        const b = btn("", `${n} rodadas`, () => { ui.n = n; escolha.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
        b.setAttribute("aria-pressed", n === ui.n);
        escolha.append(b);
      });
      const go = btn("button lt-go", js.length >= MIN ? "Começar 🎭" : `Faltam ${MIN - js.length} para começar`, async () => {
        go.disabled = true;
        const perguntas = FRASES.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, ui.n);
        try {
          await C.fs.updateDoc(ref(codigo), { status: "escrever", total: ui.n, rodada: 0, inicio: C.fs.serverTimestamp(), ordem: lista().map((j) => j.uid), perguntas, seed: Math.floor(Math.random() * 1e9) });
        } catch (e) { console.warn(e); go.disabled = false; window.siteToast?.("Não deu para começar agora"); }
      });
      go.disabled = js.length < MIN;
      ui.controle.append(escolha, go);
    } else {
      const aguarde = el("div", "lt-aguarde");
      aguarde.append(el("span", "lt-pulso"), el("span", "", "Esperando o anfitrião começar…"));
      ui.controle.append(aguarde);
    }
    ui.controle.append(btn("share-btn lt-cancelar", souHost() ? "Fechar sala" : "Sair da sala", async () => {
      try {
        if (souHost()) {
          const ds = await C.fs.getDocs(col(codigo, "jogadores"));
          await Promise.all(ds.docs.filter((d) => d.id !== C.uid).map((d) => C.fs.deleteDoc(d.ref).catch(() => null)));
          await C.fs.deleteDoc(C.fs.doc(col(codigo, "jogadores"), C.uid));
          await C.fs.deleteDoc(ref(codigo));
        } else await C.fs.deleteDoc(C.fs.doc(col(codigo, "jogadores"), C.uid));
      } catch (e) { console.warn(e); }
      codigo = null;
      history.replaceState(null, "", location.pathname);
      inicio();
    }));
  }

  function rodadaTela() {
    if (trocar(`${sala.status}-${sala.rodada}`)) {
      const topo = el("div", "rl-topo");
      ui.tempo = el("span", "rl-tempo-txt");
      topo.append(el("span", "lt-sala", `Rodada ${sala.rodada + 1} de ${sala.total}`), ui.tempo);
      const [texto] = frase();
      const card = el("p", "bf-frase", texto);
      ui.corpo = el("div", "in-corpo");
      ui.status = el("p", "rl-status");
      box.append(topo, card, ui.corpo, ui.status);
      if (sala.status === "escrever") telaEscrever();
      if (sala.status === "votar") telaVotar();
      if (sala.status === "placar") telaPlacar();
    }
    atualizar();
  }

  function telaEscrever() {
    const form = el("form", "in-form");
    const input = el("input", "in-input");
    Object.assign(input, { maxLength: 30, placeholder: "Sua mentira para a lacuna", autocomplete: "off", enterKeyHint: "send" });
    input.setAttribute("aria-label", "Sua resposta falsa");
    const enviar = Object.assign(el("button", "button", "Enviar"), { type: "submit" });
    const erro = el("p", "rk-error");
    form.append(input, enviar);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = input.value.trim().replace(/\s+/g, " ");
      if (!texto) { erro.textContent = "Escreva alguma coisa."; return; }
      if (!/^[\p{L}\p{N} ,.!?-]+$/u.test(texto)) { erro.textContent = "Use só letras, números e pontuação simples."; return; }
      if (BLOQ.some((b) => norm(texto).replace(/ /g, "").includes(b))) { erro.textContent = "Essa não vale. Escolha outra."; return; }
      if (ehVerdade(texto, sala.rodada)) { erro.textContent = "Essa é a resposta certa! 🤫 Invente uma mentira."; return; }
      enviar.disabled = true;
      try {
        await C.fs.setDoc(C.fs.doc(col(codigo, "respostas"), `${sala.rodada}-${C.uid}`), { rodada: sala.rodada, texto, em: C.fs.serverTimestamp() });
        erro.textContent = "";
      } catch (err) { console.warn(err); erro.textContent = "Não foi. Tente de novo."; enviar.disabled = false; }
    });
    ui.form = form;
    ui.feito = el("p", "rl-feito", "✅ Mentira enviada! Esperando os outros…");
    ui.feito.hidden = true;
    ui.corpo.append(el("p", "muted", "Invente uma resposta falsa que pareça verdade, para enganar os amigos."), form, erro, ui.feito);
    input.focus();
  }

  function telaVotar() {
    ui.corpo.append(el("h2", "in-titulo", "Qual é a verdadeira?"));
    ui.ops = el("div", "bf-ops");
    opcoesDa().forEach((o) => {
      const minha = o.autores.includes(C.uid);
      const b = btn("bf-op", o.texto, async () => {
        if (votos[`${sala.rodada}-${C.uid}`]) return;
        ui.ops.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        b.classList.add("escolhido");
        try { await C.fs.setDoc(C.fs.doc(col(codigo, "votos"), `${sala.rodada}-${C.uid}`), { rodada: sala.rodada, escolha: o.id, em: C.fs.serverTimestamp() }); vibrar(20); }
        catch (e) { console.warn(e); ui.ops.querySelectorAll("button").forEach((x) => { x.disabled = x.dataset.minha === "1"; }); b.classList.remove("escolhido"); }
      });
      b.dataset.id = o.id;
      b.dataset.minha = minha ? "1" : "0";
      if (minha) { b.disabled = true; b.append(el("small", "", " (sua)")); }
      ui.ops.append(b);
    });
    ui.corpo.append(ui.ops);
  }

  function telaPlacar() {
    const { ops, pts, caiu } = apuracao();
    const lis = el("ul", "bf-revela");
    ops.forEach((o) => {
      const li = el("li", o.id === "verdade" ? "verdade" : "");
      const topo = el("div", "bf-revela-topo");
      topo.append(el("strong", "", o.texto), el("span", "bf-quem", o.id === "verdade" ? "✅ VERDADE" : `🎭 de ${o.autores.map(nick).join(" e ")}`));
      const cairam = (caiu[o.id] ?? []);
      li.append(topo, el("small", "muted", cairam.length ? `${o.id === "verdade" ? "Acertaram" : "Caíram"}: ${cairam.map(nick).join(", ")}` : (o.id === "verdade" ? "Ninguém acertou!" : "Ninguém caiu")));
      lis.append(li);
    });
    const ganhos = el("p", "muted", "Nesta rodada: " + sala.ordem.map((u) => `${nick(u)} +${pts[u]}`).join(" · "));
    const geral = el("div", "rl-geral");
    geral.append(el("h3", "", "Placar geral"));
    const ol = el("ol", "rl-rank pequeno");
    placar().forEach((j, k) => {
      const li = el("li", j.uid === C.uid ? "eu" : "");
      li.append(el("span", "rl-pos", `${k + 1}º`), avatar(j.uid), el("span", "rl-nick", j.nick), el("b", "", `${j.total} pts`));
      ol.append(li);
    });
    geral.append(ol);
    ui.corpo.append(lis, ganhos, geral, el("p", "muted rl-proxima", sala.rodada + 1 < sala.total ? "Próxima rodada em instantes…" : "Já já sai o pódio…"));
    vibrar(pts[C.uid] ? [40, 30, 40] : 80);
  }

  function atualizar() {
    if (!sala || !ui.tempo) return;
    const t = agora() - ms(sala.inicio);
    const lim = { escrever: ESCREVER, votar: VOTAR }[sala.status];
    ui.tempo.textContent = lim ? `${Math.max(0, Math.ceil((lim - t) / 1000))} s` : "";
    if (sala.status === "escrever" || sala.status === "votar") {
      const banco = sala.status === "escrever" ? respostas : votos;
      const feitos = sala.ordem.filter((u) => banco[`${sala.rodada}-${u}`]);
      ui.status.replaceChildren(el("span", "", `${feitos.length} de ${sala.ordem.length} ${sala.status === "escrever" ? "escreveram" : "votaram"} `));
      sala.ordem.forEach((u) => { const a = avatar(u); a.classList.toggle("pronto", feitos.includes(u)); a.title = nick(u); ui.status.append(a); });
      if (sala.status === "escrever" && ui.form) {
        const mandei = !!respostas[`${sala.rodada}-${C.uid}`];
        ui.form.hidden = mandei;
        ui.feito.hidden = !mandei;
      }
      if (sala.status === "votar") {
        const meu = votos[`${sala.rodada}-${C.uid}`];
        if (meu) ui.ops.querySelectorAll("button").forEach((b) => { b.disabled = true; b.classList.toggle("escolhido", b.dataset.id === meu.escolha); });
      }
    } else ui.status.replaceChildren();
  }

  function fim() {
    const chave = `fim-${sala.revanche || ""}`;
    if (tela === chave) return;
    const primeira = !String(tela).startsWith("fim");
    trocar(chave);
    const geral = placar();
    const card = el("div", "rl-fim");
    card.append(el("p", "eyebrow", `${sala.total} rodadas · ${geral.length} jogadores`), el("h2", "", "Pódio"));
    const podio = el("div", "rl-podio");
    [1, 0, 2].forEach((k) => {
      const j = geral[k];
      if (!j) return;
      const c = el("div", `rl-degrau d${k + 1}`);
      c.append(avatar(j.uid, true), el("strong", "", j.nick), el("span", "", `${j.total} pts`), el("b", "rl-degrau-n", `${k + 1}º`));
      podio.append(c);
    });
    card.append(podio);
    if (geral.length > 3) {
      const ol = el("ol", "rl-rank pequeno");
      geral.slice(3).forEach((j, k) => {
        const li = el("li", j.uid === C.uid ? "eu" : "");
        li.append(el("span", "rl-pos", `${k + 4}º`), avatar(j.uid), el("span", "rl-nick", j.nick), el("b", "", `${j.total} pts`));
        ol.append(li);
      });
      card.append(ol);
    }
    const minha = geral.findIndex((j) => j.uid === C.uid);
    if (minha >= 0) card.append(el("p", "rl-minha", minha === 0 ? "🏆 Você venceu! Que blefador!" : `Você ficou em ${minha + 1}º lugar.`));
    const acoes = el("div", "quiz-actions lt-acoes");
    if (sala.revanche) {
      const c = sala.revanche;
      card.append(el("p", "lt-revanche", "🔁 Tem partida nova na mesma turma!"));
      acoes.append(btn("button lt-go", "🔁 Entrar na nova partida", () => irPara(c)));
    } else {
      const nova = btn("button lt-go", "🔁 Jogar de novo", async () => {
        nova.disabled = true;
        try { irPara(await revanche()); } catch (e) {
          console.warn(e);
          const d = (await C.fs.getDoc(ref(codigo)).catch(() => null))?.data();
          if (d?.revanche) { irPara(d.revanche); return; }
          nova.disabled = false;
        }
      });
      acoes.append(nova);
    }
    acoes.append(btn("share-btn", "Sair", () => { codigo = null; history.replaceState(null, "", location.pathname); inicio(); }));
    card.append(acoes);
    box.append(card);
    if (primeira && minha === 0) vibrar([60, 40, 60, 40, 160]);
  }

  async function irPara(c) {
    try {
      const err = await entrar(c);
      if (err) { window.siteToast?.(err); return; }
      abrir(c);
    } catch (e) { console.warn(e); window.siteToast?.("Não deu para entrar agora"); }
  }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") bater(); });

  async function comecarPagina() {
    R = window.cohabRanking;
    box.replaceChildren(el("p", "muted", "Conectando…"));
    try { C = await R.cloud(); } catch (e) { console.warn(e); C = null; }
    const pedido = (new URLSearchParams(location.search).get("sala") || "").replace(/\D/g, "");
    if (C && pedido.length === 4 && R.nick()) {
      try { if ((await C.fs.getDoc(C.fs.doc(col(pedido, "jogadores"), C.uid))).exists()) { abrir(pedido); return; } } catch (e) { console.warn(e); }
    }
    inicio();
  }

  window.__blefe = { frases: FRASES }; // usado nos testes automáticos
  if (window.cohabRanking) comecarPagina();
  else window.addEventListener("cohab-ranking", comecarPagina, { once: true });
})();
