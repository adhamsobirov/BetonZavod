import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppData,
  BarterAsset,
  CementMovement,
  Client,
  ClientReport,
  DailyReport,
  ExcavationReport,
  FinanceTransaction,
  Invoice,
  LabReport,
  PaymentReceipt,
} from '../types'
import { seedData } from './seed'
import { hasSupabaseEnv, supabase } from './supabase'

const STORAGE_KEY = 'concrete-supply-crm-data'

const emptyData: AppData = {
  profile: { id: '', full_name: '', login: '', role: 'operator', email: '', avatar_url: '' },
  clients: [],
  client_reports: [],
  barter_assets: [],
  finance_transactions: [],
  payment_receipts: [],
  daily_reports: [],
  invoices: [],
  lab_reports: [],
  excavation_reports: [],
  cement_movements: [],
  activity_logs: [],
}

const readLocal = (): AppData => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return normalizeData(seedData)
  try {
    return normalizeData(JSON.parse(raw) as AppData)
  } catch {
    return normalizeData(seedData)
  }
}

const normalizeData = (data: AppData): AppData => ({
  ...data,
  finance_transactions: data.finance_transactions ?? [],
  payment_receipts: (data.payment_receipts ?? []).map((receipt) => ({
    ...receipt,
    cash_amount: receipt.cash_amount ?? receipt.amount,
    barter_amount: receipt.barter_amount ?? 0,
    notes: receipt.notes ?? '',
    operator_name: receipt.operator_name ?? data.profile?.full_name ?? 'Администратор',
    created_at: receipt.created_at ?? now(),
  })),
  daily_reports: data.daily_reports ?? [],
  invoices: data.invoices ?? [],
  profile: {
    ...data.profile,
    full_name: data.profile.full_name ?? 'Адхам',
    login: data.profile.login ?? '',
    role: data.profile.role ?? 'operator',
    email: data.profile.email ?? '',
  },
  barter_assets: (data.barter_assets ?? []).map((asset) => {
    const remaining = Math.max(asset.remaining_amount ?? asset.market_value - (asset.used_amount ?? 0), 0)
    const used = Math.max(asset.used_amount ?? asset.market_value - remaining, 0)
    return {
      ...asset,
      cost_price: asset.cost_price ?? 0,
      linked_contract_amount: asset.linked_contract_amount ?? asset.market_value,
      cash_paid: asset.cash_paid ?? 0,
      barter_value: asset.barter_value ?? asset.market_value,
      total_paid_value: asset.total_paid_value ?? (asset.cash_paid ?? 0) + (asset.barter_value ?? asset.market_value),
      remaining_debt: asset.remaining_debt ?? Math.max((asset.linked_contract_amount ?? asset.market_value) - ((asset.cash_paid ?? 0) + (asset.barter_value ?? asset.market_value)), 0),
      asset_status: asset.asset_status ?? (remaining === 0 ? 'completed' : 'active'),
      used_amount: used,
      remaining_amount: remaining,
      status: remaining === 0 ? 'written_off' : used > 0 ? 'partial' : asset.status ?? 'active',
      owned_at: remaining === 0 ? asset.owned_at ?? now() : asset.owned_at,
      photos: asset.photos ?? [],
      comment: asset.comment ?? '',
      created_at: asset.created_at ?? now(),
      updated_at: asset.updated_at ?? now(),
    }
  }),
  clients: (data.clients ?? []).map((client) => ({
    ...client,
    contract_total: client.contract_total ?? 0,
    total_supplied_m3: client.total_supplied_m3 ?? (data.client_reports ?? []).filter((report) => report.client_id === client.id && !report.annulled).reduce((sum, report) => sum + report.volume_m3, 0),
    total_paid: client.total_paid ?? (data.client_reports ?? []).filter((report) => report.client_id === client.id && !report.annulled).reduce((sum, report) => sum + report.paid_amount, 0),
    cash_available: client.cash_available ?? Math.max((client.total_paid ?? 0) - (data.client_reports ?? []).filter((report) => report.client_id === client.id && !report.annulled).reduce((sum, report) => sum + report.paid_amount, 0), 0),
    total_barter_value: client.total_barter_value ?? (data.client_reports ?? []).filter((report) => report.client_id === client.id && !report.annulled).reduce((sum, report) => sum + report.barter_amount, 0),
  })),
  client_reports: (data.client_reports ?? []).map((report) => ({
    ...report,
    cash_amount: report.cash_amount ?? Math.max(report.amount - report.barter_amount, 0),
    transport_cost: report.transport_cost ?? 0,
    trip_count: report.trip_count ?? 0,
    comment: report.comment ?? '',
  })),
  lab_reports: (data.lab_reports ?? []).map((report) => {
    const legacyStatus = report.status as unknown as string
    return {
      ...report,
      sample_date: report.sample_date ?? report.date,
      test_date: report.test_date ?? report.date,
      status: legacyStatus === 'completed' ? 'passed' : legacyStatus === 'in_progress' ? 'pending' : report.status,
    }
  }),
  excavation_reports: (data.excavation_reports ?? []).map((report) => ({
    ...report,
    total_volume_m3: report.total_volume_m3 ?? report.excavation_m3,
    completed_volume_m3: report.completed_volume_m3 ?? report.excavation_m3,
    paid_amount: report.paid_amount ?? report.received_payment,
    expenses: report.expenses ?? report.diesel_liters * report.diesel_price + report.worker_salary + report.machinery_rent + report.other_expenses,
  })),
  cement_movements: (data.cement_movements ?? []).map((movement) => ({
    ...movement,
    tons: movement.tons ?? 0,
    price_per_ton: movement.price_per_ton ?? 0,
    total_cost: movement.total_cost ?? (movement.tons ?? 0) * (movement.price_per_ton ?? 0),
    notes: movement.notes ?? '',
    created_at: movement.created_at ?? now(),
    updated_at: movement.updated_at ?? now(),
  })),
  activity_logs: (data.activity_logs ?? []).map((log) => ({
    ...log,
    module: moduleRu[log.module] ?? log.module,
    description: log.description.replaceAll('₽', 'сомони').replaceAll('руб.', 'сомони').replaceAll('рублей', 'сомони'),
  })),
})

const writeLocal = (data: AppData) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()
const moneyText = (value: number) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0)} сомони`
const receiptNumber = (count: number) => `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
const clientBalanceStatus = (cashAvailable: number, debt: number): Client['status'] => {
  if (debt > 0) return 'debt'
  if (cashAvailable > 0) return 'active'
  return 'paid'
}

const moduleRu: Record<string, string> = {
  Dashboard: 'Дашборд',
  Clients: 'Клиенты',
  Reports: 'Отчёты',
  Daily: 'Ежедневный отчет',
  Finance: 'Финансы',
  Invoices: 'Счета',
  Lab: 'Лаборатория',
  Analytics: 'Аналитика',
  Settings: 'Настройки',
}

const allocateBarterAssets = (assets: BarterAsset[], clientId: string, amount: number) => {
  let remainingToAllocate = Math.max(amount, 0)
  const allocations: { asset_id: string; amount: number }[] = []
  const updatedById = new Map<string, BarterAsset>()
  const activeAssets = assets
    .filter((asset) => asset.client_id === clientId && asset.remaining_amount > 0 && asset.status !== 'written_off' && asset.status !== 'owned')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  for (const asset of activeAssets) {
    if (remainingToAllocate <= 0) break
    const usedNow = Math.min(asset.remaining_amount, remainingToAllocate)
    remainingToAllocate -= usedNow
    allocations.push({ asset_id: asset.id, amount: usedNow })
    const remainingAmount = Math.max(asset.remaining_amount - usedNow, 0)
    const usedAmount = asset.used_amount + usedNow
    updatedById.set(asset.id, {
      ...asset,
      used_amount: usedAmount,
      remaining_amount: remainingAmount,
      status: remainingAmount === 0 ? ('written_off' as const) : ('partial' as const),
      asset_status: remainingAmount === 0 ? 'completed' : 'active',
      owned_at: remainingAmount === 0 ? now() : asset.owned_at,
      updated_at: now(),
    })
  }

  const updatedAssets = assets.map((asset) => updatedById.get(asset.id) ?? asset)

  return { updatedAssets, allocations, covered: amount - remainingToAllocate, remainingDebt: remainingToAllocate }
}

const tableNames = [
  'clients',
  'client_reports',
  'barter_assets',
  'finance_transactions',
  'payment_receipts',
  'daily_reports',
  'invoices',
  'lab_reports',
  'excavation_reports',
  'cement_movements',
  'activity_logs',
] as const

type MutableTable = Exclude<keyof AppData, 'profile'>

const tableLabel: Partial<Record<MutableTable, string>> = {
  clients: 'клиента',
  client_reports: 'накладную бетона',
  barter_assets: 'бартерный актив',
  finance_transactions: 'оплату/транзакцию',
  payment_receipts: 'платежный документ',
  daily_reports: 'ежедневный отчет',
  invoices: 'счет',
  lab_reports: 'лабораторный отчет',
  excavation_reports: 'отчет по котловану',
  cement_movements: 'движение цемента',
  activity_logs: 'запись журнала',
}

export function useCrmStore(enabled = true) {
  const [data, setData] = useState<AppData>(() => (hasSupabaseEnv ? normalizeData(emptyData) : readLocal()))
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }, [])
  const canManage = data.profile.role === 'admin'

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!enabled) {
        setLoading(false)
        return
      }
      if (!hasSupabaseEnv || !supabase) {
        setLoading(false)
        return
      }

      setLoading(true)
      const next = { ...emptyData }
      for (const table of tableNames) {
        const { data: rows, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
        if (!error && rows && active) {
          ;(next as unknown as Record<string, unknown>)[table] = rows
        }
      }
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser()
      if (supabaseUser) {
        const { data: profile } = await supabase.from('users_profile').select('*').eq('id', supabaseUser.id).maybeSingle()
        if (profile) next.profile = profile
      }
      if (active) {
        setData(normalizeData(next))
        setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [enabled])

  useEffect(() => {
    if (!hasSupabaseEnv && !loading) writeLocal(data)
  }, [data, loading])

  const saveRow = useCallback(async (table: keyof AppData, row: Record<string, unknown>) => {
    if (hasSupabaseEnv && supabase) await supabase.from(table).upsert(row)
  }, [])

  const archiveRow = useCallback(async (table: keyof AppData, rowId: string) => {
    if (hasSupabaseEnv && supabase) await supabase.from(table).update({ archived: true, updated_at: now() }).eq('id', rowId)
  }, [])

  const api = useMemo(
    () => ({
      addClient: async (client: Omit<Client, 'id' | 'updated_at'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const initialCash = Math.max(client.total_paid ?? 0, 0)
        const row = { ...client, id: id(), updated_at: now(), total_supplied_m3: 0, total_paid: initialCash, cash_available: initialCash, total_barter_value: 0 }
        setData((current) => ({ ...current, clients: [row, ...current.clients] }))
        await saveRow('clients', row)
        notify('Клиент сохранен')
      },
      updateClient: async (client: Client) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row = { ...client, updated_at: now() }
        setData((current) => ({ ...current, clients: current.clients.map((item) => (item.id === row.id ? row : item)) }))
        await saveRow('clients', row)
        notify('Клиент обновлен')
      },
      archiveClient: async (rowId: string) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        if (!confirm('Архивировать клиента?')) return
        setData((current) => ({ ...current, clients: current.clients.map((item) => (item.id === rowId ? { ...item, archived: true } : item)) }))
        await archiveRow('clients', rowId)
        notify('Клиент архивирован')
      },
      addFinance: async (transaction: Omit<FinanceTransaction, 'id'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row = { ...transaction, id: id() }
        setData((current) => ({ ...current, finance_transactions: [row, ...current.finance_transactions] }))
        await saveRow('finance_transactions', row)
        notify('Транзакция сохранена')
      },
      updateFinance: async (transaction: FinanceTransaction) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row = { ...transaction }
        setData((current) => ({
          ...current,
          finance_transactions: current.finance_transactions.map((item) => (item.id === row.id ? row : item)),
        }))
        await saveRow('finance_transactions', row)
        notify('Транзакция обновлена')
      },
      addBarterAsset: async (asset: Omit<BarterAsset, 'id' | 'used_amount' | 'remaining_amount' | 'status' | 'created_at' | 'updated_at'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        if (!asset.type || !asset.market_value || asset.market_value <= 0) {
          notify('Укажите тип и рыночную стоимость бартерного актива')
          return
        }
        const cashPaid = Math.max(asset.cash_paid ?? 0, 0)
        const barterValue = Math.max(asset.barter_value ?? asset.market_value, 0)
        const linkedContractAmount = Math.max(asset.linked_contract_amount ?? asset.market_value, 0)
        const totalPaidValue = cashPaid + barterValue
        const remainingDebt = Math.max(linkedContractAmount - totalPaidValue, 0)
        const row: BarterAsset = {
          ...asset,
          id: id(),
          used_amount: 0,
          remaining_amount: barterValue,
          status: 'active',
          linked_contract_amount: linkedContractAmount,
          cash_paid: cashPaid,
          barter_value: barterValue,
          total_paid_value: totalPaidValue,
          remaining_debt: remainingDebt,
          asset_status: asset.asset_status ?? 'active',
          source_client_name: data.clients.find((client) => client.id === asset.client_id)?.name,
          photos: asset.photos ?? [],
          created_at: now(),
          updated_at: now(),
        }
        const cashFinance: FinanceTransaction | undefined = cashPaid > 0 ? {
          id: id(),
          client_id: row.client_id,
          date: new Date().toISOString().slice(0, 10),
          category: 'Оплата',
          type: 'income',
          description: `Наличная часть по бартеру: ${row.asset_name}`,
          amount: cashPaid,
          status: 'paid',
        } : undefined
        const barterFinance: FinanceTransaction = {
          id: id(),
          client_id: row.client_id,
          date: new Date().toISOString().slice(0, 10),
          category: 'Бартер',
          type: 'barter',
          description: `Бартерный актив: ${row.asset_name}`,
          amount: barterValue,
          status: 'paid',
        }
        const financeRows = [cashFinance, barterFinance].filter(Boolean) as FinanceTransaction[]
        setData((current) => ({
          ...current,
          barter_assets: [row, ...current.barter_assets],
          finance_transactions: [...financeRows, ...current.finance_transactions],
          clients: current.clients.map((client) =>
            client.id === row.client_id
              ? {
                  ...client,
                  balance: Math.min(client.balance + totalPaidValue, 0),
                  total_paid: (client.total_paid ?? 0) + cashPaid,
                  cash_available: (client.cash_available ?? 0) + cashPaid,
                  total_barter_value: (client.total_barter_value ?? 0) + barterValue,
                  status: client.balance + totalPaidValue < 0 ? 'debt' : 'active',
                  updated_at: now(),
                }
              : client,
          ),
        }))
        await saveRow('barter_assets', row)
        await Promise.all(financeRows.map((finance) => saveRow('finance_transactions', finance)))
        notify('Бартерный актив добавлен')
      },
      addCementMovement: async (movement: Omit<CementMovement, 'id' | 'total_cost' | 'created_at' | 'updated_at'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row: CementMovement = {
          ...movement,
          id: id(),
          tons: Math.max(movement.tons, 0),
          price_per_ton: movement.price_per_ton ?? 0,
          total_cost: Math.max(movement.tons, 0) * Math.max(movement.price_per_ton ?? 0, 0),
          created_at: now(),
          updated_at: now(),
        }
        const financeRow: FinanceTransaction | undefined = row.total_cost > 0 ? {
          id: id(),
          date: row.date,
          category: row.type === 'incoming' ? 'Цемент приход' : 'Цемент расход',
          type: 'expense',
          description: row.type === 'incoming' ? `Поступление цемента: ${row.supplier ?? 'поставщик'}` : `Расход цемента: ${row.reason ?? row.project ?? 'производство'}`,
          amount: row.total_cost,
          status: 'paid',
        } : undefined
        setData((current) => ({
          ...current,
          cement_movements: [row, ...current.cement_movements],
          finance_transactions: financeRow ? [financeRow, ...current.finance_transactions] : current.finance_transactions,
          activity_logs: [
            { id: id(), created_at: now(), module: 'Цемент', title: row.type === 'incoming' ? 'Поступление цемента' : 'Расход цемента', description: `${row.tons} т · ${moneyText(row.total_cost)}` },
            ...current.activity_logs,
          ],
        }))
        await saveRow('cement_movements', row)
        if (financeRow) await saveRow('finance_transactions', financeRow)
        notify('Движение цемента сохранено')
      },
      addConcreteDelivery: async (delivery: Omit<ClientReport, 'id' | 'amount' | 'paid_amount' | 'barter_amount' | 'cash_amount'> & { price_per_m3: number }) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const client = data.clients.find((item) => item.id === delivery.client_id)
        if (!client) return
        const concreteAmount = delivery.volume_m3 * delivery.price_per_m3
        const totalAmount = concreteAmount + (delivery.transport_cost ?? 0)
        const barterPercent = Math.max(0, Math.min(client.barter_percent ?? 0, 100))
        const barterAmount = Math.round((totalAmount * barterPercent) / 100)
        const cashAmount = totalAmount - barterAmount
        const cashCovered = Math.min(cashAmount, Math.max(client.cash_available ?? 0, 0))
        const cashDebt = Math.max(cashAmount - cashCovered, 0)
        const { updatedAssets, allocations, covered: actualCoveredBarter, remainingDebt: barterDebt } = allocateBarterAssets(data.barter_assets, client.id, barterAmount)
        const row: ClientReport = {
          id: id(),
          client_id: delivery.client_id,
          date: delivery.date,
          object_name: delivery.object_name,
          concrete_grade: delivery.concrete_grade,
          volume_m3: delivery.volume_m3,
          amount: totalAmount,
          cash_amount: cashAmount,
          paid_amount: cashCovered,
          barter_amount: barterAmount,
          barter_asset_allocations: allocations,
          transport_cost: delivery.transport_cost ?? 0,
          trip_count: delivery.trip_count ?? 0,
          comment: delivery.comment ?? '',
          status: 'unpaid',
        }
        const financeRow: FinanceTransaction = {
          id: id(),
          client_id: client.id,
          date: delivery.date,
          category: 'Начисление за бетон',
          type: 'income',
          description: `${client.name}: ${delivery.object_name}, ${delivery.volume_m3} м³ ${delivery.concrete_grade}`,
          amount: totalAmount,
          status: 'unpaid',
        }
        const nextCashAvailable = Math.max((client.cash_available ?? 0) - cashCovered, 0)
        const nextDebt = Math.max(Math.abs(Math.min(client.balance, 0)) + cashDebt + barterDebt, 0)
        const updatedClient: Client = {
          ...client,
          balance: client.balance - cashDebt - barterDebt,
          cash_available: nextCashAvailable,
          total_supplied_m3: (client.total_supplied_m3 ?? 0) + row.volume_m3,
          total_barter_value: client.total_barter_value ?? 0,
          status: clientBalanceStatus(nextCashAvailable, nextDebt),
          updated_at: now(),
        }
        setData((current) => ({
          ...current,
          client_reports: [row, ...current.client_reports],
          barter_assets: current.barter_assets.map((asset) => updatedAssets.find((updated) => updated.id === asset.id) ?? asset),
          finance_transactions: [financeRow, ...current.finance_transactions],
          clients: current.clients.map((item) =>
            item.id === client.id
              ? updatedClient
              : item,
          ),
          daily_reports: current.daily_reports.map((report) =>
            report.date === row.date
              ? {
                  ...report,
                  items: [
                    ...report.items,
                    {
                      id: id(),
                      client_name: client.name,
                      object_name: row.object_name,
                      concrete_grade: row.concrete_grade,
                      volume_m3: row.volume_m3,
                      price: delivery.price_per_m3,
                    },
                  ],
                }
              : report,
          ),
          activity_logs: [
            { id: id(), created_at: now(), module: 'Бетон', title: 'Создана накладная бетона', description: `${client.name}, ${row.volume_m3} м³` },
            ...current.activity_logs,
          ],
        }))
        await saveRow('client_reports', row)
        await Promise.all(updatedAssets.map((asset) => saveRow('barter_assets', asset)))
        await saveRow('clients', updatedClient)
        await saveRow('finance_transactions', financeRow)
        notify(cashDebt > 0 || actualCoveredBarter < barterAmount ? 'Накладная сохранена, есть долг по наличным или бартеру' : 'Накладная бетона сохранена')
      },
      addPayment: async (clientId: string, amount: number, date = new Date().toISOString().slice(0, 10), description = 'Оплата клиента', paymentType = 'наличные', notes = '') => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const client = data.clients.find((item) => item.id === clientId)
        if (!client || amount <= 0) return
        const row: FinanceTransaction = { id: id(), client_id: clientId, date, category: 'Оплата', type: 'income', description, amount, payment_method: paymentType, notes, status: 'paid' }
        const existingDebt = Math.abs(Math.min(client.balance, 0))
        const prepaymentAmount = Math.max(amount - existingDebt, 0)
        const nextCashAvailable = (client.cash_available ?? 0) + prepaymentAmount
        const nextBalance = Math.min(client.balance + amount, 0)
        const nextDebt = Math.abs(nextBalance)
        const receipt: PaymentReceipt = {
          id: id(),
          receipt_number: receiptNumber(data.payment_receipts.length),
          date: now(),
          client_id: clientId,
          payment_type: paymentType,
          amount,
          cash_amount: paymentType === 'бартер' ? 0 : amount,
          barter_amount: paymentType === 'бартер' ? amount : 0,
          notes: notes || description,
          operator_name: data.profile.full_name,
          finance_transaction_id: row.id,
          created_at: now(),
        }
        setData((current) => ({
          ...current,
          finance_transactions: [row, ...current.finance_transactions],
          payment_receipts: [receipt, ...current.payment_receipts],
          clients: current.clients.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  balance: nextBalance,
                  total_paid: (item.total_paid ?? 0) + amount,
                  cash_available: nextCashAvailable,
                  status: clientBalanceStatus(nextCashAvailable, nextDebt),
                  updated_at: now(),
                }
              : item,
          ),
          activity_logs: [
            { id: id(), created_at: now(), module: 'Финансы', title: 'Платежный документ создан', description: `${receipt.receipt_number} · ${client.name} · ${moneyText(amount)}` },
            ...current.activity_logs,
          ],
        }))
        await saveRow('finance_transactions', row)
        await saveRow('payment_receipts', receipt)
        notify(`Оплата добавлена, документ ${receipt.receipt_number} создан`)
      },
      saveDaily: async (report: DailyReport) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row = { ...report, saved_at: now() }
        setData((current) => ({ ...current, daily_reports: [row, ...current.daily_reports.filter((item) => item.id !== row.id)] }))
        await saveRow('daily_reports', row)
        notify('Ежедневный отчет сохранен')
      },
      addInvoice: async (invoice: Omit<Invoice, 'id'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row = { ...invoice, id: id() }
        setData((current) => ({ ...current, invoices: [row, ...current.invoices] }))
        await saveRow('invoices', row)
        notify('Счет создан')
      },
      markInvoicePaid: async (invoiceId: string) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const invoice = data.invoices.find((item) => item.id === invoiceId)
        if (!invoice || invoice.status === 'paid') return
        const payment: FinanceTransaction = {
          id: id(),
          client_id: invoice.client_id,
          date: new Date().toISOString().slice(0, 10),
          category: 'Оплата',
          type: 'income',
          description: `Оплата счета ${invoice.number}`,
          amount: invoice.amount,
          status: 'paid',
        }
        const row = { ...invoice, status: 'paid' as const }
        setData((current) => ({
          ...current,
          finance_transactions: [payment, ...current.finance_transactions],
          clients: current.clients.map((item) =>
            item.id === invoice.client_id
              ? { ...item, balance: Math.min(item.balance + invoice.amount, 0), total_paid: (item.total_paid ?? 0) + invoice.amount, cash_available: (item.cash_available ?? 0) + invoice.amount, updated_at: now() }
              : item,
          ),
          invoices: current.invoices.map((item) => (item.id === invoiceId ? row : item)),
        }))
        await saveRow('finance_transactions', payment)
        await saveRow('invoices', row)
        notify('Счет отмечен как оплаченный')
      },
      addLabReport: async (report: Omit<LabReport, 'id'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row = { ...report, id: id() }
        setData((current) => ({ ...current, lab_reports: [row, ...current.lab_reports] }))
        await saveRow('lab_reports', row)
        notify('Лабораторный отчет сохранен')
      },
      saveExcavation: async (report: ExcavationReport) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row = report.id ? report : { ...report, id: id() }
        setData((current) => ({
          ...current,
          excavation_reports: [row, ...current.excavation_reports.filter((item) => item.id !== row.id)],
        }))
        await saveRow('excavation_reports', row)
        notify('Отчет по котловану сохранен')
      },
      archiveExcavation: async (rowId: string) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        if (!confirm('Архивировать отчет по котловану?')) return
        setData((current) => ({
          ...current,
          excavation_reports: current.excavation_reports.map((item) => (item.id === rowId ? { ...item, archived: true } : item)),
        }))
        await archiveRow('excavation_reports', rowId)
        notify('Отчет архивирован')
      },
      adminDelete: async (table: MutableTable, rowId: string, entityName: string, mode: 'delete' | 'annul' = 'delete', reason = '') => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const barterToReverse = table === 'barter_assets' ? data.barter_assets.find((asset) => asset.id === rowId) : undefined
        const audit = {
          id: id(),
          created_at: now(),
          module: 'Аудит',
          title: mode === 'delete' ? 'Удаление записи' : 'Аннулирование записи',
          description: `${data.profile.full_name}: ${mode === 'delete' ? 'удалил' : 'аннулировал'} ${tableLabel[table] ?? table} ${entityName || rowId}${reason ? `. Причина: ${reason}` : ''}`,
        }
        const applyLocalMutation = () => setData((current) => {
          const list = current[table] as Array<Record<string, unknown>>
          const nextList = mode === 'delete'
            ? list.filter((item) => item.id !== rowId)
            : list.map((item) => (item.id === rowId ? { ...item, status: 'annulled', annulled: true, updated_at: now() } : item))
          const reversedClients = barterToReverse && mode === 'delete'
            ? current.clients.map((client) => {
                if (client.id !== barterToReverse.client_id) return client
                const cashPaid = barterToReverse.cash_paid ?? 0
                const barterValue = barterToReverse.barter_value ?? barterToReverse.market_value
                const totalPaidValue = barterToReverse.total_paid_value ?? cashPaid + barterValue
                return {
                  ...client,
                  balance: client.balance - totalPaidValue,
                  total_paid: Math.max((client.total_paid ?? 0) - cashPaid, 0),
                  cash_available: Math.max((client.cash_available ?? 0) - cashPaid, 0),
                  total_barter_value: Math.max((client.total_barter_value ?? 0) - barterValue, 0),
                  status: client.balance - totalPaidValue < 0 ? 'debt' : client.status,
                  updated_at: now(),
                }
              })
            : current.clients
          return { ...current, clients: reversedClients, [table]: nextList, activity_logs: [audit, ...current.activity_logs] }
        })
        if (hasSupabaseEnv && supabase) {
          const result = mode === 'delete'
            ? await supabase.from(table).delete().eq('id', rowId)
            : await supabase.from(table).update({ status: 'annulled', annulled: true, updated_at: now() }).eq('id', rowId)
          if (result.error) {
            notify(`Ошибка Supabase: ${result.error.message}`)
            return false
          }
          if (barterToReverse && mode === 'delete') {
            const client = data.clients.find((item) => item.id === barterToReverse.client_id)
            if (client) {
              const cashPaid = barterToReverse.cash_paid ?? 0
              const barterValue = barterToReverse.barter_value ?? barterToReverse.market_value
              const totalPaidValue = barterToReverse.total_paid_value ?? cashPaid + barterValue
              await supabase.from('clients').update({
                balance: client.balance - totalPaidValue,
                total_paid: Math.max((client.total_paid ?? 0) - cashPaid, 0),
                cash_available: Math.max((client.cash_available ?? 0) - cashPaid, 0),
                total_barter_value: Math.max((client.total_barter_value ?? 0) - barterValue, 0),
                updated_at: now(),
              }).eq('id', client.id)
            }
          }
          await supabase.from('activity_logs').insert(audit)
        }
        applyLocalMutation()
        notify(mode === 'delete' ? 'Запись удалена' : 'Запись аннулирована')
        return true
      },
      clearTestData: async (reason = 'Очистка тестовых данных') => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const audit = { id: id(), created_at: now(), module: 'Аудит', title: 'Очистка тестовых данных', description: `${data.profile.full_name}: ${reason}` }
        setData((current) => ({
          ...current,
          clients: [],
          client_reports: [],
          barter_assets: [],
          finance_transactions: [],
          payment_receipts: [],
          daily_reports: [],
          invoices: [],
          lab_reports: [],
          excavation_reports: [],
          activity_logs: [audit],
        }))
        if (hasSupabaseEnv && supabase) await supabase.from('activity_logs').insert(audit)
        notify('Тестовые данные очищены')
        return true
      },
    }),
    [archiveRow, canManage, data.barter_assets, data.clients, data.invoices, data.payment_receipts.length, data.profile.full_name, notify, saveRow],
  )

  return { data, setData, loading, toast, notify, canManage, api }
}
