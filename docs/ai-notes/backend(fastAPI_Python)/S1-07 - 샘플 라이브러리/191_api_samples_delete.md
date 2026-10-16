# Backend(FastAPI/Python) 191 — `DELETE /samples/{id}`

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/api/v1/samples.py` (`delete_sample` 라우트), `app/services/sample_service.py` (`delete_sample` 추가) |
| 작업 | S1-07 샘플 라이브러리: 소프트 삭제 · 저장 용량 반환 (FR-225·135) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [190 `PUT /samples/{id}/tags`](190_api_samples_tags.md) · 192 `GET /tags` 태그 목록 (예정) |

## 1. 하는 일
샘플을 지웁니다. `DELETE /api/v1/samples/{id}`입니다(FR-225). 행은 남기고 `deleted_at`만 채우는 **소프트 삭제**이며, 지운 만큼 저장 용량을 돌려줍니다(FR-135).

| 경우 | 결과 |
|---|---|
| 내 샘플 | 204 (본문 없음) |
| 로그인 안 함 | 401 |
| 없는 번호 · 남의 샘플 · 이미 지운 샘플 | 404 `"Sample not found."` |

지운 샘플은 목록(186)·오디오(187)·파형(188)·이름 변경(189)·태그(190)에서 모두 404로 빠집니다.

## 2. 언제 쓰나
```js
await fetch("/api/v1/samples/12", { method: "DELETE" });
```
지운 뒤에는 목록을 다시 불러 용량 표시와 목록을 갱신합니다.

## 3. 코드
**서비스** (`app/services/sample_service.py`)
```python
def delete_sample(db: Session, user: User, sample_id: int) -> None:
    sample = get_sample(db, user, sample_id)
    sample.deleted_at = datetime.now(UTC).replace(tzinfo=None)  # DB 는 UTC 를 시간대 없이 저장
    user.storage_used_bytes = max(0, user.storage_used_bytes - sample.file_size)
    db.commit()
```

**라우터** (`app/api/v1/samples.py`)
```python
@router.delete(
    "/{sample_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorResponse}},
)
def delete_sample(sample_id: int, user: CurrentUser, db: Db) -> None:
    sample_service.delete_sample(db, user, sample_id)
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `datetime.now(UTC).replace(tzinfo=None)` | 지금 시각을 UTC로 구해 시간대 표시를 뗍니다. DB가 시간대 없이(naive) UTC를 저장하기 때문입니다 |
| `max(0, user.storage_used_bytes - sample.file_size)` | 용량에서 파일 크기를 뺍니다. 혹시라도 더 커서 음수가 되지 않게 0 아래로 내려가지 않게 합니다 |
| `status.HTTP_204_NO_CONTENT` | "지웠고 돌려줄 내용은 없음"을 뜻하는 상태 코드입니다 |
| `-> None` | 본문을 돌려주지 않습니다 (204라 본문이 없음) |

## 4. 흐름
1. `get_sample`이 내 샘플인지 확인합니다. 없거나 이미 지운 것이면 404.
2. `deleted_at`에 지금 시각을 넣습니다.
3. `storage_used_bytes`에서 그 파일 크기를 뺍니다.
4. `db.commit()` 하고 204로 끝냅니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 소프트 삭제 | 행을 실제로 지우지 않아 실수로 지운 것을 되살릴 여지를 남깁니다. 프로젝트 삭제(P1-13)와 같은 방식입니다 |
| 파일은 남김 | 지우면 되돌릴 수 없습니다. 실제 파일 정리는 뒤 정리 작업(FR-137)이 오래된 것부터 맡습니다 |
| 용량은 바로 반환 | FR-135는 "파일을 지우면 용량이 돌아온다"입니다. 사용자는 지운 즉시 다시 올릴 수 있어야 합니다 |
| 두 번 지우면 404 | `get_sample`이 이미 지운 것을 빼므로 용량이 두 번 빠지지 않습니다. 지우기는 한 번만 됩니다 |
| 204(본문 없음) | 돌려줄 내용이 없습니다. 화면은 성공 여부만 알면 되고 목록을 다시 불러 갱신합니다 |

## 6. 시험 (`tests/test_sample_routes.py`에 6개 추가, 전체 982개 통과)

| 시험 | 확인한 것 |
|---|---|
| 삭제 | 204, 본문 없음, `deleted_at` 채워짐, 사용량이 파일 크기만큼 줄어 0이 됨 |
| 목록·재생에서 빠짐 | 지운 뒤 목록에서 사라지고, 오디오·파형은 404 |
| 두 번 삭제 | 두 번째는 404, 용량을 또 빼지 않음 |
| 로그인 필요 | 토큰 없이 401 |
| 남의 샘플 | 다른 사용자면 404, 안 지워짐 |
| 없는 번호 | 404 |
