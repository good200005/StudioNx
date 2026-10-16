# Backend(FastAPI/Python) 190 — `PUT /samples/{id}/tags`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/samples.py` (`set_sample_tags` 라우트), `app/services/sample_service.py` (`set_sample_tags` 추가), `app/schemas/sample.py` (`TagId`·`SampleTagsRequest` 추가) |
| 작업 | S1-07 샘플 라이브러리: 태그 설정 (FR-225) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [189 `PATCH /samples/{id}`](189_api_samples_update.md) · 191 `DELETE /samples/{id}` 소프트 삭제 (예정) |

## 1. 하는 일
샘플에 붙은 태그를 바꿉니다. `PUT /api/v1/samples/{id}/tags`에 `{"tag_ids": [1, 2, 3]}`을 보냅니다. 라이브러리 패널에서 태그를 고쳐 보낼 때 씁니다(FR-225).

**보낸 목록이 그 샘플의 태그 전부**가 됩니다. 지금 붙어 있던 것은 떼고 새로 붙입니다. 빈 목록(`[]`)은 태그를 모두 떼는 뜻입니다.

| 경우 | 결과 |
|---|---|
| 내 샘플, 태그 번호가 모두 있음 | 200 + 바뀐 줄 (SampleResponse) |
| 로그인 안 함 | 401 |
| 없는 번호 · 남의 샘플 · 지운 샘플 | 404 `"Sample not found."` |
| 목록에 없는 태그 번호가 하나라도 있음 | 422 + `details.tag_ids` (아무것도 안 바꿈) |

## 2. 언제 쓰나
```js
await fetch("/api/v1/samples/12/tags", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tag_ids: [3, 7] }),
});
```
돌려받은 줄로 목록의 그 항목을 그대로 바꿔 그립니다(새 태그가 함께 옵니다).

## 3. 코드
**스키마** (`app/schemas/sample.py`)
```python
TagId = Annotated[int, Field(ge=1)]


class SampleTagsRequest(BaseModel):
    tag_ids: list[TagId] = []
```

**서비스** (`app/services/sample_service.py`)
```python
def set_sample_tags(db, user, sample_id, tag_ids) -> SampleResponse:
    sample = get_sample(db, user, sample_id)
    wanted = list(dict.fromkeys(tag_ids))  # 보낸 차례를 지키며 중복을 뺀다
    if wanted:
        found = set(db.scalars(select(Tag.tag_id).where(Tag.tag_id.in_(wanted))).all())
        missing = [tag_id for tag_id in wanted if tag_id not in found]
        if missing:
            raise AppError(
                ErrorCode.VALIDATION_ERROR, 422, "Unknown tag.",
                details={"tag_ids": missing},
            )
    db.execute(delete(SampleTag).where(SampleTag.sample_id == sample.sample_id))
    db.add_all(SampleTag(sample_id=sample.sample_id, tag_id=tag_id) for tag_id in wanted)
    db.commit()
    tags = _tags_by_sample(db, [sample.sample_id]).get(sample.sample_id, [])
    return to_response(sample, tags)
```

**라우터** (`app/api/v1/samples.py`)
```python
@router.put(
    "/{sample_id}/tags",
    response_model=SampleResponse,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def set_sample_tags(sample_id, data, user, db) -> SampleResponse:
    return sample_service.set_sample_tags(db, user, sample_id, data.tag_ids)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `TagId = Annotated[int, Field(ge=1)]` | 태그 번호는 1 이상입니다. 0·음수는 422 |
| `list(dict.fromkeys(tag_ids))` | 보낸 차례를 지키면서 같은 번호를 하나로 냅니다(dict는 차례를 기억함) |
| `Tag.tag_id.in_(wanted)` | 보낸 번호들 중 실제로 있는 것만 한 번에 찾습니다 |
| `missing = [...]` | 보낸 번호 중 없는 것의 목록입니다. 비어 있지 않으면 422 |
| `delete(SampleTag).where(...)` | 그 샘플의 기존 연결을 통째로 지웁니다(샘플 행은 그대로) |
| `db.add_all(...)` | 새 연결을 한꺼번에 넣습니다. 지우기와 넣기가 한 트랜잭션입니다 |

## 4. 흐름
1. `get_sample`이 내 샘플인지 확인합니다. 아니면 404.
2. 보낸 번호에서 중복을 뺍니다.
3. 보낸 번호가 모두 실제 태그인지 확인합니다. 하나라도 없으면 422(그대로 두고 끝).
4. 그 샘플의 기존 연결을 지웁니다.
5. 보낸 번호로 새 연결을 넣고 `db.commit()` 합니다.
6. 붙은 태그를 모아 `SampleResponse`로 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| PUT(전체 교체) | 화면은 "이 태그들로 해라"라고 한 번에 보냅니다. 하나씩 더하고 빼는 방식보다 화면·서버 어느 쪽이든 상태가 어긋나지 않습니다 |
| 없는 번호는 422 | 조용히 무시하면 오타로 태그가 빠져도 성공으로 보여 혼란이 생깁니다. 하나라도 없으면 아무것도 안 바꾸고 422로 알려 줍니다 |
| 빈 목록 허용 | 태그를 모두 떼는 것도 정상 동작입니다. 목록이 비었다고 막지 않습니다 |
| 중복 제거 | `sample_tags`는 (sample_id, tag_id) 복합 기본 키라 같은 번호를 두 번 넣으면 DB 오류가 납니다. 서비스에서 하나로 냅니다 |
| 응답은 바뀐 줄 | 목록 한 줄과 모양을 맞춥니다(189와 같음). 화면이 그 항목만 다시 그립니다 |
| 189(이름)·190(태그) 분리 | 이름은 PATCH, 태그는 별도 경로 PUT으로 나눠 화면이 필요한 것만 보냅니다 |

## 6. 시험 (`tests/test_sample_routes.py`에 8개 추가, 전체 976개 통과)

| 시험 | 확인한 것 |
|---|---|
| 태그 설정 | 200, 응답에 새 태그, DB에 연결 생김 |
| 교체 | 기존 태그를 떼고 보낸 것만 남음 |
| 비우기 | `[]`이면 태그가 모두 사라짐 |
| 중복 | 같은 번호를 두 번 보내도 한 번만 붙음 |
| 없는 번호 | 422, `details.tag_ids`에 그 번호, 기존 태그 그대로 |
| 잘못된 번호 | `0`은 422 |
| 로그인 필요 | 토큰 없이 401 |
| 남의 샘플 | 다른 사용자면 404 |
