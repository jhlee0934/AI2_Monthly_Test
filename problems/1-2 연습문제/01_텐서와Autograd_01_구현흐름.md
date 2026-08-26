# 텐서와 Autograd: 구현 흐름

<a id="question"></a>

## 문제

다음은 `y = x² + 3x`의 각 원소에 대한 기울기를 구하는 코드이다. `x.grad`에 기울기가 저장되도록 빈칸의 처리 블록을 작성하라.

## 요구사항

- `x`는 기울기를 추적해야 한다.
- `backward()`는 스칼라 텐서에 호출한다.
- 출력은 `[7., 9.]`이어야 한다.

## 제공 코드 또는 스켈레톤

```python
import torch

x = torch.tensor([2.0, 3.0], ________)
y = x ** 2 + 3 * x
z = ________
________
print(x.grad)
```

## 예상 입력·출력

```text
tensor([7., 9.])
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
import torch

x = torch.tensor([2.0, 3.0], requires_grad=True)
y = x ** 2 + 3 * x
z = y.sum()
z.backward()
print(x.grad)
```

## 핵심 해설

- 실행 순서: 미분 대상 `x` 생성 → 원소별 계산 `y` → 스칼라 손실 `z` → 역전파이다.
- `x`의 입력은 값 `[2.0, 3.0]`, 출력은 `x.grad`의 미분값이다.
- `requires_grad=True`가 연산 그래프를 기록하고, `sum()`이 벡터를 스칼라로 바꿔 `backward()`를 가능하게 한다.
- `z.backward()`의 결과가 원본 리프 텐서 `x.grad`에 누적된다.
- 평균 손실을 쓸 경우 `y.sum()`을 `y.mean()`으로 바꾸면 기울기도 원소 수만큼 달라진다.

[문제로 돌아가기](#question)
