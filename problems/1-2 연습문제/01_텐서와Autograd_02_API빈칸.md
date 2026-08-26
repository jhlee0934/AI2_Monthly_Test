# 텐서와 Autograd: API 빈칸

<a id="question"></a>

## 문제

NumPy 배열을 PyTorch 텐서로 바꾸고, 학습된 가중치로 추론하라. 기울기 추적 없이 계산해야 한다. 빈칸을 채워라.

## 요구사항

- NumPy와 텐서의 메모리를 공유하는 변환 API를 사용한다.
- 추론 결과는 파이썬 숫자로 출력한다.
- `prediction.requires_grad`는 `False`여야 한다.

## 제공 코드 또는 스켈레톤

```python
import numpy as np
import torch

array = np.array([1.0, 4.0], dtype=np.float32)
x = torch.______(array)
weight = torch.tensor([2.0, 3.0], requires_grad=True)
bias = torch.tensor([0.5], requires_grad=True)

with torch.______():
    prediction = (x * weight).______() + bias

print(prediction.______())
print(prediction.requires_grad)
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
import numpy as np
import torch

array = np.array([1.0, 4.0], dtype=np.float32)
x = torch.from_numpy(array)
weight = torch.tensor([2.0, 3.0], requires_grad=True)
bias = torch.tensor([0.5], requires_grad=True)

with torch.no_grad():
    prediction = (x * weight).sum() + bias

print(prediction.item())
print(prediction.requires_grad)
```

## 핵심 해설

- 실행 순서: 배열 변환 → 가중치 준비 → 내적과 편향 계산 → 스칼라 추출이다.
- `from_numpy()`의 입력은 NumPy 배열이고 출력은 같은 메모리를 공유하는 텐서다.
- `torch.no_grad()`는 이 블록의 연산 그래프 생성을 끈다. `sum()`은 원소별 곱을 스칼라 내적으로 만든다.
- `item()`은 원소 하나인 텐서를 파이썬 숫자로 변환한다.
- 독립된 복사본이 필요하면 `torch.from_numpy()` 대신 `torch.tensor(array)`를 사용한다.

[문제로 돌아가기](#question)
