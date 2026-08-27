# 문제 템플릿 안내

이 디렉터리는 문제 팩을 수동 작성하거나 생성 결과를 검토할 때 사용하는 예시와 지침을 제공한다. 실제 기본 문제 원본은 `../problems/<type>/<unit>.json`에 둔다.

## 파일 목록

| 파일 | 역할 |
| --- | --- |
| `flow.json` | 개념 확인 주관식 단일 문제 예시 |
| `api.json` | 실행 맥락을 포함한 API 빈칸 단일 문제 예시 |
| `assembly.json` | 클릭 방식 TODO 코드 조립 단일 문제 예시 |
| `exam_questions_template.json` | flow와 api를 함께 담은 수동 작성 예시 |
| `pack.json` | 새 문제 팩 매니페스트 예시 |
| `exam_question_generation_prompt.md` | 노트북에서 flow·api를 생성할 때 사용하는 프롬프트 |

`exam_questions_template.json`에는 assembly가 없다. 기본 assembly 문제는 템플릿을 복제해 대량 작성하지 않고 `../scripts/build-assembly-from-samples.mjs`로 생성한다.

## 공통 필드

| 필드 | 설명 |
| --- | --- |
| `id` | 팩 안에서 고유하고 배포 후 가급적 바꾸지 않는 ID |
| `unit` | 문제 목록의 단원 그룹 |
| `type` | `flow`, `api`, `assembly` |
| `title` | TODO 번호 나열이 아닌 짧은 학습 개념 |
| `content` | 풀이 상황과 목표 |
| `requirements` | 채점하거나 확인할 요구사항 배열 |
| `solution` | 모범 답안 또는 모든 슬롯을 채운 코드 |
| `explanation` | 정답 근거와 입력→호출→결과 흐름 |
| `example` | 선택적 실행 예시 |

## flow

- `acceptedAnswers`에 완전한 모범 답안을 하나 이상 둔다.
- `keywords`는 자동 채점에 꼭 필요한 표현 1~2개만 둔다.
- 단순 API 호출법보다 개념의 목적, 원리, 차이, 결과 해석을 묻는다.

## api

- `skeleton` 슬롯은 `____[1]` 형식을 사용한다.
- `blanks`의 순서는 스켈레톤 번호와 일치해야 한다.
- 각 blank의 `answer`는 같은 blank의 `choices`에 포함해야 한다.
- 한두 줄의 호출만 떼지 말고 객체·입력 준비, 핵심 호출, 결과 사용이 보이게 한다.
- `solution`에는 빈칸 표식을 남기지 않는다.

## assembly

- `skeleton`, `slots`, `tokens`, `solution`이 필요하다.
- 슬롯 수와 `____[번호]` 수가 같아야 한다.
- 각 slot의 `answer`는 `tokens`에 포함해야 한다.
- 통합 문제는 코드 안에 `# TODO 1: ...` 형식으로 지시와 코드를 순서대로 둔다.
- `protectedRanges`는 어려움에서도 그대로 제공할 TODO 주석·프롬프트 등의 `solution` 문자 범위를 `{ "start", "end" }`로 기록한다.
- `source`는 자동 생성 문제의 원본 노트북 상대 경로다.

기본 assembly 생성 절차는 다음과 같다.

```powershell
npm.cmd run assembly:data
npm.cmd run data
```

프롬프트 작성만 요구하는 TODO는 독립 조립 문제로 만들지 않는다. 이후 코드가 해당 프롬프트 변수를 사용하면 프롬프트를 보호된 제공 코드로 포함한다.

## 저장과 검증

기본 원본은 유형·단원별로 저장한다.

```text
problems/
├─ flow/<unit>.json
├─ api/<unit>.json
└─ assembly/<unit>.json
```

각 파일은 `{ "problems": [...] }` 형식을 사용하며 파일명과 각 문제의 `unit`이 일치해야 한다.

```powershell
npm.cmd run data
npm.cmd run pack:validate
npm.cmd test
```

`problem-packs/monthly-ai/problems.json`과 `public/data/problems.json`은 생성물이므로 직접 수정하지 않는다.
