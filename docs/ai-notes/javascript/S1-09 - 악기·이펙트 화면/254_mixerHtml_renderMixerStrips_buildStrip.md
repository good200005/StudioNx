# JavaScript 254 — 믹서 칸과 아래 믹서 줄 (`mixerHtml` · `renderMixerStrips` · `buildStrip`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 펼침 칸의 믹서와 화면 아래 믹서 줄을 그립니다 (FR-252) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 253 Nyxi 카드 한 장 · 255 값 다듬기와 표시 글 |

## 1. 하는 일
`mixerHtml` 은 펼친 트랙의 믹서 칸 속을 만듭니다. 볼륨 페이더, 미터, dB 글, 팬, 겹 보내기 자리(A · B)가 담기고 MASTER 는 볼륨만 담습니다. `renderMixerStrips` 는 화면 아래 믹서 줄을 트랙마다 하나씩 다시 그립니다(MASTER 는 늘 맨 끝). `buildStrip` 은 그 줄 하나를 만듭니다. 줄에는 이름, 악기 이름, `FX 2`, 페이더, dB, 팬, M · S · ● 버튼이 담깁니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `renderCells` (251) | 믹서 칸을 채울 때 `mixerHtml` 을 씁니다 |
| `renderTracks` (246) · `refreshCells` (251) · `syncTrackSubs` (245) | 아래 믹서 줄을 다시 그릴 때 `renderMixerStrips` 를 씁니다 |
| `wireControls` (258) | `data-live="track-volume"` 자리를 조작에 묶습니다 |

## 3. 코드
```js
/** 펼침 칸의 믹서 — 볼륨 · 팬 · 미터 (MASTER 는 볼륨만) */
function mixerHtml(track) {
  const db = Number(track.volume_db || 0);
  const master = track.track_type === 'MASTER';
  return '<div class="sq-mixer">'
    + '<div class="sq-vm">'
    + '<span class="sq-fader" role="slider" tabindex="0" data-live="track-volume" aria-label="Volume"'
    + ' aria-valuemin="-60" aria-valuemax="6" aria-valuenow="' + db + '"><i style="--y:' + faderY(db) + '%"></i></span>'
    + '<span class="sq-meter"><i style="--m:0%"></i><i style="--m:0%"></i></span>'
    + '</div>'
    + '<span class="sq-db sq-num">' + fmtDb(db) + '</span>'
    + (master
      ? '<span class="sq-pan">L<i></i>R</span>'
      : '<span class="sq-pan">L<i role="slider" tabindex="0" data-live="track-pan" aria-label="Pan" style="--p:' + panDeg(Number(track.pan || 0)) + 'deg"></i>R</span>'
        + '<span class="sq-sends" title="Sends come with the mixer work unit">A<i style="--a:40deg"></i>B<i style="--a:-10deg"></i></span>')
    + '</div>';
}

/** 아래 칸 믹서 — 실제 트랙마다 줄 하나, MASTER 는 끝에 */
export function renderMixerStrips() {
  if (!active) return;
  const list = document.getElementById('mixer-strips');
  if (!list) return;
  const ordered = tracks.slice().sort(function (a, b) { return a.order_index - b.order_index; });
  const master = ordered.filter(function (t) { return t.track_type === 'MASTER'; })[0] || null;
  list.innerHTML = '';
  ordered.forEach(function (track) {
    if (track.track_type === 'MASTER') return;
    list.append(buildStrip(track, false));
  });
  const old = document.querySelector('#panel-mixer .sq-strip--master');
  if (master) {
    const strip = buildStrip(master, true);
    if (old) old.replaceWith(strip);
    else list.after(strip);
  }
  const head = document.querySelector('#panel-mixer .sq-bottom__head span');
  if (head) head.textContent = list.children.length + ' tracks · MASTER';
}

/** 아래 칸 믹서 줄 하나 만들기 */
function buildStrip(track, master) {
  const db = Number(track.volume_db || 0);
  const info = stripInfo(track);
  const strip = document.createElement('div');
  strip.className = 'sq-strip is-live' + (master ? ' sq-strip--master' : '');
  strip.dataset.trackId = String(track.track_id);
  strip.dataset.color = track.track_type === 'AUDIO' ? 'audio' : '1';
  strip.innerHTML = '<b class="sq-strip__name">' + esc(info.title) + '</b>'
    + '<small class="sq-strip__sub">' + esc(info.sub) + '</small>'
    + '<span class="sq-strip__fx">FX ' + info.fx + '</span>'
    + '<div class="sq-vm"><span class="sq-fader" role="slider" tabindex="0" data-live="track-volume" aria-label="Volume"'
    + ' aria-valuemin="-60" aria-valuemax="6" aria-valuenow="' + db + '"><i style="--y:' + faderY(db) + '%"></i></span>'
    + '<span class="sq-meter"><i style="--m:0%"></i><i style="--m:0%"></i></span></div>'
    + '<span class="sq-db sq-num">' + fmtDb(db) + '</span>'
    + '<span class="sq-pan">L<i' + (master ? '' : ' role="slider" tabindex="0" data-live="track-pan" aria-label="Pan" style="--p:' + panDeg(Number(track.pan || 0)) + 'deg"') + '></i>R</span>'
    + '<span class="sq-msr"><button type="button" class="is-mute" aria-pressed="' + String(!!track.is_muted) + '" aria-label="Mute">M</button>'
    + (master ? '' : '<button type="button" class="is-solo" aria-pressed="' + String(!!track.is_solo) + '" aria-label="Solo">S</button>'
      + '<button type="button" class="is-arm" aria-pressed="false" aria-label="Record arm">●</button>')
    + '</span>';
  return strip;
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `master ? ... : ...` | MASTER 는 팬과 보내기 자리를 만들지 않습니다 |
| `data-live="track-volume"` | 조작을 묶을 자리를 표시하는 이름입니다 |
| `if (!active) return;` | 데모 모드에서는 아래 믹서 줄을 건드리지 않습니다 |
| `list.innerHTML = ''` | 이전 줄을 모두 지웁니다 |
| `old.replaceWith(strip)` | 이미 있던 MASTER 줄 자리에 새 줄을 갈아 끼웁니다 |
| `list.children.length + ' tracks · MASTER'` | 머리 글에 트랙 수를 적습니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| MASTER 를 끝에 | 화면 자리가 고정되어 있어 늘 맨 끝이어야 합니다 |
| MASTER 만 따로 갈아 끼움 | MASTER 줄은 목록 밖에 있어 지웠다 만들면 자리가 흔들립니다 |
| 미터를 0% 로 시작 | 소리 값은 다음 작업이라 지금은 자리만 잡아 둡니다 |
| `is-live` 를 붙임 | 예시 믹서 줄과 구분해 조작이 겹치지 않게 합니다 |

## 5. 시험
시험 프로젝트에서 아래 믹서 줄이 5줄(MASTER 제외)과 MASTER 줄 1개로 그려지고, 머리 글이 `5 tracks · MASTER` 인 것을 확인했습니다. Bass Synth 줄에서 페이더를 위로 끌어 `-20.0 dB` 에서 `0.0 dB` 로 바뀐 뒤 `GET /tracks/4639` 의 `volume_db` 가 함께 바뀐 것을 확인했습니다.
