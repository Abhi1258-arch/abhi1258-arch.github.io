# Local server for the portfolio (Windows PowerShell, no installs needed).
#   powershell -ExecutionPolicy Bypass -File tools\serve.ps1            -> http://localhost:8080
#   powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 9000
# Serves the site (with HTTP Range support so audio seeking works) and a small live-data API
# that the pages use when they are opened through this server:
#   /api/ping                                   is the live API available?
#   /api/chart?symbols=^NSEI,TCS.NS&range=1d&interval=5m   (or &start=YYYY-MM-DD)   Yahoo Finance prices
#   /api/cpi                                    World Bank annual CPI inflation, India
#   /api/rbi                                    current policy repo rate, read from rbi.org.in
#   /api/journal                                entries from the live Weekly Market Journal.docx
# Responses are cached briefly so the outside services are not hammered.
param(
  [int]$Port = 8080,
  [switch]$NoApi,   # preview the site as visitors of the shared link see it (no live data)
  [string]$JournalPath = "$env:USERPROFILE\OneDrive\Documents\Market Tracking\Converted\Weekly Market Journal.docx"
)
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$types = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'
  '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'
  '.webp'='image/webp'; '.ico'='image/x-icon'; '.pdf'='application/pdf'; '.m4a'='audio/mp4'; '.mp4'='video/mp4'; '.mp3'='audio/mpeg'
  '.wav'='audio/wav'; '.ogg'='audio/ogg'; '.txt'='text/plain; charset=utf-8'; '.md'='text/plain; charset=utf-8'; '.xml'='application/xml'
}
$ua = @{ 'User-Agent' = 'Mozilla/5.0' }
$cache = @{}

function Cached([string]$key, [int]$seconds, [scriptblock]$make) {
  $hit = $cache[$key]
  if ($hit -and $hit.exp -gt (Get-Date)) { return $hit.body }
  $body = & $make
  $cache[$key] = @{ exp = (Get-Date).AddSeconds($seconds); body = $body }
  return $body
}

function Get-Chart([string]$sym, [string]$query) {
  $r = (Invoke-RestMethod "https://query1.finance.yahoo.com/v8/finance/chart/$([uri]::EscapeDataString($sym))?$query" -Headers $ua -TimeoutSec 15).chart.result[0]
  $q = $r.indicators.quote[0]
  $adj = if ($r.indicators.adjclose) { $r.indicators.adjclose[0].adjclose } else { $q.close }
  [ordered]@{
    symbol = $sym; price = $r.meta.regularMarketPrice; time = $r.meta.regularMarketTime
    prevClose = $r.meta.chartPreviousClose; gmtoffset = $r.meta.gmtoffset
    tradingStart = $r.meta.currentTradingPeriod.regular.start; tradingEnd = $r.meta.currentTradingPeriod.regular.end
    t = @($r.timestamp); c = @($q.close); a = @($adj)
  }
}

function Read-Journal([string]$path) {
  $fs = [IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
  try { $z = New-Object IO.Compression.ZipArchive($fs); $x = (New-Object IO.StreamReader($z.GetEntry('word/document.xml').Open())).ReadToEnd(); $z.Dispose() } finally { $fs.Close() }
  $entries = New-Object System.Collections.ArrayList; $cur = $null; $sec = $null
  foreach ($m in [regex]::Matches($x, '<w:p[ >].*?</w:p>')) {
    $style = [regex]::Match($m.Value, '<w:pStyle w:val="([^"]+)"').Groups[1].Value
    $t = [Net.WebUtility]::HtmlDecode((([regex]::Matches($m.Value, '<w:t[^>]*>([^<]*)</w:t>') | ForEach-Object { $_.Groups[1].Value }) -join '')).Trim()
    if (-not $t) { continue }
    if ($t -match '^Week:\s*(.+)$') { $cur = [ordered]@{ title = $Matches[1].Trim(); sections = New-Object System.Collections.ArrayList }; [void]$entries.Add($cur); $sec = $null; continue }
    if (-not $cur) { continue }
    $isHead = ($style -match '^Heading') -or ($t.Length -lt 45 -and $t -notmatch '[.!?]$')
    if ($isHead) { $sec = [ordered]@{ heading = $t; paragraphs = New-Object System.Collections.ArrayList }; [void]$cur.sections.Add($sec) }
    else { if (-not $sec) { $sec = [ordered]@{ heading = ''; paragraphs = New-Object System.Collections.ArrayList }; [void]$cur.sections.Add($sec) }; [void]$sec.paragraphs.Add($t) }
  }
  return $entries
}

function Handle-Api($req) {
  $q = $req.QueryString
  switch ($req.Url.AbsolutePath) {
    '/api/ping' { return '{"ok":true}' }
    '/api/chart' {
      $syms = @(($q['symbols'] -split ',') | Where-Object { $_ -match '^[\^A-Za-z0-9_.=&-]{1,30}$' } | Select-Object -First 20)
      $interval = $q['interval']; if ($interval -notin '1m','2m','5m','15m','30m','60m','1d','1wk','1mo') { throw 'bad interval' }
      if ($q['start'] -match '^\d{4}-\d{2}-\d{2}$') {
        $p1 = [DateTimeOffset]::new([datetime]::ParseExact($q['start'], 'yyyy-MM-dd', $null), [TimeSpan]::Zero).ToUnixTimeSeconds()
        $query = "period1=$p1&period2=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())&interval=$interval"
        $tag = "start=$($q['start'])"
      } else {
        $range = $q['range']; if ($range -notin '1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','max') { throw 'bad range' }
        $query = "range=$range&interval=$interval"; $tag = "range=$range"
      }
      $ttl = 60   # the latest bar moves with the market, so keep everything at most a minute old
      $out = [ordered]@{}
      foreach ($s in $syms) {
        $key = "chart|$s|$tag|$interval"
        try { $out[$s] = Cached $key $ttl { Get-Chart $s $query } } catch { $out[$s] = @{ error = $_.Exception.Message } }
      }
      return ($out | ConvertTo-Json -Depth 6 -Compress)
    }
    '/api/cpi' {
      return Cached 'cpi' 86400 {
        $wb = Invoke-RestMethod 'https://api.worldbank.org/v2/country/IND/indicator/FP.CPI.TOTL.ZG?format=json&per_page=100&date=2000:2035' -TimeoutSec 20
        $rows = @($wb[1] | Where-Object { $null -ne $_.value } | Sort-Object date | ForEach-Object { ,@([int]$_.date, [math]::Round([double]$_.value, 2)) })
        [ordered]@{ annual = $rows } | ConvertTo-Json -Depth 4 -Compress
      }
    }
    '/api/rbi' {
      return Cached 'rbi' 3600 {
        $html = (Invoke-WebRequest 'https://www.rbi.org.in/' -UseBasicParsing -Headers $ua -TimeoutSec 20).Content
        $m = [regex]::Match($html, 'Policy Repo Rate\s*</th>\s*<td>\s*:?\s*([\d.]+)\s*%')
        if (-not $m.Success) { throw 'repo rate not found on rbi.org.in' }
        [ordered]@{ repo = [double]$m.Groups[1].Value; fetched = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss') } | ConvertTo-Json -Compress
      }
    }
    '/api/journal' {
      if (-not (Test-Path $JournalPath)) { throw "journal not found: $JournalPath" }
      $stamp = (Get-Item $JournalPath).LastWriteTimeUtc.Ticks
      return Cached "journal|$stamp" 86400 {
        [ordered]@{ modified = (Get-Item $JournalPath).LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss'); entries = @(Read-Journal $JournalPath) } | ConvertTo-Json -Depth 6 -Compress
      }
    }
    default { throw 'unknown endpoint' }
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    try {
      if ($req.Url.AbsolutePath.StartsWith('/api/') -and -not $NoApi) {
        try { $body = Handle-Api $req; $res.StatusCode = 200 }
        catch { $body = (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress); $res.StatusCode = 502 }
        $bytes = [Text.Encoding]::UTF8.GetBytes([string]$body)
        $res.ContentType = 'application/json; charset=utf-8'; $res.Headers.Add('Cache-Control', 'no-store')
        $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length)
        continue
      }
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
        if (Test-Path (Join-Path $path 'index.html')) { $res.Redirect($req.Url.AbsolutePath.TrimEnd('/') + '/'); continue }
        $res.StatusCode = 404; $path = Join-Path $root '404.html'
      }
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
      $res.Headers.Add('Accept-Ranges', 'bytes'); $res.Headers.Add('Cache-Control', 'no-cache')
      $fs = [IO.File]::OpenRead($path); $len = $fs.Length; $start = 0; $end = $len - 1
      $range = $req.Headers['Range']
      if ($range -and $range -match 'bytes=(\d*)-(\d*)') {
        if ($Matches[1]) { $start = [long]$Matches[1] } else { $start = [Math]::Max(0, $len - [long]$Matches[2]) }
        if ($Matches[1] -and $Matches[2]) { $end = [Math]::Min([long]$Matches[2], $len - 1) }
        $res.StatusCode = 206; $res.Headers.Add('Content-Range', "bytes $start-$end/$len")
      }
      $count = $end - $start + 1; $res.ContentLength64 = $count
      if ($req.HttpMethod -ne 'HEAD') {
        $fs.Seek($start, 'Begin') | Out-Null; $buf = New-Object byte[] 65536; $left = $count
        while ($left -gt 0) { $n = $fs.Read($buf, 0, [Math]::Min($buf.Length, $left)); if ($n -le 0) { break }; $res.OutputStream.Write($buf, 0, $n); $left -= $n }
      }
      $fs.Close()
    } catch { } finally { try { $res.Close() } catch { } }
  }
} finally { $listener.Stop() }
