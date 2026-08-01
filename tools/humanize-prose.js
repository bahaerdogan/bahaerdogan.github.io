#!/usr/bin/env node
/**
 * One-time prose pass over the machine-written articles.
 *
 * The tell in these pieces was never vocabulary — a scan for "Additionally",
 * "Furthermore", "In conclusion" and friends turned up 0–2 hits per article.
 * It was shape: a two-to-ten-word stub paragraph ("Enabled by:", "Technologies
 * used:", "Popular stacks include:") followed by a bullet list of proper nouns.
 * `AgenticAiTechDepth` ran 49 <li> against 26 <p>. That is a table of contents
 * for an article, not an article.
 *
 * Each replacement below converts one stub-plus-list into prose of comparable
 * length, so reading time holds. Headings, ids, SEO keywords and every factual
 * claim are preserved; the ReWOO/ReAct corrections from the earlier pass are
 * untouched.
 *
 * Idempotent: a pair whose `from` is already gone is skipped and reported.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** [file, from, to] — `from` must match the built (minified) markup exactly. */
const EDITS = [
  // ---------- AgenticAiTechDepth ----------
  ['AgenticAiTechDepth.html',
    '<p>Agentic AI can interface with external tools and environments to:</p><ul><li>Fetch real-time data</li><li>Send emails</li><li>Schedule events</li><li>Trigger CI/CD pipelines</li></ul><p>Enabled by:</p><ul><li>Function calling APIs (OpenAI tools, LangChain, Semantic Kernel)</li><li>Code interpreters (OpenAI Code Interpreter, Azure Container Apps dynamic sessions, sandboxed Python REPLs)</li><li>External action wrappers (Selenium, Postman APIs)</li></ul><p>Agents must also validate, sandbox, and permission-check before executing real-world actions.</p>',
    '<p>A planner that cannot act is just a text generator. What makes an agentic AI system agentic is the tool layer: the ability to fetch live data, send mail, schedule an event, or trigger a CI/CD pipeline. In practice that is built on function-calling APIs — OpenAI\'s tool interface, LangChain, Semantic Kernel — which hand the model a typed schema and let it choose the call. Where a task needs computation rather than a fixed endpoint, a sandboxed code interpreter takes over, whether that is OpenAI\'s, a dynamic session in Azure Container Apps, or a locked-down Python REPL. Anything the vendor never anticipated gets wrapped by hand, usually with Selenium or a Postman collection.</p><p>The interesting engineering is not the calling, though. It is what happens immediately before it. A tool invocation is a side effect on somebody\'s real system, so arguments have to be validated against the schema rather than trusted, execution has to be sandboxed, and the action has to be permission-checked against what this particular agent is allowed to touch. Skip any of the three and the failure mode stops being a wrong answer. It becomes a wrong action that has already happened.</p>'],

  ['AgenticAiTechDepth.html',
    '<p>Agentic systems include memory types such as:</p><ul><li><strong>Short-term memory:</strong> Session-level state retention</li><li><strong>Long-term memory:</strong> User preferences, world models</li><li><strong>Episodic memory:</strong> Logs of previous decisions and outcomes</li></ul><p>Technologies used:</p><ul><li>Vector databases (Pinecone, Weaviate, Qdrant)</li><li>Graph stores (Neo4j)</li><li>In-memory caches (Redis)</li></ul><p>Well-managed memory ensures consistent context in complex workflows.</p>',
    '<p>Memory is what separates an agent from a stateless prompt, and it is rarely one thing. Short-term memory holds session state — the working set for the task currently in flight. Long-term memory carries what should outlive the session: user preferences, and whatever world model the system has accumulated. Episodic memory is the one teams most often skip and later wish they had, because it logs prior decisions together with how they turned out, which is the only substrate a reflection step can actually learn from.</p><p>The storage choices follow from the access pattern rather than from fashion. Semantic recall over unstructured history goes to a vector database such as Pinecone, Weaviate or Qdrant. Relationships that need traversal rather than similarity — who reports to whom, what depends on what — belong in a graph store like Neo4j. Session state that is hot, small and disposable sits in Redis. Get the split wrong and the symptom is subtle: the agent stays fluent while quietly losing the thread across a long workflow.</p>'],

  ['AgenticAiTechDepth.html',
    '<p>Developers orchestrate agents with patterns such as:</p><ul><li>Task Runners (e.g., Airflow, LangChain Agents)</li><li>Dynamic Task Routing</li><li>Feedback Loops for quality assessment</li><li>Meta Agents to coordinate and monitor subagents</li></ul><p>Popular stacks include:</p><ul><li><strong>LangChain + Azure OpenAI + Cosmos DB:</strong> Enterprise-level orchestration</li><li><strong>AutoGen + VS Code + Python Tooling:</strong> For custom developer tools</li><li><strong>CrewAI + Pinecone + Zapier:</strong> Business automation across SaaS</li></ul>',
    '<p>Orchestration is where agentic systems start to resemble ordinary distributed systems, and where the familiar rules reassert themselves. A task runner — Airflow, or LangChain\'s own agent executor — gives you a place to put retries, timeouts and a durable record of what ran. Dynamic routing sends a step to whichever agent is specialised for it instead of forcing one generalist to do everything. Feedback loops grade output before it is committed, and a meta agent supervises the subagents rather than doing the work itself. None of this is novel; it is a scheduler, a load balancer, a health check and a supervisor tree, wearing new names.</p><p>Stacks tend to assemble along the same three axes: a framework, a model endpoint, and somewhere to keep state. LangChain with Azure OpenAI and Cosmos DB is the shape enterprises land on, largely because the compliance story is already written. AutoGen alongside VS Code and ordinary Python tooling suits developer-facing agents, where the loop is tight and the operator is technical. CrewAI with Pinecone and Zapier covers business automation across SaaS, where most of the difficulty is integration surface rather than reasoning.</p>'],

  ['AgenticAiTechDepth.html',
    '<p>To ensure reliability and transparency, agent developers focus on:</p><ul><li><strong>Interruptibility:</strong> Human-in-the-loop controls</li><li><strong>Explainability:</strong> Transparent and traceable logic</li><li><strong>Observability:</strong> Logging, dashboards, and telemetry</li><li><strong>Scalability:</strong> Stateless services and shared memory</li></ul>',
    '<p>Four properties decide whether an agentic system survives contact with production. Interruptibility comes first: a long-running agent needs a point where a human can stop it, and that point has to exist by design rather than as a kill switch on the process. Explainability means the decision trace is inspectable after the fact, because "the model chose to" is not an answer anyone can act on. Observability is the ordinary discipline — logs, dashboards, telemetry — applied to a component whose control flow is decided at runtime, which makes it more necessary here, not less. Scalability, finally, pushes toward stateless services over shared memory, so that the agent process can be replaced without taking its accumulated context with it.</p>'],

  ['AgenticAiTechDepth.html',
    '<p>Looking forward, expect advances such as:</p><ul><li>Unified memory across symbolic and vector spaces</li><li>Adaptive planners building reusable strategies</li><li>Agent marketplaces for cooperation and capability exchange</li><li>Self-healing agents with runtime learning</li></ul>',
    '<p>The near-term work is mostly consolidation rather than invention. Memory is still split between symbolic stores and vector spaces, and unifying the two so a single query can reach both is an obvious missing piece. Planners today rebuild strategies they have already discovered, which is why adaptive planning that caches and reuses a working plan is a more valuable direction than a larger model. Beyond that the picture is less certain: agent marketplaces for exchanging capabilities, and agents that repair their own failure paths at runtime, are both plausible and both a long way from anything that would pass review.</p>'],

  // ---------- TypesOfAgenticAi: marketing register in the pull quote ----------
  ['TypesOfAgenticAi.html',
    'Agentic systems are not one-of-a-kind—they are modular, goal-oriented, and built for impact. Recognizing their varieties and processes unlocks the roadmap from prototype to production.',
    'Agentic systems are not monolithic. They are modular and goal-oriented, and the differences between the types are what decide which one survives production.'],

  ['TypesOfAgenticAi.html', 'This report is more than definitions.', 'What follows is the practical view: what each type is for, and where each one breaks.'],

  // ---------- Phrase-level tells elsewhere ----------
  ['PreciousMetalData.html',
    'In an era defined by rapid technological innovation and digital transformation, we are constantly surrounded by emerging technologies—artificial intelligence, smart devices, machine learning, and more. These innovations are not only reshaping how we live and work but are also generating an unprecedented volume of information every second.',
    'Buy a television today and the specification sheet will tell you about the panel and the processor. What it will not tell you is that the set reports back — what you watched, for how long, and when you stopped. That data is worth more to the manufacturer than the margin on the hardware, and the same trade now sits underneath most consumer technology.'],

  ['WhyToLearnHistory.html', 'Furthermore, ', 'What follows from that is simple: '],
  ['DeservingMoney.html', 'delve into', 'work through'],
  ['AgenticAiExplained.html', 'paradigm shift', 'shift in how these systems are built'],
];

let applied = 0;
let already = 0;
const missing = [];

for (const [file, from, to] of EDITS) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) { missing.push(`${file} (no such file)`); continue; }
  const before = fs.readFileSync(p, 'utf8');

  if (before.includes(from)) {
    fs.writeFileSync(p, before.split(from).join(to), 'utf8');
    applied++;
  } else if (before.includes(to.slice(0, 60))) {
    already++;
  } else {
    missing.push(`${file}: "${from.slice(0, 60)}…"`);
  }
}

console.log(`Prose pass: ${applied} applied, ${already} already present`);
if (missing.length) {
  console.warn('  ⚠ could not match:');
  missing.forEach((m) => console.warn('    ' + m));
  process.exitCode = 1;
}
