const jwt = require('jsonwebtoken');
const db = require('../config/db');

const secret = () => process.env.JWT_SECRET || 'auraassess_dev_secret_change_me';
const sign = (u) => jwt.sign({ id: u.id, role: u.role, code: u.user_code }, secret(), { expiresIn: '8h' });

async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    let payload;
    try { payload = jwt.verify(token, secret()); }
    catch (e) { return res.status(401).json({ error: 'Invalid or expired token' }); }
    const [rows] = await db.query('SELECT id, role, status, user_code, name FROM users WHERE id = ?', [payload.id]);
    if (!rows[0] || rows[0].status !== 'active') return res.status(401).json({ error: 'Account inactive or removed' });
    req.user = { id: rows[0].id, role: rows[0].role, code: rows[0].user_code, name: rows[0].name };
    next();
  } catch (e) { next(e); }
}

const role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Access denied for your role' });

module.exports = { sign, auth, role };
