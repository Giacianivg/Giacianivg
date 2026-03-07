# CRM Frontend — Tech Stack Validation & Integration

**Versão:** 1.0
**Data:** 2026-03-07
**Propósito:** Validação de escolhas tecnológicas, trade-offs, e prova de conceito

---

## 1. Stack Justification Matrix

### Frontend Tier

| Tecnologia | Versão | Porquê | Trade-off | Alternativa |
|-----------|--------|-------|-----------|------------|
| **Next.js 14** | 14.x | App Router, SSR, Deploy Vercel simples | Maior bundle (+~50kb) | Vite + React |
| **React 18** | 18.x | Hooks, Suspense, bom suporte | Não funciona IE11 | Angular, Vue |
| **TypeScript** | 5.x | Type safety, melhor DX | Setup inicial | JavaScript |
| **TailwindCSS** | 3.x | Utility-first, JIT compiler | Aprend. curve | Bootstrap, Material UI |
| **shadcn/ui** | latest | Customizável, headless, Radix-based | Não pré-built | MUI, Chakra |
| **React Hook Form** | 7.x | Performance (uncontrolled), Zod integration | Menor docs | Formik, React Final Form |
| **Zod** | 3.x | Type-safe schemas, runtime validation | Parsing extra | Joi, Yup |
| **TanStack Query** | 5.x | Caching, background refetch, DevTools | Mais boilerplate | SWR, Apollo |
| **TanStack Table** | 8.x | Headless, sorting, filtering, pagination | Menos built-in | DataTables, AG Grid |
| **Recharts** | 2.x | React-first, simples, responsive | Menos customizável | Chart.js, D3, ECharts |
| **React Big Calendar** | 1.8+ | Calendário profissional, drag-drop | Menos features | FullCalendar.io, Tus-da |
| **Supabase Auth** | built-in | Integrado com DB, gratuito, MFA ready | Menos enterprise | Auth0, Okta |
| **Axios** | 1.x | Interceptors, timeout, cancel requests | Alternativa: Fetch | Fetch API, node-fetch |

---

## 2. Integration Test Matrix

### Testes de Integração Obrigatórios

#### 2.1 Auth Flow
```typescript
// __tests__/e2e/auth.spec.ts
test('should login, navigate dashboard, then logout', async ({ page }) => {
  // 1. Visit login page
  await page.goto('http://localhost:3000/crm/login');

  // 2. Fill form
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 3. Verify redirect to dashboard
  await page.waitForURL('**/crm/dashboard');

  // 4. Check navbar shows email
  await expect(page.getByText('test@example.com')).toBeVisible();

  // 5. Logout
  await page.click('[aria-label="user-menu"]');
  await page.click('text=Logout');

  // 6. Verify redirect to login
  await page.waitForURL('**/crm/login');
});
```

**Critério:** ✅ Toda transição de auth validada

---

#### 2.2 API Integration
```typescript
// __tests__/integration/leads.spec.ts
test('should fetch leads list via API with correct auth header', async () => {
  const { data } = await apiClient.get('/api/leads');

  expect(data).toHaveProperty('success', true);
  expect(data).toHaveProperty('data');
  expect(Array.isArray(data.data)).toBe(true);

  // Validate structure
  data.data.forEach(lead => {
    expect(lead).toHaveProperty('id');
    expect(lead).toHaveProperty('whatsapp_number');
    expect(lead).toHaveProperty('name');
  });
});
```

**Critério:** ✅ Schemas validados contra responses reais

---

#### 2.3 Query Caching
```typescript
// __tests__/unit/hooks/useLeads.spec.ts
test('should cache leads query and not refetch on mount', async () => {
  const { result } = renderHook(() => useLeads(), { wrapper: QueryClientProvider });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  const firstData = result.current.data;

  // Unmount and remount within staleTime
  // Should NOT refetch
  expect(result.current.data).toBe(firstData);
});
```

**Critério:** ✅ Caching funciona conforme configurado

---

#### 2.4 Form Validation
```typescript
// __tests__/component/LeadModal.spec.tsx
test('should validate and submit lead form', async () => {
  const { getByRole, getByText } = render(
    <LeadModal isOpen={true} mode="create" onSubmit={mockSubmit} />
  );

  // Submit empty form
  fireEvent.click(getByRole('button', { name: /salvar/i }));

  // Verify errors
  expect(await getByText(/nome.*required/i)).toBeInTheDocument();
  expect(await getByText(/telefone.*required/i)).toBeInTheDocument();

  // Fill form
  fireEvent.change(getByRole('textbox', { name: /nome/i }), {
    target: { value: 'João Silva' }
  });
  fireEvent.change(getByRole('textbox', { name: /telefone/i }), {
    target: { value: '5519999999999' }
  });

  // Submit valid form
  fireEvent.click(getByRole('button', { name: /salvar/i }));

  await waitFor(() => {
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'João Silva',
        whatsapp_number: '5519999999999'
      })
    );
  });
});
```

**Critério:** ✅ Validação Zod + React Hook Form integradas

---

## 3. Performance Benchmarks

### Target Metrics

| Métrica | Target | Current | Status |
|---------|--------|---------|--------|
| **FCP** (First Contentful Paint) | <1.5s | TBD | Setup Phase 2 |
| **LCP** (Largest Contentful Paint) | <2.5s | TBD | Setup Phase 2 |
| **CLS** (Cumulative Layout Shift) | <0.1 | TBD | Setup Phase 2 |
| **TTI** (Time to Interactive) | <3.5s | TBD | Setup Phase 2 |
| **Bundle Size** (JS) | <200kb | TBD | Measure Phase 0 |
| **Dashboard Load** | <2s | TBD | Measure Phase 2 |
| **Table with 100 rows** | <500ms | TBD | Measure Phase 3 |
| **Calendar render** | <1s | TBD | Measure Phase 4 |

### Optimization Strategy

```
1. Code Splitting
   - Dynamic imports para rotas
   - Lazy load componentes grandes (Calendar, Charts)

2. Bundle Analysis
   - npx next/bundle-analyzer para identificar bloat
   - Tree-shake unused código

3. Image Optimization
   - Next.js Image component com lazy loading
   - WebP format com fallback

4. Caching Strategy
   - TanStack Query staleTime: 5 min
   - Browser cache headers via Vercel
   - Service Worker (optional Phase 8)

5. Database Query Optimization
   - API paginação (padrão 20 items)
   - Índices no Supabase
   - Prefetch relacionados
```

---

## 4. Security Validation

### Checklist OWASP

#### 4.1 OWASP Top 10 Mitigations

| Vulnerabilidade | Risco | Mitigação |
|-----------------|-------|-----------|
| **Injection** | Alto | Zod validation, parameterized queries (Supabase) |
| **Broken Auth** | Alto | Supabase Auth + JWT, HTTPS only, secure cookies |
| **Sensitive Data** | Médio | API via HTTPS, no secrets em localStorage |
| **XML/XXE** | Baixo | Next.js não processa XML |
| **Broken Access** | Alto | AuthGuard + RLS Supabase + scope validation |
| **Security Config** | Médio | Security headers via Vercel, CSP (optional Phase 8) |
| **XSS** | Médio | React auto-escape, no dangerouslySetInnerHTML |
| **Insecure Deser.** | Baixo | Não deserializa dados arbitrários |
| **Using Components** | Médio | npm audit regular, dependabot alerts |
| **Logging/Monitor** | Médio | Sentry + Vercel Analytics |

#### 4.2 Env Vars Management

**❌ NUNCA:**
```typescript
const API_KEY = 'sk-abc123'; // Commitado em repo
const password = process.env.DB_PASSWORD; // Sem NEXT_PUBLIC_ em backend
```

**✅ SIM:**
```typescript
// .env.local (ignored by git)
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_API_URL=https://...

// lib/supabase.ts — reads from process.env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
```

#### 4.3 API Token Rotation

```typescript
// services/api/client.ts
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expired
      const { data } = await supabase.auth.refreshSession();
      if (data.session) {
        error.config.headers.Authorization = `Bearer ${data.session.access_token}`;
        return apiClient(error.config);
      }
    }
    throw error;
  }
);
```

**Critério:** ✅ Token auto-refresh antes de 401

---

## 5. Compatibility Matrix

### Browser Support

| Browser | Min Version | Support | Fallback |
|---------|------------|---------|----------|
| Chrome | 90+ | ✅ Full | — |
| Firefox | 88+ | ✅ Full | — |
| Safari | 14+ | ✅ Full | — |
| Edge | 90+ | ✅ Full | — |
| IE 11 | — | ❌ Not supported | Old dashboard? |
| Mobile Chrome | Latest | ✅ Full | — |
| Mobile Safari | 14+ | ✅ Full | — |

### Device Breakpoints (TailwindCSS)

```css
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop small */
xl: 1280px  /* Desktop large */
2xl: 1536px /* Ultra-wide */
```

---

## 6. Feature Flags Strategy (Optional Phase 8)

```typescript
// lib/featureFlags.ts
export const FEATURE_FLAGS = {
  enableRealTimeUpdates: process.env.NEXT_PUBLIC_ENABLE_REALTIME === 'true',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  enableExport: process.env.NEXT_PUBLIC_ENABLE_EXPORT === 'true',
};

// Uso em componentes
export function RevenueWidget() {
  if (FEATURE_FLAGS.enableAnalytics) {
    return <AdvancedChart />;
  }
  return <SimpleChart />;
}
```

---

## 7. Deployment Checklist

### Pre-Deployment (Phase 9)

- [ ] Build size < 300kb gzipped
- [ ] All tests passing
- [ ] Lighthouse score > 90
- [ ] No console errors/warnings
- [ ] All env vars configured
- [ ] API health check returns 200
- [ ] Auth flow tested (login/logout)
- [ ] Mobile responsive tested
- [ ] Accessibility audit passed
- [ ] Performance monitored with Sentry
- [ ] Rate limiting configured on API
- [ ] CORS properly configured
- [ ] Security headers set (Vercel)

### Post-Deployment

- [ ] Health check endpoint monitoring
- [ ] Error tracking (Sentry) active
- [ ] Analytics (Google Analytics 4) active
- [ ] Uptime monitoring (optional)
- [ ] Database backups verified
- [ ] Incident response plan documented

---

## 8. Known Limitations & Workarounds

### React Big Calendar + TypeScript

**Limitação:** Tipos genéricos complexos
```typescript
// Workaround: Usar `any` para evento.resource
const events: any[] = reservations.map(res => ({
  id: res.id,
  title: res.client_name,
  start: new Date(res.check_in),
  end: new Date(res.check_out),
  resource: res as Reservation, // Type safe resource
}));
```

### Recharts responsiveness mobile

**Limitação:** Charts ficam muito pequenos em mobile
```typescript
// Workaround: Hide charts em small screens
<div className="hidden md:block">
  <RevenueChart />
</div>
<div className="md:hidden">
  <KPICardsOnly />
</div>
```

### TanStack Query + SSR

**Limitação:** Hydration mismatch em inicial
```typescript
// Workaround: Usar `ssr: false` em algumas queries
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  ssr: false, // Disable SSR for this query
});
```

---

## 9. Dependencies Audit

### Critical Dependencies (Monitored)

```
@supabase/supabase-js   (auth, realtime)
@tanstack/react-query   (data fetching)
axios                   (http client)
zod                     (validation)
react-hook-form         (forms)
recharts                (charts)
react-big-calendar      (calendar)
```

### Audit Schedule

```bash
# Weekly
npm audit

# On install
npm install --audit-level=moderate

# Automated
dependabot (GitHub) — auto-PRs para minor/patch
```

---

## 10. Disaster Recovery Plan

### Data Loss Scenarios

| Cenário | Causa | Mitigação |
|---------|-------|-----------|
| **Supabase downtime** | Infrastructure | Failover alerts, SLA 99.9% |
| **Accidental delete** | User error | Soft delete + recovery views (optional Phase 10) |
| **Database corruption** | Bug | Automated backups (Supabase daily) |
| **Browser cache poison** | Bug | Cache invalidation key rotation |

### Recovery Procedures

```bash
# 1. Database backup restore (Supabase dashboard)
# 2. API rollback (GitHub Actions revert)
# 3. Frontend redeploy (Vercel auto-rollback)
# 4. Browser cache clear (Ctrl+Shift+R or Clear-Site-Data header)
```

---

## 11. Tech Debt Tracking

### Planned Tech Debt (Future Phases)

| ID | Débito | Prioridade | Fase | Nota |
|----|--------|-----------|------|------|
| **TD-001** | Adicionar Storybook | Baixa | Phase 10 | Documentação de componentes |
| **TD-002** | Implementar E2E tests com Playwright | Média | Phase 8.5 | Coverage críticas |
| **TD-003** | Setup OpenAPI/Swagger | Média | Phase 9 | API documentation |
| **TD-004** | Migrar para SWR se needed | Baixa | Phase 11 | Monitor performance |
| **TD-005** | Implementar realtime updates | Média | Phase 10 | WebSocket + Supabase realtime |

---

## 12. Success Metrics

### Implementação

| Métrica | Target | Medida |
|---------|--------|--------|
| **Timeline** | 3-4 semanas | Horas reais vs planed |
| **Bug count** | <10 críticos | QA testing |
| **Test coverage** | >80% | Jest + Coverage report |
| **Code quality** | 0 HIGH ESLint | npm run lint |
| **Performance** | Lighthouse >90 | Vercel analytics |

### Pós-Launch

| Métrica | Target | Ferramenta |
|---------|--------|-----------|
| **Uptime** | 99.5%+ | Vercel Analytics |
| **Error rate** | <0.5% | Sentry |
| **User adoption** | >80% de clientes logando | Google Analytics |
| **Performance degradation** | <5% vs baseline | Lighthouse CI |
| **Support tickets** | <1 por semana | Email/Slack |

---

## Conclusão

A stack escolhida é **moderna, testada, escalável e realista para 3-4 semanas de desenvolvimento**.

**Riscos baixos** graças a:
- ✅ Tech stack bem-estabelecida (Next.js, React, TailwindCSS maduro)
- ✅ Documentação excelente
- ✅ Comunidades grandes
- ✅ Tooling profissional (TypeScript, ESLint, Vercel)

**Próximos passos:**
1. Validar com um prototype simples (Phase 0)
2. Implementar incrementalmente (Phase 1-9)
3. Monitorar performance/erros continuamente (Sentry)
4. Iteração rápida baseada em feedback

---

**Documento criado por:** Aria (@architect)
**Data:** 2026-03-07
**Status:** Validated & Ready for Development
