// Luta ao vivo: duelo de quiz em tempo real, cada um no seu celular.
// A sala fica no Firebase (salas/{código}) e as respostas em salas/{código}/jogadas/{rodada}-{cor}.
// Quem acertou primeiro sai da hora do servidor, então os dois aparelhos chegam ao mesmo placar.
// As regras de segurança estão em firestore.rules.
(() => {
  const box = document.getElementById("luta");
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
  const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const RODADAS = 10;
  const INTRO = 2000; // tela "Pergunta 3 · Passagem +3" antes de liberar as respostas
  const TEMPO = 20000; // tempo para responder
  const PAUSA = 4000; // mostra o resultado da pergunta antes da próxima
  const FINALIZA = 12; // abriu 12 pontos: finalização
  const BATIDA = 10000; // "ainda estou aqui" a cada 10 s
  const SUMIU = 45000; // sem sinal por 45 s: W.O.
  const VALIDADE = 60 * 60 * 1000; // a sala vale por 1 hora
  const GOLPES = [
    { pts: 2, nome: "Raspagem", faixas: ["branca", "azul"], n: 4 },
    { pts: 3, nome: "Passagem de guarda", faixas: ["roxa", "marrom"], n: 3 },
    { pts: 4, nome: "Montada", faixas: ["preta"], n: 3 },
  ];
  const golpe = (pts) => GOLPES.find((g) => g.pts === pts);
  const COR = { azul: "Azul", branco: "Branco" };
  const outra = (c) => (c === "azul" ? "branco" : "azul");
  const MOTIVO = {
    finalizacao: "por finalização",
    pontos: "nos pontos",
    vantagens: "nas vantagens",
    punicoes: "por menos punições",
    wo: "por W.O.",
    empate: "",
  };

  // ---------- estado ----------
  let R; // window.cohabRanking
  let C; // { fs, db, uid }
  let codigo = null;
  let sala = null;
  let jogadas = {};
  let cor = null;
  let offset = 0; // relógio do servidor menos o deste aparelho
  let desligar = [];
  let tick = null;
  let batida = null;
  let ui = null; // tela da luta montada
  let tela = null;
  let token = null;
  let revancheContra = null; // nick de quem vai aceitar a revanche que pedimos
  const feito = new Set(); // ações que já tentamos nesta rodada (avançar, terminar)

  const agora = () => Date.now() + offset;
  const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);
  const salaRef = (c) => C.fs.doc(C.db, "salas", c);
  const jogadasRef = (c) => C.fs.collection(C.db, "salas", c, "jogadas");
  const nickDe = (c) => (c === "azul" ? sala.nickAzul : sala.nickBranco) || COR[c];
  const vibrar = (p) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // o navegador só deixa depois de um toque
    try { navigator.vibrate?.(p); } catch { /* sem vibração */ }
  };

  // ---------- perguntas ----------
  // A sala guarda só "faixa:número:ordem" de cada pergunta do banco oficial (perguntas.js), nunca o texto:
  // assim ninguém consegue mostrar uma pergunta inventada para o adversário.
  // "ordem" diz em que posição aparece cada opção (0 é a certa).
  // Temas: o jiu-jitsu usa perguntas.js por faixa ("faixa:número:ordem"); os outros temas usam
  // temas-luta.js por nível ("tema:nível:número:ordem", nível f/m/d = fácil/médio/difícil).
  const banco = () => Object.fromEntries(window.COHAB_QUIZ.LEVELS.map((l) => [l.id, l.questions]));
  const EXTRAS = () => window.COHAB_TEMAS ?? {};
  const ptsDa = (i) => (i < 4 ? 2 : i < 7 ? 3 : 4); // 4 raspagens, 3 passagens, 3 montadas
  const nivelDa = (i) => "fmd"[i < 4 ? 0 : i < 7 ? 1 : 2];
  const temas = () => ({
    jiujitsu: { nome: "Jiu-jitsu", ico: "🥋" },
    ...Object.fromEntries(Object.entries(EXTRAS()).map(([k, t]) => [k, { nome: t.nome, ico: t.ico }])),
    mix: { nome: "Misturado", ico: "🎲" },
  });
  const temaDe = (k) => temas()[k] ?? temas().jiujitsu;

  function sortear(tema) {
    const B = banco(), T = EXTRAS();
    const ordem = () => shuffle(["0", "1", "2", "3"]).join("");
    const usadas = new Set();
    const textoDe = (id) => { const p = id.split(":"); return (p.length === 2 ? B[p[0]][p[1]] : T[p[0]][p[1]][p[2]])[0]; };
    return GOLPES.flatMap((g, gi) => {
      const nivel = "fmd"[gi];
      // cada fonte de perguntas deste nível (no misturado, sorteia a fonte de cada pergunta)
      const fontes = {};
      if (tema === "jiujitsu" || tema === "mix") fontes.jiujitsu = shuffle(g.faixas.flatMap((f) => B[f].map((_, i) => `${f}:${i}`)));
      Object.keys(T).forEach((t) => { if (tema === t || tema === "mix") fontes[t] = shuffle(T[t][nivel].map((_, i) => `${t}:${nivel}:${i}`)); });
      const ids = [];
      while (ids.length < g.n) {
        const vivas = Object.keys(fontes).filter((f) => fontes[f].length);
        if (!vivas.length) break;
        const id = fontes[vivas[Math.floor(Math.random() * vivas.length)]].pop();
        // no misturado, alguns temas têm perguntas iguais às do jiu-jitsu: não repete na mesma luta
        if (usadas.has(textoDe(id))) continue;
        usadas.add(textoDe(id));
        ids.push(id);
      }
      return ids.map((id) => `${id}:${ordem()}`);
    });
  }

  // transforma os números de volta nas perguntas; null se alguma não existir no banco
  function expandir(ids) {
    const B = banco();
    if (!Array.isArray(ids) || ids.length !== RODADAS) return null;
    const T = EXTRAS();
    const ps = ids.map((id, i) => {
      let item, ordem, faixa;
      const jj = /^(branca|azul|roxa|marrom|preta):(\d{1,2}):([0-3]{4})$/.exec(String(id));
      const tm = /^([a-z]+):([fmd]):(\d{1,2}):([0-3]{4})$/.exec(String(id));
      if (jj && GOLPES.find((g) => g.pts === ptsDa(i)).faixas.includes(jj[1])) { item = B[jj[1]][Number(jj[2])]; ordem = jj[3]; faixa = jj[1]; }
      else if (tm && T[tm[1]] && tm[2] === nivelDa(i)) { item = T[tm[1]][tm[2]][Number(tm[3])]; ordem = tm[4]; faixa = tm[1]; }
      if (!item || new Set(ordem).size !== 4) return null;
      const [q, certa, erradas, porque, img] = item;
      const base = [certa, ...erradas];
      const opcoes = [...ordem].map((k) => base[Number(k)]);
      return { q, opcoes, certa: ordem.indexOf("0"), porque, img: img || null, faixa, pts: ptsDa(i) };
    });
    return ps.every(Boolean) ? ps : null;
  }

  function foto(key) {
    const p = window.COHAB_QUIZ.PHOTOS[key];
    if (!p) return null;
    const [file, author, license] = p;
    const fig = el("figure", "quiz-photo lt-photo");
    const img = el("img");
    img.src = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`;
    img.alt = "Foto da pergunta";
    const cap = el("figcaption");
    const a = el("a", "", `Foto: ${author} · ${license}`);
    a.href = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
    a.target = "_blank";
    a.rel = "noopener";
    cap.append(a);
    fig.append(img, cap);
    return fig;
  }

  // ---------- placar: sai só das jogadas, igual nos dois aparelhos ----------
  function resultado(r) {
    const q = sala.perguntas[r];
    const js = ["azul", "branco"].map((c) => jogadas[`${r}-${c}`] && { cor: c, ...jogadas[`${r}-${c}`] }).filter(Boolean);
    const certas = js.filter((j) => j.escolha === q.certa)
      .sort((a, b) => (ms(a.em) ?? Infinity) - (ms(b.em) ?? Infinity) || (a.cor === "azul" ? -1 : 1));
    const erros = js.filter((j) => j.escolha !== q.certa).map((j) => j.cor);
    const esgotou = r === sala.rodada && agora() > ms(sala.inicio) + INTRO + TEMPO;
    const acabou = r < sala.rodada || sala.status === "fim" || certas.length > 0 || js.length === 2 || esgotou;
    return { r, q, js, vencedor: certas[0]?.cor ?? null, vantagem: certas[1]?.cor ?? null, erros, acabou, esgotou };
  }

  function placar() {
    const p = { azul: { pts: 0, v: 0, x: 0 }, branco: { pts: 0, v: 0, x: 0 } };
    const rodadas = [];
    const ate = sala.status === "luta" || sala.status === "fim" ? Math.min(sala.rodada, RODADAS - 1) : -1;
    for (let r = 0; r <= ate; r++) {
      const res = resultado(r);
      if (!res.acabou && !res.js.length) break;
      if (res.vencedor) p[res.vencedor].pts += res.q.pts;
      if (res.vantagem) p[res.vantagem].v++;
      res.erros.forEach((c) => p[c].x++);
      rodadas.push(res);
    }
    return { p, rodadas };
  }

  // quem venceu sai das respostas, não do que alguém gravou na sala (só o W.O. vem da sala,
  // e as regras só aceitam W.O. de quem desistiu ou contra quem está mesmo sem sinal)
  function veredito(p) {
    if (sala.motivo === "wo") return [sala.vencedor, "wo"];
    const dif = p.azul.pts - p.branco.pts;
    if (Math.abs(dif) >= FINALIZA) return [dif > 0 ? "azul" : "branco", "finalizacao"];
    if (sala.rodada >= RODADAS - 1) return decidir(p);
    return [null, "anulada"];
  }

  function decidir(p) {
    const a = p.azul, b = p.branco;
    if (a.pts !== b.pts) return [a.pts > b.pts ? "azul" : "branco", "pontos"];
    if (a.v !== b.v) return [a.v > b.v ? "azul" : "branco", "vantagens"];
    if (a.x !== b.x) return [a.x < b.x ? "azul" : "branco", "punicoes"];
    return ["empate", "empate"];
  }

  // ---------- Firebase ----------
  function nova(nick, tema) {
    const ts = C.fs.serverTimestamp();
    return {
      azul: C.uid, branco: null, nickAzul: nick, nickBranco: null, status: "espera", tema, perguntas: sortear(tema), rodada: 0,
      inicio: ts, criada: ts, vistoAzul: ts, vistoBranco: null, vencedor: null, motivo: null, revanche: null,
    };
  }
  const sortearCodigo = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  // apaga algumas salas vencidas (e as respostas delas) para o banco não acumular lixo
  async function limpar() {
    try {
      const { fs, db } = C;
      const velhas = await fs.getDocs(fs.query(fs.collection(db, "salas"),
        fs.where("criada", "<", fs.Timestamp.fromMillis(Date.now() - VALIDADE - 10 * 60 * 1000)), fs.limit(5)));
      for (const s of velhas.docs) {
        const js = await fs.getDocs(jogadasRef(s.id));
        await Promise.all(js.docs.map((d) => fs.deleteDoc(d.ref)));
        await fs.deleteDoc(s.ref);
      }
    } catch (e) { console.warn("Limpeza de salas antigas não rodou.", e); }
  }

  async function criar(tema) {
    const { fs, db } = C;
    for (let i = 0; i < 12; i++) {
      const c = sortearCodigo();
      const ok = await fs.runTransaction(db, async (t) => {
        const s = await t.get(salaRef(c));
        if (s.exists()) return false;
        t.set(salaRef(c), nova(R.nick(), tema));
        return true;
      });
      if (ok) { limpar(); return c; }
    }
    throw new Error("sem código livre");
  }

  // entra na sala (ou volta para ela depois de recarregar a página)
  async function entrar(c) {
    const { fs, db } = C;
    return fs.runTransaction(db, async (t) => {
      const s = await t.get(salaRef(c));
      if (!s.exists()) return "Não achamos essa sala. Confira o código.";
      const d = s.data();
      if (d.azul === C.uid || d.branco === C.uid) return null;
      if (Date.now() + offset > ms(d.criada) + VALIDADE) return "Essa sala já venceu. Peça um código novo.";
      if (d.status === "fim") return "Essa luta já terminou. Crie uma sala nova.";
      if (d.status !== "espera" || d.branco) return "Essa luta já começou com outra pessoa.";
      // "pronto": a luta só começa quando quem criou a sala estiver com a tela aberta
      t.update(salaRef(c), {
        branco: C.uid, nickBranco: R.nick(), status: "pronto", inicio: fs.serverTimestamp(), vistoBranco: fs.serverTimestamp(),
      });
      return null;
    });
  }
  // se outra pessoa entrou no mesmo instante, a primeira tentativa falha: tenta de novo para dar a mensagem certa
  const entrarDeNovo = (c) => entrar(c).catch(() => entrar(c));

  // quem criou a sala dá a largada quando vê que o adversário entrou
  async function largar() {
    const ts = C.fs.serverTimestamp();
    await C.fs.updateDoc(salaRef(codigo), { status: "luta", inicio: ts, vistoAzul: ts });
  }

  async function responder(i) {
    const r = sala.rodada;
    await C.fs.setDoc(C.fs.doc(jogadasRef(codigo), `${r}-${cor}`), { rodada: r, escolha: i, em: C.fs.serverTimestamp() });
  }

  async function avancar(r) {
    const { fs, db } = C;
    await fs.runTransaction(db, async (t) => {
      const d = (await t.get(salaRef(codigo))).data();
      if (d.status !== "luta" || d.rodada !== r) return;
      t.update(salaRef(codigo), { rodada: r + 1, inicio: fs.serverTimestamp() });
    });
  }

  async function terminar(vencedor, motivo) {
    const { fs, db } = C;
    await fs.runTransaction(db, async (t) => {
      const d = (await t.get(salaRef(codigo))).data();
      if (d.status !== "luta") return;
      t.update(salaRef(codigo), { status: "fim", vencedor, motivo });
    });
  }

  async function pedirRevanche() {
    const { fs, db } = C;
    return fs.runTransaction(db, async (t) => {
      const d = (await t.get(salaRef(codigo))).data();
      if (d.revanche) return d.revanche;
      for (let i = 0; i < 8; i++) {
        const c = sortearCodigo();
        if ((await t.get(salaRef(c))).exists()) continue;
        t.set(salaRef(c), nova(R.nick(), d.tema ?? "jiujitsu")); // revanche no mesmo tema
        t.update(salaRef(codigo), { revanche: c });
        return c;
      }
      throw new Error("sem código livre");
    });
  }

  function bater() {
    if (!sala || !cor || sala.status === "fim") return;
    batida = Date.now();
    // guarda o token de login para conseguir avisar o W.O. mesmo fechando a página
    C.user?.getIdToken().then((t) => { token = t; }).catch(() => null);
    C.fs.updateDoc(salaRef(codigo), { [cor === "azul" ? "vistoAzul" : "vistoBranco"]: C.fs.serverTimestamp() })
      .catch((e) => console.warn("Sinal de presença não foi.", e));
  }

  // ---------- acompanhar a sala ----------
  function parar() {
    desligar.forEach((f) => f());
    desligar = [];
    clearInterval(tick);
    tick = null;
    ui = null;
    tela = null;
    feito.clear();
  }

  function abrir(c) {
    parar();
    codigo = c;
    sala = null;
    jogadas = {};
    history.replaceState(null, "", `?sala=${c}`);
    const { fs } = C;
    let pendente = false;
    desligar.push(fs.onSnapshot(salaRef(c), { includeMetadataChanges: true }, (snap) => {
      if (!snap.exists()) { sala = null; codigo = null; history.replaceState(null, "", location.pathname); inicio("Essa sala foi fechada."); return; }
      const d = snap.data({ serverTimestamps: "estimate" });
      const perguntas = expandir(d.perguntas);
      if (!perguntas) { parar(); codigo = null; history.replaceState(null, "", location.pathname); inicio("Essa sala tem perguntas que não existem no site. Crie uma sala nova."); return; }
      sala = { ...d, perguntas };
      cor = sala.azul === C.uid ? "azul" : sala.branco === C.uid ? "branco" : null;
      // acerta o relógio: quando o servidor confirma o nosso sinal de presença, a hora gravada
      // é a do servidor no meio do caminho entre enviar e receber
      if (snap.metadata.hasPendingWrites) pendente = true;
      else if (pendente) {
        pendente = false;
        const meu = cor && ms(sala[cor === "azul" ? "vistoAzul" : "vistoBranco"]);
        if (meu && batida && Date.now() - batida < 5000) offset = meu - (batida + Date.now()) / 2;
      }
      desenhar();
    }, (e) => { console.warn(e); inicio("Perdemos a conexão com a sala. Tente entrar de novo."); }));
    desligar.push(fs.onSnapshot(jogadasRef(c), { includeMetadataChanges: true }, (snap) => {
      jogadas = {};
      // só vale resposta confirmada pelo servidor (com a hora oficial)
      snap.forEach((d) => { if (!d.metadata.hasPendingWrites) jogadas[d.id] = d.data(); });
      desenhar();
    }, (e) => console.warn(e)));
    bater();
    const pulso = setInterval(bater, BATIDA);
    desligar.push(() => clearInterval(pulso));
    tick = setInterval(passo, 200);
  }

  function desenhar() {
    if (!sala) return;
    if (!cor) { inicio("Essa luta já começou com outra pessoa."); return; }
    if (sala.status === "espera") return esperar();
    if (sala.status === "pronto") return pronto();
    if (sala.status === "luta") return lutar();
    return fim();
  }

  // a cada 200 ms: relógio, fim da pergunta, próxima pergunta e W.O.
  function passo() {
    if (!sala || sala.status !== "luta" || !ui) return;
    const r = sala.rodada;
    const res = resultado(r);
    atualizar(res);
    // W.O.: o outro sumiu
    // conta a partir do último sinal dele, mas nunca antes de a luta aparecer nesta tela
    const dele = ms(sala[cor === "azul" ? "vistoBranco" : "vistoAzul"]);
    const longe = dele ? Math.min(agora() - dele, Date.now() - ui.desde) : 0;
    ui.aviso.hidden = longe < 20000;
    if (longe >= 20000) ui.aviso.textContent = `📡 ${nickDe(outra(cor))} está sem sinal… W.O. em ${Math.max(0, Math.ceil((SUMIU - longe) / 1000))} s`;
    if (longe > SUMIU && !feito.has("wo")) {
      feito.add("wo");
      terminar(cor, "wo").catch((e) => { console.warn(e); feito.delete("wo"); });
      return;
    }
    if (!res.acabou) return;
    const chave = `fim-${r}`;
    if (!ui.acabouEm) ui.acabouEm = Date.now();
    if (Date.now() - ui.acabouEm < PAUSA || feito.has(chave)) return;
    feito.add(chave);
    const { p } = placar();
    const dif = p.azul.pts - p.branco.pts;
    const tentar = (acao) => acao.catch((e) => { console.warn(e); setTimeout(() => feito.delete(chave), 1500); });
    if (Math.abs(dif) >= FINALIZA) tentar(terminar(dif > 0 ? "azul" : "branco", "finalizacao"));
    else if (r >= RODADAS - 1) tentar(terminar(...decidir(p)));
    else tentar(avancar(r));
  }

  // ---------- telas ----------
  function trocar(nome) {
    if (tela === nome) return false;
    tela = nome;
    box.replaceChildren();
    box.dataset.tela = nome;
    return true;
  }

  function placarEl(p, destaque) {
    const board = el("div", "ar-board lt-board");
    ["azul", "branco"].forEach((c) => {
      const k = c === "azul" ? "a" : "b";
      const r = p[c];
      const row = el("div", `ar-row ${k}${c === cor ? " lt-eu" : ""}`);
      const name = el("span", "ar-name");
      name.append(el("i", `ar-gi ${k}`), el("span", "lt-nick", nickDe(c)));
      if (c === cor) name.append(el("small", "lt-voce", "você"));
      const pts = el("strong", "ar-pts", String(r.pts));
      const v = el("span", "ar-small v");
      v.append(el("b", "", String(r.v)), el("small", "", "V"));
      const x = el("span", "ar-small x");
      x.append(el("b", "", String(r.x)), el("small", "", "P"));
      row.append(name, v, x, pts);
      if (destaque === c && !reduced) row.classList.add("bump");
      board.append(row);
    });
    return board;
  }

  function semNick(depois) {
    const form = el("form", "rk-form lt-nickform");
    const title = el("div");
    title.append(el("strong", "", "🥋 Como você quer aparecer na luta?"),
      el("span", "muted", "É o mesmo nickname do ranking dos jogos."));
    const row = el("div", "rk-inline-row");
    const input = el("input");
    input.maxLength = 16;
    input.placeholder = "Ex.: Yago Faixa Azul";
    input.autocomplete = "nickname";
    input.setAttribute("aria-label", "Seu nickname");
    row.append(input, Object.assign(el("button", "button", "Salvar"), { type: "submit" }));
    const msg = el("p", "rk-error");
    msg.setAttribute("aria-live", "polite");
    form.append(title, row, msg);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = R.setNick(input.value);
      if (err) { msg.textContent = err; input.focus(); return; }
      R.sync();
      depois();
    });
    return form;
  }

  function inicio(msgErro) {
    parar();
    revancheContra = null;
    tela = "inicio";
    box.dataset.tela = "inicio";
    box.replaceChildren();
    if (!C) {
      box.append(el("p", "lt-erro", "A Luta ao vivo precisa de internet e da conexão com o Firebase. Confira a internet e recarregue a página."));
      return;
    }
    const pedido = new URLSearchParams(location.search).get("sala");
    if (msgErro) box.append(el("p", "lt-erro", msgErro));
    if (!R.nick()) {
      box.append(semNick(() => inicio(msgErro)));
      return;
    }
    const hello = el("div", "rk-hello lt-hello");
    const txt = el("div");
    txt.append(el("span", "muted", "Lutando como"), el("strong", "", R.nick()));
    hello.append(el("span", "rk-avatar", R.nick().slice(0, 1).toUpperCase()), txt,
      btn("share-btn", "✏️ Trocar", () => { box.replaceChildren(semNick(() => inicio())); }));
    box.append(hello);

    const portas = el("div", "lt-portas");
    // criar
    const criarCard = el("div", "lt-porta lt-porta-criar");
    criarCard.append(el("span", "lt-porta-ico", "🥋"), el("h2", "", "Criar luta"),
      el("p", "muted", "Escolha o tema. Você recebe um código de 4 números para mandar ao seu adversário e luta de Azul."));
    // tema da luta (fica lembrado para a próxima)
    let tema = temas()[store.get("lt-tema", "jiujitsu")] ? store.get("lt-tema", "jiujitsu") : "jiujitsu";
    const escolha = el("div", "lt-temas");
    escolha.setAttribute("role", "radiogroup");
    escolha.setAttribute("aria-label", "Tema da luta");
    Object.entries(temas()).forEach(([k, t]) => {
      const b = btn("lt-tema", "", () => {
        tema = k;
        store.set("lt-tema", k);
        escolha.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", x === b));
      });
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", k === tema);
      b.dataset.tema = k;
      b.append(el("span", "", t.ico), el("span", "", t.nome));
      escolha.append(b);
    });
    criarCard.append(escolha);
    const criarMsg = el("p", "rk-error");
    const criarBtn = btn("button lt-go", "Criar luta", async () => {
      criarBtn.disabled = true;
      criarBtn.textContent = "Criando a sala…";
      try { abrir(await criar(tema)); } catch (e) {
        console.warn(e);
        criarMsg.textContent = navigator.onLine === false ? "Sem internet agora." : "Não deu para criar a sala. Tente de novo.";
        criarBtn.disabled = false;
        criarBtn.textContent = "Criar luta";
      }
    });
    criarCard.append(criarBtn, criarMsg);
    // entrar
    const entrarCard = el("form", "lt-porta");
    entrarCard.append(el("span", "lt-porta-ico", "🔑"), el("h2", "", "Entrar com código"),
      el("p", "muted", "Recebeu um código? Digite aqui. Você luta de Branco."));
    const code = el("input", "lt-code-input");
    Object.assign(code, { inputMode: "numeric", maxLength: 4, placeholder: "0000", autocomplete: "off", value: (pedido || "").replace(/\D/g, "").slice(0, 4) });
    code.setAttribute("aria-label", "Código da sala");
    code.addEventListener("input", () => { code.value = code.value.replace(/\D/g, "").slice(0, 4); });
    const entrarBtn = Object.assign(el("button", "button lt-go", "Entrar na luta"), { type: "submit" });
    const entrarMsg = el("p", "rk-error");
    entrarMsg.setAttribute("aria-live", "polite");
    entrarCard.append(code, entrarBtn, entrarMsg);
    entrarCard.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (code.value.length !== 4) { entrarMsg.textContent = "O código tem 4 números."; code.focus(); return; }
      entrarBtn.disabled = true;
      entrarBtn.textContent = "Entrando…";
      try {
        const err = await entrarDeNovo(code.value);
        if (err) { entrarMsg.textContent = err; entrarBtn.disabled = false; entrarBtn.textContent = "Entrar na luta"; return; }
        abrir(code.value);
      } catch (e) {
        console.warn(e);
        entrarMsg.textContent = "Não deu para entrar agora. Tente de novo.";
        entrarBtn.disabled = false;
        entrarBtn.textContent = "Entrar na luta";
      }
    });
    portas.append(criarCard, entrarCard);
    box.append(portas, regras());
    if (pedido && !msgErro) code.focus();
  }

  function regras() {
    const d = el("details", "lt-regras");
    d.append(el("summary", "", "📜 Como funciona a luta"));
    const ul = el("ul");
    [
      `São ${RODADAS} perguntas. A mesma pergunta aparece para os dois ao mesmo tempo.`,
      "Quem acerta primeiro marca os pontos. A hora vale pelo servidor, não pelo celular.",
      ...GOLPES.map((g, i) => `${g.nome} +${g.pts}: perguntas ${["fáceis", "médias", "difíceis"][i]} (no jiu-jitsu, de faixa ${g.faixas.join(" e ")}).`),
      "Acertou, mas o outro foi mais rápido? Ganha 1 vantagem.",
      "Errou? Leva 1 punição. Cada um só responde uma vez por pergunta.",
      `Abriu ${FINALIZA} pontos de diferença: finalização, a luta acaba na hora.`,
      "Empate nos pontos: decide nas vantagens e depois nas punições, como na IBJJF.",
      "Saiu da luta ou ficou 45 segundos sem sinal: perde por W.O.",
    ].forEach((t) => ul.append(el("li", "", t)));
    d.append(ul);
    return d;
  }

  function linkSala() { return `${location.origin}${location.pathname}?sala=${codigo}`; }

  function esperar() {
    if (!trocar("espera")) return;
    const wrap = el("div", "lt-espera");
    const tm = temaDe(sala.tema);
    wrap.append(el("p", "eyebrow", `${revancheContra ? "Revanche · agora você é o Azul" : "Sala criada · você é o Azul"} · ${tm.ico} ${tm.nome}`),
      el("h2", "", revancheContra ? `Esperando ${revancheContra} aceitar a revanche` : "Mande este código para o seu adversário"));
    const digits = el("div", "lt-codigo");
    digits.setAttribute("aria-label", `Código ${codigo.split("").join(" ")}`);
    codigo.split("").forEach((d) => digits.append(el("span", "", d)));
    const convite = `🥋 Te desafio para uma Luta ao vivo (tema: ${tm.nome}) no site da Cohab! Entra com o código ${codigo}: ${linkSala()}`;
    const acoes = el("div", "lt-acoes");
    const zap = el("a", "button lt-zap", "Chamar no WhatsApp");
    zap.href = `https://wa.me/?text=${encodeURIComponent(convite)}`;
    zap.target = "_blank";
    zap.rel = "noopener";
    acoes.append(zap,
      btn("share-btn", "Compartilhar ↗", () => window.siteShare?.({ title: "Luta ao vivo · Cohab Team", text: convite, url: linkSala() })),
      btn("share-btn", "Copiar link", async () => {
        try { await navigator.clipboard.writeText(linkSala()); window.siteToast?.("Link copiado! 📋"); } catch { window.siteToast?.(`Código: ${codigo}`); }
      }));
    const esperando = el("div", "lt-aguarde");
    esperando.append(el("span", "lt-pulso"), el("span", "", revancheContra ? "O convite já apareceu na tela dele…" : "Esperando o adversário entrar…"));
    const cancelar = btn("share-btn lt-cancelar", "Cancelar sala", async () => {
      cancelar.disabled = true;
      try { await C.fs.deleteDoc(salaRef(codigo)); } catch (e) { console.warn(e); }
      codigo = null;
      history.replaceState(null, "", location.pathname);
      inicio();
    });
    wrap.append(digits, acoes, esperando, el("p", "muted lt-dica", "A sala vale por 1 hora. Deixe esta tela aberta: a luta começa sozinha quando ele entrar."), cancelar);
    box.append(wrap);
  }

  // Branco entrou: a luta começa quando quem criou a sala estiver com a página aberta
  // (ele pode estar no WhatsApp mandando o código, com o celular "dormindo" a página)
  function pronto() {
    if (cor === "azul" && !feito.has("largada")) {
      feito.add("largada");
      vibrar([80, 40, 80]);
      largar().catch((e) => { console.warn(e); setTimeout(() => { feito.delete("largada"); desenhar(); }, 2000); });
    }
    if (!trocar("pronto")) return;
    const wrap = el("div", "lt-espera");
    if (cor === "azul") {
      wrap.append(el("p", "eyebrow", "Adversário na área"), el("h2", "", `${nickDe("branco")} entrou! Começando…`));
    } else {
      wrap.append(el("p", "eyebrow", `Sala ${codigo} · você é o Branco · ${temaDe(sala.tema).ico} ${temaDe(sala.tema).nome}`), el("h2", "", `Esperando ${nickDe("azul")} voltar para a sala`));
      const esperando = el("div", "lt-aguarde");
      esperando.append(el("span", "lt-pulso"), el("span", "", "A luta começa sozinha quando ele abrir a página."));
      wrap.append(esperando, el("p", "muted lt-dica", "Ele pode estar no WhatsApp mandando o código. Se demorar, mande uma mensagem para ele voltar."),
        btn("share-btn lt-cancelar", "Sair da sala", () => { codigo = null; history.replaceState(null, "", location.pathname); inicio(); }));
    }
    box.append(wrap);
  }

  // ---------- luta ----------
  function lutar() {
    const nova = trocar("luta");
    if (nova) {
      ui = { rodada: -1, desde: Date.now() };
      ui.top = el("div", "lt-top");
      ui.board = el("div", "lt-board-wrap");
      ui.aviso = el("p", "lt-aviso");
      ui.aviso.hidden = true;
      ui.stage = el("div", "lt-stage");
      ui.stage.setAttribute("aria-live", "polite");
      const sair = btn("share-btn", "Desistir", () => {
        if (!confirm("Desistir da luta? Seu adversário vence por W.O.")) return;
        terminar(outra(cor), "wo").catch((e) => console.warn(e));
      });
      ui.top.append(el("span", "lt-sala", `Sala ${codigo} · ${temaDe(sala.tema).ico} ${temaDe(sala.tema).nome}`), sair);
      box.append(ui.top, ui.board, ui.aviso, ui.stage);
      if (!reduced) {
        const go = el("div", "lt-combate", "Combate!");
        box.append(go);
        setTimeout(() => go.remove(), 1600);
      }
    }
    if (ui.rodada !== sala.rodada) montarRodada();
    atualizar(resultado(sala.rodada));
  }

  function montarRodada() {
    const r = sala.rodada;
    const q = sala.perguntas[r];
    const g = golpe(q.pts);
    ui.rodada = r;
    ui.acabouEm = null;
    ui.mostrado = null;
    ui.placarVisto = null;
    ui.stage.replaceChildren();
    const head = el("div", "lt-head");
    const tag = el("span", `lt-golpe p${q.pts}`, `${g.nome} +${q.pts}`);
    // no misturado, mostra de que tema é a pergunta
    const de = sala.tema === "mix" ? ` · ${temaDe(q.faixa).ico} ${temaDe(q.faixa).nome}` : "";
    head.append(el("span", "muted", `Pergunta ${r + 1} de ${RODADAS}${de}`), tag);
    ui.bar = el("div", "lt-tempo");
    ui.fill = el("i");
    ui.secs = el("span", "lt-secs");
    ui.bar.append(ui.fill);
    const titulo = el("h2", "quiz-q lt-q", q.q);
    ui.opcoes = el("div", "quiz-options lt-opcoes");
    ui.botoes = q.opcoes.map((o, i) => {
      const b = btn("quiz-option", o, async () => {
        if (!podeResponder()) return;
        ui.escolhi = i;
        b.classList.add("lt-escolhida");
        ui.botoes.forEach((x) => { x.disabled = true; });
        try { await responder(i); } catch (e) {
          console.warn(e);
          ui.escolhi = null;
          b.classList.remove("lt-escolhida");
          ui.nota.textContent = "⏱️ Sua resposta não chegou a tempo.";
        }
      });
      b.disabled = true;
      ui.opcoes.append(b);
      return b;
    });
    ui.escolhi = jogadas[`${r}-${cor}`]?.escolha ?? null;
    ui.outro = el("p", "lt-outro");
    ui.nota = el("p", "quiz-why lt-nota");
    ui.intro = el("div", "lt-intro");
    ui.intro.append(el("span", "", `Pergunta ${r + 1}`), el("strong", "", g.nome), el("b", "", `+${q.pts}`));
    const relogio = el("div", "lt-tempo-row");
    relogio.append(ui.bar, ui.secs);
    ui.stage.append(head, relogio, titulo);
    const f = q.img ? foto(q.img) : null;
    if (f) ui.stage.append(f);
    ui.stage.append(ui.opcoes, ui.outro, ui.nota, ui.intro);
  }

  function podeResponder() {
    if (!sala || sala.status !== "luta" || ui.escolhi !== null) return false;
    if (jogadas[`${sala.rodada}-${cor}`]) return false;
    const t = agora() - ms(sala.inicio);
    return t >= INTRO && t < INTRO + TEMPO && !resultado(sala.rodada).acabou;
  }

  function atualizar(res) {
    if (!ui || ui.rodada !== res.r) return;
    const t = agora() - ms(sala.inicio);
    const resta = Math.max(0, INTRO + TEMPO - t);
    // introdução da pergunta
    ui.intro.classList.toggle("show", t < INTRO && !res.acabou);
    // relógio
    const frac = res.acabou ? (ui.fracFinal ??= Math.min(1, resta / TEMPO)) : Math.min(1, resta / TEMPO);
    if (!res.acabou) ui.fracFinal = undefined;
    ui.fill.style.transform = `scaleX(${frac})`;
    ui.bar.classList.toggle("urgente", !res.acabou && resta < 5000);
    ui.secs.textContent = res.acabou ? "" : `${Math.ceil(Math.min(resta, TEMPO) / 1000)} s`;
    // botões
    const pode = podeResponder();
    ui.botoes.forEach((b) => { b.disabled = !pode; });
    // o outro já respondeu?
    const dele = res.js.find((j) => j.cor !== cor);
    ui.outro.textContent = !res.acabou && dele ? `✋ ${nickDe(outra(cor))} já respondeu…` : "";
    // placar
    const { p } = placar();
    const assinatura = JSON.stringify(p);
    if (ui.placarVisto !== assinatura) {
      const destaque = res.acabou ? res.vencedor : null;
      ui.board.replaceChildren(placarEl(p, ui.placarVisto ? destaque : null));
      ui.placarVisto = assinatura;
    }
    // resultado da pergunta
    if (!res.acabou) return;
    const marca = `${res.vencedor}|${res.vantagem}|${res.erros.join()}|${res.esgotou}`;
    if (ui.mostrado === marca) return;
    const primeira = ui.mostrado === null;
    ui.mostrado = marca;
    ui.intro.classList.remove("show");
    ui.botoes.forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle("right", i === res.q.certa);
      b.classList.toggle("wrong", i === ui.escolhi && i !== res.q.certa);
    });
    const g = golpe(res.q.pts);
    const eu = cor, ele = outra(cor);
    let frase;
    if (res.vencedor === eu) frase = `🔥 Você acertou primeiro: ${g.nome.toLowerCase()}, +${res.q.pts}!`;
    else if (res.vencedor === ele) frase = `⚡ ${nickDe(ele)} acertou primeiro: +${res.q.pts} para o ${COR[ele]}.`;
    else if (res.erros.length === 2) frase = "❌ Os dois erraram.";
    else frase = "⏱️ Tempo esgotado: ninguém pontuou.";
    if (res.vantagem === eu) frase += " Você também acertou: ganhou 1 vantagem.";
    if (res.vantagem === ele) frase += ` ${nickDe(ele)} também acertou: 1 vantagem para ele.`;
    if (res.erros.includes(eu)) frase += " Você errou: 1 punição.";
    ui.nota.replaceChildren(el("strong", "", frase), el("span", "", ` ${res.q.porque}`));
    if (primeira && res.vencedor) estouro(res.vencedor, res.q.pts, g.nome);
  }

  function estouro(quem, pts, nome) {
    if (quem === cor) vibrar([40, 30, 80]);
    if (reduced) return;
    const pop = el("div", `lt-pop ${quem}`);
    pop.append(el("b", "", `+${pts}`), el("span", "", nome));
    box.append(pop);
    setTimeout(() => pop.remove(), 1500);
  }

  // ---------- fim ----------
  function fim() {
    // redesenha se chegar uma resposta atrasada ou um pedido de revanche
    const chave = `fim-${sala.revanche || ""}-${JSON.stringify(placar().p)}`;
    if (tela === chave) return;
    const primeira = !String(tela).startsWith("fim");
    trocar(chave);
    const { p, rodadas } = placar();
    const [venc, comoVenceu] = veredito(p);
    const ganhei = venc === cor;
    const card = el("div", `lt-fim ${venc === "empate" || !venc ? "empate" : ganhei ? "ganhou" : "perdeu"}`);
    const motivo = MOTIVO[comoVenceu] ?? "";
    let titulo, sub;
    if (!venc) { titulo = "Luta anulada"; sub = "A luta foi encerrada antes da hora e ninguém venceu."; }
    else if (venc === "empate") { titulo = "Empate!"; sub = "Mesmos pontos, vantagens e punições. Só uma revanche resolve."; }
    else if (comoVenceu === "wo") {
      titulo = ganhei ? "Vitória por W.O." : "Perdeu por W.O.";
      sub = ganhei ? `${nickDe(outra(cor))} saiu ou ficou sem sinal.` : `Você saiu ou ficou sem sinal, e ${nickDe(venc)} venceu por W.O.`;
    } else if (ganhei) { titulo = comoVenceu === "finalizacao" ? "Finalizou! 🥋" : "Você venceu!"; sub = `Vitória ${motivo}. Oss!`; }
    else { titulo = comoVenceu === "finalizacao" ? "Você bateu! 🫱" : "Não foi dessa vez"; sub = `${nickDe(venc)} venceu ${motivo}.`; }
    card.append(el("p", "eyebrow", `Sala ${codigo} · ${temaDe(sala.tema).ico} ${temaDe(sala.tema).nome} · ${rodadas.length} de ${RODADAS} perguntas`), el("h2", "", titulo), el("p", "lt-sub", sub));
    if (venc && venc !== "empate") {
      const braco = el("div", `lt-braco ${venc}`);
      braco.append(el("span", "", "✋"), el("strong", "", nickDe(venc)), el("small", "", `${COR[venc]} · vencedor`));
      card.append(braco);
    }
    card.append(placarEl(p));

    // pergunta por pergunta
    const lista = el("ol", "lt-resumo");
    rodadas.forEach((res) => {
      const li = el("li");
      const quem = res.vencedor ? `${COR[res.vencedor]} +${res.q.pts}` : "ninguém";
      li.append(el("span", `lt-dot ${res.vencedor || "x"}`), el("span", "lt-resumo-q", res.q.q), el("small", "muted", `${res.q.opcoes[res.q.certa]} · ${quem}`));
      lista.append(li);
    });
    if (rodadas.length) {
      const det = el("details", "lt-regras");
      det.append(el("summary", "", "📋 Pergunta por pergunta"), lista);
      card.append(det);
    }

    // vitória entra no ranking (uma vez por sala; W.O. não conta)
    if (ganhei && comoVenceu !== "wo") {
      const contadas = store.get("lt-contadas", []);
      if (!contadas.includes(codigo + ms(sala.criada))) {
        contadas.push(codigo + ms(sala.criada));
        store.set("lt-contadas", contadas.slice(-50));
        store.set("lt-vitorias", store.get("lt-vitorias", 0) + 1);
      }
      const rk = R.badge("luta", store.get("lt-vitorias", 0));
      if (rk) card.append(rk);
    }

    const acoes = el("div", "quiz-actions lt-acoes");
    if (sala.revanche) {
      const dono = sala.revanche;
      acoes.append(btn("button lt-go", "🔁 Aceitar a revanche", () => irRevanche(dono)));
      card.append(el("p", "lt-revanche", "🔁 Pediram revanche! Mesma dupla, perguntas novas."));
    } else {
      const rev = btn("button lt-go", "🔁 Pedir revanche", async () => {
        rev.disabled = true;
        rev.textContent = "Criando a revanche…";
        const contra = nickDe(outra(cor));
        try { const c = await pedirRevanche(); revancheContra = contra; irRevanche(c); } catch (e) {
          console.warn(e);
          // pediram revanche ao mesmo tempo: entra na que ficou valendo
          const d = (await C.fs.getDoc(salaRef(codigo)).catch(() => null))?.data();
          if (d?.revanche) { irRevanche(d.revanche); return; }
          rev.disabled = false;
          rev.textContent = "🔁 Pedir revanche";
          window.siteToast?.("Não deu para criar a revanche agora");
        }
      });
      acoes.append(rev);
    }
    acoes.append(
      btn("share-btn", "Nova luta", () => { codigo = null; history.replaceState(null, "", location.pathname); inicio(); }),
      btn("share-btn", "Compartilhar ↗", () => window.siteShare?.({
        title: "Luta ao vivo · Cohab Team",
        text: !venc ? "Bora uma Luta ao vivo de jiu-jitsu no site da Cohab? Te desafio:"
          : venc === "empate" ? `Empatei com ${nickDe(outra(cor))} na Luta ao vivo de jiu-jitsu da Cohab (${p[cor].pts} × ${p[outra(cor)].pts})! Te desafio:`
          : ganhei ? `Venci ${nickDe(outra(cor))} ${motivo} na Luta ao vivo de jiu-jitsu da Cohab (${p[cor].pts} × ${p[outra(cor)].pts})! Te desafio:`
            : `Perdi para ${nickDe(venc)} na Luta ao vivo de jiu-jitsu da Cohab, mas quero revanche! Te desafio:`,
        url: `${location.origin}${location.pathname}`,
      })),
    );
    card.append(acoes);
    box.append(card);
    if (primeira) {
      vibrar(ganhei ? [60, 40, 60, 40, 160] : [200]);
      if (ganhei && !reduced) confete(card);
    }
  }

  async function irRevanche(c) {
    try {
      const err = await entrarDeNovo(c);
      if (err) { window.siteToast?.(err); return; }
      abrir(c);
    } catch (e) { console.warn(e); window.siteToast?.("Não deu para entrar na revanche agora"); }
  }

  function confete(alvo) {
    const cores = ["#1f4fbf", "#f2f2f2", "#b3121b", "#f5c542", "#6a2fb3"];
    const chuva = el("div", "lt-confete");
    chuva.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 40; i++) {
      const c = el("i");
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = cores[i % cores.length];
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.setProperty("--x", `${(Math.random() - 0.5) * 160}px`);
      chuva.append(c);
    }
    alvo.append(chuva);
    setTimeout(() => chuva.remove(), 3200);
  }

  // ---------- começo ----------
  window.addEventListener("beforeunload", (e) => {
    if (sala?.status === "luta" && cor) { e.preventDefault(); e.returnValue = ""; }
  });
  // quem fecha a página no meio da luta perde por W.O. na hora. O Firebase não termina de gravar
  // com a página fechando, então vai pela API REST com keepalive (o navegador completa o envio sozinho)
  window.addEventListener("pagehide", () => {
    if (sala?.status !== "luta" || !cor || !C) return;
    const s = (v) => ({ stringValue: v });
    const campos = ["status", "vencedor", "motivo"].map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const url = `https://firestore.googleapis.com/v1/projects/${window.RANKING_CONFIG.projectId}/databases/(default)/documents/salas/${codigo}?${campos}`;
    try {
      fetch(url, {
        method: "PATCH",
        keepalive: true,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fields: { status: s("fim"), vencedor: s(outra(cor)), motivo: s("wo") } }),
      }).catch(() => null);
    } catch { /* se não der, o W.O. sai pelos 45 s sem sinal */ }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") bater(); });
  const rede = () => document.body.classList.toggle("lt-offline", navigator.onLine === false);
  window.addEventListener("online", rede);
  window.addEventListener("offline", rede);

  async function comecar() {
    R = window.cohabRanking;
    box.replaceChildren(el("p", "muted", "Conectando ao tatame…"));
    try { C = await R.cloud(); } catch (e) { console.warn(e); C = null; }
    const pedido = (new URLSearchParams(location.search).get("sala") || "").replace(/\D/g, "");
    // link de convite ou página recarregada no meio da luta
    if (C && pedido.length === 4 && R.nick()) {
      try {
        const s = await C.fs.getDoc(salaRef(pedido));
        const d = s.exists() ? s.data() : null;
        if (d && (d.azul === C.uid || d.branco === C.uid)) { abrir(pedido); return; }
      } catch (e) { console.warn(e); }
    }
    inicio();
  }

  if (window.cohabRanking) comecar();
  else window.addEventListener("cohab-ranking", comecar, { once: true });
})();
