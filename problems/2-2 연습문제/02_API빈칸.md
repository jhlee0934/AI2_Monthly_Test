# 02. 함수·메서드 빈칸 문제

각 문제는 실습의 핵심 API 흐름을 최소화한 코드이다. 빈칸은 단순 문법이 아니라 앞 블록의 출력을 다음 블록에 전달하는 클래스·함수·메서드 또는 주요 인자이다.

---

# 문제 1. 환경변수와 ChatOpenAI

<a id="question1"></a>

## 문제

`.env`의 `GMS_KEY`로 GMS 채팅 모델을 만들고 질문의 답변 문자열을 출력하도록 빈칸을 채우시오.

## 요구사항

- 키를 코드에 직접 쓰지 않는다.
- `gpt-5.4-mini`와 GMS 엔드포인트를 사용한다.
- 메시지 객체가 아니라 답변 문자열을 출력한다.

## 제공 코드 또는 스켈레톤

```python
import os
from dotenv import ______①______
from langchain_openai import ______②______

______①______()

llm = ______②______ (
    model="gpt-5.4-mini",
    api_key=______③______("GMS_KEY"),
    base_url="https://gms.ssafy.io/gmsapi/api.openai.com/v1/",
)

response = llm.______④______("AI를 한 문장으로 정의하세요.")
print(response.______⑤______)
```

[정답으로 이동](#answer1)

---

<a id="answer1"></a>

## 정답

① `load_dotenv` ② `ChatOpenAI` ③ `os.getenv` ④ `invoke` ⑤ `content`

## 정답 코드

```python
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()
llm = ChatOpenAI(
    model="gpt-5.4-mini",
    api_key=os.getenv("GMS_KEY"),
    base_url="https://gms.ssafy.io/gmsapi/api.openai.com/v1/",
)
response = llm.invoke("AI를 한 문장으로 정의하세요.")
print(response.content)
```

## 핵심 해설

- `load_dotenv()` → `os.getenv()` → `ChatOpenAI()` → `invoke()` → `.content` 순서다.
- `invoke`는 메시지 객체를 반환하고 실제 텍스트는 `content`에 있다.
- 키 이름은 `os.getenv`, 모델·서버는 `ChatOpenAI` 인자를 수정한다.

[문제로 돌아가기](#question1)

---

# 문제 2. Few-shot 프롬프트 호출

<a id="question2"></a>

## 문제

두 개의 입출력 예시로 감성 레이블 형식을 전달한 뒤 새 문장을 분류하도록 빈칸을 채우시오.

## 요구사항

- 예시는 긍정과 부정을 하나씩 포함한다.
- 실제 질문은 예시 뒤에 오고 `감성:` 다음을 모델이 완성하게 한다.
- `llm`은 이미 생성되어 있다.

## 제공 코드 또는 스켈레톤

```python
prompt = """문장: 최고의 서비스였습니다.
감성: ______①______

문장: 배송이 늦어서 실망했어요.
감성: ______②______

문장: 가격 대비 품질이 괜찮네요.
감성:
"""

response = ______③______.______④______(prompt)
label = response.______⑤______.strip()
print(label)
```

[정답으로 이동](#answer2)

---

<a id="answer2"></a>

## 정답

① `긍정` ② `부정` ③ `llm` ④ `invoke` ⑤ `content`

## 정답 코드

```python
prompt = """문장: 최고의 서비스였습니다.
감성: 긍정

문장: 배송이 늦어서 실망했어요.
감성: 부정

문장: 가격 대비 품질이 괜찮네요.
감성:
"""

response = llm.invoke(prompt)
label = response.content.strip()
print(label)
```

## 핵심 해설

- 예시의 입력·정답 쌍이 새 입력의 출력 형식을 전달한다.
- 프롬프트 문자열이 `invoke`의 입력, `AIMessage`가 출력이며 `.content`가 다음 문자열 처리로 전달된다.
- 레이블 체계가 바뀌면 지시와 모든 예시의 출력 레이블을 함께 수정해야 한다.

[문제로 돌아가기](#question2)

---

# 문제 3. 생성 옵션이 있는 Chat Completions 호출

<a id="question3"></a>

## 문제

OpenAI 공식 클라이언트로 GMS에 채팅 요청을 보내도록 핵심 메서드와 인자를 채우시오.

## 요구사항

- `messages`는 딕셔너리의 리스트이다.
- GPT-5 계열용 최대 출력 길이 인자를 사용한다.
- 첫 번째 응답의 텍스트를 출력한다.

## 제공 코드 또는 스켈레톤

```python
import os
from openai import ______①______

client = ______①______ (
    api_key=os.getenv("GMS_KEY"),
    ______②______="https://gms.ssafy.io/gmsapi/api.openai.com/v1/",
)

response = client.______③______.______④______.create(
    model="gpt-5.4-mini",
    messages=[{"______⑤______": "user", "______⑥______": "AI의 미래를 한 문장으로"}],
    temperature=1.0,
    ______⑦______=500,
)
print(response.______⑧______[0].message.content)
```

[정답으로 이동](#answer3)

---

<a id="answer3"></a>

## 정답

① `OpenAI` ② `base_url` ③ `chat` ④ `completions` ⑤ `role` ⑥ `content` ⑦ `max_completion_tokens` ⑧ `choices`

## 정답 코드

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("GMS_KEY"),
    base_url="https://gms.ssafy.io/gmsapi/api.openai.com/v1/",
)
response = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": "AI의 미래를 한 문장으로"}],
    temperature=1.0,
    max_completion_tokens=500,
)
print(response.choices[0].message.content)
```

## 핵심 해설

- `OpenAI` 클라이언트 → `chat.completions.create` → `choices[0].message.content` 순서다.
- `messages`의 각 원소는 최소 `role`과 `content`를 가진다.
- 출력 길이는 `max_completion_tokens`, 다양성은 `temperature`에서 바꾼다. 실습의 GPT-5 계열에서는 `temperature=1`을 사용한다.

[문제로 돌아가기](#question3)

---

# 문제 4. 엄격한 JSON Schema 응답

<a id="question4"></a>

## 문제

리뷰 목록을 엄격한 JSON으로 받기 위한 스키마와 호출 코드를 완성하시오.

## 요구사항

- 최상위 `reviews`는 배열이다.
- 배열 원소는 `text: string`, `rating: integer`인 객체이다.
- 두 필드를 반드시 포함하고 추가 필드를 금지한다.
- 응답 문자열을 파이썬 객체로 변환한다.

## 제공 코드 또는 스켈레톤

```python
import json

response_format = {
    "type": "______①______",
    "json_schema": {
        "name": "reviews",
        "strict": ______②______,
        "schema": {
            "type": "object",
            "properties": {
                "reviews": {
                    "type": "______③______",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "rating": {"type": "integer"},
                        },
                        "required": ______④______,
                        "additionalProperties": ______⑤______,
                    },
                }
            },
            "required": ["reviews"],
            "additionalProperties": False,
        },
    },
}

response = llm.invoke(
    "상품 리뷰 3개를 생성하세요.",
    ______⑥______=response_format,
)
result = ______⑦______(response.content)
print(result["reviews"])
```

[정답으로 이동](#answer4)

---

<a id="answer4"></a>

## 정답

① `json_schema` ② `True` ③ `array` ④ `["text", "rating"]` ⑤ `False` ⑥ `response_format` ⑦ `json.loads`

## 정답 코드

```python
import json

response_format = {
    "type": "json_schema",
    "json_schema": {
        "name": "reviews",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "reviews": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "rating": {"type": "integer"},
                        },
                        "required": ["text", "rating"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["reviews"],
            "additionalProperties": False,
        },
    },
}
response = llm.invoke("상품 리뷰 3개를 생성하세요.", response_format=response_format)
result = json.loads(response.content)
print(result["reviews"])
```

## 핵심 해설

- `json_schema`와 `strict=True`가 응답 구조를 강제한다.
- `items`가 배열 원소의 구조를 정한다. 필드 추가 시 `properties`와 `required`를 함께 바꾼다.
- 응답은 JSON 문자열이므로 `json.loads` 후에 키로 접근한다.

[문제로 돌아가기](#question4)

---

# 문제 5. 조합별 생성 결과 저장

<a id="question5"></a>

## 문제

모든 페르소나·상품 조합의 리뷰와 생성 조건을 수집하고 JSON 파일에 저장하도록 빈칸을 채우시오.

## 요구사항

- `llm`은 이미 생성되어 있다.
- 결과는 딕셔너리 리스트이다.
- 한글을 그대로 저장한다.

## 제공 코드 또는 스켈레톤

```python
import json

personas = ["대학생", "주부", "은퇴자"]
products = ["노트북", "운동화"]
results = []

for persona in personas:
    for product in products:
        prompt = ______①______"{persona}의 관점에서 {product} 리뷰를 작성하세요."
        review = llm.______②______(prompt).______③______
        results.______④______({
            "persona": persona,
            "product": product,
            "review": review,
        })

with open("synthetic_reviews.json", "w", encoding="utf-8") as f:
    json.______⑤______(
        results,
        f,
        ensure_ascii=______⑥______,
        indent=2,
    )
```

[정답으로 이동](#answer5)

---

<a id="answer5"></a>

## 정답

① `f` ② `invoke` ③ `content` ④ `append` ⑤ `dump` ⑥ `False`

## 정답 코드

```python
import json

personas = ["대학생", "주부", "은퇴자"]
products = ["노트북", "운동화"]
results = []

for persona in personas:
    for product in products:
        prompt = f"{persona}의 관점에서 {product} 리뷰를 작성하세요."
        review = llm.invoke(prompt).content
        results.append({"persona": persona, "product": product, "review": review})

with open("synthetic_reviews.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
```

## 핵심 해설

- 이중 반복문의 각 조합이 프롬프트 값으로 전달되고, `.content`가 결과 딕셔너리의 문자열 값이 된다.
- `append`에는 리뷰뿐 아니라 조건도 함께 담는다.
- `json.dump`는 파일에 쓰는 함수이며, `ensure_ascii=False`가 한글을 보존한다.

[문제로 돌아가기](#question5)

---

# 문제 6. 평가 함수와 임계값 필터

<a id="question6"></a>

## 문제

리뷰를 평가 프롬프트에 넣어 JSON 점수로 변환하고, `total`이 기준 이상인 평가 결과만 남기도록 빈칸을 채우시오.

## 요구사항

- JSON 예시의 중괄호가 `format`의 치환 필드로 해석되지 않아야 한다.
- 반환형은 `dict`이다.
- 빈 입력에서도 통과율 계산 오류가 나지 않아야 한다.

## 제공 코드 또는 스켈레톤

```python
import json

eval_prompt = """리뷰 품질을 1-5점으로 평가하세요.
리뷰: {review_text}
______①______"total": 1, "reason": "근거"______②______"""

def evaluate_review(review_text, llm):
    prompt = eval_prompt.______③______(review_text=review_text)
    response = llm.______④______(prompt)
    return json.______⑤______(response.content)

reviews = ["좋아요.", "배터리가 8시간 지속되어 유용합니다."]
results = [evaluate_review(review, llm) for review in reviews]
threshold = 3.5
filtered = [score for score in results if score["total"] ______⑥______ threshold]
pass_rate = len(filtered) / len(results) * 100 ______⑦______ results ______⑧______ 0.0
print(f"통과율: {pass_rate:.1f}%")
```

[정답으로 이동](#answer6)

---

<a id="answer6"></a>

## 정답

① `{{` ② `}}` ③ `format` ④ `invoke` ⑤ `loads` ⑥ `>=` ⑦ `if` ⑧ `else`

## 정답 코드

```python
import json

eval_prompt = """리뷰 품질을 1-5점으로 평가하세요.
리뷰: {review_text}
{{"total": 1, "reason": "근거"}}"""

def evaluate_review(review_text, llm):
    prompt = eval_prompt.format(review_text=review_text)
    response = llm.invoke(prompt)
    return json.loads(response.content)

reviews = ["좋아요.", "배터리가 8시간 지속되어 유용합니다."]
results = [evaluate_review(review, llm) for review in reviews]
threshold = 3.5
filtered = [score for score in results if score["total"] >= threshold]
pass_rate = len(filtered) / len(results) * 100 if results else 0.0
print(f"통과율: {pass_rate:.1f}%")
```

## 핵심 해설

- `format` → `invoke` → `response.content` → `json.loads` → `total` 비교 순서다.
- `{{`와 `}}`는 포맷 문자열 결과에서 리터럴 `{`와 `}`가 된다.
- 기준 변경은 `threshold`, 평가 항목 변경은 프롬프트의 JSON 형식과 후속 키 접근을 수정한다.

[문제로 돌아가기](#question6)
