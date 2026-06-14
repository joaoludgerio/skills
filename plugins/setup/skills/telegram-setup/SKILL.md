---
name: telegram-setup
description: Use quando o usuario quiser conectar um bot do Telegram ao Claude Code, configurar o canal Telegram, parear/dar acesso ao bot, habilitar transcricao de audio (voz) via Whisper local, ou resolver problemas em que o bot do Telegram para de responder. TRIGGER quando pedir "configurar Telegram", "conectar bot ao Claude Code", "criar bot no BotFather", "instalar suporte a voz/audio no Telegram", "transcrever audio do Telegram", "meu bot do Telegram parou de responder", ou "seguir o guia de setup do Telegram".
version: 0.1.0
---

# Configuracao do Telegram no Claude Code

Guia para conectar seu bot do Telegram ao Claude Code e habilitar transcricao de audio usando o Whisper ja instalado pelo Voice AI.

## Pre-requisitos

Antes de comecar, verificar:

- [ ] Claude Code instalado e funcionando
- [ ] Voice AI instalado no computador (fornece o Whisper local)
- [ ] Bun instalado (o servidor MCP do plugin Telegram roda em Bun — sem ele o canal nao conecta)
- [ ] VS Code com terminal integrado (Ctrl + ')
- [ ] Telegram instalado no celular ou desktop
- [ ] Acesso ao @BotFather no Telegram

### Instalar o Bun (se ainda nao tiver)

O plugin oficial do Telegram roda o servidor MCP em Bun. Confirme se ja esta instalado rodando `bun --version` no terminal. Se nao estiver, instale:

```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

Feche e reabra o terminal depois de instalar.

## Etapa 1: Criar o bot no Telegram

1. Abra o Telegram e busque por **@BotFather**
2. Envie `/newbot`
3. Escolha um nome para o bot (ex: `Joao Claude Bot`)
4. Escolha um username (deve terminar em `bot`, ex: `joao_claude_bot`)
5. Copie o token gerado — formato: `1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Etapa 2: Instalar o plugin do Telegram

Abra o Claude Code (rode `claude` no terminal) e instale o plugin oficial:

```bash
/plugin install telegram@claude-plugins-official
/reload-plugins
```

Sem o plugin instalado os comandos `/telegram:configure` e `/telegram:access` nao existem.

## Etapa 3: Configurar o token no Claude Code

Ainda no Claude Code, rode:

```bash
/telegram:configure SEU_TOKEN_AQUI
```

Substituir `SEU_TOKEN_AQUI` pelo token copiado do BotFather. Isso grava o token em `~/.claude/channels/telegram/.env`. Como o servidor le esse arquivo so na inicializacao, a troca de token so vale apos reiniciar a sessao (proxima etapa).

## Etapa 4: Iniciar o Claude Code com o canal Telegram

Feche o terminal e reabra. No terminal integrado do VS Code, rode:

```bash
claude --channels plugin:telegram@claude-plugins-official
```

**Importante:** nao basta abrir o Claude Code normalmente — precisa passar o parametro `--channels` para ativar o canal do Telegram.

## Etapa 5: Parear sua conta do Telegram

1. No Telegram, abra o chat com o bot que voce criou
2. Envie qualquer mensagem (ex: `oi`)
3. O bot vai responder com um codigo de 6 caracteres
4. No Claude Code, rode:

```bash
/telegram:access pair CODIGO_AQUI
```

5. O bot confirma que voce foi aprovado e a proxima mensagem ja chega no Claude.

### Travar o acesso (recomendado)

A politica padrao e `pairing`: qualquer pessoa que descobrir o username do bot recebe um codigo de pareamento. Depois de parear sua conta (e a de quem mais precisar), troque para `allowlist` para que estranhos nao recebam mais codigos:

```bash
/telegram:access policy allowlist
```

Em `allowlist` o bot ignora silenciosamente quem nao estiver na lista. Para adicionar alguem novo depois, volte para `pairing` temporariamente, pareie a pessoa e trave de novo.

## Etapa 6: Autorizar o primeiro acesso

Na primeira mensagem recebida via Telegram, o Claude Code vai pedir permissao para responder.

- Selecionar **"Yes, and don't ask again"**

Se nao fizer isso, o bot vai travar em todas as mensagens subsequentes.

## Etapa 7: Habilitar transcricao de audio

Por padrao, o Claude Code nao transcreve audios automaticamente. Para habilitar, e preciso usar o Python instalado junto com o Voice AI, que ja tem o Whisper disponivel.

### Localizar o Python com Whisper

O Python com Whisper instalado pelo Voice AI fica em:

```plaintext
C:\Users\SEU_USUARIO\AppData\Local\Python\bin\python.exe
```

Substituir `SEU_USUARIO` pelo nome do seu usuario do Windows (ex: `Eric Luciano`).

Para confirmar, abra o terminal do Claude Code e rode:

```bash
!"C:\Users\SEU_USUARIO\AppData\Local\Python\bin\python.exe" -c "import whisper; print('ok')"
```

Se aparecer `ok`, esta funcionando.

**Atencao:** o Python nao esta no PATH do sistema — sempre use o caminho completo.

### Como o Claude transcreve o audio

Quando um audio chega pelo Telegram, o Claude Code recebe o arquivo `.oga` e usa o Python para transcrever. O comando que o Claude usa internamente e:

```python
import whisper
model = whisper.load_model('base')
path = r'C:\Users\SEU_USUARIO\.claude\channels\telegram\inbox\nome-do-arquivo.oga'
result = model.transcribe(path, language='pt')
print(result['text'])
```

**Regra critica sobre caminhos:** o arquivo de audio DEVE ser passado com caminho Windows (`C:\...`), nunca Unix (`/c/...`). O ffmpeg — chamado internamente pelo Whisper — nao reconhece caminhos no formato Unix no Windows. Usar sempre raw string `r'...'` para evitar problemas com barras invertidas.

Modelo recomendado: `base` com `language='pt'` para portugues.

## Troubleshooting

### Bot nao responde apos a primeira mensagem

- **Sintoma:** primeira mensagem funciona, as seguintes ficam sem resposta ou aparece "typing" e para
- **Causa:** Claude Code cria processos duplicados do plugin Telegram que se conflitam
- **Fix:** antes de iniciar, rodar dentro do Claude Code:

```powershell
!powershell -Command "Get-Process bun -ErrorAction SilentlyContinue | Stop-Process -Force"
```

O prefixo `!` executa comandos shell direto do Claude Code, sem precisar abrir outro terminal.
Depois reiniciar com `claude --channels plugin:telegram@claude-plugins-official`.

### Permissao de reply trava toda vez

- **Sintoma:** Claude Code pede permissao a cada mensagem
- **Causa:** selecionou "Yes" em vez de "Yes, and don't ask again"
- **Fix:** fechar e reabrir o Claude Code com `--channels`. Na proxima mensagem, selecionar a opcao 2.

### Audio chega mas nao e transcrito

- **Sintoma:** audio chega, Claude recebe o arquivo, mas nao transcreve ou da erro
- **Causa 1:** Python nao esta no PATH — precisa usar o caminho completo
- **Causa 2 (mais comum):** o caminho do arquivo de audio esta no formato Unix (`/c/Users/...`) em vez de Windows (`C:\Users\...`) — o ffmpeg nao entende formato Unix no Windows
- **Fix:** garantir que o Claude use o Python pelo caminho completo E passe o path do audio no formato Windows com raw string:

```bash
!"C:\Users\SEU_USUARIO\AppData\Local\Python\bin\python.exe" -c "import whisper; model = whisper.load_model('base'); result = model.transcribe(r'C:\caminho\do\arquivo.oga', language='pt'); print(result['text'])"
```

### Bot parou de responder do nada

- **Sintoma:** bot funcionava e parou
- **Causa:** o terminal do Claude Code foi fechado ou a sessao expirou
- **Fix:** reabrir o terminal e rodar novamente:

```bash
claude --channels plugin:telegram@claude-plugins-official
```

## Referencia rapida

| Acao | Comando | Notas |
|------|---------|-------|
| Instalar plugin | `/plugin install telegram@claude-plugins-official` + `/reload-plugins` | Uma vez. Sem isso os comandos `/telegram:*` nao existem. |
| Configurar token | `/telegram:configure TOKEN` | Rodar dentro do Claude Code. Token vem do BotFather. |
| Iniciar com Telegram | `claude --channels plugin:telegram@claude-plugins-official` | Obrigatorio toda vez que abrir o Claude Code. |
| Parear conta | `/telegram:access pair CODIGO` | Codigo de 6 chars aparece no chat do bot. |
| Travar acesso | `/telegram:access policy allowlist` | Apos parear, bloqueia estranhos de receber codigos. |
| Matar processos duplicados | `!powershell -Command "Get-Process bun -ErrorAction SilentlyContinue \| Stop-Process -Force"` | Usar se o bot parar de responder. |
| Testar Python/Whisper | `!"C:\Users\SEU_USUARIO\AppData\Local\Python\bin\python.exe" -c "import whisper; print('ok')"` | Verificar se o Python com Whisper esta acessivel. |
| Resetar tudo | `/telegram:configure TOKEN` + reiniciar | Limpa config e reconfigura. |

## Limitacoes

- Suporte a **1 bot por instalacao** — nao e possivel conectar dois bots simultaneamente
- A sessao do Claude Code **precisa ficar aberta** — fechou o terminal, o bot para
- Funciona apenas no **Claude Code (CLI)**, nao no Claude Desktop
- Bug conhecido no Windows (marco 2026): processos duplicados do Bun. PRs de correcao em andamento no repositorio oficial.

## Proximos passos

Apos configurar:

1. **Controle de acesso:** usar `/telegram:access` para gerenciar quem pode usar o bot
2. **Testar audio:** envie um audio de voz pelo Telegram e verifique se a transcricao funciona
3. **Troubleshooting avancado:** logs de erro ficam em `~/.claude/logs/`

## REGRAS

1. **Todos os textos em portugues brasileiro** com acentuacao correta
2. **Sem emojis** a menos que o usuario peca
3. **Tom acolhedor mas direto** — lembrar que podem ser pessoas nao tecnicas
4. **Tudo pelo VS Code** — evitar pedir que o usuario abra prompt de comando separado
5. **Caminhos Windows** — usar formato Windows com `\` nos exemplos
6. **Nao incluir tokens reais** nos exemplos — sempre usar placeholders
