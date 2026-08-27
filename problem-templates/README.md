# 문제 팩 및 문제 제작 가이드

이 디렉터리는 문제 저작자가 런타임 스키마에 맞는 문제 팩을 만들기 위한 템플릿을 제공한다.

## 파일 구성

| 파일 | 용도 |
| --- | --- |
| `pack.json` | `questions/` 디렉터리를 사용하는 팩 매니페스트 예시 |
| `flow.json` | 개념 확인 주관식 문제 예시 |
| `api.json` | API 빈칸 문제 예시 |
| `coding.json` | 실전 코딩 문제 예시 |
| `exam_questions_template.json` | 세 유형을 한 파일에 담는 일괄 생성 예시 |
| `exam_question_generation_prompt.md` | 노트북 기반 AI 문제 생성 프롬프트 |

한 문제씩 관리할 때는 유형별 템플릿을 새 팩의 `questions/`에 복사한다. 대량 생성 결과는 `{ "problems": [...] }` 구조로 관리할 수 있다.

## 제작 흐름

```text
템플릿 복사
  → 팩 ID와 문제 ID 확정
  → 문제 및 채점 데이터 작성
  → pack:validate 실행
  → 활성 팩 변경
  → 브라우저에서 제출 동작 확인
```

```text
problem-packs/my-pack/
├─ pack.json
└─ questions/
   ├─ flow-001.json
   ├─ api-001.json
   └─ coding-001.json
```

```powershell
npm.cmd run pack:validate -- my-pack
```

## 매니페스트

```json
{
  "schemaVersion": 1,
  "id": "my-pack",
  "title": "새 문제 팩",
  "description": "문제 팩 설명",
  "problemDirectory": "questions"
}
```

- `schemaVersion`은 현재 `1`만 지원한다.
- `id`는 브라우저 저장 공간을 분리하는 키로도 사용된다.
- `problemDirectory`와 `problemFile` 중 하나가 필요하다.
- 경로는 문제 팩 디렉터리 내부만 가리킬 수 있다.

## 공통 필드

```json
{
  "id": "flow-ch01-001",
  "unit": "1-2",
  "type": "flow",
  "title": "문제 제목",
  "content": "사용자가 읽을 문제 본문",
  "requirements": ["평가할 요구사항"]
}
```

| 필드 | 규칙 |
| --- | --- |
| `id` | 팩 전체에서 고유해야 하며 배포 후 변경하지 않는 것을 권장 |
| `unit` | 같은 값의 문제끼리 사이드바에서 한 그룹으로 표시 |
| `type` | `flow`, `api`, `coding` 중 하나 |
| `title` | 목록과 본문에 표시할 짧은 제목 |
| `content` | 문제 설명 문자열 |
| `requirements` | 평가 요구사항 문자열 배열 |
| `constraints` | 선택적인 제한 조건 문자열 배열 |
| `example` | 선택적인 입력·출력 또는 실행 예시 |
| `solution` | 유형에 따른 모범 답안 또는 완성 코드 |
| `explanation` | 제출 이후 공개되는 해설 |

난이도, 예상 시간, 태그, 출처, 생성 시각은 현재 화면과 검증에서 사용하지 않는다. 추가할 수는 있지만 런타임 동작에는 영향을 주지 않는다.

## 개념 확인 주관식 (`flow`)

필수 추가 필드는 `acceptedAnswers`와 비어 있지 않은 `keywords`다.

```json
{
  "type": "flow",
  "acceptedAnswers": ["완전한 모범 답안"],
  "keywords": ["optimizer.zero_grad()", "gradient accumulation"],
  "solution": "제출 후 보여줄 모범 답안",
  "explanation": "판단 근거와 흔한 실수"
}
```

클라이언트는 답안을 정규화하고 `keywords`가 포함된 비율로 상태를 결정한다.

- 채점에 꼭 필요한 표현만 키워드로 둔다.
- 같은 의미의 표현을 지나치게 많이 나열하지 않는다.
- 정확한 API 이름과 일반 개념어를 적절히 조합한다.
- `acceptedAnswers`는 현재 직접 문자열 비교에 쓰이지 않지만 문제 계약과 향후 확장을 위해 유지한다.
- `solution`과 `explanation`은 제출 후 노출된다.

## API 빈칸 (`api`)

필수 추가 필드는 `skeleton`과 비어 있지 않은 `blanks`다.

```json
{
  "type": "api",
  "skeleton": "loss.____[1]()\noptimizer.____[2]()",
  "blanks": [
    {
      "id": "blank-1",
      "answer": "backward",
      "choices": ["backward", "item", "detach", "zero_grad"]
    },
    {
      "id": "blank-2",
      "answer": "step",
      "choices": ["step", "eval", "train", "forward"]
    }
  ],
  "solution": "loss.backward()\noptimizer.step()",
  "explanation": "각 API의 역할과 완성하면 만들어지는 코드 흐름"
}
```

작성 규칙:

- 빈칸 표시는 `____[1]`, `____[2]` 형식을 권장한다.
- 최초 등장 순서와 `blanks` 배열 순서를 일치시킨다.
- 같은 번호를 반복하면 같은 선택값이 연동된다.
- `answer`는 반드시 해당 `choices`에 포함한다.
- 선택지는 문자열 완전 일치로 채점되므로 공백과 괄호 범위를 일관되게 작성한다.
- `solution`은 빈칸을 모두 복원한 완전한 코드여야 한다.
- 해설에는 각 정답의 역할과 완성 코드의 실행 맥락을 포함한다.

변수명, 괄호 한쪽, 따옴표처럼 학습 가치가 낮거나 답이 여러 개인 요소는 빈칸으로 만들지 않는다.

## 실전 코딩 (`coding`)

`requirements`와 `skeleton`은 비어 있을 수 없다.

```json
{
  "type": "coding",
  "content": "구현할 기능과 입력·출력 계약",
  "requirements": [
    "입력값을 검증한다.",
    "지정한 형태의 값을 반환한다."
  ],
  "constraints": ["함수 시그니처를 변경하지 않는다."],
  "skeleton": "def solve(value):\n    # 코드를 작성하세요.\n    pass",
  "example": "입력: 3\n출력: 6",
  "solution": "",
  "explanation": "사전 제공 객체와 실행 문맥"
}
```

코딩 답안은 서버에서 실행하지 않는다. 사용자 코드와 문제의 제목, 본문, 요구사항, 제약, 예시를 OpenAI에 전달해 정적으로 검토한다.

- 요구사항은 코드에서 관찰 가능한 문장으로 작성한다.
- 입력 타입, 반환 타입, shape, 상태 변경 여부를 명확히 한다.
- 함수 또는 클래스 시그니처를 스켈레톤에 보존한다.
- 외부 네트워크나 대형 모델 없이 이해 가능한 fixture 또는 stub 문맥을 제공한다.
- AI 검토가 모범 답안을 참조하지 않으므로 `solution`은 빈 문자열이어도 된다.
- `explanation`에는 정답 코드보다 필요한 실행 환경을 기술한다.

## ID 설계

권장 형식은 `<type>-<unit>-<sequence>`다.

```text
flow-12-001
api-12-001
coding-12-001
```

ID는 문제 팩 중복 검증, 클라이언트 문제 식별, `localStorage` 풀이 기록을 연결한다. 제목이나 본문만 수정할 때는 ID를 유지하고, 완전히 다른 문제로 교체할 때 새 ID를 사용한다.

## 일괄 생성과 검수

`exam_questions_template.json`은 사이트가 읽는 `{ "problems": [...] }` 구조다. AI로 노트북을 분석할 때는 `exam_question_generation_prompt.md`를 함께 사용한다.

생성 결과 검수 순서:

1. JSON 파싱 가능 여부
2. 전체 ID 중복 여부
3. 유형별 필수 필드
4. API 빈칸 표시와 `blanks` 순서
5. 정답이 선택지에 포함되는지 여부
6. 완성 코드의 문법과 실행 흐름
7. 문제 본문의 정답 노출 여부
8. 네트워크, API 키, 개인 경로 등 환경 의존성

## 런타임 반영

독립 문제 팩은 해당 팩의 JSON에서 직접 관리한다. 기본 `monthly-ai` 팩은 생성 파이프라인을 사용한다.

```powershell
npm.cmd run data
```

이 명령은 `problems/`를 읽어 `problem-packs/monthly-ai/problems.json`을 덮어쓴다. 생성된 기본 팩 파일을 직접 수정하면 변경이 사라질 수 있다.

```powershell
npm.cmd run pack:validate
npm.cmd test
```

최종 화면과 번들까지 검사할 때는 다음도 실행한다.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```
