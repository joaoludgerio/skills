---
name: demonstracao-agente
description: Orquestra demo ao vivo de uma empresa do zero: imagem gpt-image-2 + carrossel + video HeyGen + site landing completo + jogo + deploy no dominio do Eric. Tudo em paralelo, ~5min. TRIGGER quando Eric pedir "faz um site", "faz uma demonstracao", "monta uma demo", "cria uma empresa de X".
---

Objetivo: receber um tema (empresa ficticia), inventar tudo que faltar, e gerar uma LANDING de empresa de verdade (imagem + carrossel + video + jogo + formulario) em ~5min, no ar no dominio do Eric.

Credenciais (env, fallback 1Password via op read): OPENAI_API_KEY, HEYGEN_API_KEY, ELEVENLABS_API_KEY, VERCEL_TOKEN, CLOUDFLARE_API_TOKEN.

AMBIENTE (agnostico, roda em Windows e Linux): pasta de trabalho WORK=$(mktemp -d), nunca C:/tmp nem /tmp fixo. Foto ref do Eric: repo ericlucianoferreira/agent-assets fotos/eric/eric_avatar_profissional.jpg (se faltar GH token, ja existe clone local em /workspace/agent-assets). Imagem via OpenAI Images API direto por curl, SEMPRE model=gpt-image-2 — NUNCA gpt-image-1 (desatualizado). Detectar binarios com command -v e instalar se faltar (op CLI: baixar de cache.agilebits.com/dist/1P/op2/pkg + OP_SERVICE_ACCOUNT_TOKEN de /home/node/.claude/op_service_account_token).

FLUXO (VIDEO PRIMEIRO — ele e o gargalo ~75s+, entao comeca antes de tudo pra o tempo total = tempo do video, nao a soma):
(1) DISPARAR JA no segundo 0, em BACKGROUND: video HeyGen+ElevenLabs. TTS eleven_turbo_v2_5 -> upload HeyGen asset com curl --data-binary -H "Content-Type: audio/mpeg" (NAO multipart) -> /v2/video/generate (avatar + voice type=audio + input_text obrigatorio) -> poll -> mp4. Avatar Eric: "Eric 2026" bd4f2d9e3ed342a2999b2f585dacc567 (lista em HeyGen GET /v2/avatars). Voz Eric casual: HSqIMKW3FHpkAcy8JJLM (stability 0.35/similarity 0.75/style 0.50/speaker_boost true).
(2) EM PARALELO enquanto o video renderiza: 4 imagens gpt-image-2 (hero high + c1/c2/c3 medium), size 1536x1024 (3:2), "Preserve his exact face and identity" + copy + montar index.html (com a secao de video ja apontando pro mp4).
(3) Video pronto -> baixar mp4 pra site/ -> embutir <video> na secao "video" -> deploy de TUDO junto.

ESTRUTURA (landing real, nao vitrine): nav -> hero -> barra de numeros -> como funciona -> quem esta por tras (autoridade real do Eric) -> carrossel -> video -> jogo -> formulario -> footer.

ANTI-CARA-DE-IA (regra dura): 1) foto com overlay/gradiente, nunca retrato cru gigante; 2) paleta de UMA cor so; 3) icones SVG de linha, nunca emoji nos cards; 4) copy especifica (numeros, autoridade), nunca generica.

CARROSSEL: 3 imagens, .slide img{width:100%;aspect-ratio:3/2;height:auto;object-fit:cover} -> proporcao travada 3:2 (= das imagens geradas), nunca corta. Setas + dots + autoplay.

JOGO: alvos em chips estilizados (borda+glow+pop), nao emoji solto. Alvo dourado +5; alvo errado -3 (evitar); combo x2 (3+)/x3 (6+) com barra; animacao de hit; ranking no fim.

DEPLOY: npm i --prefix /tmp vercel se command -v nao achar. TOKEN: usar VERCEL_TOKEN do .env (item 1P "Token_Vercel_Produto_Claude_Eric", conta expertintegrado, time expert-integrados-projects, teamId team_UAgnWON7MrvFUEjnZinLfUpg). NAO usar o token pessoal (1P VERCEL_API_TOKEN vcp_6480) — esse esta travado por SAML (saml:true) e da 403 em escrita. Deploy: env -u VERCEL_ORG_ID -u VERCEL_PROJECT_ID vercel deploy --prod --yes --token $VTOK --scope expert-integrados-projects. Desabilitar SSO (o projeto nasce com ssoProtection): PATCH /v9/projects/<slug>?teamId=team_UAgnWON7MrvFUEjnZinLfUpg {"ssoProtection":null}. VERIFICAR CONTEUDO (grep do texto + content-type dos assets), nao so HTTP 200 (o nome limpo .vercel.app pode ser de estranho). Entregar o link .vercel.app PRIMEIRO. Dominio proprio <slug>.ericluciano.com.br (CLOUDFLARE_API_TOKEN do 1P item homonimo, cfut_): (a) anexar no Vercel POST /v10/projects/<slug>/domains?teamId=... ; (b) CNAME no Cloudflare (zona ericluciano.com.br id 48ff0f4bd2bf17da3f66e4d739b98e2f, name=<slug>, content=cname.vercel-dns.com, proxied:false); (c) como a zona ja existe noutra conta Vercel, vem verified:false pedindo TXT — ler o verification.value em GET /v9/projects/<slug>/domains/<fqdn> e criar TXT _vercel na zona, depois POST .../verify. SSL leva minutos: confirmar 200 + grep do conteudo ANTES de anunciar.

QA: Playwright (node) pra screenshot antes de entregar (cuidado: print fullPage muito alto estoura PHOTO_INVALID_DIMENSIONS no Telegram — mandar viewport ou redimensionar). EXTRA: QR Code (api.qrserver.com) pro instagram.com/ericluciano quando pedir. ENTREGA: URL + print via Telegram. REGRAS: nunca perguntar, inventar tudo; video disparado PRIMEIRO e em background; limpar WORK no fim.

HISTORICO: v3 (18/06/2026) estrutura de landing real + anti-cara-de-IA + carrossel 3:2 + jogo gold/penalidade/combo + deploy robusto + paths agnosticos. Validado em 5 demos: Cano Mestre, EcoRota, NovaFibra, Codeflow, Sapatto Mania. v3.1 (30/06/2026): VIDEO-FIRST (gargalo disparado no segundo 0) + token/scope Vercel corrigido (expert-integrados-projects, token pessoal travado por SAML) + TXT de verificacao de dominio + avatar/voz Eric fixados. Validado na demo "Eric Domador de Leoes".
