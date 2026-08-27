# 문제 템플릿

이 디렉터리는 개념 확인 주관식(`flow`)과 API 빈칸(`api`) 문제 템플릿만 제공한다.

| 파일 | 용도 |
| --- | --- |
| `flow.json` | 개념 확인 주관식 단일 템플릿 |
| `api.json` | API 빈칸 단일 템플릿 |
| `exam_questions_template.json` | 두 유형을 함께 보여주는 예시 |
| `exam_question_generation_prompt.md` | 노트북 기반 문제 생성 지침 |

API 문제는 빈칸이 있는 한두 줄만 제시하지 않는다. 객체와 입력 준비, 핵심 API 호출, 반환값의 후속 사용을 파악할 수 있는 범위까지 `skeleton`에 포함하고 `content`에서 실행 상황을 설명한다.

공통 필드는 `id`, `unit`, `type`, `title`, `content`, `requirements`, `solution`, `explanation`, `example`이다. `flow`는 `acceptedAnswers`와 `keywords`를, `api`는 `skeleton`과 `blanks`를 추가한다. 각 빈칸의 `answer`는 반드시 해당 `choices`에 포함되어야 한다.
