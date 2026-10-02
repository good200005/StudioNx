"""1회성: CSV로 가져온 StudioNx_tasks 이슈를 StudioNx 프로젝트로 옮기고 필드를 정식 형식으로 변환.

  python tools/youtrack/migrate_tasks_to_studionx.py setup     StudioNx 필드 구성 (값 추가·필드 연결)
  python tools/youtrack/migrate_tasks_to_studionx.py move      이슈 이동 + 값 변환 입력 (백업 파일 필요)

백업: 이동 전 각 이슈의 글자 필드 값 → tools/youtrack/.migrate_backup.json (git 제외)
다시 실행해도 이미 된 작업은 건너뜀.
"""

import datetime as dt
import json
import re
import sys
from pathlib import Path

import yt

SRC, DST = "StudioNx_tasks", "StudioNx"
BACKUP = Path(__file__).with_name(".migrate_backup.json")
TYPES = ["Epic", "Feature", "Task"]
STATES = [("In Progress", False), ("To be discussed", False)]
PRIORITIES = ["Critical", "Major", "Normal", "Minor"]
TEXT_FIELDS = ["Stage", "Owner", "Branch", "Related", "Plan ID", "Plan Parent", "Start date"]


def global_fields():
    return yt.api("GET", "admin/customFieldSettings/customFields",
                  {"fields": "id,name,fieldType(id),instances(project(shortName))", "$top": 200})


def field_id(name, ftype):
    for f in global_fields():
        if f["name"] == name and f["fieldType"]["id"] == ftype:
            return f["id"]
    sys.exit(f"전역 필드 {name} ({ftype}) 없음")


def project_field_map(pid):
    pf = yt.api("GET", f"admin/projects/{pid}/customFields",
                {"fields": "id,field(id,name),bundle(id,values(name))"})
    return {f["field"]["id"]: f for f in pf}, {f["field"]["name"]: f for f in pf}


def attach(pid, fid, ptype, bundle=None):
    by_id, _ = project_field_map(pid)
    if fid in by_id:
        return False
    body = {"$type": ptype, "field": {"$type": "CustomField", "id": fid}, "canBeEmpty": True}
    if bundle:
        body["bundle"] = {"$type": "EnumBundle", "id": bundle}
    yt.api("POST", f"admin/projects/{pid}/customFields", {"fields": "id"}, body)
    return True


def setup():
    pid = yt.project_id(DST)
    _, by_name = project_field_map(pid)

    # Type 값 추가
    tb = by_name["Type"]["bundle"]
    have = {v["name"] for v in tb["values"]}
    for t in TYPES:
        if t not in have:
            yt.api("POST", f"admin/customFieldSettings/bundles/enum/{tb['id']}/values", {"fields": "id"}, {"name": t})
            print(f"  Type 값 추가: {t}")

    # State 값 추가
    sb = by_name["State"]["bundle"]
    have = {v["name"] for v in sb["values"]}
    for s, resolved in STATES:
        if s not in have:
            yt.api("POST", f"admin/customFieldSettings/bundles/state/{sb['id']}/values", {"fields": "id"},
                   {"name": s, "isResolved": resolved})
            print(f"  State 값 추가: {s}")

    # Priority (enum) — YouTrack 기본 묶음('우선순위': Show-stopper·Critical·Major·Normal·Minor) 사용
    prio_fid = field_id("Priority", "enum[1]")
    by_id, _ = project_field_map(pid)
    if prio_fid not in by_id:
        defaults = next(f for f in yt.api("GET", "admin/customFieldSettings/customFields",
                                           {"fields": "id,fieldDefaults(bundle(id))", "$top": 200})
                        if f["id"] == prio_fid)["fieldDefaults"]
        attach(pid, prio_fid, "EnumProjectCustomField", defaults["bundle"]["id"])
        print("  Priority 필드 연결")

    if attach(pid, field_id("Due Date", "date"), "SimpleProjectCustomField"):
        print("  Due Date(날짜) 필드 연결")
    if attach(pid, field_id("예측", "period"), "PeriodProjectCustomField"):
        print("  예측(기간) 필드 연결")
    for name in TEXT_FIELDS:
        if attach(pid, field_id(name, "string"), "SimpleProjectCustomField"):
            print(f"  {name}(글자) 필드 연결")
    print("setup 완료")


def to_minutes(text):
    """'2주', '1.5주', '3일', '0.5일' → 분 (1일 = 8시간, 1주 = 5일)."""
    m = re.match(r"([\d.]+)\s*(주|일)", text or "")
    if not m:
        return None
    n = float(m.group(1))
    return int(n * (2400 if m.group(2) == "주" else 480))


def to_ms(day):
    if not day:
        return None
    d = dt.datetime.strptime(day, "%Y-%m-%d").replace(hour=12, tzinfo=dt.timezone.utc)
    return int(d.timestamp() * 1000)


def snapshot():
    issues = yt.api("GET", "issues", {"query": f"project: {SRC}", "$top": 500,
                                      "fields": "id,idReadable,customFields(name,value(name,text))"})
    data = {}
    for i in issues:
        vals = {}
        for cf in i["customFields"]:
            v = cf.get("value")
            vals[cf["name"]] = (v.get("name") or v.get("text")) if isinstance(v, dict) else v
        data[i["id"]] = {"old": i["idReadable"], "fields": vals}
    return data


def move():
    if BACKUP.exists():
        data = json.loads(BACKUP.read_text(encoding="utf-8"))
    else:
        data = snapshot()
        BACKUP.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"백업 {len(data)}건 → {BACKUP.name}")

    remaining = yt.api("GET", "issues", {"query": f"project: {SRC}", "fields": "id,idReadable", "$top": 500})
    for k in range(0, len(remaining), 20):
        batch = remaining[k:k + 20]
        yt.api("POST", "commands", body={"query": f"project {DST}",
                                         "issues": [{"id": x["id"]} for x in batch]})
        print(f"  이동 {k + len(batch)}/{len(remaining)}")

    for iid, rec in data.items():
        f = rec["fields"]
        cfs = []
        if f.get("Type"):
            cfs.append({"name": "Type", "$type": "MultiEnumIssueCustomField", "value": [{"name": f["Type"]}]})
        if f.get("State"):
            cfs.append({"name": "State", "$type": "StateIssueCustomField", "value": {"name": f["State"]}})
        if f.get("Priority"):
            cfs.append({"name": "Priority", "$type": "SingleEnumIssueCustomField", "value": {"name": f["Priority"]}})
        if to_ms(f.get("Due Date")):
            cfs.append({"name": "Due Date", "$type": "DateIssueCustomField", "value": to_ms(f["Due Date"])})
        if to_minutes(f.get("Estimation")):
            cfs.append({"name": "예측", "$type": "PeriodIssueCustomField",
                        "value": {"minutes": to_minutes(f["Estimation"])}})
        if cfs:
            yt.api("POST", f"issues/{iid}", {"fields": "idReadable"}, {"customFields": cfs})
    print(f"값 입력 {len(data)}건 완료")


if __name__ == "__main__":
    {"setup": setup, "move": move}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
