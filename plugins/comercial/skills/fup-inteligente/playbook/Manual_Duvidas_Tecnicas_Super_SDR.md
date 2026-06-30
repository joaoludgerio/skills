
SUPER SDR
Manual de Dúvidas Técnicas
& FAQ Completo para Equipe Comercial

Expert Integrado
Documento Interno — Confidencial
Fevereiro 2026

# Índice

| SEÇÃO 1 — ARQUITETURA E FUNCIONAMENTO DA IA |
| --- |


| 1.1. Como a IA personaliza as mensagens? Ela usa um modelo genérico? |
| --- |

Não. Todo o projeto é 100% personalizado. A Expert Integrado realiza o treinamento do prompt e da base de conhecimento utilizando materiais enviados pelo próprio cliente: históricos de conversas, playbooks, descrições de produto, regras comerciais e tudo que for relevante para o processo.
Por isso a IA sabe responder com propriedade: tanto o prompt quanto a base de conhecimento são alimentados com informações exclusivas de cada cliente.
|  | Dica para o vendedor Quando o prospect perguntar 'mas a IA é genérica?', responda: 'Não, cada projeto passa por um treinamento completo com os seus materiais. É como se contratasse um SDR e treinasse ele com o seu playbook — só que em 5 dias.' |
| --- | --- |


| 1.2. Qual a diferença entre o agente inbound e outbound? |
| --- |

Tecnicamente, não existem IAs diferentes. É o mesmo agente. A única coisa que muda é o gatilho de ativação (como a conversa começa).
| Tipo | Gatilho | Como funciona |
| --- | --- | --- |
| Inbound | Formulário / WhatsApp / Instagram | Lead preenche formulário → integra com CRM → webhook dispara o Super SDR |
| Outbound | CRM (mover card) | Usuário move leads para etapa-gatilho no CRM → Super SDR inicia prospecção |
| Manual | Botão na plataforma | Usuário adiciona conversa manualmente e aperta play |

Depois que a conversa começa, o comportamento da IA é idêntico em todos os casos.

| 1.3. Cada agente pode fazer mais de um processo? Pode ter ramificações? |
| --- |

Não. Cada agente segue uma única lógica: um prompt, uma estrutura, uma integração, um funil, um conjunto de campos de CRM. Ele interage sempre da mesma forma, de acordo com a situação em que chega.
Se o cliente precisa de processos diferentes (ex.: qualificação de produto A vs. produto B, ou pré-vendas vs. pós-vendas), são necessários agentes diferentes.
|  | Ponto importante Inbound e outbound NÃO precisam de agentes separados, porque o processo é o mesmo — só o gatilho muda. Agentes diferentes só são necessários quando a árvore decisória, as perguntas ou os campos de CRM são diferentes. |
| --- | --- |


| 1.4. Até onde vai a memória da IA? Ela se lembra de conversas antigas? |
| --- |

Sim. A IA possui uma janela de contexto praticamente ilimitada para uso prático. Não há expiração por tempo — somente por volume extremo de mensagens na mesma conversa.
Na prática, se a conversa ficar extremamente longa (muitas páginas de texto), ela pode começar a esquecer o que foi dito lá no início. Isso raramente acontece em conversas de pré-vendas, que normalmente duram de 1 a 5 dias.
|  | Para o vendedor Se o prospect perguntar 'mas ela lembra o que eu falei semana passada?', a resposta é sim. A IA mantém todo o histórico da conversa. |
| --- | --- |


| 1.5. O que acontece quando a IA não sabe responder? |
| --- |

O comportamento é configurável na implementação. As opções incluem:
| Comportamento | Descrição |
| --- | --- |
| Informar que não sabe | A IA comunica educadamente que não tem a informação |
| Direcionar para site/link | A IA envia um link específico para o lead buscar a informação |
| Handoff para humano | A IA transfere a conversa para um vendedor humano no momento certo |

Existe um gatilho de confiança que aciona a transferência quando necessário. O vendedor é notificado dentro do Super SDR e, dependendo da ferramenta de WhatsApp integrada, também pode receber notificação na ferramenta.
|  | Contexto importante O Super SDR é uma ferramenta integrada ao CRM e à ferramenta de WhatsApp do cliente. A forma de trabalhar depende das ferramentas que ele já usa — a gente se adapta ao ecossistema dele. |
| --- | --- |


| 1.6. A IA aprende sozinha com as conversas ou precisa de retreinamento manual? |
| --- |

A IA não aprende automaticamente com as conversas. O retreinamento é feito manualmente pela equipe da Expert Integrado ou pelo próprio cliente (na base de conhecimento).
Existe um roadmap para uma funcionalidade futura: quando a IA detectar que não soube responder algo, vai aparecer um aviso no sistema. O usuário humano poderá clicar, fornecer a resposta correta, e essa informação será incorporada ao sistema.
|  | Protocolo de segurança A razão de não ter aprendizado automático é segurança. Se a IA aprendesse sozinha, um humano poderia praticar prompt injection — inserir informações falsas que a IA passaria a repetir. Por isso todo treinamento passa por validação humana. |
| --- | --- |

A base de conhecimento pode ser atualizada pelo próprio cliente a qualquer momento: basta acessar a seção de base de conhecimento no Super SDR e fazer upload de documentos novos.

| 1.7. Qual modelo de LLM o Super SDR utiliza? |
| --- |

Por padrão, o Super SDR utiliza os melhores modelos disponíveis do Google (Gemini) ou da OpenAI — a escolha é feita internamente pela equipe técnica da Expert Integrado.
O cliente não precisa se preocupar com isso:
• Não tem custo adicional de LLM
• Não precisa contratar ChatGPT, Gemini ou qualquer outro serviço
• Todo o custo de LLM é interno da Expert Integrado
Em alguns planos, existe a opção de upgrade de LLM: modelos mais caros e mais potentes, com um custo adicional pós-pago por lead. Esse upgrade pode ser ligado e desligado a qualquer momento.
|  | Quando recomendar o upgrade? Só faz diferença em processos muito complexos — muitas variáveis, playbook muito grande, descrição de produtos com muito detalhe e muitas regras. Para processos comuns, as LLMs padrão funcionam perfeitamente. |
| --- | --- |


| 1.8. A IA se identifica como IA? Como configurar isso? |
| --- |

O cliente escolhe na implementação. Nossa recomendação é:
| Cenário | Recomendação | Motivo |
| --- | --- | --- |
| IA inicia a conversa | Não se identificar como IA | Dizer logo que é IA diminui conversão — leads assumem experiência ruim |
| Lead pergunta se é IA | Admitir que sim | Mentir pode gerar reclamação (Reclame Aqui) e prejudicar a marca |

A IA pode ser configurada para responder de forma natural: 'Sou uma assistente virtual treinada especificamente para atender você' ou similar.


| SEÇÃO 2 — CANAIS E INTEGRAÇÕES |
| --- |


| 2.1. Quais CRMs são integrados nativamente? |
| --- |

A lista completa e atualizada está disponível em lp.supersdr.com.br ou planos.supersdr.com.br.
Integração nativa significa que dentro do próprio Super SDR já existe um campo para inserir o token do CRM (Pipedrive, HubSpot, etc.). Depois disso, fica sincronizado automaticamente — sem Zapier, N8N ou qualquer ferramenta intermediária.
Com a integração nativa, o usuário consegue ver os dados do CRM dentro do Super SDR: funil, etapas e estrutura. Na prática, o CRM e o Super SDR ficam totalmente sincronizados.

| 2.2. WhatsApp: API Oficial vs. API Web — qual a diferença? |
| --- |

Essa escolha não tem a ver com o Super SDR — é uma decisão estratégica do cliente.
|  | API Oficial | API Web |
| --- | --- | --- |
| Segurança anti-bloqueio | Alta | Menor |
| Recomendada para | 100+ leads/dia | Volume menor |
| Custo adicional | Sim (custo Meta) | Não (grátis) |
| Quem paga | Cliente paga direto à Meta | Sem custo adicional |

|  | Importante O Super SDR funciona com ambas. O custo da API Oficial (Meta) é responsabilidade do cliente — não é cobrado pela Expert Integrado. Consulte a lista de ferramentas de integração para ver quais plataformas suportam API Oficial e quais suportam API Web. |
| --- | --- |

O número de WhatsApp é sempre do cliente. A Expert Integrado não cria números. O cliente usa seus próprios números e é responsável pelo gerenciamento deles.
|  | Sobre bloqueios O Super SDR não se responsabiliza por bloqueios de chip. Bloqueios estão relacionados à forma de uso (volume de mensagens, tipo de abordagem). API Oficial é mais segura. Follow-ups muito frequentes em API Web aumentam o risco. |
| --- | --- |


| 2.3. Como funciona no Instagram? |
| --- |

A IA responde exclusivamente pelo Direct do Instagram. Principais funcionalidades:
• Leitura da bio, descrição do perfil e fotos (as 12 primeiras imagens + capas de vídeo)
• Criação de rapport personalizado baseado no que encontra no perfil
• Transição automática para WhatsApp (a IA pede o número e migra a conversa mantendo o histórico completo)
|  | Exemplo de rapport A IA pode analisar as fotos do lead e criar abordagens como: 'Oi João, vi que você estava na praia com a família no final de semana. Que tal automatizar a empresa para ter mais momentos assim?' — tudo gerado automaticamente a partir das imagens do perfil. |
| --- | --- |

Tudo que a IA lê no Instagram é salvo como resumo no CRM e usado para contextualizar as conversas futuras.
|  | Disponibilidade Instagram está disponível a partir do plano Gold. |
| --- | --- |


| 2.4. Como funciona a voz clonada (ElevenLabs)? |
| --- |

É uma integração nativa com a ElevenLabs. O fluxo é:
1. O cliente contrata sua própria conta na ElevenLabs (a partir de US$5/mês)
2. A Expert Integrado fornece um passo a passo de como configurar
3. O cliente conecta a ElevenLabs dentro do Super SDR
4. A voz começa a ser gerada nativamente em todas as mensagens configuradas
| Configuração | Opções |
| --- | --- |
| Tipo de voz | Voz do próprio vendedor, voz de cada vendedor diferente, ou voz genérica |
| Quando usar áudio (texto recebido) | De 0% a 100% das vezes — o cliente escolhe |
| Quando usar áudio (áudio recebido) | De 0% a 100% das vezes — o cliente escolhe |
| Custo por áudio | Aprox. R$0,015 por segundo (áudio de 10s = R$0,15) |
| Configurações avançadas | Velocidade, intensidade, tom — tudo via painel do Super SDR |

|  | LGPD O cliente é responsável pela conta ElevenLabs e pelo uso da voz. A Expert Integrado não clona vozes diretamente — é o cliente que configura a integração na plataforma dele. |
| --- | --- |

|  | Por que usar voz? Gera conexão maior e rapport. O lead tem a percepção de estar conversando com uma pessoa real. É um diferencial competitivo forte, mas é opcional — o cliente só ativa se quiser. |
| --- | --- |


| 2.5. Como funciona o agendamento de reuniões? |
| --- |

O Super SDR integra com Google Calendar OU Outlook (não ambos ao mesmo tempo). Cada vendedor integra sua própria agenda.
Fluxo de agendamento:
1. A IA lê a agenda do vendedor para verificar disponibilidade
2. Dentro do Super SDR, configura-se o horário de atendimento (ex.: seg-sex 9h-12h e 14h-19h, sábados 14h-15h)
3. A IA só oferece horários dentro do limite configurado E que estejam livres na agenda
4. Quando agenda, envia invite por email com link de reunião (Meet, Zoom ou Teams)
5. A IA faz lembretes personalizados no WhatsApp até o dia da reunião
Modos de distribuição:
| Modo | Como funciona |
| --- | --- |
| Rodízio | A IA escolhe qualquer vendedor disponível |
| Rodízio forçado | Distribui igualmente entre todos os vendedores |
| Cluster | Qualifica os leads em níveis e direciona para vendedores diferentes (melhores leads → melhores vendedores) |

A IA pode sugerir horários ao lead ou perguntar a preferência dele — configurável na implementação.

| 2.6. A transição entre canais (Instagram → WhatsApp → Telefone) mantém o histórico? |
| --- |

Sim. O Super SDR funciona com contexto omnichannel. A conversa que começa no Instagram pode migrar para o WhatsApp e depois para telefone — tudo com o mesmo histórico, o mesmo contexto e o mesmo 'cérebro' da IA.
O lead pode conversar no WhatsApp hoje, voltar pelo Instagram amanhã, e o Super SDR lembra de tudo que foi falado em ambos os canais.
Importante: isso conta como um único lead, independentemente de quantos canais foram utilizados.

| 2.7. Sistema de telefonia — como funciona? |
| --- |

O sistema de telefonia é uma feature exclusiva do plano Black. Funciona via integração nativa com ElevenLabs (voz) + Twilio (telefonia).
Na prática, é mais um canal que funciona da mesma forma que WhatsApp e Instagram: a IA faz e recebe ligações, mantendo o mesmo contexto omnichannel.
O lead pode começar no Instagram, migrar para WhatsApp, e receber uma ligação de follow-up — tudo integrado com o mesmo histórico de conversa.

| 2.8. Formulários e landing pages — como integrar? |
| --- |

O Super SDR integra com o CRM do cliente, não diretamente com formulários. O fluxo recomendado é:
1. O cliente integra o formulário (Facebook Leads, landing page, etc.) com o CRM dele
2. O Super SDR pega o lead de dentro do CRM via webhook
A Expert Integrado auxilia nesse processo, mas a integração formulário → CRM é responsabilidade do cliente (via Make, Zapier, ou integração nativa do CRM).
|  | Formulário nativo O Super SDR possui um formulário nativo que pode ser embeddado no site do cliente. Esse formulário já cria o lead diretamente no CRM — sem necessidade de ferramenta intermediária. Disponível a partir do plano Gold. |
| --- | --- |


| 2.9. Integra com email? |
| --- |

Não há integração com email hoje. A única mensagem que o Super SDR envia por email é o invite de reunião (convite do Google Calendar ou Outlook).
Toda a comunicação acontece via WhatsApp, Instagram Direct e telefone (Black).


| SEÇÃO 3 — CRM E AUTOMAÇÕES |
| --- |


| 3.1. O que a IA faz dentro do CRM? |
| --- |

O Super SDR (e não 'a IA' — use sempre 'Super SDR' ao falar com clientes) realiza as seguintes ações automáticas no CRM:
| Ação | Detalhes |
| --- | --- |
| Criar oportunidade (deal) | Somente se não existir — busca pelo número de WhatsApp para evitar duplicatas |
| Criar pessoa/empresa | Dados básicos do lead (nome, telefone, empresa) |
| Mover entre etapas do funil | De acordo com o processo configurado |
| Preencher campos personalizados | Todos os campos configurados na implementação |
| Criar atividade de reunião | Quando agenda uma reunião, cria a atividade no CRM |
| Criar anotação (resumo) | Resumo da conversa em parágrafos, salvo no CRM |
| Criar script de venda | Cruzamento da conversa com o playbook — salvo no CRM |

Resultado: o vendedor (Closer) recebe o CRM 100% preenchido, com o lead no lugar certo, resumo pronto e script personalizado. Zero trabalho manual.

| 3.2. Como funciona a qualificação automática? |
| --- |

A qualificação é baseada em critérios definidos pelo próprio cliente na implementação. A IA faz as perguntas qualificatórias e classifica o lead em clusters.
Exemplo com critério de faturamento:
| Faturamento do lead | Cluster | Ação |
| --- | --- | --- |
| Acima de R$1M/mês | Alta qualificação | Agenda com melhores vendedores |
| R$100K a R$1M/mês | Média qualificação | Agenda com vendedores regulares |
| R$10K a R$100K/mês | Baixa qualificação | Agenda com vendedores juniores |
| Abaixo de R$10K/mês | Desqualificado | Não pode agendar reunião |

A quantidade de clusters e os critérios são totalmente personalizáveis. Cada cluster pode consultar agendas de vendedores diferentes.

| 3.3. O que acontece quando o lead é qualificado? |
| --- |

Existem vários caminhos possíveis, configuráveis na implementação:
| Caminho | Descrição | Uso comum |
| --- | --- | --- |
| Agendar reunião | IA agenda via Google/Outlook + envia invite | Mais comum para vendas B2B |
| Transferir para humano | Vendedor assume o WhatsApp sem agendar reunião | Vendas consultivas |
| Enviar link do site | IA envia link + faz follow-up depois | E-commerce, vendas simples |
| Checkout (roadmap) | Integração com plataforma de pagamento | Infoprodutos, cursos |

No caso de integração com checkout (ex.: Hotmart), está no roadmap mas ainda não está implementado. Hoje, sem essa integração, a IA simplesmente pergunta ao lead se ele comprou.

| 3.4. O que acontece quando o lead é desqualificado? |
| --- |

Quando a IA desqualifica um lead, as seguintes ações podem acontecer:
• Perda automática do lead no CRM (muda status para perdido)
• Downsell: a IA pode convidar para outro produto, plano menor ou conteúdo gratuito
• Handoff para outro agente: se existir um Super SDR configurado para outro produto, o lead pode ser transferido automaticamente
Exemplo: advogado tem Super SDR para direito trabalhista. Lead é desqualificado para trabalhista, mas pode ser qualificado para tributário — a IA transfere para o segundo agente.

| 3.5. O que são insights, resumos e scripts de venda? |
| --- |

| Recurso | O que é | Quando é criado | Onde fica |
| --- | --- | --- | --- |
| Resumo | Parágrafos resumindo a conversa | Quando conversa finaliza (sucesso ou perda) | Anotação no CRM |
| Script de venda | Cruzamento conversa × playbook com quebra de objeções | Quando lead é qualificado e agendou/foi transferido | Anotação no CRM |
| Dashboard | Estatísticas: leads atendidos, % qualificados, mensagens, texto vs áudio | Tempo real | Super SDR |

|  | Para o Closer O resumo e o script existem para que o Closer NÃO precise ler a conversa inteira. Ele abre o CRM, lê o resumo de 3 parágrafos e o script personalizado, e já está pronto para a reunião. |
| --- | --- |


| 3.6. O que é o sistema de intenções? |
| --- |

O sistema de intenções permite ao cliente criar gatilhos personalizados dentro do Super SDR. O cliente escreve uma descrição da intenção e vincula a ações específicas:
• Mover lead de etapa no funil do CRM
• Criar anotação no CRM
• Transferir para humano
• Transferir para outro agente
• Perder o lead no CRM
• Criar atividade
Exemplo: o cliente cria a intenção 'quando o lead perguntar sobre mentoria' → transferir para o vendedor especialista em mentoria.
O cliente pode criar várias intenções e gerenciá-las por conta própria.


| SEÇÃO 4 — CAMPANHAS E PROSPECÇÃO |
| --- |


| 4.1. Como funciona a prospecção ativa (outbound) via CRM? |
| --- |

A prospecção ativa acontece exclusivamente via CRM. O passo a passo é:
1. Na implementação, a Expert Integrado configura uma etapa-gatilho no funil do CRM
2. Toda vez que um lead é movido para essa etapa, o Super SDR dispara automaticamente
3. O usuário não depende da Expert Integrado para usar — já está configurado
Uso individual:
O vendedor pega um lead e arrasta para a etapa-gatilho. O Super SDR começa a abordagem lendo os dados do CRM (dados antigos, histórico, campos preenchidos) para criar uma mensagem personalizada.
Uso em massa:
O vendedor seleciona 100 leads (de uma base Excel ou leads antigos do CRM), move todos para a etapa-gatilho ao mesmo tempo, e o Super SDR começa a prospectar todos simultaneamente.
|  | Dica comercial Isso é um argumento de vendas poderoso: 'Imagine pegar 100 leads antigos que estão parados no seu CRM e reativar todos de uma vez, com mensagens personalizadas para cada um.' |
| --- | --- |


| 4.2. O que é uma campanha? Como funciona? |
| --- |

Uma campanha é uma abordagem inicial diferente vinculada a um contexto específico. Funciona assim:
1. O cliente cria a campanha no Super SDR (ex.: 'Black Friday')
2. Vincula uma tag ou identificador do CRM
3. Toda vez que um lead com aquela tag é movido para a etapa-gatilho, recebe a abordagem da campanha
Exemplo prático:
Campanha Black Friday: a IA começa com 'Oi [nome], conversamos no passado e vi que você participou da Black Friday do ano passado. Por isso temos uma condição especial para você...'
|  | Ponto técnico importante A campanha NÃO cria uma IA diferente. É o mesmo prompt, mesma base de conhecimento, mesma estrutura. A única coisa que muda é o input inicial — as variáveis de contexto que o Super SDR recebe no começo. Depois disso, a IA continua igual. |
| --- | --- |

|  | Disponibilidade Campanhas estão disponíveis a partir do plano Gold. No plano Silver, o cliente pode fazer disparos por conta própria via CRM. |
| --- | --- |


| 4.3. O que são os gatilhos de ativação? |
| --- |

| Gatilho | Descrição |
| --- | --- |
| WhatsApp (palavra-chave/intenção) | Lead manda mensagem com palavra-chave ou intenção mapeada |
| Início manual | Vendedor adiciona a conversa e aperta play |
| CRM (outbound) | Lead é movido para etapa-gatilho no funil |
| Landing page / Formulário | Lead preenche formulário → CRM → webhook |
| Formulário nativo | Formulário do Super SDR embeddado no site do cliente (Gold+) |
| Instagram Direct | Lead manda mensagem no Direct (Gold+) |



| SEÇÃO 5 — ULTRA-HUMANIZAÇÃO E EXPERIÊNCIA |
| --- |


| 5.1. O que significa 'comunicação ultra-humanizada'? |
| --- |

É um dos principais diferenciais do Super SDR. A IA utiliza técnicas avançadas para parecer um humano real no WhatsApp:
| Recurso | O que faz |
| --- | --- |
| Erros de digitação simulados | Simula teclas erradas do teclado (não é português errado, é digitação errada) |
| Letras minúsculas | Escreve tudo em minúscula para parecer casual, como uma pessoa real |
| Abreviações e gírias | Usa 'vc', 'tb', 'blz' e expressões coloquiais |
| Linguagem falada | Adapta o texto como se fosse falado: 'fala' em vez de 'falar' |
| Mensagens quebradas | Ao invés de uma mensagem longa, envia em pedaços (como humano) |
| Buffer de tempo | Espera segundos configuráveis antes de responder, acumula mensagens |
| Áudio com voz clonada | Envia áudios com a voz do vendedor (via ElevenLabs) |

|  | Argumento de vendas O lead não percebe que está falando com uma IA. Isso aumenta drasticamente a taxa de conversão em comparação com chatbots tradicionais. |
| --- | --- |


| 5.2. Como funciona o buffer de resposta? |
| --- |

Ao invés de responder instantaneamente (como um chatbot), o Super SDR aguarda um tempo configurável (em segundos) antes de responder. Nesse tempo:
1. Recebe todas as mensagens que o lead está enviando
2. Processa tudo junto
3. Responde com mensagens quebradas em pedaços
O resultado é uma experiência muito mais natural: a conversa flui como entre duas pessoas reais.

| 5.3. A IA consegue interpretar áudios, imagens e PDFs? |
| --- |

Sim. O Super SDR interpreta:
• Texto (mensagens normais)
• Áudio (transcreve e entende o conteúdo)
• Imagens (analisa o que está na imagem e responde de acordo)
• PDFs (lê o conteúdo do documento)
Isso permite, por exemplo, que o lead envie um documento e a IA saiba responder sobre o conteúdo dele.

| 5.4. O Super SDR pode enviar mídias (fotos, vídeos)? |
| --- |

Sim. O cliente pode configurar mídias no Super SDR para serem enviadas no momento certo. Exemplo: quando alguém pedir foto do prédio da empresa, a IA envia a imagem configurada.
|  | Dependência de plataforma O envio de mídias depende da plataforma de WhatsApp que o cliente usa. Algumas plataformas não suportam envio de imagens/vídeos pela API. |
| --- | --- |


| 5.5. O que são follow-ups personalizados? |
| --- |

Os follow-ups podem ser configurados de duas formas:
| Tipo | Como funciona | Resultado |
| --- | --- | --- |
| Texto fixo + variáveis | Mensagem template com variáveis ({nome}, {empresa}) | Todos os leads recebem a mesma estrutura |
| Prompt personalizado | IA gera mensagem única baseada na dor do lead | Cada lead recebe mensagem diferente |

Exemplo de escala com prompts personalizados:
• Lead sem resposta há 2h: Follow-up batendo na dor principal que o lead mencionou
• Sem resposta há 8h: Mensagem mais incisiva sobre a dor
• Sem resposta há 24h: Mensagem com escassez ('essa condição vale até...')
Cada mensagem é gerada de forma única — nenhum lead recebe o mesmo follow-up.
|  | Lembretes de reunião A mesma lógica se aplica aos lembretes de reunião: ao invés de 'Lembrete: sua reunião é amanhã', a IA pode falar 'João, amanhã vamos conversar sobre como resolver aquele problema de [dor] que você mencionou. Você confirmou sua agenda?' |
| --- | --- |


| 5.6. O que é a programação de retomada de conversa? |
| --- |

Quando o lead fala algo como 'estou ocupado agora, me chama depois das 18h', o Super SDR programa automaticamente a retomada da conversa para o horário indicado.
Isso simula o comportamento de um SDR humano que anota o horário e volta a ligar na hora certa.

| 5.7. É possível pausar o Super SDR manualmente? |
| --- |

Sim. O usuário (vendedor) pode pausar o Super SDR a qualquer momento durante uma conversa. A IA para de enviar mensagens até que o usuário retome.
Isso é útil quando o vendedor quer assumir a conversa manualmente ou quando precisa intervir em alguma situação específica.


| SEÇÃO 6 — PLANOS, PREÇOS E COMERCIAL |
| --- |


| 6.1. Qual a diferença real entre Silver, Gold e Black? Qual recomendar? |
| --- |

| Recurso | Silver | Gold | Black |
| --- | --- | --- | --- |
| WhatsApp | ✓ | ✓ | ✓ |
| Instagram Direct | ✗ | ✓ | ✓ |
| Telefonia (Twilio) | ✗ | ✗ | ✓ |
| Integração CRM nativa | ✗ | ✓ | ✓ |
| Resumo de conversa | ✗ | ✓ | ✓ |
| Script de venda | ✗ | ✓ | ✓ |
| Campanhas | ✗ | ✓ | ✓ |
| Formulário nativo | ✗ | ✓ | ✓ |
| Consultas externas (CNPJ, Serasa) | ✗ | ✗ | ✓ |
| CS dedicado / reuniões mensais | ✗ | ✗ | ✓ |
| Dashboard básico | ✓ | ✓ | ✓ |
| Dashboard avançado | ✗ | ✓ | ✓ |

Perfil ideal de cada plano:
| Plano | Perfil ideal | Critério principal |
| --- | --- | --- |
| Silver | Empresas sem CRM, focadas só em WhatsApp | Maturidade comercial baixa |
| Gold | A maioria das empresas — recomendação padrão | Já usa CRM e precisa de inteligência comercial |
| Black | Empresas que exigem acompanhamento dedicado | CS prioritário, telefonia, consultas externas |

|  | Critério de escolha NÃO tem a ver com volume de leads nem com faturamento. Tem a ver com maturidade comercial. Empresas que já usam CRM naturalmente precisam do Gold. |
| --- | --- |


| 6.2. Como funciona a contabilização de leads? |
| --- |

A contagem é por atendimento iniciado dentro de uma janela de 30 dias (em breve será reduzida para 15 dias para novos clientes).
Regra principal: 1 lead = 1 pessoa atendida na janela de 30 dias.
| Cenário | Conta como |
| --- | --- |
| Lead conversa por 3 dias | 1 lead |
| Lead agenda, desmarca e reagenda | 1 lead |
| Lead recebe follow-up por 2 semanas | 1 lead |
| Lead conversa por mais de 30 dias | Conta novamente |
| Lead usa Instagram + WhatsApp + telefone | 1 lead (omnichannel) |

Não há cobrança de tokens adicionais dentro da janela. Tudo está incluso.
|  | Mudança em breve A janela de contagem será reduzida de 30 para 15 dias para novos clientes. Clientes que já contrataram continuam com janela de 30 dias. |
| --- | --- |


| 6.3. O que acontece se ultrapassar o limite de leads? |
| --- |

Planos semestrais e anuais — vantagem:
Ao invés de 1.000 leads/mês, o cliente contrata 6.000/semestre ou 12.000/ano. Isso permite distribuir o uso: meses de campanha forte usam mais, meses calmos usam menos.
Quando estoura o limite:
| Opção | O que acontece |
| --- | --- |
| Pagar por lead | Cobra pós-pago: preço do plano ÷ qtd de leads = valor por lead adicional |
| Subir de plano | Upgrade — o custo por lead fica menor (sempre mais vantajoso) |
| Parar de funcionar | O cliente configura no painel para o Super SDR parar quando atingir o limite |

Exemplo de cálculo:
Plano Gold 500 leads = R$1.497/mês ÷ 500 = R$2,99 por lead. A partir do lead 501, cobra R$2,99 adicional pós-pago na fatura.
|  | Argumento comercial Se o cliente estourar o plano com frequência, vale mais a pena subir de plano — o custo por lead sempre diminui no plano maior. Use isso como argumento para upgrade. |
| --- | --- |

Há uma tolerância de 10% que é cobrada automaticamente como pós-pago. Acima de 10% do excedente, precisa de liberação do CS.

| 6.4. Planos mensais vs. semestrais vs. anuais — qual a vantagem? |
| --- |

| Aspecto | Mensal | Semestral | Anual |
| --- | --- | --- | --- |
| Créditos de leads | Zeram todo mês (sobrou, perdeu) | Acumulam no semestre | Acumulam no ano |
| Flexibilidade de uso | Baixa | Alta | Máxima |
| Desconto | Sem desconto | Desconto sobre mensal | Maior desconto |
| Desconto adicional PIX | ✓ | ✓ | ✓ |

|  | Argumento de venda principal No plano semestral ou anual, os leads acumulam. Então se o cliente tem um mês forte de campanha, ele pode usar mais leads sem pagar excedente — porque puxa dos meses que usou menos. |
| --- | --- |


| 6.5. Taxa de implementação — como funciona? |
| --- |

A taxa de implementação é sempre cobrada e está visível no site. Os valores variam de acordo com campanhas promocionais sazonais.
|  | Regra comercial As regras de negociação da taxa de implementação ficam no playbook de vendas, não neste FAQ. Cada mês pode ter uma campanha diferente. Consulte o playbook atualizado antes de negociar. |
| --- | --- |


| 6.6. O que é o upgrade de LLM? Quando recomendar? |
| --- |

É a opção de usar modelos de IA mais potentes (e mais caros). O custo adicional é pós-pago, por lead.
|  | LLM Padrão | LLM Upgrade |
| --- | --- | --- |
| Custo | Incluso no plano | Adicional por lead |
| Qualidade | Excelente para 90% dos casos | Superior para processos complexos |
| Quando usar | Sempre (padrão) | Playbook muito grande, muitas variáveis, muitas regras |
| Ativação | Automática | Ligado/desligado a qualquer momento no painel |


| 6.7. Agentes adicionais — quando o cliente precisa e quanto custa? |
| --- |

O cliente precisa de agentes adicionais quando processos são diferentes. Exemplos:
• Agente de vendas + agente de pós-vendas/suporte
• Produtos diferentes com qualificações diferentes (advogado: trabalhista + tributário)
• Processos com perguntas, campos de CRM e scripts completamente diferentes
O custo do agente adicional é aproximadamente R$250/mês.
Os leads são compartilhados entre os agentes dentro do mesmo plano. Ex.: plano de 1.000 leads com 2 agentes = 1.000 leads distribuídos entre ambos.
|  | Quando NÃO precisa de agente adicional Inbound e outbound NÃO são agentes diferentes — é o mesmo agente com gatilhos diferentes. Idiomas diferentes também funcionam no mesmo agente. |
| --- | --- |



| SEÇÃO 7 — IMPLEMENTAÇÃO E PÓS-VENDA |
| --- |


| 7.1. Qual o passo a passo da implementação? |
| --- |

| Etapa | O que acontece | Quem faz | Prazo |
| --- | --- | --- | --- |
| 1. Kickoff | Cliente recebe login e formulário | CS + Cliente | Dia 0 |
| 2. Entrega de materiais | Playbook, produto, conversas de bom SDR, preços | Cliente | 1h a 3 semanas |
| 3. Fluxograma | CS cria fluxograma do processo | CS | Até 2 dias úteis |
| 4. Validação | Reunião para validar fluxograma | CS + Cliente | 1 reunião |
| 5. Desenvolvimento | CS desenvolve o agente completo | CS | ~3 dias |
| 6. Entrega | Projeto funcional, integrado ao CRM | CS | Incluído |
| 7. Homologação | Cliente testa e pede ajustes | CS + Cliente | 1 a 7 dias |
| 8. Go-live | Projeto em produção | — | — |

Prazo total: aproximadamente 5 dias úteis a partir da entrega dos materiais.
Estamos dando uma margem maior por conta da demanda atual — pode ser negociado diretamente com o vendedor.
|  | Para o vendedor O gargalo nunca é o nosso time — é o tempo que o cliente leva para entregar os materiais. Se o cliente entregar tudo em 1 dia, o projeto fica pronto em 5 dias. Use isso como argumento de urgência. |
| --- | --- |


| 7.2. O que o cliente precisa entregar para a implementação? |
| --- |

Quanto mais material, melhor. Os itens principais são:
• Playbook comercial (processo de pré-vendas)
• Definição de lead qualificado (critérios de qualificação)
• Descrição do produto/serviço (o que a IA precisa saber explicar)
• Preços e condições comerciais
• Exemplos de conversas de um bom SDR (para treinar o tom e linguagem)
• Regras de como a IA deve se portar
|  | Importante A IA só precisa saber o que um SDR saberia. Informações exclusivas do Closer (negociação avançada, descontos especiais) não precisam ser treinadas. |
| --- | --- |


| 7.3. Qual a diferença entre auto-atendimento e CS acompanhado? |
| --- |

| Aspecto | Silver (auto-atendimento) | Gold+ (CS acompanhado) |
| --- | --- | --- |
| Kickoff | Automático e rápido | Com CS dedicado |
| Preenchimento de formulários | Cliente faz sozinho | CS auxilia |
| Reuniões | Kickoff + fluxograma (só 2) | Reuniões adicionais conforme necessidade |
| Suporte na implementação | Mínimo | CS à disposição para dúvidas |


| 7.4. Como funciona o pós go-live (Jornada do Sucesso)? |
| --- |

| Plano | Acompanhamento pós go-live |
| --- | --- |
| Silver | Sem acompanhamento — projeto roda por conta do cliente |
| Gold | CS monitora conversas por 15 dias + benchmarks e sugestões. Reunião semestral de acompanhamento |
| Black | CS monitora conversas por 15 dias + benchmarks e sugestões. Reuniões mensais de acompanhamento + suporte prioritário |

Nos primeiros 15 dias (Gold+), o CS acompanha algumas conversas diariamente, valida se há pontos de melhoria, e traz benchmarks de mercado.
|  | Responsabilidade do cliente Nas primeiras duas semanas, o cliente também precisa monitorar as conversas. O CS valida se o processo está correto, mas só o cliente sabe se os detalhes do produto, da comunicação e das respostas estão atendendo suas expectativas. |
| --- | --- |


| 7.5. Alteração de projeto — o que está incluso? |
| --- |

Ajustes de produto estão inclusos em todos os planos: refinar prompt, ajustar tom, corrigir informações, adicionar perguntas, etc.
Alteração de projeto é quando o cliente quer mudar completamente o agente — refazer todo o prompt do zero, mudar o produto, reestruturar o processo.
Isso não é comum e não deve ser uma preocupação do cliente na hora da venda.
O plano Black tem mais alterações incluídas do que os demais planos.


| SEÇÃO 8 — SEGURANÇA, LGPD E COMPLIANCE |
| --- |


| 8.1. Onde ficam os dados? Como explicar LGPD para o prospect? |
| --- |

Dados do CRM: ficam no CRM do cliente.
O Super SDR registra informações no CRM do cliente — não fica nada salvo do nosso lado em termos de dados de leads. As informações (deals, contatos, campos preenchidos) ficam todas dentro do CRM que o cliente já usa.
Histórico de conversa da IA: fica dentro do Super SDR.
A IA precisa do histórico para manter o contexto. Essa informação está dentro do sistema mas não é legível por humanos externamente — só é acessível pelo painel do Super SDR, onde o próprio cliente pode visualizar.
Modelos de IA: seguem as políticas dos provedores.
Os dados processados pela IA seguem as políticas de privacidade do Google (Gemini) e da OpenAI. São modelos seguros e amplamente utilizados no mercado.
A Expert Integrado não usa os dados para treinar IA, não os expõe e não os compartilha. Tudo está previsto no contrato padrão.
|  | Para o prospect com medo de LGPD Diga que é igual a qualquer ferramenta de WhatsApp que ele já usa — se ele usa uma ferramenta como Z-API, Twilio, ou outra, essa ferramenta já tem todo o histórico de conversas. O Super SDR funciona da mesma forma. |
| --- | --- |


| 8.2. Consentimento do lead — quem é responsável? |
| --- |

A responsabilidade pelo consentimento é do cliente — não da Expert Integrado.
Se o cliente usar o Super SDR para outbound com leads que não deram permissão, pode gerar problemas para ele. É uma decisão da empresa.
O Super SDR está preparado com funções de opt-out: quando o lead pede para não ser mais contatado, a IA pode ser configurada para parar automaticamente.

| 8.3. Se o lead pedir para ser removido, como funciona o opt-out? |
| --- |

O Super SDR não faz opt-out da ferramenta (não remove o número da base). O que ele faz é parar de abordar o lead:
• A IA para de enviar follow-ups
• A IA fica parada, à disposição caso o lead volte a falar
• O cliente configura o nível de persistência (IA mais insistente ou mais respeitosa)
A remoção do lead do CRM ou da base de dados é responsabilidade do cliente.

| 8.4. Tem DPA separado ou está tudo no contrato padrão? |
| --- |

Está tudo no contrato padrão. Não há DPA (Data Processing Agreement) ou DPO (Data Protection Officer) separado.
A Expert Integrado é uma empresa de porte pequeno com um contrato padrão que cobre as cláusulas de LGPD necessárias.

| 8.5. SLA de uptime e disponibilidade — a IA pode ficar fora do ar? |
| --- |

O Super SDR trabalha com protocolo de uptime de 99,5% de disponibilidade.
Em caso de downtime superior ao previsto, é oferecido desconto proporcional na fatura.
Na prática, indisponibilidades são raras e de curta duração.

| 8.6. Vocês têm certificações de segurança (SOC 2, ISO 27001)? |
| --- |

Não temos essas certificações no momento e não estão no roadmap imediato. A Expert Integrado é uma empresa de porte pequeno que trabalha com as políticas de segurança dos provedores de LLM que utilizamos (Google e OpenAI), que possuem essas certificações em seus próprios serviços.
|  | Como responder ao prospect Se o prospect perguntar sobre certificações, explique que os modelos de IA utilizados (Google Gemini, OpenAI) são enterprise-grade e possuem suas próprias certificações. Os dados do cliente ficam no CRM dele, não nos nossos servidores. |
| --- | --- |


| 8.7. Existe log de auditoria? Quem acessou, quando, o que mudou? |
| --- |

Sim. O Super SDR possui:
• Log de auditoria de acessos (quem entrou na plataforma e quando)
• Histórico de alterações (mudanças em configurações, prompts, etc.)
Isso garante rastreabilidade e controle para o admin da conta.


| SEÇÃO 9 — MULTI-AGENTE E CENÁRIOS AVANÇADOS |
| --- |


| 9.1. Como funciona quando o cliente tem vários agentes? |
| --- |

O cliente pode ter quantos agentes precisar. Cada agente tem seu próprio processo: funil, campos, prompt, perguntas e qualificação.
Handoff entre agentes:
• Um agente pode transferir o lead para outro agente automaticamente
• O histórico da conversa é mantido — a conversa flui como se fosse uma só
• A transferência pode ser transparente (lead nem percebe) ou explícita (agente se apresenta como novo)
Compartilhamento de leads:
Os leads são compartilhados entre os agentes dentro do mesmo plano. Ex.: 2 agentes com plano de 1.000 leads = 1.000 leads distribuídos entre ambos.

| 9.2. Quando o cliente precisa de agentes diferentes? (Exemplos práticos) |
| --- |

| Cenário | Precisa de agentes separados? | Motivo |
| --- | --- | --- |
| Inbound vs. Outbound | NÃO | Mesmo processo, só muda o gatilho |
| Português + Espanhol | NÃO | A IA lida com múltiplos idiomas |
| Vendas + Suporte pós-venda | SIM | Processos completamente diferentes |
| Produto A + Produto B | SIM | Perguntas e qualificação diferentes |
| Advogado: Trabalhista + Tributário | SIM | Árvores decisórias diferentes |
| BPC Loas + Aposentadoria por invalidez | SIM | Critérios de qualificação diferentes |

Regra simples: se as perguntas são as mesmas, pode ser um agente só. Se as perguntas, scripts ou critérios de qualificação mudam, precisa de agentes separados.

| 9.3. Funcionalidades avançadas (exclusivas do Black) |
| --- |

O plano Black oferece funcionalidades de consulta externa que não estão disponíveis em outros planos:
• Consulta de CNPJ
• Consulta de CPF
• Consulta Serasa
• Consulta de CEP
• Outras integrações personalizadas
Algumas dessas consultas são nativas do Super SDR. Outras requerem que o cliente contrate a API do serviço (ex.: API do Serasa) e forneça o token de integração.
A taxa de implementação do Black é maior justamente porque inclui a configuração dessas integrações avançadas.


| SEÇÃO 10 — DASHBOARD, RELATÓRIOS E PLATAFORMA |
| --- |


| 10.1. O que o dashboard mostra? |
| --- |

O dashboard está disponível em todos os planos, com métricas diferentes por nível:
| Métrica | Silver | Gold | Black |
| --- | --- | --- | --- |
| Leads atendidos no mês | ✓ | ✓ | ✓ |
| % qualificados / desqualificados | ✓ | ✓ | ✓ |
| Reuniões agendadas | ✓ | ✓ | ✓ |
| Número médio de mensagens | ✗ | ✓ | ✓ |
| Taxa texto vs. áudio | ✗ | ✓ | ✓ |
| Distribuição por cluster | ✗ | ✓ | ✓ |
| Métricas avançadas | ✗ | ✗ | ✓ |

Exportação de dados ainda não está disponível, mas está no roadmap.

| 10.2. Tem aplicativo mobile? |
| --- |

O Super SDR é otimizado para uso via web no computador, mas funciona no celular via navegador. Não há aplicativo nativo e não está no roadmap.
Ponto importante de proposta de valor:
O Super SDR não é uma ferramenta para ficar usando o tempo todo. A proposta é configurar e sair. Quanto menos o cliente entrar no Super SDR, melhor — significa que a IA está performando bem.
|  | Grande diferencial O Super SDR não tira o cliente do ecossistema que ele já usa. Ele integra com a ferramenta de WhatsApp do cliente, com o CRM dele — os vendedores continuam trabalhando nas mesmas ferramentas. Ninguém precisa aprender ferramenta nova. |
| --- | --- |


| 10.3. Transparência: o que o cliente vê sobre a IA? |
| --- |

Dentro do painel do Super SDR, o cliente consegue ver:
• O que a IA está pensando e executando em cada interação
• Quando a IA tentou agendar, quando qualificou/desqualificou, com o motivo
• Filtros por status (agendado, qualificado, desqualificado) e por canal (WhatsApp, Instagram, telefone)
Isso garante total transparência sobre o comportamento do agente.

| 10.4. Níveis de permissão da plataforma |
| --- |

| Nível | O que pode fazer |
| --- | --- |
| Admin | Acesso total: configurações, prompts, integrações, agentes, permissões |
| Usuário (Vendedor) | Configurações pessoais: própria voz, próprios atendimentos, pausar/retomar conversas |

O vendedor não pode alterar a estrutura do agente — só o admin tem esse acesso.

| 10.5. Suporte a múltiplos idiomas |
| --- |

Sim, a IA atende em qualquer idioma. Pode ser configurada para:
• Responder no idioma que o lead falar (detecção automática)
• Responder sempre em um idioma específico (travar idioma)
Isso é definido na implementação e pode ser ajustado depois.


| SEÇÃO 11 — PROPOSTA DE VALOR E DIFERENCIAIS |
| --- |


| 11.1. Qual é a filosofia central do Super SDR? |
| --- |

"Quanto menos você entrar no Super SDR, melhor."
O Super SDR foi projetado para ser 'configurar e sair'. A IA opera de forma autônoma dentro do ecossistema que o cliente já utiliza.
Os 3 pilares da proposta de valor:
1. Não tira o cliente do ecossistema dele — integra com as ferramentas que ele já usa
2. O vendedor continua trabalhando no CRM e na ferramenta de WhatsApp dele — ninguém precisa aprender ferramenta nova
3. O Super SDR faz o trabalho do SDR de forma autônoma — qualifica, agenda, preenche CRM, gera scripts

| 11.2. Principais diferenciais competitivos |
| --- |

| Diferencial | O que significa na prática |
| --- | --- |
| Ultra-humanização | Erros de digitação, gírias, áudio, mensagens quebradas — lead não percebe que é IA |
| Omnichannel | Instagram + WhatsApp + Telefone com mesmo contexto e histórico |
| CRM 100% preenchido | Closer recebe deal pronto, com resumo e script personalizado |
| Prospecção em massa | 100 leads reativados simultaneamente com mensagens personalizadas |
| Cluster de qualificação | Melhores leads para melhores vendedores automaticamente |
| Follow-up inteligente | Cada mensagem é única, baseada na dor específica do lead |
| Voz clonada | Áudios com a voz do vendedor via ElevenLabs |
| Rapport via Instagram | IA lê perfil e cria abordagem personalizada a partir das fotos |



| SEÇÃO 12 — ROI, RESULTADOS E CASOS DE SUCESSO |
| --- |


| 12.1. Qual o tempo médio para o cliente ver resultados? |
| --- |

Não é possível garantir ROI nem volume de agendamentos — isso depende da qualidade dos leads do cliente, do processo comercial e do mercado dele. O Super SDR automatiza o processo existente; se o processo for ruim, a automação vai ser ruim também.
O que podemos afirmar:
• Projetos bem implementados começam a ter resultados operacionais nas primeiras semanas
• Durante a jornada do sucesso (15 dias pós go-live no Gold+), o projeto já está rodando e gerando operações
• O retorno não é só em reuniões agendadas — é em tempo liberado do time, CRM preenchido, qualificação padronizada e escala
|  | Nunca prometa números Não prometa taxa de agendamento, quantidade de reuniões ou ROI específico. Cada processo é diferente. A promessa é: automatizar o processo que ele já tem, com qualidade igual ou superior, a um custo muito menor que um SDR humano. |
| --- | --- |


| 12.2. Vocês têm benchmarks de taxa de agendamento ou resposta? |
| --- |

Não temos benchmarks universais porque cada processo é diferente. Taxa de agendamento, taxa de resposta e tempo de qualificação dependem do mercado, do produto e da qualidade do lead do cliente.
O argumento correto é:
A meta é que a taxa de agendamento seja igual ou maior que a de um SDR humano. Mas mesmo que seja um pouco menor, ainda vale a pena — porque o custo do Super SDR é infinitamente mais barato que contratar, treinar e gerenciar um SDR.
|  | Conta rápida para o prospect Um SDR humano custa R$3.000-5.000/mês (salário + encargos + benefícios + gestão). O Super SDR custa a partir de R$1.490/mês e trabalha 24/7 sem férias, sem doença, sem turnover. Mesmo com taxa 20% menor, o ROI é positivo. |
| --- | --- |


| 12.3. Tem case de sucesso para compartilhar? |
| --- |

Case PSP (Proteção e Segurança Patrimonial):
• Quando começaram com o Super SDR: recebiam cerca de 5.000 leads por mês
• Resultado: escalaram para 30.000-50.000 leads por mês sem aumentar o time de SDR
• O Super SDR absorveu todo o crescimento de demanda sem necessidade de contratar mais pessoas
|  | Como usar o case Use este case para prospects que têm medo de escalar: 'Imagine que seu volume de leads triplique amanhã. Com SDR humano, você precisaria contratar 3x mais gente. Com o Super SDR, você só ajusta o plano.' |
| --- | --- |



| SEÇÃO 13 — TROUBLESHOOTING E LIMITAÇÕES TÉCNICAS |
| --- |


| 13.1. Quais são os problemas mais comuns nos primeiros dias? |
| --- |

Os problemas mais frequentes no início são:
• IA respondendo com informações incorretas ou incompletas
• Falhas pontuais de integração com CRM ou plataforma de WhatsApp
• Funcionalidades que precisam de ajuste fino (tom, linguagem, regras de qualificação)
Todos esses problemas são resolvidos no período de homologação.
É exatamente para isso que a homologação existe: o cliente testa, identifica ajustes, e o CS corrige antes do go-live. Se a homologação for bem feita, os primeiros dias em produção são tranquilos.
|  | Para o vendedor Quando o prospect perguntar 'e se der problema?', explique o processo de homologação: 'Antes de ir ao ar, você testa tudo. Fazemos quantos ajustes forem necessários até você estar satisfeito. Só vai para produção quando estiver aprovado.' |
| --- | --- |


| 13.2. Se o chip de WhatsApp for bloqueado, o que acontece? |
| --- |

O número de WhatsApp é responsabilidade do cliente, mas o time de suporte da Expert Integrado auxilia na resolução.
| Cenário | Ação |
| --- | --- |
| Cliente usa plataforma externa (Take Blip, Chat Gurus, etc.) | Suporte auxilia + cliente consulta a plataforma de WhatsApp |
| Cliente usa Expert Integrado como plataforma de WhatsApp | Suporte assume a resolução diretamente |

|  | Prevenção A melhor forma de evitar bloqueio é usar API Oficial (recomendada para 100+ leads/dia) e evitar follow-ups excessivos em API Web. O Super SDR tem configurações de intervalo entre mensagens que ajudam a proteger o chip. |
| --- | --- |


| 13.3. Existe limite de mensagens por dia no WhatsApp ou Instagram? |
| --- |

Não existe um número fixo de limite. Isso depende de vários fatores: volume de envio, algoritmo anti-spam do WhatsApp/Instagram, histórico do número, tipo de abordagem e comportamento do lead.
O Super SDR é configurado para respeitar boas práticas de envio, com buffers de tempo e intervalos naturais entre mensagens, minimizando riscos.
|  | Recomendação Para volumes acima de 100 leads/dia, recomende API Oficial. Para volumes menores, API Web funciona bem com as configurações padrão do Super SDR. |
| --- | --- |


| 13.4. O que acontece se o CRM do cliente ficar fora do ar? |
| --- |

Se o CRM ficar temporariamente indisponível:
• A IA continua funcionando normalmente (respondendo leads no WhatsApp/Instagram)
• As ações no CRM (criar deal, mover etapa, preencher campos) não são executadas durante o período de indisponibilidade
• Não há sistema de fila — as ações perdidas durante o downtime não são recuperadas automaticamente
Na prática, downtimes de CRM são raros e curtos. O impacto é mínimo na operação do dia a dia.


| SEÇÃO 14 — ROADMAP E FUNCIONALIDADES FUTURAS |
| --- |


| 14.1. O Super SDR faz enriquecimento de dados do lead? |
| --- |

Hoje, não. As informações utilizadas pela IA vêm exclusivamente de duas fontes:
• Dados do CRM do cliente (campos preenchidos, histórico, anotações)
• Informações que o próprio lead fornece durante a conversa
Enriquecimento automático de dados está no roadmap.
No futuro, o Super SDR poderá buscar informações adicionais sobre o lead de fontes externas. Por enquanto, a qualidade da qualificação depende da qualidade dos dados no CRM e das respostas do lead.
|  | Como contornar hoje Oriente o cliente a enriquecer os dados no CRM antes de disparar o outbound. Se ele usar uma ferramenta de enriquecimento (Apollo, Lusha, etc.) e preencher os campos no CRM, o Super SDR vai ler essas informações e usar na abordagem. |
| --- | --- |


| 14.2. Existe A/B testing de abordagem? |
| --- |

Funcionalidade de A/B testing nativo ainda não existe. Está no roadmap.
Alternativas disponíveis hoje:
| Alternativa | Como funciona |
| --- | --- |
| Múltiplos agentes | Criar dois agentes com abordagens diferentes e dividir os leads entre eles |
| Mudar gatilhos | Alterar a mensagem inicial de um agente e comparar resultados em períodos diferentes |
| Campanhas | Criar campanhas com abordagens diferentes vinculadas a tags no CRM (Gold+) |

Nenhuma dessas alternativas é um A/B test estatístico real, mas permitem testar abordagens diferentes na prática.

| 14.3. Integração com checkout (Hotmart, etc.)? |
| --- |

Está no roadmap, mas ainda não implementado. Quando estiver disponível, o Super SDR saberá automaticamente se o lead comprou ou não, eliminando a necessidade de perguntar.
Hoje, sem essa integração, a IA simplesmente pergunta ao lead se ele concluiu a compra e faz follow-up baseado na resposta.

| 14.4. Aprendizado automático da IA? |
| --- |

Está no roadmap. A funcionalidade planejada é:
1. A IA detecta que não soube responder algo
2. Aparece um aviso no painel do Super SDR
3. O usuário humano clica, fornece a resposta correta
4. A informação é incorporada à base de conhecimento
Esse processo mantém o protocolo de segurança (validação humana obrigatória) enquanto facilita a atualização contínua do conhecimento.

| 14.5. Exportação de relatórios e dados? |
| --- |

Ainda não disponível. Está no roadmap para futuras versões do dashboard.
Por enquanto, os dados podem ser consultados diretamente no painel do Super SDR ou no CRM do cliente (onde ficam os resumos, scripts e históricos).

| 14.6. Contagem de leads: mudança de 30 para 15 dias? |
| --- |

A janela de contagem de leads vai mudar de 30 para 15 dias para novos clientes. Clientes que já contrataram mantêm a janela de 30 dias.
Sem data definida para a mudança.
Na prática, essa mudança afeta poucos clientes — a maioria das conversas de pré-vendas acontece em 1-5 dias. Só impacta quem tem follow-ups muito longos (3+ meses) ou reprospecting frequente.
