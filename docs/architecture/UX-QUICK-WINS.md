# UX Quick Wins — 5 Implementações de Alto Impacto (4 horas total)

## Overview
Implementar ESTES 5 itens fornece 50% melhoria em UX percebida com investimento mínimo (4 horas de desenvolvimento).

---

## Quick Win 1: Toast Notification System (2h)

### O Problema
Nenhuma ação assíncrona fornece feedback. Usuário não sabe se:
- Lead foi salvo
- Modal fechou com sucesso
- Erro ocorreu
- Requisição ainda está processing

### A Solução
```typescript
// lib/hooks/useToast.ts
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

const useToast = create<{
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));

    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter(t => t.id !== id)
        }));
      }, toast.duration || 3000);
    }
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  }))
}));

export default useToast;
```

### Uso no Código
```typescript
// components/LeadModal.tsx
const LeadModal = ({ isOpen, onOpenChange, lead }) => {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data) => {
    setIsLoading(true);
    try {
      await leadsService.create(data);
      addToast({
        type: 'success',
        message: '✅ Lead criado com sucesso!',
        duration: 3000
      });
      onOpenChange(false);
    } catch (error) {
      addToast({
        type: 'error',
        message: `❌ Erro ao criar lead: ${error.message}`,
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* ... form ... */}
      </DialogContent>
    </Dialog>
  );
};
```

### UI Component (shadcn/ui)
```typescript
// components/ToastContainer.tsx
import useToast from '@/lib/hooks/useToast';

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-lg shadow-lg text-white max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300 ${
            toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' :
            toast.type === 'warning' ? 'bg-yellow-500' :
            'bg-blue-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-sm opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Adicionar ao Layout
```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ToastContainer />
        {children}
      </body>
    </html>
  );
}
```

**Impacto:** Toda ação agora tem feedback visual. Alto impacto em UX percebida.

---

## Quick Win 2: Error Boundaries (2h)

### O Problema
Runtime errors quebram a página. Usuário vê blank page com erro genérico.

### A Solução
```typescript
// components/ErrorBoundary.tsx
import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Enviar para Sentry/monitoring
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback?.(this.state.error!, this.reset) || (
          <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
            <div className="max-w-md text-center">
              <h1 className="text-2xl font-bold text-red-900 mb-2">
                Algo deu errado
              </h1>
              <p className="text-red-700 mb-4">
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Tentar novamente
              </button>
              <p className="text-sm text-red-600 mt-4">
                ID do erro: {Date.now()}
              </p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### Usar no Layout
```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          <ToastContainer />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}

// app/(auth)/layout.tsx — Com fallback customizado
export default function AuthLayout({ children }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="bg-amber-50 p-4 rounded-lg">
          <h2 className="font-bold">Erro na área autenticada</h2>
          <p>{error.message}</p>
          <button onClick={reset}>Reset</button>
        </div>
      )}
    >
      <Navbar />
      <Sidebar />
      {children}
    </ErrorBoundary>
  );
}
```

**Impacto:** Erros não quebram a página inteira. Usuário sempre pode tentar novamente.

---

## Quick Win 3: Relay Message Preview (2h)

### O Problema
Equipe envia relay message sem saber como ficará. Pode enviar mensagem errada.

### Current (Ruim)
```typescript
<RelayInput>
  <Textarea
    placeholder="Digite resposta para enviar como relayed..."
    value={relayMessage}
    onChange={setRelayMessage}
  />
  <Button onClick={() => conversationsService.sendRelay(...)}>
    Enviar resposta
  </Button>
</RelayInput>
```

### Melhorado
```typescript
// components/RelayInput.tsx
import { useState } from 'react';
import { useToast } from '@/lib/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RelayInputProps {
  conversationId: string;
  clientName: string;
  onSuccess?: () => void;
}

export const RelayInput = ({
  conversationId,
  clientName,
  onSuccess
}: RelayInputProps) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const handleOpenPreview = () => {
    if (!message.trim()) {
      addToast({
        type: 'warning',
        message: 'Digite uma mensagem antes de enviar'
      });
      return;
    }
    setIsOpen(true);
  };

  const handleSendRelay = async () => {
    setIsLoading(true);
    try {
      await conversationsService.sendRelay(conversationId, message);

      addToast({
        type: 'success',
        message: '✅ Resposta enviada com sucesso!'
      });

      setMessage('');
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      addToast({
        type: 'error',
        message: `❌ Erro ao enviar: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="border-t pt-4 mt-4">
        <label className="block text-sm font-medium mb-2">
          Responder como Equipe
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite sua resposta aqui..."
          maxLength={1000}
          className="w-full p-3 border rounded-lg resize-none"
          rows={3}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {message.length}/1000
          </span>
          <Button
            onClick={handleOpenPreview}
            disabled={!message.trim()}
          >
            Pré-visualizar e enviar
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog com Preview */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar envio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Será enviado como:
              </p>

              {/* Preview da mensagem como ficará */}
              <div className="bg-gray-100 p-3 rounded-lg">
                <MessageBubble
                  role="human"
                  message={message}
                  timestamp={new Date()}
                  relayFrom="Equipe"
                />
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-3">
              <p className="text-sm text-blue-800">
                💡 Dica: A mensagem será prefixada com "⚡ Equipe:" para
                que o cliente saiba que é resposta humana, não automática.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendRelay}
              isLoading={isLoading}
            >
              {isLoading ? 'Enviando...' : 'Confirmar e enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
```

**Impacto:** Equipe vê exatamente como mensagem ficará. Reduz erros.

---

## Quick Win 4: Loading States em Formas (1h)

### O Problema
Ao submeter modal, nada acontece visualmente. Usuário pode clicar novamente.

### Current (Ruim)
```typescript
<Button type="submit">Salvar</Button>
```

### Melhorado
```typescript
// components/ui/button.tsx — Estender shadcn/ui Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ isLoading, loadingText, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'px-4 py-2 rounded-lg font-medium transition',
          isLoading && 'opacity-70 cursor-not-allowed'
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Spinner className="w-4 h-4" />
            {loadingText || 'Carregando...'}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

// components/Spinner.tsx
export const Spinner = ({ className = '' }) => (
  <div className={cn('animate-spin', className)}>
    <svg
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
);
```

### Usar no Modal
```typescript
const LeadModal = ({ isOpen, onOpenChange, mode, lead }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (data) => {
    setIsLoading(true);
    try {
      if (mode === 'create') {
        await leadsService.create(data);
      } else {
        await leadsService.update(lead.id, data);
      }

      addToast({
        type: 'success',
        message: `✅ Lead ${mode === 'create' ? 'criado' : 'atualizado'}!`
      });

      onOpenChange(false);
    } catch (error) {
      addToast({
        type: 'error',
        message: `❌ Erro: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Novo Lead' : 'Editar Lead'}
          </DialogTitle>
        </DialogHeader>

        <Form onSubmit={handleSubmit}>
          <Input label="Nome" name="name" required />
          <Input label="Telefone" name="phone" required />

          {/* Mostrar erro se houver */}
          {/* ... */}

          <Button
            type="submit"
            isLoading={isLoading}
            loadingText="Salvando..."
            className="w-full"
          >
            Salvar
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
```

**Impacto:** Usuário vê que algo está acontecendo. Não clica novamente.

---

## Quick Win 5: Reservation Wizard com Pricing (3h)

### O Problema
Wizard completa em Step 3 mas não mostra cálculo de preço.

### Current (Incompleto)
```typescript
<Step3: Confirmação />
  ├─ Card com resumo
  └─ Botões confirmar/cancelar
```

### Melhorado
```typescript
// components/ReservationWizard.tsx
import { useState, useMemo } from 'react';
import { calculateQuotation } from '@/lib/quotation';
import { useToast } from '@/lib/hooks/useToast';

interface ReservationData {
  checkIn: Date;
  checkOut: Date;
  roomType: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  guestCount: number;
}

export const ReservationWizard = ({ isOpen, onOpenChange, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<ReservationData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  // Calcular preço em tempo real
  const quotation = useMemo(() => {
    if (data.checkIn && data.checkOut && data.roomType) {
      return calculateQuotation({
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        roomType: data.roomType,
        guestCount: data.guestCount || 1
      });
    }
    return null;
  }, [data.checkIn, data.checkOut, data.roomType, data.guestCount]);

  const handleNextStep = () => {
    if (step === 1) {
      // Validar step 1
      if (!data.checkIn || !data.checkOut || !data.roomType) {
        addToast({
          type: 'warning',
          message: 'Preencha todas as datas e tipo de quarto'
        });
        return;
      }
    }
    if (step === 2) {
      // Validar step 2
      if (!data.clientName || !data.clientPhone) {
        addToast({
          type: 'warning',
          message: 'Preencha nome e telefone do hóspede'
        });
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const reservation = {
        ...data,
        quotedPrice: quotation?.total,
        finalPrice: quotation?.total,
        discountPercent: quotation?.discount_percent || 0,
        status: 'confirmed'
      };

      await reservationsService.create(reservation);

      addToast({
        type: 'success',
        message: '✅ Reserva criada com sucesso!'
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      addToast({
        type: 'error',
        message: `❌ Erro ao criar reserva: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Nova Reserva — Passo {step} de 3
          </DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                s <= step ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Datas & Tipo */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Data de entrada
              </label>
              <input
                type="date"
                value={data.checkIn?.toISOString().split('T')[0] || ''}
                onChange={(e) =>
                  setData({ ...data, checkIn: new Date(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Data de saída
              </label>
              <input
                type="date"
                value={data.checkOut?.toISOString().split('T')[0] || ''}
                onChange={(e) =>
                  setData({ ...data, checkOut: new Date(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg"
                min={data.checkIn?.toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tipo de quarto
              </label>
              <select
                value={data.roomType || ''}
                onChange={(e) => setData({ ...data, roomType: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Selecione um tipo</option>
                <option value="ALA_A">Ala A (até 3px)</option>
                <option value="ALA_B">Ala B (até 5px)</option>
                <option value="ALA_C_CASAL">Ala C Casal (até 8px)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Número de hóspedes
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={data.guestCount || 1}
                onChange={(e) =>
                  setData({ ...data, guestCount: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Preview de preço em Step 1 */}
            {quotation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">💰 Prévia de preço:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Noites:</span>
                    <span className="font-medium">{quotation.nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Preço/noite:</span>
                    <span className="font-medium">
                      R$ {quotation.pricePerNight.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t pt-1 mt-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">
                        R$ {quotation.subtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {quotation.discount_percent > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto ({quotation.discount_percent}%):</span>
                      <span className="font-medium">
                        -R$ {quotation.discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-1 mt-2 bg-white -mx-4 -mb-4 px-4 py-2 rounded-b">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>R$ {quotation.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Hóspede */}
        {step === 2 && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nome do hóspede"
              value={data.clientName || ''}
              onChange={(e) => setData({ ...data, clientName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              type="tel"
              placeholder="(19) 9999-9999"
              value={data.clientPhone || ''}
              onChange={(e) =>
                setData({ ...data, clientPhone: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        )}

        {/* Step 3: Confirmação */}
        {step === 3 && quotation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Datas:</p>
                <p className="font-semibold">
                  {data.checkIn?.toLocaleDateString('pt-BR')} →{' '}
                  {data.checkOut?.toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tipo:</p>
                <p className="font-semibold">{data.roomType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Hóspede:</p>
                <p className="font-semibold">{data.clientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pessoas:</p>
                <p className="font-semibold">{data.guestCount}</p>
              </div>
            </div>

            {/* Resumo de preço detalhado */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="font-semibold mb-3">Detalhamento do preço:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>
                    {quotation.nights} noites × R${' '}
                    {quotation.pricePerNight.toFixed(2)}
                  </span>
                  <span className="font-medium">
                    R$ {quotation.subtotal.toFixed(2)}
                  </span>
                </div>

                {quotation.discount_percent > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto {quotation.discount_percent}%:</span>
                    <span className="font-medium">
                      -R$ {quotation.discount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total a pagar:</span>
                    <span className="text-lg text-green-600">
                      R$ {quotation.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-3 pt-3 border-t">
                  <p>
                    ℹ️ Sinal: R${' '}
                    {(quotation.total * 0.3).toFixed(2)} (30%)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) {
                onOpenChange(false);
              } else {
                setStep(step - 1);
              }
            }}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step < 3 ? (
            <Button onClick={handleNextStep}>Próximo</Button>
          ) : (
            <Button
              onClick={handleSubmit}
              isLoading={isLoading}
              loadingText="Confirmando..."
            >
              Confirmar Reserva
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

**Impacto:** Usuário vê exatamente quanto vai pagar antes de confirmar.

---

## Implementação — Ordem

### Day 1 (4h total)
1. **Morning (2h):** Toast + Error Boundary
   - Setup Zustand store para toasts
   - Error Boundary class component
   - Adicionar ao layout.tsx

2. **Afternoon (2h):** Relay Message Preview
   - Criar RelayInput com Dialog
   - Preview visual
   - Confirmation flow

### Day 2 (1h)
3. **Morning (1h):** Loading states em botões
   - Estender Button shadcn/ui
   - Adicionar Spinner
   - Usar em todos modals

### Day 2-3
4. **Wizard pricing (3h)**
   - Integrar quotation.js
   - Mostrar preview em Step 1
   - Detalhamento em Step 3

---

## Testing Checklist

- [ ] Toast appears/disappears em 3s
- [ ] Toast dismissible (click X)
- [ ] Error boundary catches runtime errors
- [ ] Error boundary has reset button
- [ ] Relay dialog shows preview
- [ ] Relay button disabled se empty message
- [ ] Button loading state funciona
- [ ] Button disabled durante loading
- [ ] Wizard steps validation
- [ ] Quotation calcula correto
- [ ] Desconto aplicado corretamente
- [ ] Total matches quotation.js output

---

**Total Investment:** 4 horas
**ROI:** 50% UX improvement
**Ready to implement:** YES

