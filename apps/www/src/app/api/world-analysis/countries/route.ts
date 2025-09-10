export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const externalUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
  try {
    // Try local file first if present (public/geo/countries.geojson)
    // Note: In Next.js app router, reading from public over fetch keeps consistent behavior
    let data: unknown = null
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '')
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      if (appUrl) {
        const local = await fetch(`${appUrl}/geo/countries.geojson`, { cache: 'no-store' })
        if (local.ok) {
          data = await local.json()
        }
      }
    } catch {}
    if (!data) {
      const res = await fetch(externalUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Upstream failed: ${res.status}`)
      data = await res.json()
    }
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      status: 200,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: 'Failed to load countries.geojson', details: msg }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      status: 502,
    })
  }
}


