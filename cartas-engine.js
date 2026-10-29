// Luta de cartas: o motor do jogo (regras, cartas e IA), sem nada de tela.
// Roda no navegador (window.CartasEngine) e no Node (require), para dar para testar.
// Cada lutador é "eu" ou "ia". A posição é guardada como { pos, cima }: "cima" é quem está por cima
// (nas costas, quem pegou as costas). Do ponto de vista de cada um, isso vira um papel: "montada-cima", "guarda-baixo"...
(function (root) {
  const POSICOES = {
    empe: { nome: "Em pé" },
    fechada: { nome: "Guarda fechada" },
    aberta: { nome: "Guarda aberta" },
    meia: { nome: "Meia-guarda" },
    cem: { nome: "100 kg" },
    montada: { nome: "Montada" },
    costas: { nome: "Costas" },
  };

  // como cada papel é dito na tela (↑ por cima, ↓ por baixo) e quanto ele vale (a IA usa para escolher a jogada)
  const PAPEIS = {
    empe: { nome: "Em pé", curto: "Em pé", valor: 0 },
    "fechada-baixo": { nome: "Guarda fechada, por baixo", curto: "Fechada ↓", valor: 1 },
    "fechada-cima": { nome: "Na guarda fechada dele", curto: "Fechada ↑", valor: 0 },
    "aberta-baixo": { nome: "Guarda aberta, por baixo", curto: "Aberta ↓", valor: 0 },
    "aberta-cima": { nome: "Na guarda aberta dele", curto: "Aberta ↑", valor: 1 },
    "meia-baixo": { nome: "Meia-guarda, por baixo", curto: "Meia ↓", valor: -2 },
    "meia-cima": { nome: "Na meia-guarda dele", curto: "Meia ↑", valor: 2 },
    "cem-baixo": { nome: "Embaixo do 100 kg", curto: "100 kg ↓", valor: -5 },
    "cem-cima": { nome: "No 100 kg", curto: "100 kg ↑", valor: 5 },
    "montada-baixo": { nome: "Montado por ele", curto: "Montada ↓", valor: -7 },
    "montada-cima": { nome: "Montado nele", curto: "Montada ↑", valor: 7 },
    "costas-baixo": { nome: "Ele pegou suas costas", curto: "Costas ↓", valor: -9 },
    "costas-cima": { nome: "Nas costas dele", curto: "Costas ↑", valor: 9 },
  };

  // As cartas. "de": papéis de onde dá para jogar. "para": papel em que você fica se der certo
  // (texto, ou um mapa papel de origem -> papel final). "pontos" segue a regra da IBJJF.
  // "chance" é a base; cada pegada sua soma 8% e cada pegada dele tira 8%.
  const CARTAS = {
    puxar: {
      nome: "Puxar pra guarda", arte: "🪢", custo: 1, de: ["empe"], para: "fechada-baixo", chance: 95,
      texto: "Leva a luta pro chão com você por baixo, na guarda fechada. Não vale ponto.",
    },
    baiana: {
      nome: "Baiana", arte: "🐂", custo: 2, de: ["empe"], para: "aberta-cima", chance: 55, pontos: 2, tipo: "Queda",
      tiraPegada: 1, texto: "Entra nas duas pernas e derruba. Cai na guarda aberta dele. Tira 1 pegada dele.",
    },
    quadril: {
      nome: "Queda de quadril", arte: "🌪️", custo: 2, de: ["empe"], para: "cem-cima", chance: 65, pontos: 2, tipo: "Queda",
      precisa: 1, texto: "Encaixa o quadril e projeta. Cai direto no 100 kg. Gasta 1 pegada.",
    },
    quebra: {
      nome: "Quebra-pegada", arte: "✂️", custo: 1, de: "todas", chance: 100, tiraPegada: 2, ganhaPegada: 1,
      texto: "Solta as mãos dele e já pega a sua: tira 2 pegadas dele e você ganha 1.",
    },
    postura: {
      nome: "Postura", arte: "🧱", custo: 1, de: "todas", chance: 100, postura: true,
      texto: "Fecha a defesa: até a sua próxima vez, os golpes dele têm 20% a menos de chance.",
    },
    abrir: {
      nome: "Abrir a guarda", arte: "🚪", custo: 1, de: ["fechada-cima"], para: "aberta-cima", chance: 80,
      texto: "Fica de pé dentro da guarda e abre as pernas dele. Prepara a passagem.",
    },
    tesoura: {
      nome: "Raspagem de tesoura", arte: "🔀", custo: 2, de: ["fechada-baixo", "aberta-baixo"], para: "meia-cima", chance: 55,
      pontos: 2, tipo: "Raspagem", precisa: 1, texto: "Corta com as pernas e inverte: você cai por cima, na meia-guarda dele. Gasta 1 pegada.",
    },
    toreando: {
      nome: "Toreando", arte: "🐃", custo: 2, de: ["aberta-cima"], para: "cem-cima", chance: 55, pontos: 3, tipo: "Passagem",
      texto: "Segura as calças, joga as pernas pro lado e passa a guarda. Cai no 100 kg.",
    },
    esmagar: {
      nome: "Esmagar a meia", arte: "🪨", custo: 2, de: ["meia-cima"], para: "cem-cima", chance: 60, pontos: 3, tipo: "Passagem",
      precisa: 1, texto: "Amassa o peito dele, solta a perna presa e passa. Gasta 1 pegada.",
    },
    joelho: {
      nome: "Joelho na barriga", arte: "🦵", custo: 1, de: ["cem-cima"], fica: true, chance: 75, pontos: 2, tipo: "Joelho na barriga",
      umaVez: true, texto: "Sobe o joelho na barriga dele e segura. Vale uma vez a cada 100 kg.",
    },
    montar: {
      nome: "Montar", arte: "🐎", custo: 2, de: ["cem-cima"], para: "montada-cima", chance: 60, pontos: 4, tipo: "Montada",
      texto: "Passa o joelho por cima da barriga e senta. Montada!",
    },
    costas: {
      nome: "Pegar as costas", arte: "🎒", custo: 2, de: ["montada-cima", "cem-cima"], para: "costas-cima", chance: 50, pontos: 4,
      tipo: "Pegada das costas", precisa: 1, texto: "Quando ele vira, você entra com os ganchos. Gasta 1 pegada.",
    },
    fuga: {
      nome: "Fuga de quadril", arte: "🦐", custo: 2, chance: 55,
      de: ["cem-baixo", "montada-baixo", "meia-baixo", "costas-baixo"],
      para: { "cem-baixo": "aberta-baixo", "montada-baixo": "meia-baixo", "meia-baixo": "aberta-baixo", "costas-baixo": "fechada-baixo" },
      texto: "Faz o camarão e recoloca a guarda. Sai uma posição pior pra uma melhor.",
    },
    upa: {
      nome: "Upa", arte: "🌉", custo: 2, de: ["montada-baixo"], para: "fechada-cima", chance: 50,
      texto: "Prende um braço, faz a ponte e rola. Você cai dentro da guarda dele. Não vale ponto.",
    },
    mataleao: {
      nome: "Mata-leão", arte: "🦁", custo: 3, de: ["costas-cima"], chance: 45, finaliza: true, precisa: 1,
      texto: "Passa o braço no pescoço e aperta. Se encaixar, acabou. Precisa de 1 pegada.",
    },
    armlock: {
      nome: "Armlock", arte: "💪", custo: 3, de: ["montada-cima", "fechada-baixo"], chance: 30, finaliza: true,
      falha: { "montada-cima": "aberta-baixo" },
      texto: "Estica o braço dele. Da montada, se escapar, você cai por baixo.",
    },
    triangulo: {
      nome: "Triângulo", arte: "🔺", custo: 3, de: ["fechada-baixo", "aberta-baixo"], chance: 30, finaliza: true,
      texto: "Fecha as pernas no pescoço e num braço dele. Se encaixar, acabou.",
    },
  };

  // quantas de cada carta vão no baralho (25 no total)
  const BARALHO = {
    puxar: 2, baiana: 2, quadril: 1, quebra: 2, postura: 1, abrir: 1, tesoura: 2, toreando: 2, esmagar: 2,
    joelho: 1, montar: 2, costas: 1, fuga: 2, upa: 1, mataleao: 1, armlock: 1, triangulo: 1,
  };

  const CONFIG = {
    rounds: 10, // padrão; cada round é uma vez sua e uma dele
    folego: 3, // energia por vez
    mao: 5,
    maxPegada: 3,
    custoPegada: 1,
    custoTrocar: 1,
  };

  // números aleatórios com semente, para os testes repetirem a mesma luta
  function rngSemente(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // chance a mais (ou a menos) dos golpes do computador em cada dificuldade
  const BONUS_IA = { facil: -10, normal: 5, dificil: 18 };

  const outro = (quem) => (quem === "eu" ? "ia" : "eu");

  function embaralhar(lista, rng) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }

  function novoLutador(rng) {
    const baralho = [];
    for (const [id, n] of Object.entries(BARALHO)) for (let i = 0; i < n; i++) baralho.push(id);
    return { pontos: 0, vant: 0, folego: 0, pegada: 0, postura: false, mao: [], baralho: embaralhar(baralho, rng), descarte: [], tentativas: 0 };
  }

  function comprar(l, n, rng) {
    for (let i = 0; i < n; i++) {
      if (!l.baralho.length) {
        if (!l.descarte.length) return;
        l.baralho = embaralhar(l.descarte, rng);
        l.descarte = [];
      }
      l.mao.push(l.baralho.pop());
    }
  }

  function novaLuta(opcoes = {}) {
    const rng = opcoes.rng || (opcoes.seed !== undefined ? rngSemente(opcoes.seed) : Math.random);
    // quem começa é sorteado (quem começa tem vantagem: pode derrubar primeiro)
    const comeca = opcoes.comeca || (rng() < 0.5 ? "eu" : "ia");
    const s = {
      rng,
      primeiro: comeca,
      round: 1,
      rounds: opcoes.rounds || CONFIG.rounds,
      // fácil: a IA joga uma carta por vez, muitas vezes qualquer uma, e tem menos chance; normal e difícil: um pouco mais (BONUS_IA)
      dificuldade: opcoes.dificuldade || "normal",
      vez: comeca,
      pos: "empe",
      cima: null,
      joelhoUsado: false,
      lut: { eu: novoLutador(rng), ia: novoLutador(rng) },
      log: [],
      fim: null,
    };
    for (const l of [s.lut.eu, s.lut.ia]) {
      comprar(l, CONFIG.mao, rng);
      // a mão inicial sempre tem pelo menos uma carta para jogar em pé
      if (!l.mao.some((id) => CARTAS[id].de.includes?.("empe"))) {
        const k = l.baralho.findIndex((id) => CARTAS[id].de.includes?.("empe"));
        [l.mao[0], l.baralho[k]] = [l.baralho[k], l.mao[0]];
      }
    }
    s.lut[comeca].folego = CONFIG.folego;
    return s;
  }

  const papel = (s, quem) => (s.pos === "empe" ? "empe" : `${s.pos}-${s.cima === quem ? "cima" : "baixo"}`);

  function irPara(s, quem, alvo) {
    const antes = s.pos + s.cima;
    if (alvo === "empe") { s.pos = "empe"; s.cima = null; } else {
      const [pos, lado] = alvo.split("-");
      s.pos = pos;
      s.cima = lado === "cima" ? quem : outro(quem);
    }
    if (s.pos + s.cima !== antes) s.joelhoUsado = false;
  }

  // segundos que faltam na luta
  // cada vez vale 15 segundos: 10 rounds são 5 minutos de luta
  const tempo = (s) => Math.max(0, s.rounds * 30 - ((s.round - 1) * 2 + (s.vez === s.primeiro ? 0 : 1)) * 15);

  function chanceDe(s, quem, carta) {
    const eu = s.lut[quem], ele = s.lut[outro(quem)];
    if (carta.chance >= 100) return 100;
    let c = carta.chance + eu.pegada * 8 - ele.pegada * 8 - (ele.postura ? 20 : 0) + (quem === "ia" ? BONUS_IA[s.dificuldade] || 0 : 0);
    return Math.max(5, Math.min(95, c));
  }

  // diz se a carta pode ser jogada agora e, se não, o motivo
  function avaliar(s, quem, id) {
    const c = CARTAS[id];
    const l = s.lut[quem];
    const p = papel(s, quem);
    const r = { id, carta: c, ok: false, motivo: "", chance: chanceDe(s, quem, c) };
    if (s.fim) r.motivo = "A luta acabou";
    else if (s.vez !== quem) r.motivo = "Não é a sua vez";
    else if (c.de !== "todas" && !c.de.includes(p)) r.motivo = "Posição errada";
    else if (c.umaVez && s.joelhoUsado) r.motivo = "Já usou neste 100 kg";
    else if (l.folego < c.custo) r.motivo = `Precisa de ${c.custo} de fôlego`;
    else if (c.precisa && l.pegada < c.precisa) r.motivo = `Precisa de ${c.precisa} pegada`;
    else r.ok = true;
    return r;
  }

  function registrar(s, ev) {
    ev.round = s.round;
    ev.tempo = tempo(s);
    s.log.push(ev);
    return ev;
  }

  // joga a carta da posição "i" da mão. Devolve o que aconteceu.
  function jogar(s, quem, i) {
    const l = s.lut[quem], ele = s.lut[outro(quem)];
    const id = l.mao[i];
    const a = avaliar(s, quem, id);
    if (!a.ok) return { erro: a.motivo };
    const c = a.carta;
    const de = papel(s, quem);
    l.folego -= c.custo;
    l.cartasNaVez = (l.cartasNaVez || 0) + 1;
    l.mao.splice(i, 1);
    l.descarte.push(id);
    if (c.pontos || c.finaliza) l.tentativas++;
    const tiro = s.rng() * 100;
    const ok = tiro < a.chance;
    const ev = { tipo: "carta", quem, id, nome: c.nome, chance: a.chance, ok, pontos: 0, vantagem: false };
    if (c.precisa) l.pegada -= c.precisa;
    if (ok) {
      if (c.tiraPegada) ele.pegada = Math.max(0, ele.pegada - c.tiraPegada);
      if (c.ganhaPegada) l.pegada = Math.min(CONFIG.maxPegada, l.pegada + c.ganhaPegada);
      if (c.postura) l.postura = true;
      if (c.finaliza) {
        s.fim = { vencedor: quem, como: "finalização", detalhe: c.nome };
        ev.finalizou = true;
      } else {
        if (c.para) irPara(s, quem, typeof c.para === "string" ? c.para : c.para[de]);
        if (c.umaVez) s.joelhoUsado = true;
        if (c.pontos) { l.pontos += c.pontos; ev.pontos = c.pontos; ev.ponto = c.tipo; }
      }
    } else {
      // quase deu: na IBJJF, quem chega perto de pontuar ou finalizar ganha vantagem
      if ((c.pontos || c.finaliza) && tiro < a.chance + 20) { l.vant++; ev.vantagem = true; }
      if (c.falha?.[de]) irPara(s, quem, c.falha[de]);
    }
    ev.posicao = papel(s, quem);
    return registrar(s, ev);
  }

  function pegada(s, quem) {
    const l = s.lut[quem];
    if (s.fim || s.vez !== quem) return { erro: "Não é a sua vez" };
    if (l.folego < CONFIG.custoPegada) return { erro: "Sem fôlego" };
    if (l.pegada >= CONFIG.maxPegada) return { erro: "Já tem o máximo de pegadas" };
    l.folego -= CONFIG.custoPegada;
    l.pegada++;
    return registrar(s, { tipo: "pegada", quem, pegada: l.pegada });
  }

  function trocar(s, quem) {
    const l = s.lut[quem];
    if (s.fim || s.vez !== quem) return { erro: "Não é a sua vez" };
    if (l.folego < CONFIG.custoTrocar) return { erro: "Sem fôlego" };
    if (l.trocou) return { erro: "Só uma troca por vez" };
    l.folego -= CONFIG.custoTrocar;
    l.trocou = true;
    const n = l.mao.length;
    l.descarte.push(...l.mao);
    l.mao = [];
    comprar(l, n, s.rng);
    return registrar(s, { tipo: "trocar", quem });
  }

  // decide quem ganhou quando o tempo acaba: pontos, depois vantagens, depois quem atacou mais
  function decidir(s) {
    const e = s.lut.eu, i = s.lut.ia;
    if (e.pontos !== i.pontos) return { vencedor: e.pontos > i.pontos ? "eu" : "ia", como: "pontos" };
    if (e.vant !== i.vant) return { vencedor: e.vant > i.vant ? "eu" : "ia", como: "vantagens" };
    if (e.tentativas !== i.tentativas) return { vencedor: e.tentativas > i.tentativas ? "eu" : "ia", como: "decisão" };
    return { vencedor: null, como: "empate" };
  }

  // passa a vez: quem acabou de jogar compra cartas, o outro recupera o fôlego
  function encerrarVez(s) {
    if (s.fim) return s.fim;
    const quem = s.vez;
    const l = s.lut[quem];
    l.trocou = false;
    l.cartasNaVez = 0;
    comprar(l, CONFIG.mao - l.mao.length, s.rng);
    // o round acaba quando joga quem começou depois
    if (quem !== s.primeiro) {
      if (s.round >= s.rounds) {
        s.fim = decidir(s);
        registrar(s, { tipo: "fim", ...s.fim });
        return s.fim;
      }
      s.round++;
    }
    s.vez = outro(quem);
    const prox = s.lut[s.vez];
    prox.folego = CONFIG.folego;
    prox.postura = false;
    registrar(s, { tipo: "vez", quem: s.vez });
    return null;
  }

  // ---------- IA ----------
  // nota de cada jogada possível: chance de dar certo × (pontos + o quanto a posição melhora)
  function notaJogada(s, quem, a) {
    const c = a.carta;
    const de = papel(s, quem);
    const p = a.chance / 100;
    const ele = s.lut[outro(quem)];
    if (c.finaliza) {
      // vale mais quando está perdendo ou o tempo acaba
      const urg = s.round >= s.rounds - 1 || s.lut[quem].pontos < ele.pontos ? 6 : 0;
      return p * (24 + urg) - (c.falha?.[de] ? (1 - p) * 6 : 0);
    }
    if (c.postura) return papel(s, quem).endsWith("baixo") || s.pos === "empe" ? 1.2 : 0.6;
    if (c.tiraPegada && !c.para) return ele.pegada >= 2 ? 2.2 : ele.pegada ? 1 : 0.2;
    let ganho = 0;
    if (c.para) {
      const alvo = typeof c.para === "string" ? c.para : c.para[de];
      ganho = PAPEIS[alvo].valor - PAPEIS[de].valor;
    }
    return p * ((c.pontos || 0) * 1.5 + ganho + 0.8) - c.custo * 0.15;
  }

  // a próxima ação da IA: { acao: "carta", i } / { acao: "pegada" } / { acao: "trocar" } / { acao: "passar" }
  function iaEscolher(s, quem = "ia") {
    const l = s.lut[quem];
    let melhor = null;
    l.mao.forEach((id, i) => {
      const a = avaliar(s, quem, id);
      if (!a.ok) return;
      const n = notaJogada(s, quem, a);
      if (!melhor || n > melhor.n) melhor = { acao: "carta", i, n, id };
    });
    // no fácil a IA joga uma carta só por vez, e muitas vezes uma qualquer
    if (quem === "ia" && s.dificuldade === "facil" && l.cartasNaVez >= 1) return { acao: "passar" };
    if (melhor && quem === "ia" && s.dificuldade === "facil" && s.rng() < 0.5) {
      const ok = l.mao.map((id, i) => ({ id, i })).filter(({ id }) => avaliar(s, quem, id).ok);
      const x = ok[Math.floor(s.rng() * ok.length)];
      return { acao: "carta", i: x.i, id: x.id, n: 0 };
    }
    // pega na gola antes se uma carta boa daqui só falta a pegada
    if (l.pegada < CONFIG.maxPegada && l.folego >= CONFIG.custoPegada) {
      const precisa = l.mao.some((id) => {
        const c = CARTAS[id];
        return c.precisa && c.de !== "todas" && c.de.includes(papel(s, quem)) && l.pegada < c.precisa && l.folego >= c.custo + CONFIG.custoPegada;
      });
      if (precisa) return { acao: "pegada" };
    }
    // no normal e no difícil, pega na gola antes de um golpe que vale ponto, se sobrar fôlego (mais 8% de chance)
    if (melhor && s.dificuldade !== "facil" && quem === "ia") {
      const c = CARTAS[melhor.id];
      if ((c.pontos || c.finaliza) && l.pegada < CONFIG.maxPegada && l.folego >= c.custo + CONFIG.custoPegada && chanceDe(s, quem, c) < 95) return { acao: "pegada" };
    }
    if (melhor && melhor.n > 0.3) return melhor;
    if (!melhor && !l.trocou && l.folego >= CONFIG.custoTrocar + 1) return { acao: "trocar" };
    if (l.pegada < CONFIG.maxPegada && l.folego >= CONFIG.custoPegada) return { acao: "pegada" };
    return { acao: "passar" };
  }

  function iaPasso(s, quem = "ia") {
    const e = iaEscolher(s, quem);
    if (e.acao === "carta") return jogar(s, quem, e.i);
    if (e.acao === "pegada") return pegada(s, quem);
    if (e.acao === "trocar") return trocar(s, quem);
    return null; // passa a vez
  }

  const api = {
    POSICOES, PAPEIS, CARTAS, BARALHO, CONFIG,
    rngSemente, novaLuta, papel, tempo, avaliar, jogar, pegada, trocar, encerrarVez, decidir, iaEscolher, iaPasso, outro,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CartasEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
