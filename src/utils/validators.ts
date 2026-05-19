import { CreateTaskInput, UpdateTaskInput, Priority, TaskStatus } from '../models/task';

export function validateCreateTaskInput(input: CreateTaskInput): string[] {
  const errors: string[] = [];

  if (!input.title || typeof input.title !== 'string') {
    errors.push('Title is required');
  } else if (input.title.trim().length === 0) {
    errors.push('Title cannot be empty');
  } else if (input.title.trim().length > 200) {
    errors.push('Title cannot exceed 200 characters');
  }

  if (input.description !== undefined && typeof input.description !== 'string') {
    errors.push('Description must be a string');
  }

  if (input.description && input.description.length > 2000) {
    errors.push('Description cannot exceed 2000 characters');
  }

  if (input.priority !== undefined && !Object.values(Priority).includes(input.priority)) {
    errors.push(`Priority must be one of: ${Object.values(Priority).join(', ')}`);
  }

  if (input.dueDate !== undefined) {
    const date = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
    if (isNaN(date.getTime())) {
      errors.push('Due date must be a valid date');
    }
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      errors.push('Tags must be an array');
    } else if (input.tags.length > 10) {
      errors.push('Cannot have more than 10 tags');
    } else {
      input.tags.forEach((tag, i) => {
        if (typeof tag !== 'string' || tag.trim().length === 0) {
          errors.push(`Tag at index ${i} must be a non-empty string`);
        }
      });
    }
  }

  return errors;
}

export function validateUpdateTaskInput(input: UpdateTaskInput): string[] {
  const errors: string[] = [];

  if (Object.keys(input).length === 0) {
    errors.push('At least one field must be provided for update');
  }

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim().length === 0) {
      errors.push('Title cannot be empty');
    } else if (input.title.trim().length > 200) {
      errors.push('Title cannot exceed 200 characters');
    }
  }

  if (input.description !== undefined && input.description.length > 2000) {
    errors.push('Description cannot exceed 2000 characters');
  }

  if (input.priority !== undefined && !Object.values(Priority).includes(input.priority)) {
    errors.push(`Priority must be one of: ${Object.values(Priority).join(', ')}`);
  }

  if (input.status !== undefined && !Object.values(TaskStatus).includes(input.status)) {
    errors.push(`Status must be one of: ${Object.values(TaskStatus).join(', ')}`);
  }

  if (input.dueDate !== undefined) {
    const date = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
    if (isNaN(date.getTime())) {
      errors.push('Due date must be a valid date');
    }
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      errors.push('Tags must be an array');
    } else if (input.tags.length > 10) {
      errors.push('Cannot have more than 10 tags');
    }
  }

  return errors;
}

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ');
}

export function isValidId(id: string): boolean {
  if (typeof id !== 'string' || id.trim().length === 0) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
