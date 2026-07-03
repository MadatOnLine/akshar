# Security Policy

Akshar is a privacy and encryption protocol. Security is not a feature — it is the foundation. We take every vulnerability report seriously and commit to responding quickly and transparently.

---

## Supported Versions

| Component | Version | Supported |
|---|---|---|
| akshar-protocol | latest | ✅ |
| akshar-app | latest | ✅ |
| akshar-node | latest | ✅ |
| akshar-sdk | latest | ✅ |
| All previous versions | — | ❌ |

We only patch the latest version. If you are running an older version, upgrade before reporting.

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.** Public disclosure before a fix is deployed puts users at risk.

### Private Disclosure Process

**Email:** security@akshar.io
**PGP Key:** [Published at akshar.io/pgp — always verify the key fingerprint before encrypting]

Include in your report:

1. **Description** — what is the vulnerability?
2. **Component** — which repository and module is affected?
3. **Impact** — what can an attacker achieve? (e.g., decrypt messages, identify users, manipulate token rewards)
4. **Reproduction steps** — how can we verify the issue?
5. **Suggested fix** — if you have one (optional but appreciated)

### What Happens Next

| Milestone | Commitment |
|---|---|
| Acknowledgment | Within 48 hours of receipt |
| Status update | Within 7 days — confirmed, investigating, or not reproducible |
| Fix timeline | Communicated once severity is assessed |
| Public disclosure | Coordinated with you after fix is deployed |
| Credit | Your name or handle in release notes (unless you prefer anonymity) |

We practice **coordinated disclosure**. We ask that you give us reasonable time to fix and deploy a patch before any public disclosure. We will not ask you to delay disclosure indefinitely.

---

## Bug Bounty

Security vulnerabilities are rewarded in **$RSN tokens** based on severity. Rewards are paid after the fix is confirmed and deployed.

| Severity | Definition | Reward |
|---|---|---|
| **Critical** | Breaks E2E encryption, de-anonymizes users, allows mass message decryption, or allows an attacker to seize control of the token contract | 50,000 $RSN |
| **High** | Breaks proof-of-humanity tier system, allows token manipulation or theft, exposes hop-local traceability data beyond intended scope | 20,000 $RSN |
| **Medium** | Degrades propagation fairness, allows node score manipulation, leaks metadata that could assist deanonymization | 5,000 $RSN |
| **Low** | UI bugs, performance issues, minor logic errors with no privacy or security impact | 500 $RSN |

**Not eligible for bounty:**
- Issues already known and tracked internally
- Issues in third-party dependencies (report to the dependency maintainer)
- Issues requiring physical device access already documented in `THREAT_MODEL.md`
- Social engineering attacks
- Denial-of-service attacks against relay nodes

---

## Our Security Commitments

**Zero key custody.** The Foundation holds no user encryption keys. A court order demanding user message content is technically unanswerable — not a policy choice, an architectural reality.

**No content logging.** We log nothing about message content, propagation paths, or user identity anywhere in Foundation-operated infrastructure.

**Open source auditability.** All protocol code is AGPL v3. Security researchers can and should read, audit, and test the entire codebase. We encourage it.

**Responsible patching.** Critical security fixes are prioritized above all other work and deployed as quickly as possible.

---

## Scope

**In scope:**
- Encryption implementation in `akshar-protocol/encryption/`
- Key generation and storage in `akshar-app/`
- Relay node message handling in `akshar-node/`
- Token contract logic in `akshar-protocol/token/`
- Proof-of-humanity tier enforcement in `akshar-protocol/humanity/`
- Hop-local traceability storage
- ZK proof-of-origin implementation
- SDK cryptographic operations

**Out of scope:**
- Attacks requiring physical device access (documented in `THREAT_MODEL.md`)
- Infrastructure we don't operate (GitHub, app stores, cloud providers)
- Attacks on user devices through third-party malware
- Protocol behaviors that are working as documented in the spec

---

## Security Design References

For context on our threat model and design decisions before reporting:

- `THREAT_MODEL.md` — full threat model including state-level adversary analysis
- `akshar-protocol/SPEC.md` — protocol specification
- `akshar-whitepaper/WHITEPAPER.md` — design rationale

---

*security@akshar.io | akshar.io/pgp*
