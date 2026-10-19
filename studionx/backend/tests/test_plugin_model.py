"""plugins · plugin_presets · track_instruments · track_plugins · track_plugin_links 모델
(S1-09) — 실제 MySQL 과 비교하고 CASCADE · JSON · 슬롯 UNIQUE 를 확인한다.

DB 세션(db)과 비교 도구(assert_matches_db)는 conftest.py 에 있다.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import (
    Plugin,
    PluginPreset,
    Project,
    Track,
    TrackInstrument,
    TrackPlugin,
    TrackPluginLink,
    User,
)
from app.models.plugin import PluginEngine, PluginType, PresetSource
from app.models.track import TrackType

PARAM_SCHEMA = [
    {"key": "gain", "name": "Gain", "min": -60, "max": 24, "default": 0, "unit": "dB"},
    {
        "key": "mix",
        "name": "Mix",
        "min": 0,
        "max": 100,
        "default": 50,
        "unit": "%",
        "primary": True,
    },
]


def _user(db, name):
    user = User(
        email=f"{name}@example.com",
        password_hash="x",
        nickname=f"{name}_pm",
        privacy_agreed_at=datetime.now(UTC).replace(tzinfo=None),
        privacy_version="2026-10-17",
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def owner(db):
    return _user(db, "s109_owner")


@pytest.fixture
def track(db, owner):
    project = Project(owner_id=owner.user_id, title="S1-09 Model Song")
    db.add(project)
    db.flush()
    track = Track(project_id=project.project_id, name="S1-09 Track", track_type=TrackType.MIDI)
    db.add(track)
    db.flush()
    return track


@pytest.fixture
def plugin(db):
    plugin = Plugin(
        code="m_s109_eq",
        name="Model EQ",
        plugin_type=PluginType.EFFECT,
        param_schema=PARAM_SCHEMA,
    )
    db.add(plugin)
    db.flush()
    return plugin


def test_columns_match_db(assert_matches_db):
    # tracks 는 test_track_model.py 가 담당한다
    assert_matches_db(Plugin)
    assert_matches_db(PluginPreset)
    assert_matches_db(TrackInstrument)
    assert_matches_db(TrackPlugin)
    assert_matches_db(TrackPluginLink)


def test_plugin_defaults_from_db(db, plugin):
    """열을 안 넣으면 DB 기본값으로 채워진다 — engine 은 WEBAUDIO, is_active 는 켜짐."""
    db.refresh(plugin)
    assert plugin.engine is PluginEngine.WEBAUDIO
    assert plugin.plugin_type is PluginType.EFFECT
    assert plugin.is_active is True


def test_param_schema_roundtrip(db, plugin):
    """param_schema 는 JSON 그대로 읽히고, primary 표시도 남아 있다 (FR-244·2181)."""
    db.refresh(plugin)
    assert plugin.param_schema == PARAM_SCHEMA
    assert plugin.param_schema[1]["primary"] is True


def test_preset_owner_null_is_system(db, plugin, owner):
    """owner_id 가 NULL 이면 모두에게 보이는 시스템 프리셋, 값이 있으면 내 것이다 (FR-246)."""
    system = PluginPreset(
        plugin_id=plugin.plugin_id,
        owner_id=None,
        name="Init",
        params={},
        source=PresetSource.SYSTEM,
    )
    mine = PluginPreset(
        plugin_id=plugin.plugin_id, owner_id=owner.user_id, name="Mine", params={"gain": -6}
    )
    db.add_all([system, mine])
    db.commit()
    db.refresh(system)
    db.refresh(mine)
    assert system.owner_id is None
    assert system.source is PresetSource.SYSTEM
    assert mine.owner_id == owner.user_id
    assert mine.source is PresetSource.USER  # DB.md 기본값
    assert mine.owner_id == owner.user_id
    assert mine.params == {"gain": -6}


def test_same_slot_twice_is_rejected(db, track, plugin):
    """DB 는 같은 트랙의 같은 칸에 두 행을 넣지 않는다 (UNIQUE (track_id, slot_index))."""
    db.add(TrackInstrument(track_id=track.track_id, plugin_id=plugin.plugin_id, slot_index=0))
    db.flush()
    db.add(TrackInstrument(track_id=track.track_id, plugin_id=plugin.plugin_id, slot_index=0))
    with pytest.raises(IntegrityError):
        db.flush()


def test_deleting_track_deletes_device_rows(db, track, plugin):
    """트랙을 지우면 악기·이펙트·연결선이 DB CASCADE 로 함께 사라진다.

    세는 범위를 지운 트랙으로 좁힌다. 개발용 DB 에 다른 트랙의 장치가 남아 있어도
    (예: S1-09 화면 시험 프로젝트) 이 시험이 흔들리지 않게 하기 위해서다.
    """
    inst = TrackInstrument(track_id=track.track_id, plugin_id=plugin.plugin_id, params={})
    fx_a = TrackPlugin(track_id=track.track_id, plugin_id=plugin.plugin_id, slot_index=0, params={})
    fx_b = TrackPlugin(track_id=track.track_id, plugin_id=plugin.plugin_id, slot_index=1, params={})
    db.add_all([inst, fx_a, fx_b])
    db.flush()
    db.add(
        TrackPluginLink(
            track_id=track.track_id,
            from_track_plugin_id=fx_a.track_plugin_id,
            to_track_plugin_id=fx_b.track_plugin_id,
        )
    )
    db.flush()

    track_id = track.track_id
    db.delete(track)
    db.flush()

    counts = [
        db.scalar(select(func.count()).select_from(model).where(model.track_id == track_id))
        for model in (TrackInstrument, TrackPlugin, TrackPluginLink)
    ]
    assert counts == [0, 0, 0]
