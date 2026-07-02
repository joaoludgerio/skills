# Correções comuns de ASR (Whisper) no nicho do Eric

O Whisper transcreve bem português, mas erra **termos técnicos e nomes em inglês**. O script
`gerar_srt.py` já corrige os de alta confiança automaticamente; esta lista guia a revisão final
(a que o Claude faz lendo o .srt com o contexto do vídeo).

## Corrigidos automaticamente pelo script
- "claud" / "claudi" / "cláudio" → **Claude**
- "chat gpt" → **ChatGPT** · "git hub" → **GitHub** · "you tube" → **YouTube** · "linked in" → **LinkedIn**
- "mcp" → **MCP** · "api" → **API** · "iá" → **IA** · "pdf" → **PDF** (uppercase)

## Revisar SEMPRE no contexto (o script só sinaliza, não troca)
- **"cloud" / "clod":** quase sempre é o Whisper ouvindo **Claude**, mas "Google Cloud" e
  "cloud computing" são legítimos no nicho, por isso NÃO é troca automática. O script imprime
  o número do bloco; decidir pelo contexto da frase.
- **Markdown vs MarkItDown:** "Markdown" é o *formato*; "MarkItDown" é a *ferramenta da Microsoft*.
  O Whisper quase sempre escreve "Markdown" para os dois. Decidir pelo contexto da frase:
  - "a ferramenta chama ___" → MarkItDown
  - "converte em ___ limpo" / "entende ___" → Markdown (formato)
  - palavra-CTA "comenta ___" → conferir qual palavra o Eric escolheu no roteiro.
- **Nomes de produto/marca:** Fable 5, Opus, Anthropic, Expert Integrado, Nano Banana, Kling,
  Super SDR, ChatGuru (conferir grafia e maiúsculas).
- **Números e claims:** confirmar que bateu o número certo (ex: "140 mil estrelas", "70%", preços).

## Quebra de linha / leitura
- **O padrão é trecho curto (até 4 palavras) colado na fala**, é assim que o `gerar_srt.py` já
  gera (`--words 4`). Frase-bloco parada na tela por vários segundos é o modo antigo, só usar se
  o Eric pedir explicitamente (`--words 0`).
- Legenda nunca leva travessão: usar vírgula ou dois pontos (o `srt_from_text.py` já troca
  automaticamente no Caminho B; no Caminho A o Whisper raramente gera, mas conferir na revisão).

## Como aplicar a revisão
Depois de rodar `gerar_srt.py`, ler o .srt resultante e usar `Edit` para corrigir os termos
sinalizados em "REVISAR:". Confirmar contra o roteiro original quando houver dúvida.
