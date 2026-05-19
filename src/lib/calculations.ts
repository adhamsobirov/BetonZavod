import type { DailyReport, ExcavationReport } from '../types'

export const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0) + ' сомони'

export const numberRu = (value: number, digits = 0) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0)

export const dailyTotals = (report: DailyReport) => {
  const income = report.items.reduce((sum, item) => sum + item.volume_m3 * item.price, 0)
  const expenses = report.salary_expense + report.fuel_expense
  const profit = income - expenses
  return {
    income,
    expenses,
    profit,
    profitability: income ? (profit / income) * 100 : 0,
    volume: report.items.reduce((sum, item) => sum + item.volume_m3, 0),
  }
}

export const excavationTotals = (report: ExcavationReport) => {
  const workIncome = report.excavation_m3 * report.price_per_m3
  const tripIncome = report.trip_count * report.price_per_trip
  const totalIncome = workIncome + tripIncome
  const dieselCost = report.diesel_liters * report.diesel_price
  const totalExpenses = dieselCost + report.worker_salary + report.machinery_rent + report.other_expenses
  const profit = totalIncome - totalExpenses
  const debt = totalIncome - report.received_payment

  return { workIncome, tripIncome, totalIncome, dieselCost, totalExpenses, profit, debt }
}

export const aggregateExcavation = (reports: ExcavationReport[]) =>
  reports.reduce(
    (acc, report) => {
      const totals = excavationTotals(report)
      acc.totalIncome += totals.totalIncome
      acc.totalExpenses += totals.totalExpenses
      acc.netProfit += totals.profit
      acc.totalExcavation += report.excavation_m3
      acc.totalBackfill += report.backfill_m3
      acc.totalTrips += report.trip_count
      acc.totalDieselCost += totals.dieselCost
      acc.totalSalaries += report.worker_salary
      acc.totalDebt += Math.max(totals.debt, 0)
      return acc
    },
    {
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      totalExcavation: 0,
      totalBackfill: 0,
      totalTrips: 0,
      totalDieselCost: 0,
      totalSalaries: 0,
      totalDebt: 0,
    },
  )
