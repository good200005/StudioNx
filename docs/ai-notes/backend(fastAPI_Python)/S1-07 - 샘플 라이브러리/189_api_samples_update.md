# Backend(FastAPI/Python) 189 — `PATCH /samples/{id}`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/samples.py` (`update_sample` 라우트), `app/services/sample_service.py` (`update_sample` 추가), `app/schemas/sample.py` (`SampleName`·`SampleUpdateRequest` 추가) |
| 작업 | S1-07 샘플 라이브러리: 이름 변경 (FR-225) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [188 `GET /samples/{id}/waveform`](188_api_samples_waveform.md) · 190 태그 설정 `PUT /samples/{id}/tags` (예정) |

## 1. 하는 일
샘플 이름을 바꿉니다. `PATCH /api/v1/samples/{id}`에 `{"name": "새 이름"}`을 보냅니다. 라이브러리 패널에서 이름을 고쳐 보낼 때 씁니다(FR-225).

| 경우 | 결과 |
|---|---|
| 내 샘플, 이름이 올바름 | 200 + 바뀐 줄 (SampleResponse) |
| 로그인 안 함 | 401 |
| 없는 번호 · 남의 샘플 · 지운 샘플 | 404 `"Sample not found."` |
| 이름이 null · 공백뿐 · 200자 초과 | 422 |

이름 앞뒤 공백은 지운 뒤 저장합니다.

## 2. 언제 쓰나
```js
await fetch("/api/v1/samples/12", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "새 이름" }),
});
```
돌려받은 줄로 목록의 그 항목을 그대로 바꿔 그리면 됩니다(태그도 함께 옵니다).

## 3. 코드
**스키마** (`app/schemas/sample.py`)
```python
SAMPLE_NAME_MAX = 200  # samples.name 칸 길이(DB VARCHAR(200))와 같음

SampleName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=SAMPLE_NAME_MAX)
]


class SampleUpdateRequest(BaseModel):
    name: SampleName | None = None

    @field_validator("name")
    @classmethod
    def _name_not_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("name cannot be empty")
        return value
```

**서비스** (`app/services/sample_service.py`)
```python
def update_sample(db, user, sample_id, data) -> SampleResponse:
    sample = get_sample(db, user, sample_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sample, field, value)
    db.commit()
    db.refresh(sample)
    tags = _tags_by_sample(db, [sample.sample_id]).get(sample.sample_id, [])
    return to_response(sample, tags)
```

**라우터** (`app/api/v1/samples.py`)
```python
@router.patch(
    "/{sample_id}",
    response_model=SampleResponse,
    responses={404: {"model": ErrorResponse}},
)
def update_sample(sample_id, data, user, db) -> SampleResponse:
    return sample_service.update_sample(db, user, sample_id, data)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `SampleName \| None = None` | 이름을 안 보내도 되게 합니다(PATCH라 한 칸만 보내는 경우 대비) |
| `StringConstraints(strip_whitespace=True, …)` | 검사 전에 앞뒤 공백을 지웁니다. 지운 뒤 1자 이상, 200자 이하 |
| `data.model_dump(exclude_unset=True)` | 보낸 칸만 꺼냅니다. 안 보낸 칸은 빠져서 건드리지 않습니다 |
| `setattr(sample, field, value)` | 꺼낸 칸 이름 그대로 객체에 넣습니다 |
| `_tags_by_sample(...)` | 붙어 있는 태그를 모아 응답에 담습니다(목록 한 줄과 같은 모양) |

## 4. 흐름
1. `get_sample`이 내 샘플인지 확인합니다. 아니면 404.
2. 보낸 이름을 앞뒤 공백을 지워 검사합니다. 빈 값·200자 초과면 422(스키마가 먼저 막음).
3. 이름을 바꾸고 `db.commit()` 합니다.
4. 붙어 있는 태그를 모아 `SampleResponse`로 돌려줍니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| PATCH(부분 수정) | 이름만 바꾸는 요청이라 PUT(전체 교체)보다 맞습니다. 보낸 칸만 바꾸는 규칙은 `PATCH /projects`(P1-13)와 같습니다 |
| 이름을 스키마에서 검사 | 빈 값·길이 규칙을 라우터마다 되풀이하지 않게 한 곳에 둡니다. 프로젝트 제목(`ProjectTitle`)과 같은 방식입니다 |
| null 은 422 | 이름은 비울 수 없습니다. 아예 안 보내면 아무것도 안 바꾸고, null 을 보내면 422로 알려 줍니다 |
| 응답에 태그 포함 | 목록 한 줄과 모양을 맞춥니다. 화면이 응답으로 그 항목만 통째로 바꿔 그릴 수 있습니다 |
| 응답 모양은 SampleResponse | 업로드·목록과 같은 한 줄 모양을 써서 화면 쪽 처리(그리기)가 하나로 끝납니다 |

## 6. 시험 (`tests/test_sample_routes.py`에 9개 추가, 전체 968개 통과)

| 시험 | 확인한 것 |
|---|---|
| 이름 변경 | 200, 앞뒤 공백 지워짐, 응답 칸(ITEM_KEYS) 그대로, DB에 반영 |
| 태그 유지 | 태그가 붙은 샘플을 바꿔도 응답에 그 태그가 남음 |
| 로그인 필요 | 토큰 없이 401 |
| 남의 샘플 | 다른 사용자면 404, 이름 안 바뀜 |
| 없음/지움 | 없는 번호 404, 소프트 삭제한 샘플 404 |
| 잘못된 이름(4가지) | null · 빈 칸 · 공백뿐 · 201자 → 422, 이름 안 바뀜 |
