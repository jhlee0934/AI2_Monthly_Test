# 월말평가 연습실

AI·딥러닝 수업의 월말평가 문제를 브라우저에서 풀고 채점하는 Node.js 웹 애플리케이션이다. UI와 채점 엔진은 문제 데이터와 분리되어 있으며, `problem-packs/` 아래의 활성 문제 팩을 교체해 같은 애플리케이션으로 다른 시험 범위를 제공할 수 있다.

## 기술 스택

- Node.js 20 이상, 네이티브 `node:http` 서버
- 브라우저 JavaScript와 CSS
- esbuild 클라이언트 번들링
- Node 내장 테스트 러너
- OpenAI Responses API 기반 코딩 답안 검토

웹 프레임워크, 데이터베이스, 사용자 계정 시스템은 사용하지 않는다. 풀이 상태는 브라우저 `localStorage`에 저장한다.

## 빠른 시작

```powershell
npm.cmd ci
npm.cmd run dev
```

기본 주소는 `http://localhost:3000`이다. 포트를 바꾸려면 다음처럼 실행한다.

```powershell
$env:PORT=3001
npm.cmd run dev
```

`npm run dev`는 데이터 생성, 문제 팩 검증, 클라이언트 번들링 후 서버를 watch 모드로 시작한다.

개발 서버는 항상 `public/`을 제공한다. `dist/`는 `npm run build`와 GitHub Actions에서 생성하는 배포 전용 결과이며 Git에서 추적하지 않는다.

## 디렉터리 구조

```text
.
├─ server.mjs                         # HTTP 서버, 문제 API, OpenAI 검토 중계
├─ package.json                       # 명령과 npm 직접 의존성
├─ package-lock.json                  # 재현 가능한 npm 의존성 잠금
├─ problem-pack.config.json           # 기본 활성 문제 팩
├─ public/
│  ├─ index.html                      # 애플리케이션 HTML 골격
│  ├─ app.js                          # 상태, 렌더링, 채점, API 호출
│  ├─ app.bundle.js                   # 생성된 브라우저 번들
│  └─ styles.css                      # 공통 및 반응형 스타일
├─ dist/                              # 생성 파일: 프로덕션 정적 결과
├─ problems/
│  └─ exam_questions.json             # monthly-ai 팩의 현재 저작 원본
├─ problem-packs/
│  └─ monthly-ai/
│     ├─ pack.json                    # 팩 매니페스트
│     └─ problems.json                # 생성된 런타임 문제 데이터
├─ problem-templates/                 # 문제 팩 제작 자료
├─ scripts/
│  ├─ parser.mjs                      # JSON/레거시 Markdown → 공통 모델
│  ├─ problem-pack.mjs                # 로딩, 경로 보호, 스키마 검증
│  ├─ build-data.mjs                  # monthly-ai 데이터 생성
│  ├─ validate-pack.mjs               # CLI 문제 팩 검증
│  ├─ build-client.mjs                # 클라이언트 번들 생성
│  ├─ build.mjs                       # 전체 프로덕션 빌드
│  ├─ check.mjs                       # 정적 규칙 검사
│  └─ enrich-api-explanations.mjs     # API 문제 해설 보강
└─ tests/                              # 파서와 문제 팩 회귀 테스트
```

`public/app.bundle.js`, 소스맵, `dist/`, `problem-packs/monthly-ai/problems.json`은 다시 생성될 수 있다. 생성 결과보다 원본이나 생성 스크립트를 수정한다.

## 아키텍처와 책임 경계

### 문제 데이터 계층

런타임 단위는 문제 팩이다. 팩은 `pack.json`과 하나 이상의 JSON 문제 파일로 구성되며, 서버와 클라이언트는 `problems/`의 저작 원본을 직접 읽지 않는다.

`scripts/parser.mjs`는 두 원본 형식을 공통 문제 모델로 합친다.

1. JSON 배열, `{ "problems": [...] }`, 단일 객체를 읽는다.
2. 레거시 Markdown은 경로와 섹션 제목을 해석해 문제로 변환한다.
3. API 문제는 정답을 추출하고 오답 선택지를 구성한다.
4. 모든 결과는 `validateProblems()`를 통과해야 저장된다.

현재 기본 팩은 `problems/`의 `flow`, `api` 문제만 빌드한다. 현재 데이터는 개념 확인 주관식 50개와 중복 코드를 통합한 API 빈칸 35개로 총 85문제다.

| 유형 | 내부 값 | 개수 | 채점 방식 |
| --- | --- | ---: | --- |
| 개념 확인 주관식 | `flow` | 80 | 핵심 키워드 포함 비율 |
| API 빈칸 | `api` | 100 | 빈칸별 정답 문자열 일치 |

### 서버 계층

`server.mjs`는 다음 역할을 담당한다.

| 요청 | 동작 |
| --- | --- |
| `./data/problems.json` | GitHub Pages에서 읽는 정적 문제 팩 |
| `GET`, `HEAD /*` | `public/` 정적 파일 제공 |

활성 팩은 `.env`의 `PROBLEM_PACK`이 우선이며, 없으면 `problem-pack.config.json`의 `activePack`을 사용한다. 팩 이름과 내부 경로는 허용된 문제 팩 디렉터리를 벗어나지 못하도록 검사한다.

코드 검토 제한:

- 코드 최대 20,000자
- IP별 1분에 최대 5회
- OpenAI 출력 최대 2,000토큰
- 20초 타임아웃
- JSON Schema 기반 구조화 결과 검증
- API 키는 요청 중계에만 사용하고 저장하지 않음

rate limit은 프로세스 메모리에만 있어 재시작 시 초기화되고 여러 서버 인스턴스 사이에서 공유되지 않는다.

### GitHub 문제 신고

GitHub Pages 배포에서는 문제 신고 기능을 제공하지 않는다.

1. GitHub에서 대상 저장소 하나에만 접근하는 fine-grained personal access token을 만든다.
2. Repository permissions의 `Issues`만 `Read and write`로 설정하고 만료 기간을 지정한다.
3. `.env.example`을 참고해 로컬 `.env` 또는 배포 환경변수를 설정한다.

```dotenv
GITHUB_REPORT_TOKEN=github에서_발급한_토큰
GITHUB_REPORT_OWNER=jhlee0934
GITHUB_REPORT_REPO=AI2_Monthly_Test
```

설정하지 않으면 문제 풀이는 정상 동작하지만 신고 API는 `503`을 반환한다. 신고에는 문제 팩·문제 ID·단원·유형·제목과 사용자가 입력한 설명만 포함된다. 답안, 작성 중인 코드, OpenAI API 키, IP 주소는 이슈 본문에 넣지 않는다.

보호 장치:

- 동일 IP에서 분당 최대 3회
- 동일 출처 요청 확인과 자동 제출 방지용 숨김 필드
- 활성 팩 ID와 실제 문제 ID 검증
- 서버가 허용한 신고 유형만 사용
- 신고 본문 5~2,000자 제한 및 제어문자 제거
- GitHub Markdown과 멘션 이스케이프
- GitHub 요청 10초 타임아웃
- 토큰과 GitHub 내부 오류를 클라이언트에 노출하지 않음

### 클라이언트 계층

`public/app.js`는 단일 상태 객체를 중심으로 동작한다.

- 문제 팩을 가져와 유형별로 필터링한다.
- 단원별 목록과 현재 문제를 렌더링한다.
- 유형에 따라 주관식 또는 API 빈칸 입력을 생성한다.
- 작성 중 답안과 제출 결과를 문제 ID 기준으로 저장한다.
- 진행률과 이전·다음 문제 탐색을 갱신한다.

저장 키는 `monthly-ai-practice:v1`이며 진행 상태는 문제 팩 ID별로 분리한다. 문제 `id`는 저장된 답안의 영구 키이므로 배포 후 바꾸면 기존 진행 상태가 연결되지 않는다.

## 실행 흐름

### 개발 실행

```text
npm run dev
  ├─ build-data.mjs
  │   ├─ problems/ 읽기
  │   ├─ 파싱 및 검증
  │   └─ monthly-ai/problems.json 덮어쓰기
  ├─ validate-pack.mjs
  ├─ build-client.mjs → public/app.bundle.js
  └─ node --watch server.mjs
```

### 브라우저 요청

```text
브라우저 → GET ./data/problems.json
        → 활성 pack.json 확인
        → 문제 파일 로드 및 검증
        → { pack, problems } 반환
        → 유형/단원별 UI 렌더링
        → 답안과 결과를 localStorage에 저장
```

### 프로덕션 빌드

```text
npm run build
  → 문제 데이터 생성
  → 활성 문제 팩 검증
  → 클라이언트 번들 생성
  → 기존 dist/ 제거
  → public/ 전체를 dist/로 복사
```

`npm run data`와 `npm run build`는 기본 `monthly-ai/problems.json`을 덮어쓴다. 수동 변경이 있다면 실행 전에 원본 위치를 확인한다.

## 문제 팩 설계

매니페스트는 두 저장 방식을 지원한다.

```json
{
  "schemaVersion": 1,
  "id": "monthly-ai",
  "title": "AI 월말평가 대비",
  "problemFile": "problems.json"
}
```

```json
{
  "schemaVersion": 1,
  "id": "my-pack",
  "title": "새 문제 팩",
  "problemDirectory": "questions"
}
```

`problemFile`은 문제 배열 또는 `{ "problems": [...] }`를 받는다. `problemDirectory`는 하위 JSON 파일을 재귀적으로 읽으며 각 파일에는 단일 객체 또는 배열을 둘 수 있다.

### 공통 문제 모델

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `id` | 필수 | 팩 안에서 고유한 영구 식별자 |
| `unit` | 필수 | 사이드바 그룹 이름 |
| `type` | 필수 | `flow`, `api` 중 하나 |
| `title` | 필수 | 짧은 문제 제목 |
| `content` | 필수 | 문제 본문 문자열 |
| `requirements` | 필수 | 평가할 요구사항 문자열 배열 |
| `constraints` | 선택 | 제한 조건 문자열 배열 |
| `skeleton` | API | 빈칸 코드 |
| `example` | 선택 | 입력·출력 또는 실행 예시 |
| `solution` | 선택 | 정답 또는 완성 코드 |
| `explanation` | 선택 | 제출 후 보여줄 해설 |

유형별 필드와 작성 규칙은 [문제 제작 가이드](problem-templates/README.md)에 정리되어 있다.

## 새 문제 팩 추가

1. `problem-packs/my-pack/questions/`를 만든다.
2. `problem-templates/pack.json`을 팩 루트의 `pack.json`으로 복사한다.
3. `id`, `title`, `description`을 수정한다.
4. 유형별 템플릿을 복사해 문제를 작성한다.
5. 대상 팩을 검증한다.

```powershell
npm.cmd run pack:validate -- my-pack
```

6. `.env`에 `PROBLEM_PACK=my-pack`을 추가하거나 설정 파일을 변경한다.
7. 서버를 다시 시작한다.

`.env`는 Git에 포함되지 않는다. 팀 기본값은 설정 파일에, 개인 선택은 `.env`에 두는 것이 적합하다.

## npm 명령

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 데이터·검증·번들 생성 후 watch 서버 실행 |
| `npm start` | 사전 빌드 없이 서버만 실행 |
| `npm run data` | 기본 문제 팩 데이터 재생성 |
| `npm run pack:validate` | 활성 팩 또는 인자로 받은 팩 검증 |
| `npm run lint` | 공백과 클라이언트 비밀정보 정적 검사 |
| `npm run typecheck` | 주요 JavaScript 파일 구문 검사 |
| `npm test` | 파서와 문제 팩 회귀 테스트 |
| `npm run build` | `dist/` 프로덕션 결과 생성 |

```powershell
npm.cmd run pack:validate
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## 테스트 전략

`tests/parser.test.mjs`는 실제 원본 변환 결과와 클라이언트 계약을 검사한다.

- 두 유형 생성 여부와 ID 중복
- API 빈칸의 정답/선택지 정합성
- 원본 Markdown 구조 문법 제거
- 정적 데이터 경로, 접근성 속성, 단원 접기 UI 회귀

`tests/problem-pack.test.mjs`는 템플릿 검증, 기본 팩 로딩, 잘못된 문제 거부를 검사한다. API 해설 품질 테스트는 각 해설에 정답별 개념과 완성 코드 맥락이 포함되기를 요구한다.

## 보안과 운영

- API 키를 소스, 예제 환경파일, 클라이언트 저장소에 넣지 않는다.
- 현재 구조는 개인 또는 제한된 교육 환경을 전제로 한다. 공개 서비스라면 인증, 중앙 rate limit, HTTPS, CSP, 요청 로깅 정책이 필요하다.
- 개발 서버는 `public/`을 제공하고, GitHub Actions는 배포 시 `npm run build`로 생성한 `dist/`를 artifact로 업로드한다.
- 정답 데이터도 클라이언트로 전송되므로 보안이 필요한 실제 시험의 정답 저장소로 사용할 수 없다.

## GitHub Pages 배포

정적 사이트는 `./data/problems.json`을 읽으므로 저장소 하위 주소에서도 동작한다. `.github/workflows/deploy-pages.yml`은 `main` 브랜치 push 시 테스트와 빌드를 수행하고 `dist/`를 GitHub Pages에 배포한다.

저장소의 `Settings → Pages → Build and deployment → Source`를 `GitHub Actions`로 설정한 뒤 `main`에 push한다. 예상 주소는 `https://jhlee0934.github.io/AI2_Monthly_Test/`이다. 현재 정적 배포판에는 문제 신고 기능이 없다.

## UI 조작

- 단원 제목: 문제 목록 접기·펼치기
- `Alt + ←`, `Alt + →`: 이전·다음 문제
- 선택지 섞기: API 선택지 표시 순서 변경
- 풀이 초기화: 현재 팩의 답안과 채점 결과 삭제
