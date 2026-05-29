// ─── supabase config ─────────────────────
// linking to the supabase project and github repos
const SUPABASE_URL = 'https://qealketmijfgcuybhjni.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlYWxrZXRtaWpmZ2N1eWJoam5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzMxMTEsImV4cCI6MjA5NTY0OTExMX0.4sbNJqp7q2z38KTUK2ijo1DB2bZP89-vESuxKFE8QQs';

async function dbSave(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/trip_data?id=eq.main`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ data, updated_at: new Date() })
  });
}

async function dbLoad() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trip_data?id=eq.main`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const rows = await res.json();
  return rows[0]?.data || null;
}

// trip planner logic
// handles the crew cards, itinerary builder and key notes
// everything saves to localStorage so it persists between sessions
// to reset everything: open console and run localStorage.clear()

// ─── state ───────────────────────────────
let phases = [];
let phaseCounter = 0;
let dayCounter   = 0;

// ─── crew ────────────────────────────────
// handles the person cards at the top
// avatars update live as you type the name
// wishes save on enter, double click to remove
function updateAvatar(n) {
  const name = document.getElementById('name-' + n).value.trim();
  document.getElementById('avatar-' + n).textContent = name ? name[0].toUpperCase() : 'P';
}

function savePerson(n) { updateAvatar(n); save(); }

function showWishInput(n) {
  const inp = document.getElementById('wish-input-' + n);
  inp.classList.add('active');
  inp.focus();
}

function submitWish(e, n) {
  if (e.key === 'Enter') {
    const inp = document.getElementById('wish-input-' + n);
    const val = inp.value.trim();
    if (val) { addWishItem(n, val); inp.value = ''; save(); }
    inp.classList.remove('active');
  }
  if (e.key === 'Escape') {
    document.getElementById('wish-input-' + n).classList.remove('active');
  }
}

function addWishItem(n, text) {
  const list = document.getElementById('wishes-' + n);
  const li   = document.createElement('li');
  li.className = 'wish-item';
  li.title     = 'Double-click to remove';
  li.innerHTML = '<span class="wish-bullet"></span><span>' + escHtml(text) + '</span>';
  li.addEventListener('dblclick', () => { li.remove(); save(); });
  list.appendChild(li);
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── itinerary ───────────────────────────
// phases = locations (tokyo, kyoto etc)
// each phase holds an array of days
// add/delete both dynamically, all saved
function addPhase(data) {
  const pid = data ? data.id : ++phaseCounter;
  if (!data) phaseCounter = Math.max(phaseCounter, pid);

  const phase = data || { id: pid, location: '', dateRange: '', days: [] };
  if (!data) phases.push(phase);

  const container = document.getElementById('phases-container');

  const section = document.createElement('section');
  section.className = 'phase';
  section.id = 'phase-' + pid;

  section.innerHTML = `
    <div class="phase-header">
      <div class="phase-num" aria-hidden="true">${romanNumeral(phases.indexOf(phase) + 1)}</div>
      <div class="phase-header-fields">
        <input
          class="phase-location-input"
          id="ploc-${pid}"
          value="${escHtml(phase.location)}"
          placeholder="Location name (e.g. Tokyo, Kyoto…)"
          oninput="updatePhaseField(${pid},'location',this.value)"
        />
        <input
          class="phase-date-input"
          id="pdate-${pid}"
          value="${escHtml(phase.dateRange)}"
          placeholder="Dates (e.g. Oct 28 – Nov 1)"
          oninput="updatePhaseField(${pid},'dateRange',this.value)"
        />
      </div>
      <button class="phase-delete-btn" title="Remove this location" onclick="deletePhase(${pid})">✕</button>
    </div>

    <div class="days" id="days-${pid}"></div>

    <button class="add-day-btn" onclick="addDay(${pid})">
      ＋ Add day
    </button>
  `;

  container.appendChild(section);

  // Re-render dividers
  refreshDividers();

  // Restore days if loading from saved data
  if (data && data.days) {
    data.days.forEach(d => addDay(pid, d));
  }

  if (!data) save();
  return phase;
}

function updatePhaseField(pid, field, value) {
  const phase = phases.find(p => p.id === pid);
  if (phase) { phase[field] = value; save(); }
}

function deletePhase(pid) {
  phases = phases.filter(p => p.id !== pid);
  const el = document.getElementById('phase-' + pid);
  if (el) el.remove();
  refreshDividers();
  save();
}
// ─── days ────────────────────────────────

function addDay(pid, data) {
  const phase = phases.find(p => p.id === pid);
  if (!phase) return;

  const did = data ? data.id : ++dayCounter;
  if (!data) dayCounter = Math.max(dayCounter, did);

  const day = data || { id: did, title: '', activities: '' };
  if (!data) phase.days.push(day);

  const container = document.getElementById('days-' + pid);
  const dayNum    = phase.days.indexOf(day) + 1;

  const div = document.createElement('div');
  div.className = 'day';
  div.id        = 'day-' + did;

  div.innerHTML = `
    <div class="day-aside">
      <span class="day-label">Day</span>
      <div class="day-num-big">${dayNum}</div>
    </div>
    <div class="day-main">
      <div class="day-fields">
        <div class="day-field">
          <label class="field-label">📌 Day title</label>
          <input
            class="field-input"
            id="dtitle-${did}"
            value="${escHtml(day.title)}"
            placeholder="e.g. Akihabara + Shibuya"
            oninput="updateDayField(${pid},${did},'title',this.value)"
          />
        </div>
        <div class="day-field">
          <label class="field-label">📝 What we're doing</label>
          <textarea
            class="field-textarea"
            id="dact-${did}"
            placeholder="Add activities, restaurants, bookings…"
            oninput="updateDayField(${pid},${did},'activities',this.value)"
          >${escHtml(day.activities)}</textarea>
        </div>
      </div>
    </div>
    <button class="day-delete-btn" title="Remove day" onclick="deleteDay(${pid},${did})">✕</button>
  `;

  container.appendChild(div);
  refreshDayNumbers(pid);

  if (!data) save();
}

function updateDayField(pid, did, field, value) {
  const phase = phases.find(p => p.id === pid);
  if (!phase) return;
  const day = phase.days.find(d => d.id === did);
  if (day) { day[field] = value; save(); }
}

function deleteDay(pid, did) {
  const phase = phases.find(p => p.id === pid);
  if (!phase) return;
  phase.days = phase.days.filter(d => d.id !== did);
  const el = document.getElementById('day-' + did);
  if (el) el.remove();
  refreshDayNumbers(pid);
  save();
}

function refreshDayNumbers(pid) {
  const container = document.getElementById('days-' + pid);
  if (!container) return;
  container.querySelectorAll('.day-num-big').forEach((el, i) => {
    el.textContent = i + 1;
  });
}

const ROMAN = ['一','二','三','四','五','六','七','八','九','十'];
function romanNumeral(n) { return ROMAN[n - 1] || n; }

function refreshDividers() {
  // Remove old dividers between phases
  document.querySelectorAll('.phase-divider').forEach(d => d.remove());
  const sections = document.querySelectorAll('#phases-container .phase');
  sections.forEach((s, i) => {
    if (i < sections.length - 1) {
      const div = document.createElement('div');
      div.className = 'divider-orn phase-divider';
      div.setAttribute('aria-hidden', 'true');
      div.textContent = '◆';
      s.after(div);
    }
  });
  // Refresh phase numbers
  document.querySelectorAll('#phases-container .phase-num').forEach((el, i) => {
    el.textContent = romanNumeral(i + 1);
  });
}

function submitKeyNote(e) {
  if (e.key === 'Enter') {
    const inp = document.getElementById('key-note-input');
    const val = inp.value.trim();
    if (val) { addKeyNote(val); inp.value = ''; save(); }
  }
}

function addKeyNote(text) {
  const list = document.getElementById('key-notes-list');
  const li   = document.createElement('li');
  li.className = 'key-note-item';
  li.title     = 'Double-click to remove';
  li.innerHTML = '<span class="key-note-bullet">◆</span><span>' + escHtml(text) + '</span>';
  li.addEventListener('dblclick', () => { li.remove(); save(); });
  list.appendChild(li);
}

// ─── save / load ─────────────────────────
// v4 schema: { people, phases, phaseCounter, dayCounter, keyNotes }
// bump the localStorage key if the schema changes
async function save() {
  const data = { people: {}, phases: phases, phaseCounter, dayCounter };

  for (let n = 1; n <= 6; n++) {
    const wishes = [];
    document.querySelectorAll('#wishes-' + n + ' .wish-item span:last-child')
      .forEach(s => wishes.push(s.textContent));
    data.people['p' + n] = {
      name:   document.getElementById('name-'  + n).value,
      notes:  document.getElementById('notes-' + n).value,
      wishes: wishes
    };
  }

  const keyNotes = [];
  document.querySelectorAll('#key-notes-list .key-note-item span:last-child')
    .forEach(s => keyNotes.push(s.textContent));
  data.keyNotes = keyNotes;

  try { localStorage.setItem('japan-trip-v4', JSON.stringify(data)); } catch (e) {}
  await dbSave(data).catch(e => console.error('save failed:', e));
}

async function load() {
  let data = null;

  try { data = await dbLoad(); } catch (e) {}

  if (!data) {
    try {
      const raw = localStorage.getItem('japan-trip-v4');
      if (raw) data = JSON.parse(raw);
    } catch (e) {}
  }

  if (data && (data.phases || data.people)) {
    restoreData(data);
  } else {
    seedDefault();
  }
}

function restoreData(data) {
  if (data.people) {
    for (let n = 1; n <= 6; n++) {
      const p = data.people['p' + n];
      if (!p) continue;
      if (p.name)  { document.getElementById('name-'  + n).value = p.name;  updateAvatar(n); }
      if (p.notes)   document.getElementById('notes-' + n).value = p.notes;
      if (p.wishes) {
        p.wishes.forEach(w => addWishItem(n, w));
      }
    }
  }

  if (data.phaseCounter) phaseCounter = data.phaseCounter;
  if (data.dayCounter)   dayCounter   = data.dayCounter;
  if (data.phases && data.phases.length) {
    data.phases.forEach(p => {
      phases.push(p);
      addPhase(p);
    });
  }

  if (data.keyNotes) {
    data.keyNotes.forEach(n => addKeyNote(n));
  }
}

//------------- default DOM thats loaded----------------------------------------
function seedDefault() {
  save();
}

window.addEventListener('DOMContentLoaded', () => load());
