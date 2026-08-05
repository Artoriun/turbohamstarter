# Contributing

This is a starter template, meant to be cloned and customized rather than built up as a
shared project — so if you're forking it for your own site, just go ahead, no process
needed.

Bug reports and small fixes are still welcome upstream:

- **Found a bug?** Open an issue with steps to reproduce, and what you expected instead.
- **Have a fix?** Open a pull request. Before submitting, run:
  ```
  npm run check      # lint + format
  npm run typecheck
  npm test           # API + unit tests
  npx playwright test
  ```
  All four run in CI and gate every merge; a PR that doesn't pass them locally won't pass
  there either.
- **Feature ideas** are welcome as issues, but this repo intentionally stays small — expect
  a bias toward "fork it and add that yourself" over growing the template's scope.
