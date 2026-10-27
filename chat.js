// Assistente de perguntas do site: roda no navegador, sem IA paga.
// Reconhece o assunto pelas palavras da pergunta e responde com os dados do próprio site.
(() => {
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const STOP = new Set(("a o os as de da do das dos e em no na nos nas um uma para por com que qual quais quem " +
    "como onde quando quanto quantos quantas me fale sobre conte diga sabe voce vc pra pro tem ha foi sao eh e " +
    "medalha medalhas atleta atletas ouro ouros prata bronze titulo titulos cohab team").split(" "));

  let data = null;
  async function loadData() {
    if (data) return data;
    const [c, a] = await Promise.all([
      fetch("data/cohab-conquistas.json").then((r) => r.json()),
      fetch("data/cohab-atletas.json").then((r) => r.json()),
    ]);
    const medals = [...a.cbjje, ...c.ibjjf];
    const all = medals.length + c.fpjj.reduce((n, f) => n + (f.gold || 0) + (f.silver || 0), 0) +
      c.smoothcomp.reduce((n, s) => n + s.gold + s.silver + s.bronze, 0);
    const golds = medals.filter((m) => m.place === 1).length + c.fpjj.reduce((n, f) => n + (f.gold || 0), 0) +
      c.smoothcomp.reduce((n, s) => n + s.gold, 0);
    data = { c, medals, all, golds };
    return data;
  }

  const link = (href, text) => `<a href="${href}">${text}</a>`;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  // Cada assunto: palavras que o identificam e a resposta
  const TOPICS = [
    {
      keys: ["ola", "oi", "bom dia", "boa tarde", "boa noite", "e ai", "salve"],
      answer: () => "Oss! 👋 Pode me perguntar sobre a Cohab Team, os mestres, as conquistas, os próximos campeonatos ou buscar um atleta pelo nome.",
    },
    {
      keys: ["mestre dan", "everdan", "dan"],
      answer: () => `O Mestre Dan (Everdan Olegário da Silva) foi o primeiro aluno da Cohab, em 1998, e hoje lidera a equipe. Recebeu a faixa preta em 2005 das mãos de Fernando Tererê e formou campeões como Sérgio Moraes. Em 2026 foi homenageado pela Câmara Municipal de SP. Veja a ${link("historia.html", "história da Cohab")}.`,
    },
    {
      keys: ["fluido", "caiman"],
      answer: () => `O Mestre Fluído Caiman divide a liderança da Cohab Team com o Mestre Dan. Em 2015 gravou a série "Aprenda Jiu-Jitsu com Fluído Caiman" no dojo do Mestre Dan. Mais na ${link("historia.html", "página da Cohab")}.`,
    },
    {
      keys: ["sergio moraes", "serginho", "orgulho da cohab"],
      answer: () => "Sérgio Moraes, “O Orgulho da Cohab”, nasceu na Cohab 2. Foi campeão mundial na faixa marrom (2006) e na preta (2008), somou quatro títulos mundiais, foi vice do TUF Brasil e lutou no UFC.",
    },
    {
      keys: ["endereco", "onde fica", "localizacao", "onde treina", "onde treinar", "treinar", "como chegar", "mapa", "itaquera", "victorio", "aula", "aulas"],
      answer: () => `A Cohab Team fica na Rua Victório Santim, 625, em Itaquera, São Paulo. ${link("https://www.google.com/maps/search/?api=1&query=Rua+Vict%C3%B3rio+Santim+625+Itaquera+S%C3%A3o+Paulo", "Abrir no mapa ↗")}`,
    },
    {
      keys: ["projeto social", "nasci pra vencer", "nasci para vencer", "gratis", "gratuito", "criancas"],
      answer: () => "O projeto social Nasci pra Vencer, criado pelo Mestre Dan, leva jiu-jitsu gratuito a crianças e jovens da Cohab desde 1998. Já atendeu mais de 3.000 pessoas.",
    },
    {
      keys: ["historia da cohab", "fundacao", "fundada", "fundou", "comecou", "1998", "tony", "linhagem", "alliance", "tt jiu"],
      answer: () => `A Cohab Team nasceu em setembro de 1998 no centro esportivo da Cohab José Bonifácio, com o professor Tony e um único aluno, o Dan. Passou pela TT Jiu-Jitsu (2004) e pela Alliance (2007–2018) e hoje é a Cohab Team Brazilian Jiu-Jitsu, com 16 unidades no Brasil e filiais na América do Sul. Tudo em ${link("historia.html", "História da Cohab")}.`,
    },
    {
      keys: ["filial", "filiais", "unidades", "tamoio", "f4"],
      answer: () => "A Cohab tem 16 unidades no Brasil (entre elas a Cohab Tamoio e a Cohab Team F4) e filiais na Argentina, no Chile, no Equador e no Peru.",
    },
    {
      keys: ["pan", "panamericano", "pan-americano", "ultimo campeonato", "mais recente"],
      answer: async () => {
        const { c } = await loadData();
        const pans = c.team.filter((t) => /pan-americano/i.test(t.event)).sort((a, b) => b.year - a.year);
        if (!pans.length) return "Não encontrei o Pan-Americano nos dados.";
        const p = pans[0];
        return `No ${p.event} ${p.year} a Cohab ficou em ${p.pos}º lugar geral por equipe, com ${p.gold} ouros, ${p.silver} pratas e ${p.bronze} bronzes. ${p.note ? p.note + "." : ""} ${link("conquistas.html#equipe", "Ver conquistas")}`;
      },
    },
    {
      keys: ["titulos", "titulo", "campea", "campeao geral", "conquistas", "conquista", "venceu", "ganhou"],
      answer: async () => {
        const { c } = await loadData();
        const wins = c.team.filter((t) => t.pos === 1).sort((a, b) => b.year - a.year);
        const lista = wins.slice(0, 6).map((t) => `${t.event} (${t.year})`).join(", ");
        return `A Cohab foi campeã geral por equipe em ${plural(wins.length, "campeonato", "campeonatos")}. Os mais recentes: ${lista}. ${link("conquistas.html", "Ver todas as conquistas")}`;
      },
    },
    {
      keys: ["quantas medalhas", "total de medalhas", "quantos ouros", "medalhas da cohab", "numeros", "estatistica"],
      answer: async () => {
        const d = await loadData();
        return `Somando todas as federações, a Cohab tem ${d.all.toLocaleString("pt-BR")} medalhas, sendo ${d.golds.toLocaleString("pt-BR")} ouros. O detalhe por ano e por federação está em ${link("conquistas.html", "Conquistas")}.`;
      },
    },
    {
      keys: ["melhor atleta", "mais medalhas", "maior campeao", "quem tem mais", "ranking de atletas", "top"],
      answer: async () => {
        const { medals } = await loadData();
        const by = new Map();
        medals.filter((m) => !m.kids && !/^\p{L}\. /u.test(m.athlete)).forEach((m) => {
          const k = norm(m.athlete);
          if (!by.has(k)) by.set(k, { name: m.athlete, g: 0 });
          if (m.place === 1) by.get(k).g++;
        });
        const top = [...by.values()].sort((a, b) => b.g - a.g).slice(0, 3);
        return `Quem mais tem ouros: ${top.map((t, i) => `${i + 1}º ${t.name} (${t.g})`).join(", ")}. ${link("conquistas.html", "Ver o ranking")}`;
      },
    },
    {
      keys: ["quiz", "jogo", "jogos", "jogar", "brincadeira", "teste", "game", "arbitro", "mito"],
      answer: () => `Na aba ${link("jogos.html", "Jogos")} tem o ${link("posicoes.html", "Qual é a posição?")}, em que você acerta a posição da foto contra o relógio, o ${link("caminho.html", "Caminho da finalização")}, em que você escolhe cada passo até finalizar, o ${link("arbitro.html", "Árbitro por um dia")}, o ${link("regras.html", "Regra ou mito?")} e o ${link("quiz.html", "Quiz de jiu-jitsu")} com 5 níveis, da faixa branca (fácil) à preta (muito difícil), com fotos de lendas e posições. Será que você chega na preta? 🥋`,
    },
    {
      keys: ["video", "videos", "video de", "videos de", "aula de", "aulas de", "video de aula", "videos de aula", "aprender", "youtube", "tecnica", "tecnicas", "posicao", "posicoes"],
      answer: () => `Na aba ${link("videos.html", "Vídeos")} tem aulas de jiu-jitsu de vários canais, separadas por assunto (guarda, passagem, raspagem, finalizações, quedas) e em português ou inglês. Os vídeos novos entram sozinhos todo dia.`,
    },
    {
      keys: ["historia do jiu jitsu", "historia do jiu-jitsu", "origem", "gracie", "helio", "carlos gracie", "maeda", "conde koma", "kano", "kimura", "japao", "ufc", "royce"],
      answer: () => `O jiu-jitsu veio do Japão: o judoca Mitsuyo Maeda (Conde Koma) chegou ao Brasil em 1914 e ensinou Carlos Gracie em Belém. Hélio Gracie adaptou as técnicas para depender de alavanca, e em 1993 o Royce venceu o primeiro UFC. ${link("jiujitsu.html#historia", "Ver a linha do tempo")}`,
    },
    {
      keys: ["faixa", "faixas", "graduacao", "grau", "graus", "faixa preta", "faixa azul", "faixa roxa", "faixa marrom", "coral"],
      answer: () => `A ordem adulta é branca, azul (a partir de 16 anos), roxa, marrom (18) e preta (19). Depois vêm a coral e a vermelha, para quem dedicou décadas à arte. Crianças usam cinza, amarela, laranja e verde. ${link("jiujitsu.html#faixas", "Ver as faixas")}`,
    },
    {
      keys: ["pontos", "pontuacao", "ponto", "regra", "regras", "vantagem", "vantagens", "punicao", "quanto vale", "vale", "montada", "raspagem", "passagem", "queda", "joelho na barriga"],
      answer: () => `Queda, raspagem e joelho na barriga valem 2; passagem de guarda vale 3; montada e pegada nas costas valem 4. Finalização vence na hora. ${link("jiujitsu.html#pontos", "Ver a pontuação")}`,
    },
    {
      keys: ["oss", "glossario", "significa", "significado"],
      answer: () => `Os termos do tatame (oss, rola, drill, guarda, raspagem, berimbolo…) estão no ${link("jiujitsu.html#glossario", "glossário")}, com busca.`,
    },
    {
      keys: ["proximo campeonato", "campeonato", "campeonatos", "inscricao", "inscricoes", "calendario", "proxima competicao", "mundial"],
      answer: async () => {
        const d = await fetch("data/campeonatos.json").then((r) => r.json());
        const next = d.events.filter((e) => e.cbjje).slice(0, 3);
        if (!next.length) return `Não há campeonatos marcados agora. Veja o ${link("campeonatos.html", "calendário")}.`;
        const fmt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
        return "Próximos campeonatos da CBJJE: " + next.map((e) => `${e.name} (${fmt(e.first_day)}, ${e.city || "local a definir"})`).join("; ") + `. ${link("campeonatos.html", "Ver o calendário completo")}`;
      },
    },
    {
      keys: ["quem fez", "criador", "desenvolvedor", "yago"],
      answer: () => `O site foi feito pelo ${link("https://yagoxavier10.github.io/portfolio-noticias/", "Yago dos Santos")}, faixa azul de jiu-jitsu e estudante de Engenharia de Software.`,
    },
    {
      keys: ["noticia", "noticias", "temas", "manchete"],
      answer: () => `A aba ${link("noticias.html", "Notícias")} traz as manchetes do dia sobre jiu-jitsu, campeonatos em SP, CBJJE/IBJJF/ADCC e MMA. Elas se atualizam sozinhas toda manhã.`,
    },
    {
      keys: ["contato", "instagram", "linkedin", "github", "rede social", "redes sociais", "falar com"],
      answer: () => `Você encontra o Yago no ${link("https://www.instagram.com/yag0.xs/", "Instagram")}, no ${link("https://www.linkedin.com/in/yago-dos-santos-20157a25a/", "LinkedIn")} e no ${link("https://github.com/YagoXavier10", "GitHub")}.`,
    },
    {
      keys: ["como funciona", "atualiza", "atualizado", "feito com", "site"],
      answer: () => "O site é atualizado sozinho: as notícias, os campeonatos e os vídeos todo dia de manhã, e as conquistas da Cohab toda segunda-feira, buscadas nas federações (CBJJE, IBJJF, FPJJ e outras).",
    },
  ];

  // Busca de atleta pelo nome nos dados de medalhas
  async function athleteAnswer(q) {
    const words = norm(q).split(/[^a-z.]+/).filter((w) => w.length >= 3 && !STOP.has(w));
    if (!words.length) return null;
    const { medals } = await loadData();
    const by = new Map();
    medals.forEach((m) => {
      const n = norm(m.athlete);
      if (words.every((w) => n.includes(w))) {
        if (!by.has(n)) by.set(n, { name: m.athlete, c: { 1: 0, 2: 0, 3: 0 }, last: m });
        const a = by.get(n);
        a.c[m.place]++;
        if (m.year > a.last.year) a.last = m;
      }
    });
    const found = [...by.values()].sort((a, b) => (b.c[1] + b.c[2] + b.c[3]) - (a.c[1] + a.c[2] + a.c[3]));
    if (!found.length) return null;
    if (found.length > 4) {
      return `Encontrei ${found.length} atletas com esse nome. Tente o nome completo ou veja na ${link(`atletas.html?q=${encodeURIComponent(words.join(" "))}`, "busca de atletas")}.`;
    }
    return found.map((a) => {
      const total = a.c[1] + a.c[2] + a.c[3];
      return `<b>${a.name}</b>: ${plural(total, "medalha", "medalhas")} (🥇 ${a.c[1]} · 🥈 ${a.c[2]} · 🥉 ${a.c[3]}). Mais recente: ${a.last.event} (${a.last.year}). ${link(`atletas.html?q=${encodeURIComponent(a.name)}`, "Ver todas")}`;
    }).join("<br>");
  }

  async function reply(q) {
    const t = norm(q);
    let best = null, score = 0;
    for (const topic of TOPICS) {
      const s = topic.keys.reduce((n, k) => n + (new RegExp(`\\b${k}\\b`).test(t) ? k.length : 0), 0);
      if (s > score) { score = s; best = topic; }
    }
    const athlete = await athleteAnswer(q).catch(() => null);
    // nome de atleta tem prioridade quando a pergunta fala de medalhas/atleta ou não bate com nenhum assunto
    if (athlete && (!best || /medalh|atleta|ouro|lutou|competi/.test(t) || score <= 4)) return athlete;
    if (best) return best.answer();
    return `Ainda não sei responder isso 😅. Tente perguntar sobre: a história da Cohab ou do jiu-jitsu, o Mestre Dan, os títulos, as faixas, a pontuação, os próximos campeonatos, vídeos de aula, onde treinar ou o nome de um atleta.`;
  }

  // ---------- interface ----------
  const SUGGEST = ["Títulos da Cohab", "Próximo campeonato", "História do jiu-jitsu", "Vídeos de aula", "Quem é o Mestre Dan?", "Onde treinar?"];
  const root = document.createElement("div");
  root.className = "chatbot";
  root.innerHTML = `
    <button class="chat-toggle" aria-expanded="false" aria-controls="chat-panel">💬 <span>Pergunte</span></button>
    <section class="chat-panel" id="chat-panel" hidden aria-label="Assistente do site">
      <header class="chat-head"><strong>Assistente do site</strong><button class="chat-close" aria-label="Fechar">×</button></header>
      <div class="chat-log" aria-live="polite"></div>
      <div class="chat-suggest"></div>
      <form class="chat-form"><input type="text" placeholder="Digite sua pergunta…" aria-label="Sua pergunta" autocomplete="off"><button type="submit">Enviar</button></form>
    </section>`;
  document.body.append(root);

  const toggle = root.querySelector(".chat-toggle");
  const panel = root.querySelector(".chat-panel");
  const log = root.querySelector(".chat-log");
  const input = root.querySelector("input");
  const bubble = (html, who) => {
    const b = document.createElement("div");
    b.className = `chat-msg ${who}`;
    if (who === "user") b.textContent = html; else b.innerHTML = html;
    log.append(b);
    log.scrollTop = log.scrollHeight;
  };
  const ask = async (q) => {
    if (!q.trim()) return;
    bubble(q, "user");
    input.value = "";
    try { bubble(await reply(q), "bot"); } catch { bubble("Não consegui carregar os dados agora. Tente de novo em instantes.", "bot"); }
  };
  SUGGEST.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.addEventListener("click", () => ask(s));
    root.querySelector(".chat-suggest").append(b);
  });
  const open = (v) => {
    panel.hidden = !v;
    toggle.setAttribute("aria-expanded", v);
    if (v) {
      if (!log.children.length) bubble("Oss! 👋 Sou o assistente da Cohab Team. Pergunte sobre a história, os mestres, as conquistas, os próximos campeonatos ou o nome de um atleta.", "bot");
      input.focus();
      loadData().catch(() => {});
    }
  };
  toggle.addEventListener("click", () => open(panel.hidden));
  root.querySelector(".chat-close").addEventListener("click", () => open(false));
  root.querySelector(".chat-form").addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) open(false); });
})();
