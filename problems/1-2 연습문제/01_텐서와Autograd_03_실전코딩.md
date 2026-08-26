# 텐서와 Autograd: 실전 코딩

<a id="question"></a>

## 문제

`f(w) = Σ(w_i² - 2w_i)`의 값과 각 `w_i`에 대한 기울기를 계산하는 `compute_value_and_grad` 함수를 작성하라.

## 요구사항

- 입력은 실수 리스트이며, 반환값은 `(함숫값, 기울기_리스트)`다.
- PyTorch 텐서와 Autograd를 사용한다.
- `backward()`에 전달되는 값은 스칼라여야 한다.

## 제공 코드 또는 스켈레톤

```python
import torch

def compute_value_and_grad(values):
    pass

value, grad = compute_value_and_grad([1.0, 3.0])
print(value, grad)
```

## 예상 입력·출력

```text
4.0 [0.0, 4.0]
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
import torch

def compute_value_and_grad(values):
    w = torch.tensor(values, dtype=torch.float32, requires_grad=True)
    value = (w ** 2 - 2 * w).sum()
    value.backward()
    return value.item(), w.grad.tolist()

value, grad = compute_value_and_grad([1.0, 3.0])
print(value, grad)
```

## 핵심 해설

- 처리 블록은 입력 리스트 → 미분 가능 텐서 → 원소별 식 → 합산 손실 → 역전파 → 숫자/리스트 반환이다.
- `w`는 입력 텐서, `value`는 스칼라 출력, `w.grad`는 같은 모양의 기울기 출력이다.
- `dtype=torch.float32`와 `requires_grad=True`가 계산과 미분의 핵심 인자다.
- `value.backward()`가 그래프를 따라 미분해 `w.grad`에 전달한다.
- 식이 평균으로 바뀌면 마지막 `sum()`을 `mean()`으로, 벡터별 손실이면 적절한 축 감소 연산으로 수정한다.

[문제로 돌아가기](#question)
