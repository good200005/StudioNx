"""YouTrack REST API 도우미 (Studio Nx).

인증 정보: 환경 변수 YOUTRACK_URL, YOUTRACK_TOKEN
(현재 프로세스에 없으면 Windows 사용자 환경 변수에서 읽음 — setx 직후 재시작 전에도 동작)

사용:
  python tools/youtrack/yt.py check                 연결·프로젝트 확인
  python tools/youtrack/yt.py issues SNX             프로젝트 이슈 목록 (ID, 계획 번호, 상위 연결 여부)
  python tools/youtrack/yt.py link-parents SNX       계획 번호 기준으로 subtask 연결 (--dry-run 으로 미리보기)
  python tools/youtrack/yt.py states SNX             State 필드에 쓸 수 있는 값 목록
  python tools/youtrack/yt.py set-state SNX P1-01 Fixed [--comment "PR #10 병합"]
                                                    계획 번호로 이슈를 찾아 State 변경 (+ 코멘트)
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def _env(name):
    value = os.environ.get(name)
    if value or os.name != "nt":
        return value
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            return winreg.QueryValueEx(key, name)[0]
    except OSError:
        return None


BASE = (_env("YOUTRACK_URL") or "").rstrip("/")
TOKEN = _env("YOUTRACK_TOKEN")


def api(method, path, params=None, body=None):
    if not BASE or not TOKEN:
        sys.exit("YOUTRACK_URL / YOUTRACK_TOKEN 이 설정되지 않았습니다.")
    url = f"{BASE}/api/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    for attempt in range(4):  # 네트워크가 끊기면 재시도 (HTTP 오류는 즉시 중단)
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                raw = res.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            sys.exit(f"HTTP {e.code} {method} {path}: {e.read().decode(errors='replace')[:300]}")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            if attempt == 3:
                sys.exit(f"네트워크 오류 {method} {path}: {e}")
            time.sleep(2 * (attempt + 1))


PLAN_ID = re.compile(r"^\[?(E[123C]|S[123]-\d{2}|C-\d{2}|P1-\d{2})\b")
PARENT_IN_DESC = re.compile(r"상위 작업:\s*(E[123C]|S[123]-\d{2}|C-\d{2})")
EPIC_SUMMARY = {"1단계": "E1", "2단계": "E2", "3단계": "E3", "병행": "EC"}


def plan_id(summary):
    m = PLAN_ID.match(summary)
    if m:
        return m.group(1)
    m = re.match(r"^\[(1단계|2단계|3단계|병행)\]", summary)
    return EPIC_SUMMARY.get(m.group(1)) if m else None


def project_issues(key):
    issues, skip = [], 0
    while True:
        page = api("GET", "issues", {
            "query": f"project: {key}",
            "fields": "idReadable,summary,description,parent(issues(idReadable))",
            "$top": 100, "$skip": skip,
        })
        issues += page
        if len(page) < 100:
            return issues
        skip += 100


def cmd_check():
    me = api("GET", "users/me", {"fields": "login,fullName"})
    projects = api("GET", "admin/projects", {"fields": "shortName,name"})
    print(f"연결 OK — 사용자: {me.get('fullName') or me.get('login')}")
    for p in projects:
        print(f"  프로젝트 {p['shortName']}: {p['name']}")


def cmd_issues(key):
    for i in project_issues(key):
        parents = [p["idReadable"] for p in (i.get("parent") or {}).get("issues", [])]
        print(f"{i['idReadable']:<8} {plan_id(i['summary']) or '-':<6} parent={','.join(parents) or '-':<8} {i['summary'][:60]}")


def cmd_link_parents(key, dry_run):
    issues = project_issues(key)
    by_plan = {}
    for i in issues:
        pid = plan_id(i["summary"])
        if pid:
            by_plan[pid] = i
    linked = skipped = 0
    for pid, issue in sorted(by_plan.items()):
        m = PARENT_IN_DESC.search(issue.get("description") or "")
        if not m:
            continue
        parent = by_plan.get(m.group(1))
        if not parent:
            print(f"  ! {pid}: 상위 {m.group(1)} 이슈를 찾지 못함")
            continue
        current = [p["idReadable"] for p in (issue.get("parent") or {}).get("issues", [])]
        if parent["idReadable"] in current:
            skipped += 1
            continue
        print(f"  {issue['idReadable']} ({pid})  subtask of  {parent['idReadable']} ({m.group(1)})")
        if not dry_run:
            api("POST", "commands", body={
                "query": f"subtask of {parent['idReadable']}",
                "issues": [{"idReadable": issue["idReadable"]}],
            })
        linked += 1
    print(f"{'예정' if dry_run else '연결'} {linked}건, 이미 연결 {skipped}건, 계획 번호 인식 {len(by_plan)}/{len(issues)}건")


def project_id(key):
    for p in api("GET", "admin/projects", {"fields": "id,shortName"}):
        if p["shortName"] == key:
            return p["id"]
    sys.exit(f"프로젝트 {key} 를 찾지 못했습니다.")


def project_fields(key):
    fields = api("GET", f"admin/projects/{project_id(key)}/customFields",
                 {"fields": "field(name,fieldType(id)),canBeEmpty"})
    return {f["field"]["name"]: f["field"]["fieldType"]["id"] for f in fields}


def cmd_fields(key):
    for name, ftype in sorted(project_fields(key).items()):
        print(f"  {name:<20} {ftype}")


def cmd_move(src, dst, dry_run):
    missing = sorted(set(project_fields(src)) - set(project_fields(dst)))
    if missing:
        print(f"  ⚠ {dst} 에 없는 필드 (옮기면 값이 사라짐): {', '.join(missing)}")
        if not dry_run:
            sys.exit("먼저 대상 프로젝트에 필드를 추가하세요 (중단).")
    issues = project_issues(src)
    print(f"{'예정' if dry_run else '이동'}: {src} → {dst}, {len(issues)}건")
    if dry_run:
        return
    for i in range(0, len(issues), 20):
        batch = issues[i:i + 20]
        api("POST", "commands", body={
            "query": f"project {dst}",
            "issues": [{"idReadable": x["idReadable"]} for x in batch],
        })
        print(f"  {i + len(batch)}/{len(issues)}")


def cmd_states(key):
    fields = api("GET", f"admin/projects/{project_id(key)}/customFields",
                 {"fields": "field(name),bundle(values(name,isResolved))"})
    for f in fields:
        if f["field"]["name"] == "State":
            for v in (f.get("bundle") or {}).get("values", []):
                print(f"  {v['name']:<20} {'(완료)' if v.get('isResolved') else ''}")
            return
    sys.exit("State 필드를 찾지 못했습니다.")


def cmd_set_state(key, pid, state, comment):
    matches = [i for i in project_issues(key) if plan_id(i["summary"]) == pid]
    if len(matches) != 1:
        sys.exit(f"계획 번호 {pid} 이슈가 {len(matches)}건입니다 (1건이어야 함).")
    issue = matches[0]["idReadable"]
    body = {"query": f"State {state}", "issues": [{"idReadable": issue}]}
    if comment:
        body["comment"] = comment
    api("POST", "commands", body=body)
    now = api("GET", f"issues/{issue}", {"fields": "summary,customFields(name,value(name))"})
    current = next((f["value"]["name"] for f in now["customFields"]
                    if f["name"] == "State" and f.get("value")), "?")
    print(f"{issue} ({pid}) State = {current} — {now['summary'][:60]}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "check":
        cmd_check()
    elif args[0] == "issues":
        cmd_issues(args[1])
    elif args[0] == "link-parents":
        cmd_link_parents(args[1], "--dry-run" in args)
    elif args[0] == "fields":
        cmd_fields(args[1])
    elif args[0] == "move":
        cmd_move(args[1], args[2], "--dry-run" in args)
    elif args[0] == "states":
        cmd_states(args[1])
    elif args[0] == "set-state":
        comment = args[args.index("--comment") + 1] if "--comment" in args else None
        cmd_set_state(args[1], args[2], args[3], comment)
    else:
        sys.exit(__doc__)
