/**
 * add-descriptions.js
 *
 * Adiciona propriedades `description` e `section` aos campos customizados do config.js
 * baseado na Diretriz de Preenchimento do CRM.
 *
 * Uso: node add-descriptions.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, 'config.js');

// ─── Ler e parsear o config.js ───────────────────────────────────────────────

const rawFile = readFileSync(configPath, 'utf-8');

// Extrair o objeto CONFIG do arquivo JS
const match = rawFile.match(/export\s+const\s+CONFIG\s*=\s*(\{[\s\S]*\});?\s*$/);
if (!match) {
  console.error('Não consegui parsear o CONFIG do config.js');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(match[1]);
} catch (e) {
  // Se não for JSON puro, tentar eval (o arquivo usa export const, então deve ser JSON-like)
  console.error('Erro ao parsear JSON:', e.message);
  process.exit(1);
}

// ─── Definições de description e section para deal_custom_fields ─────────────

const dealFieldMeta = {
  // === SEÇÃO 1: Pré-qualificação ===
  "Informações gerais": {
    description: "Dados relevantes da empresa: modelo de negócio, unidades, localização, particularidades. Preencher antes da reunião.",
    section: "pre_qualificacao"
  },
  "Mídias e redes da empresa": {
    description: "Links de Instagram, site, LinkedIn e outras redes da empresa. Para pesquisa pré-reunião.",
    section: "pre_qualificacao"
  },
  "Segmento": {
    description: "Nicho/setor da empresa. Selecionar a opção mais próxima. Ex: Clínica Médica, SaaS, Varejo.",
    section: "pre_qualificacao"
  },
  "Nicho (detalhes adicionais": {
    description: "Complemento do Segmento. Descrição específica do nicho. Ex: 'Advocacia trabalhista, foco em grandes empresas'.",
    section: "pre_qualificacao"
  },
  "Produtos que oferece": {
    description: "O que a empresa do prospect vende. Serviços/produtos detalhados. Ex: 'Implantes, clareamento, lentes'.",
    section: "pre_qualificacao"
  },
  "Nº atendimentos por mês": {
    description: "Volume de leads/atendimentos por mês. Selecionar faixa que contém o número citado. Se não sabe: INFORMAÇÃO PENDENTE.",
    section: "pre_qualificacao"
  },
  "Tamanho da equipe comercial": {
    description: "Número exato de pessoas no time comercial (SDR, closer, CS, promotor — todos contam). Ex: 12.",
    section: "pre_qualificacao"
  },
  "Total de colaboradores": {
    description: "Total de funcionários da empresa toda. Selecionar faixa. Se não sabe: INFORMAÇÃO PENDENTE.",
    section: "pre_qualificacao"
  },

  // === SEÇÃO 2: Informações do Negócio (SPICED) ===
  "Como funcionam o processos da empresa": {
    description: "Como o prospect qualifica leads. Perguntas, formulários, critérios, fluxo de qualificação.",
    section: "informacoes_negocio"
  },
  "Tipo de venda": {
    description: "Como a empresa vende. Multi-seleção: agenda reunião, vende por WA/IG, site, transfere lead.",
    section: "informacoes_negocio"
  },
  "Funis de vendas utilizados": {
    description: "Fluxo completo do lead. De onde vem e caminho que percorre. Ex: 'Anúncio IG > LP > Form > SDR > WA'.",
    section: "informacoes_negocio"
  },
  "Canais de atendimento atuais": {
    description: "Canais que a empresa do prospect já usa para atender leads/clientes. Multi-seleção.",
    section: "informacoes_negocio"
  },
  "Tamanho acumulado da lista de leads": {
    description: "Base ACUMULADA de contatos (leads antigos + novos). Importante para re-prospecção de base.",
    section: "informacoes_negocio"
  },
  "Detalhes sobre volume de Leads e Clientes": {
    description: "Números EXATOS citados pelo prospect. Complementa os enums. Ex: '3.700 leads, 300 novos/mês, 8% conversão'.",
    section: "informacoes_negocio"
  },
  "Estrutura de colaboradores": {
    description: "Detalhes da equipe com cargos e divisões. Quem faz o quê. Ex: '5 SDRs, 3 closers, 2 CS'.",
    section: "informacoes_negocio"
  },
  "Dores": {
    description: "Frustrações VERBALIZADAS pelo prospect. Só preencher se usou palavras como 'problema', 'dificuldade'. Na dúvida, deixar em branco.",
    section: "informacoes_negocio"
  },
  "Objetivos com a automação": {
    description: "O que o prospect QUER ALCANÇAR. Complemento de Dores. Ex: 'Automatizar follow-up, dashboard de performance'.",
    section: "informacoes_negocio"
  },
  "Oportunidades de melhoria": {
    description: "O que NÓS podemos fazer. Features, campanhas, automações dos nossos produtos que resolvem os problemas dele.",
    section: "informacoes_negocio"
  },
  "Nível de prioridade da contratação": {
    description: "Urgência da contratação. Baixa (sem urgência), Média (sem prazo), Alta (tem prazo), Crítica (urgente).",
    section: "informacoes_negocio"
  },
  "Automações que utiliza atualmente": {
    description: "Automações que o prospect JÁ tem rodando. Ferramentas e fluxos. Ex: 'Chatbot Manychat, disparo RD Station'.",
    section: "informacoes_negocio"
  },
  "Ferramenta de WhatsApp atual": {
    description: "Ferramenta de WA que o prospect usa hoje. Se usa WA básico: 'WhatsApp Web'.",
    section: "informacoes_negocio"
  },
  "CRM atual": {
    description: "CRM que o prospect usa hoje. Excel/planilha/nada = 'Não utiliza'. Só CRM real.",
    section: "informacoes_negocio"
  },
  "Outras ferramentas": {
    description: "Ferramentas que não se encaixam em WA/CRM. ERPs, email marketing, gestão. Se WA/CRM não está na lista, descrever aqui.",
    section: "informacoes_negocio"
  },

  // === Campos sem playbook mas na config (Seção 2 — validação técnica) ===
  "Domínio de IA na empresa": {
    description: "Nível de maturidade em IA da empresa do prospect. Nenhum, Iniciante, Intermediário, Avançado.",
    section: "informacoes_negocio"
  },
  "Soluções de IA que utiliza hoje": {
    description: "Ferramentas de IA que o prospect já usa. Multi-seleção: LLMs, construtores, Claude Code, integradores, editores.",
    section: "informacoes_negocio"
  },

  // === SEÇÃO 3: Negociações Comerciais ===
  "Unidade de Negócio": {
    description: "Funil Super SDR = Projeto. Funil SaaS = SaaS. Funil Educacional = Educacional. Se não sabe: Não definido.",
    section: "negociacoes_comerciais"
  },
  "CRM que será integrado": {
    description: "CRM que vamos integrar no projeto. Só se aplica para plano Gold. Se sem integração: 'Sem integração'.",
    section: "negociacoes_comerciais"
  },
  "WhatsApp que será integrado": {
    description: "Ferramenta de WA que vamos usar na integração. Prospect escolhe entre as que integramos.",
    section: "negociacoes_comerciais"
  },
  "Instagram que será integrado": {
    description: "Plataforma de Instagram que será integrada no projeto. Sem integração ou ManyChat.",
    section: "negociacoes_comerciais"
  },
  "Forma de Pagamento": {
    description: "Como vai pagar. Ex: 'Cartão 6x' ou 'PIX à vista com 10% desconto no setup'.",
    section: "negociacoes_comerciais"
  },
  "Especificações do projeto": {
    description: "Detalhes técnicos para o CS: expectativas, pedidos especiais, particularidades do projeto. Preencher no fechamento.",
    section: "negociacoes_comerciais"
  },
  "Ferramentas adicionais que deverão ser contratadas": {
    description: "Ferramentas que o cliente precisa contratar para o projeto funcionar. Multi-seleção: Manychat, Eleven Labs, Z-API, etc.",
    section: "negociacoes_comerciais"
  },
  "Negociações adicionais": {
    description: "Descontos extras, concessões, add-ons. Info que o CS precisa saber. Ex: '+1 número WA grátis, 15% off setup'.",
    section: "negociacoes_comerciais"
  },
  "Prazo acordado": {
    description: "Prazo de entrega do projeto. Default: 30 dias. Ex: '15 dias úteis'.",
    section: "negociacoes_comerciais"
  },
  "Link do Clickup": {
    description: "AUTOMÁTICO — preenchido por automação. NÃO preencher manualmente.",
    section: "negociacoes_comerciais"
  },
  "Link da Proposta": {
    description: "AUTOMÁTICO — preenchido por automação. NÃO preencher manualmente.",
    section: "negociacoes_comerciais"
  },

  // === ORIGEM ===
  "Origem da Oportunidade": {
    description: "De onde veio ESTE deal. Pode mudar entre deals da mesma pessoa. Categorias: ORG, SS, OUT, INDIC, BASE, ADS, EVENTO.",
    section: "origem"
  },
  "Detalhes da origem da oportunidade": {
    description: "Contexto adicional da origem. Ex: 'Veio pelo post sobre CRM' ou 'Reativação após 90 dias'.",
    section: "origem"
  },
  "Pessoa que indicou": {
    description: "Nome de quem indicou. Só preencher se o deal veio por indicação. Se não foi indicação: deixar em branco.",
    section: "origem"
  },
  "Telefone de atendimento": {
    description: "Em qual telefone/chip a conversa está acontecendo. Registro interno. Não precisa preencher via transcrição.",
    section: "origem"
  },
  "Responsável por agendar a reunião": {
    description: "Quem agendou a reunião. Se foi IA/Super SDR: selecionar 'Expert Integrado'.",
    section: "origem"
  },

  // === EXCLUIR ===
  "Tempo de mercado": {
    description: "EXCLUIR — não preencher",
    section: "excluir"
  },
  "Faturamento mensal": {
    description: "EXCLUIR — não preencher",
    section: "excluir"
  },
  "Nicho (antigo)": {
    description: "EXCLUIR — não preencher",
    section: "excluir"
  },
  "Empresa (desativado)": {
    description: "EXCLUIR — não preencher",
    section: "excluir"
  },

  // === PAUSADOS ===
  "Temperatura Prospecção": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  },
  "Status da Prospecção": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  },
  "Canal de Comunicação": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  },
  "Briefing Prospecção": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  },
  "Resumo Prospecção": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  },
  "Insights técnicos": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  },
  "Insigths de Vendas": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  },
  "UTM": {
    description: "PAUSADO — não preencher até nova orientação",
    section: "pausado"
  }
};

// ─── Definições de description para person_custom_fields ─────────────────────

const personFieldMeta = {
  "Origem do Contato": {
    description: "De onde veio o contato. Preenchido 1x na vida (primeiro contato). NUNCA muda entre deals."
  },
  "Detalhes da origem do contato": {
    description: "Contexto adicional da origem do contato. Complemento da Origem do Contato."
  },
  "Cargo": {
    description: "Cargo do contato na empresa. SPICED-D (Decision)."
  },
  "Nível de decisão": {
    description: "Se o contato é decisor. Único decisor, Sócio decisor ou Não é decisor. SPICED-D."
  },
  "Link do Chat": {
    description: "Link direto para o chat do contato no ChatGuru (atendimento principal)."
  },
  "Instagram": {
    description: "@ do Instagram pessoal do contato."
  },
  "Linkedin": {
    description: "URL do perfil LinkedIn do contato."
  },
  "Manychat @expertintegrado": {
    description: "ID ou link do subscriber no ManyChat do perfil @expertintegrado."
  },
  "Manychat @ericluciano": {
    description: "ID ou link do subscriber no ManyChat do perfil @ericluciano."
  },
  "Link do Chat Disparador": {
    description: "Link do chat no ChatGuru usado para disparos/campanhas (chip disparador)."
  },
  "Whatsapp chat link": {
    description: "Link direto wa.me para abrir conversa no WhatsApp com o contato."
  }
};

// ─── Aplicar description e section nos deal fields ───────────────────────────

for (const [fieldName, fieldData] of Object.entries(config.deal_custom_fields)) {
  const meta = dealFieldMeta[fieldName];
  if (meta) {
    fieldData.description = meta.description;
    fieldData.section = meta.section;
  } else {
    // Campo existe no config mas não tem mapeamento — gerar descrição genérica
    console.warn(`Deal field sem mapeamento: "${fieldName}" — adicionando descrição genérica.`);
    fieldData.description = `Campo: ${fieldName}`;
    fieldData.section = "informacoes_negocio";
  }
}

// ─── Aplicar description nos person fields ───────────────────────────────────

for (const [fieldName, fieldData] of Object.entries(config.person_custom_fields)) {
  const meta = personFieldMeta[fieldName];
  if (meta) {
    fieldData.description = meta.description;
  } else {
    console.warn(`Person field sem mapeamento: "${fieldName}" — adicionando descrição genérica.`);
    fieldData.description = `Campo: ${fieldName}`;
  }
}

// ─── Reescrever o config.js ──────────────────────────────────────────────────

const header = `// Configuração unificada do Pipedrive MCP — gerada por sync_all
// Sincronizado em ${config.synced_at}
// Distribuir este arquivo para funcionários que não têm permissão de sync
// Descriptions e sections adicionados por add-descriptions.js em ${new Date().toISOString().slice(0, 10)}

`;

const output = header + `export const CONFIG = ${JSON.stringify(config, null, 2)};\n`;

writeFileSync(configPath, output, 'utf-8');

console.log('config.js atualizado com sucesso!');
console.log(`  - ${Object.keys(config.deal_custom_fields).length} deal fields processados`);
console.log(`  - ${Object.keys(config.person_custom_fields).length} person fields processados`);
