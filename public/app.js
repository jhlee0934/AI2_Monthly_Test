import { basicSetup } from 'codemirror';
import { acceptCompletion, autocompletion, completeFromList } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

const STORAGE_KEY = 'monthly-ai-practice:v1';
const state = { problems: [], packId: 'monthly-ai', type: 'flow', current: 0, progress: loadProgress('monthly-ai'), shuffle: false, apiKey: '', model: 'gpt-5.4-mini', collapsedUnits: new Set() };
const $ = (selector) => document.querySelector(selector);
const els = { workspace: $('#workspace'), loading: $('#loading'), list: $('#problemList'), content: $('#content'), answer: $('#answerArea'), feedback: $('#feedback') };
const reportDialog = $('#reportDialog');

document.querySelectorAll('.tabs button').forEach((button) => button.addEventListener('click', () => { state.type = button.dataset.type; state.current = 0; document.querySelectorAll('.tabs button').forEach((item) => item.setAttribute('aria-selected', item === button)); render(); }));
$('#shuffleChoices').addEventListener('change', (event) => { state.shuffle = event.target.checked; renderProblem(); });
$('#globalApiKey').addEventListener('input', (event) => { state.apiKey = event.target.value.trim(); });
$('#globalModel').addEventListener('input', (event) => { state.model = event.target.value.trim(); });
$('#previous').addEventListener('click', () => move(-1)); $('#next').addEventListener('click', () => move(1));
$('#resetAll').addEventListener('click', () => { if (confirm('저장된 모든 답안과 채점 결과를 초기화할까요?')) { state.progress = {}; saveProgress(); render(); } });
$('#reportProblem').addEventListener('click', openProblemReport);
$('#closeReport').addEventListener('click', closeProblemReport);
$('#cancelReport').addEventListener('click', closeProblemReport);
$('#reportForm').addEventListener('submit', submitProblemReport);
reportDialog.addEventListener('click', (event) => { if (event.target === reportDialog) closeProblemReport(); });
document.addEventListener('keydown', (event) => { if (event.altKey && event.key === 'ArrowLeft') move(-1); if (event.altKey && event.key === 'ArrowRight') move(1); });

try {
  const response = await fetch('/api/problems');
  if (!response.ok) throw new Error('문제 자료 요청에 실패했습니다.');
  const payload = await response.json();
  if (!Array.isArray(payload.problems)) throw new Error('문제 자료 형식이 올바르지 않습니다.');
  if (payload.pack?.title) $('#packTitle').textContent = payload.pack.title;
  if (payload.pack?.description) $('#packDescription').textContent = payload.pack.description;
  state.packId = payload.pack?.id || 'default';
  state.progress = loadProgress(state.packId);
  state.problems = payload.problems;
  els.loading.hidden = true; els.workspace.hidden = false; render();
} catch (error) { showFatal(error.message); }

function filtered() { return state.problems.filter((item) => item.type === state.type); }
function render() {
  const items = filtered(); state.current = Math.min(state.current, Math.max(0, items.length - 1));
  if (items[state.current]) state.collapsedUnits.delete(`${state.type}:${items[state.current].unit}`);
  $('#count').textContent = `${items.length}개`;
  const groups = [...new Set(items.map((item) => item.unit))].map((unit) => ({ unit, entries: items.map((item, index) => ({ item, index })).filter((entry) => entry.item.unit === unit) }));
  els.list.innerHTML = items.length ? groups.map(({ unit, entries }) => { const key = `${state.type}:${unit}`; const isOpen = !state.collapsedUnits.has(key); const panelId = `unit-${hash(key)}`; return `<section class="unit-group ${isOpen ? 'open' : ''}" data-unit-key="${escapeHtml(key)}"><button class="unit-summary" type="button" aria-expanded="${isOpen}" aria-controls="${panelId}"><span>${escapeHtml(unit)} 단원</span><small>${entries.length}문제</small></button><div class="unit-panel" id="${panelId}"><div class="unit-problems">${entries.map(({ item, index }) => `<button class="problem-link ${index === state.current ? 'active' : ''}" data-index="${index}" data-problem-id="${escapeHtml(item.id)}"><span>${index + 1}. ${escapeHtml(item.title)}</span>${problemStatusMark(item.id)}</button>`).join('')}</div></div></section>`; }).join('') : '<div class="empty">등록된 문제가 없습니다.</div>';
  els.list.querySelectorAll('.unit-summary').forEach((button) => button.addEventListener('click', () => { const group = button.closest('.unit-group'); const key = group.dataset.unitKey; const willOpen = !group.classList.contains('open'); group.classList.toggle('open', willOpen); button.setAttribute('aria-expanded', String(willOpen)); if (willOpen) state.collapsedUnits.delete(key); else state.collapsedUnits.add(key); }));
  els.list.querySelectorAll('.problem-link').forEach((button) => button.addEventListener('click', () => { state.current = Number(button.dataset.index); render(); $('#problem').focus(); }));
  renderProgress(); renderProblem();
}
function renderProblem() {
  const items = filtered(); const problem = items[state.current];
  if (!problem) { $('#problem').hidden = true; return; } $('#problem').hidden = false;
  $('#unitBadge').textContent = problem.unit; $('#statusBadge').textContent = statusLabel(statusOf(problem.id)); $('#statusBadge').className = `status ${statusOf(problem.id)}`;
  $('#position').textContent = `${state.current + 1} / ${items.length}`; $('#title').textContent = problem.title;
  els.content.innerHTML = `${markdown(problem.content)}${problem.requirements.length ? `<section><h3>문제 요구사항</h3><ul>${problem.requirements.map((item) => `<li>${inline(item)}</li>`).join('')}</ul></section>` : ''}${problem.constraints?.length ? `<section><h3>제약 조건</h3><ul>${problem.constraints.map((item) => `<li>${inline(item)}</li>`).join('')}</ul></section>` : ''}${problem.skeleton && problem.type !== 'api' ? `<section><h3>제공 코드 또는 스켈레톤</h3>${code(problem.skeleton)}</section>` : ''}${problem.example ? `<section><h3>예시 입력·출력</h3>${code(problem.example)}</section>` : ''}`;
  els.feedback.innerHTML = '';
  if (problem.type === 'flow') renderFlow(problem); else if (problem.type === 'api') renderApi(problem); else renderCoding(problem);
  $('#previous').disabled = state.current === 0; $('#next').disabled = state.current === items.length - 1;
}
function renderFlow(problem) {
  const saved = state.progress[problem.id] || {};
  els.answer.innerHTML = `<section><label for="flowAnswer"><h3>내 답안</h3></label><textarea id="flowAnswer" rows="10" placeholder="핵심 개념과 판단 근거를 서술하세요.">${escapeHtml(saved.answer || '')}</textarea><button id="submitFlow">답안 제출</button></section>`;
  $('#flowAnswer').addEventListener('input', (event) => update(problem.id, { answer: event.target.value, status: saved.status === 'unanswered' ? 'unanswered' : undefined }, false));
  $('#submitFlow').addEventListener('click', () => gradeFlow(problem, $('#flowAnswer').value)); if (saved.submitted) showFlowFeedback(problem, saved);
}
function gradeFlow(problem, answer) {
  if (!answer.trim()) return message('답안을 먼저 입력해 주세요.', 'error');
  const normalized = normalize(answer); const exact = problem.acceptedAnswers.some((item) => normalize(item) === normalized);
  const hits = problem.keywords.filter((keyword) => normalized.includes(normalize(keyword))); const ratio = problem.keywords.length ? hits.length / problem.keywords.length : 0;
  const status = exact || ratio >= .75 ? 'correct' : ratio >= .35 ? 'partial' : 'incorrect';
  const missing = problem.keywords.filter((item) => !hits.includes(item)); const saved = { answer, submitted: true, status, missing };
  update(problem.id, saved); showFlowFeedback(problem, saved);
}
function showFlowFeedback(problem, saved) { els.feedback.innerHTML = `<div class="feedback ${saved.status}"><h3>${statusLabel(saved.status)}</h3>${saved.missing?.length && saved.status !== 'correct' ? `<p>다시 확인할 핵심 개념: ${saved.missing.map((item) => `<code>${escapeHtml(item)}</code>`).join(', ')}</p>` : ''}<details open><summary>모범 답안과 해설</summary>${problem.solution ? code(problem.solution) : '<p>원문에 별도 모범 답안이 없습니다.</p>'}${markdown(problem.explanation)}</details></div>`; }
function renderApi(problem) {
  const saved = state.progress[problem.id] || { selections: {} };
  const blanks = problem.blanks || [];
  els.answer.innerHTML = `<section><h3>코드 빈칸 채우기</h3>${blanks.length ? `<pre class="blank-code"><code>${renderBlankCode(problem, saved.selections || {})}</code></pre><div id="blankResults" class="blank-results"></div>` : '<p class="notice error">이 문서의 빈칸 정답을 자동 추출하지 못했습니다. 원본 스켈레톤과 정답 코드를 확인해 주세요.</p>'}<button id="submitApi" ${!blanks.length ? 'disabled' : ''}>정답 보기</button></section>`;
  els.answer.querySelectorAll('.blank-select').forEach((select) => select.addEventListener('change', () => { els.answer.querySelectorAll(`.blank-select[data-blank-id="${select.dataset.blankId}"]`).forEach((sameBlank) => { sameBlank.value = select.value; }); const selections = collectSelections(problem); update(problem.id, { selections }, false); }));
  $('#submitApi').addEventListener('click', () => gradeApi(problem)); if (saved.submitted) showApiFeedback(problem, saved);
}
function gradeApi(problem) { const selections = collectSelections(problem); if (Object.keys(selections).length < problem.blanks.length) return message('모든 빈칸의 답을 선택해 주세요.', 'error'); const results = problem.blanks.map((blank) => selections[blank.id] === blank.answer); const saved = { selections, results, submitted: true, status: results.every(Boolean) ? 'correct' : 'incorrect' }; update(problem.id, saved); showApiFeedback(problem, saved); }
function showApiFeedback(problem, saved) { const resultArea = $('#blankResults'); if (resultArea) resultArea.innerHTML = (saved.results || []).map((correct, index) => `<span class="blank-result ${correct ? 'correct' : 'incorrect'}">빈칸 ${index + 1}: ${correct ? '정답' : `오답 · 정답은 ${escapeHtml(problem.blanks[index].answer)}`}</span>`).join(''); els.feedback.innerHTML = `<div class="feedback ${saved.status}"><h3>${statusLabel(saved.status)}</h3><details open><summary>문제 설명과 정답 코드</summary>${code(problem.solution)}${markdown(problem.explanation)}</details></div>`; }
function renderCoding(problem) {
  const saved = state.progress[problem.id] || {}; const value = saved.code ?? problem.skeleton;
  els.answer.innerHTML = `<section><div class="editor-head"><h3>코드 편집기</h3><span id="charCount">${value.length.toLocaleString()} / 20,000자</span></div><div id="codeEditor" class="code-editor" aria-label="Python 코드 편집기"></div><p class="editor-help"><kbd>Tab</kbd> 자동완성 선택 또는 들여쓰기 · <kbd>Ctrl</kbd>+<kbd>Space</kbd> 자동완성 열기 · 괄호 자동 닫기</p><div class="button-row"><button id="resetCode" class="ghost">초기 코드로 되돌리기</button><button id="reviewCode">AI 코드 검토 요청</button></div></section>`;
  const completions = buildPythonCompletions(problem);
  const editor = new EditorView({
    parent: $('#codeEditor'),
    state: EditorState.create({ doc: value, extensions: [basicSetup, python(), oneDark, Prec.highest(keymap.of([{ key: 'Tab', run: acceptCompletion }, indentWithTab])), autocompletion({ override: [completeFromList(completions)], activateOnTyping: true }), EditorView.lineWrapping, EditorView.updateListener.of((viewUpdate) => { if (!viewUpdate.docChanged) return; const currentCode = viewUpdate.state.doc.toString(); $('#charCount').textContent = `${currentCode.length.toLocaleString()} / 20,000자`; update(problem.id, { code: currentCode }, false); })] }),
  });
  $('#resetCode').addEventListener('click', () => { if (confirm('작성한 코드를 초기 코드로 되돌릴까요?')) { update(problem.id, { code: problem.skeleton, review: null, submitted: false, status: 'unanswered' }); renderProblem(); } });
  $('#reviewCode').addEventListener('click', () => requestReview(problem, editor.state.doc.toString())); if (saved.review) showReview(saved.review);
}
function buildPythonCompletions(problem) {
  const keywords = ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'];
  const builtins = ['abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'filter', 'float', 'int', 'len', 'list', 'map', 'max', 'min', 'next', 'open', 'print', 'range', 'reversed', 'set', 'sorted', 'str', 'sum', 'super', 'tuple', 'type', 'zip'];
  const source = `${problem.skeleton}\n${problem.requirements.join('\n')}`;
  const dotted = [...source.matchAll(/\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+\b/g)].map((match) => match[0]);
  const identifiers = [...source.matchAll(/\b[A-Za-z_]\w*\b/g)].map((match) => match[0]).filter((word) => word.length > 2);
  const suggestions = new Map();
  keywords.forEach((label) => suggestions.set(label, { label, type: 'keyword', detail: 'Python 키워드' }));
  builtins.forEach((label) => suggestions.set(label, { label, type: 'function', detail: 'Python 내장 함수' }));
  identifiers.forEach((label) => { if (!suggestions.has(label)) suggestions.set(label, { label, type: 'variable', detail: '문제 관련 식별자' }); });
  dotted.forEach((fullName) => { const label = fullName.split('.').at(-1); suggestions.set(label, { label, type: 'property', detail: fullName }); });
  return [...suggestions.values()];
}
async function requestReview(problem, userCode) { if (!userCode.trim()) return message('검토할 코드를 입력해 주세요.', 'error'); if (!state.apiKey) return message('웹 상단에서 OpenAI API 키를 입력해 주세요.', 'error'); if (!state.model) return message('웹 상단에서 검토 모델 ID를 입력해 주세요.', 'error'); if (userCode.length > 20000) return message('코드는 20,000자 이하로 입력해 주세요.', 'error'); const button = $('#reviewCode'); button.disabled = true; button.textContent = '검토 중…'; message('AI가 요구사항을 기준으로 코드를 검토하고 있습니다…', 'loading'); try { const response = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problemId: problem.id, code: userCode, apiKey: state.apiKey, model: state.model }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || '검토 요청에 실패했습니다.'); const status = result.verdict === '통과 가능' ? 'correct' : result.verdict === '수정 필요' ? 'incorrect' : 'partial'; update(problem.id, { code: userCode, review: result, submitted: true, status }); showReview(result); } catch (error) { message(error.message, 'error'); } finally { button.disabled = false; button.textContent = 'AI 코드 검토 요청'; } }
function showReview(review) { els.feedback.innerHTML = `<div class="feedback"><h3>전체 판정: ${escapeHtml(review.verdict)}</h3><h4>요구사항별 확인</h4><ul>${review.requirements.map((item) => `<li><strong>${escapeHtml(item.status)}</strong> — ${escapeHtml(item.requirement)}<br><small>${escapeHtml(item.reason)}</small></li>`).join('')}</ul><h4>발견된 오류</h4>${review.errors.length ? review.errors.map((item) => `<div class="review-error"><strong>${escapeHtml(item.location)}</strong>${item.code ? code(item.code) : ''}<p>${escapeHtml(item.reason)}</p><p>수정 방향: ${escapeHtml(item.fix)}</p></div>`).join('') : '<p>정적 검토에서 특정 오류를 찾지 못했습니다.</p>'}<h4>누락된 예외 처리</h4>${review.missingEdgeCases.length ? `<ul>${review.missingEdgeCases.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>확인된 항목이 없습니다.</p>'}<h4>최소 수정안 또는 개선 예시</h4>${code(review.suggestion)}</div>`; }
function currentProblem() { return filtered()[state.current]; }
function openProblemReport() { const problem = currentProblem(); if (!problem) return; $('#reportProblemLabel').textContent = `${problem.unit} · ${problem.title} (${problem.id})`; $('#reportMessage').value = ''; $('#reportWebsite').value = ''; $('#reportStatus').textContent = ''; $('#reportStatus').className = 'report-status'; $('#submitReport').disabled = false; reportDialog.showModal(); $('#reportCategory').focus(); }
function closeProblemReport() { if (reportDialog.open) reportDialog.close(); }
async function submitProblemReport(event) {
  event.preventDefault();
  const problem = currentProblem(); if (!problem) return;
  const button = $('#submitReport'); const status = $('#reportStatus');
  button.disabled = true; button.textContent = '접수 중…'; status.textContent = 'GitHub에 문제 신고를 등록하고 있습니다…'; status.className = 'report-status loading';
  try {
    const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId: state.packId, problemId: problem.id, category: $('#reportCategory').value, message: $('#reportMessage').value, website: $('#reportWebsite').value }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || '신고 접수에 실패했습니다.');
    status.textContent = ''; status.className = 'report-status success'; status.append(document.createTextNode(result.message || '문제 신고가 접수되었습니다.'));
    if (typeof result.issueUrl === 'string' && result.issueUrl.startsWith('https://github.com/')) { const link = document.createElement('a'); link.href = result.issueUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ' 생성된 이슈 보기'; status.append(link); }
    $('#reportMessage').value = '';
  } catch (error) { status.textContent = error.message; status.className = 'report-status error'; button.disabled = false; }
  finally { button.textContent = '신고 접수'; }
}
function collectSelections(problem) { const result = {}; problem.blanks.forEach((blank) => { const selected = document.querySelector(`select[data-blank-id="${blank.id}"]`); if (selected?.value) result[blank.id] = selected.value; }); return result; }
function renderBlankCode(problem, selections) {
  const markerIndexes = new Map();
  const markerPattern = /_{2,}\[(\d+)\]/g;
  let output = ''; let cursor = 0;
  for (const match of problem.skeleton.matchAll(markerPattern)) {
    output += highlight(problem.skeleton.slice(cursor, match.index));
    const marker = match[1];
    if (!markerIndexes.has(marker)) markerIndexes.set(marker, markerIndexes.size);
    const index = markerIndexes.get(marker); const blank = problem.blanks[index];
    if (!blank) output += escapeHtml(match[0]);
    else output += `<select class="blank-select" data-blank-id="${blank.id}" aria-label="빈칸 ${index + 1}"><option value="">선택</option>${orderedChoices(blank).map((choice) => `<option value="${escapeHtml(choice)}" ${selections[blank.id] === choice ? 'selected' : ''}>${escapeHtml(choice)}</option>`).join('')}</select>`;
    cursor = match.index + match[0].length;
  }
  return output + highlight(problem.skeleton.slice(cursor));
}
function orderedChoices(blank) { if (!state.shuffle) return blank.choices; return [...blank.choices].sort((a, b) => hash(`${blank.id}${a}`) - hash(`${blank.id}${b}`)); }
function update(id, patch, rerender = true) { const current = state.progress[id] || {}; const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)); state.progress[id] = { ...current, ...cleanPatch }; saveProgress(); renderProgress(); if (rerender) { const badge = $('#statusBadge'); if (badge) { badge.textContent = statusLabel(statusOf(id)); badge.className = `status ${statusOf(id)}`; } renderListStatus(); } }
function renderProgress() { const relevant = state.problems.filter((item) => item.type === state.type); const done = relevant.filter((item) => state.progress[item.id]?.submitted).length; $('#progressText').textContent = `${done} / ${relevant.length} 완료`; $('#progressBar').style.width = `${relevant.length ? done / relevant.length * 100 : 0}%`; }
function renderListStatus() { filtered().forEach((item) => { const button = [...els.list.querySelectorAll('.problem-link')].find((target) => target.dataset.problemId === item.id); const oldMark = button?.querySelector('.result-mark'); if (oldMark) oldMark.remove(); if (button && state.progress[item.id]?.submitted) button.insertAdjacentHTML('beforeend', problemStatusMark(item.id)); }); }
function problemStatusMark(id) { const progress = state.progress[id]; if (!progress?.submitted) return ''; const correct = progress.status === 'correct'; return `<small class="result-mark ${correct ? 'correct' : 'incorrect'}" title="${correct ? '정답' : '오답'}" aria-label="${correct ? '정답' : '오답'}">${correct ? '✓' : '✕'}</small>`; }
function statusOf(id) { return state.progress[id]?.status || 'unanswered'; }
function statusLabel(status) { return ({ correct: '정답', incorrect: '오답', partial: '부분 정답', unanswered: '미풀이' })[status] || '미풀이'; }
function move(amount) { const items = filtered(); const next = state.current + amount; if (next >= 0 && next < items.length) { state.current = next; render(); $('#problem').focus(); } }
function progressKey(packId) { return packId === 'monthly-ai' ? STORAGE_KEY : `${STORAGE_KEY}:${packId}`; }
function loadProgress(packId) { try { return JSON.parse(localStorage.getItem(progressKey(packId))) || {}; } catch { return {}; } }
function saveProgress() { localStorage.setItem(progressKey(state.packId), JSON.stringify(state.progress)); }
function normalize(value) { return value.toLowerCase().replace(/\s+/g, '').replace(/["'`;]/g, ''); }
function hash(value) { return [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7); }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]); }
function inline(value = '') { return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>'); }
function markdown(value = '') { if (!value) return ''; return `<div class="markdown">${value.split(/\n{2,}/).map((block) => block.startsWith('- ') ? `<ul>${block.split('\n').map((line) => `<li>${inline(line.replace(/^- /, ''))}</li>`).join('')}</ul>` : `<p>${inline(block).replaceAll('\n', '<br>')}</p>`).join('')}</div>`; }
function code(value = '') { return `<pre><code>${highlight(value)}</code></pre>`; }
function highlight(value) { return escapeHtml(value).replace(/(&quot;.*?&quot;|'.*?')/g, '<span class="tok-string">$1</span>').replace(/\b(class|def|return|if|else|for|in|from|import|with|as|try|except|True|False|None|const|let|function)\b/g, '<span class="tok-keyword">$1</span>').replace(/(^|\s)(#.*)$/gm, '$1<span class="tok-comment">$2</span>'); }
function message(text, kind) { els.feedback.innerHTML = `<div class="notice ${kind}">${escapeHtml(text)}</div>`; }
function showFatal(text) { els.loading.hidden = true; const template = $('#errorTemplate').content.cloneNode(true); template.querySelector('p').textContent = text; document.querySelector('main').append(template); }
