import { TaskService, TaskNotFoundError } from '../../src/services/taskService';
import { Priority, TaskStatus } from '../../src/models/task';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService();
  });

  describe('create', () => {
    it('creates a task with required fields', () => {
      const task = service.create({ title: 'Test Task' });
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.priority).toBe(Priority.MEDIUM);
      expect(task.tags).toEqual([]);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('creates a task with all optional fields', () => {
      const dueDate = new Date(Date.now() + 86400000);
      const task = service.create({
        title: 'Full Task',
        description: 'Some description',
        priority: Priority.HIGH,
        dueDate,
        tags: ['alpha', 'beta'],
      });
      expect(task.description).toBe('Some description');
      expect(task.priority).toBe(Priority.HIGH);
      expect(task.dueDate).toEqual(dueDate);
      expect(task.tags).toEqual(['alpha', 'beta']);
    });

    it('sanitizes title input', () => {
      const task = service.create({ title: '  My Task  ' });
      expect(task.title).toBe('My Task');
    });

    it('assigns unique ids to each task', () => {
      const t1 = service.create({ title: 'Task 1' });
      const t2 = service.create({ title: 'Task 2' });
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('getById', () => {
    it('returns the task when it exists', () => {
      const created = service.create({ title: 'Find Me' });
      const found = service.getById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('returns undefined for unknown id', () => {
      expect(service.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns empty array when no tasks exist', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('returns all created tasks', () => {
      service.create({ title: 'Task A' });
      service.create({ title: 'Task B' });
      service.create({ title: 'Task C' });
      expect(service.getAll()).toHaveLength(3);
    });
  });

  describe('update', () => {
    it('updates individual fields', () => {
      const task = service.create({ title: 'Original' });
      const updated = service.update(task.id, { title: 'Updated', priority: Priority.HIGH });
      expect(updated.title).toBe('Updated');
      expect(updated.priority).toBe(Priority.HIGH);
    });

    it('preserves unchanged fields', () => {
      const dueDate = new Date(Date.now() + 86400000);
      const task = service.create({ title: 'Task', priority: Priority.LOW, dueDate, tags: ['x'] });
      const updated = service.update(task.id, { title: 'New Title' });
      expect(updated.priority).toBe(Priority.LOW);
      expect(updated.dueDate).toEqual(dueDate);
      expect(updated.tags).toEqual(['x']);
    });

    it('updates the updatedAt timestamp', () => {
      const task = service.create({ title: 'Task' });
      const before = task.updatedAt;
      const updated = service.update(task.id, { title: 'Changed' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws TaskNotFoundError for unknown id', () => {
      expect(() => service.update('ghost', { title: 'X' })).toThrow(TaskNotFoundError);
    });

    it('persists the update so getById reflects it', () => {
      const task = service.create({ title: 'Before' });
      service.update(task.id, { title: 'After' });
      expect(service.getById(task.id)?.title).toBe('After');
    });
  });

  describe('delete', () => {
    it('returns true and removes the task', () => {
      const task = service.create({ title: 'To Delete' });
      expect(service.delete(task.id)).toBe(true);
      expect(service.getById(task.id)).toBeUndefined();
    });

    it('returns false for unknown id', () => {
      expect(service.delete('ghost')).toBe(false);
    });

    it('does not affect other tasks', () => {
      const keep = service.create({ title: 'Keep' });
      const remove = service.create({ title: 'Remove' });
      service.delete(remove.id);
      expect(service.getById(keep.id)).toBeDefined();
      expect(service.getAll()).toHaveLength(1);
    });
  });

  describe('complete', () => {
    it('sets status to COMPLETED', () => {
      const task = service.create({ title: 'Task' });
      const completed = service.complete(task.id);
      expect(completed.status).toBe(TaskStatus.COMPLETED);
    });

    it('throws TaskNotFoundError for unknown id', () => {
      expect(() => service.complete('ghost')).toThrow(TaskNotFoundError);
    });

    it('persists completed status', () => {
      const task = service.create({ title: 'Task' });
      service.complete(task.id);
      expect(service.getById(task.id)?.status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('getByStatus', () => {
    it('returns only tasks with the given status', () => {
      service.create({ title: 'Pending 1' });
      const t2 = service.create({ title: 'Pending 2' });
      service.complete(t2.id);
      const pending = service.getByStatus(TaskStatus.PENDING);
      expect(pending).toHaveLength(1);
      expect(pending[0].title).toBe('Pending 1');
    });

    it('returns empty array when no tasks match', () => {
      service.create({ title: 'Task' });
      expect(service.getByStatus(TaskStatus.CANCELLED)).toHaveLength(0);
    });
  });

  describe('getByPriority', () => {
    it('returns only tasks with the given priority', () => {
      service.create({ title: 'Low', priority: Priority.LOW });
      service.create({ title: 'High', priority: Priority.HIGH });
      const high = service.getByPriority(Priority.HIGH);
      expect(high).toHaveLength(1);
      expect(high[0].title).toBe('High');
    });

    it('returns empty array when no tasks match', () => {
      service.create({ title: 'Task', priority: Priority.MEDIUM });
      expect(service.getByPriority(Priority.URGENT)).toHaveLength(0);
    });
  });

  describe('getOverdue', () => {
    const past = new Date('2020-01-01');
    const future = new Date(Date.now() + 86400000);

    it('returns tasks with a past due date that are not completed or cancelled', () => {
      service.create({ title: 'Overdue', dueDate: past });
      expect(service.getOverdue()).toHaveLength(1);
    });

    it('excludes tasks without a due date', () => {
      service.create({ title: 'No Due Date' });
      expect(service.getOverdue()).toHaveLength(0);
    });

    it('excludes tasks with a future due date', () => {
      service.create({ title: 'Future', dueDate: future });
      expect(service.getOverdue()).toHaveLength(0);
    });

    it('excludes completed tasks even with past due date', () => {
      const task = service.create({ title: 'Done', dueDate: past });
      service.complete(task.id);
      expect(service.getOverdue()).toHaveLength(0);
    });

    it('excludes cancelled tasks', () => {
      const task = service.create({ title: 'Cancelled', dueDate: past });
      service.update(task.id, { status: TaskStatus.CANCELLED });
      expect(service.getOverdue()).toHaveLength(0);
    });
  });

  describe('setAiSuggestions', () => {
    it('stores AI suggestions on the task', () => {
      const task = service.create({ title: 'Task' });
      const suggestions = ['Do A', 'Do B', 'Do C'];
      const updated = service.setAiSuggestions(task.id, suggestions);
      expect(updated.aiSuggestions).toEqual(suggestions);
    });

    it('persists suggestions so getById reflects them', () => {
      const task = service.create({ title: 'Task' });
      service.setAiSuggestions(task.id, ['Suggestion']);
      expect(service.getById(task.id)?.aiSuggestions).toEqual(['Suggestion']);
    });

    it('throws TaskNotFoundError for unknown id', () => {
      expect(() => service.setAiSuggestions('ghost', [])).toThrow(TaskNotFoundError);
    });
  });

  describe('searchByTitle', () => {
    beforeEach(() => {
      service.create({ title: 'Fix login bug', description: 'SSO issue' });
      service.create({ title: 'Write documentation' });
      service.create({ title: 'Deploy to production' });
    });

    it('finds tasks by title substring (case-insensitive)', () => {
      expect(service.searchByTitle('login')).toHaveLength(1);
      expect(service.searchByTitle('LOGIN')).toHaveLength(1);
    });

    it('finds tasks by description substring', () => {
      expect(service.searchByTitle('SSO')).toHaveLength(1);
    });

    it('returns multiple matches', () => {
      expect(service.searchByTitle('o')).toHaveLength(3);
    });

    it('returns empty array when no match', () => {
      expect(service.searchByTitle('xyzzy')).toHaveLength(0);
    });
  });

  describe('searchByTag', () => {
    beforeEach(() => {
      service.create({ title: 'Task A', tags: ['frontend', 'react'] });
      service.create({ title: 'Task B', tags: ['backend', 'api'] });
      service.create({ title: 'Task C', tags: ['Frontend'] });
    });

    it('finds tasks by exact tag (case-insensitive)', () => {
      expect(service.searchByTag('frontend')).toHaveLength(2);
      expect(service.searchByTag('FRONTEND')).toHaveLength(2);
    });

    it('does not match partial tag names', () => {
      expect(service.searchByTag('front')).toHaveLength(0);
    });

    it('returns empty array when no match', () => {
      expect(service.searchByTag('devops')).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns zeros when no tasks exist', () => {
      const stats = service.getStats();
      expect(stats.total).toBe(0);
      expect(stats.overdue).toBe(0);
      for (const status of Object.values(TaskStatus)) {
        expect(stats.byStatus[status]).toBe(0);
      }
    });

    it('counts total tasks correctly', () => {
      service.create({ title: 'A' });
      service.create({ title: 'B' });
      expect(service.getStats().total).toBe(2);
    });

    it('counts tasks by status correctly', () => {
      const t1 = service.create({ title: 'A' });
      service.create({ title: 'B' });
      service.complete(t1.id);
      const stats = service.getStats();
      expect(stats.byStatus[TaskStatus.PENDING]).toBe(1);
      expect(stats.byStatus[TaskStatus.COMPLETED]).toBe(1);
    });

    it('counts overdue tasks correctly', () => {
      service.create({ title: 'Overdue', dueDate: new Date('2020-01-01') });
      service.create({ title: 'Future', dueDate: new Date(Date.now() + 86400000) });
      expect(service.getStats().overdue).toBe(1);
    });
  });

  describe('TaskNotFoundError', () => {
    it('has the correct name', () => {
      const err = new TaskNotFoundError('abc');
      expect(err.name).toBe('TaskNotFoundError');
    });

    it('includes the id in the message', () => {
      const err = new TaskNotFoundError('abc-123');
      expect(err.message).toContain('abc-123');
    });

    it('is an instance of Error', () => {
      expect(new TaskNotFoundError('x')).toBeInstanceOf(Error);
    });
  });
});
