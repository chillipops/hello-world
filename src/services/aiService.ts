import Anthropic from '@anthropic-ai/sdk';
import { Task, Priority } from '../models/task';

export class AIService {
  private client: Anthropic;
  private model = 'claude-opus-4-7';

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async suggestPriority(task: Task): Promise<Priority> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Given this task, suggest the most appropriate priority level (low, medium, high, or urgent). Reply with only the priority word.

Task: ${task.title}
Description: ${task.description ?? 'No description'}
Due date: ${task.dueDate ? task.dueDate.toISOString() : 'No due date'}
Tags: ${task.tags.join(', ') || 'None'}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.toLowerCase().trim() : 'medium';
    const validPriorities = Object.values(Priority);
    return validPriorities.includes(text as Priority) ? (text as Priority) : Priority.MEDIUM;
  }

  async generateSubtasks(task: Task): Promise<string[]> {
    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Break down this task into 3-5 actionable subtasks. Return only a JSON array of strings, nothing else.

Task: ${task.title}
Description: ${task.description ?? 'No description'}
Tags: ${task.tags.join(', ') || 'None'}`,
        },
      ],
    });

    const message = await stream.finalMessage();
    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';

    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const lines = text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
      return lines.map(l => l.replace(/^[-\d.)\s]+/, '').trim()).filter(Boolean);
    }
  }

  async improveDescription(task: Task): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content: `Improve and expand the description for this task to make it clearer and more actionable. Return only the improved description text.

Task title: ${task.title}
Current description: ${task.description ?? 'No description provided'}
Priority: ${task.priority}
Tags: ${task.tags.join(', ') || 'None'}`,
        },
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock && textBlock.type === 'text' ? textBlock.text : task.description ?? '';
  }

  async estimateEffort(task: Task): Promise<{ hours: number; confidence: string }> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Estimate the effort required for this task. Return a JSON object with "hours" (number) and "confidence" (string: "low", "medium", or "high"). Return only the JSON object.

Task: ${task.title}
Description: ${task.description ?? 'No description'}
Priority: ${task.priority}
Tags: ${task.tags.join(', ') || 'None'}`,
        },
      ],
      // @ts-expect-error output_config is in beta
      output_config: {
        format: {
          type: 'json_schema',
          name: 'effort_estimate',
          schema: {
            type: 'object',
            properties: {
              hours: { type: 'number' },
              confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['hours', 'confidence'],
          },
        },
      },
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      return JSON.parse(text);
    } catch {
      return { hours: 1, confidence: 'low' };
    }
  }

  async categorizeTasks(tasks: Task[]): Promise<Record<string, string[]>> {
    if (tasks.length === 0) return {};

    const taskList = tasks.map((t, i) => `${i + 1}. [${t.id}] ${t.title}`).join('\n');

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content: `Categorize these tasks into logical groups. Return a JSON object where keys are category names and values are arrays of task IDs. Return only the JSON object.

Tasks:
${taskList}`,
        },
      ],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find(block => block.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : '{}';

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}
