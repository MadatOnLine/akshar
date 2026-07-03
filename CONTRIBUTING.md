# Contributing to Akshar

Thank you for your interest in contributing. Akshar is built in the open because transparency is the only credible privacy guarantee. Every line of code is auditable. Every design decision is documented. Every community improvement is welcome.

---

## Before You Start

1. **Read the whitepaper** — `akshar-whitepaper/WHITEPAPER.md`. Understand what we are building and why before writing code.
2. **Read the protocol spec** — `akshar-protocol/SPEC.md`. All code must conform to the spec.
3. **Sign the CLA** — `CLA.md`. Required for all pull requests. Our bot will prompt you automatically on your first PR.
4. **Check existing issues** — your idea or fix may already be tracked.

---

## What We Need

- **Protocol engineers** — propagation algorithm, mesh networking, relay node
- **Cryptographers** — ZK proof-of-origin, proof-of-humanity primitives, encryption layer
- **Mobile developers** — iOS and Android reference app (React Native)
- **Smart contract developers** — $RSN token mechanics on EVM
- **Security researchers** — see `SECURITY.md` for bug bounty details
- **Technical writers** — documentation, protocol specification, tutorials
- **Translators** — making Akshar accessible in more languages

---

## Contribution Flow

```
Fork repo
    ↓
Create branch from dev (not main)
    ↓
Make changes with tests
    ↓
Open PR against dev
    ↓
Sign CLA (automated, first PR only)
    ↓
CI checks pass (lint, test, build)
    ↓
Code review (1 approval minimum, 2 for protocol changes)
    ↓
Merge to dev
```

**Never open a PR directly against `main`.** All changes go through `dev` first.

---

## Branch Naming

```
feature/short-description       ← New features
fix/short-description           ← Bug fixes
docs/short-description          ← Documentation only
refactor/short-description      ← Code refactoring, no behavior change
security/short-description      ← Security-related (discuss privately first)
```

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add diversity scoring to propagation module
fix: correct hop-local traceability storage key collision
docs: update relay node setup instructions
test: add unit tests for ZK proof generation
refactor: simplify token burn validation logic
security: patch timing side-channel in key comparison
```

---

## Pull Request Requirements

Your PR description must include:

- **What** — what does this change do?
- **Why** — what problem does it solve, or what issue does it close?
- **How to test** — steps to verify the change works correctly
- **Breaking changes** — does this change any public API or protocol behavior?

Link the related issue with `Closes #123` in the PR description.

---

## Code Standards

### All languages
- Every new function must have a docstring or JSDoc comment
- No credentials, keys, or personal data in code or tests
- No logging of message content anywhere — ever

### JavaScript / TypeScript
- ESLint + Prettier enforced via CI
- TypeScript strict mode enabled
- Test with Jest, coverage >80% on new code

### Python
- Black formatting enforced via CI
- Type hints required on all function signatures
- Test with pytest, coverage >80% on new code

### Go
- gofmt enforced via CI
- All exported functions must have godoc comments
- Test with Go testing package

### Solidity
- Follow OpenZeppelin patterns where applicable
- All contracts must have NatSpec documentation
- Tests required for all state-changing functions

---

## Definition of Done

A contribution is complete when:

- [ ] Code written and self-reviewed
- [ ] Tests written with >80% coverage on new code
- [ ] Documentation updated (inline + relevant .md files)
- [ ] PR opened with linked issue and clear description
- [ ] CI passing (lint, test, build)
- [ ] Reviewed and approved by at least one maintainer
- [ ] Merged to `dev`

---

## Security Issues

**Do not open public issues for security vulnerabilities.** Report privately following the process in `SECURITY.md`. We take security seriously and will respond within 48 hours.

---

## Code of Conduct

We are building infrastructure for free human communication. We expect contributors to embody the same values:

- Respectful, constructive feedback on code — not on people
- Good-faith engagement with disagreements
- No harassment, discrimination, or exclusionary behavior
- No discussion of exploiting or surveilling users — ever

Violations may result in permanent ban from the project.

---

## Questions?

Open a [GitHub Discussion](https://github.com/MadatOnLine/akshar/discussions) for anything that isn't a bug report or feature request. Discussions are the right place for design questions, architecture proposals, and general conversation about the protocol.

---

*Akshar — Built in the open. For everyone. Forever.*
