# 02. 함수·메서드 빈칸 문제

각 문제는 핵심 API의 입력·출력 관계를 묻는다. 모든 `①`~`⑤`를 채워 완성하라.

<a id="question1"></a>

## 문제 1. BPE와 WordPiece API

## 요구사항

- BPE 쌍 빈도는 단어 빈도로 가중한다.
- 문자열 시작/끝 또는 공백으로 구분된 토큰만 병합한다.
- 학습 후 토큰과 ID를 모두 출력한다.

## 제공 코드 또는 스켈레톤

```python
import re
from tokenizers import BertWordPieceTokenizer

def get_stats(vocab):
    pairs = {}
    for word, freq in vocab.items():
        symbols = word.①()
        for i in range(len(symbols) - 1):
            pair = (symbols[i], symbols[i + 1])
            pairs[pair] = pairs.②(pair, 0) + freq
    return pairs

def merge_vocab(pair, vocab):
    pattern = re.compile(r"(?<!\S)" + re.③(" ".join(pair)) + r"(?!\S)")
    return {pattern.sub("".join(pair), w): f for w, f in vocab.items()}

tokenizer = BertWordPieceTokenizer(lowercase=False, strip_accents=False)
tokenizer.④(
    files=["naver_review.txt"], vocab_size=30000, min_frequency=2,
    limit_alphabet=6000,
    special_tokens=["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"],
    wordpieces_prefix="##",
)
encoded = tokenizer.⑤("이 영화 정말 재미있었어요")
print(encoded.tokens, encoded.ids)
```

[정답으로 이동](#answer1)

---

<a id="answer1"></a>

## 정답 1

## 정답 코드

```python
import re
from tokenizers import BertWordPieceTokenizer

def get_stats(vocab):
    pairs = {}
    for word, freq in vocab.items():
        symbols = word.split()
        for i in range(len(symbols) - 1):
            pair = (symbols[i], symbols[i + 1])
            pairs[pair] = pairs.get(pair, 0) + freq
    return pairs

def merge_vocab(pair, vocab):
    pattern = re.compile(r"(?<!\S)" + re.escape(" ".join(pair)) + r"(?!\S)")
    return {pattern.sub("".join(pair), w): f for w, f in vocab.items()}

tokenizer = BertWordPieceTokenizer(lowercase=False, strip_accents=False)
tokenizer.train(
    files=["naver_review.txt"], vocab_size=30000, min_frequency=2,
    limit_alphabet=6000,
    special_tokens=["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"],
    wordpieces_prefix="##",
)
encoded = tokenizer.encode("이 영화 정말 재미있었어요")
print(encoded.tokens, encoded.ids)
```

## 핵심 해설

- 정답은 ① `split`, ② `get`, ③ `escape`, ④ `train`, ⑤ `encode`이다.
- `train(files=...)`의 입력은 말뭉치 경로 리스트이고, `encode`의 출력 객체는 `.tokens`, `.ids`를 제공한다.
- 대소문자 정규화 조건을 바꾸면 생성 시의 `lowercase`를 수정하고, 저장 사전을 다시 사용할 때도 같은 값을 유지한다.

[문제로 돌아가기](#question1)

---

<a id="question2"></a>

## 문제 2. Dataset·DataLoader·RNN API

## 요구사항

- 가변 길이 ID를 배치 최장 길이에 맞춰 0으로 패딩한다.
- 모델은 마지막 RNN 은닉 상태로 이진 로짓 하나를 만든다.

## 제공 코드 또는 스켈레톤

```python
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader

def collate_fn(batch):
    ids_list, labels = ①(*batch)
    max_len = max(②(ids) for ids in ids_list)
    padded = [ids + [0] * (max_len - len(ids)) for ids in ids_list]
    return torch.③(padded, dtype=torch.long), torch.tensor(labels)

class RNNClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embedding = nn.④(vocab_size, embed_dim, padding_idx=0)
        self.rnn = nn.RNN(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, 1)

    def forward(self, x):
        _, hidden = self.rnn(self.embedding(x))
        return self.fc(hidden[-1]).⑤(-1)
```

[정답으로 이동](#answer2)

---

<a id="answer2"></a>

## 정답 2

## 정답 코드

```python
import torch
from torch import nn

def collate_fn(batch):
    ids_list, labels = zip(*batch)
    max_len = max(len(ids) for ids in ids_list)
    padded = [ids + [0] * (max_len - len(ids)) for ids in ids_list]
    return torch.tensor(padded, dtype=torch.long), torch.tensor(labels)

class RNNClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.rnn = nn.RNN(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, 1)

    def forward(self, x):
        _, hidden = self.rnn(self.embedding(x))
        return self.fc(hidden[-1]).squeeze(-1)

ids, labels = collate_fn([([2, 4, 3], 1), ([2, 3], 0)])
print(ids, labels, RNNClassifier(10, 8, 16)(ids).shape)
```

## 핵심 해설

- 정답은 ① `zip`, ② `len`, ③ `tensor`, ④ `Embedding`, ⑤ `squeeze`이다.
- `zip(*batch)`는 `[(ids,label), ...]`를 ID 묶음과 레이블 묶음으로 전치한다.
- 출력 shape는 `(B,)`라서 `(B,)`인 BCE 레이블과 일치한다. 다중 분류면 FC 출력을 클래스 수로 바꾸고 squeeze를 제거한다.

[문제로 돌아가기](#question2)

---

<a id="question3"></a>

## 문제 3. LSTM과 Luong Attention API

## 요구사항

- 점곱 score, 길이 축 softmax, value 가중합을 배치 행렬곱으로 구현한다.
- 마지막 LSTM 층의 은닉 상태를 query로 사용한다.

## 제공 코드 또는 스켈레톤

```python
class LuongAttention(nn.Module):
    def forward(self, query, values):
        scores = torch.①(values, query.unsqueeze(2)).squeeze(2)
        weights = torch.②(scores, dim=1)
        context = torch.bmm(weights.③(1), values).squeeze(1)
        return context, weights

outputs, (hidden, cell) = lstm(embedded)
query = hidden[④]
context, weights = attention(query, outputs)
features = torch.⑤([query, context], dim=-1)
```

[정답으로 이동](#answer3)

---

<a id="answer3"></a>

## 정답 3

## 정답 코드

```python
import torch
from torch import nn

class LuongAttention(nn.Module):
    def forward(self, query, values):
        scores = torch.bmm(values, query.unsqueeze(2)).squeeze(2)
        weights = torch.softmax(scores, dim=1)
        context = torch.bmm(weights.unsqueeze(1), values).squeeze(1)
        return context, weights

lstm = nn.LSTM(8, 16, batch_first=True)
attention = LuongAttention()
embedded = torch.randn(4, 7, 8)
outputs, (hidden, cell) = lstm(embedded)
query = hidden[-1]
context, weights = attention(query, outputs)
features = torch.cat([query, context], dim=-1)
print(features.shape, weights.sum(dim=1))
```

## 핵심 해설

- 정답은 ① `bmm`, ② `softmax`, ③ `unsqueeze`, ④ `-1`, ⑤ `cat`이다.
- `(B,L,H) @ (B,H,1)`은 `(B,L,1)` score를 만든다. 가중합은 `(B,1,L) @ (B,L,H)`이다.
- Attention mask를 추가할 때는 `softmax` 직전의 `scores`를 수정한다.

[문제로 돌아가기](#question3)

---

<a id="question4"></a>

## 문제 4. Hugging Face 직접 추론 API

## 요구사항

- 자동 클래스 API로 토크나이저와 분류 모델을 로드한다.
- 토크나이저 반환 딕셔너리를 모델의 키워드 인자로 전달한다.
- 클래스 축을 기준으로 확률과 예측 ID를 구한다.

## 제공 코드 또는 스켈레톤

```python
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

name = "distilbert-base-uncased-finetuned-sst-2-english"
tokenizer = AutoTokenizer.①(name)
model = AutoModelForSequenceClassification.①(name)
inputs = tokenizer("This is great!", ②="pt")
with torch.③():
    logits = model(④inputs).logits
probs = torch.softmax(logits, dim=⑤)
pred = probs.argmax(dim=-1).item()
print(model.config.id2label[pred])
```

[정답으로 이동](#answer4)

---

<a id="answer4"></a>

## 정답 4

## 정답 코드

```python
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

name = "distilbert-base-uncased-finetuned-sst-2-english"
tokenizer = AutoTokenizer.from_pretrained(name)
model = AutoModelForSequenceClassification.from_pretrained(name)
inputs = tokenizer("This is great!", return_tensors="pt")
model.eval()
with torch.no_grad():
    logits = model(**inputs).logits
probs = torch.softmax(logits, dim=-1)
pred = probs.argmax(dim=-1).item()
print(model.config.id2label[pred])
```

## 핵심 해설

- 정답은 ① `from_pretrained`, ② `return_tensors`, ③ `no_grad`, ④ `**`, ⑤ `-1`이다.
- `**inputs`는 `input_ids=...`, `attention_mask=...` 형태로 펼친다.
- 배치 입력이면 `.item()` 대신 예측 ID 텐서를 순회한다.

[문제로 돌아가기](#question4)

---

<a id="question5"></a>

## 문제 5. GPT 생성과 Pre-LN·FFN API

## 요구사항

- GPT-2가 입력 뒤에 최대 20개 토큰을 생성한다.
- Pre-LN 잔차 블록과 GELU FFN이 입력 shape를 보존한다.

## 제공 코드 또는 스켈레톤

```python
generated = model.①(
    **inputs, ②=20, pad_token_id=tokenizer.eos_token_id
)
text = tokenizer.③(generated[0], skip_special_tokens=True)

class Block(nn.Module):
    def __init__(self, h):
        super().__init__()
        self.norm = nn.④(h)
        self.ffn = nn.Sequential(nn.Linear(h, 4*h), nn.⑤(), nn.Linear(4*h, h))

    def forward(self, x):
        return x + self.ffn(self.norm(x))
```

[정답으로 이동](#answer5)

---

<a id="answer5"></a>

## 정답 5

## 정답 코드

```python
import torch
from torch import nn
from transformers import AutoModelForCausalLM, AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("gpt2")
model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer.pad_token = tokenizer.eos_token
inputs = tokenizer("Artificial intelligence will", return_tensors="pt")
generated = model.generate(
    **inputs, max_new_tokens=20, pad_token_id=tokenizer.eos_token_id
)
text = tokenizer.decode(generated[0], skip_special_tokens=True)

class Block(nn.Module):
    def __init__(self, h):
        super().__init__()
        self.norm = nn.LayerNorm(h)
        self.ffn = nn.Sequential(nn.Linear(h, 4*h), nn.GELU(), nn.Linear(4*h, h))

    def forward(self, x):
        return x + self.ffn(self.norm(x))

print(text)
print(Block(32)(torch.randn(2, 5, 32)).shape)
```

## 핵심 해설

- 정답은 ① `generate`, ② `max_new_tokens`, ③ `decode`, ④ `LayerNorm`, ⑤ `GELU`이다.
- 생성 ID에는 프롬프트 ID도 포함된다. `decode`가 전체 ID를 문자열로 되돌린다.
- FFN은 마지막 Linear에서 원래 hidden 차원으로 돌아오므로 잔차 덧셈이 가능하다.

[문제로 돌아가기](#question5)
