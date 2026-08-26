# Dataset과 DataLoader: API 빈칸

<a id="question"></a>

## 문제

리스트 기반 데이터를 위한 사용자 정의 데이터셋의 빈칸을 채워라. 특성은 `float32`, 라벨은 `long` 텐서여야 한다.

## 요구사항

- `len(dataset)`과 `dataset[index]`가 모두 동작해야 한다.

## 제공 코드 또는 스켈레톤

```python
import torch
from torch.utils.data import ________

class MyDataset(________):
    def __init__(self, X, y):
        self.X = torch.________(X)
        self.y = torch.________(y)
    def ________(self):
        return len(self.X)
    def ________(self, index):
        return self.X[index], self.y[index]
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
import torch
from torch.utils.data import Dataset

class MyDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.FloatTensor(X)
        self.y = torch.LongTensor(y)
    def __len__(self):
        return len(self.X)
    def __getitem__(self, index):
        return self.X[index], self.y[index]
```

## 핵심 해설

- `Dataset`은 인덱스로 샘플을 읽고 전체 길이를 알려주는 인터페이스다.
- `__getitem__`의 `(X, y)`가 DataLoader에 의해 배치 텐서로 합쳐진다.
- `FloatTensor`는 입력에, `LongTensor`는 `CrossEntropyLoss`의 클래스 인덱스 타깃에 맞는다.
- 파일 지연 로딩은 `__getitem__`에 추가한다.

[문제로 돌아가기](#question)
