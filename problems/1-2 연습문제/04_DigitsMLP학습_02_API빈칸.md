# Digits MLP 학습: API 빈칸

<a id="question"></a>

## 문제

다중 분류 MLP의 학습·검증 루프에서 API 빈칸을 채워라. 검증에서는 기울기를 기록하지 않는다.

## 요구사항

- 학습과 검증에서 각각 올바른 모델 모드로 전환한다.

## 제공 코드 또는 스켈레톤

```python
criterion = nn.________()
optimizer = optim.________(model.parameters(), lr=1e-3, weight_decay=1e-4)

model.________()
for x, y in train_loader:
    optimizer.________()
    logits = model(x)
    loss = criterion(logits, y)
    loss.________()
    optimizer.________()

model.________()
with torch.________():
    for x, y in validation_loader:
        logits = model(x)
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

model.train()
for x, y in train_loader:
    optimizer.zero_grad()
    logits = model(x)
    loss = criterion(logits, y)
    loss.backward()
    optimizer.step()

model.eval()
with torch.no_grad():
    for x, y in validation_loader:
        logits = model(x)
```

## 핵심 해설

- 학습 순서는 train 모드 → 초기화 → 순전파 → 손실 → 역전파 → 갱신이다.
- 로짓과 정수형 타깃이 `CrossEntropyLoss`에 전달된다. Softmax는 넣지 않는다.
- `Adam`의 `lr`은 학습률, `weight_decay`는 가중치 규제 강도다.
- `eval()`과 `no_grad()`는 드롭아웃을 평가 동작으로 바꾸고 검증 그래프 생성을 막는다.
- 옵티마이저를 바꾸려면 생성 블록을, 정확도 지표를 바꾸려면 검증 집계 블록을 수정한다.

[문제로 돌아가기](#question)
