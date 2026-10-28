const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/db');
const { wrap, bad } = require('./helpers');

const DIR = path.join(__dirname, '../../uploads/profiles');
fs.mkdirSync(DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: DIR,
    filename: (req, file, cb) => cb(null, `u${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, GIF or WEBP images are allowed')))
}).single('photo');

const load = async (id) => (await db.query(
  `SELECT u.id, u.user_code, u.name, u.email, u.role, u.status, u.created_at, p.photo, p.phone, p.bio
   FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`, [id]))[0][0];

exports.get = wrap(async (req, res) => res.json(await load(req.user.id)));

exports.update = wrap(async (req, res) => {
  const cur = await load(req.user.id);
  const name = String(req.body.name ?? cur.name).trim(), email = String(req.body.email ?? cur.email).trim();
  if (!name || !email) return bad(res, 'Name and email are required');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email address');
  const [d] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, cur.id]);
  if (d.length) return bad(res, 'Email already used by another user', 409);
  await db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, cur.id]);
  await db.query('INSERT INTO profiles (user_id, phone, bio) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE phone = VALUES(phone), bio = VALUES(bio)',
    [cur.id, (req.body.phone || '').slice(0, 30) || null, (req.body.bio || '').slice(0, 500) || null]);
  res.json({ message: 'Profile updated', user: await load(cur.id) });
});

exports.photo = (req, res, next) => upload(req, res, async (err) => {
  try {
    if (err) return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller' : err.message);
    if (!req.file) return bad(res, 'Please choose an image');
    const old = (await load(req.user.id)).photo;
    const url = `/uploads/profiles/${req.file.filename}`;
    await db.query('INSERT INTO profiles (user_id, photo) VALUES (?, ?) ON DUPLICATE KEY UPDATE photo = VALUES(photo)', [req.user.id, url]);
    if (old) fs.unlink(path.join(DIR, path.basename(old)), () => {});
    res.json({ message: 'Profile photo updated', photo: url });
  } catch (e) { next(e); }
});

exports.password = wrap(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 6) return bad(res, 'New password must be at least 6 characters');
  if (newPassword !== confirmPassword) return bad(res, 'Passwords do not match');
  const [[u]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!u.password_hash || !(await bcrypt.compare(String(currentPassword || ''), u.password_hash))) return bad(res, 'Current password is incorrect', 401);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ message: 'Password changed' });
});

exports.notifications = wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, title, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20', [req.user.id]);
  res.json(rows);
});
