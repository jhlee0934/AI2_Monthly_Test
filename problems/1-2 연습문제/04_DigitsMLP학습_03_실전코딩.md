# Digits MLP 학습: 실전 코딩

<a id="question"></a>

## 문제

Digits 분류 MLP를 한 에포크 학습하고 검증 정확도를 반환하는 `run_epoch` 함수를 작성하라.

## 요구사항

- 함수 인자: `model, train_loader, validation_loader, optimizer, criterion`.
- 학습에서는 파라미터를 갱신하고, 검증에서는 갱신하지 않는다.
- 반환값은 `0.0~1.0` 범위의 검증 정확도다.
- 배치의 로짓에서 가장 큰 클래스 인덱스를 사용한다.

## 제공 코드 또는 스켈레톤

```python
def run_epoch(model, train_loader, validation_loader, optimizer, criterion):
    pass
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
import torch

def run_epoch(model, train_loader, validation_loader, optimizer, criterion):
    model.train()
    for features, target in train_loader:
        optimizer.zero_grad()
        logits = model(features)
        loss = criterion(logits, target)
        loss.backward()
        optimizer.step()

    model.eval()
    correct = total = 0
    with torch.no_grad():
        for features, target in validation_loader:
            logits = model(features)
            predicted = logits.argmax(dim=1)
            correct += (predicted == target).sum().item()
            total += target.size(0)
    return correct / total
```

## 핵심 해설

- 한 에포크는 모든 학습 배치의 갱신 후, 모든 검증 배치의 예측·집계로 구성된다.
- 학습 배치의 출력은 손실 계산과 역전파로, 검증 출력은 `argmax(dim=1)`을 거쳐 정답 비교로 전달된다.
- `train()`은 Dropout을 활성화하고, `eval()`은 이를 평가 방식으로 전환한다.
- `no_grad()`는 검증 시 메모리와 불필요한 기울기 계산을 줄인다.
- GPU를 쓰려면 각 배치와 모델을 같은 `device`로 옮기는 블록을 두 루프에 추가한다.

[문제로 돌아가기](#question)
