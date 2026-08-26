# 함수·메서드 빈칸 문제

공통 전제: `llm`은 실습과 동일하게 `ChatOpenAI`로 초기화되어 있다. 각 문항의 빈칸은 서로 독립적이다.

<a id="question1"></a>

## 문제 1. Planner–Worker Reflection API

## 문제

다음 완성 코드의 빈칸 ①~⑩을 채워 실행 가능한 반복 그래프를 완성하라.

## 요구사항

- `results`는 노드가 반환한 새 리스트를 기존 리스트에 누적한다.
- 최근 결과만 평가한다.
- 결과가 2개 이상이거나 개선이 필요 없으면 종료한다.
- 순환 오류에 대비해 최대 그래프 스텝을 10으로 제한한다.

## 제공 코드 또는 스켈레톤

```python
import operator
from typing import Annotated, List, TypedDict
from langgraph.graph import StateGraph, START, END

class AgentState(TypedDict):
    task: str
    plan: str
    results: ①[List[str], ②]
    reflection: str

def planner(state: AgentState):
    response = llm.③(f"3단계 계획을 세우세요: {state['task']}")
    return {"plan": response.④}

def worker(state: AgentState):
    result = llm.invoke(f"계획을 실행하세요: {state['plan']}").content
    return {"results": ⑤}

def reflection(state: AgentState):
    result = state["results"][⑥]
    review = llm.invoke(f"결과를 평가하고 부족하면 '개선'을 포함하세요: {result}").content
    return {"reflection": review}

def route(state: AgentState):
    if len(state["results"]) >= 2:
        return "end"
    return "planner" if "개선" in state["reflection"] else "end"

graph = ⑦(AgentState)
graph.add_node("planner", planner)
graph.add_node("worker", worker)
graph.add_node("reflection", reflection)
graph.add_edge(⑧, "planner")
graph.add_edge("planner", "worker")
graph.add_edge("worker", "reflection")
graph.⑨("reflection", route, {"planner": "planner", "end": END})

app = graph.compile()
result = app.invoke(
    {"task": "고객 불만 보고서 작성", "results": []},
    ⑩,
)
```

[정답으로 이동](#answer1)

---

<a id="answer1"></a>

## 정답

① `Annotated` / ② `operator.add` / ③ `invoke` / ④ `content` / ⑤ `[result]` / ⑥ `-1` / ⑦ `StateGraph` / ⑧ `START` / ⑨ `add_conditional_edges` / ⑩ `config={"recursion_limit": 10}`

## 정답 코드

```python
import operator
from typing import Annotated, List, TypedDict
from langgraph.graph import END, START, StateGraph

class AgentState(TypedDict):
    task: str
    plan: str
    results: Annotated[List[str], operator.add]
    reflection: str

def planner(state: AgentState):
    response = llm.invoke(f"3단계 계획을 세우세요: {state['task']}")
    return {"plan": response.content}

def worker(state: AgentState):
    result = llm.invoke(f"계획을 실행하세요: {state['plan']}").content
    return {"results": [result]}

def reflection(state: AgentState):
    result = state["results"][-1]
    review = llm.invoke(f"결과를 평가하고 부족하면 '개선'을 포함하세요: {result}").content
    return {"reflection": review}

def route(state: AgentState):
    if len(state["results"]) >= 2:
        return "end"
    return "planner" if "개선" in state["reflection"] else "end"

graph = StateGraph(AgentState)
graph.add_node("planner", planner)
graph.add_node("worker", worker)
graph.add_node("reflection", reflection)
graph.add_edge(START, "planner")
graph.add_edge("planner", "worker")
graph.add_edge("worker", "reflection")
graph.add_conditional_edges("reflection", route, {"planner": "planner", "end": END})
app = graph.compile()
result = app.invoke(
    {"task": "고객 불만 보고서 작성", "results": []},
    config={"recursion_limit": 10},
)
print(result)
```

## 핵심 해설

- `invoke()`의 반환 객체에서 생성 텍스트는 `.content`로 꺼낸다.
- reducer가 리스트 결합을 수행하므로 Worker 출력도 리스트여야 한다.
- `results[-1]`은 반복 중 가장 최근 실행 결과다.
- 조건 변경 시 `route()`, 반복 안전 한도 변경 시 `invoke()`의 `config`를 수정한다.

[문제로 돌아가기](#question1)

---

<a id="question2"></a>

## 문제 2. Supervisor 병렬 분기 API

## 문제

빈칸 ①~⑨를 채워 조사와 분석을 병렬 실행하고 결과를 종합하라.

## 요구사항

- 두 Worker가 같은 스텝에서 실행되어야 한다.
- 두 결과는 덮어쓰지 않고 `worker_results`에 누적되어야 한다.
- 결과가 모이면 Supervisor를 다시 거쳐 종합 노드에서 종료해야 한다.

## 제공 코드 또는 스켈레톤

```python
class SupervisorState(TypedDict):
    task: str
    worker_results: Annotated[List[str], ①]
    next_action: str
    final_output: str

def supervisor(state: SupervisorState):
    action = "distribute" if not state.②("worker_results") else "synthesize"
    return {"next_action": action}

def research(state: SupervisorState):
    text = llm.invoke(f"조사: {state['task']}").content
    return {"worker_results": ③}

def analysis(state: SupervisorState):
    text = llm.invoke(f"분석: {state['task']}").content
    return {"worker_results": [f"[분석] {text}"]}

def synthesize(state: SupervisorState):
    combined = ④.join(state["worker_results"])
    return {"final_output": llm.invoke(f"종합:\n{combined}").content}

def route(state: SupervisorState):
    if state["next_action"] == "distribute":
        return ⑤
    return ⑥

graph = StateGraph(SupervisorState)
graph.add_node("supervisor", supervisor)
graph.add_node("research", research)
graph.add_node("analysis", analysis)
graph.add_node("synthesize", synthesize)
graph.add_edge(START, "supervisor")
graph.⑦("supervisor", route)
graph.add_edge("research", ⑧)
graph.add_edge("analysis", ⑧)
graph.add_edge("synthesize", ⑨)
```

[정답으로 이동](#answer2)

---

<a id="answer2"></a>

## 정답

① `operator.add` / ② `get` / ③ `[f"[조사] {text}"]` / ④ `"\n"` / ⑤ `["research", "analysis"]` / ⑥ `"synthesize"` / ⑦ `add_conditional_edges` / ⑧ `"supervisor"` / ⑨ `END`

## 정답 코드

```python
import operator
from typing import Annotated, List, TypedDict
from langgraph.graph import END, START, StateGraph

class SupervisorState(TypedDict):
    task: str
    worker_results: Annotated[List[str], operator.add]
    next_action: str
    final_output: str

def supervisor(state: SupervisorState):
    action = "distribute" if not state.get("worker_results") else "synthesize"
    return {"next_action": action}

def research(state: SupervisorState):
    text = llm.invoke(f"조사: {state['task']}").content
    return {"worker_results": [f"[조사] {text}"]}

def analysis(state: SupervisorState):
    text = llm.invoke(f"분석: {state['task']}").content
    return {"worker_results": [f"[분석] {text}"]}

def synthesize(state: SupervisorState):
    combined = "\n".join(state["worker_results"])
    return {"final_output": llm.invoke(f"종합:\n{combined}").content}

def route(state: SupervisorState):
    if state["next_action"] == "distribute":
        return ["research", "analysis"]
    return "synthesize"

graph = StateGraph(SupervisorState)
graph.add_node("supervisor", supervisor)
graph.add_node("research", research)
graph.add_node("analysis", analysis)
graph.add_node("synthesize", synthesize)
graph.add_edge(START, "supervisor")
graph.add_conditional_edges("supervisor", route)
graph.add_edge("research", "supervisor")
graph.add_edge("analysis", "supervisor")
graph.add_edge("synthesize", END)
app = graph.compile()
print(app.invoke({"task": "AI 시장 동향", "worker_results": []})["final_output"])
```

## 핵심 해설

- 분기 함수의 리스트 반환은 여러 목적지로의 Fan-out을 뜻한다.
- 두 병렬 노드가 같은 상태 키를 갱신하므로 `operator.add` reducer가 필요하다.
- Worker 완료 엣지를 모두 Supervisor로 연결하면 결과가 모인 뒤 다음 결정을 수행한다.
- Worker 추가 시 분기 리스트, 노드 등록, 복귀 엣지를 모두 추가해야 한다.

[문제로 돌아가기](#question2)

---

<a id="question3"></a>

## 문제 3. JSON 평가 응답 파싱 API

## 문제

LLM이 순수 JSON 또는 Markdown JSON 코드 블록을 반환할 수 있다. 빈칸을 채워 두 경우를 모두 처리하라.

## 요구사항

- 코드 블록 내부 JSON을 우선 사용한다.
- Planner, Worker, Overall 점수를 합산한다.
- 형식 오류가 발생해도 동일한 최상위 반환 키를 유지한다.

## 제공 코드 또는 스켈레톤

```python
import json, re

def parse_evaluation(content: str) -> dict:
    try:
        match = re.①(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
        if match:
            json_str = match.②
        else:
            match = re.search(r"\{[\s\S]*\}", content)
            json_str = match.③ if match else content

        parsed = json.④(json_str)
        total = ⑤
        return {
            "score": total,
            "feedback": parsed[⑥],
            "details": {
                "planner": parsed["planner_score"],
                "worker": parsed["worker_score"],
                "overall": parsed["overall_score"],
            },
        }
    except ⑦ as error:
        return {"score": 0, "feedback": f"평가 실패: {error}\n원본 응답: {content}", "details": {}}
```

[정답으로 이동](#answer3)

---

<a id="answer3"></a>

## 정답

① `search` / ② `group(1)` / ③ `group(0)` / ④ `loads` / ⑤ `parsed["planner_score"] + parsed["worker_score"] + parsed["overall_score"]` / ⑥ `"feedback"` / ⑦ `Exception`

## 정답 코드

```python
import json
import re

def parse_evaluation(content: str) -> dict:
    try:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
        if match:
            json_str = match.group(1)
        else:
            match = re.search(r"\{[\s\S]*\}", content)
            json_str = match.group(0) if match else content
        parsed = json.loads(json_str)
        total = (
            parsed["planner_score"]
            + parsed["worker_score"]
            + parsed["overall_score"]
        )
        return {
            "score": total,
            "feedback": parsed["feedback"],
            "details": {
                "planner": parsed["planner_score"],
                "worker": parsed["worker_score"],
                "overall": parsed["overall_score"],
            },
        }
    except Exception as error:
        return {
            "score": 0,
            "feedback": f"평가 실패: {error}\n원본 응답: {content}",
            "details": {},
        }

sample = '```json\n{"planner_score": 28, "worker_score": 37, "overall_score": 29, "feedback": "좋음"}\n```'
print(parse_evaluation(sample))
```

## 핵심 해설

- 코드 블록 패턴의 첫 캡처 그룹은 펜스 내부이고, 중괄호 패턴의 전체 매치는 `group(0)`이다.
- `json.loads()`는 JSON 문자열을 Python 딕셔너리로 변환한다.
- 반환 딕셔너리는 성공과 실패 모두 `score`, `feedback`, `details` 키를 유지한다.
- 평가 키나 배점 구조가 바뀌면 프롬프트뿐 아니라 합산식과 세부 매핑도 바꿔야 한다.

[문제로 돌아가기](#question3)
