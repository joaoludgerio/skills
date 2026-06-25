# Carrossel Studio

Skill de criação de **carrosséis de Instagram prontos pra postar**. Você descreve a ideia, a skill entrevista sua marca, escreve a copy, monta o visual e te entrega um arquivo HTML que abre no navegador e exporta os slides em PNG — **tudo offline, sem ferramenta paga**.

## Como instalar

Copie a pasta `carrossel-studio/` para dentro de `~/.claude/skills/` (Mac/Linux) ou `%USERPROFILE%\.claude\skills\` (Windows):

```
.claude/skills/carrossel-studio/
├── SKILL.md
├── assets/
│   ├── editor-carrossel.html   # o editor visual (template)
│   └── montar.py               # injeta o projeto no editor
├── references/                 # base de conhecimento da skill
└── README.md
```

Abra o Claude Code e mande, por exemplo:
> "cria um carrossel sobre os 3 erros mais comuns ao começar com IA"

## O que você precisa

- **Claude Code** (a skill roda dentro dele).
- **Python 3** (só pra montar o arquivo final — opcional; dá pra importar o JSON na mão).
- Um **navegador** (Chrome, Edge, Firefox) pra abrir o editor e exportar.
- **Internet na 1ª vez** (pra baixar as fontes bonitas). Offline funciona com fontes do sistema.

Não precisa de chave de API, conta paga, nem nada externo.

## Como usar

1. Peça o carrossel ao Claude.
2. Responda as perguntas sobre sua marca (na 1ª vez). Depois é só pedir "mesmo estilo de antes".
3. O Claude te entrega um arquivo `<tema>-carrossel.html`.
4. **Abra o arquivo** (duplo clique). Ajuste textos, cores, fonte e formato nos painéis.
5. Clique em **Exportar PNGs (.zip)** → baixa um `.zip` com 1 imagem por slide (1080×1350 ou 1080×1080).
6. Poste no Instagram. A legenda já vem pronta pra colar.

## Recursos do editor

- Edição de texto por slide (kicker, título, corpo, CTA).
- 3 tipos de slide: capa, conteúdo, fechamento (CTA).
- 6 kits tipográficos + 9 paletas (ou cores próprias da marca).
- Formato retrato 4:5 ou quadrado 1:1.
- Número de página, seta "arraste", @ no rodapé — liga/desliga.
- **Salvar projeto** (JSON) pra reabrir e editar depois.
- Export PNG em alta + empacotamento em ZIP — 100% no seu navegador, nada sai da sua máquina.

## Privacidade

Tudo roda local, no seu navegador. Nenhuma imagem ou texto é enviado pra servidor. As únicas requisições externas são as fontes (Google Fonts), e só na primeira vez.
