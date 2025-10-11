# 用户体验改进文档

## 修复的问题

根据用户反馈，实现了以下三个关键改进：

### 1. ✅ 修复保存时触发 beforeunload 提示

**问题**:
- 用户点击 "Save markdown" 按钮后，页面会刷新
- 刷新时触发 beforeunload 事件，弹出"确认离开页面"提示
- 这个提示是多余的，因为用户已经明确保存了

**原因分析**:
```tsx
// 问题代码
const handleSave = async () => {
  setHasUnsavedChanges(false);  // State更新是异步的
  window.location.reload();      // 立即刷新，可能在state更新前触发beforeunload
};
```

**解决方案**: 使用 `useRef` 立即标记保存状态

```tsx
const isSavingRef = useRef(false);

const handleSave = useCallback(async () => {
  setIsSaving(true);
  isSavingRef.current = true;  // 立即标记正在保存

  // ... API调用 ...

  if (!error) {
    setHasUnsavedChanges(false);
    window.location.reload();  // 刷新时不会触发警告
  }
}, [slug, contentMd]);

// beforeunload事件处理
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // 正在保存时不显示警告
    if (hasUnsavedChanges && !isSavingRef.current) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);
```

**效果**:
- ✅ 编辑时离开页面：显示警告
- ✅ 保存后刷新：不显示警告
- ✅ 用户体验流畅

---

### 2. ✅ 修复 footer 的 padding

**问题**: 新版本 footer 没有垂直 padding，与老版本不一致

**老版本样式** (Materialize CSS):
```css
.page-footer .footer-copyright {
  padding: 10px 0px;
  min-height: 1.2rem;
  display: flex;
  align-items: center;
}
```

**修复**:
```tsx
<footer className="page-footer" style={{ backgroundColor: '#E9E9E9' }}>
  <div className="footer-copyright" style={{ padding: '10px 0' }}>
    {/* Footer content */}
  </div>
</footer>
```

**对比**:
| 元素 | 老版本 | 新版本（修复前） | 新版本（修复后） |
|------|--------|-----------------|-----------------|
| 垂直padding | `10px 0` | `0` | `10px 0` ✅ |

---

### 3. ✅ 实现 Command+Enter 快捷键保存

**新功能**: 在编辑模式下，按 `Command+Enter` (Mac) 或 `Ctrl+Enter` (Windows/Linux) 快速保存

**实现**:
```tsx
// 使用 useCallback 避免重复创建函数
const handleSave = useCallback(async () => {
  // ... 保存逻辑 ...
}, [slug, contentMd]);

// 监听快捷键
useEffect(() => {
  if (!isEditing) return;  // 只在编辑模式下监听

  const handleKeyDown = (e: KeyboardEvent) => {
    // Mac: metaKey (Command), Windows/Linux: ctrlKey (Ctrl)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();  // 阻止默认行为（如换行）
      handleSave();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isEditing, handleSave]);
```

**用户体验**:
- ✅ 无需鼠标点击按钮
- ✅ 支持 Mac 和 Windows/Linux
- ✅ 只在编辑模式下生效
- ✅ 防止误触发（阻止默认换行行为）

**快捷键对比**:
| 平台 | 快捷键 | 功能 |
|------|--------|------|
| macOS | `⌘ Command + Enter` | 保存 |
| Windows/Linux | `Ctrl + Enter` | 保存 |

---

## 技术细节

### 1. useRef vs useState 的选择

**为什么使用 `useRef` 而不是 `useState`?**

```tsx
// ❌ 问题：useState 更新是异步的
const [isSaving, setIsSaving] = useState(false);
setIsSaving(true);
window.location.reload();  // 此时 isSaving 可能还是 false

// ✅ 解决：useRef 更新是同步的
const isSavingRef = useRef(false);
isSavingRef.current = true;
window.location.reload();  // 此时 isSavingRef.current 已经是 true
```

### 2. useCallback 的必要性

**为什么要用 `useCallback` 包装 `handleSave`?**

```tsx
// ❌ 问题：每次渲染都创建新函数，导致 useEffect 重复执行
const handleSave = async () => { /* ... */ };

useEffect(() => {
  // handleSave 每次都是新函数，这个 effect 会不断重新订阅
  window.addEventListener('keydown', handleKeyDown);
}, [handleSave]);  // handleSave 依赖会导致频繁更新

// ✅ 解决：useCallback 缓存函数，只在依赖变化时重新创建
const handleSave = useCallback(async () => {
  // ...
}, [slug, contentMd]);  // 只在 slug 或 contentMd 变化时重新创建
```

### 3. 快捷键监听的最佳实践

```tsx
useEffect(() => {
  if (!isEditing) return;  // ✅ 早期返回，避免不必要的监听

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();  // ✅ 阻止默认行为
      handleSave();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);  // ✅ 清理
}, [isEditing, handleSave]);
```

---

## 构建验证

```bash
✓ Build successful
✓ No type errors
✓ No linting warnings
Route (app)
└ ƒ /[slug]    236 kB    351 kB
```

---

## 完整修复清单

| 问题 | 老版本行为 | 新版本（修复前） | 新版本（修复后） | 状态 |
|------|-----------|-----------------|-----------------|------|
| **保存时提示** | 不提示 | 提示确认离开 | 不提示 | ✅ |
| **Footer padding** | `10px 0` | `0` | `10px 0` | ✅ |
| **快捷键保存** | 无 | 无 | `Cmd/Ctrl+Enter` | ✅ |

---

## 用户体验提升

1. **流畅保存**: 保存操作不再有多余的确认弹窗
2. **视觉一致**: Footer padding 与老版本完全一致
3. **效率提升**: 快捷键保存，无需鼠标操作

所有改进已完成并通过测试！🎉
