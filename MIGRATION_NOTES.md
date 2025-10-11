# 前端迁移笔记 - 老技术栈到新技术栈

## 已完成功能

### ✅ 首页 `/` 路由
- **老实现**: 后端生成随机slug并302重定向 (`src/controller/note_controller.py:39`)
- **新实现**: 客户端生成随机slug并导航 (`site/src/app/page.tsx`)
- **行为一致性**: ✓ 都会生成7位小写字母+数字的随机slug

### ✅ 动态路由 `/:slug` 页面
- **老实现**: Jinja2模板 + jQuery + Materialize CSS (`web/page/note.html.j2`)
- **新实现**: Next.js React组件 (`site/src/app/[slug]/page.tsx`)
- **功能对比**:
  - ✓ 查看markdown渲染内容
  - ✓ 编辑模式切换
  - ✓ 保存功能
  - ✓ 取消编辑
  - ✓ 未保存提示 (beforeunload)
  - ✓ 锁定笔记不可编辑

### ✅ Markdown渲染
- **关键改进**: 使用前端markdown库实时渲染，**不再依赖后端的 `contentHtml` 字段**
- **新实现**: `site/src/components/markdown/MarkdownRenderer.tsx`
- **支持的功能**:
  - ✓ GitHub Flavored Markdown (GFM)
  - ✓ 数学公式渲染 (KaTeX)
  - ✓ 代码高亮 (highlight.js)
  - ✓ Mermaid 图表 (动态加载)
  - ✓ 原始HTML支持

### ✅ 样式保持一致
- **老样式**: `web/static/css/site.css` (Materialize CSS + 自定义)
- **新样式**: `site/src/app/globals.css` (Tailwind CSS + 保留 `.markdown-body` 样式)
- **外观**: 基本保持一致，背景色 `#f9f9f9`，markdown样式完全复制

## 技术栈对比

| 功能 | 老技术栈 | 新技术栈 |
|------|---------|---------|
| **前端框架** | jQuery + TypeScript | React 19 + Next.js 15 |
| **构建工具** | Browserify | Turbopack |
| **UI框架** | Materialize CSS | Tailwind CSS + Radix UI |
| **Markdown** | 后端Python (markdownlib) | 前端 react-markdown |
| **数学公式** | MathJax (CDN) | KaTeX (npm) |
| **代码高亮** | highlight.css (静态) | rehype-highlight |
| **图表** | Mermaid (CDN) | mermaid (npm, 动态加载) |

## 安装的依赖

```json
{
  "dependencies": {
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "remark-math": "^6.0.0",
    "rehype-katex": "^7.0.1",
    "rehype-highlight": "^7.0.2",
    "rehype-raw": "^7.0.0",
    "mermaid": "^11.12.0",
    "katex": "^0.16.23",
    "highlight.js": "^11.11.1"
  }
}
```

## API 调用

新前端使用后端的 REST API：

1. **获取笔记**: `GET /mgr/note/{slug}`
   - 返回 `contentMd` 字段
   - ~~不再使用 `contentHtml`~~ (已弃用)

2. **保存笔记**: `POST /api/note/save`
   ```json
   {
     "slug": "abc123",
     "contentMd": "# Hello World",
     "isLocked": 0
   }
   ```

## 运行说明

### 开发模式
```bash
cd site
npm run dev
# 访问 http://localhost:3000
```

### 生产构建
```bash
cd site
npm run build
npm start
```

### API 端点配置
在 `.env.local` 中配置：
```env
NEXT_PUBLIC_API_URL=https://www.binfer.net
```

## 待优化项

1. **性能优化**
   - [ ] Markdown渲染缓存
   - [ ] 图片懒加载
   - [ ] 代码分割优化

2. **功能增强**
   - [ ] 实时预览 (编辑时分屏显示)
   - [ ] 自动保存草稿
   - [ ] Markdown工具栏

3. **样式微调**
   - [ ] 移动端响应式优化
   - [ ] 暗黑模式支持

## 文件结构

```
site/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 首页 (随机跳转)
│   │   ├── [slug]/
│   │   │   └── page.tsx          # 动态笔记页面
│   │   ├── layout.tsx            # 根布局
│   │   └── globals.css           # 全局样式 (含markdown样式)
│   ├── components/
│   │   ├── markdown/
│   │   │   └── MarkdownRenderer.tsx  # Markdown渲染组件
│   │   └── ui/
│   │       └── button.tsx        # UI组件
│   └── lib/
│       ├── api-client.ts         # OpenAPI fetch客户端
│       └── api-schema.ts         # 自动生成的类型
└── package.json
```

## 关键代码片段

### Markdown渲染 (前端)
```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
>
  {note.contentMd}
</ReactMarkdown>
```

### API调用 (类型安全)
```tsx
const { data, error } = await apiClient.GET('/mgr/note/{slug}', {
  params: { path: { slug } },
});
```

## 总结

✅ **核心功能已完全迁移**
✅ **前端实时markdown渲染，不依赖后端contentHtml**
✅ **样式基本保持一致**
✅ **构建成功，无错误**

新前端可以独立运行，通过API与后端通信。建议逐步切换流量，最终完全替换老前端。
