# 🎞️ Banco de B-rolls (remoto, reutilizável)

Catálogo público de **~219 B-rolls** já gerados (Kling), pra **reciclar em vez de gerar no Kling toda vez**.
Todos no mesmo estilo: **fundo escuro carvão + brilho âmbar, abstrato high-tech, 9:16, ~5s, sem áudio.**

- **Catálogo:** `bank.json` público (raw GitHub) — a skill lê via `scripts/broll_bank.py`.
- **Clips:** hospedados num **GitHub Release** do repo `expert-broll-bank` → URLs públicas, sem login.
- Funciona em **qualquer máquina**: baixa só os clips escolhidos (com cache em `~/.cache/broll-bank/`).
- Sobrescrever URL do catálogo: env `BROLL_BANK_URL`.

## Como a skill usa (etapa 6)
```bash
python scripts/broll_bank.py --list                 # catálogo (id, categorias, descrição)
python scripts/broll_bank.py --list --cat servidor  # filtra por categoria
python scripts/broll_bank.py --list --hd            # só 1080x1920
python scripts/broll_bank.py --thumb crm-03 tag-08  # baixa thumbs p/ conferir (Read em _bankthumbs/)
python scripts/broll_bank.py --get crm-03 tag-08 ai-slop-09 --out <reel>   # vira clip-01,02,03.mp4
```

## Categorias (casar com a fala)
`robo` (figura de IA) · `servidor` (data/rack) · `cerebro` (conhecimento/grafo) · `video` (play/film strip) ·
`documento` (tela/dashboard/card) · `energia` (partículas/código/streaks) · `rede` (nós/conexões) ·
`relogio` (tempo/ampulheta) · `estrela` (burst/explosão) · `lupa` (busca/radar) · `moeda` (custo/dinheiro) ·
`cristal` (esfera âmbar) · `pessoas` (equipe + IA).

`cat` é filtro **grosso** (herdado do reel de origem); usar a **thumb** pra escolha fina. Preferir `hd=true`.

## Regra de reuso
1. `--list` → mapear cada trecho da fala a uma categoria → escolher 1 `id` (alternar, sem repetir seguido).
2. `--get ... --out <reel>` baixa na ordem como `clip-01..NN.mp4`.
3. **Só gerar no Kling o que o banco não cobre** (etapa 5 só pros gaps).
4. Clips novos gerados → subir no Release + acrescentar no `bank.json` (pra crescerem o banco).
