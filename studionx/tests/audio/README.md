# 오디오 회귀 테스트

오류 없이 소리만 조용히 달라지는 버그를 잡는 테스트입니다 (PRD 00 §7.1). 테스트 프로젝트를 앱이 쓰는 `renderOffline`으로 렌더링해 골든 WAV와 비교합니다.

## 실행

저장소 맨 위에서 실행합니다. 서버(FastAPI)와 DB는 필요 없고 Chrome만 있으면 됩니다.

| 목적 | 명령 |
|---|---|
| 전체 비교 (소리를 건드린 뒤마다) | `node studionx/tests/audio/run.mjs` |
| 프로젝트 하나만 | `node studionx/tests/audio/run.mjs --only synth_basic` |
| 골든 갱신 (의도적으로 소리를 바꾼 경우에만) | `node studionx/tests/audio/run.mjs --update "변경 이유"` |
| 테스트 도구 자체 시험 | `node studionx/tests/audio/selftest.mjs` |

Chrome이 기본 위치(`C:/Program Files/Google/Chrome/Application/chrome.exe`)에 없으면 환경 변수 `CHROME_PATH`로 지정합니다. 실패한 렌더링은 `out/`에 WAV로 저장되며(저장소에는 올리지 않음), 들어 보면서 무엇이 달라졌는지 확인할 수 있습니다.

## 구성

| 경로 | 내용 |
|---|---|
| `projects/*.json` | 테스트 프로젝트 5개. 마디와 박 단위로 읽기 쉽게 쓰고, 시험용 소리는 수식으로 만듭니다 (바이너리 파일 없음) |
| `golden/*.wav` | 기준 소리 (32bit float 스테레오). 변경 이유는 `golden/CHANGELOG.md`에 남깁니다 |
| `lib/metrics.mjs` | 비교 지표: 샘플 최대 차이, 차이 RMS, 통합 라우드니스(LUFS) |
| `lib/runner.mjs` | 정적 서버와 헤드리스 Chrome으로 렌더링, 프로젝트 JSON을 앱의 인자로 변환 |
| `lib/plugins.mjs` | 플러그인 정의를 DB 시드(`db/02_phase2_sequencer.sql`)에서 읽기 |
| `lib/wavio.mjs` | 골든 WAV 읽기와 쓰기 |
| `run.mjs`, `selftest.mjs` | 실행 명령과 자체 시험 |

## 통과 기준

기본 허용 오차는 프로젝트 JSON의 `tolerance`로 덮어쓸 수 있습니다.

| 지표 | 기본 허용 | 뜻 |
|---|---|---|
| 샘플 최대 차이 | 0.001 | -60 dBFS. 어느 한 샘플도 이보다 많이 달라지면 안 됩니다 |
| 차이 RMS | -80 dBFS | PRD 예시값. 전체적으로 달라진 정도입니다 |
| LUFS 차이 | 0.05 LU | 음량이 0.05dB만 달라져도 잡습니다 |
| 최소 피크 | 0.001 | 소리가 아예 안 나는 경우를 잡습니다 (빈 렌더링이 빈 골든과 같다고 통과하는 일을 막음) |

같은 Chrome에서 다시 렌더링해도 1e-7(-140 dBFS) 안팎의 반올림 차이는 생깁니다. 허용 오차가 그보다 1만 배 크므로 실제 변화만 실패합니다. Chrome의 큰 버전이 바뀌면 오디오 엔진의 계산이 조금 달라질 수 있어서, 골든을 만든 브라우저 버전을 `golden/CHANGELOG.md`에 함께 적습니다.
