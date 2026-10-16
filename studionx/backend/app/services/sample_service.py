"""샘플 서비스 — S1-07 샘플 라이브러리.

- `save_sample`(184): 올린 파일을 storage 에 저장하고 메타·파형을 만들어 samples 행을 넣는다.
- `list_samples`(186): 내 라이브러리 목록 — 이름 검색, 태그 필터, 페이지 (FR-224).
- `sample_file`(187)·`sample_waveform`(188): 오디오 파일·파형 JSON 서빙용 경로 (내 것만).

올린 파일 자체는 디스크에 두고(경로 규칙: samples/{owner_id}/{무작위}.{확장자}),
DB 행에는 그 정보와 파형 파일 경로만 담는다. 오디오를 읽고 파형을 만드는 일은
sample_audio_service.py(180~182)가 맡고, 이 파일은 저장·조회·사용량을 맡는다.
"""

from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.models import Sample, SampleSource, SampleTag, Tag, User
from app.schemas.sample import (
    SampleListResponse,
    SampleResponse,
    SampleUpdateRequest,
    TagItem,
)
from app.services.sample_audio_service import (
    check_upload,
    compute_waveform,
    read_audio_info,
    write_waveform,
)

#: 올린 파일을 두는 폴더 (settings.storage_dir 아래)
SAMPLE_DIR = "samples"

#: 지원 형식의 MIME 종류. samples.mime_type 에 넣는다.
#: 브라우저가 알려 준 content_type 은 믿지 않고, 검사를 통과한 확장자로 정한다.
MIME_TYPES = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
}

#: 파일을 메모리에 통째로 올리지 않고 나눠 읽는 크기 (1MB)
CHUNK_BYTES = 1024 * 1024


def to_response(sample: Sample, tags: list[TagItem] | None = None) -> SampleResponse:
    """Sample → SampleResponse (업로드 응답 · 목록 한 줄).

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    칸을 하나씩 골라 넣는다. Sample 에 칸이 늘어도 응답에 저절로 섞이지 않게 하려는
    것이다 (user_service.to_me_response 와 같은 방식).
    태그는 목록(186)이 줄마다 한 번에 모아 넘기고, 업로드 때는 넘기지 않아 빈 목록이다.
    """
    return SampleResponse(
        sample_id=sample.sample_id,
        name=sample.name,
        original_filename=sample.original_filename,
        file_size=sample.file_size,
        mime_type=sample.mime_type,
        duration_ms=sample.duration_ms,
        sample_rate=sample.sample_rate,
        channels=sample.channels,
        bpm=sample.bpm,
        music_key=sample.music_key,
        source=sample.source,
        created_at=sample.created_at,
        tags=tags or [],
    )


def _escape_like(text: str) -> str:
    """LIKE 검색어의 특수 문자(역슬래시 · % · _)를 글자 그대로 찾도록 앞에 역슬래시를 붙인다."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _tags_by_sample(db: Session, sample_ids: list[int]) -> dict[int, list[TagItem]]:
    """이 페이지 샘플들에 붙은 태그를 쿼리 한 번으로 모아 샘플 번호별로 돌려준다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    줄마다 쿼리하면 페이지 50줄이면 50번 더 물어보게 되므로 한 번에 모은다
    (project_service.list_projects 가 멤버 수를 모아 계산한 것과 같은 방법).
    태그 번호 순서로 모아 페이지를 넘겨도 같은 샘플의 태그 순서가 흔들리지 않게 한다.
    """
    if not sample_ids:
        return {}
    rows = db.execute(
        select(SampleTag.sample_id, Tag)
        .join(Tag, Tag.tag_id == SampleTag.tag_id)
        .where(SampleTag.sample_id.in_(sample_ids))
        .order_by(Tag.tag_id)
    ).all()
    grouped: dict[int, list[TagItem]] = {}
    for sample_id, tag in rows:
        grouped.setdefault(sample_id, []).append(
            TagItem(tag_id=tag.tag_id, name=tag.name, category=tag.category)
        )
    return grouped


def list_samples(
    db: Session,
    user: User,
    query: str,
    tag: int | None,
    page: int,
    size: int,
) -> SampleListResponse:
    """내 라이브러리 목록 (FR-224) — 내 것이고 지우지 않은 것만.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    - `query`: 이름에 이 글자가 들어간 것만 (대소문자 무시, 빈 문자열이면 전부)
    - `tag`: 그 태그가 붙은 샘플만 (없으면 전부)
    - 만든 순서가 같은 줄이면 샘플 번호 큰 것(나중에 만든 것)이 먼저 — 페이지를 넘겨도 순서가 그대로
    - 태그는 쿼리 한 번으로 모아 넣는다 (185 는 아직 태그가 없어 빈 목록)
    """
    conditions = [Sample.owner_id == user.user_id, Sample.deleted_at.is_(None)]
    if query:
        conditions.append(Sample.name.ilike(f"%{_escape_like(query)}%", escape="\\"))

    statement = select(Sample).where(*conditions)
    if tag is not None:
        statement = statement.join(
            SampleTag, SampleTag.sample_id == Sample.sample_id
        ).where(SampleTag.tag_id == tag)

    # 개수도 같은 거르기 조건으로 계산 — 태그로 거를 때 줄 수까지 함께 줄어든다
    total = db.scalar(select(func.count()).select_from(statement.subquery()))

    rows = list(
        db.scalars(
            statement.order_by(Sample.created_at.desc(), Sample.sample_id.desc())
            .offset((page - 1) * size)
            .limit(size)
        ).all()
    )
    tags = _tags_by_sample(db, [sample.sample_id for sample in rows])
    return SampleListResponse(
        items=[to_response(sample, tags.get(sample.sample_id, [])) for sample in rows],
        total=total,
        page=page,
        size=size,
    )


def get_sample(db: Session, user: User, sample_id: int) -> Sample:
    """내 샘플 한 건을 찾는다. 없거나 남의 것이거나 지운 것이면 404 ("Sample not found.").

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    어느 경우인지 알려 주지 않는다 — 남의 샘플이 있는지조차 알 수 없게 하려는 것이다
    (project_service.get_membership 과 같은 방침). 187·188 이 함께 쓴다.
    """
    sample = db.get(Sample, sample_id)
    if sample is None or sample.deleted_at is not None or sample.owner_id != user.user_id:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Sample not found.")
    return sample


def _stored_file(relative: str) -> Path | None:
    """저장소 기준 상대 경로를 실제 파일 경로로 바꾼다. 폴더 밖이거나 파일이 없으면 None.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    `..` 를 펴서(resolve) 저장 폴더 안인지 확인한다 (경로 넘어가기 방지).
    """
    storage_dir = get_settings().storage_dir.resolve()
    path = (storage_dir / relative).resolve()
    if not path.is_relative_to(storage_dir) or not path.is_file():
        return None
    return path


def sample_file(db: Session, user: User, sample_id: int) -> tuple[Sample, Path]:
    """스트리밍할 오디오 파일 경로와 그 샘플을 돌려준다. 파일이 없으면 404.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    지금은 올린 본인만 받는다. PRD 02 §7 은 "본인/프로젝트 멤버"라고 했는데, 그 샘플을
    쓰는 클립이 아직 없으므로 멤버 열람은 클립을 만들 때 함께 넣는다.
    """
    sample = get_sample(db, user, sample_id)
    path = _stored_file(sample.file_path)
    if path is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Sample not found.")
    return sample, path


def sample_waveform(db: Session, user: User, sample_id: int) -> tuple[Sample, Path]:
    """파형 미리보기 JSON 파일 경로와 그 샘플을 돌려준다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    waveform_path 가 비었거나(파형을 아직 안 만든 샘플) 파일이 없으면 404
    ("Waveform not found."). 샘플 자체가 없거나 남의 것이면 get_sample 이 먼저 404로 막는다.
    """
    sample = get_sample(db, user, sample_id)
    if sample.waveform_path is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Waveform not found.")
    path = _stored_file(sample.waveform_path)
    if path is None:
        raise AppError(ErrorCode.NOT_FOUND, 404, "Waveform not found.")
    return sample, path


def update_sample(
    db: Session, user: User, sample_id: int, data: SampleUpdateRequest
) -> SampleResponse:
    """샘플 수정 (FR-225) — 지금은 이름만. 보낸 칸만 바꾼다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    소유 확인은 get_sample 이 맡는다(없음·남의 것·지운 것 → 404). 이름이 비었거나(공백뿐)
    200자를 넘으면 스키마가 422로 먼저 막는다. 한 칸도 보내지 않으면 아무것도 바꾸지 않는다.
    응답은 목록 한 줄과 같은 모양(SampleResponse)이며, 붙어 있는 태그를 함께 담는다.
    """
    sample = get_sample(db, user, sample_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sample, field, value)
    db.commit()
    db.refresh(sample)
    tags = _tags_by_sample(db, [sample.sample_id]).get(sample.sample_id, [])
    return to_response(sample, tags)


def set_sample_tags(
    db: Session, user: User, sample_id: int, tag_ids: list[int]
) -> SampleResponse:
    """샘플의 태그를 통째로 교체한다 (FR-225).

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    보낸 목록이 그 샘플의 태그 전부가 된다 (지금 붙은 것은 떼고 새로 붙임). 빈 목록이면 모두 뗀다.
    없는 태그 번호가 하나라도 있으면 422로 거부하고 아무것도 바꾸지 않는다 — 오타로 태그가
    조용히 빠지지 않게 하려는 것이다. 같은 번호를 여러 번 보내도 한 번만 붙인다(복합 기본 키라
    두 번 넣으면 오류가 난다). 응답은 목록 한 줄과 같은 모양(SampleResponse)이다.
    """
    sample = get_sample(db, user, sample_id)
    wanted = list(dict.fromkeys(tag_ids))  # 보낸 차례를 지키며 중복을 뺀다
    if wanted:
        found = set(db.scalars(select(Tag.tag_id).where(Tag.tag_id.in_(wanted))).all())
        missing = [tag_id for tag_id in wanted if tag_id not in found]
        if missing:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                422,
                "Unknown tag.",
                details={"tag_ids": missing},
            )
    db.execute(delete(SampleTag).where(SampleTag.sample_id == sample.sample_id))
    db.add_all(
        SampleTag(sample_id=sample.sample_id, tag_id=tag_id) for tag_id in wanted
    )
    db.commit()
    tags = _tags_by_sample(db, [sample.sample_id]).get(sample.sample_id, [])
    return to_response(sample, tags)


def delete_sample(db: Session, user: User, sample_id: int) -> None:
    """샘플 삭제 — 소프트 삭제 (FR-225). 지운 만큼 저장 용량을 돌려준다 (FR-135).

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    행은 지우지 않고 deleted_at 만 채운다 → 목록(186)·조회(187·188)·get_sample 에서 바로 빠진다.
    디스크의 오디오·파형 파일은 남겨 둔다(복구 여지). 실제 파일 정리는 뒤 정리 작업(FR-137)이 한다.
    이미 지운 샘플을 또 지우면 get_sample 이 404로 막는다(지우기는 한 번만).
    """
    sample = get_sample(db, user, sample_id)
    sample.deleted_at = datetime.now(UTC).replace(tzinfo=None)  # DB 는 UTC 를 시간대 없이 저장
    user.storage_used_bytes = max(0, user.storage_used_bytes - sample.file_size)
    db.commit()


async def save_sample(db: Session, user: User, file: UploadFile) -> Sample:
    """올린 파일을 저장하고 samples 행을 만든다. 파일 크기만큼 사용량을 늘린다.

    (구현: AI — 2026-10-15, S1-07, 함수 하나씩 검토)

    FR-221(업로드)과 FR-131(사용량)을 함께 처리한다. 한 트랜잭션이라 행과
    사용량이 따로 남지 않는다.

    1. 올린 파일을 storage/samples/{owner_id}/{무작위}.{확장자} 로 1MB씩 나눠 쓴다.
       파일 하나 한도(sample_max_bytes)를 넘는 순간 읽기를 멈춘다 — 100MB를 넘게 쓰지 않는다.
    2. check_upload(183)로 형식·크기·남은 용량 확인 — 걸리면 쓴 파일을 지우고 AppError
    3. read_audio_info(180)로 길이·샘플레이트·채널 — 못 읽는 파일이면(415) 쓴 파일을 지우고 AppError
    4. compute_waveform(181) → write_waveform(182)로 파형 파일 저장
    5. samples 행을 넣고 user.storage_used_bytes 를 파일 크기만큼 늘려 한 번에 commit

    형식(확장자) 검사를 파일을 쓴 **뒤에** 하는 이유: 100MB를 메모리에 올리지 않으려고
    나눠 쓰기 때문이다. 어차피 걸리면 지우므로 남는 파일이 없다.
    오류가 나면 쓴 파일과 파형 파일을 지우고 rollback 한다 (반쪽 상태를 남기지 않는다).
    """
    settings = get_settings()
    storage_dir = settings.storage_dir
    original_filename = file.filename or ""
    extension = Path(original_filename).suffix.lower()
    relative = f"{SAMPLE_DIR}/{user.user_id}/{uuid4().hex}{extension}"
    target = storage_dir / relative
    target.parent.mkdir(parents=True, exist_ok=True)

    # 1. 나눠 쓰면서 크기를 센다 (한도를 넘으면 더 읽지 않는다)
    file_size = 0
    with target.open("wb") as out:
        while True:
            chunk = await file.read(CHUNK_BYTES)
            if not chunk:
                break
            file_size += len(chunk)
            out.write(chunk)
            if file_size > settings.sample_max_bytes:
                break

    waveform_relative: str | None = None
    try:
        check_upload(user, original_filename, file_size)  # 2
        info = read_audio_info(target)  # 3
        waveform = compute_waveform(target)
        waveform_relative = write_waveform(waveform, owner_id=user.user_id)  # 4

        stem = Path(original_filename).stem.strip()
        sample = Sample(  # 5
            owner_id=user.user_id,
            name=stem[:200] or "Untitled",
            original_filename=original_filename[:255],
            file_path=relative,
            mime_type=MIME_TYPES[extension],
            file_size=file_size,
            duration_ms=info.duration_ms,
            sample_rate=info.sample_rate,
            channels=info.channels,
            waveform_path=waveform_relative,
            source=SampleSource.UPLOAD,
        )
        db.add(sample)
        user.storage_used_bytes = user.storage_used_bytes + file_size
        db.commit()
    except Exception:
        db.rollback()
        target.unlink(missing_ok=True)
        if waveform_relative:
            (storage_dir / waveform_relative).unlink(missing_ok=True)
        raise
    db.refresh(sample)
    return sample
