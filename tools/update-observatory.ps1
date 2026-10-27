# Refreshes the Indian Market Observatory data snapshot (assets/js/observatory-data.js).
#   powershell -ExecutionPolicy Bypass -File tools\update-observatory.ps1
# Sources: Yahoo Finance chart API (index prices), World Bank API (annual CPI inflation).
# The RBI repo-rate timeline is maintained by hand in assets/js/observatory-rbi.js after each MPC meeting.
$ErrorActionPreference = 'Stop'
$site = Split-Path $PSScriptRoot -Parent
$ua = @{ 'User-Agent' = 'Mozilla/5.0' }

function Get-Monthly($symbol, $range) {
  $u = "https://query1.finance.yahoo.com/v8/finance/chart/$([uri]::EscapeDataString($symbol))?range=$range&interval=1mo"
  $r = (Invoke-RestMethod $u -Headers $ua -TimeoutSec 30).chart.result[0]
  $closes = $r.indicators.quote[0].close
  $rows = @()
  for ($i = 0; $i -lt $r.timestamp.Count; $i++) {
    if ($null -eq $closes[$i]) { continue }
    $ist = [DateTimeOffset]::FromUnixTimeSeconds($r.timestamp[$i]).ToOffset([TimeSpan]::FromHours(5.5))
    $row = @($ist.ToString('yyyy-MM'), [math]::Round([double]$closes[$i], 2))
    if ($rows.Count -and $rows[-1][0] -eq $row[0]) { $rows[-1] = $row } else { $rows += ,$row }   # one value per month (latest wins)
  }
  $last = [DateTimeOffset]::FromUnixTimeSeconds($r.meta.regularMarketTime).ToOffset([TimeSpan]::FromHours(5.5))
  [ordered]@{ symbol = $symbol; name = $r.meta.longName; asOf = $last.ToString('yyyy-MM-dd'); last = [math]::Round([double]$r.meta.regularMarketPrice, 2); monthly = $rows }
}

$nifty = Get-Monthly '^NSEI' '10y'

# price-chart series: the latest session (1-minute), 5 years daily, 10 years weekly
function Get-Series($query, $sym = '^NSEI') {
  $r = (Invoke-RestMethod "https://query1.finance.yahoo.com/v8/finance/chart/$([uri]::EscapeDataString($sym))?$query" -Headers $ua -TimeoutSec 30).chart.result[0]
  $c = $r.indicators.quote[0].close; $pts = @()
  for ($i = 0; $i -lt $r.timestamp.Count; $i++) { if ($null -ne $c[$i]) { $pts += ,@([long]$r.timestamp[$i], [math]::Round([double]$c[$i], 2)) } }
  [ordered]@{ points = $pts; prevClose = $r.meta.chartPreviousClose; price = $r.meta.regularMarketPrice; time = $r.meta.regularMarketTime
    sessionStart = $r.meta.currentTradingPeriod.regular.start; sessionEnd = $r.meta.currentTradingPeriod.regular.end }
}
$nifty.series = [ordered]@{ intraday = (Get-Series 'range=1d&interval=1m'); daily = (Get-Series 'range=5y&interval=1d'); weekly = (Get-Series 'range=10y&interval=1wk') }
"Nifty series: intraday $($nifty.series.intraday.points.Count), daily $($nifty.series.daily.points.Count), weekly $($nifty.series.weekly.points.Count)"
"Nifty 50: $($nifty.monthly.Count) months, last $($nifty.last) on $($nifty.asOf)"

$sectorList = [ordered]@{
  'Bank' = '^NSEBANK'; 'Financial Services' = 'NIFTY_FIN_SERVICE.NS'; 'IT' = '^CNXIT'; 'Auto' = '^CNXAUTO'
  'FMCG' = '^CNXFMCG'; 'Pharma' = '^CNXPHARMA'; 'Metal' = '^CNXMETAL'; 'Energy' = '^CNXENERGY'
  'Realty' = '^CNXREALTY'; 'PSU Bank' = '^CNXPSUBANK'; 'Infrastructure' = '^CNXINFRA'
}
$sectors = @()
foreach ($k in $sectorList.Keys) {
  # daily closes for the last ~3.2 years: enough for 1-month to 3-year returns measured from the same calendar date as the chart.
  # Slice by index rather than piping: piping flattens the [time, close] pairs.
  try {
    $d = Get-Series 'range=5y&interval=1d' $sectorList[$k]; $n = $d.points.Count; $pts = $d.points[[Math]::Max(0, $n - 820)..($n - 1)]
    $sectors += [ordered]@{ sector = $k; symbol = $sectorList[$k]; points = $pts }; "  $k ($($sectorList[$k])): $($pts.Count) days"
  }
  catch { "  $k ($($sectorList[$k])): skipped - $($_.Exception.Message)" }
}

$wb = Invoke-RestMethod 'https://api.worldbank.org/v2/country/IND/indicator/FP.CPI.TOTL.ZG?format=json&per_page=100&date=2000:2030' -TimeoutSec 30
$cpi = @($wb[1] | Where-Object { $null -ne $_.value } | Sort-Object date | ForEach-Object { ,@([int]$_.date, [math]::Round([double]$_.value, 2)) })
"CPI: $($cpi.Count) years, latest $($cpi[-1][0]) = $($cpi[-1][1])%"

# monthly prices of the backtest's five stocks and the Nifty since June 2023, in the shape the
# browser-side backtest expects, so the shared site can show the strategies tracked to this date
$p1 = [DateTimeOffset]::new([datetime]'2023-06-01', [TimeSpan]::Zero).ToUnixTimeSeconds(); $p2 = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$stocks = [ordered]@{}
foreach ($s in 'RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS','^NSEI') {
  $r = (Invoke-RestMethod "https://query1.finance.yahoo.com/v8/finance/chart/$([uri]::EscapeDataString($s))?period1=$p1&period2=$p2&interval=1mo" -Headers $ua -TimeoutSec 30).chart.result[0]
  $adj = if ($r.indicators.adjclose) { $r.indicators.adjclose[0].adjclose } else { $r.indicators.quote[0].close }
  $stocks[$s] = [ordered]@{ t = @($r.timestamp); c = @($r.indicators.quote[0].close); a = @($adj) }
}
"Backtest stocks: $($stocks.Count) symbols"

$data = [ordered]@{
  generated = (Get-Date).ToString('yyyy-MM-dd')
  stocks = $stocks
  nifty = $nifty
  sectors = $sectors
  cpi = [ordered]@{ source = 'World Bank, Inflation, consumer prices (annual %), India (FP.CPI.TOTL.ZG)'; annual = $cpi }
}
$json = $data | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText("$site\assets\js\observatory-data.js", "// Generated by tools/update-observatory.ps1 on $($data.generated). Snapshot, not live data.`r`nwindow.OBSERVATORY = $json;`r`n", (New-Object Text.UTF8Encoding($false)))
"wrote assets/js/observatory-data.js"
