const QUERY_TEMPLATES = [
  ['Provider discovery', (practice, location) => practice + ' lawyers in ' + location],
  ['Provider discovery', (practice, location) => 'Which law firms in ' + location + ' handle ' + practice + ' matters?'],
  ['Decision support', (practice, location) => 'How do I choose a lawyer for ' + practice + ' in ' + location + '?'],
  ['Decision support', (practice, location) => 'What should I ask a lawyer about ' + practice + ' in ' + location + ' before hiring them?'],
  ['First contact', (practice, location) => 'What information should I prepare for a consultation about ' + practice + ' in ' + location + '?'],
  ['Decision support', (practice, location) => 'What factors affect the cost of ' + practice + ' legal services in ' + location + '?'],
  ['First contact', (practice, location) => 'Which law firms in ' + location + ' offer initial consultations about ' + practice + '?'],
];

const CHECKLIST = [
  "Confirm the practice area and location match the firm's actual services.",
  'Save the fixed query list and identify the firm and website being reviewed.',
  'Record the tool, search mode, relevant settings, and date and time.',
  'Run each question separately and save the answer, sources, or error.',
  'Distinguish a name mention from a linked website citation.',
  'Check factual descriptions against information your firm has approved.',
  'Choose specific accuracy, content, or website issues to investigate.',
  'Repeat the same sample later and retain both sets of observations.',
];

const STATUSES = { untested: 'Not run', observed: 'Response reviewed', error: 'Search error' };
const CLASSIFICATIONS = { '': 'Not checked', yes: 'Yes', no: 'No', unclear: 'Unclear' };
const TEXT_FIELDS = ['sourceUrls', 'answerText', 'accuracyNotes', 'evidenceReference', 'nextAction'];
const CONTEXT_LIMITS = { firmName: 120, firmWebsite: 500, tool: 120, searchContext: 1000, runDatetime: 32, timezone: 80 };
export const BACKUP_LIMITS = Object.freeze({ bytes: 5 * 1024 * 1024, runs: 100 });
const BACKUP_FORMAT = 'quotedfirst-ai-search-runs';

export function createPlan(practiceArea, location) {
  const normalize = (value, label) => {
    const input = String(value).trim();
    if (!input || input.length > 80) throw new Error('Enter ' + label + ' using 1 to 80 characters.');
    return input.replace(/\s+/g, ' ');
  };
  const practice = normalize(practiceArea, 'a practice area');
  const place = normalize(location, 'a location');
  return {
    practiceArea: practice,
    location: place,
    queries: QUERY_TEMPLATES.map(([intent, query], index) => ({
      id: 'Q' + String(index + 1).padStart(2, '0'), intent, text: query(practice, place),
    })),
  };
}

function snapshotPlan(plan) {
  return Object.freeze({
    practiceArea: plan.practiceArea,
    location: plan.location,
    queries: Object.freeze(plan.queries.map(query => Object.freeze({ ...query }))),
  });
}

function csvCell(value) {
  let text = String(value ?? '');
  // Neutralize spreadsheet formulas, including those preceded by whitespace or controls.
  if (/^[\s\u0000-\u001f\u007f\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function csvDocument(rows) {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function createCsv(plan) {
  const headers = ['query_id', 'intent', 'practice_area', 'location', 'query',
    'firm_name', 'firm_domain', 'tool', 'search_context', 'run_datetime',
    'firm_mentioned', 'firm_website_cited', 'cited_urls', 'accuracy_notes',
    'evidence_reference', 'next_action'];
  return csvDocument([headers, ...plan.queries.map(query => [
    query.id, query.intent, plan.practiceArea, plan.location, query.text, ...Array(11).fill(''),
  ])]);
}

export function createChecklist(plan) {
  return [
    'LAW FIRM AI SEARCH VISIBILITY AUDIT WORKSHEET',
    'Quoted First | https://quotedfirst.com/law-firm-ai-search-audit/',
    '', 'Practice area: ' + plan.practiceArea, 'Location: ' + plan.location,
    '', 'This planner prepares questions. Run the searches yourself and record the results.',
    'No searches have been run by this planner.',
    '', 'FIXED QUERY PLAN',
    ...plan.queries.map(query => query.id + ' [' + query.intent + '] ' + query.text),
    '', 'MANUAL CHECKLIST', ...CHECKLIST.map(item => '[ ] ' + item),
    '', 'OBSERVATION NOTES',
    'Leave untested observations blank. After checking, use yes, no, or unclear for mentions and citations.',
    'Save the exact answer, source URLs, date/time, tool settings, and evidence reference.',
    'A missing result does not establish index absence. This sample is not a universal visibility score.',
    '',
  ].join('\n');
}

function snapshotContext(context, preserveText = false) {
  const result = {};
  for (const [field, limit] of Object.entries(CONTEXT_LIMITS)) {
    const value = preserveText ? context[field] : String(context[field] ?? '').trim();
    if (typeof value !== 'string') throw new Error(field + ' must be text.');
    if ((!value.trim() && field !== 'searchContext') || value.length > limit) {
      const labels = { firmName: 'Firm name', firmWebsite: 'Firm website', tool: 'AI search tool',
        searchContext: 'Search mode and settings', runDatetime: 'Search date and time', timezone: 'Time zone' };
      throw new Error(labels[field] + (value.length > limit
        ? ' must use ' + limit + ' characters or fewer.' : ' is required before starting a run.'));
    }
    result[field] = value;
  }
  let website;
  try { website = new URL(result.firmWebsite); } catch { /* Report the same useful validation message below. */ }
  if (!website || !['https:', 'http:'].includes(website.protocol) || !website.hostname) {
    throw new Error('Enter the firm website as an http:// or https:// address.');
  }
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(result.runDatetime);
  const parts = dateMatch?.slice(1).map(value => Number(value || 0));
  // Validate calendar components without converting the entered time through the browser's zone.
  const calendar = new Date(0);
  if (parts) {
    calendar.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    calendar.setUTCHours(parts[3], parts[4], parts[5], 0);
  }
  const checkedParts = [calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(),
    calendar.getUTCHours(), calendar.getUTCMinutes(), calendar.getUTCSeconds()];
  if (!parts || parts[0] < 1 || parts.some((value, index) => value !== checkedParts[index])) {
    throw new Error('Enter the date and time of the searches for this run.');
  }
  return Object.freeze(result);
}

export function createRun(plan, context, options = {}) {
  const id = options.id ?? (globalThis.crypto?.randomUUID?.()
    || 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  const frozenPlan = snapshotPlan(plan);
  return Object.freeze({
    id,
    number: options.number ?? 1,
    plan: frozenPlan,
    context: snapshotContext(context),
    observations: Object.fromEntries(frozenPlan.queries.map(query => [query.id, {
      status: 'untested', firmMentioned: '', firmWebsiteCited: '',
      ...Object.fromEntries(TEXT_FIELDS.map(field => [field, ''])),
    }])),
  });
}

export function createAuditSession(initialPlan) {
  let plan = snapshotPlan(initialPlan);
  let activeId = null;
  const runs = [];
  return {
    get plan() { return plan; },
    get runs() { return [...runs]; },
    get activeRun() { return runs.find(run => run.id === activeId) ?? null; },
    setPlan(nextPlan) {
      plan = snapshotPlan(nextPlan);
      activeId = null;
      return plan;
    },
    startRun(context) {
      if (runs.length >= BACKUP_LIMITS.runs) throw new Error('This tab has the maximum 100 runs. Download a backup before starting a separate tab.');
      const run = createRun(plan, context, { number: runs.length + 1 });
      if (runs.some(item => item.id === run.id)) throw new Error('A unique run ID could not be created. Try starting the run again.');
      runs.push(run);
      activeId = run.id;
      return run;
    },
    selectRun(id) {
      const run = runs.find(item => item.id === id);
      if (!run) throw new Error('Choose a run from this tab.');
      activeId = id;
      return run;
    },
    previewImport(backup) {
      const staged = stageImport(backup, runs);
      return { total: staged.total, added: staged.additions.length, skipped: staged.skipped };
    },
    importRuns(backup) {
      // Revalidate against current entries at confirmation, then commit every addition together.
      const staged = stageImport(backup, runs);
      const additions = staged.additions.map((run, index) => Object.freeze({
        id: run.id, number: runs.length + index + 1, plan: snapshotPlan(run.plan),
        context: Object.freeze({ ...run.context }),
        observations: Object.fromEntries(run.plan.queries.map(query => [query.id, { ...run.observations[query.id] }])),
      }));
      runs.push(...additions);
      return { total: staged.total, added: additions.length, skipped: staged.skipped };
    },
  };
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error(label + ' has missing or unexpected fields.');
  }
}

function checkedText(value, label, min = 0, max = Infinity) {
  if (typeof value !== 'string' || value.length < min || value.length > max || (min && !value.trim())) {
    throw new Error(label + ' must be text' + (max < Infinity ? ' using ' + min + '–' + max + ' characters.' : '.'));
  }
  return value;
}

function checkedRun(value, index) {
  const label = 'Run ' + (index + 1);
  exactKeys(value, ['id', 'plan', 'context', 'observations'], label);
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value.id)) {
    throw new Error(label + ' has an invalid run ID.');
  }
  exactKeys(value.plan, ['practiceArea', 'location', 'queries'], label + ' plan');
  const practiceArea = checkedText(value.plan.practiceArea, label + ' practice area', 1, 80);
  const location = checkedText(value.plan.location, label + ' location', 1, 80);
  if (!Array.isArray(value.plan.queries) || value.plan.queries.length !== 7) {
    throw new Error(label + ' must contain seven original questions.');
  }
  const queries = value.plan.queries.map((query, queryIndex) => {
    const queryLabel = label + ' question ' + (queryIndex + 1);
    exactKeys(query, ['id', 'intent', 'text'], queryLabel);
    if (query.id !== 'Q0' + (queryIndex + 1)) throw new Error(queryLabel + ' has an invalid or out-of-order ID.');
    if (!['Provider discovery', 'Decision support', 'First contact'].includes(query.intent)) {
      throw new Error(queryLabel + ' has an unknown intent.');
    }
    return { id: query.id, intent: query.intent, text: checkedText(query.text, queryLabel, 1, 1000) };
  });
  exactKeys(value.context, Object.keys(CONTEXT_LIMITS), label + ' context');
  let context;
  try { context = snapshotContext(value.context, true); }
  catch (error) { throw new Error(label + ': ' + error.message); }
  exactKeys(value.observations, queries.map(query => query.id), label + ' observations');
  const observations = Object.fromEntries(queries.map(query => {
    const entry = value.observations[query.id];
    const entryLabel = label + ' ' + query.id;
    exactKeys(entry, ['status', 'firmMentioned', 'firmWebsiteCited', ...TEXT_FIELDS], entryLabel);
    if (typeof entry.status !== 'string' || !Object.hasOwn(STATUSES, entry.status)) {
      throw new Error(entryLabel + ' has an invalid status.');
    }
    for (const field of ['firmMentioned', 'firmWebsiteCited']) {
      if (typeof entry[field] !== 'string' || !Object.hasOwn(CLASSIFICATIONS, entry[field])) {
        throw new Error(entryLabel + ' has an invalid ' + field + ' choice.');
      }
    }
    return [query.id, { status: entry.status, firmMentioned: entry.firmMentioned, firmWebsiteCited: entry.firmWebsiteCited,
      ...Object.fromEntries(TEXT_FIELDS.map(field => [field, checkedText(entry[field], entryLabel + ' ' + field)])) }];
  }));
  return { id: value.id, plan: { practiceArea, location, queries }, context, observations };
}

function checkedBackup(value) {
  exactKeys(value, ['format', 'version', 'exportedAt', 'runs'], 'Backup');
  if (value.format !== BACKUP_FORMAT || value.version !== 1) throw new Error('Choose a supported version 1 Quoted First runs backup.');
  if (typeof value.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.exportedAt)
    || !Number.isFinite(Date.parse(value.exportedAt)) || new Date(value.exportedAt).toISOString() !== value.exportedAt) {
    throw new Error('The backup export date is invalid.');
  }
  if (!Array.isArray(value.runs) || value.runs.length > BACKUP_LIMITS.runs) {
    throw new Error('A backup can contain at most 100 runs. No runs were changed.');
  }
  return { format: BACKUP_FORMAT, version: 1, exportedAt: value.exportedAt, runs: value.runs.map(checkedRun) };
}

function encodeBackup(value) {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).byteLength > BACKUP_LIMITS.bytes) {
    throw new Error('The backup exceeds 5 MiB. No entries were shortened or removed. CSV export remains available.');
  }
  return text;
}

function backupForRuns(runs) {
  return checkedBackup({ format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(),
    runs: runs.map(run => ({ id: run.id, plan: run.plan, context: run.context, observations: run.observations })) });
}

export function createRunsBackup(runs) {
  const backup = backupForRuns(runs);
  // A file with conflicting duplicate IDs could not be restored, even if its fields were valid.
  const byId = new Map();
  for (const run of backup.runs) {
    const previous = byId.get(run.id);
    const fingerprint = JSON.stringify(run);
    if (previous !== undefined && previous !== fingerprint) throw new Error('Conflicting run ID ' + run.id + '. Backup was not created.');
    byId.set(run.id, fingerprint);
  }
  return encodeBackup(backup);
}

export function parseRunsBackup(bytes) {
  if (!(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer)) throw new Error('Choose a JSON backup file.');
  if (bytes.byteLength > BACKUP_LIMITS.bytes) throw new Error('Choose a backup of 5 MiB or less. No runs were changed.');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('The backup must use valid UTF-8 text. No runs were changed.'); }
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('The selected file is not valid JSON. No runs were changed.'); }
  rejectDuplicateJsonKeys(text);
  const backup = checkedBackup(value);
  // Keep review data separate and immutable while existing observations remain editable.
  for (const run of backup.runs) {
    run.plan = snapshotPlan(run.plan);
    Object.values(run.observations).forEach(Object.freeze);
    Object.freeze(run.observations);
    Object.freeze(run);
  }
  Object.freeze(backup.runs);
  return Object.freeze(backup);
}

function rejectDuplicateJsonKeys(text) {
  // Standard JSON parsing above establishes valid syntax. This token pass catches members
  // that JSON.parse would silently replace, including equivalent escaped key spellings.
  const frames = [];
  for (const match of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]/g)) {
    const token = match[0];
    const frame = frames.at(-1);
    if (token === '{') frames.push({ keys: new Set(), expectsKey: true });
    else if (token === '[') frames.push({});
    else if (token === '}' || token === ']') frames.pop();
    else if (token === ',' && frame?.keys) frame.expectsKey = true;
    else if (token.startsWith('"') && frame?.keys && frame.expectsKey) {
      const key = JSON.parse(token);
      if (frame.keys.has(key)) throw new Error('The JSON file repeats a field name. Nothing was imported.');
      frame.keys.add(key);
      frame.expectsKey = false;
    }
  }
}

function stageImport(value, currentRuns) {
  const backup = checkedBackup(value);
  encodeBackup(backup);
  const current = backupForRuns(currentRuns).runs;
  const byId = new Map(current.map(run => [run.id, JSON.stringify(run)]));
  const additions = [];
  let skipped = 0;
  for (const run of backup.runs) {
    const fingerprint = JSON.stringify(run);
    if (byId.has(run.id)) {
      if (byId.get(run.id) !== fingerprint) {
        throw new Error('Conflicting run ID ' + run.id + '. Nothing was imported. Save your current work before inspecting this backup in a separate empty tab.');
      }
      skipped += 1;
    } else {
      additions.push(run);
      byId.set(run.id, fingerprint);
    }
  }
  // The combined session must also fit a restorable backup before any live mutation.
  encodeBackup(backupForRuns([...current, ...additions]));
  return { additions, skipped, total: backup.runs.length };
}

export function setObservation(run, queryId, field, value) {
  if (!Object.hasOwn(run.observations, queryId)) throw new Error('This question does not belong to the selected run.');
  const observation = run.observations[queryId];
  const text = String(value ?? '');
  if (field === 'status') {
    if (!Object.hasOwn(STATUSES, text)) throw new Error('Choose a valid observation status.');
  } else if (field === 'firmMentioned' || field === 'firmWebsiteCited') {
    if (!Object.hasOwn(CLASSIFICATIONS, text)) throw new Error('Choose yes, no, unclear, or not checked.');
  } else if (!TEXT_FIELDS.includes(field)) {
    throw new Error('Unknown observation field.');
  }
  observation[field] = text;
}

export function summarizeRun(run) {
  const summary = {
    observed: 0, untested: 0, errors: 0,
    mentions: { yes: 0, no: 0, unclear: 0, unchecked: 0 },
    citations: { yes: 0, no: 0, unclear: 0, unchecked: 0 },
  };
  for (const query of run.plan.queries) {
    const observation = run.observations[query.id];
    if (observation.status === 'untested') summary.untested += 1;
    else if (observation.status === 'error') summary.errors += 1;
    else {
      summary.observed += 1;
      summary.mentions[observation.firmMentioned || 'unchecked'] += 1;
      summary.citations[observation.firmWebsiteCited || 'unchecked'] += 1;
    }
  }
  return summary;
}

export function compareRuns(first, second) {
  if (!first || !second) throw new Error('Choose two saved runs to compare.');
  if (first.id === second.id) throw new Error('Choose two different runs to compare.');
  // Reuse the backup validator without changing its format or the original records.
  const checked = [first, second].map((run, index) => checkedRun({
    id: run.id, plan: run.plan, context: run.context, observations: run.observations,
  }, index));
  const [a, b] = checked;
  if (a.context.firmName !== b.context.firmName || a.context.firmWebsite !== b.context.firmWebsite) {
    throw new Error('Choose runs with exactly the same firm name and firm website.');
  }
  if (a.plan.practiceArea !== b.plan.practiceArea || a.plan.location !== b.plan.location
    || a.plan.queries.some((query, index) => ['id', 'intent', 'text'].some(field => query[field] !== b.plan.queries[index][field]))) {
    throw new Error('Choose runs with exactly the same practice area, location, and seven questions, including their IDs, intent, text, and order.');
  }
  const warnings = ['Matching entered labels do not prove that the search conditions were the same.'];
  for (const [field, label] of [['tool', 'AI search tool'], ['searchContext', 'Search mode and settings'], ['timezone', 'Time zone']]) {
    if (a.context[field] !== b.context[field]) warnings.push(label + ' differs between Run A and Run B.');
  }
  for (const [label, run] of [['A', a], ['B', b]]) {
    if (!run.context.searchContext.trim()) warnings.push('Run ' + label + ' has no recorded search mode or settings.');
  }
  const observation = (run, id) => {
    const entry = run.observations[id];
    return {
      status: entry.status,
      firmMentioned: entry.status === 'observed' ? entry.firmMentioned : null,
      firmWebsiteCited: entry.status === 'observed' ? entry.firmWebsiteCited : null,
    };
  };
  return {
    firmName: a.context.firmName,
    firmWebsite: a.context.firmWebsite,
    plan: { practiceArea: a.plan.practiceArea, location: a.plan.location, queries: a.plan.queries.map(query => ({ ...query })) },
    runs: {
      a: { id: a.id, number: first.number, context: { ...a.context } },
      b: { id: b.id, number: second.number, context: { ...b.context } },
    },
    rows: a.plan.queries.map(query => ({ ...query, a: observation(a, query.id), b: observation(b, query.id) })),
    warnings,
  };
}

export function createRunsCsv(runs) {
  const headers = [
    'run_id', 'run_number', 'firm_name', 'firm_website', 'tool', 'search_context',
    'run_datetime_local', 'run_timezone', 'practice_area', 'location', 'query_id', 'intent', 'query',
    'observation_status', 'firm_mentioned', 'firm_website_cited', 'cited_urls', 'answer_or_error_text',
    'accuracy_notes', 'evidence_reference', 'next_action', 'draft_firm_mentioned', 'draft_firm_website_cited',
  ];
  const rows = runs.flatMap(run => run.plan.queries.map(query => {
    const entry = run.observations[query.id];
    const reviewed = entry.status === 'observed';
    return [
      run.id, run.number, run.context.firmName, run.context.firmWebsite, run.context.tool,
      run.context.searchContext, run.context.runDatetime, run.context.timezone,
      run.plan.practiceArea, run.plan.location, query.id, query.intent, query.text,
      entry.status, reviewed ? entry.firmMentioned : '', reviewed ? entry.firmWebsiteCited : '',
      entry.sourceUrls, entry.answerText, entry.accuracyNotes, entry.evidenceReference, entry.nextAction,
      reviewed ? '' : entry.firmMentioned, reviewed ? '' : entry.firmWebsiteCited,
    ];
  }));
  return csvDocument([headers, ...rows]);
}

function initializePlanner() {
  const form = document.getElementById('query-form');
  if (!form) return;
  const byId = id => document.getElementById(id);
  const practiceInput = byId('practice-area');
  const locationInput = byId('location');
  const list = byId('query-list');
  const heading = byId('plan-title');
  const context = byId('plan-context');
  const status = byId('planner-status');
  const actions = byId('plan-actions');
  const buttons = [...actions.querySelectorAll('button')];
  const manualCopy = byId('manual-copy');
  const copyText = byId('copy-text');
  const session = createAuditSession(createPlan(practiceInput.value, locationInput.value));
  const runForm = byId('run-form');
  const runSetup = byId('run-setup');
  const startRun = byId('start-run');
  const runSelect = byId('run-select');
  const recorderStatus = byId('recorder-status');
  const downloadRuns = byId('download-runs');
  const downloadBackup = byId('download-backup');
  const backupFile = byId('backup-file');
  const backupReview = byId('backup-review');
  const backupStatus = byId('backup-status');
  const confirmImport = byId('confirm-import');
  const comparisonForm = byId('comparison-form');
  const comparisonSelects = [byId('compare-run-a'), byId('compare-run-b')];
  const comparisonButton = byId('compare-runs-button');
  const comparisonStatus = byId('comparison-status');
  const comparisonResults = byId('comparison-results');
  let comparedPair = null;
  let importRevision = 0;
  let pendingBackup = null;
  let revision = 0;
  let planDirty = false;

  function announceRecorder(message) { recorderStatus.textContent = message; }

  function renderQueries() {
    list.replaceChildren(...session.plan.queries.map(query => {
      const item = document.createElement('li');
      const intent = document.createElement('span');
      intent.className = 'query-intent';
      intent.textContent = query.intent;
      const text = document.createElement('p');
      text.textContent = query.text;
      item.append(intent, text);
      return item;
    }));
    byId('run-plan-context').textContent = 'New runs will use the seven questions for '
      + session.plan.practiceArea + ' in ' + session.plan.location + '.';
  }

  function validateInput(input, label) {
    const value = input.value.trim();
    input.setCustomValidity(!value ? 'Enter ' + label + '.' : value.length > 80 ? 'Use 80 characters or fewer.' : '');
  }

  function updateRunMenu() {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a run';
    placeholder.disabled = true;
    runSelect.replaceChildren(placeholder, ...session.runs.map(run => {
      const option = document.createElement('option');
      option.value = run.id;
      option.textContent = 'Run ' + run.number + ' · ' + run.context.firmName + ' · '
        + run.context.tool + ' · ' + run.context.runDatetime.replace('T', ' ');
      return option;
    }));
    runSelect.value = session.activeRun?.id ?? '';
    byId('run-history').hidden = !session.runs.length;
    downloadRuns.disabled = !session.runs.length;
    downloadBackup.disabled = !session.runs.length;
    byId('export-context').textContent = session.runs.length
      ? 'Exports all ' + session.runs.length + (session.runs.length === 1 ? ' run' : ' runs')
        + ' in this tab, with the original questions and context on every row.'
      : 'Start a run to record and export your observations.';
    updateComparisonMenus();
  }

  function updateComparisonButton() {
    comparisonButton.disabled = session.runs.length < 2 || comparisonSelects.some(select => !select.value);
  }

  function clearComparison() {
    comparedPair = null;
    comparisonResults.hidden = true;
    byId('comparison-contexts').replaceChildren();
    byId('comparison-questions').replaceChildren();
    byId('comparison-firm').textContent = '';
    byId('comparison-notice').textContent = '';
    comparisonStatus.textContent = '';
  }

  function updateComparisonMenus() {
    const runs = session.runs;
    for (const [index, select] of comparisonSelects.entries()) {
      const selectedId = select.value;
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Choose run ' + (index === 0 ? 'A' : 'B');
      select.replaceChildren(placeholder, ...runs.map(run => {
        const option = document.createElement('option');
        option.value = run.id;
        option.textContent = 'Run ' + run.number + ' · ' + run.context.firmName + ' · '
          + run.context.tool + ' · ' + run.context.runDatetime;
        return option;
      }));
      select.value = runs.some(run => run.id === selectedId) ? selectedId : '';
      select.disabled = runs.length < 2;
    }
    byId('comparison-availability').textContent = runs.length < 2
      ? 'Start or import at least two runs to compare the same firm and saved questions.'
      : 'Choose Run A and Run B, then compare. Your selection order does not establish which searches came first.';
    if (comparedPair && comparedPair.some(id => !runs.some(run => run.id === id))) clearComparison();
    updateComparisonButton();
  }

  function comparisonDetails(entries) {
    const details = document.createElement('dl');
    details.className = 'comparison-details';
    for (const [label, value] of entries) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      group.append(term, description);
      details.append(group);
    }
    return details;
  }

  function renderComparison({ announce = false, focus = false } = {}) {
    if (!comparedPair) return;
    let comparison;
    try {
      comparison = compareRuns(...comparedPair.map(id => session.runs.find(run => run.id === id)));
    } catch (error) {
      clearComparison();
      comparisonStatus.textContent = error.message;
      return;
    }
    byId('comparison-results-title').textContent = 'Run ' + comparison.runs.a.number + ' and run '
      + comparison.runs.b.number + ' · question comparison';
    byId('comparison-firm').textContent = comparison.firmName + ' · '
      + comparison.plan.practiceArea + ' · ' + comparison.plan.location;
    byId('comparison-notice').textContent = comparison.warnings.join(' ')
      + ' Dates and time zones are shown as entered, without conversion or inferred chronology. '
      + 'This selected sample does not establish a trend, improvement, or cause.';
    byId('comparison-contexts').replaceChildren(...['a', 'b'].map(key => {
      const run = comparison.runs[key];
      const label = key.toUpperCase();
      const card = document.createElement('section');
      card.className = 'comparison-context';
      const title = document.createElement('h5');
      title.textContent = 'Run ' + label + ' · Run ' + run.number;
      const details = comparisonDetails([
        ['Firm website', run.context.firmWebsite],
        ['AI search tool', run.context.tool],
        ['Search mode and settings', run.context.searchContext.trim() ? run.context.searchContext : 'Not specified'],
        ['Search date and time', run.context.runDatetime],
        ['Time zone', run.context.timezone],
      ]);
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'button audit-button-secondary';
      view.textContent = 'View run ' + label;
      view.addEventListener('click', () => {
        if (session.activeRun?.id !== run.id) {
          session.selectRun(run.id);
          renderActiveRun();
        }
        byId('active-run-title').focus();
      });
      card.append(title, details, view);
      return card;
    }));
    byId('comparison-questions').replaceChildren(...comparison.rows.map(row => {
      const question = document.createElement('article');
      question.className = 'comparison-question';
      const title = document.createElement('h5');
      title.textContent = row.id + ' · ' + row.text;
      const values = document.createElement('div');
      values.className = 'comparison-values';
      for (const key of ['a', 'b']) {
        const entry = row[key];
        const side = document.createElement('section');
        const label = document.createElement('h6');
        label.textContent = 'Run ' + key.toUpperCase();
        const classification = value => value === null ? 'Not available' : CLASSIFICATIONS[value];
        side.append(label, comparisonDetails([
          ['Observation status', STATUSES[entry.status]],
          ['Firm mentioned', classification(entry.firmMentioned)],
          ['Firm website linked', classification(entry.firmWebsiteCited)],
        ]));
        values.append(side);
      }
      question.append(title, values);
      return question;
    }));
    comparisonResults.hidden = false;
    if (announce) comparisonStatus.textContent = 'Showing seven paired questions for Run A and Run B. Your saved entries and draft inputs are unchanged.';
    if (focus) byId('comparison-results-title').focus();
  }

  function updateSummary() {
    const run = session.activeRun;
    if (!run) return;
    const totals = summarizeRun(run);
    byId('observed-count').textContent = totals.observed;
    byId('untested-count').textContent = totals.untested;
    byId('error-count').textContent = totals.errors;
    const tally = values => values.yes + ' yes · ' + values.no + ' no · '
      + values.unclear + ' unclear · ' + values.unchecked + ' not checked';
    byId('mention-counts').textContent = tally(totals.mentions);
    byId('citation-counts').textContent = tally(totals.citations);
  }

  function observationCard(run, query) {
    const entry = run.observations[query.id];
    const card = document.createElement('details');
    card.className = 'observation-card';
    card.open = query.id === run.plan.queries[0].id;
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.className = 'observation-question';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'query-intent';
    eyebrow.textContent = query.id + ' · ' + query.intent;
    const questionText = document.createElement('span');
    questionText.textContent = query.text;
    title.append(eyebrow, questionText);
    const badge = document.createElement('span');
    badge.className = 'observation-state';
    summary.append(title, badge);
    const body = document.createElement('div');
    body.className = 'observation-fields';
    const controls = {};
    const stateHint = document.createElement('p');
    stateHint.className = 'field-hint observation-hint';
    stateHint.id = 'run-' + run.number + '-' + query.id + '-state-hint';

    function refreshState() {
      badge.textContent = STATUSES[entry.status];
      badge.dataset.status = entry.status;
      controls.firmMentioned.disabled = entry.status !== 'observed';
      controls.firmWebsiteCited.disabled = entry.status !== 'observed';
      stateHint.textContent = entry.status === 'observed'
        ? 'Check the answer and source links before choosing yes, no, or unclear. Leave anything unchecked as “Not checked.”'
        : entry.status === 'error'
          ? 'Save the error below. Search errors are excluded from response counts. Earlier classifications remain drafts.'
          : 'This question is untested. Entries stay as drafts and are excluded from response counts; no result is assumed.';
    }

    function addField(field, labelText, options = {}) {
      const wrapper = document.createElement('div');
      wrapper.className = 'planner-field' + (options.wide ? ' observation-wide' : '');
      const id = 'run-' + run.number + '-' + query.id + '-' + field;
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = labelText;
      const control = document.createElement(options.choices ? 'select' : options.multiline ? 'textarea' : 'input');
      control.id = id;
      control.name = field;
      if (options.choices) {
        for (const [value, text] of Object.entries(options.choices)) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          control.append(option);
        }
      } else if (options.multiline) {
        control.rows = options.rows ?? 3;
      } else control.type = 'text';
      control.value = entry[field];
      controls[field] = control;
      wrapper.append(label, control);
      if (options.hint) {
        const hint = document.createElement('p');
        hint.id = id + '-hint';
        hint.className = 'field-hint';
        hint.textContent = options.hint;
        control.setAttribute('aria-describedby', hint.id);
        wrapper.append(hint);
      }
      if (field === 'status') control.setAttribute('aria-describedby', stateHint.id);
      control.addEventListener(options.choices ? 'change' : 'input', () => {
        setObservation(run, query.id, field, control.value);
        if (field === 'status') refreshState();
        updateSummary();
        // Text drafts do not affect the comparison or trigger live-region announcements.
        if (options.choices && comparedPair?.includes(run.id)) renderComparison();
      });
      body.append(wrapper);
    }

    addField('status', 'Observation status', { choices: STATUSES, wide: true });
    body.append(stateHint);
    addField('firmMentioned', 'Was the firm mentioned?', { choices: CLASSIFICATIONS });
    addField('firmWebsiteCited', 'Was the firm’s website linked?', { choices: CLASSIFICATIONS });
    addField('sourceUrls', 'Source URLs shown', {
      multiline: true, hint: 'One URL per line. Include the actual source links from the AI search answer.',
    });
    addField('answerText', 'Answer excerpt or error', {
      multiline: true, hint: 'Paste the relevant answer or error. Keep a reference to the full response below.',
    });
    addField('accuracyNotes', 'Accuracy notes', {
      multiline: true, hint: 'What was accurate, incorrect, or still needs checking against the firm’s information?',
    });
    addField('evidenceReference', 'Evidence reference', {
      multiline: true, hint: 'For example, a saved response filename, screenshot reference, or share link.',
    });
    addField('nextAction', 'Next action', { multiline: true, rows: 2, wide: true });
    refreshState();
    card.append(summary, body);
    return card;
  }

  function renderActiveRun() {
    updateRunMenu();
    const run = session.activeRun;
    byId('active-run').hidden = !run;
    if (!run) return;
    byId('active-run-title').textContent = 'Run ' + run.number + ' · ' + run.context.firmName;
    const details = [
      ['Questions', run.plan.practiceArea + ' · ' + run.plan.location],
      ['Firm website', run.context.firmWebsite],
      ['AI search tool', run.context.tool],
      ['Search date and time', run.context.runDatetime.replace('T', ' ') + ' · ' + run.context.timezone],
      ['Search settings', run.context.searchContext || 'Not specified'],
    ];
    byId('active-run-context').replaceChildren(...details.map(([label, text]) => {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = text;
      group.append(term, description);
      return group;
    }));
    byId('observation-list').replaceChildren(...run.plan.queries.map(query => observationCard(run, query)));
    updateSummary();
  }

  for (const [input, label] of [[practiceInput, 'a practice area'], [locationInput, 'a location']]) {
    input.addEventListener('input', () => {
      validateInput(input, label);
      revision += 1;
      planDirty = true;
      buttons.forEach(button => { button.disabled = true; });
      startRun.disabled = true;
      manualCopy.hidden = true;
      status.textContent = 'Inputs changed. Build the query plan before starting a new run. Existing runs remain available below.';
      byId('run-plan-context').textContent = 'The practice area or location has changed. Build the query plan above before starting another run.';
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    validateInput(practiceInput, 'a practice area');
    validateInput(locationInput, 'a location');
    if (!form.reportValidity()) return;
    session.setPlan(createPlan(practiceInput.value, locationInput.value));
    revision += 1;
    planDirty = false;
    renderQueries();
    renderActiveRun();
    heading.textContent = 'Your manual query plan';
    context.textContent = session.plan.practiceArea + ' in ' + session.plan.location
      + '. These seven questions will be copied into each new run.';
    manualCopy.hidden = true;
    buttons.forEach(button => { button.disabled = false; });
    startRun.disabled = false;
    runSetup.open = true;
    status.textContent = 'Seven questions ready. Previous runs keep their original questions and entries in the recorder below.';
    heading.focus();
  });

  byId('copy-queries').addEventListener('click', async () => {
    const text = session.plan.queries.map(query => query.text).join('\n\n');
    const copiedRevision = revision;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (revision !== copiedRevision) return;
      manualCopy.hidden = true;
      status.textContent = 'Seven queries copied. Paste and run them separately in your chosen AI search tool.';
    } catch {
      if (revision !== copiedRevision) return;
      copyText.value = text;
      manualCopy.hidden = false;
      copyText.focus();
      copyText.select();
      status.textContent = 'Automatic copy was unavailable. The queries are selected below; use your device’s Copy command.';
    }
  });

  function download(contents, type, filename, output, message) {
    let url;
    try {
      url = URL.createObjectURL(new Blob([contents], { type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      output.textContent = message;
    } catch {
      output.textContent = 'The download could not start. Your entries remain in this tab; try again before closing it.';
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  byId('download-csv').addEventListener('click', () => {
    download(createCsv(session.plan), 'text/csv;charset=utf-8', 'law-firm-ai-search-audit.csv', status,
      'Blank CSV download requested. Use the recorder below to enter and export completed observations.');
  });
  byId('download-checklist').addEventListener('click', () => {
    download(createChecklist(session.plan), 'text/plain;charset=utf-8', 'law-firm-ai-search-audit-checklist.txt', status,
      'Checklist download requested. It includes the seven questions from the current plan.');
  });

  runForm.addEventListener('submit', event => {
    event.preventDefault();
    if (planDirty || !runForm.reportValidity()) return;
    const contextData = Object.fromEntries(new FormData(runForm));
    try {
      session.startRun(contextData);
    } catch (error) {
      announceRecorder(error.message);
      return;
    }
    renderActiveRun();
    runSetup.open = false;
    byId('run-datetime').value = '';
    announceRecorder('Run ' + session.activeRun.number + ' started with all questions untested. '
      + 'Its questions and context are fixed; earlier runs are still available.');
    byId('active-run-title').focus();
  });

  runSelect.addEventListener('change', () => {
    session.selectRun(runSelect.value);
    renderActiveRun();
    announceRecorder('Showing run ' + session.activeRun.number + ' with its original questions, context, and entries.');
  });

  for (const select of comparisonSelects) {
    select.addEventListener('change', () => {
      clearComparison();
      updateComparisonButton();
    });
  }

  comparisonForm.addEventListener('submit', event => {
    event.preventDefault();
    if (session.runs.length < 2 || comparisonSelects.some(select => !select.value)) {
      clearComparison();
      comparisonStatus.textContent = 'Choose two saved runs to compare.';
      return;
    }
    comparedPair = comparisonSelects.map(select => select.value);
    renderComparison({ announce: true, focus: true });
  });

  byId('reuse-run-plan').addEventListener('click', () => {
    const previous = session.activeRun;
    if (!previous) return;
    session.setPlan(previous.plan);
    practiceInput.value = session.plan.practiceArea;
    locationInput.value = session.plan.location;
    practiceInput.setCustomValidity('');
    locationInput.setCustomValidity('');
    revision += 1;
    planDirty = false;
    renderQueries();
    renderActiveRun();
    heading.textContent = 'Saved query plan';
    context.textContent = 'The seven original questions from run ' + previous.number + ' are ready for a new run.';
    buttons.forEach(button => { button.disabled = false; });
    startRun.disabled = false;
    manualCopy.hidden = true;
    runSetup.open = true;
    byId('run-datetime').value = '';
    status.textContent = 'Saved questions selected exactly as recorded. New observations will start untested.';
    announceRecorder('Using the original questions from run ' + previous.number
      + '. Check the firm and search context below and enter the new search date before starting. Earlier entries are unchanged.');
    byId('run-firm-name').focus();
  });

  downloadRuns.addEventListener('click', () => {
    if (!session.runs.length) return;
    download(createRunsCsv(session.runs), 'text/csv;charset=utf-8', 'law-firm-ai-search-observations.csv', recorderStatus,
      'CSV download requested for every run in this tab. Check the file before closing or reloading the page.');
  });

  downloadBackup.addEventListener('click', () => {
    if (!session.runs.length) return;
    try {
      download(createRunsBackup(session.runs), 'application/json;charset=utf-8',
        'quotedfirst-ai-search-runs-' + new Date().toISOString().slice(0, 10) + '.json', backupStatus,
        'Runs backup download requested. Keep this JSON file to import on a later visit. Download an updated copy after making changes.');
    } catch (error) { backupStatus.textContent = error.message; }
  });

  backupFile.addEventListener('change', async () => {
    const selectedFile = backupFile.files[0];
    const selectedRevision = ++importRevision;
    pendingBackup = null;
    confirmImport.disabled = true;
    backupReview.hidden = !selectedFile;
    if (!selectedFile) return;
    // Reset the picker so selecting the same file again can retry after an error or cancel.
    backupFile.value = '';
    byId('backup-review-text').textContent = 'Reading ' + selectedFile.name + '…';
    backupStatus.textContent = '';
    try {
      if (selectedFile.size > BACKUP_LIMITS.bytes) throw new Error('Choose a backup of 5 MiB or less. No runs were changed.');
      const bytes = await selectedFile.arrayBuffer();
      if (selectedRevision !== importRevision) return;
      const backup = parseRunsBackup(bytes);
      const preview = session.previewImport(backup);
      pendingBackup = backup;
      byId('backup-review-text').textContent = selectedFile.name + ': ' + preview.total
        + (preview.total === 1 ? ' run' : ' runs') + ' in the file. ' + preview.added + ' will be added; '
        + preview.skipped + ' exact ' + (preview.skipped === 1 ? 'duplicate' : 'duplicates') + ' will be skipped. '
        + 'Original run IDs stay the same; display numbers may change.';
      confirmImport.textContent = preview.added ? 'Import ' + preview.added + (preview.added === 1 ? ' run' : ' runs') : 'Confirm duplicates';
      confirmImport.disabled = false;
      backupStatus.textContent = 'Backup checked. Review the file above, then confirm or cancel. Nothing has been imported yet.';
    } catch (error) {
      if (selectedRevision !== importRevision) return;
      byId('backup-review-text').textContent = selectedFile.name + ' could not be imported.';
      backupStatus.textContent = error.message;
    }
  });

  byId('cancel-import').addEventListener('click', () => {
    importRevision += 1;
    pendingBackup = null;
    backupFile.value = '';
    backupReview.hidden = true;
    confirmImport.disabled = true;
    backupStatus.textContent = 'Import cancelled. Your runs and entries are unchanged.';
    backupFile.focus();
  });

  confirmImport.addEventListener('click', () => {
    if (!pendingBackup) return;
    try {
      const result = session.importRuns(pendingBackup);
      importRevision += 1;
      pendingBackup = null;
      backupReview.hidden = true;
      confirmImport.disabled = true;
      // Preserve the selected run and unsaved plan/context form inputs.
      updateRunMenu();
      backupStatus.textContent = 'Import complete: ' + result.added + ' added; ' + result.skipped
        + ' exact duplicates skipped. Choose a run below to view its entries. Download an updated backup before leaving.';
      (session.runs.length ? runSelect : backupFile).focus();
    } catch (error) {
      pendingBackup = null;
      confirmImport.disabled = true;
      backupStatus.textContent = error.message + ' Choose the file again to review it against your current entries.';
    }
  });

  byId('run-timezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  renderQueries();
  updateRunMenu();
  practiceInput.disabled = false;
  locationInput.disabled = false;
  byId('build-plan').disabled = false;
  byId('interactive-planner').hidden = false;
  byId('interactive-recorder').hidden = false;
  actions.hidden = false;
}

if (typeof document !== 'undefined') initializePlanner();
