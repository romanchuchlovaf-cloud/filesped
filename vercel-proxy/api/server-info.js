export const config = { runtime: 'edge' }

export default async function handler(req) {
  const info = {
    region: process.env.VERCEL_REGION || req.headers.get('x-vercel-deployment-url') || 'Unknown',
    clientIP: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown',
    userAgent: req.headers.get('user-agent') || 'Unknown',
    country: req.headers.get('x-vercel-ip-country') || 'Unknown',
    city: req.headers.get('x-vercel-ip-city') || 'Unknown',
    timezone: req.headers.get('x-vercel-ip-timezone') || 'Unknown',
    latitude: req.headers.get('x-vercel-ip-latitude') || 'Unknown',
    longitude: req.headers.get('x-vercel-ip-longitude') || 'Unknown',
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
