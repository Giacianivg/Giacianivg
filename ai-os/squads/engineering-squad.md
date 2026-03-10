# Squad 4 — Engenharia

**Líder:** CTO Agent (`ai-os/board/cto-agent.md`)
**Criado:** 2026-03-10 — DEC-013

---

## Missão

Manter o sistema estável, escalável e seguro. O Squad 4 é o guardião da qualidade técnica — nada entra em produção sem passar pelo gate. Zero downtime é inegociável.

---

## Membros

| Agente | Arquivo | Papel no Squad |
|--------|---------|----------------|
| @dev Dex | (role AIOS) | Implementação, commits, story phase 3 |
| @qa | (role AIOS) | Quality gate (7 checks), testes, aprovação de deploy |
| @devops Gage | (role AIOS) | Git push, deploy Vercel, MCP, CI/CD (exclusivo) |
| @data-engineer Dara | (role AIOS) | Schema, migrations, queries, RLS |
| @architect Aria | (role AIOS, shared com Squad 3) | Arquitetura, veto técnico absoluto |

---

## Responsabilidades

- Implementação de todas as features aprovadas pelo board
- Quality gate obrigatório antes de qualquer deploy
- Gerenciamento de migrations (007+)
- Manutenção de `server.js`, `webhook.js`, `vercel.json` (CTO approval required)
- Monitoramento de 139/139 testes
- Gestão de débito técnico

---

## KPIs

| Métrica | Target | Fonte |
|---------|--------|-------|
| Testes passando | 139/139 | `npm test` |
| Downtime produção | Zero | Vercel logs |
| Deploy | < 5 minutos | `npx vercel --prod` |
| CTO veto score | Bloqueia se < 30 | Decision Engine |

---

## Regras CTO (inegociáveis)

| Arquivo | Regra |
|---------|-------|
| `server.js` | Alteração requer aprovação CTO explícita |
| `vercel.json` | Alteração requer aprovação CTO explícita |
| `services/whatsapp/webhook.js` | Alteração requer aprovação CTO explícita |
| `services/luna/system-prompt.js` | Alteração requer aprovação CTO explícita |
| `database/migrations/001–006` | NUNCA alterar — criar nova migration numerada |
| `agents/` existentes | Não sobrescrever sem DEC aprovado |

---

## Linha de Reporte

```
CTO Agent
  ↓
@architect Aria (veto técnico) | @dev Dex | @qa | @devops Gage | @data-engineer Dara
  ↓
Board via Decision Engine (quando necessário)
```

---

## Nível de Decisão

- **N3 (autônomo):** implementar story aprovada, rodar testes, criar migration 007+
- **N2 (board vota):** nova dependência, mudança de arquitetura, refactor significativo
- **N1 (founder):** alteração em arquivos críticos (webhook, server, vercel.json)
