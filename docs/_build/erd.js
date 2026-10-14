// ERD 정의 → Graphviz DOT (splines=ortho, 직각 직선) 생성
// 사용: node docs/_build/build.js 가 이 모듈을 불러 ERD.png 를 만듭니다.

const groups = [
  { id: 'account', label: '계정 · 사이트 운영', color: '#E8F1FF', head: '#3B6FD8', tables: {
    users:         [['PK', 'user_id'], ['UQ', 'email'], ['UQ', 'nickname']],
    user_settings: [['PK FK', 'user_id']],
    password_reset_tokens: [['PK', 'token_id'], ['FK', 'user_id'], ['UQ', 'token_hash']],
    inquiries:     [['PK', 'inquiry_id'], ['FK', 'user_id (null)']],
    dev_notes:     [['PK', 'note_id'], ['FK', 'author_id']],
  }},
  { id: 'project', label: '프로젝트 · 협업 (코멘트 · 스냅샷)', color: '#FFF4E5', head: '#D9822B', tables: {
    projects:            [['PK', 'project_id'], ['FK', 'owner_id'], ['FK', 'template_id (null)']],
    project_members:     [['PK FK', 'project_id'], ['PK FK', 'user_id']],
    project_sessions:    [['PK', 'session_id'], ['FK', 'project_id'], ['FK', 'user_id → users']],
    invitations:         [['PK', 'invitation_id'], ['FK', 'project_id'], ['FK', 'inviter_id → users'], ['FK', 'invitee_id → users (null)'], ['UQ', 'token']],
    project_change_logs: [['PK', 'change_id'], ['FK', 'project_id'], ['FK', 'user_id → users'], ['UQ', '(project_id, revision)']],
    chat_messages:       [['PK', 'message_id'], ['FK', 'project_id'], ['FK', 'user_id → users (null)']],
    timeline_comments:   [['PK', 'comment_id'], ['FK', 'project_id'], ['FK', 'user_id → users'], ['FK', 'parent_comment_id → self (null)'], ['FK', 'track_id (null)'], ['FK', 'clip_id (null)'], ['FK', 'resolved_by → users (null)']],
    project_snapshots:   [['PK', 'snapshot_id'], ['FK', 'project_id'], ['FK', 'created_by → users (null)']],
  }},
  { id: 'seq', label: '시퀀서 (트랙 · 패턴 · 오토메이션)', color: '#EAF8EE', head: '#2F9E5B', tables: {
    tracks:             [['PK', 'track_id'], ['FK', 'project_id'], ['FK', 'parent_track_id → self (null)'], ['FK', 'frozen_sample_id (null)'], ['FK', 'assignee_id → users (null)'], ['FK', 'locked_by → users (null)']],
    track_instruments:  [['PK', 'track_instrument_id'], ['FK', 'track_id'], ['FK', 'plugin_id'], ['UQ', '(track_id, slot_index)']],
    track_sends:        [['PK', 'send_id'], ['FK', 'track_id'], ['FK', 'return_track_id → tracks'], ['UQ', '(track_id, return_track_id)']],
    track_connections:  [['PK', 'connection_id'], ['FK UQ', 'from_track_id'], ['FK', 'to_track_id → tracks'], ['FK', 'to_track_plugin_id (null)']],
    track_plugins:      [['PK', 'track_plugin_id'], ['FK', 'track_id'], ['FK', 'plugin_id'], ['UQ', '(track_id, slot_index)']],
    track_plugin_links: [['PK', 'link_id'], ['FK', 'track_id'], ['FK', 'from_track_plugin_id (null)'], ['FK', 'to_track_plugin_id (null)']],
    patterns:           [['PK', 'pattern_id'], ['FK', 'project_id']],
    clips:              [['PK', 'clip_id'], ['FK', 'track_id'], ['FK', 'sample_id (null)'], ['FK', 'pattern_id (null)']],
    midi_notes:         [['PK', 'note_id'], ['FK', 'pattern_id']],
    midi_cc_events:     [['PK', 'event_id'], ['FK', 'pattern_id']],
    automation_lanes:   [['PK', 'lane_id'], ['FK', 'track_id'], ['FK', 'track_plugin_id (null)']],
    automation_points:  [['PK', 'point_id'], ['FK', 'lane_id']],
    tempo_changes:      [['PK', 'tempo_change_id'], ['FK', 'project_id'], ['UQ', '(project_id, tick)']],
    meter_changes:      [['PK', 'meter_change_id'], ['FK', 'project_id'], ['UQ', '(project_id, tick)']],
    markers:            [['PK', 'marker_id'], ['FK', 'project_id']],
  }},
  { id: 'lib', label: '라이브러리 · 플러그인 · 템플릿', color: '#F3EEFF', head: '#7C5CFF', tables: {
    samples:        [['PK', 'sample_id'], ['FK', 'owner_id']],
    tags:           [['PK', 'tag_id'], ['UQ', '(category, name)']],
    sample_tags:    [['PK FK', 'sample_id'], ['PK FK', 'tag_id']],
    plugins:        [['PK', 'plugin_id'], ['UQ', 'code']],
    plugin_presets: [['PK', 'preset_id'], ['FK', 'plugin_id'], ['FK', 'owner_id (null)']],
    project_templates: [['PK', 'template_id'], ['FK', 'owner_id (null)'], ['FK', 'genre_tag_id (null)']],
  }},
  { id: 'job', label: '출력 · 분리', color: '#FDECEC', head: '#D64545', tables: {
    export_jobs:      [['PK', 'export_id'], ['FK', 'project_id'], ['FK', 'user_id → users']],
    separation_jobs:  [['PK', 'separation_id'], ['FK', 'source_sample_id'], ['FK', 'user_id → users']],
    separation_stems: [['PK', 'stem_id'], ['FK', 'separation_id'], ['FK UQ', 'sample_id']],
  }},
  { id: 'ai', label: 'AI (레퍼런스 분석 · Nyxi 도우미)', color: '#E9F7F8', head: '#1E8C96', tables: {
    reference_tracks:   [['PK', 'reference_id'], ['FK', 'user_id'], ['FK', 'project_id (null)']],
    reference_tags:     [['PK FK', 'reference_id'], ['PK FK', 'tag_id']],
    ai_analyses:        [['PK', 'analysis_id'], ['FK', 'reference_id']],
    ai_recommendations: [['PK', 'recommendation_id'], ['FK', 'analysis_id'], ['FK', 'project_id (null)'], ['FK', 'target_plugin_id (null)']],
    assistant_messages: [['PK', 'message_id'], ['FK', 'user_id'], ['FK', 'project_id (null)']],
  }},
];

// [부모, 자식, 종류]  kind: 'N' = 1:N(FK 필수), 'N?' = 0..1:N(FK NULL 허용), '1' = 1:1
// "→ users"로 표시된 행위자 FK(요청자·작성자)는 선이 너무 많아져 선을 생략하고 박스 안에만 표기
const relations = [
  ['users', 'projects', 'N'], ['users', 'user_settings', '1'], ['users', 'password_reset_tokens', 'N'], ['users', 'inquiries', 'N?'], ['users', 'dev_notes', 'N'],
  ['users', 'samples', 'N'], ['users', 'plugin_presets', 'N?'], ['users', 'project_members', 'N'],
  ['users', 'reference_tracks', 'N'], ['users', 'assistant_messages', 'N'],
  ['projects', 'project_members', 'N'], ['projects', 'project_sessions', 'N'], ['projects', 'invitations', 'N'], ['projects', 'project_change_logs', 'N'],
  ['projects', 'chat_messages', 'N'], ['projects', 'tracks', 'N'], ['projects', 'export_jobs', 'N'],
  ['projects', 'reference_tracks', 'N?'], ['projects', 'ai_recommendations', 'N?'], ['projects', 'assistant_messages', 'N?'],
  ['tracks', 'track_plugins', 'N'], ['tracks', 'track_plugin_links', 'N'], ['tracks', 'clips', 'N'],
  ['track_plugins', 'track_plugin_links', 'N?'],
  ['projects', 'patterns', 'N'], ['patterns', 'clips', 'N?'], ['patterns', 'midi_notes', 'N'],
  ['tracks', 'automation_lanes', 'N'], ['track_plugins', 'automation_lanes', 'N?'], ['automation_lanes', 'automation_points', 'N'],
  ['projects', 'tempo_changes', 'N'], ['projects', 'meter_changes', 'N'], ['projects', 'markers', 'N'],
  ['tracks', 'track_instruments', 'N'], ['plugins', 'track_instruments', 'N'], ['tracks', 'track_sends', 'N'], ['tracks', 'track_connections', 'N'],
  ['track_plugins', 'track_connections', 'N?'], ['patterns', 'midi_cc_events', 'N'], ['samples', 'tracks', 'N?'],
  ['users', 'project_templates', 'N?'], ['tags', 'project_templates', 'N?'], ['project_templates', 'projects', 'N?'],
  ['projects', 'timeline_comments', 'N'], ['projects', 'project_snapshots', 'N'], ['tracks', 'timeline_comments', 'N?'], ['clips', 'timeline_comments', 'N?'],
  ['samples', 'clips', 'N?'], ['samples', 'sample_tags', 'N'], ['tags', 'sample_tags', 'N'],
  ['plugins', 'track_plugins', 'N'], ['plugins', 'plugin_presets', 'N'], ['plugins', 'ai_recommendations', 'N?'],
  ['samples', 'separation_jobs', 'N'], ['separation_jobs', 'separation_stems', 'N'], ['samples', 'separation_stems', '1'],
  ['reference_tracks', 'reference_tags', 'N'], ['tags', 'reference_tags', 'N'],
  ['reference_tracks', 'ai_analyses', 'N'], ['ai_analyses', 'ai_recommendations', 'N'],
];

function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function toDot() {
  const L = [];
  L.push('digraph ERD {');
  L.push('  graph [splines=ortho, rankdir=TB, nodesep=0.9, ranksep=1.1, pad=0.6, fontname="Malgun Gothic", fontsize=22, bgcolor="white", newrank=true];');
  L.push('  node  [shape=plaintext, fontname="Arial", fontsize=13];');
  L.push('  edge  [dir=both, penwidth=1.6, color="#555555", arrowsize=1.1];');
  for (const g of groups) {
    L.push(`  subgraph cluster_${g.id} { label=<<B>${esc(g.label)}</B>>; style="rounded,filled"; fillcolor="${g.color}"; color="${g.head}"; penwidth=2; margin=18;`);
    for (const [name, cols] of Object.entries(g.tables)) {
      const rows = cols.map(([k, c]) =>
        `<TR><TD ALIGN="LEFT" WIDTH="56"><FONT COLOR="${k.includes('PK') ? '#B8860B' : '#666666'}"><B>${k}</B></FONT></TD><TD ALIGN="LEFT">${esc(c)}</TD></TR>`).join('');
      L.push(`    ${name} [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="white" COLOR="${g.head}">` +
        `<TR><TD COLSPAN="2" BGCOLOR="${g.head}"><FONT COLOR="white" POINT-SIZE="15"><B>${name}</B></FONT></TD></TR>${rows}</TABLE>>];`);
    }
    L.push('  }');
  }
  for (const [p, c, k] of relations) {
    const tail = k === 'N?' ? 'teeodot' : 'teetee';
    const head = k === '1' ? 'teeodot' : 'crowodot';
    L.push(`  ${p} -> ${c} [arrowtail=${tail}, arrowhead=${head}];`);
  }
  L.push('}');
  return L.join('\n');
}

module.exports = { groups, relations, toDot };
