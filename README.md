# 월말평가 연습실

AI·딥러닝 수업의 월말평가를 대비하는 정적 웹 문제 풀이 애플리케이션이다. 개념 확인, API 빈칸, TODO 코드 조립 문제를 제공하며 풀이 상태와 채점 결과는 브라우저 `localStorage`에 저장한다.

## 기술 스택

- Node.js 20 이상
- 브라우저 JavaScript, HTML, CSS
- esbuild 번들링
- Node 내장 테스트 러너
- GitHub Actions와 GitHub Pages

웹 프레임워크, 데이터베이스, 사용자 계정, 런타임 Python 의존성은 사용하지 않는다. `requirements.txt`는 Python 패키지가 필요하지 않다는 안내 파일이다.

## 시작하기

```powershell
npm.cmd ci
npm.cmd run dev
```

개발 주소는 `http://localhost:3000`이다. 다른 포트를 사용하려면 다음처럼 실행한다.

```powershell
$env:PORT=3001
npm.cmd run dev
```

개발 서버는 항상 `public/`을 제공한다. `dist/`가 존재해도 개발 화면에는 사용하지 않는다.

## 프로젝트 구조

```text
.
├─ .github/workflows/deploy-pages.yml # 테스트·빌드·GitHub Pages 배포
├─ public/                             # 개발 서버가 제공하는 정적 사이트
│  ├─ index.html                       # 화면 골격과 세 문제 탭
│  ├─ app.js                           # 상태, 렌더링, 채점, 조립 난이도
│  ├─ app.bundle.js                    # 생성물, Git 추적 제외
│  ├─ styles.css                       # 공통·모바일 스타일
│  └─ data/problems.json               # 생성된 브라우저용 문제 데이터
├─ problems/                           # 직접 관리하는 기본 문제 원본
│  ├─ flow/                            # 개념 확인 문제, 단원별 JSON
│  ├─ api/                             # API 빈칸 문제, 단원별 JSON
│  └─ assembly/                        # TODO 조립 문제, 단원별 생성 JSON
├─ problem-packs/monthly-ai/
│  ├─ pack.json                        # 기본 팩 매니페스트
│  └─ problems.json                    # 생성된 문제 팩 데이터
├─ problem-templates/                  # 유형별 템플릿과 제작 지침
├─ samples/                            # 로컬 노트북 문제·정답 원본, Git 추적 제외
├─ scripts/
│  ├─ parser.mjs                       # problems/ 원본 통합·정렬
│  ├─ problem-pack.mjs                 # 팩 로딩과 공통 스키마 검증
│  ├─ build-assembly-from-samples.mjs  # 노트북 TODO → assembly JSON
│  ├─ build-data.mjs                   # 원본 → 런타임·브라우저 데이터
│  ├─ validate-pack.mjs                # 문제 팩 검증 CLI
│  ├─ build-client.mjs                 # app.js 번들 생성
│  ├─ build.mjs                        # dist/ 프로덕션 빌드
│  └─ check.mjs                        # 정적 규칙 검사
├─ tests/                              # 데이터·UI 계약 회귀 테스트
├─ server.mjs                          # public/ 정적 서버와 문제 팩 API
├─ problem-pack.config.json            # 기본 활성 문제 팩
└─ package.json                        # npm 명령과 Node 버전
```

생성 파일을 직접 편집하지 않는다. 문제를 바꿀 때는 `problems/` 또는 변환 스크립트를 수정한 뒤 데이터를 다시 생성한다.

## 문제 데이터

기본 문제 팩은 총 152문제다.

| 화면 탭 | `type` | 개수 | 입력과 채점 |
| --- | --- | ---: | --- |
| 개념 확인 | `flow` | 62 | 서술 답안의 핵심 키워드 포함 비율 |
| API 빈칸 | `api` | 44 | 선택한 토큰과 빈칸 정답 비교 |
| TODO 코드 조립 | `assembly` | 46 | 클릭해 배치한 토큰과 슬롯 정답 비교 |

`scripts/parser.mjs`는 `problems/` 아래 JSON을 유형·단원 순으로 합친다. 레거시 Markdown 파서도 남아 있지만 현재 기본 원본은 모두 JSON이다. 통합 결과는 `scripts/problem-pack.mjs`의 `validateProblems()`를 통과해야 저장된다.

`npm run data`는 다음 두 파일을 덮어쓴다.

- `problem-packs/monthly-ai/problems.json`: Node 문제 팩 로더용
- `public/data/problems.json`: 브라우저와 GitHub Pages용

## TODO 코드 조립 생성 규칙

`assembly` 원본은 `samples/**/문제/*.ipynb`와 같은 이름의 `정답/*.ipynb` 쌍에서 만든다.

```powershell
npm.cmd run assembly:data
npm.cmd run data
```

변환기는 다음 규칙을 적용한다.

1. 코드 셀의 `# TODO 번호:` 지시만 수집한다.
2. 같은 번호를 가진 정답 셀의 완성 코드를 연결한다.
3. 같은 노트북에서 이어지는 짧은 TODO를 최대 4개, 완성 코드 12줄 이내로 통합한다.
4. 코드 영역에 `# TODO 1: ...` 형식으로 지시와 관련 코드를 순서대로 둔다.
5. 문제 제목은 TODO 문장을 나열하지 않고 `Wine 데이터셋 로드`, `특성 스케일링`처럼 학습 개념으로 요약한다.
6. 프롬프트 작성만 요구하는 TODO는 독립 문제로 만들지 않는다.
7. 다음 TODO가 해당 프롬프트 변수를 사용하면 프롬프트를 제공 코드로 앞에 붙인다.
8. TODO 주석, 프롬프트, 템플릿 문자열은 보통·어려움 모두 슬롯으로 만들지 않는다.
9. `print(...)` 출력문은 완성 코드에서 제거한다. 출력만 수행하는 TODO는 문제에서 제외하고, 값을 계산·생성하는 코드는 유지한다.
10. 그룹 끝의 import-only TODO는 해당 모듈을 실제 사용하는 다음 문제 앞으로 이동한다.
11. 제목은 잘린 TODO 문장이 아니라 완성 코드의 핵심 API와 학습 개념으로 생성한다.

난이도는 상단 툴바에서 전체 조립 문제에 적용한다.

- `보통`: 결과 변수와 코드 구조를 남기고 함수·메서드·속성·핵심 인자와 값을 조립한다.
- `어려움`: 보호된 TODO·프롬프트를 제외한 코드 토큰을 모두 조립한다.

난이도별 풀이 상태는 따로 저장된다. `정답 보기`를 사용한 슬롯은 제출 시 오답으로 처리된다.

## 실행 흐름

### 개발

```text
npm run dev
→ build-data.mjs: problems/ → 두 problems.json 생성
→ validate-pack.mjs: 활성 문제 팩 검증
→ build-client.mjs: public/app.bundle.js 생성
→ node --watch server.mjs: public/ 제공
```

브라우저는 서버 API가 아니라 상대 경로 `./data/problems.json`을 읽는다. 따라서 개발 서버와 GitHub Pages가 같은 데이터 경로를 사용한다. `server.mjs`의 `GET /api/problems`는 문제 팩을 JSON으로 확인할 수 있는 보조 API다.

### 프로덕션

```text
npm run build
→ 문제 데이터 생성·검증
→ 클라이언트 번들 생성
→ 기존 dist/ 제거
→ public/ 전체를 dist/로 복사
```

`dist/`는 Git에서 추적하지 않는다. `.github/workflows/deploy-pages.yml`이 `main` push 또는 수동 실행 시 `npm ci`, 테스트, 빌드를 수행하고 생성된 `dist/`를 Pages artifact로 배포한다.

## 문제 모델

모든 문제는 다음 공통 필드를 사용한다.

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `id` | 예 | 문제 팩 안에서 고유한 영구 ID |
| `unit` | 예 | 사이드바 단원 그룹 |
| `type` | 예 | `flow`, `api`, `assembly` |
| `title` | 예 | 문제 목록에 표시할 짧은 개념명 |
| `content` | 예 | 문제 설명 |
| `requirements` | 예 | 수행해야 할 요구사항 배열 |
| `constraints` | 아니요 | 제한사항 배열 |
| `solution` | 아니요 | 모범 답안 또는 완성 코드 |
| `explanation` | 아니요 | 제출 후 해설 |
| `example` | 아니요 | 입력·출력 또는 실행 예시 |

유형별 추가 필드는 다음과 같다.

- `flow`: `acceptedAnswers`, `keywords`
- `api`: `skeleton`, `blanks`; 각 blank는 `id`, `answer`, `choices` 사용
- `assembly`: `skeleton`, `slots`, `tokens`, 선택적 `protectedRanges`, `source`

API와 assembly의 스켈레톤 슬롯은 `____[1]`, `____[2]` 형식을 사용한다. 각 정답은 해당 선택지 또는 토큰 목록에 반드시 포함되어야 한다.

## 문제 팩 전환

기본 팩은 `problem-pack.config.json`의 `activePack`으로 선택한다. 로컬에서만 다른 팩을 쓰려면 `.env`에 다음처럼 설정한다.

```dotenv
PROBLEM_PACK=my-pack
```

팩은 `pack.json`에서 단일 `problemFile` 또는 재귀적인 `problemDirectory`를 지정할 수 있다.

```powershell
npm.cmd run pack:validate -- my-pack
```

## npm 명령

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 데이터·검증·번들 생성 후 개발 서버 실행 |
| `npm start` | 기존 `public/`을 즉시 제공 |
| `npm run assembly:data` | samples 노트북 TODO를 assembly JSON으로 변환 |
| `npm run data` | 기본 런타임·브라우저 문제 데이터 생성 |
| `npm run pack:validate` | 활성 또는 지정 문제 팩 검증 |
| `npm run lint` | 공백과 클라이언트 비밀정보 정적 검사 |
| `npm run typecheck` | 주요 JavaScript 파일 구문 검사 |
| `npm test` | 데이터와 UI 계약 테스트 |
| `npm run build` | 배포용 `dist/` 생성 |

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## UI와 상태

- 세 탭은 화면 폭 안에서 항상 함께 표시된다.
- 단원 제목을 눌러 문제 목록을 접고 펼친다.
- API 선택지는 필요하면 표시 순서를 섞을 수 있다.
- 조립 토큰은 종류별로 묶이며 모바일에서 여러 줄과 내부 세로 스크롤을 사용한다.
- `Alt + ←`, `Alt + →`로 이전·다음 문제를 이동한다.
- `풀이 초기화`는 현재 팩의 저장된 답안과 채점 결과를 지운다.

저장 키는 `monthly-ai-practice:v1`이며 문제 팩 ID별로 상태를 분리한다. 문제 `id`를 바꾸면 기존 저장 답안과 연결되지 않는다.

## 보안과 제한

- 비밀 키나 토큰을 소스, 문제 데이터, 클라이언트 코드에 넣지 않는다.
- 정답과 해설이 브라우저 문제 JSON에 포함되므로 보안이 필요한 실제 시험 용도로는 적합하지 않다.
- GitHub Pages 정적 배포에는 인증, 서버 저장소, 문제 신고 기능이 없다.
- `.env.example`의 GitHub 신고 변수와 `server.mjs`의 관련 보조 함수는 현재 라우트와 클라이언트에 연결되지 않은 잔여 코드다.

자세한 문제 작성 규칙은 [문제 템플릿 안내](problem-templates/README.md)를 참고한다.
