// Árbitro por um dia: marque cada lance da luta como um árbitro da IBJJF e diga quem venceu
(() => {
  const box = document.getElementById("ar");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CALLS = {
    2: ["+2", "2 pontos"], 3: ["+3", "3 pontos"], 4: ["+4", "4 pontos"],
    V: ["Vantagem", "vantagem"], P: ["Punição", "punição"], 0: ["Nada", "nada"], F: ["Finalização", "finalização"],
  };
  const NAME = { a: "Azul", b: "Branco" };
  const WIN = { a: "Vitória do Azul", b: "Vitória do Branco", dec: "Decisão dos árbitros" };
  const BELT = { branca: ["Faixa branca", "#f2f2f2", "#111"], azul: ["Faixa azul", "#1f4fbf", "#fff"], roxa: ["Faixa roxa", "#6a2fb3", "#fff"], marrom: ["Faixa marrom", "#6b3e1e", "#fff"], preta: ["Faixa preta", "#111111", "#fff"] };

  /* Cada luta: lances [quem fez, o que aconteceu, marcação certa, explicação] e quem venceu */
  const FIGHTS = [
    {
      id: "primeira", belt: "branca", title: "Primeira luta", intro: "Luta simples para começar: só pontos e uma vantagem.",
      events: [
        ["a", "Azul entra na baiana, derruba o Branco e fica por cima, firme, por 3 segundos.", "2", "Queda com quem derrubou por cima e estabilizado: 2 pontos."],
        ["a", "Azul contorna as pernas do Branco e estabiliza no cem quilos por 3 segundos.", "3", "Passou a guarda e estabilizou: 3 pontos."],
        ["a", "Azul sobe o joelho na barriga do Branco e mantém, com a outra perna aberta.", "2", "Joelho na barriga estabilizado: 2 pontos."],
        ["a", "Azul tenta montar, mas o Branco coloca o joelho no meio antes de o Azul estabilizar.", "V", "Quase montou, mas não estabilizou: vantagem."],
        ["b", "Branco consegue recolocar a guarda e fica por baixo, se defendendo.", "0", "Recolocar a guarda é uma boa defesa, mas não vale pontos."],
      ],
      winner: "a", why: "O Azul venceu por 7 × 0 nos pontos.",
    },
    {
      id: "apertada", belt: "azul", title: "Luta apertada", intro: "Pouca pontuação: cada vantagem e punição conta.",
      events: [
        ["a", "Azul senta e puxa o Branco para a guarda.", "0", "Puxar para a guarda é permitido, mas não pontua."],
        ["b", "Branco quase passa: chega ao lado, mas o Azul repõe a guarda antes dos 3 segundos.", "V", "Quase passou, mas não estabilizou: vantagem para o Branco."],
        ["a", "Azul, por baixo, faz uma raspagem de tesoura e estabiliza por cima.", "2", "Saiu da guarda e terminou por cima: raspagem, 2 pontos."],
        ["b", "Branco, agora por baixo, fica muito tempo só segurando o kimono, sem tentar nada.", "P", "Falta de combatividade: punição para o Branco."],
        ["a", "Azul encaixa um gancho nas costas, mas o Branco escapa antes do segundo gancho.", "V", "Quase pegou as costas: vantagem para o Azul."],
      ],
      winner: "a", why: "O Azul venceu por 2 × 0 nos pontos. As vantagens nem precisaram desempatar.",
    },
    {
      id: "desempate", belt: "roxa", title: "Desempate", intro: "Pontos iguais no fim. Preste atenção nas vantagens.",
      events: [
        ["a", "Azul derruba o Branco com uma queda e estabiliza por cima.", "2", "Queda estabilizada: 2 pontos para o Azul."],
        ["b", "Branco, por baixo na guarda, raspa o Azul e estabiliza por cima.", "2", "Raspagem: 2 pontos para o Branco. Placar empatado."],
        ["a", "Azul quase raspa de volta: o Branco desequilibra, mas não cai.", "V", "Quase raspou: vantagem para o Azul."],
        ["b", "Branco quase passa a guarda, mas o Azul recupera antes de ele estabilizar.", "V", "Quase passou: vantagem para o Branco."],
        ["a", "Azul quase pega as costas, mas o Branco gira de frente a tempo.", "V", "Quase pegou as costas: mais uma vantagem para o Azul."],
        ["b", "Nos segundos finais, o Branco segura a luta de propósito, sem atacar.", "P", "Amarrar a luta para segurar o resultado é falta de combatividade: punição."],
      ],
      winner: "a", why: "Pontos empatados em 2 × 2. O Azul venceu nas vantagens: 2 × 1.",
    },
    {
      id: "virada", belt: "marrom", title: "A virada", intro: "O Azul começa perdendo feio. Será que vira?",
      events: [
        ["a", "Azul tenta uma queda, mas cai por baixo e o Branco termina por cima.", "0", "A queda só vale para quem derrubou se ele terminar por cima. E o Branco não raspou de uma guarda: ninguém pontua."],
        ["b", "Branco passa a guarda do Azul e estabiliza no cem quilos.", "3", "Passagem de guarda: 3 pontos para o Branco."],
        ["b", "Branco monta no Azul e estabiliza.", "4", "Montada: mais 4 pontos. Branco 7 × 0."],
        ["a", "Azul faz a ponte (upa) e inverte: agora está por cima, dentro da guarda do Branco.", "0", "Fugir da montada não é raspagem, porque não saiu de uma guarda. Não pontua."],
        ["a", "Azul passa a guarda do Branco e estabiliza no cem quilos.", "3", "Passagem: 3 pontos para o Azul."],
        ["a", "Azul sobe o joelho na barriga e mantém.", "2", "Joelho na barriga: 2 pontos. Azul 5 × 7."],
        ["a", "Azul passa para a montada e estabiliza.", "4", "Montada: 4 pontos. Azul 9 × 7!"],
      ],
      winner: "a", why: "Virada! O Azul venceu por 9 × 7.",
    },
    {
      id: "final", belt: "preta", title: "Final do absoluto", intro: "A grande final. Até o último segundo, tudo pode mudar.",
      events: [
        ["b", "Branco pega as costas do Azul com os dois ganchos e estabiliza.", "4", "Costas com os dois ganchos: 4 pontos para o Branco."],
        ["a", "Azul escapa das costas e fica por cima, dentro da guarda do Branco.", "0", "Escapar das costas é uma ótima defesa, mas não pontua."],
        ["b", "Branco, por baixo, raspa o Azul e estabiliza por cima.", "2", "Raspagem: 2 pontos. Branco 6 × 0."],
        ["a", "Cansado, o Azul fica parado por baixo, sem tentar nada, para descansar.", "P", "Falta de combatividade: punição para o Azul."],
        ["a", "Azul encaixa um triângulo da guarda fechada e o Branco bate.", "F", "Finalização! A luta acaba na hora."],
      ],
      winner: "a", why: "O Azul perdia por 6 × 0, mas finalizou. A finalização vence qualquer placar.",
    },
  ];

  // ---------- sons ----------
  let muted = store.get("pg-mudo", false);
  let audio;
  function beep(freqs, dur = 0.09, type = "sine", vol = 0.08) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        const t = audio.currentTime + i * dur;
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + dur);
      });
    } catch { /* sem áudio */ }
  }
  const sfx = {
    right: () => beep([660, 880]),
    wrong: () => beep([220, 160], 0.14, "square", 0.05),
    whistle: () => beep([1800, 2000, 1800], 0.07, "sine", 0.05),
    win: () => beep([523, 659, 784, 1046, 1318], 0.11),
  };

  const progress = () => store.get("ar-estrelas", {});
  const starsText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const beltTag = (belt) => {
    const [name, bg, fg] = BELT[belt];
    const t = el("span", "cm-belt", name);
    t.style.background = bg;
    t.style.color = fg;
    return t;
  };

  function menu() {
    document.body.classList.remove("pg-playing");
    box.replaceChildren();
    const got = progress();
    const total = Object.values(got).reduce((a, b) => a + b, 0);
    const head = el("div", "cm-menu-head");
    const t = el("div");
    t.append(el("p", "pg-kicker", `${FIGHTS.length} lutas · ${FIGHTS.reduce((n, f) => n + f.events.length, 0)} lances`), el("h2", "", "Escolha uma luta"));
    head.append(t, el("span", "cm-total", `⭐ ${total}/${FIGHTS.length * 3}`));
    box.append(head, el("p", "muted", "Você é o árbitro. A cada lance, marque pontos, vantagem, punição, finalização ou nada. No fim, diga quem venceu. As regras são as da IBJJF."));
    const list = el("div", "ar-list");
    FIGHTS.forEach((f, i) => {
      const b = el("button", "ar-fight");
      b.type = "button";
      const stars = got[f.id] || 0;
      const info = el("div", "cm-card-info");
      info.append(beltTag(f.belt), el("strong", "", f.title), el("span", "muted", f.intro));
      b.append(el("span", "ar-fight-num", String(i + 1)), info, el("span", stars ? "cm-stars got" : "cm-stars", stars ? starsText(stars) : `${f.events.length} lances`));
      b.addEventListener("click", () => play(i));
      list.append(b);
    });
    const legend = el("details", "ar-legend");
    legend.append(el("summary", "", "Cola do árbitro"));
    const ul = el("ul");
    ["Queda, raspagem e joelho na barriga: 2", "Passagem de guarda: 3", "Montada e costas com 2 ganchos: 4", "Toda posição precisa de 3 segundos", "Quase pontuou: vantagem", "Amarrar a luta: punição", "Desempate: pontos, depois vantagens, depois menos punições"]
      .forEach((x) => ul.append(el("li", "", x)));
    legend.append(ul);
    box.append(list, legend);
  }

  let g = null;
  function play(index) {
    document.body.classList.add("pg-playing");
    g = { f: FIGHTS[index], index, i: 0, hits: 0, errors: [], board: { a: { p: 0, v: 0, x: 0 }, b: { p: 0, v: 0, x: 0 } }, done: false };
    box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    box.replaceChildren();
    const hud = el("div", "cm-hud");
    const back = el("button", "cm-back", "← Lutas");
    back.type = "button";
    back.addEventListener("click", menu);
    const mute = el("button", "pg-mute", muted ? "🔇" : "🔊");
    mute.type = "button";
    mute.setAttribute("aria-label", "Ligar ou desligar o som");
    mute.addEventListener("click", () => { muted = !muted; store.set("pg-mudo", muted); mute.textContent = muted ? "🔇" : "🔊"; });
    g.ui = { hits: el("span", "ar-hits", "✓ 0") };
    hud.append(back, g.ui.hits, mute);
    const title = el("div", "ar-title");
    title.append(beltTag(g.f.belt), el("h2", "", g.f.title));
    g.ui.board = el("div", "ar-board");
    g.ui.stage = el("div", "ar-stage");
    box.append(hud, title, g.ui.board, g.ui.stage);
    drawBoard();
    sfx.whistle();
    showEvent();
  }

  function drawBoard(changed) {
    g.ui.board.replaceChildren();
    ["a", "b"].forEach((k) => {
      const r = g.board[k];
      const row = el("div", `ar-row ${k}`);
      const name = el("span", "ar-name");
      name.append(el("i", `ar-gi ${k}`), el("span", "", NAME[k]));
      const pts = el("strong", "ar-pts", String(r.p));
      const v = el("span", "ar-small v");
      v.append(el("b", "", String(r.v)), el("small", "", "V"));
      const x = el("span", "ar-small x");
      x.append(el("b", "", String(r.x)), el("small", "", "P"));
      row.append(name, v, x, pts);
      if (changed === k && !reduced) row.classList.add("bump");
      g.ui.board.append(row);
    });
  }

  function showEvent() {
    const [who, text] = g.f.events[g.i];
    const st = g.ui.stage;
    st.replaceChildren();
    const card = el("div", `ar-event ${who}`);
    card.append(el("p", "ar-step", `Lance ${g.i + 1} de ${g.f.events.length}`));
    const p = el("p", "ar-text");
    p.append(el("i", `ar-gi ${who}`), document.createTextNode(text));
    card.append(p);
    st.append(card, el("p", "ar-ask", `Como você marca para o ${NAME[who]}?`));
    const grid = el("div", "ar-calls");
    Object.entries(CALLS).forEach(([k, [label]]) => {
      const b = el("button", `ar-call c${k}`, label);
      b.type = "button";
      b.dataset.k = k;
      b.addEventListener("click", () => call(k, grid));
      grid.append(b);
    });
    st.append(grid);
    const fb = el("div", "cm-feedback");
    fb.setAttribute("aria-live", "assertive");
    st.append(fb);
    g.ui.fb = fb;
  }

  function apply(who, k) {
    const r = g.board[who];
    if (k === "2" || k === "3" || k === "4") r.p += Number(k);
    if (k === "V") r.v++;
    if (k === "P") r.x++;
  }

  function call(k, grid) {
    const [who, , right, why] = g.f.events[g.i];
    const ok = k === right;
    grid.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
      if (b.dataset.k === right) b.classList.add("right");
      else if (b.dataset.k === k) b.classList.add("wrong");
    });
    if (ok) { g.hits++; sfx.right(); } else {
      g.errors.push([g.f.events[g.i][1], CALLS[right][1], why]);
      sfx.wrong();
      try { navigator.vibrate?.(120); } catch { /* sem vibração */ }
    }
    g.ui.hits.textContent = `✓ ${g.hits}`;
    // o placar sempre mostra a marcação certa
    apply(who, right);
    drawBoard(right === "0" ? null : who);
    const fb = g.ui.fb;
    fb.className = `cm-feedback ${ok ? "good" : "bad"}`;
    fb.append(el("strong", "", ok ? "✅ Marcação certa!" : `❌ O certo era: ${CALLS[right][0]}`), el("p", "", why));
    const finished = right === "F" || g.i === g.f.events.length - 1;
    const next = el("button", "button cm-next", right === "F" ? "Encerrar a luta →" : finished ? "Acabou o tempo →" : "Próximo lance →");
    next.type = "button";
    next.addEventListener("click", () => { if (finished) decide(right === "F" ? who : null); else { g.i++; showEvent(); } });
    fb.append(next);
    next.focus({ preventScroll: true });
    fb.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }

  function decide(submitted) {
    sfx.whistle();
    const st = g.ui.stage;
    st.replaceChildren();
    const card = el("div", "ar-event end");
    card.append(el("p", "ar-step", submitted ? "Finalização!" : "Fim do tempo"),
      el("p", "ar-text", submitted ? `O ${NAME[submitted] === "Azul" ? "Branco" : "Azul"} bateu. Olhe o placar e decida: quem venceu?` : "O tempo acabou. Olhe o placar e decida: quem venceu?"));
    st.append(card);
    const grid = el("div", "ar-calls win");
    Object.entries(WIN).forEach(([k, label]) => {
      const b = el("button", `ar-call w${k}`, label);
      b.type = "button";
      b.dataset.k = k;
      b.addEventListener("click", () => verdict(k, grid));
      grid.append(b);
    });
    st.append(grid);
    const fb = el("div", "cm-feedback");
    st.append(fb);
    g.ui.fb = fb;
  }

  function verdict(k, grid) {
    const ok = k === g.f.winner;
    grid.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
      if (b.dataset.k === g.f.winner) b.classList.add("right");
      else if (b.dataset.k === k) b.classList.add("wrong");
    });
    if (ok) g.hits++; else g.errors.push(["Quem venceu a luta?", WIN[g.f.winner].toLowerCase(), g.f.why]);
    ok ? sfx.right() : sfx.wrong();
    const fb = g.ui.fb;
    fb.className = `cm-feedback ${ok ? "good" : "bad"}`;
    fb.append(el("strong", "", ok ? "✅ Isso mesmo!" : `❌ Foi: ${WIN[g.f.winner]}`), el("p", "", g.f.why));
    const next = el("button", "button cm-next", "Ver minha nota →");
    next.type = "button";
    next.addEventListener("click", finish);
    fb.append(next);
    next.focus({ preventScroll: true });
  }

  function finish() {
    document.body.classList.remove("pg-playing");
    sfx.win();
    const total = g.f.events.length + 1;
    const stars = g.errors.length === 0 ? 3 : g.errors.length <= 2 ? 2 : 1;
    const got = progress();
    if (stars > (got[g.f.id] || 0)) { got[g.f.id] = stars; store.set("ar-estrelas", got); }
    const titles = ["Árbitro estagiário", "Árbitro de academia", "Árbitro de campeonato", "Árbitro de Mundial"];
    const title = g.errors.length === 0 ? titles[3] : g.errors.length <= 1 ? titles[2] : g.errors.length <= 3 ? titles[1] : titles[0];
    box.replaceChildren();
    box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const card = el("div", "cm-end");
    const starRow = el("p", "cm-end-stars");
    [0, 1, 2].forEach((i) => {
      const s = el("span", i < stars ? "on" : "", "★");
      s.style.animationDelay = `${0.15 + i * 0.18}s`;
      starRow.append(s);
    });
    card.append(el("p", "cm-end-icon", "🧑‍⚖️"), el("h2", "", title), starRow, el("p", "muted", `${g.hits} de ${total} marcações certas em “${g.f.title}”`));
    const actions = el("div", "quiz-actions");
    const nextF = FIGHTS[g.index + 1];
    if (nextF) {
      const nx = el("button", "button", `Próxima luta: ${nextF.title} →`);
      nx.type = "button";
      nx.addEventListener("click", () => play(g.index + 1));
      actions.append(nx);
    }
    const again = el("button", nextF ? "share-btn" : "button", "Apitar de novo");
    again.type = "button";
    again.addEventListener("click", () => play(g.index));
    const all = el("button", "share-btn", "Todas as lutas");
    all.type = "button";
    all.addEventListener("click", menu);
    const share = el("button", "share-btn", "Compartilhar ↗");
    share.type = "button";
    share.addEventListener("click", () => window.siteShare?.({
      title: "Árbitro por um dia · Cohab Team",
      text: `Fui “${title.toLowerCase()}” apitando a luta “${g.f.title}” (${g.hits}/${total}) no jogo Árbitro por um dia da Cohab Team!`,
      url: location.href,
    }));
    actions.append(again, all, share);
    const totalStars = Object.values(progress()).reduce((a, b) => a + b, 0);
    const rk = window.cohabRanking?.badge("arbitro", totalStars);
    if (rk) card.append(rk);
    card.append(actions);
    if (g.errors.length) {
      const rev = el("div", "pg-review");
      rev.append(el("h3", "", "Para revisar"));
      g.errors.forEach(([lance, right, why]) => {
        const row = el("div", "rm-miss");
        row.append(el("span", "rm-tag yes", right));
        const t = el("div");
        t.append(el("strong", "", lance), el("span", "", why));
        row.append(t);
        rev.append(row);
      });
      card.append(rev);
    }
    box.append(card);
    actions.querySelector("button").focus({ preventScroll: true });
  }

  menu();
})();
