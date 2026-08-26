# 02. 함수·메서드 빈칸 문제

각 문제의 `①`과 같은 표시는 하나의 클래스·함수·메서드·인자 또는 값이다. 같은 번호가 반복되면 같은 답을 넣는다.

<a id="question-1"></a>

## 문제 1. LLM 메시지 호출

### 문제

코드의 빈칸을 채워 응답 본문을 출력하라.

### 요구사항

- SSAFY GMS와 `gpt-5-nano`를 사용한다.
- 사용자 발화를 LangChain 메시지 객체로 전달한다.

### 제공 코드 또는 스켈레톤

```python
llm = ①(model="gpt-5-nano", api_key=os.environ["GMS_KEY"], ②=GMS_URL)
response = llm.③([④(content="안녕하세요")])
print(response.⑤)
```

[정답으로 이동](#answer-1)

---

<a id="question-2"></a>

## 문제 2. PDF 로딩과 프롬프트 체인

### 문제

PDF 페이지의 텍스트를 근거로 답하도록 빈칸을 채워라.

### 제공 코드 또는 스켈레톤

```python
documents = ①(PDF_PATH).②()
context = "\n".join(doc.③ for doc in documents)
prompt = ④.⑤("자료: {context}\n질문: {question}")
response = (prompt ⑥ llm).⑦({"context": context, "question": "혜택은?"})
print(response.content)
```

[정답으로 이동](#answer-2)

---

<a id="question-3"></a>

## 문제 3. Document 키워드 검색

### 문제

`Document`의 본문에서 정확한 문자열을 찾고 출처를 안전하게 출력하도록 채워라.

### 제공 코드 또는 스켈레톤

```python
def keyword_search(documents, keyword):
    return [doc for doc in documents if keyword in doc.①]

for doc in keyword_search(all_documents, "총알배송"):
    print(doc.②.③("source_file", "알 수 없음"), doc.①[:50])
```

[정답으로 이동](#answer-3)

---

<a id="question-4"></a>

## 문제 4. 임베딩·Chroma 검색기

### 문제

질문과 의미가 가까운 문서 3개를 반환하도록 채워라.

### 제공 코드 또는 스켈레톤

```python
embeddings = ①(model="text-embedding-3-small", api_key=KEY, base_url=GMS_URL)
query_vector = embeddings.②("빠른 배송 서비스")
vectorstore = ③.④(documents=all_documents, embedding=embeddings)
retriever = vectorstore.⑤(⑥={"k": 3})
results = retriever.⑦("배송 혜택은?")
```

[정답으로 이동](#answer-4)

---

<a id="question-5"></a>

## 문제 5. 재귀적 텍스트 분할

### 문제

페이지 문서를 500자 단위, 50자 겹침으로 분할하도록 채워라.

### 제공 코드 또는 스켈레톤

```python
splitter = ①(
    ②=500,
    ③=50,
    ④=["\n\n", "\n", ".", " "]
)
chunks = splitter.⑤(all_documents)
vectorstore = Chroma.from_documents(⑥, embeddings)
```

[정답으로 이동](#answer-5)

---

<a id="question-6"></a>

## 문제 6. 상태 그래프 조립

### 문제

두 노드가 상태를 순서대로 갱신하도록 채워라.

### 제공 코드 또는 스켈레톤

```python
class RAGState(①):
    question: str
    context: ②[Document]
    answer: str

graph = ③(RAGState)
graph.④("retrieve", retrieve)
graph.④("generate", generate)
graph.⑤(⑥, "retrieve")
graph.⑤("retrieve", "generate")
graph.⑤("generate", ⑦)
app = graph.⑧()
result = app.⑨({"question": "총알배송 혜택은?"})
```

[정답으로 이동](#answer-6)

---

<a id="answer-1"></a>

## 정답 1

### 정답 코드

```python
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

GMS_URL = "https://gms.ssafy.io/gmsapi/api.openai.com/v1/"
llm = ChatOpenAI(model="gpt-5-nano", api_key=os.environ["GMS_KEY"], base_url=GMS_URL)
response = llm.invoke([HumanMessage(content="안녕하세요")])
print(response.content)
```

### 핵심 해설

- ① `ChatOpenAI`, ② `base_url`, ③ `invoke`, ④ `HumanMessage`, ⑤ `content`.
- 메시지 리스트가 `invoke`의 입력이고 반환된 `AIMessage.content`가 답변 문자열이다. 모델·서버·질문 조건은 각각 초기화 인자와 메시지 생성 블록에서 바꾼다.

[문제로 돌아가기](#question-1)

---

<a id="answer-2"></a>

## 정답 2

### 정답 코드

```python
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_core.prompts import ChatPromptTemplate

documents = PyMuPDFLoader(PDF_PATH).load()
context = "\n".join(doc.page_content for doc in documents)
prompt = ChatPromptTemplate.from_template("자료: {context}\n질문: {question}")
response = (prompt | llm).invoke({"context": context, "question": "혜택은?"})
print(response.content)
```

### 핵심 해설

- ① `PyMuPDFLoader`, ② `load`, ③ `page_content`, ④ `ChatPromptTemplate`, ⑤ `from_template`, ⑥ `|`, ⑦ `invoke`.
- `load()`의 출력은 `Document` 리스트다. 체인 입력 딕셔너리 키는 템플릿 플레이스홀더와 정확히 일치해야 한다.

[문제로 돌아가기](#question-2)

---

<a id="answer-3"></a>

## 정답 3

### 정답 코드

```python
def keyword_search(documents, keyword):
    return [doc for doc in documents if keyword in doc.page_content]

for doc in keyword_search(all_documents, "총알배송"):
    print(doc.metadata.get("source_file", "알 수 없음"), doc.page_content[:50])
```

### 핵심 해설

- ① `page_content`, ② `metadata`, ③ `get`.
- `metadata`는 딕셔너리이므로 `get`을 쓰면 키가 없는 로더에서도 오류가 나지 않는다. 부분 문자열이 아닌 의미 검색이 필요하면 함수 전체를 retriever 호출로 교체한다.

[문제로 돌아가기](#question-3)

---

<a id="answer-4"></a>

## 정답 4

### 정답 코드

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=KEY, base_url=GMS_URL)
query_vector = embeddings.embed_query("빠른 배송 서비스")
vectorstore = Chroma.from_documents(documents=all_documents, embedding=embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
results = retriever.invoke("배송 혜택은?")
```

### 핵심 해설

- ① `OpenAIEmbeddings`, ② `embed_query`, ③ `Chroma`, ④ `from_documents`, ⑤ `as_retriever`, ⑥ `search_kwargs`, ⑦ `invoke`.
- `embed_query`는 실수 리스트, retriever의 `invoke`는 `List[Document]`를 반환한다. 반환 수는 `search_kwargs["k"]`에서 변경한다.

[문제로 돌아가기](#question-4)

---

<a id="answer-5"></a>

## 정답 5

### 정답 코드

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500, chunk_overlap=50,
    separators=["\n\n", "\n", ".", " "]
)
chunks = splitter.split_documents(all_documents)
vectorstore = Chroma.from_documents(chunks, embeddings)
```

### 핵심 해설

- ① `RecursiveCharacterTextSplitter`, ② `chunk_size`, ③ `chunk_overlap`, ④ `separators`, ⑤ `split_documents`, ⑥ `chunks`.
- 분할 결과의 메타데이터는 유지된다. 크기·겹침·경계 조건 변경은 splitter 인자를 수정하고 Chroma를 다시 만든다.

[문제로 돌아가기](#question-5)

---

<a id="answer-6"></a>

## 정답 6

### 정답 코드

```python
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END

class RAGState(TypedDict):
    question: str
    context: List[Document]
    answer: str

graph = StateGraph(RAGState)
graph.add_node("retrieve", retrieve)
graph.add_node("generate", generate)
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", "generate")
graph.add_edge("generate", END)
app = graph.compile()
result = app.invoke({"question": "총알배송 혜택은?"})
```

### 핵심 해설

- ① `TypedDict`, ② `List`, ③ `StateGraph`, ④ `add_node`, ⑤ `add_edge`, ⑥ `START`, ⑦ `END`, ⑧ `compile`, ⑨ `invoke`.
- 초기 딕셔너리에는 질문이 들어가고 노드 반환 딕셔너리가 `context`, `answer`를 차례로 채운다. 분기나 순서를 바꾸려면 엣지 블록을 수정한다.

[문제로 돌아가기](#question-6)
