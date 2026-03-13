"""
Creates a demo project with sample folders and documents when a new user registers.
The demo showcases Mive's AI-first capabilities with a guided tour.
"""
import uuid
from .models import Agent, Comment, Critique, Node, Project, Version
from .utils import get_default_workspace


# ---------------------------------------------------------------------------
# Demo content for each document
# ---------------------------------------------------------------------------

WELCOME_MD = """\
Welcome to **Mive** — where AI is your writing partner from the very first word.

Mive isn't just another editor with AI bolted on. Everything here is built around the idea that writing is better when you have a smart collaborator by your side — one that understands your project, remembers your style, and never gets tired.

Here's what makes Mive different:

- **AI that knows your project** — your assistant reads your brief, your documents, and your structure to give contextual help
- **Multiple AI agents** — set up different personas (a creative partner, a strict editor, a researcher) and switch between them with @mentions
- **Review & Critique** — get structured feedback on your writing, from quick grammar checks to deep evaluations with scores
- **Write together** — ask the AI to draft, expand, or rewrite sections while you focus on the ideas

This project is your playground. Each document walks you through a different AI feature — read them, try them out, and see how AI can transform your writing workflow.

> Start with the **AI Features** folder to explore what's possible, or jump straight to **Your First Project** when you're ready to create something of your own.
"""

CHAT_ASSISTANT_MD = """\
The Chat Assistant is your always-on writing partner. It lives in the right panel and knows everything about the document you're working on.

## Opening the assistant

Click the assistant icon in the top bar, or use the keyboard shortcut. The panel slides open alongside your editor — you write on the left, chat on the right.

## What you can ask

The assistant is context-aware. It reads your current document and your project brief, so you can jump right in:

- *"Make this intro more engaging"*
- *"I'm stuck on the transition between these two sections — help?"*
- *"Suggest three different endings for this paragraph"*
- *"Rewrite this in a more conversational tone"*

You don't need to copy-paste your text into the chat — the AI already sees it.

## Conversations are saved

Each document keeps its own conversation history. Come back tomorrow and your chat is still there. Start a new conversation anytime with the + button.

## Try it now

Open the assistant panel and type something like:

*"Suggest a better title for this document"*

Watch how it responds with awareness of what you're reading right now.
"""

AI_REVIEW_MD = """\
AI Review scans your entire document and leaves targeted suggestions — like having an editor mark up your draft with a red pen, but faster and always available.

## How to run a review

Open the assistant panel, switch to the **Review** tab, and hit **Review All**. You can also run focused reviews:

- **Grammar** — catches typos, agreement errors, and punctuation issues
- **Style** — flags passive voice, wordiness, and unclear phrasing
- **Review All** — does everything at once

## Working with suggestions

Each suggestion appears as a card in the Review tab:

- **Accept** — applies the change to your document instantly
- **Dismiss** — removes the suggestion if you disagree
- **Reply** — discuss the suggestion with the AI, ask for alternatives

When you click a suggestion, the relevant text highlights in the editor so you can see exactly what it refers to.

## Mentioning agents in replies

Type **@** in a reply to invoke a specific agent. For example, if you have an "Editor" agent, reply with *"@Editor can you suggest a more concise version?"* — and that agent will respond with its own perspective.

## Try it now

This paragraph has some deliberetly awkward phrasing and a mispelled word. Run a **Grammar** review from the Review tab and watch the suggestions appear. Try accepting one and dismissing another.
"""

AI_CRITIQUE_MD = """\
While Review focuses on line-by-line suggestions, Critique takes a step back and evaluates your writing as a whole — structure, argument, clarity, and impact.

## How it works

Open the assistant panel, switch to the **Review** tab, then click the **Critique** sub-tab. Hit **Critique** to start.

The AI reads your entire document and returns:

- An **overall score** (out of 10)
- **Section-by-section** evaluations, each with its own score and detailed feedback
- Specific recommendations for improvement

## Discussing sections

Each critique section has a **Discuss** button. Click it to open a thread where you can ask the AI to elaborate:

- *"What specifically would improve the structure here?"*
- *"Can you give me an example of what you mean?"*
- *"@Writing Coach help me rework this section"*

The AI remembers the critique context, so the conversation stays focused.

## Applying feedback

When the AI suggests changes in a discussion, click **Apply** to send the suggestion to your chat assistant for implementation.

## Running multiple critiques

You can run new critiques as you revise. The **History** button lets you compare scores over time — watch your writing improve with each iteration.

## Try it now

Run a critique on this document. Look at the section scores and try discussing one of the lower-scored sections.
"""

SMART_AGENTS_MD = """\
Agents are the heart of Mive's AI-first approach. Instead of one generic assistant, you can create specialized personas — each with its own personality, expertise, and writing style.

## Your pre-configured agents

This project comes with four agents ready to use:

- **The Mirror** — reflects back what you wrote, reformulated, so you see if you said what you meant. Precise and Socratic.
- **The Challenger** — questions your ideas and finds the weak spots in your arguments. Intellectually provocative but respectful.
- **The Polisher** — pure editing. Cuts, adjusts, tightens. Only craft, never content. Terse and surgical.
- **The Explorer** — expands ideas. Brings references, connections, and tangential insights. Curious and expansive.

## Using @mentions

In any reply thread (in reviews or critiques), type **@** followed by the agent name:

- *"@The Polisher can you tighten this paragraph?"*
- *"@The Challenger what's the weakest argument here?"*
- *"@The Explorer what references connect to this idea?"*

The agent picker appears as you type — select the agent and send your message. The response will come from that agent's perspective.

## Switching your main assistant

In the chat panel, you'll see an agent selector at the top. Click it to switch which agent powers your main conversation. Each agent brings a different approach:

- **The Mirror** will reformulate your ideas and ask if that's what you meant
- **The Challenger** will push back and find gaps in your reasoning
- **The Polisher** will silently rewrite your sentences to be sharper
- **The Explorer** will open new doors and draw unexpected connections

## Creating your own agents

Go to **Settings** to create custom agents. Give them a name, a system prompt that defines their personality, and optionally set a specific AI model and temperature.

Higher temperature = more creative, lower = more precise.

## Try it now

Open the assistant panel and switch between the four agents. Ask each one the same question — *"How would you improve this document?"* — and notice how different the responses are.
"""

SLASH_COMMANDS_MD = """\
Slash commands let you invoke AI actions right where you're writing — no need to switch to the chat panel.

## How to use them

Place your cursor in the editor and type `/`. A command palette appears with available actions.

## Available commands

- **/write** — generate text from a prompt at the cursor position
- **/continue** — the AI continues writing from where you left off
- **/expand** — takes the current paragraph and makes it longer and more detailed
- **/shorten** — condenses the current paragraph while keeping the key points
- **/improve** — rewrites the current paragraph for better clarity and flow
- **/summarize** — generates a summary of the entire document
- **/translate** — translates selected text to another language

## How it works

When you trigger a command, the AI streams its response directly into your document. You'll see a diff view showing what changed — accept or reject the changes with one click.

The AI uses your project context, so the generated text matches your document's style and content.

## Combining with agents

Slash commands use whichever agent is currently selected in the assistant panel. Switch to the **Editor** agent before running `/improve` for a more critical rewrite, or use the **Writing Coach** for a more creative expansion.

## Try it now

Place your cursor at the end of this line and type `/continue` to see the AI pick up where this document leaves off.
"""

FIRST_PROJECT_MD = """\
You've seen what Mive can do. Now it's time to create something of your own.

## Create a new project

Click **New Project** in the sidebar. You'll be guided through a quick setup:

1. **Describe your project** — tell the AI what you're working on
2. **Answer a question or two** — the AI might ask for details to structure things better
3. **Name it** — pick a name or let the AI suggest one

That's it. Mive will generate a document structure tailored to your project type — chapters for a novel, sections for an article, briefs for a product spec — plus custom AI agents suited to your work.

## Tips for getting the most out of Mive

- **Write your project brief** — the more context the AI has, the better it helps
- **Use different agents for different tasks** — creative brainstorming, then editing, then fact-checking
- **Review early, review often** — run AI reviews as you draft to catch issues while they're easy to fix
- **Let the AI draft, you direct** — use slash commands to generate first drafts, then shape them into your voice

## Your writing, amplified

Mive doesn't write *for* you — it writes *with* you. The AI handles the heavy lifting so you can focus on what matters: your ideas, your voice, your story.

Happy writing.
"""


# ---------------------------------------------------------------------------
# Tree definition: (title, type, content, children)
# ---------------------------------------------------------------------------

DEMO_TREE = [
    ("Welcome", "file", WELCOME_MD, []),
    ("AI Features", "folder", "", [
        ("Chat Assistant", "file", CHAT_ASSISTANT_MD, []),
        ("AI Review", "file", AI_REVIEW_MD, []),
        ("AI Critique", "file", AI_CRITIQUE_MD, []),
        ("Smart Agents", "file", SMART_AGENTS_MD, []),
        ("Slash Commands", "file", SLASH_COMMANDS_MD, []),
    ]),
    ("Get Started", "folder", "", [
        ("Your First Project", "file", FIRST_PROJECT_MD, []),
    ]),
]

# ---------------------------------------------------------------------------
# Pre-configured agents
# ---------------------------------------------------------------------------

DEMO_AGENTS = [
    {
        "name": "The Mirror",
        "config": {
            "system_prompt": (
                "You are The Mirror. Your role is to reflect back the writer's ideas "
                "in different words, helping them see if they communicated what they "
                "intended. Never suggest changes — only reformulate and ask 'Is this "
                "what you meant?' Be precise, neutral, and Socratic. Use questions, "
                "not statements."
            ),
            "temperature": 0.3,
        },
    },
    {
        "name": "The Challenger",
        "config": {
            "system_prompt": (
                "You are The Challenger. Your role is to question the writer's ideas, "
                "find logical gaps, and play devil's advocate. Ask 'Do you really "
                "believe this? What would someone who disagrees say?' Be intellectually "
                "provocative but respectful. Push the writer to think harder, never to "
                "give up."
            ),
            "temperature": 0.6,
        },
    },
    {
        "name": "The Polisher",
        "config": {
            "system_prompt": (
                "You are The Polisher. Your role is pure editing craft — cut unnecessary "
                "words, tighten sentences, improve rhythm and flow. Never comment on the "
                "ideas or content — only on the writing itself. Be terse and surgical. "
                "Show, don't explain. When suggesting changes, just show the improved "
                "version."
            ),
            "temperature": 0.2,
        },
    },
    {
        "name": "The Explorer",
        "config": {
            "system_prompt": (
                "You are The Explorer. Your role is to expand the writer's thinking — "
                "bring references, draw connections to other ideas, suggest tangential "
                "angles they haven't considered. Say things like 'This reminds me of...' "
                "and 'Have you considered...?' Be curious, associative, and expansive. "
                "Open doors, don't close them."
            ),
            "temperature": 0.8,
        },
    },
]


# ---------------------------------------------------------------------------
# Pre-loaded review suggestions (for the Welcome document)
# ---------------------------------------------------------------------------

DEMO_SUGGESTIONS = [
    {
        "quoted_text": "Mive isn't just another editor with AI bolted on.",
        "body": (
            "This is a strong opening hook, but consider making the contrast "
            "even sharper by showing what 'bolted on' means in practice."
        ),
        "suggested_text": (
            "Mive isn't another editor where AI lives in a sidebar you forget about."
        ),
    },
    {
        "quoted_text": "one that understands your project, remembers your style, and never gets tired",
        "body": (
            "The three-part list is effective, but 'never gets tired' feels slightly "
            "cliché. Consider replacing it with something more specific to the product."
        ),
        "suggested_text": (
            "one that understands your project, remembers your style, and improves with every interaction"
        ),
    },
    {
        "quoted_text": "This project is your playground.",
        "body": (
            "Nice invitation! You could strengthen it by hinting at what the user "
            "will discover."
        ),
        "suggested_text": (
            "This project is your playground — every document below is a hands-on tutorial you can edit."
        ),
    },
]

# ---------------------------------------------------------------------------
# Pre-loaded critique (for the Welcome document)
# ---------------------------------------------------------------------------

DEMO_CRITIQUE = {
    "overall_score": 7,
    "summary": (
        "A solid introduction that clearly communicates Mive's value proposition. "
        "The AI-first positioning is effective and the tone is inviting. "
        "There's room to improve specificity in a few areas and the call-to-action "
        "could be stronger."
    ),
    "sections": [
        {
            "id": "s1",
            "title": "Opening Hook",
            "score": 8,
            "body": (
                "The opening line immediately establishes Mive's identity. "
                "'AI is your writing partner from the very first word' is memorable "
                "and sets the right expectation. The follow-up paragraph effectively "
                "contrasts Mive with generic editors."
            ),
        },
        {
            "id": "s2",
            "title": "Feature Presentation",
            "score": 7,
            "body": (
                "The bullet list covers the key differentiators well, but the descriptions "
                "are somewhat abstract. 'AI that knows your project' is great, but the others "
                "could benefit from concrete examples — what does 'write together' look like "
                "in practice? A brief scenario would make each point more vivid."
            ),
        },
        {
            "id": "s3",
            "title": "Call to Action",
            "score": 6,
            "body": (
                "The closing blockquote provides direction but could be more compelling. "
                "Consider adding a sense of progression — what will the user achieve by "
                "the end of the tour? A specific promise ('In 5 minutes, you'll see how AI "
                "can draft, review, and refine your writing') would be more motivating."
            ),
        },
    ],
}


def create_demo_project(user):
    """Create a demo project with AI-first sample content for a newly registered user."""
    workspace = get_default_workspace()

    project = Project.objects.create(
        workspace=workspace,
        owner=user,
        name="Discover Mive",
        brief="Your AI-powered writing studio — explore what AI can do for your writing.",
    )

    created_nodes = {}

    def _create_nodes(items, parent, order_start=0):
        for i, (title, node_type, content, children) in enumerate(items):
            node = Node.objects.create(
                project=project,
                parent=parent,
                type=node_type,
                title=title,
                order=order_start + i,
                content_md=content,
            )
            created_nodes[title] = node
            if node_type == "file" and content:
                Version.objects.create(node=node, content_md=content)
            if children:
                _create_nodes(children, parent=node)

    _create_nodes(DEMO_TREE, parent=None)

    # Create agents
    for agent_data in DEMO_AGENTS:
        Agent.objects.create(
            project=project,
            name=agent_data["name"],
            config=agent_data["config"],
        )

    # Create pre-loaded review suggestions on the Welcome document
    welcome_node = created_nodes.get("Welcome")
    if welcome_node:
        for suggestion in DEMO_SUGGESTIONS:
            content = welcome_node.content_md
            quoted = suggestion["quoted_text"]
            pos_from = content.find(quoted)
            pos_to = pos_from + len(quoted) if pos_from >= 0 else None

            Comment.objects.create(
                node=welcome_node,
                body=suggestion["body"],
                quoted_text=quoted,
                suggested_text=suggestion["suggested_text"],
                author_type=Comment.AuthorType.ASSISTANT,
                author_label="Editor",
                comment_type=Comment.CommentType.REVIEW,
                status=Comment.Status.OPEN,
                position_from=pos_from if pos_from >= 0 else None,
                position_to=pos_to,
            )

        # Create pre-loaded critique
        Critique.objects.create(
            node=welcome_node,
            overall_score=DEMO_CRITIQUE["overall_score"],
            summary=DEMO_CRITIQUE["summary"],
            sections=DEMO_CRITIQUE["sections"],
        )

    return project
