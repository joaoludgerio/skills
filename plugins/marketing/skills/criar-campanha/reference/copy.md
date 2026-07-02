# Copy — tom, regras e limites de caracteres

Toda copy desta skill segue o tom da Expert Integrado. Releia as memórias `tom-e-regras-conteudo`,
`cta-organico-vs-ads` e `copy-nao-copiar-roteiro` antes de escrever.

## Tom de voz (Eric)

- Prático, educador, **sem hype**. Eric é praticante, não teórico — nunca soar acadêmico.
- Dados e números sempre que possível.
- Primeira pessoa do singular (o Eric fala).
- Português com **acentuação correta**.
- **Nunca usar travessão em copy** (é tell de IA): usar vírgula, dois pontos ou parênteses.

**Pronome (Eric é paulista):** sempre "você / seu / sua" — NUNCA "tu / teu / tua". "te" oblíquo pode
("te mostro"). Imperativos curtos coloquiais OK ("olha", "pensa", "agenda").

### Palavras PROIBIDAS
`revolucionário`, `game-changer`, `transformador`, `disruptivo`, `inovador`, `solução definitiva`

### Palavras BEM-VINDAS
`prático`, `resultado`, `funcionando`, `na prática`, `caso real`, `empresa real`, `dados`, `ROI`

### Regra de promessa
**Nunca prometer resultado específico.** Usar: "resultados como", "clientes nossos chegaram a",
"na média". Vale pra todos os produtos — high ticket inclusive.

## CTA: anúncio ≠ orgânico

Esta skill faz **ANÚNCIO**. CTA de ad aponta pra ação no link/botão:
- ✅ "clique em saiba mais", "toca no botão", "link aqui", "garanta sua vaga"
- ❌ "comenta X", "manda DM", "salva esse post" → isso é CTA orgânico, **não usar em ad**

## Estrutura por criativo (1 dor por criativo)

Use AIDA ou PAS. Cada criativo ataca **uma** dor/ângulo só (ver ângulos por produto em
`produtos.md` e `criativos.md`).

**Texto principal (primary text):**
- Gancho na 1ª linha (a pessoa decide se lê o resto).
- Desenvolve a dor → vira pro produto como saída → CTA.
- Quebras de linha curtas, escaneável.

## Limites de caracteres (Meta — feed/Reels/Stories)

| Campo | Limite seguro (antes do "ver mais") | Máximo técnico |
|---|---|---|
| Texto principal | ~125 caracteres | 2.200 |
| Título (headline) | ~27-40 caracteres | 255 |
| Descrição (link description) | ~27-30 caracteres | 255 |

Regra prática: **o gancho tem que caber nos primeiros ~125 caracteres** do texto principal, porque é
o que aparece antes do "ver mais". Headline curta e direta. **Valide a contagem antes de salvar** cada
peça no `copy.md`.

## Formato do deck (copy.md)

Para cada criativo:

```
### Criativo N — [ângulo] — [formato: imagem/vídeo]
- Texto principal: "<...>"  (XX caracteres; gancho nos primeiros 125)
- Título: "<...>"  (XX caracteres)
- Descrição: "<...>"  (XX caracteres)
- CTA (botão): <ex: LEARN_MORE / SHOP_NOW / SIGN_UP>  → "Saiba mais" / "Comprar agora"
- Destino: <URL/WhatsApp/form confirmado>
```

CTA do botão: usar o enum do Meta (`call_to_action_type`) — ver lista em `meta-config.md`.
Defaults: leads → `LEARN_MORE`; WhatsApp → `WHATSAPP_MESSAGE` ou `MESSAGE_PAGE`; cursos R$97 →
`SHOP_NOW`/`BUY_NOW`; mentoria → `APPLY_NOW`/`BOOK_NOW`.
