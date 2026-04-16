import { NextResponse } from 'next/server'
import { getValidAccessToken, getTokens } from '@/lib/tokens'
import { getUserInfo } from '@/lib/meli'

const MELI_API_URL = 'https://api.mercadolibre.com'
const ITEM_ATTRIBUTES = 'id,title,price,available_quantity,sold_quantity,status,thumbnail,permalink,health,condition,listing_type_id'

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

  return results.flat().map((r: { code: number; body: unknown }) => r.body).filter(Boolean)
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

    return NextResponse.json({
      items,
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
