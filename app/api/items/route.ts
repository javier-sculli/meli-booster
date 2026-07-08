import { NextResponse } from 'next/server'
import { getValidAccessToken, getTokens } from '@/lib/tokens'
import { getUserInfo } from '@/lib/meli'
import redis from '@/lib/redis'

const MELI_API_URL = 'https://api.mercadolibre.com'
const ITEM_ATTRIBUTES = 'id,title,price,available_quantity,sold_quantity,status,thumbnail,permalink,health,condition,listing_type_id,category_id,shipping,seller_custom_field,attributes,sale_terms,tags'

const STOP_WORDS = new Set([
  // talles
  'xs','s','m','l','xl','xxl','talle','chico','grande','extra','eg','xg','g','unico','único',
  // colores
  'blanco','negro','naranja','celeste','azul','violeta','transparente',
  'blancas','verdes','azules','verde','rojo','rosa','amarillo','gris','marron',
  'blancos','negros',
  // preposiciones / artículos
  'de','del','con','para','en','x','a','al','por','sin','y','o','un','una','el','la','los','las','u',
  // cantidades / packaging
  'unidades','unidad','cajas','caja','cajon','cajón','pack','paquetes','paquete',
  'bulto','kit','pares','par','caja','bolsa','bolsas',
  // certificaciones / filler
  'anmat','c','calidad','premium','primera','1°','hipoalergenicos','hipoalergenico',
  'hipoalergénicos','hipoalergénico','antideslizantes','antideslizante',
  'descartables','descartable','examinacion','examinación',
])

function extractAttrValue(
  attributes: Array<{ id: string; value_name?: string }> | undefined,
  attrId: string
): string | null {
  return attributes?.find((a) => a.id === attrId)?.value_name ?? null
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/\bx\s*\d+\s*\w*/g, '')                   // quitar pack size: x100, x100unids, x 50 u
    .replace(/\d+/g, '')                                // quitar números sueltos
    .split(/[\s\-\/\(\)\.]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    // normalizar plural simple: "guantes" → "guante", "reforzados" → "reforzado"
    .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
    .sort()                                             // orden independiente
    .join(' ')
}

function extractVariantLabel(title: string): string {
  const match = title.match(/\s+((?:(?:blanco|negro|naranja|celeste|azul|violeta|transparente)\s*)?(?:xs|s|m|l|xl|xxl|chico|grande|extra\s*grande|eg|xg|g|único|unico)?)\s*$/i)
  const label = match?.[1]?.trim()
  if (label) return label
  // fallback: last 2 words if they look like variant tokens
  const parts = title.trim().split(/\s+/)
  return parts.slice(-2).join(' ')
}

async function getItemIds(accessToken: string, userId: number): Promise<string[]> {
  const ids: string[] = []
  let offset = 0
  const limit = 50

  while (true) {
    const res = await fetch(
      `${MELI_API_URL}/users/${userId}/items/search?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, next: { revalidate: 0 } }
    )
    if (!res.ok) throw new Error(`Items search failed: ${res.status}`)
    const data = await res.json()
    ids.push(...data.results)
    if (ids.length >= data.paging.total) break
    offset += limit
  }

  return ids
}

async function getItemDetails(accessToken: string, ids: string[]) {
  // MeLi multiget allows max 20 items per request
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 20) {
    chunks.push(ids.slice(i, i + 20))
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      fetch(
        `${MELI_API_URL}/items?ids=${chunk.join(',')}&attributes=${ITEM_ATTRIBUTES}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, next: { revalidate: 0 } }
      ).then((r) => r.json())
    )
  )

  return results.flat().map((r: { code: number; body: unknown }) => r.body).filter(Boolean) as Record<string, unknown>[]
}

async function getCategoryNames(accessToken: string, categoryIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(categoryIds)]
  const results = await Promise.all(
    unique.map((id) =>
      fetch(`${MELI_API_URL}/categories/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => r.json())
        .then((c) => [id, c.name as string] as const)
        .catch(() => [id, id] as const)
    )
  )
  return Object.fromEntries(results)
}

async function getSingleItemVisits(
  accessToken: string,
  itemId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<number> {
  const cacheKey = dateFrom && dateTo ? `visits:${itemId}:${dateFrom}:${dateTo}` : `visits:${itemId}`
  try {
    const cached = await redis.get(cacheKey)
    if (cached !== null) {
      return Number(cached)
    }
  } catch (err) {
    console.error('Redis error for item visits:', err)
  }

  try {
    const url = dateFrom && dateTo
      ? `https://api.mercadolibre.com/items/${itemId}/visits?date_from=${dateFrom}&date_to=${dateTo}`
      : `https://api.mercadolibre.com/visits/items?ids=${itemId}`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      const count = dateFrom && dateTo ? (Number(data.total_visits) || 0) : (Number(data[itemId]) || 0)
      await redis.setex(cacheKey, 7200, String(count)) // Cache for 2 hours
      return count
    }
  } catch (err) {
    console.error(`Failed to fetch visits for item ${itemId}:`, err)
  }

  return 0
}

async function getItemVisits(
  accessToken: string,
  ids: string[],
  dateFrom?: string,
  dateTo?: string
): Promise<Record<string, number>> {
  if (ids.length === 0) return {}
  const visitsMap: Record<string, number> = {}
  const chunkSize = 25
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const results = await Promise.all(
      chunk.map(async (id) => {
        const count = await getSingleItemVisits(accessToken, id, dateFrom, dateTo)
        return { id, count }
      })
    )
    for (const r of results) {
      visitsMap[r.id] = r.count
    }
    if (i + chunkSize < ids.length) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  return visitsMap
}

async function getSalesQuantityByItem(
  accessToken: string,
  userId: number,
  dateFrom: string,
  dateTo: string
): Promise<Record<string, number>> {
  const salesMap: Record<string, number> = {}
  let offset = 0
  const limit = 50
  let hasMore = true

  while (hasMore) {
    const url = `https://api.mercadolibre.com/orders/search?seller=${userId}&date_created_from=${dateFrom}T00:00:00.000Z&date_created_to=${dateTo}T23:59:59.000Z&limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!res.ok) {
      break
    }

    const data = await res.json()
    const results = data.results || []

    for (const order of results) {
      const items = order.order_items || []
      for (const item of items) {
        const itemId = item.item?.id
        const qty = Number(item.quantity) || 0
        if (itemId) {
          salesMap[itemId] = (salesMap[itemId] || 0) + qty
        }
      }
    }

    if (results.length < limit) {
      hasMore = false
    } else {
      offset += limit
      if (offset >= 500) {
        hasMore = false
      }
    }
  }

  return salesMap
}

async function getCachedSalesQuantityByItem(
  accessToken: string,
  userId: number,
  dateFrom: string,
  dateTo: string
): Promise<Record<string, number>> {
  const cacheKey = `sales_by_item:${userId}:${dateFrom}:${dateTo}`
  try {
    const cached = await redis.get(cacheKey)
    if (cached !== null) {
      return JSON.parse(cached)
    }
  } catch (err) {
    console.error('Redis error reading sales by item:', err)
  }

  const salesMap = await getSalesQuantityByItem(accessToken, userId, dateFrom, dateTo)

  try {
    await redis.setex(cacheKey, 7200, JSON.stringify(salesMap))
  } catch (err) {
    console.error('Redis error writing sales by item:', err)
  }

  return salesMap
}

export async function GET(request: Request) {
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    const tokenData = await getTokens()
    const userId = tokenData!.user_id

    const [ids, userInfo, rawCosts] = await Promise.all([
      getItemIds(accessToken, userId),
      getUserInfo(accessToken),
      redis.hgetall('sku_costs').then((res) => res || {}),
    ])

    let dateFrom: string | undefined
    let dateTo: string | undefined

    if (period !== 'hist') {
      const days = period === '7d' ? 7 : period === '60d' ? 60 : 30
      const toDate = new Date()
      const fromDate = new Date()
      fromDate.setDate(toDate.getDate() - days)
      dateTo = toDate.toISOString().split('T')[0]
      dateFrom = fromDate.toISOString().split('T')[0]
    }

    const [items, visitsMap, salesMap] = await Promise.all([
      getItemDetails(accessToken, ids),
      getItemVisits(accessToken, ids, dateFrom, dateTo),
      dateFrom && dateTo
        ? getCachedSalesQuantityByItem(accessToken, userId, dateFrom, dateTo)
        : Promise.resolve({} as Record<string, number>),
    ])

    const categoryIds = items.map((i) => i.category_id as string).filter(Boolean)
    const categoryNames = await getCategoryNames(accessToken, categoryIds)

    const itemSkuMappings: Record<string, string> = {}
    const itemsWithCategory = items.map((i) => {
      const title = i.title as string
      const shipping = i.shipping as { free_shipping?: boolean; local_pick_up?: boolean } | undefined
      const attrs = i.attributes as Array<{ id: string; value_name?: string }> | undefined
      const rawSku = (i.seller_custom_field as string | null) ?? extractAttrValue(attrs, 'SELLER_SKU')
      const sku = rawSku || (i.id as string)
      const brand = extractAttrValue(attrs, 'BRAND')
      const unitsPack = extractAttrValue(attrs, 'UNITS_PER_PACK') ?? extractAttrValue(attrs, 'PACK_QUANTITY')
      const groupKey = rawSku ? `sku:${rawSku}` : normalizeTitle(title)
      const variantLabel = extractVariantLabel(title)

      const tags = i.tags as string[] | undefined ?? []

      const conditions: string[] = []
      if (shipping?.free_shipping) conditions.push('Envío gratis')
      else conditions.push('Envío pago')
      if (shipping?.local_pick_up) conditions.push('Retiro en local')

      const saleTerms = i.sale_terms as Array<{ id: string; value_name?: string }> | undefined ?? []
      const installmentsCampaign = saleTerms.find((t) => t.id === 'INSTALLMENTS_CAMPAIGN')?.value_name
      const financing = installmentsCampaign ?? (tags.includes('pcj-co-funded') ? 'pcj-co-funded' : null)

      const cost = sku ? (parseFloat(rawCosts[sku]) || 0) : 0
      const visits = visitsMap[i.id as string] ?? 0
      const sold_quantity = period === 'hist' ? (Number(i.sold_quantity) || 0) : (salesMap[i.id as string] || 0)

      if (i.id && sku && sku !== i.id) {
        itemSkuMappings[i.id as string] = sku
      }

      return {
        ...i,
        attributes: undefined,
        tags: undefined,
        sale_terms: undefined,
        category_name: categoryNames[i.category_id as string] ?? i.category_id,
        group_key: groupKey,
        variant_label: variantLabel,
        sale_conditions: conditions.join(' · '),
        financing: financing ?? undefined,
        sku: sku || undefined,
        cost: cost || undefined,
        brand: brand ?? undefined,
        units_per_pack: unitsPack ?? undefined,
        visits,
        sold_quantity,
      }
    })

    if (Object.keys(itemSkuMappings).length > 0) {
      await redis.hset('item_to_sku', itemSkuMappings)
    }

    return NextResponse.json({
      items: itemsWithCategory,
      total: items.length,
      user: {
        id: userInfo.id,
        nickname: userInfo.nickname,
        first_name: userInfo.first_name,
      },
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Items fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}
