// Regra ou mito? Arraste a carta: direita é regra (verdade), esquerda é mito (mentira)
(() => {
  const box = document.getElementById("rm");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // [afirmação, é verdade?, explicação] — regras da IBJJF para adultos
  const CARDS = [
    ["A montada vale 4 pontos.", true, "Montada e pegada nas costas são as posições que valem mais: 4 pontos."],
    ["A passagem de guarda vale 3 pontos.", true, "Passar a guarda e estabilizar ao lado vale 3 pontos."],
    ["A raspagem vale 2 pontos.", true, "Sair de baixo da guarda e terminar por cima vale 2 pontos."],
    ["A queda vale 2 pontos.", true, "Derrubar e ficar por cima, estabilizado, vale 2 pontos."],
    ["O joelho na barriga vale 2 pontos.", true, "Joelho no abdômen, com a outra perna livre, vale 2."],
    ["Pegar as costas com os dois ganchos vale 4 pontos.", true, "Com os dois ganchos por dentro das coxas, são 4 pontos."],
    ["Para pontuar, a posição precisa ficar estabilizada por 3 segundos.", true, "Toda posição precisa ser mantida por 3 segundos para valer pontos."],
    ["A finalização vence a luta, não importa o placar.", true, "Quem finaliza vence na hora, mesmo perdendo por muitos pontos."],
    ["A luta da faixa preta adulta dura 10 minutos.", true, "Branca 5, azul 6, roxa 7, marrom 8 e preta 10 minutos."],
    ["A luta da faixa branca adulta dura 5 minutos.", true, "A branca adulta luta 5 minutos; cada faixa acima ganha mais tempo."],
    ["Com os pontos empatados, vence quem tiver mais vantagens.", true, "As vantagens são o primeiro critério de desempate."],
    ["Desistir falando em voz alta também encerra a luta.", true, "Além de bater, a desistência verbal vale como finalização."],
    ["A faixa azul pode ser dada a partir dos 16 anos.", true, "A azul é a primeira faixa adulta, a partir dos 16."],
    ["No kimono, a chave de calcanhar (heel hook) é proibida.", true, "Pela IBJJF, a chave de calcanhar é proibida em todas as faixas no kimono."],
    ["Levantar o adversário e bater ele de costas no chão (slam) é proibido.", true, "O slam é falta grave e desclassifica."],
    ["Puxar para a guarda não vale pontos.", true, "Sentar ou puxar para a guarda é permitido, mas não pontua."],
    ["A chave de joelho só é permitida a partir da faixa marrom.", true, "Para adultos de kimono, a chave de joelho é liberada para marrom e preta."],
    ["A vantagem é dada quando o atleta quase completa uma posição que pontua.", true, "Quase passou, quase raspou, quase montou: vantagem."],
    ["O mata-leão é permitido para todas as faixas adultas.", true, "Estrangulamentos como o mata-leão são liberados desde a faixa branca."],
    ["A montada vale 3 pontos.", false, "Mito! A montada vale 4 pontos. Quem vale 3 é a passagem de guarda."],
    ["A passagem de guarda vale 4 pontos.", false, "Mito! A passagem vale 3. Montada e costas é que valem 4."],
    ["Cada vantagem vale 1 ponto no placar.", false, "Mito! Vantagem não soma pontos: só serve para desempatar."],
    ["Pegar as costas com um gancho só já vale 4 pontos.", false, "Mito! Sem os dois ganchos por dentro, a pegada nas costas não pontua."],
    ["Puxar para a guarda vale 2 pontos.", false, "Mito! Puxar para a guarda não vale nada no placar."],
    ["A raspagem vale 3 pontos.", false, "Mito! A raspagem vale 2."],
    ["A faixa preta pode ser dada aos 16 anos.", false, "Mito! A idade mínima para a faixa preta é 19 anos."],
    ["A luta da faixa preta adulta dura 5 minutos.", false, "Mito! A faixa preta luta 10 minutos. Quem luta 5 é a branca."],
    ["A finalização só vale se o placar estiver empatado.", false, "Mito! A finalização vence sempre, com qualquer placar."],
    ["No kimono, a faixa azul pode aplicar chave de calcanhar.", false, "Mito! A chave de calcanhar é proibida no kimono pela IBJJF."],
    ["O joelho na barriga vale 3 pontos.", false, "Mito! Joelho na barriga vale 2."],
    ["Fugir da montada com a ponte (upa) vale 2 pontos de raspagem.", false, "Mito! Raspagem só conta saindo da guarda. Fugir da montada não pontua."],
    ["A queda vale pontos mesmo se quem derrubou cair por baixo.", false, "Mito! Para valer, quem derrubou precisa terminar por cima e estabilizar."],
    ["A posição vale pontos assim que é alcançada, sem precisar segurar.", false, "Mito! É preciso estabilizar por 3 segundos."],
    ["A faixa branca pode aplicar chave de joelho no kimono.", false, "Mito! A chave de joelho só é liberada a partir da marrom."],
    ["Quem tem mais vantagens vence, mesmo com menos pontos.", false, "Mito! Os pontos vêm primeiro. A vantagem só desempata quando os pontos estão iguais."],
    ["Bater no tatame não conta como desistência; tem que bater no adversário.", false, "Mito! Bater no tatame ou no adversário: as duas formas valem como desistência."],
  ];
  const ROUND = 15;
  const PER = 8; // segundos por carta

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
    right: (n) => beep([660 + n * 30, 880 + n * 30]),
    wrong: () => beep([220, 160], 0.14, "square", 0.05),
    swoosh: () => beep([300, 500], 0.04, "triangle", 0.04),
    end: () => beep([523, 659, 784, 1046], 0.12),
  };

  const BELTS = [[0, "Faixa branca", "#f2f2f2"], [7, "Faixa azul", "#1f4fbf"], [10, "Faixa roxa", "#6a2fb3"], [12, "Faixa marrom", "#6b3e1e"], [14, "Faixa preta", "#111111"]];
  let s = null;

  function menu() {
    stop();
    box.replaceChildren();
    const best = store.get("rm-recorde", 0);
    const wrap = el("div", "pg-menu");
    wrap.append(
      el("p", "pg-kicker", `${CARDS.length} afirmações · regras da IBJJF`),
      el("h2", "", "Regra ou mito?"),
      el("p", "muted", `Aparecem ${ROUND} afirmações sobre as regras do jiu-jitsu. Arraste a carta para a direita se for regra (verdade) ou para a esquerda se for mito. Você tem ${PER} segundos por carta.`),
    );
    const demo = el("div", "rm-demo");
    demo.append(el("span", "rm-demo-l", "← Mito"), el("span", "rm-demo-card", "🃏"), el("span", "rm-demo-r", "Regra →"));
    const go = el("button", "button rm-go", "Começar");
    go.type = "button";
    go.addEventListener("click", start);
    wrap.append(demo, go, el("p", "pg-mode-best", best ? `🏆 Seu recorde: ${best.toLocaleString("pt-BR")} pontos` : ""),
      el("p", "muted rm-keys", "No computador, use as setas ← e →."));
    box.append(wrap);
  }

  function start() {
    s = { deck: shuffle(CARDS).slice(0, ROUND), i: 0, score: 0, right: 0, streak: 0, best: 0, misses: [], running: true, locked: true, q: PER, last: performance.now() };
    document.body.classList.add("pg-playing");
    box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    box.replaceChildren();
    const hud = el("div", "pg-hud");
    const left = el("div", "pg-hud-left");
    s.ui = { score: el("strong", "pg-score", "0"), combo: el("span", "pg-combo"), count: el("span", "pg-status") };
    left.append(el("span", "muted", "Pontos"), s.ui.score, s.ui.combo);
    const mute = el("button", "pg-mute", muted ? "🔇" : "🔊");
    mute.type = "button";
    mute.setAttribute("aria-label", "Ligar ou desligar o som");
    mute.addEventListener("click", () => { muted = !muted; store.set("pg-mudo", muted); mute.textContent = muted ? "🔇" : "🔊"; });
    hud.append(left, s.ui.count, mute);
    const bar = el("div", "pg-timer");
    s.ui.bar = bar;
    s.ui.fill = el("i");
    bar.append(s.ui.fill);
    s.ui.table = el("div", "rm-table");
    s.ui.result = el("div", "rm-result");
    s.ui.result.setAttribute("aria-live", "assertive");
    const btns = el("div", "rm-buttons");
    const no = el("button", "rm-btn no", "✗ Mito");
    no.type = "button";
    no.addEventListener("click", () => answer(false));
    const yes = el("button", "rm-btn yes", "✓ Regra");
    yes.type = "button";
    yes.addEventListener("click", () => answer(true));
    btns.append(no, yes);
    box.append(hud, bar, s.ui.table, s.ui.result, btns);
    next();
    requestAnimationFrame(tick);
  }

  function hud() {
    s.ui.score.textContent = s.score.toLocaleString("pt-BR");
    s.ui.combo.textContent = s.streak >= 5 ? "🔥 x2" : s.streak >= 2 ? `${s.streak} seguidos` : "";
    s.ui.combo.classList.toggle("hot", s.streak >= 5);
    s.ui.count.textContent = `${Math.min(s.i + 1, ROUND)}/${ROUND}`;
    s.ui.fill.style.width = `${(s.q / PER) * 100}%`;
    s.ui.bar.classList.toggle("low", s.q <= 3);
  }

  function next() {
    if (s.i >= ROUND) return end();
    const [text] = s.deck[s.i];
    s.q = PER;
    s.ui.result.replaceChildren();
    s.ui.result.className = "rm-result";
    const card = el("div", "rm-card");
    card.tabIndex = 0;
    card.append(el("span", "rm-stamp yes", "REGRA"), el("span", "rm-stamp no", "MITO"), el("p", "rm-num", `Carta ${s.i + 1}`), el("p", "rm-text", text));
    s.ui.table.replaceChildren(card);
    s.card = card;
    drag(card);
    requestAnimationFrame(() => card.classList.add("in"));
    s.locked = false;
    s.qStart = performance.now();
    hud();
  }

  // arrastar a carta com o dedo ou o mouse
  function drag(card) {
    let x0 = null, dx = 0;
    const yes = card.querySelector(".rm-stamp.yes"), no = card.querySelector(".rm-stamp.no");
    const move = (x) => {
      dx = x - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      yes.style.opacity = Math.max(0, Math.min(1, dx / 100));
      no.style.opacity = Math.max(0, Math.min(1, -dx / 100));
    };
    card.addEventListener("pointerdown", (e) => {
      if (s.locked) return;
      x0 = e.clientX;
      dx = 0;
      card.setPointerCapture(e.pointerId);
      card.classList.add("dragging");
    });
    card.addEventListener("pointermove", (e) => { if (x0 !== null) move(e.clientX); });
    const up = () => {
      if (x0 === null) return;
      x0 = null;
      card.classList.remove("dragging");
      if (Math.abs(dx) > 90) answer(dx > 0);
      else { card.style.transform = ""; yes.style.opacity = 0; no.style.opacity = 0; }
    };
    card.addEventListener("pointerup", up);
    card.addEventListener("pointercancel", up);
  }

  function tick(now) {
    if (!s?.running) return;
    const dt = Math.min(0.25, (now - s.last) / 1000);
    s.last = now;
    if (!s.locked && !document.hidden) {
      s.q -= dt;
      if (s.q <= 0) { s.q = 0; answer(null); }
      hud();
    }
    requestAnimationFrame(tick);
  }

  function answer(said) {
    if (!s || s.locked) return;
    s.locked = true;
    const [text, truth, why] = s.deck[s.i];
    const ok = said === truth;
    const card = s.card;
    // a carta voa para o lado escolhido (ou cai, se o tempo acabou)
    card.classList.add("out");
    card.style.transform = said === null ? "translateY(40px) scale(.9)" : `translateX(${said ? 520 : -520}px) rotate(${said ? 24 : -24}deg)`;
    card.querySelector(said ? ".rm-stamp.yes" : ".rm-stamp.no").style.opacity = said === null ? 0 : 1;
    sfx.swoosh();
    const r = s.ui.result;
    r.replaceChildren();
    if (ok) {
      s.right++;
      s.streak++;
      s.best = Math.max(s.best, s.streak);
      const speed = Math.max(0, Math.round((PER - (performance.now() - s.qStart) / 1000) * 8));
      const gained = (100 + speed) * (s.streak >= 5 ? 2 : 1);
      s.score += gained;
      r.className = "rm-result good";
      r.append(el("strong", "", `✅ ${truth ? "É regra!" : "É mito!"} +${gained}`), el("span", "", why));
      sfx.right(Math.min(s.streak, 8));
    } else {
      s.streak = 0;
      s.misses.push([text, truth, why]);
      r.className = "rm-result bad";
      r.append(el("strong", "", said === null ? "⏰ Tempo esgotado" : `❌ ${truth ? "Era regra!" : "Era mito!"}`), el("span", "", why));
      sfx.wrong();
      try { navigator.vibrate?.(120); } catch { /* sem vibração */ }
    }
    s.i++;
    hud();
    setTimeout(() => { if (s?.running) next(); }, ok ? 1300 : 2600);
  }

  function stop() {
    if (s) s.running = false;
    document.body.classList.remove("pg-playing");
  }

  function end() {
    stop();
    sfx.end();
    const best = store.get("rm-recorde", 0);
    const record = s.score > best;
    if (record) store.set("rm-recorde", s.score);
    const [, beltName, beltColor] = BELTS.filter((b) => s.right >= b[0]).at(-1);
    box.replaceChildren();
    const card = el("div", "pg-end");
    if (record && s.score > 0) card.append(el("p", "pg-record", "🏆 Novo recorde!"));
    card.append(el("p", "muted", "Regra ou mito?"), el("p", "pg-final", s.score.toLocaleString("pt-BR")), el("h2", "", beltName));
    const belt = el("div", "quiz-belt");
    belt.style.background = beltColor;
    belt.append(el("span"));
    card.append(belt);
    const stats = el("ul", "pg-stats");
    [[`${s.right}/${ROUND}`, "acertos"], [`${Math.round((s.right / ROUND) * 100)}%`, "precisão"], [s.best, "maior sequência"]].forEach(([v, l]) => {
      const li = el("li");
      li.append(el("strong", "", String(v)), el("span", "", l));
      stats.append(li);
    });
    card.append(stats);
    const actions = el("div", "quiz-actions");
    const again = el("button", "button", "Jogar de novo");
    again.type = "button";
    again.addEventListener("click", start);
    const share = el("button", "share-btn", "Compartilhar ↗");
    share.type = "button";
    share.addEventListener("click", () => window.siteShare?.({
      title: "Regra ou mito? · Cohab Team",
      text: `Acertei ${s.right} de ${ROUND} no “Regra ou mito?” das regras do jiu-jitsu da Cohab Team (${beltName.toLowerCase()}). Consegue mais?`,
      url: location.href,
    }));
    const more = el("a", "share-btn", "Ver a pontuação");
    more.href = "jiujitsu.html#pontos";
    actions.append(again, share, more);
    const rk = window.cohabRanking?.badge("regras", s.score);
    if (rk) card.append(rk);
    card.append(actions);
    if (s.misses.length) {
      const rev = el("div", "pg-review");
      rev.append(el("h3", "", "Para revisar"));
      s.misses.forEach(([text, truth, why]) => {
        const row = el("div", "rm-miss");
        row.append(el("span", truth ? "rm-tag yes" : "rm-tag no", truth ? "Regra" : "Mito"));
        const t = el("div");
        t.append(el("strong", "", text), el("span", "", why));
        row.append(t);
        rev.append(row);
      });
      card.append(rev);
    }
    box.append(card);
    again.focus({ preventScroll: true });
  }

  document.addEventListener("keydown", (e) => {
    if (!s?.running || s.locked || e.target.closest?.("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); answer(true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); answer(false); }
  });

  menu();
})();
