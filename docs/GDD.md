# Zima Blue Adventure — Documento de Design (v0.1, Tutorial)

> Zima sai do interior rumo à Presidência. Primeiro passo: Capitão Leônidas Marques.
>
> **Missão principal** (dada por Thyberius, o Mago): recrutar aliados e chegar à Prefeitura de Capitão Leônidas Marques.

## 1. Análise dos 5 metroidvanias de referência

| Jogo | O que faz de melhor | O que levamos para o Zima |
|---|---|---|
| **Super Metroid** (1994) | Ensina sem texto. Mostra áreas inalcançáveis cedo para gerar curiosidade; o mundo é a tutorial. | Placas curtas e diegéticas em vez de telas de texto. Uma **sacada alta com um baú** visível desde o tutorial, impossível de alcançar sem o futuro pulo — a promessa do "volte depois". |
| **Castlevania: Symphony of the Night** (1997) | Recompensa a curiosidade: paredes falsas, itens escondidos, sensação de impacto em cada golpe. | **Muro rachado** que quebra com ataques e esconde uma **Coxinha** (+1 de vida máxima). Inimigos piscam, recuam e soltam itens. |
| **Hollow Knight** (2017) | Combate preciso com hitbox justa, recuo ao acertar, energia que se ganha batendo (Soul), bancos como checkpoints, chefes com sinais claros. | **Carisma**: a energia das bolhas enche quando Zima acerta golpes básicos. **Bancos da praça** salvam e curam. O chefe telegrafa cada golpe com pose + brilho antes de atacar. |
| **Ori and the Will of the Wisps** (2020) | Movimento fluido e responsivo, ambientação viva em camadas, leitura clara mesmo com muita coisa na tela. | Cenário em **parallax de 4 camadas** (céu, morros, casario, rua), controles com buffer de entrada para nada "engolir" o botão, partículas leves. |
| **Metroid Dread** (2021) | Contra-ataque com janela curta e recompensa grande; morte rápida → voltar a jogar em segundos. | **Rolagem com janela perfeita**: a invencibilidade só existe num trecho curto do rolamento. Acertar o tempo gera "ESQUIVA PERFEITA", câmera lenta e Carisma extra. Ao morrer, volta ao último banco quase sem espera. |

### Princípios resultantes
1. **Ensinar jogando**: cada habilidade tem um trecho da fase que só se resolve com ela.
2. **Risco com recompensa**: rolar no tempo certo é melhor do que rolar sempre.
3. **Bater para carregar o especial**: o jogador alterna entre agressivo (melee) e tático (bolhas).
4. **O mundo promete mais do que entrega agora**: caminhos bloqueados que exigem habilidades futuras.
5. **Mobile em primeiro lugar**: poucos botões, alvos grandes, legibilidade em tela pequena.

## 2. Zima — moveset inicial

| Ação | Teclado | Toque | Detalhe |
|---|---|---|---|
| Andar | ← → / A D | Direcional | Aceleração curta, freio rápido. |
| Pular | Espaço / W / ↑ | Botão **Pular** | Pulo variável (segurar = ~4,7 tiles; toque rápido = ~1,6), *coyote time* de 0,1 s, buffer de entrada, gravidade maior na descida e "flutuar" no topo enquanto segura. Dá para atacar e soprar bolhas no ar. |
| Agachar | ↓ / S | ▼ | Reduz a altura: passa sob toldos baixos e desvia de projéteis altos. Anda agachado devagar. |
| Rolar | K / X / Shift | Botão **Rolar** | 0,45 s, passa por baixo de obstáculos. **Invencível só entre 0,05 s e 0,22 s**. Desviar de um golpe nessa janela = Esquiva Perfeita (+Carisma, câmera lenta). |
| Ataque básico | J / Z | Botão **Rede** | Golpe com a rede, 1 de dano, enche 1/4 de Carisma por acerto. |
| Bolhas (especial) | L / C | Botão **Bolhas** | Custa 1 carga de Carisma (máx. 3). Dispara um jato de bolhas que atravessa o cenário, 2 de dano por bolha e aciona alavancas distantes. |

O pulo alcança degraus de até 4 tiles. O desnível de 6 tiles do Córrego e o portão da arena continuam fora de alcance de propósito (espaço para habilidades futuras, como pulo duplo).

## 3. O tutorial: Capitão Leônidas Marques

Fluxo da esquerda para a direita, sempre descendo (sem pulo, só se cai de degraus):

1. **Rodoviária** — Zima desce do ônibus e conhece **Thyberius, o Mago**, que dá a missão principal e encanta a rede de bolhas. Placa: andar e pular (malas no caminho).
2. **Rua do Comércio** — toldo da padaria baixo demais → agachar.
3. **Praça do Coreto** — primeiros **Atendentes**: o único ataque deles é arremessar hambúrguer → ataque básico (a rede também rebate o hambúrguer).
4. **Avenida Central** — de perto o hambúrguer vem reto na altura do peito (agachar, pular ou rolar); de longe vem em arco mirando o Zima (sair do lugar). Placa explica a janela perfeita.
5. **Banco da praça** — checkpoint (salva e cura).
6. **Muro rachado** — segredo com a Coxinha (+1 vida).
7. **Córrego** — ponte levadiça erguida; a alavanca está do outro lado → Bolhas.
8. **Sacada da igreja** — subir pelos caixotes e abrir o baú com a rede: Medalha do Avô (+1 de Carisma máximo).
9. **Chefe: Coronel Bigodão, o Prefeito Eterno** — em frente à Prefeitura.

### Chefe — Coronel Bigodão (24 de vida)
- **Investida do Palanque**: bate o pé (poeira) e atravessa a arena → rolar através dele.
- **Chuva de Santinhos**: arremessa 3 a 5 panfletos na altura da cabeça → agachar ou rolar.
- **Discurso no Megafone**: onda sonora rente ao chão → só rolando no tempo certo.
- **Fase 2 (≤ 50%)**: fica mais rápido, encadeia golpes e chama dois Atendentes.

Vitória → tela "Fim do Tutorial" com tempo, mortes e esquivas perfeitas.

## 4. Tecnologia
- HTML5 Canvas + JavaScript puro, sem dependências; abre direto no navegador (inclusive por `file://`).
- Resolução interna 640×360 escalada em pixels inteiros; paisagem no celular, com aviso para girar.
- Entrada unificada: teclado, toque com multitoque e gamepad.
- Áudio sintetizado com Web Audio (sem arquivos).
- Progresso salvo em `localStorage` (banco e segredos).

## 5. Próximos passos sugeridos
1. Pulo duplo ("Pulo do Gato") para alcançar desníveis de 6 tiles e novas rotas na cidade.
2. Mapa da cidade (estilo Hollow Knight, comprado de um personagem).
3. Novas áreas: Fazenda, Feira, Câmara dos Vereadores.
4. Sprites próprios dos inimigos e do chefe, no mesmo estilo do Zima.
