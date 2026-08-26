# Dataset과 DataLoader: 구현 흐름

<a id="question"></a>

## 문제

특성 2개와 클래스 라벨로 이루어진 데이터를 미니배치로 순회하려 한다. 빈칸을 채워 `batch_x`와 `batch_y`를 얻어라.

## 요구사항

- 배치 크기는 2이고 학습 데이터는 섞는다.

## 제공 코드 또는 스켈레톤

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

X = torch.tensor([[1., 2.], [3., 4.], [5., 6.], [7., 8.]])
y = torch.tensor([0, 1, 0, 1], dtype=torch.long)
dataset = ________(X, y)
loader = ________(dataset, batch_size=2, shuffle=True)
for batch_x, batch_y in ________:
    print(batch_x.shape, batch_y.shape)
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

X = torch.tensor([[1., 2.], [3., 4.], [5., 6.], [7., 8.]])
y = torch.tensor([0, 1, 0, 1], dtype=torch.long)
dataset = TensorDataset(X, y)
loader = DataLoader(dataset, batch_size=2, shuffle=True)
for batch_x, batch_y in loader:
    print(batch_x.shape, batch_y.shape)
```

## 핵심 해설

- 텐서 → 샘플 단위 `TensorDataset` → 배치 단위 `DataLoader` → 반복 순서로 실행한다.
- loader는 `(batch_x, batch_y)`를 출력하며 이는 모델과 손실 함수로 전달된다.
- `batch_size`는 배치 크기, `shuffle=True`는 학습 데이터 순서를 섞는다.
- 검증/테스트는 보통 `shuffle=False`로 바꾼다.

[문제로 돌아가기](#question)
