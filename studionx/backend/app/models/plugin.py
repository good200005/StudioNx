"""plugins · plugin_presets 테이블 — S1-09 (FR-241·244·246).

플러그인은 가상악기와 이펙트의 정의입니다. param_schema(JSON)에 파라미터의 이름,
범위, 기본값, 단위, group, primary 여부가 들어 있고, 화면(카드와 상세 모달)은 이 값을
읽어 노브와 슬라이더를 자동으로 만듭니다 (FR-244, FR-2187). 프리셋은 그 위에 붙는
저장된 파라미터 묶음입니다 (SYSTEM 은 기본 제공, USER 는 내가 저장한 것, AI 는 나중 단계).

- code: 화면(JS)이 구현을 찾는 열쇠입니다. 예를 들어 code 가 'eq3' 이면 화면의 EQ 구현과
  이어집니다 (FR-241·2187).
- card_asset: Nyxi 카드 그림 파일 이름입니다. 그림은 외부 AI 플랫폼에서 받으므로 지금은
  비어 있고, 화면은 플레이스홀더 그림을 씁니다 (FR-2181).
"""

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, BigInteger, Boolean, Enum, FetchedValue, ForeignKey, String, text
from sqlalchemy.dialects.mysql import DATETIME, INTEGER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:  # 타입 표시용 (실행 중에는 불러오지 않음 — 순환을 피함)
    from app.models.track_plugin import TrackInstrument, TrackPlugin
    from app.models.user import User


class PluginType(StrEnum):
    """플러그인 종류 (가상악기, 이펙트, MIDI 이펙트)."""

    INSTRUMENT = "INSTRUMENT"
    EFFECT = "EFFECT"
    MIDI_EFFECT = "MIDI_EFFECT"


class PluginEngine(StrEnum):
    """소리 만드는 방식 (Web Audio 노드 조합 또는 AudioWorklet + WASM, FR-247)."""

    WEBAUDIO = "WEBAUDIO"
    WASM = "WASM"


class PresetSource(StrEnum):
    """프리셋 출처 (시스템 기본 제공, 내가 저장, AI 생성)."""

    SYSTEM = "SYSTEM"
    USER = "USER"
    AI = "AI"


class Plugin(Base):
    """가상악기와 이펙트의 정의 (plugins). param_schema 로 카드·상세 모달 UI 를 자동 생성한다."""

    __tablename__ = "plugins"

    plugin_id: Mapped[int] = mapped_column(
        INTEGER(unsigned=True), primary_key=True, autoincrement=True
    )
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(100))
    plugin_type: Mapped[PluginType] = mapped_column(Enum(PluginType))
    engine: Mapped[PluginEngine] = mapped_column(
        Enum(PluginEngine), server_default=PluginEngine.WEBAUDIO
    )
    version: Mapped[str] = mapped_column(String(20), server_default=text("'1.0.0'"))
    param_schema: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    card_asset: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )

    # 관계된 행은 DB 의 ON DELETE CASCADE 에 맡긴다 (passive_deletes)
    presets: Mapped[list["PluginPreset"]] = relationship(
        back_populates="plugin", order_by="PluginPreset.preset_id", passive_deletes=True
    )
    track_plugins: Mapped[list["TrackPlugin"]] = relationship(back_populates="plugin")
    track_instruments: Mapped[list["TrackInstrument"]] = relationship(back_populates="plugin")


class PluginPreset(Base):
    """플러그인 프리셋 (plugin_presets). 플러그인에 붙는 저장된 파라미터 묶음 (FR-246).

    owner_id 가 NULL 이면 모두에게 보이는 시스템 프리셋이고, 값이 있으면 그 사용자의
    개인 프리셋입니다. params 는 param_schema 의 각 파라미터 값을 담은 사전입니다.
    """

    __tablename__ = "plugin_presets"

    preset_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plugin_id: Mapped[int] = mapped_column(INTEGER(unsigned=True), ForeignKey("plugins.plugin_id"))
    owner_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.user_id"))
    name: Mapped[str] = mapped_column(String(100))
    params: Mapped[dict[str, Any]] = mapped_column(JSON)
    source: Mapped[PresetSource] = mapped_column(
        Enum(PresetSource), server_default=PresetSource.SYSTEM
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=3), server_default=text("CURRENT_TIMESTAMP(3)"), server_onupdate=FetchedValue()
    )

    plugin: Mapped["Plugin"] = relationship(back_populates="presets")
    owner: Mapped["User | None"] = relationship()
