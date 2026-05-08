export default async (req, context) => {
  const clientIP = context.ip || 'Unknown'
  
  const info = {
    platform: 'Netlify Edge',
    region: context.geo?.city || 'Unknown',
    country: context.geo?.country?.name || 'Unknown',
    city: context.geo?.city || 'Unknown',
    timezone: context.geo?.timezone || 'Unknown',
    clientIP,
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
