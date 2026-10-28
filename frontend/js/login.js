(function () {

  // ============================================================
  // INITIAL SETUP
  // ============================================================

  initEyes();

  $('#themeBtn').onclick = toggleTheme;

  applyTheme(document.documentElement.dataset.theme);


  // ============================================================
  // ROLE CONFIGURATION
  // ============================================================

  const ROLE_INFO = {

    ADMIN: {
      title: 'Admin Login',
      subtitle: 'Sign in to manage AuraAssess',
      label: 'Admin ID / Email',
      placeholder: 'Enter Admin ID or email',
      text: '👨‍💼 Admin'
    },

    TEACHER: {
      title: 'Teacher Login',
      subtitle: 'Sign in to manage exams and results',
      label: 'Teacher ID / Email',
      placeholder: 'Enter Teacher ID or email',
      text: '👨‍🏫 Teacher'
    },

    STUDENT: {
      title: 'Student Login',
      subtitle: 'Sign in to attend your exams',
      label: 'Student ID / Email',
      placeholder: 'Enter Student ID or email',
      text: '🎓 Student'
    }

  };


  let selectedRole = '';

  let ident = '';


  // ============================================================
  // ROLE SELECTION
  // ============================================================

  const roleButtons = $$('.role-card');

  roleButtons.forEach((button) => {

    button.onclick = () => {

      const role = button.dataset.role;

      selectRole(role);

    };

  });


  function selectRole(role) {

    if (!ROLE_INFO[role]) return;

    selectedRole = role;

    const info = ROLE_INFO[role];


    // Remove active state from all role buttons

    roleButtons.forEach((button) => {

      button.classList.toggle(
        'active',
        button.dataset.role === role
      );

    });


    // Update login text

    $('#loginTitle').textContent = info.title;

    $('#loginSubtitle').textContent = info.subtitle;

    $('#identifierLabel').textContent = info.label;

    $('#identifier').placeholder = info.placeholder;

    $('#selectedRoleText').textContent = info.text;


    // Update other screens

    $('#createRoleText').textContent =
      'Role: ' + info.text;

    $('#forgotRoleText').textContent =
      'Role: ' + info.text;

    $('#resetRoleText').textContent =
      'Role: ' + info.text;


    // Clear old values

    $('#identifier').value = '';

    $('#password').value = '';


    // Show login

    show('loginView');

  }


  // ============================================================
  // NAVIGATION
  // ============================================================

  const go = (role) => {

    location.href =
      ({
        ADMIN: 'admin.html',
        TEACHER: 'teacher.html',
        STUDENT: 'student.html'
      })[role] || 'login.html';

  };


  // ============================================================
  // AUTO REDIRECT IF ALREADY LOGGED IN
  // ============================================================

  if (store.token && store.user) {

    go(store.user.role);

    return;

  }


  // ============================================================
  // VIEWS
  // ============================================================

  const views = [
    'roleSelection',
    'loginView',
    'createView',
    'forgotView',
    'resetView'
  ];


  function show(view) {

    views.forEach((id) => {

      const element = $('#' + id);

      if (element) {

        element.hidden = id !== view;

      }

    });


    $('#msg').textContent = '';

  }


  // ============================================================
  // MESSAGE
  // ============================================================

  const msg = (text, ok) => {

    const m = $('#msg');

    m.textContent = text;

    m.className =
      'msg ' + (ok ? 'ok' : 'err');

  };


  // ============================================================
  // API POST HELPER
  // ============================================================

  const post = (path, body) =>
    api(path, {
      method: 'POST',
      body,
      noRedirect: true
    });


  // ============================================================
  // LOGIN
  // ============================================================

  $('#loginView').onsubmit = async (e) => {

    e.preventDefault();


    if (!selectedRole) {

      msg('Please select your role first.');

      return;

    }


    try {

      const d = await post(
        '/auth/login',
        {
          identifier:
            $('#identifier').value.trim(),

          password:
            $('#password').value,

          role:
            selectedRole
        }
      );


      // First-time user

      if (d.needsPassword) {

        ident = d.identifier;

        $('#cpIdent').textContent = ident;

        show('createView');

        msg(
          'Welcome! This is your first login. Please create your password.',
          true
        );

        return;

      }


      // Successful login

      store.set(
        d.token,
        d.user
      );


      go(d.user.role);

    }

    catch (err) {

      msg(err.message);

    }

  };


  // ============================================================
  // CREATE PASSWORD
  // ============================================================

  $('#createView').onsubmit = async (e) => {

    e.preventDefault();


    if (!selectedRole) {

      msg('Please select your role first.');

      return;

    }


    try {

      const d = await post(
        '/auth/create-password',
        {
          identifier: ident,

          role: selectedRole,

          newPassword:
            $('#newPw').value,

          confirmPassword:
            $('#confPw').value
        }
      );


      store.set(
        d.token,
        d.user
      );


      go(d.user.role);

    }

    catch (err) {

      msg(err.message);

    }

  };


  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  $('#forgotView').onsubmit = async (e) => {

    e.preventDefault();


    if (!selectedRole) {

      msg('Please select your role first.');

      return;

    }


    try {

      const d = await post(
        '/auth/forgot-password',
        {
          identifier:
            $('#fgIdent').value.trim(),

          role:
            selectedRole
        }
      );


      if (d.resetToken) {

        show('resetView');

        $('#resetToken').value =
          d.resetToken;

        msg(
          d.note +
          ' The token has been filled in for you.',
          true
        );

      }

      else {

        msg(d.message, true);

      }

    }

    catch (err) {

      msg(err.message);

    }

  };


  // ============================================================
  // RESET PASSWORD
  // ============================================================

  $('#resetView').onsubmit = async (e) => {

    e.preventDefault();


    if (!selectedRole) {

      msg('Please select your role first.');

      return;

    }


    try {

      const d = await post(
        '/auth/reset-password',
        {
          token:
            $('#resetToken').value.trim(),

          role:
            selectedRole,

          newPassword:
            $('#rsPw').value,

          confirmPassword:
            $('#rsConf').value
        }
      );


      show('loginView');

      $('#password').value = '';

      msg(
        d.message,
        true
      );

    }

    catch (err) {

      msg(err.message);

    }

  };


  // ============================================================
  // FORGOT PASSWORD BUTTON
  // ============================================================

  $('#toForgot').onclick = () => {

    if (!selectedRole) {

      msg('Please select your role first.');

      return;

    }


    $('#fgIdent').value =
      $('#identifier').value.trim();


    show('forgotView');

  };


  // ============================================================
  // RESET TOKEN BUTTON
  // ============================================================

  $('#toReset').onclick = () => {

    show('resetView');

  };


  // ============================================================
  // CHANGE ROLE
  // ============================================================

  $('#changeRole').onclick = () => {

    selectedRole = '';

    $('#identifier').value = '';

    $('#password').value = '';

    roleButtons.forEach((button) => {

      button.classList.remove('active');

    });

    show('roleSelection');

  };


  // ============================================================
  // BACK BUTTONS
  // ============================================================

  $('#createBack').onclick = () => {

    show('loginView');

  };


  $('#forgotBack').onclick = () => {

    show('loginView');

  };


  $('#resetBack').onclick = () => {

    show('loginView');

  };


  // ============================================================
  // TOKEN FROM URL
  // ============================================================

  const token =
    new URLSearchParams(location.search)
      .get('token');


  if (token) {

    /*
      If the reset link contains a token,
      the user must still choose their role.
      The token will be checked against that role
      by the backend.
    */

    $('#resetToken').value = token;

    show('roleSelection');

  }

})();