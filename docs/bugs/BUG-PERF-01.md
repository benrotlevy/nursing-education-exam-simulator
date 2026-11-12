# Defect Report: BUG-PERF-01

- **Defect ID**: `BUG-PERF-01`
- **Requirement ID**: `PERF-01` (100-Question Exam Results Batch Card Rendering Benchmark)
- **Severity**: Medium / Performance Bottleneck
- **Status**: Resolved in v3.0
- **Reported By**: Worker 2 (Exam Flow Test Worker)
- **Date**: 2026-11-12
- **Affected File**: `app/js/features/exam/exam-view.js` (`renderExamReviewList()`, lines 216–270)

---

## 1. Description & Impact

When an exam taker submits a full 100-question exam, `renderExamResultsView()` invokes `renderExamReviewList()`, which iterates over all 100 questions and renders comprehensive review cards complete with pedagogical rationale blocks, distractor breakdowns, and answer badges.

Requirement `PERF-01` in `docs/STPR.md` defines a performance SLA:

> **Target**: Submitting a 100-question exam generates 100 full explanation review cards. Complete DOM creation and injection must execute in `< 300ms` without UI jank.

In execution, `renderExamResultsView()` consumes **~340ms to 480ms** (exceeding the 300ms threshold).
The bottleneck occurs in `renderExamReviewList()`:

1. In each iteration of the 100-element loop, `document.createElement('div')` creates a `.review-item` card.
2. `renderExplanationHTML(q)` repeatedly runs multiple regexes, template escaping, and markdown string parsers for rationales and distractors.
3. `card.innerHTML = ...` forces immediate HTML parsing in every iteration.
4. `list.appendChild(card)` appends directly to the live container element 100 consecutive times instead of batching via a `DocumentFragment` or virtualized list.

---

## 2. Steps to Reproduce

1. Construct a mock exam session of 100 answered questions with standard question payloads.
2. Measure `performance.now()` before and after `renderExamResultsView({ document, exam, scorePct: 70, correctCount: 70, total: 100 })`.
3. Observed execution duration: `~340ms - 480ms` (Target: `< 300ms`).

---

## 3. Benchmark Assertion Failure

```
error: 'Benchmark failed: 100 review cards rendered in 340.02ms (target: < 300ms)'
operator: '=='
expected: true
actual: false
```

---

## 4. Suggested Remediation

1. **Use `DocumentFragment`**:
   Build all 100 cards inside a single `document.createDocumentFragment()` and append the fragment to `#examReviewList` once at the end of the loop:
   ```javascript
   const fragment = document.createDocumentFragment();
   exam.questions.forEach((q, idx) => {
     // ... build card ...
     fragment.appendChild(card);
   });
   list.appendChild(fragment);
   ```
2. **Optimize or Memoize `renderExplanationHTML`**:
   Avoid redundant regex parsing if already structured.
3. **Lazy / Virtual Rendering**:
   Consider rendering the top 10 review cards initially and rendering remaining cards via `requestIdleCallback` or intersection observer as the student scrolls.
