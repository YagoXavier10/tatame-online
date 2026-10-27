// Nickname e ranking dos jogos.
// Com o Firebase configurado (ranking-config.js), o ranking é online e igual para todo mundo;
// sem configuração, ele guarda só as pontuações deste aparelho.
const FIREBASE = "10.12.2";

export const GAMES = {
  "posicoes-relogio": { name: "Qual é a posição? ⏱️", short: "Posição ⏱️", unit: "pontos" },
  "posicoes-morte": { name: "Qual é a posição? ❤️", short: "Posição ❤️", unit: "pontos" },
  regras: { name: "Regra ou mito?", short: "Regra ou mito", unit: "pontos" },
  arbitro: { name: "Árbitro por um dia", short: "Árbitro", unit: "estrelas" },
  caminho: { name: "Caminho da finalização", short: "Caminho", unit: "estrelas" },
  quiz: { name: "Quiz de jiu-jitsu", short: "Quiz", unit: "acertos" },
  luta: { name: "Luta ao vivo", short: "Luta ao vivo 🥊", unit: "vitórias", one: "vitória" },
};

// se o navegador bloquear o armazenamento (aba anônima, privacidade), guarda na memória enquanto a página estiver aberta
const memory = {};
const store = {
  get: (k, d) => {
    try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v) ?? d; } catch { /* sem armazenamento */ }
    return k in memory ? memory[k] : d;
  },
  set: (k, v) => {
    memory[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fica só na memória */ }
  },
};
// internet lenta ou bloqueada: desiste depois de alguns segundos em vez de travar
const timeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// palavras longas: bloqueia em qualquer lugar; curtas: só no começo ou no fim de uma palavra ("computador" passa)
const BLOCKED_ANY = ["caralh", "bucet", "arrombad", "vagabund", "desgraca", "xoxota", "punheta", "siririca", "piroca", "cuzao", "hitler", "cohabteam"];
const BLOCKED_EDGE = ["porra", "merda", "puta", "viado", "fdp", "pqp", "bosta", "corno", "nazi", "admin", "oficial"];

// ---------- onde as pontuações ficam ----------
const local = {
  online: false,
  me: "eu",
  async best(game) { return store.get("rk-local", {})[game]?.score ?? null; },
  async save(game, nick, score) {
    const all = store.get("rk-local", {});
    all[game] = { nick, score };
    store.set("rk-local", all);
  },
  async top(game) {
    const e = store.get("rk-local", {})[game];
    return e ? [{ id: "eu", nick: e.nick, score: e.score }] : [];
  },
  async rank() { return 1; },
};

async function firebase(cfg) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE}`;
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(cfg);
  const a = auth.getAuth(app);
  // cada aparelho ganha um login anônimo: só ele pode mudar as próprias pontuações
  const user = await new Promise((resolve, reject) => {
    const off = auth.onAuthStateChanged(a, (u) => {
      off();
      if (u) resolve(u); else auth.signInAnonymously(a).then((c) => resolve(c.user), reject);
    });
  });
  const db = fs.getFirestore(app);
  const scores = (game) => fs.collection(db, "ranking", game, "scores");
  const T = 9000;
  return {
    online: true,
    me: user.uid,
    user,
    fs,
    db,
    async best(game) {
      const snap = await timeout(fs.getDoc(fs.doc(scores(game), user.uid)), T);
      return snap.exists() ? snap.data().score : null;
    },
    async save(game, nick, score) {
      // sem internet, o Firebase guarda e envia quando a conexão voltar
      await timeout(fs.setDoc(fs.doc(scores(game), user.uid), { nick, score, updated: fs.serverTimestamp() }), T);
    },
    async top(game, n) {
      const snap = await timeout(fs.getDocs(fs.query(scores(game), fs.orderBy("score", "desc"), fs.limit(n))), T);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async rank(game, score) {
      const c = await timeout(fs.getCountFromServer(fs.query(scores(game), fs.where("score", ">", score))), T);
      return c.data().count + 1;
    },
  };
}

const configured = !!window.RANKING_CONFIG;
let problem = false;
const ready = (configured ? timeout(firebase(window.RANKING_CONFIG), 12000) : Promise.resolve(local))
  .catch((e) => {
    // Firebase bloqueado (bloqueador de anúncios, rede da escola/empresa) ou sem internet
    console.warn("Ranking online indisponível, usando o deste aparelho.", e);
    problem = true;
    return local;
  });

// ---------- nickname ----------
export function nick() { return store.get("rk-nick", ""); }

export function checkNick(value) {
  const n = value.trim().replace(/\s+/g, " ");
  if (n.length < 3) return [null, "Use pelo menos 3 letras."];
  if (n.length > 16) return [null, "Use no máximo 16 caracteres."];
  if (!/[\p{L}\p{N}]/u.test(n)) return [null, "Use pelo menos uma letra ou número."];
  if (!/^[\p{L}\p{N} _.-]+$/u.test(n)) return [null, "Use só letras, números, espaço, ponto, _ ou -."];
  const flat = norm(n).replace(/[^a-z0-9]/g, "");
  const words = [flat, ...norm(n).split(/[^a-z0-9]+/).filter(Boolean)];
  const bad = BLOCKED_ANY.some((w) => flat.includes(w))
    || BLOCKED_EDGE.some((w) => words.some((x) => x.startsWith(w) || x.endsWith(w)));
  if (bad) return [null, "Escolha outro nickname, por favor."];
  return [n, null];
}

export function setNick(value) {
  const [n, err] = checkNick(value);
  if (err) return err;
  store.set("rk-nick", n);
  return null;
}

// ---------- pontuações ----------
// envia a pontuação e devolve o recorde que ficou no ranking
export async function submit(game, score) {
  const n = nick();
  if (!n || !GAMES[game] || !(score > 0)) return null;
  const b = await ready;
  const prev = await b.best(game);
  const best = Math.max(prev ?? 0, Math.round(score));
  const prevNick = store.get("rk-sent", {})[game];
  if (prev === null || best > prev || prevNick !== n) {
    await b.save(game, n, best);
    const sent = store.get("rk-sent", {});
    sent[game] = n;
    store.set("rk-sent", sent);
  }
  return best;
}

// recordes que já estavam salvos no aparelho, de antes do nickname
function localBests() {
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const pg = store.get("pg-recordes", {});
  return {
    "posicoes-relogio": pg.relogio || 0,
    "posicoes-morte": pg.morte || 0,
    regras: store.get("rm-recorde", 0),
    arbitro: sum(store.get("ar-estrelas", {})),
    caminho: sum(store.get("cm-estrelas", {})),
    quiz: sum(store.get("quiz-faixas", {})),
    luta: store.get("lt-vitorias", 0),
  };
}
export async function sync() {
  const bests = localBests();
  for (const [game, score] of Object.entries(bests)) {
    if (score > 0) await submit(game, score).catch(() => null);
  }
}
export { localBests };

export async function top(game, n = 20) { return (await ready).top(game, n); }
export async function rank(game, score) { return (await ready).rank(game, score); }
// conexão com o Firebase para a Luta ao vivo (null se estiver sem ranking online)
export async function cloud() { const b = await ready; return b.online ? { fs: b.fs, db: b.db, uid: b.me, user: b.user } : null; }
export async function info() { const b = await ready; return { online: b.online, me: b.me, configured, problem }; }

// ---------- selo para a tela final dos jogos ----------
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// "1 vitória", "2 vitórias"
export const unit = (game, n) => (n === 1 && GAMES[game].one) || GAMES[game].unit;

export function badge(game, score) {
  const box = el("div", "rk-badge");
  const send = async () => {
    box.replaceChildren(el("span", "muted", "Enviando para o ranking…"));
    try {
      const best = await submit(game, score);
      if (best === null) { box.remove(); return; }
      const { online, problem: off } = await info();
      const pos = online ? await rank(game, best) : 1;
      box.replaceChildren();
      const line = el("p");
      line.append(el("span", "rk-medal", pos <= 3 ? ["🥇", "🥈", "🥉"][pos - 1] : "🏅"));
      line.append(document.createTextNode(best > score
        ? ` Seu recorde de ${best.toLocaleString("pt-BR")} ${unit(game, best)} segue no ranking`
        : ` ${nick()} entrou no ranking com ${best.toLocaleString("pt-BR")} ${unit(game, best)}`));
      if (online) line.append(document.createTextNode(`: você está em ${pos}º lugar.`));
      else line.append(document.createTextNode(off ? " (guardado neste aparelho; sem conexão com o ranking online agora)." : "."));
      const link = el("a", "rk-link", "Ver o ranking →");
      link.href = `jogos.html?ranking=${game}#ranking`;
      box.append(line, link);
    } catch (e) {
      console.warn(e);
      box.replaceChildren(el("span", "muted", navigator.onLine === false
        ? "Sem internet: sua pontuação vai para o ranking quando a conexão voltar."
        : "Não foi possível enviar ao ranking agora. Seu recorde fica salvo e entra no ranking na próxima partida."));
    }
  };
  if (nick()) { send(); return box; }
  // sem nickname: pede ali mesmo
  const form = el("form", "rk-inline");
  form.append(el("label", "", "Coloque um nickname para entrar no ranking:"));
  const row = el("div", "rk-inline-row");
  const input = el("input");
  input.maxLength = 16;
  input.placeholder = "Seu nickname";
  input.autocomplete = "nickname";
  input.setAttribute("aria-label", "Seu nickname");
  const btn = el("button", "button", "Entrar no ranking");
  btn.type = "submit";
  row.append(input, btn);
  const msg = el("p", "rk-error");
  msg.setAttribute("aria-live", "polite");
  form.append(row, msg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = setNick(input.value);
    if (err) { msg.textContent = err; return; }
    await send();
    sync();
  });
  box.append(form);
  return box;
}

window.cohabRanking = { GAMES, nick, setNick, checkNick, submit, sync, top, rank, info, badge, localBests, cloud, unit };
window.dispatchEvent(new Event("cohab-ranking"));
