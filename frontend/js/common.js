/* AuraAssess shared helpers */
const API = '/api';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const fmt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const toLocalInput = (d) => { if (!d) return ''; const x = new Date(d); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
const PAL = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#22c55e', '#ec4899', '#eab308', '#14b8a6', '#6366f1', '#ef4444'];

const store = {
  get token() { return localStorage.getItem('aura-token'); },
  get user() { try { return JSON.parse(localStorage.getItem('aura-user')); } catch (e) { return null; } },
  set(t, u) { localStorage.setItem('aura-token', t); localStorage.setItem('aura-user', JSON.stringify(u)); },
  setUser(u) { localStorage.setItem('aura-user', JSON.stringify(u)); },
  clear() { localStorage.removeItem('aura-token'); localStorage.removeItem('aura-user'); }
};

/* theme (saved in localStorage) */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('aura-theme', t);
  const b = $('#themeBtn');
  if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  if (typeof window.onThemeChange === 'function') window.onThemeChange();
}

applyTheme(localStorage.getItem('aura-theme') || 'light');

async function api(path, opt = {}) {
  const h = {};
  let body;

  if (store.token) h.Authorization = 'Bearer ' + store.token;

  if (opt.form) body = opt.form;
  else if (opt.body !== undefined) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(opt.body);
  }

  const res = await fetch(API + path, {
    method: opt.method || 'GET',
    headers: h,
    body
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }

  if (res.status === 401 && store.token && !opt.noRedirect) {
    store.clear();
    location.href = 'login.html';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST', noRedirect: true });
  } catch (e) {
    /* ignore */
  }

  store.clear();
  location.href = 'login.html';
}

/* shell: sidebar + top-right user area */
const MENUS = {
  ADMIN: [
    ['Dashboard', '🏠', 'admin.html#dashboard'],
    ['Manage Teachers', '👩‍🏫', 'admin.html#teachers'],
    ['Manage Students', '🎓', 'admin.html#students'],
    ['Subjects', '📚', 'admin.html#subjects'],
    ['Performance', '📈', 'admin.html#performance'],
    ['Profile', '👤', 'profile.html']
  ],

  TEACHER: [
    ['Dashboard', '🏠', 'teacher.html#dashboard'],
    ['Create Exam', '📝', 'teacher.html#create'],
    ['My Exams', '🗂️', 'teacher.html#exams'],
    ['Question Bank', '❓', 'teacher.html#questions'],
    ['Assignments', '📤', 'teacher.html#assignments'],
    ['Rankings', '🏆', 'leaderboard.html'],
    ['Analytics', '📊', 'analytics.html'],
    ['Profile', '👤', 'profile.html']
  ],

  STUDENT: [
    ['Dashboard', '🏠', 'student.html#dashboard'],
    ['Available Exams', '📝', 'student.html#available'],
    ['My Exams', '🗂️', 'student.html#my'],
    ['Results', '✅', 'results.html'],
    ['Analytics', '📊', 'analytics.html'],
    ['Leaderboard', '🏆', 'leaderboard.html'],
    ['Profile', '👤', 'profile.html']
  ]
};

const avatarHtml = (u) =>
  u.photo
    ? `<img class="avatar" src="${esc(u.photo)}" alt="">`
    : `<div class="avatar">${esc((u.name || '?').trim().charAt(0).toUpperCase())}</div>`;

function markActive() {
  const page = location.pathname.split('/').pop() || 'index.html';
  const cur = page + location.hash.split('/')[0];

  const links = $$('.sidebar a');

  const hit =
    links.find((a) => a.getAttribute('href') === cur) ||
    links.find((a) => a.getAttribute('href').split('#')[0] === page);

  links.forEach((a) => a.classList.toggle('active', a === hit));
}

function initShell(roles) {
  const u = store.user;

  if (!store.token || !u || !roles.includes(u.role)) {
    store.clear();
    location.href = 'login.html';
    return null;
  }

  $('#sidebar').innerHTML =
    MENUS[u.role]
      .map((m) => `<a href="${m[2]}"><span>${m[1]}</span>${m[0]}</a>`)
      .join('') +
    '<div class="sp"></div><button class="navlink" id="sideLogout"><span>🚪</span>Logout</button>';

  $('#topbar').innerHTML = `
    <button class="iconbtn burger" id="burger">☰</button>
    <a class="brand" href="${u.role.toLowerCase()}.html">
      <img src="assets/logo.svg" alt="AuraAssess logo">
      <span>
        <b>AuraAssess</b>
        <small>Assess. Analyze. Improve.</small>
      </span>
    </a>
    <div class="grow"></div>
    <div class="userbox">
      <a href="profile.html" title="My profile">${avatarHtml(u)}</a>
      <div class="uinfo">
        <b>${esc(u.name)}</b>
        <small>${esc(u.role.toLowerCase())}</small>
      </div>
      <button class="iconbtn" id="themeBtn" title="Toggle dark / light mode"></button>
      <button class="iconbtn" id="logoutBtn" title="Logout">Logout</button>
    </div>`;

  $('#themeBtn').onclick = toggleTheme;
  $('#logoutBtn').onclick = logout;
  $('#sideLogout').onclick = logout;

  $('#burger').onclick = () => $('#sidebar').classList.toggle('open');

  $('#sidebar').addEventListener('click', (e) => {
    if (e.target.closest('a')) $('#sidebar').classList.remove('open');
  });

  applyTheme(document.documentElement.dataset.theme);
  markActive();

  window.addEventListener('hashchange', markActive);

  return u;
}

/* UI helpers */
function toast(msg, type = 'ok') {
  let box = $('#toasts');

  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }

  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);

  setTimeout(() => t.remove(), 3800);
}

function modal(title, html, opts = {}) {
  const m = document.createElement('div');
  m.className = 'modal-back';

  m.innerHTML = `
    <div class="modal ${opts.wide ? 'wide' : ''}">
      <div class="modal-h">
        <h3>${esc(title)}</h3>
        <button class="x">✕</button>
      </div>
      <div class="modal-b">${html}</div>
    </div>`;

  document.body.appendChild(m);

  m.close = () => m.remove();

  $('.x', m).onclick = m.close;

  m.addEventListener('mousedown', (e) => {
    if (e.target === m) m.close();
  });

  return m;
}

function table(cols, rows, empty = 'No records found') {
  if (!rows.length) return `<div class="loading">${esc(empty)}</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${cols.map((c) => `<th>${c.h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="${r._cls || ''}">
              ${cols.map((c) => `<td>${c.f(r, i)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

const stat = (label, val, icon, color) =>
  `<div class="stat ${color}">
    <div class="ic">${icon}</div>
    <div><b>${val}</b><span>${esc(label)}</span></div>
  </div>`;


/* =========================================================
   TOPIC BADGES
   ========================================================= */

const TOPIC_BADGE = {
  STRONG: ['green', 'Strong'],
  NEEDS_IMPROVEMENT: ['orange', 'Needs Improvement'],
  WEAK: ['red', 'Weak'],

  /* Added for skipped topics.
     Skipped questions/topics must NOT be treated as weak. */
  SKIPPED: ['gray', 'Skipped']
};

/*
 * Defensive topic badge helper.
 *
 * If an unknown/missing status is received from the backend,
 * it will safely display "Unknown" instead of causing:
 *
 * Cannot read properties of undefined (reading '0')
 */
const topicBadge = (s) => {
  const status = String(s || '').toUpperCase().trim();

  const badge = TOPIC_BADGE[status] || ['gray', 'Unknown'];

  return `<span class="badge ${badge[0]}">${badge[1]}</span>`;
};


const EXAM_BADGE = {
  AVAILABLE: 'green',
  IN_PROGRESS: 'orange',
  COMPLETED: 'blue',
  UPCOMING: 'purple',
  EXPIRED: 'red'
};

const examBadge = (s) =>
  `<span class="badge ${EXAM_BADGE[s] || 'gray'}">${String(s || '').replace('_', ' ')}</span>`;

const pbar = (p) =>
  `<div class="progress" title="${r1(p)}%">
    <i style="width:${Math.min(100, Number(p) || 0)}%"></i>
  </div>`;

function topicLists(topics) {
  const g = (s) => topics.filter((t) => t.status === s);

  const li = (arr, sym) =>
    arr.length
      ? arr.map((t) =>
          `<li>${sym} ${esc(t.topic)} <span class="muted">(${r1(t.percentage)}%)</span></li>`
        ).join('')
      : '<li class="muted">None</li>';

  return `
    <div class="grid three">
      <div class="card tgroup">
        <h4>STRONG TOPICS</h4>
        <ul class="tlist t-strong">
          ${li(g('STRONG'), '✓')}
        </ul>
      </div>

      <div class="card tgroup">
        <h4>WEAK TOPICS</h4>
        <ul class="tlist t-weak">
          ${li(g('WEAK'), '⚠')}
        </ul>
      </div>

      <div class="card tgroup">
        <h4>NEEDS IMPROVEMENT</h4>
        <ul class="tlist t-needs">
          ${li(g('NEEDS_IMPROVEMENT'), '•')}
        </ul>
      </div>
    </div>`;
}

function topicTable(topics) {
  return table(
    [
      {
        h: 'Topic',
        f: (t) => esc(t.topic)
      },
      {
        h: 'Questions',
        f: (t) => t.total_questions ?? t.total
      },
      {
        h: 'Correct',
        f: (t) => t.correct_count ?? t.correct
      },
      {
        h: 'Percentage',
        f: (t) => `${r1(t.percentage)}%${pbar(t.percentage)}`
      },
      {
        h: 'Status',
        f: (t) => topicBadge(t.status)
      }
    ],
    topics,
    'No topic data yet'
  );
}

const STATUS_COLOR = {
  STRONG: '#22c55e',
  NEEDS_IMPROVEMENT: '#f97316',
  WEAK: '#ef4444'
};

/* Chart.js wrapper (canvas must sit inside a .chart-box) */
const charts = {};

function chart(id, type, data, options = {}) {
  const cv = document.getElementById(id);

  if (!cv) return;

  const box = cv.parentElement;
  let nd = $('.nodata', box);

  if (!window.Chart || !data.labels.length) {
    cv.style.display = 'none';

    if (!nd) {
      nd = document.createElement('div');
      nd.className = 'nodata';
      box.appendChild(nd);
    }

    nd.textContent = window.Chart
      ? 'No data yet - complete an exam to see this chart.'
      : 'Chart.js could not load (internet access is needed for the CDN).';

    return;
  }

  cv.style.display = '';

  if (nd) nd.remove();

  if (charts[id]) charts[id].destroy();

  const dark = document.documentElement.dataset.theme === 'dark';

  Chart.defaults.color = dark ? '#cbd5e1' : '#475569';
  Chart.defaults.borderColor = dark ? '#334155' : '#e2e8f0';

  charts[id] = new Chart(cv, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...options
    }
  });
}

const chartCard = (title, id) =>
  `<div class="card">
    <h3>${esc(title)}</h3>
    <div class="chart-box">
      <canvas id="${id}"></canvas>
    </div>
  </div>`;

const pctAxis = {
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      ticks: {
        callback: (v) => v + '%'
      }
    }
  },
  plugins: {
    legend: {
      display: false
    }
  }
};

function initEyes() {
  $$('.eye').forEach((b) => {
    b.type = 'button';

    b.onclick = () => {
      const i = b.parentElement.querySelector('input');
      const show = i.type === 'password';

      i.type = show ? 'text' : 'password';
      b.textContent = show ? '🙈' : '👁️';
    };
  });
}

const debounce = (fn, ms = 300) => {
  let t;

  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};