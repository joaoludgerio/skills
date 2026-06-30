# /editar-video-motion — Gravação crua em vídeo final com motion graphics

> Pega uma gravação de alguém falando pra câmera, corta os erros e entrega um vídeo final com gráficos animados por cima, na identidade da marca.

## O que faz
Transforma uma gravação crua (uma pessoa falando pra câmera, com erros, retakes e pausas) num vídeo final pronto pra publicar. A skill corta os erros e os respiros, deixa a fala corrida e sincronizada com a imagem, e monta gráficos animados por cima (nome/cargo, listas, cards de seção, contadores, CTA no fim). Usa a fala real da pessoa — não cria avatar nem voz sintética.

## Quando usar
- "Edita esse vídeo" / "transforma essa gravação em peça final"
- "Bota uns gráficos / motion nesse vídeo"
- "Corta os erros desse vídeo e deixa só o que presta"
- "Faz a versão 9x16 / vertical / Stories desse vídeo"
- Quando você manda um `.mp4` gravado (alguém falando pra câmera) pedindo o vídeo pronto

(Se a ideia for usar avatar ou voz sintética em vez da pessoa real, isso é a skill `criar-reel`, não esta.)

## O que você precisa dar
- O **vídeo gravado** (.mp4) — é a base de tudo.
- O **formato** desejado: 16:9 (YouTube/institucional), 9:16 (Reels/Stories), 1:1 (feed), ou vários de uma vez.
- A **identidade visual**: pode ser o link de uma landing page (a skill extrai as cores e o conteúdo), uma marca conhecida, ou o padrão Expert (fundo azul-escuro com destaque em azul).
- Uma ideia da **estrutura/CTA**: o que a gravação cobre, a ordem desejada e qual a chamada final.

## O que ela entrega
- O **vídeo final editado**, com os erros cortados, áudio em sincronia e motion graphics por cima.
- Renderizado nos formatos pedidos: **16:9 (1920x1080)**, **9:16 (1080x1920)** e/ou **1:1 (1080x1080)**.
- O arquivo final é copiado pra pasta **Downloads**. Se ficar muito grande (acima de ~200MB), a skill oferece também uma versão mais leve/comprimida.

## Como funciona (passo a passo resumido)
1. **Briefing e identidade** — confirma formato(s), identidade visual e estrutura/CTA.
2. **Transcrição** — transcreve o áudio com timestamps por palavra (pra saber exatamente onde cada coisa é dita).
3. **Mapa de cortes** — quebra a transcrição em frases e identifica os trechos bons; monta a lista do que fica e do que sai (retakes, falas pra produção, pigarros, silêncios).
4. **Vídeo-base limpo** — corta só os trechos bons e monta o vídeo-base com a fala corrida e o áudio sincronizado.
5. **Plano de motion** — sincroniza cada gráfico com a fala (nome/cargo, listas que entram uma a uma, cards que mascaram os cortes, contadores de números, CTA no fim).
6. **Composição e render** — monta tudo no HyperFrames, renderiza, confere por amostras de frames e entrega.

## Integrações e ferramentas
- **FFmpeg** — corta e remonta os trechos do vídeo, extrai o áudio e ajusta tamanho/formato.
- **ElevenLabs (Scribe)** — transcreve a fala com timestamps por palavra (a base pra cortar e sincronizar os gráficos).
- **HyperFrames** — junta o vídeo com os gráficos animados (motion) e renderiza o arquivo final.
- **Playwright (opcional)** — abre uma landing page pra extrair a paleta de cores e o conteúdo da marca.
- **Fonte Space Grotesk** — fonte oficial usada nos gráficos (já vem incluída na skill).

## Pré-requisitos
- **Node 22 ou superior + FFmpeg + HyperFrames** instalados (dá pra checar com `npx hyperframes doctor`).
- **Chave da ElevenLabs** configurada num arquivo `elevenlabs.env` (usada pra transcrever). Não precisa abrir nem editar a chave — só precisa existir.
- A **fonte Space Grotesk** que acompanha a skill (a skill copia pro projeto sozinha).
- Playwright só é necessário se quiser extrair a identidade automaticamente de uma landing page.

## Dicas e observações
- O vídeo gravado é sempre a base — a fala é a da pessoa real, não uma voz sintética.
- A transcrição às vezes erra termos técnicos (ex.: "MCP", "Claude") e números. Isso é só o transcritor; o áudio do vídeo está correto e não deve ser "corrigido" por causa disso.
- O ponto que mais costuma sair errado é deixar respiro/silêncio sobrando nas emendas — os cortes são feitos bem apertados, colados na fala, de propósito.
- Os cards de seção servem também pra disfarçar os cortes entre takes, então as trocas de assunto ficam suaves.
- Para gerar vários formatos (16:9, 9:16, 1:1), o vídeo-base é o mesmo; só muda o posicionamento dos gráficos em cada proporção.
- Primeira validação real: o vídeo do ecossistema Expert Integrado (24/06/2026) — 8 min de gravação crua do Eric viraram 3 min editados (Mentoria + AI Innovation Lab + CTA), em 16:9, com a voz real dele e motion sincronizado.
