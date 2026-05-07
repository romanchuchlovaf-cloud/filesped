export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const size = Math.min(parseInt(url.searchParams.get('size') || '1048576'), 10 * 1024 * 1024) // макс 10MB

  const chunk = new Uint8Array(size).fill(65)

  return new Response(chunk, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': size.toString(),
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
