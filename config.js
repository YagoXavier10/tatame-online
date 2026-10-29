// Configuração do site feita no painel de admin (admin.html): jogos ligados, ordem, destaque, aviso, manutenção...
// Fica no Firestore (site/tatame), que todo mundo pode ler e só o admin pode gravar.
// Roda cedo, no <head>: aplica a última configuração guardada no aparelho e depois busca a mais nova.
// Se o Firebase não carregar, vale a configuração padrão (tudo ligado).
(() => {
  // os jogos do site: página, grupo do menu e as abas de ranking de cada um
  const JOGOS = [
    { id: "cartas", nome: "Luta de cartas", emoji: "🎴", pagina: "cartas.html", grupo: "solo", ranking: ["cartas"], texto: "Jiu-jitsu por turnos contra o computador. Monte sua estratégia com quedas, raspagens, passagens e finalizações, valendo os pontos da IBJJF." },
    { id: "labirinto", nome: "Labirinto", emoji: "🌀", pagina: "labirinto.html", grupo: "solo", ranking: ["labirinto"], texto: "Três labirintos novos a cada partida, cada vez maiores. Chegue à 🏁 o mais rápido que puder." },
    { id: "alvo", nome: "Acerta-alvo", emoji: "🎯", pagina: "alvo.html", grupo: "solo", ranking: ["alvo"], texto: "30 segundos de alvos pulando na tela: acerte 🥋 e ⭐, fuja da 💣 e faça combo." },
    { id: "torre", nome: "Torre de faixas", emoji: "🏗️", pagina: "torre.html", grupo: "solo", ranking: ["torre"], texto: "Solte a faixa na hora certa e empilhe a torre mais alta, da faixa branca à coral." },
    { id: "esquiva", nome: "Esquiva", emoji: "💨", pagina: "esquiva.html", grupo: "solo", ranking: ["esquiva"], texto: "Arraste o dedo para desviar de blocos e lasers. Quanto mais tempo vivo, mais rápido fica." },
    { id: "pares", nome: "Pares", emoji: "🃏", pagina: "pares.html", grupo: "solo", ranking: ["pares"], texto: "Jogo da memória em 3 fases: vire duas cartas e ache os pares." },
    { id: "deslize", nome: "Deslize", emoji: "🧩", pagina: "deslize.html", grupo: "solo", ranking: ["deslize"], texto: "Empurre as peças pelo espaço vazio até ordenar do 1 ao último." },
    { id: "palavras", nome: "Caça-palavras", emoji: "🔤", pagina: "palavras.html", grupo: "solo", ranking: ["palavras"], texto: "Seis temas e palavras escondidas em todas as direções, contra o relógio." },
    { id: "quiz", nome: "Quiz de jiu-jitsu", emoji: "🧠", pagina: "quiz.html", grupo: "solo", ranking: ["quiz"], texto: "Cinco níveis, da faixa branca à preta, com mais de 230 perguntas." },
    { id: "posicoes", nome: "Qual é a posição?", emoji: "⏱️", pagina: "posicoes.html", grupo: "solo", ranking: ["posicoes-relogio", "posicoes-morte"], texto: "Aparece a foto de uma luta e você escolhe a posição certa antes do tempo acabar." },
    { id: "caminho", nome: "Caminho da finalização", emoji: "🧭", pagina: "caminho.html", grupo: "solo", ranking: ["caminho"], texto: "Escolha o próximo passo certo, posição por posição, até finalizar." },
    { id: "arbitro", nome: "Árbitro por um dia", emoji: "🧑‍⚖️", pagina: "arbitro.html", grupo: "solo", ranking: ["arbitro"], texto: "Você apita a luta: marque pontos, vantagens, punições e diga quem venceu." },
    { id: "regras", nome: "Regra ou mito?", emoji: "🃏", pagina: "regras.html", grupo: "solo", ranking: ["regras"], texto: "Arraste a carta: regra para a direita, mito para a esquerda." },
    { id: "luta", nome: "Luta ao vivo", emoji: "🥊", pagina: "luta.html", grupo: "amigos", ranking: ["luta"], texto: "Luta ao vivo contra um amigo, cada um no seu celular." },
    { id: "relampago", nome: "Desafios relâmpago", emoji: "⚡", pagina: "relampago.html", grupo: "amigos", ranking: [], texto: "Desafios rápidos para 2 a 8 jogadores." },
    { id: "infiltrado", nome: "Infiltrado", emoji: "🕵️", pagina: "infiltrado.html", grupo: "amigos", ranking: [], texto: "Todo mundo recebe a palavra, menos o infiltrado. Descubra quem é." },
    { id: "blefe", nome: "Blefe", emoji: "🎭", pagina: "blefe.html", grupo: "amigos", ranking: [], texto: "Invente respostas falsas e engane a turma." },
    { id: "batata", nome: "Batata quente", emoji: "🥔", pagina: "batata.html", grupo: "amigos", ranking: [], texto: "Passe o celular antes que a batata exploda." },
    { id: "cabo", nome: "Cabo de guerra", emoji: "🪢", pagina: "cabo.html", grupo: "amigos", ranking: [], texto: "Dois no mesmo celular, quem tocar mais rápido puxa a corda." },
  ];
  const NOVOS = ["cartas", "labirinto", "alvo", "pares", "deslize"];

  const PADRAO = {
    jogos: Object.fromEntries(JOGOS.map((j) => [j.id, { ativo: true, novo: NOVOS.includes(j.id), motivo: "" }])),
    ordem: {
      solo: JOGOS.filter((j) => j.grupo === "solo").map((j) => j.id),
      amigos: JOGOS.filter((j) => j.grupo === "amigos").map((j) => j.id),
    },
    destaque: { ativo: true, jogo: "cartas", selo: "Jogo novo", titulo: "", texto: "" },
    aviso: { ativo: false, texto: "", link: "", tipo: "info" },
    inicio: { titulo: "Bora jogar?", texto: "Escolha se vai jogar sozinho ou com a turma." },
    manutencao: { ativo: false, texto: "Estamos ajustando o site. Volta daqui a pouco!" },
    rankingAtivo: true,
    nicksBloqueados: [],
    cartas: { rounds: 10, dificuldade: "normal" },
  };

  // junta o que veio do banco com o padrão (jogos novos entram ligados, campos que faltam ganham o padrão)
  function mesclar(c) {
    const r = JSON.parse(JSON.stringify(PADRAO));
    if (!c || typeof c !== "object") return r;
    for (const k of ["destaque", "aviso", "inicio", "manutencao", "cartas"]) Object.assign(r[k], c[k] || {});
    for (const j of JOGOS) Object.assign(r.jogos[j.id], c.jogos?.[j.id] || {});
    for (const g of ["solo", "amigos"]) {
      const salva = (c.ordem?.[g] || []).filter((id) => r.ordem[g].includes(id));
      r.ordem[g] = [...salva, ...r.ordem[g].filter((id) => !salva.includes(id))];
    }
    if (typeof c.rankingAtivo === "boolean") r.rankingAtivo = c.rankingAtivo;
    if (Array.isArray(c.nicksBloqueados)) r.nicksBloqueados = c.nicksBloqueados.filter((n) => typeof n === "string" && n.trim());
    return r;
  }

  const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  // no computador do Yago, o painel tem um modo de teste que guarda a configuração só no navegador
  const demo = local && ler("site-config-demo");
  let cfg = mesclar(demo || ler("site-config"));
  const verTudo = () => ler("site-admin-ve-tudo") === true;
  const pagina = location.pathname.split("/").pop() || "index.html";
  const jogoDaPagina = JOGOS.find((j) => j.pagina === pagina);
  const bloqueado = () => jogoDaPagina && !verTudo() && (cfg.manutencao.ativo || !cfg.jogos[jogoDaPagina.id].ativo);

  // ---------- o que dá para fazer só com CSS (aplica antes da página aparecer) ----------
  // estilos do aviso e da caixa de jogo desligado (aqui para valer até nas páginas sem extras.css)
  const BASE = `.site-aviso { display: flex; justify-content: center; align-items: center; gap: 6px; padding: 10px 16px; text-align: center; font-weight: 700; font-size: .95rem; color: #fff; background: #1f4fbf; text-decoration: none; }
.site-aviso.alerta { background: #b3121b; }
.site-aviso.festa { background: linear-gradient(90deg, #f5c542, #f76b15); color: #111; }
.site-aviso.verde { background: #1a9a5c; }
a.site-aviso:hover { filter: brightness(1.1); }
.cfg-bloqueio { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.cfg-bloqueio h2 { margin: 0; font-size: 1.6rem; }
.cfg-bloqueio p { margin: 0; max-width: 440px; }
.cfg-bloqueio .ex-ico { font-size: 3rem; line-height: 1; }
.cfg-bloqueio .lt-go { min-width: 220px; padding: 12px 16px; text-align: center; }`;

  function aplicarCss() {
    const r = [BASE];
    for (const j of JOGOS) {
      const c = cfg.jogos[j.id], sel = `a.game-card[href="${j.pagina}"]`;
      if (!c.ativo) {
        if (verTudo()) r.push(`${sel}{opacity:.5;outline:2px dashed #e5484d;outline-offset:2px}`);
        else r.push(`${sel}{display:none!important}`, ...j.ranking.map((k) => `#rk-tabs [data-game="${k}"]{display:none!important}`));
      }
      const i = cfg.ordem[j.grupo].indexOf(j.id);
      r.push(`.games ${sel}{order:${i}}`);
      if (c.novo) r.push(`${sel} h2::after{content:"Novo";display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 9px;border-radius:99px;background:#b3121b;color:#fff;font:700 .72rem Inter,sans-serif;letter-spacing:.02em}`);
    }
    r.push(".game-new.novo{display:none}");
    // o jogo que está no banner não se repete na lista logo abaixo
    const dj = JOGOS.find((j) => j.id === cfg.destaque.jogo);
    if (cfg.destaque.ativo && dj) r.push(`.ct-destaque:not([hidden]) ~ .games a.game-card[href="${dj.pagina}"]{display:none}`);
    if (!cfg.rankingAtivo) r.push("#ranking,.rk-badge,#rk-profile{display:none!important}");
    if (cfg.manutencao.ativo && !verTudo()) r.push(".games .game-card,.tt-aba,.ct-destaque{opacity:.45;pointer-events:none}");
    if (bloqueado()) r.push("main.container>*:not(.cfg-bloqueio){display:none!important}");
    let st = document.getElementById("cfg-css");
    if (!st) { st = document.createElement("style"); st.id = "cfg-css"; document.head.append(st); }
    st.textContent = r.join("\n");
  }

  // ---------- o que mexe nos textos e nas caixas da página ----------
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function aplicarDom() {
    // aviso no topo (ou o aviso de manutenção)
    document.getElementById("site-aviso")?.remove();
    const nav = document.querySelector(".site-nav");
    const av = cfg.manutencao.ativo ? { texto: `🛠️ ${cfg.manutencao.texto}`, tipo: "alerta", link: "" } : cfg.aviso.ativo && cfg.aviso.texto ? cfg.aviso : null;
    if (av && nav) {
      const bar = el(av.link ? "a" : "div", `site-aviso ${av.tipo || "info"}`);
      bar.id = "site-aviso";
      if (av.link) { bar.href = av.link; if (/^https?:/.test(av.link)) { bar.target = "_blank"; bar.rel = "noopener"; } }
      bar.append(el("span", "", av.texto));
      if (av.link) bar.append(el("b", "", " →"));
      nav.after(bar);
    }

    // textos da página inicial
    const t = document.getElementById("inicio-titulo"), x = document.getElementById("inicio-texto");
    if (t) t.textContent = cfg.inicio.titulo || PADRAO.inicio.titulo;
    if (x) x.textContent = cfg.inicio.texto || PADRAO.inicio.texto;

    // banner de destaque
    document.querySelectorAll(".ct-destaque").forEach((b) => {
      const d = cfg.destaque, j = JOGOS.find((g) => g.id === d.jogo) || JOGOS[0];
      const some = !d.ativo || (!cfg.jogos[j.id].ativo && !verTudo());
      b.hidden = some;
      if (some) return;
      b.href = j.pagina;
      b.querySelector(".ct-destaque-selo").textContent = `${j.emoji} ${d.selo || "Destaque"}`;
      b.querySelector("strong").textContent = d.titulo || j.nome;
      b.querySelector(".ct-destaque-txt > .muted").textContent = d.texto || j.texto;
      const best = b.querySelector("[data-best]");
      if (best && best.dataset.best !== j.id) { best.dataset.best = j.id; best.textContent = ""; }
      // a vitrine dos lutadores é da Luta de cartas; os outros jogos mostram o emoji grande
      const cena = b.querySelector(".ct-destaque-cena");
      cena.classList.toggle("emoji", j.id !== "cartas");
      cena.dataset.emoji = j.emoji;
    });

    // página de um jogo desligado
    document.querySelector(".cfg-bloqueio")?.remove();
    if (bloqueado()) {
      const main = document.querySelector("main.container");
      const caixa = el("section", "quiz cfg-bloqueio");
      const fora = cfg.manutencao.ativo;
      caixa.append(el("span", "ex-ico", fora ? "🛠️" : "⛔"),
        el("h2", "", fora ? "Site em manutenção" : `${jogoDaPagina.nome} está desligado agora`),
        el("p", "muted", fora ? cfg.manutencao.texto : cfg.jogos[jogoDaPagina.id].motivo || "Volta em breve. Enquanto isso, dá uma olhada nos outros jogos."));
      const ir = el("a", "button lt-go", "Ver outros jogos");
      ir.href = jogoDaPagina.grupo === "amigos" ? "amigos.html" : "solo.html";
      caixa.append(ir);
      main?.prepend(caixa);
    }
  }

  function aplicar() {
    aplicarCss();
    if (document.readyState !== "loading") aplicarDom();
    window.dispatchEvent(new Event("site-config"));
  }

  // ---------- busca a configuração mais nova ----------
  async function buscar() {
    if (demo || !window.RANKING_CONFIG) return;
    try {
      const base = "https://www.gstatic.com/firebasejs/10.12.2";
      const [app, fs] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-firestore.js`)]);
      const a = app.getApps().find((x) => x.name === "[DEFAULT]") || app.initializeApp(window.RANKING_CONFIG);
      const snap = await Promise.race([
        fs.getDoc(fs.doc(fs.getFirestore(a), "site", "tatame")),
        new Promise((_, no) => setTimeout(() => no(new Error("tempo")), 8000)),
      ]);
      const novo = snap.exists() ? snap.data() : null;
      gravar("site-config", novo);
      cfg = mesclar(novo);
      aplicar();
    } catch (e) {
      console.warn("Configuração do site indisponível, usando a guardada.", e);
    }
  }

  window.siteConfig = () => cfg;
  window.SITE = { JOGOS, PADRAO, mesclar };
  aplicarCss();
  document.addEventListener("DOMContentLoaded", () => { aplicarDom(); buscar(); });
})();
