import {
  validateCreateTaskInput,
  validateUpdateTaskInput,
  sanitizeString,
  isValidId,
} from '../../src/utils/validators';
import { Priority, TaskStatus } from '../../src/models/task';

describe('validateCreateTaskInput', () => {
  it('accepts a valid minimal input', () => {
    expect(validateCreateTaskInput({ title: 'My Task' })).toHaveLength(0);
  });

  it('accepts a fully populated valid input', () => {
    const errors = validateCreateTaskInput({
      title: 'Full Task',
      description: 'A detailed description',
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() + 86400000),
      tags: ['work', 'important'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects missing title', () => {
    const errors = validateCreateTaskInput({ title: '' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('title'))).toBe(true);
  });

  it('rejects title that is too long', () => {
    const errors = validateCreateTaskInput({ title: 'a'.repeat(201) });
    expect(errors.some(e => e.includes('200'))).toBe(true);
  });

  it('rejects title that is only whitespace', () => {
    expect(validateCreateTaskInput({ title: '   ' }).length).toBeGreaterThan(0);
  });

  it('rejects invalid priority value', () => {
    const errors = validateCreateTaskInput({ title: 'Task', priority: 'extreme' as Priority });
    expect(errors.some(e => e.toLowerCase().includes('priority'))).toBe(true);
  });

  it('accepts all valid priority values', () => {
    for (const p of Object.values(Priority)) {
      expect(validateCreateTaskInput({ title: 'Task', priority: p })).toHaveLength(0);
    }
  });

  it('rejects description exceeding 2000 characters', () => {
    const errors = validateCreateTaskInput({ title: 'Task', description: 'x'.repeat(2001) });
    expect(errors.some(e => e.toLowerCase().includes('description'))).toBe(true);
  });

  it('rejects an invalid due date', () => {
    const errors = validateCreateTaskInput({ title: 'Task', dueDate: new Date('not-a-date') });
    expect(errors.some(e => e.toLowerCase().includes('date'))).toBe(true);
  });

  it('rejects tags that is not an array', () => {
    const errors = validateCreateTaskInput({ title: 'Task', tags: 'work' as unknown as string[] });
    expect(errors.some(e => e.toLowerCase().includes('tags'))).toBe(true);
  });

  it('rejects more than 10 tags', () => {
    const errors = validateCreateTaskInput({ title: 'Task', tags: new Array(11).fill('tag') });
    expect(errors.some(e => e.includes('10'))).toBe(true);
  });

  it('rejects tags containing empty strings', () => {
    const errors = validateCreateTaskInput({ title: 'Task', tags: ['valid', ''] });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateUpdateTaskInput', () => {
  it('rejects an empty update object', () => {
    const errors = validateUpdateTaskInput({});
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid partial update with only title', () => {
    expect(validateUpdateTaskInput({ title: 'New Title' })).toHaveLength(0);
  });

  it('accepts a valid partial update with only status', () => {
    expect(validateUpdateTaskInput({ status: TaskStatus.COMPLETED })).toHaveLength(0);
  });

  it('accepts a valid full update', () => {
    const errors = validateUpdateTaskInput({
      title: 'Updated',
      description: 'New desc',
      priority: Priority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      dueDate: new Date(Date.now() + 86400000),
      tags: ['a', 'b'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty title', () => {
    const errors = validateUpdateTaskInput({ title: '   ' });
    expect(errors.some(e => e.toLowerCase().includes('title'))).toBe(true);
  });

  it('rejects title exceeding 200 characters', () => {
    const errors = validateUpdateTaskInput({ title: 'a'.repeat(201) });
    expect(errors.some(e => e.includes('200'))).toBe(true);
  });

  it('rejects invalid priority', () => {
    const errors = validateUpdateTaskInput({ priority: 'superlow' as Priority });
    expect(errors.some(e => e.toLowerCase().includes('priority'))).toBe(true);
  });

  it('rejects invalid status', () => {
    const errors = validateUpdateTaskInput({ status: 'done' as TaskStatus });
    expect(errors.some(e => e.toLowerCase().includes('status'))).toBe(true);
  });

  it('rejects description exceeding 2000 characters', () => {
    const errors = validateUpdateTaskInput({ description: 'x'.repeat(2001) });
    expect(errors.some(e => e.toLowerCase().includes('description'))).toBe(true);
  });

  it('rejects tags that is not an array', () => {
    const errors = validateUpdateTaskInput({ tags: 'tag' as unknown as string[] });
    expect(errors.some(e => e.toLowerCase().includes('tags'))).toBe(true);
  });

  it('rejects more than 10 tags', () => {
    const errors = validateUpdateTaskInput({ tags: new Array(11).fill('t') });
    expect(errors.some(e => e.includes('10'))).toBe(true);
  });

  it('can report multiple errors at once', () => {
    const errors = validateUpdateTaskInput({
      title: 'a'.repeat(201),
      priority: 'bad' as Priority,
      status: 'bad' as TaskStatus,
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('sanitizeString', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('removes < and > characters', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('collapses multiple spaces into one', () => {
    expect(sanitizeString('hello   world')).toBe('hello world');
  });

  it('returns empty string unchanged', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('handles a clean string without modification', () => {
    expect(sanitizeString('clean input')).toBe('clean input');
  });
});

describe('isValidId', () => {
  it('accepts alphanumeric ids', () => {
    expect(isValidId('abc123')).toBe(true);
  });

  it('accepts ids with hyphens and underscores', () => {
    expect(isValidId('task-id_01')).toBe(true);
  });

  it('accepts a UUID-style id', () => {
    expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidId('')).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(isValidId('   ')).toBe(false);
  });

  it('rejects ids with special characters', () => {
    expect(isValidId('id with spaces')).toBe(false);
    expect(isValidId('id@domain')).toBe(false);
    expect(isValidId('id/path')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidId(123 as unknown as string)).toBe(false);
  });
});
