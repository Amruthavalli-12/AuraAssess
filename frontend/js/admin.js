const U = initShell(['ADMIN']);
const C = $('#content');

const routes = {
  dashboard,
  teachers: () => usersView('TEACHER'),
  students: () => usersView('STUDENT'),
  subjects,
  performance
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
window.onThemeChange = route;

if (U) route();


/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

async function dashboard() {
  const d = await api('/admin/stats');

  C.innerHTML = `
    <h1 class="page-title">Admin Dashboard</h1>

    <div class="grid stats">
      ${stat('Total Teachers', d.teachers, '👩‍🏫', 'blue')}
      ${stat('Total Students', d.students, '🎓', 'purple')}
      ${stat('Total Exams', d.exams, '📝', 'cyan')}
      ${stat('Total Attempts', d.attempts, '✅', 'orange')}
      ${stat('Average Performance', r1(d.avg_perf) + '%', '📈', 'green')}
    </div>

    <div class="grid two">
      ${chartCard('Student Performance (Top 10, avg %)', 'c1')}
      ${chartCard('Subject Performance (avg %)', 'c2')}
      ${chartCard('Exam Participation (attempts)', 'c3')}
      ${chartCard('Score Distribution', 'c4')}
    </div>
  `;

  chart(
    'c1',
    'bar',
    {
      labels: d.studentPerf.map((x) => x.name),
      datasets: [{
        data: d.studentPerf.map((x) => r1(x.pct)),
        backgroundColor: PAL
      }]
    },
    pctAxis
  );

  chart(
    'c2',
    'bar',
    {
      labels: d.subjectPerf.map((x) => x.name),
      datasets: [{
        data: d.subjectPerf.map((x) => r1(x.pct)),
        backgroundColor: PAL
      }]
    },
    pctAxis
  );

  chart(
    'c3',
    'bar',
    {
      labels: d.participation.map((x) => x.title),
      datasets: [{
        label: 'Attempts',
        data: d.participation.map((x) => x.attempts),
        backgroundColor: '#06b6d4'
      }]
    },
    {
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  );

  chart(
    'c4',
    'doughnut',
    {
      labels: d.distribution.labels,
      datasets: [{
        data: d.distribution.data,
        backgroundColor: [
          '#ef4444',
          '#f97316',
          '#eab308',
          '#3b82f6',
          '#22c55e'
        ]
      }]
    }
  );
}


/* =========================================================
   TEACHER / STUDENT MANAGEMENT
   ========================================================= */

function usersView(role) {
  const label = role === 'TEACHER' ? 'Teacher' : 'Student';

  const base =
    '/admin/' +
    (role === 'TEACHER' ? 'teachers' : 'students');

  C.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">Manage ${label}s</h1>
      <button class="btn primary" id="add">+ Add ${label}</button>
    </div>

    <div class="card">
      <div class="filters">
        <input
          id="q"
          placeholder="Search by ID, name or email…"
        >

        <select id="st">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div id="tbl"></div>
    </div>
  `;

  async function load() {
    const rows = await api(
      `${base}?search=${encodeURIComponent($('#q').value)}&status=${$('#st').value}`
    );

    $('#tbl').innerHTML = table(
      [
        {
          h: 'ID',
          f: (r) => `<b>${esc(r.user_code)}</b>`
        },

        {
          h: 'Name',
          f: (r) => esc(r.name)
        },

        {
          h: 'Email',
          f: (r) => esc(r.email)
        },

        {
          h: 'Role',
          f: (r) => esc(r.role)
        },

        {
          h: 'Status',
          f: (r) => `
            <span class="badge ${r.status === 'active' ? 'green' : 'red'}">
              ${r.status}
            </span>

            ${r.password_set
              ? ''
              : ' <span class="badge orange">no password yet</span>'
            }
          `
        },

        {
          h: 'Actions',
          f: (r) => `
            <div class="actions">

              <button
                class="btn sm"
                data-a="view"
                data-id="${r.id}"
              >
                View
              </button>

              <button
                class="btn sm"
                data-a="edit"
                data-id="${r.id}"
              >
                Edit
              </button>

              <button
                class="btn sm ${r.status === 'active' ? 'orange' : 'green'}"
                data-a="toggle"
                data-id="${r.id}"
              >
                ${r.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>

              <button
                class="btn sm danger"
                data-a="del"
                data-id="${r.id}"
              >
                Delete
              </button>

            </div>
          `
        }
      ],
      rows,
      `No ${label.toLowerCase()}s found`
    );

    $$('#tbl [data-a]').forEach((b) => {
      b.onclick = () =>
        act(
          b.dataset.a,
          rows.find((x) => x.id == b.dataset.id)
        );
    });
  }

  const safe = (fn) => async (...a) => {
    try {
      await fn(...a);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  async function act(a, r) {
    if (a === 'view') {
      const d = await api(`${base}/${r.id}`);

      const extra =
        role === 'STUDENT'
          ? `
            <p>
              <b>Tests taken:</b> ${d.tests}
              <br>
              <b>Average:</b> ${d.avg_pct}%
            </p>
          `
          : `
            <p>
              <b>Exams created:</b> ${d.exam_count}
            </p>
          `;

      modal(
        `${label} details`,
        `
          <div class="profile-head" style="margin:14px 0">
            ${avatarHtml(d)}

            <div>
              <h3 style="margin:0">
                ${esc(d.name)}
              </h3>

              <span class="muted">
                ${esc(d.user_code)} · ${esc(d.role)}
              </span>
            </div>
          </div>

          <p>
            <b>Email:</b> ${esc(d.email)}
            <br>

            <b>Status:</b> ${d.status}
            <br>

            <b>Password set:</b>
            ${
              d.password_set
                ? 'Yes'
                : 'No (will be created at first login)'
            }
            <br>

            <b>Created:</b> ${fmt(d.created_at)}
          </p>

          ${extra}
        `
      );

    } else if (a === 'edit') {

      form(r);

    } else if (a === 'toggle') {

      await api(`${base}/${r.id}`, {
        method: 'PUT',
        body: {
          status:
            r.status === 'active'
              ? 'inactive'
              : 'active'
        }
      });

      toast('Status updated');
      load();

    } else if (
      a === 'del' &&
      confirm(
        `Delete ${label.toLowerCase()} ${r.name}? All their data will be removed.`
      )
    ) {

      await api(`${base}/${r.id}`, {
        method: 'DELETE'
      });

      toast(`${label} deleted`);
      load();
    }
  }

  function form(r) {
    const m = modal(
      r ? `Edit ${label}` : `Add ${label}`,

      `
        <form id="uf">

          <label>${label} ID</label>

          <input
            id="f_code"
            required
            value="${esc(r?.user_code || '')}"
            placeholder="${role === 'TEACHER' ? 'T003' : 'S006'}"
          >

          <label>Name</label>

          <input
            id="f_name"
            required
            value="${esc(r?.name || '')}"
          >

          <label>Email</label>

          <input
            id="f_email"
            type="email"
            required
            value="${esc(r?.email || '')}"
          >

          <label>Role</label>

          <input
            value="${label}"
            disabled
          >

          ${
            r
              ? `
                <label>Status</label>

                <select id="f_st">
                  <option
                    value="active"
                    ${r.status === 'active' ? 'selected' : ''}
                  >
                    Active
                  </option>

                  <option
                    value="inactive"
                    ${r.status === 'inactive' ? 'selected' : ''}
                  >
                    Inactive
                  </option>
                </select>
              `
              : `
                <p class="muted" style="font-size:.85rem">
                  No password is set. The user creates one at first login.
                </p>
              `
          }

          <button
            class="btn primary block"
            style="margin-top:14px"
          >
            ${r ? 'Save changes' : `Create ${label}`}
          </button>

        </form>
      `
    );

    $('#uf', m).onsubmit = safe(async (e) => {
      e.preventDefault();

      const body = {
        user_code: $('#f_code').value.trim(),
        name: $('#f_name').value.trim(),
        email: $('#f_email').value.trim()
      };

      if (r) {
        body.status = $('#f_st').value;

        await api(`${base}/${r.id}`, {
          method: 'PUT',
          body
        });

      } else {
        await api(base, {
          method: 'POST',
          body
        });
      }

      m.close();

      toast(
        r
          ? `${label} updated`
          : `${label} created`
      );

      load();
    });
  }

  $('#add').onclick = () => form(null);

  $('#q').oninput = debounce(safe(load));
  $('#st').onchange = safe(load);

  return load();
}


/* =========================================================
   SUBJECT MANAGEMENT
   ========================================================= */

async function subjects() {
  C.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">Subjects</h1>

      <button class="btn primary" id="add">
        + Add Subject
      </button>
    </div>

    <div class="card" id="tbl"></div>
  `;

  const safe = (fn) => async (...a) => {
    try {
      await fn(...a);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  async function load() {
    const rows = await api('/admin/subjects');

    $('#tbl').innerHTML = table(
      [
        {
          h: '#',
          f: (r, i) => i + 1
        },

        {
          h: 'Subject',
          f: (r) => `<b>${esc(r.name)}</b>`
        },

        {
          h: 'Description',
          f: (r) => esc(r.description || '-')
        },

        {
          h: 'Exams',
          f: (r) => r.exam_count
        },

        {
          h: 'Questions',
          f: (r) => r.question_count
        },

        {
          h: 'Actions',
          f: (r) => `
            <div class="actions">

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

            </div>
          `
        }
      ],
      rows
    );

    $$('#tbl [data-a]').forEach((b) => {

      const r = rows.find(
        (x) => x.id == b.dataset.id
      );

      b.onclick = safe(async () => {

        if (b.dataset.a === 'edit') {

          form(r);

        } else if (
          confirm(`Delete subject ${r.name}?`)
        ) {

          await api(
            '/admin/subjects/' + r.id,
            {
              method: 'DELETE'
            }
          );

          toast('Subject deleted');
          load();
        }
      });
    });
  }

  function form(r) {
    const m = modal(
      r ? 'Edit Subject' : 'Add Subject',

      `
        <form id="sf">

          <label>Subject name</label>

          <input
            id="s_name"
            required
            value="${esc(r?.name || '')}"
          >

          <label>Description</label>

          <textarea id="s_desc">${esc(
            r?.description || ''
          )}</textarea>

          <button
            class="btn primary block"
            style="margin-top:14px"
          >
            Save
          </button>

        </form>
      `
    );

    $('#sf', m).onsubmit = safe(async (e) => {

      e.preventDefault();

      const body = {
        name: $('#s_name').value.trim(),
        description: $('#s_desc').value.trim()
      };

      if (r) {

        await api(
          '/admin/subjects/' + r.id,
          {
            method: 'PUT',
            body
          }
        );

      } else {

        await api(
          '/admin/subjects',
          {
            method: 'POST',
            body
          }
        );
      }

      m.close();

      toast('Subject saved');

      load();
    });
  }

  $('#add').onclick = () => form(null);

  return load();
}


/* =========================================================
   ADMIN PERFORMANCE
   ========================================================= */

async function performance() {

  const rows = await api('/admin/performance');

  C.innerHTML = `
    <h1 class="page-title">
      Student Performance
    </h1>

    <div class="card">

      <div class="filters">

        <input
          id="q"
          placeholder="Search student ID or name…"
        >

      </div>

      <div id="tbl"></div>

    </div>
  `;


  /* ---------- Helpers ---------- */

  /*
   * Topic data can come from the backend in either form:
   *
   * 1. "Arrays"
   *
   * or
   *
   * 2. {
   *      topic: "Arrays",
   *      percentage: 0,
   *      status: "SKIPPED"
   *    }
   *
   * This helper safely extracts the actual topic name.
   */
  const topicName = (t) => {

    if (t === null || t === undefined) {
      return '';
    }

    if (typeof t === 'string' ||
        typeof t === 'number') {
      return String(t);
    }

    if (typeof t === 'object') {

      return String(
        t.topic ??
        t.name ??
        t.topic_name ??
        t.title ??
        ''
      );
    }

    return String(t);
  };


  /*
   * Convert topic array into badges.
   */
  const chips = (a, c) => {

    if (!Array.isArray(a) || !a.length) {
      return '<span class="muted">-</span>';
    }

    return a
      .map((t) => {

        const name =
          topicName(t);

        if (!name) {
          return '';
        }

        return `
          <span class="badge ${c}">
            ${esc(name)}
          </span>
        `;

      })
      .filter(Boolean)
      .join(' ');
  };


  const violationNames = {
    TAB_SWITCH: 'Tab Switch',
    FULLSCREEN_EXIT: 'Fullscreen Exit',
    FACE_NOT_DETECTED: 'Face Not Detected',
    MULTIPLE_FACE_DETECTED: 'Multiple Faces'
  };


  const violationChips = (types) => {

    if (!Array.isArray(types) || !types.length) {
      return '<span class="muted">None</span>';
    }

    return types
      .map((t) => {

        /*
         * Violation type should normally be a string.
         * This also protects the UI if backend sends an object.
         */
        const type =
          typeof t === 'object'
            ? (
                t.violation_type ??
                t.type ??
                t.name ??
                ''
              )
            : t;

        return `
          <span class="badge red">
            ${esc(
              violationNames[type] ||
              type
            )}
          </span>
        `;

      })
      .join(' ');
  };


  const violationDetails = (r) => {

    const total =
      Number(r.total_violations || 0);

    const types =
      Array.isArray(r.violation_types)
        ? r.violation_types
        : [];

    const rules =
      Number(r.rules_violated || 0) === 1 ||
      r.rules_violated === true;

    if (!total && !rules) {
      return '<span class="badge green">No violations</span>';
    }

    return `
      <div style="line-height:1.8">

        <span class="badge red">
          ${total} violation${total === 1 ? '' : 's'}
        </span>

        ${rules
          ? '<span class="badge orange">Rules Violated</span>'
          : ''
        }

        <div style="margin-top:6px">
          ${violationChips(types)}
        </div>

      </div>
    `;
  };


  /*
   * Skipped topics are displayed separately.
   *
   * Important:
   * If backend sends objects, display only the topic name.
   */
  const skippedChips = (a) => {

    if (!Array.isArray(a) || !a.length) {
      return '<span class="muted">-</span>';
    }

    return a
      .map((t) => {

        const name =
          topicName(t);

        if (!name) {
          return '';
        }

        return `
          <span class="badge orange">
            ${esc(name)}
          </span>
        `;

      })
      .filter(Boolean)
      .join(' ');
  };


  /* ---------- Table ---------- */

  const draw = () => {

    const s =
      $('#q').value
        .toLowerCase()
        .trim();

    const f = rows.filter(
      (r) =>
        String(r.user_code || '')
          .toLowerCase()
          .includes(s) ||
        String(r.name || '')
          .toLowerCase()
          .includes(s)
    );


    $('#tbl').innerHTML = table(
      [

        {
          h: 'Student ID',
          f: (r) =>
            `<b>${esc(r.user_code)}</b>`
        },

        {
          h: 'Name',
          f: (r) =>
            esc(r.name)
        },

        {
          h: 'Tests Taken',
          f: (r) =>
            r.tests
        },

        {
          h: 'Average Marks',
          f: (r) =>
            r.avg_marks
        },

        {
          h: 'Percentage',
          f: (r) =>
            `${r.pct}%${pbar(r.pct)}`
        },

        {
          h: 'Rank',
          f: (r) =>
            r.rank
              ? '#' + r.rank
              : '-'
        },

        {
          h: 'Strong Topics',
          f: (r) =>
            chips(
              r.strong_topics,
              'green'
            )
        },

        {
          h: 'Needs Improvement',
          f: (r) =>
            chips(
              r.needs_topics,
              'orange'
            )
        },

        {
          h: 'Weak Topics',
          f: (r) =>
            chips(
              r.weak_topics,
              'red'
            )
        },

        {
          h: 'Skipped Topics',
          f: (r) =>
            skippedChips(
              r.skipped_topics
            )
        },

        {
          h: 'Violations',
          f: (r) =>
            violationDetails(r)
        }

      ],
      f
    );
  };


  $('#q').oninput = draw;

  draw();
}