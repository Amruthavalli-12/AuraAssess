USE auraassess_db;

-- Admin (login: admin@123 / admin). The placeholder is converted to a bcrypt hash by the server on start/first login.
INSERT INTO users (user_code, name, email, role, password_hash) VALUES
 ('ADMIN', 'System Admin', 'admin@123', 'ADMIN', '__ADMIN_DEFAULT__');

-- TAeachers and students are created WITHOUT passwords: they create one at first login.
INSERT INTO users (user_code, name, email, role) VALUES
 ('T001', 'Anita Sharma', 't001@auraassess.edu', 'TEACHER'),
 ('T002', 'Rahul Verma', 't002@auraassess.edu', 'TEACHER'),
 ('S001', 'Aarav Patel', 's001@auraassess.edu', 'STUDENT'),
 ('S002', 'Diya Nair', 's002@auraassess.edu', 'STUDENT'),
 ('S003', 'Karan Mehta', 's003@auraassess.edu', 'STUDENT'),
 ('S004', 'Sneha Reddy', 's004@auraassess.edu', 'STUDENT'),
 ('S005', 'Vikram Singh', 's005@auraassess.edu', 'STUDENT');

INSERT INTO profiles (user_id) SELECT id FROM users;

INSERT INTO subjects (name, description) VALUES
 ('Python', 'Python programming language'),
 ('Java', 'Java programming language'),
 ('C Programming', 'Procedural programming in C'),
 ('C++', 'Object oriented programming in C++'),
 ('Data Structures', 'Arrays, lists, trees, graphs'),
 ('DBMS', 'Database management systems'),
 ('Computer Networks', 'Networking concepts and protocols'),
 ('Operating Systems', 'Processes, memory, file systems'),
 ('Artificial Intelligence', 'Search, reasoning, agents'),
 ('Machine Learning', 'Supervised and unsupervised learning');

-- Sample exam: Python Fundamentals (created by T001, assigned to all students, published)
SET @t = (SELECT id FROM users WHERE user_code = 't001');
SET @s = (SELECT id FROM subjects WHERE name = 'Python');

INSERT INTO questions (subject_id, created_by, topic, question_text, option_a, option_b, option_c, option_d, correct_answer, marks) VALUES
 (@s,@t,'Python Basics','Who developed the Python programming language?','Guido van Rossum','James Gosling','Dennis Ritchie','Bjarne Stroustrup','A',1),
 (@s,@t,'Python Basics','Which file extension is used for Python source files?','.pyt','.py','.pt','.python','B',1),
 (@s,@t,'Python Basics','Which function prints output to the screen in Python 3?','echo()','printf()','print()','write()','C',1),
 (@s,@t,'Variables','Which is a valid variable name in Python?','2value','my-var','my_var','my var','C',1),
 (@s,@t,'Variables','What is the type of x in: x = 3.14 ?','int','float','str','double','B',1),
 (@s,@t,'Variables','Which keyword deletes a variable?','remove','delete','del','erase','C',1),
 (@s,@t,'Functions','Which keyword defines a function in Python?','function','def','define','fun','B',1),
 (@s,@t,'Functions','What does a function return if it has no return statement?','0','None','Empty string','Error','B',1),
 (@s,@t,'Functions','What is the output of len("abc")?','2','3','4','abc','B',1),
 (@s,@t,'Lists','Which method adds an item to the end of a list?','add()','insert_end()','append()','push()','C',1),
 (@s,@t,'Lists','What is the index of the first element of a list?','0','1','-1','None','A',1),
 (@s,@t,'Lists','What does [1,2,3][-1] return?','1','2','3','Error','C',1),
 (@s,@t,'Loops','Which loop iterates over a sequence in Python?','for','foreach','loop','repeat','A',1),
 (@s,@t,'Loops','Which keyword exits a loop immediately?','stop','exit','break','continue','C',1),
 (@s,@t,'Loops','How many times does range(3) iterate?','2','3','4','Infinite','B',1);

INSERT INTO exams (title, subject_id, created_by, description, duration_minutes, max_marks, start_date, end_date, is_published, assign_all)
VALUES ('Python Fundamentals', @s, @t, 'Basics, variables, functions, lists and loops.', 30, 15,
        DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 365 DAY), 1, 1);
SET @e = LAST_INSERT_ID();

INSERT INTO exam_questions (exam_id, question_id, position)
SELECT @e, id, id FROM questions WHERE created_by = @t;
