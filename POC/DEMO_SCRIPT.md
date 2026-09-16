# POC Demo Script

## Before the meeting

From the `POC` folder:

```powershell
.\start-demo.ps1
```

The first launch installs and verifies dependencies automatically. Confirm the browser opens at `http://localhost:5173` and the status shows `Connected`. Close unrelated terminals and avoid showing any source-generation workspace.

Keep [QA.md](QA.md) open on a second screen. It lists all 8 curated sales conversations, 26 question-and-answer steps, and the 104 phrasings that resolve to them.

## Suggested 8-minute walkthrough

Run one conversation end to end rather than firing isolated questions. The point of the demo is that the assistant behaves like a sales representative across a thread, not that it can answer one question.

### 1. Introduce the POC — 30 seconds

> This product finder runs completely offline at runtime. The browser talks to a local Node WebSocket service, which searches a frozen JSON catalog and approved question-and-answer records. There is no LLM, API key, vector service, or database involved in answering these questions.

### 2. Run the eyewear conversation — 3 minutes

Ask, in order:

1. > I'm developing eyewear frames and need an optical grade polymer

   A single recommendation with the reasoning a representative would give, the TDS properties to verify, and a qualifying question back to the buyer.

2. > Compare Tritan VX301 and Tritan VX401 for optical parts

   Two product cards, and a side-by-side table of the properties and standard test methods that actually decide the choice.

3. > Do you have a recycled content version of VX301?

   The sustainability-positioned grade, with an explicit boundary on what the assistant will not claim without documentation.

4. > What should I check in the VX301 TDS before tooling?

   Deep technical guidance — shrinkage, melt flow, drying, heat deflection — with values deferred to the linked data sheet.

Point out along the way:

- Every answer ends in a question, so the thread keeps moving toward a decision.
- Product cards carry **View product**, **TDS**, **SDS**, and **Contact Eastman** links.
- The response is assembled from approved records, so it is identical every time.

### 3. Show the technical comparison again in a different domain — 1 minute

Ask:

> Compare Eastman Eastek 4100 and Eastek 4500

Point out that the comparison is framed the way a formulator thinks: one resin solves crosslink density, the other solves application viscosity, and the table names the test methods to compare.

### 4. Natural-language variation — 45 seconds

Ask:

> Eastek 4100 or 4500 for my hot melt?

Same answer. Four phrasings are stored for every step, so the demo does not depend on exact wording.

### 5. Conversation memory — 45 seconds

Start a fresh thread with:

> I need a clear biocompatible polymer for a medical device housing

then ask:

> Do you have a grade with a vegetable-based mold release?

Explain that the local conversation store carries the previously selected products into the follow-up without an LLM.

### 6. Safe failure — 45 seconds

Ask:

> Find a quantum telemetry antenna for a spacecraft

Point out that the system does not invent a recommendation. It asks for an exact product, FGMN, or relevant application instead.

### 7. Show the conversion — 45 seconds

Ask:

> How do I request samples and pricing?

Point out that the assistant hands off cleanly: it states what it cannot answer — price, stock, lead time, minimum order quantity — and routes the buyer to the product inquiry form with the right information attached.

### 8. Close — 45 seconds

> This POC proves that the existing chat experience can operate from a compact local corpus. It carries 979 products, 905 approved answers, and roughly 6,980 question variants, including 8 hand-authored sales conversations. The next production steps would be domain review, broader intent coverage, analytics, and deployment hardening—not a runtime LLM dependency.

## The eight curated conversations

Full text of every question and answer is in [QA.md](QA.md).

| #   | Conversation                                 | Steps | Opening question                                                          |
| --- | -------------------------------------------- | ----- | ------------------------------------------------------------------------- |
| 1   | BPA-free clear protective barriers           | 4     | I need a BPA-free clear plastic for protective barriers                   |
| 2   | Eyewear frames and optical parts             | 4     | I'm developing eyewear frames and need an optical grade polymer           |
| 3   | Automotive paint protection film             | 3     | What do you offer for automotive paint protection film?                   |
| 4   | Reactive polyurethane hot melt adhesive      | 4     | I'm formulating a reactive polyurethane hot melt adhesive                 |
| 5   | Water-based and PVAc adhesive plasticizers   | 3     | I need a plasticizer for a water-based PVAc adhesive                      |
| 6   | Medical device moulding                      | 3     | I need a clear biocompatible polymer for a medical device housing         |
| 7   | Recyclable cosmetics packaging               | 3     | I need recyclable cosmetics packaging resin compatible with PET recycling |
| 8   | Samples, pricing, and representative handoff | 2     | How do I request samples and pricing?                                     |

## Backup questions

- `What is Eastman Acetaldehyde?` — an answer from the generated corpus rather than a curated flow
- `Tell me about product 71000122` — exact FGMN lookup
- `Tell me about Acetic Acid 56 Dilutted` — bounded typo tolerance
- `Hello` — deterministic conversational handling

## If a question does not land

Curated phrasings are listed in [QA.md](QA.md). Use one of them. The assistant deliberately refuses to guess rather than improvising an unapproved answer.

## If something goes wrong

1. Stop the demo with `Ctrl+C`.
2. Run `npm --prefix Backend run smoke` and `npm --prefix Backend run check:flows`.
3. If both pass, restart with `.\start-demo.ps1`.
4. If port 3000 or 5173 is occupied, stop the other local process using that port and restart.

Do not switch to a cloud model during the demo; this folder intentionally contains no cloud client or credential.
