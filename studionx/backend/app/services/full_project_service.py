"""프로젝트 전체 조회 서비스 — S1-10·S1-10a (FR-254·2196·2197).

시퀀서는 화면을 열 때 `GET /projects/{id}/full` 한 번으로 곡 전체를 받는다.
그 한 번의 요청이 여기 get_full_project 로 들어와, 프로젝트 설정 · 트랙(+악기·이펙트·연결선) ·
트랙 간 연결 · 패턴(+노트) · 클립을 모아 FullProjectResponse 하나로 만든다.

쿼리를 트랙 수·패턴 수만큼 늘리지 않는다. 트랙 목록 · 악기 · 이펙트 · 연결선 · 트랙 간 연결 ·
패턴 · 노트 · 클립 여덟 번 조회한 뒤 파이썬에서 track_id · pattern_id 로 묶는다 (화면을 열
때마다 곡 크기에 비례해 느려지지 않게 하려는 것).

권한은 다른 프로젝트 API 와 같다. 멤버가 아니거나 없는 프로젝트는 404 (project_service
get_membership).
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Clip, MidiNote, Pattern, Project, ProjectMember, Track, User
from app.models.track_connection import TrackConnection
from app.models.track_plugin import TrackInstrument, TrackPlugin, TrackPluginLink
from app.schemas.clip import ClipResponse
from app.schemas.connection import TrackConnectionResponse
from app.schemas.device import (
    TrackInstrumentResponse,
    TrackPluginLinkResponse,
    TrackPluginResponse,
)
from app.schemas.full_project import (
    FullProjectInfo,
    FullProjectResponse,
    FullTrackResponse,
)
from app.schemas.track import TrackResponse
from app.services import pattern_service, project_service


def _group_by(rows: list, key) -> dict[Any, list]:
    """행 목록을 key(row) 값으로 묶는다 — 트랙별 장치, 패턴별 노트.

    한 트랙(패턴)의 행이 목록 안에서 서로 붙어 있지 않아도 되도록 딕셔너리로 모은다.
    묶인 목록의 차례는 조회 때 정한 차례(slot_index 순 등)를 그대로 지킨다.
    """
    grouped: dict[Any, list] = {}
    for row in rows:
        grouped.setdefault(key(row), []).append(row)
    return grouped


def project_info(db: Session, project: Project, member: ProjectMember) -> FullProjectInfo:
    """Project → FullProjectInfo (곡 설정까지 담은 프로젝트 칸).

    멤버 수와 열어 본 적이 있는지는 project_service.to_item 이 세는 값을 그대로 쓴다 —
    목록 한 줄(myProject 화면)과 시퀀서가 보는 값이 어긋나지 않게 하려는 것.
    """
    item = project_service.to_item(db, project, member)
    return FullProjectInfo(
        **item.model_dump(),
        scale_mode=project.scale_mode,
        sample_rate=project.sample_rate,
        master_settings=project.master_settings,
        revision=project.revision,
    )


def _full_track(
    track: Track,
    instruments: dict[Any, list],
    effects: dict[Any, list],
    links: dict[Any, list],
    connections: dict[Any, list],
) -> FullTrackResponse:
    """트랙 한 줄 + 그 트랙의 악기·이펙트·연결선·나가는 연결 (FR-245·263·267·269·2197).

    트랙 칸은 목록 API 와 같은 모양(TrackResponse)을 그대로 쓰고, 장치 세 목록과 나가는
    연결 하나(0~1개)만 더한다.
    """
    base = TrackResponse.model_validate(track).model_dump()
    return FullTrackResponse(
        **base,
        instruments=[
            TrackInstrumentResponse.model_validate(row)
            for row in instruments.get(track.track_id, [])
        ],
        effects=[
            TrackPluginResponse.model_validate(row) for row in effects.get(track.track_id, [])
        ],
        links=[
            TrackPluginLinkResponse.model_validate(row) for row in links.get(track.track_id, [])
        ],
        connections=[
            TrackConnectionResponse.model_validate(row)
            for row in connections.get(track.track_id, [])
        ],
    )


def get_full_project(db: Session, user: User, project_id: int) -> FullProjectResponse:
    """프로젝트 전체 (FR-254) — 한 번의 조회로 화면이 필요한 것 전부.

    멤버면 누구나 (VIEWER 포함). 없는 프로젝트 · 남의 프로젝트는 404.
    clips 는 프로젝트의 모든 클립, connections 는 각 트랙의 나가는 연결이다.
    markers · tempo_changes · meter_changes 는 그 표의 모델·API 가 아직 없어 빈 목록으로
    나간다 (화면은 이 칸이 늘 있다고 보고 읽는다).
    """
    project, member = project_service.get_membership(db, project_id, user)

    tracks = list(
        db.scalars(
            select(Track)
            .where(Track.project_id == project_id)
            .order_by(Track.order_index, Track.track_id)
        ).all()
    )
    track_ids = [track.track_id for track in tracks]
    if track_ids:
        instruments = _group_by(
            list(
                db.scalars(
                    select(TrackInstrument)
                    .where(TrackInstrument.track_id.in_(track_ids))
                    .order_by(TrackInstrument.slot_index, TrackInstrument.track_instrument_id)
                ).all()
            ),
            lambda row: row.track_id,
        )
        effects = _group_by(
            list(
                db.scalars(
                    select(TrackPlugin)
                    .where(TrackPlugin.track_id.in_(track_ids))
                    .order_by(TrackPlugin.slot_index, TrackPlugin.track_plugin_id)
                ).all()
            ),
            lambda row: row.track_id,
        )
        links = _group_by(
            list(
                db.scalars(
                    select(TrackPluginLink)
                    .where(TrackPluginLink.track_id.in_(track_ids))
                    .order_by(TrackPluginLink.link_id)
                ).all()
            ),
            lambda row: row.track_id,
        )
        connections = _group_by(
            list(
                db.scalars(
                    select(TrackConnection)
                    .where(TrackConnection.from_track_id.in_(track_ids))
                    .order_by(TrackConnection.connection_id)
                ).all()
            ),
            lambda row: row.from_track_id,
        )
        clips = [
            ClipResponse.model_validate(row)
            for row in db.scalars(
                select(Clip)
                .where(Clip.track_id.in_(track_ids))
                .order_by(Clip.start_tick, Clip.clip_id)
            ).all()
        ]
    else:
        instruments, effects, links, connections, clips = {}, {}, {}, {}, []

    patterns = list(
        db.scalars(
            select(Pattern).where(Pattern.project_id == project_id).order_by(Pattern.pattern_id)
        ).all()
    )
    pattern_ids = [pattern.pattern_id for pattern in patterns]
    if pattern_ids:
        notes = _group_by(
            list(
                db.scalars(
                    select(MidiNote)
                    .where(MidiNote.pattern_id.in_(pattern_ids))
                    .order_by(MidiNote.pattern_id, MidiNote.start_tick, MidiNote.pitch)
                ).all()
            ),
            lambda row: row.pattern_id,
        )
    else:
        notes = {}

    return FullProjectResponse(
        project=project_info(db, project, member),
        tracks=[
            _full_track(track, instruments, effects, links, connections) for track in tracks
        ],
        patterns=[
            pattern_service.to_response(pattern, notes.get(pattern.pattern_id, []))
            for pattern in patterns
        ],
        clips=clips,
    )
