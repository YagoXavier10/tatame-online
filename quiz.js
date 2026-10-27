// Quiz de jiu-jitsu em níveis de faixa: da branca (fácil) à preta (muito difícil)
(() => {
  const box = document.getElementById("quiz");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const store = {
    get: () => { try { return JSON.parse(localStorage.getItem("quiz-faixas")) || {}; } catch { return {}; } },
    set: (v) => { try { localStorage.setItem("quiz-faixas", JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };

  // perguntas e fotos ficam em perguntas.js
  const { PHOTOS, LEVELS } = window.COHAB_QUIZ;
  const PER_ROUND = 8;
  const PASS = 6;
  const recent = {};

  // Perguntas com os dados atuais da Cohab entram nos níveis roxa e preta
  fetch("data/cohab-conquistas.json").then((r) => r.json()).then((d) => {
    const titles = d.team.filter((t) => t.pos === 1).length;
    const wrong = shuffle([titles - 3, titles - 1, titles + 2, titles + 4].filter((n) => n > 0)).slice(0, 3);
    LEVELS[2].questions.push(["Em quantos campeonatos a Cohab já foi campeã geral por equipe?", String(titles), wrong.map(String),
      `Foram ${titles} títulos de campeã geral, e a lista cresce toda semana.`]);
    const pan = d.team.filter((t) => /pan-americano/i.test(t.event)).sort((a, b) => b.year - a.year)[0];
    if (pan) {
      const right = `${pan.pos}º lugar`;
      LEVELS[4].questions.push([`Em que lugar a Cohab ficou no ${pan.event} ${pan.year}?`, right,
        ["1º lugar", "2º lugar", "3º lugar", "5º lugar"].filter((o) => o !== right).slice(0, 3),
        `Ficou em ${pan.pos}º lugar geral, com ${pan.gold} ouros.`]);
    }
  }).catch(() => { /* sem os dados, segue só com as perguntas fixas */ });

  function photo(key) {
    const [file, author, license] = PHOTOS[key];
    const fig = el("figure", "quiz-photo");
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

  function menu() {
    const best = store.get();
    box.replaceChildren();
    const start = el("div", "quiz-start");
    start.append(
      el("h2", "", "Escolha sua faixa"),
      el("p", "muted", `Cada nível tem ${PER_ROUND} perguntas sobre jiu-jitsu, judô, a Cohab e conhecimentos gerais. Acerte ${PASS} para passar de faixa.`),
    );
    const list = el("div", "quiz-levels");
    LEVELS.forEach((lv, i) => {
      const b = el("button", "quiz-level");
      b.type = "button";
      const stripe = el("span", "quiz-level-belt");
      stripe.style.background = lv.color;
      stripe.dataset.belt = lv.id;
      const name = el("strong", "", lv.name);
      const tag = el("span", "muted", lv.tag);
      const score = best[lv.id];
      const badge = el("span", "quiz-level-best", score === undefined ? "" : `${score >= PASS ? "✅" : "🔁"} ${score}/${PER_ROUND}`);
      b.append(stripe, name, tag, badge);
      b.addEventListener("click", () => play(i));
      list.append(b);
    });
    start.append(list);
    box.append(start);
  }

  function play(levelIndex) {
    const lv = LEVELS[levelIndex];
    // sorteia primeiro as perguntas que ainda não saíram; quando acabam, recomeça
    const seen = recent[lv.id] || (recent[lv.id] = new Set());
    const fresh = lv.questions.filter((q) => !seen.has(q[0]));
    const old = lv.questions.filter((q) => seen.has(q[0]));
    const picked = shuffle([...shuffle(fresh), ...shuffle(old)].slice(0, PER_ROUND));
    if (fresh.length <= PER_ROUND) seen.clear();
    picked.forEach((q) => seen.add(q[0]));
    const questions = picked.map(([q, right, wrong, why, img]) =>
      ({ q, right, options: shuffle([right, ...wrong]), why, img }));
    let i = 0, score = 0;

    const show = () => {
      box.replaceChildren();
      const { q, right, options, why, img } = questions[i];
      const head = el("div", "quiz-head");
      const level = el("span", "quiz-tag", lv.name);
      level.style.background = lv.color;
      level.style.color = lv.ink;
      head.append(level, el("span", "muted", `Pergunta ${i + 1} de ${questions.length}`), el("span", "quiz-score", `${score} ✓`));
      const bar = el("div", "quiz-bar");
      const fill = el("i");
      fill.style.width = `${(i / questions.length) * 100}%`;
      bar.append(fill);
      const list = el("div", "quiz-options");
      const note = el("p", "quiz-why");
      const next = el("button", "button quiz-next", i + 1 < questions.length ? "Próxima →" : "Ver resultado →");
      next.hidden = true;
      options.forEach((opt) => {
        const b = el("button", "quiz-option", opt);
        b.type = "button";
        b.addEventListener("click", () => {
          const ok = opt === right;
          if (ok) score++;
          list.querySelectorAll("button").forEach((x) => {
            x.disabled = true;
            if (x.textContent === right) x.classList.add("right");
          });
          if (!ok) b.classList.add("wrong");
          note.textContent = `${ok ? "✅ Isso aí!" : "❌ Não foi dessa vez."} ${why}`;
          next.hidden = false;
          next.focus();
        });
        list.append(b);
      });
      next.addEventListener("click", () => { i++; i < questions.length ? show() : finish(); });
      box.append(head, bar, el("h2", "quiz-q", q));
      if (img) box.append(photo(img));
      box.append(list, note, next);
    };

    const finish = () => {
      const passed = score >= PASS;
      const best = store.get();
      best[lv.id] = Math.max(score, best[lv.id] ?? 0);
      store.set(best);
      const nextLevel = LEVELS[levelIndex + 1];
      box.replaceChildren();
      const card = el("div", "quiz-result");
      const beltEl = el("div", "quiz-belt");
      beltEl.style.background = lv.color;
      beltEl.append(el("span"));
      const text = passed
        ? (nextLevel ? `Oss! 🥋 Você passou na ${lv.name.toLowerCase()}. Pronto para a ${nextLevel.name.toLowerCase()}?` : "Oss! 🥋 Você é uma lenda do jiu-jitsu. Passou no nível mais difícil!")
        : `Faltou pouco: precisa de ${PASS} acertos para passar. Leia a página de jiu-jitsu e tente de novo.`;
      card.append(
        el("p", "muted", `Você acertou ${score} de ${questions.length}`),
        el("h2", "", passed ? `${lv.name} aprovada!` : `${lv.name}: ainda não`),
        beltEl,
        el("p", "", text),
      );
      const actions = el("div", "quiz-actions");
      if (passed && nextLevel) {
        const up = el("button", "button", `Ir para a ${nextLevel.name.toLowerCase()} →`);
        up.type = "button";
        up.addEventListener("click", () => play(levelIndex + 1));
        actions.append(up);
      }
      const again = el("button", passed && nextLevel ? "share-btn" : "button", "Jogar de novo");
      again.type = "button";
      again.addEventListener("click", () => play(levelIndex));
      const back = el("button", "share-btn", "Escolher outra faixa");
      back.type = "button";
      back.addEventListener("click", menu);
      const share = el("button", "share-btn", "Compartilhar ↗");
      share.type = "button";
      share.addEventListener("click", () => window.siteShare?.({
        title: "Quiz de jiu-jitsu da Cohab",
        text: `Fiz ${score}/${questions.length} no nível ${lv.name.toLowerCase()} do quiz de jiu-jitsu da Cohab Team! Consegue mais?`,
        url: location.href,
      }));
      actions.append(again, back, share);
      if (!passed) {
        const more = el("a", "share-btn", "Estudar a história");
        more.href = "jiujitsu.html";
        actions.append(more);
      }
      const total = Object.values(store.get()).reduce((a, b) => a + b, 0);
      const rk = window.cohabRanking?.badge("quiz", total);
      if (rk) card.append(rk);
      card.append(actions);
      box.append(card);
    };

    show();
  }

  menu();
})();
