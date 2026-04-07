# Prototype C — The Conversational Co-pilot

## Core hypothesis

Natural language is the fastest path to closing the conceptual gap — but only if the AI always shows its work. The research warns that AI can become a crutch, a permanent translation layer between users and an illegible system. This prototype tests whether that's inevitable or avoidable. If the AI generates rules in the same constrained model the admin could have built manually, and those rules are always visible and editable, then AI-assisted authoring is additive: it lowers the floor without lowering the ceiling.

This prototype bets that **the right interface is a conversation that produces inspectable structure**. It resolves the "AI as bridge vs. AI as crutch" tension directly — by building the AI-first experience and testing whether users learn the system or learn to depend on the AI.

## What this prototype explores

**Natural language as the primary input for group creation and editing.**

The admin types or says what they want: "All full-time employees in the US," "Everyone in Engineering except contractors," "People who started after January 2025." The system translates to a structured rule (Filters + Options format) and shows the result: the rule, the membership preview, and any caveats ("I interpreted 'in the US' as work_location.country = US — did you mean something else?").

The structured rule is always visible alongside the natural language input. The admin can edit either one — change the natural language and regenerate, or tweak the structured rule directly. The AI is the on-ramp; the structured builder is the destination.

**Conversational explanation as the transparency model.**

"Why is Sarah in this group?" is a question the admin types, and the system answers in natural language: "Sarah matches because she's a full-time employee (employment_type = full_time) based in San Francisco (work_location.country = US). She's also affected by a role state filter that restricts this group to active employees — she's active, so she's included."

The system explains invisible evaluation layers conversationally: "This group has 3 hidden filters applied by the system: active role state, your company's provisioning scope, and a parent constraint from the Benefits policy. Together they exclude 14 people who would otherwise match your rule. Want me to show you who?"

**Conversational change confirmation for safety.**

When the admin edits a group, the system narrates the impact before committing: "This change will add 23 people and remove 8. The 8 people being removed are currently covered by the California Benefits policy and the US Payroll Run. Want to see who they are before I apply this?"

The admin can ask follow-up questions: "Which of the 8 people are in the California Benefits policy?" / "What happens to their benefits if I remove them?" The system answers from the reference map and membership data. Committing the change is an explicit confirmation, not a button click at the end of a flow.

**Implicit reuse through conversational intent.**

When the admin describes a group, the system checks for existing matches before creating a new one: "There's already a saved group called 'US Full-Time Employees' that matches what you described. It's used by 3 policies. Want to use that one, or create a new group?"

Reuse happens conversationally — the admin doesn't need to search or browse. The system interprets intent and surfaces matches.

## Interaction paradigm

The interface is a **structured conversation with a persistent artifact**.

- **Left region: the conversation.** A chat-like interface where the admin types requests, asks questions, and receives explanations. This is the primary input mechanism.
- **Right region: the artifact.** The current group state — rule definition (in constrained Filters + Options format), membership preview, evaluation layers, downstream consumers. This panel updates as the conversation progresses. It's always visible and always editable directly.
- **The artifact is the source of truth.** The conversation is the input; the structured rule is the output. If the admin closes the conversation and reopens the group later, they see the artifact — not the conversation history. The group must be self-describing without the conversation that created it.

This is the critical design constraint: the AI helps build the group, but the group doesn't need the AI to be understood. If the artifact isn't readable on its own, the prototype has failed.

## What this prototype should prove or disprove

1. **Does AI-first authoring produce readable artifacts?** The core risk is that AI-created groups are black boxes that only the AI can explain. If the structured rule is clear enough that a different admin (who didn't have the conversation) can read and understand it, the AI is additive. If not, it's a crutch.

2. **Do users learn the system or learn to depend on the AI?** After creating 2-3 groups through conversation, does the admin start editing the structured builder directly? Or do they keep using natural language for every change? Track whether users migrate from conversation to direct manipulation over repeated tasks.

3. **Is conversational explanation more effective than structural explanation?** Compare the time-to-understanding for inherited groups: can an admin understand a group faster by asking the AI "what does this group do?" than by reading the Filters + Options display (prototype A) or narrative explanations (prototype B)?

4. **Does conversational change confirmation feel safe or annoying?** The system narrating impact before every commit could feel protective or patronizing. At what blast radius does conversational confirmation feel proportional? Is it always helpful, or only for high-risk changes?

5. **Can the AI handle edge cases gracefully?** "Everyone except the temps we hired last month for the Austin project" — can the AI translate ambiguous, context-dependent language into correct rules? When it can't, does it fail clearly ("I'm not sure what you mean by 'the Austin project' — can you clarify?") or silently produce wrong rules?

## What this prototype should NOT do

- **No conversation-only interface.** The structured artifact (rule definition, membership preview) must always be visible and directly editable. If the only way to interact with the group is through conversation, the prototype is testing a chatbot, not a co-pilot.
- **No AI-generated explanations disconnected from the engine.** When the AI explains "why is Sarah in this group?", the explanation must be derived from the evaluation engine's actual logic, not from a language model's plausible-sounding interpretation of the rule text. The AI is a rendering layer for real data, not an independent reasoner.
- **No people-first entry point.** The admin starts by describing intent in words, not by selecting people. If the user wants to pick people first, they can say "start with Sarah, Marcus, and Aisha" — but the entry point is the conversation, not a people picker. That's prototype B's territory.
- **No information-dense dashboard.** The artifact panel should be clean and readable — not a dense workspace. The conversation carries the complexity; the artifact is the simplified, structured output.
- **No impact maps or visual blast-radius diagrams.** Impact is communicated through conversational narration, not visual representations. "This change affects 4 policies" is a sentence, not a diagram — that's prototype D's territory.

## Technical constraints

- The natural language → rule translation must produce rules in the canonical AST format, rendered in Filters + Options form. The admin must be able to switch from conversational input to direct builder editing without any data loss or format mismatch.
- The AI must distinguish between high-confidence translations ("All full-time employees in the US" → clear rule) and ambiguous inputs ("the marketing team" → which attribute? department? team? manager?) and ask for clarification rather than guessing.
- Conversational explanation must be generated from real evaluation data (the AST, the membership cache, the evaluation layer metadata), not from the language model's interpretation of the rule text. The AI formats the data; it does not invent it.
- Must include one scenario where the AI gets it wrong — the translated rule doesn't match what the admin intended. How does the system handle correction? Can the admin fix it in the builder directly, or are they stuck in a conversational loop?
- Must include a "read a group you didn't create" scenario where the admin encounters an existing group without conversation history. The group must be understandable from the artifact alone.
- Must include at least one inline component scenario (conversational group creation within a policy builder context — how does a chat interface work in a modal?).

## Evaluation focus

This prototype is the strongest test of the **"AI as bridge vs. AI as crutch" tension** and **UR-5 (natural expression)**. If it works, it proves that AI-first interaction can coexist with system legibility. If it fails, it proves that AI hides the system rather than teaching it — and that structural UI improvements (prototypes A/B) are necessary.

Evaluate primarily on:
- Can an admin who didn't create the group understand it from the artifact alone, without the conversation?
- After 3 group creation tasks, does the admin edit the structured builder directly, or always return to conversation?
- When the AI makes a mistake, does the admin catch it? How long does correction take?
- Does conversational interaction work in the inline component context, or does it break the flow of the host product?
- Does the enterprise admin trust AI-generated rules for high-blast-radius groups?

---

## Build contract (do not modify)

- Your root component must be named ConceptC
- It must live at concept-C/index.tsx and be the default export
- It must accept one prop: `entryState: EntryState` (type defined in shell/types.ts — read it before building)
- It must start from the shared entry point defined in entryState
- Do not create your own dev server, package.json, or vite config — the unified shell handles all of that
- Do not import from other concept folders
- All state is local to your component tree unless explicitly shared via entryState
