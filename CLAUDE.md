# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Binfer Notes** - A modern note-taking web application built with Next.js 15 and TypeScript. This is a frontend rewrite of a legacy Python/jQuery application, now using React with server-side rendering and type-safe API integration.

Key features:
- Markdown-based note editing with real-time rendering (GFM, Math, Mermaid, code highlighting)
- Auto web content grabbing and AI summarization
- Type-safe API client generated from OpenAPI specification
- Backend API: https://www.binfer.net

## Development Commands

### Core Commands
```bash
# Development server (with Turbopack)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint

# Regenerate API types from backend OpenAPI spec
npm run generate:api
```

### Testing Single Files
This project does not currently have a test suite. When adding tests in the future, use standard Next.js testing patterns with Jest/Vitest.

## Architecture Overview

### Frontend-Only Application
This is a **frontend application** that communicates with a separate backend API. The backend is NOT part of this repository. All markdown rendering happens **client-side** using React libraries - the backend only stores and serves markdown text.

### Key Architectural Decisions

1. **Client-Side Markdown Rendering**: Unlike the legacy version which rendered markdown server-side, this app renders markdown entirely in the browser using `react-markdown` and plugins. The backend's `contentHtml` field is deprecated and unused.

2. **Type-Safe API Layer**:
   - API schema is auto-generated from backend OpenAPI spec (`src/lib/api-schema.ts`)
   - Type-safe client uses `openapi-fetch` (`src/lib/api-client.ts`)
   - Always regenerate types after backend API changes with `npm run generate:api`

3. **Routing Pattern**:
   - Root `/` → Generates random 7-char slug and redirects (client-side)
   - `/[slug]` → Dynamic note page (view/edit modes)
   - `/search` → Search notes with vector similarity (RAG-based)
   - No server-side rendering of note content - all rendering is client-side

### Directory Structure

```
src/
├── app/
│   ├── page.tsx              # Root: generates random slug and redirects
│   ├── [slug]/page.tsx       # Dynamic note page (view/edit/delete)
│   ├── search/page.tsx       # Search page with RAG-based similarity search
│   ├── layout.tsx            # Root layout with Material Icons CDN
│   └── globals.css           # Global styles (includes .markdown-body from legacy)
├── components/
│   ├── markdown/
│   │   └── MarkdownRenderer.tsx  # Client-side markdown rendering
│   └── ui/
│       └── button.tsx        # Radix UI components
└── lib/
    ├── api-client.ts         # OpenAPI fetch client instance
    ├── api-schema.ts         # Auto-generated TypeScript types (DO NOT EDIT)
    └── utils.ts              # Utility functions (cn for className merging)
```

### State Management Pattern

The note editor uses React hooks with specific patterns:

- **`useRef` for synchronous flags**: `isSavingRef` prevents beforeunload warning during save operation (useState is async and unreliable for this)
- **`useCallback` for event handlers**: Prevents unnecessary re-renders and effect re-subscriptions
- **Auto-resize textarea**: Height adjusts on content change using scrollHeight (min 200px)
- **Unsaved changes warning**: Triggers beforeunload event when `hasUnsavedChanges` is true (except during save)

## API Integration

### Making API Calls

```typescript
import { apiClient } from '@/lib/api-client';

// GET request
const { data, error } = await apiClient.GET('/mgr/note/{slug}', {
  params: { path: { slug } },
});

// POST request
const { data, error } = await apiClient.POST('/api/note/save', {
  body: {
    slug: 'my-note',
    contentMd: '# Hello World',
    isLocked: 0,
  },
});
```

### Key API Endpoints

- `GET /mgr/note/{slug}` - Fetch note (returns `contentMd`, `title`, `isLocked`, `uv`)
- `POST /api/note/save` - Save note (body: `slug`, `contentMd`, `isLocked`)
- `DELETE /mgr/note/{slug}` - Delete note permanently
- `GET /api/note/search?query=` - Search notes using vector similarity (RAG), returns notes with similarity scores

**Important**: The `contentHtml` field is deprecated. Always use `contentMd` and render client-side.

## Styling Approach

### Legacy Compatibility
The app preserves the exact visual appearance of the legacy version:
- Background: `#f9f9f9`
- Text color: `#000000` (not gray)
- Footer: `#E9E9E9` with `10px 0` padding
- Material Icons for edit button (not emoji)
- No hover underlines on links (`.no-underline` class)

### Style Architecture
- **Tailwind CSS** for utility classes
- **Radix UI** for accessible components
- **Inline styles** for legacy button/form matching (see `[slug]/page.tsx`)
- **globals.css** contains `.markdown-body` and `.material-icons` classes copied from legacy

**Markdown heading sizes** (in globals.css):
- h1: 1.75em
- h2: 1.3em (reduced from 1.5em for better readability)
- h3: 1.1em (reduced from 1.25em for better readability)

**Footer layout pattern**: The note page footer uses a three-column flexbox layout:
```css
display: flex;
align-items: center;
justify-content: space-between;
position: relative;
```
- **Left**: "How to Use" link and edit button
- **Center**: Search icon (using `position: absolute; left: 50%; transform: translateX(-50%)`)
- **Right**: Delete icon (only shown when note exists)

**When modifying styles**: Always check against `STYLE_FIXES.md` and `EDIT_MODE_FIXES.md` to maintain visual parity with the legacy version.

## Markdown Rendering

The `MarkdownRenderer` component supports:
- GitHub Flavored Markdown (tables, strikethrough, task lists)
- Math equations (KaTeX) - only loaded when `$$` or `$` detected
- Code highlighting (highlight.js via rehype-highlight)
- Mermaid diagrams - dynamically imported when `` ```mermaid `` detected
- Raw HTML (rehype-raw)
- Line breaks (remark-breaks)

**Performance note**: Math and Mermaid plugins are conditionally loaded to reduce bundle size when not needed.

## Important Patterns

### Textarea Auto-Resize with Cursor Position Preservation
To prevent cursor jumping when content is long, use `requestAnimationFrame` and restore cursor position:

```typescript
onChange={(e) => {
  const target = e.target;
  const cursorPosition = target.selectionStart;

  handleContentChange(e);

  // Auto-resize textarea while preserving cursor position
  requestAnimationFrame(() => {
    const currentHeight = target.scrollHeight;
    const newHeight = Math.max(200, currentHeight);

    // Only update height if it actually needs to change
    if (target.style.height !== `${newHeight}px`) {
      target.style.height = 'auto';
      target.style.height = `${newHeight}px`;

      // Restore cursor position
      target.setSelectionRange(cursorPosition, cursorPosition);
    }
  });
}}
```

**Why this pattern?**: Setting `height = 'auto'` triggers browser reflow, which can cause cursor jumping in long text. Using `requestAnimationFrame` and `setSelectionRange` prevents this issue.

### Keyboard Shortcuts
- **Cmd+Enter (Mac) / Ctrl+Enter (Windows)**: Save in edit mode
- Implementation uses `e.metaKey || e.ctrlKey` and `e.preventDefault()`

### Preventing Unsaved Changes Warning on Save
```typescript
const isSavingRef = useRef(false);

// In save handler
isSavingRef.current = true;

// In beforeunload handler
if (hasUnsavedChanges && !isSavingRef.current) {
  e.preventDefault();
  e.returnValue = '';
}
```

### Search with useSearchParams (Next.js Pattern)
When using `useSearchParams()` in Next.js 15, you must wrap the component in a Suspense boundary:

```typescript
function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  // ... component logic
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
```

**Why?**: Next.js 15 requires Suspense for dynamic rendering to avoid hydration mismatches.

### Combined Input and Button Pattern
For search bars and similar UI, use seamless combined styling:

```typescript
<div style={{ display: 'flex', alignItems: 'stretch' }}>
  <input
    style={{
      flex: '1',
      height: '40px',
      padding: '0 15px',
      border: '1px solid #9e9e9e',
      borderRight: 'none',
      borderRadius: '2px 0 0 2px',
      boxSizing: 'border-box',
    }}
  />
  <button
    style={{
      height: '40px',
      padding: '0 20px',
      borderRadius: '0 2px 2px 0',
      boxSizing: 'border-box',
    }}
  >
    Search
  </button>
</div>
```

**Key points**:
- Both elements have same `height: '40px'` for alignment
- Input has `borderRight: 'none'` to avoid double border
- Use `boxSizing: 'border-box'` for consistent sizing
- Complementary border-radius values create seamless appearance

## Environment Configuration

`.env.local` (git-ignored):
```env
NEXT_PUBLIC_API_URL=https://www.binfer.net
```

Change this to point to a different backend instance if needed.

## Common UI Patterns

### Material Icons Usage
The app uses Material Icons from CDN (loaded in `layout.tsx`). Common icons:
- `edit` - Edit button
- `search` - Search functionality
- `delete` - Delete action

**Icon button pattern**:
```typescript
<button
  onClick={handleAction}
  className="text-[#626262] no-underline inline-flex items-center"
  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
  title="Action description"
>
  <i className="material-icons tiny" style={{ fontSize: '18px' }}>icon_name</i>
</button>
```

### Confirmation Dialogs
Use native confirm dialogs for destructive actions:
```typescript
const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this note?')) {
    return;
  }
  // Proceed with deletion
};
```

## Common Issues and Solutions

### Build Errors After API Changes
If the build fails with type errors after backend API changes:
```bash
npm run generate:api
npm run build
```

### useSearchParams Suspense Error
If you see "useSearchParams() should be wrapped in a suspense boundary":
```typescript
// Wrap the component that uses useSearchParams in Suspense
export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <YourComponent />
    </Suspense>
  );
}
```

### Cursor Jumping in Textarea
If cursor jumps to bottom when typing in long text, ensure you're using the `requestAnimationFrame` + `setSelectionRange` pattern (see "Textarea Auto-Resize with Cursor Position Preservation" above).

### Button Styles Don't Match Legacy
Check `EDIT_MODE_FIXES.md` - all button styles are defined inline to match the legacy `.btn-primary` class exactly. Do not use Tailwind or Radix button variants.

### Markdown Not Rendering
Ensure the component is client-side (`'use client'` directive) and all rehype/remark plugins are installed.

## Migration Notes

This codebase is a **complete frontend rewrite** of a Python/Flask + jQuery application. See `MIGRATION_NOTES.md` for detailed comparison. Key differences:
- Client-side routing (Next.js App Router) vs server-side templates
- Client-side markdown rendering vs Python markdown library
- npm packages for math/diagrams vs CDN scripts
- Type-safe API client vs jQuery AJAX

When making changes, maintain backward compatibility with the backend API and visual parity with the legacy frontend.
