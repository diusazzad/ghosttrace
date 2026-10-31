# TASK 02 — সম্পূর্ণ Forensic Workflow Implementation
# GhostTrace — TASK 02: Complete Product Workflow Implementation

## ১. তোমার দায়িত্ব
তুমি একজন Senior Full-Stack Engineer, AI Engineer, Agent Workflow Architect এবং UI Engineer হিসেবে কাজ করবে।

Repository:
https://github.com/diusazzad/ghosttrace

Current branch:
`feat/task-02-core-product-workflow`

এই branch ইতোমধ্যে সর্বশেষ অনুমোদিত MongoDB security commit `abe130d` থেকে তৈরি করা হয়েছে।

আমাদের পূর্ববর্তী কাজ:
- Next.js 16 + React 19 dashboard
- Deterministic Trace Detector
- Waterfall Timeline
- 8 Synthetic Trace Fixtures
- Gemma Adapter
- Mastra 4-step Workflow
- Regression Test Generator
- Auth0 integration
- MongoDB owner isolation

এগুলো নতুন করে তৈরি করবে না। বিদ্যমান implementation পরীক্ষা করে সেগুলোকে একটি সম্পূর্ণ কার্যকর product-এ যুক্ত করবে।

## ২. এই Task-এর মূল লক্ষ্য
একটি AI Agent failure trace নির্বাচন করার পর GhostTrace স্বয়ংক্রিয়ভাবে সম্পূর্ণ investigation report তৈরি করবে।

সম্পূর্ণ workflow:
Trace Selection
→ Schema Validation
→ Timeline Reconstruction
→ Failure Detection
→ Mastra Workflow
→ Real Open-Weight AI Investigation
→ Evidence Validation
→ Incident Report
→ Regression Test Suggestion
→ Dashboard Rendering

**একটি user action থেকে পুরো workflow কাজ করতে হবে।**
আলাদা আলাদা static বা mock result দেখিয়ে কাজ সম্পন্ন হয়েছে বলা যাবে না।

## ৩. TASK 02.0 — Git ও Branch Verification
প্রথমে:
1. Repository-এর বর্তমান branch যাচাই করো।
2. নিশ্চিত করো তুমি `feat/task-02-core-product-workflow` branch-এ আছ।
3. Remote branch-এর সর্বশেষ SHA যাচাই করো।
4. Base commit `abe130d` এবং আগের Auth0 ও MongoDB security changes সংরক্ষিত আছে কি না পরীক্ষা করো।
5. `git status` পরীক্ষা করো।
6. কোনো uncommitted user change থাকলে সেগুলো overwrite করবে না।

কোনো branch mismatch বা missing commit পাওয়া গেলে আগে রিপোর্ট করবে।
কোনো reset, force-push বা history rewrite করবে না।

## ৪. TASK 02.1 — বর্তমান Application-এর Workflow বুঝে নাও
শুধু প্রয়োজনীয় source files পরীক্ষা করো:
- `src/components/forensics/ForensicDashboard.tsx`
- `src/lib/detector.ts`
- `src/lib/ai/gemmaAdapter.ts`
- `src/lib/workflows/forensicWorkflow.ts`
- `src/lib/testGenerator.ts`
- `src/app/api/traces/analyze/route.ts`
- `src/app/api/traces/hypothesize/route.ts`
- `src/app/api/traces/workflow/route.ts`
- `src/lib/db/traceRepository.ts`

প্রকৃত implementation অনুসারে ছোট একটি data-flow map তৈরি করো।
প্রতিটি function ও API-এর বাস্তব কাজ চিহ্নিত করো।
README বা comments দেখে কোনো feature সম্পন্ন বলে ধরে নেবে না।

## ৫. TASK 02.2 — সম্পূর্ণ End-to-End Workflow তৈরি করো
প্রথম demo হিসেবে বিদ্যমান:
`Fixture 04: Unhandled Tool Crash`
ব্যবহার করতে পারো।

নিচের ধাপগুলো কার্যকর করতে হবে।

### Step 1 — Trace Selection
Dashboard থেকে ব্যবহারকারী একটি failure fixture নির্বাচন করতে পারবে।

### Step 2 — Schema Validation
Trace-এর structure, event IDs, timestamps, required fields এবং supported data types যাচাই করবে।
Invalid input হলে পরিষ্কার error দেখাবে।

### Step 3 — Deterministic Analysis
বিদ্যমান detector ব্যবহার করে:
- Timeline তৈরি।
- Failed tool শনাক্ত।
- Anomaly শনাক্ত।
- Execution duration নির্ণয়।
- Retry ও error event বিশ্লেষণ।

### Step 4 — Mastra Workflow
বর্তমান চারটি Mastra step ব্যবহার করে সম্পূর্ণ workflow চালাও।
প্রত্যেকটি step প্রকৃতপক্ষে execute হতে হবে।
প্রতিটি step-এর:
- Execution status
- Input/output summary
- Duration
- Error state
সংরক্ষণ বা report করো।
শুধু চারটি step-এর নাম দেখালেই কাজ সম্পন্ন হবে না।

### Step 5 — Gemma Investigation
বিদ্যমান Gemma adapter ব্যবহার করো।
প্রথম পছন্দ:
Local Ollama Gemma, যদি উপযুক্ত model উপলভ্য থাকে।
বিকল্প:
Configured Backboard Gemma provider।

Model-কে দেওয়া তথ্য:
- Original trace events
- Deterministic findings
- Failure metadata
- Timeline

Model-এর দায়িত্ব:
- সম্ভাব্য Root Cause ব্যাখ্যা।
- Supporting event IDs প্রদান।
- সম্ভাব্য remediation প্রস্তাব।
- Uncertainty প্রকাশ।

### গুরুত্বপূর্ণ নিয়ম
Deterministic fallback-কে কখনো Gemma inference হিসেবে দেখাবে না।
Result-এ প্রকৃত metadata থাকবে:
`provider`
`model`
`executionMode`
`latencyMs`
`fallbackReason`

Credentials না থাকলে deterministic workflow সম্পূর্ণ কার্যকর রাখবে এবং live inference blocker হিসেবে রিপোর্ট করবে।

## ৬. TASK 02.3 — Evidence Validation
AI যে event IDs উদ্ধৃত করবে, সেগুলো original trace-এর মধ্যে আছে কি না যাচাই করতে হবে।
দুটি বিষয় আলাদা রাখতে হবে:
1. `event_reference_valid`
2. `causal_claim_unverified`

Event ID থাকলেই AI-এর Root Cause সত্য প্রমাণিত হয়েছে বলা যাবে না।
Unsupported finding, missing evidence এবং contradictory event-এর ক্ষেত্রে Human Review warning দেখাবে।
AI hypothesis এবং deterministic findings আলাদা করে দেখাবে।

## ৭. TASK 02.4 — Regression Test Suggestion
বর্তমান `testGenerator.ts` পুনর্ব্যবহার করবে।
Generated test-এ:
- Original trace ID reference থাকবে।
- Failure scenario ব্যাখ্যা থাকবে।
- Expected behaviour থাকবে।
- Regression test suggestion থাকবে।

Untrusted `agentName`, `toolName`, `traceId` সরাসরি TypeScript identifier বা import path হিসেবে বসানো যাবে না।
Test compile ও execute না হলে সেটিকে `Test Blueprint` হিসেবে দেখাবে। Runnable test বলে দাবি করবে না।
ব্যবহারকারী যেন suggestion copy বা download করতে পারে।

## ৮. TASK 02.5 — Dashboard Integration
বর্তমান Dark UI এবং Laminar-inspired dashboard design বজায় রাখবে।
বড় UI redesign করবে না।

একটি investigation সম্পন্ন হলে dashboard-এ দেখাবে:
1. Selected Agent Trace
2. Execution Timeline
3. Failed Tool Call
4. Root Cause Analysis
5. Real Model / Provider Name
6. Mastra Execution Steps
7. Evidence References
8. Uncertainty Warnings
9. Suggested Remediation
10. Regression Test Suggestion
11. Investigation Status
12. Save Status

সব component একই investigation execution result থেকে data নেবে।
ভিন্ন ভিন্ন mock result ব্যবহার করা যাবে না।

## ৯. TASK 02.6 — Persistence ও Authentication
আগের Auth0 ও MongoDB security implementation অক্ষত রাখতে হবে।
- Authenticated user নিজের investigation save করতে পারবে।
- Owner ID server-side verified session থেকে নিতে হবে।
- Client-provided ownerId কখনো বিশ্বাস করা যাবে না।
- Anonymous cloud save/history চালু করা যাবে না।
- MongoDB না থাকলে result-কে `volatile` বা `not saved` হিসেবে দেখাবে।
- Synthetic fixtures read-only demo হিসেবে ব্যবহার করা যাবে।

এই Task-এ নতুন MongoDB migration প্রয়োজন নেই।

## ১০. TASK 02.7 — UI ও Product Smoke Test
কমপক্ষে একটি complete scenario manually চালাবে।
পরীক্ষা:
1. Dashboard খুলবে।
2. Fixture 04 নির্বাচন করবে।
3. Analyze করবে।
4. Timeline তৈরি হবে।
5. Mastra workflow execute হবে।
6. Gemma অথবা স্পষ্টভাবে চিহ্নিত fallback output আসবে।
7. Evidence validation দেখাবে।
8. Regression test suggestion তৈরি হবে।
9. Final report dashboard-এ render হবে।

সম্পূর্ণ workflow-এর screenshot তৈরি করবে।

## ১১. TASK 02.8 — Quality Gates
প্রতিটি ছোট পরিবর্তনের পরে পুরো test suite চালিয়ে সময় নষ্ট করবে না।
প্রথমে সংশ্লিষ্ট focused test চালাবে।

সম্পূর্ণ workflow তৈরি হওয়ার পরে চালাবে:
`pnpm typecheck`
`pnpm lint`
`pnpm test`
`pnpm build`

Actual terminal output রিপোর্ট করবে।
পুরোনো test দুর্বল করে test pass করানো যাবে না।
অপ্রয়োজনীয় নতুন test suite তৈরি করবে না।

## ১২. এই Task-এ যা করবে না
- Entire integration শুরু করবে না।
- Ultramarine integration শুরু করবে না।
- Backboard integration নতুন করে লিখবে না।
- Browserbase, Temporal বা Tiger Data শুরু করবে না।
- নতুন database architecture তৈরি করবে না।
- পুরো UI redesign করবে না।
- ৫০–১০০টি নতুন benchmark fixture তৈরি করবে না।
- Production migration চালাবে না।
- Production deployment করবে না।
- Pull Request merge করবে না।

বর্তমান product workflow সম্পূর্ণ করাই একমাত্র লক্ষ্য।

## ১৩. Git কাজ
সব পরিবর্তনের পরে:
1. সম্পূর্ণ Git diff inspect করো।
2. Secret বা environment files যেন commit না হয়।
3. Relevant tests এবং full quality gates সফল করো।
4. Branch-এ একটি coherent commit তৈরি করো।
5. GitHub-এ branch push করো।

Branch:
`feat/task-02-core-product-workflow`

কোনো force-push বা merge নয়।

## ১৪. Final Report
বাংলায় রিপোর্ট দেবে:
1. Branch এবং base SHA।
2. ব্যবহৃত fixture।
3. Complete workflow-এর execution evidence।
4. Mastra-এর চারটি step-এর প্রকৃত ফলাফল।
5. Real Gemma inference হয়েছে কি না।
6. প্রকৃত model ও provider।
7. Evidence validation result।
8. Generated test-এর compile/run status।
9. Dashboard screenshots।
10. Changed files।
11. Typecheck, lint, test এবং build-এর actual output।
12. Commit SHA ও GitHub branch URL।
13. কোন কাজ সম্পূর্ণ হয়েছে এবং কোনটি বাকি।
