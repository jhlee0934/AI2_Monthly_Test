import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'problems', 'api');
const sources = fs.readdirSync(apiDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
  .map((entry) => {
    const file = path.join(apiDir, entry.name);
    return { file, payload: JSON.parse(fs.readFileSync(file, 'utf8')) };
  });
const apiProblems = sources.flatMap(({ payload }) => payload.problems)
  .filter((problem) => legacyApiNumber(problem) <= 35)
  .sort((a, b) => legacyApiNumber(a) - legacyApiNumber(b));
const result = (role, evidence) => ({ role, evidence });

function explain(problem, answer) {
  const a = answer;
  if (problem.id === 'api-generated-001') {
    if (a === '8') return result('LoRA 저랭크 행렬의 rank를 8로 정합니다.', 'alpha가 rank의 두 배인 16이므로 `r=8`이 실습 설정과 일치합니다.');
    if (a === '16') return result('LoRA 업데이트의 스케일을 조절하는 alpha를 정합니다.', '앞의 rank 8과 `lora_alpha=2*r` 관계를 만족하는 값은 16입니다.');
    if (a.startsWith('["q_proj"')) return result('LoRA 어댑터를 attention의 Q·K·V·O 투영 계층에 삽입하도록 대상을 지정합니다.', '`get_peft_model`의 `target_modules`는 실제 모듈 이름 목록을 요구하며 실습이 네 projection을 대상으로 합니다.');
    if (a === '0') return result('LoRA 어댑터 경로의 dropout을 비활성화합니다.', '`lora_dropout`은 확률값이고 이 실습에서는 dropout을 사용하지 않습니다.');
    return result('기반 모델에 LoRA 설정을 적용해 학습 가능한 adapter가 추가된 모델로 바꿉니다.', '반환값을 다시 `model`에 대입한 뒤 학습 가능한 파라미터를 출력하므로 `get_peft_model`이 필요합니다.');
  }
  if (/nn\.Linear\(in_features=1/.test(a)) return result('입력값 하나를 예측값 하나로 변환하는 선형 회귀 계층을 만듭니다.', '입력과 목표가 모두 1차원이고 뒤에서 MSE를 계산하므로 출력 차원도 1이어야 합니다.');
  if (/nn\.MSELoss/.test(a)) return result('회귀 예측과 정답 사이의 평균제곱오차를 손실로 정의합니다.', '단일 연속값을 예측하고 이 손실에서 `backward()`를 호출하므로 MSELoss가 맞습니다.');
  if (/optim\.SGD\(model\.parameters/.test(a)) return result('모델 전체 파라미터를 SGD로 갱신할 optimizer를 만듭니다.', '뒤에서 같은 객체의 `zero_grad()`와 `step()`을 호출하므로 `model.parameters()`를 받은 optimizer가 필요합니다.');
  if (/optim\.Adam/.test(a)) return result('모델 파라미터를 Adam 규칙으로 갱신할 optimizer를 만듭니다.', '코드가 요구하는 lr·betas·eps를 모두 설정하고 뒤에서 `optimizer.step()`을 호출합니다.');
  if (/StepLR/.test(a)) return result('5 epoch마다 학습률을 0.1배로 줄이는 scheduler를 optimizer에 연결합니다.', '`step_size=5`, `gamma=0.1` 설정과 뒤의 `scheduler.step()` 호출이 StepLR 사용을 뜻합니다.');
  if (a === 'model.train()' || a === 'teacher_model.train()') return result('학습 전에 모델을 training 모드로 전환합니다.', '뒤에서 손실 역전파와 optimizer 갱신이 실행되므로 evaluation 모드가 아닌 training 모드여야 합니다.');
  if (a === 'model.eval()') return result('검증·추론 전에 모델을 evaluation 모드로 전환합니다.', '뒤의 코드는 파라미터 갱신 없이 예측만 수행하므로 Dropout 등의 학습 동작을 꺼야 합니다.');
  if (a === 'loss.backward()') return result('현재 손실에서 모델 파라미터까지 역전파해 기울기를 계산합니다.', '바로 뒤의 `optimizer.step()`이 `.grad` 값을 사용하므로 먼저 backward가 실행되어야 합니다.');
  if (a === 'optimizer.step()') return result('계산된 기울기를 이용해 모델 파라미터를 한 번 갱신합니다.', '앞에서 loss를 계산하고 backward를 호출했으므로 학습 순서상 다음 단계가 optimizer 갱신입니다.');
  if (a === 'scheduler.step()') return result('epoch 종료 후 scheduler의 주기를 진행해 다음 학습률을 결정합니다.', '배치별 optimizer 갱신이 끝난 위치에서 호출되므로 scheduler 갱신 호출이 필요합니다.');
  if (a === 'torch.no_grad()') return result('평가·생성 구간의 autograd 그래프 생성을 꺼 메모리와 연산량을 줄입니다.', '`with` 블록 안에서는 예측이나 generate만 수행하고 backward를 호출하지 않습니다.');
  if (/Embedding\(vocab_size/.test(a)) return result('토큰 ID를 hidden_size 차원의 학습 가능한 토큰 임베딩으로 변환합니다.', '입력은 vocabulary 인덱스이며 위치 임베딩과 더하려면 마지막 차원이 hidden_size여야 합니다.');
  if (/Embedding\(max_seq_len/.test(a)) return result('각 위치 인덱스를 hidden_size 차원의 위치 임베딩으로 변환합니다.', '토큰 임베딩과 원소별로 더하려면 위치 수는 max_seq_len, 벡터 차원은 hidden_size여야 합니다.');
  if (/nn\.Dropout/.test(a)) return result('합쳐진 임베딩 일부를 학습 중 무작위로 제거해 과적합을 줄입니다.', '토큰·위치 임베딩을 더한 뒤 Transformer block에 전달하기 전 dropout_rate를 적용합니다.');
  if (/nn\.LayerNorm/.test(a)) return result('Transformer 출력의 hidden 축을 정규화하는 최종 계층을 만듭니다.', '입력 마지막 차원이 hidden_size이고 vocabulary projection 전까지 shape를 유지해야 합니다.');
  if (/nn\.Linear\(hidden_size, vocab_size/.test(a)) return result('각 위치의 hidden vector를 vocabulary 전체의 token logits로 투영합니다.', '다음 토큰 예측 출력은 위치마다 vocab_size개의 점수를 가져야 합니다.');
  if (/load_dotenv/.test(a)) return result('`.env` 파일 값을 현재 프로세스 환경 변수로 로드합니다.', '다음 줄에서 GMS_KEY를 환경 변수로 조회하므로 그 전에 파일을 읽어야 합니다.');
  if (/getenv\("GMS_KEY"/.test(a)) return result('환경 변수에서 GMS API 키를 읽어 클라이언트 설정 변수에 저장합니다.', '앞에서 `.env`를 로드했고 뒤에서 이 값을 검사하거나 `api_key`로 사용합니다.');
  if (/CLIPProcessor/.test(a)) return result('CLIP 체크포인트에 맞는 이미지·텍스트 전처리기를 불러옵니다.', '이미지와 후보 문장을 모델 입력 텐서로 만들려면 모델 ID와 같은 processor가 필요합니다.');
  if (/CLIPModel/.test(a)) return result('사전학습된 CLIP 모델과 가중치를 불러옵니다.', '같은 clip_model_id의 processor 출력으로 이미지-텍스트 유사도 logits를 계산해야 합니다.');
  if (/softmax\(1\)/.test(a)) return result('텍스트 후보별 유사도 logits를 상대 확률로 정규화합니다.', '후보 클래스가 1번 축에 있으므로 그 축에 softmax를 적용해야 합니다.');
  if (/logits_per_image\.argmax/.test(a)) return result('가장 유사한 텍스트 후보의 인덱스를 Python 정수로 얻습니다.', '후속 코드가 후보 목록을 인덱싱하므로 클래스 축의 argmax와 스칼라 변환이 필요합니다.');
  if (/\.as_retriever/.test(a)) return result('Vector Store를 상위 k개 문서를 반환하는 retriever로 변환합니다.', '뒤에서 `.invoke(query)`를 호출하므로 search_kwargs가 설정된 검색 인터페이스가 필요합니다.');
  if (/retriever.*\.invoke/.test(a)) return result('질문을 retriever에 전달해 답변 근거가 될 관련 Document 목록을 검색합니다.', '반환값이 context나 비교 결과로 사용되므로 문서 검색 객체의 invoke가 필요합니다.');
  if (/llm\.invoke\(messages/.test(a)) return result('검색 문맥과 질문으로 만든 메시지를 LLM에 전달해 답변을 생성합니다.', '앞에서 messages가 구성되고 반환 메시지가 최종 답변으로 사용됩니다.');
  if (/SystemMessage/.test(a)) return result('ReAct 규칙을 담은 system 메시지를 대화 목록 맨 앞에 추가합니다.', '코드가 SystemMessage 존재 여부를 검사하므로 일반 문자열이 아니라 SystemMessage 객체가 필요합니다.');
  if (/bind_tools/.test(a)) return result('LLM에 사용 가능한 tool을 연결하고 메시지로 agent 응답 또는 tool call을 생성합니다.', '뒤의 분기 함수가 응답의 `tool_calls`를 검사하므로 tool이 bind된 LLM 응답이 필요합니다.');
  if (/StateGraph\(/.test(a)) return result('SupervisorState를 공유 상태로 사용하는 LangGraph 정의 객체를 생성합니다.', '이 객체에 worker 노드와 edge를 추가한 후 compile하므로 실행 전 StateGraph가 필요합니다.');
  if (/\.add_node\(/.test(a)) { const n=a.match(/add_node\("([^"]+)/)?.[1]; return result(`'${n}' 노드 이름을 실제 실행 함수와 연결해 그래프에 등록합니다.`, `뒤에서 '${n}' 이름으로 edge가 연결되므로 경로 정의 전에 callable을 add_node로 등록해야 합니다.`); }
  if (/\.add_edge\(/.test(a)) { const x=a.match(/add_edge\((.+)\)/)?.[1]; return result(`${x} 사이의 LangGraph 실행 순서를 연결합니다.`, '연결 대상 노드는 앞에서 등록됐으며 의도한 시작·분기·합류 흐름을 만들려면 add_edge가 필요합니다.'); }
  if (/apply_chat_template/.test(a)) return /add_generation_prompt=True/.test(a)
    ? result('role 메시지를 추론용 채팅 문자열로 직렬화하고 assistant 생성 시작 표시를 붙입니다.', '뒤에서 생성 입력으로 쓰므로 tokenize=False와 add_generation_prompt=True가 필요합니다.')
    : result('system·user·assistant 메시지를 SFT 학습용 단일 채팅 문자열로 직렬화합니다.', '정답 assistant 메시지까지 학습하므로 문자열을 반환하고 generation prompt는 붙이지 않습니다.');
  if (/batch_decode/.test(a)) return result('배치의 생성 token ID들을 응답 문자열 목록으로 복원합니다.', 'model.generate 결과가 배치 차원을 가진 token tensor이므로 batch_decode가 필요합니다.');
  if (/logits\.argmax/.test(a)) return result('각 샘플의 클래스 logits에서 가장 큰 인덱스를 예측 라벨로 선택합니다.', '뒤에서 정답과 비교하므로 dim=1을 제거한 배치 크기의 라벨 tensor가 필요합니다.');
  if (/torch\.cat\(all_preds/.test(a)) return result('배치별 예측 tensor를 전체 데이터 순서로 합쳐 NumPy 배열로 변환합니다.', '루프에서 all_preds에 CPU tensor를 누적했으므로 반환 전에 배치 축으로 연결해야 합니다.');
  if (/torch\.cat\(all_targets/.test(a)) return result('배치별 정답 tensor를 전체 데이터 순서의 NumPy 배열로 합칩니다.', '예측과 같은 길이·순서를 유지해야 평가 지표를 계산할 수 있습니다.');
  if (/RandomResizedCrop/.test(a)) return result('학습 이미지를 무작위 영역에서 잘라 224×224로 조정합니다.', '훈련 입력 크기를 유지하면서 위치·크기 augmentation을 적용하는 단계입니다.');
  if (/RandomHorizontalFlip/.test(a)) return result('학습 이미지를 확률적으로 좌우 반전해 데이터 다양성을 늘립니다.', '라벨을 바꾸지 않는 변형이며 검증이 아닌 훈련 transform에 사용됩니다.');
  if (/Resize\(256\)/.test(a)) return result('평가 이미지 크기를 256으로 일정하게 맞춥니다.', '다음 CenterCrop(224)가 모든 이미지에서 동일한 중앙 영역을 얻으려면 먼저 resize해야 합니다.');
  if (/CenterCrop/.test(a)) return result('평가 이미지의 중앙 224×224 영역을 잘라 모델 입력 크기로 만듭니다.', '검증에서는 무작위 crop 대신 결정적인 중앙 crop을 사용해야 재현 가능합니다.');
  if (/DataLoader\(train_dataset/.test(a)) return result('훈련 데이터셋을 4개 배치로 묶고 epoch마다 순서를 섞어 공급합니다.', '학습 루프가 배치 입력을 요구하며 shuffle=True로 순서 편향을 줄입니다.');
  if (/model\.save_pretrained/.test(a)) return result('학습된 LoRA adapter의 모델 설정과 가중치를 output_dir에 저장합니다.', 'PEFT adapter를 나중에 다시 로드할 수 있는 형식으로 저장해야 합니다.');
  if (/tokenizer\.save_pretrained/.test(a)) return result('학습에 사용한 tokenizer 설정과 vocabulary를 모델과 같은 폴더에 저장합니다.', 'adapter 재사용 시 동일한 tokenization을 복원해야 합니다.');
  if (/self\.fc1/.test(a)) return result('입력 특성을 첫 Linear에 통과시켜 hidden representation을 만듭니다.', '다음 ReLU는 hidden_dim tensor를 받아야 하므로 input_dim→hidden_dim인 fc1이 먼저입니다.');
  if (/self\.relu/.test(a)) return result('첫 Linear 출력에 비선형 ReLU를 적용합니다.', '두 Linear 사이에 활성화가 있어야 모델이 비선형 관계를 표현할 수 있습니다.');
  if (/self\.fc2/.test(a)) return result('hidden representation을 최종 output_dim 크기의 예측으로 변환합니다.', '앞의 ReLU 출력을 받아 함수가 반환할 차원으로 바꾸는 계층은 fc2입니다.');
  if (/self\.layers/.test(a)) return result('Sequential에 묶인 Linear→ReLU→Linear 전체를 입력에 적용합니다.', '생성자에서 전체 계층을 self.layers에 등록했으므로 결과를 바로 반환할 수 있습니다.');
  if (/pd\.DataFrame/.test(a)) return result('샘플별 평가 결과 record 목록을 열 기반 DataFrame으로 변환합니다.', '후속 코드가 컬럼 이름으로 점수와 결과를 조회하므로 DataFrame이 필요합니다.');
  if (/split_documents/.test(a)) return result('원본 Document 목록을 설정된 크기와 overlap의 작은 Document 청크로 나눕니다.', '뒤의 루프가 각 `doc.page_content`를 처리하므로 metadata를 유지한 Document 목록이 필요합니다.');
  if (/enc\.encode/.test(a)) return result('현재 청크 본문을 token ID 배열로 변환해 임베딩 입력 길이를 검사합니다.', '다음 줄에서 tokens를 MAX_TOKENS까지 자르므로 먼저 문자열을 token sequence로 encode해야 합니다.');
  if (/enc\.decode/.test(a)) return result('최대 길이까지 자른 token ID를 다시 청크 본문 문자열로 복원합니다.', 'Vector Store에는 텍스트 Document를 넣으므로 잘린 token 배열을 decode해야 합니다.');
  if (/json\.loads/.test(a)) return result('LLM의 JSON 문자열을 Python dict/list 객체로 파싱합니다.', '뒤에서 결과 필드를 key로 접근하므로 원시 문자열이 아닌 구조화 객체가 필요합니다.');
  if (/models\.resnet50/.test(a)) return result('사전학습 가중치로 teacher용 ResNet-50을 생성합니다.', '다음 줄에서 fc.in_features를 읽고 분류기를 교체하므로 fc를 가진 ResNet 객체가 필요합니다.');
  if (/nn\.Linear\(num_features_teacher/.test(a)) return result('teacher backbone 특징을 두 클래스 logits로 바꾸도록 마지막 fc를 교체합니다.', '백본 출력은 num_features_teacher이고 현재 데이터셋 클래스 수는 2입니다.');
  if (/CrossEntropyLoss/.test(a)) return result('두 클래스 logits와 정답 index를 비교하는 분류 손실을 만듭니다.', '모델이 raw logits를 출력하고 라벨이 클래스 index이므로 CrossEntropyLoss가 맞습니다.');
  if (/teacher_model\.fc\.parameters/.test(a)) return result('teacher의 새 분류기 fc 파라미터만 SGD로 학습하도록 optimizer를 만듭니다.', '전이학습에서 backbone은 유지하고 교체한 fc만 갱신해야 합니다.');
  if (/torch\.from_numpy/.test(a)) return result('표준화된 NumPy 그리드를 float tensor로 바꾸고 모델 device로 이동합니다.', '다음 모델 호출은 모델과 같은 device의 float PyTorch tensor를 요구합니다.');
  if (/predictions\.cpu/.test(a)) return result('평탄한 예측을 CPU NumPy 배열로 옮기고 시각화 grid shape로 복원합니다.', 'contourf의 predictions는 xx와 같은 2차원 shape여야 합니다.');
  if (/Resize\(\(224, 224\)\)/.test(a)) return result('입력 이미지를 CNN이 요구하는 224×224 크기로 고정합니다.', '배치 결합과 사전학습 모델 입력을 위해 모든 이미지 shape가 같아야 합니다.');
  if (/ToTensor/.test(a)) return result('PIL 이미지를 채널 우선 부동소수점 PyTorch tensor로 변환합니다.', '다음 Normalize와 모델 입력은 PIL 객체가 아닌 tensor를 요구합니다.');
  if (/Normalize/.test(a)) return result('이미지 tensor를 채널별 mean과 std로 표준화합니다.', '사전학습 모델이 기대하는 입력 분포를 맞추려면 ToTensor 뒤에 Normalize가 필요합니다.');
  if (/torch\.utils\.data\.DataLoader/.test(a)) return result('증강 trainset을 256개 배치로 묶고 shuffle·고정 메모리·병렬 로딩을 적용합니다.', '학습 루프가 배치를 반복하고 GPU 전송과 데이터 공급 효율을 높여야 합니다.');
  throw new Error(`해설 규칙 누락: ${problem.id} / ${answer}`);
}

for (const problem of apiProblems) {
  const sections = problem.blanks.map((blank, index) => {
    const { role, evidence } = explain(problem, blank.answer);
    return `빈칸 ${index + 1}\n정답: \`${blank.answer}\`\n역할: ${role}\n판단 근거: ${evidence}`;
  });
  problem.explanation = `${sections.join('\n\n')}\n\n완성하면 '${problem.title}' 단계의 입력 준비 → 핵심 API 호출 → 결과 사용 흐름이 연결됩니다.`;
}

for (const { file, payload } of sources) fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
console.log('모든 API 빈칸의 역할과 판단 근거를 코드 문맥에 맞게 다시 작성했습니다.');

function legacyApiNumber(problem) {
  return Number(/^api-generated-(\d+)$/.exec(problem.id)?.[1] || Number.POSITIVE_INFINITY);
}
