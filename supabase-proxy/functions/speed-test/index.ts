Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    })
  }

  const url = new URL(req.url)
  const size = Math.min(parseInt(url.searchParams.get('size') || '1048576'), 10 * 1024 * 1024)

  return new Response(new Uint8Array(size).fill(65), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': size.toString(),
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
    }
  })
})
