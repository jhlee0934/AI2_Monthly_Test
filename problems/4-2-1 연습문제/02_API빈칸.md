# SSAFY AI 월말평가 대비: 함수·메서드 빈칸 문제

각 문제의 코드는 해당 실습에서 준비한 `llm`, `retriever`, `tools`, `agent` 등의 객체가 존재하는 노트북 셀에서 실행하는 것을 전제로 한다. 빈칸에는 식별자뿐 아니라 필요한 인자 표현식도 들어갈 수 있다.

<a id="question1"></a>

## 문제 1. Tool 명세, 바인딩, 메모리

### 문제

정책 검색 함수를 LLM 도구로 만들고, 직접 도구 호출을 확인한 뒤, 같은 대화방의 문맥을 기억하는 Agent를 완성하라.

### 요구사항

- 검색 결과의 본문을 줄바꿈으로 합친다.
- LLM이 도구 호출 여부와 인자를 생성할 수 있게 한다.
- Agent의 상태는 메모리에 저장한다.

### 제공 코드 또는 스켈레톤

```python
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langchain.agents import create_agent

@①
def search_policy(query: str) -> str:
    """고객 서비스 정책을 검색합니다."""
    documents = retriever.②(query)
    return "\n".③(doc.page_content for doc in documents)

tools = [search_policy]
llm_with_tools = llm.④(tools)
probe = llm_with_tools.②("환불 정책이 뭐야?")
print(probe.⑤)

agent = ⑥(
    model=llm,
    tools=tools,
    checkpointer=⑦(),
)
config = {"configurable": {"thread_id": "user-1"}}
result = agent.②({"messages": [("user", "환불 정책을 알려줘")]}, config=config)
print(result["messages"][-1].content)
```

[정답으로 이동](#answer1)

---

<a id="answer1"></a>

## 정답 1

### 정답 코드

```python
@tool
def search_policy(query: str) -> str:
    """고객 서비스 정책을 검색합니다."""
    documents = retriever.invoke(query)
    return "\n".join(doc.page_content for doc in documents)

tools = [search_policy]
llm_with_tools = llm.bind_tools(tools)
probe = llm_with_tools.invoke("환불 정책이 뭐야?")
print(probe.tool_calls)

agent = create_agent(model=llm, tools=tools, checkpointer=MemorySaver())
config = {"configurable": {"thread_id": "user-1"}}
result = agent.invoke(
    {"messages": [("user", "환불 정책을 알려줘")]}, config=config
)
print(result["messages"][-1].content)
```

### 핵심 해설

- `retriever.invoke(str)`의 출력은 `Document` 리스트이며 각 본문은 `page_content`에 있다.
- `bind_tools`의 출력은 도구 스키마를 아는 Runnable이고, 응답 `AIMessage.tool_calls`에는 `name`, `args`, `id`, `type`이 담긴다.
- `create_agent`는 도구 판단과 실행 반복을 조립한다. `MemorySaver`와 `configurable.thread_id`가 함께 있어야 호출 사이 문맥이 이어진다.
- 검색량은 retriever 생성 시 `search_kwargs={"k": ...}`, 도구 설명은 docstring, 대화 분리는 `thread_id`를 바꾼다.

[문제로 돌아가기](#question1)

---

<a id="question2"></a>

## 문제 2. StateGraph 조건부 라우팅

### 문제

LLM이 도구를 요청하는 동안 `agent → tools → agent`를 반복하는 ReAct 그래프를 완성하라.

### 제공 코드 또는 스켈레톤

```python
from langgraph.graph import MessagesState, StateGraph, START, END
from langgraph.prebuilt import ToolNode

def call_model(state):
    response = llm_with_tools.①(state["messages"])
    return {"messages": ②}

def should_continue(state):
    last_message = state["messages"][③]
    return ④ if last_message.tool_calls else ⑤

graph = ⑥(MessagesState)
graph.⑦("agent", call_model)
graph.⑦("tools", ⑧(tools))
graph.⑨(START, "agent")
graph.⑩("agent", should_continue)
graph.⑨("tools", ⑪)
app = graph.⑫()
```

[정답으로 이동](#answer2)

---

<a id="answer2"></a>

## 정답 2

### 정답 코드

```python
def call_model(state):
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state):
    last_message = state["messages"][-1]
    return "tools" if last_message.tool_calls else END

graph = StateGraph(MessagesState)
graph.add_node("agent", call_model)
graph.add_node("tools", ToolNode(tools))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")
app = graph.compile()
```

### 핵심 해설

- 노드의 입력과 출력은 모두 상태 조각이다. `{"messages": [response]}`의 리스트가 기존 메시지에 병합된다.
- 분기 함수의 문자열 `"tools"`는 등록한 노드 이름과 일치해야 한다.
- `ToolNode`는 `AIMessage.tool_calls`의 `args` 딕셔너리를 실제 함수 인자로 넘기고 `ToolMessage`를 만든다.
- ⑪을 `END`로 바꾸면 Direct 패턴이 되어 도구 실행 뒤 LLM의 최종 답변 생성 단계가 사라진다.

[문제로 돌아가기](#question2)

---

<a id="question3"></a>

## 문제 3. 자연어 결론 추출과 Agent 평가

### 문제

승인과 거부 표현의 마지막 등장 위치로 결론을 정규화하고 테스트 정확도를 계산하라.

### 제공 코드 또는 스켈레톤

```python
import re

def extract_refund_statuses(response: str) -> list:
    approved_pattern = r"환불.*승인|승인.*환불|환불.*가능|환불.*처리|환불.*진행"
    denied_pattern = r"환불.*거부|거부.*환불|환불.*불가|환불.*어렵|환불할 수 없"
    approved = list(re.①(approved_pattern, response))
    denied = list(re.①(denied_pattern, response))
    if approved and not denied:
        return ["approved"]
    if denied and not approved:
        return ["denied"]
    if approved and denied:
        return ["approved"] if approved[-1].②() > denied[-1].②() else ["denied"]
    return []

def evaluate_agent(agent, test_cases):
    correct = 0
    for idx, case in enumerate(test_cases):
        config = {"configurable": {"thread_id": ③}}
        result = agent.④({"messages": [case["input"]]}, config=config)
        actual = extract_refund_statuses(result["messages"][⑤].content)
        correct += int(actual ⑥ case["expected"])
    return correct ⑦ len(test_cases)
```

[정답으로 이동](#answer3)

---

<a id="answer3"></a>

## 정답 3

### 정답 코드

```python
def extract_refund_statuses(response: str) -> list:
    approved_pattern = r"환불.*승인|승인.*환불|환불.*가능|환불.*처리|환불.*진행"
    denied_pattern = r"환불.*거부|거부.*환불|환불.*불가|환불.*어렵|환불할 수 없"
    approved = list(re.finditer(approved_pattern, response))
    denied = list(re.finditer(denied_pattern, response))
    if approved and not denied:
        return ["approved"]
    if denied and not approved:
        return ["denied"]
    if approved and denied:
        return ["approved"] if approved[-1].start() > denied[-1].start() else ["denied"]
    return []

def evaluate_agent(agent, test_cases):
    correct = 0
    for idx, case in enumerate(test_cases):
        config = {"configurable": {"thread_id": f"eval_{idx}"}}
        result = agent.invoke({"messages": [case["input"]]}, config=config)
        actual = extract_refund_statuses(result["messages"][-1].content)
        correct += int(actual == case["expected"])
    return correct / len(test_cases)
```

### 핵심 해설

- `finditer`는 문자열 자체가 아니라 위치 정보를 가진 Match 반복자를 제공한다. 리스트로 만든 뒤 마지막 Match의 `start()`를 비교한다.
- 평가 입력 형식은 `{"input": str, "expected": list[str]}`이다. 실제값과 기대값의 컨테이너 형식까지 같아야 한다.
- 케이스별 스레드를 분리해 체크포인터에 남은 앞선 대화가 평가에 섞이지 않게 한다.
- 케이스가 비어 있을 수 있다면 ⑦ 전에 별도 검증을 추가해야 0으로 나누는 오류를 피할 수 있다.

[문제로 돌아가기](#question3)

---

<a id="question4"></a>

## 문제 4. 정책 강제형 Safety Tool

### 문제

금액 한도와 주문 상태를 코드 수준에서 강제하는 함수를 완성하라.

### 제공 코드 또는 스켈레톤

```python
MAX_COUPON_AMOUNT = 20000
orders_db = {
    "ORD001": {"status": "배송 지연", "product": "노트북"},
    "ORD002": {"status": "배송 완료", "product": "키보드"},
}

def issue_coupon_safe(order_id: str, amount: int) -> str:
    if amount ① MAX_COUPON_AMOUNT:
        return "발급 불가: 금액 한도 초과"
    if order_id ② orders_db:
        return "발급 불가: 주문 없음"
    status = orders_db[order_id].③
    if status ④ "배송 지연":
        return "발급 불가: 배송 지연 주문이 아님"
    return ⑤
```

[정답으로 이동](#answer4)

---

<a id="answer4"></a>

## 정답 4

### 정답 코드

```python
def issue_coupon_safe(order_id: str, amount: int) -> str:
    if amount > MAX_COUPON_AMOUNT:
        return "발급 불가: 금액 한도 초과"
    if order_id not in orders_db:
        return "발급 불가: 주문 없음"
    status = orders_db[order_id]["status"]
    if status != "배송 지연":
        return "발급 불가: 배송 지연 주문이 아님"
    return f"{order_id}의 {amount}원 쿠폰 발급 완료"
```

### 핵심 해설

- `orders_db`는 `dict[str, dict[str, str]]` 형식이며 내부 딕셔너리에서 `"status"`를 읽는다.
- 주문 존재 확인이 상태 조회보다 앞서야 한다. 각 실패 조건은 조기 반환되어 실제 실행 경로에 도달하지 않는다.
- 정책이 배송 지연 10,000원, 상품 불량 20,000원처럼 상태별로 달라지면 단일 상수 비교를 상태별 한도 매핑 블록으로 교체해야 한다.

[문제로 돌아가기](#question4)

---

<a id="question5"></a>

## 문제 5. 가드레일과 통합 실행기

### 문제

입력 차단, Agent 실행, 출력 마스킹을 수행하는 코드를 완성하라.

### 제공 코드 또는 스켈레톤

```python
import re

BLOCKED_KEYWORDS = ["해킹", "비밀번호", "탈취", "시스템 접근"]
SENSITIVE_KEYWORDS = ["주민등록번호", "계좌번호", "카드번호"]
SENSITIVE_REGEX = [r"\d{6}-\d{7}", r"\d{4}-\d{4}-\d{4}-\d{4}"]

def is_harmful_input(user_input: str) -> bool:
    return ①(keyword in user_input for keyword in BLOCKED_KEYWORDS)

def filter_output(output: str) -> str:
    filtered = output
    for keyword in SENSITIVE_KEYWORDS:
        filtered = filtered.②(keyword, "[민감정보 필터링됨]")
    for pattern in SENSITIVE_REGEX:
        filtered = re.③(pattern, "[민감정보 필터링됨]", filtered)
    return filtered

class TrustedAgentExecutor:
    def __init__(self, agent):
        self.agent = agent

    def run(self, user_input: str, config=None) -> str:
        if ④(user_input):
            return "해당 요청은 처리할 수 없습니다."
        try:
            result = self.agent.⑤(
                {"messages": [("user", user_input)]}, config=config
            )
            output = result["messages"][⑥].content
        except Exception:
            return "처리 중 오류가 발생했습니다."
        return ⑦(output)
```

[정답으로 이동](#answer5)

---

<a id="answer5"></a>

## 정답 5

### 정답 코드

```python
def is_harmful_input(user_input: str) -> bool:
    return any(keyword in user_input for keyword in BLOCKED_KEYWORDS)

def filter_output(output: str) -> str:
    filtered = output
    for keyword in SENSITIVE_KEYWORDS:
        filtered = filtered.replace(keyword, "[민감정보 필터링됨]")
    for pattern in SENSITIVE_REGEX:
        filtered = re.sub(pattern, "[민감정보 필터링됨]", filtered)
    return filtered

class TrustedAgentExecutor:
    def __init__(self, agent):
        self.agent = agent

    def run(self, user_input: str, config=None) -> str:
        if is_harmful_input(user_input):
            return "해당 요청은 처리할 수 없습니다."
        try:
            result = self.agent.invoke(
                {"messages": [("user", user_input)]}, config=config
            )
            output = result["messages"][-1].content
        except Exception:
            return "처리 중 오류가 발생했습니다."
        return filter_output(output)
```

### 핵심 해설

- `any`는 한 키워드라도 포함되면 즉시 `True`가 된다. 이 결과가 참이면 Agent 입력 자체가 전달되지 않는다.
- 일반 단어는 `str.replace`, 형식이 있는 번호는 `re.sub(pattern, replacement, text)`로 가린다.
- Agent 상태의 `messages`는 리스트이며 마지막 AI 응답의 `content`만 출력 필터로 전달한다.
- 필터링 대상이 이메일·전화번호로 확대되면 `SENSITIVE_REGEX`, 의미 기반 공격 탐지가 필요하면 `is_harmful_input` 블록을 바꾼다.

[문제로 돌아가기](#question5)
