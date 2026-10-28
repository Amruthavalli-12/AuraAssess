const U = initShell(['STUDENT']);
const C = $('#content');

const routes = {
  dashboard,
  available: () => examsView('available'),
  my: () => examsView('my')
};

async function route() {
  const k = location.hash.slice(1) || 'dashboard';
  markActive();

  C.innerHTML = '<div class="loading">Loading…</div>';

  try {
    await (routes[k] || dashboard)();
  } catch (e) {
    C.innerHTML = `<div class="card err">${esc(e.message)}</div>`;
  }
}

window.addEventListener('hashchange', route);

if (U) route();


/* =========================================================
   VIOLATION HELPERS
   ========================================================= */

const violationNames = {
  TAB_SWITCH: 'Tab Switch',
  FULLSCREEN_EXIT: 'Fullscreen Exit',
  FACE_NOT_DETECTED: 'Face Not Detected',
  MULTIPLE_FACE_DETECTED: 'Multiple Faces'
};

function violationLabel(type) {
  return violationNames[type] || type || 'Unknown Violation';
}


/*
 * Display violation types as badges.
 *
 * Supports:
 *   ['TAB_SWITCH', 'FULLSCREEN_EXIT']
 *
 * and also:
 *   [
 *     { type: 'TAB_SWITCH', count: 2 },
 *     { type: 'FULLSCREEN_EXIT', count: 1 }
 *   ]
 */
function violationTypesHtml(types, summary = {}) {

  if (!Array.isArray(types) || !types.length) {
    return '';
  }

  return `
    <div style="margin-top:7px">
      ${types.map((item) => {

        const type =
          typeof item === 'string'
            ? item
            : item?.type;

        const count =
          typeof item === 'object' && item?.count != null
            ? Number(item.count)
            : Number(summary?.[type] || 0);

        return `
          <span class="badge red">
            ${esc(violationLabel(type))}
            ${count > 0 ? ` (${count})` : ''}
          </span>
        `;
      }).join(' ')}
    </div>
  `;
}


/*
 * Get violation types from the different formats that
 * the backend may return.
 */
function getViolationTypes(e) {

  if (Array.isArray(e?.violation_types)) {
    return e.violation_types;
  }

  if (e?.violation_summary &&
      typeof e.violation_summary === 'object') {

    return Object.keys(e.violation_summary);
  }

  return [];
}


/*
 * Display rules / violation status for a completed exam.
 */
function examRuleStatus(e) {

  const rulesViolated =
    e.rules_violated === true ||
    Number(e.rules_violated || 0) === 1;

  const totalViolations =
    Number(
      e.total_violations ??
      e.violation_count ??
      0
    );

  const types = getViolationTypes(e);

  const summary =
    e.violation_summary &&
    typeof e.violation_summary === 'object'
      ? e.violation_summary
      : {};

  /*
   * If there are no violations and no rule violation,
   * don't show a warning card.
   */
  if (!rulesViolated && totalViolations === 0) {
    return '';
  }

  const reason =
    e.submit_reason ||
    e.submission_status ||
    '';

  return `
    <div
      class="card"
      style="
        margin-top:12px;
        border-left:4px solid #ef4444;
      "
    >

      <div>
        <b>⚠️ Exam Rules</b>
      </div>


      <p style="margin:6px 0">

        ${
          rulesViolated
            ? 'Rules violated. Your exam was automatically submitted.'
            : `${totalViolations}
               exam violation${totalViolations === 1 ? '' : 's'}
               recorded.`
        }

      </p>


      ${
        reason
          ? `
            <div class="muted" style="margin-top:4px">
              Submission:
              <b>${esc(formatSubmitReason(reason))}</b>
            </div>
          `
          : ''
      }


      ${
        types.length
          ? `
            <div style="margin-top:7px">

              <small class="muted">
                Violation Type${types.length === 1 ? '' : 's'}:
              </small>

              ${violationTypesHtml(types, summary)}

            </div>
          `
          : ''
      }

    </div>
  `;
}


/*
 * Convert backend submit reasons into readable text.
 */
function formatSubmitReason(reason) {

  const map = {
    VIOLATION: 'Rules Violated / Auto-Submitted',
    TIMEOUT: 'Time Expired / Auto-Submitted',
    MANUAL: 'Submitted by Student'
  };

  return map[reason] || reason || 'Submitted';
}


/*
 * Small rules badge used inside the My Exams table.
 */
function examRulesBadge(e) {

  const rulesViolated =
    e.rules_violated === true ||
    Number(e.rules_violated || 0) === 1;

  const totalViolations =
    Number(
      e.total_violations ??
      e.violation_count ??
      0
    );

  if (rulesViolated) {

    return `
      <div>

        <span class="badge red">
          ⚠️ Rules Violated
        </span>

        ${
          totalViolations > 0
            ? `
              <div
                class="muted"
                style="margin-top:4px"
              >
                ${totalViolations}
                violation${totalViolations === 1 ? '' : 's'}
              </div>
            `
            : ''
        }

      </div>
    `;
  }


  if (totalViolations > 0) {

    return `
      <div>

        <span class="badge orange">
          ⚠️ ${totalViolations} Violation${totalViolations === 1 ? '' : 's'}
        </span>

      </div>
    `;
  }


  if (e.status === 'COMPLETED') {

    return `
      <span class="badge green">
        No Violations
      </span>
    `;
  }


  return '-';
}


/* =========================================================
   EXAM CARD
   ========================================================= */

function examCard(e) {

  const btn = {
    AVAILABLE:
      `<a class="btn primary block" href="exam.html?id=${e.id}">
        START EXAM
      </a>`,

    IN_PROGRESS:
      `<a class="btn orange block" href="exam.html?id=${e.id}">
        RESUME EXAM
      </a>`,

    COMPLETED:
      `<a class="btn block" href="results.html?attempt=${e.attempt_id}">
        VIEW RESULT
      </a>`,

    UPCOMING:
      `<button class="btn block" disabled>
        NOT STARTED YET
      </button>`,

    EXPIRED:
      `<button class="btn block" disabled>
        EXAM CLOSED
      </button>`
  }[e.status];


  const score =
    e.status === 'COMPLETED'
      ? `${e.obtained_marks} (${r1(e.percentage)}%)`
      : '-';


  const ruleStatus =
    e.status === 'COMPLETED'
      ? examRuleStatus(e)
      : '';


  return `
    <div class="card exam-card">

      <div style="
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:flex-start
      ">

        <h3>${esc(e.title)}</h3>

        ${examBadge(e.status)}

      </div>


      <div class="meta">

        <span>
          Subject<br>
          <b>${esc(e.subject)}</b>
        </span>

        <span>
          Teacher<br>
          <b>${esc(e.teacher)}</b>
        </span>

        <span>
          Duration<br>
          <b>${e.duration_minutes} min</b>
        </span>

        <span>
          Questions<br>
          <b>${e.question_count}</b>
        </span>

        <span>
          Maximum Marks<br>
          <b>${e.max_marks}</b>
        </span>

        <span>
          Score<br>
          <b>${score}</b>
        </span>

        <span>
          Starts<br>
          <b>${fmt(e.start_date)}</b>
        </span>

        <span>
          Ends<br>
          <b>${fmt(e.end_date)}</b>
        </span>

      </div>


      ${btn}


      ${ruleStatus}

    </div>
  `;
}


/* =========================================================
   STUDENT DASHBOARD
   ========================================================= */

async function dashboard() {

  const d = await api('/student/dashboard');


  C.innerHTML = `
    <h1 class="page-title">
      Hello, ${esc(U.name)} 👋
    </h1>


    <div class="grid stats">

      ${stat(
        'Available Exams',
        d.available,
        '📝',
        'blue'
      )}

      ${stat(
        'Completed Exams',
        d.completed,
        '✅',
        'green'
      )}

      ${stat(
        'Average Score',
        r1(d.avg_score) + '%',
        '📈',
        'purple'
      )}

      ${stat(
        'Best Score',
        r1(d.best_score) + '%',
        '🌟',
        'orange'
      )}

      ${stat(
        'Current Rank',
        d.rank
          ? '#' + d.rank + ' of ' + d.participants
          : '-',
        '🏆',
        'cyan'
      )}

    </div>


    <h3>Exams ready for you</h3>


    ${
      d.upcoming.length
        ? `
          <div class="grid three">
            ${d.upcoming.map(examCard).join('')}
          </div>
        `
        : `
          <div class="card muted">
            No exams available right now.
          </div>
        `
    }


    <div class="card">

      <h3>🔔 Notifications</h3>

      ${
        d.notifications.length
          ? `
            <ul class="tlist">

              ${d.notifications.map((n) => `
                <li>

                  <b>${esc(n.title)}</b>
                  -
                  ${esc(n.message)}

                  <span class="muted">
                    (${fmt(n.created_at)})
                  </span>

                </li>
              `).join('')}

            </ul>
          `
          : `
            <span class="muted">
              No notifications.
            </span>
          `
      }

    </div>
  `;
}


/* =========================================================
   AVAILABLE / MY EXAMS
   ========================================================= */

async function examsView(mode) {

  const rows = await api('/student/exams');


  /* =======================================================
     AVAILABLE EXAMS
     ======================================================= */

  if (mode === 'available') {

    const f = rows.filter((e) =>
      [
        'AVAILABLE',
        'IN_PROGRESS',
        'UPCOMING'
      ].includes(e.status)
    );


    C.innerHTML = `
      <h1 class="page-title">
        Available Exams
      </h1>

      ${
        f.length
          ? `
            <div class="grid three">
              ${f.map(examCard).join('')}
            </div>
          `
          : `
            <div class="card muted">
              No exams available. Check back later.
            </div>
          `
      }
    `;

    return;
  }


  /* =======================================================
     MY EXAMS
     ======================================================= */

  C.innerHTML = `
    <h1 class="page-title">
      My Exams
    </h1>

    <div class="card">

      ${table(

        [
          {
            h: 'Exam',
            f: (e) =>
              `<b>${esc(e.title)}</b>`
          },

          {
            h: 'Subject',
            f: (e) =>
              esc(e.subject)
          },

          {
            h: 'Teacher',
            f: (e) =>
              esc(e.teacher)
          },

          {
            h: 'Window',
            f: (e) =>
              `
                <small>
                  ${fmt(e.start_date)}
                  <br>
                  →
                  ${fmt(e.end_date)}
                </small>
              `
          },

          {
            h: 'Status',
            f: (e) =>
              `
                ${examBadge(e.status)}

                ${
                  e.status === 'COMPLETED' &&
                  (
                    e.rules_violated === true ||
                    Number(e.rules_violated || 0) === 1
                  )
                    ? `
                      <div style="margin-top:5px">
                        <span class="badge red">
                          ⚠️ Rules Violated
                        </span>
                      </div>
                    `
                    : ''
                }
              `
          },

          {
            h: 'Score',
            f: (e) =>
              e.status === 'COMPLETED'
                ? `
                  ${e.obtained_marks}/${e.max_marks}
                  (${r1(e.percentage)}%)
                `
                : '-'
          },

          {
            h: 'Rules',
            f: (e) =>
              e.status === 'COMPLETED'
                ? examRulesBadge(e)
                : '-'
          },

          {
            h: 'Action',
            f: (e) => {

              if (e.status === 'COMPLETED') {

                return `
                  <a
                    class="btn sm"
                    href="results.html?attempt=${e.attempt_id}"
                  >
                    Result
                  </a>
                `;
              }


              if (
                e.status === 'AVAILABLE' ||
                e.status === 'IN_PROGRESS'
              ) {

                return `
                  <a
                    class="btn sm primary"
                    href="exam.html?id=${e.id}"
                  >
                    ${
                      e.status === 'AVAILABLE'
                        ? 'Start'
                        : 'Resume'
                    }
                  </a>
                `;
              }


              return '-';
            }
          }
        ],

        rows,

        'No exams assigned yet'

      )}

    </div>
  `;
}