# CRM e Sistema de Automação - Pousada Luz da Lua
Documentação Técnica Completa

ÍNDICE

Visão Geral
Arquitetura do Sistema
Stack Tecnológica
Banco de Dados
API REST
Fluxos de Negócio
Integração WhatsApp
Automações com n8n
Dashboard e Relatórios
Segurança e Compliance
Roadmap de Implementação


## 1. Visão Geral
Objetivo
Automatizar o ciclo completo de vendas de grupos para a Pousada Luz da Lua:

Captação: Leads via Meta Ads (Facebook/Instagram)
Qualificação: IA (Claude) via WhatsApp
Conversão: Propostas automáticas e negociação
Fechamento: Pagamento de sinal e confirmação
Relacionamento: Follow-ups e upsells automáticos

Benefícios Esperados
MétricaEsperadoTaxa de conversão+40%Tempo de resposta<2 minCusto por aquisição-30%Ocupação média+25%Receita anual+50%

## 2. Arquitetura do Sistema
Diagrama de Fluxo Completo
Copy┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE CAPTAÇÃO                        │
│  Facebook Ads │ Instagram Ads │ Google Ads │ Organic        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              META CLOUD API (WhatsApp)                       │
│  ├─ Webhook de mensagens recebidas                          │
│  ├─ Envio de mensagens automáticas                          │
│  └─ Templates de proposta                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                    LUNA (Claude AI)                          │
│  ├─ Processamento de linguagem natural                       │
│  ├─ Extração de dados da conversa                           │
│  ├─ Decisão de qualificação                                 │
│  └─ Geração de respostas contextualizado                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│            API BACKEND (Next.js + Vercel)                   │
│  ├─ /api/webhooks/whatsapp                                  │
│  ├─ /api/leads                                              │
│  ├─ /api/reservas                                           │
│  ├─ /api/propostas                                          │
│  └─ /api/disponibilidade                                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│         DATABASE (Supabase PostgreSQL)                       │
│  ├─ Leads │ Reservas │ Disponibilidade                      │
│  ├─ Conversas │ Follow-ups │ Clientes                       │
│  └─ Pagamentos │ Logs de IA │ Métricas                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        ↓         ↓         ↓
    ┌───────┐ ┌──────┐ ┌──────────┐
    │ n8n   │ │Zapier│ │Task Queue│
    │(Auto) │ │(Auto)│ │(Bullmq)  │
    └───────┘ └──────┘ └──────────┘
        │         │         │
        └─────────┼─────────┘
                  ↓
        ┌──────────────────────┐
        │   AUTOMAÇÕES         │
        │ ├─ Follow-ups        │
        │ ├─ Lembretes         │
        │ ├─ Confirmações      │
        │ └─ Upsells           │
        └──────────────────────┘
                  │
                  ↓
        ┌──────────────────────┐
        │     DASHBOARD        │
        │  Next.js + Shadcn UI │
        │  ├─ Métricas         │
        │  ├─ Reservas         │
        │  ├─ Leads            │
        │  └─ Receita          │
        └──────────────────────┘
Componentes Principais
```javascript
// Estrutura de diretórios
pousada-crm/
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── leads/
│   │   │   ├── reservas/
│   │   │   ├── disponibilidade/
│   │   │   └── relatorios/
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── whatsapp.ts
│   │   │   ├── leads/
│   │   │   ├── reservas/
│   │   │   ├── propostas/
│   │   │   ├── disponibilidade/
│   │   │   └── ia/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── LeadCard/
│   │   ├── ReservaForm/
│   │   └── PropostaTemplate/
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── whatsapp.ts
│   │   ├── claude.ts
│   │   └── calculos.ts
│   └── package.json
├── backend/
│   ├── jobs/
│   │   ├── followup.job.ts
│   │   ├── reminder.job.ts
│   │   └── upsell.job.ts
│   ├── services/
│   │   ├── whatsapp.service.ts
│   │   ├── ia.service.ts
│   │   └── pagamento.service.ts
│   └── package.json
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema.sql
└── .env.example

3. Stack Tecnológica
Detalhamento Completo
Frontend
```
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@shadcn/ui": "^0.8.0",
    "tailwindcss": "^3.3.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.48.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "date-fns": "^2.30.0",
    "recharts": "^2.10.0",
    "react-hot-toast": "^2.4.0"
  }
}
Backend
```
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0",
    "@anthropic-ai/sdk": "^0.9.0",
    "axios": "^1.6.0",
    "node-cron": "^3.0.0",
    "bull": "^4.11.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.0",
    "pino": "^8.16.0"
  }
}
Infraestrutura
```
```yaml
Hosting:
  - Frontend: Vercel
  - Backend: Vercel / Railway
  - Database: Supabase Cloud
  - Storage: Supabase Storage / S3
  
Automação:
  - n8n (Self-hosted ou Cloud)
  - Bull Queue (Redis)
  
APIs Externas:
  - Meta Cloud API (WhatsApp)
  - Anthropic Claude API
  - Stripe / MercadoPago (Pagamentos)

4. Banco de Dados
Schema PostgreSQL Completo
```
```sql
-- ============================================
-- 1. TABELA DE CLIENTES/LEADS
-- ============================================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_whatsapp VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    tamanho_grupo INT NOT NULL,
    tipo_grupo VARCHAR(50), -- Família, Amigos, Casal, Corporativo, Outros
    datas_interesse_inicio DATE,
    datas_interesse_fim DATE,
    origem_lead VARCHAR(50), -- Facebook, Instagram, Google, Referral, Organic
    estagio_funil VARCHAR(50) DEFAULT 'novo', -- novo, qualificado, proposta, negociacao, confirmado, perdido
    pontuacao_qualificacao INT DEFAULT 0,
    valor_estimado DECIMAL(10, 2),
    notas TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    deletado_em TIMESTAMP,
    
    CONSTRAINT tamanho_grupo_positive CHECK (tamanho_grupo > 0)
);

-- ============================================
-- 2. TABELA DE CONVERSAS (HISTÓRICO)
-- ============================================
CREATE TABLE conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    numero_whatsapp VARCHAR(20) NOT NULL,
    tipo_mensagem VARCHAR(20), -- entrada, saida
    conteudo_mensagem TEXT NOT NULL,
    resposta_ia TEXT,
    intencao_detectada VARCHAR(100), -- duvida_preco, duvida_disponibilidade, pronto_para_reservar, etc
    dados_extraidos JSONB, -- Dados estruturados extraídos pela IA
    token_usage JSONB, -- Monitoramento de uso de API
    criado_em TIMESTAMP DEFAULT NOW(),
    
    INDEX (lead_id),
    INDEX (numero_whatsapp),
    INDEX (criado_em)
);

-- ============================================
-- 3. TABELA DE DISPONIBILIDADE
-- ============================================
CREATE TABLE disponibilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    numero_quartos_total INT NOT NULL DEFAULT 10,
    quartos_disponiveis INT NOT NULL,
    preco_por_pessoa DECIMAL(10, 2) NOT NULL,
    preco_casal DECIMAL(10, 2),
    preco_grupo_5plus DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'disponivel', -- disponivel, bloqueado, fechado
    motivo_bloqueio VARCHAR(200),
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT data_valida CHECK (data >= CURRENT_DATE),
    CONSTRAINT quartos_valido CHECK (quartos_disponiveis >= 0 AND quartos_disponiveis <= numero_quartos_total),
    UNIQUE (data)
);

-- ============================================
-- 4. TABELA DE RESERVAS
-- ============================================
CREATE TABLE reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    numero_whatsapp VARCHAR(20) NOT NULL,
    data_checkin DATE NOT NULL,
    data_checkout DATE NOT NULL,
    numero_pessoas INT NOT NULL,
    numero_quartos INT NOT NULL,
    preco_por_pessoa DECIMAL(10, 2) NOT NULL,
    valor_diaria DECIMAL(10, 2) NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL,
    valor_sinal DECIMAL(10, 2) NOT NULL,
    sinal_pago BOOLEAN DEFAULT FALSE,
    data_pagamento_sinal TIMESTAMP,
    metodo_pagamento VARCHAR(50), -- pix, boleto, cartao
    comprovante_pagamento VARCHAR(500),
    valor_restante DECIMAL(10, 2),
    status_reserva VARCHAR(50) DEFAULT 'pendente', -- pendente, sinal_confirmado, confirmada, cancelada, hospedado, concluida
    observacoes_cliente TEXT,
    observacoes_internas TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    cancelado_em TIMESTAMP,
    
    CONSTRAINT datas_validas CHECK (data_checkout > data_checkin),
    CONSTRAINT pessoas_positivo CHECK (numero_pessoas > 0),
    CONSTRAINT quartos_positivo CHECK (numero_quartos > 0),
    CONSTRAINT valor_valido CHECK (valor_total > 0),
    INDEX (lead_id),
    INDEX (numero_whatsapp),
    INDEX (status_reserva),
    INDEX (data_checkin)
);

-- ============================================
-- 5. TABELA DE PROPOSTAS
-- ============================================
CREATE TABLE propostas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    numero_proposta VARCHAR(50) UNIQUE NOT NULL,
    data_checkin DATE NOT NULL,
    data_checkout DATE NOT NULL,
    numero_pessoas INT NOT NULL,
    numero_quartos INT NOT NULL,
    valor_diaria DECIMAL(10, 2) NOT NULL,
    numero_diarias INT NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL,
    desconto_aplicado DECIMAL(10, 2) DEFAULT 0,
    valor_com_desconto DECIMAL(10, 2),
    percentual_desconto INT DEFAULT 0,
    motivo_desconto TEXT,
    inclusos TEXT[], -- wifi, cafe_da_manha, piscina, etc
    taxa_servico DECIMAL(10, 2) DEFAULT 0,
    valor_final DECIMAL(10, 2) NOT NULL,
    percentual_sinal INT DEFAULT 30,
    valor_sinal DECIMAL(10, 2) NOT NULL,
    status_proposta VARCHAR(50) DEFAULT 'enviada', -- enviada, visualizada, aceita, rejeitada, expirada
    data_envio TIMESTAMP DEFAULT NOW(),
    data_visualizacao TIMESTAMP,
    data_resposta TIMESTAMP,
    validade_proposta_dias INT DEFAULT 7,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valor_valido CHECK (valor_total > 0),
    INDEX (lead_id),
    INDEX (status_proposta)
);

-- ============================================
-- 6. TABELA DE FOLLOW-UPS
-- ============================================
CREATE TABLE followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    numero_whatsapp VARCHAR(20) NOT NULL,
    tipo_followup VARCHAR(50), -- qualificacao, proposta, confirmacao, lembrete_checkin, pos_hospedagem, upsell
    status VARCHAR(50) DEFAULT 'agendado', -- agendado, enviado, respondido, cancelado
    data_agendada TIMESTAMP NOT NULL,
    data_envio TIMESTAMP,
    mensagem_template TEXT,
    resposta_lead TEXT,
    data_resposta TIMESTAMP,
    tentativas INT DEFAULT 0,
    proxima_tentativa TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    
    INDEX (lead_id),
    INDEX (status),
    INDEX (data_agendada)
);

-- ============================================
-- 7. TABELA DE PAGAMENTOS
-- ============================================
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    numero_transacao VARCHAR(100) UNIQUE NOT NULL,
    tipo_pagamento VARCHAR(50), -- sinal, restante, completo
    valor DECIMAL(10, 2) NOT NULL,
    metodo VARCHAR(50), -- pix, boleto, cartao, dinheiro
    status VARCHAR(50) DEFAULT 'pendente', -- pendente, processando, confirmado, falhou, reembolsado
    data_solicitacao TIMESTAMP DEFAULT NOW(),
    data_confirmacao TIMESTAMP,
    comprovante_url VARCHAR(500),
    chave_pix VARCHAR(100),
    id_externo_stripe VARCHAR(100),
    id_externo_mercadopago VARCHAR(100),
    erro_mensagem TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    
    INDEX (reserva_id),
    INDEX (status),
    INDEX (data_solicitacao)
);

-- ============================================
-- 8. TABELA DE LOGS DE IA
-- ============================================
CREATE TABLE logs_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    modelo VARCHAR(50) DEFAULT 'claude-3-sonnet',
    input_tokens INT,
    output_tokens INT,
    total_tokens INT,
    tempo_processamento_ms INT,
    custo_estimado DECIMAL(10, 4),
    status VARCHAR(50) DEFAULT 'sucesso', -- sucesso, erro, timeout
    erro_mensagem TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    
    INDEX (lead_id),
    INDEX (criado_em)
);

-- ============================================
-- 9. TABELA DE MÉTRICAS DIÁRIAS
-- ============================================
CREATE TABLE metricas_diarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL UNIQUE,
    novos_leads INT DEFAULT 0,
    leads_qualificados INT DEFAULT 0,
    propostas_enviadas INT DEFAULT 0,
    propostas_aceitas INT DEFAULT 0,
    reservas_confirmadas INT DEFAULT 0,
    taxa_conversao_leads DECIMAL(5, 2),
    taxa_conversao_propostas DECIMAL(5, 2),
    receita_dia DECIMAL(12, 2),
    receita_acumulada DECIMAL(12, 2),
    ocupacao_pousada INT,
    quartos_ocupados INT,
    quartos_disponiveis INT,
    custos_ads DECIMAL(10, 2),
    custo_por_lead DECIMAL(10, 2),
    roi_ads DECIMAL(5, 2),
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 10. TABELA DE SETTINGS
-- ============================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    tipo VARCHAR(50), -- string, numero, boolean, json
    descricao TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================
CREATE INDEX idx_leads_estagio_funil ON leads(estagio_funil);
CREATE INDEX idx_leads_criado_em ON leads(criado_em);
CREATE INDEX idx_reservas_data_checkin ON reservas(data_checkin);
CREATE INDEX idx_reservas_status ON reservas(status_reserva);
CREATE INDEX idx_propostas_status ON propostas(status_proposta);
CREATE INDEX idx_disponibilidade_data ON disponibilidade(data);

-- ============================================
-- VIEWS ÚTEIS
-- ============================================
CREATE VIEW vw_leads_ativos AS
SELECT * FROM leads
WHERE deletado_em IS NULL
AND estagio_funil NOT IN ('perdido', 'cancelado');

CREATE VIEW vw_receita_projetada AS
SELECT 
    COALESCE(SUM(CASE WHEN status_reserva = 'confirmada' THEN valor_total ELSE 0 END), 0) as receita_confirmada,
    COALESCE(SUM(CASE WHEN status_reserva = 'pendente' THEN valor_total ELSE 0 END), 0) as receita_pendente,
    COALESCE(SUM(valor_total), 0) as receita_total
FROM reservas
WHERE deletado_em IS NULL;

CREATE VIEW vw_ocupacao_por_data AS
SELECT 
    r.data_checkin,
    r.data_checkout,
    COUNT(DISTINCT r.id) as numero_reservas,
    SUM(r.numero_pessoas) as pessoas_totais,
    SUM(r.numero_quartos) as quartos_ocupados
FROM reservas r
WHERE r.status_reserva IN ('confirmada', 'hospedado')
GROUP BY r.data_checkin, r.data_checkout;

-- ============================================
-- RLS (ROW LEVEL SECURITY) - Segurança
-- ============================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead policy" ON leads
    FOR ALL
    USING (auth.uid() = user_id OR current_user_role() = 'admin');
```
Diagrama ER
Copy┌─────────────┐          ┌──────────────┐
│   LEADS     │◄─────────┤  CONVERSAS   │
│             │    1:N   │              │
└─────────────┘          └──────────────┘
      │
      │ 1:N
      │
      ├──────────────┬──────────────┬──────────────┐
      │              │              │              │
      ↓              ↓              ↓              ↓
┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐
│RESERVAS  │ │  PROPOSTAS   │ │FOLLOWUPS │ │  PAGAMENTOS  │
└──────────┘ └──────────────┘ └──────────┘ └──────────────┘
      │              │
      │              └────────────┬───────────┐
      │                          │           │
      ↓                          ↓           ↓
┌──────────────────┐    ┌──────────────┐ ┌───────────┐
│DISPONIBILIDADE   │    │  LOGS_IA     │ │PAGAMENTOS │
└──────────────────┘    └──────────────┘ └───────────┘

## 5. API REST
Endpoints Principais
```javascript
// ============================================
// WEBHOOK - RECEBIMENTO DE MENSAGENS
// ============================================

POST /api/webhooks/whatsapp
Body: {
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: "551299999999",
          id: "wamid...",
          timestamp: "1234567890",
          text: { body: "Olá, gostaria de saber..." },
          type: "text"
        }]
      }
    }]
  }]
}
Response: { status: "received" }

// ============================================
// LEADS - GESTÃO DE LEADS
// ============================================

// Criar novo lead
POST /api/leads
Body: {
  numero_whatsapp: "5512999999999",
  nome: "João Silva",
  tamanho_grupo: 8,
  tipo_grupo: "Família",
  origem_lead: "Facebook"
}
Response: {
  id: "uuid-123",
  numero_whatsapp: "5512999999999",
  estagio_funil: "novo",
  criado_em: "2024-01-15T10:30:00Z"
}

// Listar leads com filtros
GET /api/leads?estagio=qualificado&origem=Facebook&limite=20&pagina=1
Response: {
  total: 45,
  pagina: 1,
  dados: [{...}, {...}]
}

// Obter lead específico com histórico completo
GET /api/leads/:leadId
Response: {
  id: "uuid-123",
  numero_whatsapp: "5512999999999",
  nome: "João Silva",
  conversas: [{...}, {...}],
  reservas: [{...}],
  propostas: [{...}],
  followups_proximos: [{...}]
}

// Atualizar lead (pontuação, estágio, notas)
PATCH /api/leads/:leadId
Body: {
  estagio_funil: "qualificado",
  pontuacao_qualificacao: 85,
  notas: "Grupo interessado em fevereiro"
}

// Deletar lead (soft delete)
DELETE /api/leads/:leadId

// ============================================
// DISPONIBILIDADE - CALENDÁRIO
// ============================================

// Obter disponibilidade para período
GET /api/disponibilidade?data_inicio=2024-02-01&data_fim=2024-02-29
Response: {
  dados: [
    {
      data: "2024-02-01",
      quartos_disponiveis: 8,
      preco_por_pessoa: 150.00,
      status: "disponivel"
    },
    ...
  ]
}

// Verificar disponibilidade específica
GET /api/disponibilidade/verificar
Query: {
  data_checkin: "2024-02-15",
  data_checkout: "2024-02-18",
  numero_pessoas: 8,
  numero_quartos: 3
}
Response: {
  disponivel: true,
  quartos_necessarios: 3,
  quartos_disponiveis: 5,
  preco_total: 1800.00,
  detalhes_diaria: [...]
}

// Atualizar disponibilidade
PATCH /api/disponibilidade/:data
Body: {
  quartos_disponiveis: 5,
  preco_por_pessoa: 160.00,
  status: "disponivel"
}

// ============================================
// PROPOSTAS - GERAÇÃO E GESTÃO
// ============================================

// Gerar proposta automática
POST /api/propostas
Body: {
  lead_id: "uuid-lead",
  data_checkin: "2024-02-15",
  data_checkout: "2024-02-18",
  numero_pessoas: 8,
  numero_quartos: 3,
  percentual_desconto: 10,
  motivo_desconto: "Grupo grande"
}
Response: {
  id: "uuid-proposta",
  numero_proposta: "PROP-2024-00001",
  valor_total: 1800.00,
  valor_com_desconto: 1620.00,
  valor_sinal: 486.00,
  status_proposta: "gerada"
}

// Enviar proposta via WhatsApp
POST /api/propostas/:propostaId/enviar
Response: {
  mensagem_id: "wamid...",
  status: "enviada",
  data_envio: "2024-01-15T10:30:00Z"
}

// Atualizar status de proposta (visualizada, aceita, rejeitada)
PATCH /api/propostas/:propostaId
Body: {
  status_proposta: "aceita",
  data_resposta: "2024-01-15T12:30:00Z"
}

// Listar propostas
GET /api/propostas?status=enviada&lead_id=uuid&limite=50
Response: {
  total: 120,
  dados: [{...}, {...}]
}

// ============================================
// RESERVAS - CONFIRMAÇÃO E GESTÃO
// ============================================

// Criar reserva (após aceitar proposta)
POST /api/reservas
Body: {
  lead_id: "uuid-lead",
  data_checkin: "2024-02-15",
  data_checkout: "2024-02-18",
  numero_pessoas: 8,
  numero_quartos: 3,
  valor_total: 1620.00,
  valor_sinal: 486.00
}
Response: {
  id: "uuid-reserva",
  numero_reserva: "RES-2024-00001",
  status_reserva: "pendente",
  valor_sinal: 486.00,
  link_pagamento: "https://..."
}

// Gerar link de pagamento PIX
POST /api/reservas/:reservaId/gerar-pix
Response: {
  chave_pix: "uuid-pix",
  qr_code: "00020126...",
  valor: 486.00,
  expiracao: "2024-01-16T10:30:00Z"
}

// Confirmar pagamento manualmente
POST /api/reservas/:reservaId/confirmar-pagamento
Body: {
  valor: 486.00,
  comprovante_url: "s3://...",
  metodo: "pix"
}

// Listar reservas com filtros
GET /api/reservas?status=confirmada&data_inicio=2024-02-01&data_fim=2024-02-29
Response: {
  total: 15,
  dados: [{...}, {...}],
  ocupacao: {
    quartos_ocupados: 28,
    quartos_disponiveis: 2,
    percentual_ocupacao: 93
  }
}

// Obter detalhes da reserva
GET /api/reservas/:reservaId
Response: {
  id: "uuid-reserva",
  lead: {...},
  datas: {...},
  pagamentos: [{...}, {...}],
  checkins_anteriores: [{...}]
}

// Cancelar reserva
DELETE /api/reservas/:reservaId
Body: {
  motivo: "Cliente solicitou cancelamento",
  gerar_reembolso: true
}

// ============================================
// IA - PROCESSAMENTO E QUALIFICAÇÃO
// ============================================

// Processar mensagem com IA
POST /api/ia/processar-mensagem
Body: {
  numero_whatsapp: "5512999999999",
  mensagem: "Olá, tenho um grupo de 10 pessoas...",
  contexto_lead: {
    nome: "João",
    historico: [{...}, {...}]
  }
}
Response: {
  intencao: "qualificar_grupo",
  dados_extraidos: {
    tamanho_grupo: 10,
    datas_interesse: "fevereiro",
    tipo_grupo: "Amigos"
  },
  resposta_sugerida: "Ótimo João! Tenho interesse...",
  proxima_acao: "gerar_proposta",
  score_confianca: 0.95
}

// Gerar proposta com IA
POST /api/ia/gerar-proposta
Body: {
  lead_id: "uuid-lead",
  preferencias_cliente: {
    data_checkin: "2024-02-15",
    numero_pessoas: 10
  }
}
Response: {
  proposta_gerada: {
    valor_total: 1800.00,
    desconto_sugerido: 5,
    inclusoes: ["wifi", "cafe_da_manha"],
    observacoes_ia: "Grupo grande merece desconto..."
  }
}

// Analisar conversa para insights
POST /api/ia/analisar-conversa
Body: {
  lead_id: "uuid-lead"
}
Response: {
  score_qualificacao: 85,
  motivos_positivos: ["Grupo grande", "Data confirmada", "Orçamento flexível"],
  motivos_negativos: ["Aguardando resposta do grupo"],
  recomendacoes: ["Enviar proposta hoje", "Follow-up em 2 dias"],
  probabilidade_conversao: 0.78
}

// ============================================
// AUTOMAÇÕES - FOLLOW-UPS
// ============================================

// Listar follow-ups agendados
GET /api/followups?status=agendado&proximos_dias=7
Response: {
  total: 23,
  dados: [{...}, {...}]
}

// Criar follow-up manual
POST /api/followups
Body: {
  lead_id: "uuid-lead",
  tipo_followup: "follow_up_proposta",
  data_agendada: "2024-01-16T10:00:00Z",
  mensagem_template: "Olá {{nome}}, gostaria de saber..."
}

// Cancelar follow-up
DELETE /api/followups/:followupId

// ============================================
// DASHBOARD - MÉTRICAS
// ============================================

// Dashboard geral
GET /api/dashboard/resumo
Response: {
  periodo: "2024-01",
  novos_leads: 45,
  leads_qualificados: 32,
  taxa_qualificacao: 71.1,
  propostas_enviadas: 25,
  propostas_aceitas: 12,
  taxa_conversao: 48.0,
  reservas_confirmadas: 10,
  receita_periodo: 15000.00,
  ocupacao_media: 85.5,
  custo_ads: 2500.00,
  roi_ads: 6.0
}

// Dados para gráficos
GET /api/dashboard/graficos?periodo=30dias
Response: {
  leads_por_dia: [{data: "2024-01-01", valor: 5}, ...],
  receita_cumulativa: [{data: "2024-01-01", valor: 1000}, ...],
  ocupacao_por_dia: [{data: "2024-01-01", valor: 75}, ...],
  conversao_funil: {
    total_leads: 100,
    qualificados: 71,
    proposta: 45,
    confirmada: 12
  }
}

// Relatório detalhado
GET /api/dashboard/relatorio?tipo=vendas&data_inicio=2024-01-01&data_fim=2024-01-31
Response: {
  resumo: {...},
  por_origem: {...},
  por_tipo_grupo: {...},
  ticket_medio: 1500.00,
  clientes_por_origem: {...}
}

// ============================================
// PAGAMENTOS - STRIPE / MERCADO PAGO
// ============================================

// Webhook de confirmação de pagamento
POST /api/webhooks/pagamento
Body: {
  id: "evt_...",
  type: "charge.succeeded",
  data: {
    object: {
      id: "ch_...",
      amount: 48600,
      metadata: {
        reserva_id: "uuid-reserva"
      }
    }
  }
}

// Gerar link de pagamento
POST /api/pagamentos/gerar-link
Body: {
  reserva_id: "uuid-reserva",
  metodo: "cartao"
}
Response: {
  link_pagamento: "https://buy.stripe.com/...",
  valor: 486.00,
  expiracao: "2024-01-16T10:30:00Z"
}

6. Fluxos de Negócio
6.1 Fluxo Completo de Um Lead
Copy┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 1: CAPTAÇÃO (NOVO)                                  │
└─────────────────────────────────────────────────────────────┘

Cliente clica em anúncio (Facebook/Instagram)
      ↓
Click para conversar no WhatsApp
      ↓
Webhook recebe mensagem: "Olá, tenho um grupo..."
      ↓
Sistema cria novo Lead (status = NOVO)
      ↓
Luna (Claude IA) processa mensagem:
  • Extrai: tamanho_grupo = 8
  • Extrai: datas_interesse = Fevereiro 2024
  • Extrai: tipo_grupo = Família
  • Define intencao = QUALIFICACAO
      ↓
Luna envia resposta automática:
  "Ótimo! Grupo de 8 pessoas em fevereiro. 
   Deixa eu verificar a disponibilidade para você..."
      ↓
Sistema armazena em CONVERSAS:
  - mensagem_usuario: "Olá, tenho um grupo..."
  - resposta_ia: "Ótimo! Grupo de 8..."
  - intencao_detectada: "qualificacao"
  - dados_extraidos: {tamanho_grupo: 8, ...}

┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 2: QUALIFICAÇÃO (QUALIFICADO)                       │
└─────────────────────────────────────────────────────────────┘

Luna segue com mais perguntas:
      ↓
Cliente responde (várias interações):
  • "Sim, queremos 15 de fevereiro até 18"
  • "Precisamos de 3 quartos"
  • "Quanto custa?"
      ↓
Sistema analisa cada resposta com IA:
  • Incrementa pontuacao_qualificacao para 85
  • Confirma: data_checkin = 15/02, data_checkout = 18/02
  • Confirma: numero_quartos = 3
      ↓
Sistema verifica DISPONIBILIDADE:
  ✓ 15, 16, 17/02 têm 5+ quartos disponíveis
  ✓ Preço: R$ 150 por pessoa
      ↓
Luna informa disponibilidade:
  "Ótimo! Temos disponibilidade de 15 a 18 de fevereiro.
   Para 8 pessoas em 3 quartos, o valor seria R$ 3.600.
   Posso enviar uma proposta detalhada?"
      ↓
Sistema atualiza Lead:
  - estagio_funil = QUALIFICADO
  - pontuacao_qualificacao = 85
  - status_lead = "pronto_para_proposta"

┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 3: PROPOSTA (PROPOSTA ENVIADA)                      │
└─────────────────────────────────────────────────────────────┘

Luna: "Deixa eu preparar uma proposta especial para vocês"
      ↓
Sistema gera PROPOSTA automaticamente:
  - numero_proposta: PROP-2024-00015
  - data_checkin: 15/02/2024
  - data_checkout: 18/02/2024
  - numero_pessoas: 8
  - numero_quartos: 3
  - numero_diarias: 3
  - valor_diaria: R$ 150 × 8 = R$ 1.200/dia
  - valor_total: R$ 1.200 × 3 = R$ 3.600
  - desconto_aplicado: 10% (grupo grande) = R$ 360
  - valor_com_desconto: R$ 3.240
  - percentual_sinal: 30%
  - valor_sinal: R$ 972
      ↓
Sistema formata mensagem WhatsApp com:
  • Números de quartos sugeridos
  • Tabela de preços
  • Inclusos (wifi, café da manhã, etc)
  • QR Code e link de pagamento
  • Validade da proposta (7 dias)
      ↓
Luna envia proposta formatada:
  "📋 PROPOSTA PARA SEU GRUPO
   
   Datas: 15 a 18 de fevereiro (3 noites)
   Pessoas: 8 | Quartos: 3
   
   💰 VALORES:
   Diária: R$ 1.200
   Total (3 noites): R$ 3.600
   Desconto (10%): -R$ 360
   TOTAL COM DESCONTO: R$ 3.240
   
   Sinal (30%): R$ 972
   Restante: R$ 2.268
   
   ✅ Inclusos:
   • WiFi 24h
   • Café da manhã completo
   • Estacionamento
   • Piscina aquecida
   
   👇 Confirmar agora:
   [Link PIX] [Link Cartão]
   
   Válida até: 22 de janeiro"
      ↓
Sistema armazena em PROPOSTAS:
  - status_proposta = ENVIADA
  - data_envio = agora
  - data_visualizacao = NULL
  - data_resposta = NULL
      ↓
Sistema cria FOLLOWUP automático:
  - tipo = "proposta"
  - data_agendada = 22/01 (7 dias depois)
  - Mensagem: "Olá João, gostaria de confirmar se a proposta..."

┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 4: NEGOCIAÇÃO (NEGOCIACAO)                          │
└─────────────────────────────────────────────────────────────┘

Cliente visualiza proposta (IA detecta)
      ↓
Cliente responde: "Posso pagar tudo de uma vez e ganho desconto?"
      ↓
Sistema detecta: intencao = NEGOCIACAO
      ↓
Luna responde com IA:
  • Analisa solicitação
  • Sugere desconto de 5% para pagamento completo
  • Calcula novo valor
  • Apresenta opção: R$ 3.078 pagamento único
      ↓
Cliente: "Tudo bem, vou confirmar com o grupo"
      ↓
Sistema cria novo FOLLOWUP:
  - tipo = "confirmacao_grupo"
  - data_agendada = 20/01 (2 dias)
  - Mensagem: "E aí João, conseguiu confirmar com o grupo?"

┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 5: CONFIRMAÇÃO (CONFIRMADO)                         │
└─────────────────────────────────────────────────────────────┘

Cliente confirma: "Tudo certo! Vou pagar agora"
      ↓
Sistema detecta: intencao = PRONTO_PARA_RESERVAR
      ↓
Sistema atualiza PROPOSTA:
  - status_proposta = ACEITA
  - data_resposta = agora
      ↓
Sistema cria RESERVA automaticamente:
  - status_reserva = PENDENTE (aguardando pagamento do sinal)
  - numero_reserva = RES-2024-00087
  - valor_total = R$ 3.240 (ou valor negociado)
  - valor_sinal = R$ 972
  - data_checkin = 15/02
  - data_checkout = 18/02
      ↓
Luna envia opções de pagamento:
  "Ótimo! Vou gerar o link para você pagar o sinal.
   
   💰 Sinal a pagar: R$ 972
   
   Escolha a forma de pagamento:
   1️⃣ PIX (instantâneo) [QR CODE]
   2️⃣ Cartão de crédito [LINK]
   3️⃣ Boleto [LINK]
   
   Após confirmar, você receberá:
   ✅ Confirmação da reserva
   ✅ Detalhes do check-in
   ✅ Contato direto com gerente"
      ↓
Cliente clica em PIX → Paga R$ 972
      ↓
Webhook de pagamento é processado:
  • Stripe/MercadoPago confirma pagamento
  • Sistema recebe confirmação
  • Atualiza PAGAMENTO: status = CONFIRMADO
      ↓
Sistema atualiza RESERVA:
  - status_reserva = CONFIRMADA
  - sinal_pago = TRUE
  - data_pagamento_sinal = agora
  - valor_restante = R$ 2.268
      ↓
Sistema atualiza LEAD:
  - estagio_funil = CONFIRMADO
  - pontuacao_qualificacao = 100
      ↓
Sistema bloqueia DISPONIBILIDADE:
  - 15, 16, 17/02: quartos_disponiveis -= 3
      ↓
Luna envia confirmação:
  "✅ RESERVA CONFIRMADA!
   
   Número da reserva: RES-2024-00087
   Check-in: 15 de fevereiro às 14h
   Check-out: 18 de fevereiro às 11h
   
   👥 Hospedes: 8 pessoas
   🛏️ Quartos: 3 (Suíte A, Duplo B, Duplo C)
   
   💰 Valor restante: R$ 2.268
   Data limite pagamento: 31 de janeiro
   
   📞 Seu contato: João Silva
   ✉️ E-mail: joao@email.com
   📱 WhatsApp: (12) 99999-9999
   
   Aguardamos você em breve! 🌙"
      ↓
Sistema cria FOLLOWUPS automáticos:
  1. "cobranca_restante" → 30/01
  2. "lembrete_checkin" → 14/02
  3. "confirmacao_checkin" → 15/02 às 12h
  4. "pos_hospedagem" → 18/02

┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 6: HOSPEDAGEM E PÓS-VENDA (HOSPEDADO → CONCLUÍDO)   │
└─────────────────────────────────────────────────────────────┘

14/02 - Lembrete de check-in:
  Luna: "Olá João! Você chega amanhã às 14h.
         Aqui estão os detalhes:"
      ↓
15/02 - Check-in:
  - Gerente confirma entrada do grupo
  - Sistema atualiza: status_reserva = HOSPEDADO
  - Gera cupom para upsells (frigobar, tour, etc)
      ↓
Luna envia durante hospedagem:
  "Bem-vindo Grupo do João! 
   Aproveitem a piscina aquecida, à noite temos...
   
   Precisa de algo? 📞 Ligue para a recepção"
      ↓
18/02 - Check-out:
  - Gerente libera quartos
  - Sistema atualiza: status_reserva = CONCLUÍDO
  - Processa pagamento do restante (se ainda não pago)
      ↓
Luna envia após check-out:
  "Obrigado pela hospedagem, João!
   
   Sua avaliação é importante para nós.
   👇 Deixe seu feedback:
   [Link para avaliação]
   
   Quer voltar? Temos 10% de desconto para sua próxima vinda!"
      ↓
Sistema cria FOLLOWUP:
  - tipo = "pos_hospedagem"
  - data_agendada = 20/02 (2 dias depois)
  - Mensagem automática pedindo avaliação
      ↓
Sistema atualiza métricas:
  - receita_gerada = R$ 3.240
  - ocupacao = +3 quartos × 3 noites
  - satisfacao_cliente = aguardando feedback
  - clientes_recorrentes = incrementa se retorno
6.2 Fluxo de Automações Diárias
```
```javascript
// FLUXO DE AUTOMAÇÕES COM N8N / BULLMQ

// 1. TODO DIA ÀS 10:00 - VERIFICAR PROPOSTAS VENCIDAS
const jobVerificarPropostasVencidas = async () => {
  const propostas = await supabase
    .from('propostas')
    .select('*')
    .eq('status_proposta', 'enviada')
    .lt('data_envio', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  
  for (const proposta of propostas) {
    await supabase
      .from('propostas')
      .update({ status_proposta: 'expirada' })
      .eq('id', proposta.id);
    
    // Enviar mensagem ao lead
    await whatsapp.enviarMensagem(proposta.lead_id, 
      `Olá! Sua proposta expirou. Gostaria de renovar?`);
  }
};

// 2. DIARIAMENTE - ENVIAR FOLLOW-UPS AGENDADOS
const jobEnviarFollowups = async () => {
  const followups = await supabase
    .from('followups')
    .select('*')
    .eq('status', 'agendado')
    .lte('data_agendada', new Date());
  
  for (const followup of followups) {
    const lead = await obterLead(followup.lead_id);
    const mensagem = interpolarTemplate(followup.mensagem_template, lead);
    
    await whatsapp.enviarMensagem(lead.numero_whatsapp, mensagem);
    
    await supabase
      .from('followups')
      .update({ 
        status: 'enviado',
        data_envio: new Date()
      })
      .eq('id', followup.id);
    
    // Agendar próxima tentativa se não responder
    if (followup.tentativas < 3) {
      await criarFollowup({
        lead_id: followup.lead_id,
        tipo_followup: followup.tipo_followup,
        data_agendada: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        tentativas: followup.tentativas + 1
      });
    }
  }
};

// 3. DIARIAMENTE ÀS 09:00 - LEMBRETES DE CHECK-IN
const jobLembretesCheckin = async () => {
  // Para reservas que fazem check-in amanhã
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  
  const reservas = await supabase
    .from('reservas')
    .select('*, leads(nome, numero_whatsapp)')
    .eq('data_checkin', amanha)
    .eq('status_reserva', 'confirmada');
  
  for (const reserva of reservas) {
    const mensagem = `
      Olá ${reserva.leads.nome}! 🌙
      
      Amanhã você chega à Pousada Luz da Lua!
      
      ⏰ Check-in: 14:00
      📍 Endereço: Rua das Flores, 123
      📱 Gerente: (12) 3456-7890
      
      Tem alguma dúvida? Chama a gente!
    `;
    
    await whatsapp.enviarMensagem(
      reserva.leads.numero_whatsapp, 
      mensagem
    );
  }
};

// 4. DIARIAMENTE ÀS 11:00 - COBRANÇA DE SALDO PENDENTE
const jobCobrancaSaldo = async () => {
  const hoje = new Date().toISOString().split('T')[0];
  const dataLimite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  
  const reservas = await supabase
    .from('reservas')
    .select('*, leads(nome, numero_whatsapp)')
    .eq('status_reserva', 'sinal_confirmado')
    .gte('data_checkin', hoje)
    .lte('criado_em', dataLimite);
  
  for (const reserva of reservas) {
    const diasParaCheckin = Math.ceil(
      (new Date(reserva.data_checkin) - new Date()) / (1000 * 60 * 60 * 24)
    );
    
    const mensagem = `
      Olá ${reserva.leads.nome}! 💰
      
      Faltam ${diasParaCheckin} dias para seu check-in.
      Você ainda tem um saldo a pagar: R$ ${reserva.valor_restante.toFixed(2)}
      
      🔗 Pague agora:
      ${await gerarLinkPagamento(reserva.id)}
      
      Qualquer dúvida, estamos aqui!
    `;
    
    await whatsapp.enviarMensagem(
      reserva.leads.numero_whatsapp,
      mensagem
    );
  }
};

// 5. DIARIAMENTE ÀS 18:00 - ATUALIZAR MÉTRICAS
const jobAtualizarMetricas = async () => {
  const hoje = new Date().toISOString().split('T')[0];
  
  const novosLeads = await supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .gte('criado_em', hoje + 'T00:00:00')
    .lte('criado_em', hoje + 'T23:59:59');
  
  const leadsQualificados = await supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('estagio_funil', 'qualificado')
    .gte('atualizado_em', hoje + 'T00:00:00');
  
  const propostas = await supabase
    .from('propostas')
    .select('*')
    .gte('data_envio', hoje + 'T00:00:00')
    .lte('data_envio', hoje + 'T23:59:59');
  
  const reservas = await supabase
    .from('reservas')
    .select('valor_total')
    .gte('criado_em', hoje + 'T00:00:00')
    .eq('status_reserva', 'confirmada');
  
  const ocupacao = await supabase
    .from('vw_ocupacao_por_data')
    .select('*')
    .eq('data_checkin', hoje);
  
  const metricas = {
    data: hoje,
    novos_leads: novosLeads.count,
    leads_qualificados: leadsQualificados.count,
    propostas_enviadas: propostas.data.length,
    propostas_aceitas: propostas.data.filter(p => p.status_proposta === 'aceita').length,
    reservas_confirmadas: reservas.data.length,
    receita_dia: reservas.data.reduce((sum, r) => sum + r.valor_total, 0),
    ocupacao_pousada: ocupacao.data.length > 0 ? ocupacao.data[0].quartos_ocupados : 0,
    taxa_conversao_leads: (leadsQualificados.count / novosLeads.count * 100).toFixed(2)
  };
  
  await supabase
    .from('metricas_diarias')
    .upsert(metricas);
  
  // Enviar relatório ao administrador
  const mensagem = `
    📊 RELATÓRIO DO DIA - ${new Date(hoje).toLocaleDateString('pt-BR')}
    
    👥 Novos Leads: ${metricas.novos_leads}
    ✅ Qualificados: ${metricas.leads_qualificados}
    📋 Propostas Enviadas: ${metricas.propostas_enviadas}
    💰 Propostas Aceitas: ${metricas.propostas_aceitas}
    🔐 Reservas Confirmadas: ${metricas.reservas_confirmadas}
    
    💵 Receita: R$ ${metricas.receita_dia.toFixed(2)}
    🛏️ Quartos Ocupados: ${metricas.ocupacao_pousada}
    
    Taxa de Conversão: ${metricas.taxa_conversao_leads}%
  `;
  
  await telegram.enviarMensagem(ADMIN_CHAT_ID, mensagem);
};

// 6. SEMANALMENTE - ANÁLISE DE LEADS NÃO CONVERTIDOS
const jobAnalisarLeadsNaoConvertidos = async () => {
  const semanaPassada = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const leads = await supabase
    .from('leads')
    .select('*')
    .in('estagio_funil', ['novo', 'qualificado'])
    .lt('criado_em', semanaPassada.toISOString());
  
  for (const lead of leads) {
    const ultimaConversa = await supabase
      .from('conversas')
      .select('criado_em')
      .eq('lead_id', lead.id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single();
    
    const diasSemContato = Math.ceil(
      (new Date() - new Date(ultimaConversa.criado_em)) / (1000 * 60 * 60 * 24)
    );
    
    if (diasSemContato > 3) {
      // Lead frio - tentar reativar
      const mensagem = `
        Olá ${lead.nome}! 👋
        
        Percebi que você ficou interessado na Pousada Luz da Lua.
        
        Posso te ajudar com informações atualizadas?
        Temos promoções especiais para grupos como o seu!
        
        😊 Que tal a gente conversa?
      `;
      
      await whatsapp.enviarMensagem(lead.numero_whatsapp, mensagem);
      
      // Criar follow-up de reativação
      await criarFollowup({
        lead_id: lead.id,
        tipo_followup: 'reativacao',
        data_agendada: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      });
    }
  }
};

// 7. CONFIGURAR JOBS NO SERVIDOR
const queue = new Queue('automacoes-pousada');

// Agendar jobs
queue.add(jobVerificarPropostasVencidas, { repeat: { cron: '0 10 * * *' } });
queue.add(jobEnviarFollowups, { repeat: { cron: '0 */1 * * *' } });
queue.add(jobLembretesCheckin, { repeat: { cron: '0 9 * * *' } });
queue.add(jobCobrancaSaldo, { repeat: { cron: '0 11 * * *' } });
queue.add(jobAtualizarMetricas, { repeat: { cron: '0 18 * * *' } });
queue.add(jobAnalisarLeadsNaoConvertidos, { repeat: { cron: '0 8 * * 1' } });

CRM e Sistema de Automação - Pousada Luz da Lua
Documentação Técnica Completa (Continuação)

8. INTEGRAÇÃO WHATSAPP
8.1 Arquitetura da Integração
Copy┌─────────────┐
│  WhatsApp   │
│  Business   │
│     API     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│     Webhook WhatsApp                │
│  (Port: 3001, Path: /webhook/wpp)   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Message Queue (Bull/Redis)        │
│  - Processamento assíncrono         │
│  - Retry automático                 │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Message Processor Service         │
│  - Classificação inteligente         │
│  - Roteamento inteligente            │
│  - Respostas automáticas             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   CRM Database & n8n Workflows      │
│  - Registro de conversas            │
│  - Acionamento de automações        │
└─────────────────────────────────────┘
8.2 Configuração WhatsApp Business API
```
```javascript
// config/whatsapp.config.js

module.exports = {
  // Credenciais
  businessAccountId: process.env.WPP_BUSINESS_ACCOUNT_ID,
  phoneNumberId: process.env.WPP_PHONE_NUMBER_ID,
  accessToken: process.env.WPP_ACCESS_TOKEN,
  webhookVerifyToken: process.env.WPP_WEBHOOK_VERIFY_TOKEN,
  
  // Configurações
  apiVersion: 'v18.0',
  webhookUrl: `${process.env.BASE_URL}/webhook/whatsapp`,
  
  // Limites e timeouts
  messageTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 5000,
  
  // Templates configurados
  templates: {
    confirmacaoReserva: 'reservation_confirmation_pt',
    lembreteCheckIn: 'checkin_reminder_pt',
    pesquisaSatisfacao: 'satisfaction_survey_pt',
    conviteUpsell: 'upsell_invitation_pt'
  }
};
8.3 Webhook WhatsApp
```
```javascript
// routes/whatsapp.routes.js

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const whatsappMiddleware = require('../middlewares/whatsappMiddleware');

// Verificação de webhook
router.get('/webhook/whatsapp', whatsappController.verifyWebhook);

// Recebimento de mensagens
router.post('/webhook/whatsapp',
  whatsappMiddleware.validateSignature,
  whatsappMiddleware.rateLimit,
  whatsappController.handleIncomingMessage
);

module.exports = router;
```
```javascript
// controllers/whatsappController.js

const Queue = require('bull');
const redis = require('../config/redis');
const WhatsAppService = require('../services/WhatsAppService');
const MessageProcessor = require('../services/MessageProcessor');

const messageQueue = new Queue('whatsapp-messages', {
  redis: redis.connection
});

exports.verifyWebhook = (req, res) => {
  const verifyToken = process.env.WPP_WEBHOOK_VERIFY_TOKEN;
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (token === verifyToken) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
};

exports.handleIncomingMessage = async (req, res) => {
  try {
    const { entry } = req.body;

    // Processa cada entrada recebida
    for (const item of entry) {
      const { changes } = item;
      
      for (const change of changes) {
        const { value } = change;
        const { messages, contacts } = value;

        if (messages) {
          for (const message of messages) {
            // Adiciona à fila de processamento
            await messageQueue.add(
              {
                message,
                contact: contacts[0],
                timestamp: value.timestamp
              },
              {
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000
                }
              }
            );
          }
        }
      }
    }

    // Responde imediatamente ao WhatsApp
    res.sendStatus(200);
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.sendStatus(500);
  }
};
8.4 Processador de Mensagens
```
```javascript
// services/MessageProcessor.js

const messageQueue = require('../queues/messageQueue');
const WhatsAppService = require('./WhatsAppService');
const ChatGPTService = require('./ChatGPTService');
const BookingService = require('./BookingService');
const CustomerService = require('./CustomerService');

class MessageProcessor {
  async processMessage(jobData) {
    const { message, contact, timestamp } = jobData;

    // Extrai informações
    const phoneNumber = message.from;
    const messageId = message.id;
    const type = message.type;
    const text = this._extractText(message);

    console.log(`[MSG] De: ${phoneNumber} - Tipo: ${type}`);

    try {
      // 1. Obtém ou cria cliente
      let customer = await CustomerService.findByPhoneOrCreate(phoneNumber, {
        name: contact?.name || 'Cliente WhatsApp'
      });

      // 2. Registra conversação
      const conversation = await this._saveMessage({
        customerId: customer.id,
        type: 'incoming',
        messageId,
        content: text,
        rawData: message,
        timestamp
      });

      // 3. Marca como lida no WhatsApp
      await WhatsAppService.markAsRead(messageId);

      // 4. Classifica a mensagem
      const classification = await this._classifyMessage(text);
      console.log(`[CLASS] Classificação: ${classification.intent}`);

      // 5. Rota para handler apropriado
      let response = await this._routeMessage({
        customer,
        conversation,
        message: text,
        classification,
        originalMessage: message
      });

      // 6. Envia resposta
      if (response) {
        await WhatsAppService.sendMessage(phoneNumber, response);
      }

      return { success: true, conversation };

    } catch (error) {
      console.error('[ERROR] Processando mensagem:', error);
      
      // Envia mensagem de erro educada
      await WhatsAppService.sendMessage(
        phoneNumber,
        'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.'
      );
      
      throw error;
    }
  }

  async _classifyMessage(text) {
    // Classificação rápida por keywords
    const keywords = {
      booking: ['reserv', 'hospedad', 'quart', 'noite', 'data', 'checkin'],
      availability: ['disponível', 'disponible', 'tem vag', 'há quart'],
      pricing: ['preço', 'valor', 'quanto', 'cust', 'tarif'],
      amenities: ['piscin', 'wifi', 'tv', 'ar condicion', 'facilidad'],
      complaint: ['problema', 'reclamação', 'ruído', 'sujei', 'frio', 'quent'],
      greeting: ['oi', 'olá', 'opa', 'e aí', 'tudo bem'],
      cancel: ['cancelar', 'desistir', 'parar']
    };

    const lowerText = text.toLowerCase();
    let intent = 'general';
    let confidence = 0;

    for (const [key, words] of Object.entries(keywords)) {
      const matches = words.filter(w => lowerText.includes(w)).length;
      if (matches > confidence) {
        confidence = matches;
        intent = key;
      }
    }

    return {
      intent,
      confidence,
      text
    };
  }

  async _routeMessage({ customer, conversation, message, classification, originalMessage }) {
    switch (classification.intent) {
      case 'booking':
        return await this._handleBookingRequest(customer, message);
      
      case 'availability':
        return await this._handleAvailabilityQuery(customer, message);
      
      case 'pricing':
        return await this._handlePricingQuery(customer, message);
      
      case 'amenities':
        return await this._handleAmenitiesQuery(customer, message);
      
      case 'complaint':
        return await this._handleComplaint(customer, conversation, message);
      
      case 'cancel':
        return await this._handleCancellation(customer, message);
      
      case 'greeting':
        return await this._handleGreeting(customer);
      
      default:
        return await this._handleGeneralQuery(customer, message);
    }
  }

  async _handleBookingRequest(customer, message) {
    const response = `Olá ${customer.name}! 🏨\n\n` +
      `Para realizar uma reserva, preciso das seguintes informações:\n\n` +
      `1️⃣ Data de chegada (DD/MM/YYYY)\n` +
      `2️⃣ Data de saída (DD/MM/YYYY)\n` +
      `3️⃣ Tipo de quarto preferido\n` +
      `4️⃣ Número de hóspedes\n\n` +
      `Por favor, envie essas informações e farei uma cotação para você!`;

    // Inicia fluxo de conversação estruturada
    await this._initializeBookingFlow(customer.id);

    return response;
  }

  async _handleAvailabilityQuery(customer, message) {
    const BookingService = require('./BookingService');
    
    try {
      // Tenta extrair datas do texto
      const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
      const dates = message.match(datePattern);

      let response = '📅 *Disponibilidade da Pousada Luz da Lua*\n\n';

      if (dates && dates.length >= 2) {
        const [checkIn, checkOut] = dates;
        const availability = await BookingService.checkAvailability(
          new Date(checkIn),
          new Date(checkOut)
        );

        if (availability.length > 0) {
          response += `✅ Temos quartos disponíveis!\n\n`;
          availability.forEach(room => {
            response += `🛏️ ${room.name}\n`;
            response += `   • Capacidade: ${room.capacity} pessoas\n`;
            response += `   • Preço/noite: R$ ${room.price.toFixed(2)}\n\n`;
          });
        } else {
          response += `❌ Desculpe, não temos disponibilidade para essas datas.\n\n`;
          response += `Que tal alterar as datas?`;
        }
      } else {
        response += `Para verificar disponibilidade, por favor informe:\n`;
        response += `• Data de chegada (DD/MM/YYYY)\n`;
        response += `• Data de saída (DD/MM/YYYY)`;
      }

      return response;
    } catch (error) {
      return `Desculpe, houve um erro ao verificar a disponibilidade. Tente novamente mais tarde.`;
    }
  }

  async _handlePricingQuery(customer, message) {
    const response = `💰 *Tabela de Preços - Pousada Luz da Lua*\n\n` +
      `*Quartos Disponíveis:*\n\n` +
      `🛏️ *Quarto Simples*\n` +
      `   • Capacidade: 1-2 pessoas\n` +
      `   • Valor: R$ 150,00/noite\n\n` +
      `🛏️ *Quarto Duplo*\n` +
      `   • Capacidade: 2-3 pessoas\n` +
      `   • Valor: R$ 200,00/noite\n\n` +
      `🛏️ *Suite Familiar*\n` +
      `   • Capacidade: 4-5 pessoas\n` +
      `   • Valor: R$ 350,00/noite\n\n` +
      `*Promoções Especiais:*\n` +
      `🎉 3+ noites: 10% de desconto\n` +
      `🎉 7+ noites: 15% de desconto\n\n` +
      `Deseja fazer uma reserva? 🏨`;

    return response;
  }

  async _handleComplaint(customer, conversation, message) {
    // Registra reclamação para análise
    await this._saveComplaint({
      customerId: customer.id,
      conversationId: conversation.id,
      content: message,
      status: 'pending',
      priority: 'high'
    });

    const response = `Obrigado por compartilhar seu feedback, ${customer.name}! 😟\n\n` +
      `Levamos suas preocupações muito a sério. Nossa equipe de gestão foi notificada ` +
      `e entraremos em contato em breve para resolver o problema.\n\n` +
      `Referência: #${conversation.id}`;

    return response;
  }

  async _handleCancellation(customer, message) {
    // Verifica reservas ativas
    const BookingService = require('./BookingService');
    const activeBookings = await BookingService.findActiveByCustomer(customer.id);

    if (activeBookings.length === 0) {
      return `Você não possui reservas ativas para cancelar. 📋`;
    }

    let response = `🔴 *Cancelamento de Reserva*\n\n`;
    response += `Você possui ${activeBookings.length} reserva(s):\n\n`;

    activeBookings.forEach((booking, index) => {
      response += `${index + 1}. Reserva #${booking.id}\n`;
      response += `   • Checkin: ${booking.checkInDate}\n`;
      response += `   • Checkout: ${booking.checkOutDate}\n\n`;
    });

    response += `Para cancelar, responda com o número da reserva (1, 2, 3...)`;

    return response;
  }

  async _handleGreeting(customer) {
    const hour = new Date().getHours();
    let greeting;

    if (hour < 12) greeting = 'Bom dia';
    else if (hour < 18) greeting = 'Boa tarde';
    else greeting = 'Boa noite';

    const response = `${greeting}, ${customer.name}! 👋\n\n` +
      `Bem-vindo à Pousada Luz da Lua! ✨\n\n` +
      `Como posso ajudá-lo?\n\n` +
      `💬 Pode me perguntar sobre:\n` +
      `• Disponibilidade de quartos\n` +
      `• Preços e promoções\n` +
      `• Comodidades da pousada\n` +
      `• Fazer uma reserva`;

    return response;
  }

  async _handleGeneralQuery(customer, message) {
    // Usa IA para responder perguntas gerais
    const ChatGPTService = require('./ChatGPTService');

    const systemPrompt = `Você é um assistente de atendimento ao cliente da Pousada Luz da Lua, 
uma pousada boutique localizada em [localização]. Você é amigável, prestativo e profissional. 
Responde apenas sobre tópicos relacionados à pousada. Se uma pergunta não for sobre a pousada, 
redirecione educadamente para os tópicos que você pode ajudar.`;

    const response = await ChatGPTService.generateResponse(
      message,
      systemPrompt,
      {
        maxTokens: 200,
        temperature: 0.7
      }
    );

    return response;
  }

  async _saveMessage(data) {
    const ConversationMessage = require('../models/ConversationMessage');
    return await ConversationMessage.create(data);
  }

  async _saveComplaint(data) {
    const Complaint = require('../models/Complaint');
    return await Complaint.create(data);
  }

  async _initializeBookingFlow(customerId) {
    const ConversationFlow = require('../models/ConversationFlow');
    return await ConversationFlow.create({
      customerId,
      flowType: 'booking',
      status: 'active',
      step: 1,
      metadata: {}
    });
  }

  _extractText(message) {
    const { type } = message;

    switch (type) {
      case 'text':
        return message.text.body;
      
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
        return `[Arquivo: ${type}] ${message[type].caption || '(sem descrição)'}`;
      
      case 'location':
        return `[Localização] Lat: ${message.location.latitude}, Long: ${message.location.longitude}`;
      
      default:
        return '[Mensagem não suportada]';
    }
  }
}

module.exports = new MessageProcessor();
8.5 WhatsApp Service
```
```javascript
// services/WhatsAppService.js

const axios = require('axios');
const config = require('../config/whatsapp.config');

class WhatsAppService {
  constructor() {
    this.client = axios.create({
      baseURL: `https://graph.instagram.com/${config.apiVersion}`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`
      }
    });
  }

  async sendMessage(phoneNumber, text, options = {}) {
    try {
      const response = await this.client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
          type: 'text',
          text: {
            body: text
          }
        }
      );

      // Registra envio
      await this._logMessage({
        phoneNumber,
        type: 'outgoing',
        content: text,
        status: 'sent',
        messageId: response.data.messages[0].id
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  async sendTemplate(phoneNumber, templateName, parameters = []) {
    try {
      const response = await this.client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'pt_BR'
            },
            ...(parameters.length > 0 && {
              parameters: {
                body: {
                  parameters: parameters.map(p => ({ text: String(p) }))
                }
              }
            })
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao enviar template:', error);
      throw error;
    }
  }

  async sendImage(phoneNumber, imageUrl, caption = '') {
    try {
      const response = await this.client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
          type: 'image',
          image: {
            link: imageUrl,
            ...(caption && { caption })
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      throw error;
    }
  }

  async sendDocument(phoneNumber, documentUrl, filename) {
    try {
      const response = await this.client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
          type: 'document',
          document: {
            link: documentUrl,
            filename
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao enviar documento:', error);
      throw error;
    }
  }

  async sendButtons(phoneNumber, headerText, bodyText, buttons) {
    try {
      const response = await this.client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: bodyText
            },
            ...(headerText && {
              header: {
                type: 'text',
                text: headerText
              }
            }),
            action: {
              buttons: buttons.map(btn => ({
                type: 'reply',
                reply: {
                  id: btn.id,
                  title: btn.title
                }
              }))
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao enviar botões:', error);
      throw error;
    }
  }

  async sendList(phoneNumber, bodyText, sections) {
    try {
      const response = await this.client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: {
              text: bodyText
            },
            action: {
              button: 'Opções',
              sections: sections.map(section => ({
                title: section.title,
                rows: section.rows.map(row => ({
                  id: row.id,
                  title: row.title,
                  description: row.description || ''
                }))
              }))
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao enviar lista:', error);
      throw error;
    }
  }

  async markAsRead(messageId) {
    try {
      await this.client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        }
      );
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
    }
  }

  async _logMessage(data) {
    const ConversationMessage = require('../models/ConversationMessage');
    await ConversationMessage.create(data);
  }
}

module.exports = new WhatsAppService();

9. AUTOMAÇÕES COM N8N
9.1 Arquitetura de Automações
Copy┌─────────────────────────────────────────────────────────────┐
│                      N8N WORKFLOWS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  1. RESERVAÇÃO E CONFIRMAÇÃO                     │     │
│  │  • Trigger: Nova reserva criada (API/Webhook)    │     │
│  │  • Ações:                                         │     │
│  │    - Validar disponibilidade                     │     │
│  │    - Gerar confirmação                           │     │
│  │    - Enviar template WhatsApp                    │     │
│  │    - Atualizar calendário                        │     │
│  │    - Criar tarefa de check-in                    │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  2. LEMBRETES PRÉ-CHEGADA (7 DIAS ANTES)        │     │
│  │  • Trigger: Agendado (Cron)                      │     │
│  │  • Ações:                                         │     │
│  │    - Query reservas com check-in em 7 dias       │     │
│  │    - Enviar lembretes via WhatsApp               │     │
│  │    - Solicitar informações adicionais            │     │
│  │    - Atualizar status da reserva                 │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  3. CHECK-IN AUTOMÁTICO (DIA DA CHEGADA)         │     │
│  │  • Trigger: Dia de check-in                      │     │
│  │  • Ações:                                         │     │
│  │    - Enviar instruções de check-in               │     │
│  │    - Código WiFi e informações úteis             │     │
│  │    - Contacto de emergência                      │     │
│  │    - Atualizar status para "Hospedando"          │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  4. LEMBRETES PÓS-CHECKOUT (SATISFAÇÃO)          │     │
│  │  • Trigger: Dia após checkout                    │     │
│  │  • Ações:                                         │     │
│  │    - Enviar pesquisa de satisfação               │     │
│  │    - Coletar feedback                            │     │
│  │    - Atualizar rating do cliente                 │     │
│  │    - Alertar para problemas relatados            │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  5. UPSELL E ANCILARES                            │     │
│  │  • Trigger: Check-in confirmado                  │     │
│  │  • Ações:                                         │     │
│  │    - Enviar propostas de serviços adicionais     │     │
│  │    - Oferecimentos de atividades                 │     │
│  │    - Descontos em restaurantes parceiros         │     │
│  │    - Estender estadias                           │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  6. PROCESSAMENTO DE PAGAMENTOS                  │     │
│  │  • Trigger: Confirmação de reserva               │     │
│  │  • Ações:                                         │     │
│  │    - Integrar com gateway (Stripe/Pix)           │     │
│  │    - Gerar link de pagamento                     │     │
│  │    - Enviar via WhatsApp                         │     │
│  │    - Monitorar status                            │     │
│  │    - Reenviar lembretes                          │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  7. RECUPERAÇÃO DE CARRINHO ABANDONADO           │     │
│  │  • Trigger: Reserva não finalizada há 1h         │     │
│  │  • Ações:                                         │     │
│  │    - Enviar lembretes via WhatsApp               │     │
│  │    - Oferecer desconto especial                  │     │
│  │    - Reenviar link com 3h                        │     │
│  │    - Fazer follow-up com 24h                     │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  8. SINCRONIZAÇÃO DE CANAIS (OTAs)               │     │
│  │  • Trigger: Webhook de Booking.com/AirBnB        │     │
│  │  • Ações:                                         │     │
│  │    - Sincronizar reservas                        │     │
│  │    - Atualizar calendário                        │     │
│  │    - Importar informações de hóspedes            │     │
│  │    - Evitar overbooking                          │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  9. ANÁLISE E RELATÓRIOS AUTOMÁTICOS             │     │
│  │  • Trigger: Diário/Semanal/Mensal                │     │
│  │  • Ações:                                         │     │
│  │    - Calcular KPIs                               │     │
│  │    - Gerar gráficos                              │     │
│  │    - Enviar relatórios por email                 │     │
│  │    - Alertar anomalias                           │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  10. GESTÃO DE REPUTAÇÃO ONLINE                  │     │
│  │  • Trigger: Nova avaliação (Google/TripAdvisor)  │     │
│  │  • Ações:                                         │     │
│  │    - Monitorar avaliações                        │     │
│  │    - Alertar sobre reviews negativos             │     │
│  │    - Enviar template de resposta                 │     │
│  │    - Compilar em dashboard                       │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
9.2 Workflow de Reservação e Confirmação
```
```json
{
  "name": "Reservação e Confirmação",
  "description": "Processa nova reserva, valida e envia confirmação",
  "nodes": [
    {
      "name": "Webhook - Nova Reserva",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [100, 100],
      "parameters": {
        "path": "booking/new",
        "httpMethod": "POST",
        "options": {}
      }
    },
    {
      "name": "Validar Disponibilidade",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [300, 100],
      "parameters": {
        "url": "=http://api.meuhost.com/api/bookings/availability",
        "method": "POST",
        "body": {
          "roomId": "={{$node[\"Webhook - Nova Reserva\"].json.roomId}}",
          "checkIn": "={{$node[\"Webhook - Nova Reserva\"].json.checkInDate}}",
          "checkOut": "={{$node[\"Webhook - Nova Reserva\"].json.checkOutDate}}"
        }
      }
    },
    {
      "name": "Verificar Disponibilidade",
      "type": "n8n-nodes-base.if",
      "position": [500, 100],
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{$node[\"Validar Disponibilidade\"].json.available}}",
              "operator": "equals",
              "value2": true
            }
          ]
        }
      }
    },
    {
      "name": "Criar Reserva no CRM",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [700, 50],
      "parameters": {
        "url": "=http://api.meuhost.com/api/bookings",
        "method": "POST",
        "body": {
          "customerId": "={{$node[\"Webhook - Nova Reserva\"].json.customerId}}",
          "roomId": "={{$node[\"Webhook - Nova Reserva\"].json.roomId}}",
          "checkInDate": "={{$node[\"Webhook - Nova Reserva\"].json.checkInDate}}",
          "checkOutDate": "={{$node[\"Webhook - Nova Reserva\"].json.checkOutDate}}",
          "totalPrice": "={{$node[\"Webhook - Nova Reserva\"].json.totalPrice}}",
          "status": "confirmed",
          "metadata": "={{$node[\"Webhook - Nova Reserva\"].json}}"
        }
      }
    },
    {
      "name": "Enviar Confirmação WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [900, 50],
      "parameters": {
        "url": "=http://api.meuhost.com/api/whatsapp/send",
        "method": "POST",
        "body": {
          "phoneNumber": "={{$node[\"Webhook - Nova Reserva\"].json.phoneNumber}}",
          "templateName": "reservation_confirmation_pt",
          "parameters": [
            "={{$node[\"Webhook - Nova Reserva\"].json.guestName}}",
            "={{$node[\"Webhook - Nova Reserva\"].json.roomName}}",
            "={{$node[\"Webhook - Nova Reserva\"].json.checkInDate}}",
            "={{$node[\"Webhook - Nova Reserva\"].json.checkOutDate}}",
            "={{$node[\"Webhook - Nova Reserva\"].json.totalPrice}}"
          ]
        }
      }
    },
    {
      "name": "Atualizar Calendário",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [900, 150],
      "parameters": {
        "url": "=http://api.meuhost.com/api/calendar/update",
        "method": "PUT",
        "body": {
          "roomId": "={{$node[\"Webhook - Nova Reserva\"].json.roomId}}",
          "startDate": "={{$node[\"Webhook - Nova Reserva\"].json.checkInDate}}",
          "endDate": "={{$node[\"Webhook - Nova Reserva\"].json.checkOutDate}}",
          "status": "occupied",
          "bookingId": "={{$node[\"Criar Reserva no CRM\"].json.id}}"
        }
      }
    },
    {
      "name": "Crear Tarefa Check-in",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [900, 250],
      "parameters": {
        "url": "=http://api.meuhost.com/api/tasks",
        "method": "POST",
        "body": {
          "title": "=Check-in: {{$node[\"Webhook - Nova Reserva\"].json.guestName}}",
          "description": "=Preparar quarto {{$node[\"Webhook - Nova Reserva\"].json.roomName}} para {{$node[\"Webhook - Nova Reserva\"].json.guestName}}",
          "dueDate": "={{$node[\"Webhook - Nova Reserva\"].json.checkInDate}}",
          "priority": "high",
          "assignedTo": "recepcao",
          "metadata": {
            "bookingId": "={{$node[\"Criar Reserva no CRM\"].json.id}}",
            "roomId": "={{$node[\"Webhook - Nova Reserva\"].json.roomId}}"
          }
        }
      }
    },
    {
      "name": "Reserva Indisponível",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [700, 250],
      "parameters": {
        "url": "=http://api.meuhost.com/api/whatsapp/send",
        "method": "POST",
        "body": {
          "phoneNumber": "={{$node[\"Webhook - Nova Reserva\"].json.phoneNumber}}",
          "text": "Desculpe, o quarto não está disponível para essas datas. Por favor, escolha outras datas."
        }
      }
    }
  ],
  "connections": {
    "Webhook - Nova Reserva": {
      "main": [[{ "node": "Validar Disponibilidade", "type": "main", "index": 0 }]]
    },
    "Validar Disponibilidade": {
      "main": [[{ "node": "Verificar Disponibilidade", "type": "main", "index": 0 }]]
    },
    "Verificar Disponibilidade": {
      "main": [
        [{ "node": "Criar Reserva no CRM", "type": "main", "index": 0 }],
        [{ "node": "Reserva Indisponível", "type": "main", "index": 0 }]
      ]
    },
    "Criar Reserva no CRM": {
      "main": [[
        { "node": "Enviar Confirmação WhatsApp", "type": "main", "index": 0 },
        { "node": "Atualizar Calendário", "type": "main", "index": 0 },
        { "node": "Criar Tarefa Check-in", "type": "main", "index": 0 }
      ]]
    }
  }
}
9.3 Workflow de Lembretes (Cron)
```
```javascript
// workflows/reminders.workflow.js

const n8n = require('n8n-workflow');

class RemindersWorkflow {
  static createPreArrivalReminder() {
    return {
      name: 'Lembretes Pré-Chegada (7 dias)',
      triggers: [
        {
          type: 'cron',
          cron: '0 9 * * *' // 9h da manhã, todos os dias
        }
      ],
      nodes: [
        {
          name: 'Obter Reservas',
          type: 'Database Query',
          query: `
            SELECT b.*, c.name, c.phone_number, r.name as room_name
            FROM bookings b
            JOIN customers c ON b.customer_id = c.id
            JOIN rooms r ON b.room_id = r.id
            WHERE DATE(b.check_in_date) = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            AND b.status = 'confirmed'
          `
        },
        {
          name: 'Loop Reservas',
          type: 'forEach',
          process: async (booking) => {
            return {
              phoneNumber: booking.phone_number,
              guestName: booking.name,
              roomName: booking.room_name,
              checkInDate: booking.check_in_date,
              bookingId: booking.id
            };
          }
        },
        {
          name: 'Enviar Lembrete WhatsApp',
          type: 'WhatsApp Template',
          template: 'checkin_reminder_pt',
          parameters: [
            '={{$node.Loop Reservas.json.guestName}}',
            '={{$node.Loop Reservas.json.roomName}}',
            '={{$node.Loop Reservas.json.checkInDate}}'
          ]
        },
        {
          name: 'Atualizar Status',
          type: 'Database Update',
          query: `
            UPDATE bookings
            SET reminder_sent = true, reminder_sent_at = NOW()
            WHERE id = '={{$node.Loop Reservas.json.bookingId}}'
          `
        },
        {
          name: 'Log Execução',
          type: 'Log',
          message: 'Lembretes enviados com sucesso'
        }
      ]
    };
  }

  static createCheckInDayReminder() {
    return {
      name: 'Lembretes Dia do Check-in',
      triggers: [
        {
          type: 'cron',
          cron: '0 14 * * *' // 14h do dia do check-in
        }
      ],
      nodes: [
        {
          name: 'Obter Check-ins Hoje',
          type: 'Database Query',
          query: `
            SELECT b.*, c.name, c.phone_number, r.name as room_name
            FROM bookings b
            JOIN customers c ON b.customer_id = c.id
            JOIN rooms r ON b.room_id = r.id
            WHERE DATE(b.check_in_date) = CURDATE()
            AND b.status = 'confirmed'
          `
        },
        {
          name: 'Para cada Check-in',
          type: 'forEach',
          process: async (booking) => {
            return {
              phoneNumber: booking.phone_number,
              guestName: booking.name,
              roomName: booking.room_name,
              wifiPassword: await this.generateWiFiCredentials(),
              emergencyContact: process.env.EMERGENCY_CONTACT
            };
          }
        },
        {
          name: 'Enviar Instruções Check-in',
          type: 'WhatsApp Message',
          template: 'checkin_instructions_pt',
          attachments: [
            {
              type: 'document',
              url: 'https://example.com/house-rules.pdf'
            }
          ]
        }
      ]
    };
  }

  static createPostCheckoutSurvey() {
    return {
      name: 'Pesquisa Pós-Checkout',
      triggers: [
        {
          type: 'webhook',
          path: '/booking/checkout-completed'
        }
      ],
      nodes: [
        {
          name: 'Aguardar 24 horas',
          type: 'Wait',
          duration: 86400 // 24 horas em segundos
        },
        {
          name: 'Enviar Pesquisa',
          type: 'WhatsApp Interactive',
          content: {
            type: 'list',
            body: 'Como foi sua estadia?',
            sections: [
              {
                title: 'Avaliação Geral',
                rows: [
                  { id: '1', title: '⭐ Excelente' },
                  { id: '2', title: '⭐⭐ Bom' },
                  { id: '3', title: '⭐⭐⭐ Regular' },
                  { id: '4', title: '⭐⭐⭐⭐ Ruim' }
                ]
              }
            ]
          }
        },
        {
          name: 'Processar Resposta',
          type: 'Conditional Logic',
          conditions: [
            {
              if: 'rating <= 2',
              then: 'Enviar para análise'
            },
            {
              if: 'rating >= 4',
              then: 'Enviar convite para novo agendamento'
            }
          ]
        }
      ]
    };
  }

  static createOverbookingCheck() {
    return {
      name: 'Verificação de Overbooking',
      triggers: [
        {
          type: 'cron',
          cron: '0 */4 * * *' // A cada 4 horas
        }
      ],
      nodes: [
        {
          name: 'Verificar Conflitos',
          type: 'Database Query',
          query: `
            SELECT
              r.id,
              r.name,
              COUNT(b.id) as total_bookings,
              r.capacity
            FROM rooms r
            LEFT JOIN bookings b ON r.id = b.room_id
            WHERE DATE(b.check_in_date) <= CURDATE()
            AND DATE(b.check_out_date) > CURDATE()
            GROUP BY r.id
            HAVING COUNT(b.id) > r.capacity
          `
        },
        {
          name: 'Existe Conflito?',
          type: 'Conditional',
          condition: 'total_bookings > capacity'
        },
        {
          name: 'Alertar Gerência',
          type: 'Email',
          to: 'gerencia@pousada.com',
          subject: 'ALERTA: Possível Overbooking',
          body: 'Conflito detectado no quarto {{roomName}}'
        }
      ]
    };
  }

  static async generateWiFiCredentials() {
    const crypto = require('crypto');
    return crypto.randomBytes(8).toString('hex');
  }
}

module.exports = RemindersWorkflow;
9.4 Webhook para Integração de OTAs (Booking.com, AirBnB)
```
```javascript
// routes/ota-webhooks.routes.js

const express = require('express');
const router = express.Router();
const OTAService = require('../services/OTAService');
const BookingService = require('../services/BookingService');

// Webhook do Booking.com
router.post('/webhook/booking-com', async (req, res) => {
  try {
    const bookingData = req.body;

    // Validar assinatura
    if (!validateBookingComSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event_type, booking } = bookingData;

    switch (event_type) {
      case 'BOOKING_CREATED':
        await handleNewOTABooking(booking, 'booking_com');
        break;
      
      case 'BOOKING_MODIFIED':
        await handleModifiedBooking(booking, 'booking_com');
        break;
      
      case 'BOOKING_CANCELLED':
        await handleCancelledBooking(booking, 'booking_com');
        break;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao processar webhook Booking.com:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook do Airbnb
router.post('/webhook/airbnb', async (req, res) => {
  try {
    const webhookData = req.body;

    if (!validateAirbnbSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { events } = webhookData;

    for (const event of events) {
      const { event_type, data } = event;

      switch (event_type) {
        case 'booking.created':
          await handleNewOTABooking(data, 'airbnb');
          break;
        
        case 'booking.updated':
          await handleModifiedBooking(data, 'airbnb');
          break;
        
        case 'booking.cancelled':
          await handleCancelledBooking(data, 'airbnb');
          break;
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao processar webhook Airbnb:', error);
    res.status(500).json({ error: error.message });
  }
});

async function handleNewOTABooking(otaBookingData, source) {
  try {
    // 1. Verificar conflitos
    const hasConflict = await BookingService.checkOverbooking(
      otaBookingData.room_id,
      otaBookingData.check_in_date,
      otaBookingData.check_out_date
    );

    if (hasConflict) {
      // Alertar sobre conflito
      await OTAService.notifyOverbooking(source, otaBookingData);
      return;
    }

    // 2. Criar/atualizar cliente
    let customer = await CustomerService.findOrCreateFromOTA({
      otaId: otaBookingData.guest_id,
      source,
      name: otaBookingData.guest_name,
      email: otaBookingData.guest_email,
      phoneNumber: otaBookingData.guest_phone
    });

    // 3. Criar reserva
    const booking = await BookingService.create({
      customerId: customer.id,
      roomId: otaBookingData.room_id,
      checkInDate: otaBookingData.check_in_date,
      checkOutDate: otaBookingData.check_out_date,
      totalPrice: otaBookingData.total_price,
      source: source,
      otaBookingId: otaBookingData.id,
      status: 'confirmed',
      guestCount: otaBookingData.guest_count,
      specialRequests: otaBookingData.special_requests
    });

    // 4. Atualizar calendários em outros canais
    await OTAService.updateBlockedDates(source, {
      roomId: otaBookingData.room_id,
      checkIn: otaBookingData.check_in_date,
      checkOut: otaBookingData.check_out_date
    });

    // 5. Disparar automações
    await n8nService.triggerWorkflow('nova-reserva-ota', {
      booking,
      customer,
      source
    });

    console.log(`✅ Reserva OTA criada: ${booking.id} (${source})`);

  } catch (error) {
    console.error('Erro ao processar nova reserva OTA:', error);
    throw error;
  }
}

async function handleModifiedBooking(otaBookingData, source) {
  try {
    const booking = await BookingService.findByOTAId(
      otaBookingData.id,
      source
    );

    if (!booking) {
      console.warn(`Reserva OTA não encontrada: ${otaBookingData.id}`);
      return;
    }

    // Verificar se há conflito com mudança de datas
    if (otaBookingData.check_in_date !== booking.checkInDate ||
        otaBookingData.check_out_date !== booking.checkOutDate) {
      
      const hasConflict = await BookingService.checkOverbooking(
        booking.roomId,
        otaBookingData.check_in_date,
        otaBookingData.check_out_date,
        booking.id // Excluir reserva atual
      );

      if (hasConflict) {
        await OTAService.rejectModification(source, otaBookingData);
        return;
      }
    }

    // Atualizar reserva
    await booking.update({
      checkInDate: otaBookingData.check_in_date,
      checkOutDate: otaBookingData.check_out_date,
      totalPrice: otaBookingData.total_price,
      guestCount: otaBookingData.guest_count,
      specialRequests: otaBookingData.special_requests,
      lastModified: new Date()
    });

    // Sincronizar em outros canais
    await OTAService.syncBookingAcrossChannels(booking);

    console.log(`✅ Reserva OTA atualizada: ${booking.id}`);

  } catch (error) {
    console.error('Erro ao modificar reserva OTA:', error);
    throw error;
  }
}

async function handleCancelledBooking(otaBookingData, source) {
  try {
    const booking = await BookingService.findByOTAId(
      otaBookingData.id,
      source
    );

    if (!booking) {
      console.warn(`Reserva OTA não encontrada: ${otaBookingData.id}`);
      return;
    }

    // Cancelar reserva
    await booking.update({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: `Cancelada via ${source}`,
      otaCancellationReason: otaBookingData.cancellation_reason
    });

    // Processar reembolso se necessário
    if (booking.paymentStatus === 'paid') {
      await PaymentService.processRefund(booking);
    }

    // Sincronizar em outros canais
    await OTAService.releaseDates(source, {
      roomId: booking.roomId,
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate
    });

    console.log(`✅ Reserva OTA cancelada: ${booking.id}`);

  } catch (error) {
    console.error('Erro ao cancelar reserva OTA:', error);
    throw error;
  }
}

function validateBookingComSignature(req) {
  // Implementar validação de assinatura do Booking.com
  const signature = req.headers['x-booking-signature'];
  const timestamp = req.headers['x-booking-timestamp'];
  const body = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.BOOKING_COM_SECRET)
    .update(`${timestamp}${body}`)
    .digest('hex');

  return signature === expectedSignature;
}

function validateAirbnbSignature(req) {
  // Implementar validação de assinatura do Airbnb
  const signature = req.headers['x-airbnb-signature'];
  const body = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.AIRBNB_SECRET)
    .update(body)
    .digest('hex');

  return signature === expectedSignature;
}

module.exports = router;
9.5 N8N Self-Hosted Setup
```
```yaml
# docker-compose.yml para N8N

version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_PROTOCOL=https
      - N8N_HOST=${N8N_DOMAIN}
      - N8N_PORT=443
      - N8N_SECURE_COOKIE=true
      - WEBHOOK_URL=https://${N8N_DOMAIN}
      - DB_TYPE=postgres
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=${DB_NAME}
      - DB_POSTGRESDB_USER=${DB_USER}
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - EXECUTIONS_TIMEOUT=3600
      - N8N_LOG_LEVEL=info
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres
    networks:
      - n8n-network

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - n8n-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - n8n-network

volumes:
  n8n_data:
  postgres_data:
  redis_data:

networks:
  n8n-network:
    driver: bridge

10. DASHBOARD E RELATÓRIOS
10.1 Arquitetura do Dashboard
Copy┌─────────────────────────────────────────────────────────┐
│          Frontend - React Dashboard                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  1. HOME / OVERVIEW                              │  │
│  │  • KPIs em tempo real                            │  │
│  │  • Reservas de hoje                              │  │
│  │  • Check-ins pendentes                           │  │
│  │  • Alertas/Notificações                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  2. CALENDÁRIO / OCUPAÇÃO                         │  │
│  │  • View por quartos                              │  │
│  │  • Drag-and-drop de reservas                     │  │
│  │  • Conflitos visuais                             │  │
│  │  • Bloqueios e manutenção                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  3. RESERVAS                                      │  │
│  │  • Lista com filtros avançados                   │  │
│  │  • Edição inline                                 │  │
│  │  • Histórico de mudanças                         │  │
│  │  • Documentos anexados                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  4. CLIENTES                                      │  │
│  │  • CRM completo                                  │  │
│  │  • Histórico de estadias                         │  │
│  │  │ Segmentação e análise                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  5. FINANCEIRO                                    │  │
│  │  • Fluxo de caixa                                │  │
│  │  • Receitas por período                          │  │
│  │  • Despesas                                      │  │
│  │  • Lucros e margens                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  6. ANÁLISES / RELATÓRIOS                         │  │
│  │  • Taxa de ocupação                              │  │
│  │  • ADR (Average Daily Rate)                      │  │
│  │  • RevPAR (Revenue Per Available Room)           │  │
│  │  • Lead source analysis                          │  │
│  │  • Customer lifetime value                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  7. AUTOMAÇÕES / N8N                              │  │
│  │  • Status dos workflows                          │  │
│  │  • Logs de execução                              │  │
│  │  • Configuração de triggers                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  8. CONFIGURAÇÕES / ADMIN                         │  │
│  │  • Gerenciamento de usuários                     │  │
│  │  • Permissões e roles                            │  │
│  │  • Integrações (OTAs, WhatsApp, etc)             │  │
│  │  • Backups e segurança                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
         ↓
    REST API
         ↓
┌─────────────────────────────────────────────────────────┐
│         Backend - Node.js APIs                          │
├─────────────────────────────────────────────────────────┤
│ • Query builders otimizados                            │
│ • Caching com Redis                                    │
│ • Real-time updates via WebSocket                      │
│ • Geração de relatórios                                │
└─────────────────────────────────────────────────────────┘
         ↓
    Database
         ↓
┌─────────────────────────────────────────────────────────┐
│    PostgreSQL com índices otimizados                    │
└─────────────────────────────────────────────────────────┘

CRM e Sistema de Automação - Pousada Luz da Lua
Documentação Técnica Completa

10.2 Componentes React do Dashboard
10.2.1 Estrutura de Pastas
Copysrc/
├── components/
│   ├── Dashboard/
│   │   ├── DashboardLayout.jsx
│   │   ├── DashboardCard.jsx
│   │   ├── MetricCard.jsx
│   │   └── styles.module.css
│   ├── Charts/
│   │   ├── OccupancyChart.jsx
│   │   ├── RevenueChart.jsx
│   │   ├── GuestSourceChart.jsx
│   │   └── TrendChart.jsx
│   ├── Tables/
│   │   ├── ReservationsTable.jsx
│   │   ├── GuestTable.jsx
│   │   ├── TasksTable.jsx
│   │   └── TablePagination.jsx
│   ├── Forms/
│   │   ├── ReservationForm.jsx
│   │   ├── GuestForm.jsx
│   │   ├── RoomForm.jsx
│   │   └── FormValidation.jsx
│   ├── Modals/
│   │   ├── ReservationModal.jsx
│   │   ├── GuestModal.jsx
│   │   ├── ConfirmDialog.jsx
│   │   └── NotificationModal.jsx
│   ├── Calendar/
│   │   ├── CalendarView.jsx
│   │   ├── RoomCalendar.jsx
│   │   └── CalendarEvent.jsx
│   └── Common/
│       ├── Header.jsx
│       ├── Sidebar.jsx
│       ├── LoadingSpinner.jsx
│       ├── ErrorBoundary.jsx
│       └── Toast.jsx
10.2.2 Componente Principal - DashboardLayout.jsx
```
```jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import Header from './Header';
import Sidebar from './Sidebar';
import MetricCard from './MetricCard';
import OccupancyChart from '../Charts/OccupancyChart';
import RevenueChart from '../Charts/RevenueChart';
import ReservationsTable from '../Tables/ReservationsTable';
import styles from './styles.module.css';

const DashboardLayout = () => {
  const { user } = useAuth();
  const { get } = useApi();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalGuests: 0,
    occupancyRate: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    totalRevenue: 0,
    averageRating: 0,
    pendingTasks: 0,
    upcomingReservations: 0
  });
  const [periodData, setPeriodData] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [metricsRes, periodRes] = await Promise.all([
        get('/api/dashboard/metrics'),
        get('/api/dashboard/period?days=30')
      ]);

      setMetrics(metricsRes.data);
      setPeriodData(periodRes.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.dashboardContainer}>
      <Header user={user} />
      
      <div className={styles.mainContent}>
        <Sidebar />
        
        <div className={styles.contentArea}>
          <section className={styles.metricsSection}>
            <h2>Métricas Gerenciais</h2>
            <div className={styles.metricsGrid}>
              <MetricCard
                title="Hóspedes Atuais"
                value={metrics.totalGuests}
                icon="👥"
                trend="+5%"
                color="blue"
              />
              <MetricCard
                title="Taxa de Ocupação"
                value={`${metrics.occupancyRate}%`}
                icon="🛏️"
                trend="+2%"
                color="green"
              />
              <MetricCard
                title="Check-ins Hoje"
                value={metrics.todayCheckIns}
                icon="📥"
                trend="0%"
                color="orange"
              />
              <MetricCard
                title="Check-outs Hoje"
                value={metrics.todayCheckOuts}
                icon="📤"
                trend="0%"
                color="red"
              />
              <MetricCard
                title="Receita Total"
                value={`R$ ${metrics.totalRevenue.toLocaleString('pt-BR')}`}
                icon="💰"
                trend="+12%"
                color="gold"
              />
              <MetricCard
                title="Avaliação Média"
                value={`${metrics.averageRating.toFixed(1)}/5`}
                icon="⭐"
                trend="+0.2"
                color="purple"
              />
              <MetricCard
                title="Tarefas Pendentes"
                value={metrics.pendingTasks}
                icon="✅"
                trend="-3"
                color="warning"
              />
              <MetricCard
                title="Reservas Próximos 7 dias"
                value={metrics.upcomingReservations}
                icon="📅"
                trend="+8"
                color="info"
              />
            </div>
          </section>

          <section className={styles.chartsSection}>
            <div className={styles.chartContainer}>
              <OccupancyChart data={periodData?.occupancy} />
            </div>
            <div className={styles.chartContainer}>
              <RevenueChart data={periodData?.revenue} />
            </div>
          </section>

          <section className={styles.tableSection}>
            <h2>Próximas Reservas</h2>
            <ReservationsTable limit={10} onRefresh={loadDashboardData} />
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
10.2.3 Componente MetricCard.jsx
```
```jsx
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import styles from './MetricCard.module.css';

const MetricCard = ({ 
  title, 
  value, 
  icon, 
  trend = '0%', 
  color = 'blue',
  onClick = null,
  subtitle = null 
}) => {
  const isTrendPositive = !trend.startsWith('-');

  return (
    <div 
      className={`${styles.metricCard} ${styles[color]}`}
      onClick={onClick}
      role="article"
      aria-label={`${title}: ${value}`}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.icon}>{icon}</span>
      </div>

      <div className={styles.content}>
        <div className={styles.valueContainer}>
          <span className={styles.value}>{value}</span>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>

        <div className={`${styles.trend} ${isTrendPositive ? styles.positive : styles.negative}`}>
          {isTrendPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{trend}</span>
        </div>
      </div>

      <div className={styles.footer}>
        <small>Comparado ao período anterior</small>
      </div>
    </div>
  );
};

export default MetricCard;
10.2.4 Componente de Tabela - ReservationsTable.jsx
```
```jsx
import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Edit2, Trash2, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import TablePagination from './TablePagination';
import styles from './ReservationsTable.module.css';

const ReservationsTable = ({ limit = 10, onRefresh, filters = {} }) => {
  const { get, delete: apiDelete } = useApi();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('checkIn');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    loadReservations();
  }, [currentPage, sortBy, sortOrder, filters]);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit,
        sortBy,
        sortOrder,
        ...filters
      });

      const response = await get(`/api/reservations?${params}`);
      setReservations(response.data.reservations);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Erro ao carregar reservas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Deseja deletar esta reserva?')) {
      try {
        await apiDelete(`/api/reservations/${id}`);
        loadReservations();
        onRefresh?.();
      } catch (error) {
        console.error('Erro ao deletar reserva:', error);
      }
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      confirmed: { label: 'Confirmada', color: 'green' },
      pending: { label: 'Pendente', color: 'yellow' },
      checkedIn: { label: 'Check-in', color: 'blue' },
      checkedOut: { label: 'Check-out', color: 'gray' },
      cancelled: { label: 'Cancelada', color: 'red' }
    };
    
    const config = statusConfig[status] || { label: status, color: 'gray' };
    return <span className={`${styles.badge} ${styles[config.color]}`}>{config.label}</span>;
  };

  if (loading) {
    return <div className={styles.loading}>Carregando reservas...</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th onClick={() => handleSort('guestName')}>
              Hóspede {sortBy === 'guestName' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('room')}>
              Quarto {sortBy === 'room' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('checkIn')}>
              Check-in {sortBy === 'checkIn' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('checkOut')}>
              Check-out {sortBy === 'checkOut' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th>Noites</th>
            <th onClick={() => handleSort('totalPrice')}>
              Valor {sortBy === 'totalPrice' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map(reservation => (
            <tr key={reservation.id}>
              <td className={styles.guestName}>
                <strong>{reservation.guest.name}</strong>
                <small>{reservation.guest.email}</small>
              </td>
              <td>{reservation.room.number}</td>
              <td>{new Date(reservation.checkIn).toLocaleDateString('pt-BR')}</td>
              <td>{new Date(reservation.checkOut).toLocaleDateString('pt-BR')}</td>
              <td className={styles.centered}>{reservation.nights}</td>
              <td className={styles.value}>R$ {reservation.totalPrice.toFixed(2)}</td>
              <td>{getStatusBadge(reservation.status)}</td>
              <td className={styles.actions}>
                <button 
                  className={styles.btnAction}
                  title="Visualizar"
                  aria-label={`Visualizar reserva ${reservation.id}`}
                >
                  <Eye size={18} />
                </button>
                <button 
                  className={styles.btnAction}
                  title="Editar"
                  aria-label={`Editar reserva ${reservation.id}`}
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  className={`${styles.btnAction} ${styles.danger}`}
                  onClick={() => handleDelete(reservation.id)}
                  title="Deletar"
                  aria-label={`Deletar reserva ${reservation.id}`}
                >
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default ReservationsTable;
10.2.5 Componente de Gráfico - OccupancyChart.jsx
```
```jsx
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import styles from './OccupancyChart.module.css';

const OccupancyChart = ({ data = [], title = 'Taxa de Ocupação' }) => {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      date: new Date(item.date).toLocaleDateString('pt-BR', { 
        month: 'short', 
        day: 'numeric' 
      }),
      occupancy: Math.round(item.occupancyRate || 0),
      available: 100 - Math.round(item.occupancyRate || 0),
      fullName: item.date
    }));
  }, [data]);

  const averageOccupancy = useMemo(() => {
    if (chartData.length === 0) return 0;
    const sum = chartData.reduce((acc, item) => acc + item.occupancy, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipDate}>{payload[0].payload.fullName}</p>
          <p className={styles.tooltipOccupancy}>
            Ocupação: <strong>{payload[0].value}%</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.label}>Média</span>
            <span className={styles.value}>{averageOccupancy}%</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            domain={[0, 100]}
            label={{ value: '%', angle: -90, position: 'insideLeft' }}
            style={{ fontSize: '12px' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="occupancy" 
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill="url(#colorOccupancy)"
            name="Taxa de Ocupação"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OccupancyChart;
10.2.6 Componente de Gráfico - RevenueChart.jsx
```
```jsx
import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import styles from './RevenueChart.module.css';

const RevenueChart = ({ data = [], title = 'Receita Diária' }) => {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      date: new Date(item.date).toLocaleDateString('pt-BR', { 
        month: 'short', 
        day: 'numeric' 
      }),
      revenue: parseFloat(item.revenue || 0),
      reservations: item.reservations || 0,
      fullName: item.date
    }));
  }, [data]);

  const totalRevenue = useMemo(() => {
    return chartData.reduce((acc, item) => acc + item.revenue, 0);
  }, [chartData]);

  const averageRevenue = useMemo(() => {
    return chartData.length > 0 ? totalRevenue / chartData.length : 0;
  }, [chartData, totalRevenue]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipDate}>{payload[0].payload.fullName}</p>
          <p className={styles.tooltipRevenue}>
            Receita: <strong>R$ {payload[0].value.toFixed(2)}</strong>
          </p>
          <p className={styles.tooltipReservations}>
            Reservas: <strong>{payload[0].payload.reservations}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  const getBarColor = (value) => {
    if (value >= averageRevenue * 1.2) return '#10b981'; // green
    if (value >= averageRevenue) return '#3b82f6'; // blue
    return '#f59e0b'; // amber
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.label}>Total</span>
            <span className={styles.value}>R$ {totalRevenue.toFixed(2)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Média</span>
            <span className={styles.value}>R$ {averageRevenue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={{ value: 'R$', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="revenue" name="Receita" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.revenue)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
10.2.7 Componente de Formulário - ReservationForm.jsx
```
```jsx
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useApi } from '../../hooks/useApi';
import styles from './ReservationForm.module.css';

const ReservationForm = ({ reservationId = null, onSuccess, onCancel }) => {
  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      guestId: '',
      roomId: '',
      checkIn: '',
      checkOut: '',
      guests: 1,
      totalPrice: 0,
      specialRequests: '',
      paymentStatus: 'pending',
      notes: ''
    }
  });

  const { post, put, get } = useApi();
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);

  const checkIn = watch('checkIn');
  const checkOut = watch('checkOut');
  const roomId = watch('roomId');
  const guestCount = watch('guests');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (checkIn && checkOut && roomId) {
      calculatePrice();
      checkRoomAvailability();
    }
  }, [checkIn, checkOut, roomId]);

  const loadInitialData = async () => {
    try {
      const [roomsRes, guestsRes] = await Promise.all([
        get('/api/rooms'),
        get('/api/guests')
      ]);
      setRooms(roomsRes.data);
      setGuests(guestsRes.data);

      if (reservationId) {
        const reservationRes = await get(`/api/reservations/${reservationId}`);
        reset(reservationRes.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const calculatePrice = async () => {
    if (!checkIn || !checkOut || !roomId) return;

    try {
      const nights = Math.ceil(
        (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)
      );
      const room = rooms.find(r => r.id === roomId);
      const totalPrice = nights * (room?.pricePerNight || 0);

      // Atualizar valor no formulário
      reset(prev => ({
        ...prev,
        totalPrice
      }));
    } catch (error) {
      console.error('Erro ao calcular preço:', error);
    }
  };

  const checkRoomAvailability = async () => {
    if (!checkIn || !checkOut || !roomId) return;

    try {
      const response = await get('/api/rooms/availability', {
        roomId,
        checkIn,
        checkOut
      });
      setAvailableRooms(response.data);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      
      if (reservationId) {
        await put(`/api/reservations/${reservationId}`, data);
      } else {
        await post('/api/reservations', data);
      }

      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formGroup}>
        <label htmlFor="guestId">Hóspede *</label>
        <Controller
          name="guestId"
          control={control}
          rules={{ required: 'Hóspede é obrigatório' }}
          render={({ field }) => (
            <select {...field} id="guestId">
              <option value="">Selecionar hóspede</option>
              {guests.map(guest => (
                <option key={guest.id} value={guest.id}>
                  {guest.name} ({guest.email})
                </option>
              ))}
            </select>
          )}
        />
        {errors.guestId && <span className={styles.error}>{errors.guestId.message}</span>}
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="checkIn">Check-in *</label>
          <Controller
            name="checkIn"
            control={control}
            rules={{ required: 'Check-in é obrigatório' }}
            render={({ field }) => (
              <input {...field} type="date" id="checkIn" />
            )}
          />
          {errors.checkIn && <span className={styles.error}>{errors.checkIn.message}</span>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="checkOut">Check-out *</label>
          <Controller
            name="checkOut"
            control={control}
            rules={{ required: 'Check-out é obrigatório' }}
            render={({ field }) => (
              <input {...field} type="date" id="checkOut" />
            )}
          />
          {errors.checkOut && <span className={styles.error}>{errors.checkOut.message}</span>}
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="roomId">Quarto *</label>
          <Controller
            name="roomId"
            control={control}
            rules={{ required: 'Quarto é obrigatório' }}
            render={({ field }) => (
              <select {...field} id="roomId">
                <option value="">Selecionar quarto</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    Quarto {room.number} - R$ {room.pricePerNight}/noite
                  </option>
                ))}
              </select>
            )}
          />
          {errors.roomId && <span className={styles.error}>{errors.roomId.message}</span>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="guests">Número de Hóspedes *</label>
          <Controller
            name="guests"
            control={control}
            rules={{ required: 'Número de hóspedes é obrigatório' }}
            render={({ field }) => (
              <input {...field} type="number" id="guests" min="1" max="6" />
            )}
          />
          {errors.guests && <span className={styles.error}>{errors.guests.message}</span>}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="paymentStatus">Status do Pagamento</label>
        <Controller
          name="paymentStatus"
          control={control}
          render={({ field }) => (
            <select {...field} id="paymentStatus">
              <option value="pending">Pendente</option>
              <option value="partial">Parcial</option>
              <option value="confirmed">Confirmado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          )}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="specialRequests">Solicitações Especiais</label>
        <Controller
          name="specialRequests"
          control={control}
          render={({ field }) => (
            <textarea {...field} id="specialRequests" rows="3" />
          )}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="notes">Notas Internas</label>
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <textarea {...field} id="notes" rows="3" />
          )}
        />
      </div>

      <div className={styles.priceDisplay}>
        <span>Preço Total:</span>
        <span className={styles.price}>R$ {watch('totalPrice').toFixed(2)}</span>
      </div>

      <div className={styles.formActions}>
        <button 
          type="button" 
          onClick={onCancel} 
          className={styles.btnCancel}
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className={styles.btnSubmit}
          disabled={loading}
        >
          {loading ? 'Salvando...' : reservationId ? 'Atualizar' : 'Criar Reserva'}
        </button>
      </div>
    </form>
  );
};

export default ReservationForm;
10.2.8 Hook Customizado - useApi.js
```
```javascript
import { useCallback } from 'react';
import { useAuth } from './useAuth';

export const useApi = () => {
  const { token } = useAuth();
  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const makeRequest = useCallback(async (endpoint, options = {}) => {
    const url = `${baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized
          window.location.href = '/login';
        }
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Request error:', error);
      throw error;
    }
  }, [token, baseURL]);

  const get = useCallback((endpoint, queryParams = {}) => {
    const params = new URLSearchParams(queryParams);
    const url = params.toString() ? `${endpoint}?${params}` : endpoint;
    return makeRequest(url, { method: 'GET' });
  }, [makeRequest]);

  const post = useCallback((endpoint, data) => {
    return makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, [makeRequest]);

  const put = useCallback((endpoint, data) => {
    return makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }, [makeRequest]);

  const patch = useCallback((endpoint, data) => {
    return makeRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }, [makeRequest]);

  const delete_ = useCallback((endpoint) => {
    return makeRequest(endpoint, { method: 'DELETE' });
  }, [makeRequest]);

  return {
    get,
    post,
    put,
    patch,
    delete: delete_,
    makeRequest,
  };
};
10.2.9 Estilos CSS - styles.module.css
```
```css
/* Dashboard Container */
.dashboardContainer {
  display: flex;
  height: 100vh;
  background-color: #f9fafb;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.mainContent {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.contentArea {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* Sections */
.metricsSection,
.chartsSection,
.tableSection {
  margin-bottom: 32px;
}

.metricsSection h2,
.chartsSection h2,
.tableSection h2 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 16px;
}

/* Metrics Grid */
.metricsGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

/* Charts Section */
.chartsSection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.chartContainer {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .metricsGrid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .chartsSection {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .contentArea {
    padding: 12px;
  }

  .metricsGrid {
    grid-template-columns: 1fr;
  }

  .chartsSection {
    grid-template-columns: 1fr;
  }
}
10.2.10 Componente de Calendário - CalendarView.jsx
```
```jsx
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CalendarView.module.css';

const CalendarView = ({ reservations = [], onDateSelect }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const reservationsByDate = useMemo(() => {
    const map = {};
    reservations.forEach(reservation => {
      const date = new Date(reservation.checkIn).toLocaleDateString('pt-BR');
      if (!map[date]) map[date] = [];
      map[date].push(reservation);
    });
    return map;
  }, [reservations]);

  const monthDays = useMemo(() => {
    const days = [];
    const totalDays = daysInMonth(currentDate);
    const startingDayOfWeek = firstDayOfMonth(currentDate);

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      days.push(day);
    }

    return days;
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthName = currentDate.toLocaleDateString('pt-BR', { 
    month: 'long', 
    year: 'numeric' 
  });

  const getDayReservations = (day) => {
    if (!day) return [];
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = date.toLocaleDateString('pt-BR');
    return reservationsByDate[dateStr] || [];
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button onClick={handlePrevMonth} aria-label="Mês anterior">
          <ChevronLeft size={20} />
        </button>
        <h2>{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h2>
        <button onClick={handleNextMonth} aria-label="Próximo mês">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className={styles.weekDays}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
          <div key={day} className={styles.weekDay}>{day}</div>
        ))}
      </div>

      <div className={styles.days}>
        {monthDays.map((day, index) => {
          const dayReservations = getDayReservations(day);
          const isToday = day && new Date().toDateString() === 
            new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

          return (
            <div 
              key={index}
              className={`${styles.day} ${day ? '' : styles.empty} ${isToday ? styles.today : ''}`}
              onClick={() => day && onDateSelect?.(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              role="button"
              tabIndex={day ? 0 : -1}
            >
              {day && (
                <>
                  <span className={styles.dayNumber}>{day}</span>
                  {dayReservations.length > 0 && (
                    <div className={styles.reservationDots}>
                      {dayReservations.slice(0, 2).map((_, i) => (
                        <span key={i} className={styles.dot} />
                      ))}
                      {dayReservations.length > 2 && (
                        <span className={styles.more}>+{dayReservations.length - 2}</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;

11. Integrações e Extensões
11.1 Integração Google Calendar
```
```jsx
// components/Integrations/GoogleCalendarSync.jsx
import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';

const GoogleCalendarSync = ({ reservationId }) => {
  const { post } = useApi();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await post('/api/integrations/google-calendar/sync', {
        reservationId
      });
      alert('Sincronizado com Google Calendar');
    } catch (error) {
      alert('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button onClick={handleSync} disabled={syncing}>
      {syncing ? 'Sincronizando...' : '📅 Sincronizar Google Calendar'}
    </button>
  );
};

export default GoogleCalendarSync;
11.2 Integração Stripe (Pagamentos)
```
```jsx
// components/Payments/StripePayment.jsx
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useApi } from '../../hooks/useApi';
import styles from './StripePayment.module.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_KEY);

const StripePaymentForm = ({ reservationId, amount, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { post } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const { token } = await stripe.createToken(elements.getElement(CardElement));
      
      if (token) {
        const response = await post('/api/payments/charge', {
          reservationId,
          amount,
          token: token.id
        });

        onSuccess?.(response);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.cardElement}>
        <CardElement />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <button 
        type="submit" 
        disabled={!stripe || loading}
        className={styles.submitBtn}
      >
        {loading ? 'Processando...' : `Pagar R$ ${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
};

const StripePayment = (props) => (
  <Elements stripe={stripePromise}>
    <StripePaymentForm {...props} />
  </Elements>
);

export default StripePayment;

12. Testes Unitários
12.1 Testes do Componente MetricCard
```
```javascript
// __tests__/components/MetricCard.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import MetricCard from '../../components/Dashboard/MetricCard';

describe('MetricCard', () => {
  it('should render metric card with title and value', () => {
    render(
      <MetricCard 
        title="Test Metric" 
        value="100"
        icon="📊"
      />
    );
    
    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should display positive trend correctly', () => {
    render(
      <MetricCard 
        title="Revenue" 
        value="1000"
        trend="+10%"
      />
    );
    
    expect(screen.getByText('+10%')).toBeInTheDocument();
  });

  it('should apply correct color class', () => {
    const { container } = render(
      <MetricCard 
        title="Metric" 
        value="50"
        color="green"
      />
    );
    
    expect(container.querySelector('.green')).toBeInTheDocument();
  });
});
12.2 Testes da API
```
```javascript
// __tests__/api/reservations.test.js
import request from 'supertest';
import app from '../../app';
import { Reservation } from '../../models';

describe('Reservations API', () => {
  beforeEach(async () => {
    await Reservation.destroy({ where: {} });
  });

  it('POST /api/reservations - should create a new reservation', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .send({
        guestId: 1,
        roomId: 1,
        checkIn: '2024-01-15',
        checkOut: '2024-01-20',
        guests: 2
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('GET /api/reservations - should list all reservations', async () => {
    const res = await request(app)
      .get('/api/reservations');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/reservations/:id - should update a reservation', async () => {
    const reservation = await Reservation.create({
      guestId: 1,
      roomId: 1,
      checkIn: new Date('2024-01-15'),
      checkOut: new Date('2024-01-20')
    });

    const res = await request(app)
      .put(`/api/reservations/${reservation.id}`)
      .send({ status: 'confirmed' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });
});

13. Performance e Otimizações
13.1 Lazy Loading de Componentes
```
```jsx
// utils/lazyLoad.js
import React, { Suspense, lazy } from 'react';

const LoadingFallback = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    Carregando...
  </div>
);

export const lazyLoad = (importFunc) => {
  const Component = lazy(importFunc);
  return (props) => (
    <Suspense fallback={<LoadingFallback />}>
      <Component {...props} />
    </Suspense>
  );
};

// routes/index.jsx
const Dashboard = lazyLoad(() => import('../pages/Dashboard'));
const Guests = lazyLoad(() => import('../pages/Guests'));
const Reservations = lazyLoad(() => import('../pages/Reservations'));
const Rooms = lazyLoad(() => import('../pages/Rooms'));
13.2 Caching de Dados
```
```javascript
// hooks/useCache.js
import { useRef, useCallback } from 'react';

export const useCache = (duration = 5 * 60 * 1000) => {
  const cacheRef = useRef(new Map());

  const get = useCallback((key) => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < duration) {
      return cached.data;
    }
    return null;
  }, [duration]);

  const set = useCallback((key, data) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  const clear = useCallback((key) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  return { get, set, clear };
};
13.3 Compressão Gzip no Backend
```
```javascript
// server.js
const compression = require('compression');

app.use(compression({
  level: 6,
  threshold: 10 * 1000, // 10KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

14. Configuração de Deploy
14.1 Docker Compose
```
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: crm_postgres
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - crm_network

  redis:
    image: redis:7-alpine
    container_name: crm_redis
    ports:
      - "6379:6379"
    networks:
      - crm_network

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crm_api
    environment:
      NODE_ENV: ${NODE_ENV}
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      WHATSAPP_TOKEN: ${WHATSAPP_TOKEN}
    depends_on:
      - postgres
      - redis
    ports:
      - "3001:3001"
    networks:
      - crm_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: crm_frontend
    environment:
      REACT_APP_API_URL: ${REACT_APP_API_URL}
      REACT_APP_STRIPE_KEY: ${REACT_APP_STRIPE_KEY}
    depends_on:
      - api
    ports:
      - "3000:3000"
    networks:
      - crm_network

  n8n:
    image: n8nio/n8n:latest
    container_name: crm_n8n
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_USER: ${DB_USER}
      DB_POSTGRESDB_PASSWORD: ${DB_PASSWORD}
      DB_POSTGRESDB_DATABASE: n8n
    depends_on:
      - postgres
    ports:
      - "5678:5678"
    networks:
      - crm_network
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  postgres_data:
  n8n_data:

networks:
  crm_network:
    driver: bridge
14.2 Dockerfile - Backend
```
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
14.3 Dockerfile - Frontend
```
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

15. Monitoramento e Logging
15.1 Winston Logger
```
```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'crm-api' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

module.exports = logger;
15.2 Prometheus Metrics
```
```javascript
// utils/metrics.js
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

const reservationCounter = new prometheus.Counter({
  name: 'reservations_total',
  help: 'Total number of reservations',
  labelNames: ['status'],
});

const dbQueryDuration = new prometheus.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
});

module.exports = {
  httpRequestDuration,
  reservationCounter,
  dbQueryDuration,
};

```
Conclusão
Este CRM completo fornece:
✅ Sistema robusto de gerenciamento de reservas
✅ Automação com n8n e WhatsApp
✅ Dashboard intuitivo e responsivo
✅ Pagamentos integrados com Stripe
✅ Sincronização com Google Calendar
✅ Testes unitários e de integração
✅ Deploy containerizado com Docker
✅ Monitoramento em tempo real
Para iniciar:
```bash
git clone <repository>
cd crm-pousada
docker-compose up -d
Acesso: http://localhost:3000


```