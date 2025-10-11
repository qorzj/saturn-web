# Textarea 自动滚动问题修复

## 问题描述

在编辑模式下，每次用户输入文字时，文本输入框会被强制定位到页面的最上方。当文本输入框内容很多时，这严重影响了用户体验。

## 问题根源

```tsx
// ❌ 问题代码
useEffect(() => {
  if (isEditing) {
    const textarea = document.getElementById('content-md') as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
    }
  }
}, [isEditing, contentMd]); // contentMd 作为依赖导致每次输入都触发
```

**问题分析**：
1. `useEffect` 依赖了 `contentMd`
2. 每次用户输入，`contentMd` 改变
3. `useEffect` 重新执行，操作 DOM
4. 浏览器将页面滚动到 textarea 位置（顶部）

## 解决方案

```tsx
// ✅ 修复后的代码
useEffect(() => {
  if (isEditing) {
    const textarea = document.getElementById('content-md') as HTMLTextAreaElement;
    if (textarea) {
      // 使用 setTimeout 确保 textarea 已渲染完成
      setTimeout(() => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
      }, 0);
    }
  }
}, [isEditing]); // 只依赖 isEditing，不依赖 contentMd
```

**修复要点**：
1. **移除 `contentMd` 依赖**：`useEffect` 只在进入编辑模式时执行一次
2. **添加 `setTimeout`**：确保 textarea 渲染完成后再调整高度
3. **保留 `onChange` 中的逻辑**：用户输入时的高度调整仍然通过 `onChange` 事件处理

## 完整的高度调整机制

### 1. 进入编辑模式时（一次性）

```tsx
useEffect(() => {
  if (isEditing) {
    const textarea = document.getElementById('content-md') as HTMLTextAreaElement;
    if (textarea) {
      setTimeout(() => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
      }, 0);
    }
  }
}, [isEditing]);
```

### 2. 用户输入时（每次输入）

```tsx
<textarea
  onChange={(e) => {
    handleContentChange(e);
    // 自动调整高度
    e.target.style.height = 'auto';
    e.target.style.height = Math.max(200, e.target.scrollHeight) + 'px';
  }}
/>
```

## 测试场景

- ✅ 进入编辑模式：textarea 高度正确初始化
- ✅ 输入新内容：高度自动扩展，页面不滚动
- ✅ 删除内容：高度自动收缩，页面不滚动
- ✅ 粘贴大量文本：高度正确调整，页面不滚动
- ✅ 长文本编辑：光标位置保持，用户体验流畅

## 技术细节

### 为什么使用 `setTimeout(..., 0)`？

```tsx
setTimeout(() => {
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
}, 0);
```

- **作用**：将高度调整操作推迟到下一个事件循环
- **原因**：确保 React 完成 DOM 更新，textarea 的 `value` 已经设置完成
- **效果**：`scrollHeight` 能正确反映内容高度

### onChange 中为什么不会导致滚动？

```tsx
onChange={(e) => {
  // 直接操作 event.target，不通过 getElementById
  e.target.style.height = 'auto';
  e.target.style.height = Math.max(200, e.target.scrollHeight) + 'px';
}}
```

- **关键**：操作的是当前正在交互的元素 (`e.target`)
- **浏览器行为**：不会改变焦点和滚动位置
- **对比**：通过 `getElementById` 重新获取元素会触发重新聚焦

## 相关文件

- `src/app/[slug]/page.tsx` - 修复位置：第 76-88 行

## 构建验证

```bash
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (5/5)
Route (app)                                 Size  First Load JS
└ ƒ /[slug]                               236 kB         339 kB
```

## 总结

通过移除 `useEffect` 对 `contentMd` 的依赖，避免了每次输入都触发 DOM 操作，从而解决了页面自动滚动的问题。用户现在可以流畅地编辑长文本，无需担心页面位置被强制改变。
