# 드래프트 룸 — KBO 신인 드래프트 시뮬레이션

가상의 2027 KBO 신인 드래프트에서 한 구단을 맡아 7라운드 지명을 하고, 뽑은 선수들이 2027–2031 다섯 시즌 동안 어떻게 자라는지 지켜보는 웹 게임입니다.

## 실행

`index.html` 파일 하나를 브라우저로 여세요. 서버·설치·인터넷 연결이 필요 없습니다. 모바일에서는 파일 미리보기 앱이 아니라 JavaScript가 도는 브라우저로 열어야 합니다.

`examples/demo-v06-five-seasons.json`을 게임의 ‘불러오기’로 열면 5년을 다 마친 진행 상태를 바로 볼 수 있습니다.

## 게임 한눈에

1. **구단 선택**: 10개 구단, 난이도(이지/노말/하드), 지역 1차 지명 여부.
2. **예상·추천**: 언론 두 곳의 1라운드 모의 지명과 스카우트 팀장의 추천 3명.
3. **드래프트**: 후보 200명(고졸 136, 대졸 30, 대학 얼리 16, 독립 6, 해외 대학 4, 해외 복귀 8). 20–80 스카우팅 등급, 대졸 의무 지명 1명.
4. **입단**: 단장 기자회견 약속과 입단 소감.
5. **5시즌**: 보직·기록·성장·부상·트레이드·방출이 해마다 이어집니다. 전체 구단 기록실에서 모든 지명 선수를 추적합니다.
6. **평가**: 10개 구단의 드래프트를 5년 경력으로 비교합니다.

시스템이 어떻게 동작하는지는 [`docs/ANALYSIS.md`](docs/ANALYSIS.md)에 정리했습니다.

## 저장

- 진행 상황은 브라우저 `localStorage`에 자동 저장됩니다.
- ‘진행 파일 저장’으로 JSON을 받을 수 있습니다.
- 불러올 때는 시드와 지명 기록으로 게임을 다시 계산합니다. v0.6.0에서 만든 저장도 그대로 열립니다. V0.5 저장은 능력치 체계가 달라 호환되지 않습니다.

## 폴더 구조

```
index.html            빌드 결과물(이 파일 하나로 실행)
src/
  template.html       HTML 뼈대
  styles/main.css     스타일시트
  core/               게임 로직(브라우저·Node 공용, DOM 없음)
    clubs catalog names ko biography   정적 데이터와 한국어 조사
    grades prospects                   20–80 등급, 선수 풀 생성
    scouting draft-ai press voices     팀장·CPU·언론·대사
    season career engine               시즌·5년 경력·진행과 저장 복원
  ui/                 화면(순수 함수로 HTML 생성) + app.js(상태·이벤트)
tests/                단위·DOM·골든·브라우저·밸런스 테스트
docs/ANALYSIS.md      시스템·코드 분석
build.py              src → index.html
release.py            dist/에 배포용 HTML과 소스 zip 생성
```

`src/`를 고쳤다면 `python3 build.py`로 `index.html`을 다시 만드세요.

## 개발

Node.js 22+ 와 Python 3가 필요합니다.

```bash
npm ci
npm run build          # src → index.html
npm test               # 단위·DOM 테스트 + 골든 마스터(시뮬레이션 결과 불변 확인)
npm run test:browser   # 실제 Chromium, 4개 화면 크기로 전체 진행(CHROMIUM_BIN으로 경로 지정)
npm run test:balance   # 600회 전 구단 밸런스 실험
npm run release        # dist/에 배포 파일
```

- **골든 마스터**(`tests/golden.cjs`): 선수 풀 3개와 5년 완주 게임 6개의 해시를 비교합니다.
  - `numbers`(문자열 제외)와 `picks`가 바뀌면 시뮬레이션 동작이 바뀐 것입니다.
  - 문구만 고쳤다면 `full`만 바뀌므로 `node tests/golden.cjs --write`로 기준을 다시 기록하면 됩니다.

## 범위와 주의

- 구단명을 뺀 선수·학교·해외 구단·기록·전력은 모두 게임용 가상 데이터입니다.
- 공식 KBO 규정이나 실제 선수 평가를 재현하지 않습니다.
- 지역 1차·의무 지명·해외 복귀 자격·포스트시즌은 단순화한 규칙입니다.
- 계약금 협상, 지명 거부, 연례 드래프트, 이도류, 수동 트레이드는 없습니다.
