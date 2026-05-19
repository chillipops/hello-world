import { Task, Priority, TaskStatus } from '../models/task';

export function formatTaskForDisplay(task: Task): string {
  const lines: string[] = [];
  const statusIcon = {
    [TaskStatus.PENDING]: '○',
    [TaskStatus.IN_PROGRESS]: '◑',
    [TaskStatus.COMPLETED]: '●',
    [TaskStatus.CANCELLED]: '✕',
  }[task.status];

  const priorityLabel = {
    [Priority.LOW]: '[LOW]',
    [Priority.MEDIUM]: '[MED]',
    [Priority.HIGH]: '[HIGH]',
    [Priority.URGENT]: '[URGENT]',
  }[task.priority];

  lines.push(`${statusIcon} ${priorityLabel} ${task.title}`);
  lines.push(`  ID: ${task.id}`);

  if (task.description) {
    lines.push(`  Description: ${task.description}`);
  }

  if (task.dueDate) {
    const now = new Date();
    const isOverdue = task.dueDate < now && task.status !== TaskStatus.COMPLETED;
    const dueDateStr = task.dueDate.toLocaleDateString();
    lines.push(`  Due: ${dueDateStr}${isOverdue ? ' (OVERDUE)' : ''}`);
  }

  if (task.tags.length > 0) {
    lines.push(`  Tags: ${task.tags.map(t => `#${t}`).join(', ')}`);
  }

  if (task.aiSuggestions && task.aiSuggestions.length > 0) {
    lines.push(`  AI Suggestions:`);
    task.aiSuggestions.forEach(s => lines.push(`    • ${s}`));
  }

  lines.push(`  Created: ${task.createdAt.toLocaleDateString()}`);

  return lines.join('\n');
}

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) {
    return 'No tasks found.';
  }
  return tasks.map(formatTaskForDisplay).join('\n\n');
}

export function priorityToNumber(priority: Priority): number {
  const map: Record<Priority, number> = {
    [Priority.LOW]: 1,
    [Priority.MEDIUM]: 2,
    [Priority.HIGH]: 3,
    [Priority.URGENT]: 4,
  };
  return map[priority];
}

export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => priorityToNumber(b.priority) - priorityToNumber(a.priority));
}

export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    [TaskStatus.PENDING]: [],
    [TaskStatus.IN_PROGRESS]: [],
    [TaskStatus.COMPLETED]: [],
    [TaskStatus.CANCELLED]: [],
  };

  for (const task of tasks) {
    groups[task.status].push(task);
  }

  return groups;
}
