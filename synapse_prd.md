  
# **SYNAPSE**

*A Concept PRD for a Live Dual-Channel Human–AI Interface*

Version 0.2 — Working Draft

March 2026

**What this document is:** *A concept-level specification for a new paradigm of human–AI interaction. It describes what the system does, how it behaves, and why, without prescribing a technology stack. It is intended to be specific enough that a builder could derive product requirements from it, and clear enough that a non-technical reader can fully understand the vision.*

# **1\. The Problem**

The dominant interface for interacting with AI systems today is the chat box. A text field accepts a query. The system returns a text response. This interaction model was not designed for AI. It was borrowed — first from web search, then from messaging applications — and applied to language models because it was familiar and available, not because it was right.

This inheritance has consequences. Chat interfaces force all communication through a single channel: text. Text must simultaneously carry conversational content (reasoning, discussion, clarification) and structured information (code, diagrams, sequences, formulas). It does neither well. The result is an interaction that is functional but chronically inefficient.

## **1.1 The Asymmetry Problem**

A user inputs 5 to 20 lines. The AI responds with 80 to 200 lines organized into sections, headers, and nested bullet points. This asymmetry is not because the AI has proportionally more to say. It is because text is a low-density medium for structured information. A single diagram communicates in one second what would take ten paragraphs to describe. A step-by-step visual conveys sequence and hierarchy that prose can only approximate. The AI over-produces text because it has no other channel through which to communicate density.

## **1.2 The Single-Channel Problem**

Text tries to be everything at once: explanation, structure, code, diagram, narrative, reference. None of these is text’s native job. Voice is better for explanation. Diagrams are better for structure. Code viewers are better for code. The chat interface collapses all of these into a flat text stream and asks the reader to mentally reconstruct the distinctions.

The introduction of voice interfaces partially addresses this. Conversation becomes faster and more natural. But voice alone introduces a different failure: it cannot carry structured information. Code spoken aloud is unusable. A diagram narrated verbally loses precision. Voice-only forces the AI to either read out structured content (which fails) or omit it entirely (which loses information). Neither is acceptable.

## **1.3 The Turn-Based Problem**

Chat is turn-based by design: one party sends, the other receives, then replies. This model made sense for messaging between two humans exchanging comparable volumes of information. It does not reflect what actually happens in a human–AI session, where the AI can generate and display multiple types of output simultaneously, and where the user’s response may be a single word, a gesture, or a silence. The turn-based structure is an artificial constraint that throttles the natural rhythm of the interaction.

## **1.4 The Absent Working Memory Problem**

In a chat session, messages are ephemeral once scrolled past. When either party needs to reference something established earlier, they must describe it verbally: “in step three you said…” or “that thing you mentioned about the loop…” This verbal pointing consumes communication bandwidth without adding information. There is no persistent shared surface both parties can see and refer to directly. Every reference must be re-established in words.

# **2\. The Core Insight**

The solution is not to improve text. It is to stop asking text to do everything.

Human cognitive architecture supports parallel processing of auditory and visual information. A person can listen to an explanation while simultaneously watching a diagram build, absorbing both streams without one cannibalizing the other. This is not true of two simultaneous text streams — reading competes with reading. The chat interface forces all information through the reading pathway and thereby discards the parallel visual channel entirely.

The proposal is to restore that channel. Voice carries the conversational, intuitive, human layer. A canvas carries the structured, dense, information layer. Both run simultaneously. They are synchronized: what the voice describes is reflected in real time on the canvas. Neither channel tries to do the other’s job.

**The analogy:** *A great lecturer speaks and draws simultaneously. A designer walks you through a mockup while explaining their thinking out loud. A surgeon narrates what they see while pointing at the scan. Voice and synchronized visual is the oldest and most natural teaching interface humans have ever used. Synapse brings that model to human–AI interaction.*

Critically, this is not just a UX convenience. The dual-channel architecture changes the fundamental nature of what gets communicated. The AI no longer needs to describe things it can show. The user no longer needs to re-read a wall of text to extract the structure embedded within it. The interaction becomes faster, denser, and more natural — not because of incremental optimization, but because the channel finally matches the content.

# **3\. Product Vision**

Synapse is a live, shared workspace. When a session begins, a canvas appears alongside a voice connection. The AI speaks naturally — not reading from a script, not listing headers, but conversing. Simultaneously, the canvas updates in real time to reflect what is being communicated. The user speaks back. The canvas persists and accumulates. Both the user and the AI have full visibility of the canvas at all times.

The canvas is not a fixed dashboard or a pre-designed template. It is a dynamic surface that generates itself based on the context of the conversation. When the conversation calls for a step list, a step list appears. When it calls for code, a code viewer opens. When it calls for a branching diagram, a diagram builds. When the conversation shifts, the canvas shifts with it.

The user interacts primarily through voice. When a different input modality is appropriate — selecting an answer, entering a value, pointing at an element — that input method appears on the canvas contextually and disappears when no longer needed. The interface generates itself to meet the moment.

# **4\. The Canvas**

The canvas is the primary visual surface of the interface. It occupies the majority of the screen when a session is active. It is persistent: it does not clear between turns or reset mid-session. It scrolls downward as the session builds, accumulating a visual record of the thinking.

The canvas is composed of components. Each component is a discrete visual unit serving a specific communicative function. Components appear, update, expand, and collapse as the conversation progresses. They are the building blocks of the canvas.

## **4.1 Component Types**

**Step List**

An ordered sequence of steps that populates incrementally as the AI narrates. Each step appears as the AI reaches it in its explanation — not all at once, but one by one, in sync with the voice. Steps can expand to reveal sub-steps. The AI does not read steps aloud; it elaborates on the concepts behind them verbally while the steps appear visually. The combination gives the user the structure on screen and the understanding through voice simultaneously.

**Code Viewer**

A syntax-highlighted code block that populates in real time as the AI writes or explains code. Lines or blocks appear as the AI narrates what they do. The AI does not read code character by character — it narrates intent and effect while the code itself appears on canvas. The code viewer includes an execution panel below it: when code is run, output, errors, and runtime behavior display there immediately.

**Flowchart and Diagram**

A node-and-edge diagram that builds as the AI explains a process, system, or structure. Nodes appear as concepts are introduced. Edges appear as relationships are established. Labels update as the AI names and describes elements. The diagram is not drawn all at once; it grows with the explanation, allowing the user to see structure emerge in real time.

**Mind Map**

A branching structure for ideation and exploration. A central concept sits at the center of the canvas, with branches extending outward as ideas are introduced. Sub-branches appear as the conversation deepens into a given area. The user can move, merge, prune, and rename branches by speaking. The AI can also propose new branches or reorganize existing ones as the thinking evolves. The mind map is collaborative by nature: both parties can reshape it throughout the session.

**Formula Display**

Mathematical or logical expressions rendered in clean notation. Builds incrementally as the AI works through a derivation, proof, or explanation. Variables are labeled. Steps are shown in sequence. The AI narrates the logic while the notation appears visually.

**Output Terminal**

Displays the results of code execution, test outputs, error messages, or data returns. Updates in real time as code runs. Errors are highlighted. The AI can direct the user’s attention to specific lines in the output verbally.

**Quiz Widget**

A question display paired with an appropriate input mechanism. Appears when the AI poses a question to the user. Disappears after the user responds. Takes several forms depending on the question type: multiple choice presents radio buttons with labeled options; short answer presents a text entry field; prediction presents a text field where the user enters an expected value or output; ranking presents draggable cards the user arranges in order. The AI calibrates which widget type matches the question.

**Text Note**

A formatted text block for definitions, summaries, key points, or reference material. Unlike chat responses, a Text Note is placed on the canvas as a persistent artifact, not a transient message. It stays visible and can be referenced throughout the session. Useful for establishing shared terminology, recording a decision, or anchoring a key concept.

**Image and Annotated Display**

For reference images, generated visuals, imported figures, or screenshots. Can be annotated by the AI with highlight overlays, arrows, or labeled regions. The AI can say “look at the top-left region here” and a highlight appears there on the image.

## **4.2 Canvas Behavior**

Components are identified by name, not pixel position. Every component on the canvas has a stable identifier — for example, “merge-step-3”, “loop-variable-block”, “error-output-panel” — that both the AI and the user can reference. This is what allows the AI to direct attention precisely without relying on coordinates that break with layout changes. When the AI says “look at the loop-variable-block”, that component highlights. When the user says “that node looks wrong” and points at something, the AI knows exactly which node is being referenced.

The canvas does not re-render from scratch when updated. Components are patched incrementally. A new step appearing in a step list does not redraw the existing steps. A new line appearing in a code viewer does not flash or reload. Updates are smooth and continuous, synchronized with the voice so that visual and audio arrive together.

The canvas persists for the full duration of the session, accumulating downward. At the end of a session, the canvas represents a complete visual record of the work done: the diagrams built, the code written, the questions posed and answered, the ideas branched and pruned. This record can be exported.

# **5\. Voice Interaction**

Voice is the primary input modality. The user speaks naturally, in full sentences, without special syntax or commands. The AI listens continuously and responds in natural speech. The interaction follows a conversational model, not a command model.

The user does not need to learn gesture vocabulary or system commands to use the interface. Statements like “I think there’s a branch missing here for the error case” cause a new branch to appear in the diagram. “Actually, let’s call that something else” causes a label to update. The AI interprets conversational intent and translates it into canvas changes. The user interacts with the canvas through the same natural language they use to think and discuss.

## **5.1 AI Voice Behavior**

* The AI speaks conversationally, not in the format of a structured document. It does not say “Step one. Step two. Step three.” It narrates while the steps appear on canvas.

* The AI does not recite code, formulas, or structured data verbally. It refers to the canvas: “as you can see, the function is iterating over each element here…”

* The AI can be interrupted mid-sentence. It handles the interruption, acknowledges the new input, and continues or redirects without losing context.

* When the AI needs specific input from the user, it asks naturally and the appropriate widget appears on the canvas. It does not enumerate options verbally if a visual widget communicates them more clearly.

* The AI does not over-produce speech. Because the canvas carries structured information, the voice is freed to carry only what voice does well: reasoning, explanation, emphasis, question, and response.

## **5.2 User Voice Behavior**

* The user can speak at any time, including while the AI is speaking or while the canvas is updating.

* The user can reference canvas elements by their visible labels or by pointing: “that node”, “this step”, “the error at the bottom.”

* The user can request changes to the canvas verbally: renaming, moving, adding, removing, expanding, or collapsing components.

* The user can redirect the session at any time by speaking. The canvas responds accordingly.

# **6\. Contextual Input Widgets**

Beyond voice, the user interacts with the canvas through contextual input widgets. A widget is an input element that appears on the canvas when the conversational context requires a specific type of user input. It disappears after the input is received. Widgets are determined by the AI based on what is being asked or required at that moment in the session.

## **6.1 Widget Types**

**Multiple Choice**

Appears when the AI poses a question with discrete, clearly bounded answer options. Example: during a code quiz, the AI asks what a variable will hold after a specific loop executes. Four options appear as radio buttons. The user selects one. The AI responds to the selection immediately.

**Short Text Entry**

Appears when the user needs to enter a specific value, prediction, name, or short string. Example: the AI asks the user to predict the return value of a function call. A text field appears. The user types their answer. The AI evaluates it.

**In-Canvas Code Editor**

A small, syntax-highlighted code editor that appears within the canvas when the user needs to write or modify a code snippet. The AI can see the user’s code in real time as they type. Example: the AI asks the user to fix a bug they have identified together. The editor opens with the buggy code pre-populated. The user edits it. The AI can comment as the user types.

**Slider**

Appears for numerical inputs with a known and bounded range. Example: the AI asks the user to select a probability threshold for a classifier. A labeled slider from 0.0 to 1.0 appears. The user drags to their chosen value.

**Drag-to-Arrange**

Appears when the AI asks the user to order a set of items. Labeled cards appear in a randomized order. The user drags them into sequence. Example: ordering the steps of an algorithm, or ranking the priority of features in a product decision exercise.

## **6.2 The Persistent Text Input**

A floating text input field is always present in a non-obtrusive corner of the interface. It does not require the widget system to activate. It is always available. This field exists for users who prefer to type at any point, for environments where voice is not practical, for cases where the user wants to paste content (a block of code, a link, a dataset), and as a transition mechanism for users still adjusting to voice-first interaction.

The persistent text input does not compete with the widget system. It supplements it. When a widget is active, the text input is still available. The user can use whichever channel fits the moment.

# **7\. Shared Visual Context**

The AI has full, continuous visibility of the canvas state. This is not a screenshot taken occasionally. It is a persistent awareness of what is on the canvas, which components are active, what content they contain, and what the user has interacted with or modified. Both parties are looking at the same surface at all times.

This shared visibility is what makes the canvas a working memory rather than just a display. The canvas is not where the AI sends output to be consumed and forgotten. It is a surface both parties write to, read from, and build upon together throughout the session.

## **7.1 What Shared Context Enables**

* The AI can notice when what it has drawn is incorrect or incomplete and correct it without being asked, because it can see the state of the canvas as the user sees it.

* The user can say “this part looks off” or point at an element, and the AI knows exactly what is being referenced without needing a verbal description.

* The AI can ask questions that require the user to look at a specific thing — “can you see why this node connects back here?” — and both parties are oriented to the same element.

* The AI can track which steps the user has acknowledged, which questions they answered correctly, and which elements they have interacted with, and adapt the session accordingly.

* Entire categories of verbal reference — “in step three”, “that thing you mentioned earlier”, “the error at the bottom” — are replaced by direct pointing. Conversational overhead drops substantially.

# **8\. Use Cases**

The following scenarios describe the interface in action. They are intended to be specific enough to communicate the full texture of the experience, not just the concept.

## **8.1 Algorithm Explanation and Code Walkthrough**

The user asks the AI to explain merge sort.

The AI begins speaking conversationally: “Merge sort works by repeatedly dividing an array in half until you have individual elements, then merging those back together in sorted order.” As it speaks, a Step List component opens on the canvas. Steps appear one by one, synchronized with the narration. The AI does not read the steps aloud. It explains the intuition behind them verbally while the structure appears visually.

The AI then says: “Let me show you how this looks in code.” The step list remains on canvas. A Code Viewer opens beside it. As the AI narrates the recursive call, that function appears in the viewer. As it mentions the merge operation, the merge function appears below. The AI does not read the code — it narrates intent: “you can see here how the left and right halves are being compared and combined.”

The AI then asks: “Before we run this — can you predict what happens if we initialize the index at 1 instead of 0?” A text input widget appears on the canvas. The user types their prediction. The AI evaluates it and runs both versions. Both outputs appear in the Output Terminal. The AI explains what happened, pointing to specific lines in the output.

## **8.2 Ideation Session**

The user says: “I want to think through the business model for this product.”

A Mind Map component opens on the canvas with the product name at the center. As the user and AI talk, primary branches appear: Revenue Streams, Customer Segments, Value Proposition, Key Costs. As the conversation moves deeper into Revenue Streams, sub-branches appear: Subscription, Enterprise License, API Access.

The user says: “Wait, API access might fit better under Customer Segments — it’s more of a channel than a revenue model.” The API Access node moves to Customer Segments on the canvas. The user says “actually let’s call them users and buyers, not end users and economic buyers.” The labels update. By the end of the session, the canvas holds a full visual representation of the thinking. The user exports it.

## **8.3 Tutoring and Assessment**

The user is studying for an exam on tree data structures. The AI says: “Let’s work through some traversal questions.”

A Text Note component appears with the question. A Diagram component appears below it showing the tree. A short text entry widget appears. The user types their answer. If correct, the AI confirms and an animated path traces the traversal order across the tree on the canvas. If incorrect, the AI asks the user to walk through their reasoning aloud. As the user explains, the AI annotates the tree diagram to show where the reasoning diverged. The correction is visual, not just verbal.

The quiz continues. Each question, diagram, user response, and correction accumulates on the canvas. At the end of the session, the user has a complete visual record of every question, their answers, and the correct paths — exportable as study notes.

## **8.4 Live Debugging**

The user has written code that is producing an unexpected result. They paste it via the persistent text input. It appears in a Code Viewer on the canvas. The AI reads it and runs it. The Output Terminal shows the result. The AI highlights a specific block in the code viewer and identifies the bug. The In-Canvas Code Editor activates for that block. The user makes the change. The output updates. The entire debugging session is visible on the canvas: original code, incorrect output, identified bug, fix, correct output.

# **9\. Potential Implementation Direction**

This section describes a plausible technical direction for building Synapse. It is not a prescriptive stack but a conceptual architecture grounded in the tools and design decisions discussed during the development of this concept. The intent is to give a builder sufficient orientation to begin making real implementation decisions without over-specifying choices that depend on context.

## **9.1 The Voice Layer: Gemini Live API**

The voice connection — the real-time, interruptible, bidirectional audio channel between the user and the AI — is well-suited to Google’s Gemini Live API. The Live API supports continuous audio input and output, handles barge-in (the user interrupting the AI mid-sentence), and maintains session context across turns. These properties are foundational to Synapse: without continuous audio and natural interruption handling, the voice layer degrades into something that still feels turn-based.

An important capability of the Gemini Live API relevant to Synapse is screen awareness. The API can receive visual input — including a live view of what is on the user’s screen. This is what enables the shared visual context described in Section 7\. The AI does not just hear the user; it can see the canvas. When the user says “that node looks off,” the AI can observe which node the user is referring to based on what is currently visible. This makes the pointing and referencing behaviors described throughout this document technically achievable without requiring the user to do anything special to communicate what they are looking at.

## **9.2 The Canvas Architecture: Components, Not Generated Code**

The most consequential architectural decision for the canvas is this: the AI should never generate the frontend code that renders the canvas. It should generate descriptions of what the canvas should contain, and a pre-built renderer should interpret those descriptions and draw accordingly.

This distinction matters for several reasons. Generating frontend code on the fly is slow, error-prone, and creates a session management problem: if the canvas is being rendered from dynamically generated code, updating it mid-session requires stopping and restarting the renderer, which breaks the live session. Generating a lightweight structured description — a data object specifying which component to show, what it contains, and how it should be updated — is fast, stable, and allows the canvas to update incrementally without disrupting anything.

The practical form of this is a canvas state object: a structured data format (JSON is the natural choice for its lightness and near-universal frontend compatibility) that describes the current state of the canvas. The AI emits updates to this object as the conversation progresses. The frontend renderer, which is pre-built and always running, watches for updates and applies them to the canvas. No code is generated. No session is restarted. The canvas simply reflects the current state of the object.

**The key principle:** *The AI decides what to show. The renderer decides how to show it. These are two separate responsibilities that should never be combined into a single code-generation step.*

## **9.3 The Modular Component Library**

Because the AI is not generating code, it needs a vocabulary of components to work from. This vocabulary is a finite, pre-built library of component types — the same types described in Section 4.1: step list, code viewer, flowchart, mind map, formula display, output terminal, quiz widget, text note, annotated image. Each component type has a defined schema: the fields the AI must populate to invoke it, and the fields it can update incrementally over time.

The AI learns this library as part of its operational context. When the conversation calls for a step list, the AI emits a canvas update that says: invoke the step-list component, give it this identifier, populate it with these initial steps. As the explanation progresses, it emits further updates: add this step, expand this step to reveal these sub-steps. The component handles all visual rendering; the AI only handles content and sequencing.

This is also what gives the system its modularity. Because each component is self-contained and pre-built, adding a new component type — a timeline, a comparison table, a probability distribution — means adding one new item to the library and one new schema entry. The rest of the system does not change. The AI simply gains a new word in its vocabulary.

The library also provides a caching benefit. The first time a code viewer appears in a session, the renderer instantiates it. If a second code viewer is needed later, the same component definition is reused. Nothing needs to be regenerated or re-fetched. The system becomes lighter and faster the more it is used within a session.

## **9.4 Incremental State Patching**

The canvas state object is never replaced wholesale. It is patched. When a new step appears in a step list, only that step is added to the relevant component’s entry in the state object. The renderer observes the patch, updates that one component, and leaves everything else on the canvas untouched. This is how the canvas achieves the smooth, continuous update behavior described in Section 4.2 — individual elements appearing in sync with the voice without any flicker, reload, or visual disruption.

The patch-based approach also means that the full canvas state at any point in a session is a complete, serializable description of everything on the canvas. This is the foundation for session export and, eventually, session persistence across time.

## **9.5 Named Element Identifiers**

Every component placed on the canvas is assigned a stable, human-readable identifier at the time of creation. This identifier is included in the canvas state object and is known to both the AI and the frontend renderer. When the AI needs to reference a specific element — to highlight it, update it, point the user toward it, or modify it — it uses that identifier rather than a pixel coordinate or a positional description.

This design is robust to layout changes. If the canvas reflows because new content is added above a component, the identifier still points to the right thing. If the user has scrolled, the identifier still resolves correctly. And because the identifiers are human-readable (derived from the content they represent rather than randomly generated), the AI can use them naturally in its speech: “look at the merge-step component” is something the AI can say because it knows what it named that component when it created it.

## **9.6 The Voice–Canvas Sync Challenge**

Running voice and canvas in parallel introduces a timing challenge. The AI speaks continuously, and canvas updates need to arrive at the moment the voice reaches the relevant content — not half a second before (which feels like the visual is rushing ahead) and not half a second after (which feels like a lag). In practice, some desync is unavoidable given network and processing latency.

The design approach to this is not to eliminate the desync but to make it feel intentional. If visual elements appear just slightly after the AI mentions them, that can feel like natural emphasis — the way a presenter clicks to advance a slide beat after they say something, not before. The goal is a rendering pipeline fast enough that updates arrive within a perceptually comfortable window of the corresponding voice, and a system tuned to err on the side of visual-slightly-after-voice rather than the reverse.

The lightweight nature of the JSON patch approach helps substantially here. A small structured update sent over a live connection is orders of magnitude faster than generating and rendering new code. The bottleneck is network and model latency, not computation. Choosing fast, low-latency model variants for the canvas update pathway (distinct from the voice reasoning pathway) is one way to close the gap further.

## **9.7 Two Parallel Processes**

The overall system can be thought of as two parallel processes running simultaneously and coordinated by the AI. The first is the voice process: the AI maintains the live audio session, listens to the user, speaks, handles interruptions, and manages the conversation. The second is the canvas process: the AI emits structured canvas updates as the conversation progresses, and the frontend renderer applies them.

These processes share the same AI session context. The AI is not two separate models. But the outputs are different: one produces speech, one produces canvas state patches. Coordinating these two output streams — deciding what to say and what to draw, and keeping them synchronized — is one of the more nuanced parts of the system prompt and session design.

A reasonable implementation starting point is to treat canvas updates as a structured tool call or function output that the AI can emit alongside its spoken response. The frontend listens for both: audio output goes to the speaker, canvas update output goes to the renderer. The user experiences both simultaneously.

# **10\. What This Is Not**

Defining boundaries is as important as defining scope. The following are explicitly outside the concept described in this document.

**Not a screen reader or UI navigator**

Synapse does not observe an existing application and control it. It does not take over the user’s browser or desktop. The canvas is its own native surface, not an overlay on something else.

**Not a voice-to-text layer over chat**

This is not a chat interface with voice input bolted on. The chat window is not the output. There is no stream of text messages. The canvas and voice together are the output. The text-in / text-out model is replaced, not augmented.

**Not a task-execution agent**

This document describes the interaction layer — how a user and an AI communicate and co-think. The question of autonomous agents executing multi-step tasks in the background is a separate concern and is outside this scope. Synapse is about the conversation, not the automation.

**Not an always-identical interface**

The canvas looks different in every session because it generates itself based on the conversation. There is no default view, no empty state with pre-placed widgets, no fixed layout. The interface arrives at the shape it takes because of what is said. Two sessions on different topics will look like entirely different products.

**Not voice-only**

Voice is the primary modality, but Synapse degrades gracefully. In environments where voice is not practical, the user can type via the persistent text input. The AI still responds with voice and canvas. The canvas still updates. The experience is reduced but functional.

# **11\. Open Questions**

The following are significant design questions that this document leaves deliberately open. They are not oversights; they are decisions that require further thinking, user research, or experimentation before they can be answered with confidence.

## **Canvas Persistence Across Sessions**

Does the canvas from a previous session carry over into a new one? If yes, the canvas becomes a long-term knowledge artifact — a shared notebook between user and AI that grows over time. Sessions connect. The AI has access to all previous visual work. This changes the nature of the ongoing relationship between user and agent in ways that are potentially very powerful and potentially very complex. This is the most consequential open question in the concept.

## **Direct Canvas Manipulation**

To what extent can the user directly edit canvas components without speaking? Can they click into a Code Viewer and type directly? Can they drag nodes in a diagram using a cursor? The current concept assumes voice and contextual widgets as the primary interaction modes, but direct manipulation of canvas elements is a natural complement that would increase the range of things a user can do without speaking. The design of this interaction — what is always manipulable directly, what requires voice, and how direct manipulation and voice coexist — needs to be worked out.

## **Multi-User Canvas**

Can two human users share a canvas session with a single AI? This is not required for the core concept but is a natural extension — particularly for collaborative work, tutoring, or pair programming. The design implications are significant: voice attribution, turn management, and canvas ownership all become more complex.

## **Canvas Privacy**

The AI has full visibility of the canvas. When the canvas contains sensitive material — personal notes, proprietary code, confidential data — the boundaries of that visibility and the handling of that data must be clearly defined. This is a product and policy question as much as a design one.

## **The Naming and Navigation of a Long Canvas**

As a session extends, the canvas accumulates. In a long session, it may contain dozens of components spread across significant vertical space. How does the user navigate this? How does the AI refer the user to something far up in the canvas without requiring them to scroll? This is a practical UX problem that will emerge as soon as the system is used for any serious extended work.

# **Appendix: Design Principles**

The following principles guided the thinking in this document. They are not rules but orientations — heuristics for making decisions when the concept is extended or instantiated.

* The channel should match the content. Voice for conversation. Canvas for structure. Never force structured content through voice or conversational content onto the canvas.

* The interface should generate itself. No fixed layout, no empty state to fill. The canvas takes the shape the conversation requires.

* Shared context is the product. The fact that both parties see the same surface at all times is not a feature — it is the core of what makes the interaction work.

* Conversational overhead should approach zero. Any verbalization that exists only to point at something that is already visible on the canvas is waste. The design should eliminate it.

* The canvas accumulates. It is a record, not a scratch pad. By the end of a session, the canvas should be worth keeping.

* Degrade gracefully. Every voice-primary interaction should have a text fallback. The interface should work in constrained environments.

* Introduce nothing that requires learning. The paradigm is new; the gestures must be so intuitive that the learning curve is invisible.

*End of Document — Synapse Concept PRD v0.2*