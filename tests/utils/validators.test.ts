import { validateCreateTaskInput } from '../../src/utils/validators';
import { Priority } from '../../src/models/task';

describe('validateCreateTaskInput', () => {
  it('accepts a valid minimal input', () => {
    const errors = validateCreateTaskInput({ title: 'My Task' });
    expect(errors).toHaveLength(0);
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
    const errors = validateCreateTaskInput({ title: '   ' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid priority value', () => {
    const errors = validateCreateTaskInput({ title: 'Task', priority: 'extreme' as Priority });
    expect(errors.some(e => e.toLowerCase().includes('priority'))).toBe(true);
  });

  it('accepts all valid priority values', () => {
    for (const p of Object.values(Priority)) {
      const errors = validateCreateTaskInput({ title: 'Task', priority: p });
      expect(errors).toHaveLength(0);
    }
  });
});

// NOTE: validateUpdateTaskInput, sanitizeString, and isValidId are not tested here.
