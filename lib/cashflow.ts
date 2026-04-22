import redis from './redis'

export interface CashflowEntry {
  id: string
  date: string      // YYYY-MM-DD
  amount: number    // always positive
  description: string
}

const KEYS = {
  disponible: 'cashflow:disponible',
  egresos: 'cashflow:egresos',
  aportes: 'cashflow:aportes',
}

// --- Disponible ---

export async function getDisponible(): Promise<number> {
  const raw = await redis.get(KEYS.disponible)
  return raw ? parseFloat(raw) : 0
}

export async function setDisponible(amount: number): Promise<void> {
  await redis.set(KEYS.disponible, String(amount))
}

// --- Generic entry helpers ---

async function getEntries(key: string): Promise<CashflowEntry[]> {
  const raw = await redis.get(key)
  if (!raw) return []
  try { return JSON.parse(raw) as CashflowEntry[] } catch { return [] }
}

async function saveEntries(key: string, entries: CashflowEntry[]): Promise<void> {
  await redis.set(key, JSON.stringify(entries))
}

// --- Egresos ---

export async function getEgresos(): Promise<CashflowEntry[]> {
  return getEntries(KEYS.egresos)
}

export async function addEgreso(entry: Omit<CashflowEntry, 'id'>): Promise<CashflowEntry> {
  const entries = await getEgresos()
  const newEntry = { ...entry, id: `egr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }
  await saveEntries(KEYS.egresos, [...entries, newEntry])
  return newEntry
}

export async function deleteEgreso(id: string): Promise<void> {
  const entries = await getEgresos()
  await saveEntries(KEYS.egresos, entries.filter((e) => e.id !== id))
}

// --- Aportes ---

export async function getAportes(): Promise<CashflowEntry[]> {
  return getEntries(KEYS.aportes)
}

export async function addAporte(entry: Omit<CashflowEntry, 'id'>): Promise<CashflowEntry> {
  const entries = await getAportes()
  const newEntry = { ...entry, id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }
  await saveEntries(KEYS.aportes, [...entries, newEntry])
  return newEntry
}

export async function deleteAporte(id: string): Promise<void> {
  const entries = await getAportes()
  await saveEntries(KEYS.aportes, entries.filter((e) => e.id !== id))
}
