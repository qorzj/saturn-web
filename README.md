# Binfer Notes

A modern note-taking web application built with Next.js and TypeScript, featuring markdown support, auto web content grabbing, and AI summarization.

## Features

- 📝 Markdown-based note editing
- 🌐 Auto web content grabbing from URLs
- 🤖 AI-powered summarization
- 🔒 Secure note management
- 🎨 Built with Radix UI components
- ⚡ Type-safe API client with OpenAPI

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **API Client**: openapi-fetch with type generation
- **Backend**: https://www.binfer.net

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://www.binfer.net
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
binfer-notes/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   │   └── ui/          # Radix UI components
│   └── lib/             # Utilities and API client
│       ├── api-client.ts    # OpenAPI fetch client
│       ├── api-schema.ts    # Generated TypeScript types
│       └── utils.ts         # Utility functions
├── public/              # Static assets
│   └── openapi.json    # OpenAPI specification
└── ...config files
```

## API Integration

The project uses type-safe API client generated from OpenAPI specification:

```typescript
import { apiClient } from "@/lib/api-client";

// Example: Fetch notes
const { data, error } = await apiClient.GET("/mgr/note");

// Example: Save a note
const { data, error } = await apiClient.POST("/api/note/save", {
  body: {
    slug: "my-note",
    content_md: "# Hello World"
  }
});
```

## Regenerating API Types

When the backend API changes, regenerate TypeScript types:

```bash
# Download latest OpenAPI spec
curl -o public/openapi.json https://www.binfer.net/openapi/openapi.json

# Generate TypeScript types
npx openapi-typescript public/openapi.json -o src/lib/api-schema.ts
```

## Development

```bash
# Development server
npm run dev

# Type checking
npm run build

# Linting
npm run lint
```

## Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API base URL (default: https://www.binfer.net)

## License

Private

## Contact

- Author: qorzj
- Email: goodhorsezxj@gmail.com

### 页面 (Pages)

| 路由              | 名称                            | 功能描述                              |
| ----------------- | ------------------------------- | ------------------------------------- |
| `/`               | **Home (首页)**                 | 生成随机 7 位 slug 并重定向到笔记页面 |
| `/[slug]`         | **Note Page (笔记页面)**        | 查看/编辑笔记，支持 Markdown 渲染     |
| `/search`         | **Search Page (搜索页面)**      | 基于向量相似度 (RAG) 搜索笔记         |
| `/share/[slug]`   | **Shared Note Page (分享页面)** | 公开查看已分享的笔记                  |
| `/login`          | **Login Page**                  | 用户登录                              |
| `/login/callback` | **Login Callback**              | OAuth 登录回调                        |