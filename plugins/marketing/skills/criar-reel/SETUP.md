# SETUP — instruções de instalação (escritas pra VOCÊ, Claude)

Você (Claude Code) está instalando a skill **criar-reel** na máquina de um usuário novo.
Esta skill foi construída originalmente pro fluxo do Eric (Expert Integrado) — sua missão é
adaptá-la pra ESTE usuário: dependências, chaves, avatar, voz e tom. Siga as fases na ordem,
**valide cada uma antes de seguir**, e não gaste crédito de API do usuário sem avisar antes.

## Regra zero: o usuário pode ser leigo

Assuma que o usuário NÃO é técnico e NÃO é do mundo do vídeo (pode ser alguém de 50+ anos
rodando isso pela primeira vez). Regras de comunicação durante TODO o setup e o uso:

- Na PRIMEIRA vez que um termo aparecer, explique em 1 frase simples. Exemplos prontos:
  B-roll (os vídeos de fundo que aparecem enquanto o avatar fala), lip-sync (fazer a boca
  do avatar mexer conforme o áudio), TTS (transformar texto em fala com a voz clonada),
  avatar (a versão digital do usuário em vídeo, criada no HeyGen), SRT (o arquivo da legenda
  que aparece na tela), chromakey (recortar o fundo verde do vídeo), chave de API (uma senha
  que autoriza o computador do usuário a usar um serviço pago em nome dele), arquivo .env
  (um bloco de notas onde essa senha fica guardada, só na máquina dele).
- Um passo por vez: peça UMA coisa, valide, só então peça a próxima. Nunca despeje uma
  lista de 5 tarefas de uma vez.
- Ao pedir qualquer coisa num site (chave, gravação, assinatura), diga exatamente onde
  clicar, o que copiar e onde colar.
- Todo custo em US$ vem acompanhado da conversão aproximada em R$.
- Se o usuário mandar um vídeo dele (pra tom de voz ou referência), transcreva VOCÊ,
  localmente, com o Whisper instalado na Fase 1 (grátis). Nunca mande o usuário procurar
  "ferramenta de transcrição online".
- Detecte você mesmo tudo que der (sistema operacional, Python, FFmpeg já instalados) em
  vez de perguntar ao usuário.

## Fase 0 — Entenda o terreno

- Leia o `SKILL.md` inteiro antes de começar.
- Pergunte ao usuário: sistema operacional, e onde ele quer guardar as credenciais.
  Os scripts assumem `C:\MCPs\` no Windows (constantes `ENV_PATH`/`DEFAULT_*` no topo de
  cada script). Se o usuário preferir outra pasta — ou estiver em macOS/Linux — **edite as
  constantes nos scripts** pra apontar pro caminho escolhido. São poucas linhas, todas no topo.
- **Dependência da skill irmã `viral-pra-reel`:** as etapas 1 e 2 do `SKILL.md` chamam
  `../viral-pra-reel/scripts/registro_reels.py` (caminho relativo, saindo da pasta desta skill)
  pra sincronizar o registro anti-repetição e os `padroes-perfil.md`. Numa instalação
  STANDALONE (só `criar-reel`, sem `viral-pra-reel` instalada), esse caminho relativo não existe
  e o comando falha. Nesse caso: (a) copiar `registro_reels.py` pra dentro de `scripts/` desta
  skill e ajustar o caminho nas etapas 1 e 2 do `SKILL.md`, ou (b) se o usuário não quiser esse
  controle de repetição, remover as duas chamadas do `SKILL.md` e avisar que a checagem
  anti-repetição fica manual. Confirme com o usuário antes de escolher.

## Fase 1 — Dependências de sistema

Verifique (e instrua a instalar se faltar):

- [ ] Python 3.10+ (`python --version`)
- [ ] FFmpeg + ffprobe no PATH (`ffmpeg -version`), com encoder libwebp
- [ ] Pacotes Python: `pip install numpy sherpa-onnx requests`
- [ ] (Só pro modo manual / vídeo gravado): `pip install rembg`
- [ ] (Pra legenda SRT): `pip install -U openai-whisper`. A skill `gerar-srt` e o
  `--transcrever` do `preflight_voz.py` chamam a CLI `whisper` (do pacote `openai-whisper`,
  não `faster-whisper`) com `--output_format srt` e `--word_timestamps`. `faster-whisper` é
  outro pacote, sem essa CLI, e não serve aqui. Se o usuário não tiver a skill `gerar-srt`,
  transcreva você mesmo com `whisper <video> --model medium --language pt --output_format srt
  --word_timestamps True` e gere o .srt no mesmo formato.
- [ ] (Opcional, só pro arquivamento): GitHub CLI `gh` autenticado (`gh auth status`). Usado
  só pelo `arquivar_reel.py` (item 8 do checklist do SKILL.md) pra subir o reel pronto num
  release privado. Sem isso, esse item do checklist fica indisponível.

## Fase 2 — Chaves de API (peça uma por uma, crie os arquivos)

Crie um arquivo por serviço na pasta de credenciais (formato `CHAVE=valor`, uma por linha):

| Arquivo | Conteúdo | Onde o usuário pega |
|---|---|---|
| `elevenlabs.env` | `ELEVENLABS_API_KEY=...` | elevenlabs.io → Profile → API Keys |
| `heygen.env` | `HEYGEN_API_KEY=...` | app.heygen.com → Settings → API (precisa de saldo de API, que é separado da assinatura do site) |
| `openai.env` | `OPENAI_API_KEY=...` | platform.openai.com → API Keys |
| `kling.env` | `KLING_ACCESS_KEY=...` e `KLING_SECRET_KEY=...` | klingai.com → API (saldo separado da assinatura) |

Pré-requisitos de conta (confirme com o usuário ANTES de testar):
- **ElevenLabs:** plano com Instant/Professional Voice Cloning e a voz do usuário JÁ clonada
  (Professional/PVC dá o melhor resultado). Sem voz clonada, a skill não faz sentido.
- **HeyGen:** um avatar do usuário criado (Avatar IV/V — "digital twin"). Custo de referência:
  US$ 4/min de vídeo 1080p gerado via API.
- **Kling:** chaves de API ativas. Custo de referência: ~US$ 0,42/clipe de 5s (std).

### Se o usuário está começando do ZERO (sem voz clonada, sem avatar)

Não trave o setup: guie a criação na ordem abaixo, avisando que essas são as duas únicas
partes que dependem de gravação própria e levam mais tempo que o resto:

1. **Voz clonada (ElevenLabs):** assinar um plano que inclua clonagem de voz e criar a voz
   em Voices, seguindo o fluxo do próprio site. Orientações de gravação que você deve
   repassar: áudio só com a voz (sem música, sem eco, sem outra pessoa falando), tom natural
   de conversa, como se estivesse gravando um vídeo pro Instagram. A clonagem Instant
   (poucos minutos de áudio) serve pra começar hoje; a Professional (exige bem mais áudio e
   demora pra processar) dá o melhor resultado e pode ser feita como upgrade depois.
2. **Avatar (HeyGen):** criar o "digital twin" (Avatar IV/V) seguindo o fluxo do site, que
   pede uma gravação em vídeo do usuário e um vídeo de consentimento. Depois, comprar
   crédito de API em Settings > API. Explique: é um saldo pré-pago SEPARADO da mensalidade
   do site; a mensalidade sozinha não faz a skill funcionar.
3. Enquanto a clonagem e o avatar processam, adiante o resto (Fase 1, as outras chaves da
   Fase 2 e a entrevista de tom da Fase 3).

1. **Voz ElevenLabs e avatar HeyGen (IDs centralizados):** desde a criação de `scripts/comum.py`,
   `AVATAR_ERIC_2026` e `VOICE_ELEVEN_ERIC` moram num único lugar, importado por
   `elevenlabs_heygen.py`, `heygen_video.py` e `preflight_voz.py`. Não edite mais dois scripts
   separados, edite SÓ `scripts/comum.py`:
   - Voz: liste as vozes (`GET https://api.elevenlabs.io/v1/voices`, header `xi-api-key`),
     mostre as clonadas ao usuário, pergunte qual usar e atualize `VOICE_ELEVEN_ERIC`.
   - Avatar: liste os avatares (`GET https://api.heygen.com/v2/avatars`, header `x-api-key`),
     pergunte qual usar e atualize `AVATAR_ERIC_2026`.
2. **Referência de voz + modelo de embedding (checkpoint anti voz-trocada):** o script
   `scripts/setup_voice_checker.py` automatiza os dois passos que antes eram manuais: baixa o
   modelo ERes2Net (com verificação de sha256 contra `EXPECTED_SHA256`, pra garantir que o
   download não veio corrompido ou trocado) e converte a referência de voz do usuário, com
   validação de duração. Rode:
   ```bash
   python scripts/setup_voice_checker.py --ref <audio-do-usuario>
   ```
   Depois CALIBRE com `--test`: `python scripts/setup_voice_checker.py --test <video-real>.mp4`
   (deve dar sim > 0.7 num vídeo do próprio usuário e < 0.3 num áudio de outra pessoa).
   A referência recomendada é um áudio já gerado pelo ElevenLabs com a voz certa (não a voz
   real do usuário, o modelo compara timbre TTS contra timbre TTS).
   Fallback manual (só se o script não servir pro ambiente do usuário): converta a referência
   com `ffmpeg -i entrada -ar 16000 -ac 1 voice-ref.wav`, baixe o modelo direto dos releases de
   speaker-recognition do sherpa-onnx (github.com/k2-fsa/sherpa-onnx, ex:
   `3dspeaker_speech_eres2net_*.onnx`) e atualize `DEFAULT_REF`/`DEFAULT_MODEL` em
   `scripts/verificar_voz.py`.
3. **Tom de voz do roteiro:** `references/voz-eric.md` descreve o tom do Eric e precisa ser
   REESCRITO pro tom DESTE usuário (pode renomear pra `voz-do-usuario.md`, ajustando as
   referências no SKILL.md). A qualidade de todo roteiro futuro depende do material coletado
   aqui. Colete nesta ordem de preferência:
   - **(a) Fala real dele:** peça 3 a 5 vídeos em que ele aparece falando (Reels antigos,
     stories, aula gravada, até áudio/vídeo de WhatsApp serve). Transcreva você, localmente,
     com o Whisper da Fase 1 (grátis, sem ferramenta externa) e extraia: vocabulário,
     bordões, ritmo, como ele abre e fecha uma ideia.
   - **(b) Texto que ele mesmo escreveu:** legendas de posts, e-mails, mensagens longas.
   - **(c) Entrevista guiada** (sempre, pra fechar as lacunas): nicho, público, 3 bordões,
     palavras e clichês que ele NUNCA usaria, e como ele explicaria o produto dele pra um
     amigo, em voz alta. Registre no arquivo frases INTEIRAS de exemplo, não só adjetivos.
4. **Etapa 9 (página de CTA):** o SKILL.md publica numa biblioteca de conteúdos privada do
   autor original (MCP `biblioteca`), que NÃO vem neste repo. Pergunte ao usuário o que ele
   prefere: (a) publicar no Notion dele via MCP oficial, (b) pular a etapa, ou (c) se ele
   tiver um site próprio com API, adaptar. Edite a etapa 9 do SKILL.md conforme a escolha.
5. **Item 8 do checklist (arquivamento):** `scripts/arquivar_reel.py` aponta pro repo PRIVADO
   `joaoludgerio/expert-reels-arquivo` (constante `REPO` no topo do script). Pergunte ao
   usuário: (a) ele cria um repo privado próprio com um release chamado "arquivo" e você
   atualiza `REPO`, ou (b) ele não quer arquivamento e você marca o item 8 do checklist do
   SKILL.md como pulado (avise que isso é reversível depois).

## Fase 4 — Testes de validação (custo total < US$ 1, avise antes)

Execute em ordem, mostrando o resultado de cada um:

1. **ElevenLabs (centavos):** gere um TTS curto com a voz escolhida e rode o
   `verificar_voz.py` nele — esperado: sim ≥ 0.7.
2. **HeyGen (~US$ 0,30):** suba esse áudio (`POST https://upload.heygen.com/v1/asset`,
   Content-Type `audio/mpeg`, body binário) e gere um lip-sync de ~4s via `POST /v3/videos`
   com `audio_asset_id` (corpo igual ao do `elevenlabs_heygen.py`). Baixe, confira 1 frame
   (fundo verde chapado) e re-rode o `verificar_voz.py` no vídeo.
3. **OpenAI (~US$ 0,02):** `python scripts/openai_image.py --prompt "teste" --quality low
   --out teste.png` e confira a imagem.
4. **Kling (~US$ 0,42 — pergunte antes):** 1 clipe de teste com `scripts/kling_i2v.py` num
   manifesto de 1 item (formato em `references/kling-api.md`).
5. **FFmpeg/WebP:** `ffmpeg -y -i teste.png -q:v 80 teste.webp` deve funcionar.

## Fase 5 — Fechamento

- [ ] Confirme que o SKILL.md ficou coerente com as escolhas do usuário (voz, etapa 9, paths).
- [ ] Apague os arquivos de teste gerados.
- [ ] Diga ao usuário o custo estimado por vídeo (~US$ 9/min) e os saldos que ele precisa
  manter (HeyGen API e Kling são pré-pagos separados da assinatura dos sites).
- [ ] Sugira o primeiro uso: *"cria um reel sobre [tema que o usuário domina]"*.

## Avisos que você deve repassar

- O HeyGen cobra por segundo de vídeo GERADO (~US$ 4/min no Avatar V 1080p) — submit
  recusado não gasta, mas vídeo gerado e descartado gasta.
- O ElevenLabs às vezes troca a voz no meio do áudio — é exatamente isso que o checkpoint
  do `elevenlabs_heygen.py` pega ANTES de gastar crédito do HeyGen. Não remova.
- O Kling barra imagens com figura humana "nua" (mesmo robôs estilizados) — as figuras dos
  frames devem estar sempre vestidas (já está nas referências visuais).
