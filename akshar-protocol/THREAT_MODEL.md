# Akshar Threat Model

**Version 1.0 | June 2026**

This document defines the threat model Akshar is designed to withstand. Every architectural decision in the protocol is evaluated against this model. Developers, security researchers, and users should read this before drawing conclusions about what Akshar can and cannot protect against.

---

## Design Philosophy

Akshar assumes that any data held centrally will eventually be requested by someone with the power to compel its disclosure. The protocol is designed so that even full cooperation by the Foundation with any legal authority yields nothing useful about user communications, identities, or network structure.

The goal is not to make surveillance difficult. It is to make mass surveillance architecturally impossible and targeted surveillance prohibitively expensive.

---

## Threat Actors

### Tier 1 — Nation-State Adversary (Primary Design Target)

**Capabilities assumed:**
- Can compel any domestically incorporated entity to disclose data
- Has direct access to major telecom providers and ISPs
- Can compel Apple and Google to provide device data, app store records, and push notification logs
- Can purchase or compel access to cloud infrastructure providers
- Has access to Aadhaar or equivalent national identity databases (for jurisdictions where applicable)
- Can deploy malware on target devices through supply chain or social engineering
- Has legal authority to physically seize devices

**Examples:** Government of India, United States government acting under FISA, Chinese state security apparatus, any government with broad surveillance legislation

---

### Tier 2 — Sophisticated Criminal or Corporate Adversary

**Capabilities assumed:**
- Can purchase large amounts of cloud infrastructure
- Can run large-scale bot networks
- Can bribe or socially engineer individuals
- Cannot compel legal disclosure but may attempt data theft through technical means

---

### Tier 3 — Opportunistic Attacker

**Capabilities assumed:**
- Script-kiddie to intermediate technical skill
- No significant financial or legal resources
- Attempting common attacks: phishing, relay node compromise, bot farming

---

## Attack Vectors & Mitigations

### A. Mass Message Content Surveillance

**Attack:** Adversary compels the Foundation to hand over all message content.

**Mitigation:** The Foundation holds no message content. All messages are end-to-end encrypted between sender and recipients. Keys are generated on user devices and never transmitted to any server operated by the Foundation. A court order for message content is technically unanswerable.

**Residual risk:** None at the protocol level. Risk exists only if the user's device is physically seized (see Section F).

---

### B. Network Graph Identification (Who Talks to Whom)

**Attack:** Adversary compels the Foundation to hand over social graph data — who is connected to whom, who shared what with whom.

**Mitigation:** No global propagation graph is stored anywhere in Foundation infrastructure. The only traceability data that exists is stored locally on individual user devices — each node records from whom it received a message, but this is never transmitted to any central service. The Foundation has no graph to hand over.

**Residual risk:** A determined adversary running their own nodes in the mesh could observe which nodes relay messages to which other nodes, building a partial graph of node-to-node communication patterns. This reveals mesh topology, not user identity, unless individual nodes are correlated to identities through other means.

---

### C. Origin Tracing (Who Sent a Specific Message)

**Attack:** Adversary wants to find who originated a specific message that spread through the network.

**Mitigation:** Origin is never stored globally. To trace a message to its origin, an adversary must physically access and forensically examine every device in the propagation chain, working backward from the most recent recipient one device at a time. Each device only knows from whom it received the message — not the original sender.

**Residual risk:** Sequential physical device seizure remains a viable (if logistically expensive) attack. The more hops a message has traveled, the more devices must be seized. Users who receive sensitive content should be aware that their device records one hop of traceability.

**Mitigation for high-risk users:** Enable message TTL (auto-delete after configurable time period) and disable cloud backup of Akshar data.

---

### D. Identity Correlation via Subscription Payment

**Attack:** Adversary subpoenas payment records to identify subscribers.

**Mitigation:** Akshar subscriptions are paid in $RSN tokens or privacy coins (Monero, Zcash shielded transactions). No name, email, or bank account is required. Wallet addresses are pseudonymous. Indian-regulated exchanges (which are KYC-mandated) should not be used as the source of subscription payments by high-risk users.

**Residual risk:** A sophisticated adversary with access to on-chain analytics and the ability to correlate wallet addresses to real identities through exchange KYC records could potentially link a wallet to a subscriber. High-risk users should acquire tokens through non-KYC channels and use Monero for maximum privacy.

---

### E. SIM / Phone Number Correlation

**Attack:** Adversary has access to telecom records and Aadhaar-SIM linkage (India) and attempts to correlate Akshar accounts to phone numbers.

**Mitigation:** Akshar does not store phone numbers. The SIM uniqueness check during Tier 1 onboarding hashes the SIM identifier locally and immediately discards it. Only a one-way hash is used for uniqueness enforcement — it is stored locally on the device only, never transmitted to the Foundation. There is no central database of phone number hashes.

**Residual risk:** If an adversary has physical access to the device and the device's local storage, they may recover the locally stored hash. The hash cannot be reversed to recover the phone number without the device-specific salt, which is also local only.

**Mitigation for high-risk users:** Use a foreign eSIM not linked to national identity, or accept that Tier 1 onboarding via SIM is not available and proceed through alternative humanity verification.

---

### F. Physical Device Seizure

**Attack:** Adversary physically seizes a user's device and forensically examines it.

**Status:** This is the most significant residual vulnerability. Physical device access can expose:
- Message history stored locally
- One hop of propagation traceability (who sent this user a message)
- The user's private key (compromising their Akshar identity)
- The user's circle (list of connections)

**Mitigations available to users:**
- **Panic wipe** — single gesture wipes all Akshar data instantly; can be triggered before seizure
- **Decoy profile** — a secondary profile showing innocuous content, activated under duress
- **Message TTL** — messages auto-delete after a configurable period (1 hour to 30 days)
- **No cloud backup** — Akshar data must never be included in iCloud or Google Drive backups
- **Strong device encryption** — device full-disk encryption with strong PIN/passphrase

**Protocol-level mitigations:**
- Private keys are stored in device secure enclave (iOS Secure Enclave / Android StrongBox) where available, making key extraction without the device PIN computationally infeasible

**Residual risk after mitigations:** An adversary with physical access, the device PIN, and forensic tools can still access any message content not yet deleted by TTL, and one hop of propagation chain. This is the irreducible minimum — no protocol can protect against a cooperative device owner or a fully compromised device.

---

### G. Relay Node Compromise

**Attack:** Adversary seizes or compromises a relay node to access message content.

**Mitigation:** Relay nodes hold no decryption keys. Messages stored on relay nodes are encrypted blobs — the relay can read only the recipient public key (to know where to forward) and the message size and timestamp. Content is completely inaccessible without the recipient's private key, which exists only on the recipient's device.

**Residual risk:** Metadata — that a relay node received and forwarded a blob of a certain size destined for a certain public key at a certain time — is observable. This is a form of traffic analysis. It reveals that communication occurred between identities (public keys) but not its content.

---

### H. Bot Networks and Sybil Attacks

**Attack:** Adversary creates large numbers of fake accounts to manipulate propagation, farm tokens, or artificially amplify content.

**Mitigation:** Tiered proof-of-humanity system. Each tier requires something that does not scale cheaply: device-bound proof-of-work (Tier 1), peer-evaluated humanity puzzle + token burn + time + genuine human connections (Tier 2), extended organic network behavior + Colony vouching + stake (Tier 3). Real influence in the network requires Tier 3, which requires 90 days of genuine human behavior and real financial stake.

**Residual risk:** A well-funded, patient adversary can build legitimate-appearing accounts over time. The topological diversity scoring ensures that even legitimate-appearing bot clusters cannot achieve broad propagation without genuinely resonating with diverse unconnected human communities.

---

### I. Government Shutdown of the Foundation

**Attack:** Adversary obtains a court order to shut down the Akshar Foundation or seize its infrastructure.

**Mitigation:** The Foundation operates no servers that carry user messages. The protocol runs entirely on the peer-to-peer mesh of user devices and relay nodes. Shutting down the Foundation stops development but does not stop the network. The protocol is open source and forkable — the community can continue development without the Foundation.

**Residual risk:** If relay nodes are operated in the same jurisdiction and can be compelled to shut down simultaneously, users in that jurisdiction may experience degraded connectivity until new relay nodes come online elsewhere. This is a connectivity disruption, not a privacy breach.

---

## What Akshar Does Not Protect Against

Being clear about limitations is as important as documenting protections.

**Akshar does not protect against:**
- A user voluntarily revealing their identity alongside their Akshar activity
- Device compromise through malware installed before Akshar (a compromised device is a compromised device)
- An adversary who has already seized the devices of multiple people in a propagation chain
- Traffic analysis at the ISP level revealing that encrypted P2P communication is occurring (though not its content)
- A user's circle members cooperating with authorities and revealing what messages they received from that user
- Compelled self-incrimination — Akshar cannot protect a user who is legally required to unlock their device

---

## Reporting Threats Not Covered Here

If you identify an attack vector not addressed in this document, please report it per the process in `SECURITY.md`. If the attack is novel and significant, it will be added to this document and the appropriate mitigation will be designed into the protocol.

---

*Akshar Protocol Foundation | akshar.io*
*This document is maintained alongside the protocol and updated with each significant version.*
