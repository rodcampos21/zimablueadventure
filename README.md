# O Conto de Zima: Rumo à Presidência 🫧

Um metroidvania em pixel art que roda no navegador e no celular.
Zima desce do ônibus em Capitão Leônidas Marques e encontra **Thyberius, o Mago**, que lhe dá a missão principal: **recrutar aliados e chegar à Prefeitura**, onde o Coronel Bigodão governa desde 1985. É o primeiro passo da campanha que termina em Brasília.

Esta versão é a **Demo**: atravessa a cidade e termina na luta contra **Julius, o Comuculturista**, que depois de apanhar vira o primeiro aliado do Zima.

## Como jogar
- **Navegador:** abra `index.html` (funciona até com dois cliques, sem servidor) ou o arquivo único `dist/zima.html`.
- **Celular:** abra o mesmo endereço e gire para a horizontal. Aparecem botões de toque. Dá para "Adicionar à tela inicial".

| Ação | Teclado | Toque | Gamepad |
|---|---|---|---|
| Andar | ← → ou A D | ◀ ▶ | Direcional / analógico |
| Pular (segure para ir mais alto) | Espaço, W ou ↑ | Pular | A |
| Agachar | ↓ ou S | ▼ | ↓ |
| Rolar | K, X ou Shift | Rolar | B / RB |
| Rede (ataque, também no ar) | J ou Z | Rede | X |
| Bolhas (especial) | L ou C | Bolhas | Y / RT |
| Pausa | Esc ou P | ❚❚ | Start |

**Rolar no tempo certo:** a invencibilidade só existe num trecho curto do giro. Se um golpe passar por você nesse momento, é **Esquiva Perfeita**: câmera lenta + Carisma extra.
**Carisma:** cada golpe da rede enche um pouco. Cada carga gasta dispara um jato de bolhas (que também aciona alavancas distantes).

## Visual em HD
- O canvas é desenhado na resolução real da tela (inclui telas Retina/celulares de alta densidade), não mais em 640×360 ampliado.
- Sprites do Zima recortados em 3× de resolução, com remoção de fundo, realce de contraste/nitidez e contorno.
- Ampliar usa vizinho mais próximo (`imageSmoothingEnabled = false` + `image-rendering: pixelated`, o equivalente web do `RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR` do Java); reduzir usa filtro de alta qualidade, para não serrilhar.
- Menu **Imagem** (no título e na pausa): Brilho, Contraste e Qualidade (Alta/Média/Leve).

## O que tem na demo
Rodoviária (primeiro pulo, por cima das malas) → Rua do Comércio (marquise baixa) → Praça do Coreto → Avenida Central (Atendentes que arremessam hambúrguer) → Banco da Praça (checkpoint) → um segredo escondido → Córrego Manso (ponte e alavanca) → Largo da Matriz (suba pelos caixotes até a sacada: o baú dá +1 de Carisma máximo) → **Chefe: Julius, o Comuculturista** (soco, investida e arremesso de pedra, duas fases, com música própria) → Julius se levanta e entra para a campanha → Fim da demo.

O design se baseia numa análise de Super Metroid, Castlevania: Symphony of the Night, Hollow Knight, Ori and the Will of the Wisps e Metroid Dread. Veja [`docs/GDD.md`](docs/GDD.md).

## Estrutura
```
index.html            página do jogo
css/style.css         layout, controles de toque
js/core.js            utilitários, partículas, câmera
js/input.js           teclado, toque multitoque, gamepad
js/audio.js           efeitos e músicas sintetizados (Web Audio)
js/art.js             cenário e personagens em pixel art procedural
js/level.js           mapa de Capitão Leônidas Marques, colisão, objetos
js/player.js          o Zima
js/enemies.js         Atendente (inimigo comum), hambúrguer, projéteis do chefe, itens
js/boss.js            Julius, o Comuculturista (chefe)
js/game.js            laço principal, HUD, diálogos, menus, salvamento
js/atlas.js           (gerado) quadros do Zima
assets/zima.png       (gerado) atlas dos sprites do Zima
raw/                  folhas de sprite originais (Zima, Thyberius, Atendente e Julius)
assets/audio/         músicas: menu (menu.mp3), exploração da fase (exploracao.mp3) e chefe (chefe.mp3)
assets/portraits/     retratos dos diálogos e do HUD (gerados por tools/portraits.py a partir de raw/portraits/)
tools/                scripts Python para recortar sprites e gerar o arquivo único
```

## Atualizar os sprites do Zima
Troque as folhas em `raw/` e rode:
```
pip install pillow numpy scipy
python3 tools/pack.py     # recorta, remove o fundo e gera assets/zima.png + js/atlas.js
python3 tools/build.py    # gera dist/zima.html
```
As animações usadas (quais quadros, velocidade) ficam no topo de `tools/pack.py`. NPCs e inimigos em folhas com células são recortados por `tools/npc.py`; o Julius (figuras que atravessam as linhas da grade) por `tools/julius.py`.

## Depuração
Abra com `?debug` no endereço (ou aperte F2) para ver as caixas de colisão.
