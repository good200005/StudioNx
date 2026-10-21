"""플러그인 스키마 — S1-09 (FR-241·244·246·2187).

param_schema(JSON)의 항목 구조는 프론트가 카드/상세 모달 노브를 자동 생성하는 기준이다.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

PluginType = Literal["INSTRUMENT", "EFFECT", "MIDI_EFFECT"]
PluginEngine = Literal["WEBAUDIO", "WASM"]
PresetSource = Literal["SYSTEM", "USER", "AI"]


class ParamOption(BaseModel):
    value: str
    label: str
    hint: str | None = None


class ParamSchemaItem(BaseModel):
    key: str
    name: str
    # sample: 라이브러리의 샘플 번호를 담는 칸 (Sampler 의 sample_id, S1-11c)
    type: Literal["knob", "select", "toggle", "sample"] = "knob"
    # segment: select 를 드롭다운 대신 이어 붙은 버튼으로 그리고, 고른 옵션의 hint 를 아래에 보여 줌
    display: Literal["segment"] | None = None
    group: str | None = None
    min: float | int | None = None
    max: float | int | None = None
    default: float | int | bool | str | None = None
    unit: str | None = None
    step: float | int | None = None
    curve: Literal["linear", "log"] | None = None
    primary: bool | None = None
    options: list[ParamOption] | None = None


class PluginResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plugin_id: int
    code: str
    name: str
    plugin_type: PluginType
    engine: PluginEngine
    version: str
    param_schema: list[ParamSchemaItem]
    card_asset: str | None
    is_active: bool


class PluginListResponse(BaseModel):
    items: list[PluginResponse]


class PluginPresetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    preset_id: int
    plugin_id: int
    owner_id: int | None
    name: str
    params: dict[str, Any]
    source: PresetSource
