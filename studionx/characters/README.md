# characters/ — 캐릭터 원본 자료 (웹 비공개)

Nyxi 등 캐릭터의 **레퍼런스와 원본 이미지**를 보관합니다. 캐릭터 외형은 별도 AI 플랫폼에서 제작합니다.

| 폴더 | 넣을 것 |
|---|---|
| `nyxi/reference/` | 참고 자료 — 캐릭터 시트, 포즈·표정·색감 레퍼런스, 외부 플랫폼에 줄 참고 이미지 |
| `nyxi/base/` | **Nyxi 기본(Base) 이미지** — 확정된 원본 디자인. 모든 변형(춤·아이콘·카드 아트)의 기준 |

> 이 폴더는 `frontend/` 밖에 있어서 **웹으로 서빙되지 않습니다**.
> 실제 화면에서 쓰는 변환된 에셋(애니메이션·아이콘·카드 아트 + `manifest.json`)은 `frontend/static/characters/nyxi/`에 둡니다 (규격: `docs/PRD/02_Phase2_Sequencer_Core.md` FR-288).

## 파일 이름 규칙 (권장)
- base: `nyxi_base_v1.png` — 버전이 바뀌면 `v2`, `v3` (이전 버전은 지우지 않기)
- reference: `nyxi_ref_{내용}.{확장자}` — 예: `nyxi_ref_character-sheet.png`, `nyxi_ref_dance-pose.png`
