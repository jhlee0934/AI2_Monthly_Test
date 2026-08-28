import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const requirement = [];
const flow = [
  mc('flow-sample-063', '1-2', 'Dataset과 DataLoader의 역할', 'TensorDataset과 DataLoader의 역할을 올바르게 구분한 것을 고르세요.', [
    'TensorDataset은 텐서를 샘플 단위로 묶고, DataLoader는 Dataset에서 배치를 구성하며 셔플 같은 로딩 정책을 적용합니다.',
    'TensorDataset은 모델 파라미터를 갱신하고, DataLoader는 손실 함수의 기울기를 계산합니다.',
    'TensorDataset은 배치 순서를 무작위화하고, DataLoader는 NumPy 배열을 텐서로 변환합니다.',
    'TensorDataset과 DataLoader는 모두 평가 모드에서 dropout을 비활성화하는 도구입니다.',
  ], 0, 'TensorDataset은 데이터의 샘플 구조를, DataLoader는 배치 크기와 셔플을 포함한 순회 방식을 담당합니다.', 'samples/chapter_1_2_ws/(실습-문제) 1-2_MLP 구현.ipynb'),
  mc('flow-sample-064', '2-1', 'BPE 병합의 토큰 경계', 'BPE 병합 정규식에서 앞뒤 토큰 경계를 확인하는 이유로 옳은 것을 고르세요.', [
    '문자열 일부가 우연히 일치한 경우까지 병합하지 않고, 공백으로 구분된 정확한 인접 토큰 쌍만 치환하기 위해서입니다.',
    '병합할 때마다 전체 vocabulary를 알파벳순으로 다시 정렬하기 위해서입니다.',
    '빈도가 낮은 토큰 쌍을 우선 선택하도록 정규식 점수를 계산하기 위해서입니다.',
    '모든 단어 끝 토큰을 삭제해 문장 길이를 일정하게 만들기 위해서입니다.',
  ], 1, '경계 조건은 선택한 bigram이 더 긴 문자열 내부에서 부분 일치하는 것을 막습니다.', 'samples/chapter_2_1_hw/(과제-문제) 2-1_토큰화 임베딩 심화 과제.ipynb'),
  mc('flow-sample-065', '2-2', 'API 키와 환경 변수', 'LLM API 키를 코드 문자열 대신 환경 변수에서 읽는 이유로 옳은 것을 고르세요.', [
    '비밀값을 소스 코드와 분리해 저장소 노출 위험을 줄이고 실행 환경별 설정을 코드 변경 없이 적용하기 위해서입니다.',
    '환경 변수에 저장하면 API 호출의 토큰 사용량이 자동으로 줄어들기 때문입니다.',
    '환경 변수는 모델 응답을 항상 JSON으로 변환해 주기 때문입니다.',
    '환경 변수에 넣은 키는 만료되거나 권한이 변경되지 않기 때문입니다.',
  ], 2, '환경 변수는 민감한 설정과 코드를 분리하지만 키 자체의 권한·회전 관리는 별도로 필요합니다.', 'samples/chapter_2_2_ws/(실습-문제) 2-2_합성 데이터 실습.ipynb'),
  mc('flow-sample-066', '3-1', 'Partial Fine-tuning 범위', 'Partial Fine-tuning에서 backbone 일부를 동결 해제하는 방식에 대한 설명으로 옳은 것을 고르세요.', [
    '분류 head와 상위 특징 레이어만 학습하면 전체 미세조정보다 계산량을 줄이면서 새 데이터에 필요한 고수준 특징을 조정할 수 있습니다.',
    '모든 backbone 레이어를 영구 동결하면 새 데이터에 맞게 특징 추출기 전체가 갱신됩니다.',
    '분류 head를 동결하고 입력 정규화 통계만 학습하는 것이 Partial Fine-tuning의 정의입니다.',
    '동결 해제 범위가 넓을수록 항상 과적합과 사전학습 표현 훼손이 감소합니다.',
  ], 3, 'Partial Fine-tuning은 head와 일부 상위 레이어만 갱신해 적응성과 비용 사이의 균형을 잡습니다.', 'samples/chapter_3_1_hw/(과제-문제) 3-1_Transfer Learning 기반의 CNN 모델 학습.ipynb'),
  mc('flow-sample-067', '3-2', '원격 추론과 로컬 파이프라인', 'HuggingFace Inference API와 로컬 Stable Diffusion 실행의 차이로 옳은 것을 고르세요.', [
    'Inference API는 원격 서버에서 모델을 실행해 로컬 GPU 부담을 줄이고, 로컬 파이프라인은 모델과 생성 설정을 직접 제어하는 대신 자원이 필요합니다.',
    'Inference API는 네트워크 없이 동작하고 로컬 파이프라인은 항상 외부 API 키가 필요합니다.',
    'Inference API에서 생성한 이미지는 평가할 수 없고 로컬 이미지만 CLIP 평가가 가능합니다.',
    '로컬 파이프라인은 seed와 negative prompt를 지정할 수 없지만 원격 API에서는 항상 지정됩니다.',
  ], 0, '원격 API는 인프라를 위임하고, 로컬 실행은 자원을 사용하는 대신 파이프라인 제어 범위가 넓습니다.', 'samples/chapter_3_2_hw/(과제-문제) 3-2_이미지 생성 및 평가와 모델 학습.ipynb'),
  mc('flow-sample-068', '4-1', '토큰 기준 문서 길이', 'RAG 청크를 문자 수뿐 아니라 모델 토큰 수로 확인해야 하는 이유로 옳은 것을 고르세요.', [
    '임베딩 모델의 입력 한도와 비용은 토큰 기준이므로 같은 문자 수라도 토큰화 결과에 따라 실제 입력 길이가 달라질 수 있습니다.',
    '토큰 수를 측정하면 문서의 의미 검색 점수가 항상 1로 정규화됩니다.',
    '문자 수와 토큰 수는 모든 언어와 토크나이저에서 항상 동일합니다.',
    '토큰 수는 retriever의 top_k를 자동으로 최적값으로 변경합니다.',
  ], 1, '모델 제한은 토큰 단위이므로 tiktoken 등 실제 토크나이저로 길이를 점검해야 합니다.', 'samples/chapter_4_1_hw/(과제-문제) 4-1_RAG 기반 Customer Service AI 에이전트 개발.ipynb'),
  mc('flow-sample-069', '4-2(1)', 'Direct Agent 패턴의 한계', 'Direct 패턴과 ReAct 패턴을 비교한 설명으로 옳은 것을 고르세요.', [
    'Direct 패턴은 정해진 단일 흐름에 단순하지만 도구 결과를 관찰해 재계획하기 어렵고, ReAct는 도구 실행과 관찰을 반복할 수 있습니다.',
    'Direct 패턴은 항상 도구를 반복 호출하지만 ReAct는 도구를 한 번만 호출합니다.',
    'Direct 패턴만 조건부 엣지를 사용할 수 있고 ReAct는 선형 엣지만 사용할 수 있습니다.',
    '두 패턴 모두 ToolMessage를 상태에 기록할 수 없다는 동일한 제약이 있습니다.',
  ], 2, 'Direct는 예측 가능한 단순 흐름에, ReAct는 관찰 결과에 따라 다음 행동이 달라지는 작업에 적합합니다.', 'samples/chapter_4_2_1_ws/(실습-문제) 4-2(1)_ReAct 기반 Agent 서비스 개발.ipynb'),
  mc('flow-sample-070', '4-2(2)', '단일 Agent의 복합 작업 한계', '복합 작업을 단일 Agent 대신 여러 전문 Worker로 나누는 이유로 옳은 것을 고르세요.', [
    '역할별 문맥과 책임을 분리해 각 하위 작업에 집중시키고 결과를 병렬 처리하거나 Supervisor가 통합할 수 있기 때문입니다.',
    'Worker 수가 늘면 모든 상태 충돌과 통합 오류가 자동으로 사라지기 때문입니다.',
    'Multi-Agent에서는 계획이나 결과 병합 단계가 필요하지 않기 때문입니다.',
    '단일 Agent는 LLM을 호출할 수 없고 Multi-Agent만 모델 호출이 가능하기 때문입니다.',
  ], 3, '전문화는 복합 작업의 집중도와 병렬성을 높이지만 상태 병합과 조정 규칙은 별도로 설계해야 합니다.', 'samples/chapter_4_2_2_ws/(실습-문제) 4-2(2)_Multi-Agent 대표 패턴 학습.ipynb'),
  mc('flow-sample-071', '5-1', '학습·추론 Chat Template', '학습과 추론에서 add_generation_prompt 설정을 다르게 사용하는 이유로 옳은 것을 고르세요.', [
    '학습 데이터에는 assistant 정답이 이미 있어 False를 사용하고, 추론에서는 모델 응답 시작 위치를 알려 주기 위해 True를 사용합니다.',
    '학습에서는 vocabulary를 늘리기 위해 True, 추론에서는 토큰화를 끄기 위해 False를 사용합니다.',
    'True는 LoRA rank를 두 배로 만들고 False는 adapter를 동결합니다.',
    '두 단계 모두 assistant 응답이 이미 포함되므로 항상 False만 사용해야 합니다.',
  ], 1, '생성 프롬프트는 추론 시 assistant 턴의 시작을 표시하며 학습 정답이 포함된 데이터에는 불필요합니다.', 'samples/chapter_5_1_ws/(실습-문제) 5-1_PEFT 파라미터 효율적 튜닝.ipynb'),
];

const api = [
  apiProblem('api-sample-045', '1-2', 'TensorDataset과 DataLoader 배치 구성', '전체 과정 중 텐서를 Dataset으로 묶고 훈련 배치를 섞어 로드하는 단계를 완성하세요.', 'train_ds = ____[1](X_train_t, y_train_t)\ntrain_loader = ____[2](train_ds, ____[3]=BATCH_SIZE, ____[4]=True)\nx_batch, y_batch = next(iter(train_loader))', [['TensorDataset', 'DataLoader', 'Dataset', 'Sequential'], ['DataLoader', 'TensorDataset', 'ModuleList', 'Sampler'], ['batch_size', 'shuffle', 'num_workers', 'drop_last'], ['shuffle', 'batch_size', 'training', 'random']], 'train_ds = TensorDataset(X_train_t, y_train_t)\ntrain_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)\nx_batch, y_batch = next(iter(train_loader))', '`TensorDataset`이 텐서를 샘플로 묶고 `DataLoader`가 batch_size와 shuffle 정책으로 배치를 만듭니다.', 'samples/chapter_1_2_ws/(실습-문제) 1-2_MLP 구현.ipynb'),
  apiProblem('api-sample-046', '2-1', 'BPE 토큰 경계 정규식', '전체 과정 중 선택한 BPE 토큰 쌍을 정확한 토큰 경계에서 병합하는 단계를 완성하세요.', 'bigram = re.____[1](" ".join(pair))\npattern = re.____[2](r"(?<!\\S)" + bigram + r"(?!\\S)")\nnew_word = pattern.____[3]("".join(pair), word)', [['escape', 'compile', 'sub', 'findall'], ['compile', 'escape', 'match', 'split'], ['sub', 'search', 'match', 'findall']], 'bigram = re.escape(" ".join(pair))\npattern = re.compile(r"(?<!\\S)" + bigram + r"(?!\\S)")\nnew_word = pattern.sub("".join(pair), word)', '`escape`로 토큰 문자열을 안전하게 만들고 경계 패턴을 `compile`한 뒤 `sub`로 선택한 쌍만 병합합니다.', 'samples/chapter_2_1_hw/(과제-문제) 2-1_토큰화 임베딩 심화 과제.ipynb'),
  apiProblem('api-sample-047', '2-2', 'Responses API 번역 호출', '전체 과정 중 Responses API에 모델·입력·지시문을 전달하고 텍스트 결과를 사용하는 단계를 완성하세요.', 'response = client.____[1].____[2](\n    model="gpt-5-mini",\n    input=test_question,\n    instructions=ZERO_SHOT_PROMPT,\n)\nzero_shot_result = {"korean": response.____[3]}', [['responses', 'chat', 'completions', 'embeddings'], ['create', 'invoke', 'parse', 'compile'], ['output_text', 'content', 'text', 'message']], 'response = client.responses.create(\n    model="gpt-5-mini",\n    input=test_question,\n    instructions=ZERO_SHOT_PROMPT,\n)\nzero_shot_result = {"korean": response.output_text}', '`responses.create`에 입력과 instructions를 전달하고 반환 객체의 `output_text`를 번역 결과로 사용합니다.', 'samples/chapter_2_2_hw/(과제-문제) 2-2_합성 데이터 생성 과제.ipynb'),
  apiProblem('api-sample-048', '3-1', 'ResNet 분류 Head 교체', '전체 과정 중 사전학습 ResNet의 기존 파라미터를 동결하고 새 클래스 수에 맞는 분류 Head를 구성하세요.', 'for param in model.____[1]():\n    param.____[2] = False\nmodel.fc = nn.____[3](model.fc.____[4], num_classes)', [['parameters', 'modules', 'children', 'buffers'], ['requires_grad', 'training', 'grad', 'is_leaf'], ['Linear', 'Sequential', 'Conv2d', 'ReLU'], ['in_features', 'out_features', 'num_features', 'hidden_size']], 'for param in model.parameters():\n    param.requires_grad = False\nmodel.fc = nn.Linear(model.fc.in_features, num_classes)', '기존 파라미터의 기울기를 끄고 `fc.in_features`를 입력 크기로 사용하는 새 `Linear` 분류기를 연결합니다.', 'samples/chapter_3_1_ws/(실습-문제) 3-1_Transfer Learning 기반의 CNN 모델 학습.ipynb'),
  apiProblem('api-sample-049', '3-2', 'Stable Diffusion 파이프라인 로드', '전체 과정 중 사전학습 Stable Diffusion 파이프라인을 불러와 연산 장치로 이동하는 단계를 완성하세요.', 'pipe = ____[1].____[2](model_id, torch_dtype=torch.float16)\npipe = pipe.____[3](device)\nimage = pipe(prompt=positive_prompt, negative_prompt=negative_prompt).images[0]', [['StableDiffusionPipeline', 'CLIPModel', 'AutoModel', 'Image'], ['from_pretrained', 'load', 'create', 'from_config'], ['to', 'eval', 'cuda', 'compile']], 'pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16)\npipe = pipe.to(device)\nimage = pipe(prompt=positive_prompt, negative_prompt=negative_prompt).images[0]', '`from_pretrained`로 파이프라인을 구성하고 `to(device)`로 이동한 뒤 positive/negative prompt를 함께 전달합니다.', 'samples/chapter_3_2_hw/(과제-문제) 3-2_이미지 생성 및 평가와 모델 학습.ipynb'),
  apiProblem('api-sample-050', '4-1', 'PDF 문서 일괄 로드', '전체 과정 중 PDF 경로별 loader를 만들고 문서를 하나의 목록에 누적하는 단계를 완성하세요.', 'all_documents = []\nfor pdf_path in glob.____[1]("data/*.pdf"):\n    loader = ____[2](pdf_path)\n    documents = loader.____[3]()\n    all_documents.____[4](documents)', [['glob', 'find', 'walk', 'listdir'], ['PyMuPDFLoader', 'TextLoader', 'DirectoryLoader', 'PDFParser'], ['load', 'invoke', 'read', 'parse'], ['extend', 'append', 'update', 'add']], 'all_documents = []\nfor pdf_path in glob.glob("data/*.pdf"):\n    loader = PyMuPDFLoader(pdf_path)\n    documents = loader.load()\n    all_documents.extend(documents)', '`glob`으로 PDF 경로를 찾고 각 `PyMuPDFLoader.load` 결과를 `extend`해 단일 문서 목록으로 합칩니다.', 'samples/chapter_4_1_ws/(실습-문제) 4-1_RAG 기반 Customer Service AI 에이전트 개발.ipynb'),
  apiProblem('api-sample-051', '4-2(1)', 'LLM Tool 바인딩', '전체 과정 중 LLM에 도구 목록을 바인딩하고 모델이 만든 tool call을 실행할 노드를 구성하세요.', 'tools = [search_policy, process_refund]\nllm_with_tools = llm.____[1](tools)\ntool_node = ____[2](tools)\nresponse = llm_with_tools.____[3](messages)', [['bind_tools', 'with_structured_output', 'assign', 'pipe'], ['ToolNode', 'StateGraph', 'ToolMessage', 'Runnable'], ['invoke', 'compile', 'execute', 'run']], 'tools = [search_policy, process_refund]\nllm_with_tools = llm.bind_tools(tools)\ntool_node = ToolNode(tools)\nresponse = llm_with_tools.invoke(messages)', '`bind_tools`가 도구 스키마를 LLM에 제공하고 `ToolNode`가 선택된 호출을 실행하며 `invoke`가 메시지를 전달합니다.', 'samples/chapter_4_2_1_ws/(실습-문제) 4-2(1)_ReAct 기반 Agent 서비스 개발.ipynb'),
  apiProblem('api-sample-052', '4-2(2)', 'Reflection 조건부 분기', '전체 과정 중 reflection 결과에 따라 종료하거나 worker를 다시 실행하는 조건부 엣지를 구성하세요.', 'workflow_reflection.____[1](\n    "reflection",\n    should_continue_reflection,\n    {"end": ____[2], "worker": "worker"},\n)\napp_reflection = workflow_reflection.____[3]()', [['add_conditional_edges', 'add_edge', 'add_node', 'set_entry_point'], ['END', 'START', 'None', '"end"'], ['compile', 'invoke', 'build', 'run']], 'workflow_reflection.add_conditional_edges(\n    "reflection",\n    should_continue_reflection,\n    {"end": END, "worker": "worker"},\n)\napp_reflection = workflow_reflection.compile()', '`add_conditional_edges`가 분기 함수의 결과를 END 또는 worker에 매핑하고 `compile`이 실행 가능한 그래프를 만듭니다.', 'samples/chapter_4_2_2_ws/(실습-문제) 4-2(2)_Multi-Agent 대표 패턴 학습.ipynb'),
  apiProblem('api-sample-053', '5-1', 'SFT 유효 배치 구성', '전체 과정 중 장치당 배치와 gradient accumulation을 함께 설정해 유효 배치 크기를 구성하세요.', 'train_cfg = ____[1](\n    output_dir="outputs-text2sql",\n    per_device_train_batch_size=____[2],\n    gradient_accumulation_steps=____[3],\n    learning_rate=5e-5,\n    max_steps=100,\n)', [['SFTConfig', 'LoraConfig', 'TrainingArguments', 'SFTTrainer'], ['1', '2', '4', '8'], ['4', '1', '2', '8']], 'train_cfg = SFTConfig(\n    output_dir="outputs-text2sql",\n    per_device_train_batch_size=1,\n    gradient_accumulation_steps=4,\n    learning_rate=5e-5,\n    max_steps=100,\n)', '`SFTConfig`에서 장치당 배치 1과 누적 단계 4를 조합해 매 스텝의 메모리 부담을 낮추면서 유효 배치를 구성합니다.', 'samples/chapter_5_1_hw/(과제-문제) 5-1_PEFT 파라미터 효율적 튜닝.ipynb'),
];

const assembly = [
  assemblyProblem('assembly-sample-1-2-01', '1-2', '훈련 DataLoader 조립', 'TensorDataset과 섞인 훈련 DataLoader를 구성하세요.', 'train_ds = ____[1](X_train_t, y_train_t)\ntrain_loader = ____[2](train_ds, ____[3]=BATCH_SIZE, ____[4]=____[5])', ['TensorDataset', 'DataLoader', 'batch_size', 'shuffle', 'True'], 'train_ds = TensorDataset(X_train_t, y_train_t)\ntrain_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)', 'samples/chapter_1_2_ws/(실습-문제) 1-2_MLP 구현.ipynb'),
  assemblyProblem('assembly-sample-2-1-01', '2-1', 'BPE 경계 병합 조립', '토큰 경계를 지키는 BPE 병합 정규식을 구성하세요.', 'bigram = re.____[1](" ".join(pair))\npattern = re.____[2](r"(?<!\\S)" + bigram + r"(?!\\S)")\nnew_word = pattern.____[3]("".join(pair), word)', ['escape', 'compile', 'sub'], 'bigram = re.escape(" ".join(pair))\npattern = re.compile(r"(?<!\\S)" + bigram + r"(?!\\S)")\nnew_word = pattern.sub("".join(pair), word)', 'samples/chapter_2_1_hw/(과제-문제) 2-1_토큰화 임베딩 심화 과제.ipynb'),
  assemblyProblem('assembly-sample-2-2-01', '2-2', 'Responses 번역 호출 조립', 'Responses API 호출과 출력 텍스트 사용을 조립하세요.', 'response = client.____[1].____[2](model="gpt-5-mini", input=test_question, instructions=ZERO_SHOT_PROMPT)\nresult = {"korean": response.____[3]}', ['responses', 'create', 'output_text'], 'response = client.responses.create(model="gpt-5-mini", input=test_question, instructions=ZERO_SHOT_PROMPT)\nresult = {"korean": response.output_text}', 'samples/chapter_2_2_hw/(과제-문제) 2-2_합성 데이터 생성 과제.ipynb'),
  assemblyProblem('assembly-sample-3-1-01', '3-1', 'ResNet Head 교체 조립', 'backbone을 동결하고 새 Linear 분류기를 연결하세요.', 'for param in model.____[1]():\n    param.____[2] = ____[3]\nmodel.fc = nn.____[4](model.fc.____[5], num_classes)', ['parameters', 'requires_grad', 'False', 'Linear', 'in_features'], 'for param in model.parameters():\n    param.requires_grad = False\nmodel.fc = nn.Linear(model.fc.in_features, num_classes)', 'samples/chapter_3_1_ws/(실습-문제) 3-1_Transfer Learning 기반의 CNN 모델 학습.ipynb'),
  assemblyProblem('assembly-sample-3-2-01', '3-2', 'Stable Diffusion 로드 조립', 'Stable Diffusion 파이프라인을 불러와 장치로 이동하세요.', 'pipe = ____[1].____[2](model_id, torch_dtype=torch.float16)\npipe = pipe.____[3](device)', ['StableDiffusionPipeline', 'from_pretrained', 'to'], 'pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16)\npipe = pipe.to(device)', 'samples/chapter_3_2_hw/(과제-문제) 3-2_이미지 생성 및 평가와 모델 학습.ipynb'),
  assemblyProblem('assembly-sample-4-1-01', '4-1', 'Retriever top_k 조립', 'Vector Store에서 top_k 설정을 가진 Retriever를 구성하고 검색하세요.', 'retriever = vectorstore.____[1](____[2]={____[3]: top_k})\ndocuments = retriever.____[4](query)', ['as_retriever', 'search_kwargs', '"k"', 'invoke'], 'retriever = vectorstore.as_retriever(search_kwargs={"k": top_k})\ndocuments = retriever.invoke(query)', 'samples/chapter_4_1_hw/(과제-문제) 4-1_RAG 기반 Customer Service AI 에이전트 개발.ipynb'),
  assemblyProblem('assembly-sample-4-2-1-01', '4-2(1)', 'ReAct 순환 엣지 조립', 'agent 조건 분기와 tools에서 agent로 돌아오는 ReAct 순환을 구성하세요.', 'workflow_react.____[1]("agent", should_continue_react)\nworkflow_react.____[2]("tools", "agent")\nagent_react = workflow_react.____[3]()', ['add_conditional_edges', 'add_edge', 'compile'], 'workflow_react.add_conditional_edges("agent", should_continue_react)\nworkflow_react.add_edge("tools", "agent")\nagent_react = workflow_react.compile()', 'samples/chapter_4_2_1_ws/(실습-문제) 4-2(1)_ReAct 기반 Agent 서비스 개발.ipynb'),
  assemblyProblem('assembly-sample-4-2-2-01', '4-2(2)', 'Reflection 분기 조립', 'reflection 결과를 END 또는 worker로 연결하고 그래프를 컴파일하세요.', 'workflow.____[1]("reflection", should_continue, {"end": ____[2], "worker": "worker"})\napp = workflow.____[3]()', ['add_conditional_edges', 'END', 'compile'], 'workflow.add_conditional_edges("reflection", should_continue, {"end": END, "worker": "worker"})\napp = workflow.compile()', 'samples/chapter_4_2_2_ws/(실습-문제) 4-2(2)_Multi-Agent 대표 패턴 학습.ipynb'),
  assemblyProblem('assembly-sample-5-1-01', '5-1', '추론 Chat Template 조립', '추론용 메시지에 생성 프롬프트를 추가해 텍스트로 변환하세요.', 'text = tokenizer.____[1](messages, ____[2]=____[3], ____[4]=____[5])', ['apply_chat_template', 'tokenize', 'False', 'add_generation_prompt', 'True'], 'text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)', 'samples/chapter_5_1_ws/(실습-문제) 5-1_PEFT 파라미터 효율적 튜닝.ipynb'),
];

for (const problem of [...flow, ...api, ...assembly]) upsert(problem);
console.log(`${flow.length + api.length + assembly.length}개 sample 기반 문제를 추가했습니다.`);

function mc(id, unit, title, content, choices, answerIndex, explanation, source) {
  const [answer, ...distractors] = choices;
  const orderedChoices = [...distractors];
  orderedChoices.splice(answerIndex, 0, answer);
  return { id, unit, type: 'flow', title, content, requirements: requirement, choices: orderedChoices, answer, solution: answer, explanation, example: '', source };
}
function apiProblem(id, unit, title, content, skeleton, specs, solution, explanation, source) {
  const answers = extractAnswers(skeleton, solution);
  return { id, unit, type: 'api', title, content, requirements: [], skeleton, blanks: answers.map((answer, index) => ({ id: `blank-${index + 1}`, answer, choices: specs[index] })), solution, explanation, example: '', source };
}
function assemblyProblem(id, unit, title, content, skeleton, answers, solution, source) {
  const slots = answers.map((answer, index) => ({ id: `slot-${index + 1}`, answer }));
  return { id, unit, type: 'assembly', title, content, requirements: ['핵심 API, 메서드, 인자와 값을 배치한다.'], skeleton, slots, tokens: [...new Set([...answers, 'None', 'transform'])], solution, protectedRanges: [], explanation: '샘플 노트북의 완성 코드를 기준으로 핵심 호출 흐름을 조립합니다.', example: '', source, origin: 'sample-generated' };
}
function extractAnswers(skeleton, solution) {
  const skeletonTokens = [...skeleton.matchAll(/____\[(\d+)\]/g)];
  const escaped = skeleton.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/____\\\[\d+\\\]/g, '([\\s\\S]+?)');
  const match = solution.match(new RegExp(`^${escaped}$`));
  if (!match || match.length - 1 !== skeletonTokens.length) throw new Error(`API 정답 추출 실패: ${skeleton}`);
  return match.slice(1);
}
function upsert(problem) {
  const file = path.join(root, 'problems', problem.type, `${problem.unit}.json`);
  const payload = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { problems: [] };
  const index = payload.problems.findIndex((item) => item.id === problem.id);
  if (index >= 0) payload.problems[index] = problem;
  else payload.problems.push(problem);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}
