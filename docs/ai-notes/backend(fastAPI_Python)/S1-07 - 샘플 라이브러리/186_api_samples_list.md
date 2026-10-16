# Backend(FastAPI/Python) 186 — `GET /samples`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/samples.py` (`list_samples` 추가), `app/schemas/sample.py` (`TagItem`, `SampleListResponse` 추가, `SampleResponse.tags` 추가), `app/services/sample_service.py` (`list_samples`, `_tags_by_sample`, `_escape_like` 추가) |
| 작업 | S1-07 샘플 라이브러리: 내 라이브러리 목록 — 이름 검색, 태그 필터, 페이지 (FR-224) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [185 `POST /samples`](185_api_samples_upload.md) · 187 `GET /samples/{id}/file` (예정) |

## 1. 하는 일
로그인한 사람의 라이브러리 목록을 돌려줍니다. `GET /api/v1/samples`입니다.

| 요청 | 결과 |
|---|---|
| `GET /samples` | 만든 순서로 (나중에 만든 것 먼저), 10개씩 |
| `?query=kic` | 이름에 들어간 것만 (대소문자 무시) |
| `?tag=3` | 3번 태그가 붙은 샘플만 |
| `?page=2&size=20` | 2페이지, 한 번에 20개 (최대 50) |
| 로그인 안 함 | 401 |
| `size=1000` | 422 (최대 50) |

응답은 `{ items, total, page, size }`. 줄 하나는 `SampleResponse`이고, 붙은 태그가 `tags`에 들어 있습니다.

| 이름 | 내용 |
|---|---|
| `items` | 이 페이지 샘플 목록 (만든 순서, 같은 줄은 번호 큰 것 먼저) |
| `total` | 거른 결과 전체 개수 (페이지를 넘겨도 그대로) |
| `page`, `size` | 보낸 값 그대로 |

## 2. 언제 쓰나
라이브러리 패널을 열 때 부릅니다(FR-224). 태그 필터(FR-224), 검색, 페이지를 한 함수에서 처리합니다.

## 3. 코드
**라우터** (`app/api/v1/samples.py`)
```python
@router.get("", response_model=SampleListResponse)
def list_samples(
    user: CurrentUser,
    db: Db,
    query: Annotated[str, Query(max_length=100)] = "",
    tag: Annotated[int | None, Query(ge=1)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=SAMPLE_PAGE_SIZE_MAX)] = 10,
) -> SampleListResponse:
    return sample_service.list_samples(db, user, query.strip(), tag, page, size)
```

**서비스** (`app/services/sample_service.py`)
```python
def list_samples(db, user, query, tag, page, size):
    conditions = [Sample.owner_id == user.user_id, Sample.deleted_at.is_(None)]
    if query:
        conditions.append(Sample.name.ilike(f"%{_escape_like(query)}%", escape="\\"))

    statement = select(Sample).where(*conditions)
    if tag is not None:
        statement = statement.join(
            SampleTag, SampleTag.sample_id == Sample.sample_id
        ).where(SampleTag.tag_id == tag)

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
        total=total, page=page, size=size,
    )
```

**태그 한 번에 모으기**
```python
def _tags_by_sample(db, sample_ids):
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
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `.ilike(...)` | 대소문자를 가리지 않는 포함 검색입니다 |
| `escape="\\"` | `%`·`_`를 글자 그대로 찾게 하는데, 검색어에 역슬래시가 있으면 먼저 두 배로 바꿉니다 (`_escape_like`) |
| `statement.subquery()` | 거른 결과를 임시 테이블처럼 봐서 줄 수를 셉니다 (프로젝트 목록 58과 같은 방법) |
| `.offset().limit()` | 페이지를 넘기는 자리입니다 |
| `dict.setdefault(key, [])` | 샘플 번호별 태그 목록을 채웁니다 (없는 샘플은 빈 목록으로 시작) |

## 4. 흐름
1. 로그인을 확인합니다 (`CurrentUser` → 401).
2. 거를 조건을 모읍니다: 내 것이고, 지우지 않았고, (이름 검색이면) 이름에 글자가 있고, (태그가 있으면) 그 태그가 붙어 있어야 합니다.
3. 거른 조건 그대로 줄 수를 셉니다.
4. 만든 순서로 정렬해 이 페이지 줄만 읽습니다.
5. 이 페이지 샘플들의 태그를 **한 번에** 읽어 샘플별로 묶습니다.
6. `{ items, total, page, size }`로 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 태그 필터를 이름이 아니라 번호로 | 같은 분류뿐 아니라 분류를 넘겨도 이름이 겹칠 수 있습니다. 화면의 태그 칩은 번호를 이미 알고 있으므로 번호가 안전합니다 |
| 태그를 한 번에 모아 읽기 | 페이지가 50줄이면 줄마다 쿼리하면 50번 더 묻게 됩니다. 프로젝트 목록이 멤버 수를 모아 계산한 것(58)과 같은 방법입니다 |
| 태그를 `SampleResponse`에 넣음 | 라이브러리 패널이 줄마다 태그를 보여 주기 때문입니다. 업로드 응답(185)도 같은 모양을 써야 하므로 한 스키마를 늘렸고, 업로드 때는 빈 목록입니다 |
| 이름만 검색 | 이름 검색(FR-224)만 요구됐습니다. 태그 이름으로도 찾는 일은 태그 필터가 맡습니다 |
| 정렬은 만든 순서 하나 | 라이브러리에서 방금 올린 것이 맨 위에 오는 것이 자연스럽습니다. 이름순·크기순은 쓸 때 추가합니다 |
| 페이지 한도 50 | 프로젝트 목록(`PROJECT_PAGE_SIZE_MAX`)과 같게 맞췄습니다 |
| 검색어를 strip | 공백만 친 검색어는 전부 보여 줍니다 (프로젝트 목록과 같은 규칙) |

## 6. 시험 (`tests/test_sample_routes.py`에 9개 추가, 전체 946개 통과)

| 시험 | 확인한 것 |
|---|---|
| 목록 기본 | 내 것이 나열되고, 다른 사람 것은 안 나옴, 만든 순서, `total` |
| 로그인 필요 | 토큰 없이 401 |
| 이름 검색 | 부분 일치, 대소문자 무시, `%` 포함 이름 |
| 태그 필터 | 붙은 것만, 없는 태그 번호는 빈 목록 |
| 태그 표시 | `tags`에 번호 순서로 담김, `category` 값 포함 |
| 검색 + 태그 | 둘 다 거치면 겹치는 것만 |
| 페이지 | `size=2`에 3개 → 1페이지 2개, `total` 3, 2페이지 1개 |
| 지운 샘플 | `deleted_at`이 있는 줄은 안 나옴 |
| 한도 | `size=1000`이면 422 |
