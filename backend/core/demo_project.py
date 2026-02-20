"""
Creates a demo project with sample folders and documents when a new user registers.
"""
from .models import Node, Project, Version
from .utils import get_default_workspace


# ---------------------------------------------------------------------------
# Demo content for each document
# ---------------------------------------------------------------------------

WELCOME_MD = """\
Welcome to **Mive** — your AI-powered writing studio.

Mive helps you write, organize, and refine your ideas in one place. Here's what you can do:

- **Write** in a clean, distraction-free editor with full Markdown support
- **Organize** your work into projects, folders, and documents
- **Collaborate with AI** — get suggestions, reviews, and replies right inside the editor
- **Export** your finished work to PDF, DOCX, or EPUB
- **Version history** — every change is tracked so you can go back in time

> This demo project is yours to explore. Edit anything, delete what you don't need, or use it as a reference.

Feel free to start writing in any document, or create a new project from the sidebar.
"""

QUICK_START_MD = """\
## 1. Create a project

Click **New Project** in the sidebar to start fresh. Give it a name and an optional description.

## 2. Add folders and documents

Use the **+** button in the document tree to create:

- **Folders** to group related documents
- **Documents** to write your content

## 3. Write with Markdown

The editor supports full Markdown — headings, lists, bold, italic, code, tables, and more. Check the *Formatting Guide* folder for examples.

## 4. Use the AI assistant

- Select text and click **Comment** to get AI feedback on a specific passage
- Open the **Assistant panel** (right side) to chat about your document
- Type `/` in the editor to access slash commands

## 5. Manage versions

Every save creates a version automatically. Click the **clock icon** in the toolbar to browse your version history and restore any previous state.

---

That's it! You're ready to start writing.
"""

TEXT_STYLING_MD = """\
This document demonstrates all the text styling options available in the editor.

## Bold

Use double asterisks for **bold text**. Great for emphasis and key terms.

## Italic

Use single asterisks for *italic text*. Useful for titles, foreign words, or subtle emphasis.

## Strikethrough

Use double tildes for ~~strikethrough text~~. Handy for showing corrections or removed content.

## Inline code

Use backticks for `inline code`. Perfect for mentioning `variable names`, `file paths`, or `commands`.

## Combining styles

You can combine styles freely:

- ***Bold and italic***
- **~~Bold and strikethrough~~**
- *`Italic with code`*

---

*Tip: Select any text and use the formatting toolbar that appears above your selection.*
"""

STRUCTURE_LAYOUT_MD = """\
This document shows how to structure your content with headings, lists, quotes, and dividers.

## Headings

Headings create hierarchy in your document. Use `#` for levels:

# Heading 1
## Heading 2
### Heading 3
#### Heading 4

## Unordered lists

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

## Ordered lists

1. First step
2. Second step
3. Third step
   1. Sub-step A
   2. Sub-step B

## Task lists

- [x] Completed task
- [x] Another done
- [ ] Still pending
- [ ] One more to go

## Blockquotes

> This is a blockquote. Use it for callouts, citations, or to highlight important information.
>
> You can have multiple paragraphs inside a quote.

## Horizontal rules

Use three dashes to create a divider:

---

They're great for separating sections visually.
"""

ADVANCED_FORMATTING_MD = """\
This document covers code blocks, tables, and links.

## Code blocks

Use triple backticks for code blocks with syntax highlighting:

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}
```

```python
def greet(name):
    return f"Hello, {name}!"
```

## Tables

Tables use pipes and dashes:

| Feature       | Shortcut   | Description              |
| ------------- | ---------- | ------------------------ |
| Bold          | `Ctrl+B`   | Make text bold           |
| Italic        | `Ctrl+I`   | Make text italic         |
| Code          | `Ctrl+E`   | Inline code              |
| Strikethrough | —          | Cross out text           |

## Links

Create links with `[text](url)` syntax:

[Markdown Guide](https://www.markdownguide.org) is a great reference for learning Markdown.

## Images

Add images with `![alt text](url)` syntax. You can paste images directly into the editor too.

---

*These are the main formatting tools you'll need. The editor renders everything in real-time as you type.*
"""

PROJECTS_FOLDERS_MD = """\
Mive organizes your work in a simple hierarchy:

## Projects

A **project** is the top-level container. Think of it as a book, a report, or any collection of related writing.

- Each project has its own document tree
- Projects can have a brief that guides the AI assistant
- You can share projects with collaborators

## Folders

**Folders** group related documents inside a project. Use them to create chapters, sections, or any logical structure.

- Folders can be nested inside other folders
- Drag and drop to reorder
- Click the folder name to rename it

## Documents

**Documents** are where you write. Each document:

- Has its own version history
- Can have inline comments
- Can have its own AI agent configuration
- Supports full Markdown formatting

## Tips for organizing

1. **Start simple** — you can always restructure later
2. **Use folders for chapters** in longer projects
3. **One idea per document** keeps things focused
4. **Drag to reorder** documents and folders in the tree
"""

AI_ASSISTANT_MD = """\
Mive includes a built-in AI assistant that can help you write, edit, and refine your work.

## Chat with the assistant

Open the **Assistant panel** on the right side of the editor. You can:

- Ask questions about your document
- Request rewrites or expansions
- Get feedback on tone, clarity, or structure
- Brainstorm ideas

Each document has its own conversation history.

## Inline comments

1. Select a passage of text
2. Click the **Comment** button in the formatting toolbar
3. The AI will review your selection and provide suggestions

Comments appear in the margin and can be resolved, approved, or rejected.

## Slash commands

Type `/` in the editor to open the command palette. Available commands include:

- `/continue` — ask the AI to continue writing from the cursor
- `/improve` — get suggestions for the current paragraph
- `/summarize` — generate a summary of the document

## AI review

Request a full document review from the toolbar. The AI will analyze your entire document and leave comments on specific passages that could be improved.

---

*The assistant uses the context of your project — including other documents and your project brief — to give more relevant suggestions.*
"""


# ---------------------------------------------------------------------------
# Tree definition: (title, type, content, children)
# ---------------------------------------------------------------------------

DEMO_TREE = [
    ("Getting Started", "folder", "", [
        ("Welcome", "file", WELCOME_MD, []),
        ("Quick Start Guide", "file", QUICK_START_MD, []),
    ]),
    ("Formatting Guide", "folder", "", [
        ("Text Styling", "file", TEXT_STYLING_MD, []),
        ("Structure & Layout", "file", STRUCTURE_LAYOUT_MD, []),
        ("Advanced Formatting", "file", ADVANCED_FORMATTING_MD, []),
    ]),
    ("Organizing Your Work", "folder", "", [
        ("Projects & Folders", "file", PROJECTS_FOLDERS_MD, []),
        ("Using the AI Assistant", "file", AI_ASSISTANT_MD, []),
    ]),
]


def create_demo_project(user):
    """Create a demo project with sample content for a newly registered user."""
    workspace = get_default_workspace()

    project = Project.objects.create(
        workspace=workspace,
        owner=user,
        name="Welcome to Mive",
        brief="A demo project showcasing folders, documents, and formatting.",
    )

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
            if node_type == "file" and content:
                Version.objects.create(node=node, content_md=content)
            if children:
                _create_nodes(children, parent=node)

    _create_nodes(DEMO_TREE, parent=None)

    return project
