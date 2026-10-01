/* =============================================
   STUDYZONE — APP LOGIC
   ============================================= */

// ── STATE ────────────────────────────────────────────────────────────────────
let state = {
  subjects: [],
  sessions: [],   // Planned sessions
  logs: [],       // Completed timer sessions
  streak: 0,
  lastStudyDate: null,
  currentSubjectId: null,
};

// ── PERSISTENCE ──────────────────────────────────────────────────────────────
function save() {
  try { localStorage.setItem('studyzone_v2', JSON.stringify(state)); } catch(e) {}
}
function load() {
  try {
    const raw = localStorage.getItem('studyzone_v2');
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch(e) {}
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function fmt(mins) {
  if (mins < 60) return mins + ' min';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtSecs(s) {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function today() { return new Date().toISOString().slice(0,10); }

// ── VIEWS ─────────────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  const btn = document.querySelector(`[data-view="${name}"]`);
  if (btn) btn.classList.add('active');
  const titles = { dashboard: 'Dashboard', subjects: 'Subjects & Topics',
    planner: 'Study Planner', timer: 'Focus Timer', progress: 'Progress' };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
  closeSidebar();
  if (name === 'dashboard') renderDashboard();
  if (name === 'subjects') renderSubjects();
  if (name === 'planner') renderPlanner();
  if (name === 'timer') populateTimerSelects();
  if (name === 'progress') renderProgress();
}

// ── SIDEBAR MOBILE ────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
}

// ── SUBJECTS ──────────────────────────────────────────────────────────────────
let selectedColor = '#6366f1';
document.addEventListener('click', e => {
  if (e.target.classList.contains('color-dot')) {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
    e.target.classList.add('selected');
    selectedColor = e.target.dataset.color;
  }
});

function toggleAddSubjectForm() {
  const f = document.getElementById('addSubjectForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    document.getElementById('subjectName').focus();
  }
}

function addSubject() {
  const name = document.getElementById('subjectName').value.trim();
  if (!name) { shakeEl('subjectName'); return; }
  const howTo = document.getElementById('subjectHowTo').value.trim();
  const goal = parseInt(document.getElementById('subjectGoal').value) || 0;
  const subject = {
    id: uid(),
    name,
    color: selectedColor,
    howTo,
    goal,
    topics: [],
    totalMins: 0,
    createdAt: Date.now()
  };
  state.subjects.push(subject);
  save();
  document.getElementById('subjectName').value = '';
  document.getElementById('subjectHowTo').value = '';
  document.getElementById('subjectGoal').value = '';
  document.getElementById('addSubjectForm').classList.remove('open');
  renderSubjects();
  renderSidebarSubjects();
  updateDashboardStats();
  logActivity(`Added subject "${name}"`);
}

function deleteSubject(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this subject and all its topics?')) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  state.sessions = state.sessions.filter(s => s.subjectId !== id);
  save();
  renderSubjects();
  renderSidebarSubjects();
  updateDashboardStats();
}

function renderSubjects() {
  const grid = document.getElementById('subjectsGrid');
  if (!state.subjects.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><h3>No subjects yet</h3><p>Click "+ New Subject" to create your first one.</p></div>`;
    return;
  }
  grid.innerHTML = state.subjects.map(s => {
    const done = s.topics.filter(t => t.done).length;
    const total = s.topics.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `
    <div class="subject-card" style="--subject-color:${s.color}" onclick="openSubjectModal('${s.id}')">
      <div class="subject-card-header">
        <span class="subject-card-name">${escHtml(s.name)}</span>
        <div class="subject-card-actions">
          <button class="icon-btn" title="Delete" onclick="deleteSubject('${s.id}',event)">🗑</button>
        </div>
      </div>
      <div class="subject-card-meta">${total} topic${total !== 1 ? 's' : ''} · Goal: ${s.goal ? s.goal + 'h/wk' : 'not set'}</div>
      <div class="subject-progress-bar">
        <div class="subject-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="subject-progress-text">${done}/${total} topics done (${pct}%)</div>
      <div class="subject-time-chip">⏱ ${fmt(s.totalMins || 0)} studied</div>
    </div>`;
  }).join('');
}

function renderSidebarSubjects() {
  const el = document.getElementById('sidebarSubjectItems');
  el.innerHTML = state.subjects.map(s =>
    `<div class="sidebar-subject-item" onclick="openSubjectModal('${s.id}')">
       <span class="subject-dot" style="background:${s.color}"></span>
       ${escHtml(s.name)}
     </div>`
  ).join('');
}

// ── TOPIC MODAL ───────────────────────────────────────────────────────────────
function openSubjectModal(id) {
  state.currentSubjectId = id;
  const s = state.subjects.find(s => s.id === id);
  if (!s) return;
  document.getElementById('topicModal').classList.add('open');
  document.getElementById('modalSubjectTitle').textContent = s.name;
  document.getElementById('modalSubjectTitle').style.color = s.color;
  const howToBox = document.getElementById('modalHowTo');
  if (s.howTo) {
    howToBox.innerHTML = `<div class="how-to-label">How to study this</div><div class="how-to-text">${escHtml(s.howTo)}</div>`;
    howToBox.classList.add('visible');
  } else {
    howToBox.classList.remove('visible');
  }
  renderChecklist(s);
}

function closeTopicModal(e) {
  if (e.target === document.getElementById('topicModal')) closeTopicModalDirect();
}
function closeTopicModalDirect() {
  document.getElementById('topicModal').classList.remove('open');
  document.getElementById('addTopicForm').style.display = 'none';
  state.currentSubjectId = null;
}

function showAddTopicForm() {
  const f = document.getElementById('addTopicForm');
  f.style.display = 'flex';
  f.style.flexDirection = 'column';
  document.getElementById('topicNameInput').focus();
}

function addTopic() {
  const name = document.getElementById('topicNameInput').value.trim();
  if (!name) { shakeEl('topicNameInput'); return; }
  const desc = document.getElementById('topicDescInput').value.trim();
  const s = state.subjects.find(s => s.id === state.currentSubjectId);
  if (!s) return;
  s.topics.push({ id: uid(), name, desc, done: false, minsSpent: 0, addedAt: Date.now() });
  save();
  document.getElementById('topicNameInput').value = '';
  document.getElementById('topicDescInput').value = '';
  document.getElementById('addTopicForm').style.display = 'none';
  renderChecklist(s);
  renderSubjects();
  updateDashboardStats();
}

function renderChecklist(s) {
  const el = document.getElementById('topicChecklist');
  if (!s.topics.length) {
    el.innerHTML = '<p class="empty-hint" style="padding:10px 0">No topics yet — add one above.</p>';
    return;
  }
  el.innerHTML = s.topics.map(t => `
    <div class="checklist-item ${t.done ? 'done-item' : ''}" id="ci-${t.id}">
      <button class="checklist-checkbox ${t.done ? 'checked' : ''}"
        onclick="toggleTopic('${s.id}','${t.id}')">${t.done ? '✓' : ''}</button>
      <div class="checklist-content">
        <div class="topic-item-name">${escHtml(t.name)}</div>
        ${t.desc ? `<div class="topic-item-desc">${escHtml(t.desc)}</div>` : ''}
        ${t.minsSpent ? `<div class="topic-item-time">⏱ ${fmt(t.minsSpent)} studied</div>` : ''}
      </div>
      <button class="checklist-del" onclick="deleteTopic('${s.id}','${t.id}')">✕</button>
    </div>`
  ).join('');
}

function toggleTopic(subId, topicId) {
  const s = state.subjects.find(s => s.id === subId);
  if (!s) return;
  const t = s.topics.find(t => t.id === topicId);
  if (!t) return;
  t.done = !t.done;
  save();
  renderChecklist(s);
  renderSubjects();
  updateDashboardStats();
  if (t.done) {
    logActivity(`Completed topic "${t.name}" in ${s.name}`);
    checkConfetti(s);
  }
}

function deleteTopic(subId, topicId) {
  const s = state.subjects.find(s => s.id === subId);
  if (!s) return;
  s.topics = s.topics.filter(t => t.id !== topicId);
  save();
  renderChecklist(s);
  renderSubjects();
  updateDashboardStats();
}

function checkConfetti(s) {
  const done = s.topics.filter(t => t.done).length;
  if (done === s.topics.length && s.topics.length > 0) {
    launchConfetti();
    logActivity(`🎉 Completed ALL topics in "${s.name}"!`);
  }
}

// ── PLANNER ───────────────────────────────────────────────────────────────────
let weekOffset = 0;

function toggleAddSessionForm() {
  const f = document.getElementById('addSessionForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    populateSessionSubjects();
    const d = document.getElementById('sessionDate');
    d.value = today();
  }
}

function populateSessionSubjects() {
  const sel = document.getElementById('sessionSubject');
  sel.innerHTML = '<option value="">— select subject —</option>' +
    state.subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
}

function populateTopicSelect() {
  const subId = document.getElementById('sessionSubject').value;
  const sel = document.getElementById('sessionTopic');
  const s = state.subjects.find(s => s.id === subId);
  sel.innerHTML = '<option value="">— all topics / none —</option>' +
    (s ? s.topics.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('') : '');
}

function addSession() {
  const subId = document.getElementById('sessionSubject').value;
  const topicId = document.getElementById('sessionTopic').value;
  const date = document.getElementById('sessionDate').value;
  const dur = parseInt(document.getElementById('sessionDuration').value) || 45;
  if (!subId || !date) { alert('Please select a subject and date.'); return; }
  const sub = state.subjects.find(s => s.id === subId);
  const topic = topicId ? sub?.topics.find(t => t.id === topicId) : null;
  state.sessions.push({ id: uid(), subjectId: subId, topicId, date, duration: dur, subjectName: sub?.name, topicName: topic?.name, color: sub?.color });
  save();
  document.getElementById('addSessionForm').classList.remove('open');
  renderPlanner();
  renderDashboardToday();
  logActivity(`Scheduled ${dur}min of ${sub?.name}${topic ? ` — ${topic.name}` : ''} on ${date}`);
}

function shiftWeek(d) { weekOffset += d; renderPlanner(); }

function renderPlanner() {
  populateSessionSubjects();
  const base = new Date();
  base.setDate(base.getDate() + weekOffset * 7);
  const dow = base.getDay(); // 0=Sun
  const monday = new Date(base);
  monday.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const startStr = days[0].toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  const endStr = days[6].toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  document.getElementById('weekLabel').textContent = `${startStr} – ${endStr}`;

  const todayStr = today();
  const grid = document.getElementById('weekGrid');
  grid.innerHTML = days.map((d, i) => {
    const ds = d.toISOString().slice(0,10);
    const sessions = state.sessions.filter(s => s.date === ds);
    const isToday = ds === todayStr;
    return `<div class="week-day ${isToday ? 'today' : ''}">
      <div class="week-day-header">${dayNames[i]}</div>
      <div class="week-day-date">${d.getDate()}</div>
      ${sessions.map(ses => `
        <div class="session-chip" style="background:${ses.color || '#6366f1'}" title="${ses.subjectName}${ses.topicName ? ' — '+ses.topicName : ''} · ${ses.duration}min">
          ${escHtml((ses.subjectName || '').slice(0,10))} ${ses.duration}m
          <span class="chip-del" onclick="deleteSession('${ses.id}',event)">✕</span>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function deleteSession(id, e) {
  e.stopPropagation();
  state.sessions = state.sessions.filter(s => s.id !== id);
  save();
  renderPlanner();
  renderDashboardToday();
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
let timerInterval = null;
let timerTotal = 25 * 60;
let timerLeft = 25 * 60;
let timerRunning = false;
const CIRCUMFERENCE = 2 * Math.PI * 88; // r=88

function setTimerMode(mins, btn) {
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('customTimeRow').style.display = mins === 0 ? 'flex' : 'none';
  if (mins > 0) { timerTotal = mins * 60; resetTimer(); }
}

function applyCustomTime() {
  const v = parseInt(document.getElementById('customMinutes').value) || 25;
  timerTotal = Math.max(1, Math.min(300, v)) * 60;
  resetTimer();
}

function toggleTimer() {
  if (timerRunning) pauseTimer(); else startTimer();
}

function startTimer() {
  const subEl = document.getElementById('timerSubject');
  if (!subEl.value) { alert('Please select a subject first.'); return; }
  timerRunning = true;
  document.getElementById('timerStartBtn').textContent = '⏸ Pause';
  document.getElementById('timerState').textContent = 'Studying…';
  document.getElementById('ringProgress').classList.remove('paused','done');
  timerInterval = setInterval(tickTimer, 1000);
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timerStartBtn').textContent = '▶ Resume';
  document.getElementById('timerState').textContent = 'Paused';
  document.getElementById('ringProgress').classList.add('paused');
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerLeft = timerTotal;
  document.getElementById('timerStartBtn').textContent = '▶ Start';
  document.getElementById('timerState').textContent = 'Ready';
  document.getElementById('timerTime').textContent = fmtSecs(timerLeft);
  document.getElementById('ringProgress').classList.remove('paused','done');
  updateRing();
}

function tickTimer() {
  timerLeft--;
  document.getElementById('timerTime').textContent = fmtSecs(timerLeft);
  updateRing();
  if (timerLeft <= 0) finishTimer();
}

function updateRing() {
  const offset = CIRCUMFERENCE * (1 - timerLeft / timerTotal);
  document.getElementById('ringProgress').style.strokeDashoffset = offset;
}

function finishTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timerStartBtn').textContent = '▶ Start';
  document.getElementById('timerState').textContent = 'Done! 🎉';
  document.getElementById('ringProgress').classList.add('done');
  const minsSpent = Math.ceil(timerTotal / 60);
  const subId = document.getElementById('timerSubject').value;
  const topicId = document.getElementById('timerTopic').value;
  const notes = document.getElementById('sessionNotes').value.trim();
  // Save log
  const sub = state.subjects.find(s => s.id === subId);
  const topic = sub?.topics.find(t => t.id === topicId);
  const logEntry = {
    id: uid(),
    subjectId: subId,
    topicId,
    subjectName: sub?.name || '',
    topicName: topic?.name || '',
    color: sub?.color || '#6366f1',
    mins: minsSpent,
    notes,
    date: today(),
    time: new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
  };
  state.logs.push(logEntry);
  // Update subject total and topic time
  if (sub) {
    sub.totalMins = (sub.totalMins || 0) + minsSpent;
    if (topic) topic.minsSpent = (topic.minsSpent || 0) + minsSpent;
  }
  updateStreak();
  save();
  renderTimerLog();
  renderSubjects();
  updateDashboardStats();
  logActivity(`Studied ${sub?.name || '?'}${topic ? ' — ' + topic.name : ''} for ${minsSpent} min`);
  timerLeft = timerTotal;
  updateRing();
  // Notify
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('StudyZone', { body: `Session done! ${minsSpent} min of ${sub?.name || ''}` });
  }
}

function populateTimerSelects() {
  const subSel = document.getElementById('timerSubject');
  subSel.innerHTML = '<option value="">— select —</option>' +
    state.subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  populateTimerTopics();
  renderTimerLog();
}

function populateTimerTopics() {
  const subId = document.getElementById('timerSubject').value;
  const s = state.subjects.find(s => s.id === subId);
  const topSel = document.getElementById('timerTopic');
  topSel.innerHTML = '<option value="">— select topic (optional) —</option>' +
    (s ? s.topics.filter(t => !t.done).map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('') : '');
}

function renderTimerLog() {
  const todayLogs = state.logs.filter(l => l.date === today());
  const el = document.getElementById('timerLog');
  if (!todayLogs.length) {
    el.innerHTML = '<p class="empty-hint">No sessions yet today.</p>';
    document.getElementById('totalTimeToday').textContent = '0 min';
    return;
  }
  const totalMins = todayLogs.reduce((acc, l) => acc + l.mins, 0);
  el.innerHTML = todayLogs.slice().reverse().map(l =>
    `<div class="log-entry">
       <div class="log-entry-title" style="color:${l.color}">${escHtml(l.subjectName)}${l.topicName ? ' — ' + escHtml(l.topicName) : ''}</div>
       <div class="log-entry-meta">${l.time} · ${l.mins} min${l.notes ? ' · ' + escHtml(l.notes.slice(0,40)) : ''}</div>
     </div>`
  ).join('');
  document.getElementById('totalTimeToday').textContent = fmt(totalMins);
}

// ── STREAK ────────────────────────────────────────────────────────────────────
function updateStreak() {
  const t = today();
  if (state.lastStudyDate === t) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const ys = yesterday.toISOString().slice(0,10);
  if (state.lastStudyDate === ys) {
    state.streak = (state.streak || 0) + 1;
  } else if (state.lastStudyDate !== t) {
    state.streak = 1;
  }
  state.lastStudyDate = t;
  document.getElementById('streakBadge').textContent = `🔥 ${state.streak} day streak`;
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  updateDashboardStats();
  renderDashboardToday();
  renderRecentActivity();
  populateQuickSubjects();
}

function updateDashboardStats() {
  const total = state.subjects.reduce((a, s) => a + s.topics.length, 0);
  const done = state.subjects.reduce((a, s) => a + s.topics.filter(t => t.done).length, 0);
  const mins = state.subjects.reduce((a, s) => a + (s.totalMins || 0), 0);
  document.getElementById('statSubjects').textContent = state.subjects.length;
  document.getElementById('statTopics').textContent = total;
  document.getElementById('statDone').textContent = done;
  document.getElementById('statHours').textContent = mins >= 60 ? Math.round(mins/60) + 'h' : mins + 'm';
  document.getElementById('streakBadge').textContent = `🔥 ${state.streak || 0} day streak`;
}

function renderDashboardToday() {
  const el = document.getElementById('todayFocus');
  const ts = state.sessions.filter(s => s.date === today());
  if (!ts.length) {
    el.innerHTML = '<p class="empty-hint">No sessions planned. <button class="link-btn" onclick="showView(\'planner\')">Add one →</button></p>';
    return;
  }
  el.innerHTML = ts.map(s =>
    `<div class="activity-item">
       <span class="activity-dot" style="background:${s.color || '#6366f1'}"></span>
       <span class="activity-text">${escHtml(s.subjectName || '')}${s.topicName ? ' — ' + escHtml(s.topicName) : ''}</span>
       <span class="activity-time">${s.duration}min</span>
     </div>`
  ).join('');
}

function renderRecentActivity() {
  const el = document.getElementById('recentActivity');
  const recent = (state._activity || []).slice(-8).reverse();
  if (!recent.length) { el.innerHTML = '<p class="empty-hint">Nothing yet — study something first!</p>'; return; }
  el.innerHTML = recent.map(a =>
    `<div class="activity-item">
       <span class="activity-dot" style="background:var(--accent)"></span>
       <span class="activity-text">${escHtml(a.msg)}</span>
       <span class="activity-time">${a.time}</span>
     </div>`
  ).join('');
}

function logActivity(msg) {
  if (!state._activity) state._activity = [];
  const now = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  state._activity.push({ msg, time: now, date: today() });
  if (state._activity.length > 50) state._activity = state._activity.slice(-50);
  save();
}

function populateQuickSubjects() {
  const sel = document.getElementById('quickSubjectPick');
  sel.innerHTML = '<option value="">— choose subject —</option>' +
    state.subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
}

function quickStart() {
  const id = document.getElementById('quickSubjectPick').value;
  if (!id) { alert('Please select a subject.'); return; }
  showView('timer');
  setTimeout(() => {
    document.getElementById('timerSubject').value = id;
    populateTimerTopics();
  }, 50);
}

// ── PROGRESS ──────────────────────────────────────────────────────────────────
function renderProgress() {
  const grid = document.getElementById('progressGrid');
  if (!state.subjects.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>Nothing to show yet</h3><p>Add subjects and start studying to see your progress.</p></div>`;
    return;
  }
  grid.innerHTML = state.subjects.map(s => {
    const done = s.topics.filter(t => t.done).length;
    const total = s.topics.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const r = 34;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    const weekMins = state.logs.filter(l => {
      const d = new Date(l.date);
      const now = new Date();
      return l.subjectId === s.id && (now - d) < 7 * 86400000;
    }).reduce((a, l) => a + l.mins, 0);
    return `
    <div class="progress-card">
      <div class="progress-card-header">
        <div class="progress-color-bar" style="background:${s.color}"></div>
        <div>
          <div class="progress-subject-name">${escHtml(s.name)}</div>
          <div class="progress-meta">${total} topics · Goal: ${s.goal ? s.goal + 'h/wk' : 'not set'}</div>
        </div>
      </div>
      <div class="progress-donut">
        <div class="donut-wrap">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="${r}" class="donut-track"/>
            <circle cx="40" cy="40" r="${r}" class="donut-fill" stroke="${s.color}"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
          </svg>
          <div class="donut-text">${pct}%</div>
        </div>
        <div class="progress-stats">
          <div class="progress-stat-row"><span>${done}/${total}</span> topics done</div>
          <div class="progress-stat-row"><span>${fmt(s.totalMins || 0)}</span> total</div>
          <div class="progress-stat-row"><span>${fmt(weekMins)}</span> this week</div>
        </div>
      </div>
      <div class="topic-progress-list">
        ${s.topics.slice(0,6).map(t =>
          `<div class="topic-progress-item">
             <div class="topic-check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</div>
             <span>${escHtml(t.name)}</span>
             ${t.minsSpent ? `<span style="margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--text-3)">${fmt(t.minsSpent)}</span>` : ''}
           </div>`
        ).join('')}
        ${s.topics.length > 6 ? `<div style="font-size:11px;color:var(--text-3);padding:2px 0">+${s.topics.length - 6} more topics</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = Array.from({length: 120}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 2,
    color: ['#7c6af7','#f472b6','#34d399','#fbbf24','#60a5fa'][Math.floor(Math.random()*5)],
    size: Math.random() * 8 + 4,
    rot: Math.random() * 360,
    rotV: (Math.random()-0.5)*6
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
    });
    frame++;
    if (frame < 160) requestAnimationFrame(draw);
    else { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display='none'; }
  }
  requestAnimationFrame(draw);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shakeEl(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#ef4444';
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.3s';
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 500);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  load();
  // Inject overlay div for mobile sidebar
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebarOverlay';
  overlay.onclick = closeSidebar;
  document.body.appendChild(overlay);
  // Set today's date for session form
  const sd = document.getElementById('sessionDate');
  if (sd) sd.value = today();
  // Greet
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const dashGreet = document.getElementById('dashGreeting');
  if (dashGreet) dashGreet.textContent = `${greet}! Here's your study snapshot.`;
  // Request notifications
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  renderSidebarSubjects();
  renderDashboard();
}

// Add shake keyframe
const style = document.createElement('style');
style.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);
