// Jogo das posições: reconheça a posição ou finalização da foto antes do tempo acabar
(() => {
  const box = document.getElementById("pg");
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

  // id: [nome, grupo, dica]
  const ANSWERS = {
    montada: ["Montada", "controle", "Sentado sobre o tronco, com os dois joelhos no chão. Vale 4 pontos."],
    cemquilos: ["Cem quilos", "controle", "Por cima, de lado e peito com peito. É o controle lateral."],
    kesa: ["Kesa-gatame", "controle", "Sentado de lado, abraçando a cabeça e prendendo um braço do adversário."],
    nortesul: ["Norte-sul", "controle", "Por cima, cabeça com cabeça, cada um virado para um lado."],
    costas: ["Pegada nas costas", "controle", "Atrás do adversário, com os dois ganchos por dentro. Vale 4 pontos."],
    joelho: ["Joelho na barriga", "controle", "Joelho no abdômen de quem está por baixo e a outra perna livre. Vale 2."],
    fechada: ["Guarda fechada", "guarda", "Por baixo, com as pernas cruzadas nas costas do adversário."],
    meia: ["Meia-guarda", "guarda", "Por baixo, prendendo só uma perna do adversário entre as suas."],
    dlr: ["Guarda De La Riva", "guarda", "Um gancho enrolado por fora da perna da frente do adversário."],
    aranha: ["Guarda aranha", "guarda", "Mãos nas mangas e pés empurrando os bíceps do adversário."],
    queda: ["Queda", "em pé", "Derrubar o adversário e ficar por cima. Vale 2 pontos."],
    mataleao: ["Mata-leão", "finalização", "Estrangulamento pelas costas, com o braço em volta do pescoço."],
    triangulo: ["Triângulo", "finalização", "Estrangulamento com as pernas, prendendo o pescoço e um braço."],
    armlock: ["Armlock", "finalização", "Chave que estica o braço e força o cotovelo."],
    kimura: ["Kimura", "finalização", "Chave de ombro com os dois braços, torcendo o braço para trás."],
    americana: ["Americana", "finalização", "Chave de ombro por cima, girando o braço dobrado para cima."],
    katagatame: ["Katagatame", "finalização", "Triângulo de mão: o braço do adversário aperta o próprio pescoço."],
    guilhotina: ["Guilhotina", "finalização", "Estrangulamento pela frente, com o braço em volta do pescoço."],
    omoplata: ["Omoplata", "finalização", "Chave de ombro feita com as pernas, a partir da guarda."],
    ezequiel: ["Ezequiel", "finalização", "Estrangulamento usando a própria manga, muitas vezes da montada."],
    chavejoelho: ["Chave de joelho", "finalização", "Estica a perna do adversário e força o joelho, como um armlock na perna."],
  };
  // posições que aparecem juntas na mesma foto e não podem ser opção uma da outra
  const AVOID = {
    costas: ["mataleao"], triangulo: ["fechada"], armlock: ["fechada"], kimura: ["fechada"], omoplata: ["fechada"],
    americana: ["cemquilos", "montada"], katagatame: ["cemquilos"], ezequiel: ["montada"], kesa: ["cemquilos"], cemquilos: ["montada"],
  };
  const ARMY = "Exército dos EUA";
  // [resposta, arquivo no Wikimedia Commons, autor, licença]
  const PHOTOS = [
    ["montada", "Tate-shiho-gatame.jpg", "Michael Hultström", "CC BY-SA 2.0"],
    ["montada", "Tate shiho gatame.jpg", "Lapate (Flickr)", "CC BY 2.0"],
    ["cemquilos", "Mune-gatame.jpg", "Michael Hultström", "CC BY-SA 2.0"],
    ["cemquilos", "Side-control to full-mount transition 110701-A-FJ360-054 (retouched).jpg", ARMY, "domínio público"],
    ["nortesul", "Kami-shiho-gatame.jpg", "Michael Hultström", "CC BY-SA 2.0"],
    ["nortesul", "North–south choke.JPG", "Jdcollins13", "CC BY-SA 3.0"],
    ["nortesul", "Fig4-1-north-south position.jpg", ARMY, "domínio público"],
    ["kesa", "Hon-kesa-gatame.jpg", "Michael Hultström", "CC BY-SA 3.0"],
    ["kesa", "Makura kesa gatame.jpg", "R. Grouls", "CC BY 2.5"],
    ["kesa", "Kata kesa gatame.jpg", "R. Grouls", "CC BY 2.5"],
    ["costas", "Back mount.jpg", "Wikimedia Commons", "domínio público"],
    ["joelho", "Image943-knee mount.jpg", ARMY, "domínio público"],
    ["fechada", "Brazilian Jiu-jitsu-Closed guard.jpg", "MartialArtsNomad.com", "CC BY 2.0"],
    ["meia", "BJJ-half guard.jpg", "parhessiastes", "CC BY-SA 2.0"],
    ["meia", "Escaping the half guard.jpg", "Wikimedia Commons", "domínio público"],
    ["dlr", "De la Riva guard.jpg", "Aesopian", "CC BY-SA 2.5"],
    ["aranha", "Image986spider-guard.jpg", ARMY, "domínio público"],
    ["aranha", "BJJ spider guard 01.jpg", "soh32", "CC BY-SA 3.0"],
    ["queda", "Single-Leg Takedown (8111417907).jpg", "Chris Hunkeler", "CC BY-SA 2.0"],
    ["queda", "Takedown.jpg", "Michael Gerstl", "CC BY-SA 2.0"],
    ["mataleao", "Rear naked choke.jpg", ARMY, "domínio público"],
    ["mataleao", "Submission Grappling - rear naked choke.jpg", "MartialArtsNomad.com", "CC BY 2.0"],
    ["mataleao", "US Army combatives-rear naked choke.jpg", "Expert Infantry", "CC BY 2.0"],
    ["triangulo", "Triangle choke.jpeg", "Zoran Jerkovic", "CC BY-SA 4.0"],
    ["triangulo", "Image939-triangle choke.jpg", ARMY, "domínio público"],
    ["triangulo", "Image938-triangle choke.jpg", ARMY, "domínio público"],
    ["triangulo", "Triangle choke attempt in grappling tournament at Joint Base Balad, Iraq, 2011.jpg", "SSgt Corenthia Fennell", "domínio público"],
    ["armlock", "Armlock juji-gatame armbar.jpg", "Wikimedia Commons", "domínio público"],
    ["armlock", "Juji-gatame.jpg", "Michael Hultström", "CC BY-SA 3.0"],
    ["armlock", "Girl armlock.jpg", "Scott Feldstein", "CC BY 2.0"],
    ["armlock", "MCMAP grappling armbar.jpg", "Stephen M. Votaw", "domínio público"],
    ["kimura", "Brazilian Jiu-jitsu Kimura lock from guard.jpg", "Linsey Williams", "domínio público"],
    ["americana", "Army Combatives Keylock (111007-A-HU462-383).jpg", "Sean Harp", "domínio público"],
    ["katagatame", "Arm triangle choke.jpg", "Eric Langley", "CC BY 2.0"],
    ["guilhotina", "Guillotine choke.jpg", "Wikimedia Commons", "domínio público"],
    ["omoplata", "Omoplata armlock.jpg", "Rettotako", "CC BY-SA 3.0"],
    ["omoplata", "Professor Brites Demonstrating an Omoplata Variation.jpg", "Rebelx2g1", "CC BY-SA 4.0"],
    ["ezequiel", "Army combatives-ezekiel choke.jpg", "807th Medical Command", "CC BY 2.0"],
    ["chavejoelho", "Leglock straight kneebar.jpg", ARMY, "domínio público"],
  ];
  const src = (file, w = 640) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w}`;
  const page = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

  const MODES = {
    relogio: { name: "Contra o relógio", icon: "⏱️", desc: "60 segundos. Acerto dá +2 s, erro tira 3 s.", time: 60 },
    morte: { name: "Morte súbita", icon: "❤️", desc: "3 vidas e 6 segundos por foto. Até onde você vai?", lives: 3, per: 6 },
  };
  const BELTS = [
    [0, "Faixa branca", "#f2f2f2"], [600, "Faixa azul", "#1f4fbf"], [1400, "Faixa roxa", "#6a2fb3"],
    [2400, "Faixa marrom", "#6b3e1e"], [3600, "Faixa preta", "#111111"],
  ];
  const beltFor = (score) => BELTS.filter((b) => score >= b[0]).at(-1);

  // ---------- sons (curtos, gerados no navegador) ----------
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
    right: (combo) => beep([660 + combo * 40, 880 + combo * 40]),
    wrong: () => beep([220, 160], 0.14, "square", 0.05),
    tick: () => beep([520], 0.05, "sine", 0.05),
    go: () => beep([880], 0.18),
    end: () => beep([523, 659, 784, 1046], 0.12),
  };

  // ---------- estado ----------
  let s = null;
  let deck = [];
  let recentAnswers = [];
  function draw() {
    if (!deck.length) deck = shuffle(PHOTOS);
    // evita a mesma resposta nas últimas 4 fotos (há várias fotos da mesma posição)
    let i = deck.length - 1;
    while (i > 0 && recentAnswers.includes(deck[i][0])) i--;
    const [photo] = deck.splice(i, 1);
    recentAnswers = [photo[0], ...recentAnswers].slice(0, 4);
    return photo;
  }
  const preload = () => { if (deck.length) new Image().src = src(deck.at(-1)[1]); };

  function options(answer) {
    const bad = (id) => id === answer || (AVOID[answer] || []).includes(id) || (AVOID[id] || []).includes(answer);
    const pool = Object.keys(ANSWERS).filter((id) => !bad(id));
    const group = ANSWERS[answer][1];
    const same = shuffle(pool.filter((id) => ANSWERS[id][1] === group));
    const other = shuffle(pool.filter((id) => ANSWERS[id][1] !== group));
    // fica mais difícil com o tempo: mais opções parecidas (do mesmo grupo)
    const hard = Math.min(3, Math.floor(s.n / 4));
    const picks = [...same.slice(0, hard), ...other, ...same.slice(hard)].slice(0, 3);
    return shuffle([answer, ...picks]);
  }

  // ---------- telas ----------
  function menu() {
    stop();
    box.replaceChildren();
    const best = store.get("pg-recordes", {});
    const wrap = el("div", "pg-menu");
    wrap.append(
      el("p", "pg-kicker", `${PHOTOS.length} fotos · ${Object.keys(ANSWERS).length} posições e finalizações`),
      el("h2", "", "Escolha o modo"),
      el("p", "muted", "Aparece uma foto de luta e você escolhe o nome certo o mais rápido que puder. Respostas rápidas valem mais, e acertos seguidos multiplicam os pontos."),
    );
    const modes = el("div", "pg-modes");
    Object.entries(MODES).forEach(([id, m]) => {
      const b = el("button", "pg-mode");
      b.type = "button";
      const rec = best[id];
      b.append(el("span", "pg-mode-icon", m.icon), el("strong", "", m.name), el("span", "muted", m.desc),
        el("span", "pg-mode-best", rec ? `🏆 Recorde: ${rec.toLocaleString("pt-BR")}` : "Sem recorde ainda"));
      b.addEventListener("click", () => countdown(id));
      modes.append(b);
    });
    const tips = el("ul", "pg-tips");
    ["Teclas 1, 2, 3 e 4 escolhem a resposta no computador.", "3 acertos seguidos: pontos x2. Seis seguidos: x3.", "Fica mais difícil com o tempo: as opções ficam parecidas."]
      .forEach((t) => tips.append(el("li", "", t)));
    wrap.append(modes, tips);
    box.append(wrap);
  }

  function countdown(mode) {
    deck = shuffle(PHOTOS);
    recentAnswers = [];
    preload();
    box.replaceChildren();
    box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const n = el("div", "pg-count", "3");
    box.append(n);
    let k = 3;
    sfx.tick();
    const t = setInterval(() => {
      k--;
      if (k > 0) { n.textContent = k; n.classList.remove("pop"); void n.offsetWidth; n.classList.add("pop"); sfx.tick(); }
      else { clearInterval(t); sfx.go(); start(mode); }
    }, reduced ? 400 : 700);
    n.classList.add("pop");
  }

  function start(mode) {
    const m = MODES[mode];
    s = { mode, m, score: 0, n: 0, right: 0, streak: 0, bestStreak: 0, misses: [], lives: m.lives || 0,
      time: m.time || 0, q: m.per || 0, cur: null, locked: true, running: true, last: performance.now() };
    document.body.classList.add("pg-playing");
    build();
    next();
    requestAnimationFrame(tick);
  }

  let ui = {};
  function build() {
    box.replaceChildren();
    const hud = el("div", "pg-hud");
    ui.score = el("strong", "pg-score", "0");
    ui.combo = el("span", "pg-combo");
    ui.status = el("span", "pg-status");
    const mute = el("button", "pg-mute", muted ? "🔇" : "🔊");
    mute.type = "button";
    mute.setAttribute("aria-label", "Ligar ou desligar o som");
    mute.addEventListener("click", () => { muted = !muted; store.set("pg-mudo", muted); mute.textContent = muted ? "🔇" : "🔊"; });
    const left = el("div", "pg-hud-left");
    left.append(el("span", "muted", "Pontos"), ui.score, ui.combo);
    hud.append(left, ui.status, mute);
    ui.bar = el("div", "pg-timer");
    ui.fill = el("i");
    ui.bar.append(ui.fill);
    ui.stage = el("div", "pg-stage");
    ui.img = el("img");
    ui.img.alt = "Foto de uma posição de jiu-jitsu";
    ui.flash = el("div", "pg-flash");
    ui.pop = el("div", "pg-pop");
    ui.load = el("div", "pg-loading", "Carregando foto…");
    ui.stage.append(ui.img, ui.flash, ui.pop, ui.load);
    ui.credit = el("a", "pg-credit");
    ui.credit.target = "_blank";
    ui.credit.rel = "noopener";
    ui.opts = el("div", "pg-options");
    box.append(hud, ui.bar, ui.stage, ui.credit, ui.opts);
    ui.img.addEventListener("load", () => {
      ui.load.hidden = true;
      ui.stage.classList.add("ready");
      s.locked = false;
      s.qStart = performance.now();
      ui.opts.querySelectorAll("button").forEach((b) => { b.disabled = false; });
      preload();
    });
    ui.img.addEventListener("error", () => { if (s?.running) next(); });
  }

  function next() {
    s.cur = draw();
    s.locked = true;
    s.q = s.m.per || 0;
    const [answer, file, author, license] = s.cur;
    ui.stage.classList.remove("ready", "good", "bad");
    ui.pop.className = "pg-pop";
    ui.load.hidden = false;
    ui.img.src = src(file);
    ui.credit.textContent = `Foto: ${author} · ${license}`;
    ui.credit.href = page(file);
    ui.opts.replaceChildren();
    options(answer).forEach((id, i) => {
      const b = el("button", "pg-opt");
      b.type = "button";
      b.disabled = true;
      b.dataset.id = id;
      b.append(el("kbd", "", String(i + 1)), el("span", "", ANSWERS[id][0]));
      b.addEventListener("click", () => answer_(id));
      ui.opts.append(b);
    });
    hud();
  }

  function hud() {
    ui.score.textContent = s.score.toLocaleString("pt-BR");
    const mult = s.streak >= 6 ? 3 : s.streak >= 3 ? 2 : 1;
    ui.combo.textContent = mult > 1 ? `🔥 x${mult}` : s.streak ? `${s.streak} seguidos` : "";
    ui.combo.classList.toggle("hot", mult > 1);
    if (s.m.time) {
      ui.status.textContent = `⏱️ ${Math.ceil(s.time)} s`;
      ui.fill.style.width = `${Math.min(100, (s.time / s.m.time) * 100)}%`;
      ui.bar.classList.toggle("low", s.time <= 10);
    } else {
      ui.status.textContent = "❤️".repeat(s.lives) + "🖤".repeat(s.m.lives - s.lives);
      ui.fill.style.width = `${(s.q / s.m.per) * 100}%`;
      ui.bar.classList.toggle("low", s.q <= 2);
    }
  }

  let lastSecond = 0;
  function tick(now) {
    if (!s?.running) return;
    const dt = Math.min(0.25, (now - s.last) / 1000);
    s.last = now;
    if (!s.locked && !document.hidden) {
      if (s.m.time) {
        s.time -= dt;
        const sec = Math.ceil(s.time);
        if (sec <= 5 && sec !== lastSecond && sec > 0) sfx.tick();
        lastSecond = sec;
        if (s.time <= 0) { s.time = 0; hud(); return end(); }
      } else {
        s.q -= dt;
        if (s.q <= 0) { s.q = 0; answer_(null); }
      }
      hud();
    }
    requestAnimationFrame(tick);
  }

  function popText(text, good) {
    ui.pop.textContent = text;
    ui.pop.className = `pg-pop show ${good ? "good" : "bad"}`;
  }

  function answer_(id) {
    if (!s || s.locked) return;
    s.locked = true;
    const right = s.cur[0];
    const ok = id === right;
    const secs = (performance.now() - s.qStart) / 1000;
    s.n++;
    if (ok) {
      s.right++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      const mult = s.streak >= 6 ? 3 : s.streak >= 3 ? 2 : 1;
      const speed = Math.max(0, Math.round((3 - secs) * 25));
      const gained = (100 + speed) * mult;
      s.score += gained;
      if (s.m.time) s.time = Math.min(s.time + 2, 99);
      popText(`+${gained}${speed >= 50 ? " ⚡" : ""}`, true);
      sfx.right(Math.min(s.streak, 8));
    } else {
      s.streak = 0;
      s.misses.push(s.cur);
      if (s.m.time) s.time = Math.max(0, s.time - 3); else s.lives--;
      popText(id === null ? "⏰ Tempo!" : s.m.time ? "−3 s" : "−1 ❤️", false);
      sfx.wrong();
      try { navigator.vibrate?.(120); } catch { /* sem vibração */ }
    }
    ui.stage.classList.add(ok ? "good" : "bad");
    ui.opts.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
      if (b.dataset.id === right) b.classList.add("right");
      else if (b.dataset.id === id) b.classList.add("wrong");
    });
    hud();
    const over = s.m.time ? s.time <= 0 : s.lives <= 0;
    setTimeout(() => { if (!s?.running) return; over ? end() : next(); }, ok ? 600 : 1300);
  }

  function stop() {
    if (s) s.running = false;
    document.body.classList.remove("pg-playing");
  }

  function end() {
    if (!s.running) return;
    stop();
    sfx.end();
    const best = store.get("pg-recordes", {});
    const record = s.score > (best[s.mode] || 0);
    if (record) { best[s.mode] = s.score; store.set("pg-recordes", best); }
    const [, beltName, beltColor] = beltFor(s.score);
    box.replaceChildren();
    const card = el("div", "pg-end");
    if (record && s.score > 0) card.append(el("p", "pg-record", "🏆 Novo recorde!"));
    const score = el("p", "pg-final", "0");
    card.append(el("p", "muted", s.m.name), score);
    // contagem animada do placar final
    const t0 = performance.now(), target = s.score;
    const run = (now) => {
      const k = reduced ? 1 : Math.min(1, (now - t0) / 900);
      score.textContent = Math.round(target * (1 - (1 - k) ** 3)).toLocaleString("pt-BR");
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
    setTimeout(() => { score.textContent = target.toLocaleString("pt-BR"); }, 1200);
    const belt = el("div", "quiz-belt");
    belt.style.background = beltColor;
    belt.append(el("span"));
    card.append(el("h2", "", beltName), belt);
    const stats = el("ul", "pg-stats");
    const acc = s.n ? Math.round((s.right / s.n) * 100) : 0;
    [[`${s.right}/${s.n}`, "acertos"], [`${acc}%`, "precisão"], [s.bestStreak, "maior sequência"]].forEach(([v, l]) => {
      const li = el("li");
      li.append(el("strong", "", String(v)), el("span", "", l));
      stats.append(li);
    });
    card.append(stats);
    const nextBelt = BELTS.find((b) => b[0] > s.score);
    if (nextBelt) card.append(el("p", "muted", `Faltam ${(nextBelt[0] - s.score).toLocaleString("pt-BR")} pontos para a ${nextBelt[1].toLowerCase()}.`));

    const actions = el("div", "quiz-actions");
    const again = el("button", "button", "Jogar de novo");
    again.type = "button";
    again.addEventListener("click", () => countdown(s.mode));
    const other = el("button", "share-btn", "Trocar de modo");
    other.type = "button";
    other.addEventListener("click", menu);
    const share = el("button", "share-btn", "Compartilhar ↗");
    share.type = "button";
    share.addEventListener("click", () => window.siteShare?.({
      title: "Qual é a posição? · Cohab Team",
      text: `Fiz ${s.score.toLocaleString("pt-BR")} pontos (${beltName.toLowerCase()}) no jogo “Qual é a posição?” da Cohab Team, modo ${s.m.name.toLowerCase()}. Consegue mais?`,
      url: location.href,
    }));
    actions.append(again, other, share);
    const rk = window.cohabRanking?.badge(`posicoes-${s.mode}`, s.score);
    if (rk) card.append(rk);
    card.append(actions);

    // revisão do que errou, para aprender
    const seen = new Set();
    const misses = s.misses.filter((p) => !seen.has(p[1]) && seen.add(p[1]));
    if (misses.length) {
      const rev = el("div", "pg-review");
      rev.append(el("h3", "", "Para revisar"));
      misses.slice(0, 8).forEach(([id, file]) => {
        const row = el("div", "pg-miss");
        const img = el("img");
        img.src = src(file, 200);
        img.alt = "";
        img.loading = "lazy";
        const txt = el("div");
        txt.append(el("strong", "", ANSWERS[id][0]), el("span", "", ANSWERS[id][2]));
        row.append(img, txt);
        rev.append(row);
      });
      const more = el("a", "story-link", "Ver o glossário do tatame →");
      more.href = "jiujitsu.html#glossario";
      rev.append(more);
      card.append(rev);
    }
    box.append(card);
    again.focus();
  }

  document.addEventListener("keydown", (e) => {
    if (!s?.running || s.locked || e.target.closest?.("input, textarea")) return;
    const k = Number(e.key);
    if (k >= 1 && k <= 4) {
      const b = ui.opts.querySelectorAll("button")[k - 1];
      if (b) { e.preventDefault(); answer_(b.dataset.id); }
    }
  });

  menu();
})();
