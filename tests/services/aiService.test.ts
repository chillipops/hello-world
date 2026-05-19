import { AIService } from '../../src/services/aiService';
import { Priority, TaskStatus } from '../../src/models/task';
import type { Task } from '../../src/models/task';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  const mockFinalMessage = jest.fn();
  const mockStream = jest.fn().mockResolvedValue({ finalMessage: mockFinalMessage });
  const mockCreate = jest.fn();

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
        stream: mockStream,
      },
    })),
    _mockCreate: mockCreate,
    _mockStream: mockStream,
    _mockFinalMessage: mockFinalMessage,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sdk = require('@anthropic-ai/sdk');
const mockCreate: jest.Mock = sdk._mockCreate;
const mockStream: jest.Mock = sdk._mockStream;
const mockFinalMessage: jest.Mock = sdk._mockFinalMessage;

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

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

function streamResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIService('test-api-key');
  });

  describe('suggestPriority', () => {
    it('returns the priority from the API response', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('high'));
      const result = await service.suggestPriority(makeTask());
      expect(result).toBe(Priority.HIGH);
    });

    it('handles uppercase response', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('  URGENT  '));
      const result = await service.suggestPriority(makeTask());
      expect(result).toBe(Priority.URGENT);
    });

    it('defaults to MEDIUM when response is not a valid priority', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('definitely important'));
      const result = await service.suggestPriority(makeTask());
      expect(result).toBe(Priority.MEDIUM);
    });

    it('calls the API with the correct model', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('low'));
      await service.suggestPriority(makeTask());
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-4-7' })
      );
    });

    it('includes task details in the prompt', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('medium'));
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
      mockFinalMessage.mockResolvedValueOnce(streamResponse(JSON.stringify(subtasks)));
      const result = await service.generateSubtasks(makeTask());
      expect(result).toEqual(subtasks);
    });

    it('falls back to line parsing when response is not valid JSON', async () => {
      const raw = '- Write tests\n- Deploy service\n1. Monitor logs';
      mockFinalMessage.mockResolvedValueOnce(streamResponse(raw));
      const result = await service.generateSubtasks(makeTask());
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe('Write tests');
    });

    it('returns empty array when JSON parses to non-array', async () => {
      mockFinalMessage.mockResolvedValueOnce(streamResponse('{"key":"value"}'));
      const result = await service.generateSubtasks(makeTask());
      expect(result).toEqual([]);
    });

    it('uses streaming', async () => {
      mockFinalMessage.mockResolvedValueOnce(streamResponse('[]'));
      await service.generateSubtasks(makeTask());
      expect(mockStream).toHaveBeenCalled();
    });
  });

  describe('improveDescription', () => {
    it('returns the improved description text', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('Improved detailed description'));
      const result = await service.improveDescription(makeTask());
      expect(result).toBe('Improved detailed description');
    });

    it('falls back to original description when no text block in response', async () => {
      mockCreate.mockResolvedValueOnce({ content: [{ type: 'thinking', thinking: 'thoughts' }] });
      const task = makeTask({ description: 'Original desc' });
      const result = await service.improveDescription(task);
      expect(result).toBe('Original desc');
    });

    it('falls back to empty string when no description and no text block', async () => {
      mockCreate.mockResolvedValueOnce({ content: [] });
      const task = makeTask({ description: undefined });
      const result = await service.improveDescription(task);
      expect(result).toBe('');
    });

    it('calls the API with adaptive thinking', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('Improved'));
      await service.improveDescription(makeTask());
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ thinking: { type: 'adaptive' } })
      );
    });
  });

  describe('estimateEffort', () => {
    it('returns parsed hours and confidence', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('{"hours":4,"confidence":"medium"}'));
      const result = await service.estimateEffort(makeTask());
      expect(result).toEqual({ hours: 4, confidence: 'medium' });
    });

    it('falls back to default when JSON parse fails', async () => {
      mockCreate.mockResolvedValueOnce(textResponse('not json'));
      const result = await service.estimateEffort(makeTask());
      expect(result).toEqual({ hours: 1, confidence: 'low' });
    });

    it('falls back to default when response has no text content', async () => {
      mockCreate.mockResolvedValueOnce({ content: [] });
      const result = await service.estimateEffort(makeTask());
      expect(result).toEqual({ hours: 1, confidence: 'low' });
    });
  });

  describe('categorizeTasks', () => {
    it('returns empty object for empty task list without calling API', async () => {
      const result = await service.categorizeTasks([]);
      expect(result).toEqual({});
      expect(mockStream).not.toHaveBeenCalled();
    });

    it('returns parsed categories', async () => {
      const categories = { Engineering: ['task-1'], Design: ['task-2'] };
      mockFinalMessage.mockResolvedValueOnce(streamResponse(JSON.stringify(categories)));
      const tasks = [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2', title: 'Design UI' })];
      const result = await service.categorizeTasks(tasks);
      expect(result).toEqual(categories);
    });

    it('returns empty object when JSON parse fails', async () => {
      mockFinalMessage.mockResolvedValueOnce(streamResponse('not json'));
      const result = await service.categorizeTasks([makeTask()]);
      expect(result).toEqual({});
    });

    it('uses streaming with adaptive thinking', async () => {
      mockFinalMessage.mockResolvedValueOnce(streamResponse('{}'));
      await service.categorizeTasks([makeTask()]);
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({ thinking: { type: 'adaptive' } })
      );
    });
  });
});
