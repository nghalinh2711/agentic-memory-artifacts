# Qualitative User Study Synthesis (n=7)

*Synthesized from moderated think-aloud sessions and comparative interviews. Participant identifiers below use the Teilnehmer-ID from the raw notes (initials in parentheses for your own reference only — replace with anonymized labels such as P1–P7 before including in the thesis).*

---

## 1. Overall Preference

| Participant | Preferred App | Basis |
|---|---|---|
| 1 (MR) | **App B** | Less clicking through, closer to familiar apps, better writing style |
| 2 (MK) | **App A** | Lower entry barrier, closer to what she already knows |
| 3 (AS) | **App B** | Familiar chatbot style, felt "finished" rather than prototype-like, better-structured answers |
| 4 (JA) | **App B** | Better UX/summarization; despite finding its tone slightly too soft/hand-holding |
| 5 (HO) | **Split** | UI → App A ("nicer to look at"); Answer quality → App B ("better structured") |
| 6 (TA) | **Leaning App B** | Reasons transfer more easily to the other app; App A seen as offering more features overall |
| 7 (MT) | **App B** | More intuitive structure overall, more fitting colors |

**Tally: App B preferred by 5/7, App A by 1/7, 1 split decision.** No participant preferred App A outright without reservations.

---

## 2. Thematic Findings

### 2.1 Onboarding & Navigation

**App A (workspace-based):**
- The two buttons "New Workspace" vs. "Create Workspace" caused confusion about their difference for multiple participants (1, 3, 6, 7) — described as redundant.
- Multi-level structure (Workspaces → Chats → Threads) led to repeated "back-and-forth clicking" and disorientation (2, 7).
- Requires an explicit manual "Process" step to index uploaded documents before they can be used — described as unintuitive and an unnecessary extra step by nearly every participant who mentioned it (1, 2, 3, 5, 6, 7).
- One participant (7) counted roughly "18 steps" before being able to start chatting and called the flow "terribly complicated."

**App B (chat-based):**
- Familiar, ChatGPT-like interface lowered the learning curve — explicitly compared favorably to known tools (2, 3, 7, 1).
- New conversations are auto-named "Default," which multiple participants found confusing and didn't realize could/should be renamed (2, 5, 7, 4).
- Several flows required uploading a document *before* any chat interaction was possible, which one participant explicitly flagged as a barrier (7).
- Once multiple chats existed, navigation became "rather confusing" for at least one participant (2).

### 2.2 Visual Design & Layout

**App A:**
- Seen as tidier/cleaner by some (5, 6): "better for the eye," more organized button styling and coloring.
- Also described very negatively by one participant as "terrible AI slop" — a color gradient and misaligned elements (4).
- Chat window opens scrolled to the bottom, requiring a manual scroll-up to read from the start — noted independently by two participants (1, 3).
- One clear software bug: a JSON parse error and a loading bar that never disappeared (4).

**App B:**
- More whitespace/margin issues reported — either too much empty space on the sides or, after adjustment, too wide (4, 6).
- Small font size and a cramped chat input area criticized (2).
- One participant found the left sidebar visually cut off and misaligned (6).
- Overall perceived as more minimalistic; several found this refreshing, though one (6) felt it lost some of App A's organizational clarity.

### 2.3 Document & Source Handling

- Both apps limited uploads to **one document at a time** in several task flows despite drag-and-drop support — a shared limitation (5, 6, and implied elsewhere).
- App A offered more granular source referencing (paragraph-level highlighting, hover tooltips) — appreciated by one participant (4) as a trust-building detail.
- App B's source citations linked directly to specific document sections and were also well received (4, 6).
- One factual/terminology slip was caught in App B: mixing up "consent-based" and "consensus-based" decision-making (4) — worth flagging as an answer-quality/precision issue rather than a UX issue.

### 2.4 Answer Quality & Response Style

- Most participants rated **underlying answer relevance/correctness as broadly similar** between the two apps — the differentiator was workflow and presentation, not raw RAG accuracy.
- App B's recommendations were phrased more assertively ("should" instead of "could"), which one participant explicitly preferred in a work context (3); App A's phrasing was described as more cautious/conservative.
- Another participant (4) found App B's tone slightly too soft/inviting ("more hand-holding, more flavor text") for a professional context, while App A's answers felt more direct and factual — a contrasting take from the previous point, suggesting response tone read differently depending on the individual.
- Both apps handled at least one out-of-scope/edge-case question well by clearly stating the answer wasn't in the provided documents (6, and others), though App B failed to explain *why* no answer was found in one case (1).
- App A was noted for not hallucinating even under-specified questions, instead asking for more context (3).

### 2.5 General Impressions

- Multiple participants independently described **both apps as "half-finished"** or in need of "fine-tuning," not just one (2, 6).
- One participant explicitly reflected on how strongly visual polish and workflow friction shaped his overall judgment, even though the answer quality itself felt comparable between the two apps (4) — a notable meta-observation for your discussion section, since it speaks directly to why UX/design matters even when RAG quality is held constant.
- App A was consistently associated with **more features** (workspaces, multi-document projects, compare-documents, rename/delete) — appreciated by power users wanting more control (6: "the first offers more possibilities"), but this same richness was the direct source of most onboarding complaints.

---

## 3. Notable Bugs / Issues Log

| App | Issue | Reported by |
|---|---|---|
| A | JSON parse error on file upload | P4 |
| A | Loading bar stuck indefinitely | P4 |
| A | Drag & drop for images not working | P5 |
| A | Only one file selectable despite drag & drop UI | P6 |
| B | Two simultaneous uploads not possible | P5 |
| B | Network error during use | P5 |
| B | Renaming "Default" conversations not obvious/working | P4 |
| B | Compare-documents flow failed after deleting a document | P7 |
| Both | Single-document-at-a-time upload limitation | P5, P6 |

---

## 4. Limitations to State in the Thesis

- n=7, single-session, non-blinded to app identity by the moderator (though blinded to condition — memory vs. no-memory — for participants).
- Order effects possible; not fully counterbalanced across all 7 (verify your actual A/B-first split before writing this up).
- Several interview answers used relative references ("first/second app tested") rather than naming the app directly — cross-checked here against observation content but worth a final read-through against your own memory of each session.
- Individual reactions to response tone/directness were not consistent across participants (see 2.4) — worth reporting as a genuine finding rather than smoothing it into a single conclusion.