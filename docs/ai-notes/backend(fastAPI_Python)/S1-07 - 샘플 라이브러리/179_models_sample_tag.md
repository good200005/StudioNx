# Backend(FastAPI/Python) 179 — `SampleTag` 모델과 샘플·태그 관계

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/backend/app/models/tag.py` (`SampleTag` 클래스), `sample.py`·`tag.py`의 `relationship` |
| 작업 | S1-07 샘플 라이브러리: ORM 모델 컬럼과 관계 (`docs/DB.md` §3.2, `studionx/db/02_phase2_sequencer.sql`) |
| 작성 | Claude (AI), 2026-10-15, 사용자 검토 |
| 이전 · 다음 | [178 `Tag` 모델](178_models_tag.md) · (S1-07 다음 함수) |

## 1. 하는 일
`sample_tags` 표는 어느 샘플에 어느 태그가 붙었는지 잇는 표입니다. 이 표를 파이썬 클래스 `SampleTag`로 옮겨 적고, 177·178의 FK를 **파이썬 속성(`relationship`)으로도 오갈 수 있게** 했습니다.

| 관계가 없을 때 | 관계가 있을 때 |
|---|---|
| `db.scalars(select(Tag).join(SampleTag).where(SampleTag.sample_id == 3))` | `sample.tags` |
| `db.scalars(select(Sample).join(SampleTag).where(SampleTag.tag_id == 5))` | `tag.samples` |

| 속성 | 방향 | 값 |
|---|---|---|
| `sample.tags` | 샘플 → 태그 | `[Tag, …]` |
| `tag.samples` | 태그 → 샘플 | `[Sample, …]` |

## 2. 언제 쓰나
| 쓰는 곳 | 쓰는 방법 |
|---|---|
| S1-07 태그 추가·삭제 (FR-225) | `sample.tags.append(tag)`로 붙이고, `sample.tags.remove(tag)`로 뗍니다 |
| S1-07 라이브러리 목록 (FR-224) | 각 샘플의 `sample.tags`로 붙은 태그를 보여 주고, 태그로 거릅니다 |
| 앞선 P1-03의 관계(13번) | `project.members`·`project.tracks`와 같은 방식입니다 |

```python
# 샘플에 태그를 붙일 때
tag = Tag(name="Deep", category=TagCategory.MOOD, is_system=0)
sample.tags.append(tag)
db.add(sample)   # 중간 표(sample_tags) 행은 저장할 때 자동으로 들어갑니다
db.commit()
```

## 3. 코드
```python
class SampleTag(Base):
    __tablename__ = "sample_tags"

    sample_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("samples.sample_id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.tag_id", ondelete="CASCADE"), primary_key=True
    )
```

관계는 두 클래스에 나누어 적었습니다(서로를 문자열 이름으로 가리킵니다).
```python
# sample.py
tags: Mapped[list["Tag"]] = relationship(secondary="sample_tags", back_populates="samples")

# tag.py
samples: Mapped[list["Sample"]] = relationship(secondary="sample_tags", back_populates="tags")
```

### SQL과 한 줄씩 비교
| SQL (`02_phase2_sequencer.sql`) | 파이썬 |
|---|---|
| `PRIMARY KEY (sample_id, tag_id)` | 두 칸 모두 `primary_key=True` |
| `FOREIGN KEY (sample_id) REFERENCES samples (sample_id) ON DELETE CASCADE` | `ForeignKey("samples.sample_id", ondelete="CASCADE")` |
| `FOREIGN KEY (tag_id) REFERENCES tags (tag_id) ON DELETE CASCADE` | `ForeignKey("tags.tag_id", ondelete="CASCADE")` |

### 문법 풀이
| 식 | 뜻 |
|---|---|
| 복합 기본 키 | 두 칸을 **합쳐서** 한 행을 가리킵니다. `(3, 5)`는 한 번만 있고, `(3, 6)`과 `(4, 5)`는 따로 있습니다 |
| `ondelete="CASCADE"` (양쪽) | 가리키는 샘플이나 태그가 지워지면 **DB가** 이 연결 행도 함께 지웁니다 |
| `secondary="sample_tags"` | 다대다 관계에서 거쳐 가는 중간 표의 이름입니다 |
| `back_populates="samples"` | 반대쪽 `Tag.samples`와 짝을 이룹니다. 한쪽을 바꾸면 다른 쪽에도 반영됩니다 |
| `TYPE_CHECKING` + 문자열 `"Tag"` | 두 파일이 서로를 import하면 순환이 생기므로, 타입 표시용 이름만 문자열로 두고 실행 중에는 불러오지 않습니다 |

## 4. 흐름 (샘플을 지울 때)
1. `db.delete(sample)`을 부릅니다. 이때 `samples.deleted_at`만 기록하는 소프트 삭제가 원칙입니다(177번).
2. 관리자가 행을 정말 지우면(`DELETE`), DB가 `ON DELETE CASCADE`로 그 샘플의 `sample_tags` 행을 함께 지웁니다. 태그(`tags`) 행 자체는 남습니다.

## 5. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 중간 표에 번호 칸이 없음 | `(sample_id, tag_id)`로 이미 한 행이 정해집니다. 같은 샘플에 같은 태그를 두 번 붙일 수 없습니다 |
| 양쪽 모두 `ON DELETE CASCADE` | 연결 행은 둘 중 하나가 없으면 의미가 없습니다. 소프트 삭제로는 표가 지워지지 않으므로, 이 경우는 관리자가 직접 지울 때만 생깁니다 |
| 관계를 양방향(`back_populates`)으로 | `sample.tags`로도, `tag.samples`로도 볼 일이 있습니다(태그로 샘플을 거르는 FR-224) |
| 중간 표 클래스를 따로 둠 | `relationship(secondary=…)`만으로도 되지만, 시험이나 통계에서 `sample_tags`를 직접 세거나 지울 때가 있어 클래스를 남겼습니다 |

## 6. 시험 (`tests/test_tag_model.py` 중 `SampleTag`·관계 부분, 4개)
**실제 MySQL**의 `sample_tags` 테이블과 비교했습니다. 넣은 행은 시험이 끝나면 되돌립니다.

| 시험 | 확인한 것 |
|---|---|
| 칸이 DB와 같은지 | 칸 2개와 FK 2개(둘 다 `ON DELETE CASCADE`)가 실제 테이블과 같습니다 |
| 기본 키 | `["sample_id", "tag_id"]` 순서입니다 |
| 연결과 연쇄 삭제 | 연결 행을 넣으면 1개가 되고, 샘플 행을 지우면 그 연결 행이 0개가 됩니다(DB의 `CASCADE`) |
| 같은 짝을 두 번 | 같은 `(sample_id, tag_id)`를 또 넣으면 DB가 거절합니다(`IntegrityError`, 복합 기본 키) |

전체 시험 871개가 통과했고, `ruff` 검사도 통과했습니다.
