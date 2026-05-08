const express = require('express')
const app = express()
const PORT = process.env.PORT || 3000

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// Server info
app.get('/server-info', (req, res) => {
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.ip
    || 'Unknown'

  const info = {
    platform: 'Render.com',
    region: process.env.RENDER_REGION || 'Unknown',
    service: process.env.RENDER_SERVICE_NAME || 'Unknown',
    clientIP,
  }

  res.json(info)
})

// Speed test
app.get('/speed-test', (req, res) => {
  const size = Math.min(parseInt(req.query.size || '1048576'), 10 * 1024 * 1024)
  const chunk = Buffer.alloc(size, 65)

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': size.toString(),
    'Cache-Control': 'no-cache, no-store',
  })

  res.send(chunk)
})

// Download
app.get('/download', async (req, res) => {
  const fileUrl = req.query.url

  if (!fileUrl) {
    return res.status(400).send('Ошибка: не указан URL')
  }

  try {
    new URL(fileUrl)

    const isPixeldrain = fileUrl.includes('pixeldrain.com')

    const downloadHeaders = {
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

    const fetch = (await import('node-fetch')).default
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
      return res.status(response.status).send(`Ошибка: ${response.status} ${response.statusText}`)
    }

    // Имя файла
    let filename = 'download'
    const cd = response.headers.get('content-disposition')
    if (cd) {
      const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (m?.[1]) filename = m[1].replace(/['"]/g, '')
    } else {
      const p = new URL(fileUrl).pathname.split('/').pop()
      if (p) filename = decodeURIComponent(p)
    }

    res.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    })

    const cl = response.headers.get('content-length')
    if (cl) res.set('Content-Length', cl)
    const cr = response.headers.get('content-range')
    if (cr) res.set('Content-Range', cr)

    response.body.pipe(res)

  } catch (e) {
    res.status(500).send(`Ошибка: ${e.message}`)
  }
})

// Health check
app.get('/', (req, res) => {
  res.send('OK - Render Proxy')
})

app.listen(PORT, () => {
  console.log(`🚀 Render proxy running on port ${PORT}`)
})
