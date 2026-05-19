import { randomUUID } from 'crypto';
import { Task, CreateTaskInput, UpdateTaskInput, Priority, TaskStatus } from '../models/task';
import { sanitizeString } from '../utils/validators';

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskService {
  private tasks: Map<string, Task> = new Map();

  create(input: CreateTaskInput): Task {
    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      title: sanitizeString(input.title),
      description: input.description ? sanitizeString(input.description) : undefined,
      priority: input.priority ?? Priority.MEDIUM,
      status: TaskStatus.PENDING,
      dueDate: input.dueDate,
      tags: input.tags ? input.tags.map(sanitizeString) : [],
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getById(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAll(): Task[] {
    return Array.from(this.tasks.values());
  }

  getByStatus(status: TaskStatus): Task[] {
    return this.getAll().filter(task => task.status === status);
  }

  getByPriority(priority: Priority): Task[] {
    return this.getAll().filter(task => task.priority === priority);
  }

  getOverdue(): Task[] {
    const now = new Date();
    return this.getAll().filter(task =>
      task.dueDate &&
      task.dueDate < now &&
      task.status !== TaskStatus.COMPLETED &&
      task.status !== TaskStatus.CANCELLED
    );
  }

  update(id: string, input: UpdateTaskInput): Task {
    const task = this.tasks.get(id);
    if (!task) throw new TaskNotFoundError(id);

    const updated: Task = {
      ...task,
      ...(input.title !== undefined && { title: sanitizeString(input.title) }),
      ...(input.description !== undefined && { description: sanitizeString(input.description) }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.tags !== undefined && { tags: input.tags.map(sanitizeString) }),
      updatedAt: new Date(),
    };

    this.tasks.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    if (!this.tasks.has(id)) return false;
    this.tasks.delete(id);
    return true;
  }

  complete(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new TaskNotFoundError(id);

    const updated: Task = {
      ...task,
      status: TaskStatus.COMPLETED,
      updatedAt: new Date(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  setAiSuggestions(id: string, suggestions: string[]): Task {
    const task = this.tasks.get(id);
    if (!task) throw new TaskNotFoundError(id);

    const updated: Task = {
      ...task,
      aiSuggestions: suggestions,
      updatedAt: new Date(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  searchByTitle(query: string): Task[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(task =>
      task.title.toLowerCase().includes(lower) ||
      (task.description && task.description.toLowerCase().includes(lower))
    );
  }

  searchByTag(tag: string): Task[] {
    const lower = tag.toLowerCase();
    return this.getAll().filter(task =>
      task.tags.some(t => t.toLowerCase() === lower)
    );
  }

  getStats(): { total: number; byStatus: Record<string, number>; overdue: number } {
    const all = this.getAll();
    const byStatus: Record<string, number> = {};

    for (const status of Object.values(TaskStatus)) {
      byStatus[status] = all.filter(t => t.status === status).length;
    }

    return {
      total: all.length,
      byStatus,
      overdue: this.getOverdue().length,
    };
  }

  clear(): void {
    this.tasks.clear();
  }
}
