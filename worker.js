addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    })
  }

  // Информация о сервере
  if (url.pathname === '/server-info') {
    const info = {
      colo: request.cf?.colo || 'Unknown',
      country: request.cf?.country || 'Unknown',
      region: request.cf?.region || 'Unknown',
      city: request.cf?.city || 'Unknown',
      timezone: request.cf?.timezone || 'Unknown',
      asn: request.cf?.asn || 'Unknown',
      httpProtocol: request.cf?.httpProtocol || 'Unknown',
      tlsVersion: request.cf?.tlsVersion || 'Unknown',
      clientIP: request.headers.get('cf-connecting-ip') || 'Unknown',
      cfRay: request.headers.get('cf-ray') || 'Unknown'
    }
    return new Response(JSON.stringify(info, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  // Тест скорости
  if (url.pathname === '/speed-test') {
    const size = Math.min(parseInt(url.searchParams.get('size') || '1048576'), 10 * 1024 * 1024)
    return new Response(new Uint8Array(size).fill(65), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': size.toString(),
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  // Главная страница
  if (url.pathname === '/') {
    return new Response(getHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  // Скачивание
  if (url.pathname === '/download' || url.pathname === '/api/download') {
    const fileUrl = url.searchParams.get('url')
    if (!fileUrl) return new Response('Ошибка: не указан URL', { status: 400 })

    try {
      new URL(fileUrl)

      const isPixeldrain = fileUrl.includes('pixeldrain.com')
      const clientColo = request.cf?.colo || 'Unknown'
      const clientCountry = request.cf?.country || 'Unknown'

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
        return new Response(`Ошибка: ${response.status} ${response.statusText}`, { status: response.status })
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

      const headers = new Headers()
      headers.set('Content-Disposition', `attachment; filename="${filename}"`)
      headers.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
      headers.set('Accept-Ranges', 'bytes')
      headers.set('Cache-Control', 'public, max-age=86400')
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range')
      headers.set('X-Served-From', `${clientColo}-${clientCountry}`)

      const cl = response.headers.get('content-length')
      if (cl) headers.set('Content-Length', cl)
      const cr = response.headers.get('content-range')
      if (cr) headers.set('Content-Range', cr)

      return new Response(response.body, { status: 200, headers })

    } catch (e) {
      return new Response(`Ошибка: ${e.message}`, { status: 500 })
    }
  }

  return new Response('Не найдено', { status: 404 })
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Download</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #2a2a2a;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .info-btn {
            position: fixed; top: 20px; right: 20px;
            padding: 10px 16px; background: #3a3a3a;
            border: 1px solid #4a4a4a; border-radius: 6px;
            color: #e0e0e0; font-size: 14px; cursor: pointer;
            transition: all 0.3s; z-index: 100;
        }
        .info-btn:hover { background: #404040; border-color: #666; }
        .modal {
            display: none; position: fixed; top: 0; left: 0;
            width: 100%; height: 100%; background: rgba(0,0,0,0.7);
            align-items: center; justify-content: center; z-index: 1000;
        }
        .modal.active { display: flex; }
        .modal-content {
            background: #3a3a3a; border: 1px solid #4a4a4a;
            border-radius: 12px; padding: 24px; max-width: 500px;
            width: 90%; color: #e0e0e0; max-height: 80vh; overflow-y: auto;
        }
        .modal-header { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #fff; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #4a4a4a; }
        .info-label { color: #999; font-size: 14px; }
        .info-value { color: #e0e0e0; font-size: 14px; font-weight: 500; }
        .debug-data {
            background: #2a2a2a; border: 1px solid #4a4a4a; border-radius: 8px;
            padding: 16px; font-family: monospace; font-size: 12px;
            white-space: pre-wrap; word-break: break-all;
            max-height: 400px; overflow-y: auto; color: #4ade80;
        }
        .close-btn, .debug-btn {
            margin-top: 12px; width: 100%; padding: 10px; background: #4a4a4a;
            border: 1px solid #555; border-radius: 6px; color: #e0e0e0;
            font-size: 14px; cursor: pointer;
        }
        .close-btn:hover, .debug-btn:hover { background: #555; }
        .loading { text-align: center; color: #999; padding: 20px; }
        .container { width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: 12px; }
        .servers { display: flex; flex-wrap: wrap; gap: 8px; }
        .server-card {
            flex: 1; min-width: 120px; max-width: calc(33% - 6px);
            padding: 10px 12px; background: #3a3a3a;
            border: 1px solid #4a4a4a; border-radius: 8px;
            cursor: pointer; transition: border-color 0.3s, background 0.3s;
            display: flex; flex-direction: column; gap: 3px;
            box-sizing: border-box;
        }
        .server-card:hover { background: #404040; border-color: #666; }
        .server-card.sel-auto { border-color: #60a5fa; background: #1e2a3a; }
        .server-card.sel-manual { border-color: #4ade80; background: #1e2e1e; }
        .server-name { font-size: 13px; font-weight: 600; color: #e0e0e0; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; }
        .server-speed { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; height: 16px; }
        .server-speed.fast { color: #4ade80; }
        .server-speed.slow { color: #f87171; }
        .server-speed.testing { color: #fbbf24; }
        .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
        .badge.auto { background: #60a5fa; color: #1a1a1a; }
        .badge.best { background: #4ade80; color: #1a1a1a; }
        .badge.manual { background: #a78bfa; color: #1a1a1a; }
        .status-bar { font-size: 13px; color: #888; text-align: center; min-height: 18px; }
        .status-bar.ok { color: #4ade80; }
        .status-bar.err { color: #f87171; }
        .input-wrapper { display: flex; gap: 10px; align-items: center; }
        input[type="url"] {
            flex: 1; padding: 16px 20px; background: #3a3a3a;
            border: 1px solid #4a4a4a; border-radius: 8px;
            font-size: 16px; color: #e0e0e0; transition: all 0.3s;
        }
        input[type="url"]:focus { outline: none; border-color: #666; background: #404040; }
        input[type="url"]::placeholder { color: #888; }
        .dl-btn {
            padding: 16px 20px; background: #3a3a3a; border: 1px solid #4a4a4a;
            border-radius: 8px; color: #e0e0e0; cursor: pointer;
            transition: all 0.3s; display: flex; align-items: center; justify-content: center;
        }
        .dl-btn:hover { background: #404040; border-color: #666; }
    </style>
</head>
<body>
    <button class="info-btn" onclick="showServerInfo()">Server Info</button>

    <div id="modal" class="modal" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">Информация о сервере</div>
            <div id="serverData" class="loading">Загрузка...</div>
            <button class="close-btn" onclick="closeModal()">Закрыть</button>
        </div>
    </div>

    <div class="container">
        <div class="servers">
            <div class="server-card sel-auto" id="card-auto" onclick="selectServer('auto')">
                <div class="server-name">⚡ Авто <span class="badge auto" id="badge-auto">ВЫБРАН</span></div>
                <div class="server-speed" id="speed-auto">Выбирает лучший</div>
            </div>
            <div class="server-card" id="card-cf" onclick="selectServer('cf')">
                <div class="server-name">
                    ☁️ Cloudflare
                    <span class="badge best" id="badge-cf-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-cf-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-cf">Тестирование...</div>
            </div>
            <div class="server-card" id="card-vercel" onclick="selectServer('vercel')">
                <div class="server-name">
                    ▲ Vercel
                    <span class="badge best" id="badge-vercel-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-vercel-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-vercel">Тестирование...</div>
            </div>
            <div class="server-card" id="card-netlify" onclick="selectServer('netlify')">
                <div class="server-name">
                    ◈ Netlify
                    <span class="badge best" id="badge-netlify-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-netlify-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-netlify">Тестирование...</div>
            </div>
            <div class="server-card" id="card-deno" onclick="selectServer('deno')">
                <div class="server-name">
                    🦕 Deno
                    <span class="badge best" id="badge-deno-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-deno-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-deno">Тестирование...</div>
            </div>
            <div class="server-card" id="card-valtown" onclick="selectServer('valtown')">
                <div class="server-name">
                    🏙️ Val.town
                    <span class="badge best" id="badge-valtown-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-valtown-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-valtown">Тестирование...</div>
            </div>
            <div class="server-card" id="card-supabase" onclick="selectServer('supabase')">
                <div class="server-name">
                    ⚡ Supabase
                    <span class="badge best" id="badge-supabase-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-supabase-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-supabase">Тестирование...</div>
            </div>
            <div class="server-card" id="card-render" onclick="selectServer('render')">
                <div class="server-name">
                    🎨 Render
                    <span class="badge best" id="badge-render-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-render-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-render">Тестирование...</div>
            </div>
            <div class="server-card" id="card-koyeb" onclick="selectServer('koyeb')">
                <div class="server-name">
                    🚀 Koyeb
                    <span class="badge best" id="badge-koyeb-best" style="display:none">БЫСТРЕЕ</span>
                    <span class="badge manual" id="badge-koyeb-manual" style="display:none">ВЫБРАН</span>
                </div>
                <div class="server-speed testing" id="speed-koyeb">Тестирование...</div>
            </div>
        </div>

        <form id="downloadForm">
            <div class="input-wrapper">
                <input type="url" id="fileUrl" placeholder="URL файла" required autofocus>
                <button type="submit" class="dl-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
            </div>
        </form>

        <div class="status-bar" id="statusBar">Тестируем серверы...</div>
    </div>

    <script>
        const VERCEL_URL = 'https://filesped.vercel.app'
        const CF_URL = ''
        const NETLIFY_URL = 'https://resplendent-monstera-7d930c.netlify.app'
        const DENO_URL = 'https://fast-squirrel-35-ahspqj0se9z0.spehiks.deno.net'
        const VALTOWN_URL = 'https://speh1k--4deaeede4a2111f1b8ecee650bb23af1.web.val.run'
        const SUPABASE_URL = 'https://zhgijilnoqlbgsftovat.supabase.co/functions/v1/hyper-action'
        const RENDER_URL = 'https://YOUR-APP.onrender.com'
        const KOYEB_URL = 'https://YOUR-APP.koyeb.app'
        const TEST_SIZE = 3 * 1024 * 1024

        let selectedServer = 'auto'
        let bestServer = 'cf'
        let cachedServerInfo = null
        let allServers = ['cf','vercel','netlify','deno','valtown','supabase','render','koyeb']

        function selectServer(name) {
            selectedServer = name
            ;['auto',...allServers].forEach(s => {
                document.getElementById('card-' + s).classList.remove('sel-auto','sel-manual')
            })
            document.getElementById('badge-auto').style.display = 'none'
            allServers.forEach(s => {
                document.getElementById('badge-' + s + '-manual').style.display = 'none'
            })
            if (name === 'auto') {
                document.getElementById('card-auto').classList.add('sel-auto')
                document.getElementById('badge-auto').style.display = 'inline'
            } else {
                document.getElementById('card-' + name).classList.add('sel-manual')
                document.getElementById('badge-' + name + '-manual').style.display = 'inline'
            }
        }

        async function testServer(name, baseUrl, path) {
            const el = document.getElementById('speed-' + name)
            el.className = 'server-speed testing'
            el.textContent = 'Тестирование...'

            const DURATION = 10000 // 10 секунд
            const CHUNK = 3 * 1024 * 1024 // 3MB за раз
            let totalBytes = 0
            let rounds = 0
            const deadline = performance.now() + DURATION

            try {
                // Первый запрос — проверяем доступность
                const probe = await fetch((baseUrl || '') + path + '?size=65536', { cache: 'no-store' })
                if (!probe.ok) throw new Error()
                await probe.blob()

                const start = performance.now()

                while (performance.now() < deadline) {
                    const res = await fetch((baseUrl || '') + path + '?size=' + CHUNK + '&r=' + rounds, { cache: 'no-store' })
                    if (!res.ok) break
                    await res.blob()
                    totalBytes += CHUNK
                    rounds++

                    // Обновляем скорость в реальном времени
                    const elapsed = (performance.now() - start) / 1000
                    const mbps = ((totalBytes * 8) / (elapsed * 1e6)).toFixed(1)
                    el.textContent = mbps + ' Mbps (' + Math.round(elapsed) + 's)'
                }

                const elapsed = (performance.now() - start) / 1000
                const mbps = ((totalBytes * 8) / (elapsed * 1e6)).toFixed(1)
                el.className = 'server-speed fast'
                el.textContent = mbps + ' Mbps'
                return parseFloat(mbps)
            } catch {
                el.className = 'server-speed slow'
                el.textContent = 'Недоступен'
                return 0
            }
        }

        async function runTests() {
            const sb = document.getElementById('statusBar')
            const [cfS, vS, nS, dS, vtS, sbS, rS, kS] = await Promise.all([
                testServer('cf', CF_URL, '/speed-test'),
                testServer('vercel', VERCEL_URL, '/api/speed-test'),
                testServer('netlify', NETLIFY_URL, '/speed-test'),
                testServer('deno', DENO_URL, '/speed-test'),
                testServer('valtown', VALTOWN_URL, '/speed-test'),
                testServer('supabase', SUPABASE_URL, '/speed-test'),
                testServer('render', RENDER_URL, '/speed-test'),
                testServer('koyeb', KOYEB_URL, '/speed-test')
            ])

            allServers.forEach(s =>
                document.getElementById('badge-' + s + '-best').style.display = 'none'
            )

            if (cfS===0 && vS===0 && nS===0 && dS===0 && vtS===0 && sbS===0 && rS===0 && kS===0) {
                sb.textContent = 'Все серверы недоступны'
                sb.className = 'status-bar err'
                return
            }

            const scores = { cf: cfS, vercel: vS, netlify: nS, deno: dS, valtown: vtS, supabase: sbS, render: rS, koyeb: kS }
            bestServer = Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0]
            const names = { cf: 'Cloudflare', vercel: 'Vercel', netlify: 'Netlify', deno: 'Deno', valtown: 'Val.town', supabase: 'Supabase', render: 'Render', koyeb: 'Koyeb' }
            const bestSpeed = scores[bestServer]

            document.getElementById('badge-' + bestServer + '-best').style.display = 'inline'
            document.getElementById('speed-auto').textContent = names[bestServer] + ' — ' + bestSpeed + ' Mbps'
            document.getElementById('speed-auto').className = 'server-speed fast'
            sb.textContent = 'Лучший: ' + names[bestServer] + ' (' + bestSpeed + ' Mbps)'
            sb.className = 'status-bar ok'
        }

        document.getElementById('downloadForm').addEventListener('submit', function(e) {
            e.preventDefault()
            const fileUrl = document.getElementById('fileUrl').value.trim()
            if (!fileUrl) return
            const server = selectedServer === 'auto' ? bestServer : selectedServer
            const urls = {
                cf:       (CF_URL || '') + '/download?url=' + encodeURIComponent(fileUrl),
                vercel:   VERCEL_URL + '/api/download?url=' + encodeURIComponent(fileUrl),
                netlify:  NETLIFY_URL + '/download?url=' + encodeURIComponent(fileUrl),
                deno:     DENO_URL + '/download?url=' + encodeURIComponent(fileUrl),
                valtown:  VALTOWN_URL + '/download?url=' + encodeURIComponent(fileUrl),
                supabase: SUPABASE_URL + '/download?url=' + encodeURIComponent(fileUrl),
                render:   RENDER_URL + '/download?url=' + encodeURIComponent(fileUrl),
                koyeb:    KOYEB_URL + '/download?url=' + encodeURIComponent(fileUrl),
            }
            const names = { cf: 'Cloudflare', vercel: 'Vercel', netlify: 'Netlify', deno: 'Deno', valtown: 'Val.town', supabase: 'Supabase', render: 'Render', koyeb: 'Koyeb' }
            document.getElementById('statusBar').textContent = 'Качаем через ' + names[server] + '...'
            document.getElementById('statusBar').className = 'status-bar ok'
            window.location.href = urls[server]
        })

        async function showServerInfo() {
            document.getElementById('modal').classList.add('active')
            const sd = document.getElementById('serverData')
            sd.innerHTML = '<div class="loading">Загрузка...</div>'
            
            const server = selectedServer === 'auto' ? bestServer : selectedServer
            const names = { cf: 'Cloudflare', vercel: 'Vercel', netlify: 'Netlify', deno: 'Deno', valtown: 'Val.town', supabase: 'Supabase', render: 'Render', koyeb: 'Koyeb' }
            const serverInfoUrls = {
                cf:       (CF_URL || '') + '/server-info',
                vercel:   VERCEL_URL + '/api/server-info',
                netlify:  NETLIFY_URL + '/server-info',
                deno:     DENO_URL + '/server-info',
                valtown:  VALTOWN_URL + '/server-info',
                supabase: SUPABASE_URL + '/server-info',
                render:   RENDER_URL + '/server-info',
                koyeb:    KOYEB_URL + '/server-info',
            }
            
            try {
                const response = await fetch(serverInfoUrls[server])
                if (!response.ok) throw new Error('Server unavailable')
                const i = await response.json()
                
                // Разные серверы возвращают разные данные
                if (server === 'cf') {
                    sd.innerHTML = \`
                        <div class="modal-header">Информация: \${names[server]}</div>
                        <div class="info-row"><span class="info-label">☁️ CF Дата-центр:</span><span class="info-value">\${i.colo || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">Страна:</span><span class="info-value">\${i.country || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">Город:</span><span class="info-value">\${i.city || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">Протокол:</span><span class="info-value">\${i.httpProtocol || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">Твой IP:</span><span class="info-value">\${i.clientIP || 'Unknown'}</span></div>
                        <button class="debug-btn" onclick="showDebug()">Показать всё</button>
                    \`
                } else if (server === 'vercel') {
                    sd.innerHTML = \`
                        <div class="modal-header">Информация: \${names[server]}</div>
                        <div class="info-row"><span class="info-label">▲ Регион:</span><span class="info-value">\${i.region || i.serverRegion || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">Страна:</span><span class="info-value">\${i.country || i.clientCountry || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">Город:</span><span class="info-value">\${i.city || i.clientCity || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">Часовой пояс:</span><span class="info-value">\${i.timezone || i.clientTimezone || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">IP клиента:</span><span class="info-value">\${i.clientIP || 'Unknown'}</span></div>
                        <button class="debug-btn" onclick="showDebug()">Показать всё</button>
                    \`
                } else {
                    // Для остальных серверов показываем что есть
                    sd.innerHTML = \`
                        <div class="modal-header">Информация: \${names[server]}</div>
                        <div class="info-row"><span class="info-label">Сервер:</span><span class="info-value">\${names[server]}</span></div>
                        <div class="info-row"><span class="info-label">Регион:</span><span class="info-value">\${i.region || i.colo || 'Unknown'}</span></div>
                        <div class="info-row"><span class="info-label">IP клиента:</span><span class="info-value">\${i.clientIP || i.ip || 'Unknown'}</span></div>
                        <button class="debug-btn" onclick="showDebug()">Показать всё</button>
                    \`
                }
            } catch { 
                sd.innerHTML = \`
                    <div class="modal-header">Информация: \${names[server]}</div>
                    <div class="loading">Сервер недоступен или не поддерживает server-info</div>
                \`
            }
        }

        async function showDebug() {
            const sd = document.getElementById('serverData')
            sd.innerHTML = '<div class="loading">Загрузка...</div>'
            
            const server = selectedServer === 'auto' ? bestServer : selectedServer
            const serverInfoUrls = {
                cf:       (CF_URL || '') + '/server-info',
                vercel:   VERCEL_URL + '/api/server-info',
                netlify:  NETLIFY_URL + '/server-info',
                deno:     DENO_URL + '/server-info',
                valtown:  VALTOWN_URL + '/server-info',
                supabase: SUPABASE_URL + '/server-info',
                render:   RENDER_URL + '/server-info',
                koyeb:    KOYEB_URL + '/server-info',
            }
            
            try {
                const data = await (await fetch(serverInfoUrls[server])).json()
                sd.innerHTML = \`<div class="debug-data">\${JSON.stringify(data, null, 2)}</div>\`
            } catch { sd.innerHTML = '<div class="loading">Ошибка</div>' }
        }

        function closeModal(e) {
            if (!e || e.target === document.getElementById('modal'))
                document.getElementById('modal').classList.remove('active')
        }

        selectServer('auto')
        runTests()
    </script>
</body>
</html>`
}
