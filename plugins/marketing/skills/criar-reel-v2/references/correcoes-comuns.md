# Correções comuns de ASR (Whisper) no nicho do Eric

O Whisper transcreve bem português, mas erra **termos técnicos e nomes em inglês**. O script
`gerar_srt.py` já corrige os de alta confiança automaticamente; esta lista guia a revisão final
(a que o Claude faz lendo o .srt com o contexto do vídeo).

## Corrigidos automaticamente pelo script
- "cloud" / "clod" / "claud" / "claudi" → **Claude**
- "chat gpt" → **ChatGPT** · "git hub" → **GitHub** · "you tube" → **YouTube** · "linked in" → **LinkedIn**
- "mcp" → **MCP** · "api" → **API** · "ia" → **IA** · "pdf" → **PDF** (uppercase)

## Revisar SEMPRE no contexto (o script só sinaliza, não troca)
- **Markdown vs MarkItDown:** "Markdown" é o *formato*; "MarkItDown" é a *ferramenta da Microsoft*.
  O Whisper quase sempre escreve "Markdown" para os dois. Decidir pelo contexto da frase:
  - "a ferramenta chama ___" → MarkItDown
  - "converte em ___ limpo" / "entende ___" → Markdown (formato)
  - palavra-CTA "comenta ___" → conferir qual palavra o Eric escolheu no roteiro.
- **Nomes de produto/marca:** Fable 5, Opus, Anthropic, Expert Integrado, Nano Banana, Kling,
  Super SDR, ChatGuru — conferir grafia e maiúsculas.
- **Números e claims:** confirmar que bateu o número certo (ex: "140 mil estrelas", "70%", preços).

## Quebra de linha / leitura
- Segmentos muito longos (uma frase de 5s+ numa linha só) podem ser quebrados pra leitura no Reels,
  mas para importar no CapCut o SRT por frase já funciona (o CapCut re-segmenta no estilo escolhido).

## Como aplicar a revisão
Depois de rodar `gerar_srt.py`, ler o .srt resultante e usar `Edit` para corrigir os termos
sinalizados em "REVISAR:". Confirmar contra o roteiro original quando houver dúvida.
