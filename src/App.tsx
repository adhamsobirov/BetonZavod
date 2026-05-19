import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  CreditCard,
  Download,
  Edit3,
  FileBarChart,
  FileText,
  Filter,
  FlaskConical,
  Home,
  LayoutDashboard,
  LogOut,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Settings,
  Shield,
  Trash2,
  UserCircle,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { aggregateExcavation, dailyTotals, excavationTotals, money, numberRu } from './lib/calculations'
import { exportExcel, exportPdf, exportReportPdf, printReport, type ExportRow, type ReportSection } from './lib/export'
import { useCrmStore } from './lib/store'
import { hasSupabaseEnv, supabase } from './lib/supabase'
import type { BarterAssetType, Client, DailyReport, DailyReportItem, ExcavationReport, Invoice, LabReport, Profile, Status } from './types'
import './App.css'

const navItems = [
  { label: 'Дашборд', to: '/', icon: LayoutDashboard },
  { label: 'Клиенты', to: '/clients', icon: Users },
  { label: 'Отчёты', to: '/reports', icon: FileText },
  { label: 'Ежедневный отчёт', to: '/daily', icon: Calendar },
  { label: 'Финансы', to: '/finance', icon: CreditCard },
  { label: 'Счета', to: '/invoices', icon: ReceiptText },
  { label: 'Лаборатория', to: '/lab', icon: FlaskConical },
  { label: 'Котлован', to: '/excavation', icon: Home },
  { label: 'Аналитика', to: '/analytics', icon: FileBarChart },
  { label: 'Настройки', to: '/settings', icon: Settings },
]

const statusLabel: Record<Status, string> = {
  active: 'Активен',
  pending: 'Ожидание',
  debt: 'Долг',
  archived: 'Архив',
  paid: 'Оплачен',
  unpaid: 'Не оплачен',
  completed: 'Завершено',
  in_progress: 'В процессе',
  annulled: 'Аннулирован',
}

const statusClass: Record<string, string> = {
  active: 'tag tag-green',
  paid: 'tag tag-green',
  completed: 'tag tag-green',
  pending: 'tag tag-amber',
  in_progress: 'tag tag-blue',
  debt: 'tag tag-red',
  unpaid: 'tag tag-red',
  archived: 'tag',
  annulled: 'tag tag-red',
}

const chartRows = [
  { name: 'Пн', income: 16200, expenses: 5600, profit: 10600 },
  { name: 'Вт', income: 23000, expenses: 8200, profit: 14800 },
  { name: 'Ср', income: 14400, expenses: 6200, profit: 8200 },
  { name: 'Чт', income: 30200, expenses: 10900, profit: 19300 },
  { name: 'Пт', income: 39200, expenses: 15500, profit: 23700 },
  { name: 'Сб', income: 34600, expenses: 12100, profit: 22500 },
  { name: 'Вс', income: 43800, expenses: 13400, profit: 30400 },
]

function App() {
  const auth = useAuth()
  const store = useCrmStore(auth.authenticated)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (auth.loading) return <LoadingState />

  if (!auth.authenticated) {
    return <LoginPage onLogin={auth.signIn} />
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu-btn" aria-label="Открыть меню" onClick={() => setMobileNavOpen(true)}>
        <LayoutDashboard size={20} /> Меню
      </button>
      <Sidebar
        open={mobileNavOpen}
        canManage={store.canManage}
        onClose={() => setMobileNavOpen(false)}
        onDelivery={() => setDeliveryOpen(true)}
        onLogout={auth.signOut}
      />
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Закрыть меню" onClick={() => setMobileNavOpen(false)} />}
      <div className="main-shell">
        <Topbar store={store} onDelivery={() => setDeliveryOpen(true)} />
        <main className="page-wrap">
          {store.loading ? (
            <LoadingState />
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard store={store} onDelivery={() => setDeliveryOpen(true)} />} />
              <Route path="/clients" element={<Clients store={store} />} />
              <Route path="/clients/:id" element={<ClientDetail store={store} />} />
              <Route path="/reports" element={<Reports store={store} />} />
              <Route path="/daily" element={<Daily store={store} />} />
              <Route path="/finance" element={<Finance store={store} />} />
              <Route path="/invoices" element={<Invoices store={store} />} />
              <Route path="/lab" element={<Lab store={store} />} />
              <Route path="/excavation" element={<Excavation store={store} />} />
              <Route path="/excavation/:id" element={<ExcavationDetail store={store} />} />
              <Route path="/analytics" element={<Analytics store={store} />} />
              <Route path="/settings" element={<SettingsPage store={store} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>
      {store.toast && <div className="toast">{store.toast}</div>}
      {deliveryOpen && store.canManage && <ConcreteDeliveryModal store={store} onClose={() => setDeliveryOpen(false)} />}
    </div>
  )
}

function useAuth() {
  const [authenticated, setAuthenticated] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(hasSupabaseEnv)

  const loadProfile = async () => {
    if (!supabase) return null
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('users_profile').select('*').eq('id', user.id).maybeSingle()
    setProfile((data as Profile | null) ?? null)
    return data as Profile | null
  }

  useEffect(() => {
    let active = true
    const init = async () => {
      if (!hasSupabaseEnv || !supabase) {
        setLoading(false)
        return
      }
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session && active) {
        await loadProfile()
        setAuthenticated(true)
      }
      if (active) setLoading(false)
    }
    init()
    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session))
      if (!session) setProfile(null)
      if (session) void loadProfile()
    }) ?? { data: null }
    return () => {
      active = false
      listener?.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (login: string, password: string) => {
    if (!hasSupabaseEnv || !supabase) {
      return 'Supabase Auth не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.'
    }
    const { data: email, error: loginError } = await supabase.rpc('login_email_for_username', { p_login: login })
    if (loginError || !email) return 'Пользователь не найден'
    const { error } = await supabase.auth.signInWithPassword({ email: String(email), password })
    if (error) return 'Неверный логин или пароль'
    await loadProfile()
    setAuthenticated(true)
    return true
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setAuthenticated(false)
    setProfile(null)
  }

  return { authenticated, profile, loading, signIn, signOut }
}

type Store = ReturnType<typeof useCrmStore>

const contractOptions = [
  { value: '100% cash / Без бартера', label: '100% наличка', cash: 100, barter: 0 },
  { value: '50% cash / 50% barter', label: '50% наличка / 50% бартер', cash: 50, barter: 50 },
  { value: 'Custom mixed contract', label: 'Пользовательский процент', cash: 60, barter: 40 },
]

const concreteGrades = ['M100', 'M150', 'M200', 'M250', 'M300', 'M350', 'M400', 'M450']

const barterAssetTypeLabels: Record<BarterAssetType, string> = {
  apartment: 'Квартира',
  car: 'Машина',
  land: 'Земельный участок',
  equipment: 'Спецтехника',
  other: 'Другое имущество',
}

const barterStatusLabel = {
  active: 'Активный',
  partial: 'Частично списан',
  written_off: 'Полностью списан',
  owned: 'Наш актив',
}

const addDaysIso = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const labStatusLabel = {
  pending: 'В ожидании',
  passed: 'Пройдено',
  failed: 'Не пройдено',
}

const labStatusClass = {
  pending: 'tag tag-amber',
  passed: 'tag tag-green',
  failed: 'tag tag-red',
}

function Sidebar({ open, canManage, onClose, onLogout, onDelivery }: { open: boolean; canManage: boolean; onClose: () => void; onLogout: () => void; onDelivery: () => void }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">C</div>
        <div>
          <strong>ConcreteCore</strong>
          <span>Управление поставками</span>
        </div>
      </div>
      {canManage && <button className="primary full" onClick={() => { onDelivery(); onClose() }}>
        <Plus size={18} /> Дать бетон
      </button>}
      <nav className="nav-list">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose}>
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <NavLink to="/settings">
          <Settings size={20} /> Настройки
        </NavLink>
        <button onClick={onLogout}>
          <LogOut size={20} /> Выйти
        </button>
      </div>
    </aside>
  )
}

function Topbar({ store, onDelivery }: { store: Store; onDelivery: () => void }) {
  const income = store.data.finance_transactions.filter((item) => item.type === 'income' && !item.annulled).reduce((sum, item) => sum + item.amount, 0)
  const expenses = store.data.finance_transactions.filter((item) => item.type === 'expense' && !item.annulled).reduce((sum, item) => sum + item.amount, 0)
  const debt = store.data.clients.reduce((sum, item) => sum + Math.abs(Math.min(item.balance, 0)), 0)
  const concreteM3 = store.data.client_reports.filter((item) => !item.annulled).reduce((sum, item) => sum + item.volume_m3, 0)
  const sections: ReportSection[] = [
    {
      title: 'Сводка CRM',
      items: [
        { label: 'Доход', value: money(income) },
        { label: 'Расход', value: money(expenses) },
        { label: 'Прибыль', value: money(income - expenses) },
        { label: 'Долги', value: money(debt) },
        { label: 'Клиенты', value: store.data.clients.length },
        { label: 'Кубы бетона', value: `${numberRu(concreteM3, 1)} м³` },
      ],
    },
  ]

  return (
    <header className="topbar">
      <label className="search">
        <Search size={18} />
        <input placeholder="Поиск объектов или отчетов..." />
      </label>
      <div className="top-actions">
        <button className="secondary" onClick={() => exportReportPdf('Сводный отчет CRM', sections, 'crm-summary')}>
          <Download size={18} /> Экспорт
        </button>
        {store.canManage && <button className="primary" onClick={onDelivery}>
          <Plus size={18} /> Дать бетон
        </button>}
        <button className="icon-btn" aria-label="Уведомления">
          <Bell size={20} />
        </button>
        <div className="profile-pill">
          <UserCircle size={28} />
          <div>
            <strong>{store.data.profile.full_name}</strong>
            <span>{store.data.profile.role === 'admin' ? 'Администратор' : 'Просмотр'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

function LoginPage({ onLogin }: { onLogin: (login: string, password: string) => Promise<true | string> }) {
  const [login, setLogin] = useState('Adham')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const result = await onLogin(login.trim(), password)
    setSubmitting(false)
    if (result !== true) setError(result)
  }

  return (
    <main className="login-screen">
      <form className="login-card glass-panel" onSubmit={submit}>
        <div className="brand center">
          <div className="brand-mark">C</div>
          <div>
            <strong>Concrete Supply CRM</strong>
            <span>Онлайн управление бетонным заводом</span>
          </div>
        </div>
        <h1>Вход в систему</h1>
        <p>Безопасный вход администратора через Supabase Auth.</p>
        <Field label="Логин" value={login} onChange={setLogin} />
        <Field label="Пароль" value={password} onChange={setPassword} type="password" />
        {error && <p className="error-text">{error}</p>}
        <button className="primary full" disabled={submitting}>{submitting ? 'Проверяем доступ...' : 'Войти'}</button>
      </form>
    </main>
  )
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

function Kpi({ title, value, tone = 'blue', icon }: { title: string; value: string; tone?: string; icon?: ReactNode }) {
  return (
    <Card className="kpi">
      <div className={`kpi-icon ${tone}`}>{icon ?? <WalletCards size={20} />}</div>
      <span>{title}</span>
      <strong>{value}</strong>
    </Card>
  )
}

function Dashboard({ store, onDelivery }: { store: Store; onDelivery: () => void }) {
  const income = store.data.finance_transactions.filter((item) => item.type === 'income' && !item.annulled).reduce((sum, item) => sum + item.amount, 0)
  const expenses = store.data.finance_transactions.filter((item) => item.type === 'expense' && !item.annulled).reduce((sum, item) => sum + item.amount, 0)
  const debt = store.data.clients.reduce((sum, item) => sum + Math.abs(Math.min(item.balance, 0)), 0)
  const concreteM3 = store.data.client_reports.filter((item) => !item.annulled).reduce((sum, item) => sum + item.volume_m3, 0)
  const barterValue = store.data.barter_assets.reduce((sum, item) => sum + item.remaining_amount, 0)
  const excavationProfit = aggregateExcavation(store.data.excavation_reports.filter((item) => !item.archived && !item.annulled)).netProfit
  const activeClients = store.data.clients.filter((client) => !client.archived && client.status !== 'archived').length
  const dashboardEvents = [
    ...store.data.activity_logs.map((item) => ({ title: item.title, description: item.description, module: item.module, date: item.created_at })),
    ...store.data.barter_assets.slice(0, 2).map((asset) => ({ title: `${barterAssetTypeLabels[asset.type]} добавлен`, description: asset.asset_name, module: 'Бартер', date: asset.created_at })),
    ...store.data.finance_transactions.filter((item) => item.category === 'Оплата' && !item.annulled).slice(0, 2).map((item) => ({ title: 'Оплата', description: item.description, module: 'Финансы', date: item.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)

  return (
    <>
      <PageHeader
        title="Панель управления"
        subtitle="Операционная сводка бетонного завода, финансов и проектов."
        action={store.canManage ? (
          <div className="toolbar compact">
            <button className="primary" onClick={onDelivery}><Plus size={18} /> Дать бетон</button>
            <Link className="secondary" to="/clients"><Users size={18} /> Новый клиент</Link>
          </div>
        ) : undefined}
      />
      <div className="kpi-grid dashboard-kpis">
        <Kpi title="Доход" value={money(income)} />
        <Kpi title="Расход" value={money(expenses)} tone="red" />
        <Kpi title="Прибыль" value={money(income - expenses)} tone="green" />
        <Kpi title="Долги" value={money(debt)} tone="amber" />
        <Kpi title="Активные клиенты" value={numberRu(activeClients)} />
        <Kpi title="Кубы бетона" value={`${numberRu(concreteM3, 1)} м³`} />
        <Kpi title="Бартерные активы" value={money(barterValue)} tone="amber" />
        <Kpi title="Котлован прибыль" value={money(excavationProfit)} tone="green" />
      </div>
      <div className="grid two wide-left">
        <ChartCard title="Денежный поток" type="area" dataKey="profit" color="#0f55d9" />
        <Card className="quick-actions-card">
          <h2>Быстрые действия</h2>
          <div className="quick-actions-grid">
            {store.canManage && <Link className="secondary" to="/clients"><Plus size={18} /> Новый клиент</Link>}
            {store.canManage && <button className="secondary" onClick={onDelivery}><Plus size={18} /> Дать бетон</button>}
            {store.canManage && <button className="secondary" onClick={() => store.notify('Откройте карточку клиента, чтобы добавить оплату')}><CreditCard size={18} /> Оплата</button>}
            {store.canManage && <Link className="secondary" to="/invoices"><ReceiptText size={18} /> Счёт</Link>}
            <Link className="secondary" to="/excavation"><Home size={18} /> Котлован</Link>
          </div>
        </Card>
      </div>
      <div className="grid three">
        <ChartCard title="Расходы" type="line" dataKey="expenses" color="#991b1b" />
        <ChartCard title="Прибыль" type="area" dataKey="profit" color="#166534" />
        <DonutCard title="Наличные vs Бартер" data={[{ name: 'Наличные', value: 75 }, { name: 'Бартер', value: 25 }]} />
      </div>
      <Card>
        <h2>Последние действия</h2>
        <div className="timeline-list">
          {dashboardEvents.map((item, index) => (
            <div className="timeline-item" key={`${item.title}-${index}`}>
              <span>{item.module}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function Analytics({ store }: { store: Store }) {
  const income = store.data.finance_transactions.filter((item) => item.type === 'income' && !item.annulled).reduce((sum, item) => sum + item.amount, 0)
  const expenses = store.data.finance_transactions.filter((item) => item.type === 'expense' && !item.annulled).reduce((sum, item) => sum + item.amount, 0)
  const concreteM3 = store.data.client_reports.reduce((sum, item) => sum + item.volume_m3, 0)
  const barterMarket = store.data.barter_assets.reduce((sum, item) => sum + item.market_value, 0)
  const barterUsed = store.data.barter_assets.reduce((sum, item) => sum + item.used_amount, 0)
  const excavation = aggregateExcavation(store.data.excavation_reports.filter((item) => !item.archived && !item.annulled))
  const clientsByProfit = store.data.clients
    .map((client) => ({
      client,
      value: store.data.client_reports.filter((report) => report.client_id === client.id && !report.annulled).reduce((sum, report) => sum + report.amount, 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)

  return (
    <>
      <PageHeader
        title="Аналитика"
        action={
          <div className="toolbar compact">
            <button className="secondary">
              <Calendar size={18} /> Последние 30 дней <ChevronDown size={16} />
            </button>
            <button className="secondary">
              <Building2 size={18} /> Все клиенты <ChevronDown size={16} />
            </button>
            <button className="secondary icon-only">
              <Filter size={18} />
            </button>
          </div>
        }
      />
      <div className="kpi-grid four">
        <Kpi title="Доход / расход" value={`${money(income)} / ${money(expenses)}`} />
        <Kpi title="Бетон за период" value={`${numberRu(concreteM3, 1)} м³`} />
        <Kpi title="Бартер использован" value={money(barterUsed)} tone="amber" />
        <Kpi title="Котлован прибыль" value={money(excavation.netProfit)} tone="green" />
      </div>
      <div className="grid two">
        <ChartCard title="Доход по дням" type="bar" dataKey="income" />
        <ChartCard title="Расходы" type="line" dataKey="expenses" color="#c51414" />
      </div>
      <div className="grid two">
        <ChartCard title="Прибыль" type="area" dataKey="profit" color="#16a34a" />
        <DonutCard title="Бартер vs Наличные" data={[{ name: 'Наличные / Перевод', value: 75 }, { name: 'Бартер / Взаимозачет', value: 25 }]} />
      </div>
      <div className="grid three">
        <Card>
          <h2>Бетон по месяцам</h2>
          <div className="progress-row"><span>Поставлено</span><strong>{numberRu(concreteM3, 1)} м³</strong><div><i style={{ width: `${Math.min(100, concreteM3 / 120)}%` }} /></div></div>
          <div className="progress-row"><span>Средняя цена</span><strong>{money(concreteM3 ? income / concreteM3 : 0)}</strong><div><i style={{ width: '58%' }} /></div></div>
        </Card>
        <Card>
          <h2>Клиенты по выручке</h2>
          {clientsByProfit.map(({ client, value }) => (
            <div className="progress-row" key={client.id}><span>{client.name}</span><strong>{money(value)}</strong><div><i style={{ width: `${Math.min(100, value / Math.max(1, clientsByProfit[0]?.value ?? 1) * 100)}%` }} /></div></div>
          ))}
        </Card>
        <Card>
          <h2>Бартер аналитика</h2>
          <SummaryLine label="Рыночная стоимость" value={money(barterMarket)} />
          <SummaryLine label="Использовано" value={money(barterUsed)} tone="blue" />
          <SummaryLine label="Остаток" value={money(Math.max(barterMarket - barterUsed, 0))} tone="amber" />
        </Card>
      </div>
      <RecentActivity store={store} />
    </>
  )
}

function Clients({ store }: { store: Store }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const clients = store.data.clients.filter((client) => !client.archived)

  return (
    <>
      <PageHeader
        title="Управление клиентами"
        subtitle="Клиентская база, договоры, долги и поставки бетона."
        action={store.canManage ? (
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> Создать клиента
          </button>
        ) : undefined}
      />
      <div className="toolbar">
        <button className="secondary">
          <Filter size={18} /> Все статусы <ChevronDown size={16} />
        </button>
      </div>
      <Card>
        <table className="crm-table clients-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Клиент / логин</th>
              <th>Баланс</th>
              <th>Поставлено</th>
              <th>Оплачено / бартер</th>
              <th>Статус</th>
              <th>Договор / изменено</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <tr key={client.id} className={client.status === 'debt' || client.balance < 0 ? 'debt-row' : ''}>
                <td>{String(index + 1).padStart(3, '0')}</td>
                <td>
                  <Link className="client-cell" to={`/clients/${client.id}`}>
                    <span>{client.name.charAt(0)}</span>
                    <strong>{client.name}</strong>
                    <small>{client.login}</small>
                  </Link>
                </td>
                <td className={client.balance < 0 ? 'red-text amount' : 'green-text amount'}>{money(client.balance)}</td>
                <td>{numberRu(client.total_supplied_m3 ?? 0, 1)} м³</td>
                <td>
                  {money(client.total_paid ?? 0)}
                  <small>Бартер: {money(client.total_barter_value ?? 0)}</small>
                </td>
                <td>
                  <span className={statusClass[client.status]}>{statusLabel[client.status]}</span>
                </td>
                <td>
                  <span className="pill">{client.contract_type}</span>
                  <small>{new Date(client.updated_at).toLocaleDateString('ru-RU')}</small>
                </td>
                <td>
                  <div className="row-actions">
                    {store.canManage && (
                      <>
                        <button className="icon-btn" onClick={() => setEditing(client)}>
                          <Edit3 size={17} />
                        </button>
                        <AdminActionButton className="icon-btn" action={(reason) => store.api.adminDelete('clients', client.id, client.name, 'delete', reason)}>
                          <Trash2 size={17} />
                        </AdminActionButton>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open && store.canManage && <ClientModal onClose={() => setOpen(false)} onSave={store.api.addClient} />}
      {editing && store.canManage && <ClientModal client={editing} onClose={() => setEditing(null)} onUpdate={store.api.updateClient} onSave={store.api.addClient} />}
    </>
  )
}

function ClientDetail({ store }: { store: Store }) {
  const { id } = useParams()
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const client = store.data.clients.find((item) => item.id === id)
  if (!client) return <EmptyState title="Клиент не найден" />
  const rows = store.data.client_reports.filter((report) => report.client_id === client.id && !report.annulled)
  const payments = store.data.finance_transactions.filter((item) => item.client_id === client.id && item.category === 'Оплата' && !item.annulled)
  const barterAssets = store.data.barter_assets.filter((asset) => asset.client_id === client.id)
  const ownedAssets = barterAssets.filter((asset) => asset.remaining_amount <= 0 || asset.status === 'written_off' || asset.status === 'owned')
  const totals = rows.reduce(
    (acc, row) => ({
      volume: acc.volume + row.volume_m3,
      amount: acc.amount + row.amount,
      paid: acc.paid + row.paid_amount,
      barter: acc.barter + row.barter_amount,
      cash: acc.cash + (row.cash_amount ?? row.amount - row.barter_amount),
      usedBarterFromDeliveries: acc.usedBarterFromDeliveries + (row.barter_asset_allocations ?? []).reduce((sum, allocation) => sum + allocation.amount, 0),
    }),
    { volume: 0, amount: 0, paid: 0, barter: 0, cash: 0, usedBarterFromDeliveries: 0 },
  )
  const cashPaid = payments.reduce((sum, item) => sum + item.amount, 0)
  const usedCash = Math.min(cashPaid, totals.cash)
  const remainingCash = Math.max(cashPaid - usedCash, 0)
  const cashDebt = Math.max(totals.cash - usedCash, 0)
  const totalMarketValue = barterAssets.reduce((sum, asset) => sum + asset.market_value, 0)
  const totalCostPrice = barterAssets.reduce((sum, asset) => sum + (asset.cost_price ?? 0), 0)
  const usedBarter = barterAssets.reduce((sum, asset) => sum + asset.used_amount, 0)
  const remainingBarter = barterAssets.reduce((sum, asset) => sum + asset.remaining_amount, 0)
  const barterDebt = Math.max(totals.barter - usedBarter, 0)
  const barterProfit = totalMarketValue - totalCostPrice
  const debt = cashDebt + barterDebt
  const exportRows = rows.map((row) => ({
    Дата: row.date,
    Объект: row.object_name,
    Марка: row.concrete_grade,
    Объем: row.volume_m3,
    Сумма: row.amount,
    Наличные: row.paid_amount,
    Бартер: row.barter_amount,
    Комментарий: row.comment ?? '',
  }))
  const clientReportSections: ReportSection[] = [
    {
      title: 'Информация клиента',
      items: [
        { label: 'Клиент', value: client.name },
        { label: 'Телефон', value: client.phone },
        { label: 'Логин', value: client.login },
        { label: 'Статус', value: statusLabel[client.status] },
      ],
    },
    {
      title: 'Договор',
      items: [
        { label: 'Тип договора', value: contractOptions.find((item) => item.value === client.contract_type)?.label ?? client.contract_type },
        { label: 'Наличные', value: `${client.cash_percent}%` },
        { label: 'Бартер', value: `${client.barter_percent}%` },
      ],
    },
    { title: 'Поставки бетона', rows: exportRows },
    { title: 'Оплаты', rows: payments.map((payment) => ({ Дата: payment.date, Описание: payment.description, Сумма: money(payment.amount) })) },
    { title: 'Бартер', rows: barterAssets.map((asset) => ({ Тип: barterAssetTypeLabels[asset.type], Название: asset.asset_name, Стоимость: money(asset.market_value), Себестоимость: money(asset.cost_price), Использовано: money(asset.used_amount), Остаток: money(asset.remaining_amount), Статус: barterStatusLabel[asset.status] })) },
    {
      title: 'Итог',
      items: [
        { label: 'Всего поставлено', value: `${numberRu(totals.volume, 1)} м³` },
        { label: 'Сумма поставок', value: money(totals.amount) },
        { label: 'Наличный долг', value: money(cashDebt) },
        { label: 'Бартерный долг', value: money(barterDebt) },
        { label: 'Общий долг', value: money(debt) },
      ],
    },
  ]

  return (
    <>
      <Link className="back-link" to="/reports">Назад к отчётам</Link>
      <PageHeader
        title={client.name.replace('ООО ', '').replaceAll('"', '')}
        subtitle="Детали отчета клиента"
        action={
          <div className="toolbar compact">
            <span className="pill blue">Договор: {contractOptions.find((item) => item.value === client.contract_type)?.label ?? client.contract_type}</span>
            <button className="secondary" onClick={() => exportExcel(exportRows, 'client-report')}>
              <Download size={18} /> Скачать Excel
            </button>
            <button className="secondary" onClick={() => exportReportPdf('Отчет клиента', clientReportSections, `client-${client.id}`, { client: client.name })}>
              <FileText size={18} /> PDF
            </button>
            <button className="secondary" onClick={() => printReport('Отчет клиента', clientReportSections, { client: client.name })}>
              <Printer size={18} /> Печать
            </button>
          </div>
        }
      />
      <div className="kpi-grid four">
        <Kpi title="Общая сумма договора" value={money(client.contract_total ?? 0)} />
        <Kpi title="Поставлено бетона" value={`${numberRu(totals.volume, 1)} м³`} />
        <Kpi title="Сумма поставленного бетона" value={money(totals.amount)} />
        <Kpi title="Наличные оплачено" value={money(cashPaid)} tone="green" />
      </div>
      <div className="kpi-grid four">
        <Kpi title="Наличная часть" value={`${client.cash_percent}% · ${money(totals.cash)}`} />
        <Kpi title="Бартерная часть" value={`${client.barter_percent}% · ${money(totals.barter)}`} />
        <Kpi title="Использовано наличных" value={money(usedCash)} />
        <Kpi title="Остаток наличных" value={money(remainingCash)} tone="green" />
      </div>
      <div className="kpi-grid four">
        <Kpi title="Стоимость бартерных активов" value={money(totalMarketValue)} />
        <Kpi title="Использовано бартера" value={money(usedBarter)} tone="blue" />
        <Kpi title="Остаток бартера" value={money(remainingBarter)} tone="green" />
        <Kpi title="Бартерная прибыль" value={money(barterProfit)} tone="amber" />
      </div>
      <div className="kpi-grid four">
        <Kpi title="Наличный долг" value={money(cashDebt)} tone="red" />
        <Kpi title="Бартерный долг" value={money(barterDebt)} tone="red" />
        <Kpi title="Общий долг" value={money(debt)} tone="red" />
        <Kpi title="Наши активы" value={numberRu(ownedAssets.length)} tone="green" />
      </div>
      <Card>
        <h2>История поставок бетона</h2>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Объект</th>
              <th>Марка</th>
              <th>Объем</th>
              <th>Сумма</th>
              <th>Денежная часть</th>
              <th>Бартерная часть</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.date).toLocaleDateString('ru-RU')}</td>
                <td>{row.object_name}</td>
                <td>{row.concrete_grade}</td>
                <td>{row.volume_m3} м³</td>
                <td>{money(row.amount)}</td>
                <td className="blue-text">{money(row.cash_amount ?? row.amount - row.barter_amount)}</td>
                <td className="purple-text">{money(row.barter_amount)}</td>
                <td>{row.comment}</td>
                <td>
                  {store.canManage && (
                    <>
                      <AdminActionButton className="secondary" action={(reason) => store.api.adminDelete('client_reports', row.id, row.object_name, 'annul', reason)}>Аннулировать</AdminActionButton>
                      <AdminActionButton className="icon-btn" action={(reason) => store.api.adminDelete('client_reports', row.id, row.object_name, 'delete', reason)}><Trash2 size={16} /></AdminActionButton>
                    </>
                  )}
                </td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={3}>Итого:</td>
              <td>{totals.volume} м³</td>
              <td>{money(totals.amount)}</td>
              <td>{money(totals.cash)}</td>
              <td>{money(totals.barter)}</td>
              <td /><td />
            </tr>
          </tbody>
        </table>
      </Card>
      <div className="grid two">
        <Card>
          <h2>История оплат</h2>
          {payments.length ? payments.map((payment) => (
            <div className="asset-row" key={payment.id}>
              <CreditCard /> {payment.description} <strong>{money(payment.amount)}</strong>
              {store.canManage && <AdminActionButton className="icon-btn" action={(reason) => store.api.adminDelete('finance_transactions', payment.id, payment.description, 'delete', reason)}><Trash2 size={16} /></AdminActionButton>}
            </div>
          )) : <p>Оплаты пока не добавлены.</p>}
          {store.canManage && <button className="secondary" onClick={() => {
            const value = Number(prompt('Сумма оплаты в сомони') ?? 0)
            if (value > 0) void store.api.addPayment(client.id, value)
          }}>Добавить оплату</button>}
        </Card>
        <Card>
          <div className="card-title">
            <h2>Бартерные активы</h2>
            {store.canManage && <button className="primary" onClick={() => setAssetModalOpen(true)}><Plus size={18} /> Добавить актив</button>}
          </div>
          {barterAssets.length ? (
            <div className="barter-table-wrap">
              <table className="crm-table compact-table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Название</th>
                    <th>Рыночная стоимость</th>
                    <th>Себестоимость</th>
                    <th>Использовано</th>
                    <th>Остаток</th>
                    <th>Статус</th>
                    <th>Фото</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {barterAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td>{barterAssetTypeLabels[asset.type]}</td>
                      <td>{asset.asset_name}<small>{asset.comment}</small></td>
                      <td>{money(asset.market_value)}</td>
                      <td>{money(asset.cost_price)}</td>
                      <td className="purple-text">{money(asset.used_amount)}</td>
                      <td>{money(asset.remaining_amount)}</td>
                      <td>
                        <span className={asset.remaining_amount === 0 ? 'tag tag-green' : asset.used_amount > 0 ? 'tag tag-amber' : 'tag tag-blue'}>
                          {barterStatusLabel[asset.status]}
                        </span>
                        {asset.remaining_amount === 0 && <small className="green-text">Наш актив</small>}
                      </td>
                      <td>{asset.photos.length ? <img className="asset-thumb" src={asset.photos[0]} alt={asset.asset_name} /> : 'Нет фото'}</td>
                      <td>
                        <button className="secondary" onClick={() => store.notify('Детали актива доступны в карточке')}>Детали</button>
                        {store.canManage && <AdminActionButton className="icon-btn" action={(reason) => store.api.adminDelete('barter_assets', asset.id, asset.asset_name, 'delete', reason)}><Trash2 size={16} /></AdminActionButton>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>Бартерные активы пока не добавлены.</p>}
        </Card>
      </div>
      <Card>
        <h2>Наши активы</h2>
        {ownedAssets.length ? (
          <div className="asset-list">
            {ownedAssets.map((asset) => (
              <div className="asset-row" key={asset.id}>
                <Home />
                <span>{barterAssetTypeLabels[asset.type]} · {asset.asset_name}</span>
                <strong>{money(asset.market_value)}</strong>
                <small>Клиент: {client.name} · использовано {money(asset.used_amount)} · дата завершения {asset.owned_at ? new Date(asset.owned_at).toLocaleDateString('ru-RU') : '—'}</small>
              </div>
            ))}
          </div>
        ) : <p>Активы появятся здесь после полного списания стоимости.</p>}
      </Card>
      {assetModalOpen && <BarterAssetModal client={client} store={store} onClose={() => setAssetModalOpen(false)} />}
    </>
  )
}

function Reports({ store }: { store: Store }) {
  const rows = store.data.clients.filter((client) => !client.archived).map((client) => {
    const reports = store.data.client_reports.filter((report) => report.client_id === client.id && !report.annulled)
    return {
      client,
      orders: reports.length,
      volume: reports.reduce((sum, report) => sum + report.volume_m3, 0),
      amount: reports.reduce((sum, report) => sum + report.amount, 0),
      paid: reports.reduce((sum, report) => sum + report.paid_amount, 0),
      barter: reports.reduce((sum, report) => sum + report.barter_amount, 0),
      debt: Math.max(0, Math.abs(Math.min(client.balance, 0))),
    }
  })
  const exportRows = rows.map((row) => ({ Клиент: row.client.name, Заказов: row.orders, Объем: row.volume, Сумма: row.amount, Оплачено: row.paid, Бартер: row.barter, Долг: row.debt }))

  return (
    <>
      <PageHeader
        title="Отчеты по клиентам"
        subtitle="Аналитика и финансовые показатели по контрагентам"
        action={<ExportButtons title="Отчеты по клиентам" rows={exportRows} filename="client-reports" />}
      />
      <div className="toolbar">
        <button className="secondary">Все периоды <ChevronDown size={16} /></button>
        <button className="secondary">Все типы договоров <ChevronDown size={16} /></button>
        <label className="search small"><Search size={18} /><input placeholder="Поиск клиента..." /></label>
      </div>
      <Card>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Тип договора</th>
              <th>Заказов</th>
              <th>Общий объем (м³)</th>
              <th>Общая сумма</th>
              <th>Долг</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.client.id}>
                <td><Link to={`/clients/${row.client.id}`}>{row.client.name}<small>{row.client.phone}</small></Link></td>
                <td><span className="pill blue">{row.client.contract_type}</span></td>
                <td>{row.orders}</td>
                <td>{numberRu(row.volume, 1)}</td>
                <td>{money(row.amount)}</td>
                <td className="red-text">{money(row.debt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

function Finance({ store }: { store: Store }) {
  const totals = store.data.finance_transactions.reduce(
    (acc, item) => {
      acc[item.type] += item.amount
      return acc
    },
    { income: 0, expense: 0, barter: 0 },
  )
  const [clientFilter, setClientFilter] = useState('all')
  const financeRows = store.data.finance_transactions.filter((item) => !item.annulled)
  const visibleTransactions = clientFilter === 'all' ? financeRows : financeRows.filter((item) => item.client_id === clientFilter)
  const exportRows = visibleTransactions.map((item) => ({ Дата: item.date, Категория: item.category, Тип: item.type, Описание: item.description, Сумма: item.amount }))

  return (
    <>
      <PageHeader title="Финансы" subtitle="Финансовая сводка, оплаты, долги и бартер." action={<ExportButtons title="Финансы" rows={exportRows} filename="finance" />} />
      <div className="toolbar">
        <SelectField label="Фильтр по клиенту" value={clientFilter} onChange={setClientFilter} options={[{ value: 'all', label: 'Все клиенты' }, ...store.data.clients.map((client) => ({ value: client.id, label: client.name }))]} />
      </div>
      <div className="kpi-grid four">
        <Kpi title="Общий доход" value={money(totals.income)} />
        <Kpi title="Расходы" value={money(totals.expense)} tone="red" />
        <Kpi title="Бартер" value={money(totals.barter)} tone="amber" />
        <Kpi title="Чистая прибыль" value={money(totals.income - totals.expense)} />
      </div>
      <div className="grid two wide-left">
        <Card>
          <div className="card-title"><h2>Последние транзакции</h2><button className="link-btn" onClick={() => store.notify('Показаны все доступные транзакции')}>Смотреть все</button></div>
          <table className="crm-table compact-table">
            <thead><tr><th>Дата</th><th>Категория</th><th>Описание</th><th>Сумма</th></tr></thead>
            <tbody>
              {visibleTransactions.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                  <td><span className="pill blue">{item.category}</span></td>
                  <td>{item.description}</td>
                  <td className={item.type === 'income' ? 'blue-text' : item.type === 'barter' ? 'amber-text' : 'red-text'}>{item.type === 'income' ? '+ ' : '- '}{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <DonutCard title="Распределение" data={[{ name: 'Доход', value: 67 }, { name: 'Расход', value: 23 }, { name: 'Бартер', value: 10 }]} />
      </div>
    </>
  )
}

function Daily({ store }: { store: Store }) {
  const [report, setReport] = useState<DailyReport | undefined>(store.data.daily_reports.find((item) => !item.annulled) ?? store.data.daily_reports[0])
  if (!report) return <EmptyState title="Ежедневных отчетов пока нет" />
  const totals = dailyTotals(report)
  const updateItem = (itemId: string, key: keyof DailyReportItem, value: string) => {
    setReport((current) => ({
      ...current!,
      items: current!.items.map((item) => (item.id === itemId ? { ...item, [key]: key === 'volume_m3' || key === 'price' ? Number(value) : value } : item)),
    }))
  }
  const rows = report.items.map((item) => ({ Клиент: item.client_name, Объект: item.object_name, Марка: item.concrete_grade, Объем: item.volume_m3, Цена: item.price, Сумма: item.volume_m3 * item.price }))
  const dailySections: ReportSection[] = [
    { title: 'Дата', items: [{ label: 'Дата отчёта', value: new Date(report.date).toLocaleDateString('ru-RU') }] },
    { title: 'Бетон', rows },
    {
      title: 'Материалы',
      items: [
        { label: 'Цемент', value: `${report.cement_t} т` },
        { label: 'Щебень', value: `${report.gravel_t} т` },
        { label: 'Песок', value: `${report.sand_t} т` },
        { label: 'Добавки', value: `${report.additives_l} л` },
      ],
    },
    {
      title: 'Расходы',
      items: [
        { label: 'Зарплата', value: money(report.salary_expense) },
        { label: 'Топливо', value: money(report.fuel_expense) },
        { label: 'Всего расходы', value: money(totals.expenses) },
      ],
    },
    {
      title: 'Итог',
      items: [
        { label: 'Доход', value: money(totals.income) },
        { label: 'Расход', value: money(totals.expenses) },
        { label: 'Прибыль', value: money(totals.profit) },
        { label: 'Рентабельность', value: `${numberRu(totals.profitability, 1)}%` },
      ],
    },
  ]

  return (
    <>
      <PageHeader
        title="Ежедневный отчет"
        subtitle={new Date(report.date).toLocaleDateString('ru-RU')}
        action={<button className="secondary"><Calendar size={18} /> Выбрать дату</button>}
      />
      <div className="daily-grid">
        <Card>
          <div className="card-title">
            <h2>Операции</h2>
            {store.canManage && (
              <button
                className="link-btn"
                onClick={() => setReport((current) => current ? ({ ...current, items: [...current.items, { id: crypto.randomUUID(), client_name: '', object_name: '', concrete_grade: '', volume_m3: 0, price: 0 }] }) : current)}
              >
                <Plus size={16} /> Добавить строку
              </button>
            )}
          </div>
          <table className="crm-table editable">
            <thead><tr><th>Клиент</th><th>Объект</th><th>Марка</th><th>м³</th><th>Цена</th><th>Сумма</th></tr></thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.id}>
                  <td><input value={item.client_name} onChange={(e) => updateItem(item.id, 'client_name', e.target.value)} placeholder="Имя клиента" /></td>
                  <td><input value={item.object_name} onChange={(e) => updateItem(item.id, 'object_name', e.target.value)} placeholder="Адрес" /></td>
                  <td><input value={item.concrete_grade} onChange={(e) => updateItem(item.id, 'concrete_grade', e.target.value)} placeholder="Марка" /></td>
                  <td><NumberInput value={item.volume_m3} onChange={(value) => updateItem(item.id, 'volume_m3', value)} min={0} /></td>
                  <td><NumberInput value={item.price} onChange={(value) => updateItem(item.id, 'price', value)} min={0} /></td>
                  <td>{money(item.volume_m3 * item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">Всего объем: <strong>{numberRu(totals.volume, 1)} м³</strong> <span>Сумма: {money(totals.income)}</span></div>
        </Card>
        <aside className="side-stack">
          <Card>
            <h2>Расходы (Материалы)</h2>
            <div className="form-grid two-cols">
              <Field label="Цемент (т)" value={report.cement_t} onChange={(v) => setReport({ ...report, cement_t: Number(v) })} type="number" />
              <Field label="Щебень (т)" value={report.gravel_t} onChange={(v) => setReport({ ...report, gravel_t: Number(v) })} type="number" />
              <Field label="Песок (т)" value={report.sand_t} onChange={(v) => setReport({ ...report, sand_t: Number(v) })} type="number" />
              <Field label="Добавки (л)" value={report.additives_l} onChange={(v) => setReport({ ...report, additives_l: Number(v) })} type="number" />
              <Field label="Топливо (сомони)" value={report.fuel_expense} onChange={(v) => setReport({ ...report, fuel_expense: Number(v) })} type="number" />
              <Field label="Зарплата (сомони)" value={report.salary_expense} onChange={(v) => setReport({ ...report, salary_expense: Number(v) })} type="number" />
            </div>
          </Card>
          <Card className="summary-card">
            <h2>Сводка</h2>
            <SummaryLine label="Итого (Доход)" value={money(totals.income)} />
            <SummaryLine label="Расходы (Общие)" value={money(totals.expenses)} tone="red" />
            <SummaryLine label="Прибыль" value={money(totals.profit)} tone="green" />
            <SummaryLine label="Рентабельность" value={`${numberRu(totals.profitability, 1)}%`} />
          </Card>
        </aside>
      </div>
      <div className="bottom-bar">
        <ExportButtons title="Ежедневный отчет" rows={rows} filename="daily-report" />
        <button className="secondary" onClick={() => exportReportPdf('Ежедневный отчет', dailySections, 'daily-report', { subtitle: new Date(report.date).toLocaleDateString('ru-RU') })}><FileText size={18} /> PDF</button>
        <button className="secondary" onClick={() => printReport('Ежедневный отчет', dailySections, { subtitle: new Date(report.date).toLocaleDateString('ru-RU') })}><Printer size={18} /> Печать</button>
        {store.canManage && <AdminActionButton className="secondary" action={(reason) => store.api.adminDelete('daily_reports', report.id, report.date, 'delete', reason)}><Trash2 size={18} /> Удалить</AdminActionButton>}
        {store.canManage && <button className="primary" onClick={() => store.api.saveDaily(report)}>Сохранить</button>}
      </div>
    </>
  )
}

function Invoices({ store }: { store: Store }) {
  const [open, setOpen] = useState(false)
  const rows = store.data.invoices.filter((invoice) => invoice.status !== 'annulled').map((invoice) => {
    const client = store.data.clients.find((item) => item.id === invoice.client_id)
    return { ...invoice, clientName: client?.name ?? 'Клиент' }
  })

  return (
    <>
      <PageHeader title="Счета" subtitle="Создание, печать и контроль оплаты счетов." action={store.canManage ? <button className="primary" onClick={() => setOpen(true)}><Plus size={18} /> Создать счёт</button> : undefined} />
      <Card>
        <table className="crm-table">
          <thead><tr><th>№ счета</th><th>Клиент</th><th>Дата</th><th>Срок</th><th>Сумма</th><th>Статус</th><th>Действия</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.number}</td>
                <td>{row.clientName}</td>
                <td>{new Date(row.date).toLocaleDateString('ru-RU')}</td>
                <td>{new Date(row.due_date).toLocaleDateString('ru-RU')}</td>
                <td>{money(row.amount)}</td>
                <td><span className={statusClass[row.status]}>{statusLabel[row.status]}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="secondary" onClick={() => printReport(`Счёт ${row.number}`, [{ title: 'Информация счета', items: [{ label: 'Клиент', value: row.clientName }, { label: 'Дата', value: row.date }, { label: 'Срок', value: row.due_date }, { label: 'Сумма', value: money(row.amount) }, { label: 'Статус', value: statusLabel[row.status] }] }], { client: row.clientName })}><Printer size={16} /> Печать</button>
                    <button className="secondary" onClick={() => exportReportPdf(`Счёт ${row.number}`, [{ title: 'Информация счета', items: [{ label: 'Клиент', value: row.clientName }, { label: 'Дата', value: row.date }, { label: 'Срок', value: row.due_date }, { label: 'Сумма', value: money(row.amount) }, { label: 'Статус', value: statusLabel[row.status] }] }], row.number, { client: row.clientName })}><Download size={16} /> PDF</button>
                    {store.canManage && row.status === 'unpaid' && <button className="primary" onClick={() => store.api.markInvoicePaid(row.id)}>Оплатить</button>}
                    {store.canManage && <AdminActionButton className="icon-btn" action={(reason) => store.api.adminDelete('invoices', row.id, row.number, 'delete', reason)}><Trash2 size={16} /></AdminActionButton>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open && store.canManage && <InvoiceModal store={store} onClose={() => setOpen(false)} />}
    </>
  )
}

function Lab({ store }: { store: Store }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<LabReport | null>(null)
  const totals = {
    all: store.data.lab_reports.filter((item) => !item.annulled).length,
    passed: store.data.lab_reports.filter((item) => item.status === 'passed' && !item.annulled).length,
    failed: store.data.lab_reports.filter((item) => item.status === 'failed' && !item.annulled).length,
    pending: store.data.lab_reports.filter((item) => item.status === 'pending' && !item.annulled).length,
  }
  const labRows = store.data.lab_reports.filter((item) => !item.annulled)
  const exportRows = labRows.map((row) => ({ Марка: row.concrete_grade, Объект: row.object_name, Прочность: row.strength_mpa, Статус: labStatusLabel[row.status] }))
  return (
    <>
      <PageHeader
        title="Лаборатория"
        subtitle="Контроль качества бетона, образцы, протоколы и результаты испытаний."
        action={<div className="toolbar compact"><ExportButtons title="Лаборатория" rows={exportRows} filename="lab-reports" />{store.canManage && <button className="primary" onClick={() => setOpen(true)}><Plus size={18} /> Добавить тест</button>}</div>}
      />
      <div className="kpi-grid four">
        <Kpi title="Всего тестов" value={numberRu(totals.all)} />
        <Kpi title="Пройдено" value={numberRu(totals.passed)} tone="green" />
        <Kpi title="Не пройдено" value={numberRu(totals.failed)} tone="red" />
        <Kpi title="В ожидании" value={numberRu(totals.pending)} tone="amber" />
      </div>
      <div className="toolbar">
        <button className="secondary"><Calendar size={18} /> Все даты</button>
        <button className="secondary"><Users size={18} /> Все клиенты</button>
        <button className="secondary">Все марки <ChevronDown size={16} /></button>
        <button className="secondary">Все статусы <ChevronDown size={16} /></button>
      </div>
      <Card>
        <table className="crm-table">
          <thead><tr><th>Дата образца</th><th>Дата теста</th><th>Клиент</th><th>Объект</th><th>Марка</th><th>Осадка</th><th>Прочность MPa</th><th>Статус</th><th>Действия</th></tr></thead>
          <tbody>
            {labRows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.sample_date).toLocaleDateString('ru-RU')}</td>
                <td>{new Date(row.test_date).toLocaleDateString('ru-RU')}</td>
                <td>{store.data.clients.find((client) => client.id === row.client_id)?.name ?? 'Не указан'}</td>
                <td>{row.object_name}</td>
                <td>{row.concrete_grade}</td>
                <td>{row.slump}</td>
                <td>{row.strength_mpa}</td>
                <td><span className={labStatusClass[row.status]}>{labStatusLabel[row.status]}</span></td>
                <td>
                  <button className="secondary" onClick={() => setDetail(row)}>Детали</button>
                  {store.canManage && <AdminActionButton className="icon-btn" action={(reason) => store.api.adminDelete('lab_reports', row.id, row.object_name, 'delete', reason)}><Trash2 size={16} /></AdminActionButton>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open && store.canManage && <LabModal store={store} onClose={() => setOpen(false)} />}
      {detail && <LabDetailModal report={detail} store={store} onClose={() => setDetail(null)} />}
    </>
  )
}

function Excavation({ store }: { store: Store }) {
  const [modalReport, setModalReport] = useState<ExcavationReport | null>(null)
  const reports = store.data.excavation_reports.filter((item) => !item.archived && !item.annulled)
  const totals = aggregateExcavation(reports)
  const exportRows = reports.map((report) => {
    const computed = excavationTotals(report)
    return { Дата: report.date, Объект: report.object_name, Клиент: report.client_name, Кубы: report.excavation_m3, Рейсы: report.trip_count, Доход: computed.totalIncome, Расход: computed.totalExpenses, Прибыль: computed.profit, Долг: computed.debt }
  })

  return (
    <>
      <PageHeader
        title="Котлован"
        subtitle="Учет котлованов, рейсов, кубов, расходов и прибыли"
        action={<ExportButtons title="Котлован" rows={exportRows} filename="excavation-reports" />}
      />
      <div className="kpi-grid excavation-kpis">
        <Kpi title="Общий доход" value={money(totals.totalIncome)} />
        <Kpi title="Общие расходы" value={money(totals.totalExpenses)} tone="red" />
        <Kpi title="Чистая прибыль" value={money(totals.netProfit)} tone="green" />
        <Kpi title="Всего кубов" value={`${numberRu(totals.totalExcavation)} м³`} tone="amber" />
        <Kpi title="Обратная засыпка" value={`${numberRu(totals.totalBackfill)} м³`} />
        <Kpi title="Рейсов" value={numberRu(totals.totalTrips)} />
        <Kpi title="Солярка" value={money(totals.totalDieselCost)} tone="red" />
        <Kpi title="Зарплата" value={money(totals.totalSalaries)} tone="amber" />
        <Kpi title="Долг" value={money(totals.totalDebt)} tone="red" />
      </div>
      <div className="toolbar">
        <button className="secondary"><Calendar size={18} /> Последние 30 дней</button>
        <button className="secondary">Все заказчики</button>
        <button className="secondary">Все объекты <ChevronDown size={16} /></button>
        <button className="secondary">Все статусы</button>
        {store.canManage && <button className="primary" onClick={() => setModalReport(emptyExcavation())}><Plus size={18} /> Новый отчет</button>}
      </div>
      <div className="grid three">
        <ChartCard title="Доходы по дням" type="bar" dataKey="income" />
        <DonutCard title="Расходы по категориям" data={[{ name: 'Зарплата', value: 60 }, { name: 'Топливо', value: 25 }, { name: 'ТО', value: 15 }]} />
        <Card>
          <h2>Кубы по объектам</h2>
          {reports.map((report) => (
            <div className="progress-row" key={report.id}>
              <span>{report.object_name}</span><strong>{numberRu(report.excavation_m3)} м³</strong>
              <div><i style={{ width: `${Math.min(100, report.excavation_m3 / 6)}%` }} /></div>
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <div className="card-title"><h2>Последние операции</h2><button className="link-btn">Смотреть все</button></div>
        <table className="crm-table">
          <thead><tr><th>Дата</th><th>Объект / котлован</th><th>Заказчик</th><th>Тип работы</th><th>Кубы</th><th>Рейсы</th><th>Техника</th><th>Прибыль</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {reports.map((report) => {
              const computed = excavationTotals(report)
              return (
                <tr key={report.id}>
                  <td>{new Date(report.date).toLocaleDateString('ru-RU')}</td>
                  <td><Link to={`/excavation/${report.id}`}>{report.object_name}</Link></td>
                  <td>{report.client_name}</td>
                  <td><span className="pill blue">{report.work_type}</span></td>
                  <td>{numberRu(report.excavation_m3)}</td>
                  <td>{report.trip_count}</td>
                  <td>{report.machinery}</td>
                  <td className="green-text">{money(computed.profit)}</td>
                  <td><span className={statusClass[report.status]}>{statusLabel[report.status]}</span></td>
                  <td>
                    {store.canManage && <button className="icon-btn" onClick={() => setModalReport(report)}><Edit3 size={16} /></button>}
                    {store.canManage && <AdminActionButton className="icon-btn" action={(reason) => store.api.adminDelete('excavation_reports', report.id, report.object_name, 'delete', reason)}><Trash2 size={16} /></AdminActionButton>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      {modalReport && store.canManage && <ExcavationModal report={modalReport} onClose={() => setModalReport(null)} onSave={store.api.saveExcavation} />}
    </>
  )
}

function ExcavationDetail({ store }: { store: Store }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const report = store.data.excavation_reports.find((item) => item.id === id)
  if (!report) return <EmptyState title="Отчет не найден" />
  const totals = excavationTotals(report)
  const excavationSections: ReportSection[] = [
    { title: 'Клиент и объект', items: [{ label: 'Заказчик', value: report.client_name }, { label: 'Телефон', value: report.client_phone }, { label: 'Адрес', value: report.location }, { label: 'Тип работ', value: report.work_type }] },
    { title: 'Работы', items: [{ label: 'Выемка', value: `${numberRu(report.excavation_m3)} м³` }, { label: 'Засыпка', value: `${numberRu(report.backfill_m3)} м³` }, { label: 'Рейсы', value: report.trip_count }, { label: 'Техника', value: report.machinery }] },
    { title: 'Финансы', items: [{ label: 'Доход', value: money(totals.totalIncome) }, { label: 'Расход', value: money(totals.totalExpenses) }, { label: 'Прибыль', value: money(totals.profit) }, { label: 'Долг', value: money(Math.max(totals.debt, 0)) }] },
  ]

  return (
    <>
      <div className="detail-head">
        <button className="secondary icon-only" onClick={() => navigate('/excavation')}>←</button>
        <div>
          <h1>Детали отчета: {report.object_name}</h1>
          <p><span className={statusClass[report.status]}>{statusLabel[report.status]}</span> ID: {report.id} • Недавно обновлено</p>
        </div>
        <button className="secondary" onClick={() => printReport('Отчет по котловану', excavationSections, { client: report.client_name })}><Printer size={18} /> Печать</button>
        <button className="primary" onClick={() => exportReportPdf('Отчет по котловану', excavationSections, 'excavation-detail', { client: report.client_name })}><Download size={18} /> Экспорт данных</button>
      </div>
      <div className="grid three">
        <Card><h2>Клиент и локация</h2><Info label="Заказчик" value={report.client_name} /><Info label="Телефон" value={report.client_phone} /><Info label="Адрес объекта" value={report.location} /></Card>
        <Card><h2>Сводка работ</h2><Info label="Объем выемки" value={`${numberRu(report.excavation_m3)} м³`} /><Info label="Рейсы" value={String(report.trip_count)} /><Info label="Тип работ" value={report.work_type} /></Card>
        <Card><h2>Финансы</h2><Info label="Валовый доход" value={money(totals.totalIncome)} /><Info label="Расходы" value={money(totals.totalExpenses)} tone="red" /><Info label="Чистая прибыль" value={money(totals.profit)} tone="blue" /><Info label="Остаток долга" value={money(Math.max(totals.debt, 0))} tone="amber" /></Card>
      </div>
      <div className="grid two wide-left">
        <Card>
          <h2>Расшифровка расходов</h2>
          <table className="crm-table compact-table">
            <tbody>
              <tr><td>Логистика</td><td>Топливо и рейсы</td><td>{money(totals.dieselCost)}</td></tr>
              <tr><td>Рабочие</td><td>{report.workers}</td><td>{money(report.worker_salary)}</td></tr>
              <tr><td>Техника</td><td>{report.machinery}</td><td>{money(report.machinery_rent)}</td></tr>
              <tr><td>Прочее</td><td>{report.comment}</td><td>{money(report.other_expenses)}</td></tr>
            </tbody>
          </table>
        </Card>
        <DonutCard title="Распределение прибыли" data={[{ name: 'Прибыль', value: totals.profit }, { name: 'Расходы', value: totals.totalExpenses }]} />
      </div>
    </>
  )
}

function SettingsPage({ store }: { store: Store }) {
  return (
    <>
      <PageHeader title="Настройки" subtitle="Компания, валюта, пользователи и роли." />
      <div className="grid two">
        <Card>
          <h2>Компания</h2>
          <Field label="Название компании" value="Concrete Supply CRM" onChange={() => undefined} />
          <Field label="Валюта" value="TJS / сомони" onChange={() => undefined} />
          <Field label="Логотип" value="ConcreteCore" onChange={() => undefined} />
        </Card>
        <Card>
          <h2>Пользователь</h2>
          <Info label="Имя" value={store.data.profile.full_name} />
          <Info label="Email" value={store.data.profile.email} />
          <Info label="Роль" value={store.data.profile.role === 'admin' ? 'Администратор' : 'Просмотр'} />
          {store.canManage && <AdminActionButton className="secondary" action={(reason) => store.api.clearTestData(reason || 'Очистка тестовых данных')}>
            <Trash2 size={18} /> Очистить тестовые данные
          </AdminActionButton>}
        </Card>
      </div>
      <Card>
        <h2>Роли доступа</h2>
        <div className="role-grid">
          {['Администратор', 'Менеджер', 'Бухгалтер', 'Оператор'].map((role) => <span className={`role-card ${role === 'Администратор' ? 'active-role' : 'inactive-role'}`} key={role}><Shield size={18} /> {role}<small>{role === 'Администратор' ? 'Активен' : 'Зарезервировано'}</small></span>)}
        </div>
      </Card>
    </>
  )
}

function ChartCard({ title, type, dataKey, color = '#2563eb' }: { title: string; type: 'bar' | 'line' | 'area'; dataKey: string; color?: string }) {
  return (
    <Card className="chart-card">
      <h2>{title}</h2>
      <ResponsiveContainer width="100%" height={260}>
        {type === 'bar' ? (
          <BarChart data={chartRows}><CartesianGrid stroke="#edf1f8" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} /></BarChart>
        ) : type === 'line' ? (
          <LineChart data={chartRows}><XAxis dataKey="name" /><Tooltip /><Line dataKey={dataKey} stroke={color} strokeWidth={5} dot={false} /></LineChart>
        ) : (
          <AreaChart data={chartRows}><XAxis dataKey="name" /><Tooltip /><Area dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={5} /></AreaChart>
        )}
      </ResponsiveContainer>
    </Card>
  )
}

function DonutCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const colors = ['#0f55d9', '#c51414', '#f59e0b', '#7c3aed']
  return (
    <Card className="donut-card">
      <h2>{title}</h2>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={70} outerRadius={105} paddingAngle={1}>
            {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      {data.map((row, index) => <div className="legend-row" key={row.name}><i style={{ background: colors[index % colors.length] }} />{row.name}<strong>{numberRu(row.value)}%</strong></div>)}
    </Card>
  )
}

function RecentActivity({ store }: { store: Store }) {
  return (
    <Card>
      <h2>Последняя активность</h2>
      <div className="activity-list">
        {store.data.activity_logs.map((item) => (
          <div key={item.id}>
            <span>{item.module}</span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ClientModal({ client, onClose, onSave, onUpdate }: { client?: Client; onClose: () => void; onSave: (client: Omit<Client, 'id' | 'updated_at'>) => Promise<void>; onUpdate?: (client: Client) => Promise<void> }) {
  const [form, setForm] = useState(client ?? { name: '', login: '', phone: '+992 ', password: '', contract_type: '100% cash / Без бартера', contract_total: 0, cash_percent: 100, barter_percent: 0, balance: 0, cash_available: 0, total_supplied_m3: 0, total_paid: 0, total_barter_value: 0, status: 'active' as Status, updated_at: '' })
  const [error, setError] = useState('')
  const changeContract = (value: string) => {
    const option = contractOptions.find((item) => item.value === value)
    setForm({ ...form, contract_type: value, cash_percent: option?.cash ?? form.cash_percent, barter_percent: option?.barter ?? form.barter_percent })
  }
  const setPercent = (key: 'cash_percent' | 'barter_percent', value: string) => {
    const next = Math.min(100, Math.max(0, Number(value || 0)))
    setForm({ ...form, [key]: next })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.cash_percent < 0 || form.barter_percent < 0 || form.cash_percent > 100 || form.barter_percent > 100) {
      setError('Проценты не могут быть меньше 0 или больше 100.')
      return
    }
    if (Number(form.cash_percent) + Number(form.barter_percent) !== 100) {
      setError('Сумма процентов наличных и бартера должна быть ровно 100%.')
      return
    }
    if (client && onUpdate) await onUpdate(form as Client)
    else await onSave(form)
    onClose()
  }
  return (
    <Modal title={client ? 'Редактировать клиента' : 'Создать клиента'} onClose={onClose} onSubmit={submit}>
      <h3>Основная информация</h3>
      <div className="form-grid two-cols">
        <Field label="Название клиента" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Введите название" />
        <Field label="Телефон" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Логин" value={form.login} onChange={(v) => setForm({ ...form, login: v })} placeholder="Уникальный логин" />
        <Field label="Пароль" value={form.password ?? ''} onChange={(v) => setForm({ ...form, password: v })} type="password" />
      </div>
      <h3>Детали контракта</h3>
      <SelectField label="Тип договора" value={form.contract_type} onChange={changeContract} options={contractOptions.map(({ value, label }) => ({ value, label }))} />
      <div className="soft-panel">
        <div className="form-grid two-cols">
          <Field label="Общая сумма договора" value={form.contract_total ?? 0} onChange={(v) => setForm({ ...form, contract_total: Number(v || 0) })} type="number" min={0} />
          <Field label="Первичная оплата наличкой" value={form.total_paid ?? 0} onChange={(v) => setForm({ ...form, total_paid: Number(v || 0), cash_available: Number(v || 0) })} type="number" min={0} />
          <Field label="Наличная часть %" value={form.cash_percent} onChange={(v) => setPercent('cash_percent', v)} type="number" min={0} max={100} />
          <Field label="Бартерная часть %" value={form.barter_percent} onChange={(v) => setPercent('barter_percent', v)} type="number" min={0} max={100} />
          <Field label="Баланс / долг (сомони)" value={form.balance} onChange={(v) => setForm({ ...form, balance: Number(v || 0) })} type="number" />
          <SelectField label="Статус" value={form.status} onChange={(v) => setForm({ ...form, status: v as Status })} options={[{ value: 'active', label: 'Активен' }, { value: 'pending', label: 'Ожидание' }, { value: 'debt', label: 'Долг' }]} />
        </div>
        <p className={form.cash_percent + form.barter_percent === 100 ? 'green-text' : 'error-text'}>
          Итого: {form.cash_percent + form.barter_percent}% · Наличные {form.cash_percent}% / Бартер {form.barter_percent}%
        </p>
        <p className="muted-text">Бартерные активы добавляются в карточке клиента после сохранения.</p>
        {error && <p className="error-text">{error}</p>}
      </div>
    </Modal>
  )
}

function BarterAssetModal({ client, store, onClose }: { client: Client; store: Store; onClose: () => void }) {
  const [form, setForm] = useState({
    client_id: client.id,
    type: 'car' as BarterAssetType,
    asset_name: '',
    market_value: 0,
    cost_price: 0,
    photos: [] as string[],
    comment: '',
    apartment_number: '',
    building: '',
    block: '',
    floor: '',
    area_m2: 0,
    rooms: 0,
    address: '',
    car_make: '',
    car_model: '',
    car_year: '',
    license_plate: '',
    vin: '',
    mileage: '',
    color: '',
    condition: '',
    land_area: '',
    land_purpose: '',
    cadastral_number: '',
    equipment_name: '',
    equipment_model: '',
    equipment_year: '',
  })
  const [error, setError] = useState('')
  const set = (key: keyof typeof form, value: string | number | string[]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.type || form.market_value <= 0) {
      setError('Тип актива и рыночная стоимость обязательны.')
      return
    }
    const assetName = form.asset_name || buildAssetName(form)
    await store.api.addBarterAsset({ ...form, asset_name: assetName })
    onClose()
  }

  return (
    <Modal title="Бартерный актив" subtitle="Добавьте квартиру, машину, участок, спецтехнику или другое имущество." onClose={onClose} onSubmit={submit}>
      <div className="form-grid three-cols">
        <SelectField label="Тип актива" value={form.type} onChange={(v) => set('type', v as BarterAssetType)} options={Object.entries(barterAssetTypeLabels).map(([value, label]) => ({ value, label }))} />
        <Field label="Название актива" value={form.asset_name} onChange={(v) => set('asset_name', v)} placeholder="Например Toyota Camry 2020" />
        <Field label="Рыночная стоимость (TJS)" value={form.market_value} onChange={(v) => set('market_value', Number(v))} type="number" />
        <Field label="Себестоимость (TJS)" value={form.cost_price} onChange={(v) => set('cost_price', Number(v))} type="number" />
        <Field label="Остаток стоимости" value={form.market_value} onChange={() => undefined} type="number" />
        <Field label="Статус" value="Активный" onChange={() => undefined} />
        <Field label="Комментарий" value={form.comment} onChange={(v) => set('comment', v)} />
      </div>

      {form.type === 'apartment' && (
        <>
          <h3>Данные квартиры</h3>
          <div className="form-grid three-cols">
            <Field label="Номер квартиры" value={form.apartment_number} onChange={(v) => set('apartment_number', v)} />
            <Field label="Объект / ЖК / здание" value={form.building} onChange={(v) => set('building', v)} />
            <Field label="Блок / подъезд" value={form.block} onChange={(v) => set('block', v)} />
            <Field label="Этаж" value={form.floor} onChange={(v) => set('floor', v)} />
            <Field label="Площадь м²" value={form.area_m2} onChange={(v) => set('area_m2', Number(v))} type="number" />
            <Field label="Количество комнат" value={form.rooms} onChange={(v) => set('rooms', Number(v))} type="number" />
            <Field label="Адрес" value={form.address} onChange={(v) => set('address', v)} />
          </div>
        </>
      )}

      {form.type === 'car' && (
        <>
          <h3>Данные машины</h3>
          <div className="form-grid three-cols">
            <Field label="Марка" value={form.car_make} onChange={(v) => set('car_make', v)} />
            <Field label="Модель" value={form.car_model} onChange={(v) => set('car_model', v)} />
            <Field label="Год выпуска" value={form.car_year} onChange={(v) => set('car_year', v)} />
            <Field label="Госномер" value={form.license_plate} onChange={(v) => set('license_plate', v)} />
            <Field label="VIN" value={form.vin} onChange={(v) => set('vin', v)} />
            <Field label="Пробег" value={form.mileage} onChange={(v) => set('mileage', v)} />
            <Field label="Цвет" value={form.color} onChange={(v) => set('color', v)} />
            <Field label="Состояние" value={form.condition} onChange={(v) => set('condition', v)} />
          </div>
        </>
      )}

      {form.type === 'land' && (
        <>
          <h3>Данные участка</h3>
          <div className="form-grid three-cols">
            <Field label="Адрес / локация" value={form.address} onChange={(v) => set('address', v)} />
            <Field label="Площадь участка" value={form.land_area} onChange={(v) => set('land_area', v)} />
            <Field label="Назначение" value={form.land_purpose} onChange={(v) => set('land_purpose', v)} />
            <Field label="Кадастровый номер" value={form.cadastral_number} onChange={(v) => set('cadastral_number', v)} />
          </div>
        </>
      )}

      {form.type === 'equipment' && (
        <>
          <h3>Данные спецтехники</h3>
          <div className="form-grid three-cols">
            <Field label="Название техники" value={form.equipment_name} onChange={(v) => set('equipment_name', v)} />
            <Field label="Марка / модель" value={form.equipment_model} onChange={(v) => set('equipment_model', v)} />
            <Field label="Год" value={form.equipment_year} onChange={(v) => set('equipment_year', v)} />
            <Field label="Состояние" value={form.condition} onChange={(v) => set('condition', v)} />
          </div>
        </>
      )}

      <label className="field file-field">
        <span>Фото / документы</span>
        <input type="file" multiple accept="image/*" onChange={(event) => void readPhotoFiles(event.currentTarget.files, (photos) => set('photos', [...form.photos, ...photos]))} />
        <small>TODO: при подключении Supabase Storage загружать файлы в bucket, сейчас сохраняются локальные preview.</small>
      </label>
      {form.photos.length > 0 && <div className="asset-photo-grid">{form.photos.map((photo, index) => <img src={photo} alt={`Фото ${index + 1}`} key={photo.slice(0, 40) + index} />)}</div>}
      {error && <p className="error-text">{error}</p>}
    </Modal>
  )
}

const buildAssetName = (form: { type: BarterAssetType; car_make?: string; car_model?: string; car_year?: string; building?: string; apartment_number?: string; address?: string; equipment_name?: string }) => {
  if (form.type === 'car') return [form.car_make, form.car_model, form.car_year].filter(Boolean).join(' ') || 'Машина'
  if (form.type === 'apartment') return [form.building, form.apartment_number && `кв. ${form.apartment_number}`].filter(Boolean).join(', ') || 'Квартира'
  if (form.type === 'land') return form.address || 'Земельный участок'
  if (form.type === 'equipment') return form.equipment_name || 'Спецтехника'
  return 'Другое имущество'
}

const readPhotoFiles = async (files: FileList | null, onDone: (photos: string[]) => void) => {
  if (!files?.length) return
  const photos = await Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result ?? ''))
          reader.readAsDataURL(file)
        }),
    ),
  )
  onDone(photos.filter(Boolean))
}

function ConcreteDeliveryModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const firstClient = store.data.clients.find((client) => !client.archived)
  const [form, setForm] = useState({
    client_id: firstClient?.id ?? '',
    date: new Date().toISOString().slice(0, 10),
    object_name: '',
    concrete_grade: 'M300',
    volume_m3: 0,
    price_per_m3: 0,
    trip_count: 0,
    transport_cost: 0,
    comment: '',
  })
  const client = store.data.clients.find((item) => item.id === form.client_id)
  const amount = form.volume_m3 * form.price_per_m3 + form.transport_cost
  const barter = client ? Math.round((amount * client.barter_percent) / 100) : 0
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.client_id || !form.object_name || form.volume_m3 <= 0 || form.price_per_m3 <= 0) {
      store.notify('Заполните клиента, объект, кубы и цену')
      return
    }
    await store.api.addConcreteDelivery(form)
    onClose()
  }

  return (
    <Modal title="Новая накладная бетона" subtitle="Выберите клиента и зафиксируйте поставку бетона." onClose={onClose} onSubmit={submit}>
      <div className="form-grid three-cols">
        <SelectField label="Клиент" value={form.client_id} onChange={(v) => setForm({ ...form, client_id: v })} options={store.data.clients.filter((item) => !item.archived).map((item) => ({ value: item.id, label: item.name }))} />
        <Field label="Дата" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
        <Field label="Объект / проект" value={form.object_name} onChange={(v) => setForm({ ...form, object_name: v })} />
        <SelectField label="Марка бетона" value={form.concrete_grade} onChange={(v) => setForm({ ...form, concrete_grade: v })} options={concreteGrades.map((grade) => ({ value: grade, label: grade }))} />
        <Field label="Кубометры" value={form.volume_m3} onChange={(v) => setForm({ ...form, volume_m3: Number(v) })} type="number" />
        <Field label="Цена за м³ (сомони)" value={form.price_per_m3} onChange={(v) => setForm({ ...form, price_per_m3: Number(v) })} type="number" />
        <Field label="Количество рейсов" value={form.trip_count} onChange={(v) => setForm({ ...form, trip_count: Number(v) })} type="number" />
        <Field label="Транспорт (сомони)" value={form.transport_cost} onChange={(v) => setForm({ ...form, transport_cost: Number(v) })} type="number" />
        <Field label="Комментарий" value={form.comment} onChange={(v) => setForm({ ...form, comment: v })} />
      </div>
      <div className="calc-strip">
        <SummaryLine label="Сумма бетона" value={money(form.volume_m3 * form.price_per_m3)} />
        <SummaryLine label="Итого накладная" value={money(amount)} />
        <SummaryLine label="Денежная часть" value={money(amount - barter)} tone="blue" />
        <SummaryLine label="Бартерная часть" value={money(barter)} tone="amber" />
      </div>
    </Modal>
  )
}

function InvoiceModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const firstClient = store.data.clients[0]
  const [clientId, setClientId] = useState(firstClient?.id ?? '')
  const [selected, setSelected] = useState<string[]>([])
  const deliveries = store.data.client_reports.filter((report) => report.client_id === clientId && !report.annulled)
  const total = deliveries.filter((report) => selected.includes(report.id)).reduce((sum, report) => sum + report.amount, 0)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!clientId || selected.length === 0) {
      store.notify('Выберите клиента и накладные')
      return
    }
    const invoice: Omit<Invoice, 'id'> = {
      number: `INV-${new Date().getFullYear()}-${String(store.data.invoices.length + 1).padStart(3, '0')}`,
      client_id: clientId,
      delivery_ids: selected,
      date: new Date().toISOString().slice(0, 10),
      due_date: addDaysIso(14),
      amount: total,
      status: 'unpaid',
    }
    await store.api.addInvoice(invoice)
    onClose()
  }

  return (
    <Modal title="Создать счёт" subtitle="Выберите клиента и накладные для автоматического расчета суммы." onClose={onClose} onSubmit={submit}>
      <SelectField label="Клиент" value={clientId} onChange={(v) => { setClientId(v); setSelected([]) }} options={store.data.clients.map((client) => ({ value: client.id, label: client.name }))} />
      <div className="modal-list">
        {deliveries.map((delivery) => (
          <label key={delivery.id} className="check-row">
            <input type="checkbox" checked={selected.includes(delivery.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, delivery.id] : current.filter((id) => id !== delivery.id))} />
            <span>{delivery.object_name} • {delivery.concrete_grade} • {delivery.volume_m3} м³</span>
            <strong>{money(delivery.amount)}</strong>
          </label>
        ))}
      </div>
      <div className="calc-strip">
        <SummaryLine label="Итого к оплате" value={money(total)} tone="blue" />
      </div>
    </Modal>
  )
}

function LabModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const firstClient = store.data.clients[0]
  const [form, setForm] = useState<Omit<LabReport, 'id' | 'date'>>({
    client_id: firstClient?.id ?? '',
    delivery_id: '',
    sample_date: new Date().toISOString().slice(0, 10),
    test_date: new Date().toISOString().slice(0, 10),
    concrete_grade: 'M300',
    object_name: '',
    slump: 'П3',
    strength_mpa: 0,
    temperature: 20,
    cement_amount: 0,
    sand_amount: 0,
    gravel_amount: 0,
    water_amount: 0,
    notes: '',
    status: 'pending',
  })
  const deliveries = store.data.client_reports.filter((report) => report.client_id === form.client_id && !report.annulled)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await store.api.addLabReport({ ...form, date: form.test_date })
    onClose()
  }
  const selectDelivery = (deliveryId: string) => {
    const delivery = store.data.client_reports.find((item) => item.id === deliveryId)
    setForm({ ...form, delivery_id: deliveryId, object_name: delivery?.object_name ?? form.object_name, concrete_grade: delivery?.concrete_grade ?? form.concrete_grade })
  }

  return (
    <Modal title="Добавить лабораторный тест" onClose={onClose} onSubmit={submit}>
      <div className="form-grid three-cols">
        <SelectField label="Клиент" value={form.client_id ?? ''} onChange={(v) => setForm({ ...form, client_id: v, delivery_id: '' })} options={store.data.clients.map((client) => ({ value: client.id, label: client.name }))} />
        <SelectField label="Накладная бетона" value={form.delivery_id ?? ''} onChange={selectDelivery} options={[{ value: '', label: 'Без привязки' }, ...deliveries.map((delivery) => ({ value: delivery.id, label: `${delivery.object_name} • ${delivery.concrete_grade}` }))]} />
        <SelectField label="Марка бетона" value={form.concrete_grade} onChange={(v) => setForm({ ...form, concrete_grade: v })} options={concreteGrades.map((grade) => ({ value: grade, label: grade }))} />
        <Field label="Дата образца" value={form.sample_date} onChange={(v) => setForm({ ...form, sample_date: v })} type="date" />
        <Field label="Дата теста" value={form.test_date} onChange={(v) => setForm({ ...form, test_date: v })} type="date" />
        <Field label="Объект" value={form.object_name} onChange={(v) => setForm({ ...form, object_name: v })} />
        <Field label="Осадка конуса" value={form.slump} onChange={(v) => setForm({ ...form, slump: v })} />
        <Field label="Прочность куба MPa" value={form.strength_mpa} onChange={(v) => setForm({ ...form, strength_mpa: Number(v) })} type="number" />
        <Field label="Температура" value={form.temperature ?? 0} onChange={(v) => setForm({ ...form, temperature: Number(v) })} type="number" />
        <Field label="Цемент" value={form.cement_amount ?? 0} onChange={(v) => setForm({ ...form, cement_amount: Number(v) })} type="number" />
        <Field label="Песок" value={form.sand_amount ?? 0} onChange={(v) => setForm({ ...form, sand_amount: Number(v) })} type="number" />
        <Field label="Щебень" value={form.gravel_amount ?? 0} onChange={(v) => setForm({ ...form, gravel_amount: Number(v) })} type="number" />
        <Field label="Вода" value={form.water_amount ?? 0} onChange={(v) => setForm({ ...form, water_amount: Number(v) })} type="number" />
        <SelectField label="Статус" value={form.status} onChange={(v) => setForm({ ...form, status: v as LabReport['status'] })} options={[{ value: 'pending', label: 'В ожидании' }, { value: 'passed', label: 'Пройдено' }, { value: 'failed', label: 'Не пройдено' }]} />
        <Field label="Примечания" value={form.notes ?? ''} onChange={(v) => setForm({ ...form, notes: v })} />
      </div>
    </Modal>
  )
}

function LabDetailModal({ report, store, onClose }: { report: LabReport; store: Store; onClose: () => void }) {
  const client = store.data.clients.find((item) => item.id === report.client_id)
  const sections: ReportSection[] = [
    {
      title: 'Сертификат испытания бетона',
      items: [
        { label: 'Клиент', value: client?.name ?? 'Не указан' },
        { label: 'Объект', value: report.object_name },
        { label: 'Марка', value: report.concrete_grade },
        { label: 'Дата образца', value: report.sample_date },
        { label: 'Дата теста', value: report.test_date },
        { label: 'Осадка конуса', value: report.slump },
        { label: 'Прочность', value: `${report.strength_mpa} MPa` },
        { label: 'Статус', value: labStatusLabel[report.status] },
      ],
    },
  ]
  return (
    <Modal title="Протокол лаборатории" onClose={onClose} onSubmit={(event) => { event.preventDefault(); onClose() }}>
      <div className="grid two">
        <Card><Info label="Клиент" value={client?.name ?? 'Не указан'} /><Info label="Объект" value={report.object_name} /><Info label="Марка" value={report.concrete_grade} /></Card>
        <Card><Info label="Осадка" value={report.slump} /><Info label="Прочность" value={`${report.strength_mpa} MPa`} /><Info label="Статус" value={labStatusLabel[report.status]} /></Card>
      </div>
      <div className="toolbar compact">
        <button type="button" className="secondary" onClick={() => printReport('Протокол лаборатории', sections, { client: client?.name })}><Printer size={18} /> Печать сертификата</button>
        <button type="button" className="secondary" onClick={() => exportReportPdf('Протокол лаборатории', sections, 'lab-certificate', { client: client?.name })}><Download size={18} /> PDF</button>
      </div>
    </Modal>
  )
}

function ExcavationModal({ report, onClose, onSave }: { report: ExcavationReport; onClose: () => void; onSave: (report: ExcavationReport) => Promise<void> }) {
  const [form, setForm] = useState(report)
  const totals = excavationTotals(form)
  const set = (key: keyof ExcavationReport, value: string) => setForm({ ...form, [key]: numericExcavationKeys.has(key) ? Number(value) : value })
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await onSave(form)
    onClose()
  }

  return (
    <Modal title="Новый отчет по котловану" subtitle="Заполните данные для формирования нового операционного отчета." onClose={onClose} onSubmit={submit}>
      <h3>Основная информация</h3>
      <div className="form-grid two-cols">
        <Field label="Название котлована / объекта" value={form.object_name} onChange={(v) => set('object_name', v)} />
        <Field label="Заказчик" value={form.client_name} onChange={(v) => set('client_name', v)} />
        <Field label="Телефон" value={form.client_phone} onChange={(v) => set('client_phone', v)} />
        <Field label="Адрес / локация" value={form.location} onChange={(v) => set('location', v)} />
        <Field label="Дата" value={form.date} onChange={(v) => set('date', v)} type="date" />
        <Field label="Статус" value={form.status} onChange={(v) => setForm({ ...form, status: v as Status })} />
      </div>
      <h3>Параметры работ</h3>
      <Field label="Тип работы" value={form.work_type} onChange={(v) => set('work_type', v)} />
      <div className="form-grid three-cols">
        <Field label="Кубы выемки (м³)" value={form.excavation_m3} onChange={(v) => set('excavation_m3', v)} type="number" />
        <Field label="Кубы обратной засыпки (м³)" value={form.backfill_m3} onChange={(v) => set('backfill_m3', v)} type="number" />
        <Field label="Цена за 1 м³ (сомони)" value={form.price_per_m3} onChange={(v) => set('price_per_m3', v)} type="number" />
        <Field label="Количество рейсов" value={form.trip_count} onChange={(v) => set('trip_count', v)} type="number" />
        <Field label="Цена за рейс (сомони)" value={form.price_per_trip} onChange={(v) => set('price_per_trip', v)} type="number" />
        <Field label="Техника" value={form.machinery} onChange={(v) => set('machinery', v)} />
      </div>
      <h3>Расходы и оплата</h3>
      <div className="form-grid three-cols">
        <Field label="Водитель" value={form.driver} onChange={(v) => set('driver', v)} />
        <Field label="Рабочие" value={form.workers} onChange={(v) => set('workers', v)} />
        <Field label="Зарплата рабочих" value={form.worker_salary} onChange={(v) => set('worker_salary', v)} type="number" />
        <Field label="Дизель литров" value={form.diesel_liters} onChange={(v) => set('diesel_liters', v)} type="number" />
        <Field label="Цена дизеля" value={form.diesel_price} onChange={(v) => set('diesel_price', v)} type="number" />
        <Field label="Аренда техники" value={form.machinery_rent} onChange={(v) => set('machinery_rent', v)} type="number" />
        <Field label="Прочие расходы" value={form.other_expenses} onChange={(v) => set('other_expenses', v)} type="number" />
        <Field label="Полученная оплата" value={form.received_payment} onChange={(v) => set('received_payment', v)} type="number" />
        <Field label="Комментарий" value={form.comment} onChange={(v) => set('comment', v)} />
      </div>
      <div className="calc-strip">
        <SummaryLine label="Доход" value={money(totals.totalIncome)} />
        <SummaryLine label="Расход" value={money(totals.totalExpenses)} tone="red" />
        <SummaryLine label="Прибыль" value={money(totals.profit)} tone="green" />
        <SummaryLine label="Долг" value={money(totals.debt)} tone="amber" />
      </div>
    </Modal>
  )
}

const numericExcavationKeys = new Set<keyof ExcavationReport>(['excavation_m3', 'backfill_m3', 'price_per_m3', 'trip_count', 'price_per_trip', 'worker_salary', 'diesel_liters', 'diesel_price', 'machinery_rent', 'other_expenses', 'received_payment'])

function emptyExcavation(): ExcavationReport {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    object_name: '',
    client_name: '',
    client_phone: '',
    location: '',
    work_type: 'Выемка грунта',
    excavation_m3: 0,
    backfill_m3: 0,
    price_per_m3: 0,
    trip_count: 0,
    price_per_trip: 0,
    machinery: '',
    driver: '',
    workers: '',
    worker_salary: 0,
    diesel_liters: 0,
    diesel_price: 0,
    machinery_rent: 0,
    other_expenses: 0,
    received_payment: 0,
    comment: '',
    status: 'active',
  }
}

function Modal({ title, subtitle, children, onClose, onSubmit }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={onSubmit}>
        <header>
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" className="icon-btn" onClick={onClose}><X /></button>
        </header>
        <div className="modal-body">{children}</div>
        <footer><button type="button" className="secondary" onClick={onClose}>Отмена</button><button className="primary">Сохранить</button></footer>
      </form>
    </div>
  )
}

function AdminActionButton({ children, className, action }: { children: ReactNode; className: string; action: (reason: string) => Promise<unknown> | unknown }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await action(reason)
    setOpen(false)
    setReason('')
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{children}</button>
      {open && (
        <Modal title="Подтвердите удаление" subtitle="Это действие нельзя отменить. Доступ проверяется через роль администратора в Supabase." onClose={() => setOpen(false)} onSubmit={submit}>
          <div className="form-grid">
            <Field label="Причина" value={reason} onChange={setReason} placeholder="Необязательно" />
          </div>
        </Modal>
      )}
    </>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, min, max }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; min?: number; max?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      {type === 'number' ? (
        <NumberInput value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} />
      ) : (
        <input value={value} type={type} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  )
}

function NumberInput({ value, onChange, placeholder, min, max }: { value: string | number; onChange: (value: string) => void; placeholder?: string; min?: number; max?: number }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const normalizedValue = typeof value === 'number' && value === 0 ? '' : String(value ?? '')
  const visibleValue = focused ? draft : normalizedValue

  const normalize = (raw: string) => {
    const cleaned = raw.replace(',', '.').replace(/[^\d.-]/g, '')
    const withoutLeadingZero = cleaned.replace(/^(-?)0+(?=\d)/, '$1')
    const numeric = Number(withoutLeadingZero)
    if (withoutLeadingZero !== '' && Number.isFinite(numeric)) {
      if (min !== undefined && numeric < min) return String(min)
      if (max !== undefined && numeric > max) return String(max)
    }
    return withoutLeadingZero
  }

  return (
    <input
      value={visibleValue}
      inputMode="decimal"
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true)
        setDraft(normalizedValue)
      }}
      onChange={(event) => {
        const next = normalize(event.target.value)
        setDraft(next)
        onChange(next)
      }}
      onBlur={() => {
        setFocused(false)
        if (draft === '' || draft === '-') onChange('0')
      }}
    />
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function SummaryLine({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'green' | 'blue' | 'amber' }) {
  return <div className={`summary-line ${tone ?? ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function Info({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className={`info-line ${tone ?? ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function ExportButtons({ title, rows, filename }: { title: string; rows: ExportRow[]; filename: string }) {
  return (
    <div className="toolbar compact">
      <button className="secondary" onClick={() => exportExcel(rows, filename, title)}><Download size={18} /> Excel</button>
      <button className="secondary" onClick={() => exportPdf(title, rows, filename)}><FileText size={18} /> PDF</button>
      <button className="secondary icon-only" onClick={() => printReport(title, [{ title: 'Данные отчёта', rows }], { orientation: rows.length && Object.keys(rows[0]).length > 6 ? 'landscape' : 'portrait' })}><Printer size={18} /></button>
    </div>
  )
}

function EmptyState({ title }: { title: string }) {
  return <Card className="empty-state"><h2>{title}</h2><p>Данные появятся здесь после сохранения записей.</p></Card>
}

function LoadingState() {
  return <Card className="empty-state"><h2>Загрузка CRM...</h2><p>Подготавливаем данные и подключение Supabase.</p></Card>
}

export default App
