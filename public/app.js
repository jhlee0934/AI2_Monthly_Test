const STORAGE_KEY = 'monthly-ai-practice:v1';
const state = { problems: [], packId: 'monthly-ai', type: 'flow', current: 0, progress: loadProgress('monthly-ai'), shuffle: false, collapsedUnits: new Set(), assemblySlotId: null, assemblyDifficulty: 'normal' };
const $ = (selector) => document.querySelector(selector);
const els = { workspace: $('#workspace'), loading: $('#loading'), list: $('#problemList'), content: $('#content'), answer: $('#answerArea'), feedback: $('#feedback') };

document.querySelectorAll('.tabs button').forEach((button) => button.addEventListener('click', () => { state.type = button.dataset.type; state.current = 0; state.assemblySlotId = null; document.querySelectorAll('.tabs button').forEach((item) => item.setAttribute('aria-selected', item === button)); render(); }));
document.querySelectorAll('[data-assembly-difficulty]').forEach((button) => button.addEventListener('click', () => { const problem = filtered()[state.current]; if (problem?.type === 'assembly') setAssemblyDifficulty(problem, button.dataset.assemblyDifficulty); }));
$('#shuffleChoices').addEventListener('change', (event) => { state.shuffle = event.target.checked; renderProblem(); });
$('#previous').addEventListener('click', () => move(-1)); $('#next').addEventListener('click', () => move(1));
$('#resetAll').addEventListener('click', () => { if (confirm('저장된 모든 답안과 채점 결과를 초기화할까요?')) { state.progress = {}; saveProgress(); render(); } });
document.addEventListener('keydown', (event) => { if (event.altKey && event.key === 'ArrowLeft') move(-1); if (event.altKey && event.key === 'ArrowRight') move(1); });

try {
  const response = await fetch('./data/problems.json', { cache: 'no-store' });
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

function filtered() { return state.problems.filter((item) => item.type === state.type).sort((a, b) => a.unit.localeCompare(b.unit, 'ko', { numeric: true })); }
function render() {
  const items = filtered(); state.current = Math.min(state.current, Math.max(0, items.length - 1));
  $('#assemblyDifficultyControl').hidden = state.type !== 'assembly'; syncDifficultyButtons();
  if (items[state.current]) state.collapsedUnits.delete(`${state.type}:${items[state.current].unit}`);
  $('#count').textContent = `${items.length}개`;
  const groups = [...new Set(items.map((item) => item.unit))].map((unit) => ({ unit, entries: items.map((item, index) => ({ item, index })).filter((entry) => entry.item.unit === unit) }));
  els.list.innerHTML = items.length ? groups.map(({ unit, entries }) => { const key = `${state.type}:${unit}`; const isOpen = !state.collapsedUnits.has(key); const panelId = `unit-${hash(key)}`; return `<section class="unit-group ${isOpen ? 'open' : ''}" data-unit-key="${escapeHtml(key)}"><button class="unit-summary" type="button" aria-expanded="${isOpen}" aria-controls="${panelId}"><span>${escapeHtml(unit)} 단원</span><small>${entries.length}문제</small></button><div class="unit-panel" id="${panelId}"><div class="unit-problems">${entries.map(({ item, index }) => `<button class="problem-link ${index === state.current ? 'active' : ''}" data-index="${index}" data-problem-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.title)}</span>${problemStatusMark(item.id)}</button>`).join('')}</div></div></section>`; }).join('') : '<div class="empty">등록된 문제가 없습니다.</div>';
  els.list.querySelectorAll('.unit-summary').forEach((button) => button.addEventListener('click', () => { const group = button.closest('.unit-group'); const key = group.dataset.unitKey; const willOpen = !group.classList.contains('open'); group.classList.toggle('open', willOpen); button.setAttribute('aria-expanded', String(willOpen)); if (willOpen) state.collapsedUnits.delete(key); else state.collapsedUnits.add(key); }));
  els.list.querySelectorAll('.problem-link').forEach((button) => button.addEventListener('click', () => { state.current = Number(button.dataset.index); render(); $('#problem').focus(); }));
  renderProgress(); renderProblem();
}
function renderProblem() {
  const items = filtered(); const problem = items[state.current];
  if (!problem) { $('#problem').hidden = true; return; } $('#problem').hidden = false;
  $('#unitBadge').textContent = problem.unit; $('#statusBadge').textContent = statusLabel(statusOf(problem.id)); $('#statusBadge').className = `status ${statusOf(problem.id)}`;
  $('#position').textContent = `${state.current + 1} / ${items.length}`; $('#title').textContent = problem.title;
  els.content.innerHTML = `${markdown(problem.content)}${problem.requirements.length ? `<section><h3>문제 요구사항</h3><ul>${problem.requirements.map((item) => `<li>${inline(item)}</li>`).join('')}</ul></section>` : ''}${problem.constraints?.length ? `<section><h3>제약 조건</h3><ul>${problem.constraints.map((item) => `<li>${inline(item)}</li>`).join('')}</ul></section>` : ''}${problem.skeleton && problem.type === 'flow' ? `<section><h3>제공 코드 또는 스켈레톤</h3>${code(problem.skeleton)}</section>` : ''}${problem.example ? `<section><h3>예시 입력·출력</h3>${code(problem.example)}</section>` : ''}`;
  els.feedback.innerHTML = '';
  if (problem.type === 'flow') renderFlow(problem); else if (problem.type === 'api') renderApi(problem); else renderAssembly(problem);
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
function gradeApi(problem) { const selections = collectSelections(problem); const results = problem.blanks.map((blank) => selections[blank.id] === blank.answer); const saved = { selections, results, submitted: true, status: results.every(Boolean) ? 'correct' : 'incorrect' }; update(problem.id, saved); showApiFeedback(problem, saved); }
function showApiFeedback(problem, saved) { const resultArea = $('#blankResults'); if (resultArea) resultArea.innerHTML = (saved.results || []).map((correct, index) => `<span class="blank-result ${correct ? 'correct' : 'incorrect'}">빈칸 ${index + 1}: ${correct ? '정답' : '오답'}</span>`).join(''); els.feedback.innerHTML = `<div class="feedback ${saved.status}"><h3>${statusLabel(saved.status)}</h3><details open><summary>해설</summary>${markdown(problem.explanation)}</details></div>`; }
function renderAssembly(problem) {
  const spec = assemblySpec(problem);
  const saved = assemblySaved(problem);
  const rootSaved = state.progress[problem.id] || {};
  if (rootSaved.submitted !== Boolean(saved.submitted) || rootSaved.status !== (saved.status || 'unanswered')) update(problem.id, { submitted: Boolean(saved.submitted), status: saved.status || 'unanswered' }, false);
  const badge = $('#statusBadge'); badge.textContent = statusLabel(saved.status || 'unanswered'); badge.className = `status ${saved.status || 'unanswered'}`;
  const selections = saved.selections || {};
  if (!spec.slots.some((slot) => slot.id === state.assemblySlotId)) state.assemblySlotId = spec.slots.find((slot) => !selections[slot.id])?.id || spec.slots[0]?.id;
  const groups = groupAssemblyTokens(spec);
  const activeIndex = Math.max(0, spec.slots.findIndex((slot) => slot.id === state.assemblySlotId));
  const filledCount = spec.slots.filter((slot) => selections[slot.id]).length;
  els.answer.innerHTML = `<section class="assembly"><div class="assembly-head"><div><h3>TODO 코드 조립</h3><p>채울 슬롯을 누른 뒤 코드 조각을 선택하세요. 선택 후 다음 빈 슬롯으로 자동 이동합니다.</p></div></div>${state.assemblyDifficulty === 'hard' ? '<p class="difficulty-note">어려움: 제공된 프롬프트를 제외한 완성 코드의 키워드·변수·메서드·값을 모두 직접 배치합니다.</p>' : ''}<div class="slot-navigator"><strong id="assemblySlotProgress">현재 슬롯 ${activeIndex + 1} / ${spec.slots.length}</strong><span>입력 ${filledCount} / ${spec.slots.length}</span><div><button type="button" id="previousAssemblySlot" class="ghost" aria-label="이전 코드 슬롯">← 이전</button><button type="button" id="nextAssemblySlot" class="ghost" aria-label="다음 코드 슬롯">다음 →</button></div></div><pre class="assembly-code" tabindex="0" aria-label="가로로 스크롤할 수 있는 코드 조립 영역"><code>${renderAssemblyCode(spec, selections)}</code></pre><div class="slot-help"><button type="button" id="revealAssemblySlot" class="ghost">선택 슬롯 정답 보기</button><small>확인한 슬롯은 제출 시 오답으로 처리됩니다.</small></div><div class="token-bank" aria-label="사용 가능한 코드 조각">${groups.map(({ label, tokens }) => `<section class="token-group"><h4>${label}</h4><div>${tokens.map((token) => `<button type="button" class="code-token" data-token="${escapeHtml(token)}"><code>${escapeHtml(token)}</code></button>`).join('')}</div></section>`).join('')}</div><div class="assembly-actions"><button type="button" id="clearAssembly" class="ghost">선택 슬롯 비우기</button><button type="button" id="submitAssembly">코드 확인</button></div><div id="assemblyResults" class="blank-results"></div></section>`;
  els.answer.querySelectorAll('.assembly-slot').forEach((button) => button.addEventListener('click', () => selectAssemblySlot(button.dataset.slotId)));
  els.answer.querySelectorAll('.code-token').forEach((button) => button.addEventListener('click', () => placeAssemblyToken(problem, button.dataset.token)));
  $('#clearAssembly').addEventListener('click', () => clearAssemblySlot(problem));
  $('#revealAssemblySlot').addEventListener('click', () => revealAssemblySlot(problem));
  $('#previousAssemblySlot').addEventListener('click', () => moveAssemblySlot(spec, -1));
  $('#nextAssemblySlot').addEventListener('click', () => moveAssemblySlot(spec, 1));
  $('#submitAssembly').addEventListener('click', () => gradeAssembly(problem));
  selectAssemblySlot(state.assemblySlotId);
  if (saved.submitted) showAssemblyFeedback(problem, saved);
}
function assemblySpec(problem) { return state.assemblyDifficulty === 'hard' ? buildHardAssembly(problem) : problem; }
function assemblySaved(problem) { return state.progress[problem.id]?.assemblyModes?.[state.assemblyDifficulty] || {}; }
function saveAssemblyMode(problem, patch, rerender = false) { const current = state.progress[problem.id] || {}; const modes = current.assemblyModes || {}; const next = { ...(modes[state.assemblyDifficulty] || {}), ...patch }; update(problem.id, { assemblyModes: { ...modes, [state.assemblyDifficulty]: next }, submitted: Boolean(next.submitted), status: next.status || 'unanswered' }, rerender); return next; }
function syncDifficultyButtons() { document.querySelectorAll('[data-assembly-difficulty]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.assemblyDifficulty === state.assemblyDifficulty))); }
function setAssemblyDifficulty(problem, difficulty) { if (difficulty === state.assemblyDifficulty) return; state.assemblyDifficulty = difficulty; state.assemblySlotId = null; syncDifficultyButtons(); const saved = assemblySaved(problem); update(problem.id, { submitted: Boolean(saved.submitted), status: saved.status || 'unanswered' }, false); els.feedback.innerHTML = ''; renderAssembly(problem); const badge = $('#statusBadge'); badge.textContent = statusLabel(saved.status || 'unanswered'); badge.className = `status ${saved.status || 'unanswered'}`; }
function buildHardAssembly(problem) {
  const slots = []; const tokens = []; let skeleton = ''; let cursor = 0;
  const lexical = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  for (const match of problem.solution.matchAll(lexical)) {
    if (problem.protectedRanges?.some((range) => match.index >= range.start && match.index < range.end)) continue;
    skeleton += problem.solution.slice(cursor, match.index);
    const answer = match[0]; const id = `hard-${slots.length + 1}`;
    const before = problem.solution.slice(0, match.index).trimEnd();
    const category = before.endsWith('.') ? 'method' : assemblyTokenCategory(answer);
    slots.push({ id, answer, category });
    if (!tokens.includes(answer)) tokens.push(answer);
    skeleton += `____[${slots.length}]`;
    cursor = match.index + answer.length;
  }
  return { ...problem, skeleton: skeleton + problem.solution.slice(cursor), slots, tokens };
}
function renderAssemblyCode(spec, selections) {
  const markerPattern = /_{2,}\[(\d+)\]/g;
  let output = ''; let cursor = 0;
  for (const match of spec.skeleton.matchAll(markerPattern)) {
    output += highlight(spec.skeleton.slice(cursor, match.index));
    const slot = spec.slots[Number(match[1]) - 1];
    if (!slot) output += escapeHtml(match[0]);
    else {
      const value = selections[slot.id];
      output += `<button type="button" class="assembly-slot ${state.assemblySlotId === slot.id ? 'selected' : ''} ${value ? 'filled' : ''}" data-slot-id="${escapeHtml(slot.id)}" aria-label="코드 슬롯 ${match[1]}${value ? `, 현재 값 ${escapeHtml(value)}` : ''}">${value ? escapeHtml(value) : `슬롯 ${match[1]}`}</button>`;
    }
    cursor = match.index + match[0].length;
  }
  return output + highlight(spec.skeleton.slice(cursor));
}
function assemblyTokenCategory(token) { if (/^(?:True|False|None|import|from|as|def|return|for|in|if|else|with)$/.test(token)) return 'keyword'; if (/^(?:"[\s\S]*"|'[\s\S]*'|\d+(?:\.\d+)?)$/.test(token)) return 'value'; return 'name'; }
function groupAssemblyTokens(spec) {
  const labels = { keyword: '키워드', name: '변수·클래스', method: '메서드·속성', value: '값·문자열' };
  const groups = new Map(Object.keys(labels).map((key) => [key, []]));
  const markers = [...spec.skeleton.matchAll(/_{2,}\[(\d+)\]/g)];
  for (const token of spec.tokens) {
    const related = spec.slots.map((slot, index) => ({ slot, match: markers[index] })).filter(({ slot }) => slot.answer === token);
    const category = related.some(({ slot, match }) => slot.category === 'method' || spec.skeleton.slice(0, match?.index).trimEnd().endsWith('.')) ? 'method' : related[0]?.slot.category || assemblyTokenCategory(token);
    groups.get(category).push(token);
  }
  return [...groups].filter(([, tokens]) => tokens.length).map(([category, tokens]) => ({ label: labels[category], tokens: state.shuffle ? [...tokens].sort((a, b) => hash(`${spec.id}${a}`) - hash(`${spec.id}${b}`)) : tokens }));
}
function selectAssemblySlot(id) { if (!id) return; state.assemblySlotId = id; const slots = [...els.answer.querySelectorAll('.assembly-slot')]; slots.forEach((button) => button.classList.toggle('selected', button.dataset.slotId === id)); const index = slots.findIndex((button) => button.dataset.slotId === id); const progress = $('#assemblySlotProgress'); if (progress && index >= 0) progress.textContent = `현재 슬롯 ${index + 1} / ${slots.length}`; requestAnimationFrame(() => ensureAssemblySlotVisible(slots[index])); }
function moveAssemblySlot(spec, amount) { const index = spec.slots.findIndex((slot) => slot.id === state.assemblySlotId); const next = Math.min(spec.slots.length - 1, Math.max(0, index + amount)); selectAssemblySlot(spec.slots[next]?.id); }
function ensureAssemblySlotVisible(slot) { const codeArea = slot?.closest('.assembly-code'); if (!slot || !codeArea) return; const slotBox = slot.getBoundingClientRect(); const codeBox = codeArea.getBoundingClientRect(); if (slotBox.left < codeBox.left + 16 || slotBox.right > codeBox.right - 16) codeArea.scrollTo({ left: codeArea.scrollLeft + slotBox.left - codeBox.left - codeBox.width / 2 + slotBox.width / 2, behavior: 'smooth' }); }
function placeAssemblyToken(problem, token) {
  const spec = assemblySpec(problem); const saved = assemblySaved(problem);
  const current = spec.slots.find((slot) => slot.id === state.assemblySlotId) || spec.slots.find((slot) => !saved.selections?.[slot.id]);
  if (!current) return;
  const selections = { ...(saved.selections || {}), [current.id]: token };
  state.assemblySlotId = spec.slots.find((slot) => !selections[slot.id])?.id || current.id;
  saveAssemblyMode(problem, { selections, submitted: false, status: 'unanswered', results: [] });
  els.feedback.innerHTML = '';
  renderAssembly(problem);
}
function clearAssemblySlot(problem) {
  const spec = assemblySpec(problem); const saved = assemblySaved(problem); const current = spec.slots.find((slot) => slot.id === state.assemblySlotId);
  if (!current) return;
  const selections = { ...(saved.selections || {}) };
  delete selections[current.id];
  saveAssemblyMode(problem, { selections, submitted: false, status: 'unanswered', results: [] });
  els.feedback.innerHTML = '';
  renderAssembly(problem);
}
function revealAssemblySlot(problem) {
  const spec = assemblySpec(problem); const saved = assemblySaved(problem);
  const current = spec.slots.find((slot) => slot.id === state.assemblySlotId) || spec.slots.find((slot) => !saved.selections?.[slot.id]);
  if (!current) return;
  const selections = { ...(saved.selections || {}), [current.id]: current.answer };
  const revealed = [...new Set([...(saved.revealed || []), current.id])];
  state.assemblySlotId = spec.slots.find((slot) => !selections[slot.id])?.id || current.id;
  saveAssemblyMode(problem, { selections, revealed, submitted: false, status: 'unanswered', results: [] });
  els.feedback.innerHTML = '';
  renderAssembly(problem);
}
function gradeAssembly(problem) {
  const spec = assemblySpec(problem); const savedMode = assemblySaved(problem); const selections = savedMode.selections || {}; const revealed = savedMode.revealed || [];
  if (spec.slots.some((slot) => !selections[slot.id])) return message('모든 코드 슬롯을 채워 주세요.', 'error');
  const results = spec.slots.map((slot) => !revealed.includes(slot.id) && selections[slot.id] === slot.answer);
  const saved = { selections, revealed, results, submitted: true, status: results.every(Boolean) ? 'correct' : 'incorrect' };
  saveAssemblyMode(problem, saved, true);
  showAssemblyFeedback(problem, saved);
}
function showAssemblyFeedback(problem, saved) { const resultArea = $('#assemblyResults'); const wrong = saved.results.map((correct, index) => correct ? null : index + 1).filter(Boolean); if (resultArea) resultArea.innerHTML = wrong.length ? `<span class="blank-result incorrect">다시 확인할 슬롯: ${wrong.join(', ')}</span>` : '<span class="blank-result correct">모든 코드 조각이 올바릅니다.</span>'; els.feedback.innerHTML = `<div class="feedback ${saved.status}"><h3>${statusLabel(saved.status)}</h3><details open><summary>완성 코드와 해설</summary>${code(problem.solution)}${markdown(problem.explanation)}</details></div>`; }
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
function highlight(value) { return escapeHtml(value).replace(/(&quot;.*?&quot;|'.*?')/g, '<span data-syntax="string">$1</span>').replace(/\b(class|def|return|if|else|for|in|from|import|with|as|try|except|True|False|None|const|let|function)\b/g, '<span data-syntax="keyword">$1</span>').replace(/(^|\s)(#.*)$/gm, '$1<span data-syntax="comment">$2</span>'); }
function message(text, kind) { els.feedback.innerHTML = `<div class="notice ${kind}">${escapeHtml(text)}</div>`; }
function showFatal(text) { els.loading.hidden = true; const template = $('#errorTemplate').content.cloneNode(true); template.querySelector('p').textContent = text; document.querySelector('main').append(template); }
