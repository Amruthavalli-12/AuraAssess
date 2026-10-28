const U = initShell(['TEACHER']);
const C = $('#content');

let SUBJECTS = [];

const routes = {
  dashboard,
  create: examForm,
  exams,
  questions,
  assignments
};

const safe = (fn) => async (...a) => {
  try {
    await fn(...a);
  } catch (e) {
    toast(e.message, 'err');
  }
};

async function route() {
  const [k, param] = (location.hash.slice(1) || 'dashboard').split('/');
  markActive();

  C.innerHTML = '<div class="loading">Loading…</div>';

  try {
    if (!SUBJECTS.length) {
      SUBJECTS = await api('/subjects');
    }

    await (routes[k] || dashboard)(param);
  } catch (e) {
    C.innerHTML = `<div class="card err">${esc(e.message)}</div>`;
  }
}

window.addEventListener('hashchange', route);
window.onThemeChange = () => {};

if (U) route();

const subjOpts = (sel) =>
  SUBJECTS.map(
    (s) =>
      `<option value="${s.id}" ${s.id == sel ? 'selected' : ''}>${esc(
        s.name
      )}</option>`
  ).join('');


/* =========================================================
   DASHBOARD
   ========================================================= */

async function dashboard() {
  const d = await api('/teacher/dashboard');

  C.innerHTML = `
    <h1 class="page-title">Welcome, ${esc(U.name)}</h1>

    <div class="grid stats">
      ${stat('My Exams', d.my_exams, '🗂️', 'blue')}
      ${stat('Published Exams', d.published, '🚀', 'purple')}
      ${stat('Total Students', d.total_students, '🎓', 'cyan')}
      ${stat('Total Attempts', d.attempts, '✅', 'orange')}
      ${stat(
        'Average Score',
        r1(d.avg_score) + '%',
        '📈',
        'green'
      )}
      ${stat(
        'Top Performer',
        d.top_performer ? esc(d.top_performer.name) : '-',
        '🏆',
        'red'
      )}
    </div>

    <div class="card">
      <h3>Quick actions</h3>

      <div class="actions">
        <a class="btn primary" href="#create">+ Create Exam</a>
        <a class="btn" href="#questions">Question Bank</a>
        <a class="btn" href="#assignments">Assign Exams</a>
        <a class="btn" href="analytics.html">View Analytics</a>
      </div>

      ${
        d.top_performer
          ? `<p class="muted" style="margin-bottom:0">
              Top performer:
              <b>${esc(d.top_performer.name)}</b>
              (${esc(d.top_performer.user_code)})
              with an average of ${d.top_performer.percentage}%.
            </p>`
          : ''
      }
    </div>
  `;
}


/* =========================================================
   QUESTION MODAL - ADD / EDIT
   ========================================================= */

function questionModal(q, onSaved, defaults = {}) {
  const m = modal(
    q ? 'Edit Question' : 'Add Question',

    `
    <form id="qf">

      <div class="row2">

        <div>
          <label>Subject</label>

          <select id="q_sub" required>
            <option value="">Select subject</option>
            ${subjOpts(q?.subject_id || defaults.subject_id)}
          </select>
        </div>

        <div>
          <label>Topic name *</label>

          <input
            id="q_topic"
            required
            list="topicList"
            value="${esc(q?.topic || '')}"
            placeholder="e.g. Python Functions"
          >

          <datalist id="topicList"></datalist>
        </div>

      </div>

      <label>Question text</label>

      <textarea id="q_text" required>${esc(
        q?.question_text || ''
      )}</textarea>

      <div class="row2">

        <div>
          <label>Option A</label>
          <input
            id="q_a"
            required
            value="${esc(q?.option_a || '')}"
          >
        </div>

        <div>
          <label>Option B</label>
          <input
            id="q_b"
            required
            value="${esc(q?.option_b || '')}"
          >
        </div>

        <div>
          <label>Option C</label>
          <input
            id="q_c"
            required
            value="${esc(q?.option_c || '')}"
          >
        </div>

        <div>
          <label>Option D</label>
          <input
            id="q_d"
            required
            value="${esc(q?.option_d || '')}"
          >
        </div>

      </div>

      <div class="row2">

        <div>
          <label>Correct answer</label>

          <select id="q_ans">
            ${['A', 'B', 'C', 'D']
              .map(
                (x) =>
                  `<option ${
                    q?.correct_answer === x ? 'selected' : ''
                  }>${x}</option>`
              )
              .join('')}
          </select>
        </div>

        <div>
          <label>Marks</label>

          <input
            id="q_marks"
            type="number"
            min="1"
            required
            value="${q?.marks || 1}"
          >
        </div>

      </div>

      <button
        class="btn primary block"
        style="margin-top:14px"
      >
        Save question
      </button>

    </form>
    `,
    { wide: true }
  );

  const loadTopics = async () => {
    try {
      const t = await api(
        '/teacher/topics?subject_id=' +
          ($('#q_sub', m).value || '')
      );

      $('#topicList', m).innerHTML = t
        .map((x) => `<option value="${esc(x)}">`)
        .join('');
    } catch (e) {
      /* optional */
    }
  };

  $('#q_sub', m).onchange = loadTopics;

  loadTopics();

  $('#qf', m).onsubmit = safe(async (e) => {
    e.preventDefault();

    const body = {
      subject_id: $('#q_sub').value,
      topic: $('#q_topic').value.trim(),
      question_text: $('#q_text').value.trim(),
      option_a: $('#q_a').value.trim(),
      option_b: $('#q_b').value.trim(),
      option_c: $('#q_c').value.trim(),
      option_d: $('#q_d').value.trim(),
      correct_answer: $('#q_ans').value,
      marks: $('#q_marks').value
    };

    if (q) {
      await api('/teacher/questions/' + q.id, {
        method: 'PUT',
        body
      });
    } else {
      await api('/teacher/questions', {
        method: 'POST',
        body
      });
    }

    m.close();

    toast('Question saved');

    onSaved();
  });
}


/* =========================================================
   CREATE / EDIT EXAM
   ========================================================= */

async function examForm(id) {
  const ex = id
    ? await api('/teacher/exams/' + id)
    : null;

  const sel = new Set(ex ? ex.question_ids : []);

  const now = new Date();
  const later = new Date(Date.now() + 7 * 864e5);

  C.innerHTML = `
    <h1 class="page-title">
      ${ex ? 'Edit Exam' : 'Create Exam'}
    </h1>

    <form id="ef">

      <div class="card">

        <h3>Exam details</h3>

        <label>Exam Title</label>

        <input
          id="e_title"
          required
          value="${esc(ex?.title || '')}"
        >

        <div class="row2">

          <div>
            <label>Subject</label>

            <select id="e_sub" required>
              <option value="">Select subject</option>
              ${subjOpts(ex?.subject_id)}
            </select>
          </div>

          <div>
            <label>Duration (minutes)</label>

            <input
              id="e_dur"
              type="number"
              min="1"
              required
              value="${ex?.duration_minutes || 30}"
            >
          </div>

        </div>

        <label>Description</label>

        <textarea id="e_desc">${esc(
          ex?.description || ''
        )}</textarea>

        <div class="row3">

          <div>
            <label>
              Maximum Marks
              (auto = sum of selected questions)
            </label>

            <input
              id="e_max"
              type="number"
              readonly
              value="${ex?.max_marks || 0}"
            >
          </div>

          <div>
            <label>Start Date</label>

            <input
              id="e_start"
              type="datetime-local"
              required
              value="${toLocalInput(
                ex?.start_date || now
              )}"
            >
          </div>

          <div>
            <label>End Date</label>

            <input
              id="e_end"
              type="datetime-local"
              required
              value="${toLocalInput(
                ex?.end_date || later
              )}"
            >
          </div>

        </div>

      </div>

      <div class="card">

        <div class="page-head">

          <h3 style="margin:0">
            Select questions

            <span
              class="badge blue"
              id="selCount"
            >
              0 selected
            </span>
          </h3>

          <button
            type="button"
            class="btn sm primary"
            id="newQ"
          >
            + New question
          </button>

        </div>

        <div class="filters">

          <input
            id="pq_search"
            placeholder="Search questions…"
          >

          <select id="pq_topic">
            <option value="">All topics</option>
          </select>

        </div>

        <div id="picker"></div>

      </div>

      <button
        class="btn primary"
        style="padding:12px 30px"
      >
        ${ex ? 'Save changes' : 'Create exam'}
      </button>

      <a class="btn" href="#exams">
        Cancel
      </a>

    </form>
  `;

  let all = [];

  const sum = () => {
    const t = all
      .filter((q) => sel.has(q.id))
      .reduce((s, q) => s + q.marks, 0);

    if (sel.size) {
      $('#e_max').value = t;
    }

    $('#selCount').textContent =
      sel.size + ' selected';
  };

  const draw = () => {
    const s = $('#pq_search').value.toLowerCase();
    const tp = $('#pq_topic').value;

    const f = all.filter(
      (q) =>
        (!tp || q.topic === tp) &&
        (!s ||
          q.question_text
            .toLowerCase()
            .includes(s) ||
          q.topic.toLowerCase().includes(s))
    );

    $('#picker').innerHTML = f.length
      ? table(
          [
            {
              h: '✔',
              f: (q) =>
                `<input
                  type="checkbox"
                  data-id="${q.id}"
                  ${sel.has(q.id) ? 'checked' : ''}
                >`
            },
            {
              h: 'Question',
              f: (q) =>
                esc(q.question_text.slice(0, 90))
            },
            {
              h: 'Topic',
              f: (q) =>
                `<span class="badge purple">
                  ${esc(q.topic)}
                </span>`
            },
            {
              h: 'Marks',
              f: (q) => q.marks
            }
          ],
          f
        )
      : `
        <div class="loading">
          Choose a subject to load its questions,
          or click “New question”.
        </div>
      `;

    $$('#picker input[type=checkbox]').forEach(
      (c) => {
        c.onchange = () => {
          c.checked
            ? sel.add(+c.dataset.id)
            : sel.delete(+c.dataset.id);

          sum();
        };
      }
    );
  };

  const loadQs = safe(async () => {
    const s = $('#e_sub').value;

    all = s
      ? await api(
          '/teacher/questions?subject_id=' + s
        )
      : [];

    const ids = new Set(
      all.map((q) => q.id)
    );

    [...sel].forEach((x) => {
      if (!ids.has(x) && s) {
        sel.delete(x);
      }
    });

    const topics = [
      ...new Set(all.map((q) => q.topic))
    ].sort();

    $('#pq_topic').innerHTML =
      '<option value="">All topics</option>' +
      topics
        .map(
          (t) =>
            `<option>${esc(t)}</option>`
        )
        .join('');

    draw();
    sum();
  });

  $('#e_sub').onchange = loadQs;

  $('#pq_search').oninput = draw;

  $('#pq_topic').onchange = draw;

  $('#newQ').onclick = () =>
    questionModal(
      null,
      loadQs,
      {
        subject_id: $('#e_sub').value
      }
    );

  await loadQs();

  $('#ef').onsubmit = safe(async (e) => {
    e.preventDefault();

    const body = {
      title: $('#e_title').value.trim(),
      subject_id: $('#e_sub').value,
      description: $('#e_desc').value,
      duration_minutes: $('#e_dur').value,
      max_marks: $('#e_max').value,

      start_date: new Date(
        $('#e_start').value
      ).toISOString(),

      end_date: new Date(
        $('#e_end').value
      ).toISOString(),

      question_ids: [...sel]
    };

    const d = ex
      ? await api('/teacher/exams/' + ex.id, {
          method: 'PUT',
          body
        })
      : await api('/teacher/exams', {
          method: 'POST',
          body
        });

    toast(
      `${d.message}. Max marks: ${d.max_marks}`
    );

    location.hash = '#exams';
  });
}


/* =========================================================
   PERFORMANCE HELPERS
   ========================================================= */

function performanceTopicList(items, type) {
  if (!Array.isArray(items) || !items.length) {
    return `<span class="muted">None</span>`;
  }

  const badgeClass =
    type === 'strong'
      ? 'green'
      : type === 'needs'
      ? 'orange'
      : type === 'skipped'
      ? 'orange'
      : 'red';

  return `
    <div class="actions" style="margin-top:6px">
      ${items
        .map((t) => {

          const topic =
            typeof t === 'string'
              ? t
              : t.topic;

          const pct =
            typeof t === 'object' &&
            t.percentage !== undefined
              ? ` (${r1(t.percentage)}%)`
              : '';

          return `
            <span class="badge ${badgeClass}">
              ${esc(topic)}${pct}
            </span>
          `;
        })
        .join(' ')}
    </div>
  `;
}


function violationLabel(type) {
  const names = {
    TAB_SWITCH: 'Tab Switch',
    FULLSCREEN_EXIT: 'Fullscreen Exit',
    FACE_NOT_DETECTED: 'Face Not Detected',
    MULTIPLE_FACE_DETECTED: 'Multiple Faces'
  };

  return names[type] || type || 'Unknown Violation';
}


function violationTypeChips(types, summary) {

  const list = Array.isArray(types)
    ? types
    : summary
      ? Object.keys(summary)
      : [];

  if (!list.length) {
    return '<span class="muted">None</span>';
  }

  return list
    .map((type) => {

      const count =
        summary && summary[type]
          ? ` (${summary[type]})`
          : '';

      return `
        <span class="badge red">
          ${esc(violationLabel(type))}${count}
        </span>
      `;
    })
    .join(' ');
}


function rulesViolationBlock(student) {

  const total =
    Number(
      student.total_violations ??
      student.violations ??
      student.violation_count ??
      0
    );

  const rules =
    student.rules_violated === true ||
    Number(student.rules_violated || 0) === 1;

  const types =
    Array.isArray(student.violation_types)
      ? student.violation_types
      : [];

  const summary =
    student.violation_summary &&
    typeof student.violation_summary === 'object'
      ? student.violation_summary
      : {};

  const reason =
    student.submit_reason ||
    student.submission_status ||
    '';

  if (!total && !rules && !types.length) {
    return `
      <div
        style="
          padding:12px;
          border-radius:10px;
          border:1px solid var(--border);
          margin-top:14px;
        "
      >
        <b>🛡️ Exam Rules</b>

        <p
          class="muted"
          style="margin:6px 0 0"
        >
          No rule violations recorded.
        </p>
      </div>
    `;
  }

  return `
    <div
      style="
        padding:14px;
        border-radius:10px;
        border:1px solid var(--border);
        margin-top:14px;
      "
    >

      <div class="page-head">

        <b>⚠️ Exam Rules</b>

        ${
          rules
            ? `
              <span class="badge red">
                Rules Violated
              </span>
            `
            : `
              <span class="badge orange">
                Violations Recorded
              </span>
            `
        }

      </div>

      <p style="margin:6px 0">
        <b>Total violations:</b>
        ${total}
      </p>

      ${
        reason
          ? `
            <p style="margin:6px 0">
              <b>Submission:</b>
              ${esc(String(reason))}
            </p>
          `
          : ''
      }

      <div style="margin-top:8px">

        <b>Violation types:</b>

        <div style="margin-top:6px">
          ${violationTypeChips(types, summary)}
        </div>

      </div>

      ${
        rules
          ? `
            <p
              style="
                margin:10px 0 0;
                font-weight:600;
              "
            >
              🚨 The exam was automatically submitted
              because the maximum allowed violations
              were reached.
            </p>
          `
          : ''
      }

    </div>
  `;
}


function studentPerformanceCard(student) {

  const skipped =
    student.unanswered_count ??
    student.skipped_count ??
    student.skipped ??
    0;

  const strong =
    student.strong_topics || [];

  const needs =
    student.needs_improvement_topics ||
    student.needs_topics ||
    [];

  const weak =
    student.weak_topics || [];

  const skippedTopics =
    student.skipped_topics || [];


  return `
    <div
      class="card"
      style="margin-bottom:14px"
    >

      <div class="page-head">

        <div>

          <h3 style="margin-bottom:4px">
            #${student.rank || '-'}
            ${esc(student.name)}
          </h3>

          <div class="muted">
            Student ID:
            <b>${esc(student.user_code)}</b>
          </div>

        </div>

        <div style="text-align:right">

          <div
            style="
              font-size:1.35rem;
              font-weight:700;
            "
          >
            ${r1(student.percentage)}%
          </div>

          <div class="muted">
            ${student.marks}/${student.max_marks} marks
          </div>

        </div>

      </div>


      <div
        class="grid stats"
        style="margin-top:12px"
      >

        ${stat(
          'Correct',
          student.correct_count,
          '✅',
          'green'
        )}

        ${stat(
          'Wrong',
          student.wrong_count,
          '❌',
          'red'
        )}

        ${stat(
          'Skipped',
          skipped,
          '⏭️',
          'orange'
        )}

        ${stat(
          'Percentage',
          r1(student.percentage) + '%',
          '📊',
          'blue'
        )}

      </div>


      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(220px,1fr));
          gap:12px;
          margin-top:14px;
        "
      >

        <div
          style="
            padding:12px;
            border-radius:10px;
            border:1px solid var(--border);
          "
        >
          <b>🟢 Strong Topics</b>

          ${performanceTopicList(
            strong,
            'strong'
          )}
        </div>


        <div
          style="
            padding:12px;
            border-radius:10px;
            border:1px solid var(--border);
          "
        >
          <b>🟠 Needs Improvement</b>

          ${performanceTopicList(
            needs,
            'needs'
          )}
        </div>


        <div
          style="
            padding:12px;
            border-radius:10px;
            border:1px solid var(--border);
          "
        >
          <b>🔴 Weak Topics</b>

          ${performanceTopicList(
            weak,
            'weak'
          )}
        </div>


        <div
          style="
            padding:12px;
            border-radius:10px;
            border:1px solid var(--border);
          "
        >
          <b>⏭️ Skipped Topics</b>

          ${performanceTopicList(
            skippedTopics,
            'skipped'
          )}

          <p
            class="muted"
            style="
              font-size:.82rem;
              margin:8px 0 0;
            "
          >
            Skipped questions are not counted
            as wrong for topic classification.
          </p>
        </div>

      </div>


      ${rulesViolationBlock(student)}

    </div>
  `;
}


/* =========================================================
   STUDENT PERFORMANCE
   ========================================================= */

async function showExamPerformance(examId, title) {

  const d = await api(
    `/teacher/exams/${examId}/analytics`
  );

  const students = Array.isArray(d.students)
    ? d.students
    : [];


  const content = `
    <div>

      <div class="grid stats">

        ${stat(
          'Assigned',
          d.total_assigned,
          '👥',
          'blue'
        )}

        ${stat(
          'Attempted',
          d.attempted,
          '✅',
          'green'
        )}

        ${stat(
          'Not Attempted',
          d.not_attempted,
          '⏳',
          'orange'
        )}

        ${stat(
          'Average',
          r1(d.avg_pct) + '%',
          '📈',
          'purple'
        )}

        ${stat(
          'Highest',
          d.highest,
          '🔝',
          'cyan'
        )}

        ${stat(
          'Lowest',
          d.lowest,
          '🔻',
          'red'
        )}

      </div>


      <div
        class="card"
        style="margin-top:16px"
      >

        <h3>
          👨‍🎓 Student Performance
        </h3>

        <p class="muted">
          Topic-wise performance is calculated
          using answered questions only.
          Skipped questions do not reduce the
          topic percentage.
        </p>

        ${
          students.length
            ? students
                .map(studentPerformanceCard)
                .join('')
            : `
              <div class="loading">
                No student submissions yet.
              </div>
            `
        }

      </div>

    </div>
  `;


  modal(
    'Student Performance - ' + title,
    content,
    { wide: true }
  );
}


/* =========================================================
   MY EXAMS
   ========================================================= */

async function exams() {

  C.innerHTML = `
    <div class="page-head">

      <h1 class="page-title">
        My Exams
      </h1>

      <a
        class="btn primary"
        href="#create"
      >
        + Create Exam
      </a>

    </div>

    <div class="card" id="tbl"></div>
  `;


  async function load() {

    const rows = await api('/teacher/exams');


    $('#tbl').innerHTML = table(
      [
        {
          h: 'Title',
          f: (r) =>
            `<b>${esc(r.title)}</b>`
        },

        {
          h: 'Subject',
          f: (r) =>
            esc(r.subject_name)
        },

        {
          h: 'Questions',
          f: (r) =>
            r.question_count
        },

        {
          h: 'Marks',
          f: (r) =>
            r.max_marks
        },

        {
          h: 'Duration',
          f: (r) =>
            r.duration_minutes + ' min'
        },

        {
          h: 'Window',
          f: (r) =>
            `<small>
              ${fmt(r.start_date)}
              <br>→
              ${fmt(r.end_date)}
            </small>`
        },

        {
          h: 'Assigned',
          f: (r) =>
            `${r.assigned}${
              r.assign_all
                ? ' <span class="badge blue">all</span>'
                : ''
            }`
        },

        {
          h: 'Attempts',
          f: (r) =>
            r.attempts
        },

        {
          h: 'Status',
          f: (r) =>
            `<span class="badge ${
              r.is_published
                ? 'green'
                : 'gray'
            }">
              ${
                r.is_published
                  ? 'Published'
                  : 'Draft'
              }
            </span>`
        },

        {
          h: 'Actions',
          f: (r) =>
            `<div class="actions">

              <a
                class="btn sm"
                href="#create/${r.id}"
              >
                Edit
              </a>

              <button
                class="btn sm"
                data-a="assign"
                data-id="${r.id}"
              >
                Assign
              </button>

              <button
                class="btn sm ${
                  r.is_published
                    ? 'orange'
                    : 'green'
                }"
                data-a="pub"
                data-id="${r.id}"
              >
                ${
                  r.is_published
                    ? 'Unpublish'
                    : 'Publish'
                }
              </button>

              <button
                class="btn sm"
                data-a="res"
                data-id="${r.id}"
              >
                Results
              </button>

              <button
                class="btn sm primary"
                data-a="performance"
                data-id="${r.id}"
              >
                Performance
              </button>

              <a
                class="btn sm"
                href="leaderboard.html?exam=${r.id}"
              >
                Ranking
              </a>

              <button
                class="btn sm danger"
                data-a="del"
                data-id="${r.id}"
              >
                Delete
              </button>

            </div>`
        }
      ],
      rows,
      'No exams yet. Click “Create Exam”.'
    );


    $$('#tbl [data-a]').forEach(
      (b) => {

        const r = rows.find(
          (x) =>
            x.id == b.dataset.id
        );


        b.onclick = safe(async () => {


          /* ---------- Publish / Unpublish ---------- */

          if (b.dataset.a === 'pub') {

            await api(
              '/teacher/exams/' + r.id,
              {
                method: 'PUT',
                body: {
                  is_published:
                    r.is_published
                      ? 0
                      : 1
                }
              }
            );

            toast(
              r.is_published
                ? 'Exam unpublished'
                : 'Exam published'
            );

            load();

          }


          /* ---------- Delete ---------- */

          else if (b.dataset.a === 'del') {

            if (
              confirm(
                `Delete exam "${r.title}" and all its results?`
              )
            ) {

              await api(
                '/teacher/exams/' + r.id,
                {
                  method: 'DELETE'
                }
              );

              toast('Exam deleted');

              load();
            }

          }


          /* ---------- Assignment ---------- */

          else if (b.dataset.a === 'assign') {

            location.hash =
              '#assignments/' + r.id;

          }


          /* ---------- Existing Results ---------- */

          else if (b.dataset.a === 'res') {

            const res = await api(
              `/teacher/exams/${r.id}/results`
            );


            modal(
              'Results - ' + r.title,

              table(
                [
                  {
                    h: 'Rank',
                    f: (x) =>
                      '#' + x.rank
                  },

                  {
                    h: 'Student ID',
                    f: (x) =>
                      esc(x.user_code)
                  },

                  {
                    h: 'Name',
                    f: (x) =>
                      esc(x.name)
                  },

                  {
                    h: 'Marks',
                    f: (x) =>
                      `${x.marks}/${x.max_marks}`
                  },

                  {
                    h: '%',
                    f: (x) =>
                      x.percentage + '%'
                  },

                  {
                    h: 'Correct',
                    f: (x) =>
                      x.correct_count
                  },

                  {
                    h: 'Wrong',
                    f: (x) =>
                      x.wrong_count
                  },

                  {
                    h: 'Skipped',
                    f: (x) =>
                      x.unanswered_count
                  },

                  {
                    h: 'Rules',
                    f: (x) => {

                      const rules =
                        x.rules_violated === true ||
                        Number(x.rules_violated || 0) === 1;

                      const total =
                        Number(
                          x.total_violations ??
                          x.violations ??
                          0
                        );

                      if (rules) {
                        return `
                          <span class="badge red">
                            ⚠️ Rules Violated
                          </span>
                        `;
                      }

                      if (total > 0) {
                        return `
                          <span class="badge orange">
                            ${total} violation${total === 1 ? '' : 's'}
                          </span>
                        `;
                      }

                      return `
                        <span class="badge green">
                          No violations
                        </span>
                      `;
                    }
                  },

                  {
                    h: 'Violation Types',
                    f: (x) => {

                      const types =
                        Array.isArray(x.violation_types)
                          ? x.violation_types
                          : [];

                      const summary =
                        x.violation_summary &&
                        typeof x.violation_summary === 'object'
                          ? x.violation_summary
                          : {};

                      return violationTypeChips(
                        types,
                        summary
                      );
                    }
                  },

                  {
                    h: 'Submission',
                    f: (x) => {

                      if (
                        x.rules_violated === true ||
                        Number(x.rules_violated || 0) === 1
                      ) {
                        return `
                          <span class="badge red">
                            Auto-submitted
                          </span>
                        `;
                      }

                      if (
                        x.submit_reason === 'TIMEOUT'
                      ) {
                        return `
                          <span class="badge orange">
                            Time expired
                          </span>
                        `;
                      }

                      return `
                        <span class="badge green">
                          Submitted
                        </span>
                      `;
                    }
                  }

                ],
                res,
                'No submissions yet'
              ),
              {
                wide: true
              }
            );

          }


          /* ---------- Student Performance ---------- */

          else if (
            b.dataset.a === 'performance'
          ) {

            await showExamPerformance(
              r.id,
              r.title
            );

          }

        });
      }
    );
  }

  return load();
}


/* =========================================================
   QUESTION BANK
   ========================================================= */

async function questions() {

  C.innerHTML = `
    <div class="page-head">

      <h1 class="page-title">
        Question Bank
      </h1>

      <button
        class="btn primary"
        id="add"
      >
        + Add Question
      </button>

    </div>

    <div class="card">

      <div class="filters">

        <input
          id="qs"
          placeholder="Search question or topic…"
        >

        <select id="qsub">
          <option value="">
            All subjects
          </option>

          ${subjOpts()}
        </select>

        <select id="qtopic">
          <option value="">
            All topics
          </option>
        </select>

      </div>

      <div id="tbl"></div>

    </div>
  `;


  async function topics() {

    const t = await api(
      '/teacher/topics?subject_id=' +
        $('#qsub').value
    );

    const cur =
      $('#qtopic').value;

    $('#qtopic').innerHTML =
      '<option value="">All topics</option>' +
      t
        .map(
          (x) =>
            `<option ${
              x === cur
                ? 'selected'
                : ''
            }>
              ${esc(x)}
            </option>`
        )
        .join('');
  }


  async function load() {

    const p = new URLSearchParams({
      search: $('#qs').value,
      subject_id: $('#qsub').value,
      topic: $('#qtopic').value
    });

    const rows = await api(
      '/teacher/questions?' + p
    );


    $('#tbl').innerHTML = table(
      [
        {
          h: '#',
          f: (r, i) => i + 1
        },

        {
          h: 'Question',
          f: (r) =>
            esc(
              r.question_text.slice(0, 100)
            )
        },

        {
          h: 'Subject',
          f: (r) =>
            esc(r.subject_name)
        },

        {
          h: 'Topic',
          f: (r) =>
            `<span class="badge purple">
              ${esc(r.topic)}
            </span>`
        },

        {
          h: 'Answer',
          f: (r) =>
            r.correct_answer
        },

        {
          h: 'Marks',
          f: (r) =>
            r.marks
        },

        {
          h: 'Actions',
          f: (r) =>
            `<div class="actions">

              <button
                class="btn sm"
                data-a="edit"
                data-id="${r.id}"
              >
                Edit
              </button>

              <button
                class="btn sm danger"
                data-a="del"
                data-id="${r.id}"
              >
                Delete
              </button>

            </div>`
        }
      ],
      rows,
      'No questions found'
    );


    $$('#tbl [data-a]').forEach(
      (b) => {

        const r = rows.find(
          (x) =>
            x.id == b.dataset.id
        );


        b.onclick = safe(async () => {

          if (
            b.dataset.a === 'edit'
          ) {

            questionModal(
              r,
              () => {
                topics();
                load();
              }
            );

          } else if (
            confirm(
              'Delete this question?'
            )
          ) {

            await api(
              '/teacher/questions/' + r.id,
              {
                method: 'DELETE'
              }
            );

            toast('Question deleted');

            topics();

            load();
          }

        });

      }
    );
  }


  $('#add').onclick = () =>
    questionModal(
      null,
      () => {
        topics();
        load();
      },
      {
        subject_id:
          $('#qsub').value
      }
    );


  $('#qs').oninput =
    debounce(safe(load));

  $('#qsub').onchange =
    safe(async () => {
      await topics();
      await load();
    });

  $('#qtopic').onchange =
    safe(load);

  await topics();

  return load();
}


/* =========================================================
   ASSIGNMENTS
   ========================================================= */

async function assignments(preId) {

  const [exs, studs] =
    await Promise.all([
      api('/teacher/exams'),
      api('/teacher/students')
    ]);


  C.innerHTML = `
    <h1 class="page-title">
      Assignments
    </h1>

    <div class="card">

      <label>
        Choose exam
      </label>

      <select id="a_exam">

        <option value="">
          Select an exam
        </option>

        ${exs
          .map(
            (e) =>
              `<option
                value="${e.id}"
                ${
                  e.id == preId
                    ? 'selected'
                    : ''
                }
              >
                ${esc(e.title)}
                (
                ${
                  e.is_published
                    ? 'published'
                    : 'draft'
                }
                )
              </option>`
          )
          .join('')}

      </select>

      <div id="a_body"></div>

    </div>
  `;


  const sel = new Set();


  async function loadExam() {

    const id =
      $('#a_exam').value;

    if (!id) {
      $('#a_body').innerHTML = '';
      return;
    }


    const ex = await api(
      '/teacher/exams/' + id
    );


    sel.clear();

    ex.assigned_student_ids.forEach(
      (x) => sel.add(x)
    );


    $('#a_body').innerHTML = `
      <label>
        Assign to
      </label>

      <label style="font-weight:500">

        <input
          type="radio"
          name="mode"
          value="all"
          ${
            ex.assign_all
              ? 'checked'
              : ''
          }
        >

        All students

      </label>

      <label style="font-weight:500">

        <input
          type="radio"
          name="mode"
          value="sel"
          ${
            ex.assign_all
              ? ''
              : 'checked'
          }
        >

        Selected students

      </label>

      <div
        id="a_list"
        ${ex.assign_all ? 'hidden' : ''}
      >

        <div class="filters">

          <input
            id="a_search"
            placeholder="Search students…"
          >

        </div>

        <div id="a_tbl"></div>

      </div>

      <button
        class="btn primary"
        id="a_save"
        style="margin-top:14px"
      >
        Save assignment
      </button>

      <p class="muted">
        Remember to publish the exam so students
        can see it.
      </p>
    `;


    const draw = () => {

      const s =
        $('#a_search').value
          .toLowerCase();

      const f = studs.filter(
        (x) =>
          x.name
            .toLowerCase()
            .includes(s) ||
          x.user_code
            .toLowerCase()
            .includes(s)
      );


      $('#a_tbl').innerHTML = table(
        [
          {
            h: '✔',
            f: (x) =>
              `<input
                type="checkbox"
                data-id="${x.id}"
                ${
                  sel.has(x.id)
                    ? 'checked'
                    : ''
                }
              >`
          },

          {
            h: 'ID',
            f: (x) =>
              esc(x.user_code)
          },

          {
            h: 'Name',
            f: (x) =>
              esc(x.name)
          },

          {
            h: 'Email',
            f: (x) =>
              esc(x.email)
          }
        ],
        f
      );


      $$('#a_tbl input').forEach(
        (c) => {

          c.onchange = () => {

            c.checked
              ? sel.add(+c.dataset.id)
              : sel.delete(+c.dataset.id);

          };

        }
      );
    };


    draw();

    $('#a_search').oninput =
      draw;


    $$('input[name=mode]').forEach(
      (r) => {

        r.onchange = () => {

          $('#a_list').hidden =
            r.value === 'all' &&
            r.checked;

        };

      }
    );


    $('#a_save').onclick =
      safe(async () => {

        const all =
          $('input[name=mode]:checked')
            .value === 'all';


        const d = await api(
          `/teacher/exams/${id}/assign`,
          {
            method: 'POST',

            body: all
              ? { all: true }
              : {
                  student_ids: [...sel]
                }
          }
        );


        toast(d.message);

      });
  }


  $('#a_exam').onchange =
    safe(loadExam);


  if (preId) {
    await loadExam();
  }
}