param([string]$OutputDirectory = '.cache/local-ai/audio')
$ErrorActionPreference = 'Stop'
[void](New-Item -ItemType Directory -Path $OutputDirectory -Force)
$audioRoot = (Resolve-Path $OutputDirectory).Path
$voice = New-Object -ComObject SAPI.SpVoice
$germanVoice = @($voice.GetVoices() | Where-Object { $_.GetDescription() -like '*Hedda*' })
if ($germanVoice.Count -eq 0) { throw 'Microsoft Hedda Desktop ist nicht installiert.' }
$voice.Voice = $germanVoice[0]
foreach ($phrase in (Get-Content (Join-Path $PSScriptRoot 'speech.de.json') -Raw -Encoding utf8 | ConvertFrom-Json)) {
  $voice.Rate = if ($null -ne $phrase.rate) { $phrase.rate } else { 0 }
  $stream = New-Object -ComObject SAPI.SpFileStream
  $wav = Join-Path $audioRoot ($phrase.id + '.wav')
  $stream.Open($wav, 3, $false)
  try {
    $voice.AudioOutputStream = $stream
    [void]$voice.Speak($phrase.text)
  } finally { $stream.Close() }
  & ffmpeg -y -hide_banner -loglevel error -i $wav -t 10 -ac 1 -ar 48000 -c:a libopus -b:a 64k (Join-Path $audioRoot ($phrase.id + '.webm'))
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg fehlgeschlagen: $($phrase.id)" }
}
& ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=mono -t 3 -c:a libopus (Join-Path $audioRoot 'silence.webm')
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg fehlgeschlagen: silence' }
& ffmpeg -y -hide_banner -loglevel error -i (Join-Path $audioRoot 'phrase-4.wav') -f lavfi -i 'anoisesrc=color=white:amplitude=0.01:sample_rate=22050:seed=42' -filter_complex 'amix=inputs=2:duration=first:normalize=0' -t 10 -ar 48000 -c:a libopus (Join-Path $audioRoot 'noise.webm')
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg fehlgeschlagen: noise' }
