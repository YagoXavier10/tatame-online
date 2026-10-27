// Caminho da finalização: escolha o próximo passo certo, posição por posição, até finalizar
(() => {
  const box = document.getElementById("cm");
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

  // Fotos livres do Wikimedia Commons: [arquivo, autor, licença]
  const ARMY = "Exército dos EUA";
  const PHOTOS = {
    guarda: ["Brazilian Jiu-jitsu-Closed guard.jpg", "MartialArtsNomad.com", "CC BY 2.0"],
    armlock: ["Juji-gatame.jpg", "Michael Hultström", "CC BY-SA 3.0"],
    armlockGuarda: ["MCMAP grappling armbar.jpg", "Stephen M. Votaw", "domínio público"],
    montada: ["Tate-shiho-gatame.jpg", "Michael Hultström", "CC BY-SA 2.0"],
    montadaFoto: ["Tate shiho gatame.jpg", "Lapate (Flickr)", "CC BY 2.0"],
    costas: ["Back mount.jpg", "Wikimedia Commons", "domínio público"],
    mataleao: ["Rear naked choke.jpg", ARMY, "domínio público"],
    cemquilos: ["Mune-gatame.jpg", "Michael Hultström", "CC BY-SA 2.0"],
    joelho: ["Image943-knee mount.jpg", ARMY, "domínio público"],
    aberta: ["BJJ spider guard 01.jpg", "soh32", "CC BY-SA 3.0"],
    triangulo: ["Image939-triangle choke.jpg", ARMY, "domínio público"],
    trianguloFoto: ["Triangle choke.jpeg", "Zoran Jerkovic", "CC BY-SA 4.0"],
    queda: ["Single-Leg Takedown (8111417907).jpg", "Chris Hunkeler", "CC BY-SA 2.0"],
    americana: ["Army Combatives Keylock (111007-A-HU462-383).jpg", "Sean Harp", "domínio público"],
    lado: ["Side-control to full-mount transition 110701-A-FJ360-054 (retouched).jpg", ARMY, "domínio público"],
  };
  const src = (file, w = 640) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w}`;
  const page = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

  const BELT = { branca: ["Faixa branca", "#f2f2f2", "#111"], azul: ["Faixa azul", "#1f4fbf", "#fff"], roxa: ["Faixa roxa", "#6a2fb3", "#fff"] };

  /* Cada desafio tem passos. Cada passo:
     at: posição atual · img: foto · text: situação
     ok: [escolha certa, explicação, resumo para o caminho] · gain: pontos que você marca ao acertar
     bad: [[escolha errada, o que acontece, pontos que ele marca?], ...] */
  const CHALLENGES = [
    {
      id: "armlock-guarda", belt: "branca", title: "Armlock da guarda", start: "Guarda fechada", img: "guarda",
      goal: "Finalize com o armlock saindo da guarda fechada.",
      end: ["finalizacao", "Armlock da guarda", "A finalização mais clássica da guarda fechada: postura quebrada, quadril girado e alavanca no cotovelo."],
      steps: [
        { at: "Guarda fechada", img: "guarda",
          text: "Você está por baixo, com a guarda fechada. Ele está de joelhos, com a postura reta e as duas mãos no seu peito. Qual é o primeiro passo?",
          ok: ["Puxar com as pernas e com a gola para quebrar a postura dele", "Com a postura quebrada, ele perde força para se defender e não consegue passar a guarda.", "Quebrou a postura"],
          bad: [
            ["Abrir a guarda e empurrar o quadril dele com os pés para criar distância", "Abrindo a guarda sem motivo, você dá espaço para ele começar a passar."],
            ["Passar o braço em volta do pescoço dele, por baixo, e tentar um mata-leão", "O mata-leão é feito pelas costas. De frente, por baixo, ele não encaixa."],
          ] },
        { at: "Guarda fechada", img: "guarda",
          text: "Ele perdeu a postura e, para se levantar, apoia uma mão no meio do seu peito.",
          ok: ["Prender esse braço junto ao seu peito e girar o quadril para o lado dele", "Girar o quadril deixa você em ângulo para atacar o braço que ficou apoiado.", "Prendeu o braço e girou o quadril"],
          bad: [
            ["Abrir as pernas e esticar o braço para segurar o tornozelo dele e puxar para o lado", "Sem a guarda, ele levanta a postura e você perde a chance de atacar o braço."],
            ["Empurrar o rosto dele com as duas mãos para afastar a cabeça", "Empurrar só cansa você e deixa os braços dele livres."],
          ] },
        { at: "Ângulo na guarda", img: "armlockGuarda",
          text: "Seu quadril está girado e o braço dele está preso. Como finalizar?",
          ok: ["Passar a perna pela cabeça dele e subir o quadril, com o polegar dele para cima", "Bateu! Com o polegar para cima, o cotovelo fica travado e o quadril faz a alavanca.", "Armlock"],
          bad: [
            ["Segurar o punho dele com as duas mãos e puxar o braço para trás, sem mexer as pernas", "Sem as pernas controlando a cabeça e o tronco, ele puxa o braço e levanta a postura."],
            ["Soltar o braço, voltar o quadril para o centro e fechar a guarda de novo", "Você estava a um passo da finalização e deixou ele escapar."],
          ] },
      ],
    },
    {
      id: "tesoura-montada", belt: "branca", title: "Da tesoura à montada", start: "Guarda fechada", img: "montada",
      goal: "Raspe, estabilize a montada e finalize.",
      end: ["finalizacao", "Armlock da montada", "Raspagem (2) + montada (4) e finalização. Lição para ele: na montada, nunca empurre com o braço esticado."],
      steps: [
        { at: "Guarda fechada", img: "guarda",
          text: "Você quer fazer a raspagem de tesoura. Ele está de joelhos, com a postura alta. Como você se prepara?",
          ok: ["Segurar gola e manga do mesmo lado e atravessar a canela na barriga dele", "Gola e manga presas e a canela atravessada: a tesoura está armada.", "Armou a tesoura"],
          bad: [
            ["Soltar as pegadas, deitar reto e colocar os dois pés no quadril dele para empurrar", "Sem pegadas não existe raspagem. Ele começa a passar a sua guarda."],
            ["Sentar e abraçar as duas pernas dele na altura dos joelhos", "Por baixo, abraçar as pernas dele não desequilibra ninguém."],
          ] },
        { at: "Tesoura armada", img: "guarda",
          text: "Canela na barriga dele e a outra perna no chão, ao lado do joelho dele. E agora?",
          ok: ["Puxar gola e manga enquanto a perna de baixo varre o joelho dele e a de cima empurra", "Raspou! As pernas fazem a tesoura e as mãos puxam: ele cai para o lado da manga presa.", "Raspagem de tesoura"],
          gain: [2, "Raspagem"],
          bad: [
            ["Esticar as duas pernas de uma vez para empurrar ele para trás", "Empurrar para trás só cria distância. Ele volta e você perde as pegadas."],
            ["Soltar a manga, apoiar a mão no chão e levantar o quadril para empurrar ele com as pernas", "Com o braço solto, ele apoia a mão no tatame e não cai."],
          ] },
        { at: "Montada", img: "montada",
          text: "Você caiu montado nele. Ele empurra seus joelhos e mexe o quadril para te derrubar.",
          ok: ["Abrir os joelhos, baixar o quadril e colar o peso nele, segurando a posição", "Estabilizou! Mantida por 3 segundos, a montada vale 4 pontos.", "Estabilizou a montada"],
          gain: [4, "Montada"],
          bad: [
            ["Ficar sentado alto, com o tronco reto e os joelhos fechados", "Alto e sem base, você é derrubado pela ponte (upa)."],
            ["Sair da montada e girar para as costas dele antes que ele consiga se mexer", "Ele não virou de costas. Sair da montada à toa joga fora 4 pontos."],
          ] },
        { at: "Montada", img: "montadaFoto",
          text: "Desesperado, ele empurra o seu peito com um braço esticado.",
          ok: ["Prender o braço esticado, girar o corpo e passar a perna pela cabeça dele no armlock", "Bateu! Braço esticado na montada é convite para o armlock.", "Armlock da montada"],
          bad: [
            ["Descer para o cem quilos para descansar e garantir a vantagem", "Você trocaria uma posição de 4 pontos por uma pior, e o braço esticado era a deixa para finalizar."],
            ["Afastar o braço dele do peito com a mão e continuar segurando a montada até o fim da luta", "Você desperdiçou a chance: braço esticado na montada é armlock."],
          ] },
      ],
    },
    {
      id: "queda-americana", belt: "azul", title: "Da queda à americana", start: "Em pé", img: "americana",
      goal: "Derrube, passe a guarda e finalize por cima.",
      end: ["finalizacao", "Americana", "Queda (2) + passagem (3) e a americana do cem quilos, uma das finalizações mais seguras por cima."],
      steps: [
        { at: "Em pé", img: "queda",
          text: "A luta começa em pé. Ele está com a postura alta e as pernas abertas.",
          ok: ["Abaixar o nível, entrar entre os pés dele e abraçar as duas pernas (baiana)", "Derrubou! Ele cai de costas e a queda vale 2 pontos.", "Queda (baiana)"],
          gain: [2, "Queda"],
          bad: [
            ["Segurar a nuca dele com as duas mãos e puxar a cabeça para baixo até ele cair", "Sem controlar o quadril ou as pernas, ele se solta fácil."],
            ["Dar um passo para trás, baixar as mãos e esperar ele atacar primeiro para contra-atacar", "Esperar entrega a iniciativa para ele, e a falta de combatividade pode ser punida."],
          ] },
        { at: "Entre as pernas", img: "lado",
          text: "Ele caiu, mas você ficou entre as pernas dele. Antes que ele feche a guarda:",
          ok: ["Contornar as pernas dele e estabilizar no cem quilos", "Passou! Chegou ao lado e segurou: passagem de guarda vale 3 pontos.", "Passou a guarda"],
          gain: [3, "Passagem"],
          bad: [
            ["Ficar de joelhos entre as pernas dele e deixar ele fechar a guarda", "Com a guarda fechada, ele volta para o jogo e você perde a chance de passar."],
            ["Ficar de pé e se afastar para esperar ele levantar", "Ele levanta também e a luta recomeça do zero."],
          ] },
        { at: "Cem quilos", img: "americana",
          text: "No cem quilos, ele deixou o braço de cima dobrado, com a mão perto da cabeça.",
          ok: ["Prender o punho dele no tatame, passar o braço por baixo e segurar o próprio punho", "Bateu! É a americana: com o braço dobrado e o cotovelo subindo, o ombro trava.", "Americana"],
          bad: [
            ["Segurar o punho dele com as duas mãos e puxar o braço para esticá-lo em direção às pernas", "Puxando sem trava, ele só recolhe o braço."],
            ["Soltar o controle do tronco e passar o braço por baixo para pegar a perna de cima dele", "Ao soltar, ele recupera a guarda."],
          ] },
      ],
    },
    {
      id: "placar", belt: "azul", title: "Vitória por pontos", start: "Guarda aberta", img: "joelho",
      goal: "Passe a guarda e vá somando pontos até a montada.",
      end: ["pontos", "Vitória por pontos", "Passagem (3) + joelho na barriga (2) + montada (4) = 9 pontos. Cada posição conquistada e estabilizada soma no placar."],
      steps: [
        { at: "Guarda aberta", img: "aberta",
          text: "Você está de pé e ele está na guarda aberta, com os pés no seu quadril.",
          ok: ["Segurar as calças nos joelhos, jogar as pernas para um lado e correr para o outro", "É o toreando: controlando as pernas, você contorna a guarda.", "Toreando"],
          bad: [
            ["Ajoelhar entre as pernas dele sem pegadas e tentar abrir a guarda com as mãos", "Ele aproveita e te raspa: 2 pontos para ele.", [2, "Raspagem"]],
            ["Pular por cima das pernas dele de uma vez, sem segurar nada, e cair direto no cem quilos", "Sem controlar as pernas, ele gira e te pega no meio do pulo."],
          ] },
        { at: "Ao lado", img: "cemquilos",
          text: "As pernas dele ficaram para o lado e você chegou ao lado do tronco dele.",
          ok: ["Colar o peito, controlar a cabeça e o quadril e segurar a posição por 3 segundos", "Estabilizou no cem quilos: passagem de guarda, 3 pontos.", "Estabilizou no cem quilos"],
          gain: [3, "Passagem"],
          bad: [
            ["Levantar o tronco e comemorar a passagem antes dos 3 segundos", "Sem estabilizar, não pontua, e ele repõe a guarda."],
            ["Ficar de quatro ao lado dele, sem encostar o peito, para ter mais mobilidade e velocidade", "Com espaço, ele coloca o joelho entre vocês e recupera a guarda."],
          ] },
        { at: "Cem quilos", img: "joelho",
          text: "No cem quilos, ele empurra o seu quadril para criar espaço.",
          ok: ["Usar o espaço e subir o joelho na barriga dele, com a outra perna aberta", "Joelho na barriga: mais pressão e mais 2 pontos.", "Joelho na barriga"],
          gain: [2, "Joelho na barriga"],
          bad: [
            ["Empurrar de volta com toda a força para fechar o espaço que ele abriu no seu quadril", "Força contra força só cansa você. Use o espaço que ele deu."],
            ["Recuar e voltar para dentro da guarda dele para recomeçar a passagem pelo outro lado", "Você jogaria fora os 3 pontos da passagem."],
          ] },
        { at: "Joelho na barriga", img: "montada",
          text: "No joelho na barriga, ele empurra o seu joelho com as duas mãos.",
          ok: ["Deslizar o joelho por cima da barriga dele e cair montado", "Montou! Estabilizou por 3 segundos: mais 4 pontos.", "Montada"],
          gain: [4, "Montada"],
          bad: [
            ["Tirar o joelho da barriga e sentar ao lado dele para segurar o lado", "Ao sentar, você perde a pressão e ele foge."],
            ["Ficar parado no joelho na barriga esperando o tempo acabar", "Ficar parado pode gerar punição por falta de combatividade."],
          ] },
      ],
    },
    {
      id: "costas-mataleao", belt: "azul", title: "Pegando as costas", start: "Tartaruga", img: "costas",
      goal: "Pegue as costas e finalize no mata-leão.",
      end: ["finalizacao", "Mata-leão", "O caminho mais clássico: cinto de segurança, dois ganchos e o mata-leão."],
      steps: [
        { at: "Tartaruga", img: null,
          text: "Ele está de quatro apoios (tartaruga) na sua frente, se protegendo. Você está ao lado dele.",
          ok: ["Colar o peito nas costas dele e prender o tronco: um braço por cima e outro por baixo", "O cinto de segurança prende o tronco dele e prepara a pegada nas costas.", "Cinto de segurança"],
          bad: [
            ["Ficar de pé ao lado dele, com as mãos nos joelhos, e esperar ele levantar para recomeçar", "Parado, você dá tempo para ele se recompor."],
            ["Soltar a pegada, sentar e puxar ele para dentro da sua guarda fechada", "Você estava na melhor posição e trocou por ficar por baixo."],
          ] },
        { at: "Cinto de segurança", img: "costas",
          text: "O cinto de segurança está firme. Como pegar as costas de verdade?",
          ok: ["Rolar junto para o lado e encaixar os dois ganchos por dentro das coxas dele", "Costas pegas! Com os dois ganchos por dentro, valem 4 pontos.", "Dois ganchos"],
          gain: [4, "Costas"],
          bad: [
            ["Rolar junto para o lado e cruzar os seus pés na frente da barriga dele, bem apertado", "Pés cruzados não são ganchos e ainda deixam seu tornozelo exposto a uma chave de pé."],
            ["Encaixar só um gancho e segurar a faixa dele com as duas mãos", "Com um gancho só, ele gira e escapa, e os 4 pontos não valem."],
          ] },
        { at: "Pegada nas costas", img: "mataleao",
          text: "Ganchos dentro e peito colado. Ele tenta defender, mas deixou um espaço no pescoço.",
          ok: ["Passar o braço no pescoço, segurar o próprio bíceps e pôr a outra mão atrás da cabeça", "Bateu! É o mata-leão, o estrangulamento mais famoso do jiu-jitsu.", "Mata-leão"],
          bad: [
            ["Cruzar as pernas e apertar a cintura dele com força até ele desistir", "Apertar a cintura cansa, mas quase nunca finaliza. O pescoço estava aberto."],
            ["Soltar os ganchos por um instante para ajustar melhor a pegada dos braços no pescoço", "Sem ganchos, ele gira de frente e você perde as costas."],
          ] },
      ],
    },
    {
      id: "fuga-montada", belt: "roxa", title: "Fuga da montada", start: "Montado por baixo", img: "montadaFoto",
      goal: "Ele montou em você. Sobreviva e escape!",
      score: [0, 4],
      end: ["fuga", "Escapou!", "Fugir da montada não vale pontos, mas troca a pior posição pela melhor: agora é você quem vai passar a guarda."],
      steps: [
        { at: "Montado por baixo", img: "montadaFoto",
          text: "Ele montou em você (4 pontos para ele) e procura o seu pescoço e os seus braços.",
          ok: ["Fechar os cotovelos junto ao corpo e proteger o pescoço com as mãos", "Defesa primeiro: cotovelos fechados e pescoço protegido não dão nada para ele.", "Protegeu pescoço e cotovelos"],
          bad: [
            ["Esticar os braços e empurrar o peito dele para tirar o peso de cima", "Braço esticado embaixo da montada é tudo o que ele quer: armlock!"],
            ["Virar de bruços rapidamente para tentar levantar e fugir", "De bruços você entrega as costas: mais 4 pontos para ele.", [4, "Costas"]],
          ] },
        { at: "Montado por baixo", img: "montada",
          text: "Ele apoia uma mão no chão, ao lado da sua cabeça, para se equilibrar.",
          ok: ["Prender o braço apoiado e o pé do mesmo lado e fazer a ponte (upa) para esse lado", "Ele não tem como apoiar o lado preso e rola por cima de você.", "Upa"],
          bad: [
            ["Fazer a ponte bem alta para o lado contrário, onde ele não está apoiado e parece mais leve", "Do lado livre, ele simplesmente apoia a outra mão e continua montado."],
            ["Segurar a faixa dele com as duas mãos e esperar ele cansar", "Esperar por baixo só dá tempo para ele atacar."],
          ] },
        { at: "Dentro da guarda dele", img: "guarda",
          text: "A ponte funcionou: ele rolou e agora você está por cima, dentro da guarda dele.",
          ok: ["Manter a postura: coluna reta e mãos no quadril dele", "Com postura, você fica seguro na guarda dele e pronto para começar a passar.", "Postura na guarda"],
          bad: [
            ["Apoiar as duas mãos no chão, perto da cabeça dele, para ter base", "Mãos no chão perto dele deixam seu braço pronto para kimura ou triângulo."],
            ["Deitar o peito em cima dele para descansar e recuperar o fôlego", "Sem postura, você fica preso na guarda dele e vira alvo de ataques."],
          ] },
      ],
    },
    {
      id: "triangulo", belt: "roxa", title: "O triângulo perfeito", start: "Guarda fechada", img: "trianguloFoto",
      goal: "Monte o triângulo da guarda, detalhe por detalhe.",
      end: ["finalizacao", "Triângulo", "Um braço dentro, outro fora, a perna trancada atrás do joelho e o ângulo certo: o triângulo perfeito."],
      steps: [
        { at: "Guarda fechada", img: "guarda",
          text: "Você está na guarda fechada e controla os punhos dele. Qual é o momento certo para atacar o triângulo?",
          ok: ["Com um braço dele dentro das suas pernas e o outro fora, subir o quadril e passar a perna", "Um braço dentro e outro fora é a condição do triângulo: o braço preso ajuda a apertar o pescoço.", "Um braço dentro, outro fora"],
          bad: [
            ["Com os dois braços dele de fora das suas pernas, subir o quadril e fechar as pernas no pescoço", "Sem nenhum braço preso, as pernas só apertam a cabeça: não estrangula."],
            ["Com os dois braços dele dentro, fechar as pernas no pescoço", "Com os dois braços dentro, ele protege o pescoço e não há triângulo."],
          ] },
        { at: "Triângulo aberto", img: "triangulo",
          text: "Sua perna passou por cima do pescoço dele e um braço ficou preso. Como trancar?",
          ok: ["Puxar a cabeça dele para baixo e travar o pé na dobra do joelho da outra perna", "Trancou! A perna atrás do joelho forma o “triângulo” que dá nome à finalização.", "Trancou o triângulo"],
          bad: [
            ["Puxar a cabeça dele para baixo e cruzar os tornozelos atrás do pescoço dele, bem apertado", "Tornozelos cruzados não fecham o triângulo: ele levanta a postura e sai."],
            ["Soltar a cabeça dele e segurar a faixa para puxar o corpo", "Sem puxar a cabeça, ele levanta a postura e escapa."],
          ] },
        { at: "Triângulo trancado", img: "trianguloFoto",
          text: "O triângulo está trancado, mas ele ainda resiste.",
          ok: ["Ajustar o ângulo, ficando de lado em relação a ele, e apertar os joelhos puxando a cabeça", "Bateu! Com ângulo e joelhos apertados, o estrangulamento fecha.", "Ângulo e aperto"],
          bad: [
            ["Soltar a trava das pernas por um instante para ajustar a posição e trancar de novo mais firme", "Ao destrancar, ele tira o braço e sai do triângulo."],
            ["Ficar de frente para ele e puxar a cabeça com as duas mãos", "De frente e sem apertar, o triângulo fica frouxo."],
          ] },
      ],
    },
  ];
  const LIVES = 3;

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
    points: () => beep([523, 784, 1046], 0.08),
    wrong: () => beep([220, 160], 0.14, "square", 0.05),
    win: () => beep([523, 659, 784, 1046, 1318], 0.11),
    lose: () => beep([392, 330, 262, 196], 0.16, "triangle", 0.06),
  };

  // ---------- telas ----------
  const progress = () => store.get("cm-estrelas", {});
  const starsText = (n) => "★".repeat(n) + "☆".repeat(3 - n);

  function photoBox(key, small) {
    const fig = el("figure", small ? "cm-photo small" : "cm-photo");
    if (!key) {
      fig.classList.add("empty");
      fig.append(el("span", "", "🥋"));
      return fig;
    }
    const [file, author, license] = PHOTOS[key];
    const img = el("img");
    img.src = src(file, small ? 320 : 640);
    img.alt = "";
    img.addEventListener("load", () => fig.classList.add("ready"));
    fig.append(img);
    if (!small) {
      const cap = el("a", "cm-credit", `Foto: ${author} · ${license}`);
      cap.href = page(file);
      cap.target = "_blank";
      cap.rel = "noopener";
      fig.append(cap);
    }
    return fig;
  }

  function beltTag(belt) {
    const [name, bg, fg] = BELT[belt];
    const t = el("span", "cm-belt", name);
    t.style.background = bg;
    t.style.color = fg;
    return t;
  }

  function menu() {
    document.body.classList.remove("pg-playing");
    box.replaceChildren();
    const got = progress();
    const total = Object.values(got).reduce((a, b) => a + b, 0);
    const head = el("div", "cm-menu-head");
    const title = el("div");
    title.append(el("p", "pg-kicker", `${CHALLENGES.length} desafios · ${CHALLENGES.reduce((n, c) => n + c.steps.length, 0)} decisões`),
      el("h2", "", "Escolha um desafio"));
    head.append(title, el("span", "cm-total", `⭐ ${total}/${CHALLENGES.length * 3}`));
    box.append(head, el("p", "muted", "Em cada passo, escolha o que você faria na luta. Errou? Perde um fôlego e tenta de novo. Sem errar nada, você ganha 3 estrelas."));
    const grid = el("div", "cm-grid");
    CHALLENGES.forEach((c, i) => {
      const b = el("button", "cm-card");
      b.type = "button";
      const info = el("div", "cm-card-info");
      const stars = got[c.id] || 0;
      info.append(beltTag(c.belt), el("strong", "", c.title), el("span", "muted", c.goal),
        el("span", stars ? "cm-stars got" : "cm-stars", stars ? starsText(stars) : `${c.steps.length} passos · começa: ${c.start}`));
      b.append(photoBox(c.img, true), info);
      b.addEventListener("click", () => play(i));
      grid.append(b);
    });
    box.append(grid);
  }

  let g = null;
  function play(index) {
    const c = CHALLENGES[index];
    document.body.classList.add("pg-playing");
    g = { c, index, step: 0, lives: LIVES, errors: 0, me: (c.score || [0, 0])[0], opp: (c.score || [0, 0])[1], path: [] };
    box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    showStep();
  }

  function scoreboard() {
    const sb = el("div", "cm-score");
    const me = el("div", "cm-side me");
    me.append(el("span", "", "Você"), el("strong", "", String(g.me)));
    const opp = el("div", "cm-side opp");
    opp.append(el("span", "", "Ele"), el("strong", "", String(g.opp)));
    sb.append(me, el("span", "cm-x", "×"), opp);
    return sb;
  }

  function hudBar() {
    const hud = el("div", "cm-hud");
    const back = el("button", "cm-back", "← Desafios");
    back.type = "button";
    back.addEventListener("click", menu);
    const lives = el("span", "cm-lives", "💨".repeat(g.lives) + "·".repeat(LIVES - g.lives));
    lives.title = "Fôlego";
    lives.setAttribute("aria-label", `Fôlego: ${g.lives} de ${LIVES}`);
    const mute = el("button", "pg-mute", muted ? "🔇" : "🔊");
    mute.type = "button";
    mute.setAttribute("aria-label", "Ligar ou desligar o som");
    mute.addEventListener("click", () => { muted = !muted; store.set("pg-mudo", muted); mute.textContent = muted ? "🔇" : "🔊"; });
    hud.append(back, lives, mute);
    return hud;
  }

  function trail() {
    const t = el("ol", "cm-trail");
    g.c.steps.forEach((s, i) => {
      const li = el("li", i < g.step ? "done" : i === g.step ? "now" : "", s.at);
      t.append(li);
    });
    const end = el("li", "goal", g.c.end[0] === "fuga" ? "Fuga" : g.c.end[0] === "pontos" ? "Vitória" : "Finalização");
    t.append(end);
    return t;
  }

  function showStep() {
    const step = g.c.steps[g.step];
    box.replaceChildren();
    const top = el("div", "cm-top");
    const title = el("div");
    title.append(beltTag(g.c.belt), el("h2", "", g.c.title));
    top.append(title, scoreboard());
    box.append(hudBar(), top, trail());
    const scene = el("div", "cm-scene");
    scene.append(photoBox(step.img));
    const right = el("div", "cm-ask");
    right.append(el("p", "cm-at", `📍 ${step.at}`), el("p", "cm-text", step.text));
    const opts = el("div", "cm-options");
    const choices = shuffle([[step.ok[0], true], ...step.bad.map((b) => [b[0], false, b])]);
    choices.forEach(([text, ok, bad], i) => {
      const b = el("button", "cm-opt");
      b.type = "button";
      b.append(el("kbd", "", "ABC"[i]), el("span", "", text));
      b.addEventListener("click", () => choose(b, ok, bad, opts));
      opts.append(b);
    });
    right.append(opts);
    scene.append(right);
    box.append(scene);
    const fb = el("div", "cm-feedback");
    fb.id = "cm-feedback";
    fb.setAttribute("aria-live", "assertive");
    box.append(fb);
  }

  function bump(sel) {
    const n = box.querySelector(sel);
    if (!n || reduced) return;
    n.classList.remove("bump");
    void n.offsetWidth;
    n.classList.add("bump");
  }

  function choose(btn, ok, bad, opts) {
    const step = g.c.steps[g.step];
    const fb = box.querySelector("#cm-feedback");
    fb.replaceChildren();
    if (ok) {
      opts.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      btn.classList.add("right");
      g.path.push(step.ok[2]);
      fb.className = "cm-feedback good";
      fb.append(el("strong", "", "✅ Boa!"), el("p", "", step.ok[1]));
      if (step.gain) {
        g.me += step.gain[0];
        box.querySelector(".cm-side.me strong").textContent = g.me;
        bump(".cm-side.me");
        fb.append(el("p", "cm-gain", `+${step.gain[0]} pontos · ${step.gain[1]}`));
        sfx.points();
      } else sfx.right();
      const last = g.step === g.c.steps.length - 1;
      const next = el("button", "button cm-next", last ? "Ver resultado →" : "Próximo passo →");
      next.type = "button";
      next.addEventListener("click", () => { g.step++; last ? finish(true) : showStep(); });
      fb.append(next);
      next.focus({ preventScroll: true });
      fb.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
      return;
    }
    // errou: perde fôlego, a opção errada fica marcada e tenta de novo
    btn.disabled = true;
    btn.classList.add("wrong");
    g.errors++;
    g.lives--;
    sfx.wrong();
    try { navigator.vibrate?.(120); } catch { /* sem vibração */ }
    fb.className = "cm-feedback bad";
    fb.append(el("strong", "", "❌ Não foi bem assim"), el("p", "", bad[1]));
    if (bad[2]) {
      g.opp += bad[2][0];
      box.querySelector(".cm-side.opp strong").textContent = g.opp;
      bump(".cm-side.opp");
      fb.append(el("p", "cm-gain bad", `+${bad[2][0]} pontos para ele · ${bad[2][1]}`));
    }
    const lives = box.querySelector(".cm-lives");
    lives.textContent = "💨".repeat(g.lives) + "·".repeat(LIVES - g.lives);
    bump(".cm-lives");
    if (!reduced) { box.querySelector(".cm-scene").classList.remove("shake"); void box.offsetWidth; box.querySelector(".cm-scene").classList.add("shake"); }
    if (g.lives <= 0) {
      opts.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      const end = el("button", "button cm-next", "Ver resultado →");
      end.type = "button";
      end.addEventListener("click", () => finish(false));
      fb.append(end);
      end.focus({ preventScroll: true });
    } else {
      fb.append(el("p", "muted", "Tente outra opção."));
    }
    fb.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }

  function finish(won) {
    document.body.classList.remove("pg-playing");
    box.replaceChildren();
    box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const card = el("div", "cm-end");
    const [kind, name, lesson] = g.c.end;
    if (!won) {
      sfx.lose();
      card.append(el("p", "cm-end-icon", "😮‍💨"), el("h2", "", "Acabou o fôlego"),
        el("p", "muted", "Ele aproveitou os erros e virou a luta. Revise as dicas e tente de novo: no jiu-jitsu, quem insiste aprende."));
    } else {
      sfx.win();
      const stars = Math.max(1, 3 - g.errors);
      const got = progress();
      const record = stars > (got[g.c.id] || 0);
      if (record) { got[g.c.id] = stars; store.set("cm-estrelas", got); }
      const icon = kind === "fuga" ? "🏃" : kind === "pontos" ? "🥇" : "🏆";
      const head = kind === "fuga" ? name : kind === "pontos" ? `${name}: ${g.me} × ${g.opp}` : `Finalizou: ${name}!`;
      const starRow = el("p", "cm-end-stars");
      [0, 1, 2].forEach((i) => {
        const st = el("span", i < stars ? "on" : "", "★");
        st.style.animationDelay = `${0.15 + i * 0.18}s`;
        starRow.append(st);
      });
      card.append(el("p", "cm-end-icon", icon), el("h2", "", head), starRow,
        el("p", "muted", g.errors ? `${g.errors} ${g.errors === 1 ? "erro" : "erros"} no caminho${record ? " · novo recorde de estrelas!" : ""}` : "Caminho perfeito, sem nenhum erro!"));
      const path = el("ol", "cm-path");
      path.append(el("li", "start", g.c.start));
      g.path.forEach((p) => path.append(el("li", "", p)));
      card.append(path, el("p", "cm-lesson", lesson));
    }
    const actions = el("div", "quiz-actions");
    const nextC = CHALLENGES[g.index + 1];
    if (won && nextC) {
      const nx = el("button", "button", `Próximo: ${nextC.title} →`);
      nx.type = "button";
      nx.addEventListener("click", () => play(g.index + 1));
      actions.append(nx);
    }
    const again = el("button", won && nextC ? "share-btn" : "button", "Jogar de novo");
    again.type = "button";
    again.addEventListener("click", () => play(g.index));
    const all = el("button", "share-btn", "Todos os desafios");
    all.type = "button";
    all.addEventListener("click", menu);
    actions.append(again, all);
    if (won) {
      const share = el("button", "share-btn", "Compartilhar ↗");
      share.type = "button";
      const stars = Math.max(1, 3 - g.errors);
      share.addEventListener("click", () => window.siteShare?.({
        title: "Caminho da finalização · Cohab Team",
        text: `Completei o desafio “${g.c.title}” com ${starsText(stars)} no jogo Caminho da finalização da Cohab Team!`,
        url: location.href,
      }));
      actions.append(share);
    }
    if (won) {
      const total = Object.values(progress()).reduce((a, b) => a + b, 0);
      const rk = window.cohabRanking?.badge("caminho", total);
      if (rk) card.append(rk);
    }
    card.append(actions);
    box.append(card);
    actions.querySelector("button").focus({ preventScroll: true });
  }

  // teclado: A, B, C ou 1, 2, 3 escolhem; Enter avança
  document.addEventListener("keydown", (e) => {
    if (!g || e.target.closest?.("input, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { a: 0, b: 1, c: 2, 1: 0, 2: 1, 3: 2 };
    const i = map[e.key.toLowerCase()];
    if (i === undefined) return;
    const b = box.querySelectorAll(".cm-opt")[i];
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });

  menu();
})();
