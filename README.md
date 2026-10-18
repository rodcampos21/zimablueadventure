# Zima Blue Adventure 🫧

**A Aventura de Zima — Rumo à Presidência.** Um metroidvania em pixel art que roda no navegador e no celular.
Zima volta para a Vila Azul do Interior para enfrentar o Coronel Bigodão, prefeito desde 1985. É o primeiro passo da campanha que termina em Brasília.

Esta versão é o **Tutorial**: atravessa a cidadezinha e termina na luta contra o primeiro chefe.

## Como jogar
- **Navegador:** abra `index.html` (funciona até com dois cliques, sem servidor) ou o arquivo único `dist/zima.html`.
- **Celular:** abra o mesmo endereço e gire para a horizontal. Aparecem botões de toque. Dá para "Adicionar à tela inicial".

| Ação | Teclado | Toque | Gamepad |
|---|---|---|---|
| Andar | ← → ou A D | ◀ ▶ | Direcional / analógico |
| Agachar | ↓ ou S | ▼ | ↓ |
| Rolar | K, X ou Shift | Rolar | A |
| Rede (ataque) | J ou Z | Rede | X |
| Bolhas (especial) | L ou C | Bolhas | B / Y |
| Pausa | Esc ou P | ❚❚ | Start |

**Rolar no tempo certo:** a invencibilidade só existe num trecho curto do giro. Se um golpe passar por você nesse momento, é **Esquiva Perfeita**: câmera lenta + Carisma extra.
**Carisma:** cada golpe da rede enche um pouco. Cada carga gasta dispara um jato de bolhas (que também aciona alavancas distantes).

## O que tem no tutorial
Rodoviária → Rua do Comércio (marquise baixa) → Praça dos Pombos → Rua dos Cabos Eleitorais → Banco da Praça (checkpoint) → um segredo escondido → Córrego Manso (ponte e alavanca) → Largo da Matriz (um baú que só se alcança pulando… depois) → **Chefe: Coronel Bigodão**, com duas fases.

O design se baseia numa análise de Super Metroid, Castlevania: Symphony of the Night, Hollow Knight, Ori and the Will of the Wisps e Metroid Dread. Veja [`docs/GDD.md`](docs/GDD.md).

## Estrutura
```
index.html            página do jogo
css/style.css         layout, controles de toque
js/core.js            utilitários, partículas, câmera
js/input.js           teclado, toque multitoque, gamepad
js/audio.js           efeitos e músicas sintetizados (Web Audio)
js/art.js             cenário e personagens em pixel art procedural
js/level.js           mapa da Vila Azul, colisão, objetos
js/player.js          o Zima
js/enemies.js         pombos, cabos eleitorais, projéteis, itens
js/boss.js            Coronel Bigodão
js/game.js            laço principal, HUD, diálogos, menus, salvamento
js/atlas.js           (gerado) quadros do Zima
assets/zima.png       (gerado) atlas dos sprites do Zima
raw/                  folhas de sprite originais
tools/                scripts Python para recortar sprites e gerar o arquivo único
```

## Atualizar os sprites do Zima
Troque as folhas em `raw/` e rode:
```
pip install pillow numpy scipy
python3 tools/pack.py     # recorta, remove o fundo e gera assets/zima.png + js/atlas.js
python3 tools/build.py    # gera dist/zima.html
```
As animações usadas (quais quadros, velocidade) ficam no topo de `tools/pack.py`.

## Depuração
Abra com `?debug` no endereço (ou aperte F2) para ver as caixas de colisão.
