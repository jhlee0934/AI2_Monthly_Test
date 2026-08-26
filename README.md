# 월말평가 연습실

문제풀이 기능과 문제 데이터를 분리한 웹 문제풀이 사이트입니다. 화면, 채점, 진행 상태 저장, 코드 편집기와 AI 검토 기능은 공통 엔진으로 유지되고, 표시할 문제는 `problem-packs/`의 문제 팩만 교체해 바꿀 수 있습니다.

## 실행

Node.js 20 이상에서 의존성을 설치하고 개발 서버를 실행합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 3000번 포트가 사용 중이면 다음처럼 다른 포트를 지정할 수 있습니다.

```powershell
$env:PORT=3001; npm.cmd run dev
```

## 문제 팩 구조

```text
problem-pack.config.json          # 기본으로 사용할 문제 팩
problem-packs/
  monthly-ai/
    pack.json                     # 문제 팩 정보와 데이터 위치
    problems.json                 # 현재 Markdown에서 변환한 기본 문제
  my-pack/
    pack.json
    questions/
      flow-001.json
      api-001.json
      coding-001.json
problem-templates/                # 복사해서 쓰는 유형별 템플릿
```

서버는 `problems/` 원문을 직접 읽지 않고 활성 문제 팩만 읽습니다. 따라서 새 팩은 레거시 Markdown 파서와 무관하게 JSON만으로 작성할 수 있습니다. 기존 `problems/`는 원본 보존 및 기본 `monthly-ai` 팩 재생성 용도로 남아 있습니다.

### 새 문제 팩 만들기

1. `problem-packs/my-pack/questions/` 폴더를 만듭니다.
2. `problem-templates/pack.json`을 `problem-packs/my-pack/pack.json`으로 복사하고 `id`, `title`을 수정합니다.
3. 유형별 JSON 템플릿을 복사해 문제를 작성합니다.
4. `npm.cmd run pack:validate -- my-pack`으로 검사합니다.
5. `.env`에 `PROBLEM_PACK=my-pack`을 지정하거나 `problem-pack.config.json`의 `activePack`을 변경하고 서버를 다시 시작합니다.

환경변수가 설정되면 설정 파일보다 우선합니다. `.env`는 Git에 포함되지 않습니다.

### 공통 문제 형식

| 필드 | 설명 |
| --- | --- |
| `id` | 문제 팩 전체에서 고유한 영구 ID |
| `unit` | 사이드바에서 묶을 단원명 |
| `type` | `flow`, `api`, `coding` 중 하나 |
| `title` | 문제 제목 |
| `content` | 문제 설명 |
| `requirements` | 구현 요구사항 문자열 배열 |
| `constraints` | 선택 제약 조건 문자열 배열 |
| `skeleton` | 제공 코드 또는 빈칸 코드 |
| `example` | 예시 입력·출력 |
| `solution` | 정답 또는 모범 코드 |
| `explanation` | 제출 후 표시할 해설 |

유형별 추가 필드는 다음과 같습니다.

- 구현 흐름(`flow`): `acceptedAnswers`, `keywords`
- API 빈칸(`api`): `id`, `answer`, `choices`를 가진 `blanks`
- 실전 코딩(`coding`): 비어 있지 않은 `skeleton`, `requirements`

API 빈칸은 `①`, `②` 또는 `____[1]`, `____[2]`로 표시하며, 최초 등장 순서가 `blanks` 배열 순서와 같아야 합니다. 같은 표시를 반복하면 같은 답을 공유합니다. 자세한 예시는 [문제 제작 안내](problem-templates/README.md)를 참고하세요.

문제 `id`는 브라우저 풀이 기록의 키이므로 이미 배포한 문제의 ID를 바꾸면 기존 진행 상태가 이어지지 않습니다.

## 기존 Markdown 다시 변환하기

`npm.cmd run data`를 실행하면 기존 `problems/` 원문을 `problem-packs/monthly-ai/problems.json`으로 다시 변환합니다. 다른 문제 팩은 변경하지 않습니다.

## OpenAI 코드 검토

웹 상단의 접힌 `AI 코드 검토 설정`에서 사용자가 자신의 API 키와 모델 ID를 입력합니다. 키는 현재 탭 메모리에만 있으며 저장되지 않고, 서버가 요청을 중계한 뒤 보관하지 않습니다. 기본 모델 입력값은 `gpt-5.4-mini`입니다.

- 코드 최대 20,000자
- IP별 분당 최대 5회
- 최대 출력 2,000토큰
- 요청 타임아웃 20초
- 검토 중 중복 요청 차단

## 검사와 빌드

```powershell
npm.cmd run pack:validate
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

인자 없는 `pack:validate`는 현재 활성 팩을 검사합니다. 프로덕션 정적 파일은 `dist/`에 생성됩니다.

## 주요 조작

- 문제 목록의 단원 제목: 문제 목록 접기·펼치기
- `Alt + ←` / `Alt + →`: 이전·다음 문제
- 코드 편집기 `Tab`: 자동완성 선택 또는 들여쓰기
- 코드 편집기 `Ctrl + Space`: 자동완성 열기
- 풀이 초기화: 저장된 전체 답안과 결과 삭제
- 선택지 섞기: API 문제의 드롭다운 선택지 순서 변경
