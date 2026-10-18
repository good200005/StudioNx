"""플러그인 서비스 — S1-09."""

from collections.abc import Sequence

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.plugin import Plugin, PluginPreset


def list_plugins(db: Session, *, active_only: bool = True) -> Sequence[Plugin]:
    stmt = select(Plugin).order_by(Plugin.plugin_type, Plugin.name)
    if active_only:
        stmt = stmt.where(Plugin.is_active == True)  # noqa: E712
    return db.execute(stmt).scalars().all()


def get_plugin(db: Session, plugin_id: int) -> Plugin | None:
    return db.get(Plugin, plugin_id)


def require_plugin(db: Session, plugin_id: int) -> Plugin:
    p = get_plugin(db, plugin_id)
    if not p:
        raise AppError(ErrorCode.NOT_FOUND, "Plugin not found")
    return p


def list_plugin_presets(
    db: Session, plugin_id: int, user_id: int | None = None
) -> Sequence[PluginPreset]:
    stmt = select(PluginPreset).where(PluginPreset.plugin_id == plugin_id)
    if user_id is not None:
        stmt = stmt.where(or_(PluginPreset.owner_id.is_(None), PluginPreset.owner_id == user_id))
    else:
        stmt = stmt.where(PluginPreset.owner_id.is_(None))
    stmt = stmt.order_by(PluginPreset.name)
    return db.execute(stmt).scalars().all()
