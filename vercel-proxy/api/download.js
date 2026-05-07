export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    })
  }

  const fileUrl = url.searchParams.get('url')

  if (!fileUrl) {
    return new Response('Ошибка: не указан URL файла', { status: 400 })
  }

  try {
    new URL(fileUrl)

    const isPixeldrain = fileUrl.includes('pixeldrain.com')

    const downloadHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    }

    let fetchUrl = fileUrl

    if (isPixeldrain) {
      const fileIdMatch = fetchUrl.match(/\/api\/file\/([a-zA-Z0-9]+)/) || fetchUrl.match(/\/u\/([a-zA-Z0-9]+)/)
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1]
        fetchUrl = `https://pixeldrain.com/api/file/${fileId}`
        downloadHeaders['Referer'] = `https://pixeldrain.com/u/${fileId}`
        downloadHeaders['Range'] = 'bytes=0-'
      }
    }

    let response = await fetch(fetchUrl, {
      headers: downloadHeaders,
      redirect: 'follow'
    })

    if ((response.status === 403 || response.status === 416) && isPixeldrain) {
      const retryHeaders = { ...downloadHeaders }
      retryHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'
      delete retryHeaders['Range']
      response = await fetch(fetchUrl + '?download', { headers: retryHeaders, redirect: 'follow' })
    }

    if (response.status === 403 && isPixeldrain) {
      response = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'Wget/1.21.1', 'Referer': 'https://pixeldrain.com/' },
        redirect: 'follow'
      })
    }

    if (!response.ok) {
      return new Response(`Ошибка загрузки: ${response.status} ${response.statusText}`, { status: response.status })
    }

    // Имя файла
    let filename = 'download'
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match && match[1]) filename = match[1].replace(/['"]/g, '')
    } else {
      const urlPath = new URL(fileUrl).pathname
      const urlFilename = urlPath.split('/').pop()
      if (urlFilename) filename = decodeURIComponent(urlFilename)
    }

    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    headers.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'public, max-age=86400')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range')

    const contentLength = response.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)

    const contentRange = response.headers.get('content-range')
    if (contentRange) headers.set('Content-Range', contentRange)

    return new Response(response.body, { status: 200, headers })

  } catch (error) {
    return new Response(`Ошибка: ${error.message}`, { status: 500 })
  }
}
