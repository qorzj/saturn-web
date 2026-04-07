const TASK_LIST_ITEM_PATTERN = /^(\s*(?:>\s*)*(?:[-*+]|\d+\.)\s+\[)( |x|X)(\].*)$/;

export function updateMarkdownTaskState(
  content: string,
  taskIndex: number,
  checked: boolean,
): string {
  const lines = content.split('\n');
  let currentTaskIndex = 0;

  const updatedLines = lines.map((line) => {
    const match = line.match(TASK_LIST_ITEM_PATTERN);

    if (!match) {
      return line;
    }

    if (currentTaskIndex !== taskIndex) {
      currentTaskIndex += 1;
      return line;
    }

    currentTaskIndex += 1;
    return `${match[1]}${checked ? 'x' : ' '}${match[3]}`;
  });

  return updatedLines.join('\n');
}
