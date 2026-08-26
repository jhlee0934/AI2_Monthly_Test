# Digits MLP 학습: 구현 흐름

<a id="question"></a>

## 문제

Digits 데이터셋을 MLP 분류기에 학습시키기 위한 데이터 준비 순서를 빈칸에 작성하라. 데이터 누수를 막아야 한다.

## 요구사항

- 테스트 세트의 통계량으로 스케일러를 적합하면 안 된다.

## 제공 코드 또는 스켈레톤

```python
digits = load_digits()
X, y = digits.data, digits.target

X_train, X_test, y_train, y_test = ________(X, y, test_size=0.2,
    random_state=42, stratify=y)
scaler = ________()
X_train = scaler.________(X_train)
X_test = scaler.________(X_test)

train_x = torch.from_numpy(X_train).float()
train_y = torch.from_numpy(y_train).long()
```

[정답으로 이동](#answer)

---

<a id="answer"></a>

## 정답

## 정답 코드

```python
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import torch

digits = load_digits()
X, y = digits.data, digits.target
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2,
    random_state=42, stratify=y)
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)
train_x = torch.from_numpy(X_train).float()
train_y = torch.from_numpy(y_train).long()
```

## 핵심 해설

- 로드 → 분할 → 학습 데이터로 스케일러 적합 → 두 집합 변환 → 텐서 변환 순서다.
- `stratify=y`는 클래스 비율을 유지하고, `fit_transform`은 학습 집합에서만 평균·표준편차를 배운다.
- 테스트에는 이미 학습된 `transform()`만 적용해 누수를 막는다.
- 변환된 특성은 float, 클래스 인덱스 타깃은 long으로 이후 Dataset에 전달된다.
- 분할 비율은 `test_size`, 정규화 방식은 스케일러 블록에서 변경한다.

[문제로 돌아가기](#question)
