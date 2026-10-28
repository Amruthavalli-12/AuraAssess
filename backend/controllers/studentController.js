const db = require('../config/db');
const {
  wrap,
  bad,
  round,
  classify,
  overallBoard
} = require('./helpers');

const GRACE_MS = 15000; // network latency allowance for the last save/submit

const VTYPES = [
  'TAB_SWITCH',
  'FULLSCREEN_EXIT',
  'FACE_NOT_DETECTED',
  'MULTIPLE_FACE_DETECTED'
];

const ACCESS = `
  e.is_published = 1
  AND (
    e.assign_all = 1
    OR EXISTS (
      SELECT 1
      FROM exam_assignments a
      WHERE a.exam_id = e.id
        AND a.student_id = ?
    )
  )
`;

const EXAM_SQL = `
  SELECT
    e.id,
    e.title,
    e.description,
    s.name AS subject,
    t.name AS teacher,
    e.duration_minutes,
    e.max_marks,
    e.max_violations,
    e.start_date,
    e.end_date,

    (
      SELECT COUNT(*)
      FROM exam_questions eq
      WHERE eq.exam_id = e.id
    ) AS question_count,

    att.id AS attempt_id,
    att.status AS attempt_status,
    att.violation_count,
    att.submit_reason,

    r.percentage,
    r.obtained_marks

  FROM exams e

  JOIN subjects s
    ON s.id = e.subject_id

  JOIN users t
    ON t.id = e.created_by

  LEFT JOIN exam_attempts att
    ON att.exam_id = e.id
    AND att.student_id = ?

  LEFT JOIN results r
    ON r.attempt_id = att.id
`;

/* ============================================================
   EXAM STATUS
   ============================================================ */

function examStatus(r) {

  if (r.attempt_status === 'SUBMITTED') {
    return 'COMPLETED';
  }

  if (r.attempt_status === 'IN_PROGRESS') {
    return 'IN_PROGRESS';
  }

  const n = Date.now();

  if (n < new Date(r.start_date)) {
    return 'UPCOMING';
  }

  if (n > new Date(r.end_date)) {
    return 'EXPIRED';
  }

  return 'AVAILABLE';
}

const withStatus = (rows) =>
  rows.map((r) => ({
    ...r,
    status: examStatus(r)
  }));

const deadline = (a) =>
  new Date(a.started_at).getTime() +
  a.duration_minutes * 60000;

/* ============================================================
   VIOLATION DATA HELPERS
   ============================================================ */

async function attachViolationData(rows) {

  if (!rows || !rows.length) {
    return rows || [];
  }

  const attemptIds = rows
    .map((r) => r.attempt_id)
    .filter(Boolean)
    .map(Number);

  /*
   * If there is no attempt, there cannot be any
   * recorded violation.
   */
  if (!attemptIds.length) {

    return rows.map((r) => {

      const total =
        Number(r.violation_count || 0);

      const max =
        Number(r.max_violations || 0);

      const rulesViolated =
        r.submit_reason === 'VIOLATION' ||
        (
          max > 0 &&
          total >= max &&
          r.attempt_status === 'SUBMITTED'
        );

      return {

        ...r,

        total_violations:
          total,

        violation_summary:
          {},

        violation_types:
          [],

        rules_violated:
          rulesViolated,

        submission_status:
          rulesViolated
            ? 'RULES_VIOLATED'
            : r.attempt_status === 'SUBMITTED'
              ? 'SUBMITTED'
              : r.attempt_status

      };

    });

  }

  const placeholders =
    attemptIds
      .map(() => '?')
      .join(',');

  const [violations] =
    await db.query(
      `SELECT
         attempt_id,
         violation_type,
         COUNT(*) AS count

       FROM violations

       WHERE attempt_id IN (${placeholders})

       GROUP BY
         attempt_id,
         violation_type`,
      attemptIds
    );

  const byAttempt = {};

  violations.forEach((v) => {

    const attemptId =
      Number(v.attempt_id);

    if (!byAttempt[attemptId]) {
      byAttempt[attemptId] = {};
    }

    byAttempt[attemptId][
      v.violation_type
    ] =
      Number(v.count || 0);

  });

  return rows.map((r) => {

    const attemptId =
      Number(r.attempt_id);

    const summary =
      byAttempt[attemptId] || {};

    const total =
      Number(r.violation_count || 0);

    const max =
      Number(r.max_violations || 0);

    const rulesViolated =
      r.submit_reason === 'VIOLATION' ||
      (
        max > 0 &&
        total >= max &&
        (
          r.attempt_status === 'SUBMITTED' ||
          !r.attempt_status
        )
      );

    return {

      ...r,

      total_violations:
        total,

      violation_summary:
        summary,

      violation_types:
        Object.keys(summary),

      rules_violated:
        rulesViolated,

      submission_status:
        rulesViolated
          ? 'RULES_VIOLATED'
          : r.attempt_status === 'SUBMITTED'
            ? 'SUBMITTED'
            : r.attempt_status

    };

  });

}

async function listExams(uid) {

  const [rows] = await db.query(
    `${EXAM_SQL}
     WHERE ${ACCESS}
     ORDER BY e.start_date DESC`,
    [uid, uid]
  );

  const enriched =
    await attachViolationData(rows);

  return withStatus(enriched);
}

/* ============================================================
   GET SINGLE EXAM
   ============================================================ */

async function getExam(id, uid) {

  const [rows] = await db.query(
    `${EXAM_SQL}
     WHERE e.id = ?
       AND ${ACCESS}`,
    [uid, id, uid]
  );

  return rows[0];
}

/* ============================================================
   LOAD ATTEMPT
   ============================================================ */

const loadAttempt = async (
  examId,
  uid
) =>
  (
    await db.query(
      `SELECT
        a.*,
        e.duration_minutes,
        e.max_violations

       FROM exam_attempts a

       JOIN exams e
         ON e.id = a.exam_id

       WHERE a.exam_id = ?
         AND a.student_id = ?`,
      [
        examId,
        uid
      ]
    )
  )[0][0];

/* ============================================================
   AUTOMATIC EVALUATION
   ============================================================

   TOPIC ANALYTICS RULE:

   1. ALL QUESTIONS SKIPPED
      --------------------
      answered = 0
      status = SKIPPED

   2. SOME QUESTIONS SKIPPED
      ----------------------
      skipped questions are ignored.

      Example:
        Total     = 5
        Correct   = 3
        Wrong     = 1
        Skipped   = 1

        Answered  = 4

        Percentage = 3 / 4 * 100
                   = 75%

        Status = NEEDS_IMPROVEMENT

   3. NO QUESTIONS SKIPPED
      --------------------
      normal classification is used.

   IMPORTANT:
   Skipped questions never become wrong answers and
   never reduce the topic percentage.
   ============================================================ */

async function evaluate(
  attemptId,
  reason
) {

  const conn =
    await db.getConnection();

  try {

    await conn.beginTransaction();

    /* --------------------------------------------------------
       Lock attempt
       -------------------------------------------------------- */

    const [[a]] =
      await conn.query(
        `SELECT *
         FROM exam_attempts
         WHERE id = ?
         FOR UPDATE`,
        [attemptId]
      );

    if (
      !a ||
      a.status !== 'IN_PROGRESS'
    ) {

      await conn.rollback();

      return false;
    }

    /* --------------------------------------------------------
       Load exam questions + student answers
       -------------------------------------------------------- */

    const [qs] =
      await conn.query(
        `SELECT
          q.id,
          q.topic,
          q.correct_answer,
          q.marks,
          sa.selected_answer

         FROM exam_questions eq

         JOIN questions q
           ON q.id = eq.question_id

         LEFT JOIN student_answers sa
           ON sa.question_id = q.id
           AND sa.attempt_id = ?

         WHERE eq.exam_id = ?`,
        [
          attemptId,
          a.exam_id
        ]
      );

    let correct = 0;
    let wrong = 0;
    let un = 0;
    let obt = 0;
    let max = 0;

    /*
     * Topic structure:
     *
     * {
     *   total: number,
     *   correct: number,
     *   wrong: number,
     *   skipped: number
     * }
     */

    const topics = {};

    /* --------------------------------------------------------
       Evaluate every question
       -------------------------------------------------------- */

    for (const q of qs) {

      max += Number(q.marks || 0);

      const t =
        topics[q.topic] ||
        (
          topics[q.topic] = {
            total: 0,
            correct: 0,
            wrong: 0,
            skipped: 0
          }
        );

      t.total++;

      /* ------------------------------------------------------
         SKIPPED QUESTION
         ------------------------------------------------------ */

      if (!q.selected_answer) {

        un++;

        t.skipped++;

        continue;
      }

      /* ------------------------------------------------------
         CORRECT ANSWER
         ------------------------------------------------------ */

      if (
        q.selected_answer ===
        q.correct_answer
      ) {

        correct++;

        obt += Number(q.marks || 0);

        t.correct++;

      }

      /* ------------------------------------------------------
         WRONG ANSWER
         ------------------------------------------------------ */

      else {

        wrong++;

        t.wrong++;

      }

      /* ------------------------------------------------------
         SAVE is_correct
         ------------------------------------------------------ */

      await conn.query(
        `UPDATE student_answers
         SET is_correct = ?
         WHERE attempt_id = ?
           AND question_id = ?`,
        [
          q.selected_answer ===
          q.correct_answer
            ? 1
            : 0,

          attemptId,
          q.id
        ]
      );

    }

    /* ========================================================
       FINAL SCORE
       ======================================================== */

    const now =
      new Date();

    const taken =
      Math.max(
        0,
        Math.round(
          (
            now.getTime() -
            new Date(
              a.started_at
            ).getTime()
          ) / 1000
        )
      );

    const pct =
      max
        ? round(
            (obt / max) * 100
          )
        : 0;

    /* ========================================================
       SAVE RESULT
       ======================================================== */

    await conn.query(
      `INSERT INTO results
       (
         attempt_id,
         exam_id,
         student_id,
         total_questions,
         correct_count,
         wrong_count,
         unanswered_count,
         obtained_marks,
         max_marks,
         percentage,
         time_taken_seconds
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        a.exam_id,
        a.student_id,
        qs.length,
        correct,
        wrong,
        un,
        obt,
        max,
        pct,
        taken
      ]
    );

    /* ========================================================
       SAVE TOPIC PERFORMANCE
       ======================================================== */

    const rows =
      Object.entries(
        topics
      ).map(
        ([topic, t]) => {

          const answered =
            t.correct +
            t.wrong;

          let p = 0;
          let status = 'SKIPPED';

          /* --------------------------------------------------
             ALL QUESTIONS SKIPPED
             -------------------------------------------------- */

          if (
            answered === 0
          ) {

            p = 0;

            status =
              'SKIPPED';

          }

          /* --------------------------------------------------
             AT LEAST ONE QUESTION ANSWERED
             -------------------------------------------------- */

          else {

            p =
              round(
                (
                  t.correct /
                  answered
                ) * 100
              );

            status =
              classify(p);

          }

          return [
            attemptId,
            a.exam_id,
            a.student_id,
            topic,
            t.total,
            t.correct,
            p,
            status
          ];

        }
      );

    if (rows.length) {

      await conn.query(
        `INSERT INTO topic_performance
         (
           attempt_id,
           exam_id,
           student_id,
           topic,
           total_questions,
           correct_count,
           percentage,
           status
         )
         VALUES ?`,
        [rows]
      );

    }

    /* ========================================================
       SUBMIT EXAM
       ======================================================== */

    await conn.query(
      `UPDATE exam_attempts
       SET
         status = 'SUBMITTED',
         submitted_at = ?,
         submit_reason = ?
       WHERE id = ?`,
      [
        now,
        reason,
        attemptId
      ]
    );

    await conn.commit();

    return true;

  } catch (e) {

    await conn.rollback();

    throw e;

  } finally {

    conn.release();

  }
}

/* ============================================================
   SAVE ANSWERS
   ============================================================ */

async function saveAnswers(
  attemptId,
  examId,
  map
) {

  const [q] =
    await db.query(
      `SELECT question_id
       FROM exam_questions
       WHERE exam_id = ?`,
      [examId]
    );

  const valid =
    new Set(
      q.map(
        (x) => x.question_id
      )
    );

  for (
    const [
      qid,
      sel
    ]
    of Object.entries(
      map || {}
    )
  ) {

    if (
      !valid.has(
        Number(qid)
      )
    ) {
      continue;
    }

    const s =
      sel
        ? String(
            sel
          ).toUpperCase()
        : null;

    if (
      s &&
      ![
        'A',
        'B',
        'C',
        'D'
      ].includes(s)
    ) {
      continue;
    }

    await db.query(
      `INSERT INTO student_answers
       (
         attempt_id,
         question_id,
         selected_answer
       )
       VALUES (?, ?, ?)

       ON DUPLICATE KEY UPDATE
         selected_answer =
         VALUES(selected_answer)`,
      [
        attemptId,
        Number(qid),
        s
      ]
    );

  }
}

/* ============================================================
   ENDPOINTS
   ============================================================ */

/* ============================================================
   STUDENT EXAMS
   ============================================================ */

exports.exams =
  wrap(
    async (
      req,
      res
    ) => {

      res.json(
        await listExams(
          req.user.id
        )
      );

    }
  );

/* ============================================================
   SINGLE EXAM
   ============================================================ */

exports.exam =
  wrap(
    async (
      req,
      res
    ) => {

      const e =
        await getExam(
          req.params.id,
          req.user.id
        );

      if (!e) {

        return bad(
          res,
          'Exam not found or not assigned to you',
          404
        );

      }

      const enriched =
        await attachViolationData([e]);

      const exam =
        enriched[0] || e;

      res.json({

        ...exam,

        status:
          examStatus(exam),

        max_violations:
          exam.max_violations

      });

    }
  );

/* ============================================================
   START EXAM
   ============================================================ */

exports.start =
  wrap(
    async (
      req,
      res
    ) => {

      const uid =
        req.user.id;

      const e =
        await getExam(
          req.params.id,
          uid
        );

      if (!e) {

        return bad(
          res,
          'Exam not found or not assigned to you',
          404
        );

      }

      if (
        e.attempt_status ===
        'SUBMITTED'
      ) {

        return bad(
          res,
          'You have already completed this exam',
          409
        );

      }

      let attemptId =
        e.attempt_id;

      /* ------------------------------------------------------
         Create attempt if required
         ------------------------------------------------------ */

      if (!attemptId) {

        const n =
          Date.now();

        if (
          n <
          new Date(
            e.start_date
          )
        ) {

          return bad(
            res,
            'This exam has not started yet',
            403
          );

        }

        if (
          n >
          new Date(
            e.end_date
          )
        ) {

          return bad(
            res,
            'The exam window has closed',
            403
          );

        }

        if (
          !e.question_count
        ) {

          return bad(
            res,
            'This exam has no questions',
            400
          );

        }

        try {

          const [r] =
            await db.query(
              `INSERT INTO exam_attempts
               (
                 exam_id,
                 student_id,
                 started_at
               )
               VALUES (?, ?, ?)`,
              [
                e.id,
                uid,
                new Date()
              ]
            );

          attemptId =
            r.insertId;

        } catch (err) {

          if (
            err.code !==
            'ER_DUP_ENTRY'
          ) {

            throw err;

          }

          attemptId =
            (
              await loadAttempt(
                e.id,
                uid
              )
            ).id;

        }

      }

      const a =
        await loadAttempt(
          e.id,
          uid
        );

      const remaining =
        Math.floor(
          (
            deadline(a) -
            Date.now()
          ) / 1000
        );

      /* ------------------------------------------------------
         Automatic timeout
         ------------------------------------------------------ */

      if (
        remaining <= 0
      ) {

        await evaluate(
          a.id,
          'TIMEOUT'
        );

        return res
          .status(409)
          .json({
            error:
              'Time is over. Your exam has been automatically submitted.',

            submitted:
              true,

            attempt_id:
              a.id
          });

      }

      /* ------------------------------------------------------
         Questions
         ------------------------------------------------------ */

      const [questions] =
        await db.query(
          `SELECT
            q.id,
            q.question_text,
            q.topic,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.marks

           FROM exam_questions eq

           JOIN questions q
             ON q.id = eq.question_id

           WHERE eq.exam_id = ?

           ORDER BY
             eq.position,
             eq.id`,
          [e.id]
        );

      /* ------------------------------------------------------
         Existing answers
         ------------------------------------------------------ */

      const [ans] =
        await db.query(
          `SELECT
            question_id,
            selected_answer

           FROM student_answers

           WHERE attempt_id = ?`,
          [a.id]
        );

      const answers = {};

      ans.forEach(
        (x) => {

          if (
            x.selected_answer
          ) {

            answers[
              x.question_id
            ] =
              x.selected_answer;

          }

        }
      );

      res.json({

        attempt_id:
          a.id,

        exam: {

          id:
            e.id,

          title:
            e.title,

          duration_minutes:
            e.duration_minutes,

          max_marks:
            e.max_marks

        },

        remaining_seconds:
          remaining,

        questions,

        answers,

        violation_count:
          a.violation_count,

        max_violations:
          e.max_violations

      });

    }
  );

/* ============================================================
   SAVE SINGLE ANSWER
   ============================================================ */

exports.answer =
  wrap(
    async (
      req,
      res
    ) => {

      const a =
        await loadAttempt(
          req.params.id,
          req.user.id
        );

      if (!a) {

        return bad(
          res,
          'Attempt not found',
          404
        );

      }

      if (
        a.status !==
        'IN_PROGRESS'
      ) {

        return res
          .status(409)
          .json({

            error:
              'Exam already submitted',

            submitted:
              true,

            attempt_id:
              a.id

          });

      }

      if (
        Date.now() >
        deadline(a) +
        GRACE_MS
      ) {

        await evaluate(
          a.id,
          'TIMEOUT'
        );

        return res
          .status(409)
          .json({

            error:
              'Time is over. Your exam has been automatically submitted.',

            submitted:
              true,

            attempt_id:
              a.id

          });

      }

      const {
        question_id,
        selected_answer
      } =
        req.body || {};

      if (!question_id) {

        return bad(
          res,
          'question_id is required'
        );

      }

      await saveAnswers(
        a.id,
        a.exam_id,
        {
          [question_id]:
            selected_answer
        }
      );

      res.json({
        saved: true
      });

    }
  );

/* ============================================================
   VIOLATION
   ============================================================ */

exports.violation =
  wrap(
    async (
      req,
      res
    ) => {

      const a =
        await loadAttempt(
          req.params.id,
          req.user.id
        );

      if (!a) {

        return bad(
          res,
          'Attempt not found',
          404
        );

      }

      if (
        a.status !==
        'IN_PROGRESS'
      ) {

        return res
          .status(409)
          .json({

            error:
              'Exam already submitted',

            submitted:
              true,

            attempt_id:
              a.id

          });

      }

      const type =
        String(
          (
            req.body || {}
          ).violation_type || ''
        ).toUpperCase();

      if (
        !VTYPES.includes(type)
      ) {

        return bad(
          res,
          'Invalid violation type'
        );

      }

      /* ------------------------------------------------------
         Increment violation count
         ------------------------------------------------------ */

      const count =
        Number(
          a.violation_count || 0
        ) + 1;

      /* ------------------------------------------------------
         Save violation record
         ------------------------------------------------------ */

      await db.query(
        `INSERT INTO violations
         (
           attempt_id,
           exam_id,
           student_id,
           violation_type,
           violation_count
         )
         VALUES (?, ?, ?, ?, ?)`,
        [
          a.id,
          a.exam_id,
          a.student_id,
          type,
          count
        ]
      );

      /* ------------------------------------------------------
         Update attempt
         ------------------------------------------------------ */

      await db.query(
        `UPDATE exam_attempts
         SET violation_count = ?
         WHERE id = ?`,
        [
          count,
          a.id
        ]
      );

      /* ------------------------------------------------------
         Get configured maximum
         ------------------------------------------------------ */

      const [[exam]] =
        await db.query(
          `SELECT
            max_violations

           FROM exams

           WHERE id = ?`,
          [a.exam_id]
        );

      const maxViolations =
        Number(
          exam.max_violations || 0
        );

      /* ======================================================
         MAXIMUM VIOLATION REACHED
         ====================================================== */

      if (
        maxViolations > 0 &&
        count >= maxViolations
      ) {

        await evaluate(
          a.id,
          'VIOLATION'
        );

        return res.json({

          violation_count:
            count,

          max_violations:
            maxViolations,

          submitted:
            true,

          attempt_id:
            a.id,

          rules_violated:
            true,

          submission_status:
            'RULES_VIOLATED',

          submission_message:
            'Rules Violated - Maximum violation limit reached.',

          triggering_violation:
            type

        });

      }

      /* ======================================================
         VIOLATION RECORDED BUT EXAM CONTINUES
         ====================================================== */

      res.json({

        violation_count:
          count,

        max_violations:
          maxViolations,

        submitted:
          false,

        rules_violated:
          false,

        submission_status:
          'IN_PROGRESS',

        violation_type:
          type

      });

    }
  );

/* ============================================================
   MANUAL / TIMEOUT / VIOLATION SUBMIT
   ============================================================ */

exports.submit =
  wrap(
    async (
      req,
      res
    ) => {

      const a =
        await loadAttempt(
          req.params.id,
          req.user.id
        );

      if (!a) {

        return bad(
          res,
          'Attempt not found',
          404
        );

      }

      if (
        a.status ===
        'SUBMITTED'
      ) {

        const rulesViolated =
          a.submit_reason ===
          'VIOLATION';

        return res.json({

          submitted:
            true,

          attempt_id:
            a.id,

          rules_violated:
            rulesViolated,

          submission_status:
            rulesViolated
              ? 'RULES_VIOLATED'
              : 'SUBMITTED',

          submission_message:
            rulesViolated
              ? 'Rules Violated - Maximum violation limit reached.'
              : 'Exam submitted successfully.'

        });

      }

      const late =
        Date.now() >
        deadline(a);

      /* ------------------------------------------------------
         Save final answers
         ------------------------------------------------------ */

      if (
        Date.now() <=
          deadline(a) +
            GRACE_MS &&
        req.body &&
        typeof req.body.answers ===
          'object'
      ) {

        await saveAnswers(
          a.id,
          a.exam_id,
          req.body.answers
        );

      }

      const asked =
        req.body &&
        [
          'TIMEOUT',
          'VIOLATION'
        ].includes(
          req.body.reason
        )
          ? req.body.reason
          : 'MANUAL';

      const finalReason =
        late
          ? 'TIMEOUT'
          : asked;

      await evaluate(
        a.id,
        finalReason
      );

      const rulesViolated =
        finalReason ===
        'VIOLATION';

      res.json({

        submitted:
          true,

        attempt_id:
          a.id,

        rules_violated:
          rulesViolated,

        submission_status:
          rulesViolated
            ? 'RULES_VIOLATED'
            : 'SUBMITTED',

        submission_message:
          rulesViolated
            ? 'Rules Violated - Maximum violation limit reached.'
            : late
              ? 'Time expired. Exam submitted automatically.'
              : 'Exam submitted successfully.'

      });

    }
  );

/* ============================================================
   STUDENT RESULTS
   ============================================================ */

const RANK_POS = `
  (
    1 +
    (
      SELECT COUNT(*)
      FROM results r2
      WHERE r2.exam_id = r.exam_id
        AND r2.obtained_marks >
            r.obtained_marks
    )
  )
`;

exports.results =
  wrap(
    async (
      req,
      res
    ) => {

      const [rows] =
        await db.query(
          `SELECT
            r.attempt_id,
            e.title,
            s.name AS subject,
            r.obtained_marks,
            r.max_marks,
            r.percentage,
            r.correct_count,
            r.wrong_count,
            r.unanswered_count,
            r.total_questions,
            r.created_at,

            a.status AS attempt_status,
            a.violation_count,
            a.submit_reason,

            e.max_violations,

            ${RANK_POS} AS rank_pos

           FROM results r

           JOIN exams e
             ON e.id = r.exam_id

           JOIN subjects s
             ON s.id = e.subject_id

           JOIN exam_attempts a
             ON a.id = r.attempt_id

           WHERE r.student_id = ?

           ORDER BY r.created_at DESC`,
          [req.user.id]
        );

      const enriched =
        await attachViolationData(rows);

      res.json(

        enriched.map(
          (r) => {

            const rulesViolated =
              !!r.rules_violated;

            return {

              ...r,

              rules_violated:
                rulesViolated,

              submission_status:
                rulesViolated
                  ? 'RULES_VIOLATED'
                  : 'SUBMITTED',

              submission_message:
                rulesViolated
                  ? 'Rules Violated - Maximum violation limit reached.'
                  : 'Exam submitted successfully.'

            };

          }
        )

      );

    }
  );

/* ============================================================
   RESULT DETAIL
   ============================================================ */

exports.resultDetail =
  wrap(
    async (
      req,
      res
    ) => {

      const [rows] =
        await db.query(
          `SELECT
            r.*,

            e.title,
            e.duration_minutes,
            e.max_violations,

            s.name AS subject,

            a.violation_count,
            a.submit_reason,

            ${RANK_POS} AS rank_pos,

            (
              SELECT COUNT(*)
              FROM results r3
              WHERE r3.exam_id = r.exam_id
            ) AS participants

           FROM results r

           JOIN exams e
             ON e.id = r.exam_id

           JOIN subjects s
             ON s.id = e.subject_id

           JOIN exam_attempts a
             ON a.id = r.attempt_id

           WHERE r.attempt_id = ?
             AND r.student_id = ?`,
          [
            req.params.attemptId,
            req.user.id
          ]
        );

      const r =
        rows[0];

      if (!r) {

        return bad(
          res,
          'Result not found',
          404
        );

      }

      /* ------------------------------------------------------
         Question review
         ------------------------------------------------------ */

      const [review] =
        await db.query(
          `SELECT
            q.id AS question_id,
            q.question_text,
            q.topic,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_answer,
            q.marks,
            sa.selected_answer

           FROM exam_questions eq

           JOIN questions q
             ON q.id = eq.question_id

           LEFT JOIN student_answers sa
             ON sa.question_id = q.id
             AND sa.attempt_id = ?

           WHERE eq.exam_id = ?

           ORDER BY
             eq.position,
             eq.id`,
          [
            r.attempt_id,
            r.exam_id
          ]
        );

      /* ------------------------------------------------------
         Topic performance
         ------------------------------------------------------ */

      const [topics] =
        await db.query(
          `SELECT
            topic,
            total_questions,
            correct_count,
            percentage,
            status

           FROM topic_performance

           WHERE attempt_id = ?

           ORDER BY
             CASE
               WHEN status = 'SKIPPED'
                 THEN 4

               WHEN status = 'WEAK'
                 THEN 1

               WHEN status = 'NEEDS_IMPROVEMENT'
                 THEN 2

               WHEN status = 'STRONG'
                 THEN 3

               ELSE 5
             END,

             percentage DESC,
             topic`,
          [r.attempt_id]
        );

      /*
       * Calculate skipped questions directly from the
       * actual answer review.
       *
       * This avoids treating skipped questions as wrong.
       */

      const topicSkippedMap = {};

      review.forEach(
        (q) => {

          const topic =
            q.topic ||
            'General';

          if (
            !Object.prototype.hasOwnProperty.call(
              topicSkippedMap,
              topic
            )
          ) {

            topicSkippedMap[topic] =
              0;

          }

          if (
            !q.selected_answer
          ) {

            topicSkippedMap[topic]++;

          }

        }
      );

      /*
       * Recalculate topic percentage and status.
       *
       * This is important because topic_performance was
       * originally stored without skipped_count.
       */

      const enrichedTopics =
        topics.map(
          (t) => {

            const total =
              Number(
                t.total_questions || 0
              );

            const correct =
              Number(
                t.correct_count || 0
              );

            const skipped =
              Number(
                topicSkippedMap[
                  t.topic ||
                  'General'
                ] || 0
              );

            const answered =
              Math.max(
                0,
                total - skipped
              );

            let percentage =
              0;

            let status =
              'SKIPPED';

            if (
              answered === 0
            ) {

              percentage =
                0;

              status =
                'SKIPPED';

            } else {

              percentage =
                round(
                  (
                    correct /
                    answered
                  ) * 100
                );

              status =
                classify(
                  percentage
                );

            }

            return {

              ...t,

              total_questions:
                total,

              correct_count:
                correct,

              skipped_count:
                skipped,

              answered_count:
                answered,

              percentage,

              status

            };

          }
        );

      /* ------------------------------------------------------
         Violations
         ------------------------------------------------------ */

      const [violations] =
        await db.query(
          `SELECT
            violation_type,
            violation_count,
            created_at

           FROM violations

           WHERE attempt_id = ?

           ORDER BY id`,
          [r.attempt_id]
        );

      /*
       * Build a compact violation summary.
       *
       * Example:
       *
       * {
       *   TAB_SWITCH: 2,
       *   FULLSCREEN_EXIT: 1
       * }
       */

      const violationSummary = {};

      violations.forEach(
        (v) => {

          const type =
            v.violation_type;

          violationSummary[type] =
            (
              violationSummary[type] ||
              0
            ) + 1;

        }
      );

      const violationTypes =
        Object.keys(
          violationSummary
        );

      /* ------------------------------------------------------
         Rules violated status
         ------------------------------------------------------ */

      const rulesViolated =
        r.submit_reason ===
        'VIOLATION'
        ||
        (
          Number(
            r.violation_count || 0
          ) >=
          Number(
            r.max_violations || 0
          )
          &&
          Number(
            r.max_violations || 0
          ) > 0
        );

      const submissionStatus =
        rulesViolated
          ? 'RULES_VIOLATED'
          : r.submit_reason ===
            'TIMEOUT'
            ? 'TIMEOUT'
            : 'SUBMITTED';

      const submissionMessage =
        rulesViolated
          ? 'Rules Violated - Maximum violation limit reached.'
          : r.submit_reason ===
            'TIMEOUT'
            ? 'Time expired. Exam submitted automatically.'
            : 'Exam submitted successfully.';

      /* ------------------------------------------------------
         Final result
         ------------------------------------------------------ */

      res.json({

        ...r,

        rules_violated:
          rulesViolated,

        submission_status:
          submissionStatus,

        submission_message:
          submissionMessage,

        total_violations:
          Number(
            r.violation_count || 0
          ),

        violation_types:
          violationTypes,

        violation_summary:
          violationSummary,

        topics:
          enrichedTopics,

        review,

        violations,

        violation_summary:
          violationSummary

      });

    }
  );

/* ============================================================
   STUDENT ANALYTICS
   ============================================================ */

exports.analytics =
  wrap(
    async (
      req,
      res
    ) => {

      const uid =
        req.user.id;

      /* ------------------------------------------------------
         Performance trend
         ------------------------------------------------------ */

      const [trend] =
        await db.query(
          `SELECT
            e.title,
            r.percentage,
            r.obtained_marks,
            r.max_marks,
            r.created_at

           FROM results r

           JOIN exams e
             ON e.id = r.exam_id

           WHERE r.student_id = ?

           ORDER BY r.created_at ASC`,
          [uid]
        );

      /* ------------------------------------------------------
         Topic performance
         ------------------------------------------------------ */

      const [tp] =
        await db.query(
          `SELECT
            s.name AS subject,
            tp.topic,

            SUM(
              tp.total_questions
            ) AS total,

            SUM(
              tp.correct_count
            ) AS correct,

            SUM(
              (
                SELECT COUNT(*)
                FROM exam_questions eq2

                JOIN questions q2
                  ON q2.id = eq2.question_id

                LEFT JOIN student_answers sa2
                  ON sa2.question_id = q2.id
                  AND sa2.attempt_id = tp.attempt_id

                WHERE eq2.exam_id = tp.exam_id
                  AND q2.topic = tp.topic
                  AND (
                    sa2.selected_answer IS NULL
                    OR sa2.selected_answer = ''
                  )
              )
            ) AS skipped

           FROM topic_performance tp

           JOIN exams e
             ON e.id = tp.exam_id

           JOIN subjects s
             ON s.id = e.subject_id

           WHERE tp.student_id = ?

           GROUP BY
             s.id,
             s.name,
             tp.topic

           ORDER BY
             s.name,
             tp.topic`,
          [uid]
        );

      /*
       * Correct topic classification across all exams.
       *
       * answered = total - skipped
       *
       * answered = 0
       *     -> SKIPPED
       *
       * answered > 0
       *     -> correct / answered
       */

      const topics =
        tp.map(
          (t) => {

            const total =
              Number(
                t.total || 0
              );

            const correct =
              Number(
                t.correct || 0
              );

            const skipped =
              Number(
                t.skipped || 0
              );

            const answered =
              Math.max(
                0,
                total - skipped
              );

            let p =
              0;

            let status =
              'SKIPPED';

            if (
              answered === 0
            ) {

              p =
                0;

              status =
                'SKIPPED';

            } else {

              p =
                round(
                  (
                    correct /
                    answered
                  ) * 100
                );

              status =
                classify(p);

            }

            return {

              ...t,

              total,

              correct,

              skipped,

              answered,

              percentage:
                p,

              status

            };

          }
        );

      /* ------------------------------------------------------
         Subject-wise average
         ------------------------------------------------------ */

      const [subjects] =
        await db.query(
          `SELECT
            s.name,
            AVG(
              r.percentage
            ) AS pct

           FROM results r

           JOIN exams e
             ON e.id = r.exam_id

           JOIN subjects s
             ON s.id = e.subject_id

           WHERE r.student_id = ?

           GROUP BY
             s.id,
             s.name

           ORDER BY
             s.name`,
          [uid]
        );

      res.json({

        trend:
          trend.map(
            (t, i) => ({

              ...t,

              test:
                `Test ${i + 1}`

            })
          ),

        topics,

        subjects:
          subjects.map(
            (s) => ({

              name:
                s.name,

              percentage:
                round(
                  s.pct
                )

            })
          )

      });

    }
  );

/* ============================================================
   STUDENT DASHBOARD
   ============================================================ */

exports.dashboard =
  wrap(
    async (
      req,
      res
    ) => {

      const uid =
        req.user.id;

      const exams =
        await listExams(
          uid
        );

      const [[s]] =
        await db.query(
          `SELECT
            COUNT(*) AS n,

            COALESCE(
              AVG(percentage),
              0
            ) AS avg_pct,

            COALESCE(
              MAX(percentage),
              0
            ) AS best

           FROM results

           WHERE student_id = ?`,
          [uid]
        );

      const board =
        await overallBoard();

      const me =
        board.find(
          (b) =>
            b.student_id === uid
        );

      const [notes] =
        await db.query(
          `SELECT
            id,
            title,
            message,
            created_at

           FROM notifications

           WHERE user_id = ?

           ORDER BY id DESC

           LIMIT 5`,
          [uid]
        );

      res.json({

        available:
          exams.filter(
            (e) =>
              e.status ===
                'AVAILABLE' ||
              e.status ===
                'IN_PROGRESS'
          ).length,

        completed:
          s.n,

        avg_score:
          round(
            s.avg_pct
          ),

        best_score:
          round(
            s.best
          ),

        rank:
          me
            ? me.rank
            : null,

        participants:
          board.length,

        notifications:
          notes,

        upcoming:
          exams
            .filter(
              (e) =>
                e.status ===
                  'AVAILABLE' ||
                e.status ===
                  'IN_PROGRESS'
            )
            .slice(
              0,
              3
            )

      });

    }
  );