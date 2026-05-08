Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    })
  }

  // Server info: /functions/v1/proxy/server-info
  if (url.pathname.endsWith('/server-info')) {
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || 'Unknown'
    
    const info = {
      platform: 'Supabase Edge Functions',
      region: Deno.env.get('SUPABASE_REGION') || 'Unknown',
      clientIP,
    }
    
    return new Response(JSON.stringify(info, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }

  // Тест скорости: /functions/v1/proxy/speed-test
  if (url.pathname.endsWith('/speed-test')) {
    const size = Math.min(parseInt(url.searchParams.get('size') || '1048576'), 10 * 1024 * 1024)
    return new Response(new Uint8Array(size).fill(65), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': size.toString(),
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }

  // Скачивание: /functions/v1/proxy/download?url=...
  if (url.pathname.endsWith('/download')) {
    const fileUrl = url.searchParams.get('url')
    if (!fileUrl) return new Response('Ошибка: не указан URL', {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })

    try {
      new URL(fileUrl)
      const isPixeldrain = fileUrl.includes('pixeldrain.com')

      const downloadHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      }

      let fetchUrl = fileUrl

      if (isPixeldrain) {
        const m = fetchUrl.match(/\/api\/file\/([a-zA-Z0-9]+)/) || fetchUrl.match(/\/u\/([a-zA-Z0-9]+)/)
        if (m?.[1]) {
          fetchUrl = `https://pixeldrain.com/api/file/${m[1]}`
          downloadHeaders['Referer'] = `https://pixeldrain.com/u/${m[1]}`
          downloadHeaders['Range'] = 'bytes=0-'
        }
      }

      let response = await fetch(fetchUrl, { headers: downloadHeaders, redirect: 'follow' })

      if ((response.status === 403 || response.status === 416) && isPixeldrain) {
        const h = { ...downloadHeaders, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0' }
        delete h['Range']
        response = await fetch(fetchUrl + '?download', { headers: h, redirect: 'follow' })
      }

      if (response.status === 403 && isPixeldrain) {
        response = await fetch(fetchUrl, {
          headers: { 'User-Agent': 'Wget/1.21.1', 'Referer': 'https://pixeldrain.com/' },
          redirect: 'follow'
        })
      }

      if (!response.ok) {
        return new Response(`Ошибка: ${response.status} ${response.statusText}`, {
          status: response.status,
          headers: { 'Access-Control-Allow-Origin': '*' }
        })
      }

      let filename = 'download'
      const cd = response.headers.get('content-disposition')
      if (cd) {
        const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (m?.[1]) filename = m[1].replace(/['"]/g, '')
      } else {
        const p = new URL(fileUrl).pathname.split('/').pop()
        if (p) filename = decodeURIComponent(p)
      }

      const headers = new Headers()
      headers.set('Content-Disposition', `attachment; filename="${filename}"`)
      headers.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
      headers.set('Accept-Ranges', 'bytes')
      headers.set('Cache-Control', 'public, max-age=86400')
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range')

      const cl = response.headers.get('content-length')
      if (cl) headers.set('Content-Length', cl)
      const cr = response.headers.get('content-range')
      if (cr) headers.set('Content-Range', cr)

      return new Response(response.body, { status: 200, headers })

    } catch (e) {
      return new Response(`Ошибка: ${(e as Error).message}`, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }
  }

  return new Response('OK', {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
})
