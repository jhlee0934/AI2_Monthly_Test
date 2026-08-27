import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'problems', 'exam_questions.json');
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));

function role(answer) {
  if (/\.add_node\(/.test(answer)) return '실행할 노드 이름과 함수를 그래프에 등록합니다.';
  if (/\.add_(?:conditional_)?edge/.test(answer)) return '등록된 노드 사이의 실행 경로 또는 조건 분기를 연결합니다.';
  if (/StateGraph\(/.test(answer)) return '지정된 state 스키마를 사용하는 워크플로 그래프를 생성합니다.';
  if (/\.compile\(/.test(answer)) return '정의된 노드와 경로를 검증해 실행 가능한 그래프로 컴파일합니다.';
  if (/\.invoke\(/.test(answer)) return '준비된 입력이나 state를 전달해 객체를 동기 실행하고 결과를 반환합니다.';
  if (/\.eval\(\)/.test(answer)) return '모델을 평가 모드로 전환해 추론 시 계층 동작을 고정합니다.';
  if (/no_grad/.test(answer)) return '추론 중 autograd 그래프 생성을 비활성화해 불필요한 메모리 사용을 막습니다.';
  if (/zero_grad/.test(answer)) return '이전 배치에서 누적된 기울기를 파라미터 갱신 전에 초기화합니다.';
  if (/backward/.test(answer)) return '현재 손실을 기준으로 학습 파라미터의 기울기를 계산합니다.';
  if (/\.step\(\)/.test(answer)) return '계산된 기울기를 사용해 optimizer가 파라미터를 갱신합니다.';
  if (/DataLoader/.test(answer)) return '데이터셋을 지정된 배치 단위와 순서로 공급하는 로더를 만듭니다.';
  if (/Compose/.test(answer)) return '여러 전처리 연산을 지정된 순서로 묶습니다.';
  if (/Linear|Embedding|LayerNorm|Dropout|ReLU/.test(answer)) return '앞뒤 텐서의 차원과 모델 구조에 맞는 계층 또는 연산을 구성합니다.';
  return '앞에서 준비된 객체와 입력을 사용해 다음 줄이 요구하는 반환값 또는 상태를 만듭니다.';
}

for (const problem of payload.problems) {
  if (problem.type !== 'api') continue;
  const answers = problem.blanks.map((blank, index) => (
    `빈칸 ${index + 1}\n정답: \`${blank.answer}\`\n역할: ${role(blank.answer)}\n판단 근거: 빈칸 앞에서 준비된 객체·입력과 뒤 연산이 요구하는 타입, shape 또는 실행 순서가 일치해야 합니다.`
  ));
  problem.explanation = `${answers.join('\n\n')}\n\n완성하면 '${problem.title}' 단계의 입력 준비 → 핵심 API 호출 → 결과 사용 흐름이 연결됩니다.`;
}

fs.writeFileSync(file, JSON.stringify(payload, null, 2));
console.log('현재 빈칸 번호를 기준으로 API 해설을 다시 생성했습니다.');
