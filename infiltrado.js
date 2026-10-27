// Infiltrado: todos recebem a mesma palavra secreta, menos um (o infiltrado), que só sabe o tema.
// Cada um dá uma dica de uma palavra, na sua vez; depois todos votam em quem acham que é o infiltrado.
// Se ele for pego, ainda pode roubar pontos adivinhando a palavra. De 3 a 8 jogadores, várias rodadas.
// Sala em infiltrado/{código}; jogadores, dicas, votos e chutes em subcoleções. Regras em firestore.rules.
// Quem é o infiltrado e qual é a palavra saem da "semente" da rodada, calculados em cada celular.
(() => {
  const box = document.getElementById("infiltrado");
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
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const MIN = 3, MAX = 8;
  const INTRO = 6000; // ver o papel antes das dicas
  const VEZ = 30000; // tempo de cada dica
  const VOTO = 45000;
  const CHUTE = 25000;
  const PLACAR = 12000;
  const BATIDA = 20000, SUMIU = 50000;
  const VALIDADE = 60 * 60 * 1000;
  const AVATARES = ["🦁", "🐯", "🐻", "🦊", "🐼", "🐸", "🐵", "🦉", "🐙", "🦄", "🐲", "🐺", "🦈", "🐢", "🦅", "🐝"];
  const TEMAS = {
    "Comidas": ["Pizza", "Feijoada", "Brigadeiro", "Pastel", "Coxinha", "Pão de queijo", "Lasanha", "Hambúrguer", "Açaí", "Churrasco", "Pipoca", "Sorvete"],
    "Animais": ["Girafa", "Elefante", "Pinguim", "Tubarão", "Cachorro", "Gato", "Cavalo", "Coruja", "Jacaré", "Macaco", "Tartaruga", "Capivara"],
    "Lugares": ["Praia", "Escola", "Hospital", "Shopping", "Aeroporto", "Cinema", "Estádio", "Academia", "Padaria", "Igreja", "Farmácia", "Zoológico"],
    "Profissões": ["Médico", "Bombeiro", "Professor", "Policial", "Cozinheiro", "Motorista", "Dentista", "Pedreiro", "Piloto", "Cabeleireiro", "Jornalista", "Veterinário"],
    "Objetos de casa": ["Geladeira", "Sofá", "Televisão", "Travesseiro", "Espelho", "Vassoura", "Fogão", "Chuveiro", "Ventilador", "Panela", "Escova de dente", "Controle remoto"],
    "Esportes": ["Futebol", "Vôlei", "Basquete", "Natação", "Skate", "Surfe", "Tênis", "Ciclismo", "Corrida", "Handebol", "Jiu-jitsu", "Judô"],
  };
  // palavrão em dica: mesma ideia do filtro de nickname do ranking
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const BLOQ = ["caralh", "bucet", "arrombad", "vagabund", "desgraca", "xoxota", "punheta", "siririca", "piroca", "cuzao", "porra", "merda", "puta", "viado", "fdp", "pqp", "bosta", "corno"];

  function sorte(seed) {
    let a = seed >>> 0;
    const r = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.pick = (list) => list[Math.floor(r() * list.length)];
    r.shuffle = (list) => list.map((v) => [r(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    return r;
  }

  // ---------- estado ----------
  let R, C;
  let codigo = null, sala = null;
  let jogadores = {}, dicas = {}, votos = {}, chutes = {};
  let offset = 0, batida = 0, pendente = false;
  let desligar = [], tick = null, tela = null, ui = {};
  const feito = new Set();
  const agora = () => Date.now() + offset;
  const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);
  const ref = (...p) => C.fs.doc(C.db, "infiltrado", ...p);
  const col = (c, nome) => C.fs.collection(C.db, "infiltrado", c, nome);
  const sortearCodigo = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const souHost = () => sala && C && sala.host === C.uid;
  const lista = () => Object.entries(jogadores).map(([uid, j]) => ({ uid, ...j }))
    .sort((a, b) => (ms(a.entrou) ?? 0) - (ms(b.entrou) ?? 0));
  const nick = (uid) => jogadores[uid]?.nick ?? "Alguém";
  const ativo = (uid) => { const v = ms(jogadores[uid]?.visto); return !v || agora() - v < SUMIU; };

  // ---------- regras do jogo (iguais em todos os celulares) ----------
  function segredo() {
    const r = sorte(sala.seed);
    const palavras = TEMAS[sala.tema] ?? [];
    const palavra = r.pick(palavras);
    const infiltrado = sala.ordem[Math.floor(r() * sala.ordem.length)];
    const opcoes = r.shuffle([palavra, ...r.shuffle(palavras.filter((p) => p !== palavra)).slice(0, 5)]);
    return { palavra, infiltrado, opcoes };
  }
  const voltas = () => (sala.ordem.length <= 4 ? 2 : 1); // grupo pequeno dá duas dicas cada

  // de quem é a vez: cada um tem VEZ ms; quem não mandar dica a tempo perde a vez
  function vezes() {
    const seq = [];
    for (let v = 0; v < voltas(); v++) sala.ordem.forEach((uid) => seq.push({ uid, volta: v }));
    let t = ms(sala.inicio) + INTRO;
    return seq.map((s) => {
      const d = dicas[`${sala.rodada}-${s.volta}-${s.uid}`];
      const comeca = t;
      // quem saiu da sala perde a vez na hora
      const fim = d ? Math.max(comeca, ms(d.em) ?? comeca) : ativo(s.uid) ? comeca + VEZ : comeca;
      t = fim;
      return { ...s, comeca, fim, dica: d?.texto ?? null };
    });
  }
  function vezAtual() {
    const now = agora();
    return vezes().find((v) => !v.dica && now < v.fim) ?? null;
  }
  // só pode mandar a dica quando a vez já começou (não durante a explicação)
  const minhaVez = (v) => !!v && v.uid === C.uid && agora() >= v.comeca;

  function apuracao(r = sala.rodada) {
    const { infiltrado, palavra } = segredo();
    const contagem = {};
    sala.ordem.forEach((uid) => { contagem[uid] = 0; });
    const quem = {};
    sala.ordem.forEach((uid) => {
      const v = votos[`${r}-${uid}`];
      if (v && contagem[v.alvo] !== undefined) { contagem[v.alvo]++; quem[uid] = v.alvo; }
    });
    const max = Math.max(0, ...Object.values(contagem));
    const maisVotados = Object.keys(contagem).filter((u) => contagem[u] === max && max > 0);
    const escolhido = maisVotados.length === 1 ? maisVotados[0] : null; // empate: ninguém sai
    const pego = escolhido === infiltrado;
    const chute = chutes[String(r)];
    const acertou = pego && chute?.por === infiltrado && chute.palavra === palavra;
    const pts = {};
    sala.ordem.forEach((uid) => { pts[uid] = 0; });
    sala.ordem.forEach((uid) => { if (uid !== infiltrado && quem[uid] === infiltrado) pts[uid] += 2; });
    if (!pego) pts[infiltrado] += 4;
    else if (acertou) pts[infiltrado] += 3;
    return { infiltrado, palavra, contagem, quem, escolhido, pego, chute, acertou, pts };
  }

  function placar() {
    const total = Object.fromEntries(lista().map((j) => [j.uid, 0]));
    // rodadas já apuradas: as anteriores e a atual se já passou da votação
    const ate = sala.status === "placar" || sala.status === "fim" ? sala.rodada : sala.rodada - 1;
    // rodadas antigas usam o tema/semente/ordem guardados no histórico; a atual usa os da sala
    const salaAtual = sala;
    for (let r = 0; r <= ate; r++) {
      const hist = r === salaAtual.rodada ? {} : salaAtual.historico?.[r];
      if (!hist) continue;
      sala = { ...salaAtual, ...hist, rodada: r };
      try {
        const a = apuracao(r);
        Object.entries(a.pts).forEach(([u, p]) => { total[u] = (total[u] ?? 0) + p; });
      } finally { sala = salaAtual; }
    }
    return lista().map((j) => ({ ...j, total: total[j.uid] ?? 0 })).sort((a, b) => b.total - a.total);
  }

  // ---------- Firebase ----------
  function novaRodada(rodada, ordemAntiga) {
    const temas = Object.keys(TEMAS);
    const ordem = (ordemAntiga ?? lista().map((j) => j.uid)).slice().sort(() => Math.random() - 0.5);
    return { rodada, tema: temas[Math.floor(Math.random() * temas.length)], seed: Math.floor(Math.random() * 1e9), ordem };
  }

  async function limpar() {
    try {
      const { fs, db } = C;
      const velhas = await fs.getDocs(fs.query(fs.collection(db, "infiltrado"),
        fs.where("criada", "<", fs.Timestamp.fromMillis(Date.now() - VALIDADE - 10 * 60 * 1000)), fs.limit(3)));
      for (const s of velhas.docs) {
        for (const sub of ["jogadores", "dicas", "votos", "chutes"]) {
          const ds = await fs.getDocs(col(s.id, sub));
          await Promise.all(ds.docs.map((d) => fs.deleteDoc(d.ref)));
        }
        await fs.deleteDoc(s.ref);
      }
    } catch (e) { console.warn("Limpeza de salas antigas não rodou.", e); }
  }

  const salaVazia = (ts) => ({ host: C.uid, status: "espera", rodada: 0, total: 0, inicio: ts, criada: ts, tema: "", seed: 0, ordem: [], historico: [], revanche: null });

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
    jogadores = {}; dicas = {}; votos = {}; chutes = {};
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
    seguir("dicas", dicas);
    seguir("votos", votos);
    seguir("chutes", chutes);
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

  // quem manda o jogo andar: o anfitrião (ou qualquer um, se ele sumir por muito tempo)
  function passo() {
    if (!sala || ["espera", "fim"].includes(sala.status)) return;
    atualizarRodada();
    const t = agora() - ms(sala.inicio);
    const chave = `${sala.status}-${sala.rodada}`;
    if (feito.has(chave)) return;
    const pode = souHost() || t > 120000;
    if (!pode) return;
    const de = { status: sala.status, rodada: sala.rodada };
    let campos = null;
    if (sala.status === "dicas") {
      const vs = vezes();
      if (agora() > vs[vs.length - 1].fim + 1500) campos = { status: "votacao" };
    } else if (sala.status === "votacao") {
      const vivos = sala.ordem.filter(ativo);
      const todos = vivos.every((u) => votos[`${sala.rodada}-${u}`]);
      if ((todos && t > 2500) || t > VOTO) {
        const a = apuracao();
        campos = a.pego && ativo(a.infiltrado) ? { status: "chute" } : { status: "placar" };
      }
    } else if (sala.status === "chute") {
      if (chutes[String(sala.rodada)] || t > CHUTE) campos = { status: "placar" };
    } else if (sala.status === "placar") {
      if (t > PLACAR) {
        const hist = [...(sala.historico ?? [])];
        if (sala.rodada + 1 < sala.total) campos = { status: "dicas", ...novaRodada(sala.rodada + 1, sala.ordem), historico: hist };
        else campos = { status: "fim" };
      }
    }
    if (!campos) return;
    // guarda tema/semente/ordem da rodada que acabou para refazer o placar depois
    if (sala.status === "placar" && campos.status === "dicas") {
      campos.historico[sala.rodada] = { tema: sala.tema, seed: sala.seed, ordem: sala.ordem };
    }
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
    title.append(el("strong", "", "🕵️ Como você quer aparecer no jogo?"), el("span", "muted", "É o mesmo nickname do ranking dos jogos."));
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
    if (!C) { box.append(el("p", "lt-erro", "O Infiltrado precisa de internet. Confira a conexão e recarregue a página.")); return; }
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
    criarCard.append(el("span", "lt-porta-ico", "🕵️"), el("h2", "", "Criar sala"),
      el("p", "muted", `Junte de ${MIN} a ${MAX} pessoas, cada uma no seu celular.`), criarBtn, criarMsg);
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
      "Todo mundo recebe a mesma palavra secreta, menos um: o infiltrado, que só sabe o tema.",
      "Na sua vez, dê uma dica de uma palavra sobre a palavra secreta. Nem fácil demais (o infiltrado descobre), nem difícil demais (acham que é você).",
      "O infiltrado também dá dicas, tentando se misturar.",
      "Depois, todo mundo vota em quem acha que é o infiltrado.",
      "Votou certo: +2. Infiltrado não foi pego: +4.",
      "Se o infiltrado for pego, ele ainda pode adivinhar a palavra: acertou, +3 para ele.",
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
      const convite = `🕵️ Bora jogar Infiltrado? Entra na minha sala com o código ${codigo}: ${linkSala()}`;
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
      ui.n = ui.n ?? 3;
      const escolha = el("div", "chips rl-quantos");
      [3, 5, 7].forEach((n) => {
        const b = btn("", `${n} rodadas`, () => { ui.n = n; escolha.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
        b.setAttribute("aria-pressed", n === ui.n);
        escolha.append(b);
      });
      const go = btn("button lt-go", js.length >= MIN ? "Começar 🕵️" : `Faltam ${MIN - js.length} para começar`, async () => {
        go.disabled = true;
        try { await C.fs.updateDoc(ref(codigo), { status: "dicas", total: ui.n, inicio: C.fs.serverTimestamp(), historico: [], ...novaRodada(0) }); }
        catch (e) { console.warn(e); go.disabled = false; window.siteToast?.("Não deu para começar agora"); }
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

  // ---------- rodada ----------
  function rodadaTela() {
    const nome = `${sala.status}-${sala.rodada}`;
    const nova = trocar(nome);
    if (nova) {
      const topo = el("div", "rl-topo");
      topo.append(el("span", "lt-sala", `Rodada ${sala.rodada + 1} de ${sala.total} · tema: ${sala.tema}`), el("span", "rl-tempo-txt"));
      ui.tempoTxt = topo.lastChild;
      ui.papel = papel();
      ui.corpo = el("div", "in-corpo");
      box.append(topo, ui.papel, ui.corpo);
      if (sala.status === "dicas") telaDicas();
      if (sala.status === "votacao") telaVoto();
      if (sala.status === "chute") telaChute();
      if (sala.status === "placar") telaPlacar();
    }
    atualizarRodada();
  }

  // cartão do papel: fica escondido até tocar (para quem está do lado não ver)
  function papel() {
    const { palavra, infiltrado } = segredo();
    const sou = infiltrado === C.uid;
    const card = el("button", "in-papel");
    card.type = "button";
    const frente = el("span", "in-papel-frente", "👆 Toque para ver sua palavra");
    const verso = el("span", "in-papel-verso");
    if (sou) verso.append(el("small", "", "Você é o"), el("strong", "", "🕵️ INFILTRADO"), el("small", "", `Tema: ${sala.tema}. Descubra a palavra pelas dicas dos outros!`));
    else verso.append(el("small", "", "A palavra secreta é"), el("strong", "", palavra), el("small", "", "Cuidado: tem um infiltrado no meio de vocês."));
    card.classList.toggle("infiltrado", sou);
    card.append(frente, verso);
    const virar = () => card.classList.toggle("aberto");
    card.addEventListener("click", virar);
    if (sala.status === "dicas" && agora() - ms(sala.inicio) < INTRO) { card.classList.add("aberto"); setTimeout(() => card.classList.remove("aberto"), INTRO - 500); }
    return card;
  }

  function telaDicas() {
    ui.vez = el("p", "in-vez");
    ui.lista = el("ol", "in-dicas");
    ui.form = el("form", "in-form");
    const input = el("input", "in-input");
    Object.assign(input, { maxLength: 20, placeholder: "Sua dica (uma palavra)", autocomplete: "off", enterKeyHint: "send" });
    input.setAttribute("aria-label", "Sua dica");
    const enviar = Object.assign(el("button", "button", "Enviar"), { type: "submit" });
    ui.erro = el("p", "rk-error");
    ui.form.append(input, enviar);
    ui.form.hidden = true;
    ui.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = input.value.trim().replace(/\s+/g, " ");
      const { palavra } = segredo();
      if (texto.length < 2) { ui.erro.textContent = "Escreva pelo menos 2 letras."; return; }
      if (!/^[\p{L}\p{N} -]+$/u.test(texto)) { ui.erro.textContent = "Use só letras, números, espaço ou hífen."; return; }
      if (BLOQ.some((b) => norm(texto).includes(b))) { ui.erro.textContent = "Essa não vale. Escolha outra dica."; return; }
      if (norm(texto).includes(norm(palavra)) || norm(palavra).includes(norm(texto))) { ui.erro.textContent = "Não vale falar a própria palavra! 😅"; return; }
      const v = vezAtual();
      if (!minhaVez(v)) return;
      enviar.disabled = true;
      try {
        await C.fs.setDoc(C.fs.doc(col(codigo, "dicas"), `${sala.rodada}-${v.volta}-${C.uid}`), { rodada: sala.rodada, volta: v.volta, texto, em: C.fs.serverTimestamp() });
        input.value = "";
        ui.erro.textContent = "";
      } catch (err) { console.warn(err); ui.erro.textContent = "Sua dica não foi. Tente de novo."; }
      enviar.disabled = false;
    });
    ui.input = input;
    ui.corpo.append(ui.vez, ui.form, ui.erro, ui.lista);
  }

  function telaVoto() {
    ui.corpo.append(el("h2", "in-titulo", "Quem é o infiltrado?"), el("p", "muted", "Leia as dicas e vote. Não dá para votar em você."));
    ui.lista = el("ol", "in-dicas compacta");
    ui.botoes = el("div", "in-votos");
    sala.ordem.filter((u) => u !== C.uid).forEach((u) => {
      const b = btn("in-voto", "", async () => {
        if (votos[`${sala.rodada}-${C.uid}`]) return;
        ui.botoes.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        b.classList.add("escolhido");
        try { await C.fs.setDoc(C.fs.doc(col(codigo, "votos"), `${sala.rodada}-${C.uid}`), { rodada: sala.rodada, alvo: u, em: C.fs.serverTimestamp() }); vibrar(20); }
        catch (e) { console.warn(e); ui.botoes.querySelectorAll("button").forEach((x) => { x.disabled = false; }); b.classList.remove("escolhido"); window.siteToast?.("Seu voto não foi. Tente de novo."); }
      });
      b.dataset.uid = u;
      b.append(avatar(u), el("span", "rl-nick", nick(u)));
      ui.botoes.append(b);
    });
    ui.status = el("p", "rl-status");
    ui.corpo.append(ui.botoes, ui.status, el("h3", "in-sub", "As dicas"), ui.lista);
  }

  function telaChute() {
    const a = apuracao();
    const sou = a.infiltrado === C.uid;
    ui.corpo.append(el("h2", "in-titulo", `${nick(a.infiltrado)} foi pego!`),
      el("p", "muted", sou ? "Última chance: qual era a palavra? Acertou, ganha 3 pontos." : `${nick(a.infiltrado)} era o infiltrado e agora tenta adivinhar a palavra…`));
    if (sou) {
      const grade = el("div", "rl-opcoes in-chutes");
      a.palavra && segredo().opcoes.forEach((p) => grade.append(btn("rl-opcao in-chute", p, async (e) => {
        grade.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        e.currentTarget.classList.add("escolhida");
        try { await C.fs.setDoc(C.fs.doc(col(codigo, "chutes"), String(sala.rodada)), { rodada: sala.rodada, por: C.uid, palavra: p, em: C.fs.serverTimestamp() }); }
        catch (err) { console.warn(err); grade.querySelectorAll("button").forEach((x) => { x.disabled = false; }); }
      })));
      ui.corpo.append(grade);
    } else {
      const aguarde = el("div", "lt-aguarde");
      aguarde.append(el("span", "lt-pulso"), el("span", "", "Esperando o chute…"));
      ui.corpo.append(aguarde);
    }
  }

  function telaPlacar() {
    const a = apuracao();
    ui.papel.remove();
    const rev = el("div", `in-revela ${a.pego ? (a.acertou ? "roubou" : "pego") : "escapou"}`);
    rev.append(el("p", "eyebrow", "O infiltrado era"), avatar(a.infiltrado, true), el("h2", "", nick(a.infiltrado)),
      el("p", "in-palavra", `A palavra era: ${a.palavra}`),
      el("p", "in-resumo", !a.escolhido ? "Deu empate na votação: ninguém foi expulso e o infiltrado escapou! +4 para ele."
        : !a.pego ? `Vocês expulsaram ${nick(a.escolhido)}, que era inocente. O infiltrado escapou! +4 para ele.`
          : a.acertou ? `Pego, mas adivinhou a palavra (${a.chute.palavra})! +3 para ele.`
            : `Pegaram o infiltrado!${a.chute ? ` Ele chutou "${a.chute.palavra}" e errou.` : " Ele não chutou a palavra."} Quem votou certo ganha +2.`));
    if (a.pego && !a.acertou && !reduced) rev.classList.add("festa");
    ui.corpo.append(rev);
    const votosEl = el("ul", "in-apuracao");
    sala.ordem.forEach((u) => {
      const li = el("li", u === a.infiltrado ? "inf" : "");
      li.append(avatar(u), el("span", "rl-nick", nick(u)),
        el("small", "muted", a.quem[u] ? `votou em ${nick(a.quem[u])}` : "não votou"),
        el("b", "", `${a.contagem[u]} ${a.contagem[u] === 1 ? "voto" : "votos"}`),
        el("b", "rl-ganhou", a.pts[u] ? `+${a.pts[u]}` : ""));
      votosEl.append(li);
    });
    ui.geral = el("div", "rl-geral");
    ui.proxima = el("p", "muted rl-proxima", sala.rodada + 1 < sala.total ? "Próxima rodada em instantes…" : "Já já sai o pódio…");
    ui.corpo.append(votosEl, ui.geral, ui.proxima);
    const geral = placar();
    ui.geral.append(el("h3", "", "Placar geral"));
    const ol = el("ol", "rl-rank pequeno");
    geral.forEach((j, k) => {
      const li = el("li", j.uid === C.uid ? "eu" : "");
      li.append(el("span", "rl-pos", `${k + 1}º`), avatar(j.uid), el("span", "rl-nick", j.nick), el("b", "", `${j.total} pts`));
      ol.append(li);
    });
    ui.geral.append(ol);
    vibrar(a.pego ? [40, 30, 40] : [120]);
  }

  // partes que mudam sem trocar de tela: relógio, vez, dicas e votos
  function atualizarRodada() {
    if (!sala || !ui.tempoTxt) return;
    const t = agora() - ms(sala.inicio);
    if (sala.status === "dicas") {
      const vs = vezes();
      const v = vezAtual();
      ui.tempoTxt.textContent = v ? `${Math.max(0, Math.ceil((v.fim - agora()) / 1000))} s` : "";
      const antes = agora() < ms(sala.inicio) + INTRO;
      const minha = minhaVez(v);
      ui.vez.replaceChildren();
      if (antes) ui.vez.append(el("strong", "", "Olhe sua palavra! As dicas começam já já…"));
      else if (!v) ui.vez.append(el("strong", "", "Dicas encerradas. Hora de votar…"));
      else if (minha) ui.vez.append(el("strong", "in-sua-vez", "⭐ Sua vez! Dê uma dica de uma palavra."));
      else ui.vez.append(avatar(v.uid), el("span", "", ` Vez de ${nick(v.uid)}…`));
      if (ui.form.hidden === !!minha) {
        ui.form.hidden = !minha;
        if (minha) { ui.input.focus(); vibrar(40); }
      }
      desenharDicas(vs);
    } else if (sala.status === "votacao") {
      ui.tempoTxt.textContent = `${Math.max(0, Math.ceil((VOTO - t) / 1000))} s`;
      desenharDicas(vezes());
      const feitos = sala.ordem.filter((u) => votos[`${sala.rodada}-${u}`]);
      ui.status.replaceChildren(el("span", "", `${feitos.length} de ${sala.ordem.length} votaram `));
      sala.ordem.forEach((u) => { const a = avatar(u); a.classList.toggle("pronto", feitos.includes(u)); a.title = nick(u); ui.status.append(a); });
      const meu = votos[`${sala.rodada}-${C.uid}`];
      if (meu) ui.botoes.querySelectorAll("button").forEach((b) => { b.disabled = true; b.classList.toggle("escolhido", b.dataset.uid === meu.alvo); });
    } else if (sala.status === "chute") {
      ui.tempoTxt.textContent = `${Math.max(0, Math.ceil((CHUTE - t) / 1000))} s`;
    } else ui.tempoTxt.textContent = "";
  }

  function desenharDicas(vs) {
    if (!ui.lista) return;
    const agoraMs = agora();
    const chave = vs.map((v) => `${v.uid}${v.volta}${v.dica ?? (agoraMs >= v.fim ? "-" : "")}`).join("|");
    if (ui.chaveDicas === chave) return;
    ui.chaveDicas = chave;
    ui.lista.replaceChildren(...vs.filter((v) => v.dica || agoraMs >= v.fim).map((v) => {
      const li = el("li", v.uid === C.uid ? "eu" : "");
      li.append(avatar(v.uid), el("span", "rl-nick", nick(v.uid)), v.dica ? el("strong", "in-dica", v.dica) : el("em", "muted", "passou a vez"));
      return li;
    }));
  }

  // ---------- fim ----------
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
    if (minha >= 0) card.append(el("p", "rl-minha", minha === 0 ? "🏆 Você venceu!" : `Você ficou em ${minha + 1}º lugar.`));
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

  // ---------- começo ----------
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") bater(); });

  async function comecarPagina() {
    R = window.cohabRanking;
    box.replaceChildren(el("p", "muted", "Conectando…"));
    try { C = await R.cloud(); } catch (e) { console.warn(e); C = null; }
    const pedido = (new URLSearchParams(location.search).get("sala") || "").replace(/\D/g, "");
    if (C && pedido.length === 4 && R.nick()) {
      try {
        if ((await C.fs.getDoc(C.fs.doc(col(pedido, "jogadores"), C.uid))).exists()) { abrir(pedido); return; }
      } catch (e) { console.warn(e); }
    }
    inicio();
  }

  if (window.cohabRanking) comecarPagina();
  else window.addEventListener("cohab-ranking", comecarPagina, { once: true });
})();
