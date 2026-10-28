/* Dynamic "what to improve" advice for the student result page.
   Uses only data the result API already returns: exam subject, topic scores and the answer review.
   Depends on esc() and r1() from common.js. */

// [subject regex, topic regex, advice] - first match wins. Anything not matched gets an advice line built from the test itself.
const IMPROVE_TIPS = [
  [/\bc programming|^c$/, /function/, 'Practise writing C functions: prototype vs definition, return types, pass-by-value vs passing pointers, scope, and recursion base cases.'],
  [/\bc programming|^c$/, /pointer/, 'Draw memory diagrams for pointers: & and *, pointer arithmetic, arrays vs pointers, and malloc/free.'],
  [/\bc programming|^c$|c\+\+/, /array|string/, 'Practise array indexing, 2-D arrays and string handling (remember the \'\\0\' terminator).'],
  [/c\+\+|java/, /class|object|oop|inherit|polymorph/, 'Revise classes and objects, constructors, inheritance, method overriding and polymorphism with small examples.'],
  [/python/, /function/, 'Practise def, parameters vs arguments, default and keyword arguments, return values and variable scope.'],
  [/python/, /list|tuple|dict|set|collection/, 'Practise list/tuple/dict/set operations, slicing, and looping over collections.'],
  [/python/, /variable|data ?type|basic/, 'Revise data types, type conversion, operators and how variables are assigned.'],
  [/data structures/, /tree|graph/, 'Trace traversals (in-order, pre-order, BFS/DFS) by hand on small trees and graphs.'],
  [/data structures/, /stack|queue|list|array/, 'Implement push/pop, enqueue/dequeue and list insert/delete yourself and trace the pointers step by step.'],
  [/dbms|database/, /sql|query|join/, 'Write practice queries: SELECT with WHERE/GROUP BY/HAVING, and every JOIN type on small tables.'],
  [/dbms|database/, /normal|key|schema|er/, 'Revise keys, functional dependencies and 1NF-3NF/BCNF with worked examples.'],
  [/networks?/, /osi|tcp|ip|protocol|layer/, 'Learn what each OSI/TCP-IP layer does, its protocols and its PDU, then match protocols to layers.'],
  [/operating systems?/, /process|schedul|thread|deadlock|memory/, 'Work through scheduling (FCFS, SJF, RR) and paging/deadlock examples by hand.'],
  [/machine learning|artificial intelligence/, /regress|classif|cluster|learning|search/, 'Revise the core idea, when to use it, and its main evaluation metric or cost function, with one worked example.'],
  [/./, /loop|iteration|control|condition/, 'Trace loops and if/else by hand on paper, checking the start, condition and update of every loop.'],
  [/./, /function|method|procedure/, 'Revise how functions are defined and called, parameters vs arguments, return values and scope.'],
  [/./, /array|list/, 'Practise indexing, traversal, insertion and deletion on small examples.']
];

function improveTip(subject, topic) {
  const s = String(subject || '').toLowerCase(), t = String(topic || '').toLowerCase();
  const hit = IMPROVE_TIPS.find((x) => x[0].test(s) && x[1].test(t));
  return hit ? hit[2] : null;
}

function improveItems(subject, topics, review) {
  return topics.filter((t) => t.status !== 'STRONG').sort((a, b) => a.percentage - b.percentage).map((t) => {
    const total = t.total_questions ?? t.total ?? 0, correct = t.correct_count ?? t.correct ?? 0;
    const missed = (review || []).filter((q) => q.topic === t.topic && q.selected_answer !== q.correct_answer);
    const need = Math.max(0, Math.ceil(total * 0.8) - correct);      // extra correct answers needed to reach STRONG (80%)
    const tip = improveTip(subject, t.topic) ||
      `Revise the concepts behind the ${missed.length} question${missed.length === 1 ? '' : 's'} you missed in ${t.topic}, then attempt more practice questions on this topic.`;
    return { t, total, correct, need, missed, tip };
  });
}

/* Replaces topicLists() on the result page: same three boxes, but "Needs Improvement" now lists every non-strong topic
   (weak ones included) as a clear sentence, followed by a detailed improvement plan for this test. */
function improvementBlock(subject, topics, review) {
  const sub = esc(subject || 'this subject');
  const g = (s) => topics.filter((t) => t.status === s);
  const li = (arr, sym) => arr.length ? arr.map((t) => `<li>${sym} ${esc(t.topic)} <span class="muted">(${r1(t.percentage)}%)</span></li>`).join('') : '<li class="muted">None</li>';
  const items = improveItems(subject, topics, review);
  const focus = items.length
    ? items.map((i) => `<li>${i.t.status === 'WEAK' ? '⚠' : '•'} You need to improve <b>${esc(i.t.topic)}</b> in ${sub} <span class="muted">(${r1(i.t.percentage)}%)</span></li>`).join('')
    : '<li class="muted">Nothing to improve in this test. Great work!</li>';

  const plan = items.length ? `<div class="card"><h3>📌 Your Improvement Plan · ${sub}</h3>
    <p class="muted" style="margin-top:0">Built from your answers in this test, weakest topic first.</p>
    ${items.map((i) => `<div class="q-review ${i.t.status === 'WEAK' ? 'no' : 'na'}">
      <b>${esc(i.t.topic)}</b> <span class="badge ${i.t.status === 'WEAK' ? 'red' : 'orange'}">${i.t.status === 'WEAK' ? 'Weak' : 'Needs Improvement'}</span>
      <small class="muted"> · ${i.correct}/${i.total} correct (${r1(i.t.percentage)}%)</small><br>
      <span>You need to improve <b>${esc(i.t.topic)}</b> in ${sub}. ${esc(i.tip)}</span><br>
      <small>${i.need > 0 ? `Target: answer <b>${i.need}</b> more ${i.need === 1 ? 'question' : 'questions'} correctly in this topic to reach Strong (80%).` : 'You are close to the Strong level; keep practising.'}</small>
      ${i.missed.length ? `<ul style="margin:6px 0 0;padding-left:18px"><small>Questions to revisit:</small>${i.missed.slice(0, 4).map((q) => `<li><small>${esc(q.question_text.length > 110 ? q.question_text.slice(0, 107) + '…' : q.question_text)} <b>(Answer: ${q.correct_answer}. ${esc(q['option_' + q.correct_answer.toLowerCase()])})</b></small></li>`).join('')}</ul>` : ''}
    </div>`).join('')}</div>` : '';

  return `<div class="grid three"><div class="card tgroup"><h4>STRONG TOPICS</h4><ul class="tlist t-strong">${li(g('STRONG'), '✓')}</ul></div>
    <div class="card tgroup"><h4>WEAK TOPICS</h4><ul class="tlist t-weak">${li(g('WEAK'), '⚠')}</ul></div>
    <div class="card tgroup"><h4>NEEDS IMPROVEMENT</h4><ul class="tlist t-needs">${focus}</ul></div></div>${plan}`;
}

/* Analytics page (all exams together): same idea as improvementBlock(), but each topic carries its own subject
   (sent by /api/student/analytics), and the plan is grouped by subject. */
function improvementOverall(topics) {
  const subOf = (t) => t.subject || '';
  const label = (t) => esc(t.topic) + (subOf(t) ? ` <span class="muted">· ${esc(subOf(t))}</span>` : '');
  const g = (s) => topics.filter((t) => t.status === s);
  const li = (arr, sym) => arr.length ? arr.map((t) => `<li>${sym} ${label(t)} <span class="muted">(${r1(t.percentage)}%)</span></li>`).join('') : '<li class="muted">None</li>';
  const weak = topics.filter((t) => t.status !== 'STRONG').sort((a, b) => a.percentage - b.percentage);
  const focus = weak.length
    ? weak.map((t) => `<li>${t.status === 'WEAK' ? '⚠' : '•'} You need to improve <b>${esc(t.topic)}</b>${subOf(t) ? ' in ' + esc(subOf(t)) : ''} <span class="muted">(${r1(t.percentage)}%)</span></li>`).join('')
    : '<li class="muted">All topics are strong. Great work!</li>';

  const groups = {};
  weak.forEach((t) => { (groups[subOf(t) || 'Other topics'] = groups[subOf(t) || 'Other topics'] || []).push(t); });
  const plan = Object.keys(groups).sort().map((name) => `<div class="card"><h3>📌 ${esc(name)}: what to improve</h3>
    ${groups[name].map((t) => {
      const total = Number(t.total ?? t.total_questions ?? 0), correct = Number(t.correct ?? t.correct_count ?? 0);
      const more = Math.max(1, 4 * total - 5 * correct);                  // correct answers in a row needed to lift this topic to 80%
      const tip = improveTip(name, t.topic) || `Revise the concepts in ${t.topic} and practise more questions on it. Open your past results to see the exact questions you missed.`;
      return `<div class="q-review ${t.status === 'WEAK' ? 'no' : 'na'}"><b>${esc(t.topic)}</b> <span class="badge ${t.status === 'WEAK' ? 'red' : 'orange'}">${t.status === 'WEAK' ? 'Weak' : 'Needs Improvement'}</span>
        <small class="muted"> · ${correct}/${total} correct across all tests (${r1(t.percentage)}%)</small><br>
        <span>You need to improve <b>${esc(t.topic)}</b>${name !== 'Other topics' ? ' in ' + esc(name) : ''}. ${esc(tip)}</span><br>
        <small>Target: about <b>${more}</b> more correct ${more === 1 ? 'answer' : 'answers'} in this topic to reach Strong (80%).</small></div>`;
    }).join('')}</div>`).join('');

  return `<div class="grid three"><div class="card tgroup"><h4>STRONG TOPICS</h4><ul class="tlist t-strong">${li(g('STRONG'), '✓')}</ul></div>
    <div class="card tgroup"><h4>WEAK TOPICS</h4><ul class="tlist t-weak">${li(g('WEAK'), '⚠')}</ul></div>
    <div class="card tgroup"><h4>NEEDS IMPROVEMENT</h4><ul class="tlist t-needs">${focus}</ul></div></div>${plan}`;
}
