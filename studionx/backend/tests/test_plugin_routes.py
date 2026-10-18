"""/api/v1/plugins 라우터 (S1-09 FR-241·244·246) — 플러그인 목록·상세·프리셋.

미로그인 401, 활성 플러그인만 보기, 프리셋은 시스템 제공분과 내 것만 보이는지,
없는 플러그인은 404 인지 확인한다.
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import Plugin, PluginPreset, User
from app.models.plugin import PluginType, PresetSource

URL = "/api/v1/plugins"
PLUGIN_KEYS = {
    "plugin_id", "code", "name", "plugin_type", "engine", "version",
    "param_schema", "card_asset", "is_active",
}
PRESET_KEYS = {"preset_id", "plugin_id", "owner_id", "name", "params", "source"}

CUTOFF_SCHEMA = [
    {"key": "cutoff", "name": "Cutoff", "min": 20, "max": 20000, "default": 1200, "unit": "Hz"},
    {"key": "res", "name": "Resonance", "type": "knob", "min": 0, "max": 1, "default": 0.1},
]


def test_plugin_routes_registered():
    paths = app.openapi()["paths"]
    assert "get" in paths[URL]
    assert "get" in paths[URL + "/{plugin_id}"]
    assert "get" in paths[URL + "/{plugin_id}/presets"]


def add_user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_pl",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-17",
    )
    db.add(user)
    db.flush()
    return user


def add_plugin(db, code, name="EQ 3-Band", plugin_type=PluginType.EFFECT, active=True):
    plugin = Plugin(
        code=code,
        name=name,
        plugin_type=plugin_type,
        param_schema=CUTOFF_SCHEMA,
    )
    if not active:
        plugin.is_active = False
    db.add(plugin)
    db.flush()
    return plugin


def add_preset(db, plugin, name, owner_id=None, source=PresetSource.SYSTEM):
    preset = PluginPreset(
        plugin_id=plugin.plugin_id,
        owner_id=owner_id,
        name=name,
        params={"cutoff": 800},
        source=source,
    )
    db.add(preset)
    db.flush()
    return preset


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id)}"}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_requires_login(client):
    res = client.get(URL)

    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_list_plugins_active_only(client, db):
    user = add_user(db, "pl_list")
    inst = add_plugin(db, "pl_a_inst", "A Instrument", plugin_type=PluginType.INSTRUMENT)
    add_plugin(db, "pl_a_fx", "A Effect")
    add_plugin(db, "pl_a_old", "A Old One", active=False)

    res = client.get(URL, headers=auth(user))

    assert res.status_code == 200
    items = res.json()["items"]
    codes = [i["code"] for i in items]
    assert "pl_a_inst" in codes and "pl_a_fx" in codes  # 내가 만든 활성 플러그인
    assert "pl_a_old" not in codes  # 끈 것은 목록에 없다
    # 응답 칸은 화면이 노브를 만드는 데 쓰는 칸 그대로
    assert PLUGIN_KEYS <= set(items[0])
    # 종류 순 (INSTRUMENT < EFFECT < MIDI_EFFECT)
    assert codes.index("pl_a_inst") < codes.index("pl_a_fx")
    assert any(i["plugin_id"] == inst.plugin_id for i in items)


def test_list_plugins_can_include_inactive(client, db):
    user = add_user(db, "pl_all")
    add_plugin(db, "pl_b_fx")
    add_plugin(db, "pl_b_old", active=False)

    res = client.get(URL, params={"active_only": "false"}, headers=auth(user))

    assert res.status_code == 200
    codes = {i["code"] for i in res.json()["items"]}
    assert {"pl_b_fx", "pl_b_old"} <= codes


def test_get_plugin_builds_param_schema(client, db):
    user = add_user(db, "pl_get")
    plugin = add_plugin(db, "pl_c_eq")

    res = client.get(f"{URL}/{plugin.plugin_id}", headers=auth(user))

    assert res.status_code == 200
    data = res.json()
    assert set(data) == PLUGIN_KEYS
    assert data["code"] == "pl_c_eq"
    assert data["plugin_type"] == "EFFECT"
    assert data["engine"] == "WEBAUDIO"
    # DB JSON 을 ParamSchemaItem 으로 읽어 화면이 노브를 만들 수 있게 한다
    assert data["param_schema"][0]["key"] == "cutoff"
    assert data["param_schema"][0]["max"] == 20000
    assert data["param_schema"][1]["type"] == "knob"  # 안 적으면 기본값 knob


def test_get_plugin_404(client, db):
    user = add_user(db, "pl_404")

    res = client.get(f"{URL}/999999", headers=auth(user))

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_list_presets_only_system_and_mine(client, db):
    user = add_user(db, "pl_owner")
    other = add_user(db, "pl_other")
    plugin = add_plugin(db, "pl_d_synth", plugin_type=PluginType.INSTRUMENT)
    add_preset(db, plugin, "Init")
    add_preset(db, plugin, "My Bass", owner_id=user.user_id, source=PresetSource.USER)
    add_preset(db, plugin, "Other User", owner_id=other.user_id, source=PresetSource.USER)

    res = client.get(f"{URL}/{plugin.plugin_id}/presets", headers=auth(user))

    assert res.status_code == 200
    presets = res.json()
    assert [p["name"] for p in presets] == ["Init", "My Bass"]  # 이름 순, 남의 것은 안 보임
    assert set(presets[0]) == PRESET_KEYS
    assert presets[1]["source"] == "USER"


def test_presets_requires_login(client, db):
    plugin = add_plugin(db, "pl_e_eq")

    res = client.get(f"{URL}/{plugin.plugin_id}/presets")

    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_presets_of_unknown_plugin_404(client, db):
    user = add_user(db, "pl_p404")

    res = client.get(f"{URL}/999999/presets", headers=auth(user))

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"
