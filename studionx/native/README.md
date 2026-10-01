# native/ — C++ DSP (JUCE → WebAssembly)

이 폴더는 **사용자가 직접 구현하는 영역**입니다. (기획서 원칙: C++ 구현은 AI가 건드리지 않음)

- 목표: JUCE 등으로 만든 DSP를 Emscripten으로 `.wasm` 빌드 → `frontend/static/js` 의 AudioWorklet에서 로드
- 지켜야 할 인터페이스: `docs/PRD/02_Phase2_Sequencer_Core.md` §4.6 (`init`, `setParam`, `noteOn/noteOff`, `process`)
- 빌드 결과물(`.wasm`, glue `.js`)은 `frontend/static/wasm/` 에 두는 것을 권장
- 필요한 도구(직접 설치): CMake, Emscripten SDK(emsdk), JUCE
