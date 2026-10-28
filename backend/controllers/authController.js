const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = require('../config/db');

const { sign } = require('../middleware/auth');

const { wrap, bad } = require('./helpers');


// ============================================================
// ALLOWED ROLES
// ============================================================

const ALLOWED_ROLES = [
  'ADMIN',
  'TEACHER',
  'STUDENT'
];


const normalizeRole = (role) => {

  const value =
    String(role || '')
      .trim()
      .toUpperCase();

  return ALLOWED_ROLES.includes(value)
    ? value
    : null;

};


// ============================================================
// FIND USER
// ============================================================

const findUser = async (id, role = null) => {

  let sql = `
    SELECT
      u.*,
      p.photo
    FROM users u
    LEFT JOIN profiles p
      ON p.user_id = u.id
    WHERE
      (
        u.user_code = ?
        OR u.email = ?
      )
  `;

  const params = [
    id,
    id
  ];


  /*
   * IMPORTANT:
   *
   * If a role is selected on the login page,
   * the database must match BOTH:
   *
   * 1. User ID / Email
   * 2. Selected Role
   *
   * Example:
   *
   * Selected ADMIN + Teacher account
   * = NO MATCH
   */

  if (role) {

    sql += `
      AND UPPER(TRIM(u.role)) = ?
    `;

    params.push(role);

  }


  sql += `
    LIMIT 1
  `;


  const [rows] =
    await db.query(
      sql,
      params
    );


  return rows[0];

};


// ============================================================
// PUBLIC USER OBJECT
// ============================================================

const pub = (u) => ({

  id: u.id,

  user_code: u.user_code,

  name: u.name,

  email: u.email,

  role: String(
    u.role || ''
  ).toUpperCase(),

  photo: u.photo || null

});


// ============================================================
// PASSWORD VALIDATION
// ============================================================

const checkPw = (
  password,
  confirmPassword
) => {

  if (
    typeof password !== 'string' ||
    password.length < 6
  ) {

    return 'Password must be at least 6 characters';

  }


  if (
    password !==
    confirmPassword
  ) {

    return 'Passwords do not match';

  }


  return null;

};


// ============================================================
// SHA-256
// ============================================================

const sha = (value) =>

  crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');


// ============================================================
// LOGIN
// ============================================================

exports.login = wrap(
  async (req, res) => {

    const {
      identifier,
      password,
      role
    } = req.body || {};


    // --------------------------------------------------------
    // VALIDATE IDENTIFIER
    // --------------------------------------------------------

    if (
      !identifier ||
      !String(identifier).trim()
    ) {

      return bad(
        res,
        'User ID / Email is required'
      );

    }


    // --------------------------------------------------------
    // VALIDATE SELECTED ROLE
    // --------------------------------------------------------

    const selectedRole =
      normalizeRole(role);


    if (!selectedRole) {

      return bad(
        res,
        'Please select a valid login role'
      );

    }


    // --------------------------------------------------------
    // FIND USER BY IDENTIFIER + SELECTED ROLE
    // --------------------------------------------------------

    const u =
      await findUser(
        String(identifier).trim(),
        selectedRole
      );


    /*
     * If the identifier belongs to another role,
     * findUser() will return nothing.
     *
     * Example:
     *
     * Database:
     * teacher01 -> TEACHER
     *
     * Login selection:
     * ADMIN
     *
     * Result:
     * No matching ADMIN account
     */

    if (!u) {

      return bad(
        res,
        `Invalid ${selectedRole.toLowerCase()} credentials`,
        401
      );

    }


    // --------------------------------------------------------
    // EXTRA ROLE SAFETY CHECK
    // --------------------------------------------------------
    //
    // This is intentionally checked AGAIN after retrieving
    // the user.
    //
    // This guarantees that a token cannot be issued when
    // the selected role and actual database role differ.
    //

    const actualRole =
      String(
        u.role || ''
      )
        .trim()
        .toUpperCase();


    if (
      actualRole !==
      selectedRole
    ) {

      return bad(
        res,
        `This account is registered as ${actualRole.toLowerCase()}, not ${selectedRole.toLowerCase()}`,
        403
      );

    }


    // --------------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------------

    if (
      u.status !== 'active'
    ) {

      return bad(
        res,
        'Your account is deactivated. Please contact the admin.',
        403
      );

    }


    // ========================================================
    // ADMIN DEFAULT PASSWORD
    // ========================================================

    if (
      selectedRole === 'ADMIN' &&
      u.password_hash === '__ADMIN_DEFAULT__'
    ) {

      u.password_hash =
        await bcrypt.hash(
          'admin',
          10
        );


      await db.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [
          u.password_hash,
          u.id
        ]
      );

    }


    // ========================================================
    // FIRST-TIME TEACHER / STUDENT LOGIN
    // ========================================================

    if (
      !u.password_hash
    ) {

      return res.json({

        needsPassword: true,

        identifier:
          u.user_code,

        role:
          actualRole

      });

    }


    // ========================================================
    // PASSWORD CHECK
    // ========================================================

    if (
      !password ||
      !(
        await bcrypt.compare(
          String(password),
          u.password_hash
        )
      )
    ) {

      return bad(
        res,
        `Invalid ${selectedRole.toLowerCase()} credentials`,
        401
      );

    }


    // ========================================================
    // FINAL ROLE CHECK BEFORE TOKEN
    // ========================================================
    //
    // Never issue a token if the role does not match.
    //

    if (
      actualRole !==
      selectedRole
    ) {

      return bad(
        res,
        'Login role does not match this account',
        403
      );

    }


    // ========================================================
    // SUCCESS
    // ========================================================

    res.json({

      token:
        sign({
          ...u,
          role: actualRole
        }),

      user:
        pub({
          ...u,
          role: actualRole
        })

    });

  }
);


// ============================================================
// CREATE PASSWORD
// ============================================================

exports.createPassword = wrap(
  async (req, res) => {

    const {
      identifier,
      role,
      newPassword,
      confirmPassword
    } = req.body || {};


    // --------------------------------------------------------
    // VALIDATE PASSWORD
    // --------------------------------------------------------

    const err =
      checkPw(
        newPassword,
        confirmPassword
      );


    if (err) {

      return bad(
        res,
        err
      );

    }


    // --------------------------------------------------------
    // VALIDATE ROLE
    // --------------------------------------------------------

    const selectedRole =
      normalizeRole(role);


    if (!selectedRole) {

      return bad(
        res,
        'Please select a valid login role'
      );

    }


    // --------------------------------------------------------
    // FIND ACCOUNT BY IDENTIFIER + ROLE
    // --------------------------------------------------------

    const u =
      await findUser(
        String(
          identifier || ''
        ).trim(),
        selectedRole
      );


    if (
      !u ||
      u.status !== 'active'
    ) {

      return bad(
        res,
        `Invalid ${selectedRole.toLowerCase()} account`,
        404
      );

    }


    // --------------------------------------------------------
    // EXTRA ROLE CHECK
    // --------------------------------------------------------

    const actualRole =
      String(
        u.role || ''
      )
        .trim()
        .toUpperCase();


    if (
      actualRole !==
      selectedRole
    ) {

      return bad(
        res,
        `This account is registered as ${actualRole.toLowerCase()}, not ${selectedRole.toLowerCase()}`,
        403
      );

    }


    // --------------------------------------------------------
    // PASSWORD ALREADY EXISTS
    // --------------------------------------------------------

    if (
      u.password_hash
    ) {

      return bad(
        res,
        'Password already set. Please log in or use Forgot Password.',
        409
      );

    }


    // --------------------------------------------------------
    // SAVE PASSWORD
    // --------------------------------------------------------

    const hash =
      await bcrypt.hash(
        newPassword,
        10
      );


    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [
        hash,
        u.id
      ]
    );


    // --------------------------------------------------------
    // RETURN LOGIN TOKEN
    // --------------------------------------------------------

    res.json({

      token:
        sign({
          ...u,
          role: actualRole
        }),

      user:
        pub({
          ...u,
          role: actualRole
        }),

      message:
        'Password created'

    });

  }
);


// ============================================================
// FORGOT PASSWORD
// ============================================================

exports.forgot = wrap(
  async (req, res) => {

    const {
      identifier,
      role
    } = req.body || {};


    if (!identifier) {

      return bad(
        res,
        'User ID / Email is required'
      );

    }


    // --------------------------------------------------------
    // VALIDATE ROLE
    // --------------------------------------------------------

    const selectedRole =
      normalizeRole(role);


    if (!selectedRole) {

      return bad(
        res,
        'Please select a valid login role'
      );

    }


    // --------------------------------------------------------
    // FIND ACCOUNT BY IDENTIFIER + ROLE
    // --------------------------------------------------------

    const u =
      await findUser(
        String(
          identifier
        ).trim(),
        selectedRole
      );


    const out = {

      message:
        'If the account exists, a reset token has been generated.'

    };


    if (
      u &&
      u.status === 'active'
    ) {

      // ------------------------------------------------------
      // EXTRA ROLE CHECK
      // ------------------------------------------------------

      const actualRole =
        String(
          u.role || ''
        )
          .trim()
          .toUpperCase();


      if (
        actualRole !==
        selectedRole
      ) {

        return bad(
          res,
          `This account is registered as ${actualRole.toLowerCase()}, not ${selectedRole.toLowerCase()}`,
          403
        );

      }


      // ------------------------------------------------------
      // NO PASSWORD YET
      // ------------------------------------------------------

      if (
        !u.password_hash
      ) {

        return res.json({

          message:
            'This account has no password yet. Log in with your ID to create one.'

        });

      }


      // ------------------------------------------------------
      // GENERATE TOKEN
      // ------------------------------------------------------

      const token =
        crypto.randomBytes(
          24
        ).toString('hex');


      await db.query(
        `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
        [
          u.id,

          sha(token),

          new Date(
            Date.now() +
            30 * 60000
          )

        ]
      );


      console.log(
        `[AuraAssess] Password reset token for ${u.user_code}: ${token}`
      );


      // Academic project demo:
      // token is returned instead of emailed.

      out.resetToken =
        token;

      out.note =
        'Demo mode: no email server configured, so the token is shown here (valid 30 minutes).';

    }


    res.json(
      out
    );

  }
);


// ============================================================
// RESET PASSWORD
// ============================================================

exports.reset = wrap(
  async (req, res) => {

    const {
      token,
      role,
      newPassword,
      confirmPassword
    } = req.body || {};


    // --------------------------------------------------------
    // VALIDATE PASSWORD
    // --------------------------------------------------------

    const err =
      checkPw(
        newPassword,
        confirmPassword
      );


    if (err) {

      return bad(
        res,
        err
      );

    }


    if (!token) {

      return bad(
        res,
        'Reset token is required'
      );

    }


    // --------------------------------------------------------
    // VALIDATE ROLE
    // --------------------------------------------------------

    const selectedRole =
      normalizeRole(role);


    if (!selectedRole) {

      return bad(
        res,
        'Please select a valid login role'
      );

    }


    // --------------------------------------------------------
    // FIND VALID RESET TOKEN
    // --------------------------------------------------------

    const [rows] =
      await db.query(
        `SELECT
            prt.*,
            u.role,
            u.status
         FROM password_reset_tokens prt
         JOIN users u
           ON u.id = prt.user_id
         WHERE
            prt.token_hash = ?
            AND prt.used = 0
            AND prt.expires_at > ?
         LIMIT 1`,
        [
          sha(
            String(token).trim()
          ),

          new Date()

        ]
      );


    if (!rows[0]) {

      return bad(
        res,
        'Invalid or expired reset token',
        400
      );

    }


    // --------------------------------------------------------
    // ROLE CHECK
    // --------------------------------------------------------

    const actualRole =
      String(
        rows[0].role || ''
      )
        .trim()
        .toUpperCase();


    if (
      actualRole !==
      selectedRole
    ) {

      return bad(
        res,
        `This reset token belongs to a ${actualRole.toLowerCase()} account, not a ${selectedRole.toLowerCase()} account`,
        403
      );

    }


    // --------------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------------

    if (
      rows[0].status !== 'active'
    ) {

      return bad(
        res,
        'Account is inactive',
        403
      );

    }


    // --------------------------------------------------------
    // UPDATE PASSWORD
    // --------------------------------------------------------

    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [
        await bcrypt.hash(
          newPassword,
          10
        ),

        rows[0].user_id

      ]
    );


    // --------------------------------------------------------
    // MARK RESET TOKENS AS USED
    // --------------------------------------------------------

    await db.query(
      'UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?',
      [
        rows[0].user_id
      ]
    );


    res.json({

      message:
        'Password reset successful. You can now log in.'

    });

  }
);


// ============================================================
// LOGOUT
// ============================================================

exports.logout = (
  req,
  res
) => {

  res.json({

    message:
      'Logged out'

  });

};