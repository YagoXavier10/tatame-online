// Painel do admin: login com usuário e senha (só o admin precisa), e daqui liga e desliga jogos, muda o destaque,
// o aviso do topo, a manutenção, os ajustes da Luta de cartas e modera o ranking.
// O usuário e a senha ficam no Firebase Authentication (nunca no código do site), e as regras do Firestore
// só deixam o UID do admin gravar.
// No computador (localhost), ?demo abre um modo de teste que guarda tudo só neste navegador.
const box = document.getElementById("admin");
const { JOGOS, PADRAO, mesclar } = window.SITE;
const FB = "https://www.gstatic.com/firebasejs/10.12.2";
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const demo = local && new URLSearchParams(location.search).has("demo");

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const toast = (t) => window.siteToast?.(t);

let fb = null; // { auth, db, fs, user }
let cfg = mesclar(null);
let salvo = JSON.stringify(cfg);
let ui = {};

// abas do ranking: cada jogo pode ter mais de uma (Qual é a posição? tem duas)
const RANKINGS = JOGOS.flatMap((j) => j.ranking.map((k) => ({
  k, nome: k === "posicoes-relogio" ? `${j.nome} ⏱️` : k === "posicoes-morte" ? `${j.nome} ❤️` : j.nome, emoji: j.emoji,
})));

// ---------- Firebase (um app separado, para não trocar o login anônimo do ranking deste aparelho) ----------
async function abrirFirebase() {
  const [app, auth, fs] = await Promise.all([import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`)]);
  const a = app.getApps().find((x) => x.name === "admin") || app.initializeApp(window.RANKING_CONFIG, "admin");
  const au = auth.getAuth(a);
  fb = { auth, au, fs, db: fs.getFirestore(a), user: null };
  return new Promise((resolve) => auth.onAuthStateChanged(au, (u) => { fb.user = u; resolve(); desenhar(); }));
}

// o usuário vira um e-mail interno do Firebase ("yago" -> "yago@tatame-online.app"); quem preferir digita o e-mail inteiro
const DOMINIO = "tatame-online.app";
const emailDe = (usuario) => (usuario.includes("@") ? usuario : `${usuario}@${DOMINIO}`).trim().toLowerCase();

async function entrar(usuario, senha) {
  ui.erroLogin.textContent = "";
  ui.bEntrar.disabled = true;
  try {
    await fb.auth.signInWithEmailAndPassword(fb.au, emailDe(usuario), senha);
  } catch (e) {
    ui.erroLogin.textContent = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(e.code)
      ? "Usuário ou senha errados."
      : e.code === "auth/too-many-requests"
        ? "Muitas tentativas. Espere uns minutos e tente de novo."
        : e.code === "auth/operation-not-allowed"
          ? "O login com e-mail e senha ainda não foi ativado no Firebase (Authentication → Sign-in method → E-mail/senha)."
          : e.code === "auth/network-request-failed" ? "Sem conexão com a internet." : `Não deu para entrar: ${e.code || e.message}`;
    ui.bEntrar.disabled = false;
  }
}

const docCfg = () => fb.fs.doc(fb.db, "site", "tatame");

async function carregar() {
  if (demo) cfg = mesclar(ler("site-config-demo"));
  else {
    const snap = await fb.fs.getDoc(docCfg());
    cfg = mesclar(snap.exists() ? snap.data() : null);
  }
  salvo = JSON.stringify(cfg);
}

async function salvar() {
  ui.bSalvar.disabled = true;
  ui.estado.textContent = "Salvando…";
  try {
    if (demo) gravar("site-config-demo", cfg);
    else {
      await fb.fs.setDoc(docCfg(), { ...JSON.parse(JSON.stringify(cfg)), atualizado: fb.fs.serverTimestamp(), por: fb.user.uid });
      gravar("site-config", cfg); // este aparelho já vê na hora
    }
    salvo = JSON.stringify(cfg);
    ui.estado.textContent = "✅ Salvo! O site já está usando.";
    toast("Configuração salva");
  } catch (e) {
    ui.estado.textContent = e.code === "permission-denied"
      ? "⛔ Sem permissão: sua conta ainda não é admin nas regras do Firebase (veja o UID lá em cima)."
      : `Não deu para salvar: ${e.code || e.message}`;
  }
  sujo();
}

// marca quando tem alteração para salvar
function sujo() {
  const mudou = JSON.stringify(cfg) !== salvo;
  ui.barra.classList.toggle("mudou", mudou);
  ui.bSalvar.disabled = !mudou;
  if (mudou) ui.estado.textContent = "Alterações não salvas";
}

// ---------- peças do formulário ----------
function secao(emoji, titulo, desc) {
  const s = el("section", "adm-sec");
  const h = el("h2");
  h.append(el("span", "", emoji), document.createTextNode(" " + titulo));
  s.append(h);
  if (desc) s.append(el("p", "muted adm-desc", desc));
  ui.corpo.append(s);
  return s;
}

function chave(rotulo, valor, mudar, ajuda) {
  const l = el("label", "adm-chave");
  const i = el("input");
  i.type = "checkbox";
  i.checked = !!valor;
  i.setAttribute("role", "switch");
  i.addEventListener("change", () => { mudar(i.checked); sujo(); });
  const t = el("span", "adm-chave-txt");
  t.append(el("strong", "", rotulo));
  if (ajuda) t.append(el("small", "muted", ajuda));
  l.append(i, el("span", "adm-switch"), t);
  return l;
}

function campo(rotulo, valor, mudar, { placeholder = "", area = false, max = 200 } = {}) {
  const l = el("label", "adm-campo");
  l.append(el("span", "", rotulo));
  const i = el(area ? "textarea" : "input");
  i.value = valor || "";
  i.placeholder = placeholder;
  i.maxLength = max;
  if (area) i.rows = 3;
  i.addEventListener("input", () => { mudar(i.value); sujo(); });
  l.append(i);
  return l;
}

function escolha(rotulo, valor, opcoes, mudar) {
  const l = el("label", "adm-campo");
  l.append(el("span", "", rotulo));
  const sel = el("select");
  for (const [v, t] of opcoes) {
    const o = el("option", "", t);
    o.value = v;
    if (String(v) === String(valor)) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener("change", () => { mudar(sel.value); sujo(); });
  l.append(sel);
  return l;
}

function botao(texto, fn, cls = "") {
  const b = el("button", `adm-b ${cls}`, texto);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}

// ---------- telas ----------
function desenhar() {
  box.replaceChildren();
  ui = {};
  if (!demo && !window.RANKING_CONFIG) {
    box.append(el("p", "adm-alerta", "O Firebase não está configurado (ranking-config.js)."));
    return;
  }
  if (!demo && !fb?.user) return telaLogin();
  telaPainel();
}

function telaLogin() {
  const c = el("div", "adm-login quiz");
  c.append(el("span", "ex-ico", "🔐"), el("h2", "", "Entrar como admin"),
    el("p", "muted", "Só o administrador precisa entrar. Quem joga continua sem login nenhum."));
  const form = el("form", "adm-form");
  const usuario = el("input");
  usuario.autocomplete = "username";
  usuario.autocapitalize = "none";
  usuario.spellcheck = false;
  usuario.required = true;
  const senha = el("input");
  senha.type = "password";
  senha.autocomplete = "current-password";
  senha.required = true;
  const lu = el("label", "adm-campo"), ls = el("label", "adm-campo");
  lu.append(el("span", "", "Usuário"), usuario);
  ls.append(el("span", "", "Senha"), senha);
  ui.bEntrar = el("button", "button lt-go adm-entrar", "Entrar");
  ui.bEntrar.type = "submit";
  ui.erroLogin = el("p", "rk-error");
  ui.erroLogin.setAttribute("aria-live", "polite");
  form.append(lu, ls, ui.bEntrar, ui.erroLogin);
  form.addEventListener("submit", (e) => { e.preventDefault(); entrar(usuario.value, senha.value); });
  c.append(form);
  if (local) {
    const t = el("a", "adm-link", "Abrir o modo de teste (sem login, só neste navegador) →");
    t.href = "admin.html?demo";
    c.append(t);
  }
  box.append(c);
}

async function telaPainel() {
  box.append(el("p", "muted", "Carregando a configuração…"));
  try { await carregar(); } catch (e) {
    box.replaceChildren(el("p", "adm-alerta", `Não deu para ler a configuração: ${e.code || e.message}`));
    return;
  }
  box.replaceChildren();
  ui.corpo = el("div", "adm-corpo");
  box.append(ui.corpo);
  ui.barra = el("div", "adm-barra");
  ui.estado = el("span", "adm-estado", "Tudo salvo");
  ui.bSalvar = botao("💾 Salvar alterações", salvar, "primario");
  ui.bSalvar.disabled = true;
  ui.barra.append(ui.estado, ui.bSalvar);
  box.append(ui.barra);

  secConta();
  secSite();
  secInicio();
  secJogos();
  secCartas();
  secRanking();
  secNumeros();
  secBackup();
}

function secConta() {
  const s = secao("👤", "Conta");
  if (demo) {
    s.append(el("p", "adm-alerta demo", "🧪 Modo de teste: as mudanças valem só neste navegador e não vão para o site de verdade."));
    s.append(botao("Sair do modo de teste e apagar o teste", () => {
      try { localStorage.removeItem("site-config-demo"); } catch { /* nada */ }
      location.href = "admin.html";
    }));
    return;
  }
  const u = fb.user;
  const quem = el("div", "adm-quem");
  const t = el("div");
  t.append(el("strong", "", `🔓 ${(u.email || "admin").replace(`@${DOMINIO}`, "")}`), el("small", "muted", "Conectado como admin"));
  quem.append(t, botao("Sair", () => fb.auth.signOut(fb.au)));
  s.append(quem);
  const uid = el("div", "adm-uid");
  uid.append(el("span", "muted", "Seu UID (vai nas regras do Firebase):"), el("code", "", u.uid),
    botao("Copiar", async () => { try { await navigator.clipboard.writeText(u.uid); toast("UID copiado"); } catch { toast("Não deu para copiar"); } }));
  s.append(uid);
  s.append(chave("Ver jogos desligados neste aparelho", ler("site-admin-ve-tudo") === true,
    (v) => { gravar("site-admin-ve-tudo", v); toast(v ? "Este aparelho vê tudo" : "Este aparelho vê como todo mundo"); },
    "Para você testar um jogo desligado antes de ligar para todo mundo. Não precisa salvar."));
}

function secSite() {
  const s = secao("🌐", "Site", "Liga e desliga coisas que valem para o site inteiro.");
  s.append(chave("Modo manutenção", cfg.manutencao.ativo, (v) => { cfg.manutencao.ativo = v; }, "Todos os jogos ficam fechados e aparece um aviso vermelho no topo."));
  s.append(campo("Texto da manutenção", cfg.manutencao.texto, (v) => { cfg.manutencao.texto = v; }, { placeholder: PADRAO.manutencao.texto }));
  s.append(chave("Ranking online", cfg.rankingAtivo, (v) => { cfg.rankingAtivo = v; }, "Desligado, some o ranking e o pedido de nickname."));
  s.append(el("h3", "", "📢 Aviso no topo"));
  s.append(chave("Mostrar aviso", cfg.aviso.ativo, (v) => { cfg.aviso.ativo = v; }, "Uma faixa logo abaixo do menu, em todas as páginas."));
  s.append(campo("Texto", cfg.aviso.texto, (v) => { cfg.aviso.texto = v; }, { placeholder: "Ex.: Campeonato interno sábado às 9h! 🥋", max: 140 }));
  s.append(campo("Link (opcional)", cfg.aviso.link, (v) => { cfg.aviso.link = v.trim(); }, { placeholder: "https://… ou cartas.html", max: 300 }));
  s.append(escolha("Cor", cfg.aviso.tipo, [["info", "🔵 Azul (informação)"], ["verde", "🟢 Verde (novidade)"], ["festa", "🟠 Laranja (festa, evento)"], ["alerta", "🔴 Vermelho (importante)"]], (v) => { cfg.aviso.tipo = v; }));
}

function secInicio() {
  const s = secao("🏠", "Página inicial e destaque");
  s.append(campo("Título do início", cfg.inicio.titulo, (v) => { cfg.inicio.titulo = v; }, { placeholder: PADRAO.inicio.titulo, max: 40 }));
  s.append(campo("Texto do início", cfg.inicio.texto, (v) => { cfg.inicio.texto = v; }, { placeholder: PADRAO.inicio.texto, max: 140 }));
  s.append(el("h3", "", "⭐ Banner de destaque"));
  s.append(chave("Mostrar banner", cfg.destaque.ativo, (v) => { cfg.destaque.ativo = v; }, "Aparece no início e no topo do menu solo."));
  s.append(escolha("Jogo em destaque", cfg.destaque.jogo, JOGOS.map((j) => [j.id, `${j.emoji} ${j.nome}`]), (v) => { cfg.destaque.jogo = v; }));
  s.append(campo("Selo", cfg.destaque.selo, (v) => { cfg.destaque.selo = v; }, { placeholder: "Jogo novo", max: 24 }));
  s.append(campo("Título (vazio = nome do jogo)", cfg.destaque.titulo, (v) => { cfg.destaque.titulo = v; }, { max: 40 }));
  s.append(campo("Texto (vazio = descrição do jogo)", cfg.destaque.texto, (v) => { cfg.destaque.texto = v; }, { area: true, max: 200 }));
}

function secJogos() {
  const s = secao("🎮", "Jogos", "Ligue, desligue, marque como novo e mude a ordem nos menus. Jogo desligado some dos menus e do ranking; quem abrir o link vê o motivo.");
  const acoes = el("div", "adm-linha");
  acoes.append(botao("Ligar todos", () => { JOGOS.forEach((j) => { cfg.jogos[j.id].ativo = true; }); sujo(); lista(); }),
    botao("Tirar todos os “Novo”", () => { JOGOS.forEach((j) => { cfg.jogos[j.id].novo = false; }); sujo(); lista(); }));
  s.append(acoes);
  const caixa = el("div");
  s.append(caixa);
  function lista() {
    caixa.replaceChildren();
    for (const [grupo, titulo] of [["solo", "🎮 Solo"], ["amigos", "👥 Com amigos"]]) {
      caixa.append(el("h3", "", titulo));
      const ul = el("ul", "adm-jogos");
      cfg.ordem[grupo].forEach((id, i, ordem) => {
        const j = JOGOS.find((x) => x.id === id), c = cfg.jogos[id];
        const li = el("li", c.ativo ? "" : "off");
        const nome = el("div", "adm-jogo-nome");
        const a = el("a", "", `${j.emoji} ${j.nome}`);
        a.href = j.pagina;
        a.target = "_blank";
        nome.append(a);
        const mover = el("div", "adm-mover");
        const sobe = botao("↑", () => { [ordem[i - 1], ordem[i]] = [ordem[i], ordem[i - 1]]; sujo(); lista(); });
        const desce = botao("↓", () => { [ordem[i + 1], ordem[i]] = [ordem[i], ordem[i + 1]]; sujo(); lista(); });
        sobe.disabled = i === 0; desce.disabled = i === ordem.length - 1;
        sobe.setAttribute("aria-label", `Subir ${j.nome}`); desce.setAttribute("aria-label", `Descer ${j.nome}`);
        mover.append(sobe, desce);
        const liga = chave("Ligado", c.ativo, (v) => { c.ativo = v; lista(); });
        const novo = chave("Novo", c.novo, (v) => { c.novo = v; });
        li.append(nome, liga, novo, mover);
        if (!c.ativo) li.append(campo("Motivo (aparece para quem abrir o jogo)", c.motivo, (v) => { c.motivo = v; }, { placeholder: "Ex.: em manutenção, volta amanhã", max: 120 }));
        ul.append(li);
      });
      caixa.append(ul);
    }
  }
  lista();
}

function secCartas() {
  const s = secao("🎴", "Luta de cartas", "Vale para as próximas lutas de todo mundo.");
  s.append(escolha("Tempo de luta", cfg.cartas.rounds, [[6, "3 minutos (6 rounds)"], [8, "4 minutos (8 rounds)"], [10, "5 minutos (10 rounds)"], [12, "6 minutos (12 rounds)"], [14, "7 minutos (14 rounds)"]], (v) => { cfg.cartas.rounds = Number(v); }));
  s.append(escolha("Dificuldade do computador", cfg.cartas.dificuldade, [["facil", "🟢 Fácil"], ["normal", "🟡 Normal"], ["dificil", "🔴 Difícil"]], (v) => { cfg.cartas.dificuldade = v; }));
}

function secRanking() {
  const s = secao("🏆", "Ranking e moderação");
  s.append(campo("Nicks bloqueados (um por linha)", cfg.nicksBloqueados.join("\n"), (v) => {
    cfg.nicksBloqueados = v.split("\n").map((x) => x.trim()).filter(Boolean);
  }, { area: true, max: 2000, placeholder: "Quem tiver esse nome some do ranking e ninguém consegue usar de novo" }));
  s.append(el("h3", "", "🧹 Apagar pontuações"));
  if (demo) { s.append(el("p", "muted", "Precisa do login de verdade (não funciona no modo de teste).")); return; }
  const linha = el("div", "adm-linha");
  let k = RANKINGS[0].k;
  const sel = escolha("Jogo", k, RANKINGS.map((r) => [r.k, `${r.emoji} ${r.nome}`]), (v) => { k = v; carregarLista(); });
  linha.append(sel);
  s.append(linha);
  const lista = el("ol", "adm-rank");
  const zerar = botao("Zerar o ranking deste jogo", async () => {
    const nome = RANKINGS.find((r) => r.k === k).nome;
    if (prompt(`Isso apaga TODAS as pontuações de “${nome}”. Para confirmar, digite ZERAR`) !== "ZERAR") return;
    try {
      const snap = await fb.fs.getDocs(fb.fs.collection(fb.db, "ranking", k, "scores"));
      await Promise.all(snap.docs.map((d) => fb.fs.deleteDoc(d.ref)));
      toast(`Ranking zerado (${snap.size})`);
    } catch (e) { toast(e.code === "permission-denied" ? "Sem permissão de admin" : "Não deu para zerar"); }
    carregarLista();
  }, "perigo");
  s.append(lista, zerar);
  async function carregarLista() {
    lista.replaceChildren(el("li", "muted", "Carregando…"));
    try {
      const q = fb.fs.query(fb.fs.collection(fb.db, "ranking", k, "scores"), fb.fs.orderBy("score", "desc"), fb.fs.limit(50));
      const snap = await fb.fs.getDocs(q);
      lista.replaceChildren();
      if (snap.empty) lista.append(el("li", "muted", "Ninguém pontuou ainda."));
      snap.docs.forEach((d, i) => {
        const r = d.data();
        const li = el("li");
        li.append(el("span", "adm-pos", `${i + 1}º`), el("strong", "", r.nick), el("span", "muted", Number(r.score).toLocaleString("pt-BR")),
          botao("Apagar", async () => {
            if (!confirm(`Apagar “${r.nick}” (${r.score}) do ranking?`)) return;
            try { await fb.fs.deleteDoc(d.ref); li.remove(); toast("Apagado"); } catch (e) { toast(e.code === "permission-denied" ? "Sem permissão de admin" : "Não deu para apagar"); }
          }, "perigo"));
        lista.append(li);
      });
    } catch (e) { lista.replaceChildren(el("li", "muted", `Não deu para carregar: ${e.code || e.message}`)); }
  }
  carregarLista();
}

function secNumeros() {
  const s = secao("📊", "Números", "Quantas pessoas estão no ranking de cada jogo e quem está em primeiro.");
  if (demo) { s.append(el("p", "muted", "Precisa do login de verdade (não funciona no modo de teste).")); return; }
  const tab = el("div", "adm-numeros");
  s.append(botao("Carregar números", async () => {
    tab.replaceChildren(el("p", "muted", "Contando…"));
    const linhas = await Promise.all(RANKINGS.map(async (r) => {
      try {
        const col = fb.fs.collection(fb.db, "ranking", r.k, "scores");
        const [n, top] = await Promise.all([fb.fs.getCountFromServer(col), fb.fs.getDocs(fb.fs.query(col, fb.fs.orderBy("score", "desc"), fb.fs.limit(1)))]);
        return { ...r, n: n.data().count, top: top.docs[0]?.data() };
      } catch { return { ...r, n: "?", top: null }; }
    }));
    linhas.sort((a, b) => (b.n || 0) - (a.n || 0));
    const total = linhas.reduce((t, l) => t + (Number(l.n) || 0), 0);
    tab.replaceChildren(el("p", "adm-total", `${total} pontuações no ranking, somando todos os jogos`));
    const ul = el("ul", "adm-num");
    for (const l of linhas) {
      const li = el("li");
      li.append(el("span", "", `${l.emoji} ${l.nome}`), el("b", "", String(l.n)), el("small", "muted", l.top ? `🥇 ${l.top.nick} (${Number(l.top.score).toLocaleString("pt-BR")})` : "—"));
      ul.append(li);
    }
    tab.append(ul);
  }), tab);
}

function secBackup() {
  const s = secao("💾", "Backup");
  const linha = el("div", "adm-linha");
  linha.append(botao("Baixar configuração", () => {
    const a = el("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" }));
    a.download = `tatame-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }));
  const arq = el("input");
  arq.type = "file";
  arq.accept = "application/json,.json";
  arq.hidden = true;
  arq.addEventListener("change", async () => {
    try {
      cfg = mesclar(JSON.parse(await arq.files[0].text()));
      telaRecarregar("Configuração importada. Confira e salve.");
    } catch { toast("Arquivo inválido"); }
  });
  linha.append(botao("Importar arquivo", () => arq.click()), arq,
    botao("Voltar ao padrão", () => {
      if (!confirm("Voltar tudo ao padrão? (Só vale depois de salvar.)")) return;
      cfg = mesclar(null);
      telaRecarregar("Tudo voltou ao padrão. Salve para valer no site.");
    }, "perigo"));
  s.append(linha);
}

// redesenha o formulário mantendo a configuração em edição
function telaRecarregar(msg) {
  const atual = cfg;
  ui.corpo.replaceChildren();
  cfg = atual;
  secConta(); secSite(); secInicio(); secJogos(); secCartas(); secRanking(); secNumeros(); secBackup();
  sujo();
  toast(msg);
}

window.addEventListener("beforeunload", (e) => {
  if (ui.bSalvar && JSON.stringify(cfg) !== salvo) { e.preventDefault(); e.returnValue = ""; }
});

if (demo) desenhar();
else if (window.RANKING_CONFIG) abrirFirebase().catch((e) => { box.replaceChildren(el("p", "adm-alerta", `Não deu para abrir o Firebase: ${e.message}`)); });
else desenhar();
