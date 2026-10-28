(function () {
  const U = store.user;

  if (!store.token || !U || U.role !== 'STUDENT') {
    location.href = 'login.html';
    return;
  }

  const id =
    new URLSearchParams(location.search).get('id');

  if (!id) {
    location.href = 'student.html';
    return;
  }

  /*
   * Set true if the camera must be available
   * before the student can start the exam.
   */
  const REQUIRE_CAMERA = false;

  let MAXV = 0;

  const S = {
    q: [],
    ans: {},
    visited: new Set(),
    cur: 0,
    endAt: 0,
    violations: 0,
    violationTypes: [],
    running: false,
    done: false,
    submitting: false,
    stream: null,
    lastV: 0
  };


  /* ============================================================
     BASIC PAGE SETUP
     ============================================================ */

  $('#brandLink').href = 'student.html';

  $('#hStudent').textContent =
    U.name + ' (' + U.user_code + ')';

  $('#themeBtn').onclick = toggleTheme;

  applyTheme(
    document.documentElement.dataset.theme
  );


  /* ============================================================
     OVERLAY
     ============================================================ */

  const overlay = (html) => {

    $('#overlayCard').innerHTML = html;

    $('#overlay').hidden = false;

  };


  const hideOverlay = () => {

    $('#overlay').hidden = true;

  };


  const inFs = () =>
    !!document.fullscreenElement;


  const goResult = (aid) => {

    location.href =
      'results.html?attempt=' + aid;

  };


  /* ============================================================
     INTRO / PRE-EXAM CHECKS
     ============================================================ */

  async function init() {

    try {

      const e =
        await api('/student/exams/' + id);


      $('#hTitle').textContent =
        e.title;


      MAXV =
        Number(e.max_violations || 0);


      /*
       * If already completed,
       * directly open result.
       */
      if (e.status === 'COMPLETED') {

        return goResult(
          e.attempt_id
        );

      }


      const can =
        ['AVAILABLE', 'IN_PROGRESS']
          .includes(e.status);


      $('#timer').textContent =
        String(e.duration_minutes)
          .padStart(2, '0') + ':00';


      /*
       * Dynamic violation rule text.
       *
       * We do NOT hard-code:
       * "Second violation..."
       *
       * because maximum violations
       * may be different for different exams.
       */
      const violationRuleText =
        MAXV > 0

          ? `
            <li>
              <b>
                Violations are monitored.
                Maximum allowed violations:
                ${MAXV}.
              </b>
            </li>

            <li>
              <b>
                Reaching the maximum allowed
                violation limit (${MAXV})
                will automatically submit the exam.
              </b>
            </li>
          `

          : `
            <li>
              <b>
                Violations are monitored during
                the exam.
              </b>
            </li>
          `;


      $('#introCard').innerHTML = `

        <h2>
          ${esc(e.title)}
        </h2>

        <p class="muted">
          ${esc(e.description || '')}
        </p>


        <div
          class="grid stats"
          style="margin:14px 0"
        >

          <div class="card">

            <b>
              ${esc(e.subject)}
            </b>

            <br>

            <small class="muted">
              Subject
            </small>

          </div>


          <div class="card">

            <b>
              ${e.duration_minutes} min
            </b>

            <br>

            <small class="muted">
              Duration
            </small>

          </div>


          <div class="card">

            <b>
              ${e.question_count}
            </b>

            <br>

            <small class="muted">
              Questions
            </small>

          </div>


          <div class="card">

            <b>
              ${e.max_marks}
            </b>

            <br>

            <small class="muted">
              Max marks
            </small>

          </div>

        </div>


        <ul>

          ${violationRuleText}

          <li>
            When the timer reaches
            <b>00:00</b>,
            the exam is submitted automatically.
          </li>

          <li>
            Unanswered questions are recorded as
            <b>Skipped</b>.
          </li>

        </ul>


        <p
          id="camStatus"
          class="badge gray"
        >
          Camera: checking…
        </p>


        ${
          e.status === 'IN_PROGRESS'

            ? `
              <p class="badge orange">
                You have an exam in progress.
                Your saved answers and remaining
                time will be restored.
              </p>
            `

            : ''
        }


        <div
          id="introMsg"
          class="msg"
        ></div>


        <div class="actions">

          <button
            class="btn primary"
            id="startBtn"
            ${can ? '' : 'disabled'}
          >

            ${
              can

                ? (
                    e.status === 'IN_PROGRESS'

                      ? 'Resume in Fullscreen'

                      : 'Enter Fullscreen & Start Exam'
                  )

                : e.status
            }

          </button>


          <a
            class="btn"
            href="student.html"
          >
            Back
          </a>

        </div>

      `;


      $('#startBtn').onclick =
        begin;


      startCamera();


    } catch (err) {

      $('#introCard').innerHTML = `

        <h3 class="err">
          ${esc(err.message)}
        </h3>

        <a
          class="btn"
          href="student.html"
        >
          Back to dashboard
        </a>

      `;

    }

  }


  /* ============================================================
     CAMERA
     ============================================================ */

  async function startCamera() {

    const st =
      $('#camStatus');


    try {

      S.stream =
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              width: 320,
              height: 240
            },
            audio: false
          });


      $('#cam').srcObject =
        S.stream;


      $('#camBox').hidden =
        false;


      if (st) {

        st.className =
          'badge green';

        st.textContent =
          'Camera: ready';

      }


    } catch (e) {

      if (st) {

        st.className =
          'badge red';

        st.textContent =
          'Camera: not available' +
          (
            REQUIRE_CAMERA

              ? ' (required)'

              : ' (continuing without camera monitoring)'
          );

      }

    }

  }


  /* ============================================================
     BEGIN EXAM
     ============================================================ */

  async function begin() {

    const btn =
      $('#startBtn');

    const msg =
      $('#introMsg');


    if (
      REQUIRE_CAMERA &&
      !S.stream
    ) {

      msg.className =
        'msg err';

      msg.textContent =
        'Camera permission is required.';

      return;

    }


    btn.disabled =
      true;


    /*
     * Fullscreen is required.
     */
    try {

      await document
        .documentElement
        .requestFullscreen();

    } catch (e) {

      msg.className =
        'msg err';

      msg.textContent =
        'Fullscreen is required for this exam. Please allow fullscreen and try again.';

      btn.disabled =
        false;

      return;

    }


    try {

      const d =
        await api(
          `/student/exams/${id}/start`,
          {
            method: 'POST'
          }
        );


      S.q =
        d.questions;


      S.ans =
        d.answers || {};


      S.violations =
        Number(d.violation_count || 0);


      MAXV =
        Number(d.max_violations || MAXV || 0);


      S.endAt =
        Date.now() +
        d.remaining_seconds * 1000;


      $('#hTitle').textContent =
        d.exam.title;


      $('#intro').hidden =
        true;


      $('#examUI').hidden =
        false;


      $('#vBadge').hidden =
        false;


      updateV();


      render();


      S.running =
        true;


      arm();


      setInterval(
        tick,
        500
      );


      tick();


      faceLoop();


    } catch (err) {

      if (inFs()) {

        document
          .exitFullscreen()
          .catch(() => {});

      }


      if (
        err.data &&
        err.data.submitted
      ) {

        toast(
          err.message,
          'err'
        );


        setTimeout(
          () =>
            goResult(
              err.data.attempt_id
            ),
          1500
        );

        return;

      }


      msg.className =
        'msg err';

      msg.textContent =
        err.message;

      btn.disabled =
        false;

    }

  }


  /* ============================================================
     TIMER
     ============================================================ */

  function tick() {

    if (S.done)
      return;


    const rem =
      Math.max(
        0,
        Math.ceil(
          (S.endAt - Date.now()) /
          1000
        )
      );


    $('#timer').textContent =
      String(
        Math.floor(rem / 60)
      ).padStart(2, '0') +
      ':' +
      String(
        rem % 60
      ).padStart(2, '0');


    $('#timer').classList.toggle(
      'low',
      rem <= 60
    );


    if (rem <= 0) {

      submit(
        'TIMEOUT',
        'Time is over. Your exam has been automatically submitted.'
      );

    }

  }


  /* ============================================================
     QUESTION UI
     ============================================================ */

  function render() {

    const q =
      S.q[S.cur];


    if (!q)
      return;


    S.visited.add(
      q.id
    );


    $('#qno').textContent =
      `Question ${S.cur + 1} of ${S.q.length}`;


    $('#qtext').textContent =
      q.question_text;


    $('#qtopic').textContent =
      'Topic: ' + q.topic;


    $('#qmarks').textContent =
      q.marks +
      ' mark' +
      (
        q.marks > 1
          ? 's'
          : ''
      );


    $('#opts').innerHTML =
      ['A', 'B', 'C', 'D']
        .map(
          (k) => `

            <label
              class="opt ${
                S.ans[q.id] === k
                  ? 'sel'
                  : ''
              }"
            >

              <input
                type="radio"
                name="o"
                value="${k}"
              >

              <b>
                ${k}
              </b>

              <span>
                ${esc(
                  q[
                    'option_' +
                    k.toLowerCase()
                  ]
                )}
              </span>

            </label>

          `
        )
        .join('');


    $$('#opts .opt')
      .forEach(
        (l) => {

          l.onclick =
            () =>
              choose(
                q,
                l.querySelector(
                  'input'
                ).value
              );

        }
      );


    $('#prev').disabled =
      S.cur === 0;


    $('#next').disabled =
      S.cur ===
      S.q.length - 1;


    drawPalette();

  }


  /* ============================================================
     QUESTION PALETTE
     ============================================================ */

  function drawPalette() {

    $('#palette').innerHTML =
      S.q
        .map(
          (q, i) => `

            <button
              class="${
                S.ans[q.id]
                  ? 'answered'
                  : S.visited.has(q.id)
                    ? 'visited'
                    : ''
              }
              ${
                i === S.cur
                  ? 'current'
                  : ''
              }"
              data-i="${i}"
            >
              ${i + 1}
            </button>

          `
        )
        .join('');


    $$('#palette button')
      .forEach(
        (b) => {

          b.onclick =
            () => {

              S.cur =
                +b.dataset.i;

              render();

            };

        }
      );

  }


  /* ============================================================
     SAVE ANSWER
     ============================================================ */

  function choose(q, k) {

    S.ans[q.id] =
      k;


    render();


    api(
      `/student/exams/${id}/answer`,
      {
        method: 'POST',

        body: {
          question_id: q.id,
          selected_answer: k
        }
      }
    )
      .catch(
        (e) => {

          if (
            e.data &&
            e.data.submitted
          ) {

            goResult(
              e.data.attempt_id
            );

          }

        }
      );

  }


  /* ============================================================
     NAVIGATION
     ============================================================ */

  $('#prev').onclick =
    () => {

      if (S.cur > 0) {

        S.cur--;

        render();

      }

    };


  $('#next').onclick =
    () => {

      if (
        S.cur <
        S.q.length - 1
      ) {

        S.cur++;

        render();

      }

    };


  /* ============================================================
     CLEAR CURRENT ANSWER
     ============================================================ */

  $('#clear').onclick =
    () => {

      const q =
        S.q[S.cur];


      /*
       * Removing the answer means
       * the question becomes SKIPPED.
       */
      delete S.ans[q.id];


      render();


      api(
        `/student/exams/${id}/answer`,
        {
          method: 'POST',

          body: {
            question_id: q.id,
            selected_answer: null
          }
        }
      )
        .catch(
          () => {}
        );

    };


  /* ============================================================
     MANUAL SUBMIT
     ============================================================ */

  $('#submitBtn').onclick =
    () => {

      const un =
        S.q.length -
        Object.keys(S.ans).length;


      if (
        confirm(
          `Submit the exam now?\n\n` +
          `Answered: ${
            S.q.length - un
          }\n` +
          `Skipped: ${un}\n\n` +
          `You cannot change answers after submitting.`
        )
      ) {

        submit(
          'MANUAL',
          'Your exam has been submitted.'
        );

      }

    };


  /* ============================================================
     SUBMIT / FINISH
     ============================================================ */

  async function submit(
    reason,
    msg
  ) {

    if (
      S.submitting ||
      S.done
    )
      return;


    S.submitting =
      true;


    try {

      const d =
        await api(
          `/student/exams/${id}/submit`,
          {
            method: 'POST',

            body: {
              answers: S.ans,
              reason
            }
          }
        );


      finish(
        msg,
        d.attempt_id,
        reason
      );


    } catch (e) {

      S.submitting =
        false;


      toast(
        e.message,
        'err'
      );


      /*
       * Retry automatic submissions.
       */
      if (
        reason !== 'MANUAL'
      ) {

        setTimeout(
          () =>
            submit(
              reason,
              msg
            ),
          2000
        );

      }

    }

  }


  function finish(
    msg,
    attemptId,
    reason = ''
  ) {

    S.done =
      true;


    S.running =
      false;


    if (S.stream) {

      S.stream
        .getTracks()
        .forEach(
          (t) =>
            t.stop()
        );

    }


    if (inFs()) {

      document
        .exitFullscreen()
        .catch(() => {});

    }


    const isViolation =
      reason === 'VIOLATION' ||
      msg.toLowerCase().includes('violat');


    const isTimeout =
      reason === 'TIMEOUT' ||
      msg.toLowerCase().includes('time');


    overlay(`

      <div
        style="font-size:3rem"
      >
        ${
          isViolation
            ? '🚨'
            : isTimeout
              ? '⏱️'
              : '✅'
        }
      </div>


      <h2>
        ${esc(msg)}
      </h2>


      ${
        isViolation
          ? `
            <p class="badge red">
              Rules Violated
            </p>

            <p class="muted">
              The exam was automatically submitted
              because the maximum allowed violation
              limit was reached.
            </p>
          `
          : ''
      }


      <p class="muted">
        Your result and detailed analysis
        are being prepared…
      </p>


      <p class="muted">
        Redirecting to your results…
      </p>

    `);


    setTimeout(
      () =>
        goResult(
          attemptId
        ),
      2500
    );

  }


  /* ============================================================
     PROCTORING
     ============================================================ */

  function updateV() {

    const badge =
      $('#vBadge');


    badge.textContent =
      MAXV > 0

        ? `Violations ${S.violations}/${MAXV}`

        : `Violations ${S.violations}`;


    badge.className =
      'badge ' +
      (
        S.violations
          ? 'red'
          : 'orange'
      );

  }


  /*
   * Messages shown to the student
   * for each type of rule violation.
   */
  const MSG = {

    TAB_SWITCH:
      'You switched tabs or left the exam window.',

    FULLSCREEN_EXIT:
      'You exited fullscreen mode.',

    FACE_NOT_DETECTED:
      'Your face was not detected by the camera.',

    MULTIPLE_FACE_DETECTED:
      'Multiple faces were detected.'

  };


  /*
   * Friendly names for result display.
   */
  const VIOLATION_NAME = {

    TAB_SWITCH:
      'Tab Switch / Left Exam Window',

    FULLSCREEN_EXIT:
      'Fullscreen Exit',

    FACE_NOT_DETECTED:
      'Face Not Detected',

    MULTIPLE_FACE_DETECTED:
      'Multiple Faces Detected'

  };


  async function violate(
    type
  ) {

    if (
      !S.running ||
      S.done
    )
      return;


    const now =
      Date.now();


    /*
     * Prevent multiple browser events
     * from counting as separate violations.
     */
    if (
      now - S.lastV <
      2500
    )
      return;


    /*
     * Face events need a larger
     * cooldown.
     */
    if (
      type.startsWith('FACE') &&
      now - S.lastV <
      10000
    )
      return;


    S.lastV =
      now;


    /*
     * Keep the local list of violation
     * types as well. The backend remains
     * the source of truth.
     */
    S.violationTypes.push(
      type
    );


    try {

      const d =
        await api(
          `/student/exams/${id}/violation`,
          {
            method: 'POST',

            body: {
              violation_type:
                type
            }
          }
        );


      S.violations =
        Number(
          d.violation_count || 0
        );


      MAXV =
        Number(
          d.max_violations ||
          MAXV ||
          0
        );


      updateV();


      /*
       * Maximum reached.
       *
       * The backend has already
       * submitted the exam.
       */
      if (d.submitted) {

        finish(

          `Rules violated: ${
            VIOLATION_NAME[type] ||
            type
          }. Your exam has been automatically submitted.`,

          d.attempt_id,

          'VIOLATION'

        );

        return;

      }


      /*
       * Calculate remaining violations.
       */
      const remaining =
        MAXV > 0

          ? Math.max(
              0,
              MAXV -
              S.violations
            )

          : 0;


      const remainingText =
        MAXV > 0

          ? (
              remaining === 1

                ? '1 more violation'

                : `${remaining} more violations`
            )

          : 'no automatic violation limit configured';


      /*
       * Warning overlay.
       */
      overlay(`

        <div
          style="font-size:3rem"
        >
          ⚠️
        </div>


        <h2>
          Exam Rule Warning
        </h2>


        <p>
          ${esc(
            MSG[type] ||
            'An exam rule was violated.'
          )}
        </p>


        <p>

          <b>
            Violation:
          </b>

          ${S.violations}

          ${
            MAXV > 0
              ? ` / ${MAXV}`
              : ''
          }

        </p>


        ${
          MAXV > 0

            ? `
              <p class="err">

                <b>
                  ${esc(remainingText)}
                  remaining before automatic submission.
                </b>

              </p>
            `

            : ''
        }


        <p
          class="muted"
        >
          Rule:
          ${esc(
            VIOLATION_NAME[type] ||
            type
          )}
        </p>


        <button
          class="btn primary"
          id="ret"
        >
          Return to exam
        </button>

      `);


      $('#ret').onclick =
        async () => {

          if (!inFs()) {

            try {

              await document
                .documentElement
                .requestFullscreen();

            } catch (e) {

              /*
               * Ignore fullscreen
               * request failure here.
               */

            }

          }


          S.lastV =
            Date.now();


          hideOverlay();

        };


    } catch (e) {

      /*
       * If backend already submitted
       * the exam, immediately go to
       * result.
       */
      if (
        e.data &&
        e.data.submitted
      ) {

        finish(

          `Rules violated: ${
            VIOLATION_NAME[type] ||
            type
          }. Your exam has been automatically submitted.`,

          e.data.attempt_id,

          'VIOLATION'

        );

      }

    }

  }


  /* ============================================================
     EVENT LISTENERS / EXAM RULES
     ============================================================ */

  function arm() {

    /*
     * Tab switch.
     */
    document.addEventListener(
      'visibilitychange',
      () => {

        if (
          document.hidden
        ) {

          violate(
            'TAB_SWITCH'
          );

        }

      }
    );


    /*
     * Leaving the browser window.
     */
    window.addEventListener(
      'blur',
      () =>
        violate(
          'TAB_SWITCH'
        )
    );


    /*
     * Leaving fullscreen.
     */
    document.addEventListener(
      'fullscreenchange',
      () => {

        if (!inFs()) {

          violate(
            'FULLSCREEN_EXIT'
          );

        }

      }
    );


    /*
     * Prevent copy/paste/context menu.
     */
    [
      'contextmenu',
      'copy',
      'cut',
      'paste'
    ]
      .forEach(
        (ev) => {

          document.addEventListener(
            ev,
            (e) =>
              e.preventDefault()
          );

        }
      );


    /*
     * Warn before browser refresh/close.
     */
    window.addEventListener(
      'beforeunload',
      (e) => {

        if (!S.done) {

          e.preventDefault();

          e.returnValue = '';

        }

      }
    );

  }


  /* ============================================================
     FACE DETECTION
     ============================================================ */

  /*
   * Uses the browser's built-in
   * FaceDetector when available.
   *
   * Otherwise MediaPipe is loaded
   * from CDN.
   */
  async function makeFaceCounter() {

    if (
      'FaceDetector' in window
    ) {

      const fd =
        new FaceDetector({
          fastMode: true,
          maxDetectedFaces: 5
        });


      return async (
        video
      ) =>
        (
          await fd.detect(
            video
          )
        ).length;

    }


    const V =
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';


    const vision =
      await import(
        V +
        '/vision_bundle.mjs'
      );


    const files =
      await vision
        .FilesetResolver
        .forVisionTasks(
          V + '/wasm'
        );


    const det =
      await vision
        .FaceDetector
        .createFromOptions(
          files,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
            },

            runningMode:
              'IMAGE',

            minDetectionConfidence:
              0.4
          }
        );


    return async (
      video
    ) =>
      det
        .detect(video)
        .detections
        .length;

  }


  /* ============================================================
     FACE MONITORING LOOP
     ============================================================ */

  async function faceLoop() {

    const fs =
      $('#faceStatus');


    if (!S.stream) {

      fs.textContent =
        'Camera unavailable: face monitoring is off.';

      return;

    }


    fs.textContent =
      'Face detection: loading…';


    let count;


    try {

      count =
        await makeFaceCounter();


    } catch (e) {

      console.error(
        'Face detector failed to load:',
        e
      );


      fs.textContent =
        'Face detection could not be loaded (check internet). Camera is on, but face checks are disabled.';

      return;

    }


    fs.textContent =
      'Face detection: active';


    let miss = 0;

    let multi = 0;


    const video =
      $('#cam');


    const loop =
      async () => {

        if (S.done)
          return;


        if (
          S.running &&
          video.readyState >= 2
        ) {

          try {

            const n =
              await count(
                video
              );


            /*
             * No face.
             */
            if (n === 0) {

              multi = 0;


              if (
                ++miss >= 3
              ) {

                violate(
                  'FACE_NOT_DETECTED'
                );

              }

            }


            /*
             * Multiple faces.
             */
            else if (n > 1) {

              miss = 0;


              if (
                ++multi >= 2
              ) {

                violate(
                  'MULTIPLE_FACE_DETECTED'
                );

              }

            }


            /*
             * Exactly one face.
             */
            else {

              miss = 0;

              multi = 0;

            }

          } catch (e) {

            /*
             * Detector errors are ignored
             * so they don't unfairly violate
             * the student.
             */

          }

        }


        setTimeout(
          loop,
          1500
        );

      };


    loop();

  }


  /* ============================================================
     START
     ============================================================ */

  init();

})();