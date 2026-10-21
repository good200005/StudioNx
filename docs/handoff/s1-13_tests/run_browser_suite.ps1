# S1-13 브라우저 시험 묶음 실행 — 같은 시험을 BROWSER_PATH 로 정한 브라우저에서 돌려 결과를 표로 보여 줍니다.
# 사용 (저장소 맨 위에서, 시험용 서버 8001 이 떠 있어야 화면 시험이 돌아감):
#   $env:BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
#   powershell -File docs/handoff/s1-13_tests/run_browser_suite.ps1
# 시험마다 제한 시간(기본 240초)을 두어, 하나가 멈춰도 뒤의 시험이 막히지 않게 합니다.
param([int]$TimeoutSec = 240)

$tests = @(
  'docs/handoff/s1-11a_tests/effects_offline.mjs',
  'docs/handoff/s1-11b_tests/render_offline.mjs',
  'docs/handoff/s1-11c_tests/render_sampler.mjs',
  'studionx/tests/audio/run.mjs',
  'studionx/tests/audio/selftest.mjs',
  'docs/handoff/s1-10_tests/ui.mjs',
  'docs/handoff/s1-10a_tests/ui.mjs',
  'docs/handoff/s1-11a_tests/ui.mjs',
  'docs/handoff/s1-11a_tests/ui_fx.mjs',
  'docs/handoff/s1-11a_tests/ui_meter.mjs',
  'docs/handoff/s1-11a_tests/ui_midi.mjs',
  'docs/handoff/s1-11b_tests/ui_export.mjs',
  'docs/handoff/s1-11c_tests/ui_sampler.mjs',
  'docs/handoff/s1-13_tests/ui_tempo.mjs'
)

"브라우저: " + $(if ($env:BROWSER_PATH) { $env:BROWSER_PATH } else { '(기본 Chrome)' })
foreach ($t in $tests) {
  $job = Start-Job -ScriptBlock { param($dir, $test, $bp) Set-Location $dir; if ($bp) { $env:BROWSER_PATH = $bp }; node $test 2>&1 } -ArgumentList (Get-Location).Path, $t, $env:BROWSER_PATH
  $done = Wait-Job $job -Timeout $TimeoutSec
  if (-not $done) {
    Stop-Job $job
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'handoff|tests/audio|tests\\audio' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'chrome|msedge' -and $_.CommandLine -match 'remote-debugging-port' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    "{0,-40} TIMEOUT ({1}초)" -f $t.Replace('docs/handoff/', ''), $TimeoutSec
    Remove-Job $job -Force
    continue
  }
  $o = Receive-Job $job
  Remove-Job $job -Force
  $fails = ($o | Select-String '^FAIL').Count
  $sum = ($o | Select-String 'passed|통과' | Select-Object -Last 1)
  "{0,-40} FAIL {1}  {2}" -f $t.Replace('docs/handoff/', ''), $fails, $sum
  $o | Select-String '^FAIL' | Select-Object -First 6 | ForEach-Object { '    ' + $_.Line }
}
