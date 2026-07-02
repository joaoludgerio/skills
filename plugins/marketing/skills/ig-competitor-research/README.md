# /ig-competitor-research — Pesquisa de conteúdo viral dos concorrentes no Instagram

> Descobre o que está bombando no Instagram do seu nicho e entrega um relatório pronto com os posts de maior performance, explicando hook, formato e por que cada um viralizou.

## O que faz

Olha os perfis de concorrentes (ou referências) que você indicar, pega os posts que mais performaram nos últimos dias, transcreve os Reels, analisa o visual de cada post e monta um **relatório HTML** organizado. O objetivo é simples: descobrir quais tópicos, formatos e ganchos já estão funcionando no seu nicho para você copiar/adaptar nas suas próprias publicações — em vez de chutar pauta.

Em vez de comparar curtidas brutas, a skill usa um **outlier score**: o quanto cada post superou a mediana daquele próprio perfil. Assim, um post que explodiu num perfil pequeno aparece no topo mesmo tendo menos curtidas que um post mediano de um perfil grande.

## Quando usar

Peça em linguagem natural, por exemplo:

- "Roda o IG competitor research nesses perfis: @perfil1 @perfil2 @perfil3"
- "O que tá viralizando no nicho de IA essa semana?"
- "Analisa esses perfis aqui e me diz que tipo de conteúdo tá performando"
- "Preciso de ideias de Reels baseadas no que já funciona no nosso mercado"
- "Faz uma pesquisa de concorrentes no Instagram"

## O que você precisa dar

Os **@ dos perfis** que quer analisar. Há duas formas:

1. **Direto no pedido:** mande os handles na conversa (ex: `@perfil1 @perfil2`).
2. **Lista fixa:** edite o arquivo `competitors.txt` na pasta da skill — **1 @ por linha**. Linhas começando com `#` são ignoradas (comentários). Quando você roda sem passar nenhum @, a skill lê essa lista automaticamente. É a forma prática de deixar o seu nicho "salvo" e rodar a pesquisa toda semana sem digitar os perfis de novo.

Se você não passar nenhum @ e o `competitors.txt` estiver vazio, a skill vai pedir os perfis.

Opcional, você pode ajustar:
- janela de dias analisados (padrão: 7 dias);
- quantos posts no total entram no relatório (padrão: 15);
- modo rápido, sem transcrição (só capa + métricas — bem mais veloz).

## O que ela entrega

Um **relatório HTML** (`report.html`) que abre direto no navegador, com tema escuro, imagens embutidas e transcrição copiável. Para cada post de destaque, o relatório traz:

- **Hook** — a primeira frase/promessa que segura o espectador;
- **Formato** — o tipo de conteúdo (ex: "Talking head + B-roll", "Carrossel listicle", "Tutorial de tela");
- **Por que viralizou** — o gatilho psicológico por trás (curiosidade, autoridade, prova social, contraste...);
- **Notas visuais** — o que a imagem mostra e por que prende o olhar;
- **Transcrição** do áudio do Reel e a legenda original.

No fim, a skill resume os 3 tópicos/formatos que mais se repetem e que valem a pena testar, e pode brainstormar pautas com você a partir do relatório.

## Como funciona (passo a passo resumido)

1. **Coleta + ranking + transcrição (automático):** um script busca os posts dos perfis via Apify, filtra os da janela de dias, calcula o engajamento e o outlier score, separa os melhores, baixa as capas e — para os Reels — baixa o vídeo, extrai o áudio e transcreve com o Whisper.
2. **Análise visual (o Claude faz):** o Claude lê a capa, a transcrição e a legenda de cada post e escreve hook, formato, por que viralizou e notas visuais, em português.
3. **Geração do relatório (automático):** um segundo script junta tudo e gera o `report.html`, abrindo no navegador.
4. **Entrega:** o Claude te aponta o caminho do relatório, destaca os padrões que mais aparecem e oferece ajuda pra transformar isso em pauta.

## Integrações e ferramentas

- **Apify** — serviço que faz a coleta (scraping) dos perfis do Instagram. Usa o ator `instagram-profile-scraper`.
- **Whisper (OpenAI, versão local)** — transcreve o áudio dos Reels. Roda na sua máquina, sem custo por uso.
- **FFmpeg** — extrai o áudio dos vídeos para a transcrição.
- **Python 3** — roda os scripts da skill.

## Pré-requisitos

- **Python 3** instalado.
- **FFmpeg** disponível no PATH.
- **Bibliotecas Python:** `openai-whisper` (instalação: `pip install -U openai-whisper`).
- **Token do Apify** configurado na variável de ambiente `APIFY_TOKEN` (crie a conta gratuita no Apify e gere o token nas configurações de API). *Não há nenhuma chave salva neste repositório — você precisa configurar a sua.*

> **Custo:** a coleta no Apify sai por volta de US$ 0,10–0,15 por pesquisa, o que cabe no plano gratuito de US$ 5/mês. O Whisper roda local, de graça. Na prática, o único custo recorrente é a assinatura do Claude.

## Dicas e observações

- **Rode toda semana** com a lista do `competitors.txt` para acompanhar tendências do nicho ao longo do tempo.
- **Pressa?** Use o modo sem transcrição: ele entrega capa + métricas muito mais rápido, sem baixar e transcrever os vídeos.
- **Não apareceu post nenhum?** Provavelmente a janela de dias está curta para aquele período — aumente o número de dias.
- **Perfil privado ou inexistente** é simplesmente ignorado; a pesquisa segue com os demais perfis.
- **Reels longos:** a skill transcreve só os primeiros minutos (padrão 120s), porque o gancho e o miolo do conteúdo quase sempre estão no começo.
- **Atendendo vários clientes/nichos:** rode uma conversa separada para cada um, com os perfis daquele cliente.
- Depois de gerar o relatório, jogar o HTML de volta no chat ajuda o Claude a "entrar no clima" do que está funcionando no nicho e sugerir pautas mais afiadas.
