---
name: clean-code
description: "Design, implement, refactor, or review maintainable code using Clean Code principles: KISS, meaningful names, focused functions and classes, explicit boundaries, error handling, tests, pragmatic SOLID, and proportionate validation. Use for any non-trivial code change, refactor, bug fix, reusable component, accessibility adjustment, or code-quality review, especially when preventing duplication, coupling, over-abstraction, hidden side effects, or static-analysis regressions matters."
---

# Code propre

Apply this workflow before editing and again before delivery. Prefer the smallest clear change that solves the observed problem. Treat the codebase as a shared place: leave the touched area clearer than before.

Read [the detailed principles](references/clean-code-principles.md) when designing a non-trivial change, reviewing code, or resolving a trade-off. Do not turn every guideline into a rigid rule; preserve readability, behavior, and project conventions.

## Design before code

1. State the observable behavior to preserve and the exact behavior to change.
2. Identify the affected boundary: caller, domain/service, persistence/API, UI, and tests. Do not change an unneeded boundary.
3. Choose the simplest design that can be changed safely:
   - Implement one local, stable behavior directly.
   - Extract a function, class, or component when a distinct responsibility is repeated or obscured.
   - Introduce an interface, pattern, or generic abstraction only for a real dependency or known variation.
4. Work in small, reviewable increments. Keep the system runnable and tests passing after each meaningful increment.

## Implement clearly

- Name values, functions, classes, components, and tests after intent. Avoid vague placeholders such as `data`, `handler`, `util`, or `manager` unless the scope makes their meaning unmistakable.
- Keep functions short, at one abstraction level, and focused on one thing. Prefer no argument; avoid boolean control flags. Separate command from query and make side effects explicit.
- Prefer guard clauses and straightforward control flow over deep nesting. Delete dead code and misleading comments.
- Make comments explain a non-obvious decision, constraint, or consequence; make the code explain what it does. Never use a comment to excuse unclear code.
- Keep public APIs narrow. Hide implementation details, avoid mutable global state, and keep data ownership explicit.
- Keep domain rules out of templates, controllers, and UI callbacks. Keep rendering, orchestration, business rules, and I/O separate.
- Remove duplication only when the repeated behavior is stable. Do not create a generic abstraction for a single use case.
- Preserve established project conventions before introducing a second implementation pattern.

## Apply boundaries and SOLID pragmatically

- Keep one unit responsible for one reason to change; extract responsibilities, not arbitrary line counts.
- Depend on the smallest useful contract. Inject external infrastructure when it makes business logic testable or replaceable.
- Preserve contracts when substituting an implementation. Keep data structures and objects honest about their role.
- Wrap third-party APIs at a boundary when their details would otherwise spread through the application. Keep framework code from leaking into the domain.
- Handle failures deliberately: use exceptions or explicit result types consistently, add useful context, and do not return `null` or sentinel values for ordinary failure paths when they obscure the contract.

## Build accessible UI honestly

- Use native semantic HTML first. Use ARIA only to express behavior native HTML cannot express.
- Add `tabindex` only to controls or deliberately focus-managed elements. Do not make static containers focusable merely to address a perceived accessibility concern.
- Prefer semantic elements such as `button`, `a`, `nav`, `main`, `section`, and `dialog` over redundant ARIA roles.
- Keep interaction behavior, visual style, and server state separate. Reuse an existing component only when its responsibility matches.

## Verify before delivery

1. Add or update the smallest meaningful automated test. Keep tests independent, readable, fast, repeatable, and timely.
2. Read the diff. Remove accidental changes, dead code, duplicate branches, unrelated formatting, and unnecessary complexity.
3. Run the narrowest relevant checks first, then the project lint, build, and test commands required by the touched area.
4. Treat static-analysis and accessibility warnings as design feedback. Understand the rule and correct the implementation; never silence a warning without a documented, valid exception.
5. Report what changed, checks run, and any remaining limitation or assumption.

## Review questions

- Can a new developer explain this code without knowing its history?
- Does each name, function, class, and test state its intent?
- Is the added abstraction cheaper to understand than the duplication it removes?
- Are failures, dependencies, and side effects visible at their boundary?
- Does the change preserve the current API and business invariants?
- Would an accessibility or static-analysis tool flag a semantic shortcut?
- Is there a smaller change that is equally correct?
