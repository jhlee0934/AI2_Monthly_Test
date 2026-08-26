# Dataset과 DataLoader: 실전 코딩

<a id="question"></a>

## 문제

2차원 입력의 이진 분류 데이터를 `DataLoader`로 학습하는 코드를 작성하라.

## 요구사항

- `TensorDataset`, `DataLoader(batch_size=2, shuffle=True)`를 쓴다.
- 모델은 `nn.Linear(2, 2)`, 손실은 `CrossEntropyLoss`, 최적화는 SGD(`lr=0.01`)다.
- 각 배치마다 순전파, 손실, 기울기 초기화, 역전파, 갱신을 수행한다.

## 제공 코드 또는 스켈레톤

```python
import torch
import torch.nn as nn
import torch.optim as optim

X = [[1, 2], [3, 4], [5, 6], [7, 8]]
y = [0, 1, 0, 1]
# 여기에 학습 코드를 작성
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

X = torch.tensor([[1, 2], [3, 4], [5, 6], [7, 8]], dtype=torch.float32)
y = torch.tensor([0, 1, 0, 1], dtype=torch.long)
loader = DataLoader(TensorDataset(X, y), batch_size=2, shuffle=True)
model = nn.Linear(2, 2)
criterion = nn.CrossEntropyLoss()
optimizer = optim.SGD(model.parameters(), lr=0.01)

for _ in range(5):
    for batch_x, batch_y in loader:
        logits = model(batch_x)
        loss = criterion(logits, batch_y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
print(loss.item())
```

## 핵심 해설

- 데이터 → Dataset → DataLoader → 배치별 모델 → 손실 → 역전파 → 갱신 순서다.
- 배치 특성은 모델 입력, 배치 라벨은 손실 함수 타깃으로 전달된다.
- `model.parameters()`가 SGD가 갱신할 파라미터를 제공한다.
- 배치 크기나 섞기 조건은 DataLoader에서, 모델 차원은 `Linear`에서 바꾼다.

[문제로 돌아가기](#question)
