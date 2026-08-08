import { AIService } from '../../src/services/aiService';
import { Priority, TaskStatus } from '../../src/models/task';
import type { Task } from '../../src/models/task';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Sample Task',
    priority: Priority.MEDIUM,
    status: TaskStatus.PENDING,
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function chatResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIService('http://localhost:11434');
  });

  describe('suggestPriority', () => {
    it('returns the priority from the API response', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('high'));
      const result = await service.suggestPriority(makeTask());
      expect(result).toBe(Priority.HIGH);
    });

    it('handles uppercase response', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('  URGENT  '));
      const result = await service.suggestPriority(makeTask());
      expect(result).toBe(Priority.URGENT);
    });

    it('defaults to MEDIUM when response is not a valid priority', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('definitely important'));
      const result = await service.suggestPriority(makeTask());
      expect(result).toBe(Priority.MEDIUM);
    });

    it('calls the API with the correct model', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('low'));
      await service.suggestPriority(makeTask());
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'hermes3-64k:latest' })
      );
    });

    it('includes task details in the prompt', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('medium'));
      const task = makeTask({ title: 'Deploy prod', description: 'Critical rollout' });
      await service.suggestPriority(task);
      const call = mockCreate.mock.calls[0][0];
      const content = call.messages[0].content;
      expect(content).toContain('Deploy prod');
      expect(content).toContain('Critical rollout');
    });
  });

  describe('generateSubtasks', () => {
    it('returns parsed subtasks from JSON response', async () => {
      const subtasks = ['Step 1', 'Step 2', 'Step 3'];
      mockCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(subtasks)));
      const result = await service.generateSubtasks(makeTask());
      expect(result).toEqual(subtasks);
    });

    it('strips markdown code fences before parsing', async () => {
      const subtasks = ['Step 1', 'Step 2'];
      mockCreate.mockResolvedValueOnce(chatResponse('```json\n' + JSON.stringify(subtasks) + '\n```'));
      const result = await service.generateSubtasks(makeTask());
      expect(result).toEqual(subtasks);
    });

    it('falls back to line parsing when response is not valid JSON', async () => {
      const raw = '- Write tests\n- Deploy service\n1. Monitor logs';
      mockCreate.mockResolvedValueOnce(chatResponse(raw));
      const result = await service.generateSubtasks(makeTask());
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe('Write tests');
    });

    it('returns empty array when JSON parses to non-array', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('{"key":"value"}'));
      const result = await service.generateSubtasks(makeTask());
      expect(result).toEqual([]);
    });
  });

  describe('improveDescription', () => {
    it('returns the improved description text', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('Improved detailed description'));
      const result = await service.improveDescription(makeTask());
      expect(result).toBe('Improved detailed description');
    });

    it('falls back to original description when content is null', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
      const task = makeTask({ description: 'Original desc' });
      const result = await service.improveDescription(task);
      expect(result).toBe('Original desc');
    });

    it('falls back to empty string when no description and no content', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
      const task = makeTask({ description: undefined });
      const result = await service.improveDescription(task);
      expect(result).toBe('');
    });
  });

  describe('estimateEffort', () => {
    it('returns parsed hours and confidence', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('{"hours":4,"confidence":"medium"}'));
      const result = await service.estimateEffort(makeTask());
      expect(result).toEqual({ hours: 4, confidence: 'medium' });
    });

    it('strips markdown code fences before parsing', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('```json\n{"hours":2,"confidence":"high"}\n```'));
      const result = await service.estimateEffort(makeTask());
      expect(result).toEqual({ hours: 2, confidence: 'high' });
    });

    it('falls back to default when JSON parse fails', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('not json'));
      const result = await service.estimateEffort(makeTask());
      expect(result).toEqual({ hours: 1, confidence: 'low' });
    });

    it('falls back to default when response has no content', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
      const result = await service.estimateEffort(makeTask());
      expect(result).toEqual({ hours: 1, confidence: 'low' });
    });
  });

  describe('categorizeTasks', () => {
    it('returns empty object for empty task list without calling API', async () => {
      const result = await service.categorizeTasks([]);
      expect(result).toEqual({});
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns parsed categories', async () => {
      const categories = { Engineering: ['task-1'], Design: ['task-2'] };
      mockCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(categories)));
      const tasks = [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2', title: 'Design UI' })];
      const result = await service.categorizeTasks(tasks);
      expect(result).toEqual(categories);
    });

    it('strips markdown code fences before parsing', async () => {
      const categories = { Work: ['task-1'] };
      mockCreate.mockResolvedValueOnce(chatResponse('```\n' + JSON.stringify(categories) + '\n```'));
      const result = await service.categorizeTasks([makeTask()]);
      expect(result).toEqual(categories);
    });

    it('returns empty object when JSON parse fails', async () => {
      mockCreate.mockResolvedValueOnce(chatResponse('not json'));
      const result = await service.categorizeTasks([makeTask()]);
      expect(result).toEqual({});
    });
  });
});
