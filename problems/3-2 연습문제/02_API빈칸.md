# 02. 함수·메서드 빈칸 문제

각 문제의 코드는 빈칸을 제외하면 완성된 형태다. `①`, `②`처럼 표시한 빈칸에 들어갈 클래스·함수·메서드·인자 또는 표현식을 작성하시오.

<a id="question1"></a>

## 문제 1. Stable Diffusion 생성 옵션

## 요구사항

- Stable Diffusion v1.5를 반정밀도로 로드한다.
- 부정 프롬프트를 적용하고 시드 42로 결과를 재현한다.
- 파이프라인의 첫 이미지를 얻는다.

## 제공 코드

```python
import torch
from diffusers import StableDiffusionPipeline

pipe = StableDiffusionPipeline.①(
    "runwayml/stable-diffusion-v1-5",
    ②=torch.float16,
).to(device)

generator = torch.③(device=device).④(42)
image = pipe(
    prompt="a golden retriever puppy, studio photography, soft lighting, 4k",
    ⑤="blurry, low quality, distorted",
    ⑥=7.5,
    ⑦=50,
    generator=generator,
).⑧[0]
```

[정답으로 이동](#answer1)

---

<a id="answer1"></a>

## 정답 1

① `from_pretrained` ② `torch_dtype` ③ `Generator` ④ `manual_seed` ⑤ `negative_prompt` ⑥ `guidance_scale` ⑦ `num_inference_steps` ⑧ `images`

## 정답 코드

```python
pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
).to(device)
generator = torch.Generator(device=device).manual_seed(42)
image = pipe(
    prompt="a golden retriever puppy, studio photography, soft lighting, 4k",
    negative_prompt="blurry, low quality, distorted",
    guidance_scale=7.5,
    num_inference_steps=50,
    generator=generator,
).images[0]
```

## 핵심 해설

- `from_pretrained`의 입력은 모델 저장소 ID이고 출력은 호출 가능한 파이프라인이다.
- `torch_dtype`은 모델 파라미터 자료형, `guidance_scale`은 텍스트 조건의 영향, `num_inference_steps`는 디노이징 반복 수를 정한다.
- `Generator`는 난수 상태를 담고 `manual_seed`가 이를 고정한다. 시드만 변경하면 같은 프롬프트의 다른 초기 노이즈 결과를 얻는다.
- 반환 객체의 `images`는 PIL 이미지 리스트다.

[문제로 돌아가기](#question1)

---

<a id="question2"></a>

## 문제 2. CLIP 전처리와 Zero-shot 예측

## 요구사항

- 이미지 한 장과 세 문장을 하나의 CLIP 입력 딕셔너리로 만든다.
- 후보 문장 축으로 확률을 계산하고 최고 확률 문장을 고른다.

## 제공 코드

```python
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

model_id = "openai/clip-vit-base-patch32"
model = CLIPModel.①(model_id)
processor = CLIPProcessor.①(model_id)
image = Image.open("generated_image.jpg")
labels = ["a photo of a dog", "a photo of a cat", "a photo of a bird"]

inputs = processor(
    ②=labels,
    ③=image,
    ④="pt",
    ⑤=True,
)
with torch.⑥():
    outputs = model(⑦)

probs = outputs.⑧.⑨(dim=1)
predicted = labels[probs.⑩(dim=1).item()]
```

[정답으로 이동](#answer2)

---

<a id="answer2"></a>

## 정답 2

① `from_pretrained` ② `text` ③ `images` ④ `return_tensors` ⑤ `padding` ⑥ `no_grad` ⑦ `**inputs` ⑧ `logits_per_image` ⑨ `softmax` ⑩ `argmax`

## 정답 코드

```python
model = CLIPModel.from_pretrained(model_id)
processor = CLIPProcessor.from_pretrained(model_id)
inputs = processor(
    text=labels,
    images=image,
    return_tensors="pt",
    padding=True,
)
with torch.no_grad():
    outputs = model(**inputs)
probs = outputs.logits_per_image.softmax(dim=1)
predicted = labels[probs.argmax(dim=1).item()]
```

## 핵심 해설

- `CLIPProcessor`는 텍스트 토큰과 이미지 픽셀 텐서를 같은 딕셔너리에 담는다. `return_tensors="pt"`는 PyTorch 텐서를 요청한다.
- `padding=True`는 길이가 다른 문장을 같은 텐서 길이로 맞춘다.
- `**inputs`는 딕셔너리 키를 모델 인자로 전달한다.
- `(1, 문장 수)` 로짓의 `dim=1`이 후보 문장 축이다. 여러 이미지에서도 각 이미지별 최고 후보를 얻을 수 있다.

[문제로 돌아가기](#question2)

---

<a id="question3"></a>

## 문제 3. ResNet-50 가중치 연계 API

## 요구사항

- V2 가중치에 맞는 모델, 전처리, 클래스명을 사용한다.
- 이미지 한 장의 Top-5 결과를 구한다.

## 제공 코드

```python
import torch
import torchvision.models as models
from PIL import Image

weights = models.①.②
model = models.③(weights=weights)
model.④()
preprocess = weights.⑤()

image = Image.open("generated_image.jpg")
batch = preprocess(image).⑥(0)
with torch.⑦():
    logits = model(batch)
    probabilities = torch.⑧(logits, dim=1)

top_probs, top_indices = probabilities.⑨(5, dim=1)
categories = weights.⑩["categories"]
```

[정답으로 이동](#answer3)

---

<a id="answer3"></a>

## 정답 3

① `ResNet50_Weights` ② `IMAGENET1K_V2` ③ `resnet50` ④ `eval` ⑤ `transforms` ⑥ `unsqueeze` ⑦ `no_grad` ⑧ `softmax` ⑨ `topk` ⑩ `meta`

## 정답 코드

```python
weights = models.ResNet50_Weights.IMAGENET1K_V2
model = models.resnet50(weights=weights)
model.eval()
preprocess = weights.transforms()
batch = preprocess(image).unsqueeze(0)
with torch.no_grad():
    logits = model(batch)
    probabilities = torch.softmax(logits, dim=1)
top_probs, top_indices = probabilities.topk(5, dim=1)
categories = weights.meta["categories"]
```

## 핵심 해설

- 가중치 객체의 `transforms()`는 해당 모델 학습 시 사용한 resize/crop/정규화를 재현한다.
- `unsqueeze(0)`은 단일 샘플 앞에 배치 축을 추가한다.
- `topk`는 `(값, 인덱스)`를 반환하며, 인덱스를 `meta["categories"]`의 위치로 사용한다.
- Top-N 조건이 바뀌면 `topk(5)`와 출력 반복 횟수만 함께 변경한다.

[문제로 돌아가기](#question3)

---

<a id="question4"></a>

## 문제 4. ImageFolder와 Linear Probing

## 요구사항

- 클래스별 하위 폴더를 데이터셋으로 읽는다.
- ResNet-18 특징 추출부는 동결하고, 데이터셋 클래스 수에 맞춘 분류층만 학습한다.

## 제공 코드

```python
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder
from torchvision.models import ResNet18_Weights, resnet18

train_dataset = ①("data/train", ②=train_transforms)
test_dataset = ①("data/test", ②=test_transforms)
train_loader = ③(train_dataset, batch_size=4, ④=True)

model = resnet18(⑤=ResNet18_Weights.IMAGENET1K_V1)
for parameter in model.⑥():
    parameter.⑦ = False

num_classes = len(train_dataset.⑧)
model.fc = nn.⑨(model.fc.⑩, num_classes)
optimizer = optim.SGD(model.fc.⑪(), lr=0.01, momentum=0.9)
```

[정답으로 이동](#answer4)

---

<a id="answer4"></a>

## 정답 4

① `ImageFolder` ② `transform` ③ `DataLoader` ④ `shuffle` ⑤ `weights` ⑥ `parameters` ⑦ `requires_grad` ⑧ `classes` ⑨ `Linear` ⑩ `in_features` ⑪ `parameters`

## 정답 코드

```python
train_dataset = ImageFolder("data/train", transform=train_transforms)
test_dataset = ImageFolder("data/test", transform=test_transforms)
train_loader = DataLoader(train_dataset, batch_size=4, shuffle=True)
model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
for parameter in model.parameters():
    parameter.requires_grad = False
num_classes = len(train_dataset.classes)
model.fc = nn.Linear(model.fc.in_features, num_classes)
optimizer = optim.SGD(model.fc.parameters(), lr=0.01, momentum=0.9)
```

## 핵심 해설

- `ImageFolder`는 `root/class_name/file.png` 구조를 읽고 `(이미지, 정수 라벨)`을 반환한다.
- `transform`은 샘플을 꺼낼 때 적용되며, DataLoader는 이를 배치로 묶는다.
- `model.parameters()`를 먼저 동결하고 새 `Linear`를 나중에 대입해야 새 헤드는 학습 가능 상태를 유지한다.
- 전체 미세조정으로 바꾸려면 동결 정책과 optimizer에 전달하는 파라미터를 함께 바꿔야 한다.

[문제로 돌아가기](#question4)

---

<a id="question5"></a>

## 문제 5. KD 손실 API

## 요구사항

- Teacher의 soft target과 Student의 log probability를 비교한다.
- temperature가 4.0일 때 기울기 크기를 제곱 보정한다.
- KL 70%, 정답 CE 30%로 결합한다.

## 제공 코드

```python
import torch
import torch.nn.functional as F

temperature = 4.0
alpha = 0.7

with torch.①():
    teacher_logits = teacher_model(images)
    teacher_soft = F.②(teacher_logits / temperature, dim=1)

student_logits = student_model(images)
student_log_soft = F.③(student_logits / temperature, dim=1)
kl_loss = F.④(
    ⑤,
    ⑥,
    ⑦="batchmean",
) * ⑧
ce_loss = ce_cross_entropy(⑨, ⑩)
loss = ⑪ * kl_loss + (1 - ⑪) * ce_loss

student_optimizer.⑫()
loss.⑬()
student_optimizer.⑭()
```

[정답으로 이동](#answer5)

---

<a id="answer5"></a>

## 정답 5

① `no_grad` ② `softmax` ③ `log_softmax` ④ `kl_div` ⑤ `student_log_soft` ⑥ `teacher_soft` ⑦ `reduction` ⑧ `temperature ** 2` ⑨ `student_logits` ⑩ `labels` ⑪ `alpha` ⑫ `zero_grad` ⑬ `backward` ⑭ `step`

## 정답 코드

```python
with torch.no_grad():
    teacher_logits = teacher_model(images)
    teacher_soft = F.softmax(teacher_logits / temperature, dim=1)
student_logits = student_model(images)
student_log_soft = F.log_softmax(student_logits / temperature, dim=1)
kl_loss = F.kl_div(
    student_log_soft,
    teacher_soft,
    reduction="batchmean",
) * (temperature ** 2)
ce_loss = ce_cross_entropy(student_logits, labels)
loss = alpha * kl_loss + (1 - alpha) * ce_loss
student_optimizer.zero_grad()
loss.backward()
student_optimizer.step()
```

## 핵심 해설

- `kl_div(input, target)`에서 `input`은 로그 확률, `target`은 확률이다. 순서를 바꾸면 API 규약과 손실 방향이 달라진다.
- `batchmean`은 클래스 항을 합한 뒤 배치 크기로 나눠 KL 정의에 맞춘다.
- Teacher 출력은 `no_grad`로 끊고 Student 출력만 계산 그래프에 남긴다.
- hard label 형식은 클래스 번호를 담은 정수 텐서 `(batch,)`이고, soft target 형식은 클래스별 확률 텐서 `(batch, classes)`이다.

[문제로 돌아가기](#question5)
