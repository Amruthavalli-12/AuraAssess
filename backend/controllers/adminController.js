const db = require('../config/db');
const {
  wrap,
  bad,
  round,
  classify,
  buckets
} = require('./helpers');


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


const SEL = `
  SELECT
    u.id,
    u.user_code,
    u.name,
    u.email,
    u.role,
    u.status,
    u.created_at,
    (u.password_hash IS NOT NULL) AS password_set,
    p.photo
  FROM users u
  LEFT JOIN profiles p
    ON p.user_id = u.id
  WHERE u.role = ?
`;


/* ============================================================
   USER CRUD
   ============================================================ */

function userCrud(role) {

  const label =
    role === 'TEACHER'
      ? 'Teacher'
      : 'Student';


  return {


    /* ---------------- LIST ---------------- */

    list: wrap(async (req, res) => {

      let sql =
        SEL;

      const a = [
        role
      ];


      if (req.query.search) {

        const s =
          `%${req.query.search}%`;

        sql +=
          ' AND (u.user_code LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';

        a.push(
          s,
          s,
          s
        );
      }


      if (
        ['active', 'inactive']
          .includes(
            req.query.status
          )
      ) {

        sql +=
          ' AND u.status = ?';

        a.push(
          req.query.status
        );
      }


      const [rows] =
        await db.query(
          sql +
          ' ORDER BY u.user_code',
          a
        );


      rows.forEach(
        (r) => {

          r.password_set =
            !!r.password_set;
        }
      );


      res.json(rows);
    }),


    /* ---------------- ONE ---------------- */

    one: wrap(async (req, res) => {

      const [r] =
        await db.query(
          SEL +
          ' AND u.id = ?',
          [
            role,
            req.params.id
          ]
        );


      if (!r[0]) {

        return bad(
          res,
          `${label} not found`,
          404
        );
      }


      const u =
        r[0];


      u.password_set =
        !!u.password_set;


      if (
        role === 'STUDENT'
      ) {

        const [[s]] =
          await db.query(
            `SELECT
              COUNT(*) AS tests,
              COALESCE(
                AVG(percentage),
                0
              ) AS avg_pct
             FROM results
             WHERE student_id = ?`,
            [u.id]
          );


        u.tests =
          s.tests;

        u.avg_pct =
          round(
            s.avg_pct
          );

      } else {

        const [[s]] =
          await db.query(
            `SELECT
              COUNT(*) AS exam_count
             FROM exams
             WHERE created_by = ?`,
            [u.id]
          );


        u.exam_count =
          s.exam_count;
      }


      res.json(u);
    }),


    /* ---------------- CREATE ---------------- */

    create: wrap(async (req, res) => {

      const code =
        String(
          req.body.user_code || ''
        ).trim();

      const name =
        String(
          req.body.name || ''
        ).trim();

      const email =
        String(
          req.body.email || ''
        ).trim();


      if (
        !code ||
        !name ||
        !email
      ) {

        return bad(
          res,
          `${label} ID, name and email are required`
        );
      }


      if (
        !/^[A-Za-z0-9_-]{2,50}$/
          .test(code)
      ) {

        return bad(
          res,
          'ID may contain letters, numbers, - and _ only'
        );
      }


      if (
        !EMAIL.test(email)
      ) {

        return bad(
          res,
          'Enter a valid email address'
        );
      }


      const [d] =
        await db.query(
          `SELECT
            user_code,
            email
           FROM users
           WHERE user_code = ?
              OR email = ?`,
          [
            code,
            email
          ]
        );


      if (d.length) {

        return bad(
          res,
          d[0].user_code
            .toLowerCase() ===
            code.toLowerCase()
            ? `${label} ID already exists`
            : 'Email already exists',
          409
        );
      }


      const [r] =
        await db.query(
          `INSERT INTO users
           (
             user_code,
             name,
             email,
             role
           )
           VALUES (?, ?, ?, ?)`,
          [
            code,
            name,
            email,
            role
          ]
        );


      await db.query(
        `INSERT INTO profiles
         (user_id)
         VALUES (?)`,
        [
          r.insertId
        ]
      );


      res.status(201).json({

        id:
          r.insertId,

        message:
          `${label} created. They will set a password at first login.`
      });
    }),


    /* ---------------- UPDATE ---------------- */

    update: wrap(async (req, res) => {

      const [r] =
        await db.query(
          `SELECT *
           FROM users
           WHERE id = ?
             AND role = ?`,
          [
            req.params.id,
            role
          ]
        );


      if (!r[0]) {

        return bad(
          res,
          `${label} not found`,
          404
        );
      }


      const b =
        req.body;

      const u =
        r[0];


      const code =
        String(
          b.user_code ??
          u.user_code
        ).trim();

      const name =
        String(
          b.name ??
          u.name
        ).trim();

      const email =
        String(
          b.email ??
          u.email
        ).trim();

      const status =
        b.status ??
        u.status;


      if (
        !code ||
        !name ||
        !email
      ) {

        return bad(
          res,
          'ID, name and email are required'
        );
      }


      if (
        !EMAIL.test(email)
      ) {

        return bad(
          res,
          'Enter a valid email address'
        );
      }


      if (
        ![
          'active',
          'inactive'
        ].includes(status)
      ) {

        return bad(
          res,
          'Invalid status'
        );
      }


      const [d] =
        await db.query(
          `SELECT id
           FROM users
           WHERE
             (
               user_code = ?
               OR email = ?
             )
             AND id <> ?`,
          [
            code,
            email,
            u.id
          ]
        );


      if (d.length) {

        return bad(
          res,
          'ID or email already used by another user',
          409
        );
      }


      await db.query(
        `UPDATE users
         SET
           user_code = ?,
           name = ?,
           email = ?,
           status = ?
         WHERE id = ?`,
        [
          code,
          name,
          email,
          status,
          u.id
        ]
      );


      res.json({

        message:
          `${label} updated`
      });
    }),


    /* ---------------- DELETE ---------------- */

    remove: wrap(async (req, res) => {

      const [r] =
        await db.query(
          `DELETE FROM users
           WHERE id = ?
             AND role = ?`,
          [
            req.params.id,
            role
          ]
        );


      if (!r.affectedRows) {

        return bad(
          res,
          `${label} not found`,
          404
        );
      }


      res.json({

        message:
          `${label} deleted`
      });
    })
  };
}


exports.teachers =
  userCrud(
    'TEACHER'
  );


exports.students =
  userCrud(
    'STUDENT'
  );


/* ============================================================
   SUBJECTS
   ============================================================ */

exports.subjects = {


  /* ---------------- LIST ---------------- */

  list: wrap(async (req, res) => {

    const [rows] =
      await db.query(
        `SELECT
          s.*,

          (
            SELECT COUNT(*)
            FROM exams e
            WHERE e.subject_id = s.id
          ) AS exam_count,

          (
            SELECT COUNT(*)
            FROM questions q
            WHERE q.subject_id = s.id
          ) AS question_count

         FROM subjects s

         ORDER BY s.name`
      );


    res.json(rows);
  }),


  /* ---------------- CREATE ---------------- */

  create: wrap(async (req, res) => {

    const name =
      String(
        req.body.name || ''
      ).trim();


    if (!name) {

      return bad(
        res,
        'Subject name is required'
      );
    }


    const [d] =
      await db.query(
        `SELECT id
         FROM subjects
         WHERE name = ?`,
        [name]
      );


    if (d.length) {

      return bad(
        res,
        'Subject already exists',
        409
      );
    }


    const [r] =
      await db.query(
        `INSERT INTO subjects
         (name, description)
         VALUES (?, ?)`,
        [
          name,
          req.body.description ||
          null
        ]
      );


    res.status(201).json({

      id:
        r.insertId,

      message:
        'Subject created'
    });
  }),


  /* ---------------- UPDATE ---------------- */

  update: wrap(async (req, res) => {

    const name =
      String(
        req.body.name || ''
      ).trim();


    if (!name) {

      return bad(
        res,
        'Subject name is required'
      );
    }


    const [d] =
      await db.query(
        `SELECT id
         FROM subjects
         WHERE name = ?
           AND id <> ?`,
        [
          name,
          req.params.id
        ]
      );


    if (d.length) {

      return bad(
        res,
        'Subject name already exists',
        409
      );
    }


    const [r] =
      await db.query(
        `UPDATE subjects
         SET
           name = ?,
           description = ?
         WHERE id = ?`,
        [
          name,
          req.body.description ||
          null,
          req.params.id
        ]
      );


    if (!r.affectedRows) {

      return bad(
        res,
        'Subject not found',
        404
      );
    }


    res.json({

      message:
        'Subject updated'
    });
  }),


  /* ---------------- DELETE ---------------- */

  remove: wrap(async (req, res) => {

    const [r] =
      await db.query(
        `DELETE FROM subjects
         WHERE id = ?`,
        [
          req.params.id
        ]
      );


    if (!r.affectedRows) {

      return bad(
        res,
        'Subject not found',
        404
      );
    }


    res.json({

      message:
        'Subject deleted'
    });
  })
};


/* ============================================================
   ADMIN PERFORMANCE
   ============================================================ */

exports.performance = wrap(
  async (req, res) => {

    /* --------------------------------------------------------
       BASIC STUDENT PERFORMANCE
       -------------------------------------------------------- */

    const [rows] =
      await db.query(
        `SELECT

          u.id,

          u.user_code,

          u.name,

          u.status,

          COUNT(r.id) AS tests,

          COALESCE(
            AVG(r.obtained_marks),
            0
          ) AS avg_marks,

          COALESCE(
            AVG(r.percentage),
            0
          ) AS pct

         FROM users u

         LEFT JOIN results r
           ON r.student_id = u.id

         WHERE u.role = 'STUDENT'

         GROUP BY
           u.id,
           u.user_code,
           u.name,
           u.status

         ORDER BY
           u.user_code`
      );


    /* --------------------------------------------------------
       TOPIC PERFORMANCE
       
       IMPORTANT:
       We do NOT directly classify using
       correct_count / total_questions.

       Skipped questions must be removed from
       the denominator.
       -------------------------------------------------------- */

    const [tp] =
      await db.query(
        `SELECT

          tp.attempt_id,

          tp.student_id,

          tp.exam_id,

          tp.topic,

          tp.total_questions,

          tp.correct_count,

          tp.percentage AS stored_percentage,

          tp.status AS stored_status

         FROM topic_performance tp

         ORDER BY
           tp.student_id,
           tp.attempt_id,
           tp.topic`
      );


    /* --------------------------------------------------------
       STUDENT / TOPIC MAP
       -------------------------------------------------------- */

    const by = {};


    /*
     * Cache skipped counts so that the same attempt/topic
     * is not queried more than once.
     */

    const skippedCache =
      new Map();


    for (
      const x of tp
    ) {

      const key =
        `${x.attempt_id}|${x.topic}`;


      let skippedCount =
        skippedCache.get(
          key
        );


      /* ------------------------------------------------------
         Calculate skipped questions
         ------------------------------------------------------ */

      if (
        skippedCount === undefined
      ) {

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
              x.attempt_id,
              x.exam_id,
              x.topic
            ]
          );


        skippedCount =
          Number(
            skipRow?.skipped_count ||
            0
          );


        skippedCache.set(
          key,
          skippedCount
        );
      }


      /* ------------------------------------------------------
         Topic counts
         ------------------------------------------------------ */

      const total =
        Number(
          x.total_questions || 0
        );


      const correct =
        Number(
          x.correct_count || 0
        );


      const skipped =
        skippedCount;


      const answered =
        Math.max(
          0,
          total -
          skipped
        );


      /* ------------------------------------------------------
         Correct topic percentage
         
         Only answered questions are included.
         ------------------------------------------------------ */

      const percentage =
        answered > 0
          ? round(
              (
                correct /
                answered
              ) * 100
            )
          : 0;


      /* ------------------------------------------------------
         Topic status
         
         All skipped => SKIPPED.
         ------------------------------------------------------ */

      let status;


      if (
        answered === 0
      ) {

        status =
          'SKIPPED';

      } else {

        status =
          classify(
            percentage
          );
      }


      /* ------------------------------------------------------
         Student topic bucket
         ------------------------------------------------------ */

      const studentId =
        x.student_id;


      const o =
        (
          by[studentId] ||=
          {
            strong: [],
            weak: [],
            needs: [],
            skipped: []
          }
        );


      const topicData = {

        topic:
          x.topic,

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

        percentage:
          percentage,

        status:
          status
      };


      if (
        status === 'STRONG'
      ) {

        o.strong.push(
          topicData
        );

      } else if (
        status === 'WEAK'
      ) {

        o.weak.push(
          topicData
        );

      } else if (
        status ===
        'NEEDS_IMPROVEMENT'
      ) {

        o.needs.push(
          topicData
        );

      } else if (
        status === 'SKIPPED'
      ) {

        o.skipped.push(
          topicData
        );
      }
    }


    /* --------------------------------------------------------
       VIOLATION INFORMATION
       
       Admin performance should also know:
       - total violations
       - violation types
       - submission reason
       - whether rules were violated
       -------------------------------------------------------- */

    const [violations] =
      await db.query(
        `SELECT

          a.id AS attempt_id,

          a.student_id,

          a.exam_id,

          a.submit_reason,

          a.violation_count,

          a.status,

          e.max_violations,

          v.violation_type,

          COUNT(v.id) AS type_count

         FROM exam_attempts a

         JOIN exams e
           ON e.id = a.exam_id

         LEFT JOIN violations v
           ON v.attempt_id = a.id

         GROUP BY

           a.id,
           a.student_id,
           a.exam_id,
           a.submit_reason,
           a.violation_count,
           a.status,
           e.max_violations,
           v.violation_type

         ORDER BY
           a.id DESC`
      );


    const violationByStudent =
      {};


    for (
      const v of violations
    ) {

      const studentId =
        v.student_id;


      const o =
        (
          violationByStudent[
            studentId
          ] ||=
          {
            total: 0,
            types: {},
            attempts: []
          }
        );


      const attemptId =
        v.attempt_id;


      let attempt =
        o.attempts.find(
          (x) =>
            x.attempt_id ===
            attemptId
        );


      if (!attempt) {

        attempt = {

          attempt_id:
            attemptId,

          exam_id:
            v.exam_id,

          submit_reason:
            v.submit_reason ||
            null,

          status:
            v.status,

          violation_count:
            Number(
              v.violation_count ||
              0
            ),

          max_violations:
            Number(
              v.max_violations ||
              0
            ),

          rules_violated:
            (
              v.submit_reason ===
              'VIOLATION'
            ) ||
            (
              Number(
                v.violation_count ||
                0
              ) >=
              Number(
                v.max_violations ||
                0
              ) &&
              Number(
                v.max_violations ||
                0
              ) > 0
            ),

          violation_summary: {}
        };


        o.attempts.push(
          attempt
        );
      }


      if (
        v.violation_type
      ) {

        const count =
          Number(
            v.type_count ||
            0
          );


        attempt
          .violation_summary[
            v.violation_type
          ] =
          count;


        o.total +=
          count;


        o.types[
          v.violation_type
        ] =
          (
            o.types[
              v.violation_type
            ] || 0
          ) + count;
      }
    }


    /* --------------------------------------------------------
       Add violation information to each student
       -------------------------------------------------------- */

    rows.forEach(
      (r) => {

        const topicData =
          by[r.id] ||
          {
            strong: [],
            weak: [],
            needs: [],
            skipped: []
          };


        const violationData =
          violationByStudent[
            r.id
          ] ||
          {
            total: 0,
            types: {},
            attempts: []
          };


        r.avg_marks =
          round(
            r.avg_marks
          );


        r.pct =
          round(
            r.pct
          );


        r.strong_topics =
          topicData.strong;


        r.weak_topics =
          topicData.weak;


        r.needs_topics =
          topicData.needs;


        r.skipped_topics =
          topicData.skipped;


        r.total_violations =
          violationData.total;


        r.violation_types =
          Object.keys(
            violationData.types
          );


        r.violation_summary =
          violationData.types;


        r.violation_attempts =
          violationData.attempts;


        r.rules_violated =
          violationData.attempts.some(
            (a) =>
              a.rules_violated
          );


        /*
         * A student with no submitted tests has no rank.
         */

        r.rank =
          r.tests > 0
            ? null
            : null;
      }
    );


    /* --------------------------------------------------------
       Rank students
       
       Rank is based on average percentage.
       -------------------------------------------------------- */

    const ranked =
      rows
        .filter(
          (r) =>
            Number(
              r.tests || 0
            ) > 0
        )
        .sort(
          (a, b) =>
            Number(
              b.pct || 0
            ) -
            Number(
              a.pct || 0
            )
        );


    ranked.forEach(
      (r, index) => {

        r.rank =
          index + 1;
      }
    );


    res.json(
      rows
    );
  }
);


/* ============================================================
   ADMIN STATISTICS
   ============================================================ */

exports.stats = wrap(
  async (req, res) => {

    const q =
      async (s) =>
        (
          await db.query(s)
        )[0];


    const [[c]] =
      await db.query(
        `SELECT

          (
            SELECT COUNT(*)
            FROM users
            WHERE role='TEACHER'
          ) AS teachers,

          (
            SELECT COUNT(*)
            FROM users
            WHERE role='STUDENT'
          ) AS students,

          (
            SELECT COUNT(*)
            FROM exams
          ) AS exams,

          (
            SELECT COUNT(*)
            FROM exam_attempts
            WHERE status='SUBMITTED'
          ) AS attempts,

          (
            SELECT COALESCE(
              AVG(percentage),
              0
            )
            FROM results
          ) AS avg_perf`
      );


    const studentPerf =
      await q(
        `SELECT

          u.user_code,

          u.name,

          AVG(
            r.percentage
          ) AS pct

         FROM results r

         JOIN users u
           ON u.id = r.student_id

         GROUP BY
           u.id,
           u.user_code,
           u.name

         ORDER BY
           pct DESC

         LIMIT 10`
      );


    const subjectPerf =
      await q(
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

         GROUP BY
           s.id,
           s.name

         ORDER BY
           s.name`
      );


    const participation =
      await q(
        `SELECT

          e.title,

          COUNT(a.id) AS attempts

         FROM exams e

         LEFT JOIN exam_attempts a
           ON a.exam_id = e.id
          AND a.status = 'SUBMITTED'

         GROUP BY
           e.id,
           e.title

         ORDER BY
           e.id DESC

         LIMIT 10`
      );


    const pcts =
      (
        await q(
          'SELECT percentage FROM results'
        )
      ).map(
        (x) =>
          x.percentage
      );


    res.json({

      ...c,

      avg_perf:
        round(
          c.avg_perf
        ),

      studentPerf,

      subjectPerf,

      participation,

      distribution:
        buckets(
          pcts
        )
    });
  }
);