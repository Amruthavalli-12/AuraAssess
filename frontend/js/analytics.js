const U = initShell(['STUDENT', 'TEACHER', 'ADMIN']);
const C = $('#content');


function classify(p) {

  p = Number(p) || 0;

  if (p >= 80) return 'STRONG';

  if (p >= 50) return 'NEEDS_IMPROVEMENT';

  return 'WEAK';
}


if (U && U.role === 'ADMIN')
  location.href = 'admin.html#dashboard';


let redraw = () => {};


window.onThemeChange = () =>
  redraw();


if (U && U.role === 'STUDENT')
  student().catch(fail);

else if (U && U.role === 'TEACHER')
  teacher().catch(fail);


/* ============================================================
   ERROR HANDLER
   ============================================================ */

function fail(e) {

  console.error(
    'Analytics Error:',
    e
  );


  C.innerHTML =
    `<div class="card err">
      ${esc(
        e?.message ||
        'Unable to load analytics'
      )}
    </div>`;
}


/* ============================================================
   TOPIC HELPERS
   ============================================================ */

/*
 * A topic can contain:
 *
 * 1. All answered
 * 2. Answered + skipped
 * 3. All skipped
 *
 * Important:
 *
 * - Skipped questions must NOT reduce percentage.
 * - If all questions are skipped,
 *   topic status = SKIPPED.
 */


/* ------------------------------------------------------------
   TOTAL QUESTIONS
   ------------------------------------------------------------ */

function topicTotal(t) {

  return Number(
    t?.total_questions ??
    t?.total ??
    0
  );
}


/* ------------------------------------------------------------
   CORRECT QUESTIONS
   ------------------------------------------------------------ */

function topicCorrect(t) {

  return Number(
    t?.correct_count ??
    t?.correct ??
    0
  );
}


/* ------------------------------------------------------------
   SKIPPED QUESTIONS
   ------------------------------------------------------------ */

function topicSkipped(t) {

  return Number(
    t?.skipped_count ??
    t?.skipped ??
    0
  );
}


/* ------------------------------------------------------------
   ANSWERED QUESTIONS
   ------------------------------------------------------------ */

function topicAnswered(t) {

  const total =
    topicTotal(t);


  const skipped =
    topicSkipped(t);


  return Math.max(
    0,
    total - skipped
  );
}


/* ------------------------------------------------------------
   TOPIC PERCENTAGE
   ------------------------------------------------------------ */

function topicPercentage(t) {

  const total =
    topicTotal(t);


  const correct =
    topicCorrect(t);


  const skipped =
    topicSkipped(t);


  const answered =
    Math.max(
      0,
      total - skipped
    );


  /*
   * All questions skipped.
   */

  if (
    answered === 0
  ) {

    return 0;
  }


  /*
   * Percentage is calculated
   * only from answered questions.
   */

  return (
    correct /
    answered
  ) * 100;
}


/* ------------------------------------------------------------
   TOPIC STATUS
   ------------------------------------------------------------ */

function topicStatus(t) {

  const total =
    topicTotal(t);


  const skipped =
    topicSkipped(t);


  const answered =
    Math.max(
      0,
      total - skipped
    );


  /*
   * All questions were skipped.
   */

  if (
    total > 0 &&
    answered === 0
  ) {

    return 'SKIPPED';
  }


  /*
   * At least one question answered.
   * Classify using answered questions only.
   */

  return classify(
    topicPercentage(t)
  );
}


/* ------------------------------------------------------------
   NORMALIZE TOPIC
   ------------------------------------------------------------ */

function normalizeTopic(t) {

  t =
    t || {};


  const total =
    topicTotal(t);


  const skipped =
    topicSkipped(t);


  const answered =
    Math.max(
      0,
      total - skipped
    );


  const percentage =
    topicPercentage(t);


  return {

    ...t,

    total_questions:
      total,

    correct_count:
      topicCorrect(t),

    skipped_count:
      skipped,

    answered_count:
      answered,

    percentage:
      r1(percentage),

    status:
      topicStatus(t)

  };
}


/* ============================================================
   SAFE ARRAY HELPERS
   ============================================================ */

function safeArray(value) {

  return Array.isArray(value)
    ? value
    : [];
}


/* ============================================================
   STUDENT ANALYTICS
   ============================================================ */

async function student() {

  const d =
    await api(
      '/student/analytics'
    );


  /*
   * ----------------------------------------------------------
   * SAFELY NORMALIZE BACKEND ARRAYS
   * ----------------------------------------------------------
   *
   * This prevents analytics from breaking when one of the
   * backend arrays is missing or undefined.
   */

  d.trend =
    safeArray(
      d.trend
    );


  d.topics =
    safeArray(
      d.topics
    ).map(
      normalizeTopic
    );


  d.subjects =
    safeArray(
      d.subjects
    );


  const build = () => {


    C.innerHTML = `

      <h1 class="page-title">
        My Analytics
      </h1>


      ${improvementOverall(
        d.topics
      )}


      <div class="grid two">


        ${chartCard(
          'Your Performance Trend',
          'c1'
        )}


        ${chartCard(
          'Topic Performance',
          'c2'
        )}


        ${chartCard(
          'Strong / Weak Topics',
          'c3'
        )}


        ${chartCard(
          'Subject-wise Average',
          'c4'
        )}


      </div>


      <div class="card">

        <h3>
          All Topics (across every exam)
        </h3>


        ${topicTable(
          d.topics
        )}

      </div>

    `;


    /* ========================================================
       PERFORMANCE TREND
       ======================================================== */

    chart(

      'c1',

      'line',

      {

        labels:
          d.trend.map(
            (t) =>
              t?.test ??
              t?.title ??
              ''
          ),


        datasets: [

          {

            label:
              'Score %',


            data:
              d.trend.map(
                (t) =>
                  r1(
                    t?.percentage ??
                    0
                  )
              ),


            borderColor:
              '#3b82f6',


            backgroundColor:
              'rgba(59,130,246,.18)',


            fill:
              true,


            tension:
              .3,


            pointRadius:
              5

          }

        ]

      },


      {

        scales: {

          y: {

            beginAtZero:
              true,

            max:
              100

          }

        },


        plugins: {

          tooltip: {

            callbacks: {

              /*
               * FIX:
               *
               * Previously this was:
               *
               * d.trend[i[0].dataIndex]
               *
               * If i or i[0] was undefined,
               * JavaScript produced:
               *
               * Cannot read properties of undefined
               * (reading '0')
               *
               * Now it is completely protected.
               */

              title: (items) => {

                if (
                  !Array.isArray(items) ||
                  !items.length
                ) {

                  return '';
                }


                const index =
                  Number(
                    items[0]?.dataIndex
                  );


                if (
                  !Number.isInteger(index) ||
                  !d.trend[index]
                ) {

                  return '';
                }


                return (
                  d.trend[index]?.title ??
                  d.trend[index]?.test ??
                  ''
                );
              }

            }

          }

        }

      }

    );


    /* ========================================================
       TOPIC PERFORMANCE
       ======================================================== */

    chart(

      'c2',

      'bar',

      {

        labels:
          d.topics.map(
            (t) =>
              t.topic
          ),


        datasets: [

          {

            data:
              d.topics.map(
                (t) =>
                  r1(
                    t.percentage
                  )
              ),


            backgroundColor:
              d.topics.map(
                (t) => {

                  const status =
                    topicStatus(t);


                  /*
                   * SKIPPED topics receive
                   * a neutral chart color.
                   */

                  if (
                    status ===
                    'SKIPPED'
                  ) {

                    return '#94a3b8';
                  }


                  return (
                    STATUS_COLOR?.[
                      status
                    ] ||
                    '#3b82f6'
                  );

                }
              )

          }

        ]

      },


      pctAxis

    );


    /* ========================================================
       STRONG / NEEDS / WEAK / SKIPPED
       ======================================================== */

    const cnt = (s) =>

      d.topics.filter(
        (t) =>
          topicStatus(t) === s
      ).length;


    chart(

      'c3',

      'doughnut',

      {

        labels: [

          'Strong',

          'Needs Improvement',

          'Weak',

          'Skipped'

        ],


        datasets: [

          {

            data: [

              cnt(
                'STRONG'
              ),

              cnt(
                'NEEDS_IMPROVEMENT'
              ),

              cnt(
                'WEAK'
              ),

              cnt(
                'SKIPPED'
              )

            ],


            backgroundColor: [

              '#22c55e',

              '#f97316',

              '#ef4444',

              '#94a3b8'

            ]

          }

        ]

      }

    );


    /* ========================================================
       SUBJECT-WISE AVERAGE
       ======================================================== */

    chart(

      'c4',

      'bar',

      {

        labels:
          d.subjects.map(
            (s) =>
              s?.name ??
              ''
          ),


        datasets: [

          {

            data:
              d.subjects.map(
                (s) =>
                  Number(
                    s?.percentage ??
                    0
                  )
              ),


            backgroundColor:
              PAL

          }

        ]

      },


      pctAxis

    );

  };


  redraw =
    build;


  build();
}


/* ============================================================
   TEACHER ANALYTICS
   EXISTING FEATURES + STUDENT PERFORMANCE
   ============================================================ */

async function teacher() {

  const exs =
    await api(
      '/teacher/exams'
    );


  const exams =
    safeArray(exs);


  const pre =
    new URLSearchParams(
      location.search
    ).get('exam');


  C.innerHTML = `

    <h1 class="page-title">
      Exam Analytics
    </h1>


    <div class="card">

      <label
        style="margin-top:0"
      >
        Choose exam
      </label>


      <select id="ex">

        <option value="">
          Select an exam
        </option>


        ${exams.map(
          (e) => `

            <option
              value="${e.id}"
              ${
                e.id == pre
                  ? 'selected'
                  : ''
              }
            >

              ${esc(
                e.title
              )}

            </option>

          `
        ).join('')}

      </select>

    </div>


    <div id="out"></div>

  `;


  async function load() {

    const select =
      $('#ex');


    const id =
      select
        ? select.value
        : '';


    if (!id) {

      $('#out').innerHTML =
        '';

      return;
    }


    const d =
      await api(
        `/teacher/exams/${id}/analytics`
      );


    /*
     * Safely normalize teacher data.
     */

    d.topics =
      safeArray(
        d.topics
      ).map(
        normalizeTopic
      );


    d.ranking =
      safeArray(
        d.ranking
      );


    d.students =
      safeArray(
        d.students
      );


    d.distribution =
      d.distribution ||
      {
        labels: [],
        data: []
      };


    d.distribution.labels =
      safeArray(
        d.distribution.labels
      );


    d.distribution.data =
      safeArray(
        d.distribution.data
      );


    const build = () => {

      const top =
        d.ranking.slice(
          0,
          10
        );


      /* ======================================================
         STUDENT PERFORMANCE DATA
         ====================================================== */

      const studentPerformance =
        buildTeacherStudentData(
          d
        );


      /* ======================================================
         EXISTING ANALYTICS UI
         ====================================================== */

      $('#out').innerHTML = `

        <div class="grid stats">


          ${stat(
            'Total Assigned',
            d.total_assigned ?? 0,
            '👥',
            'blue'
          )}


          ${stat(
            'Attempted',
            d.attempted ?? 0,
            '✅',
            'green'
          )}


          ${stat(
            'Not Attempted',
            d.not_attempted ?? 0,
            '⏳',
            'orange'
          )}


          ${stat(
            'Average Score',
            (
              d.avg_marks ?? 0
            ) +
              ' (' +
              r1(
                d.avg_pct ?? 0
              ) +
              '%)',
            '📈',
            'purple'
          )}


          ${stat(
            'Highest Score',
            d.highest ?? 0,
            '🔝',
            'cyan'
          )}


          ${stat(
            'Lowest Score',
            d.lowest ?? 0,
            '🔻',
            'red'
          )}


        </div>


        <div class="grid two">


          ${chartCard(
            'Score Distribution',
            'c1'
          )}


          ${chartCard(
            'Average Marks',
            'c2'
          )}


          ${chartCard(
            'Topic Performance',
            'c3'
          )}


          ${chartCard(
            'Student Ranking (Top 10)',
            'c4'
          )}


        </div>


        ${teacherStudentPerformance(
          studentPerformance
        )}

      `;


      /* ======================================================
         SCORE DISTRIBUTION
         ====================================================== */

      chart(

        'c1',

        'bar',

        {

          labels:
            d.distribution.labels,


          datasets: [

            {

              label:
                'Students',


              data:
                d.distribution.data,


              backgroundColor: [

                '#ef4444',

                '#f97316',

                '#eab308',

                '#3b82f6',

                '#22c55e'

              ]

            }

          ]

        },


        {

          plugins: {

            legend: {

              display:
                false

            }

          },


          scales: {

            y: {

              beginAtZero:
                true,


              ticks: {

                precision:
                  0

              }

            }

          }

        }

      );


      /* ======================================================
         AVERAGE MARKS
         ====================================================== */

      const examMax =
        Number(
          d.exam?.max_marks ??
          0
        );


      chart(

        'c2',

        'bar',

        {

          labels:

            d.attempted

              ? [

                  'Average',

                  'Highest',

                  'Lowest',

                  'Maximum'

                ]

              : [],


          datasets: [

            {

              data: [

                Number(
                  d.avg_marks ?? 0
                ),

                Number(
                  d.highest ?? 0
                ),

                Number(
                  d.lowest ?? 0
                ),

                examMax

              ],


              backgroundColor: [

                '#8b5cf6',

                '#22c55e',

                '#ef4444',

                '#3b82f6'

              ]

            }

          ]

        },


        {

          plugins: {

            legend: {

              display:
                false

            }

          },


          scales: {

            y: {

              beginAtZero:
                true

            }

          }

        }

      );


      /* ======================================================
         TOPIC PERFORMANCE
         ====================================================== */

      chart(

        'c3',

        'bar',

        {

          labels:
            d.topics.map(
              (t) =>
                t.topic
            ),


          datasets: [

            {

              data:
                d.topics.map(
                  (t) =>
                    r1(
                      t.percentage
                    )
                ),


              backgroundColor:
                d.topics.map(
                  (t) => {

                    const status =
                      topicStatus(t);


                    if (
                      status ===
                      'SKIPPED'
                    ) {

                      return '#94a3b8';
                    }


                    return (
                      STATUS_COLOR?.[
                        status
                      ] ||
                      '#3b82f6'
                    );

                  }
                )

            }

          ]

        },


        pctAxis

      );


      /* ======================================================
         TOP 10 RANKING
         ====================================================== */

      chart(

        'c4',

        'bar',

        {

          labels:
            top.map(
              (r) =>
                `#${r.rank} ${
                  r.name ||
                  r.student_name ||
                  '-'
                }`
            ),


          datasets: [

            {

              data:
                top.map(
                  (r) =>
                    Number(
                      r.percentage ||
                      0
                    )
                ),


              backgroundColor:
                '#06b6d4'

            }

          ]

        },


        {

          indexAxis:
            'y',


          plugins: {

            legend: {

              display:
                false

            }

          },


          scales: {

            x: {

              beginAtZero:
                true,


              max:
                100

            }

          }

        }

      );

    };


    redraw =
      build;


    build();
  }


  const examSelect =
    $('#ex');


  if (examSelect) {

    examSelect.onchange =
      () =>
        load().catch(
          fail
        );

  }


  if (pre)
    await load();
}


/* ============================================================
   BUILD STUDENT DATA FROM BACKEND STUDENTS OR RANKING
   ============================================================ */

function buildTeacherStudentData(d) {

  /*
   * Priority 1:
   * Use student-wise performance data.
   */

  if (

    Array.isArray(
      d.students
    ) &&

    d.students.length > 0

  ) {

    return d.students.map(
      normalizeTeacherStudent
    );

  }


  /*
   * Priority 2:
   * Existing ranking fallback.
   */

  if (

    Array.isArray(
      d.ranking
    ) &&

    d.ranking.length > 0

  ) {

    return d.ranking.map(
      (r) =>

        normalizeTeacherStudent({

          ...r,


          student_id:
            r.student_id ||
            r.id ||
            null,


          user_code:
            r.user_code ||
            r.student_id ||
            '-',


          name:
            r.name ||
            r.student_name ||
            '-',


          rank:
            r.rank ??
            null,


          marks:
            Number(
              r.marks ||
              r.obtained_marks ||
              0
            ),


          max_marks:
            Number(
              r.max_marks ||
              d.exam?.max_marks ||
              0
            ),


          percentage:
            Number(
              r.percentage ||
              0
            ),


          correct_count:
            Number(
              r.correct_count ||
              0
            ),


          wrong_count:
            Number(
              r.wrong_count ||
              0
            ),


          unanswered_count:
            Number(
              r.unanswered_count ||
              r.skipped_count ||
              0
            ),


          violations:
            Number(
              r.violations ||
              0
            ),


          strong_topics:
            Array.isArray(
              r.strong_topics
            )
              ? r.strong_topics
              : [],


          needs_improvement_topics:
            Array.isArray(
              r.needs_improvement_topics
            )
              ? r.needs_improvement_topics
              : [],


          weak_topics:
            Array.isArray(
              r.weak_topics
            )
              ? r.weak_topics
              : [],


          skipped_topics:
            Array.isArray(
              r.skipped_topics
            )
              ? r.skipped_topics
              : []

        })
    );

  }


  return [];
}


/* ============================================================
   NORMALIZE TEACHER STUDENT
   ============================================================ */

function normalizeTeacherStudent(
  s
) {

  s =
    s || {};


  return {

    ...s,


    strong_topics:
      Array.isArray(
        s.strong_topics
      )
        ? s.strong_topics.map(
            normalizeTopic
          )
        : [],


    needs_improvement_topics:
      Array.isArray(
        s.needs_improvement_topics
      )
        ? s.needs_improvement_topics.map(
            normalizeTopic
          )
        : [],


    weak_topics:
      Array.isArray(
        s.weak_topics
      )
        ? s.weak_topics.map(
            normalizeTopic
          )
        : [],


    skipped_topics:
      Array.isArray(
        s.skipped_topics
      )
        ? s.skipped_topics.map(
            normalizeTopic
          )
        : []

  };
}


/* ============================================================
   STUDENT-WISE PERFORMANCE
   ============================================================ */

function teacherStudentPerformance(
  students
) {

  if (
    !students ||
    !students.length
  ) {

    return `

      <div class="card">

        <div class="page-head">

          <h3
            style="margin:0"
          >
            👨‍🎓 Student-wise Performance
          </h3>

        </div>


        <div class="muted">

          No students have submitted this exam yet.

        </div>

      </div>

    `;
  }


  return `

    <div class="card">

      <div class="page-head">

        <div>

          <h2
            style="margin:0"
          >
            👨‍🎓 Student-wise Performance
          </h2>


          <p
            class="muted"
            style="margin:5px 0 0"
          >
            Individual marks, ranking and
            topic-wise performance
          </p>

        </div>


        <span class="badge blue">

          ${students.length}

          ${
            students.length === 1
              ? 'Student'
              : 'Students'
          }

        </span>

      </div>


      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>
                Rank
              </th>


              <th>
                Student ID
              </th>


              <th>
                Student Name
              </th>


              <th>
                Marks
              </th>


              <th>
                Percentage
              </th>


              <th>
                Correct
              </th>


              <th>
                Wrong
              </th>


              <th>
                Skipped
              </th>


              <th>
                Performance
              </th>

            </tr>

          </thead>


          <tbody>

            ${students.map(
              (s) =>
                teacherStudentRow(
                  s
                )
            ).join('')}

          </tbody>

        </table>

      </div>

    </div>

  `;
}


/* ============================================================
   STUDENT PERFORMANCE ROW
   ============================================================ */

function teacherStudentRow(
  s
) {

  const percentage =
    Number(
      s?.percentage || 0
    );


  const performanceClass =
    percentage >= 80

      ? 'green'

      : percentage >= 50

        ? 'orange'

        : 'red';


  const performanceText =
    percentage >= 80

      ? 'Strong'

      : percentage >= 50

        ? 'Needs Improvement'

        : 'Weak';


  const hasSkippedTopics =
    Array.isArray(
      s?.skipped_topics
    ) &&

    s.skipped_topics.length > 0;


  return `

    <tr>


      <td>

        <b>
          #${s?.rank ?? '-'}
        </b>

      </td>


      <td>

        <b>
          ${esc(
            s?.user_code || '-'
          )}
        </b>

      </td>


      <td>

        ${esc(
          s?.name || '-'
        )}

      </td>


      <td>

        <b>
          ${Number(
            s?.marks || 0
          )}
        </b>

        /

        ${Number(
          s?.max_marks || 0
        )}

      </td>


      <td>

        <span
          class="badge ${performanceClass}"
        >

          ${r1(
            percentage
          )}%

        </span>

      </td>


      <td>

        ${Number(
          s?.correct_count || 0
        )}

      </td>


      <td>

        ${Number(
          s?.wrong_count || 0
        )}

      </td>


      <td>

        ${Number(
          s?.unanswered_count ||
          s?.skipped_count ||
          0
        )}

      </td>


      <td>

        <button
          class="btn sm"
          type="button"
          onclick="toggleStudentTopics(this)"
        >

          View Topics

        </button>

      </td>

    </tr>


    <tr
      class="student-topic-row"
      hidden
    >

      <td
        colspan="9"
        style="padding:0"
      >


        <div
          class="card"
          style="margin:10px 0"
        >


          <div class="grid three">


            <!-- STRONG TOPICS -->

            <div>

              <h4>
                🟢 Strong Topics
              </h4>


              ${
                topicPerformanceList(
                  s?.strong_topics,
                  'green',
                  'No strong topics'
                )
              }

            </div>


            <!-- NEEDS IMPROVEMENT -->

            <div>

              <h4>
                🟠 Needs Improvement
              </h4>


              ${
                topicPerformanceList(
                  s?.needs_improvement_topics,
                  'orange',
                  'No topics in this category'
                )
              }

            </div>


            <!-- WEAK TOPICS -->

            <div>

              <h4>
                🔴 Weak Topics
              </h4>


              ${
                topicPerformanceList(
                  s?.weak_topics,
                  'red',
                  'No weak topics'
                )
              }

            </div>


          </div>


          <!-- SKIPPED TOPICS -->

          ${
            hasSkippedTopics

              ? `

                <div
                  style="
                    margin-top:14px;
                    padding-top:12px;
                    border-top:1px solid var(--border);
                  "
                >

                  <h4>
                    ⚪ Skipped Topics
                  </h4>


                  ${topicPerformanceList(
                    s.skipped_topics,
                    'blue',
                    'No skipped topics'
                  )}

                </div>

              `

              : ''
          }


          <div
            style="
              margin-top:14px;
              padding-top:12px;
              border-top:1px solid var(--border);
            "
          >

            <b>
              Overall Performance:
            </b>


            <span
              class="badge ${performanceClass}"
              style="margin-left:6px"
            >

              ${performanceText}

            </span>

          </div>


        </div>

      </td>

    </tr>

  `;
}


/* ============================================================
   TOPIC PERFORMANCE LIST
   ============================================================ */

function topicPerformanceList(
  topics,
  badgeClass,
  emptyText
) {

  if (
    !topics ||
    !topics.length
  ) {

    return `

      <p class="muted">

        ${emptyText}

      </p>

    `;
  }


  return `

    <div>

      ${topics.map(
        (t) => {

          const normalized =
            normalizeTopic(t);


          const skipped =
            Number(
              normalized.skipped_count ||
              0
            );


          const total =
            Number(
              normalized.total_questions ||
              0
            );


          const correct =
            Number(
              normalized.correct_count ||
              0
            );


          const answered =
            Math.max(
              0,
              total - skipped
            );


          return `

            <div
              style="
                padding:8px 0;
                border-bottom:1px solid var(--border);
              "
            >

              <b>

                ${esc(
                  normalized.topic ||
                  '-'
                )}

              </b>


              <span
                class="badge ${badgeClass}"
                style="margin-left:5px"
              >

                ${
                  normalized.status ===
                  'SKIPPED'

                    ? 'Skipped'

                    : `${r1(
                        normalized.percentage
                      )}%`
                }

              </span>


              <br>


              <small
                class="muted"
              >

                ${
                  normalized.status ===
                  'SKIPPED'

                    ? `${skipped} skipped`

                    : `${correct}/${answered} answered correctly`
                }


                ${
                  skipped > 0 &&
                  normalized.status !==
                    'SKIPPED'

                    ? ` · ${skipped} skipped`

                    : ''
                }

              </small>

            </div>

          `;

        }
      ).join('')}

    </div>

  `;
}


/* ============================================================
   SHOW / HIDE STUDENT TOPICS
   ============================================================ */

function toggleStudentTopics(
  button
) {

  const currentRow =
    button.closest('tr');


  const topicRow =
    currentRow
      ? currentRow.nextElementSibling
      : null;


  if (!topicRow)
    return;


  topicRow.hidden =
    !topicRow.hidden;


  button.textContent =
    topicRow.hidden

      ? 'View Topics'

      : 'Hide Topics';
}

/* ============================================================
   IMPROVEMENT OVERALL
   ============================================================ */

function improvementOverall(
  topics
) {

  /*
   * Normalize all topics first.
   *
   * Important:
   * - Skipped questions are NOT counted as wrong.
   * - A topic with some answered + some skipped is classified
   *   using answered questions only.
   * - A topic with all questions skipped becomes SKIPPED.
   */

  topics =
    safeArray(
      topics
    ).map(
      normalizeTopic
    );


  const subOf = (t) =>
    t?.subject || '';


  const label = (t) =>
    esc(
      t?.topic || '-'
    ) +

    (
      subOf(t)

        ? ` <span class="muted">
             · ${esc(
               subOf(t)
             )}
           </span>`

        : ''
    );


  const g = (s) =>
    topics.filter(
      (t) =>
        topicStatus(t) === s
    );


  /* ----------------------------------------------------------
     TOPIC LIST
     ---------------------------------------------------------- */

  const li = (
    arr,
    sym
  ) =>

    arr.length

      ? arr.map(
          (t) => {

            const skipped =
              topicSkipped(t);

            const answered =
              topicAnswered(t);

            const percentage =
              topicPercentage(t);


            return `

              <li>

                ${sym}

                ${label(t)}

                <span class="muted">

                  (${r1(
                    percentage
                  )}%)

                </span>


                ${
                  skipped > 0

                    ? `

                      <span
                        class="muted"
                        title="These questions were skipped and were not counted in the percentage"
                      >

                        · ${skipped} skipped

                      </span>

                    `

                    : ''
                }

              </li>

            `;

          }
        ).join('')

      : '<li class="muted">None</li>';


  /* ----------------------------------------------------------
     WEAK + NEEDS IMPROVEMENT
     ---------------------------------------------------------- */

  const weak =
    topics

      .filter(
        (t) => {

          const status =
            topicStatus(t);


          return (

            status ===
              'WEAK' ||

            status ===
              'NEEDS_IMPROVEMENT'

          );

        }
      )


      .sort(
        (a, b) =>

          topicPercentage(a) -
          topicPercentage(b)

      );


  /* ----------------------------------------------------------
     SKIPPED TOPICS
     ---------------------------------------------------------- */

  const skippedTopics =
    topics.filter(
      (t) =>
        topicStatus(t) ===
        'SKIPPED'
    );


  /* ----------------------------------------------------------
     ANSWERED TOPICS
     ---------------------------------------------------------- */

  const answeredTopics =
    topics.filter(
      (t) =>
        topicStatus(t) !==
        'SKIPPED'
    );


  const strongTopics =
    g('STRONG');


  /* ----------------------------------------------------------
     IMPROVEMENT / FOCUS MESSAGE
     ---------------------------------------------------------- */

  let focus = '';


  if (weak.length) {

    /*
     * There are actual Weak / Needs Improvement topics.
     */

    focus =
      weak.map(
        (t) => {

          const status =
            topicStatus(t);

          const skipped =
            topicSkipped(t);


          return `

            <li>

              ${
                status ===
                'WEAK'

                  ? '⚠'

                  : '•'
              }


              You need to improve


              <b>

                ${esc(
                  t.topic
                )}

              </b>


              ${
                subOf(t)

                  ? ' in ' +
                    esc(
                      subOf(t)
                    )

                  : ''
              }


              <span class="muted">

                (${r1(
                  topicPercentage(t)
                )}%)

              </span>


              ${
                skipped > 0

                  ? `

                    <span class="muted">

                      · ${skipped} skipped

                    </span>

                  `

                  : ''
              }

            </li>

          `;

        }
      ).join('');

  } else if (
    answeredTopics.length === 0 &&
    skippedTopics.length > 0
  ) {

    /*
     * There are no answered topics at all.
     *
     * IMPORTANT:
     * Do NOT say "All answered topics are strong".
     */

    focus = `

      <li class="muted">

        No answered topics to evaluate yet.
        You skipped all available topic questions.

      </li>

    `;

  } else if (
    skippedTopics.length > 0
  ) {

    /*
     * All answered topics are strong, BUT there are
     * completely skipped topics.
     *
     * Therefore we must NOT give the misleading message
     * "All topics are strong".
     */

    focus = `

      <li class="muted">

        All answered topics are strong. 🎉

        Some topics were completely skipped and
        are shown separately below.

      </li>

    `;

  } else {

    /*
     * No skipped topics and no weak/needs topics.
     * Therefore it is genuinely correct to say all
     * answered topics are strong.
     */

    focus = `

      <li class="muted">

        All answered topics are strong.
        Great work! 🎉

      </li>

    `;

  }


  /* ----------------------------------------------------------
     IMPROVEMENT PLAN
     ---------------------------------------------------------- */

  const groups = {};


  weak.forEach(
    (t) => {

      const key =
        subOf(t) ||
        'Other topics';


      if (!groups[key]) {

        groups[key] = [];

      }


      groups[key].push(t);

    }
  );


  const plan =
    Object.keys(groups)

      .sort()

      .map(
        (name) => `

          <div class="card">

            <h3>

              📌

              ${esc(name)}:
              what to improve

            </h3>


            ${
              groups[name]

                .map(
                  (t) => {

                    const total =
                      topicTotal(t);


                    const correct =
                      topicCorrect(t);


                    const skipped =
                      topicSkipped(t);


                    const answered =
                      Math.max(
                        0,
                        total - skipped
                      );


                    /*
                     * Calculate the additional correct
                     * answers needed to reach 80%.
                     *
                     * Skipped questions are NOT included.
                     */

                    const more =
                      Math.max(

                        1,

                        Math.ceil(

                          0.8 *
                            answered -
                          correct

                        )

                      );


                    const tip =
                      improveTip(
                        name,
                        t.topic
                      ) ||

                      `Revise the concepts in ${t.topic} and practise more questions on it. Open your past results to see the exact questions you missed.`;


                    const status =
                      topicStatus(t);


                    return `

                      <div
                        class="q-review ${
                          status ===
                          'WEAK'

                            ? 'no'

                            : 'na'
                        }"
                      >

                        <b>

                          ${esc(
                            t.topic
                          )}

                        </b>


                        <span
                          class="badge ${
                            status ===
                            'WEAK'

                              ? 'red'

                              : 'orange'
                          }"
                        >

                          ${
                            status ===
                            'WEAK'

                              ? 'Weak'

                              : 'Needs Improvement'
                          }

                        </span>


                        <small
                          class="muted"
                        >

                          ·

                          ${correct}/${answered}
                          answered correctly


                          ${
                            skipped > 0

                              ? ` · ${skipped} skipped`

                              : ''
                          }


                          (${r1(
                            topicPercentage(t)
                          )}%)

                        </small>


                        <br>


                        <span>

                          You need to improve


                          <b>

                            ${esc(
                              t.topic
                            )}

                          </b>


                          ${
                            name !==
                            'Other topics'

                              ? ' in ' +
                                esc(name)

                              : ''
                          }.


                          ${esc(tip)}

                        </span>


                        <br>


                        <small>

                          Target: about


                          <b>
                            ${more}
                          </b>


                          more correct


                          ${
                            more === 1

                              ? 'answer'

                              : 'answers'
                          }


                          in this topic to reach
                          Strong (80%).

                        </small>


                      </div>

                    `;

                  }
                )

                .join('')

            }

          </div>

        `
      )

      .join('');


  /* ----------------------------------------------------------
     FINAL ANALYTICS SUMMARY
     ---------------------------------------------------------- */

  return `

    <div class="grid three">


      <!-- STRONG TOPICS -->

      <div class="card tgroup">

        <h4>
          STRONG TOPICS
        </h4>


        <ul
          class="tlist t-strong"
        >

          ${li(
            strongTopics,
            '✓'
          )}

        </ul>

      </div>


      <!-- WEAK TOPICS -->

      <div class="card tgroup">

        <h4>
          WEAK TOPICS
        </h4>


        <ul
          class="tlist t-weak"
        >

          ${li(
            g('WEAK'),
            '⚠'
          )}

        </ul>

      </div>


      <!-- NEEDS IMPROVEMENT -->

      <div class="card tgroup">

        <h4>
          NEEDS IMPROVEMENT
        </h4>


        <ul class="tlist t-needs">

          ${focus}

        </ul>

      </div>


    </div>


    <!-- COMPLETELY SKIPPED TOPICS -->

    ${
      skippedTopics.length

        ? `

          <div
            class="card"
            style="margin-top:14px"
          >

            <h3>
              ⚪ Skipped Topics
            </h3>


            <p class="muted">

              These topics were completely skipped.
              They are not counted as Weak or
              Needs Improvement.

            </p>


            <ul class="tlist">

              ${
                skippedTopics

                  .map(
                    (t) => `

                      <li>

                        ⚪

                        ${label(t)}

                        <span class="muted">

                          (${topicSkipped(t)}
                          skipped)

                        </span>

                      </li>

                    `
                  )

                  .join('')
              }

            </ul>

          </div>

        `

        : ''
    }


    <!-- IMPROVEMENT PLAN -->

    ${plan}

  `;

}