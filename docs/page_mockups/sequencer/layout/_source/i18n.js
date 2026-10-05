// 시퀀서 목업 언어 바꾸기 — layout.html?lang=en|ko|ja (기본 en)
// PRD 02 FR-2171: 화면 글자만 바뀜. 트랙·패턴·마커·파일 이름, 채팅, 플러그인 이름·파라미터는 그대로
(function () {
  const LANG = new URLSearchParams(location.search).get('lang') || 'en';
  if (LANG === 'en') return;
  const I = LANG === 'ko' ? 0 : 1;
  document.documentElement.lang = LANG;

  // 그대로 바꾸는 글자 (앞뒤 공백 무시, 정확히 같을 때만) — [영어, 한국어, 일본어]
  const W = [
    ['FILE', '파일', 'ファイル'], ['EDIT', '편집', '編集'], ['ADD', '추가', '追加'], ['PATTERNS', '패턴', 'パターン'], ['VIEW', '보기', '表示'],
    ['OPTIONS', '옵션', 'オプション'], ['TOOLS', '도구', 'ツール'], ['HELP', '도움말', 'ヘルプ'],
    ['MIN:SEC:MS', '분:초:밀리초', '分:秒:ミリ秒'], ['BAR', '마디', '小節'], ['● Saved', '● 저장됨', '● 保存済み'],
    ['Samples', '샘플', 'サンプル'], ['Presets', '프리셋', 'プリセット'], ['Plugins', '플러그인', 'プラグイン'], ['Patterns', '패턴', 'パターン'],
    ['Automation', '오토메이션', 'オートメーション'], ['Records', '녹음', '録音'], ['Reference', '레퍼런스', 'リファレンス'], ['Favorites', '즐겨찾기', 'お気に入り'],
    ['Mixer', '믹서', 'ミキサー'], ['Members', '멤버', 'メンバー'], ['Chat', '채팅', 'チャット'],
    ['⤒ Upload', '⤒ 업로드', '⤒ アップロード'], ['Drums', '드럼', 'ドラム'], ['Bass', '베이스', 'ベース'], ['Vocal', '보컬', 'ボーカル'], ['Loops', '루프', 'ループ'],
    ['My uploads', '내 업로드', 'マイアップロード'], ['My uploads (.mid)', '내 업로드 (.mid)', 'マイアップロード (.mid)'],
    ['Instruments', '악기', '楽器'], ['Effects', '이펙트', 'エフェクト'], ['EQ·Dynamics', 'EQ·다이내믹', 'EQ・ダイナミクス'], ['Space', '공간계', '空間系'], ['Modulation', '모듈레이션', 'モジュレーション'],
    ['Instrument', '악기', '楽器'], ['Effect', '이펙트', 'エフェクト'], ['Imported', '가져옴', 'インポート済み'],
    ['Drop files here', '여기로 파일을 끌어 넣기', 'ここにファイルをドロップ'], ['or press Upload · WAV · MP3 · FLAC · MID', '또는 업로드 · WAV · MP3 · FLAC · MID', 'またはアップロード · WAV · MP3 · FLAC · MID'],
    ['Search samples (Ctrl+F)', '샘플 검색 (Ctrl+F)', 'サンプル検索 (Ctrl+F)'], ['Search plugins (Ctrl+F)', '플러그인 검색 (Ctrl+F)', 'プラグイン検索 (Ctrl+F)'], ['Search patterns (Ctrl+F)', '패턴 검색 (Ctrl+F)', 'パターン検索 (Ctrl+F)'],
    ['Default: English', '기본: English', 'デフォルト: English'],
    ['⤴ Automation A', '⤴ 오토메이션 A', '⤴ オートメーション A'], ['Playlist — Arrangement', '플레이리스트 — 편곡', 'プレイリスト — アレンジメント'],
    ['Add Track', '트랙 추가', 'トラック追加'], ['＋ Add Track', '＋ 트랙 추가', '＋ トラック追加'], ['GROUP', '그룹', 'グループ'], ['RETURN', '리턴', 'リターン'], ['Audio', '오디오', 'オーディオ'], ['Return', '리턴', 'リターン'],
    ['MASTER', '마스터', 'マスター'], ['MAIN', '메인', 'メイン'], ['Main output — always the last track', '메인 출력 — 늘 마지막 트랙', 'メイン出力 — 常に最後のトラック'],
    ['INSTRUMENT', '악기', 'インストゥルメント'], ['INSTRUMENTS', '악기', 'インストゥルメント'], ['Drop a synth or virtual instrument here to replace', '신스·가상 악기를 여기로 끌어 놓아 바꾸기', 'シンセや仮想楽器をここにドロップして置き換え'],
    ['EFFECTS', '이펙트', 'エフェクト'], ['signal → (1 parallel split)', '신호 → (병렬 1개)', '信号 → (並列 1つ)'], ['signal → · drag ⠿ to reorder', '신호 → · ⠿ 를 끌어 순서 변경', '信号 → · ⠿ をドラッグで並べ替え'],
    ['＋ Add branch', '＋ 갈래 추가', '＋ 分岐を追加'],
    ['CONNECT TO ANOTHER', '다른 트랙에 연결', '他のトラックに接続'], ['Connect', '연결', '接続'], ['Track', '트랙', 'トラック'], ['Plugin', '플러그인', 'プラグイン'],
    ['Connected', '연결됨', '接続中'], ['None', '없음', 'なし'], ['MIXER', '믹서', 'ミキサー'], ['OFF', '꺼짐', 'オフ'], ['Connected to', '연결 대상', '接続先'],
    ['Chop', '자르기', 'チョップ'], ['Glue', '붙이기', 'グルー'], ['Legato', '레가토', 'レガート'], ['Humanize', '휴머나이즈', 'ヒューマナイズ'], ['Reverse', '거꾸로', 'リバース'], ['Flip', '뒤집기', 'フリップ'],
    ['Length', '길이', '長さ'], ['Swing', '스윙', 'スイング'], ['Selected note', '선택한 노트', '選択ノート'], ['Velocity · Release', '벨로시티 · 릴리즈', 'ベロシティ · リリース'], ['Chance', '확률', '確率'],
    ['Vel. random', '벨로시티 랜덤', 'ベロシティ ランダム'], ['Muted notes', '뮤트한 노트', 'ミュートノート'], ['MIDI FX', 'MIDI 이펙트', 'MIDI エフェクト'],
    ['Velocity', '벨로시티', 'ベロシティ'], ['Release', '릴리즈', 'リリース'], ['CC64 Sustain', 'CC64 서스테인', 'CC64 サステイン'], ['Pitch Bend', '피치벤드', 'ピッチベンド'], ['Mod (CC1)', '모듈레이션 (CC1)', 'モジュレーション (CC1)'],
    ['pedal down', '페달 밟음', 'ペダル オン'],
    ['Undo', '실행 취소', '元に戻す'], ['Redo', '다시 실행', 'やり直し'], ['Cut', '잘라내기', '切り取り'], ['Copy', '복사', 'コピー'], ['Paste', '붙여넣기', '貼り付け'], ['Delete', '삭제', '削除'],
    ['Duplicate (linked)', '링크 복제', 'リンク複製'], ['Duplicate (unique)', '독립 복제', '個別複製'], ['Make unique', '고유하게 만들기', 'ユニーク化'], ['Split at playhead', '재생 위치에서 분할', '再生位置で分割'],
    ['Insert Time', '시간 삽입', '時間を挿入'], ['Delete Time', '시간 삭제', '時間を削除'], ['Duplicate Time', '시간 복제', '時間を複製'],
    ['Select all', '모두 선택', 'すべて選択'], ['Select same pattern', '같은 패턴 선택', '同じパターンを選択'], ['Quantize', '퀀타이즈', 'クオンタイズ'], ['Group tracks', '그룹으로 묶기', 'グループ化'], ['Ungroup', '그룹 풀기', 'グループ解除'],
    ['Edit menu', '편집 메뉴', '編集メニュー'], [' — Every command also works from its shortcut, the command palette (Ctrl+P) and the right-click menu', ' — 모든 명령은 단축키·커맨드 팔레트(Ctrl+P)·오른쪽 클릭 메뉴에서도 쓸 수 있어요', ' — すべてのコマンドはショートカット・コマンドパレット(Ctrl+P)・右クリックメニューからも使えます'],
    ['Draw (P)', '그리기 (P)', '描画 (P)'], [' — Left-click to add the selected clip · Right-click to delete', ' — 왼쪽 클릭으로 고른 클립 추가 · 오른쪽 클릭으로 삭제', ' — 左クリックで選択中のクリップを追加 · 右クリックで削除'],
    ['Merge ↘', '병합 ↘', 'マージ ↘'], [' — Press on any branch to merge them before the next effect', ' — 갈래 중 하나라도 누르면 다음 이펙트 전에 합쳐져요', ' — どちらかの分岐で押すと次のエフェクトの前で合流します'],
    ['Piano roll', '피아노 롤', 'ピアノロール'], [' — Chop · Glue · Legato · Humanize · Control lane: CC64 sustain pedal is recorded with the notes', ' — 자르기 · 붙이기 · 레가토 · 휴머나이즈 · 컨트롤 레인: CC64 서스테인 페달이 노트와 함께 녹음돼요', ' — チョップ · グルー · レガート · ヒューマナイズ · コントロールレーン: CC64 サステインペダルもノートと一緒に録音'],
  ];
  // 앞부분만 바꾸는 글자 (뒤에 값이 붙는 것)
  const P = [
    [/^Pattern: /, ['패턴: ', 'パターン: ']], [/^Snap: Line/, ['스냅: 라인', 'スナップ: ライン']], [/^Key: C# minor/, ['키: C# 마이너', 'キー: C# マイナー']], [/^Chord: /, ['코드: ', 'コード: ']],
    [/^(\d+) items$/, ['$1개', '$1件']], [/^(\d+) bar$/, ['$1마디', '$1小節']], [/^Preset: /, ['프리셋: ', 'プリセット: ']], [/^Track (\d+) ›$/, ['트랙 $1 ›', 'トラック $1 ›']],
    [/^Quantize (\d+%)$/, ['퀀타이즈 $1', 'クオンタイズ $1']], [/^Swing ◔ (\d+%)$/, ['스윙 ◔ $1', 'スイング ◔ $1']], [/^👻 Ghost: /, ['👻 흐린 노트: ', '👻 ゴースト: ']],
    [/^⌕ Search samples/, ['⌕ 샘플 검색', '⌕ サンプル検索']], [/^⌕ Search plugins/, ['⌕ 플러그인 검색', '⌕ プラグイン検索']], [/^⌕ Search patterns/, ['⌕ 패턴 검색', '⌕ パターン検索']],
    [/^🎹 Piano roll — /, ['🎹 피아노 롤 — ', '🎹 ピアノロール — ']], [/^🌐 EN ▾$/, ['🌐 KO ▾', '🌐 JA ▾']],
  ];
  const dict = new Map(W.map(r => [r[0].trim(), r[1 + I]]));
  // 사용자·플러그인이 정한 글자는 건너뜀
  const SKIP = '.msg, .bub, .clip, .marks, .notes, .badge, .tn b, .tn small, .it > span, .fx b, .knob, .inst .name, .irow .nm, .mxs .nm, .mxs small, .glab';
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    const el = n.parentElement; if (!el || el.closest(SKIP) || el.closest('script,style')) continue;
    const raw = n.nodeValue, t = raw.trim(); if (!t) continue;
    if (dict.has(t)) { n.nodeValue = raw.replace(t, dict.get(t)); continue; }
    if (dict.has(raw)) { n.nodeValue = dict.get(raw); continue; }
    for (const [re, rr] of P) if (re.test(t)) { n.nodeValue = raw.replace(t, t.replace(re, rr[I])); break; }
  }
  // 트랙 이름 칸 안의 종류 배지(MAIN·GROUP·RETURN)는 화면 글자라 따로 바꿈
  document.querySelectorAll('.tbadge').forEach(e => { const t = e.textContent.trim(); if (dict.has(t)) e.textContent = dict.get(t); });
  // 언어 메뉴: 고른 언어에 ✓
  document.querySelectorAll('.langmenu div').forEach((d, k) => d.classList.toggle('on', k === 1 + I));
  // 아래 설명 줄
  const b = document.querySelector('.badge strong'), sm = document.querySelector('.badge small');
  if (b) b.textContent = (LANG === 'ko' ? '한국어 KO' : '日本語 JA') + ' · ' + b.textContent.replace(/^C Signal · /, '');
  if (sm) sm.textContent = (LANG === 'ko' ? '언어 설정 한국어' : '언어 설정 일본어') + ' — 화면 글자(메뉴·버튼·안내·칸 이름)만 바뀜. 트랙·패턴·마커·파일 이름, 채팅, 플러그인 이름·파라미터(Osc·Filter 등)는 그대로 (PRD 02 FR-2171)';
})();
