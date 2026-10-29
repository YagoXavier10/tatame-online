// Menu solo: nickname do jogador (o ranking fica em ranking.html)
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // links antigos (solo.html?ranking=torre#ranking) vão para a página do ranking
  const antigo = new URLSearchParams(location.search).get("ranking");
  if (antigo || location.hash === "#ranking") location.replace(`ranking.html${antigo ? `?jogo=${encodeURIComponent(antigo)}` : ""}`);

  function init() {
    const R = window.cohabRanking;
    const profile = document.getElementById("rk-profile");

    // ---------- perfil ----------
    function drawProfile() {
      profile.replaceChildren();
      const nick = R.nick();
      if (!nick) return drawForm("");
      const hello = el("div", "rk-hello");
      const avatar = el("span", "rk-avatar", nick.slice(0, 1).toUpperCase());
      const text = el("div");
      text.append(el("span", "muted", "Jogando como"), el("strong", "", nick));
      // logado como admin: avisa que as pontuações somam em todos os aparelhos
      R.info().then((i) => { if (i.admin) text.append(el("small", "muted", "🔐 Conta de admin: seus recordes somam em todos os aparelhos")); }).catch(() => null);
      const change = el("button", "share-btn", "✏️ Trocar");
      change.type = "button";
      change.setAttribute("aria-label", "Trocar nickname");
      change.addEventListener("click", () => drawForm(nick));
      hello.append(avatar, text, change);
      profile.append(hello);
    }

    function drawForm(value) {
      profile.replaceChildren();
      const form = el("form", "rk-form");
      const title = el("div");
      title.append(el("strong", "", value ? "Trocar nickname" : "🥋 Escolha seu nickname"),
        el("span", "muted", "É o nome que aparece no ranking. Seus recordes deste aparelho entram junto."));
      const row = el("div", "rk-inline-row");
      const input = el("input");
      input.value = value;
      input.maxLength = 16;
      input.placeholder = "Ex.: Yago Faixa Azul";
      input.autocomplete = "nickname";
      input.setAttribute("aria-label", "Seu nickname");
      const save = el("button", "button", "Salvar");
      save.type = "submit";
      row.append(input, save);
      if (value) {
        const cancel = el("button", "share-btn", "Cancelar");
        cancel.type = "button";
        cancel.addEventListener("click", drawProfile);
        row.append(cancel);
      }
      const msg = el("p", "rk-error");
      msg.setAttribute("aria-live", "polite");
      form.append(title, row, msg);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = R.setNick(input.value);
        if (err) { msg.textContent = err; input.focus(); return; }
        drawProfile();
        await R.sync();
      });
      profile.append(form);
      if (value) input.select();
    }

    drawProfile();
  }

  if (window.cohabRanking) init();
  else window.addEventListener("cohab-ranking", init, { once: true });
})();
