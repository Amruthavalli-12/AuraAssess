const db = require('../config/db');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
// 80%+ STRONG, 50-79 NEEDS_IMPROVEMENT, <50 WEAK
const classify = (p) => (p >= 80 ? 'STRONG' : p >= 50 ? 'NEEDS_IMPROVEMENT' : 'WEAK');

function buckets(percents) {
  const b = [0, 0, 0, 0, 0];
  percents.forEach((p) => { b[Math.min(4, Math.floor(Math.max(0, p - 0.0001) / 20))]++; });
  return { labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'], data: b };
}

async function examRanking(examId) {
  const [rows] = await db.query(
    `SELECT r.attempt_id, u.id AS student_id, u.user_code, u.name, r.obtained_marks AS marks, r.max_marks,
            r.percentage, r.correct_count, r.wrong_count, r.unanswered_count, r.total_questions,
            r.time_taken_seconds, r.created_at AS submitted_at,
            (SELECT a.violation_count FROM exam_attempts a WHERE a.id = r.attempt_id) AS violations
     FROM results r JOIN users u ON u.id = r.student_id
     WHERE r.exam_id = ? ORDER BY r.obtained_marks DESC, r.time_taken_seconds ASC`, [examId]);
  rows.forEach((r) => { r.rank = 1 + rows.filter((x) => x.marks > r.marks).length; });
  return rows;
}

async function overallBoard() {
  const [rows] = await db.query(
    `SELECT u.id AS student_id, u.user_code, u.name, COUNT(r.id) AS tests, SUM(r.obtained_marks) AS marks,
            SUM(r.max_marks) AS max_marks, AVG(r.percentage) AS avg_pct
     FROM users u JOIN results r ON r.student_id = u.id
     WHERE u.role = 'STUDENT' GROUP BY u.id, u.user_code, u.name
     ORDER BY avg_pct DESC, marks DESC`);
  rows.forEach((r) => { r.percentage = round(r.avg_pct); delete r.avg_pct; });
  rows.forEach((r) => { r.rank = 1 + rows.filter((x) => x.percentage > r.percentage).length; });
  return rows;
}

module.exports = { wrap, bad, round, classify, buckets, examRanking, overallBoard };
