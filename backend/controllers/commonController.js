const db = require('../config/db');
const { wrap, bad, examRanking, overallBoard } = require('./helpers');

// Leaderboard shared by all roles. ?exam_id= for exam-specific, otherwise overall.
exports.leaderboard = wrap(async (req, res) => {
  const examId = Number(req.query.exam_id);
  if (!examId) return res.json({ scope: 'overall', me: req.user.id, rows: await overallBoard() });
  const [[e]] = await db.query('SELECT id, title, created_by FROM exams WHERE id = ?', [examId]);
  if (!e) return bad(res, 'Exam not found', 404);
  if (req.user.role === 'TEACHER' && e.created_by !== req.user.id) return bad(res, 'Not your exam', 403);
  if (req.user.role === 'STUDENT') {
    const [a] = await db.query("SELECT id FROM exam_attempts WHERE exam_id = ? AND student_id = ? AND status = 'SUBMITTED'", [examId, req.user.id]);
    if (!a.length) return bad(res, 'Complete this exam to view its leaderboard', 403);
  }
  res.json({ scope: 'exam', exam: { id: e.id, title: e.title }, me: req.user.id, rows: await examRanking(examId) });
});

exports.leaderboardExams = wrap(async (req, res) => {
  let sql = 'SELECT DISTINCT e.id, e.title FROM exams e JOIN results r ON r.exam_id = e.id'; const a = [];
  if (req.user.role === 'TEACHER') { sql += ' WHERE e.created_by = ?'; a.push(req.user.id); }
  if (req.user.role === 'STUDENT') { sql += ' WHERE EXISTS (SELECT 1 FROM results x WHERE x.exam_id = e.id AND x.student_id = ?)'; a.push(req.user.id); }
  const [rows] = await db.query(sql + ' ORDER BY e.title', a);
  res.json(rows);
});

exports.subjects = wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, name FROM subjects ORDER BY name');
  res.json(rows);
});
