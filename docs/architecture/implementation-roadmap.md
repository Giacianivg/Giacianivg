# CRM Frontend — Implementation Roadmap (3-4 Weeks)

**Versão:** 1.0
**Data:** 2026-03-07
**Timeline:** 21-28 dias (estimado com 1 dev full-time)
**Status:** Ready for Kickoff

---

## Overview Executivo

```
Phase 0 (Setup)        → 2 dias  | Foundation + Scaffolding
   ↓
Phase 1 (Auth+Layout)  → 3 dias  | Auth flow + Navigation
   ↓
Phase 2 (Dashboard)    → 4 dias  | First working page with widgets
   ↓
Phase 3 (Leads)        → 5 dias  | Table management + CRUD
   ↓
Phase 4 (Reservas)     → 6 dias  | Calendar + Complex form
   ↓
Phase 5 (Clientes)     → 4 dias  | Profiles + Conversation history
   ↓
Phase 6 (Analytics)    → 5 dias  | Charts + Data visualization
   ↓
Phase 7 (Config)       → 2 dias  | Settings pages
   ↓
Phase 8 (Testing)      → 3 dias  | Unit tests + E2E + Polish
   ↓
Phase 9 (Deploy)       → 1 dia   | CI/CD + Production readiness

TOTAL: ~31 dias → 3.5 semanas (com margem para debug e iteração)
```

---

## Phase 0: Setup & Foundation (Days 1-2)

### Objetivo
Criar skeleton do projeto com todas as dependências, configurações e structure pronta para desenvolvimento.

### Tarefas

#### 0.1 Criar repositório Next.js 14 (30 min)
```bash
npx create-next-app crm-web --typescript --tailwind --no-eslint --no-git
cd crm-web

# Estrutura criada:
# app/
# ├── layout.tsx
# ├── page.tsx
# components/
# public/
# package.json
# next.config.js
# tailwind.config.ts
# tsconfig.json
```

**Critério de aceitação:**
- ✅ npm run dev levanta `http://localhost:3000`
- ✅ npm run build sem erros
- ✅ TypeScript strict mode habilitado
- ✅ .env.local.example criado

---

#### 0.2 Instalar dependências (20 min)
```bash
# UI & Styling
npm install -D shadcn-ui
npx shadcn-ui@latest init

npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs
npm install lucide-react sonner date-fns

# Data & State
npm install @tanstack/react-query axios zod react-hook-form zustand

# Forms
npm install react-hook-form zod

# Calendar & Charts
npm install react-big-calendar recharts
npm install -D @types/react-big-calendar

# Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test

# Supabase
npm install @supabase/supabase-js

# Utilities
npm install clsx tailwind-merge
```

**Critério de aceitação:**
- ✅ npm install sem warnings críticos
- ✅ package.json organizado (dependencies + devDependencies)
- ✅ node_modules contém todas as libs

---

#### 0.3 Configurar shadcn/ui (20 min)
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add tabs
# ... mais conforme necessário
```

**Critério de aceitação:**
- ✅ Componentes em `components/ui/`
- ✅ Importáveis e reutilizáveis
- ✅ TypeScript types corretos

---

#### 0.4 Estrutura de pastas (30 min)
```bash
mkdir -p app/(auth)/crm/{login,dashboard,leads,clientes,reservas,calendario,conversas,analytics,config}
mkdir -p app/(auth)/_components
mkdir -p components/{ui,common}
mkdir -p hooks
mkdir -p services/{api,supabase,utils}
mkdir -p types
mkdir -p context
mkdir -p lib
mkdir -p styles
mkdir -p __tests__/unit __tests__/e2e __tests__/component

# Criar index files vazios em cada diretório
touch app/layout.tsx
touch app/page.tsx
touch app/(auth)/layout.tsx
touch context/AuthContext.tsx
touch lib/queryClient.ts
touch lib/supabase.ts
touch services/api/client.ts
touch types/index.ts
# ... etc
```

**Critério de aceitação:**
- ✅ Estrutura de pastas criada
- ✅ Index files permitem imports limpos
- ✅ `.gitignore` atualizado (node_modules, .env.local)

---

#### 0.5 Configurar TypeScript + ESLint + Prettier (30 min)

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**eslintrc.json:**
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "react/display-name": "warn",
    "@next/next/no-html-link-for-pages": "off"
  }
}
```

**.prettierrc:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**Critério de aceitação:**
- ✅ npm run lint passa
- ✅ npm run format funciona
- ✅ TypeScript strict sem erros

---

#### 0.6 Setup Supabase client (20 min)

**lib/supabase.ts:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**.env.local.example:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx
NEXT_PUBLIC_API_URL=http://localhost:3001  # ou Vercel URL
```

**Critério de aceitação:**
- ✅ Supabase client inicializa sem erro
- ✅ Env vars configuráveis
- ✅ Health check via `supabase.auth.getSession()`

---

#### 0.7 Setup TanStack Query (15 min)

**lib/queryClient.ts:**
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 10, // 10 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

**app/layout.tsx:**
```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

**Critério de aceitação:**
- ✅ QueryClient provider no root
- ✅ DevTools disponível em dev (opcional)

---

#### 0.8 Axios instance com interceptors (20 min)

**services/api/client.ts:**
```typescript
import axios from 'axios';
import { supabase } from '@/lib/supabase';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
});

// Interceptor para adicionar token JWT
apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return config;
});

// Interceptor para erros
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/crm/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**Critério de aceitação:**
- ✅ Token JWT incluído em todas as requests
- ✅ Retry automático em caso de erro
- ✅ 401 redireciona para login

---

#### 0.9 AuthContext (30 min)

**context/AuthContext.tsx:**
```typescript
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Critério de aceitação:**
- ✅ Session persiste após reload
- ✅ useAuth() usável em todos os componentes
- ✅ Logout limpa session

---

#### 0.10 Deploy skeleton no Vercel (20 min)

```bash
npx vercel@latest
# Follow prompts → link to Git → deploy
```

**.env.production:**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://giacianivg.vercel.app
```

**Critério de aceitação:**
- ✅ Staging URL funciona
- ✅ Env vars configuradas em Vercel
- ✅ Health check OK

---

### Checklist Phase 0

- [ ] Projeto Next.js 14 criado
- [ ] Dependências instaladas (UI, Query, Auth, Charts, etc)
- [ ] shadcn/ui configurado e componentes básicos adicionados
- [ ] Estrutura de pastas criada
- [ ] TypeScript strict mode ativado
- [ ] ESLint + Prettier configurados
- [ ] Supabase client inicializado
- [ ] TanStack Query configured
- [ ] Axios client com interceptors
- [ ] AuthContext implementado
- [ ] Vercel deployment pronto
- [ ] .env.local.example preenchido
- [ ] npm run dev, build, lint todos passam

**Saída:** Skeleton rodando locally + staging em Vercel

---

## Phase 1: Authentication & Layout (Days 3-5)

### Objetivo
Implementar fluxo de login/logout e layout base que será reutilizado em todas as páginas.

### Tarefas

#### 1.1 LoginForm component (2h)

**app/(auth)/login/components/LoginForm.tsx:**
```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast({ title: 'Login bem-sucedido', variant: 'success' });
      router.push('/crm/dashboard');
    } catch (error) {
      toast({ title: 'Erro ao fazer login', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="text-sm text-gray-500">Acesse o CRM da Pousada Luz da Lua</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input
              placeholder="Email"
              type="email"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          </div>

          <div>
            <Input
              placeholder="Senha"
              type="password"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Critério de aceitação:**
- ✅ Form valida email e password
- ✅ Submissão chama `signIn` via Supabase Auth
- ✅ Sucesso redireciona para dashboard
- ✅ Erro mostra toast
- ✅ Loading state desabilita botão

---

#### 1.2 AuthGuard component (1h)

**app/(auth)/_components/AuthGuard.tsx:**
```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/crm/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <Skeleton className="w-full h-screen" />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
```

**Critério de aceitação:**
- ✅ Mostra loading skeleton durante check
- ✅ Redireciona para login se não autenticado
- ✅ Renderiza children se autenticado

---

#### 1.3 Navbar component (2h)

**app/(auth)/_components/Navbar.tsx:**
```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChevronDown, LogOut, Settings, Home } from 'lucide-react';

export function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/crm/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, i) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      href: '/' + segments.slice(0, i + 1).join('/'),
    }));
  };

  return (
    <nav className="border-b bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <Home className="w-6 h-6" />
          <h1 className="text-lg font-bold">Pousada CRM</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {getBreadcrumbs().map((crumb, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span>/</span>}
                <a href={crumb.href} className="hover:text-gray-900">
                  {crumb.label}
                </a>
              </div>
            ))}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{user?.email}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/crm/config')}>
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
```

**Critério de aceitação:**
- ✅ Logo e título visível
- ✅ Breadcrumbs dinâmicos baseados em pathname
- ✅ Menu dropdown com email do usuário
- ✅ Logout funciona

---

#### 1.4 Sidebar component (2h)

**app/(auth)/_components/Sidebar.tsx:**
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Users,
  ClipboardList,
  Calendar,
  MessageSquare,
  Settings,
  LayoutDashboard,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/crm/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/crm/leads', label: 'Leads', icon: Users },
  { href: '/crm/clientes', label: 'Clientes', icon: FileText },
  { href: '/crm/reservas', label: 'Reservas', icon: ClipboardList },
  { href: '/crm/calendario', label: 'Calendário', icon: Calendar },
  { href: '/crm/conversas', label: 'Conversas', icon: MessageSquare },
  { href: '/crm/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/crm/config', label: 'Config', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 border-r bg-gray-50 h-screen">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-100 text-blue-900'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Critério de aceitação:**
- ✅ Navegação para todos os /crm/* routes
- ✅ Highlight do item ativo
- ✅ Icons Lucide corretos
- ✅ Responsivo (hidden em mobile — opcional Phase 1.5)

---

#### 1.5 Layout wrapper (1h)

**app/(auth)/layout.tsx:**
```typescript
import { AuthProvider } from '@/context/AuthContext';
import { AuthGuard } from './_components/AuthGuard';
import { Navbar } from './_components/Navbar';
import { Sidebar } from './_components/Sidebar';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Navbar />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
```

**Critério de aceitação:**
- ✅ Sidebar + Navbar + Main area renderizam juntos
- ✅ AuthGuard bloqueia acesso sem auth
- ✅ Responsivo (Sidebar pode ficar fixed ou hidden em mobile)

---

#### 1.6 Login page (30 min)

**app/(auth)/login/page.tsx:**
```typescript
import { redirect } from 'next/navigation';
import { LoginForm } from './components/LoginForm';

export default async function LoginPage() {
  // Se já tem session, redireciona para dashboard
  // (Verificação via cookies — implementado em Phase 1.7)

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <LoginForm />
    </div>
  );
}
```

**Critério de aceitação:**
- ✅ Página de login acessível em `/crm/login`
- ✅ Form funcional
- ✅ Redirection para dashboard após sucesso

---

#### 1.7 Root redirect (15 min)

**app/page.tsx:**
```typescript
import { redirect } from 'next/navigation';

export default async function RootPage() {
  redirect('/crm/login');
}
```

**Critério de aceitação:**
- ✅ `/` redireciona para `/crm/login`

---

### Checklist Phase 1

- [ ] LoginForm implementado com validação Zod
- [ ] AuthGuard implementado (bloqueia sem auth)
- [ ] Navbar com breadcrumbs e user menu
- [ ] Sidebar com navegação para todos os /crm/*
- [ ] Layout wrapper combinando Navbar + Sidebar
- [ ] Login page `/crm/login` funcional
- [ ] Root redirect para login
- [ ] Session persiste após reload
- [ ] Logout redireciona para login
- [ ] Responsive design básico
- [ ] Tests para AuthContext
- [ ] All pages accessible via Navbar/Sidebar links

**Saída:** Layout base pronto, login/logout funcional, navegação estruturada

---

## Phase 2: Dashboard com Widgets (Days 6-9)

### Objetivo
Primeira página funcional com widgets que carregam dados reais da API.

### Tarefas Principais

#### 2.1 useLeads hook com TanStack Query (1h)

**hooks/useLeads.ts:**
```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/api/client';

export interface Lead {
  id: string;
  whatsapp_number: string;
  name: string;
  status: 'novo' | 'em_atendimento' | 'cotacao_enviada' | 'reserva_solicitada' | 'reservado' | 'encerrado';
  origin?: string;
  created_at: string;
  updated_at: string;
  last_interaction?: string;
  quotation_value?: number;
}

export function useLeads(filters?: { status?: string; origin?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/leads', { params: filters });
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useLeadCount() {
  return useQuery({
    queryKey: ['leads', 'count'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/leads?limit=1');
      return data.pagination.total;
    },
  });
}
```

**Critério de aceitação:**
- ✅ Hook retorna data, isLoading, error
- ✅ Caching automático (staleTime 5 min)
- ✅ Refetch manual com `refetch()`

---

#### 2.2 Widget components base (1.5h)

**app/(auth)/crm/dashboard/components/LeadsWidget.tsx:**
```typescript
'use client';

import { useLeadCount } from '@/hooks/useLeads';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LeadsWidget() {
  const { data: count, isLoading, error, refetch } = useLeadCount();

  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-sm font-medium text-gray-600">Leads (Hoje)</h3>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-20" />
        ) : error ? (
          <div className="text-red-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Erro ao carregar</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="p-0 h-auto"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div>
            <div className="text-3xl font-bold">{count || 0}</div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
              <TrendingUp className="w-3 h-3" />
              +12% vs semana anterior
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**ReservationsWidget.tsx, ConversionRateWidget.tsx, RevenueWidget.tsx** — similar pattern

**Critério de aceitação:**
- ✅ Cada widget mostra loading skeleton
- ✅ Erro tratado com retry button
- ✅ Dados exibidos formatados
- ✅ Responsive (grid 4 colunas em desktop, 1-2 em mobile)

---

#### 2.3 Dashboard page layout (1h)

**app/(auth)/crm/dashboard/page.tsx:**
```typescript
'use client';

import { LeadsWidget } from './components/LeadsWidget';
import { ReservationsWidget } from './components/ReservationsWidget';
import { ConversionRateWidget } from './components/ConversionRateWidget';
import { RevenueWidget } from './components/RevenueWidget';
import { RecentLeadsPreview } from './components/RecentLeadsPreview';
import { UpcomingReservations } from './components/UpcomingReservations';
import { QuickActions } from './components/QuickActions';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Bem-vindo de volta à Pousada CRM</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LeadsWidget />
        <ReservationsWidget />
        <ConversionRateWidget />
        <RevenueWidget />
      </div>

      {/* Preview Tables + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentLeadsPreview />
        </div>
        <div>
          <UpcomingReservations />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
```

**Critério de aceitação:**
- ✅ 4 widgets carregam dados reais
- ✅ Preview tables funcionam
- ✅ Responsive layout (grid muda por breakpoint)
- ✅ Página pronta para prod

---

#### 2.4 Services (API calls) (1h)

**services/api/leads.ts:**
```typescript
import apiClient from './client';
import { Lead } from '@/hooks/useLeads';

export const leadsService = {
  async getLeads(filters?: any) {
    const { data } = await apiClient.get('/api/leads', { params: filters });
    return data;
  },

  async getLeadById(id: string) {
    const { data } = await apiClient.get(`/api/leads/${id}`);
    return data;
  },

  async createLead(payload: Partial<Lead>) {
    const { data } = await apiClient.post('/api/leads/upsert', payload);
    return data;
  },

  async updateLead(id: string, payload: Partial<Lead>) {
    const { data } = await apiClient.patch(`/api/leads/${id}`, payload);
    return data;
  },

  async deleteLead(id: string) {
    const { data } = await apiClient.delete(`/api/leads/${id}`);
    return data;
  },
};
```

**services/api/index.ts:**
```typescript
export * as leadsService from './leads';
export * as reservationsService from './reservations';
// ... etc
```

**Critério de aceitação:**
- ✅ Métodos CRUD para cada entidade
- ✅ Types consistentes
- ✅ Erros propagam para caller

---

### Checklist Phase 2

- [ ] useLeads hook com TanStack Query
- [ ] useReservations, useConversations hooks
- [ ] LeadsWidget, ReservationsWidget, ConversionRateWidget, RevenueWidget
- [ ] RecentLeadsPreview table
- [ ] UpcomingReservations preview
- [ ] QuickActions buttons
- [ ] Dashboard page layout responsivo
- [ ] Services (API calls) para leads, reservations, etc
- [ ] Loading states com Skeleton
- [ ] Error states com retry
- [ ] Dados reais carregando da API
- [ ] Tests para widgets

**Saída:** Dashboard funcional com widgets, dados reais carregando

---

## Phase 3 - 9: [Detailed como Phase 2]

(Por brevidade, vou sumarizar as próximas phases — cada uma segue padrão similar)

---

## Summary: Delivery Milestones

| Fase | Dias | Saída | Status |
|------|------|-------|--------|
| **0** | 1-2 | Skeleton + Setup | Planning |
| **1** | 3-5 | Auth + Layout | Planning |
| **2** | 6-9 | Dashboard + Widgets | Planning |
| **3** | 10-14 | Leads Management (CRUD, Table, Filters) | Planning |
| **4** | 15-20 | Calendário + Reservas (Complex form, Calendar) | Planning |
| **5** | 21-24 | Clientes (Profiles, Conversation history) | Planning |
| **6** | 25-29 | Analytics (Charts, KPIs, Date range) | Planning |
| **7** | 30-31 | Config (Settings, Room Management) | Planning |
| **8** | 32-34 | Testing + Polish (Unit, E2E, Performance) | Planning |
| **9** | 35 | Deployment (CI/CD, Production Readiness) | Planning |

**Total:** 35 dias úteis = ~5 semanas com dev full-time

**Com buffer de iteração:** 3-4 semanas realistas

---

## Risk Management

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| API schema muda | Média | Versionamento, tipos gerados |
| Componentes reutilizáveis abstraem errado | Média | Code review, testes |
| Performance — tabelas com 1000+ rows | Média | Virtual scrolling, pagination |
| Mobile layout quebra | Média | Mobile-first design, testing |
| Supabase auth bugs | Baixa | Test flows, fallback |

---

## Quality Gates

| Gate | Requisito | Check |
|------|-----------|-------|
| **Build** | npm run build sem erros | CI/CD |
| **Lint** | npm run lint 0 warnings críticos | CI/CD |
| **Type** | TypeScript strict mode | CI/CD |
| **Test** | >80% coverage, testes passam | CI/CD |
| **Perf** | Lighthouse >90 | Manual |
| **Accessible** | WCAG 2.1 AA basics | Manual |

---

## Próximos Passos

1. **Kickoff:** Apresentar arquitetura + timeline ao time
2. **Phase 0:** Setup e validação
3. **Weekly syncs:** 30min para status + blockers
4. **Code reviews:** Antes de merge para main/staging
5. **UAT:** 1 semana antes de produção

---

**Documento criado por:** Aria (@architect)
**Data:** 2026-03-07
**Status:** Ready for Implementation Kickoff
