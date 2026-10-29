// Testes do motor da Luta de cartas: node tests/cartas.test.js ou abra tests/cartas.test.html
const E = typeof require !== "undefined" ? require("../cartas-engine.js") : window.CartasEngine;
const assert = (v, msg) => { if (!v) throw new Error("falhou: " + (msg || "")); };
assert.ok = assert;
assert.strictEqual = (a, b, msg) => assert(a === b, `${msg || ""} (${a} !== ${b})`);
assert.deepStrictEqual = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg || ""} ${JSON.stringify(a)}`);
const log = (...a) => { console.log(...a); if (typeof document !== "undefined") document.body.append(a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" "), document.createElement("br")); };

// toda carta aponta para papéis que existem
for (const [id, c] of Object.entries(E.CARTAS)) {
  if (c.de !== "todas") c.de.forEach((p) => assert.ok(E.PAPEIS[p], `${id}: papel de origem ${p}`));
  const destinos = !c.para ? [] : typeof c.para === "string" ? [c.para] : Object.values(c.para);
  destinos.forEach((p) => assert.ok(p === "empe" || E.PAPEIS[p], `${id}: destino ${p}`));
  if (c.para && typeof c.para !== "string") c.de.forEach((p) => assert.ok(c.para[p], `${id}: sem destino saindo de ${p}`));
}
for (const id of Object.keys(E.BARALHO)) assert.ok(E.CARTAS[id], `baralho tem ${id}`);

// papel é visto dos dois lados
const s = E.novaLuta({ seed: 1, comeca: "eu" });
assert.strictEqual(E.papel(s, "eu"), "empe");
s.pos = "montada"; s.cima = "eu";
assert.strictEqual(E.papel(s, "eu"), "montada-cima");
assert.strictEqual(E.papel(s, "ia"), "montada-baixo");

// não dá para jogar carta da posição errada nem sem fôlego
const t = E.novaLuta({ seed: 2, comeca: "eu" });
t.lut.eu.mao = ["montar", "puxar"];
assert.strictEqual(E.avaliar(t, "eu", "montar").ok, false);
assert.strictEqual(E.avaliar(t, "eu", "puxar").ok, true);
t.lut.eu.folego = 0;
assert.strictEqual(E.avaliar(t, "eu", "puxar").ok, false);

// carta que dá certo muda a posição e marca os pontos da IBJJF
const u = E.novaLuta({ rng: () => 0 }); // sempre acerta
u.pos = "cem"; u.cima = "eu"; u.lut.eu.mao = ["montar"];
const ev = E.jogar(u, "eu", 0);
assert.ok(ev.ok);
assert.strictEqual(u.lut.eu.pontos, 4);
assert.strictEqual(E.papel(u, "eu"), "montada-cima");

// joelho na barriga só uma vez no mesmo 100 kg
const j = E.novaLuta({ rng: () => 0 });
j.pos = "cem"; j.cima = "eu"; j.lut.eu.folego = 3; j.lut.eu.mao = ["joelho", "joelho"];
E.jogar(j, "eu", 0);
assert.strictEqual(E.avaliar(j, "eu", "joelho").ok, false);

// finalização acaba a luta
const f = E.novaLuta({ rng: () => 0 });
f.pos = "costas"; f.cima = "eu"; f.lut.eu.pegada = 1; f.lut.eu.mao = ["mataleao"];
E.jogar(f, "eu", 0);
assert.deepStrictEqual([f.fim.vencedor, f.fim.como], ["eu", "finalização"]);

// erro por pouco dá vantagem
const v = E.novaLuta({ rng: () => 0.6, comeca: "eu" }); // tiro 60 contra chance 55
v.pos = "aberta"; v.cima = "eu"; v.lut.eu.mao = ["toreando"];
const ev2 = E.jogar(v, "eu", 0);
assert.ok(!ev2.ok && ev2.vantagem);
assert.strictEqual(v.lut.eu.vant, 1);

// IA contra IA: toda luta termina e não trava
const placar = { eu: 0, ia: 0, empate: 0, finalizacao: 0 };
let pontos = 0;
for (let seed = 0; seed < 500; seed++) {
  const l = E.novaLuta({ seed });
  let guarda = 0;
  while (!l.fim) {
    let passos = 0;
    while (!l.fim && E.iaPasso(l, l.vez)) assert.ok(++passos < 30, "IA em loop");
    E.encerrarVez(l);
    assert.ok(++guarda < 100, "luta não acaba");
  }
  placar[l.fim.vencedor || "empate"]++;
  if (l.fim.como === "finalização") placar.finalizacao++;
  pontos += l.lut.eu.pontos + l.lut.ia.pontos;
}
log("500 lutas IA×IA:", placar, "média de pontos por luta:", (pontos / 500).toFixed(1));
assert.ok(placar.finalizacao > 25 && placar.finalizacao < 400, "finalizações nem raras nem certas demais");
// quem começa é sorteado e o round só acaba depois da vez dos dois
let comecouIa = 0;
for (let seed = 0; seed < 200; seed++) if (E.novaLuta({ seed }).vez === "ia") comecouIa++;
assert.ok(comecouIa > 70 && comecouIa < 130, `sorteio desequilibrado: IA começou ${comecouIa} de 200`);
const ord = E.novaLuta({ rng: () => 0.9 }); // a IA começa
assert.strictEqual(ord.vez, "ia");
assert.strictEqual(E.tempo(ord), 300);
E.encerrarVez(ord);
assert.strictEqual(ord.round, 1, "round não pode acabar só com a vez de um");
assert.strictEqual(E.tempo(ord), 285);
E.encerrarVez(ord);
assert.strictEqual(ord.round, 2);

// equilíbrio: o mesmo jogador simples (sem bônus) contra cada dificuldade, cada um começando metade das vezes
for (const dificuldade of ["facil", "normal", "dificil"]) {
  let ia = 0, primeiro = 0;
  for (let seed = 0; seed < 300; seed++) {
    const l = E.novaLuta({ seed, dificuldade });
    let voltas = 0;
    while (!l.fim) {
      while (!l.fim && E.iaPasso(l, l.vez)) assert.ok(++voltas < 600, "IA em loop");
      E.encerrarVez(l);
    }
    if (l.fim.vencedor === "ia") ia++;
    if (l.fim.vencedor === l.primeiro) primeiro++;
  }
  log(`equilíbrio ${dificuldade}: IA venceu ${ia} de 300; quem começou venceu ${primeiro}`);
}

// rounds e dificuldade do painel de admin
for (const dificuldade of ["facil", "normal", "dificil"]) {
  let ia = 0;
  for (let seed = 0; seed < 200; seed++) {
    const l = E.novaLuta({ seed, rounds: 6, dificuldade });
    let voltas = 0;
    while (!l.fim) {
      while (!l.fim && E.iaPasso(l, l.vez)) assert.ok(++voltas < 400, "IA em loop");
      E.encerrarVez(l);
    }
    assert.ok(l.round <= 6, "passou dos 6 rounds");
    if (l.fim.vencedor === "ia") ia++;
  }
  log(`dificuldade ${dificuldade}: IA venceu ${ia} de 200`);
}
assert.strictEqual(E.tempo(E.novaLuta({ rounds: 6 })), 180, "6 rounds são 3 minutos");
log("ok");
