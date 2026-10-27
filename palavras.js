// Caça-palavras: as palavras do tema estão escondidas na grade, em qualquer direção (até de trás para frente).
// Arraste do começo ao fim da palavra (ou toque na primeira e na última letra). Quanto mais rápido, mais pontos.
(() => {
  const box = document.getElementById("palavras");
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
  const shuffle = (l) => l.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]/g, "");

  const TEMAS = {
    "Jiu-jitsu": ["Guarda", "Montada", "Raspagem", "Kimono", "Faixa", "Tatame", "Chave", "Costas", "Triângulo", "Omoplata", "Kimura", "Passagem"],
    "Frutas": ["Banana", "Abacaxi", "Manga", "Laranja", "Morango", "Goiaba", "Caju", "Melancia", "Limão", "Maracujá", "Acerola", "Pitanga"],
    "Animais": ["Girafa", "Elefante", "Tucano", "Jacaré", "Onça", "Leão", "Macaco", "Cavalo", "Coruja", "Baleia", "Capivara", "Tatu"],
    "Países": ["Brasil", "Japão", "Chile", "Peru", "Canadá", "México", "Itália", "Egito", "China", "Portugal", "Argentina", "Equador"],
    "Esportes": ["Futebol", "Vôlei", "Judô", "Natação", "Tênis", "Surfe", "Skate", "Ciclismo", "Basquete", "Atletismo", "Handebol", "Remo"],
    "Corpo humano": ["Coração", "Pulmão", "Joelho", "Ombro", "Cotovelo", "Cérebro", "Fígado", "Estômago", "Costela", "Pescoço", "Tornozelo", "Quadril"],
  };
  const N = 11, QTD = 8;
  // letras de enchimento com a frequência do português (assim as palavras não "saltam" da grade)
  const LETRAS = "AAAAAAAAAAAAAEEEEEEEEEEEOOOOOOOOOOSSSSSSRRRRRRIIIIIINNNNNDDDDDMMMMUUUUTTTTCCCCLLLPPPVVGGHQBFZJXK";
  const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  const CORES = ["#1f4fbf", "#1a9a5c", "#b3121b", "#8e4ec6", "#f76b15", "#0091a8", "#c2410c", "#6b3e1e"];

  let jogo = null, timer = null;

  function montar(tema) {
    for (let tent = 0; tent < 40; tent++) {
      const grade = Array.from({ length: N }, () => Array(N).fill(""));
      const escolhidas = shuffle(TEMAS[tema]).slice(0, QTD);
      const postas = [];
      let ok = true;
      for (const nome of escolhidas.sort((a, b) => semAcento(b).length - semAcento(a).length)) {
        const p = semAcento(nome);
        let colocou = false;
        for (let k = 0; k < 200 && !colocou; k++) {
          const [dl, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
          const l0 = Math.floor(Math.random() * N), c0 = Math.floor(Math.random() * N);
          const l1 = l0 + dl * (p.length - 1), c1 = c0 + dc * (p.length - 1);
          if (l1 < 0 || l1 >= N || c1 < 0 || c1 >= N) continue;
          let cabe = true;
          for (let i = 0; i < p.length; i++) {
            const v = grade[l0 + dl * i][c0 + dc * i];
            if (v && v !== p[i]) { cabe = false; break; }
          }
          if (!cabe) continue;
          const celulas = [];
          for (let i = 0; i < p.length; i++) { grade[l0 + dl * i][c0 + dc * i] = p[i]; celulas.push((l0 + dl * i) * N + c0 + dc * i); }
          postas.push({ nome, p, celulas, achada: false });
          colocou = true;
        }
        if (!colocou) { ok = false; break; }
      }
      if (!ok) continue;
      for (let l = 0; l < N; l++) for (let c = 0; c < N; c++) if (!grade[l][c]) grade[l][c] = LETRAS[Math.floor(Math.random() * LETRAS.length)];
      return { grade, palavras: postas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) };
    }
    throw new Error("não coube");
  }

  // ---------- telas ----------
  function inicio() {
    clearInterval(timer);
    box.replaceChildren();
    const rec = store.get("cp-recorde", 0);
    const card = el("div", "ex-inicio");
    card.append(el("span", "ex-ico", "🔤"), el("h2", "", "Caça-palavras"),
      el("p", "muted", `Ache as ${QTD} palavras escondidas numa grade de ${N}×${N}. Elas podem estar na horizontal, na vertical, na diagonal e até de trás para frente. Arraste da primeira à última letra (ou toque nas duas). Quanto mais rápido, mais pontos.`),
      el("p", "ex-recorde", rec ? `🏆 Seu recorde: ${rec.toLocaleString("pt-BR")} pontos` : "Sem recorde ainda"),
      el("p", "ex-escolha", "Escolha o tema:"));
    const temas = el("div", "ex-temas");
    Object.keys(TEMAS).forEach((t) => {
      const b = el("button", "ex-tema", t);
      b.type = "button";
      b.addEventListener("click", () => jogar(t));
      temas.append(b);
    });
    card.append(temas);
    box.append(card);
  }

  function jogar(tema) {
    const { grade, palavras } = montar(tema);
    jogo = { tema, grade, palavras, t0: performance.now(), sel: null, cor: 0, acabou: false };
    box.replaceChildren();
    const topo = el("div", "ex-topo");
    const relogio = el("strong", "ex-relogio", "0:00");
    const conta = el("span", "muted", `0 de ${QTD}`);
    topo.append(el("span", "lt-sala", tema), conta, relogio);
    const g = el("div", "cp-grade");
    g.style.setProperty("--n", N);
    g.setAttribute("role", "grid");
    g.setAttribute("aria-label", "Grade de letras");
    const cels = [];
    grade.forEach((linha, l) => linha.forEach((letra, c) => {
      const d = el("div", "cp-cel", letra);
      d.dataset.i = String(l * N + c);
      cels.push(d);
      g.append(d);
    }));
    const lista = el("ul", "cp-lista");
    palavras.forEach((w) => { w.li = el("li", "", w.nome); lista.append(w.li); });
    const desistir = el("button", "share-btn", "Desistir e ver as respostas");
    desistir.type = "button";
    desistir.addEventListener("click", () => terminar(true));
    box.append(topo, g, lista, desistir);
    jogo.cels = cels;
    jogo.contaEl = conta;

    timer = setInterval(() => {
      const s = Math.floor((performance.now() - jogo.t0) / 1000);
      relogio.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 250);

    // seleção: arrastar, ou tocar na primeira e na última letra
    const celDe = (e) => {
      const alvo = document.elementFromPoint(e.clientX, e.clientY);
      return alvo?.classList.contains("cp-cel") ? Number(alvo.dataset.i) : null;
    };
    let arrastando = false, inicioSel = null, moveu = false;
    g.addEventListener("pointerdown", (e) => {
      const i = celDe(e);
      if (i === null || jogo.acabou) return;
      e.preventDefault();
      try { g.setPointerCapture(e.pointerId); } catch { /* sem captura: segue sem ela */ }
      if (inicioSel !== null && !arrastando) { // segundo toque
        const ok = conferir(linha(inicioSel, i));
        limparSel();
        inicioSel = null;
        if (!ok) { inicioSel = i; marcar([i]); }
        return;
      }
      arrastando = true;
      moveu = false;
      inicioSel = i;
      marcar([i]);
    });
    g.addEventListener("pointermove", (e) => {
      if (!arrastando) return;
      const i = celDe(e);
      if (i === null) return;
      if (i !== inicioSel) moveu = true;
      marcar(linha(inicioSel, i));
    });
    const soltar = (e) => {
      if (!arrastando) return;
      arrastando = false;
      const i = celDe(e) ?? inicioSel;
      if (!moveu || i === inicioSel) return; // foi só um toque: espera o segundo
      conferir(linha(inicioSel, i));
      limparSel();
      inicioSel = null;
    };
    g.addEventListener("pointerup", soltar);
    g.addEventListener("pointercancel", () => { arrastando = false; limparSel(); inicioSel = null; });
  }

  // células em linha reta entre a e b (horizontal, vertical ou diagonal); senão só a
  function linha(a, b) {
    const la = Math.floor(a / N), ca = a % N, lb = Math.floor(b / N), cb = b % N;
    const dl = Math.sign(lb - la), dc = Math.sign(cb - ca);
    const passos = Math.max(Math.abs(lb - la), Math.abs(cb - ca));
    if (!(la === lb || ca === cb || Math.abs(lb - la) === Math.abs(cb - ca))) return [a];
    return Array.from({ length: passos + 1 }, (_, k) => (la + dl * k) * N + ca + dc * k);
  }

  function marcar(ids) {
    limparSel();
    ids.forEach((i) => jogo.cels[i].classList.add("sel"));
    jogo.sel = ids;
  }
  function limparSel() { jogo.cels.forEach((c) => c.classList.remove("sel")); jogo.sel = null; }

  function conferir(ids) {
    if (ids.length < 2) return false;
    const chave = ids.join(","), contraria = [...ids].reverse().join(",");
    const w = jogo.palavras.find((p) => !p.achada && (p.celulas.join(",") === chave || p.celulas.join(",") === contraria));
    if (!w) { vibrar(40); return false; }
    w.achada = true;
    const cor = CORES[jogo.cor++ % CORES.length];
    w.celulas.forEach((i) => { const c = jogo.cels[i]; c.classList.add("achada"); c.style.setProperty("--c", cor); });
    w.li.classList.add("achada");
    w.li.style.setProperty("--c", cor);
    vibrar(25);
    const feitas = jogo.palavras.filter((p) => p.achada).length;
    jogo.contaEl.textContent = `${feitas} de ${QTD}`;
    if (feitas === QTD) setTimeout(() => terminar(false), 350);
    return true;
  }

  function terminar(desistiu) {
    if (jogo.acabou) return;
    jogo.acabou = true;
    clearInterval(timer);
    const s = Math.round((performance.now() - jogo.t0) / 1000);
    const achadas = jogo.palavras.filter((p) => p.achada).length;
    // 300 por palavra + bônus de tempo se achar todas
    const pontos = achadas * 300 + (desistiu ? 0 : Math.max(0, 3000 - s * 15));
    jogo.palavras.filter((p) => !p.achada).forEach((p) => p.celulas.forEach((i) => jogo.cels[i].classList.add("faltou")));
    const rec = store.get("cp-recorde", 0);
    if (pontos > rec) store.set("cp-recorde", pontos);
    const over = el("div", "ex-fim cp-fim");
    over.append(el("p", "eyebrow", pontos > rec && pontos > 0 ? "🎉 Novo recorde!" : desistiu ? "Fim de jogo" : "Achou todas!"),
      el("h2", "", `${pontos.toLocaleString("pt-BR")} pontos`),
      el("p", "muted", `${achadas} de ${QTD} palavras em ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${desistiu ? " As que faltaram estão marcadas na grade." : ""}`));
    if (pontos > 0) {
      const rk = window.cohabRanking?.badge("palavras", Math.max(pontos, rec));
      if (rk) over.append(rk);
    }
    const acoes = el("div", "quiz-actions");
    const de = el("button", "button lt-go", "Jogar de novo");
    de.type = "button";
    de.addEventListener("click", () => jogar(jogo.tema));
    const outro = el("button", "share-btn", "Outro tema");
    outro.type = "button";
    outro.addEventListener("click", inicio);
    acoes.append(de, outro);
    over.append(acoes);
    box.querySelector(".share-btn")?.remove();
    box.append(over);
  }

  window.__palavras = { estado: () => jogo, conferir: (ids) => conferir(ids) }; // usado nos testes automáticos
  inicio();
})();
