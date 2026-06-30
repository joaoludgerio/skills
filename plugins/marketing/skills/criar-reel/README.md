# /criar-reel — Reel de Instagram pronto pra postar, com o avatar de IA do Eric

> Você dá o tema, a skill devolve o Reel completo: roteiro, vídeo do avatar falando, B-rolls, legenda na tela, thumb e a página do CTA — tudo pronto pra publicar.

## O que faz

É a "fábrica de Reels" da Expert Integrado. A partir de uma pauta (um tema, um link ou um vídeo gravado), ela escreve o roteiro no tom de voz do Eric, gera o vídeo do avatar dele falando, monta os fundos animados (B-rolls), queima a legenda amarela, cria a thumb e ainda publica a página do material prometido no CTA. Sem editor de vídeo, sem Canva, sem ficar pulando entre ferramentas. É a versão padrão de produção (a v3 é a mais barata e a mais estável).

## Quando usar

- "Cria um reel sobre [ferramenta/assunto]"
- "Monta o reel desse repositório/desse link: [url]" (ela pesquisa os fatos sozinha)
- "Reel barato" / "reel com ElevenLabs" / "cria um reel v3"
- "Faz um reel com esse vídeo que eu gravei" (modo manual — usa a sua gravação no lugar do avatar)
- Qualquer pedido de Reel sem versão especificada cai aqui por padrão.

## O que você precisa dar

- **A pauta.** Pode ser de três formas:
  - Um **tema** ("a hora do programador ficou mais barata com IA");
  - Um **link ou repositório** (ela acessa, confere números, versões e diferencial);
  - Um **vídeo já gravado** do Eric (modo manual — aí ela usa a fala real dele em vez do avatar).
- Se a pauta for aberta ("acha um tema"), ela pesquisa o que está viralizando, propõe um conceito com hook e CTA e **espera você aprovar antes de gastar crédito**.

## O que ela entrega

Tudo salvo dentro de uma pasta única do Reel (em `Downloads`), nada solto:

- **`video-final-*.mp4`** — o Reel pronto pra postar (9:16, avatar sobre o B-roll, legenda amarela queimada).
- **`legenda-post.md`** — a legenda do post (ângulo diferente do roteiro) + hashtags + a palavra do CTA + o link da página da Biblioteca.
- **`thumb-*.png`** — a capa/thumb do Reel.
- **Página pública do CTA** na Biblioteca (biblioteca.ericluciano.com.br) — o material prometido (guia, prompts etc.) que captura o lead com nome e telefone. O link volta no chat e na legenda.

## Como funciona (passo a passo resumido)

1. **Pauta e fatos** — entende o tema, e se vier link/repo pesquisa e confere os dados (nunca inventa número).
2. **Roteiro** — escreve no tom do Eric seguindo o template viral (dor → diagnóstico com número → "isso tem nome" → solução → CTA), com alvo de 40-60s.
3. **Fala do avatar** — gera o áudio no ElevenLabs (voz clonada do Eric) e faz só o lip-sync no HeyGen (o avatar do Eric mexendo a boca no áudio). É aqui que a v3 economiza.
4. **Legenda da tela (SRT)** — transcreve o vídeo e corrige os termos técnicos.
5. **Fundos (B-rolls)** — primeiro reaproveita o **banco de B-rolls** já existente (~219 clipes prontos); só gera novo no que faltar.
6. **B-rolls novos** — pros poucos trechos sem clipe no banco, gera imagem (GPT Image 2) e anima (Kling).
7. **Composição final** — junta tudo: B-roll no fundo, Eric recortado por cima e a legenda amarela.
8. **Thumb** — gera a capa do Reel.
9. **Página do CTA** — publica o material prometido na Biblioteca e devolve o link público.

## Integrações e ferramentas

- **ElevenLabs** — gera a fala (voz clonada do Eric). É a etapa que barateia a v3.
- **HeyGen** — faz o lip-sync: o avatar do Eric falando o áudio do ElevenLabs.
- **GPT Image 2 (OpenAI)** — gera as imagens base dos B-rolls, a thumb e a capa da página de CTA.
- **Kling** — anima as imagens e vira os vídeos de fundo (B-rolls). É a opção principal.
- **Higgsfield** — alternativa de animação, usada só como fallback se o Kling falhar ou ficar sem saldo.
- **Banco de B-rolls** — catálogo de ~219 clipes prontos reutilizáveis; consultado antes de gerar qualquer coisa nova, pra economizar.
- **Biblioteca (biblioteca.ericluciano.com.br)** — onde a página do CTA é publicada e os leads são capturados. (Notion serve de fallback.)
- **Whisper** — transcreve o áudio pra gerar a legenda da tela.

## Pré-requisitos

- **Claude Code**, **Python 3.10+** e **FFmpeg** instalados na máquina.
- **Chaves de API** (configuradas em arquivos `.env`, normalmente na pasta `C:\MCPs\` — nunca colocadas neste README):
  - `elevenlabs.env` — chave do ElevenLabs (conta com a voz do Eric já clonada).
  - `heygen.env` — chave do HeyGen (com o avatar do Eric criado; **o saldo de API é separado da assinatura do site**).
  - `openai.env` — chave da OpenAI (GPT Image 2).
  - `kling.env` — chaves do Kling (**saldo também separado da assinatura**).
  - `biblioteca.env` — login de admin da Biblioteca (pra publicar a página de CTA).
- **Voz e avatar já configurados** dentro da skill (qual voz do ElevenLabs e qual avatar do HeyGen usar). Isso é feito uma vez, na instalação — o passo a passo está no `SETUP.md`, e o Claude faz pra você.

> Observação: os valores das chaves NÃO ficam neste repositório. Você só precisa saber QUAIS chaves existem e que elas moram nos arquivos `.env` acima.

## Dicas e observações

- **Custo por Reel (~1 min): cerca de US$ 9.** Aproximadamente US$ 4 de fala (ElevenLabs + HeyGen), US$ 4,60 de B-rolls (Kling, ~11 clipes) e ~US$ 0,50 de imagens. O fluxo antigo custava US$ 10-11 só na fala — a v3 corta isso pela metade.
- **HeyGen e Kling são pré-pagos e separados** da assinatura dos sites. Mantenha saldo. Vídeo gerado e descartado gasta crédito; submit recusado não gasta.
- **O ElevenLabs às vezes troca a voz no meio do áudio.** A skill tem uma verificação automática que pega isso ANTES de gastar crédito do HeyGen — por isso ela gera a fala em blocos curtos.
- **Reaproveitar o banco de B-rolls derruba muito o custo.** Na maioria dos Reels dá pra não gerar quase nada de Kling novo.
- **Pauta aberta gasta crédito.** Quando você pede "acha um tema", ela propõe e espera aprovação antes de produzir.
- **Modo manual** (você manda um vídeo gravado): ela recorta o fundo por IA e usa a fala real do Eric, pulando o avatar.
- **Sempre confira o vídeo final antes de postar.** A skill checa frames automaticamente, mas é IA gerando conteúdo — vale uma olhada humana.
