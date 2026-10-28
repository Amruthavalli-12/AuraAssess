const db = require('../config/db');

const {
  wrap,
  bad,
  round,
  classify,
  buckets,
  examRanking
} = require('./helpers');


/* ============================================================
   COMMON HELPERS
   ============================================================ */

const ownExam = async (id, uid) =>
  (await db.query(
    'SELECT * FROM exams WHERE id = ? AND created_by = ?',
    [id, uid]
  ))[0][0];


const toDate = (v) => {
  const d = new Date(v);
  return isNaN(d) ? null : d;
};


const ACTIVE_STUDENTS =
  `(SELECT COUNT(*) FROM users WHERE role='STUDENT' AND status='active')`;


/* ============================================================
   QUESTIONS
   ============================================================ */

const FIELD_MSG = {
  topic: 'Topic name is mandatory',
  question_text: 'Question text is required',
  option_a: 'Option A is required',
  option_b: 'Option B is required',
  option_c: 'Option C is required',
  option_d: 'Option D is required'
};


function validateQ(b) {

  for (const k of Object.keys(FIELD_MSG)) {

    if (!b[k] || !String(b[k]).trim()) {
      return FIELD_MSG[k];
    }
  }


  if (
    !['A', 'B', 'C', 'D'].includes(
      String(b.correct_answer).toUpperCase()
    )
  ) {
    return 'Correct answer must be A, B, C or D';
  }


  if (!Number(b.subject_id)) {
    return 'Subject is required';
  }


  if (!(Number(b.marks ?? 1) > 0)) {
    return 'Marks must be a positive number';
  }


  return null;
}


const qParams = (b) => [

  Number(b.subject_id),

  String(b.topic).trim(),

  String(b.question_text).trim(),

  String(b.option_a).trim(),

  String(b.option_b).trim(),

  String(b.option_c).trim(),

  String(b.option_d).trim(),

  String(b.correct_answer).toUpperCase(),

  Math.round(
    Number(b.marks ?? 1)
  )
];


/* ============================================================
   QUESTION EXPORTS
   ============================================================ */

exports.questions = {


  /* ---------------- Question List ---------------- */

  list: wrap(async (req, res) => {

    let sql = `
      SELECT
        q.*,
        s.name AS subject_name
      FROM questions q
      JOIN subjects s
        ON s.id = q.subject_id
      WHERE q.created_by = ?
    `;


    const a = [
      req.user.id
    ];


    if (req.query.subject_id) {

      sql +=
        ' AND q.subject_id = ?';

      a.push(
        req.query.subject_id
      );
    }


    if (req.query.topic) {

      sql +=
        ' AND q.topic = ?';

      a.push(
        req.query.topic
      );
    }


    if (req.query.search) {

      sql +=
        ' AND (q.question_text LIKE ? OR q.topic LIKE ?)';

      a.push(
        `%${req.query.search}%`,
        `%${req.query.search}%`
      );
    }


    const [rows] =
      await db.query(
        sql +
        ' ORDER BY q.subject_id, q.topic, q.id',
        a
      );


    res.json(rows);
  }),


  /* ---------------- Create Question ---------------- */

  create: wrap(async (req, res) => {

    const err =
      validateQ(
        req.body || {}
      );


    if (err) {
      return bad(res, err);
    }


    const [r] =
      await db.query(
        `INSERT INTO questions
        (
          subject_id,
          topic,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          marks,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ...qParams(req.body),
          req.user.id
        ]
      );


    res.status(201).json({
      id: r.insertId,
      message: 'Question added'
    });
  }),


  /* ---------------- Update Question ---------------- */

  update: wrap(async (req, res) => {

    const err =
      validateQ(
        req.body || {}
      );


    if (err) {
      return bad(res, err);
    }


    const [r] =
      await db.query(
        `UPDATE questions
         SET
           subject_id=?,
           topic=?,
           question_text=?,
           option_a=?,
           option_b=?,
           option_c=?,
           option_d=?,
           correct_answer=?,
           marks=?
         WHERE id = ?
           AND created_by = ?`,
        [
          ...qParams(req.body),
          req.params.id,
          req.user.id
        ]
      );


    if (!r.affectedRows) {

      return bad(
        res,
        'Question not found',
        404
      );
    }


    res.json({
      message: 'Question updated'
    });
  }),


  /* ---------------- Delete Question ---------------- */

  remove: wrap(async (req, res) => {

    const [r] =
      await db.query(
        'DELETE FROM questions WHERE id = ? AND created_by = ?',
        [
          req.params.id,
          req.user.id
        ]
      );


    if (!r.affectedRows) {

      return bad(
        res,
        'Question not found',
        404
      );
    }


    res.json({
      message: 'Question deleted'
    });
  }),


  /* ---------------- Topics ---------------- */

  topics: wrap(async (req, res) => {

    let sql =
      'SELECT DISTINCT topic FROM questions WHERE created_by = ?';


    const a = [
      req.user.id
    ];


    if (req.query.subject_id) {

      sql +=
        ' AND subject_id = ?';

      a.push(
        req.query.subject_id
      );
    }


    const [rows] =
      await db.query(
        sql + ' ORDER BY topic',
        a
      );


    res.json(
      rows.map(
        (r) => r.topic
      )
    );
  })

};


/* ============================================================
   EXAMS
   ============================================================ */

async function setQuestions(
  examId,
  ids
) {

  await db.query(
    'DELETE FROM exam_questions WHERE exam_id = ?',
    [examId]
  );


  if (ids.length) {

    await db.query(
      `INSERT INTO exam_questions
       (exam_id, question_id, position)
       VALUES ?`,
      [
        ids.map(
          (q, i) => [
            examId,
            q,
            i + 1
          ]
        )
      ]
    );
  }
}


async function validQuestions(
  ids,
  uid
) {

  if (!ids.length) {
    return [];
  }


  const [rows] =
    await db.query(
      `SELECT id, marks
       FROM questions
       WHERE id IN (?)
         AND created_by = ?`,
      [
        ids,
        uid
      ]
    );


  return rows;
}


/* ============================================================
   EXAM EXPORTS
   ============================================================ */

exports.exams = {


  /* ---------------- Exam List ---------------- */

  list: wrap(async (req, res) => {

    const [rows] =
      await db.query(
        `SELECT
          e.*,
          s.name AS subject_name,

          (
            SELECT COUNT(*)
            FROM exam_questions
            WHERE exam_id = e.id
          ) AS question_count,

          (
            SELECT COUNT(*)
            FROM exam_attempts
            WHERE exam_id = e.id
              AND status = 'SUBMITTED'
          ) AS attempts,

          IF(
            e.assign_all = 1,
            ${ACTIVE_STUDENTS},
            (
              SELECT COUNT(*)
              FROM exam_assignments
              WHERE exam_id = e.id
            )
          ) AS assigned

         FROM exams e

         JOIN subjects s
           ON s.id = e.subject_id

         WHERE e.created_by = ?

         ORDER BY e.created_at DESC`,
        [req.user.id]
      );


    res.json(rows);
  }),


  /* ---------------- Single Exam ---------------- */

  one: wrap(async (req, res) => {

    const e =
      await ownExam(
        req.params.id,
        req.user.id
      );


    if (!e) {

      return bad(
        res,
        'Exam not found',
        404
      );
    }


    const [q] =
      await db.query(
        `SELECT question_id
         FROM exam_questions
         WHERE exam_id = ?
         ORDER BY position`,
        [e.id]
      );


    const [a] =
      await db.query(
        `SELECT student_id
         FROM exam_assignments
         WHERE exam_id = ?`,
        [e.id]
      );


    res.json({

      ...e,

      question_ids:
        q.map(
          (x) => x.question_id
        ),

      assigned_student_ids:
        a.map(
          (x) => x.student_id
        )
    });
  }),


  /* ---------------- Create Exam ---------------- */

  create: wrap(async (req, res) => {

    const b =
      req.body || {};


    const err =
      validateExam(b);


    if (err) {
      return bad(res, err);
    }


    const ids = (
      Array.isArray(
        b.question_ids
      )
        ? b.question_ids
        : []
    ).map(Number);


    const qs =
      await validQuestions(
        ids,
        req.user.id
      );


    const max =
      qs.length
        ? qs.reduce(
            (s, x) =>
              s + Number(x.marks),
            0
          )
        : Number(b.max_marks) || 0;


    const [r] =
      await db.query(
        `INSERT INTO exams
        (
          title,
          subject_id,
          created_by,
          description,
          duration_minutes,
          max_marks,
          start_date,
          end_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.title.trim(),
          b.subject_id,
          req.user.id,
          b.description || null,
          Number(
            b.duration_minutes
          ),
          max,
          toDate(
            b.start_date
          ),
          toDate(
            b.end_date
          )
        ]
      );


    await setQuestions(
      r.insertId,
      qs.map(
        (x) => x.id
      )
    );


    res.status(201).json({

      id:
        r.insertId,

      max_marks:
        max,

      message:
        'Exam created'
    });
  }),


  /* ---------------- Update Exam ---------------- */

  update: wrap(async (req, res) => {

    const e =
      await ownExam(
        req.params.id,
        req.user.id
      );


    if (!e) {

      return bad(
        res,
        'Exam not found',
        404
      );
    }


    const b = {
      ...e,
      ...req.body
    };


    const err =
      validateExam(b);


    if (err) {
      return bad(res, err);
    }


    let max =
      Number(
        b.max_marks
      ) || 0;


    if (
      Array.isArray(
        req.body.question_ids
      )
    ) {

      const [[c]] =
        await db.query(
          `SELECT COUNT(*) AS n
           FROM exam_attempts
           WHERE exam_id = ?`,
          [e.id]
        );


      if (c.n > 0) {

        return bad(
          res,
          'Questions cannot be changed after students have started this exam',
          409
        );
      }


      const qs =
        await validQuestions(
          req.body.question_ids.map(Number),
          req.user.id
        );


      max =
        qs.reduce(
          (s, x) =>
            s + Number(x.marks),
          0
        );


      await setQuestions(
        e.id,
        qs.map(
          (x) => x.id
        )
      );
    }


    const pub =
      b.is_published
        ? 1
        : 0;


    if (pub) {

      const [[c]] =
        await db.query(
          `SELECT COUNT(*) AS n
           FROM exam_questions
           WHERE exam_id = ?`,
          [e.id]
        );


      if (!c.n) {

        return bad(
          res,
          'Add at least one question before publishing'
        );
      }
    }


    await db.query(
      `UPDATE exams
       SET
         title=?,
         subject_id=?,
         description=?,
         duration_minutes=?,
         max_marks=?,
         start_date=?,
         end_date=?,
         is_published=?
       WHERE id=?`,
      [
        String(
          b.title
        ).trim(),

        b.subject_id,

        b.description || null,

        Number(
          b.duration_minutes
        ),

        max,

        toDate(
          b.start_date
        ),

        toDate(
          b.end_date
        ),

        pub,

        e.id
      ]
    );


    res.json({

      message:
        pub
          ? 'Exam saved'
          : 'Exam saved (draft)',

      max_marks:
        max
    });
  }),


  /* ---------------- Delete Exam ---------------- */

  remove: wrap(async (req, res) => {

    const [r] =
      await db.query(
        `DELETE FROM exams
         WHERE id = ?
           AND created_by = ?`,
        [
          req.params.id,
          req.user.id
        ]
      );


    if (!r.affectedRows) {

      return bad(
        res,
        'Exam not found',
        404
      );
    }


    res.json({
      message: 'Exam deleted'
    });
  }),


  /* ---------------- Assign Exam ---------------- */

  assign: wrap(async (req, res) => {

    const e =
      await ownExam(
        req.params.id,
        req.user.id
      );


    if (!e) {

      return bad(
        res,
        'Exam not found',
        404
      );
    }


    const {
      all,
      student_ids
    } = req.body || {};


    if (all) {

      await db.query(
        `UPDATE exams
         SET assign_all = 1
         WHERE id = ?`,
        [e.id]
      );


      await db.query(
        `INSERT INTO notifications
         (user_id, title, message)

         SELECT
           id,
           'New exam assigned',
           ?

         FROM users

         WHERE role = 'STUDENT'
           AND status = 'active'`,
        [
          `"${e.title}" has been assigned to you.`
        ]
      );


      return res.json({
        message:
          'Exam assigned to all students'
      });
    }


    if (
      !Array.isArray(
        student_ids
      ) ||
      !student_ids.length
    ) {

      return bad(
        res,
        'Select at least one student'
      );
    }


    const [valid] =
      await db.query(
        `SELECT id
         FROM users
         WHERE id IN (?)
           AND role = 'STUDENT'`,
        [
          student_ids.map(Number)
        ]
      );


    const ids =
      valid.map(
        (v) => v.id
      );


    if (!ids.length) {

      return bad(
        res,
        'No valid students selected'
      );
    }


    await db.query(
      `UPDATE exams
       SET assign_all = 0
       WHERE id = ?`,
      [e.id]
    );


    await db.query(
      `DELETE FROM exam_assignments
       WHERE exam_id = ?
         AND student_id NOT IN (?)
         AND student_id NOT IN (
           SELECT student_id
           FROM exam_attempts
           WHERE exam_id = ?
         )`,
      [
        e.id,
        ids,
        e.id
      ]
    );


    const [ins] =
      await db.query(
        `INSERT IGNORE INTO exam_assignments
         (exam_id, student_id)
         VALUES ?`,
        [
          ids.map(
            (s) => [
              e.id,
              s
            ]
          )
        ]
      );


    if (ins.affectedRows) {

      await db.query(
        `INSERT INTO notifications
         (user_id, title, message)
         VALUES ?`,
        [
          ids.map(
            (s) => [
              s,
              'New exam assigned',
              `"${e.title}" has been assigned to you.`
            ]
          )
        ]
      );
    }


    res.json({

      message:
        `Exam assigned to ${ids.length} student(s)`
    });
  }),


  /* ==========================================================
     RESULTS
     ========================================================== */

  results: wrap(async (req, res) => {

    const e =
      await ownExam(
        req.params.id,
        req.user.id
      );


    if (!e) {

      return bad(
        res,
        'Exam not found',
        404
      );
    }


    res.json(
      await examRanking(
        e.id
      )
    );
  }),


  /* ==========================================================
     RANKING
     ========================================================== */

  ranking: wrap(async (req, res) => {

    const e =
      await ownExam(
        req.params.id,
        req.user.id
      );


    if (!e) {

      return bad(
        res,
        'Exam not found',
        404
      );
    }


    const rows =
      await examRanking(
        e.id
      );


    res.json(
      rows.map(
        (r) => ({

          rank:
            r.rank,

          student_id:
            r.user_code,

          student_name:
            r.name,

          marks:
            r.marks,

          max_marks:
            r.max_marks,

          percentage:
            r.percentage,

          violations:
            Number(
              r.violations || 0
            ),

          submission_status:
            r.submission_status ||
            null,

          submit_reason:
            r.submit_reason ||
            null,

          rules_violated:
            Boolean(
              r.rules_violated
            ),

          violation_types:
            Array.isArray(
              r.violation_types
            )
              ? r.violation_types
              : [],

          violation_summary:
            r.violation_summary ||
            {},

          total_violations:
            Number(
              r.total_violations ||
              r.violations ||
              0
            )
        })
      )
    );
  }),


  /* ==========================================================
     EXAM ANALYTICS
     
     Existing:
     - Statistics
     - Distribution
     - Overall topic performance
     - Ranking

     New:
     - Student-wise performance
     - Strong topics
     - Needs Improvement topics
     - Weak topics
     - Skipped topic handling
     - Violation information
     ========================================================== */

  analytics: wrap(async (req, res) => {

    /* --------------------------------------------------------
       Find exam
       -------------------------------------------------------- */

    const e =
      await ownExam(
        req.params.id,
        req.user.id
      );


    if (!e) {

      return bad(
        res,
        'Exam not found',
        404
      );
    }


    /* --------------------------------------------------------
       Overall Exam Statistics
       -------------------------------------------------------- */

    const [[a]] =
      await db.query(
        `SELECT
          COUNT(*) AS attempted,

          COALESCE(
            AVG(obtained_marks),
            0
          ) AS avg_marks,

          COALESCE(
            MAX(obtained_marks),
            0
          ) AS high,

          COALESCE(
            MIN(obtained_marks),
            0
          ) AS low,

          COALESCE(
            AVG(percentage),
            0
          ) AS avg_pct

         FROM results

         WHERE exam_id = ?`,
        [e.id]
      );


    /* --------------------------------------------------------
       Assigned Students
       -------------------------------------------------------- */

    let assigned;


    if (e.assign_all) {

      assigned =
        (
          await db.query(
            `SELECT
              ${ACTIVE_STUDENTS} AS n`
          )
        )[0][0].n;

    } else {

      assigned =
        (
          await db.query(
            `SELECT
              COUNT(*) AS n
             FROM exam_assignments
             WHERE exam_id = ?`,
            [e.id]
          )
        )[0][0].n;
    }


    /* ========================================================
       OVERALL TOPIC PERFORMANCE

       IMPORTANT:
       This is calculated directly from the actual submitted
       answers instead of topic_performance.total_questions.

       Therefore:
       - Answered questions are used for percentage.
       - Skipped questions do NOT reduce percentage.
       - All skipped = SKIPPED.
       ======================================================== */

    const [tp] =
      await db.query(
        `SELECT

          q.topic,

          COUNT(*) AS total_questions,

          SUM(
            CASE
              WHEN sa.id IS NULL
                OR sa.selected_answer IS NULL
                OR TRIM(sa.selected_answer) = ''
              THEN 1
              ELSE 0
            END
          ) AS skipped_count,

          SUM(
            CASE
              WHEN sa.id IS NOT NULL
                AND sa.selected_answer IS NOT NULL
                AND TRIM(sa.selected_answer) <> ''
                AND sa.is_correct = 1
              THEN 1
              ELSE 0
            END
          ) AS correct_count

         FROM results r

         JOIN exam_questions eq
           ON eq.exam_id = r.exam_id

         JOIN questions q
           ON q.id = eq.question_id

         LEFT JOIN student_answers sa
           ON sa.attempt_id = r.attempt_id
          AND sa.question_id = q.id

         WHERE r.exam_id = ?

         GROUP BY q.topic

         ORDER BY q.topic`,
        [e.id]
      );


    /* --------------------------------------------------------
       Existing Ranking
       -------------------------------------------------------- */

    const ranking =
      await examRanking(
        e.id
      );


    /* ========================================================
       STUDENT-WISE TOPIC PERFORMANCE
       ======================================================== */

    const [studentTopicRows] =
      await db.query(
        `SELECT

          r.student_id,

          u.user_code,

          u.name,

          r.obtained_marks,

          r.max_marks,

          r.percentage,

          r.correct_count,

          r.wrong_count,

          r.unanswered_count,

          r.attempt_id,

          tp.topic,

          tp.total_questions
            AS topic_total,

          tp.correct_count
            AS topic_correct,

          tp.percentage
            AS topic_percentage,

          tp.status
            AS topic_status

         FROM results r

         JOIN users u
           ON u.id = r.student_id

         LEFT JOIN topic_performance tp
           ON tp.attempt_id = r.attempt_id

         WHERE r.exam_id = ?

         ORDER BY
           r.percentage DESC,
           u.name ASC,
           tp.topic ASC`,
        [e.id]
      );


    /* ========================================================
       STUDENT MAP
       
       Start with ranking data so that every submitted
       student appears even if topic_performance is empty.
       ======================================================== */

    const studentMap =
      new Map();


    /* --------------------------------------------------------
       STEP 1 — Create students from ranking
       -------------------------------------------------------- */

    ranking.forEach((r) => {

      const studentKey =
        String(
          r.user_code
        );


      studentMap.set(
        studentKey,
        {

          student_id:
            r.student_id ||
            null,

          user_code:
            r.user_code,

          name:
            r.name,

          rank:
            r.rank,

          attempt_id:
            r.attempt_id ||
            null,

          marks:
            Number(
              r.marks || 0
            ),

          max_marks:
            Number(
              r.max_marks ||
              e.max_marks ||
              0
            ),

          percentage:
            round(
              r.percentage || 0
            ),

          correct_count:
            Number(
              r.correct_count || 0
            ),

          wrong_count:
            Number(
              r.wrong_count || 0
            ),

          unanswered_count:
            Number(
              r.unanswered_count || 0
            ),

          violations:
            Number(
              r.violations || 0
            ),

          submission_status:
            r.submission_status ||
            null,

          submit_reason:
            r.submit_reason ||
            null,

          rules_violated:
            Boolean(
              r.rules_violated
            ),

          violation_types:
            Array.isArray(
              r.violation_types
            )
              ? r.violation_types
              : [],

          violation_summary:
            r.violation_summary ||
            {},

          total_violations:
            Number(
              r.total_violations ||
              r.violations ||
              0
            ),

          strong_topics: [],

          needs_improvement_topics: [],

          weak_topics: [],

          skipped_topics: []
        }
      );
    });


    /* --------------------------------------------------------
       STEP 2 — Add topic information
       -------------------------------------------------------- */

    for (
      const row of studentTopicRows
    ) {

      const studentKey =
        String(
          row.user_code
        );


      /*
       * If ranking somehow does not contain this
       * student, create the student from results.
       */

      if (
        !studentMap.has(
          studentKey
        )
      ) {

        studentMap.set(
          studentKey,
          {

            student_id:
              row.student_id,

            user_code:
              row.user_code,

            name:
              row.name,

            rank:
              null,

            attempt_id:
              row.attempt_id,

            marks:
              Number(
                row.obtained_marks || 0
              ),

            max_marks:
              Number(
                row.max_marks ||
                e.max_marks ||
                0
              ),

            percentage:
              round(
                row.percentage || 0
              ),

            correct_count:
              Number(
                row.correct_count || 0
              ),

            wrong_count:
              Number(
                row.wrong_count || 0
              ),

            unanswered_count:
              Number(
                row.unanswered_count || 0
              ),

            violations:
              0,

            submission_status:
              null,

            submit_reason:
              null,

            rules_violated:
              false,

            violation_types: [],

            violation_summary: {},

            total_violations:
              0,

            strong_topics: [],

            needs_improvement_topics: [],

            weak_topics: [],

            skipped_topics: []
          }
        );
      }


      const student =
        studentMap.get(
          studentKey
        );


      /* Keep attempt ID available */

      if (
        !student.attempt_id &&
        row.attempt_id
      ) {
        student.attempt_id =
          row.attempt_id;
      }


      /* No topic information */

      if (!row.topic) {
        continue;
      }


      /* ------------------------------------------------------
         Topic Total
         ------------------------------------------------------ */

      const topicTotal =
        Number(
          row.topic_total || 0
        );


      /* ------------------------------------------------------
         Correct Answers
         ------------------------------------------------------ */

      const topicCorrect =
        Number(
          row.topic_correct || 0
        );


      /* ------------------------------------------------------
         Calculate skipped questions directly from
         the student's submitted answers.
         
         IMPORTANT:
         Skipped questions must NOT reduce the topic
         percentage.
         ------------------------------------------------------ */

      const [[skipRow]] =
        await db.query(
          `SELECT
             COUNT(*) AS skipped_count

           FROM exam_questions eq

           JOIN questions q
             ON q.id = eq.question_id

           LEFT JOIN student_answers sa
             ON sa.question_id = q.id
            AND sa.attempt_id = ?

           WHERE eq.exam_id = ?
             AND q.topic = ?

             AND (
               sa.id IS NULL
               OR sa.selected_answer IS NULL
               OR TRIM(sa.selected_answer) = ''
             )`,
          [
            row.attempt_id,
            e.id,
            row.topic
          ]
        );


      const skippedCount =
        Number(
          skipRow?.skipped_count || 0
        );


      /* ------------------------------------------------------
         Answered Questions
         
         answered = total - skipped
         ------------------------------------------------------ */

      const answeredCount =
        Math.max(
          0,
          topicTotal -
          skippedCount
        );


      /* ------------------------------------------------------
         Topic Percentage
         
         IMPORTANT:
         Percentage is based ONLY on answered questions.
         ------------------------------------------------------ */

      const topicPercentage =
        answeredCount > 0
          ? round(
              (
                topicCorrect /
                answeredCount
              ) * 100
            )
          : 0;


      /* ------------------------------------------------------
         Topic Status
         
         ALL SKIPPED => SKIPPED
         Otherwise classify only answered questions.
         ------------------------------------------------------ */

      let topicStatus;


      if (
        answeredCount === 0
      ) {

        topicStatus =
          'SKIPPED';

      } else {

        topicStatus =
          classify(
            topicPercentage
          );
      }


      const topic = {

        topic:
          row.topic,

        total_questions:
          topicTotal,

        answered_count:
          answeredCount,

        skipped_count:
          skippedCount,

        correct_count:
          topicCorrect,

        wrong_count:
          Math.max(
            0,
            answeredCount -
            topicCorrect
          ),

        percentage:
          topicPercentage,

        status:
          topicStatus
      };


      /* ------------------------------------------------------
         Add to correct category
         ------------------------------------------------------ */

      if (
        topicStatus === 'STRONG'
      ) {

        student.strong_topics.push(
          topic
        );

      } else if (
        topicStatus ===
        'NEEDS_IMPROVEMENT'
      ) {

        student.needs_improvement_topics.push(
          topic
        );

      } else if (
        topicStatus === 'WEAK'
      ) {

        student.weak_topics.push(
          topic
        );

      } else if (
        topicStatus === 'SKIPPED'
      ) {

        student.skipped_topics.push(
          topic
        );
      }
    }


    /* ========================================================
       VIOLATION DETAILS
       
       Teacher should be able to see:
       - total violations
       - whether rules were violated
       - submission reason
       - violation types
       ======================================================== */

    const [violationRows] =
      await db.query(
        `SELECT

          v.attempt_id,

          v.violation_type,

          COUNT(*) AS count

         FROM violations v

         JOIN exam_attempts a
           ON a.id = v.attempt_id

         WHERE a.exam_id = ?

         GROUP BY
           v.attempt_id,
           v.violation_type

         ORDER BY
           v.attempt_id,
           v.violation_type`,
        [e.id]
      );


    const violationMap =
      new Map();


    for (
      const v of violationRows
    ) {

      const key =
        String(
          v.attempt_id
        );


      if (
        !violationMap.has(key)
      ) {

        violationMap.set(
          key,
          {}
        );
      }


      const summary =
        violationMap.get(
          key
        );


      summary[
        v.violation_type
      ] =
        Number(
          v.count || 0
        );
    }


    /* --------------------------------------------------------
       Attach violation data to students
       -------------------------------------------------------- */

    studentMap.forEach(
      (student) => {

        if (
          !student.attempt_id
        ) {
          return;
        }


        const summary =
          violationMap.get(
            String(
              student.attempt_id
            )
          ) || {};


        student.violation_summary =
          summary;


        student.violation_types =
          Object.keys(
            summary
          );


        student.total_violations =
          Object.values(
            summary
          ).reduce(
            (sum, n) =>
              sum + Number(n || 0),
            0
          );


        /*
         * If the attempt has violations,
         * make sure rules_violated is true.
         */
        if (
          student.total_violations > 0
        ) {

          student.rules_violated =
            true;
        }
      }
    );


    /* ========================================================
       OVERALL TOPIC FINAL CALCULATION
       ======================================================== */

    const overallTopics =
      tp.map(
        (t) => {

          const total =
            Number(
              t.total_questions || 0
            );

          const skipped =
            Number(
              t.skipped_count || 0
            );

          const correct =
            Number(
              t.correct_count || 0
            );

          const answered =
            Math.max(
              0,
              total - skipped
            );


          const percentage =
            answered > 0
              ? round(
                  (
                    correct /
                    answered
                  ) * 100
                )
              : 0;


          const status =
            answered === 0
              ? 'SKIPPED'
              : classify(
                  percentage
                );


          return {

            topic:
              t.topic,

            total_questions:
              total,

            answered_count:
              answered,

            skipped_count:
              skipped,

            correct_count:
              correct,

            wrong_count:
              Math.max(
                0,
                answered -
                correct
              ),

            percentage,

            status
          };
        }
      );


    /* ========================================================
       FINAL STUDENT LIST
       ======================================================== */

    const students =
      Array.from(
        studentMap.values()
      ).sort(
        (a, b) => {

          const rankA =
            a.rank ??
            Number.MAX_SAFE_INTEGER;

          const rankB =
            b.rank ??
            Number.MAX_SAFE_INTEGER;


          return (
            rankA - rankB ||
            String(
              a.name || ''
            ).localeCompare(
              String(
                b.name || ''
              )
            )
          );
        }
      );


    /* ========================================================
       FINAL ANALYTICS RESPONSE
       ======================================================== */

    res.json({

      /* ---------------- Exam ---------------- */

      exam: {

        id:
          e.id,

        title:
          e.title,

        max_marks:
          e.max_marks,

        max_violations:
          Number(
            e.max_violations || 0
          )
      },


      /* ---------------- Statistics ---------------- */

      total_assigned:
        assigned,

      attempted:
        a.attempted,

      not_attempted:
        Math.max(
          0,
          assigned -
          Number(a.attempted || 0)
        ),


      avg_marks:
        round(
          a.avg_marks
        ),

      avg_pct:
        round(
          a.avg_pct
        ),

      highest:
        a.high,

      lowest:
        a.low,


      /* ---------------- Distribution ---------------- */

      distribution:
        buckets(
          ranking.map(
            (r) =>
              r.percentage
          )
        ),


      /* ---------------- Overall Topics ---------------- */

      topics:
        overallTopics,


      /* ---------------- Existing Ranking ---------------- */

      ranking,


      /* ---------------- Student Analytics ---------------- */

      students

    });
  })

};


/* ============================================================
   EXAM VALIDATION
   ============================================================ */

function validateExam(b) {

  if (
    !b.title ||
    !String(
      b.title
    ).trim()
  ) {

    return 'Exam title is required';
  }


  if (
    !Number(
      b.subject_id
    )
  ) {

    return 'Please select a subject';
  }


  if (
    !(
      Number(
        b.duration_minutes
      ) > 0
    )
  ) {

    return 'Duration must be greater than 0 minutes';
  }


  const s =
    toDate(
      b.start_date
    );

  const e =
    toDate(
      b.end_date
    );


  if (!s || !e) {

    return 'Start and end date are required';
  }


  if (e <= s) {

    return 'End date must be after start date';
  }


  return null;
}


/* ============================================================
   STUDENTS
   ============================================================ */

exports.students = wrap(
  async (req, res) => {

    const [rows] =
      await db.query(
        `SELECT
          id,
          user_code,
          name,
          email

         FROM users

         WHERE role = 'STUDENT'
           AND status = 'active'

         ORDER BY user_code`
      );


    res.json(rows);
  }
);


/* ============================================================
   TEACHER DASHBOARD
   ============================================================ */

exports.dashboard = wrap(
  async (req, res) => {

    const uid =
      req.user.id;


    const [[c]] =
      await db.query(
        `SELECT

          (
            SELECT COUNT(*)
            FROM exams
            WHERE created_by = ?
          ) AS my_exams,


          (
            SELECT COUNT(*)
            FROM exams
            WHERE created_by = ?
              AND is_published = 1
          ) AS published,


          (
            SELECT COUNT(*)
            FROM users u

            WHERE u.role = 'STUDENT'
              AND u.status = 'active'

              AND (

                EXISTS (
                  SELECT 1
                  FROM exams e
                  WHERE e.created_by = ?
                    AND e.assign_all = 1
                )

                OR

                EXISTS (
                  SELECT 1
                  FROM exam_assignments a

                  JOIN exams e
                    ON e.id = a.exam_id

                  WHERE e.created_by = ?
                    AND a.student_id = u.id
                )

              )

          ) AS total_students,


          (
            SELECT COUNT(*)
            FROM exam_attempts a

            JOIN exams e
              ON e.id = a.exam_id

            WHERE e.created_by = ?
              AND a.status = 'SUBMITTED'

          ) AS attempts,


          (
            SELECT COALESCE(
              AVG(r.percentage),
              0
            )

            FROM results r

            JOIN exams e
              ON e.id = r.exam_id

            WHERE e.created_by = ?

          ) AS avg_score`,

        [
          uid,
          uid,
          uid,
          uid,
          uid,
          uid
        ]
      );


    /* --------------------------------------------------------
       Top Performer
       -------------------------------------------------------- */

    const [top] =
      await db.query(
        `SELECT

          u.name,

          u.user_code,

          AVG(
            r.percentage
          ) AS pct

         FROM results r

         JOIN exams e
           ON e.id = r.exam_id

         JOIN users u
           ON u.id = r.student_id

         WHERE e.created_by = ?

         GROUP BY
           u.id,
           u.name,
           u.user_code

         ORDER BY pct DESC

         LIMIT 1`,
        [uid]
      );


    res.json({

      ...c,

      avg_score:
        round(
          c.avg_score
        ),

      top_performer:

        top[0]

          ? {

              name:
                top[0].name,

              user_code:
                top[0].user_code,

              percentage:
                round(
                  top[0].pct
                )
            }

          : null
    });
  }
);