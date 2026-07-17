---
name: tutorial-expert
description: "Produz um episódio da série educacional de topo do perfil @expertintegrado (linha editorial de 09/07/2026): tutorial curto (~60s) apresentado pelo influencer de IA da casa (persona fixa, NÃO é o Eric), respondendo uma pergunta prática real de dono de empresa sobre IA no comercial. Reusa o pipeline do criar-reel (ElevenLabs + HeyGen lip-sync + B-rolls + composição) com voz e avatar próprios da persona, configurados fora do código. Usar quando pedirem 'cria o tutorial da Expert', 'episódio da série da Expert', 'conteúdo de topo do perfil da empresa', 'roda o tutorial-expert', ou qualquer pedido de vídeo da série do influencer de IA."
argument-hint: "[pergunta ou pauta] [--da-fila] [--sem-thumb] [--block-seconds N]"
allowed-tools: Read, Write, Edit, Bash, WebFetch, WebSearch, Glob
---

# Tutorial Expert (série educacional do @expertintegrado)

Episódio da série de topo de funil da conta da EMPRESA, decidida na reunião de linha editorial
de 09/07/2026. O que define a série:

- **Apresentador fixo:** o influencer de IA da casa (avatar + voz próprios). NUNCA o Eric, nem
  imitação do Eric. A consistência do personagem é o que constrói o hábito.
- **Formato:** 1 pergunta prática real de dono de empresa por episódio, respondida em ~60s.
  Didática, direta, tom de canal de marca. NÃO é réplica dos Insiders do Eric (que nomeiam
  dores e batizam conceitos em 1ª pessoa): aqui se ensina o passo, não se opina.
- **Pauta:** perguntas reais das calls do comercial e da mentoria. A skill irmã
  `pauta-tutorial-expert` garimpa e mantém a fila; com `--da-fila`, pegar a próxima de lá.
- **Critério de corte:** 4-8 semanas de teste; se não gerar alcance/seguidor incremental,
  a série é cortada. Registrar todo episódio (etapa 9) pra essa conta fechar.

## Etapa 0: persona (gate, nada roda sem isso)

A persona vive FORA do plugin (sobrevive a updates) em `C:/MCPs/tutorial-expert-persona.env`:

```
PERSONA_NOME=...            # nome do personagem
SERIE_NOME=...              # ex.: IA no Comercial em 60 Segundos
ELEVEN_VOICE_ID=...         # voz da persona no ElevenLabs
HEYGEN_AVATAR_ID=...        # avatar da persona no HeyGen
VOICE_REF=C:/MCPs/tutorial-expert-voice-ref.wav
CTA_CONTA=@expertintegrado  # o direct que responde a palavra-chave
SUB_STYLE=                  # opcional: linha Style do ASS pro compose_reel (vazio = default)
APROVADA_PELO_ERIC=nao      # sim | nao
```

Modelo em `config/persona.exemplo.env`. Se o arquivo NÃO existir, não invente IDs: guie a
criação (uma coisa por vez, sem gastar crédito sem avisar):

1. **Voz:** listar as vozes da conta (`GET https://api.elevenlabs.io/v1/voices`, header
   `xi-api-key`, chave em `C:/MCPs/elevenlabs.env`), sugerir 2-3 candidatas de estoque
   (pt-BR, tom claro e didático) e deixar o usuário escolher.
2. **Avatar:** listar avatares (`GET https://api.heygen.com/v2/avatars`, header `x-api-key`)
   e escolher um de estoque, ou o usuário cria um no site do HeyGen. Boneco/personagem
   ilustrado fora do HeyGen: ver Edge cases.
3. **Referência de voz do checkpoint:** gerar um TTS de ~30s com a voz escolhida e rodar
   `setup_voice_checker.py --ref <audio>` (script do criar-reel) salvando a saída no caminho
   do `VOICE_REF` (NÃO sobrescrever a referência do Eric).
4. Gravar o `.env`, marcar `APROVADA_PELO_ERIC=nao` e avisar: dá pra produzir PILOTO, mas
   nada vai pro feed sem o Eric validar o formato (pendência registrada na linha editorial).

## Resolução dos scripts do criar-reel

Esta skill chama scripts da pasta irmã `criar-reel` (mesmo plugin):

```bash
SKILLS_DIR=$(ls -d "$HOME/.claude/plugins/cache/expertintegrado/marketing"/*/skills | sort -V | tail -1)
```

Se o caminho não existir (instalação fora do padrão), procurar por glob
`**/criar-reel/scripts/elevenlabs_heygen.py`. Instalação standalone sem `criar-reel`: parar e
avisar (esta skill não funciona sem a irmã).

## Fluxo

### 1. Pauta
- `--da-fila`: abrir `C:/Users/<user>/Downloads/tutorial-expert/fila-pautas.md`, pegar a
  primeira com status `nova` e confirmar com o usuário. Sem fila e sem pauta no pedido:
  perguntar a pergunta do episódio (ou sugerir rodar `/pauta-tutorial-expert` antes).
- Conferir fatos como no criar-reel: preço, nome de ferramenta, número citado. Nunca inventar
  dado. Número de case só com autorização já validada (na dúvida, falar "um cliente da Expert"
  sem nome nem número).
- Checar no registro (`Downloads/tutorial-expert/registro-episodios.md`) se a pergunta já foi
  respondida em episódio anterior; se sim, avisar e só seguir com ângulo genuinamente novo.

### 2. Roteiro (voz do CANAL, não do Eric)
Ler `references/tom-canal-expert.md` antes. Estrutura fixa do episódio (~9-12 cenas de 1-2
frases em `cenas.txt`, uma por linha):

1. **Hook = a pergunta**, dita como o dono fala (ex.: "IA responde meu WhatsApp sozinha?").
2. **Resposta direta em 1 frase** (sim/não/depende + o porquê em linguagem simples).
3. **O passo a passo**: 2-3 passos concretos, cada um com o que fazer e o que esperar.
4. **Prova rápida**: um dado ou exemplo real (anonimizado) que ancora a resposta.
5. **CTA de palavra-chave**: "comenta X que o material chega no seu direct". Palavra única,
   repetida 1x antes do fim. CTA orgânico SEMPRE ("comenta X"), nunca "link na bio".

Regras duras (reprovam o roteiro): soma de `cenas.txt` entre 900-980 caracteres (`wc -c`);
"você/seu", nunca "tu/teu"; sem travessão; sem sequência de frases picotadas; sem
"revolucionário", "game-changer", "transformador", "disruptivo"; pronúncia fonética no
`cenas.txt` como no criar-reel ("CLÁUDI", termos em inglês por extenso, "repositório" no
lugar de "GitHub"); a legenda mostra a grafia certa.

### 2.5 Gate de orçamento
`python "$SKILLS_DIR/criar-reel/scripts/simular_custo.py" --cenas-file <ep>/cenas.txt --clips <N> --clips-kling 0`
Mostrar o custo e só seguir depois do "prosseguir? (s/n)" aprovado.

### 3. Fala (pré-voo + produção, com a VOZ DA PERSONA)
- Pré-voo obrigatório:
  `python "$SKILLS_DIR/criar-reel/scripts/preflight_voz.py" <ep>/cenas.txt --voice $ELEVEN_VOICE_ID --block-seconds 12 --transcrever`
  Mesmas regras do criar-reel: bloco reprovado = reescrever a frase; atrator resistente =
  mudar o corte das cenas.
- Produção:
  `python "$SKILLS_DIR/criar-reel/scripts/elevenlabs_heygen.py" --scenes-file cenas.txt --out-dir <ep>/heygen --block-seconds 12 --avatar $HEYGEN_AVATAR_ID --eleven-voice $ELEVEN_VOICE_ID --voice-ref $VOICE_REF --final persona-green.mp4`
- PROIBIDO `--no-voice-check` pra contornar reprovação real (mesma regra da casa). Se o
  `VOICE_REF` da persona ainda não existe, é setup incompleto: voltar à Etapa 0, passo 3.
- A calibração de ~17,5 chars/s foi medida na voz do Eric; voz nova pode variar. No primeiro
  episódio, conferir a duração real e anotar no registro se a faixa 900-980 precisar de ajuste.

### 4. SRT + gate de português
Igual ao criar-reel: `gerar_srt.py` no vídeo da fala, revisar termos, e
`PYTHONUTF8=1 python "$SKILLS_DIR/criar-reel/scripts/checar_srt.py" <arquivo>.srt <ep>/cenas.txt`
até sair "LEGENDA OK". Composição só com o gate verde.

### 5. B-rolls: banco primeiro, Kling só nos gaps
Mesmo processo do criar-reel etapa 6 (`broll_bank.py --list/--get`, manifest Kling pros
gaps, figuras sempre vestidas). N de B-rolls = ceil(duração ÷ 5).

### 6. Composição
`python "$SKILLS_DIR/criar-reel/scripts/compose_reel.py" --avatar <fala> --brolls-dir <ep> --srt <corrigido>.srt --out video-final-<slug>.mp4`
Se `SUB_STYLE` estiver preenchido na persona, passar `--sub-style "$SUB_STYLE"`. Conferir 3
frames (início/meio/fim) com `Read` antes de entregar.

### 7. Thumb (identidade da CONTA da Expert)
Via `openai_image.py`: fotográfico/ilustrado limpo, acento AZUL da marca Expert (#4A90E2) no
lugar do âmbar do perfil do Eric, headline branca caixa alta com a PERGUNTA encurtada (3-4
palavras) + pill com a palavra do CTA. Português com acentuação correta, letra por letra.
Salvar `<ep>/thumb-<slug>.png` e conferir com `Read`.

### 8. Legenda de post
`<ep>/legenda-post.md`: ângulo diferente do roteiro (não replicar a fala), sem
asterisco/markdown, máximo 5 hashtags, sem travessão, CTA "comenta X". Rodapé: palavra do
CTA + variantes pro ManyChat + lembrete de que quem responde é o direct da conta
`$CTA_CONTA`. Material prometido no CTA: publicar na Biblioteca via MCP `biblioteca`
(mesma etapa 9 do criar-reel) ou entregar direto no ManyChat; decidir com o usuário.

### 9. Registro e manifest (régua "baixar e publicar")
- Acrescentar a linha do episódio em `Downloads/tutorial-expert/registro-episodios.md`:
  data, slug, pergunta, palavra do CTA, custo, e depois (manual) alcance/seguidores.
  Este registro é a base da revisão de 4-8 semanas do critério de corte.
- Escrever `<ep>/manifest-revisao.md`: pergunta respondida, duração, custo, o que conferir
  antes de postar (3 frames, thumb, legenda) e o passo a passo de publicação. Quem publica
  revisa por ele, sem assistir tudo.
- NÃO usar o `registro_reels.py` do perfil do Eric: contas separadas, registros separados.

## Checklist final (pular item = entrega incompleta)
1. Persona carregada do `.env` (nunca ID hardcoded na conversa).
2. Vídeo validado em 3 frames + gate de português VERDE.
3. Thumb conferida letra a letra, acento azul da marca.
4. legenda-post.md com rodapé de CTA/ManyChat.
5. registro-episodios.md atualizado.
6. manifest-revisao.md escrito.
7. Se `APROVADA_PELO_ERIC=nao`: marcar o episódio como PILOTO no manifest e avisar que não
   vai pro feed sem validação do Eric.

## Saídas
`C:/Users/<user>/Downloads/tutorial-expert/<AAAA-MM-DD>-<slug>/` com `cenas.txt`,
`roteiro.md`, `heygen/`, clips, SRT/ASS, `video-final-*.mp4`, `thumb-*.png`,
`legenda-post.md`, `manifest-revisao.md`.

## Edge cases
- **Persona ainda não existe:** rodar só a Etapa 0 e parar. Não produzir com a voz/avatar
  do Eric "só pra testar": quebra a premissa da série.
- **Eric escolheu boneco ilustrado fora do HeyGen:** o lip-sync do pipeline não cobre;
  avisar que precisa de adaptação (ex.: HeyGen photo avatar do personagem, ou outro motor)
  antes de prometer episódio.
- **Crédito HeyGen/ElevenLabs:** mesmos avisos do criar-reel (`MOVIO_PAYMENT_INSUFFICIENT_CREDIT`
  = saldo de API separado da assinatura).
- **Crash no meio do lote:** re-rodar o mesmo comando retoma via `jobs.json`, igual ao criar-reel.

## Skills relacionadas
- `pauta-tutorial-expert`: garimpa as perguntas e mantém a fila desta série.
- `criar-reel`: dona dos scripts que esta skill reusa (não duplicar código).
- `gerar-srt`: legenda da tela (etapa 4).
