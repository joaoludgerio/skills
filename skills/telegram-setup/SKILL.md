---
name: telegram-setup
description: Guia de instalacao e configuracao do Telegram conectado ao Claude Code com suporte a audio via Whisper local. TRIGGER quando o usuario pedir para configurar Telegram, conectar bot ao Claude Code, instalar suporte a voz, ou seguir o guia de setup do Telegram.
---

# Configuracao do Telegram no Claude Code

Guia para conectar seu bot do Telegram ao Claude Code e habilitar transcricao de audio usando o Whisper ja instalado pelo Voice AI.

---

## Pre-requisitos

- Claude Code instalado e funcionando
- Voice AI instalado no computador (fornece o Whisper local)
- VS Code com terminal integrado (Ctrl + ')

---

## Etapa 1: Criar o bot no Telegram

1. Abra o Telegram e busque por **@BotFather**
2. Envie `/newbot`
3. Escolha um nome para o bot (ex: `Joao Claude Bot`)
4. Escolha um username (deve terminar em `bot`, ex: `joao_claude_bot`)
5. Copie o token gerado — formato: `1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Etapa 2: Configurar o token no Claude Code

Abra o Claude Code e rode:

```
/telegram:configure SEU_TOKEN_AQUI
```

Substituir `SEU_TOKEN_AQUI` pelo token copiado do BotFather.

---

## Etapa 3: Iniciar o Claude Code com o canal Telegram

Feche o terminal e reabra. No terminal integrado do VS Code, rode:

```
claude --channels plugin:telegram@claude-plugins-official
```

**Importante:** nao basta abrir o Claude Code normalmente — precisa passar o parametro `--channels` para ativar o canal do Telegram.

---

## Etapa 4: Autorizar o primeiro acesso

Na primeira mensagem recebida via Telegram, o Claude Code vai pedir permissao para responder.

- Selecionar **"Yes, and don't ask again"**

Se nao fizer isso, o bot vai travar em todas as mensagens subsequentes.

---

## Etapa 5: Habilitar transcricao de audio

Por padrao, o Claude Code nao sabe transcrever audios. Para habilitar, e preciso apontar para o Whisper que ja esta instalado pelo Voice AI.

### Localizar o Whisper

O Whisper instalado pelo Voice AI fica em:

```
C:\Users\SEU_USUARIO\AppData\Local\Python\pythoncore-3.14-64\Scripts\whisper.exe
```

Substituir `SEU_USUARIO` pelo nome do seu usuario do Windows.

Para confirmar, abra o terminal e rode:

```
"C:\Users\SEU_USUARIO\AppData\Local\Python\pythoncore-3.14-64\Scripts\whisper.exe" --help
```

Se aparecer a lista de opcoes, esta funcionando.

**Atencao:** o Whisper nao esta no PATH do sistema — sempre use o caminho completo.

### Como o Claude transcreve o audio

Quando um audio chega pelo Telegram, o Claude Code recebe o arquivo (formato `.oga`) e roda o Whisper automaticamente. Nao e necessaria nenhuma configuracao adicional — o Claude ja sabe usar o executavel pelo caminho completo.

---

## Problemas conhecidos e solucoes (Windows)

### 1. Primeira mensagem funciona, as seguintes nao

O Claude Code pode criar processos duplicados do plugin Telegram que se conflitam.

**Solucao:** antes de iniciar, rodar dentro do Claude Code:

```
!powershell -Command "Get-Process bun -ErrorAction SilentlyContinue | Stop-Process -Force"
```

O prefixo `!` executa comandos shell direto do Claude Code, sem precisar abrir outro terminal.

### 2. Permissao de reply trava na primeira mensagem

Na primeira mensagem recebida, o Claude Code pede permissao para responder no Telegram.

**Solucao:** selecionar **"Yes, and don't ask again"** para nao travar toda vez.

### 3. Sessao precisa ficar aberta

O canal Telegram vive dentro da sessao do Claude Code. Fechou o terminal, o bot para de responder.

### 4. Suporte a 1 bot por instalacao

Nao e possivel conectar dois bots diferentes ao mesmo tempo na mesma instalacao.

### 5. Para resetar e comecar do zero

```
/telegram:configure SEU_TOKEN_AQUI
```

Depois fechar e reabrir com:

```
claude --channels plugin:telegram@claude-plugins-official
```

### 6. Whisper nao encontrado ("comando nao reconhecido")

O Whisper nao esta no PATH. Sempre usar o caminho completo:

```
C:\Users\SEU_USUARIO\AppData\Local\Python\pythoncore-3.14-64\Scripts\whisper.exe
```

---

## Resumo dos comandos

| Acao | Comando |
|------|---------|
| Configurar token | `/telegram:configure TOKEN` |
| Iniciar com Telegram | `claude --channels plugin:telegram@claude-plugins-official` |
| Matar processos duplicados | `!powershell -Command "Get-Process bun -ErrorAction SilentlyContinue | Stop-Process -Force"` |
| Testar Whisper | `"C:\...\whisper.exe" --help` |

---

## Observacoes

- Tudo feito de dentro do VS Code, sem abrir prompt de comando separado
- O terminal integrado do VS Code e ativado com **Ctrl + '**
- Audios chegam no formato `.oga` — o Whisper processa normalmente
- Modelo recomendado: `base` com `--language pt` para portugues
