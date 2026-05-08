export const config = { runtime: 'edge' }

export default async function handler(req) {
  // VERCEL_REGION — регион сервера (fra1, iad1, sfo1 и т.д.)
  // x-vercel-ip-* — данные о клиенте (его IP, страна, город)
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'Unknown'

  const info = {
    // Данные СЕРВЕРА Vercel
    region: process.env.VERCEL_REGION || 'fra1',

    // Данные КЛИЕНТА (тебя)
    clientIP,
    country: req.headers.get('x-vercel-ip-country') || 'Unknown',
    city: decodeURIComponent(req.headers.get('x-vercel-ip-city') || 'Unknown'),
    timezone: req.headers.get('x-vercel-ip-timezone') || 'Unknown',
    latitude: req.headers.get('x-vercel-ip-latitude') || 'Unknown',
    longitude: req.headers.get('x-vercel-ip-longitude') || 'Unknown',

    userAgent: req.headers.get('user-agent') || 'Unknown',
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
