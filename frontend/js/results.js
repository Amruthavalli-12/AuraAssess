const U = initShell(['STUDENT']);
const C = $('#content');

const attempt =
  new URLSearchParams(location.search).get('attempt');


/* ============================================================
   START
   ============================================================ */

async function run() {

  try {

    attempt
      ? await detail()
      : await list();

  } catch (e) {

    C.innerHTML =
      `<div class="card err">
        ${esc(e.message)}
      </div>`;

  }
}


window.onThemeChange = run;

if (U)
  run();


/* ============================================================
   RESULT LIST
   ============================================================ */

async function list() {

  const rows =
    await api('/student/results');


  C.innerHTML = `

    <h1 class="page-title">
      My Results
    </h1>

    <div class="card">

      ${table(

        [

          {
            h: 'Exam',

            f: (r) =>
              `<b>
                ${esc(r.title)}
              </b>`
          },


          {
            h: 'Subject',

            f: (r) =>
              esc(r.subject)
          },


          {
            h: 'Score',

            f: (r) =>
              `${r.obtained_marks}/${r.max_marks}`
          },


          {
            h: 'Percentage',

            f: (r) =>
              `${r1(r.percentage)}%${pbar(r.percentage)}`
          },


          {
            h: 'Correct / Wrong / Skipped',

            f: (r) =>
              `${r.correct_count}
               /
               ${r.wrong_count}
               /
               ${r.unanswered_count}`
          },


          {
            h: 'Status',

            f: (r) =>
              r.rules_violated ||
              String(
                r.submit_reason || ''
              ).toUpperCase() === 'VIOLATION'

                ? `<span class="badge red">
                    🚨 Rules Violated
                  </span>`

                : String(
                    r.submit_reason || ''
                  ).toUpperCase() === 'TIMEOUT'

                  ? `<span class="badge orange">
                      ⏱️ Time Over
                    </span>`

                  : `<span class="badge green">
                      ✓ Submitted
                    </span>`
          },


          {
            h: 'Rank',

            f: (r) =>
              '#' + r.rank_pos
          },


          {
            h: 'Date',

            f: (r) =>
              fmt(r.created_at)
          },


          {
            h: '',

            f: (r) =>
              `<a
                class="btn sm primary"
                href="results.html?attempt=${r.attempt_id}"
              >
                View analysis
              </a>`
          }

        ],

        rows,

        'No results yet. Complete an exam to see your analysis.'

      )}

    </div>
  `;
}


/* ============================================================
   TOPIC STATUS HELPERS
   ============================================================ */

/*
 * IMPORTANT:
 *
 * SKIPPED is NOT treated as WEAK.
 *
 * Strong / Needs Improvement / Weak are calculated only
 * from questions that were actually answered.
 */


/* ------------------------------------------------------------
   CHECK SKIPPED TOPIC
   ------------------------------------------------------------ */

function isSkippedTopic(t) {

  return (
    String(
      t.status || ''
    ).toUpperCase() ===
    'SKIPPED'
  );

}


/* ------------------------------------------------------------
   GET TOTAL QUESTIONS
   ------------------------------------------------------------ */

function topicTotal(t) {

  return Number(
    t.total_questions ??
    t.total ??
    0
  );

}


/* ------------------------------------------------------------
   GET CORRECT COUNT
   ------------------------------------------------------------ */

function topicCorrect(t) {

  return Number(
    t.correct_count ??
    t.correct ??
    0
  );

}


/* ------------------------------------------------------------
   GET WRONG COUNT
   ------------------------------------------------------------ */

function topicWrong(t) {

  /*
   * If backend supplies wrong_count,
   * use it directly.
   */

  if (
    t.wrong_count !== undefined &&
    t.wrong_count !== null
  ) {

    return Number(
      t.wrong_count
    );

  }


  const total =
    topicTotal(t);


  const correct =
    topicCorrect(t);


  const skipped =
    topicSkipped(t);


  /*
   * Wrong =
   * total - correct - skipped
   */

  return Math.max(
    0,
    total -
      correct -
      skipped
  );

}


/* ------------------------------------------------------------
   GET SKIPPED COUNT
   ------------------------------------------------------------ */

function topicSkipped(t) {

  /*
   * Prefer the exact backend value.
   */

  if (
    t.skipped_count !== undefined &&
    t.skipped_count !== null
  ) {

    return Math.max(
      0,
      Number(
        t.skipped_count
      )
    );

  }


  if (
    t.skipped !== undefined &&
    t.skipped !== null
  ) {

    return Math.max(
      0,
      Number(
        t.skipped
      )
    );

  }


  /*
   * If the backend explicitly says SKIPPED
   * and does not provide skipped_count,
   * all questions are treated as skipped.
   *
   * This is safe for single-result topic data.
   */

  if (
    isSkippedTopic(t)
  ) {

    return topicTotal(t);

  }


  /*
   * For normal topics, skipped is derived
   * only when wrong_count is available.
   */

  if (
    t.wrong_count !== undefined &&
    t.wrong_count !== null
  ) {

    return Math.max(
      0,
      topicTotal(t) -
        topicCorrect(t) -
        Number(
          t.wrong_count
        )
    );

  }


  /*
   * Without explicit skipped information,
   * the exact skipped count cannot be safely
   * reconstructed from percentage alone.
   *
   * Return 0 here. detail() enriches topics
   * from the actual answer review whenever
   * review data is available.
   */

  return 0;

}


/* ------------------------------------------------------------
   ANSWERED COUNT
   ------------------------------------------------------------ */

function topicAnswered(t) {

  return Math.max(
    0,
    topicTotal(t) -
      topicSkipped(t)
  );

}


/* ------------------------------------------------------------
   ANSWERED-QUESTION PERCENTAGE
   ------------------------------------------------------------ */

function answeredTopicPercentage(t) {

  const answered =
    topicAnswered(t);


  const correct =
    topicCorrect(t);


  /*
   * No answered questions means the topic
   * is skipped rather than weak.
   */

  if (
    answered <= 0
  ) {

    return 0;

  }


  return round(
    (
      correct /
      answered
    ) * 100
  );

}


/* ------------------------------------------------------------
   TOPIC STATUS
   ------------------------------------------------------------ */

function topicStatus(t) {

  const status =
    String(
      t.status || ''
    ).toUpperCase();


  /*
   * Explicit SKIPPED status always wins.
   */

  if (
    status ===
    'SKIPPED'
  ) {

    return 'SKIPPED';

  }


  const total =
    topicTotal(t);


  const skipped =
    topicSkipped(t);


  /*
   * If every question was skipped,
   * the topic is SKIPPED.
   */

  if (
    total > 0 &&
    skipped >= total
  ) {

    return 'SKIPPED';

  }


  /*
   * Otherwise classify using answered
   * questions only.
   */

  const answered =
    Math.max(
      0,
      total -
        skipped
    );


  if (
    answered <= 0
  ) {

    return 'SKIPPED';

  }


  const percentage =
    answeredTopicPercentage(t);


  if (
    percentage >= 80
  ) {

    return 'STRONG';

  }


  if (
    percentage >= 50
  ) {

    return 'NEEDS_IMPROVEMENT';

  }


  return 'WEAK';

}


/* ============================================================
   TOPIC DISPLAY
   ============================================================ */

function resultTopicBadge(t) {

  const status =
    topicStatus(t);


  if (
    status ===
    'SKIPPED'
  ) {

    return `
      <span class="badge orange">
        ⏭️ Skipped
      </span>
    `;

  }


  if (
    status ===
    'STRONG'
  ) {

    return `
      <span class="badge green">
        Strong
      </span>
    `;

  }


  if (
    status ===
    'NEEDS_IMPROVEMENT'
  ) {

    return `
      <span class="badge orange">
        Needs Improvement
      </span>
    `;

  }


  return `
    <span class="badge red">
      Weak
    </span>
  `;

}
/* ============================================================
   IMPROVEMENT BLOCK
   ============================================================ */

function improvementBlock(
  subject,
  topics,
  review
) {

  const sub =
    esc(
      subject ||
      'this subject'
    );


  /*
   * SKIPPED topics are completely removed from
   * Strong / Weak / Needs Improvement.
   */

  const usableTopics =
    (topics || []).filter(
      (t) =>
        topicStatus(t) !==
        'SKIPPED'
    );


  const g =
    (s) =>
      usableTopics.filter(
        (t) =>
          topicStatus(t) ===
          s
      );


  const li =
    (
      arr,
      sym
    ) =>

      arr.length

        ? arr.map(
            (t) => `

              <li>

                ${sym}

                ${esc(t.topic)}

                <span class="muted">

                  (${r1(
                    answeredTopicPercentage(t)
                  )}%)

                </span>

              </li>

            `
          ).join('')

        : '<li class="muted">None</li>';


  /*
   * Only answered topics are sent to improvement logic.
   */

  const items =
    improveItems(
      subject,
      usableTopics,
      review
    );


  const focus =
    items.length

      ? items.map(
          (i) => `

            <li>

              ${
                topicStatus(i.t) ===
                'WEAK'

                  ? '⚠'

                  : '•'
              }

              You need to improve

              <b>
                ${esc(i.t.topic)}
              </b>

              in ${sub}

              <span class="muted">

                (${r1(
                  answeredTopicPercentage(i.t)
                )}%)

              </span>

            </li>

          `
        ).join('')

      : usableTopics.length

        ? `

          <li class="muted">

            Nothing to improve in this test.
            Great work! 🎉

          </li>

        `

        : `

          <li class="muted">

            No answered topics available for
            improvement analysis.

          </li>

        `;


  /*
   * Improvement plan
   */

  const plan =
    items.length

      ? `

        <div class="card">

          <h3>
            📌 Your Improvement Plan · ${sub}
          </h3>

          <p
            class="muted"
            style="margin-top:0"
          >

            Built from the questions you answered
            in this test, weakest topic first.

          </p>


          ${items.map(
            (i) => {

              const status =
                topicStatus(i.t);


              const percentage =
                answeredTopicPercentage(i.t);


              const answered =
                topicAnswered(i.t);


              return `

                <div
                  class="q-review ${
                    status === 'WEAK'
                      ? 'no'
                      : 'na'
                  }"
                >

                  <b>
                    ${esc(i.t.topic)}
                  </b>


                  <span
                    class="badge ${
                      status === 'WEAK'
                        ? 'red'
                        : 'orange'
                    }"
                  >

                    ${
                      status === 'WEAK'
                        ? 'Weak'
                        : 'Needs Improvement'
                    }

                  </span>


                  <small class="muted">

                    ·

                    ${topicCorrect(i.t)}/${answered}
                    answered correctly

                    (${r1(
                      percentage
                    )}%)

                  </small>


                  <br>


                  <span>

                    You need to improve

                    <b>
                      ${esc(i.t.topic)}
                    </b>

                    in ${sub}.

                    ${esc(i.tip)}

                  </span>


                  <br>


                  <small>

                    ${
                      i.need > 0

                        ? `Target: answer
                           <b>${i.need}</b>
                           more
                           ${
                             i.need === 1
                               ? 'question'
                               : 'questions'
                           }
                           correctly in this topic
                           to reach Strong (80%).`

                        : `You are close to the
                           Strong level; keep practising.`
                    }

                  </small>


                  ${
                    i.missed &&
                    i.missed.length

                      ? `

                        <ul
                          style="
                            margin:6px 0 0;
                            padding-left:18px
                          "
                        >

                          <small>
                            Questions to revisit:
                          </small>


                          ${
                            i.missed
                              .slice(0, 4)
                              .map(
                                (q) => `

                                  <li>

                                    <small>

                                      ${esc(
                                        q.question_text.length > 110

                                          ? q.question_text.slice(
                                              0,
                                              107
                                            ) + '…'

                                          : q.question_text
                                      )}

                                      <b>

                                        (Answer:
                                        ${q.correct_answer}.
                                        ${esc(
                                          q[
                                            'option_' +
                                            q.correct_answer
                                              .toLowerCase()
                                          ]
                                        )})

                                      </b>

                                    </small>

                                  </li>

                                `
                              )
                              .join('')
                          }

                        </ul>

                      `

                      : ''
                  }

                </div>

              `;

            }
          ).join('')}

        </div>

      `

      : '';


  /*
   * Skipped topics section
   */

  const skippedTopics =
    (topics || []).filter(
      (t) =>
        topicStatus(t) ===
        'SKIPPED'
    );


  const skippedBlock =
    skippedTopics.length

      ? `

        <div class="card">

          <h3>
            ⏭️ Skipped Topics
          </h3>

          <p class="muted">

            These topics are not marked as
            Weak because no questions in these
            topics were answered.

          </p>


          <div>

            ${skippedTopics.map(
              (t) => {

                const skipped =
                  topicSkipped(t);


                return `

                  <span
                    class="badge orange"
                    style="margin:4px"
                  >

                    ${esc(t.topic)}

                    ·

                    ${skipped}
                    skipped

                  </span>

                `;

              }
            ).join('')}

          </div>

        </div>

      `

      : '';


  return `

    <div class="grid three">


      <!-- STRONG -->

      <div class="card tgroup">

        <h4>
          STRONG TOPICS
        </h4>

        <ul
          class="tlist t-strong"
        >

          ${li(
            g('STRONG'),
            '✓'
          )}

        </ul>

      </div>


      <!-- WEAK -->

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


    ${skippedBlock}


    ${plan}

  `;

}


/* ============================================================
   VIOLATION LABEL
   ============================================================ */

function violationLabel(type) {

  const labels = {

    TAB_SWITCH:
      'Tab Switch / Left Exam Window',

    FULLSCREEN_EXIT:
      'Fullscreen Exit',

    FACE_NOT_DETECTED:
      'Face Not Detected',

    MULTIPLE_FACE_DETECTED:
      'Multiple Faces Detected'

  };


  return (
    labels[
      String(
        type || ''
      ).toUpperCase()
    ] ||
    String(
      type || 'Unknown Violation'
    )
      .replaceAll(
        '_',
        ' '
      )
  );

}


/* ============================================================
   VIOLATION DETAILS BLOCK
   ============================================================ */

function violationBlock(r) {

  const violations =
    Array.isArray(
      r.violations
    )
      ? r.violations
      : [];


  const rulesViolated =
    r.rules_violated ||
    String(
      r.submit_reason || ''
    ).toUpperCase() ===
      'VIOLATION';


  /*
   * Only display this section when violation
   * activity actually exists.
   */

  if (
    !rulesViolated &&
    !violations.length &&
    !Number(
      r.violation_count || 0
    )
  ) {

    return '';

  }


  /*
   * Get unique violation types.
   */

  const uniqueTypes = [
    ...new Set(
      violations
        .map(
          (v) =>
            String(
              v.violation_type || ''
            ).toUpperCase()
        )
        .filter(Boolean)
    )
  ];


  /*
   * If backend returns a violation_types array,
   * use it as an additional source.
   */

  if (
    Array.isArray(
      r.violation_types
    )
  ) {

    r.violation_types
      .forEach(
        (type) => {

          const normalized =
            String(
              type || ''
            ).toUpperCase();


          if (
            normalized &&
            !uniqueTypes.includes(
              normalized
            )
          ) {

            uniqueTypes.push(
              normalized
            );

          }

        }
      );

  }


  const typeBadges =
    uniqueTypes.length

      ? uniqueTypes.map(
          (type) => {

            const count =
              violations.filter(
                (v) =>
                  String(
                    v.violation_type || ''
                  ).toUpperCase() ===
                  type
              ).length;


            return `

              <span
                class="badge red"
                style="margin:4px"
              >

                ⚠️
                ${esc(
                  violationLabel(type)
                )}

                ${
                  count > 0
                    ? `(${count})`
                    : ''
                }

              </span>

            `;

          }
        ).join('')

      : `

          <span class="muted">
            Violation details are not available.
          </span>

        `;


  const maxViolations =
    Number(
      r.max_violations || 0
    );


  return `

    <div
      class="card"
      style="
        margin-top:14px;
        border-left:4px solid #ef4444;
      "
    >

      <h3>
        🚨 Exam Rule Violations
      </h3>


      <p
        class="muted"
        style="margin-top:0"
      >

        ${
          rulesViolated

            ? `The exam was automatically submitted
               because the maximum allowed violation
               limit was reached.`

            : `Violation activity was recorded
               during this exam.`
        }

      </p>


      <div
        style="
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap:8px;
          margin:10px 0;
        "
      >

        <b>
          Violations:
        </b>

        <span class="badge red">

          ${Number(
            r.violation_count || 0
          )}

          ${
            maxViolations > 0
              ? ` / ${maxViolations}`
              : ''
          }

        </span>

      </div>


      <div>

        <b>
          Violation Types:
        </b>

        <div
          style="
            margin-top:6px;
          "
        >

          ${typeBadges}

        </div>

      </div>


      ${
        violations.length

          ? `

            <div
              style="
                margin-top:14px;
              "
            >

              <b>
                Violation History
              </b>


              <div
                style="
                  margin-top:8px;
                "
              >

                ${violations.map(
                  (v, i) => `

                    <div
                      class="q-review no"
                      style="
                        margin-bottom:6px;
                      "
                    >

                      <b>
                        ${i + 1}.
                        ${esc(
                          violationLabel(
                            v.violation_type
                          )
                        )}
                      </b>


                      <span class="muted">

                        ·
                        Count:
                        ${Number(
                          v.violation_count || 0
                        )}

                      </span>


                      ${
                        v.created_at

                          ? `

                            <br>

                            <small class="muted">

                              ${fmt(
                                v.created_at
                              )}

                            </small>

                          `

                          : ''
                      }

                    </div>

                  `
                ).join('')}

              </div>

            </div>

          `

          : ''

      }

    </div>

  `;

}


/* ============================================================
   RESULT SUBMISSION REASON
   ============================================================ */

function submissionReason(r) {

  const reason =
    String(
      r.submit_reason || ''
    ).toUpperCase();


  /*
   * VIOLATION
   */

  if (
    reason === 'VIOLATION' ||
    r.rules_violated
  ) {

    const count =
      Number(
        r.violation_count || 0
      );


    const max =
      Number(
        r.max_violations || 0
      );


    return `

      <span
        class="badge red"
      >
        🚨 Rules Violated
      </span>

      <span class="muted">

        Exam was automatically submitted
        because the maximum allowed violations
        were reached

        ${
          max > 0
            ? `(${count}/${max})`
            : ''
        }.

      </span>

    `;

  }


  /*
   * TIMEOUT
   */

  if (
    reason === 'TIMEOUT'
  ) {

    return `

      <span
        class="badge orange"
      >
        ⏱️ Time Over
      </span>

      <span class="muted">

        Exam was automatically submitted
        because the exam time ended.

      </span>

    `;

  }


  /*
   * MANUAL
   */

  return `

    <span
      class="badge green"
    >
      ✓ Submitted
    </span>

    <span class="muted">

      Exam submitted normally.

    </span>

  `;

}


/* ============================================================
   ENRICH TOPICS USING ANSWER REVIEW
   ============================================================ */

/*
 * This is important when the backend topic_performance
 * table does not contain skipped_count.
 *
 * The actual review data tells us exactly which questions
 * were skipped, so mixed topics can be calculated correctly.
 */

function enrichTopicsFromReview(
  topics,
  review
) {

  const safeTopics =
    Array.isArray(topics)
      ? topics
      : [];


  const safeReview =
    Array.isArray(review)
      ? review
      : [];


  /*
   * Build skipped-question counts by topic.
   */

  const skippedByTopic = {};


  safeReview.forEach(
    (q) => {

      const topic =
        String(
          q.topic || ''
        );


      if (!topic)
        return;


      if (
        !q.selected_answer
      ) {

        skippedByTopic[topic] =
          (
            skippedByTopic[topic] ||
            0
          ) + 1;

      }

    }
  );


  return safeTopics.map(
    (t) => {

      const topic =
        String(
          t.topic || ''
        );


      const reviewForTopic =
        safeReview.filter(
          (q) =>
            String(
              q.topic || ''
            ) === topic
        );


      /*
       * Total from review is the most reliable
       * value for this attempt.
       */

      const totalFromReview =
        reviewForTopic.length;


      const total =
        totalFromReview > 0

          ? totalFromReview

          : topicTotal(t);


      const skippedFromReview =
        reviewForTopic.length > 0

          ? reviewForTopic.filter(
              (q) =>
                !q.selected_answer
            ).length

          : topicSkipped(t);


      const correctFromReview =
        reviewForTopic.length > 0

          ? reviewForTopic.filter(
              (q) =>
                q.selected_answer &&
                q.selected_answer ===
                  q.correct_answer
            ).length

          : topicCorrect(t);


      const answered =
        Math.max(
          0,
          total -
            skippedFromReview
        );


      let percentage = 0;

      let status = 'SKIPPED';


      if (
        answered > 0
      ) {

        percentage =
          round(
            (
              correctFromReview /
              answered
            ) * 100
          );


        if (
          percentage >= 80
        ) {

          status =
            'STRONG';

        } else if (
          percentage >= 50
        ) {

          status =
            'NEEDS_IMPROVEMENT';

        } else {

          status =
            'WEAK';

        }

      }


      return {

        ...t,

        total_questions:
          total,

        correct_count:
          correctFromReview,

        skipped_count:
          skippedFromReview,

        wrong_count:
          Math.max(
            0,
            answered -
              correctFromReview
          ),

        percentage,

        status

      };

    }
  );

}


/* ============================================================
   RESULT DETAIL
   ============================================================ */

async function detail() {

  const [
    r,
    an
  ] =
    await Promise.all([

      api(
        '/student/results/' +
        attempt
      ),

      api(
        '/student/analytics'
      )

    ]);


  /*
   * Keep original review information.
   */

  const review =
    Array.isArray(
      r.review
    )
      ? r.review
      : [];


  /*
   * Enrich topic data using the actual answer review.
   *
   * This fixes mixed answered/skipped topics.
   */

  const topics =
    enrichTopicsFromReview(
      r.topics || [],
      review
    );


  C.innerHTML = `

    <div class="page-head">

      <h1 class="page-title">

        ${esc(r.title)}

        <small
          class="muted"
          style="font-size:.95rem"
        >

          ·
          ${esc(r.subject)}

        </small>

      </h1>


      <a
        class="btn"
        href="results.html"
      >
        ← All results
      </a>

    </div>


    <!-- ======================================================
         SCORE SUMMARY
         ====================================================== -->

    <div class="grid stats">

      ${stat(
        'Score',
        `${r.obtained_marks}/${r.max_marks}`,
        '🎯',
        'blue'
      )}


      ${stat(
        'Percentage',
        r1(r.percentage) + '%',
        '📊',
        'purple'
      )}


      ${stat(
        'Correct',
        r.correct_count,
        '✔️',
        'green'
      )}


      ${stat(
        'Wrong',
        r.wrong_count,
        '❌',
        'red'
      )}


      ${stat(
        'Skipped',
        r.unanswered_count,
        '⏭️',
        'orange'
      )}


      ${stat(
        'Rank',
        `#${r.rank_pos} of ${r.participants}`,
        '🏆',
        'cyan'
      )}

    </div>


    <!-- ======================================================
         SUBMISSION STATUS
         ====================================================== -->

    <div
      class="card"
      style="
        margin-top:14px;
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        align-items:center;
      "
    >

      ${submissionReason(r)}

      <span class="muted">

        ·
        Time taken:
        ${Math.floor(
          r.time_taken_seconds / 60
        )}m
        ${r.time_taken_seconds % 60}s

      </span>


      <span class="muted">

        ·
        Violations:
        <b>
          ${Number(
            r.violation_count || 0
          )}
        </b>

        ${
          Number(
            r.max_violations || 0
          ) > 0

            ? `
              /
              ${Number(
                r.max_violations
              )}
            `

            : ''
        }

      </span>

    </div>


    <!-- ======================================================
         VIOLATION DETAILS
         ====================================================== -->

    ${violationBlock(r)}


    <!-- ======================================================
         IMPROVEMENT
         ====================================================== -->

    ${improvementBlock(
      r.subject,
      topics,
      review
    )}


    <!-- ======================================================
         TOPIC ANALYSIS
         ====================================================== -->

    <div class="card">

      <h3>
        Topic Analysis
      </h3>

      ${topicTable(topics)}

    </div>


    <!-- ======================================================
         CHARTS
         ====================================================== -->

    <div class="grid two">

      ${chartCard(
        'Score Chart',
        'c1'
      )}

      ${chartCard(
        'Topic Performance',
        'c2'
      )}

      ${chartCard(
        'Your Performance Trend',
        'c3'
      )}

      ${chartCard(
        'Strong / Weak Topics',
        'c4'
      )}

    </div>


    <!-- ======================================================
         ANSWER REVIEW
         ====================================================== -->

    <div class="card">

      <h3>
        Answer Review
      </h3>


      ${
        review.map(
          (q, i) => {

            const st =
              !q.selected_answer

                ? 'na'

                : q.selected_answer ===
                    q.correct_answer

                  ? 'ok'

                  : 'no';


            const selectedText =
              q.selected_answer

                ? q.selected_answer +
                  '. ' +
                  esc(
                    q[
                      'option_' +
                      q.selected_answer
                        .toLowerCase()
                    ]
                  )

                : 'Not answered';


            const correctText =
              q.correct_answer +
              '. ' +
              esc(
                q[
                  'option_' +
                  q.correct_answer
                    .toLowerCase()
                ]
              );


            return `

              <div
                class="q-review ${st}"
              >

                <b>
                  Q${i + 1}.
                  ${esc(q.question_text)}
                </b>


                <span
                  class="badge purple"
                >
                  ${esc(q.topic)}
                </span>


                <br>


                <small>

                  Your answer:

                  <b>
                    ${selectedText}
                  </b>


                  ·


                  Correct:

                  <b>
                    ${correctText}
                  </b>

                </small>


                ${
                  !q.selected_answer

                    ? `

                      <br>

                      <span
                        class="badge orange"
                        style="margin-top:6px"
                      >

                        ⏭️ Skipped

                      </span>

                    `

                    : ''

                }

              </div>

            `;

          }
        ).join('')
      }

    </div>

  `;


  /* ==========================================================
     SCORE CHART
     ========================================================== */

  chart(

    'c1',

    'doughnut',

    {

      labels: [
        'Correct',
        'Wrong',
        'Skipped'
      ],

      datasets: [

        {

          data: [

            r.correct_count,

            r.wrong_count,

            r.unanswered_count

          ],

          backgroundColor: [

            '#22c55e',
            '#ef4444',
            '#f97316'

          ]

        }

      ]

    }

  );


  /* ==========================================================
     TOPIC PERFORMANCE CHART
     ========================================================== */

  chart(

    'c2',

    'bar',

    {

      labels:
        topics.map(
          (t) =>
            t.topic
        ),

      datasets: [

        {

          data:
            topics.map(
              (t) =>
                topicStatus(t) ===
                  'SKIPPED'

                  ? 0

                  : r1(
                      answeredTopicPercentage(t)
                    )
            ),

          backgroundColor:
            topics.map(
              (t) => {

                const status =
                  topicStatus(t);


                if (
                  status ===
                  'SKIPPED'
                ) {

                  return '#94a3b8';

                }


                return STATUS_COLOR[
                  status
                ];

              }
            )

        }

      ]

    },

    pctAxis

  );


  /* ==========================================================
     PERFORMANCE TREND
     ========================================================== */

  chart(

    'c3',

    'line',

    {

      labels:
        an.trend.map(
          (t) =>
            t.test
        ),

      datasets: [

        {

          label:
            'Score %',

          data:
            an.trend.map(
              (t) =>
                r1(
                  t.percentage
                )
            ),

          borderColor:
            '#8b5cf6',

          backgroundColor:
            'rgba(139,92,246,.18)',

          fill: true,

          tension: .3,

          pointRadius: 5

        }

      ]

    },

    {

      scales: {

        y: {

          beginAtZero: true,

          max: 100

        }

      }

    }

  );


  /* ==========================================================
     STRONG / NEEDS / WEAK / SKIPPED CHART
     ========================================================== */

  const cnt =
    (s) =>
      topics.filter(
        (t) =>
          topicStatus(t) ===
          s
      ).length;


  chart(

    'c4',

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

            cnt('STRONG'),

            cnt(
              'NEEDS_IMPROVEMENT'
            ),

            cnt('WEAK'),

            cnt('SKIPPED')

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

}