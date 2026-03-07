# CRM Frontend — Component Hierarchy & Data Flow

**Versão:** 1.0
**Data:** 2026-03-07
**Propósito:** Referência técnica para estrutura de componentes e fluxo de dados

---

## 1. Hierarquia de Componentes — Visualização Completa

### Root Structure

```
App (Next.js App Router)
├── layout.tsx (Providers, Fonts)
│   ├── QueryClientProvider
│   ├── AuthProvider
│   ├── ToastProvider
│   └── ThemeProvider
│
└── page.tsx (Redirect logic)
    └── /crm/login
        └── /crm/* (Protected routes)
```

### Protected Routes Structure

```
(auth)/layout.tsx (Auth Guard + Main Layout)
├── <NavBar />                    # Top bar (user menu, logo)
│   ├── Logo
│   ├── Breadcrumbs
│   ├── SearchBar (global)
│   └── UserMenu
│       ├── Profile
│       ├── Settings
│       └── Logout
│
├── <Sidebar />                   # Left navigation
│   ├── NavLink /dashboard
│   ├── NavLink /leads
│   ├── NavLink /clientes
│   ├── NavLink /reservas
│   ├── NavLink /calendario
│   ├── NavLink /conversas
│   ├── NavLink /analytics
│   └── NavLink /config
│
└── <main>                        # Route-specific content
    └── Page components
```

---

## 2. Page-by-Page Component Breakdown

### 2.1 Dashboard Page

```
DashboardPage (async Server Component)
│
├── Query data on server (optional)
│
└── <DashboardLayout>
    │
    ├── <PageHeader>
    │   ├── <h1>Dashboard</h1>
    │   └── <p>Bem-vindo de volta!</p>
    │
    ├── <section className="grid grid-cols-4 gap-4">
    │   │
    │   ├── <LeadsWidget />
    │   │   └── useLeads({ limit: 1, order: 'desc' })
    │   │       ├── <Card>
    │   │       ├── <Skeleton> (loading)
    │   │       ├── <AlertCircle /> (error)
    │   │       └── <div className="text-3xl">{count}</div>
    │   │
    │   ├── <ReservationsWidget />
    │   │   └── useReservations({ status: 'confirmed', days: 7 })
    │   │       └── <Card>
    │   │           └── <div className="text-3xl">{count}</div>
    │   │
    │   ├── <ConversionRateWidget />
    │   │   └── useAnalytics({ metric: 'conversion_rate' })
    │   │       └── <Card>
    │   │           └── <div className="text-3xl">{percentage}%</div>
    │   │
    │   └── <RevenueWidget />
    │       └── useAnalytics({ metric: 'monthly_revenue' })
    │           └── <Card>
    │               └── <div className="text-3xl">{formatCurrency(amount)}</div>
    │
    ├── <section className="grid grid-cols-2 gap-6 mt-6">
    │   │
    │   ├── <RecentLeadsPreview />
    │   │   └── useLeads({ limit: 5, order: 'desc' })
    │   │       ├── <Card>
    │   │       │   └── <CardHeader>
    │   │       │       └── <h2>Leads Recentes</h2>
    │   │       │
    │   │       ├── <Table>
    │   │       │   ├── <thead>
    │   │       │   │   └── <th>Nome</th>, <th>Telefone</th>, <th>Status</th>
    │   │       │   │
    │   │       │   └── <tbody>
    │   │       │       └── {leads.map(lead => (
    │   │       │             <LeadRow key={lead.id} lead={lead} />
    │   │       │           ))}
    │   │       │
    │   │       └── <Button>Ver todos</Button>
    │   │
    │   └── <UpcomingReservations />
    │       └── useReservations({ status: 'confirmed', order: 'asc' })
    │           ├── <Card>
    │           │   └── <CardHeader>
    │           │       └── <h2>Próximas Check-ins</h2>
    │           │
    │           ├── <ul className="space-y-2">
    │           │   └── {reservations.map(res => (
    │           │         <ReservationItem key={res.id} res={res} />
    │           │       ))}
    │           │
    │           └── <Button>Ver calendário</Button>
    │
    └── <QuickActions />
        ├── <h3>Ações Rápidas</h3>
        └── <ButtonGroup>
            ├── <Button onClick={openNewLeadModal}>Novo Lead</Button>
            ├── <Button onClick={openNewReservationModal}>Nova Reserva</Button>
            └── <Button onClick={openRelayModal}>Enviar Resposta</Button>
```

### 2.2 Leads Page

```
LeadsPage (async Server Component)
│
└── <LeadsLayout>
    │
    ├── <PageHeader>
    │   ├── <h1>Leads</h1>
    │   └── <Button onClick={openNewLeadModal}>+ Novo Lead</Button>
    │
    ├── <LeadsFilters />
    │   ├── State: { search, status, origin, page }
    │   ├── <Input
    │   │   placeholder="Buscar por nome ou telefone..."
    │   │   value={search}
    │   │   onChange={(e) => {
    │   │     debounce(() => setSearch(e.target.value), 300)
    │   │   }}
    │   │ />
    │   ├── <Select
    │   │   label="Status"
    │   │   options={[
    │   │     { value: 'novo', label: 'Novo' },
    │   │     { value: 'em_atendimento', label: 'Em atendimento' },
    │   │     ...
    │   │   ]}
    │   │   onChange={(v) => setStatus(v)}
    │   │ />
    │   ├── <Select
    │   │   label="Origem"
    │   │   options={[
    │   │     { value: 'whatsapp', label: 'WhatsApp Direto' },
    │   │     { value: 'meta_ads', label: 'Meta Ads' },
    │   │     ...
    │   │   ]}
    │   │   onChange={(v) => setOrigin(v)}
    │   │ />
    │   └── <Button onClick={() => {setSearch(''); setStatus(null); setOrigin(null)}}>
    │       Limpar filtros
    │     </Button>
    │
    ├── <LeadsTable />
    │   ├── useLeads({ search, status, origin, page, limit: 20 })
    │   │
    │   └── <DataTable
    │       columns={[
    │         { id: 'name', header: 'Nome', sortable: true },
    │         { id: 'phone', header: 'Telefone' },
    │         { id: 'status', header: 'Status', sortable: true },
    │         { id: 'origin', header: 'Origem', sortable: true },
    │         { id: 'last_interaction', header: 'Última interação', sortable: true },
    │         { id: 'quotation_value', header: 'Valor cotado', sortable: true },
    │         { id: 'actions', header: 'Ações' },
    │       ]}
    │       data={leads}
    │       isLoading={isLoading}
    │       error={error}
    │     >
    │       <tbody>
    │         {leads?.map(lead => (
    │           <tr key={lead.id}>
    │             <td>
    │               <div className="flex items-center gap-2">
    │                 <Avatar src={getInitials(lead.name)} />
    │                 <div>
    │                   <p className="font-medium">{lead.name}</p>
    │                   <p className="text-sm text-gray-500">{lead.phone}</p>
    │                 </div>
    │               </div>
    │             </td>
    │             <td><StatusBadge status={lead.status} /></td>
    │             <td><Badge>{lead.origin}</Badge></td>
    │             <td>{formatDate(lead.last_interaction)}</td>
    │             <td>{lead.quotation_value ? formatCurrency(lead.quotation_value) : '—'}</td>
    │             <td>
    │               <DropdownMenu>
    │                 <MenuItem onClick={() => navigate(`/crm/leads/${lead.id}`)}>
    │                   Ver detalhes
    │                 </MenuItem>
    │                 <MenuItem onClick={() => openEditLeadModal(lead)}>
    │                   Editar
    │                 </MenuItem>
    │                 <MenuItem onClick={() => openConvertModal(lead)}>
    │                   Converter em reserva
    │                 </MenuItem>
    │                 <MenuItem onClick={() => confirmDelete(lead.id)}>
    │                   Deletar
    │                 </MenuItem>
    │               </DropdownMenu>
    │             </td>
    │           </tr>
    │         ))}
    │       </tbody>
    │     </DataTable>
    │
    ├── <Pagination
    │   page={page}
    │   totalPages={Math.ceil(total / limit)}
    │   onChange={setPage}
    │ />
    │
    └── <LeadModal />
        ├── State: { isOpen, mode: 'create' | 'edit', formData }
        └── <Dialog open={isOpen} onOpenChange={setIsOpen}>
            ├── <DialogHeader>
            │   └── <h2>{mode === 'create' ? 'Novo Lead' : 'Editar Lead'}</h2>
            │
            ├── <Form
            │   schema={leadSchema}
            │   onSubmit={async (data) => {
            │     if (mode === 'create') {
            │       await leadsService.create(data);
            │     } else {
            │       await leadsService.update(lead.id, data);
            │     }
            │     refetch();
            │     setIsOpen(false);
            │   }}
            │ >
            │   ├── <Input label="Nome" name="name" required />
            │   ├── <Input label="Telefone" name="phone" required mask="(99) 9999-9999" />
            │   ├── <Select label="Status" name="status" options={statuses} required />
            │   ├── <Select label="Origem" name="origin" options={origins} />
            │   ├── <Textarea label="Notas" name="notes" />
            │   └── <Button type="submit">Salvar</Button>
            └── </Dialog>
```

### 2.3 Clientes Page

```
ClientsPage (async Server Component)
│
└── <ClientsLayout>
    │
    ├── <PageHeader>
    │   ├── <h1>Clientes</h1>
    │   └── <Button onClick={openNewClientModal}>+ Novo Cliente</Button>
    │
    ├── <ClientFilters />
    │   ├── <Input placeholder="Buscar por nome..." value={search} onChange={setSearch} />
    │   ├── <Select
    │   │   label="Período"
    │   │   options={[
    │   │     { value: 'all', label: 'Todos' },
    │   │     { value: 'month', label: 'Este mês' },
    │   │     { value: 'quarter', label: 'Este trimestre' },
    │   │     { value: 'year', label: 'Este ano' },
    │   │   ]}
    │   │ />
    │
    ├── <ClientsTable />
    │   └── useClients({ search, period })
    │       └── <DataTable
    │           columns={[...]}
    │           data={clients}
    │         >
    │           {/* Similar structure to LeadsTable */}
    │           <tbody>
    │             {clients?.map(client => (
    │               <tr key={client.id}>
    │                 <td>
    │                   <Avatar src={getInitials(client.name)} />
    │                   {client.name}
    │                 </td>
    │                 <td>{client.phone}</td>
    │                 <td>{formatDate(client.first_contact)}</td>
    │                 <td>{formatDate(client.last_contact)}</td>
    │                 <td>{formatCurrency(client.total_spent)}</td>
    │                 <td>
    │                   <div className="flex items-center">
    │                     <span className="text-yellow-500">★</span>
    │                     {client.nps}/10
    │                   </div>
    │                 </td>
    │                 <td>
    │                   <Button
    │                     variant="ghost"
    │                     onClick={() => navigate(`/crm/clientes/${client.id}`)}
    │                   >
    │                     Ver perfil
    │                   </Button>
    │                 </td>
    │               </tr>
    │             ))}
    │           </tbody>
    │         </DataTable>
    │
    └── <Pagination />
```

### 2.4 Cliente Detail Page

```
ClientDetailPage (async Server Component, params: { id })
│
└── <ClientDetailLayout>
    │
    ├── <header className="mb-6">
    │   ├── <Avatar size="lg" />
    │   ├── <div>
    │   │   ├── <h1>{client.name}</h1>
    │   │   ├── <p>(19) {client.phone}</p>
    │   │   └── <ButtonGroup>
    │   │       ├── <Button onClick={openEditClientModal}>Editar</Button>
    │   │       └── <Button onClick={openSendMessageModal}>Enviar Mensagem</Button>
    │   │
    │
    ├── <Tabs defaultValue="overview">
    │   │
    │   ├── <TabsContent value="overview">
    │   │   │
    │   │   ├── <section className="grid grid-cols-3 gap-4">
    │   │   │   ├── <InfoCard label="Total gasto" value={formatCurrency(client.total_spent)} />
    │   │   │   ├── <InfoCard label="Reservas" value={client.reservation_count} />
    │   │   │   └── <InfoCard label="NPS" value={client.nps ? `${client.nps}/10` : 'N/A'} />
    │   │   │
    │   │   ├── <Card>
    │   │   │   ├── <h3>Próximas Reservas</h3>
    │   │   │   └── {client.upcoming_reservations.length > 0 ? (
    │   │   │         <List>
    │   │   │           {client.upcoming_reservations.map(res => (
    │   │   │             <ListItem key={res.id}>
    │   │   │               <span>{formatDateRange(res.check_in, res.check_out)}</span>
    │   │   │               <span>{res.room_type}</span>
    │   │   │               <span>{formatCurrency(res.total)}</span>
    │   │   │             </ListItem>
    │   │   │           ))}
    │   │   │         </List>
    │   │   │       ) : (
    │   │   │         <EmptyState text="Nenhuma reserva próxima" />
    │   │   │       )
    │   │   │   }
    │   │   │
    │   │   └── <Button>Criar reserva</Button>
    │   │
    │   ├── <TabsContent value="conversations">
    │   │   │
    │   │   └── useConversations({ client_id: id })
    │   │       └── <ConversationThread>
    │   │           {conversations.map(conv => (
    │   │             <MessageBubble
    │   │               key={conv.id}
    │   │               role={conv.role}
    │   │               message={conv.message}
    │   │               timestamp={conv.timestamp}
    │   │             />
    │   │           ))}
    │   │
    │   ├── <TabsContent value="reservations">
    │   │   │
    │   │   └── useReservations({ client_id: id })
    │   │       └── <ReservationsList>
    │   │           {reservations.map(res => (
    │   │             <ReservationItem key={res.id} reservation={res} />
    │   │           ))}
    │   │
    │   └── <TabsContent value="notes">
    │       │
    │       └── <NotesEditor
    │           initialValue={client.notes}
    │           onSave={async (notes) => {
    │             await clientsService.update(id, { notes });
    │             refetch();
    │           }}
    │         >
    │           <Textarea
    │             value={notes}
    │             onChange={setNotes}
    │             placeholder="Adicione notas sobre este cliente..."
    │           />
    │           <Button onClick={handleSave}>Salvar</Button>
    │         </NotesEditor>
    │
    └── <Card>
        ├── <h3>Ações Rápidas</h3>
        └── <ButtonGroup>
            ├── <Button>Enviar promoção</Button>
            ├── <Button>Solicitar NPS</Button>
            └── <Button>Arquivar cliente</Button>
```

### 2.5 Calendario Page

```
CalendarPage (async Server Component)
│
└── <CalendarLayout>
    │
    ├── <PageHeader>
    │   ├── <h1>Calendário</h1>
    │   └── <RoomTypeSelector>
    │       ├── <Checkbox label="ALA_A" />
    │       ├── <Checkbox label="ALA_B" />
    │       └── <Checkbox label="ALA_C_CASAL" />
    │
    ├── <section className="grid grid-cols-4 gap-4">
    │   │
    │   └── <aside>
    │       └── <OccupancyLegend />
    │           ├── <Badge color="green">Disponível</Badge>
    │           ├── <Badge color="blue">Reservado</Badge>
    │           ├── <Badge color="yellow">Bloqueado</Badge>
    │           └── <Badge color="red">Manutenção</Badge>
    │
    └── <section className="flex-1">
        │
        └── <CalendarGrid />
            └── useAvailability({ start_date, end_date, room_types: selectedRoomTypes })
                └── <ReactBigCalendar
                    style={{ height: '100vh' }}
                    events={events.map(res => ({
                      id: res.id,
                      title: `${res.client_name} (${res.room_type})`,
                      start: new Date(res.check_in),
                      end: new Date(res.check_out),
                      resource: res,
                    }))}
                    onSelectEvent={(event) => {
                      setSelectedReservation(event.resource);
                    }}
                    onSelectSlot={(slot) => {
                      openNewReservationModal({ start_date: slot.start, end_date: slot.end });
                    }}
                    selectable
                  />
        │
        └── {selectedReservation && (
              <ReservationDetailPanel>
                ├── <h3>{selectedReservation.client_name}</h3>
                ├── <p>{formatDateRange(selectedReservation.check_in, selectedReservation.check_out)}</p>
                ├── <p>Tipo: {selectedReservation.room_type}</p>
                ├── <p>Pessoas: {selectedReservation.guest_count}</p>
                ├── <p>Total: {formatCurrency(selectedReservation.total)}</p>
                └── <ButtonGroup>
                    ├── <Button onClick={() => navigate(`/crm/reservas/${selectedReservation.id}`)}>
                      Ver detalhes
                    </Button>
                    └── <Button onClick={() => openEditReservationModal(selectedReservation)}>
                      Editar
                    </Button>
              </ReservationDetailPanel>
            )}
```

### 2.6 Reservas Page

```
ReservationsPage (async Server Component)
│
└── <ReservationsLayout>
    │
    ├── <PageHeader>
    │   ├── <h1>Reservas</h1>
    │   └── <Button onClick={openNewReservationModal}>+ Nova Reserva</Button>
    │
    ├── <ReservationFilters />
    │   ├── <Input placeholder="Buscar por cliente..." />
    │   ├── <Select label="Status">
    │   │   ├── Todas
    │   │   ├── Pendente
    │   │   ├── Confirmada
    │   │   ├── Check-in
    │   │   └── Concluída
    │   │
    │   ├── <DateRangePicker />
    │
    ├── <ReservationsList />
    │   └── useReservations({ search, status, date_range })
    │       └── <DataTable
    │           columns={[...]}
    │           data={reservations}
    │         >
    │           {/* Tabela com reservas */}
    │           <tbody>
    │             {reservations?.map(res => (
    │               <tr key={res.id}>
    │                 <td>{formatDateRange(res.check_in, res.check_out)}</td>
    │                 <td>{res.client_name}</td>
    │                 <td>{res.room_type}</td>
    │                 <td>{res.guest_count} pess.</td>
    │                 <td>{formatCurrency(res.total)}</td>
    │                 <td><StatusBadge status={res.status} /></td>
    │                 <td>
    │                   <Button onClick={() => navigate(`/crm/reservas/${res.id}`)}>
    │                     Ver
    │                   </Button>
    │                 </td>
    │               </tr>
    │             ))}
    │           </tbody>
    │         </DataTable>
    │
    └── <ReservationModal />
        └── <ConfirmationWizard steps={['Datas', 'Hóspede', 'Confirmação']}>
            ├── <Step1: Datas />
            │   ├── <DateRangePicker />
            │   └── <RoomTypeSelector />
            │
            ├── <Step2: Hóspede />
            │   ├── <ClientSearch /> (lookup ou criar novo)
            │   ├── <Input label="Nome" />
            │   ├── <Input label="Telefone" />
            │   ├── <Input label="Email" />
            │   └── <Input label="Pessoas" type="number" />
            │
            └── <Step3: Confirmação />
                ├── <Card>
                │   ├── Resumo: datas, tipo, pessoas
                │   ├── Cálculo: noites, preço/noite, desconto, total
                │   └── Botões de confirmação/cancelamento
```

### 2.7 Conversas Page

```
ConversationsPage (async Server Component)
│
└── <ConversationsLayout className="grid grid-cols-4">
    │
    ├── <aside className="col-span-1 border-r">
    │   │
    │   ├── <Input placeholder="Buscar conversa..." />
    │   │
    │   └── <ConversationsList />
    │       └── useConversations({ search, limit: 50 })
    │           └── <ul className="space-y-1">
    │               {conversations?.map(conv => (
    │                 <ConversationItem
    │                   key={conv.id}
    │                   active={selectedConversationId === conv.id}
    │                   onClick={() => setSelectedConversationId(conv.id)}
    │                 >
    │                   ├── <Avatar src={getInitials(conv.client_name)} />
    │                   ├── <div>
    │                   │   ├── <p className="font-medium">{conv.client_name}</p>
    │                   │   ├── <p className="text-sm truncate">{conv.last_message}</p>
    │                   │   └── <p className="text-xs text-gray-500">{formatTime(conv.last_timestamp)}</p>
    │                   │
    │                   └── {conv.unread && <Badge>Novo</Badge>}
    │                 </ConversationItem>
    │               ))}
    │
    └── <section className="col-span-3">
        │
        ├── {selectedConversationId && (
              <ChatView convId={selectedConversationId}>
                │
                ├── <header className="border-b p-4">
                │   ├── <Avatar src={getInitials(selectedConversation.client_name)} />
                │   ├── <h3>{selectedConversation.client_name}</h3>
                │   ├── <p className="text-sm">{selectedConversation.phone}</p>
                │   └── <Button onClick={() => navigate(`/crm/clientes/${selectedConversation.client_id}`)}>
                │       Ver perfil
                │     </Button>
                │
                ├── <div className="flex-1 overflow-y-auto p-4 space-y-4">
                │   └── {messages?.map(msg => (
                │         <MessageBubble
                │           key={msg.id}
                │           role={msg.role}
                │           message={msg.message}
                │           timestamp={msg.timestamp}
                │           relayFrom={msg.relay_from}
                │         >
                │           {msg.role === 'user' && (
                │             <div className="bg-blue-100 text-left">
                │               {msg.message}
                │               <small className="block text-gray-500">{formatTime(msg.timestamp)}</small>
                │             </div>
                │           )}
                │           {msg.role === 'bot' && (
                │             <div className="bg-gray-200 text-left">
                │               {msg.message}
                │               <small className="block text-gray-500">{formatTime(msg.timestamp)}</small>
                │             </div>
                │           )}
                │           {msg.role === 'human' && (
                │             <div className="bg-green-100 text-left border-l-4 border-green-500">
                │               <small className="block font-semibold">⚡ Equipe</small>
                │               {msg.message}
                │               <small className="block text-gray-500">{formatTime(msg.timestamp)}</small>
                │             </div>
                │           )}
                │         </MessageBubble>
                │       ))}
                │
                └── <RelayInput>
                    ├── <Textarea
                    │   placeholder="Digite resposta para enviar como relayed..."
                    │   maxLength={1000}
                    │   value={relayMessage}
                    │   onChange={setRelayMessage}
                    │ />
                    ├── <p className="text-xs">
                    │   ⚡ Será enviado como: "Equipe: sua mensagem"
                    │ </p>
                    └── <Button
                        onClick={async () => {
                          await conversationsService.sendRelay(selectedConversationId, relayMessage);
                          setRelayMessage('');
                          refetch();
                        }}
                      >
                        Enviar resposta
                      </Button>
            )
```

### 2.8 Analytics Page

```
AnalyticsPage (async Server Component)
│
└── <AnalyticsLayout>
    │
    ├── <PageHeader>
    │   ├── <h1>Analytics</h1>
    │   └── <DateRangePicker
    │       value={{ from, to }}
    │       onChange={(range) => setDateRange(range)}
    │       presets={['Hoje', 'Esta semana', 'Este mês', 'Este trimestre', 'Este ano']}
    │     />
    │
    ├── <section className="grid grid-cols-4 gap-4 mb-6">
    │   │
    │   ├── <KPICard
    │   │   label="Leads (período)"
    │   │   value={analytics.leads_count}
    │   │   trend={analytics.leads_trend}
    │   │   icon="TrendingUp"
    │   │ />
    │   │
    │   ├── <KPICard
    │   │   label="Taxa conversão"
    │   │   value={`${analytics.conversion_rate}%`}
    │   │   target="25%"
    │   │   icon="Target"
    │   │ />
    │   │
    │   ├── <KPICard
    │   │   label="Receita (período)"
    │   │   value={formatCurrency(analytics.total_revenue)}
    │   │   trend={analytics.revenue_trend}
    │   │   icon="DollarSign"
    │   │ />
    │   │
    │   └── <KPICard
    │       label="Ocupação"
    │       value={`${analytics.occupancy_rate}%`}
    │       target="75%"
    │       icon="Percent"
    │     />
    │
    ├── <section className="grid grid-cols-2 gap-6">
    │   │
    │   ├── <Card>
    │   │   ├── <h3>Leads (Tendência)</h3>
    │   │   └── <LeadsChart
    │   │       data={analytics.leads_trend}
    │   │       xAxis="date"
    │   │       yAxis="count"
    │   │     >
    │   │       <LineChart data={analytics.leads_trend}>
    │   │         <CartesianGrid />
    │   │         <XAxis dataKey="date" />
    │   │         <YAxis />
    │   │         <Tooltip />
    │   │         <Line type="monotone" dataKey="count" stroke="#8884d8" />
    │   │       </LineChart>
    │   │     </LeadsChart>
    │   │
    │   └── <Card>
    │       ├── <h3>Receita (Tendência)</h3>
    │       └── <RevenueTrendChart>
    │           <AreaChart data={analytics.revenue_trend}>
    │             <CartesianGrid />
    │             <XAxis dataKey="date" />
    │             <YAxis />
    │             <Tooltip formatter={formatCurrency} />
    │             <Area type="monotone" dataKey="revenue" fill="#82ca9d" stroke="#82ca9d" />
    │           </AreaChart>
    │         </RevenueTrendChart>
    │
    ├── <section className="grid grid-cols-2 gap-6">
    │   │
    │   ├── <Card>
    │   │   ├── <h3>Funil de Conversão</h3>
    │   │   └── <ConversionFunnelChart>
    │   │       <BarChart
    │   │         data={[
    │   │           { stage: 'Leads', value: analytics.leads_count },
    │   │           { stage: 'Cotação enviada', value: analytics.quoted_count },
    │   │           { stage: 'Reservado', value: analytics.confirmed_count },
    │   │         ]}
    │   │         layout="vertical"
    │   │       >
    │   │         <CartesianGrid />
    │   │         <XAxis type="number" />
    │   │         <YAxis dataKey="stage" type="category" />
    │   │         <Bar dataKey="value" fill="#8884d8" />
    │   │       </BarChart>
    │   │     </ConversionFunnelChart>
    │   │
    │   └── <Card>
    │       ├── <h3>Ocupação</h3>
    │       └── <OccupancyChart>
    │           <LineChart data={analytics.occupancy_trend}>
    │             <CartesianGrid />
    │             <XAxis dataKey="date" />
    │             <YAxis domain={[0, 100]} />
    │             <Tooltip formatter={(v) => `${v}%`} />
    │             <Line type="monotone" dataKey="occupancy" stroke="#ffc658" />
    │           </LineChart>
    │         </OccupancyChart>
    │
    └── <section>
        ├── <Card>
        │   ├── <h3>Leads por Origem</h3>
        │   └── <PieChart data={analytics.leads_by_origin}>
        │       <Pie dataKey="count" nameKey="origin">
        │         {analytics.leads_by_origin.map(entry => (
        │           <Cell key={entry.origin} fill={colorMap[entry.origin]} />
        │         ))}
        │       </Pie>
        │       <Tooltip />
        │     </PieChart>
```

---

## 3. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND STATE MANAGEMENT                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐          ┌──────────────────────┐              │
│  │ AuthContext      │          │  TanStack Query      │              │
│  ├──────────────────┤          ├──────────────────────┤              │
│  │ user: User|null  │          │ useLeads()           │              │
│  │ session: Session │          │ useReservations()    │              │
│  │ signIn()         │          │ useConversations()   │              │
│  │ signOut()        │          │ useClients()         │              │
│  └────────┬─────────┘          │ useAnalytics()       │              │
│           │                    │ useAvailability()    │              │
│           │                    └────────┬─────────────┘              │
│           │                             │                            │
│           └─────────────┬────────────────┘                           │
│                         │                                             │
│                         ▼                                             │
│            ┌────────────────────────┐                                │
│            │   useQuery / useMutation│                               │
│            │   (TanStack)           │                               │
│            │   - Cache management   │                               │
│            │   - Background refetch │                               │
│            │   - Deduplication      │                               │
│            └────────────┬───────────┘                                │
│                         │                                             │
│                         │                                             │
│          ┌──────────────┴───────────────┐                            │
│          │                              │                            │
│          ▼                              ▼                            │
│  ┌──────────────────┐          ┌──────────────────┐                │
│  │ Component State  │          │ Form State       │                │
│  │ useState()       │          │ React Hook Form  │                │
│  │ isModalOpen      │          │ Zod schemas      │                │
│  │ selectedItem     │          │ errors           │                │
│  │ filters          │          │ touched          │                │
│  └──────────────────┘          └──────────────────┘                │
│           │                              │                          │
└───────────┼──────────────────────────────┼──────────────────────────┘
            │                              │
            └──────────────┬───────────────┘
                           │
                HTTP/REST  │
                           │
            ┌──────────────▼────────────┐
            │    Axios Instance         │
            ├──────────────────────────┤
            │ baseURL                  │
            │ headers (Authorization)  │
            │ interceptors (retry)     │
            │ timeout handling         │
            └──────────────┬───────────┘
                           │
            ┌──────────────▼────────────┐
            │   Backend API            │
            │   (server.js / Vercel)   │
            ├──────────────────────────┤
            │ /api/leads               │
            │ /api/conversations       │
            │ /api/reservations        │
            │ /api/availability        │
            │ /api/payments            │
            │ /api/analytics           │
            └──────────────┬───────────┘
                           │
            ┌──────────────▼────────────┐
            │   Supabase PostgreSQL    │
            ├──────────────────────────┤
            │ leads table              │
            │ conversations table      │
            │ reservations table       │
            │ clients table            │
            │ availability table       │
            │ payments table           │
            └──────────────────────────┘
```

---

## 4. Component Reusability Matrix

| Componente | Dashboard | Leads | Clientes | Reservas | Conversas | Analytics |
|------------|-----------|-------|----------|----------|-----------|-----------|
| Avatar | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Badge | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Button | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Card | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DataTable | — | ✅ | ✅ | ✅ | — | — |
| Dialog | ✅ | ✅ | ✅ | ✅ | — | — |
| Input | — | ✅ | ✅ | ✅ | ✅ | — |
| Select | — | ✅ | ✅ | ✅ | — | — |
| Skeleton | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| StatusBadge | ✅ | ✅ | — | ✅ | — | — |
| Textarea | — | ✅ | ✅ | — | ✅ | — |
| Chart (Recharts) | — | — | — | — | — | ✅ |
| Calendar (React Big Calendar) | — | — | — | ✅ | — | — |
| MessageBubble | — | — | — | — | ✅ | — |

---

## 5. Custom Hooks Map

```typescript
// Auth Hooks
useAuth()                          // AuthContext consumer
useAuthGuard()                     // Redirect if not auth
useSessionRefresh()                // Auto-refresh JWT (optional)

// Data Fetching Hooks
useLeads(filters?)                 // TanStack Query leads
useLeadDetail(id)                  // Single lead
useReservations(filters?)          // TanStack Query reservations
useReservationDetail(id)           // Single reservation
useConversations(filters?)         // TanStack Query conversations
useClients(filters?)               // TanStack Query clients
useClientDetail(id)                // Single client
useAvailability(startDate, endDate, roomTypes?)  // Calendar data
useAnalytics(dateRange)            // Analytics data
usePayments(reservationId?)        // Payments history

// Form & UI Hooks
useForm<T>(options)                // React Hook Form (wrapper)
useFilters()                       // Filter state management
usePagination(total, limit)        // Pagination logic
useDebounce(value, delay)          // Debounce input
useLocalStorage<T>(key)            // Persist to localStorage

// Utility Hooks
useToast()                         // Toast notifications
useConfirmDialog()                 // Confirmation dialogs
useIsMobile()                      // Responsive detection
useAsync(asyncFn)                  // Generic async handler
```

---

## 6. Props Types Definition

Exemplo de tipos para componentes reutilizáveis:

```typescript
// components/LeadRow.tsx
interface LeadRowProps {
  lead: Lead;
  isLoading?: boolean;
  onEdit?: (lead: Lead) => void;
  onDelete?: (id: string) => void;
  onSelect?: (lead: Lead) => void;
  isSelected?: boolean;
}

// components/ReservationModal.tsx
interface ReservationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  reservation?: Reservation;
  onSubmit: (data: ReservationFormData) => Promise<void>;
  isLoading?: boolean;
}

// components/KPICard.tsx
interface KPICardProps {
  label: string;
  value: string | number;
  trend?: number;  // percentage change
  target?: string;
  icon?: LucideIcon;
  isLoading?: boolean;
}
```

---

Este documento fornece um roadmap visual completo da hierarquia de componentes, fluxo de dados e estrutura reutilizável do CRM Web.
