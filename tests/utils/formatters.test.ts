import {
  formatTaskForDisplay,
  formatTaskList,
  priorityToNumber,
  sortTasksByPriority,
  groupTasksByStatus,
} from '../../src/utils/formatters';
import { Task, Priority, TaskStatus } from '../../src/models/task';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-id',
    title: 'Test Task',
    priority: Priority.MEDIUM,
    status: TaskStatus.PENDING,
    tags: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('priorityToNumber', () => {
  it('maps all priorities to distinct numbers in ascending order', () => {
    const low = priorityToNumber(Priority.LOW);
    const medium = priorityToNumber(Priority.MEDIUM);
    const high = priorityToNumber(Priority.HIGH);
    const urgent = priorityToNumber(Priority.URGENT);
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
    expect(high).toBeLessThan(urgent);
  });
});

describe('sortTasksByPriority', () => {
  it('returns tasks sorted highest priority first', () => {
    const tasks = [
      makeTask({ id: '1', priority: Priority.LOW }),
      makeTask({ id: '2', priority: Priority.URGENT }),
      makeTask({ id: '3', priority: Priority.MEDIUM }),
      makeTask({ id: '4', priority: Priority.HIGH }),
    ];
    const sorted = sortTasksByPriority(tasks);
    expect(sorted[0].priority).toBe(Priority.URGENT);
    expect(sorted[1].priority).toBe(Priority.HIGH);
    expect(sorted[2].priority).toBe(Priority.MEDIUM);
    expect(sorted[3].priority).toBe(Priority.LOW);
  });

  it('does not mutate the original array', () => {
    const tasks = [
      makeTask({ id: '1', priority: Priority.LOW }),
      makeTask({ id: '2', priority: Priority.URGENT }),
    ];
    const original = [...tasks];
    sortTasksByPriority(tasks);
    expect(tasks[0].id).toBe(original[0].id);
  });

  it('returns empty array for empty input', () => {
    expect(sortTasksByPriority([])).toEqual([]);
  });
});

describe('groupTasksByStatus', () => {
  it('groups tasks by their status', () => {
    const tasks = [
      makeTask({ id: '1', status: TaskStatus.PENDING }),
      makeTask({ id: '2', status: TaskStatus.COMPLETED }),
      makeTask({ id: '3', status: TaskStatus.PENDING }),
      makeTask({ id: '4', status: TaskStatus.IN_PROGRESS }),
    ];
    const groups = groupTasksByStatus(tasks);
    expect(groups[TaskStatus.PENDING]).toHaveLength(2);
    expect(groups[TaskStatus.COMPLETED]).toHaveLength(1);
    expect(groups[TaskStatus.IN_PROGRESS]).toHaveLength(1);
    expect(groups[TaskStatus.CANCELLED]).toHaveLength(0);
  });

  it('always returns all four status keys even when empty', () => {
    const groups = groupTasksByStatus([]);
    expect(groups).toHaveProperty(TaskStatus.PENDING);
    expect(groups).toHaveProperty(TaskStatus.IN_PROGRESS);
    expect(groups).toHaveProperty(TaskStatus.COMPLETED);
    expect(groups).toHaveProperty(TaskStatus.CANCELLED);
    for (const key of Object.values(TaskStatus)) {
      expect(groups[key]).toHaveLength(0);
    }
  });
});

describe('formatTaskForDisplay', () => {
  it('includes the task title and id', () => {
    const task = makeTask({ title: 'Write tests', id: 'abc-123' });
    const output = formatTaskForDisplay(task);
    expect(output).toContain('Write tests');
    expect(output).toContain('abc-123');
  });

  it('includes priority label', () => {
    expect(formatTaskForDisplay(makeTask({ priority: Priority.URGENT }))).toContain('URGENT');
    expect(formatTaskForDisplay(makeTask({ priority: Priority.LOW }))).toContain('LOW');
  });

  it('includes description when present', () => {
    const task = makeTask({ description: 'Detailed steps here' });
    expect(formatTaskForDisplay(task)).toContain('Detailed steps here');
  });

  it('does not include description line when absent', () => {
    const task = makeTask({ description: undefined });
    expect(formatTaskForDisplay(task)).not.toContain('Description:');
  });

  it('includes tags with # prefix', () => {
    const task = makeTask({ tags: ['backend', 'api'] });
    const output = formatTaskForDisplay(task);
    expect(output).toContain('#backend');
    expect(output).toContain('#api');
  });

  it('does not include tags line when tags are empty', () => {
    expect(formatTaskForDisplay(makeTask({ tags: [] }))).not.toContain('Tags:');
  });

  it('marks overdue tasks', () => {
    const task = makeTask({
      dueDate: new Date('2020-01-01'),
      status: TaskStatus.PENDING,
    });
    expect(formatTaskForDisplay(task)).toContain('OVERDUE');
  });

  it('does not mark completed tasks as overdue even with past due date', () => {
    const task = makeTask({
      dueDate: new Date('2020-01-01'),
      status: TaskStatus.COMPLETED,
    });
    expect(formatTaskForDisplay(task)).not.toContain('OVERDUE');
  });

  it('includes AI suggestions when present', () => {
    const task = makeTask({ aiSuggestions: ['Break into subtasks', 'Set a deadline'] });
    const output = formatTaskForDisplay(task);
    expect(output).toContain('Break into subtasks');
    expect(output).toContain('Set a deadline');
  });

  it('does not include AI suggestions section when absent', () => {
    const task = makeTask({ aiSuggestions: undefined });
    expect(formatTaskForDisplay(task)).not.toContain('AI Suggestions');
  });

  it('shows all status icons', () => {
    expect(formatTaskForDisplay(makeTask({ status: TaskStatus.PENDING }))).toContain('○');
    expect(formatTaskForDisplay(makeTask({ status: TaskStatus.IN_PROGRESS }))).toContain('◑');
    expect(formatTaskForDisplay(makeTask({ status: TaskStatus.COMPLETED }))).toContain('●');
    expect(formatTaskForDisplay(makeTask({ status: TaskStatus.CANCELLED }))).toContain('✕');
  });
});

describe('formatTaskList', () => {
  it('returns "No tasks found." for empty array', () => {
    expect(formatTaskList([])).toBe('No tasks found.');
  });

  it('formats a single task', () => {
    const output = formatTaskList([makeTask({ title: 'Only Task' })]);
    expect(output).toContain('Only Task');
  });

  it('separates multiple tasks with blank lines', () => {
    const tasks = [
      makeTask({ id: '1', title: 'Task One' }),
      makeTask({ id: '2', title: 'Task Two' }),
    ];
    const output = formatTaskList(tasks);
    expect(output).toContain('Task One');
    expect(output).toContain('Task Two');
    expect(output).toContain('\n\n');
  });
});
