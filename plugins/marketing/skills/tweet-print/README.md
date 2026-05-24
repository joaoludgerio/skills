# tweet-print

Skill da Expert Integrado pra gerar imagens estilo "tweet print" prontas pra postar no Instagram.

## Setup

```bash
cd skills/tweet-print
pip install -r requirements.txt
playwright install chromium
```

## Uso direto via CLI

```bash
python generate.py \
  --text "Se **Matrix** fosse lançado hoje, o **Neo** se chamaria **Cláudio**." \
  --avatar /caminho/foto.jpg \
  --output ./tweet.png
```

## Uso via Claude Code

Pedir em linguagem natural:

> "faz um tweet print com o texto X"
> "transforma essa frase num post estilo tweet"
> "monta um carrossel de 3 tweets sobre Y"

A skill ativa automática pelos triggers definidos no `SKILL.md`.

## Parâmetros

Ver `python generate.py --help` ou consultar o `SKILL.md`.

## Exemplos

| Caso | Comando |
|------|---------|
| Feed quadrado tema claro | `--theme light --format 1080x1080` |
| Story vertical tema escuro | `--theme dark --format 1080x1920` |
| Sem foto (usa inicial) | omitir `--avatar` |
| Sem selo verificado | `--no-verified` |
| Texto longo | a fonte se ajusta automático (40-64px) |
