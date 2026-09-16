# POC Demo Script

## Before the meeting

From the `POC` folder:

```powershell
.\start-demo.ps1
```

The first launch installs and verifies dependencies automatically. Confirm the browser opens at `http://localhost:5173` and the status shows `Ready`. Close unrelated terminals and avoid showing any source-generation workspace.

## Suggested 5-minute walkthrough

### 1. Introduce the POC — 30 seconds

> This product finder runs completely offline at runtime. The browser talks to a local Node WebSocket service, which searches a frozen JSON catalog and approved question-and-answer records. There is no LLM, API key, vector service, or database involved in answering these questions.

### 2. Exact approved answer — 45 seconds

Ask:

> What is Eastman Acetaldehyde?

Point out:

- The response comes from an approved stored answer.
- A product card and source link are returned with it.
- The visible status trail describes retrieval steps, then the answer is revealed progressively like a chat response.
- Matching is deterministic and repeatable.

### 3. Natural-language variation — 45 seconds

Ask:

> How is Acetaldehyde used?

Point out that multiple curated question variants map to the same approved product record.

### 4. Product identifier lookup — 45 seconds

Ask:

> Tell me about product 71000122

Point out that exact FGMN lookup works even when the wording is not a stored question.

### 5. Typo tolerance — 45 seconds

Ask:

> Tell me about Acetic Acid 56 Dilutted

Explain that bounded fuzzy matching tolerates the misspelled “Dilutted” and resolves one confident product, while confidence gates prevent broad guessing.

### 6. Conversation context — 45 seconds

Immediately ask:

> What about its technical properties?

Explain that the local conversation store carries the previously selected product into a follow-up without an LLM.

### 7. Safe failure — 45 seconds

Ask:

> Find a quantum telemetry antenna for a spacecraft

Point out that the system does not invent a recommendation. It asks for an exact product, FGMN, or relevant application instead.

### 8. Close — 45 seconds

> This POC proves that the existing chat experience can operate from a compact local corpus. It currently contains 979 products, 879 approved answers, and 6,879 question variants in about 5.5 MB of project data and code before npm dependencies. The next production steps would be domain review, broader intent coverage, analytics, and deployment hardening—not a runtime LLM dependency.

## Backup questions

- `Tell me about Acetaldehyde from Eastman.`
- `Is there a safety sheet for Acetaldehyde?`
- `Tell me about Acetaldehyde - Kosher`
- `What is product 71014147?`
- `Hello` — demonstrates deterministic conversational handling

## If something goes wrong

1. Stop the demo with `Ctrl+C`.
2. Run `npm --prefix Backend run smoke`.
3. If it passes, restart with `.\start-demo.ps1`.
4. If port 3000 or 5173 is occupied, stop the other local process using that port and restart.

Do not switch to a cloud model during the demo; this folder intentionally contains no cloud client or credential.
