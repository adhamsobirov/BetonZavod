import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppData,
  AccountingDebt,
  BarterAsset,
  CementMovement,
  Client,
  ClientReport,
  DailyReport,
  DebtRepayment,
  ExcavationReport,
  FinanceTransaction,
  Invoice,
  LabReport,
  PaymentReceipt,
  RawMaterialReceipt,
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
  accounting_debts: [],
  debt_repayments: [],
  raw_material_receipts: [],
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
  accounting_debts: (data.accounting_debts ?? []).map((debt) => ({
    ...debt,
    paid_amount: debt.paid_amount ?? 0,
    remaining_amount: debt.remaining_amount ?? Math.max(debt.amount - (debt.paid_amount ?? 0), 0),
    status: debt.status ?? ((debt.paid_amount ?? 0) > 0 ? 'partial' : 'open'),
    notes: debt.notes ?? '',
    created_at: debt.created_at ?? now(),
    updated_at: debt.updated_at ?? now(),
  })),
  debt_repayments: (data.debt_repayments ?? []).map((repayment) => ({
    ...repayment,
    notes: repayment.notes ?? '',
    created_at: repayment.created_at ?? now(),
    updated_at: repayment.updated_at ?? repayment.created_at ?? now(),
    annulled: repayment.annulled ?? false,
  })),
  raw_material_receipts: (data.raw_material_receipts ?? []).map((receipt) => ({
    ...receipt,
    quantity: receipt.quantity ?? 0,
    price: receipt.price ?? 0,
    amount: receipt.amount ?? (receipt.quantity ?? 0) * (receipt.price ?? 0),
    notes: receipt.notes ?? '',
    created_at: receipt.created_at ?? now(),
    updated_at: receipt.updated_at ?? now(),
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
    cash_received_now: report.cash_received_now ?? report.paid_amount ?? 0,
    transport_cost: report.transport_cost ?? 0,
    trip_count: report.trip_count ?? 0,
    comment: report.comment ?? '',
    updated_at: report.updated_at ?? now(),
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
const debtStatus = (remaining: number, paid: number): AccountingDebt['status'] => {
  if (remaining <= 0) return 'paid'
  if (paid > 0) return 'partial'
  return 'open'
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
  'accounting_debts',
  'debt_repayments',
  'raw_material_receipts',
  'daily_reports',
  'invoices',
  'lab_reports',
  'excavation_reports',
  'cement_movements',
  'activity_logs',
] as const

type MutableTable = Exclude<keyof AppData, 'profile'>
type InitialBarterAsset = {
  type: BarterAsset['type']
  asset_name: string
  market_value: number
  contract_number?: string
  comment?: string
}

const tableLabel: Partial<Record<MutableTable, string>> = {
  clients: 'клиента',
  client_reports: 'накладную бетона',
  barter_assets: 'бартерный актив',
  finance_transactions: 'оплату/транзакцию',
  payment_receipts: 'платежный документ',
  accounting_debts: 'долг',
  debt_repayments: 'погашение долга',
  raw_material_receipts: 'приход сырья',
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

  const saveRows = useCallback(async (rows: { table: keyof AppData; row: Record<string, unknown> }[]) => {
    await Promise.all(rows.map(({ table, row }) => saveRow(table, row)))
  }, [saveRow])

  const linkedFinance = useCallback((module: string, recordId: string) =>
    data.finance_transactions.filter((row) => row.linked_module === module && row.linked_record_id === recordId && !row.annulled),
  [data.finance_transactions])

  const linkedDebts = useCallback((module: string, recordId: string) =>
    data.accounting_debts.filter((row) => row.source_module === module && row.source_record_id === recordId && !row.annulled),
  [data.accounting_debts])

  const auditRow = useCallback((title: string, description: string) => ({
    id: id(),
    created_at: now(),
    module: 'Аудит',
    title,
    description: `${data.profile.full_name}: ${description}`,
  }), [data.profile.full_name])

  const reverseConcreteSale = useCallback(async (rowId: string, reason = '') => {
    if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
    const sale = data.client_reports.find((row) => row.id === rowId && !row.annulled)
    const client = sale ? data.clients.find((row) => row.id === sale.client_id) : undefined
    if (!sale || !client) return false
    const debts = linkedDebts('Продажи бетона', sale.id)
    if (debts.some((debt) => debt.paid_amount > 0)) {
      notify('Продажа уже связана с погашением долга. Сначала удалите погашение долга, затем повторите операцию.')
      return false
    }
    const debtAmount = debts.reduce((sum, debt) => sum + debt.amount, 0)
    const cashBack = sale.cash_received_now === undefined ? sale.paid_amount ?? 0 : 0
    const oldExtraCash = sale.cash_received_now === undefined ? 0 : Math.max((sale.cash_received_now ?? 0) - (sale.paid_amount ?? 0), 0)
    const nextDebt = Math.max(Math.abs(Math.min(client.balance + debtAmount, 0)), 0)
    const nextCashAvailable = Math.max((client.cash_available ?? 0) + cashBack - oldExtraCash, 0)
    const updatedClient: Client = {
      ...client,
      balance: Math.min(client.balance + debtAmount, 0),
      cash_available: nextCashAvailable,
      total_paid: Math.max((client.total_paid ?? 0) - (sale.cash_received_now ?? 0), 0),
      total_supplied_m3: Math.max((client.total_supplied_m3 ?? 0) - sale.volume_m3, 0),
      status: clientBalanceStatus(nextCashAvailable, nextDebt),
      updated_at: now(),
    }
    const allocationMap = new Map((sale.barter_asset_allocations ?? []).map((allocation) => [allocation.asset_id, allocation.amount]))
    const updatedAssets = data.barter_assets.map((asset) => {
      const amount = allocationMap.get(asset.id) ?? 0
      if (!amount) return asset
      const used = Math.max((asset.used_amount ?? 0) - amount, 0)
      const remaining = Math.max((asset.remaining_amount ?? 0) + amount, 0)
      return {
        ...asset,
        used_amount: used,
        remaining_amount: remaining,
        status: used <= 0 ? ('active' as const) : ('partial' as const),
        asset_status: remaining <= 0 ? ('completed' as const) : ('active' as const),
        owned_at: remaining > 0 ? undefined : asset.owned_at,
        updated_at: now(),
      }
    })
    const updatedSale: ClientReport = { ...sale, annulled: true, status: 'annulled', recalculated_at: now(), updated_at: now() }
    const updatedFinance = data.finance_transactions.map((row) =>
      row.linked_module === 'Продажи бетона' && row.linked_record_id === sale.id && !row.annulled
        ? { ...row, annulled: true, status: 'annulled' as const }
        : row,
    )
    const updatedDebts = data.accounting_debts.map((row) =>
      row.source_module === 'Продажи бетона' && row.source_record_id === sale.id && !row.annulled
        ? { ...row, annulled: true, status: 'cancelled' as const, remaining_amount: 0, updated_at: now() }
        : row,
    )
    const audit = auditRow('Аннулирование продажи бетона', `аннулировал продажу ${sale.object_name}. Связанные приход, бартер и долг пересчитаны${reason ? `. Причина: ${reason}` : ''}`)
    setData((current) => ({
      ...current,
      clients: current.clients.map((row) => (row.id === client.id ? updatedClient : row)),
      client_reports: current.client_reports.map((row) => (row.id === sale.id ? updatedSale : row)),
      barter_assets: updatedAssets,
      finance_transactions: updatedFinance,
      accounting_debts: updatedDebts,
      activity_logs: [audit, ...current.activity_logs],
    }))
    await saveRows([
      { table: 'clients', row: updatedClient },
      { table: 'client_reports', row: updatedSale },
      ...updatedAssets.filter((asset) => allocationMap.has(asset.id)).map((row) => ({ table: 'barter_assets' as const, row })),
      ...updatedFinance.filter((row) => row.linked_module === 'Продажи бетона' && row.linked_record_id === sale.id).map((row) => ({ table: 'finance_transactions' as const, row })),
      ...updatedDebts.filter((row) => row.source_module === 'Продажи бетона' && row.source_record_id === sale.id).map((row) => ({ table: 'accounting_debts' as const, row })),
      { table: 'activity_logs', row: audit },
    ])
    notify('Продажа аннулирована, связанные записи пересчитаны')
    return true
  }, [auditRow, canManage, data.accounting_debts, data.barter_assets, data.client_reports, data.clients, data.finance_transactions, linkedDebts, notify, saveRows])

  const updateConcreteSale = useCallback(async (sale: ClientReport) => {
    if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
    const oldSale = data.client_reports.find((row) => row.id === sale.id && !row.annulled)
    if (!oldSale) return
    const client = data.clients.find((row) => row.id === oldSale.client_id)
    if (!client) return
    const oldDebts = linkedDebts('Продажи бетона', oldSale.id)
    if (oldDebts.some((debt) => debt.paid_amount > 0)) {
      notify('Нельзя изменить продажу: по связанному долгу уже есть погашение. Сначала удалите погашение.')
      return
    }
    const oldDebtAmount = oldDebts.reduce((sum, debt) => sum + debt.amount, 0)
    const oldExtraCash = oldSale.cash_received_now === undefined ? 0 : Math.max((oldSale.cash_received_now ?? 0) - (oldSale.paid_amount ?? 0), 0)
    const restoredClient = {
      ...client,
      balance: Math.min(client.balance + oldDebtAmount, 0),
      cash_available: Math.max((client.cash_available ?? 0) + (oldSale.cash_received_now === undefined ? oldSale.paid_amount ?? 0 : 0) - oldExtraCash, 0),
      total_supplied_m3: Math.max((client.total_supplied_m3 ?? 0) - oldSale.volume_m3, 0),
    }
    let assetsAfterReverse = data.barter_assets.map((asset) => {
      const allocation = (oldSale.barter_asset_allocations ?? []).find((item) => item.asset_id === asset.id)
      if (!allocation) return asset
      const used = Math.max(asset.used_amount - allocation.amount, 0)
      const remaining = asset.remaining_amount + allocation.amount
      return { ...asset, used_amount: used, remaining_amount: remaining, status: used > 0 ? ('partial' as const) : ('active' as const), asset_status: 'active' as const, owned_at: remaining > 0 ? undefined : asset.owned_at, updated_at: now() }
    })
    const barterPercent = Math.max(0, Math.min(client.barter_percent ?? 0, 100))
    const nextAmount = Math.max(sale.amount, 0)
    const barterAmount = Math.round((nextAmount * barterPercent) / 100)
    const cashAmount = nextAmount - barterAmount
    const immediateCash = Math.min(Math.max(sale.cash_received_now ?? sale.paid_amount ?? 0, 0), nextAmount)
    const cashCovered = Math.min(cashAmount, immediateCash)
    const extraCash = Math.max(immediateCash - cashCovered, 0)
    const cashDebt = Math.max(cashAmount - cashCovered, 0)
    const allocated = allocateBarterAssets(assetsAfterReverse, client.id, barterAmount)
    assetsAfterReverse = allocated.updatedAssets
    const totalDebt = cashDebt + allocated.remainingDebt
    const updatedSale: ClientReport = {
      ...oldSale,
      ...sale,
      amount: nextAmount,
      cash_amount: cashAmount,
      paid_amount: cashCovered,
      cash_received_now: immediateCash,
      barter_amount: barterAmount,
      barter_asset_allocations: allocated.allocations,
      status: totalDebt > 0 ? 'unpaid' : 'paid',
      recalculated_at: now(),
      updated_at: now(),
    }
    const nextBalance = restoredClient.balance - totalDebt
    const nextCashAvailable = Math.max(restoredClient.cash_available ?? 0, 0) + extraCash
    const updatedClient: Client = {
      ...restoredClient,
      balance: nextBalance,
      cash_available: nextCashAvailable,
      total_paid: (restoredClient.total_paid ?? 0) + immediateCash - (oldSale.cash_received_now ?? oldSale.paid_amount ?? 0),
      total_supplied_m3: (restoredClient.total_supplied_m3 ?? 0) + updatedSale.volume_m3,
      status: clientBalanceStatus(nextCashAvailable, Math.abs(Math.min(nextBalance, 0))),
      updated_at: now(),
    }
    const oldFinance = linkedFinance('Продажи бетона', oldSale.id)[0]
    const financeRow: FinanceTransaction | undefined = immediateCash > 0
      ? {
          id: oldFinance?.id ?? id(),
          client_id: client.id,
          date: updatedSale.date,
          category: 'Продажа бетона',
          type: 'income',
          description: `${client.name}: ${updatedSale.object_name}, ${updatedSale.volume_m3} м³ ${updatedSale.concrete_grade}`,
          amount: immediateCash,
          payment_method: 'наличные',
          linked_module: 'Продажи бетона',
          linked_record_id: updatedSale.id,
          status: 'paid',
        }
      : oldFinance ? { ...oldFinance, annulled: true, status: 'annulled' as const } : undefined
    const oldDebt = oldDebts[0]
    const debtRow: AccountingDebt | undefined = totalDebt > 0
      ? {
          id: oldDebt?.id ?? id(),
          type: 'receivable',
          counterparty: client.name,
          client_id: client.id,
          source_module: 'Продажи бетона',
          source_record_id: updatedSale.id,
          date: updatedSale.date,
          amount: totalDebt,
          paid_amount: 0,
          remaining_amount: totalDebt,
          status: 'open',
          notes: `Накладная: ${updatedSale.object_name}. Наличный долг ${moneyText(cashDebt)}, бартерный долг ${moneyText(allocated.remainingDebt)}`,
          created_at: oldDebt?.created_at ?? now(),
          updated_at: now(),
        }
      : oldDebt ? { ...oldDebt, annulled: true, status: 'cancelled' as const, remaining_amount: 0, updated_at: now() } : undefined
    const audit = auditRow('Пересчет продажи бетона', `изменил продажу ${updatedSale.object_name}. Приход, бартер, долг и баланс клиента пересчитаны`)
    setData((current) => ({
      ...current,
      clients: current.clients.map((row) => (row.id === client.id ? updatedClient : row)),
      client_reports: current.client_reports.map((row) => (row.id === updatedSale.id ? updatedSale : row)),
      barter_assets: assetsAfterReverse,
      finance_transactions: financeRow ? [financeRow, ...current.finance_transactions.filter((row) => row.id !== financeRow.id)] : current.finance_transactions,
      accounting_debts: debtRow ? [debtRow, ...current.accounting_debts.filter((row) => row.id !== debtRow.id)] : current.accounting_debts,
      activity_logs: [audit, ...current.activity_logs],
    }))
    await saveRows([
      { table: 'clients', row: updatedClient },
      { table: 'client_reports', row: updatedSale },
      ...assetsAfterReverse.filter((asset) => data.barter_assets.find((old) => old.id === asset.id && (old.used_amount !== asset.used_amount || old.remaining_amount !== asset.remaining_amount))).map((row) => ({ table: 'barter_assets' as const, row })),
      ...(financeRow ? [{ table: 'finance_transactions' as const, row: financeRow }] : []),
      ...(debtRow ? [{ table: 'accounting_debts' as const, row: debtRow }] : []),
      { table: 'activity_logs', row: audit },
    ])
    notify('Продажа изменена, связанные записи пересчитаны')
  }, [auditRow, canManage, data.barter_assets, data.client_reports, data.clients, linkedDebts, linkedFinance, notify, saveRows])

  const updateRawMaterialReceipt = useCallback(async (receipt: RawMaterialReceipt) => {
    if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
    const old = data.raw_material_receipts.find((row) => row.id === receipt.id && !row.annulled)
    if (!old) return
    const oldDebt = old.debt_id ? data.accounting_debts.find((row) => row.id === old.debt_id && !row.annulled) : linkedDebts('Приход сырья', old.id)[0]
    if (oldDebt?.paid_amount && oldDebt.paid_amount > 0) {
      notify('Нельзя изменить приход сырья: связанный долг уже частично погашен. Сначала удалите погашение.')
      return
    }
    const amount = Math.max(receipt.quantity, 0) * Math.max(receipt.price, 0)
    const oldFinance = linkedFinance('Приход сырья', old.id)[0]
    let debtRow: AccountingDebt | undefined
    let financeRow: FinanceTransaction | undefined
    const row: RawMaterialReceipt = { ...receipt, amount, updated_at: now(), recalculated_at: now() }
    if (row.status === 'debt') {
      debtRow = {
        id: oldDebt?.id ?? id(),
        type: 'payable',
        counterparty: row.supplier,
        source_module: 'Приход сырья',
        source_record_id: row.id,
        date: row.date,
        amount,
        paid_amount: 0,
        remaining_amount: amount,
        status: 'open',
        notes: `${row.material} · ${row.quantity} ${row.unit}`,
        created_at: oldDebt?.created_at ?? now(),
        updated_at: now(),
      }
      row.debt_id = debtRow.id
      if (oldFinance) financeRow = { ...oldFinance, annulled: true, status: 'annulled' as const }
    } else {
      row.debt_id = undefined
      if (oldDebt) debtRow = { ...oldDebt, annulled: true, status: 'cancelled' as const, remaining_amount: 0, updated_at: now() }
      financeRow = {
        id: oldFinance?.id ?? id(),
        date: row.date,
        category: 'Сырьё',
        type: 'expense',
        description: `${row.material}: ${row.supplier}`,
        amount,
        payment_method: 'банк',
        supplier_person: row.supplier,
        notes: row.notes,
        linked_module: 'Приход сырья',
        linked_record_id: row.id,
        status: 'paid',
      }
    }
    const audit = auditRow('Пересчет прихода сырья', `изменил приход сырья ${row.material}. Связанный долг/расход пересчитан`)
    setData((current) => ({
      ...current,
      raw_material_receipts: current.raw_material_receipts.map((item) => (item.id === row.id ? row : item)),
      accounting_debts: debtRow ? [debtRow, ...current.accounting_debts.filter((item) => item.id !== debtRow.id)] : current.accounting_debts,
      finance_transactions: financeRow ? [financeRow, ...current.finance_transactions.filter((item) => item.id !== financeRow.id)] : current.finance_transactions,
      activity_logs: [audit, ...current.activity_logs],
    }))
    await saveRows([
      { table: 'raw_material_receipts', row },
      ...(debtRow ? [{ table: 'accounting_debts' as const, row: debtRow }] : []),
      ...(financeRow ? [{ table: 'finance_transactions' as const, row: financeRow }] : []),
      { table: 'activity_logs', row: audit },
    ])
    notify('Приход сырья изменен, связанные записи пересчитаны')
  }, [auditRow, canManage, data.accounting_debts, data.raw_material_receipts, linkedDebts, linkedFinance, notify, saveRows])

  const reverseRawMaterialReceipt = useCallback(async (rowId: string, reason = '') => {
    if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
    const receipt = data.raw_material_receipts.find((row) => row.id === rowId && !row.annulled)
    if (!receipt) return false
    const debt = receipt.debt_id ? data.accounting_debts.find((row) => row.id === receipt.debt_id && !row.annulled) : linkedDebts('Приход сырья', receipt.id)[0]
    if (debt?.paid_amount && debt.paid_amount > 0) {
      notify('Приход сырья нельзя удалить: связанный долг уже погашался. Сначала удалите погашение.')
      return false
    }
    const updatedReceipt: RawMaterialReceipt = { ...receipt, annulled: true, status: receipt.status, recalculated_at: now(), updated_at: now() }
    const debtRow = debt ? { ...debt, annulled: true, status: 'cancelled' as const, remaining_amount: 0, updated_at: now() } : undefined
    const updatedFinance = data.finance_transactions.map((row) =>
      row.linked_module === 'Приход сырья' && row.linked_record_id === receipt.id && !row.annulled
        ? { ...row, annulled: true, status: 'annulled' as const }
        : row,
    )
    const audit = auditRow('Аннулирование прихода сырья', `аннулировал приход сырья ${receipt.material}. Связанный долг/расход пересчитан${reason ? `. Причина: ${reason}` : ''}`)
    setData((current) => ({
      ...current,
      raw_material_receipts: current.raw_material_receipts.map((row) => (row.id === receipt.id ? updatedReceipt : row)),
      accounting_debts: debtRow ? current.accounting_debts.map((row) => (row.id === debtRow.id ? debtRow : row)) : current.accounting_debts,
      finance_transactions: updatedFinance,
      activity_logs: [audit, ...current.activity_logs],
    }))
    await saveRows([
      { table: 'raw_material_receipts', row: updatedReceipt },
      ...(debtRow ? [{ table: 'accounting_debts' as const, row: debtRow }] : []),
      ...updatedFinance.filter((row) => row.linked_module === 'Приход сырья' && row.linked_record_id === receipt.id).map((row) => ({ table: 'finance_transactions' as const, row })),
      { table: 'activity_logs', row: audit },
    ])
    notify('Приход сырья аннулирован, связанные записи пересчитаны')
    return true
  }, [auditRow, canManage, data.accounting_debts, data.finance_transactions, data.raw_material_receipts, linkedDebts, notify, saveRows])

  const updateDebtRepayment = useCallback(async (repayment: DebtRepayment) => {
    if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
    const old = data.debt_repayments.find((row) => row.id === repayment.id && !row.annulled)
    if (!old) return
    const debt = data.accounting_debts.find((row) => row.id === old.debt_id && !row.annulled)
    if (!debt) return
    const available = debt.remaining_amount + old.amount
    const nextAmount = Math.min(Math.max(repayment.amount, 0), available)
    const nextPaid = Math.max(debt.paid_amount - old.amount + nextAmount, 0)
    const nextRemaining = Math.max(debt.amount - nextPaid, 0)
    const updatedDebt: AccountingDebt = { ...debt, paid_amount: nextPaid, remaining_amount: nextRemaining, status: debtStatus(nextRemaining, nextPaid), updated_at: now() }
    const updatedRepayment: DebtRepayment = { ...old, ...repayment, amount: nextAmount, updated_at: now() }
    const finance = old.finance_transaction_id ? data.finance_transactions.find((row) => row.id === old.finance_transaction_id) : undefined
    const updatedFinance: FinanceTransaction | undefined = finance ? { ...finance, amount: nextAmount, date: updatedRepayment.date, notes: updatedRepayment.notes, status: 'paid' } : undefined
    const audit = auditRow('Пересчет погашения долга', `изменил погашение долга ${debt.counterparty}. Остаток долга пересчитан`)
    setData((current) => ({
      ...current,
      accounting_debts: current.accounting_debts.map((row) => (row.id === debt.id ? updatedDebt : row)),
      debt_repayments: current.debt_repayments.map((row) => (row.id === old.id ? updatedRepayment : row)),
      finance_transactions: updatedFinance ? current.finance_transactions.map((row) => (row.id === updatedFinance.id ? updatedFinance : row)) : current.finance_transactions,
      activity_logs: [audit, ...current.activity_logs],
    }))
    await saveRows([
      { table: 'accounting_debts', row: updatedDebt },
      { table: 'debt_repayments', row: updatedRepayment },
      ...(updatedFinance ? [{ table: 'finance_transactions' as const, row: updatedFinance }] : []),
      { table: 'activity_logs', row: audit },
    ])
    notify('Погашение изменено, долг пересчитан')
  }, [auditRow, canManage, data.accounting_debts, data.debt_repayments, data.finance_transactions, notify, saveRows])

  const reverseDebtRepayment = useCallback(async (rowId: string, reason = '') => {
    if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
    const repayment = data.debt_repayments.find((row) => row.id === rowId && !row.annulled)
    if (!repayment) return false
    const debt = data.accounting_debts.find((row) => row.id === repayment.debt_id && !row.annulled)
    if (!debt) return false
    const nextPaid = Math.max(debt.paid_amount - repayment.amount, 0)
    const nextRemaining = Math.max(debt.amount - nextPaid, 0)
    const updatedDebt: AccountingDebt = { ...debt, paid_amount: nextPaid, remaining_amount: nextRemaining, status: debtStatus(nextRemaining, nextPaid), updated_at: now() }
    const updatedRepayment: DebtRepayment = { ...repayment, annulled: true, updated_at: now() }
    const updatedFinance = repayment.finance_transaction_id
      ? data.finance_transactions.map((row) => (row.id === repayment.finance_transaction_id ? { ...row, annulled: true, status: 'annulled' as const } : row))
      : data.finance_transactions
    const audit = auditRow('Аннулирование погашения долга', `аннулировал погашение долга ${debt.counterparty}. Долг и приход/расход пересчитаны${reason ? `. Причина: ${reason}` : ''}`)
    setData((current) => ({
      ...current,
      accounting_debts: current.accounting_debts.map((row) => (row.id === debt.id ? updatedDebt : row)),
      debt_repayments: current.debt_repayments.map((row) => (row.id === repayment.id ? updatedRepayment : row)),
      finance_transactions: updatedFinance,
      activity_logs: [audit, ...current.activity_logs],
    }))
    await saveRows([
      { table: 'accounting_debts', row: updatedDebt },
      { table: 'debt_repayments', row: updatedRepayment },
      ...updatedFinance.filter((row) => row.id === repayment.finance_transaction_id).map((row) => ({ table: 'finance_transactions' as const, row })),
      { table: 'activity_logs', row: audit },
    ])
    notify('Погашение аннулировано, долг пересчитан')
    return true
  }, [auditRow, canManage, data.accounting_debts, data.debt_repayments, data.finance_transactions, notify, saveRows])

  const api = useMemo(
    () => ({
      addClient: async (client: Omit<Client, 'id' | 'updated_at'>, initialBarter?: InitialBarterAsset) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const initialCash = Math.max(client.total_paid ?? 0, 0)
        const barterValue = Math.max(initialBarter?.market_value ?? 0, 0)
        const row: Client = { ...client, id: id(), updated_at: now(), total_supplied_m3: 0, total_paid: initialCash, cash_available: initialCash, total_barter_value: barterValue }
        const asset: BarterAsset | undefined = initialBarter && barterValue > 0 ? {
          id: id(),
          client_id: row.id,
          type: initialBarter.type,
          asset_name: initialBarter.asset_name || 'Бартерный актив',
          market_value: barterValue,
          cost_price: 0,
          contract_number: initialBarter.contract_number,
          linked_contract_amount: row.contract_total ?? barterValue,
          cash_paid: 0,
          barter_value: barterValue,
          total_paid_value: barterValue,
          remaining_debt: Math.max((row.contract_total ?? barterValue) - barterValue, 0),
          asset_status: 'active',
          used_amount: 0,
          remaining_amount: barterValue,
          status: 'active',
          photos: [],
          comment: initialBarter.comment ?? '',
          source_client_name: row.name,
          created_at: now(),
          updated_at: now(),
        } : undefined
        setData((current) => ({ ...current, clients: [row, ...current.clients], barter_assets: asset ? [asset, ...current.barter_assets] : current.barter_assets }))
        await saveRow('clients', row)
        if (asset) await saveRow('barter_assets', asset)
        notify(asset ? 'Клиент и бартерный актив сохранены' : 'Клиент сохранен')
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
      addDebt: async (debt: Omit<AccountingDebt, 'id' | 'paid_amount' | 'remaining_amount' | 'status' | 'created_at' | 'updated_at'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const row: AccountingDebt = {
          ...debt,
          id: id(),
          paid_amount: 0,
          remaining_amount: Math.max(debt.amount, 0),
          status: 'open',
          created_at: now(),
          updated_at: now(),
        }
        setData((current) => ({ ...current, accounting_debts: [row, ...current.accounting_debts] }))
        await saveRow('accounting_debts', row)
        notify('Долг создан')
      },
      repayDebt: async (debtId: string, amount: number, date = new Date().toISOString().slice(0, 10), notes = '') => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const debt = data.accounting_debts.find((item) => item.id === debtId && !item.annulled)
        if (!debt || amount <= 0) return
        const paidNow = Math.min(amount, debt.remaining_amount)
        const nextPaid = debt.paid_amount + paidNow
        const nextRemaining = Math.max(debt.amount - nextPaid, 0)
        const finance: FinanceTransaction = {
          id: id(),
          client_id: debt.client_id,
          date,
          category: 'Погашение долга',
          type: debt.type === 'receivable' ? 'income' : 'expense',
          description: `${debt.type === 'receivable' ? 'Они должны' : 'Мы должны'}: ${debt.counterparty}`,
          amount: paidNow,
          payment_method: 'банк',
          notes,
          linked_module: 'Долги',
          linked_record_id: debt.id,
          status: 'paid',
        }
        const repayment: DebtRepayment = {
          id: id(),
          debt_id: debt.id,
          date,
          amount: paidNow,
          direction: debt.type,
          notes,
          finance_transaction_id: finance.id,
          created_at: now(),
        }
        const updatedDebt: AccountingDebt = {
          ...debt,
          paid_amount: nextPaid,
          remaining_amount: nextRemaining,
          status: debtStatus(nextRemaining, nextPaid),
          updated_at: now(),
        }
        setData((current) => ({
          ...current,
          accounting_debts: current.accounting_debts.map((item) => (item.id === debt.id ? updatedDebt : item)),
          debt_repayments: [repayment, ...current.debt_repayments],
          finance_transactions: [finance, ...current.finance_transactions],
        }))
        await saveRow('accounting_debts', updatedDebt)
        await saveRow('debt_repayments', repayment)
        await saveRow('finance_transactions', finance)
        notify(nextRemaining === 0 ? 'Долг полностью погашен' : 'Погашение долга сохранено')
      },
      addRawMaterialReceipt: async (receipt: Omit<RawMaterialReceipt, 'id' | 'amount' | 'debt_id' | 'created_at' | 'updated_at'>) => {
        if (!canManage) return notify('Недостаточно прав: доступ только для просмотра')
        const amount = Math.max(receipt.quantity, 0) * Math.max(receipt.price, 0)
        const row: RawMaterialReceipt = { ...receipt, id: id(), amount, created_at: now(), updated_at: now() }
        let debt: AccountingDebt | undefined
        let finance: FinanceTransaction | undefined
        if (receipt.status === 'debt') {
          debt = {
            id: id(),
            type: 'payable',
            counterparty: receipt.supplier,
            source_module: 'Приход сырья',
            source_record_id: row.id,
            date: receipt.date,
            amount,
            paid_amount: 0,
            remaining_amount: amount,
            status: 'open',
            notes: `${receipt.material} · ${receipt.quantity} ${receipt.unit}`,
            created_at: now(),
            updated_at: now(),
          }
          row.debt_id = debt.id
        } else {
          finance = {
            id: id(),
            date: receipt.date,
            category: 'Сырьё',
            type: 'expense',
            description: `${receipt.material}: ${receipt.supplier}`,
            amount,
            payment_method: 'банк',
            supplier_person: receipt.supplier,
            notes: receipt.notes,
            linked_module: 'Приход сырья',
            linked_record_id: row.id,
            status: 'paid',
          }
        }
        setData((current) => ({
          ...current,
          raw_material_receipts: [row, ...current.raw_material_receipts],
          accounting_debts: debt ? [debt, ...current.accounting_debts] : current.accounting_debts,
          finance_transactions: finance ? [finance, ...current.finance_transactions] : current.finance_transactions,
        }))
        await saveRow('raw_material_receipts', row)
        if (debt) await saveRow('accounting_debts', debt)
        if (finance) await saveRow('finance_transactions', finance)
        notify(receipt.status === 'debt' ? 'Приход сырья сохранен и создан долг поставщику' : 'Приход сырья сохранен')
      },
      updateConcreteSale,
      updateRawMaterialReceipt,
      updateDebtRepayment,
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
        const cashReceivedNow = Math.min(Math.max(delivery.cash_received_now ?? 0, 0), totalAmount)
        const cashCovered = Math.min(cashAmount, cashReceivedNow)
        const extraCash = Math.max(cashReceivedNow - cashCovered, 0)
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
          cash_received_now: cashReceivedNow,
          barter_amount: barterAmount,
          barter_asset_allocations: allocations,
          transport_cost: delivery.transport_cost ?? 0,
          trip_count: delivery.trip_count ?? 0,
          comment: delivery.comment ?? '',
          status: 'unpaid',
        }
        const financeRow: FinanceTransaction | undefined = cashReceivedNow > 0 ? {
          id: id(),
          client_id: client.id,
          date: delivery.date,
          category: 'Продажа бетона',
          type: 'income',
          description: `${client.name}: ${delivery.object_name}, ${delivery.volume_m3} м³ ${delivery.concrete_grade}`,
          amount: cashReceivedNow,
          payment_method: 'наличные',
          linked_module: 'Продажи бетона',
          linked_record_id: row.id,
          status: 'paid',
        } : undefined
        const totalDebt = cashDebt + barterDebt
        const debtRow: AccountingDebt | undefined = totalDebt > 0 ? {
          id: id(),
          type: 'receivable',
          counterparty: client.name,
          client_id: client.id,
          source_module: 'Продажи бетона',
          source_record_id: row.id,
          date: delivery.date,
          amount: totalDebt,
          paid_amount: 0,
          remaining_amount: totalDebt,
          status: 'open',
          notes: `Накладная: ${delivery.object_name}. Наличный долг ${moneyText(cashDebt)}, бартерный долг ${moneyText(barterDebt)}`,
          created_at: now(),
          updated_at: now(),
        } : undefined
        const nextCashAvailable = Math.max(client.cash_available ?? 0, 0) + extraCash
        const nextDebt = Math.max(Math.abs(Math.min(client.balance, 0)) + cashDebt + barterDebt, 0)
        const updatedClient: Client = {
          ...client,
          balance: client.balance - cashDebt - barterDebt,
          cash_available: nextCashAvailable,
          total_paid: (client.total_paid ?? 0) + cashReceivedNow,
          total_supplied_m3: (client.total_supplied_m3 ?? 0) + row.volume_m3,
          total_barter_value: client.total_barter_value ?? 0,
          status: clientBalanceStatus(nextCashAvailable, nextDebt),
          updated_at: now(),
        }
        setData((current) => ({
          ...current,
          client_reports: [row, ...current.client_reports],
          barter_assets: current.barter_assets.map((asset) => updatedAssets.find((updated) => updated.id === asset.id) ?? asset),
          finance_transactions: financeRow ? [financeRow, ...current.finance_transactions] : current.finance_transactions,
          accounting_debts: debtRow ? [debtRow, ...current.accounting_debts] : current.accounting_debts,
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
        if (financeRow) await saveRow('finance_transactions', financeRow)
        if (debtRow) await saveRow('accounting_debts', debtRow)
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
        if (table === 'client_reports') return reverseConcreteSale(rowId, reason)
        if (table === 'raw_material_receipts') return reverseRawMaterialReceipt(rowId, reason)
        if (table === 'debt_repayments') return reverseDebtRepayment(rowId, reason)
        if (table === 'finance_transactions') {
          const repayment = data.debt_repayments.find((row) => row.finance_transaction_id === rowId && !row.annulled)
          if (repayment) return reverseDebtRepayment(repayment.id, reason)
        }
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
          accounting_debts: [],
          debt_repayments: [],
          raw_material_receipts: [],
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
    [archiveRow, canManage, data.accounting_debts, data.barter_assets, data.clients, data.debt_repayments, data.invoices, data.payment_receipts.length, data.profile.full_name, notify, reverseConcreteSale, reverseDebtRepayment, reverseRawMaterialReceipt, saveRow, updateConcreteSale, updateDebtRepayment, updateRawMaterialReceipt],
  )

  return { data, setData, loading, toast, notify, canManage, api }
}
