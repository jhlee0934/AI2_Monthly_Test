# 함수·메서드 빈칸 문제

각 문제의 코드는 독립적으로 실행할 수 있는 완성 흐름이다. `_____`에 들어갈 클래스·함수·메서드·인자 표현식을 작성하라.

<a id="question1"></a>

## 문제 1. 선형 프로빙 API

## 요구사항

- ImageNet V1 가중치의 ResNet18 특징 추출기는 동결한다.
- 출력 클래스 수는 10이다.
- 분류 헤드만 SGD로 학습하며 학습률은 2에폭마다 10분의 1이 된다.

## 제공 코드 또는 스켈레톤

```python
import torch.nn as nn
import torch.optim as optim
from torchvision.models import resnet18, ResNet18_Weights

weights = ResNet18_Weights._____[1]
model = resnet18(_____[2]=weights)

for parameter in model._____[3]():
    parameter._____[4] = False

model._____[5] = nn._____[6](model.fc._____[7], 10)
criterion = nn._____[8]()
optimizer = optim._____[9](model.fc.parameters(), lr=0.001, momentum=0.9)
scheduler = optim.lr_scheduler._____[10](optimizer, step_size=2, gamma=0.1)
```

[정답으로 이동](#answer1)

---

<a id="answer1"></a>

## 정답 1

`[1] IMAGENET1K_V1`, `[2] weights`, `[3] parameters`, `[4] requires_grad`, `[5] fc`, `[6] Linear`, `[7] in_features`, `[8] CrossEntropyLoss`, `[9] SGD`, `[10] StepLR`

## 정답 코드

```python
weights = ResNet18_Weights.IMAGENET1K_V1
model = resnet18(weights=weights)
for parameter in model.parameters():
    parameter.requires_grad = False
model.fc = nn.Linear(model.fc.in_features, 10)
criterion = nn.CrossEntropyLoss()
optimizer = optim.SGD(model.fc.parameters(), lr=0.001, momentum=0.9)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=2, gamma=0.1)
```

## 핵심 해설

- `weights`는 구조와 함께 학습된 값을 로드하고, `in_features`는 기존 헤드가 받던 특징 차원을 보존한다.
- 새 `Linear`만 기본 `requires_grad=True`이므로 헤드만 옵티마이저에 전달한다.
- `CrossEntropyLoss`의 입력은 로짓과 정수 클래스 인덱스다.
- 클래스 수 변경은 `Linear`의 두 번째 인자, 학습 범위 변경은 동결 상태와 옵티마이저 입력에서 반영한다.

[문제로 돌아가기](#question1)

---

<a id="question2"></a>

## 문제 2. 증강 및 선택적 파인튜닝 API

## 요구사항

- 학습 이미지는 224 크기의 랜덤 크롭, 확률 0.5의 좌우 반전, 15도 범위 회전을 적용한다.
- 정규화 값은 가중치 메타데이터에서 가져온다.
- `layer4`와 `fc`만 Adam의 업데이트 대상이 된다.

## 제공 코드 또는 스켈레톤

```python
from torchvision import transforms
from torchvision.models import resnet18, ResNet18_Weights
import torch.nn as nn
import torch.optim as optim

weights = ResNet18_Weights.IMAGENET1K_V1
preprocess = weights._____[1]()
train_transform = transforms._____[2]([
    transforms._____[3](224),
    transforms._____[4](p=0.5),
    transforms._____[5](15),
    transforms.ToTensor(),
    transforms._____[6](mean=preprocess.mean, std=preprocess.std),
])

model = resnet18(weights=weights)
model.fc = nn.Linear(model.fc.in_features, 10)
for p in model.parameters():
    p.requires_grad = False
for p in model._____[7].parameters():
    p.requires_grad = True
for p in model.fc.parameters():
    p.requires_grad = True

optimizer = optim._____[8](
    _____[9](lambda p: p.requires_grad, model.parameters()),
    lr=0.001,
)
```

[정답으로 이동](#answer2)

---

<a id="answer2"></a>

## 정답 2

`[1] transforms`, `[2] Compose`, `[3] RandomResizedCrop`, `[4] RandomHorizontalFlip`, `[5] RandomRotation`, `[6] Normalize`, `[7] layer4`, `[8] Adam`, `[9] filter`

## 정답 코드

```python
preprocess = weights.transforms()
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(15),
    transforms.ToTensor(),
    transforms.Normalize(mean=preprocess.mean, std=preprocess.std),
])
model = resnet18(weights=weights)
model.fc = nn.Linear(model.fc.in_features, 10)
for p in model.parameters():
    p.requires_grad = False
for p in model.layer4.parameters():
    p.requires_grad = True
for p in model.fc.parameters():
    p.requires_grad = True
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=0.001)
```

## 핵심 해설

- `Compose`는 리스트 순서대로 PIL 변환 → 텐서 변환 → 정규화를 수행한다.
- `weights.transforms()`가 제공하는 `mean`, `std`는 사전학습 입력 분포와 일치시킨다.
- `filter`가 반환하는 반복 가능 객체에는 동결 해제된 파라미터만 들어간다.
- 전체 파인튜닝은 모든 `requires_grad`를 `True`로 하고 필터 없이 `model.parameters()`를 전달한다.

[문제로 돌아가기](#question2)

---

<a id="question3"></a>

## 문제 3. ViT 전처리·추론·후처리 API

## 요구사항

- 같은 체크포인트에서 전처리기와 이미지 분류 모델을 로드한다.
- PIL 이미지 리스트를 배치 텐서로 만들고 기울기 없이 추론한다.
- 결과는 예측 클래스 인덱스 리스트여야 한다.

## 제공 코드 또는 스켈레톤

```python
import torch
from transformers import ViTImageProcessor, ViTForImageClassification

checkpoint = "nateraw/vit-base-patch16-224-cifar10"
processor = ViTImageProcessor._____[1](checkpoint)
model = ViTForImageClassification._____[2](checkpoint)
model._____[3]()

inputs = processor(_____[4]=images, return_tensors=_____[5])
with torch._____[6]():
    outputs = model(_____[7])
predictions = outputs._____[8]._____[9](dim=-1)._____[10]()
```

[정답으로 이동](#answer3)

---

<a id="answer3"></a>

## 정답 3

`[1] from_pretrained`, `[2] from_pretrained`, `[3] eval`, `[4] images`, `[5] "pt"`, `[6] no_grad`, `[7] **inputs`, `[8] logits`, `[9] argmax`, `[10] tolist`

## 정답 코드

```python
processor = ViTImageProcessor.from_pretrained(checkpoint)
model = ViTForImageClassification.from_pretrained(checkpoint)
model.eval()
inputs = processor(images=images, return_tensors="pt")
with torch.no_grad():
    outputs = model(**inputs)
predictions = outputs.logits.argmax(dim=-1).tolist()
```

## 핵심 해설

- 전처리 출력은 `{"pixel_values": tensor(...)}` 형태의 딕셔너리이며 `**inputs`가 이를 키워드 인자로 푼다.
- `logits`는 `(배치 크기, 클래스 수)`, `argmax(dim=-1)`의 출력은 `(배치 크기,)`다.
- `return_tensors="pt"`는 PyTorch 텐서를 뜻한다.
- TensorFlow 모델로 바꾸면 반환 텐서 형식과 모델 클래스가 함께 바뀌어야 한다.

[문제로 돌아가기](#question3)
