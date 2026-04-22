import { NextResponse } from 'next/server'
import { getValidAccessToken, getTokens } from '@/lib/tokens'
import { getUserInfo } from '@/lib/meli'

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

export async function GET() {
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tokenData = await getTokens()
    const userId = tokenData!.user_id

    const [ids, userInfo] = await Promise.all([
      getItemIds(accessToken, userId),
      getUserInfo(accessToken),
    ])

    const items = await getItemDetails(accessToken, ids)

    const categoryIds = items.map((i) => i.category_id as string).filter(Boolean)
    const categoryNames = await getCategoryNames(accessToken, categoryIds)

    const itemsWithCategory = items.map((i) => {
      const title = i.title as string
      const shipping = i.shipping as { free_shipping?: boolean; local_pick_up?: boolean } | undefined
      const attrs = i.attributes as Array<{ id: string; value_name?: string }> | undefined
      const sku = (i.seller_custom_field as string | null) ?? extractAttrValue(attrs, 'SELLER_SKU')
      const brand = extractAttrValue(attrs, 'BRAND')
      const unitsPack = extractAttrValue(attrs, 'UNITS_PER_PACK') ?? extractAttrValue(attrs, 'PACK_QUANTITY')
      const groupKey = sku ? `sku:${sku}` : normalizeTitle(title)
      const variantLabel = extractVariantLabel(title)

      const tags = i.tags as string[] | undefined ?? []

      const conditions: string[] = []
      if (shipping?.free_shipping) conditions.push('Envío gratis')
      else conditions.push('Envío pago')
      if (shipping?.local_pick_up) conditions.push('Retiro en local')

      const saleTerms = i.sale_terms as Array<{ id: string; value_name?: string }> | undefined ?? []
      const installmentsCampaign = saleTerms.find((t) => t.id === 'INSTALLMENTS_CAMPAIGN')?.value_name
      const financing = installmentsCampaign ?? (tags.includes('pcj-co-funded') ? 'pcj-co-funded' : null)

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
        sku: sku ?? undefined,
        brand: brand ?? undefined,
        units_per_pack: unitsPack ?? undefined,
      }
    })

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
