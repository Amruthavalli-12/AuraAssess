const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const { auth, role } = require('./middleware/auth');
const common = require('./controllers/commonController');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', auth, role('ADMIN'), require('./routes/admin'));
app.use('/api/teacher', auth, role('TEACHER'), require('./routes/teacher'));
app.use('/api/student', auth, role('STUDENT'), require('./routes/student'));
app.use('/api/profile', auth, require('./routes/profile'));
app.get('/api/subjects', auth, common.subjects);
app.get('/api/leaderboard', auth, common.leaderboard);
app.get('/api/leaderboard/exams', auth, common.leaderboardExams);
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate entry: that value already exists' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'This item is in use and cannot be deleted' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Server error. Check the terminal for details.' });
});

const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await db.query('SELECT 1');
    // Turn the seeded admin placeholder into a real bcrypt hash of the default password
    await db.query("UPDATE users SET password_hash = ? WHERE password_hash = '__ADMIN_DEFAULT__'", [await bcrypt.hash('admin', 10)]);
  } catch (e) {
    console.error('\n[AuraAssess] Could not connect to MySQL / find auraassess_db:', e.message);
    console.error('Check DB_* values in .env, and that schema.sql and seed.sql were run. See README.md.\n');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) console.warn('[AuraAssess] JWT_SECRET not set in .env - using an insecure development secret.');
  app.listen(PORT, () => console.log(`\nAuraAssess running:  http://localhost:${PORT}\nLogin as admin:      admin@123 / admin\n`));
})();
