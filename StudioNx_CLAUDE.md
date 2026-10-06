# 프로젝트명 - Studio Nx.

## 목적 : 웹 기반의 DAW 시퀀서

## 핵심 기능
     1) 기본적인 회원 등의 CRUD 기능
     2) 기본적인 시퀀서 기능 - 외부에서 샘플을 드래그앤 드롭해 라이브러리에 저장한 뒤 쓸 수 있도록 하고, MIDI 파일 등은 화면 상에서 클릭이나 외부 악기를 통해 입력하도록 함. 또한 plugin이나 synth 및 가상 악기는 웹 기반으로 하도록 함.
     3) reference가 될 트랙의 link(youtube 등)나 파일, 그리고 주 장르를 입력하거나 태그에서 클릭해서 AI가 이를 분석하고, synth 및 plugin 프리셋의 추천 설정을 만들어주고, 믹싱 및 마스터링 설정도 하도록 함.
     4) 샘플 등을 별도로 instrument separation하는 기능
     5) wav 및 mp3 등 오디오 파일 형식에 따라 output하는 기능
     6) 다른 회원을 초대하여 google docs와 비슷한 방식으로 협업하는 기능(with 단체 톡)

## 기술스택
     - FrontEnd : Javascript + CSS + HTML5
     - BackEnd : Python FastAPI
     - Database : Oracle DB (만약 Oracle DB를 설치해야 하면 MySQL로 대체)
     - 그 외 : C++

## 페이지 구성
     - home.html -> 해당 서비스의 맨 처음 main page, 서비스 설명 및 문의 창 등등..
     - 계정 관련
       * 로그인 -> home.html의 로그인 모달 (별도 페이지 없음, 2026-10-02 결정)
       * join.html -> 회원가입
     - 마이페이지
       * myPage.html -> 마이페이지 대시보드
       * userInfo.html -> 회원 정보 및 수정
       * myProject.html -> 나의 프로젝트
     - studioNx.html -> 시퀀서

## AI 관련 주의 사항
     - FrontEnd 중 html과 CSS의 경우에는 적극적으로 AI를 활용할 예정이지만, 다만 이전에 레퍼런스를 어떻게 하는지를 관련 디렉토리에서 확인하도록 할 것.
     - Javascript 및 BackEnd 구현은 AI가 하되, **함수 하나씩** 구현하고 멈춰서 내가 직접 검토(코드 · 설명 · 시험 결과)한 뒤 OK 하면 다음 함수로 넘어감. 함수마다 `docs/ai-notes/javascript/NN_파일_함수.md` + PDF 로 설명(명확·간결, 만연체 금지). (2026-10-06 변경 — 예전: 템플릿만 제공, 요청 시에만 AI 구현)
     - DB는 새로운 database를 만들고 새로 만든 곳에 테이블 등을 만들도록 하고, DB구조에 대한 문서를 별도로 만들어 놓을 것.
     - C++적인 구현 자체는 최대한 AI가 건들지 말도록 할 것(특히 아마도 관련 외부 라이브러리(JUCE 등)를 배우고 싶기도 하니까..)
     - AI가 구현한 부분은 무조건 별도의 문서로 설명을 자세히 적어 놓을 것(실제로 해당 프로젝트 관련 질문 대비할 수 있도록 하기 위함.)
     - FrontEnd의 경우, 일단 위의 기술스택으로 하되 이후, React 및 Next.js 등으로 변환할 수 있는 여지를 줄 수 있게만 구현하도록 함(문법적으로 React 및 Next.js의 문법을 일단은 적용하지 않도록 함.)