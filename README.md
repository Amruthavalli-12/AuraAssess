# ⭐ AuraAssess — Smart Exam Analytics

## 🚀 Overview

**AuraAssess** is a secure online examination and student performance analysis platform designed to conduct online exams, automatically evaluate student answers, and provide meaningful performance analytics.

The system connects:

**Secure Examination → Automatic Evaluation → Performance Analysis → Ranking → Reports**

AuraAssess provides separate modules for **Admin, Faculty, and Student** users. It also includes basic proctoring features such as fullscreen monitoring, tab-switch detection, camera monitoring, face detection, and violation tracking.

---

## 🎯 Objectives

- Conduct secure online examinations.
- Provide separate Admin, Faculty, and Student modules.
- Allow Faculty to create and manage exams.
- Maintain a question bank with topic-wise questions.
- Assign exams to students.
- Automatically evaluate submitted answers.
- Calculate marks, percentage, correct, wrong, and unanswered questions.
- Identify strong and weak topics.
- Analyze student performance trends.
- Provide rankings and leaderboards.
- Track suspicious examination activities.
- Generate meaningful performance reports.

---

## 🔍 Problem Statement

Traditional online examination systems mainly focus on conducting tests and generating scores.

However:

- Results from different examinations are often viewed separately.
- Repeated weak topics may not be clearly identified.
- Student improvement or performance decline may be difficult to analyze.
- Online examinations can face tab switching and unauthorized activity.
- Teachers need a centralized platform to monitor student performance.

AuraAssess addresses these problems by combining **secure online examinations, automatic evaluation, performance analytics, ranking, and reporting** in one platform.

---

## 💡 Proposed System

AuraAssess provides a centralized platform for:

### Secure Exam
Students attend assigned online examinations with timer and basic proctoring.

### Automatic Evaluation
Student answers are automatically evaluated after submission.

### Performance Analysis
The system analyzes marks, percentage, topic performance, strengths, weaknesses, and trends.

### Ranking
Students can be ranked based on examination performance.

### Reports
Faculty and administrators can view student results and performance information.

---

# 👥 User Modules

## 👨‍💼 Admin Module

The Admin manages the overall system.

### Features

- Admin login.
- Manage Faculty accounts.
- Manage Student accounts.
- Add new Faculty.
- Add new Students.
- Manage subjects.
- View student performance.
- View student rankings.
- Monitor examination information.
- View system-level analytics.

---

## 👩‍🏫 Faculty Module

Faculty members manage examinations and evaluate student performance.

### Features

- Faculty login.
- Create examinations.
- Edit and manage examinations.
- Create questions.
- Maintain question bank.
- Add topic-wise questions.
- Define correct answers and marks.
- Assign examinations to students.
- View examination results.
- View student rankings.
- Analyze topic-wise performance.
- Generate performance reports.

---

## 👨‍🎓 Student Module

Students can attend assigned examinations and monitor their performance.

### Features

- Student login.
- View assigned examinations.
- View examination details.
- Start examination.
- Timer-based examination.
- Navigate between questions.
- Answer MCQ questions.
- Submit examination.
- Automatic evaluation.
- View marks and percentage.
- View correct, wrong, and unanswered questions.
- View topic-wise performance.
- View strong and weak topics.
- View performance trends.
- View leaderboard and ranking.

---

# 🛡️ Proctoring Module

AuraAssess includes basic examination monitoring features.

### Features

- Fullscreen monitoring.
- Tab-switch detection.
- Camera monitoring.
- Face detection.
- Violation tracking.
- Violation count.
- Automatic submission when configured violation limits are reached.

### Violation Types

- `TAB_SWITCH`
- `FULLSCREEN_EXIT`
- `FACE_NOT_DETECTED`
- `MULTIPLE_FACE_DETECTED`

The system records examination violations and associates them with the student's examination attempt.

---

# 📊 Analytics Module

The Analytics module helps understand student performance beyond simple marks.

### Topic-Wise Analysis

Topics are classified as:

| Percentage | Status |
|---|---|
| 80% and above | 🟢 Strong |
| 50% – 79% | 🟠 Needs Improvement |
| Below 50% | 🔴 Weak |
| No answered questions | ⚪ Skipped |

Skipped questions are not treated as incorrect answers for topic-performance classification.

If all questions belonging to a topic are skipped, the topic is shown as **Skipped**.

---

## 📈 Performance Analysis

AuraAssess provides:

- Overall performance.
- Topic-wise performance.
- Subject-wise performance.
- Performance trends.
- Strong topics.
- Weak topics.
- Topics needing improvement.
- Examination rankings.
- Overall leaderboard.

---

# 🏆 Ranking and Leaderboard

The system provides ranking information based on student examination performance.

Faculty can view examination-wise rankings, while students can view leaderboard information.

Ranking considers examination performance and helps compare student results.

---

# 🗄️ Database

AuraAssess uses **MySQL** for storing system information.

### Main Database

```text
auraassess_db
```

### Main Tables

```text
users
subjects
exams
questions
exam_questions
exam_assignments
exam_attempts
student_answers
results
topic_performance
violations
password_reset_tokens
profiles
notifications
```

The database stores:

- User information.
- Roles.
- Subjects.
- Examinations.
- Questions.
- Exam assignments.
- Student answers.
- Examination attempts.
- Results.
- Topic performance.
- Violations.
- Profiles.
- Notifications.

---

# 🏗️ System Architecture

The system follows a client-server architecture.

```text
                    ┌─────────────────────┐
                    │       Student       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │      Frontend       │
                    │ HTML / CSS / JS     │
                    └──────────┬──────────┘
                               │
                         REST API
                               │
                    ┌──────────▼──────────┐
                    │       Backend       │
                    │ Node.js + Express   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │       MySQL         │
                    │   auraassess_db     │
                    └─────────────────────┘
```

---

# 🛠️ Technologies Used

## Frontend

- HTML5
- CSS3
- JavaScript
- Chart.js
- Responsive UI

## Backend

- Node.js
- Express.js
- REST APIs
- JWT Authentication
- bcrypt Password Hashing

## Database

- MySQL

## Development Tools

- Visual Studio Code
- MySQL Server
- MySQL Workbench
- Git
- GitHub
- Postman

## Browser APIs

- Fullscreen API
- Camera / MediaDevices API

---

# 🔐 Security Features

AuraAssess includes several security mechanisms:

- Role-based authentication.
- Separate Admin, Faculty, and Student login.
- Password hashing using bcrypt.
- JWT-based authentication.
- Protected API routes.
- Role-based authorization.
- Parameterized SQL queries.
- Environment variables for sensitive configuration.
- Password creation for first-time users.
- Forgot-password and reset-password functionality.
- Examination violation tracking.
- Fullscreen monitoring.
- Tab-switch detection.
- Camera monitoring.

---

# 📁 Project Structure

```text
AuraAssess/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   └── server.js
│
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   ├── teacher.html
│   ├── student.html
│   ├── exam.html
│   ├── results.html
│   ├── analytics.html
│   ├── leaderboard.html
│   └── profile.html
│
├── database/
│   ├── schema.sql
│   └── seed.sql
│
├── uploads/
│   └── profiles/
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

# ⚙️ System Requirements

## Software Requirements

- Windows / Linux
- Node.js
- npm
- MySQL Server
- Visual Studio Code
- Modern web browser
- Git / GitHub

## Hardware Requirements

- Intel Core i3 or equivalent processor
- Minimum 4 GB RAM
- At least 10 GB free storage
- Webcam for proctoring features
- Microphone if required
- LAN / Wi-Fi connection

---

# 🚀 Installation and Setup

## 1. Clone the Repository

```bash
git clone https://github.com/Amruthavalli-12/AuraAssess.git
```

Move into the project:

```bash
cd AuraAssess
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create the `.env` file from the example:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

Open the file:

```powershell
notepad .env
```

Configure your MySQL database and application settings.

Example:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=auraassess_db

JWT_SECRET=your_secret_key
```

> ⚠️ Never upload `.env` to GitHub.

---

# 🗄️ Database Setup

Make sure MySQL Server is running.

Create the database and tables using:

```bash
mysql -u root -p < database/schema.sql
```

Then load the initial data:

```bash
mysql -u root -p < database/seed.sql
```

For Windows MySQL installations, you can also use MySQL Workbench to execute:

```text
database/schema.sql
database/seed.sql
```

---

# ▶️ Run the Application

Start the backend server:

```bash
npm start
```

The application runs at:

```text
http://localhost:5000
```

Open the URL in a browser.

---

# 🔑 Default Admin Login

The seeded system provides the default administrator account:

```text
User ID:
admin@123

Password:
admin
```

> For a deployed/production environment, change default credentials immediately.

---

# 🔄 Application Workflow

```text
Admin
  │
  ├── Create Faculty
  ├── Create Students
  └── Manage Subjects
          │
          ▼
       Faculty
          │
          ├── Create Exam
          ├── Add Questions
          ├── Assign Exam
          └── View Results
                  │
                  ▼
               Student
                  │
                  ├── Attend Exam
                  ├── Answer Questions
                  ├── Submit Exam
                  └── View Results
                          │
                          ▼
                    Analytics
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
         Topics        Trends       Ranking
```

---

# 🧪 Testing

The system can be tested for:

### Authentication

- Valid login.
- Invalid login.
- Role mismatch.
- First-time password creation.
- Forgot password.
- Password reset.

### Examination

- Exam creation.
- Question creation.
- Exam assignment.
- Exam start.
- Timer.
- Question navigation.
- Answer submission.
- Manual submission.
- Automatic submission.

### Proctoring

- Tab switching.
- Fullscreen exit.
- Camera availability.
- Face detection.
- Multiple-face detection.
- Violation counting.
- Maximum violation handling.

### Results

- Marks calculation.
- Percentage calculation.
- Correct answers.
- Wrong answers.
- Unanswered questions.
- Topic classification.
- Ranking.
- Performance trends.

---

# 📐 UML Design

The Smart Exam Analytics system is designed using Object-Oriented Analysis and Design principles.

The project documentation includes:

- Class Diagram
- Object Diagram
- Domain Class Diagram
- Sequence Diagram
- Detailed Sequence Diagram
- High-Level Sequence Diagram
- Activity Diagram
- State Chart Diagram
- Use Case Diagram
- Communication Diagram
- Component Diagram
- Deployment Diagram

These diagrams describe the system structure, interactions, workflows, components, and deployment architecture.

---

# 🔄 Development Methodology

The project follows the development flow:

```text
Requirement Analysis
        ↓
OOAD & UML Design
        ↓
Frontend & Backend Development
        ↓
Database Integration
        ↓
Testing & Integration
        ↓
Final Deployment
```

### Requirement Analysis

Identify:

- User roles.
- Examination requirements.
- Security requirements.
- Analytics requirements.

### OOAD & UML Design

Model the system using UML diagrams such as:

- Use Case
- Class
- Sequence
- Activity
- State
- Component
- Deployment

### System Development

Develop the frontend, backend APIs, authentication, examination flow, evaluation, and analytics.

### Database Integration

Store:

- Users
- Exams
- Questions
- Answers
- Results
- Performance data
- Violations

### Testing and Integration

Test:

- Authentication.
- APIs.
- Examination flow.
- Automatic evaluation.
- Analytics.
- Proctoring features.

### Deployment

Integrate all modules into the complete AuraAssess Smart Exam Analytics platform.

---

# 📊 Key Features at a Glance

| Feature | Available |
|---|---|
| Admin Module | ✅ |
| Faculty Module | ✅ |
| Student Module | ✅ |
| User Management | ✅ |
| Subject Management | ✅ |
| Question Bank | ✅ |
| Exam Creation | ✅ |
| Exam Assignment | ✅ |
| Online Examination | ✅ |
| Timer | ✅ |
| Automatic Evaluation | ✅ |
| Results | ✅ |
| Topic Analytics | ✅ |
| Performance Trends | ✅ |
| Ranking | ✅ |
| Leaderboard | ✅ |
| Fullscreen Monitoring | ✅ |
| Tab-Switch Detection | ✅ |
| Camera Monitoring | ✅ |
| Face Detection | ✅ |
| Violation Tracking | ✅ |
| MySQL Database | ✅ |
| REST APIs | ✅ |
| Role-Based Authentication | ✅ |

---

# 🌟 Advantages

- Centralized examination management.
- Automatic result calculation.
- Reduced manual evaluation effort.
- Topic-wise performance analysis.
- Identification of strong and weak areas.
- Performance trend analysis.
- Ranking and leaderboard support.
- Basic online exam security.
- Role-based access.
- Structured database management.
- Improved transparency and efficiency.

---

# 🔮 Future Enhancements

The system can be further enhanced with:

- Advanced AI-based proctoring.
- Improved face-recognition accuracy.
- Emotion and attention analysis.
- Voice-based suspicious activity detection.
- AI-generated question recommendations.
- Adaptive examinations.
- Predictive student performance analysis.
- Email and SMS notifications.
- Cloud deployment.
- Mobile application.
- Advanced teacher dashboards.
- AI-based personalized learning recommendations.

---

# 🎓 Academic Project

**Project Title:** Smart Exam Analytics / AuraAssess

**Domain:** Online Examination and Student Performance Analytics

**Department:** Artificial Intelligence and Machine Learning

**Batch:** 2024–2028

### Team Members

- **M. Amruthavalli Supriya** — 24B11AI239
- **M. Padmavathi** — 24B11AI276
- **N. Nikil Varma** — 24B11AI201
- **K. Akshay** — 24B11AI210

### Guide

**Mrs. S. Vijaya Nirmala**

---

# 👩‍💻 Team Contribution

The project is collaboratively developed by the team members as an Object-Oriented Analysis and Design project.

The work covers:

- Requirement analysis.
- UML modelling.
- Frontend development.
- Backend development.
- Database integration.
- Examination management.
- Performance analytics.
- Testing and integration.
- Documentation.

---

# 🏁 Conclusion

AuraAssess provides a secure and efficient platform for conducting online examinations and analyzing student performance.

The system automates:

**Exam Conduct → Evaluation → Results → Analytics → Ranking**

It helps teachers understand student performance through topic-wise analysis, trends, rankings, and reports. Students can identify their strengths and weaknesses and track their progress over time.

Overall, AuraAssess provides a centralized and intelligent solution for modern examination management.

---

## ⭐ Project Highlights

> **Assess. Analyze. Improve.**

**AuraAssess — Smarter exams. Deeper insight.**

---

## 📜 License

This project is developed for academic and educational purposes.
