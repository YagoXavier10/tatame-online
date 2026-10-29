<p align="center">
  <img src="./assets/banner.svg" width="100%" alt="Tatame Online · jogos de jiu-jitsu" />
</p>

<p align="center">
  <a href="https://yagoxavier10.github.io/tatame-online/"><img src="https://img.shields.io/badge/🌐_Ver_o_site-ao_vivo-7b3fe4?style=for-the-badge&labelColor=0d0b2e" alt="Ver o site" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-0d0b2e?style=for-the-badge&logo=javascript&logoColor=f7df1e" alt="JavaScript" />
  <img src="https://img.shields.io/badge/HTML5-0d0b2e?style=for-the-badge&logo=html5&logoColor=e34f26" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-0d0b2e?style=for-the-badge&logo=css&logoColor=1572b6" alt="CSS3" />
  <img src="https://img.shields.io/badge/Firebase-0d0b2e?style=for-the-badge&logo=firebase&logoColor=ffca28" alt="Firebase" />
</p>

Jogos de jiu-jitsu no navegador, feitos para a Cohab Team Brazilian Jiu-Jitsu: para jogar sozinho, com recorde e ranking online,
ou com a turma, no mesmo celular ou ao vivo. O site completo é https://yagoxavier10.github.io/cohab-team/ (repositório YagoXavier10/cohab-team).

> 🎴 **Novo: [Luta de cartas](https://yagoxavier10.github.io/tatame-online/cartas.html).** Jiu-jitsu por turnos contra o computador.
> Cada carta só funciona de certas posições (guarda, meia, 100 kg, montada, costas) e leva a luta para outra, gastando fôlego e pegadas.
> Os pontos são os da IBJJF e a finalização acaba a luta.

## 📸 Prévia

<p align="center">
  <a href="https://yagoxavier10.github.io/tatame-online/"><img src="./assets/preview.png" width="90%" alt="Prévia do site" /></a>
</p>

## 🎮 Jogos

| Solo | Com os amigos |
| :-- | :-- |
| 🎴 Luta de cartas | 🥊 Luta ao vivo |
| 🌀 Labirinto | ⚡ Relâmpago |
| 🎯 Acerta-alvo | 🕵️ Infiltrado |
| 🏗️ Torre de faixas | 🎭 Blefe |
| 💨 Esquiva | 🪢 Cabo de guerra |
| 🃏 Pares | 🥔 Batata quente |
| 🧩 Deslize | |
| 🔤 Caça-palavras | |
| ❓ Quiz | |
| ⏱️ Qual é a posição? | |
| 🧭 Caminho da finalização | |
| 🧑‍⚖️ Árbitro por um dia | |
| 🃏 Regra ou mito? | |

Com recorde e ranking online. 🏆



## 🔐 Painel do admin

Em `admin.html` (fora dos menus) o administrador entra com usuário e senha e controla o site sem mexer no código:
liga e desliga jogos (com motivo), muda a ordem e a etiqueta “Novo”, escolhe o banner de destaque, coloca um aviso no topo,
ativa o modo manutenção, ajusta a Luta de cartas (tempo e dificuldade), bloqueia nicks e apaga pontuações do ranking.
Quem joga não precisa de login. O usuário e a senha ficam no Firebase Authentication (nunca no código), e as regras do
Firestore só deixam o admin gravar.

## 📄 Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
