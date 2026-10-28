const U = initShell(['STUDENT', 'TEACHER', 'ADMIN']);
const C = $('#content');

(async function () {

  if (!U) return;

  try {

    const exams =
      await api('/leaderboard/exams');

    const pre =
      new URLSearchParams(location.search).get('exam') || '';

    C.innerHTML = `
      <h1 class="page-title">
        Leaderboard
      </h1>

      <div class="card">

        <label style="margin-top:0">
          Leaderboard type
        </label>

        <select id="sel">

          <option value="">
            Overall Leaderboard
          </option>

          ${exams.map(
            (e) => `
              <option
                value="${e.id}"
                ${e.id == pre ? 'selected' : ''}
              >
                Exam: ${esc(e.title)}
              </option>
            `
          ).join('')}

        </select>

      </div>

      <div id="out"></div>
    `;


    async function load() {

      const ex =
        $('#sel').value;

      const d =
        await api(
          '/leaderboard' +
          (ex
            ? '?exam_id=' + ex
            : '')
        );


      const rows =
        d.rows.map(
          (r) => ({
            ...r,
            _cls:
              r.student_id === d.me
                ? 'me'
                : ''
          })
        );


      const medals =
        ['🥇', '🥈', '🥉'];

      const cls =
        ['p1', 'p2', 'p3'];


      const top =
        rows.slice(0, 3);


      /*
       * --------------------------------------------------------
       * PODIUM
       * --------------------------------------------------------
       *
       * Rank is already represented by the medal.
       * Therefore we don't display "Rank #1", "Rank #2", etc.
       * below the marks.
       */

      const podium =
        top.length

          ? `
            <div class="podium">

              ${
                [1, 0, 2]
                  .filter(
                    (i) => top[i]
                  )
                  .map(
                    (i) => `

                      <div
                        class="pcard ${cls[i]}"
                      >

                        <div class="medal">
                          ${medals[i]}
                        </div>


                        <b>
                          ${esc(
                            top[i].name
                          )}
                        </b>


                        <small>
                          ${esc(
                            top[i].user_code
                          )}
                        </small>


                        <div class="pct">
                          ${top[i].percentage}%
                        </div>


                        <small>

                          ${top[i].marks}

                          ${
                            top[i].max_marks
                              ? '/' +
                                top[i].max_marks
                              : ''
                          }

                          marks

                        </small>

                      </div>

                    `
                  )
                  .join('')
              }

            </div>
          `

          : '';


      $('#out').innerHTML = `

        <h3>

          ${
            d.scope === 'exam'

              ? esc(
                  d.exam.title
                ) +
                ' - Exam Leaderboard'

              : 'Overall Leaderboard (average percentage across all exams)'
          }

        </h3>


        ${podium}


        <div class="card">

          ${table(

            [

              {
                h: 'Rank',
                f: (r) =>
                  '#' + r.rank
              },


              {
                h: 'Student ID',
                f: (r) =>
                  esc(r.user_code)
              },


              {
                h: 'Student Name',
                f: (r) =>
                  esc(r.name) +
                  (
                    r._cls
                      ? ' <span class="badge blue">You</span>'
                      : ''
                  )
              },


              {
                h: 'Marks',
                f: (r) =>
                  r.marks +
                  (
                    d.scope === 'overall'

                      ? ` (${r.tests} test${
                          r.tests > 1
                            ? 's'
                            : ''
                        })`

                      : '/' +
                        r.max_marks
                  )
              },


              {
                h: 'Percentage',
                f: (r) =>
                  `${r.percentage}%${pbar(
                    r.percentage
                  )}`
              }

            ],

            rows,

            'No results yet - the leaderboard fills up as students complete exams.'

          )}

        </div>

      `;

    }


    $('#sel').onchange =
      () =>
        load().catch(
          (e) =>
            toast(
              e.message,
              'err'
            )
        );


    await load();

  } catch (e) {

    C.innerHTML =
      `
        <div class="card err">
          ${esc(e.message)}
        </div>
      `;

  }

})();