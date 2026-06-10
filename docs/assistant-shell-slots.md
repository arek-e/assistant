# Assistant Shell Slots

Status: active product structure note
Date: 2026-06-10

## Purpose

This note defines the durable shell regions for the assistant workspace. These terms should be used consistently in product discussion, component naming, and implementation reviews.

## Primary Rail

Stable workspace modes and persistent account controls.

- Assistant / chat
- Work queue / tasks
- Integrations / tools
- Memory / knowledge
- Settings
- Bottom: theme + user profile

## Secondary Nav

Contextual to the selected primary mode.

- Assistant: current chat, chat history, new chat
- Work queue: scheduled tasks, approvals, failed runs
- Integrations: MCP servers, available tools, connection state
- Memory: saved facts, pending review, debugger
- Settings: model, privacy, workspace controls

## Workspace Preview

Optional center preview surface for documents, task artifacts, plans, or other work objects. When present, this slot takes the central workspace area and the chat moves into a right-side work/chat column.

- document preview
- task artifact preview
- generated plan preview
- uploaded file preview
- editable work object preview

## Main Content

Active work surface.

- chat stream
- task detail
- integration setup
- memory review
- settings view

When `Workspace Preview` is open, `Main Content` becomes the right-side chat/work column instead of owning the full central surface.

## Right Details

Accountability/control inspector.

- runtime status
- agent state
- tools/servers involved
- approvals, failures, recovery
- object metadata for the selected item

## Implementation Slots

The current shell implementation should expose these DOM slots:

- `data-shell-slot="primary-rail"`
- `data-shell-slot="secondary-nav"`
- `data-shell-slot="workspace-preview"`
- `data-shell-slot="main-content"`
- `data-shell-slot="right-details"`
