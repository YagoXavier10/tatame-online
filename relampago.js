// Desafios relâmpago: minijogos rápidos para 2 a 8 jogadores, cada um no seu celular.
// A sala fica no Firebase em relampago/{código}; quem entra vira relampago/{código}/jogadores/{uid}
// e cada resultado vai para relampago/{código}/resultados/{rodada}-{uid}. Regras em firestore.rules.
// Todos jogam o mesmo desafio com a mesma "sorte" (semente), e o placar sai dos resultados.
(() => {
  const box = document.getElementById("relampago");
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
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vibrar = (p) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate?.(p); } catch { /* sem vibração */ }
  };

  const MAX = 8;
  const INTRO = 4000; // explicação do desafio antes de começar
  const PRAZO = 45000; // do começo da rodada até o último resultado valer (as regras aceitam até 50 s)
  const MOSTRA = 7000; // placar da rodada na tela antes da próxima
  const BATIDA = 20000; // "ainda estou aqui"
  const SUMIU = 50000; // sem sinal: não espera mais por ele
  const VALIDADE = 60 * 60 * 1000;
  const PONTOS = [10, 8, 6, 5, 4, 3, 2, 1];
  const AVATARES = ["🦁", "🐯", "🐻", "🦊", "🐼", "🐸", "🐵", "🦉", "🐙", "🦄", "🐲", "🐺", "🦈", "🐢", "🦅", "🐝"];

  // ---------- sorte igual para todos ----------
  function sorte(seed) {
    let a = seed >>> 0;
    const r = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (min, max) => min + Math.floor(r() * (max - min + 1));
    r.pick = (list) => list[Math.floor(r() * list.length)];
    r.shuffle = (list) => list.map((v) => [r(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    return r;
  }

  // ---------- os minijogos ----------
  // Cada um recebe a área de jogo e a sorte, e devolve um número: quanto maior, melhor.
  // "mostrar" transforma esse número em texto para o placar.
  const tempo = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  const acertosTempo = (v) => `${Math.floor(v / 100000)} acertos · ${tempo(100000 - (v % 100000))}`;
  const JOGOS = {
    reflexo: {
      nome: "Reflexo", ico: "⚡",
      como: "A tela fica vermelha. Quando ficar VERDE, toque o mais rápido que puder. Cuidado: se ficar AMARELA, é pegadinha! Tocou antes da hora? Queimou. São 3 tentativas.",
      mostrar: (v) => `${-v} ms de média`,
      jogar: reflexo,
    },
    memoria: {
      nome: "Memória", ico: "🧠",
      como: "Seis botões acendem numa sequência. Repita na mesma ordem. A cada acerto a sequência cresce e fica mais rápida. Quem for mais longe vence.",
      mostrar: (v) => `sequência de ${Math.floor(v / 100000)} · ${tempo(100000 - (v % 100000))}`,
      jogar: memoria,
    },
    conta: {
      nome: "Conta de cabeça", ico: "🔢",
      como: "Seis contas rápidas. Toque no resultado certo. Vale acertar e ser rápido.",
      mostrar: acertosTempo,
      jogar: conta,
    },
    contar: {
      nome: "Contar rápido", ico: "👀",
      como: "Um monte de figuras parecidas aparece por só 2 segundos. Depois, diga quantas tinha de uma delas. Cinco telas.",
      mostrar: acertosTempo,
      jogar: contar,
    },
    mira: {
      nome: "Na hora certa", ico: "🎯",
      como: "O marcador vai e volta na barra. Toque quando ele estiver bem no centro. Cinco toques, cada vez mais rápido.",
      mostrar: (v) => `${v} pontos de mira`,
      jogar: mira,
    },
    cor: {
      nome: "Ache a cor diferente", ico: "🎨",
      como: "Um dos quadrados tem uma cor quase igual às outras. Ache e toque nele. Cinco telas, cada vez mais difícil.",
      mostrar: acertosTempo,
      jogar: cor,
    },
  };
  const TIPOS = Object.keys(JOGOS);

  // tempo limite de cada minijogo (o resultado sai do que deu para fazer)
  const LIMITE = 32000;

  function reflexo(area, r, fim) {
    const tela = el("button", "rl-reflexo");
    tela.type = "button";
    const info = el("p", "rl-dica", "Tentativa 1 de 3");
    area.append(info, tela);
    const tempos = [];
    let estado = "pausa", verdeEm = 0, timer;
    const verde = () => {
      estado = "verde";
      tela.className = "rl-reflexo verde";
      tela.textContent = "TOQUE!";
      verdeEm = performance.now();
    };
    const proxima = () => {
      if (tempos.length === 3) { fim(-Math.round(tempos.reduce((a, b) => a + b, 0) / 3)); return; }
      info.textContent = `Tentativa ${tempos.length + 1} de 3`;
      estado = "vermelho";
      tela.className = "rl-reflexo vermelho";
      tela.textContent = "Espere…";
      const espera1 = 900 + r() * 3600;
      // pegadinha: às vezes fica amarelo antes do verde (tocar no amarelo também queima)
      if (r() < 0.55) {
        timer = setTimeout(() => {
          tela.className = "rl-reflexo amarelo";
          tela.textContent = "Ainda não…";
          timer = setTimeout(() => {
            tela.className = "rl-reflexo vermelho";
            tela.textContent = "Espere…";
            timer = setTimeout(verde, 500 + r() * 1500);
          }, 450 + r() * 400);
        }, espera1 * 0.6);
      } else timer = setTimeout(verde, espera1);
    };
    tela.addEventListener("pointerdown", () => {
      if (estado === "vermelho") {
        clearTimeout(timer);
        tempos.push(1000);
        estado = "pausa";
        tela.className = "rl-reflexo queimou";
        tela.textContent = "Queimou! +1000 ms";
        vibrar(150);
        setTimeout(proxima, 1100);
      } else if (estado === "verde") {
        const ms = Math.min(1000, Math.round(performance.now() - verdeEm));
        tempos.push(ms);
        estado = "pausa";
        tela.className = "rl-reflexo pausa";
        tela.textContent = `${ms} ms`;
        setTimeout(proxima, 900);
      }
    });
    proxima();
    return () => { clearTimeout(timer); if (tempos.length < 3) fim(-Math.round((tempos.reduce((a, b) => a + b, 0) + (3 - tempos.length) * 1000) / 3)); };
  }

  function memoria(area, r, fim) {
    const cores = ["#e5484d", "#1f4fbf", "#1a9a5c", "#f5c542", "#8e4ec6", "#f76b15"];
    const seq = Array.from({ length: 20 }, () => r.int(0, cores.length - 1));
    const info = el("p", "rl-dica", "Preste atenção…");
    const grade = el("div", "rl-pads");
    const pads = cores.map((c, i) => {
      const b = btn("rl-pad");
      b.style.setProperty("--c", c);
      b.setAttribute("aria-label", `Botão ${i + 1}`);
      grade.append(b);
      return b;
    });
    area.append(info, grade);
    const t0 = performance.now();
    let nivel = 4, pos = 0, ouvindo = false, acabou = false;
    const acender = async (i, ms) => { pads[i].classList.add("on"); await espera(ms); pads[i].classList.remove("on"); };
    const mostrar = async () => {
      ouvindo = false;
      info.textContent = `Sequência de ${nivel}: preste atenção…`;
      await espera(500);
      // acende mais rápido a cada nível
      const on = Math.max(170, 330 - (nivel - 4) * 25), off = Math.max(70, 120 - (nivel - 4) * 8);
      for (let k = 0; k < nivel && !acabou; k++) { await acender(seq[k], on); await espera(off); }
      if (acabou) return;
      info.textContent = "Sua vez!";
      pos = 0;
      ouvindo = true;
    };
    const terminar = (n) => {
      if (acabou) return;
      acabou = true;
      const ms = Math.min(99999, Math.round(performance.now() - t0));
      fim(n * 100000 + (100000 - ms));
    };
    pads.forEach((p, i) => p.addEventListener("pointerdown", () => {
      if (!ouvindo || acabou) return;
      acender(i, 160);
      if (i !== seq[pos]) {
        ouvindo = false;
        info.textContent = `Errou! Você chegou na sequência de ${nivel - 1}.`;
        vibrar(150);
        setTimeout(() => terminar(nivel - 1), 900);
        return;
      }
      pos++;
      if (pos === nivel) {
        if (nivel === seq.length) { terminar(nivel); return; }
        nivel++;
        info.textContent = "Boa!";
        setTimeout(mostrar, 500);
      }
    }));
    mostrar();
    return () => terminar(nivel - 1);
  }

  // 4 opções: a certa e 3 vizinhas, sem repetir
  function opcoes(r, certa, perto, dezenas) {
    const set = new Set([certa]);
    // metade das erradas com o mesmo último dígito (±10, ±20) para o chute ficar difícil
    if (dezenas) [10, -10, 20].forEach((d) => { if (set.size < 3 && certa + d >= 0) set.add(certa + d); });
    while (set.size < 4) {
      const v = certa + r.int(-perto, perto);
      if (v >= 0 && v !== certa) set.add(v);
    }
    return r.shuffle([...set]);
  }

  // perguntas de múltipla escolha em sequência (usado pela conta e pelo contar)
  function rodadaDeEscolhas(area, total, montar, fim) {
    const info = el("p", "rl-dica");
    const palco = el("div", "rl-palco");
    area.append(info, palco);
    const t0 = performance.now();
    let i = 0, acertos = 0, acabou = false;
    const terminar = () => {
      if (acabou) return;
      acabou = true;
      const ms = Math.min(99999, Math.round(performance.now() - t0));
      fim(acertos * 100000 + (100000 - ms));
    };
    const proxima = async () => {
      if (acabou) return;
      if (i === total) { terminar(); return; }
      info.textContent = `${i + 1} de ${total} · ${acertos} ✓`;
      palco.replaceChildren();
      const { mostrar, certa, escolhas, pergunta } = montar(i);
      if (mostrar) await mostrar(palco);
      if (acabou) return;
      palco.replaceChildren(el("p", "rl-pergunta", pergunta));
      const grade = el("div", "rl-opcoes");
      escolhas.forEach((v) => grade.append(btn("rl-opcao", String(v), (e) => {
        const ok = v === certa;
        if (ok) acertos++;
        e.currentTarget.classList.add(ok ? "certa" : "errada");
        grade.querySelectorAll("button").forEach((b) => { b.disabled = true; });
        if (!ok) vibrar(80);
        i++;
        setTimeout(proxima, ok ? 250 : 600);
      })));
      palco.append(grade);
    };
    proxima();
    return terminar;
  }

  function conta(area, r, fim) {
    return rodadaDeEscolhas(area, 6, (i) => {
      const tipo = i < 2 ? "+" : i < 4 ? "−" : "×";
      let a, b, certa;
      if (tipo === "+") { a = r.int(37, 99); b = r.int(26, 99); certa = a + b; }
      else if (tipo === "−") { a = r.int(80, 199); b = r.int(17, a - 11); certa = a - b; }
      else { a = r.int(6, 15); b = r.int(4, 12); certa = a * b; }
      // erradas bem perto da certa (e com o mesmo final, para não dar para chutar pelo último dígito)
      return { pergunta: `${a} ${tipo} ${b} = ?`, certa, escolhas: opcoes(r, certa, 4, true) };
    }, fim);
  }

  function contar(area, r, fim) {
    // grupos de figuras parecidas: cada tela usa um grupo
    const grupos = [["🍎", "🍅", "🍒", "🍓", "🌶️"], ["🐶", "🐱", "🐭", "🐹", "🐰"], ["⚽", "🏀", "🏐", "⚾", "🥎"],
      ["🔴", "🟠", "🟡", "🟤", "🟣"], ["🌲", "🌳", "🌴", "🌵", "🎄"], ["😀", "😃", "😄", "😁", "😆"]];
    return rodadaDeEscolhas(area, 5, (i) => {
      const usadas = r.shuffle(r.pick(grupos)).slice(0, 3 + Math.min(i, 2));
      const qtd = usadas.map(() => r.int(3, 8 + i));
      const alvo = r.int(0, usadas.length - 1);
      const itens = r.shuffle(usadas.flatMap((f, k) => Array(qtd[k]).fill(f)));
      const certa = qtd[alvo];
      return {
        mostrar: async (palco) => {
          const campo = el("div", "rl-campo");
          itens.forEach((f) => {
            const s = el("span", "", f);
            s.style.left = `${4 + r() * 86}%`;
            s.style.top = `${4 + r() * 82}%`;
            campo.append(s);
          });
          palco.append(campo);
          await espera(2000);
        },
        pergunta: `Quantos ${usadas[alvo]} tinha?`,
        certa,
        escolhas: opcoes(r, certa, 2),
      };
    }, fim);
  }

  function mira(area, r, fim) {
    const info = el("p", "rl-dica", "Toque quando o marcador estiver no centro");
    const barra = el("div", "rl-barra");
    const alvoEl = el("i", "rl-alvo");
    const marca = el("b", "rl-marca");
    barra.append(alvoEl, marca);
    const toque = btn("button rl-toque", "TOQUE!");
    const notas = el("p", "rl-notas");
    area.append(info, barra, toque, notas);
    let n = 0, pontos = 0, acabou = false, raf;
    let fase = r() * Math.PI * 2;
    let ultimo = performance.now();
    const vel = () => 2.2 + n * 0.7 + r() * 0.3; // voltas por segundo (cresce a cada toque)
    let v = vel();
    const pos = () => (Math.sin(fase) + 1) / 2; // 0 a 1
    const anda = (agora) => {
      fase += ((agora - ultimo) / 1000) * v * Math.PI;
      ultimo = agora;
      marca.style.left = `${pos() * 100}%`;
      if (!acabou) raf = requestAnimationFrame(anda);
    };
    raf = requestAnimationFrame(anda);
    const terminar = () => {
      if (acabou) return;
      acabou = true;
      cancelAnimationFrame(raf);
      fim(pontos);
    };
    toque.addEventListener("pointerdown", () => {
      if (acabou) return;
      const erro = Math.abs(pos() - 0.5) * 2; // 0 no centro, 1 na ponta
      const p = Math.max(0, Math.round(200 * (1 - erro * 1.6)));
      pontos += p;
      n++;
      notas.textContent = `${notas.textContent ? `${notas.textContent} · ` : ""}${p}`;
      barra.classList.remove("acerto", "erro");
      void barra.offsetWidth;
      barra.classList.add(p >= 160 ? "acerto" : "erro");
      v = vel();
      if (n === 5) setTimeout(terminar, 400);
    });
    return terminar;
  }

  function cor(area, r, fim) {
    const info = el("p", "rl-dica");
    const grade = el("div", "rl-cores");
    area.append(info, grade);
    const t0 = performance.now();
    let i = 0, acertos = 0, acabou = false;
    const terminar = () => {
      if (acabou) return;
      acabou = true;
      const ms = Math.min(99999, Math.round(performance.now() - t0));
      fim(acertos * 100000 + (100000 - ms));
    };
    const tela = () => {
      if (acabou) return;
      if (i === 5) { terminar(); return; }
      info.textContent = `${i + 1} de 5 · ${acertos} ✓`;
      const lado = 4 + Math.min(i, 3); // 4x4 até 7x7
      const h = r.int(0, 359), s = r.int(45, 75), l = r.int(40, 60);
      const dif = [11, 8, 6, 5, 4][i];
      const certo = r.int(0, lado * lado - 1);
      grade.style.setProperty("--lado", lado);
      grade.replaceChildren();
      for (let k = 0; k < lado * lado; k++) {
        const q = btn("rl-q");
        q.style.background = `hsl(${h} ${s}% ${k === certo ? l + dif : l}%)`;
        q.setAttribute("aria-label", `Quadrado ${k + 1}`);
        q.addEventListener("pointerdown", () => {
          const ok = k === certo;
          if (ok) acertos++; else vibrar(80);
          grade.children[certo].classList.add("certa");
          grade.querySelectorAll("button").forEach((b) => { b.disabled = true; });
          i++;
          setTimeout(tela, ok ? 250 : 700);
        });
        grade.append(q);
      }
    };
    tela();
    return terminar;
  }

  // ---------- estado ----------
  let R, C;
  let codigo = null, sala = null, eu = null;
  let jogadores = {}, resultados = {};
  let offset = 0, batida = 0, pendente = false;
  let desligar = [], tick = null, tela = null;
  let jogando = null; // minijogo em andamento: { rodada, parar }
  const feito = new Set();
  const agora = () => Date.now() + offset;
  const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);
  const salaRef = (c) => C.fs.doc(C.db, "relampago", c);
  const jogRef = (c) => C.fs.collection(C.db, "relampago", c, "jogadores");
  const resRef = (c) => C.fs.collection(C.db, "relampago", c, "resultados");
  const sortearCodigo = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const souHost = () => sala && C && sala.host === C.uid;
  const lista = () => Object.entries(jogadores).map(([uid, j]) => ({ uid, ...j }))
    .sort((a, b) => (ms(a.entrou) ?? 0) - (ms(b.entrou) ?? 0));
  const ativos = () => lista().filter((j) => !ms(j.visto) || agora() - ms(j.visto) < SUMIU);

  // ---------- placar: sai dos resultados ----------
  function rodada(r) {
    const tipo = sala.desafios[r].split(":")[0];
    const lin = lista().map((j) => ({ ...j, valor: resultados[`${r}-${j.uid}`]?.valor ?? null }));
    const com = lin.filter((j) => j.valor !== null).sort((a, b) => b.valor - a.valor);
    // empate no mesmo valor divide a mesma posição
    let pos = 0;
    com.forEach((j, k) => {
      if (k > 0 && j.valor !== com[k - 1].valor) pos = k;
      j.pos = pos;
      j.ganhou = PONTOS[pos] ?? 1;
    });
    lin.filter((j) => j.valor === null).forEach((j) => { j.pos = null; j.ganhou = 0; });
    return { tipo, linhas: [...com, ...lin.filter((j) => j.valor === null)] };
  }

  function placar(ate) {
    const total = Object.fromEntries(lista().map((j) => [j.uid, 0]));
    for (let r = 0; r <= ate; r++) rodada(r).linhas.forEach((j) => { total[j.uid] = (total[j.uid] ?? 0) + j.ganhou; });
    return lista().map((j) => ({ ...j, total: total[j.uid] ?? 0 })).sort((a, b) => b.total - a.total);
  }

  // ---------- Firebase ----------
  async function limpar() {
    try {
      const { fs, db } = C;
      const velhas = await fs.getDocs(fs.query(fs.collection(db, "relampago"),
        fs.where("criada", "<", fs.Timestamp.fromMillis(Date.now() - VALIDADE - 10 * 60 * 1000)), fs.limit(3)));
      for (const s of velhas.docs) {
        for (const sub of [jogRef(s.id), resRef(s.id)]) {
          const ds = await fs.getDocs(sub);
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
        if ((await t.get(salaRef(c))).exists()) return false;
        const ts = fs.serverTimestamp();
        t.set(salaRef(c), { host: C.uid, status: "espera", rodada: 0, inicio: ts, criada: ts, desafios: [], revanche: null });
        return true;
      });
      if (ok) { await entrarComo(c); limpar(); return c; }
    }
    throw new Error("sem código livre");
  }

  async function entrarComo(c) {
    const { fs } = C;
    const ts = fs.serverTimestamp();
    const avatar = [...C.uid].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 1000003, 7) % AVATARES.length;
    await fs.setDoc(fs.doc(jogRef(c), C.uid), { nick: R.nick(), avatar, entrou: ts, visto: ts });
  }

  async function entrar(c) {
    const { fs } = C;
    const s = await fs.getDoc(salaRef(c));
    if (!s.exists()) return "Não achamos essa sala. Confira o código.";
    const d = s.data();
    const ja = await fs.getDoc(fs.doc(jogRef(c), C.uid));
    if (ja.exists()) return null; // voltando para a sala
    if (Date.now() + offset > ms(d.criada) + VALIDADE) return "Essa sala já venceu. Peça um código novo.";
    if (d.status === "fim") return "Esse jogo já terminou. Crie uma sala nova.";
    if (d.status !== "espera") return "Esse jogo já começou. Espere a próxima partida.";
    const qtd = (await fs.getDocs(jogRef(c))).size;
    if (qtd >= MAX) return `A sala está cheia (${MAX} jogadores).`;
    await entrarComo(c);
    return null;
  }

  async function comecar(n) {
    const desafios = [];
    const tipos = [...TIPOS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) desafios.push(`${tipos[i % tipos.length]}:${Math.floor(Math.random() * 1e9)}`);
    const ts = C.fs.serverTimestamp();
    await C.fs.updateDoc(salaRef(codigo), { status: "jogo", desafios, rodada: 0, inicio: ts });
  }

  async function avancar(r) {
    const { fs, db } = C;
    await fs.runTransaction(db, async (t) => {
      const d = (await t.get(salaRef(codigo))).data();
      if (d.status !== "jogo" || d.rodada !== r) return;
      if (r + 1 < d.desafios.length) t.update(salaRef(codigo), { rodada: r + 1, inicio: fs.serverTimestamp() });
      else t.update(salaRef(codigo), { status: "fim" });
    });
  }

  async function enviar(r, valor) {
    const { fs } = C;
    await fs.setDoc(fs.doc(resRef(codigo), `${r}-${C.uid}`), { rodada: r, valor: Math.round(valor), em: fs.serverTimestamp() });
  }

  async function revanche() {
    const { fs, db } = C;
    return fs.runTransaction(db, async (t) => {
      const d = (await t.get(salaRef(codigo))).data();
      if (d.revanche) return d.revanche;
      for (let i = 0; i < 8; i++) {
        const c = sortearCodigo();
        if ((await t.get(salaRef(c))).exists()) continue;
        const ts = fs.serverTimestamp();
        t.set(salaRef(c), { host: C.uid, status: "espera", rodada: 0, inicio: ts, criada: ts, desafios: [], revanche: null });
        t.update(salaRef(codigo), { revanche: c });
        return c;
      }
      throw new Error("sem código livre");
    });
  }

  function bater() {
    if (!codigo || !jogadores[C.uid] || sala?.status === "fim") return;
    batida = Date.now();
    C.fs.updateDoc(C.fs.doc(jogRef(codigo), C.uid), { visto: C.fs.serverTimestamp() }).catch(() => null);
  }

  // ---------- acompanhar a sala ----------
  function parar() {
    desligar.forEach((f) => f());
    desligar = [];
    clearInterval(tick);
    tick = null;
    jogando?.parar?.(true);
    jogando = null;
    tela = null;
    feito.clear();
  }

  function abrir(c) {
    parar();
    codigo = c;
    sala = null;
    jogadores = {};
    resultados = {};
    history.replaceState(null, "", `?sala=${c}`);
    const { fs } = C;
    desligar.push(fs.onSnapshot(salaRef(c), (snap) => {
      if (!snap.exists()) { codigo = null; history.replaceState(null, "", location.pathname); inicio("Essa sala foi fechada."); return; }
      sala = snap.data({ serverTimestamps: "estimate" });
      desenhar();
    }, (e) => { console.warn(e); inicio("Perdemos a conexão com a sala. Tente entrar de novo."); }));
    desligar.push(fs.onSnapshot(jogRef(c), { includeMetadataChanges: true }, (snap) => {
      jogadores = {};
      snap.forEach((d) => { jogadores[d.id] = d.data({ serverTimestamps: "estimate" }); });
      // acerta o relógio pela hora que o servidor gravou no nosso sinal de presença
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
    desligar.push(fs.onSnapshot(resRef(c), (snap) => {
      resultados = {};
      snap.forEach((d) => { if (!d.metadata.hasPendingWrites) resultados[d.id] = d.data(); });
      desenhar();
    }));
    bater();
    const pulso = setInterval(bater, BATIDA);
    desligar.push(() => clearInterval(pulso));
    tick = setInterval(passo, 300);
  }

  function desenhar() {
    if (!sala || !Object.keys(jogadores).length) return;
    if (!jogadores[C.uid] && sala.status !== "espera") { inicio("Esse jogo já começou sem você. Espere a próxima partida."); return; }
    if (sala.status === "espera") return salaEspera();
    if (sala.status === "jogo") return jogo();
    return fim();
  }

  // a cada 300 ms: relógio da rodada e quem avança
  function passo() {
    if (!sala || sala.status !== "jogo") return;
    const r = sala.rodada;
    const t = agora() - ms(sala.inicio);
    atualizarRelogio(t);
    const prontos = ativos().filter((j) => resultados[`${r}-${j.uid}`]).length;
    const todos = prontos >= ativos().length;
    // o placar da rodada aparece quando todos terminaram ou o tempo acabou
    if ((todos || t > PRAZO) && tela !== `res-${r}`) mostrarRodada();
    const fimDaRodada = todos ? (ui.todosEm ??= Date.now()) : null;
    const chave = `av-${r}`;
    if (feito.has(chave)) return;
    const hostPode = souHost() && ((todos && Date.now() - fimDaRodada > MOSTRA) || t > PRAZO + MOSTRA);
    const qualquerUm = t > 60000 + MOSTRA; // anfitrião sumiu
    if (hostPode || qualquerUm) {
      feito.add(chave);
      avancar(r).catch((e) => { console.warn(e); setTimeout(() => feito.delete(chave), 2000); });
    }
  }

  // ---------- telas ----------
  let ui = {};
  function trocar(nome) {
    if (tela === nome) return false;
    tela = nome;
    ui = {};
    box.replaceChildren();
    box.dataset.tela = nome;
    return true;
  }

  function avatar(j, grande) {
    const a = el("span", grande ? "rl-av grande" : "rl-av", AVATARES[j.avatar] ?? "🙂");
    a.setAttribute("aria-hidden", "true");
    return a;
  }

  function semNick(depois) {
    const form = el("form", "rk-form");
    const title = el("div");
    title.append(el("strong", "", "🎮 Como você quer aparecer no jogo?"), el("span", "muted", "É o mesmo nickname do ranking dos jogos."));
    const row = el("div", "rk-inline-row");
    const input = el("input");
    Object.assign(input, { maxLength: 16, placeholder: "Seu nickname", autocomplete: "nickname" });
    input.setAttribute("aria-label", "Seu nickname");
    row.append(input, Object.assign(el("button", "button", "Salvar"), { type: "submit" }));
    const msg = el("p", "rk-error");
    msg.setAttribute("aria-live", "polite");
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
    if (!C) {
      box.append(el("p", "lt-erro", "Os Desafios relâmpago precisam de internet. Confira a conexão e recarregue a página."));
      return;
    }
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
      criarBtn.textContent = "Criando…";
      try { abrir(await criar()); } catch (e) {
        console.warn(e);
        criarMsg.textContent = "Não deu para criar a sala. Tente de novo.";
        criarBtn.disabled = false;
        criarBtn.textContent = "Criar sala";
      }
    });
    criarCard.append(el("span", "lt-porta-ico", "⚡"), el("h2", "", "Criar sala"),
      el("p", "muted", `Você recebe um código para mandar aos amigos. Cabem até ${MAX} jogadores.`), criarBtn, criarMsg);

    const entrarCard = el("form", "lt-porta");
    const code = el("input", "lt-code-input");
    Object.assign(code, { inputMode: "numeric", maxLength: 4, placeholder: "0000", autocomplete: "off", value: pedido });
    code.setAttribute("aria-label", "Código da sala");
    code.addEventListener("input", () => { code.value = code.value.replace(/\D/g, "").slice(0, 4); });
    const entrarBtn = Object.assign(el("button", "button lt-go", "Entrar"), { type: "submit" });
    const entrarMsg = el("p", "rk-error");
    entrarMsg.setAttribute("aria-live", "polite");
    entrarCard.append(el("span", "lt-porta-ico", "🔑"), el("h2", "", "Entrar com código"),
      el("p", "muted", "Recebeu um código? Digite aqui."), code, entrarBtn, entrarMsg);
    entrarCard.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (code.value.length !== 4) { entrarMsg.textContent = "O código tem 4 números."; code.focus(); return; }
      entrarBtn.disabled = true;
      entrarBtn.textContent = "Entrando…";
      try {
        const err = await entrar(code.value);
        if (err) { entrarMsg.textContent = err; entrarBtn.disabled = false; entrarBtn.textContent = "Entrar"; return; }
        abrir(code.value);
      } catch (e) {
        console.warn(e);
        entrarMsg.textContent = "Não deu para entrar agora. Tente de novo.";
        entrarBtn.disabled = false;
        entrarBtn.textContent = "Entrar";
      }
    });
    portas.append(criarCard, entrarCard);

    const lista = el("div", "rl-lista-jogos");
    TIPOS.forEach((k) => {
      const j = JOGOS[k];
      const item = el("div", "rl-mini");
      item.append(el("span", "rl-mini-ico", j.ico), el("strong", "", j.nome), el("small", "muted", j.como));
      lista.append(item);
    });
    const det = el("details", "lt-regras");
    det.append(el("summary", "", "🎮 Os 6 desafios"), lista,
      el("p", "muted rl-pontos", `Em cada desafio: 1º lugar ganha ${PONTOS[0]} pontos, 2º ganha ${PONTOS[1]}, 3º ganha ${PONTOS[2]}… Quem somar mais no fim vence.`));
    box.append(portas, det);
    if (pedido) code.focus();
  }

  function linkSala() { return `${location.origin}${location.pathname}?sala=${codigo}`; }

  function salaEspera() {
    const nova = trocar("espera");
    if (nova) {
      const wrap = el("div", "lt-espera rl-espera");
      wrap.append(el("p", "eyebrow", "Sala de espera"), el("h2", "", "Código da sala"));
      const digits = el("div", "lt-codigo");
      codigo.split("").forEach((d) => digits.append(el("span", "", d)));
      const convite = `⚡ Bora jogar Desafios relâmpago? Entra na minha sala com o código ${codigo}: ${linkSala()}`;
      const acoes = el("div", "lt-acoes");
      const zap = el("a", "button lt-zap", "Chamar no WhatsApp");
      Object.assign(zap, { href: `https://wa.me/?text=${encodeURIComponent(convite)}`, target: "_blank", rel: "noopener" });
      acoes.append(zap,
        btn("share-btn", "Compartilhar ↗", () => window.siteShare?.({ title: "Desafios relâmpago", text: convite, url: linkSala() })),
        btn("share-btn", "Copiar link", async () => {
          try { await navigator.clipboard.writeText(linkSala()); window.siteToast?.("Link copiado! 📋"); } catch { window.siteToast?.(`Código: ${codigo}`); }
        }));
      ui.jogadores = el("ul", "rl-jogadores");
      ui.contagem = el("p", "rl-contagem");
      ui.controle = el("div", "rl-controle");
      wrap.append(digits, acoes, ui.contagem, ui.jogadores, ui.controle);
      box.append(wrap);
    }
    // jogadores
    const js = lista();
    ui.contagem.textContent = `${js.length} de ${MAX} jogadores`;
    ui.jogadores.replaceChildren(...js.map((j) => {
      const li = el("li", j.uid === C.uid ? "eu" : "");
      li.append(avatar(j), el("span", "rl-nick", j.nick));
      if (j.uid === sala.host) li.append(el("small", "rl-tag", "anfitrião"));
      else if (j.uid === C.uid) li.append(el("small", "rl-tag", "você"));
      return li;
    }));
    // controles
    const chaveControle = `${souHost()}-${js.length >= 2}`;
    if (ui.chaveControle === chaveControle) return;
    ui.chaveControle = chaveControle;
    ui.controle.replaceChildren();
    if (souHost()) {
      ui.n = ui.n ?? 5;
      const escolha = el("div", "chips rl-quantos");
      escolha.setAttribute("role", "group");
      escolha.setAttribute("aria-label", "Quantos desafios");
      [3, 5, 7].forEach((n) => {
        const b = btn("", `${n} desafios`, () => {
          ui.n = n;
          escolha.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        });
        b.setAttribute("aria-pressed", n === ui.n);
        escolha.append(b);
      });
      const go = btn("button lt-go", js.length >= 2 ? "Começar ⚡" : "Esperando mais jogadores…", async () => {
        go.disabled = true;
        try { await comecar(ui.n); } catch (e) { console.warn(e); go.disabled = false; window.siteToast?.("Não deu para começar agora"); }
      });
      go.disabled = js.length < 2;
      ui.controle.append(escolha, go);
    } else {
      const aguarde = el("div", "lt-aguarde");
      aguarde.append(el("span", "lt-pulso"), el("span", "", "Esperando o anfitrião começar…"));
      ui.controle.append(aguarde);
    }
    ui.controle.append(btn("share-btn lt-cancelar", souHost() ? "Fechar sala" : "Sair da sala", async () => {
      try {
        if (souHost()) {
          const ds = await C.fs.getDocs(jogRef(codigo));
          await Promise.all(ds.docs.map((d) => (d.id === C.uid ? null : C.fs.deleteDoc(d.ref).catch(() => null))));
          await C.fs.deleteDoc(C.fs.doc(jogRef(codigo), C.uid));
          await C.fs.deleteDoc(salaRef(codigo));
        } else await C.fs.deleteDoc(C.fs.doc(jogRef(codigo), C.uid));
      } catch (e) { console.warn(e); }
      codigo = null;
      history.replaceState(null, "", location.pathname);
      inicio();
    }));
  }

  // ---------- rodada ----------
  function jogo() {
    const r = sala.rodada;
    if (tela === `res-${r}`) return atualizarResultado();
    if (!trocar(`jogo-${r}`)) return atualizarEspera();
    const [tipo, seed] = sala.desafios[r].split(":");
    const J = JOGOS[tipo];
    if (!J) { box.append(el("p", "lt-erro", "Desafio desconhecido. Atualize a página.")); return; }
    const topo = el("div", "rl-topo");
    topo.append(el("span", "lt-sala", `Desafio ${r + 1} de ${sala.desafios.length}`), el("span", "rl-tempo-txt"));
    ui.tempoTxt = topo.lastChild;
    ui.barra = el("div", "lt-tempo");
    ui.barra.append(el("i"));
    const titulo = el("div", "rl-titulo");
    titulo.append(el("span", "rl-titulo-ico", J.ico), el("h2", "", J.nome));
    ui.area = el("div", "rl-area");
    ui.status = el("p", "rl-status");
    box.append(topo, ui.barra, titulo, ui.area, ui.status);

    // já mandou o resultado (voltou para a página)? só espera os outros
    if (resultados[`${r}-${C.uid}`]) { ui.enviado = true; ui.area.append(el("p", "rl-feito", "✅ Seu resultado já foi enviado.")); atualizarEspera(); return; }

    // explicação + contagem regressiva, presa ao relógio da rodada
    const intro = el("div", "rl-intro");
    const contagem = el("b", "rl-contagem-grande");
    intro.append(el("p", "", J.como), contagem);
    ui.area.append(intro);
    const comeca = ms(sala.inicio) + INTRO;
    const tickIntro = setInterval(() => {
      const falta = comeca - agora();
      if (falta > 0) { contagem.textContent = String(Math.ceil(falta / 1000)); return; }
      clearInterval(tickIntro);
      if (tela !== `jogo-${r}`) return;
      if (agora() > ms(sala.inicio) + PRAZO) { ui.area.replaceChildren(el("p", "rl-feito", "⏱️ O tempo dessa rodada acabou.")); return; }
      iniciarMinijogo(r, J, Number(seed));
    }, 100);
    ui.limpar = () => clearInterval(tickIntro);
  }

  function iniciarMinijogo(r, J, seed) {
    ui.area.replaceChildren();
    const area = el("div", `rl-jogo rl-jogo-${sala.desafios[r].split(":")[0]}`);
    ui.area.append(area);
    let enviado = false;
    const fim = (valor) => {
      if (enviado) return;
      enviado = true;
      clearTimeout(limite);
      jogando = null;
      ui.area.replaceChildren(el("p", "rl-feito", `✅ ${J.mostrar(valor)}`), el("p", "muted", "Enviando…"));
      enviar(r, valor).then(() => {
        ui.enviado = true;
        if (ui.area) ui.area.lastChild.textContent = "Esperando os outros terminarem…";
        atualizarEspera();
      }).catch((e) => {
        console.warn(e);
        if (ui.area) ui.area.lastChild.textContent = "⏱️ Seu resultado não chegou a tempo.";
      });
    };
    const parar = J.jogar(area, sorte(seed), fim);
    jogando = { rodada: r, parar };
    // tempo máximo do minijogo (e nunca depois do prazo da rodada)
    const resta = Math.min(LIMITE, ms(sala.inicio) + PRAZO - 1500 - agora());
    const limite = setTimeout(() => parar?.(), Math.max(1000, resta));
  }

  function atualizarRelogio(t) {
    if (!ui.barra || !tela?.startsWith("jogo-")) return;
    const resta = Math.max(0, PRAZO - t);
    ui.barra.firstChild.style.transform = `scaleX(${resta / PRAZO})`;
    ui.barra.classList.toggle("urgente", resta < 10000);
    ui.tempoTxt.textContent = `${Math.ceil(resta / 1000)} s`;
  }

  function atualizarEspera() {
    if (!ui.status) return;
    const r = sala.rodada;
    const js = ativos();
    const prontos = js.filter((j) => resultados[`${r}-${j.uid}`]);
    ui.status.replaceChildren();
    if (!ui.enviado && !prontos.length) return;
    ui.status.append(el("span", "", `${prontos.length} de ${js.length} terminaram `));
    js.forEach((j) => {
      const a = avatar(j);
      a.classList.toggle("pronto", !!resultados[`${r}-${j.uid}`]);
      a.title = j.nick;
      ui.status.append(a);
    });
  }

  function mostrarRodada() {
    const r = sala.rodada;
    jogando?.parar?.();
    ui.limpar?.();
    trocar(`res-${r}`);
    const { tipo, linhas } = rodada(r);
    const J = JOGOS[tipo];
    const card = el("div", "rl-resultado");
    card.append(el("p", "eyebrow", `Desafio ${r + 1} de ${sala.desafios.length} · ${J.ico} ${J.nome}`), el("h2", "", "Resultado"));
    const ol = el("ol", "rl-rank");
    linhas.forEach((j) => {
      const li = el("li", j.uid === C.uid ? "eu" : "");
      li.append(el("span", "rl-pos", j.pos === null ? "–" : j.pos < 3 ? ["🥇", "🥈", "🥉"][j.pos] : `${j.pos + 1}º`), avatar(j),
        el("span", "rl-nick", j.nick), el("small", "muted", j.valor === null ? "não terminou" : J.mostrar(j.valor)),
        el("b", "rl-ganhou", j.ganhou ? `+${j.ganhou}` : "0"));
      ol.append(li);
    });
    card.append(ol);
    ui.geral = el("div", "rl-geral");
    card.append(ui.geral);
    ui.proxima = el("p", "muted rl-proxima");
    card.append(ui.proxima);
    box.append(card);
    const meu = linhas.find((j) => j.uid === C.uid);
    if (meu?.pos === 0) vibrar([40, 30, 80]);
    atualizarResultado();
  }

  function atualizarResultado() {
    if (!ui.geral) return;
    const r = sala.rodada;
    const geral = placar(r);
    ui.geral.replaceChildren(el("h3", "", "Placar geral"));
    const ol = el("ol", "rl-rank pequeno");
    geral.forEach((j, k) => {
      const li = el("li", j.uid === C.uid ? "eu" : "");
      li.append(el("span", "rl-pos", `${k + 1}º`), avatar(j), el("span", "rl-nick", j.nick), el("b", "", `${j.total} pts`));
      ol.append(li);
    });
    ui.geral.append(ol);
    const ultima = r + 1 >= sala.desafios.length;
    ui.proxima.textContent = ultima ? "Já já sai o pódio…" : "Próximo desafio em instantes…";
  }

  // ---------- fim ----------
  function fim() {
    const chave = `fim-${sala.revanche || ""}-${Object.keys(resultados).length}`;
    if (tela === chave) return;
    const primeira = !String(tela).startsWith("fim");
    trocar(chave);
    const geral = placar(sala.desafios.length - 1);
    const card = el("div", "rl-fim");
    card.append(el("p", "eyebrow", `${sala.desafios.length} desafios · ${geral.length} jogadores`), el("h2", "", "Pódio"));
    const podio = el("div", "rl-podio");
    [1, 0, 2].forEach((k) => {
      const j = geral[k];
      if (!j) return;
      const col = el("div", `rl-degrau d${k + 1}`);
      col.append(avatar(j, true), el("strong", "", j.nick), el("span", "", `${j.total} pts`), el("b", "rl-degrau-n", `${k + 1}º`));
      podio.append(col);
    });
    card.append(podio);
    if (geral.length > 3) {
      const ol = el("ol", "rl-rank pequeno");
      ol.start = 4;
      geral.slice(3).forEach((j, k) => {
        const li = el("li", j.uid === C.uid ? "eu" : "");
        li.append(el("span", "rl-pos", `${k + 4}º`), avatar(j), el("span", "rl-nick", j.nick), el("b", "", `${j.total} pts`));
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
          const d = (await C.fs.getDoc(salaRef(codigo)).catch(() => null))?.data();
          if (d?.revanche) { irPara(d.revanche); return; }
          nova.disabled = false;
          window.siteToast?.("Não deu para criar a partida nova agora");
        }
      });
      acoes.append(nova);
    }
    acoes.append(btn("share-btn", "Sair", () => { codigo = null; history.replaceState(null, "", location.pathname); inicio(); }));
    card.append(acoes);
    box.append(card);
    if (primeira && minha === 0) {
      vibrar([60, 40, 60, 40, 160]);
      if (!reduced) confete(card);
    }
  }

  async function irPara(c) {
    try {
      const err = await entrar(c);
      if (err) { window.siteToast?.(err); return; }
      abrir(c);
    } catch (e) { console.warn(e); window.siteToast?.("Não deu para entrar agora"); }
  }

  function confete(alvo) {
    const cores = ["#1f4fbf", "#f2f2f2", "#b3121b", "#f5c542", "#1a9a5c"];
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
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") bater(); });
  window.addEventListener("beforeunload", (e) => {
    if (sala?.status === "jogo" && jogadores[C?.uid]) { e.preventDefault(); e.returnValue = ""; }
  });

  // modo treino: ?treino=reflexo (ou outro) joga um desafio sozinho, sem sala e sem internet
  function treino(tipo) {
    const J = JOGOS[tipo] ?? JOGOS.reflexo;
    box.replaceChildren();
    const titulo = el("div", "rl-titulo");
    titulo.append(el("span", "rl-titulo-ico", J.ico), el("h2", "", `Treino: ${J.nome}`));
    const area = el("div", `rl-jogo rl-jogo-${tipo}`);
    box.append(titulo, el("p", "muted", J.como), area);
    J.jogar(area, sorte(Math.floor(Math.random() * 1e9)), (valor) => {
      box.dataset.resultado = String(valor);
      area.replaceChildren(el("p", "rl-feito", `✅ ${J.mostrar(valor)}`),
        btn("button lt-go", "Treinar de novo", () => treino(tipo)));
    });
  }

  async function comecarPagina() {
    R = window.cohabRanking;
    const params = new URLSearchParams(location.search);
    if (params.has("treino")) { treino(params.get("treino")); return; }
    box.replaceChildren(el("p", "muted", "Conectando…"));
    try { C = await R.cloud(); } catch (e) { console.warn(e); C = null; }
    const pedido = (params.get("sala") || "").replace(/\D/g, "");
    if (C && pedido.length === 4 && R.nick()) {
      try {
        const ja = await C.fs.getDoc(C.fs.doc(jogRef(pedido), C.uid));
        if (ja.exists()) { abrir(pedido); return; }
      } catch (e) { console.warn(e); }
    }
    inicio();
  }

  if (window.cohabRanking) comecarPagina();
  else window.addEventListener("cohab-ranking", comecarPagina, { once: true });
})();
