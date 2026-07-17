---
name: depoimento-expert
description: "Transforma um vídeo BRUTO de depoimento (aluno de imersão, mentorado, cliente de consultoria) num post pronto pro perfil @expertintegrado: acha o melhor trecho de prova social na transcrição, corta, reencadra 9:16, queima a legenda e escreve a legenda de post. É o pilar semanal de depoimentos da linha editorial de 09/07/2026. Usar quando pedirem 'monta o post do depoimento', 'trata esse depoimento', 'depoimento da imersão pro feed', 'roda o depoimento-expert', ou mandarem vídeo de depoimento pedindo post."
argument-hint: "[video-bruto.mp4] [--duracao 30|45|60] [--sem-legenda]"
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Depoimento Expert (pilar P5 do @expertintegrado)

Depoimento é PROVA pra quem chega no perfil em due diligence, não conteúdo de alcance
(métrica declarada da linha editorial: nenhuma). O trabalho aqui é achar o trecho mais
crível do bruto e entregar o pacote "baixar e publicar".

Prioridade editorial: depoimento de COMPRADOR (cliente, mentorado) vale mais que depoimento
de evento. Estoque atual vem das imersões e da rotina de captura (pedir o vídeo no fim da
consultoria/mentoria, com o cliente quente).

## Fluxo

Esta skill reusa o motor da irmã `clipar-video` (mesmo plugin), sem duplicar código:

```bash
SKILLS_DIR=$(ls -d "$HOME/.claude/plugins/cache/expertintegrado/marketing"/*/skills | sort -V | tail -1)
CLIPAR="$SKILLS_DIR/clipar-video/scripts/clipar_video.py"
```

### 1. Transcrever
```bash
python "$CLIPAR" --video "<bruto>" --fase transcricao
```
Copiar a linha `📂 Pasta de saída:` e usar como `--out-dir` no resto. Requer
`OPENAI_API_KEY` em `C:/MCPs/openai.env` (~US$0.006/min).

### 2. Escolher o trecho (VOCÊ escolhe, sem chamada de API)
NÃO rodar a fase `analise` (os critérios dela são de viral; depoimento é outra régua).
Ler o `transcript.json` da pasta de saída e escolher **1 trecho contínuo** de 30-60s
(`--duracao` ajusta o alvo) pelos critérios de prova social, nesta ordem:

1. **Resultado concreto** dito pela pessoa (número, antes/depois, tempo economizado).
2. **Especificidade**: nome do produto/processo, situação real, nada de elogio genérico.
3. **Emoção genuína** (entusiasmo espontâneo, riso, alívio).
4. **Auto-contido**: faz sentido sem o resto da conversa.

Regra inegociável: o corte NUNCA muda o sentido do que a pessoa disse. Não emendar frases
de momentos diferentes, não cortar ressalva que qualifica o elogio.

Escrever a seleção em `<out-dir>/clips_selecionados.json` (mesmo formato da fase analise):
```json
[{"start": <seg>, "end": <seg>, "titulo": "<slug curto>",
  "hook": "<a frase mais forte do trecho>", "score": 10.0}]
```

### 3. Cortar
```bash
python "$CLIPAR" --video "<bruto>" --fase cortar --out-dir "<pasta>" --formato 9:16 --estilo-legenda padrao
```
Legenda branca (estilo `padrao`): o amarelo é assinatura do perfil do Eric, depoimento é da
conta da empresa. `--sem-legenda` no pedido = passar sem queimar e entregar só o .srt.
Pessoa fora do centro no bruto 16:9: `--crop-side esquerda|direita` (mesma regra da irmã).
Revisar o .srt do trecho (nome do produto, acentuação) ANTES de dar por pronto; legenda
queimada com termo errado = re-cortar o clipe.

### 4. Legenda de post
`legenda-post.md` na pasta: 2-4 linhas apresentando quem é a pessoa (primeiro nome +
segmento, ex.: "a Dra. Ana, de clínica odontológica") e o contexto (imersão, mentoria,
consultoria), SEM repetir a fala do vídeo. Regras: sem asterisco/markdown, máximo 5
hashtags, sem travessão, sem palavras proibidas ("revolucionário", "game-changer",
"transformador", "disruptivo"). Marcar o @ericluciano no post (decisão de 09/07; reavaliar
com o tempo). CTA leve ou nenhum: depoimento é prova, não peça de conversão agressiva.

**Consentimento:** confirmar com quem pediu que a pessoa autorizou o uso da imagem. Sem
confirmação, entregar o pacote marcado como AGUARDANDO AUTORIZAÇÃO no manifest.

### 5. Entregar (régua "baixar e publicar")
Mover/copiar pra `Downloads/funil-depoimentos/<AAAA-MM-DD>-<primeiro-nome>/` com:
- `clip-01-*.mp4` (final 9:16 legendado) + `.srt`
- `legenda-post.md`
- `manifest-revisao.md`: quem é, contexto, trecho escolhido (timestamps), status de
  autorização, e o lembrete de marcar o @ericluciano.

## Edge cases
- **Bruto com mais de um depoimento forte:** avisar e oferecer cortar os extras (repetir as
  etapas 2-3 com outro `clips_selecionados.json`; guardar cada um em pasta própria).
- **Áudio ruim (vento, música alta):** avisar antes de cortar; legenda queimada vira
  obrigatória (é o que salva a compreensão).
- **Depoimento em selfie vertical:** já é 9:16, o reencadre vira no-op; só conferir enquadre.
- **Vídeo muito curto (<20s):** usar inteiro, sem escolha de trecho; seguir do passo 3.

## Skills relacionadas
- `clipar-video`: dona do motor (transcrição, corte, reencadre, legenda).
- `tutorial-expert` / `pauta-tutorial-expert`: os outros pilares automatizados da conta.
