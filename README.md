# AuraAssess - Online Exam Analytics System
**Assess. Analyze. Improve.**

Stack: HTML5, CSS3, Vanilla JS, Node.js, Express, MySQL (mysql2), Chart.js, bcryptjs, JWT.

## Run it (Windows, step by step)
1. **Install Node.js** (LTS 18+): https://nodejs.org - verify with `node -v`.
2. **Install MySQL Server** (8.x) and MySQL Workbench: https://dev.mysql.com/downloads/installer/ - remember the `root` password you set.
3. **Open the `AuraAssess` folder in VS Code** (File > Open Folder).
4. **Open a terminal** in VS Code (Terminal > New Terminal).
5. Run: `npm install`
6. **Create the database + 7. run schema.sql** - either in MySQL Workbench (File > Open SQL Script > `database/schema.sql` > lightning bolt), or in the terminal:
   `mysql -u root -p < database/schema.sql`
   (schema.sql creates `auraassess_db` itself. It drops/recreates tables, so run it only for a fresh setup.)
8. **Run seed.sql** the same way: `mysql -u root -p < database/seed.sql`
9. **Configure .env**: copy `.env.example` to `.env` (same folder) and set `DB_PASSWORD` to your MySQL root password and `JWT_SECRET` to any long random text:
   `copy .env.example .env`
10. Run: `npm start`
11. Open **http://localhost:5000** in Chrome or Edge.
12. Log in as **admin@123** / **admin**.

## Trying the whole flow
1. Admin: add teachers/students (or use the seeded T001, T002, S001-S005 - they have no password yet).
2. Log in as `T001` (no password): you are asked to create one. Open **My Exams** - "Python Fundamentals" (15 questions, 5 topics) is already published and assigned to all students.
3. Log in as `S001`, create a password, click **START EXAM**, allow camera, take the exam.
4. See the result page: score, topic analysis (Strong / Needs Improvement / Weak), charts, rank, trend. Teacher and admin dashboards fill with real data.

## Notes
- Charts use Chart.js from a CDN, so the browser needs internet access.
- Proctoring is browser-based (fullscreen, tab/focus, camera, and face detection where the browser's `FaceDetector` API exists - in Chrome it may need `chrome://flags/#enable-experimental-web-platform-features`). It is a practical academic feature, not system-level prevention. No images or biometric data are stored or uploaded. Set `REQUIRE_CAMERA = true` in `frontend/js/exam.js` to make the camera mandatory.
- 2 violations maximum: first = warning, second = auto-submit. Timer is validated on the server too.
- Forgot password: there is no email server, so the reset token is shown on screen (demo mode) and printed in the server terminal.
- Change the port with `PORT` in `.env`. If MySQL uses a different port/host set `DB_PORT` / `DB_HOST`.
- Troubleshooting: "Access denied" = wrong `DB_PASSWORD`; "Unknown database" = schema.sql not run; MySQL 8 error about `mysql` command not found = use Workbench to run the SQL files.

## Structure
`frontend/` pages, css, js, assets - `backend/` Express API (routes, controllers, middleware, config) - `database/` schema.sql, seed.sql - `uploads/profiles/` profile pictures.
