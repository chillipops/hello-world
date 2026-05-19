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
});

// NOTE: update, delete, complete, getOverdue, getByStatus, getByPriority,
// searchByTitle, searchByTag, getStats, and setAiSuggestions are not tested here.
