# Implementation_Plan.md → docs/youtrack/StudioNx_tasks.csv (YouTrack 가져오기용)
# 실행: python docs/_build/make_youtrack_csv.py
# 진행 상황(State)은 아래 state 딕셔너리에서 직접 갱신
import csv, re, datetime as dt
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1]   # docs/
md = (DOCS / 'Implementation_Plan.md').read_text(encoding='utf8')


def clean(t):
    t = re.sub(r'\*\*(.+?)\*\*', r'\1', t)
    return t.replace('`', '').strip()


def cells(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]


# 간트 날짜: ID → (시작, 종료)
dates = {}
for m in re.finditer(r'^\s+((?:S[123]|C)-\d+) .*?:\w+, (\d{4}-\d{2}-\d{2}), (\d+)d', md, re.M):
    s = dt.date.fromisoformat(m.group(2))
    dates[m.group(1)] = (s, s + dt.timedelta(days=int(m.group(3)) - 1))

PRIO = {'최상': 'Critical', '상': 'Major', '중': 'Normal', '하': 'Minor'}
EPIC = {'S1': ('E1', '1단계 MVP'), 'S2': ('E2', '2단계 작곡 완성도 · 차별화'),
        'S3': ('E3', '3단계 협업 · 경험'), 'C': ('EC', '병행 C++ / JUCE → WASM (사용자 학습)')}

rows = []
# Epic
epics = [
    ('E1', '[1단계] MVP — 혼자 곡 만들기 → 저장 → WAV 출력', '2026-10-12', '2027-02-07', 'v0.1 MVP (2027-02-08)'),
    ('E2', '[2단계] 작곡 완성도 · 차별화 — 패처·오토메이션·녹음·AI 분석·악기 분리', '2027-02-08', '2027-07-18', 'v0.2 (2027-07-19)'),
    ('E3', '[3단계] 협업 · 경험 — 실시간 협업·Nyxi·튜토리얼', '2027-07-19', '2027-11-30', 'v1.0 (2027-12-01)'),
    ('EC', '[병행] C++ / JUCE → WASM 학습', '2026-12-01', '2027-09-28', '사용자 학습 트랙'),
]
for i, s, a, b, ms in epics:
    rows.append(dict(ID=i, Summary=s, Type='Epic', Parent='', Stage={v[0]: v[1] for v in EPIC.values()}[i], Priority='Critical' if i != 'EC' else 'Normal',
                     State='Open', Owner='', Estimation='', **{'Start date': a, 'Due Date': b}, Branch='',
                     Related='', Description=f'마일스톤: {ms}. 출처: docs/Implementation_Plan.md'))

# S / C 작업
for line in md.splitlines():
    m = re.match(r'^\| ((S[123])-\d+|(C)-\d+) \|', line)
    if not m:
        continue
    c = cells(line)
    tid = c[0]
    key = m.group(2) or m.group(3)
    epic_id, stage = EPIC[key]
    if key == 'C':
        summary, period = clean(c[1]), c[2]
        prio, rel, est = 'Normal', 'PRD 02 §4.6', ''
        owner, desc_extra = '사용자 (C++ 직접 구현)', f'목표 시기: {period}'
    else:
        summary, rel, est, prio = clean(c[1]), clean(c[2]), clean(c[3]), PRIO.get(c[4], 'Normal')
        owner, desc_extra = '', ''
    s, e = dates.get(tid, (None, None))
    rows.append(dict(ID=tid, Summary=f'{tid} {summary}', Type='Feature', Parent=epic_id, Stage=stage, Priority=prio,
                     State='Open', Owner=owner, Estimation=est,
                     **{'Start date': s.isoformat() if s else '', 'Due Date': e.isoformat() if e else ''},
                     Branch='feature/native-dsp' if key == 'C' else '', Related=rel,
                     Description=' '.join(x for x in [summary, desc_extra, '출처: docs/Implementation_Plan.md'] if x)))

# P1 세부 작업 → 상위 S1 작업
P1_PARENT = {}
for ids, parent in [('03 04 05', 'S1-02'), ('01 06 11', 'S1-03'),
                    ('02 07 08 09 10 12 13 14 15 16 17 18 19', 'S1-04')]:
    for n in ids.split():
        P1_PARENT[f'P1-{n}'] = parent
for line in md.splitlines():
    if not re.match(r'^\| P1-\d+ \|', line):
        continue
    c = cells(line)
    tid, group, work, fr, who, est, branch = c[0], c[1], clean(c[2]), clean(c[3]), clean(c[4]), c[5], clean(c[6])
    rows.append(dict(ID=tid, Summary=f'{tid} {work}', Type='Task', Parent=P1_PARENT[tid], Stage='1단계 MVP',
                     Priority='Major', State='Open', Owner=who, Estimation=est, **{'Start date': '', 'Due Date': ''},
                     Branch=branch, Related=f'PRD 01 {fr}' if fr not in ('—', '') else '',
                     Description=f'[{group}] {work} 출처: docs/Implementation_Plan.md §2.1'))

# 현재 진행 상황 반영
state = {
    'S1-01': ('In Progress', '개발 환경·DB(33개 테이블)·FastAPI 뼈대 완료. Sentry는 코드만 연결(DSN 미입력).'),
    'P1-01': ('In Progress', '공통 CSS + home.html 첫 화면 완료, PR #1 (→ feature/phase1-account) 리뷰 대기.'),
    'P1-11': ('In Progress', 'home.html 구조·첫 화면은 P1-01에서 함께 구현. 섹션 5개 내용·문의 폼 남음.'),
}
for r in rows:
    if r['ID'] in state:
        r['State'], note = state[r['ID']]
        r['Description'] += f' | 진행 상황(2026-10-02): {note}'

rows.append(dict(ID='P1-20', Summary='P1-20 home 첫 접속 로딩(인트로) 애니메이션 → 첫 화면 전환', Type='Task', Parent='S1-03',
                 Stage='1단계 MVP', Priority='Minor', State='To be discussed', Owner='AI(화면) / 직접(JS)', Estimation='1일',
                 **{'Start date': '', 'Due Date': ''}, Branch='feature/phase1/p1-20-intro-loader', Related='',
                 Description='보류: 약 1초, 건너뛰기 없음, 레퍼런스는 사용자가 추후 제공. 첫 방문만 표시·동작 줄이기 설정 처리 여부 미정.'))

out = DOCS / 'youtrack' / 'StudioNx_tasks.csv'
out.parent.mkdir(exist_ok=True)
cols = ['ID', 'Summary', 'Type', 'Parent', 'Stage', 'Priority', 'State', 'Owner', 'Estimation',
        'Start date', 'Due Date', 'Branch', 'Related', 'Description']
# YouTrack이 'ID'·'Parent' 열을 자체 필드(이슈 ID·상위 이슈)로 자동 매핑해 가져오기가 실패하므로
# 계획 번호용 이름으로 바꾸고, 상위 작업은 설명에도 적어 둔다 (subtask 링크는 가져온 뒤 연결)
RENAME = {'ID': 'Plan ID', 'Parent': 'Plan Parent'}
for r in rows:
    if r['Parent']:
        r['Description'] += f' | 상위 작업: {r["Parent"]}'
cols = [RENAME.get(c, c) for c in cols]
rows = [{RENAME.get(k, k): v for k, v in r.items()} for r in rows]
with open(out, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

from collections import Counter
print(out, len(rows), Counter(r['Type'] for r in rows), Counter(r['State'] for r in rows))
print('dates missing:', [r['Plan ID'] for r in rows if r['Type'] == 'Feature' and not r['Start date']])
