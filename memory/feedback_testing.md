---
name: Testing & Coverage Practices
description: Preferred approach: table-driven tests, mocks over DB, Quality Gate compliance
type: feedback
---

**Rule** : Use table-driven tests for unit tests; mock external dependencies

**Why** : 
- Table-driven (parameterized) tests are easier to extend
- Mocking keeps tests fast (no DB I/O)
- Quality Gate checks new code coverage first, so each commit needs 80%+
- Real DB should only be used for Lot 4+ integration tests

**How to apply** :
1. For every pure function (Lot 1), write unit tests with multiple input/output pairs
2. For services (Lot 2), inject mocked repositories — don't hit real DB
3. For React components (Lot 3), mock API calls and test user interactions, not implementation details
4. Aim for 80%+ line coverage in new code on every commit
5. Skip edge cases that add complexity without new code paths

**Example** :
```typescript
// ✅ Table-driven unit test
describe('calculateScore', () => {
  const cases = [
    { input: { hp: 100, armor: 50 }, expected: 150 },
    { input: { hp: 100, armor: 0 }, expected: 100 },
    { input: { hp: 0, armor: 50 }, expected: 50 },
  ];
  
  cases.forEach(({ input, expected }) => {
    it(`should return ${expected} for ${JSON.stringify(input)}`, () => {
      expect(calculateScore(input)).toBe(expected);
    });
  });
});
```

**Not recommended** :
- Deep snapshot tests (brittle, hard to maintain)
- Testing implementation details (private methods, internal state)
- Mocking everything (test real integrations for contracts)
