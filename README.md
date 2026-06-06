# अक्षर · Akshar

> *That which does not perish. That which cannot be silenced.*

**Akshar** is an open, decentralized communication protocol combining private group messaging with attributed public broadcast — governed by topological diversity scoring, proof-of-curation token economics, and tiered proof-of-humanity. Built for humans. Resilient against everything else.

---

## Why Akshar Exists

Every major messaging platform has a fatal flaw:

- **Twitter/X** — algorithmic amplification rewards outrage, not quality
- **Facebook** — surveillance capitalism at scale, content moderation by corporate and political pressure, zero creator compensation
- **WhatsApp** — anonymous forwarding with no accountability, single company to shut down or subpoena
- **Signal** — excellent privacy, no broadcast layer, no economic model
- **Telegram** — centralized servers, no curation incentives

Akshar is built on a different premise entirely:

> Authentic ideas earn their spread through genuine resonance across diverse human networks. Good curation deserves compensation. Privacy is architectural, not promised. Sharing is a reputational act, not an anonymous forward.

---

## How It Works

### Two Layers. One Protocol.

**Layer 1 — Private Groups** *(WhatsApp model)*
Closed, encrypted, threaded conversation. Nothing leaves unless a member actively chooses to share it. Replies, reactions, and discussions stay inside the group. Fully end-to-end encrypted — not even Akshar can read your messages.

**Layer 2 — Public Broadcast** *(Twitter/Facebook model)*
When you share a message, it broadcasts to your entire circle — like a retweet, not a private forward. Critically: **your share is visible to everyone in the originating group.** Sharing is attributed. Anonymous forwarding does not exist in Akshar.

The **share** is the bridge between layers — a deliberate, public, reputation-staking act.

```
Message posted in group
        ↓
Group discusses, replies, reacts  [stays private]
        ↓
Member shares the message
        ↓
Share visible to all group members  [accountability]
        ↓
Broadcasts to sharer's entire circle  [propagation]
        ↓
Diversity scoring + token rewards activate
```

---

### Propagation Mechanics

Message velocity is determined by **network topology** — never by content analysis.

- **Diverse spread** → message crosses many unconnected circles → velocity increases
- **Clustered spread** → message stays within tight communities → velocity naturally slows
- **Node score** → consistent quality sharing builds reputation → faster propagation over time
- **Divisive content** → doesn't need moderation — it self-limits topologically

> The protocol never reads your messages. It only observes the shape of how they travel.

---

### Token Economy — Proof of Curation

Every user is simultaneously a messenger, a curator, and a miner. Subscription revenue flows back to participants — not to a platform extracting rent.

| Role | Earns When |
|---|---|
| **Originator** | Claims ZK proof after message achieves diverse viral spread |
| **Early Sharer** | Shared before message crossed diversity threshold |
| **Late Sharer** | Shared after message was already broadly circulating |
| **Relay Node** | Device uptime contributing to mesh infrastructure |
| **Quality Curator** | Consistent history of sharing content with high diversity scores |

Token rewards track **real human value** — not volume, not engagement, not time-on-platform.

---

### Proof of Humanity — Tiered Access

Akshar makes bot creation economically irrational at scale. Three tiers, each requiring something that cannot be faked cheaply:

| Tier | Name | Requirements | Capabilities |
|---|---|---|---|
| 1 | **Larva** 🪲 | Device proof-of-work + SIM hash | Read, reply in groups |
| 2 | **Drone** 🪳 | 14 days + humanity puzzle + token burn + 3 human connections | Full sharing, basic token earning |
| 3 | **Colony** 👑 | 90 days + organic diversity scores + Colony vouches + stake | Relay node, full token earning, governance |

Genuine humans barely notice the tiers. Bot operators face compounding costs that break down completely at scale.

---

### Privacy Architecture

| Attack | Resonance Protocol |
|---|---|
| Government subpoena | No message logs held — structurally unanswerable |
| Server seizure | No central server exists |
| Mass surveillance | No global propagation graph stored |
| Origin tracing | Requires sequential physical access to every device in chain |
| Anonymous forwarding abuse | All shares attributed and visible — by design |

**Zero organizer key custody.** Keys are generated on user devices and never transmitted anywhere. A court order to the Akshar foundation for message content is technically unanswerable — not a policy, an architectural reality.

---

## Repository Structure

```
akshar/
├── akshar-protocol/        # Core protocol specification
│   ├── propagation/        # Topological diversity scoring algorithm
│   ├── encryption/         # E2E encryption + ZK proof-of-origin
│   ├── mesh/               # P2P mesh networking + relay protocol
│   ├── token/              # $RSN token mechanics + proof-of-curation
│   └── humanity/           # Tiered proof-of-humanity system
│
├── akshar-app/             # Reference mobile application
│   ├── ios/                # iOS client
│   └── android/            # Android client
│
├── akshar-sdk/             # Developer tools and libraries (MIT)
│   ├── javascript/
│   ├── python/
│   └── go/
│
├── akshar-node/            # Relay node software
│
└── akshar-whitepaper/      # Protocol specification and research
```

---

## Getting Started

### Run a Relay Node

```bash
git clone https://github.com/akshar/akshar-node
cd akshar-node
cp config.example.yml config.yml
./akshar-node start
```

### Build with the SDK

```bash
npm install @akshar/sdk
```

```javascript
import { AksharClient } from '@akshar/sdk'

const client = new AksharClient({
  network: 'mainnet',
  identity: yourKeyPair
})

// Join a group
const group = await client.groups.join(inviteCode)

// Share a message to your circle
await client.share(messageId, {
  attribution: true  // always true — shares are attributed by protocol
})

// Listen for incoming messages
client.on('message', (msg) => {
  console.log(`From ${msg.sender}: ${msg.content}`)
})
```

### Read the Protocol Spec

Full specification: [`akshar-protocol/SPEC.md`](./akshar-protocol/SPEC.md)

Whitepaper: [`akshar-whitepaper/`](./akshar-whitepaper/)

---

## Contributing

Akshar is built in the open because **transparency is the only credible privacy guarantee.** Every line of code is auditable. Every design decision is documented. Every community improvement is welcome.

### Before You Contribute

1. Read the [Protocol Specification](./akshar-protocol/SPEC.md)
2. Read [CONTRIBUTING.md](./CONTRIBUTING.md)
3. Sign the [Contributor License Agreement](./CLA.md) — required for all PRs
4. Check [open issues](https://github.com/akshar/akshar/issues) for good first contributions

### What We Need

- **Protocol engineers** — propagation algorithm, mesh networking, encryption
- **Cryptographers** — ZK proof-of-origin, proof-of-humanity primitives
- **Mobile developers** — iOS and Android reference app
- **Security researchers** — see bug bounty below
- **Community** — documentation, translations, testing

### Contribution Flow

```
Fork → Branch → Commit → PR → CLA check → Review → Merge
```

All PRs are reviewed publicly. All design discussions happen in issues — not in private channels.

---

## Security

Akshar is a privacy and encryption protocol. Security is not a feature — it is the foundation.

**Found a vulnerability?**

Do **not** open a public issue. Report privately to:

```
security@akshar.io
PGP Key: [key fingerprint]
```

We commit to:
- Acknowledge your report within **48 hours**
- Provide a status update within **7 days**
- Credit you publicly when the fix ships (unless you prefer anonymity)

### Bug Bounty

Security vulnerabilities are rewarded in **$RSN tokens** based on severity:

| Severity | Reward |
|---|---|
| Critical — breaks encryption or anonymity | 50,000 $RSN |
| High — breaks proof-of-humanity or token integrity | 20,000 $RSN |
| Medium — degrades privacy or propagation fairness | 5,000 $RSN |
| Low — UI, performance, minor logic errors | 500 $RSN |

---

## Threat Model

Akshar is designed to withstand state-level adversaries. Read the full threat model in [`THREAT_MODEL.md`](./THREAT_MODEL.md).

The short version: even if an adversary compels every cloud provider, payment processor, and app store under their jurisdiction, the content of your communications and the structure of your network remain inaccessible. The physical device is the only true attack surface — and we document mitigations for that too.

---

## Governance

Akshar is governed by the community through on-chain voting weighted by $RSN holdings and node score.

- Protocol changes require community proposal and vote
- The foundation holds no unilateral override
- All governance discussions are public
- Governance spec: [`akshar-protocol/GOVERNANCE.md`](./akshar-protocol/GOVERNANCE.md)

---

## License

```
akshar-protocol/     →  GNU AGPL v3
akshar-app/          →  GNU AGPL v3
akshar-node/         →  GNU AGPL v3
akshar-sdk/          →  MIT
akshar-whitepaper/   →  Creative Commons CC BY 4.0
```

AGPL v3 ensures no company can fork Akshar, improve it, and close it. The protocol stays permanently open. All improvements flow back to the commons.

See [`LICENSE`](./LICENSE) for full terms.

---

## Community

- **Discussions:** [github.com/akshar/akshar/discussions](https://github.com/akshar/akshar/discussions)
- **Protocol dev:** [akshar.io/protocol](https://akshar.io/protocol)
- **Security:** security@akshar.io
- **Website:** [akshar.app](https://akshar.app)

---

## Acknowledgments

Akshar builds on the shoulders of Signal Protocol, Nostr, Briar, the Tor Project, and every open source privacy tool that came before it. We exist because they proved it was possible.

---

<div align="center">

**अक्षर** — *That which does not perish.*

[akshar.app](https://akshar.app) · [Whitepaper](./akshar-whitepaper/) · [Protocol Spec](./akshar-protocol/SPEC.md) · [Contributing](./CONTRIBUTING.md)

*Built in the open. For everyone. Forever.*

</div>
