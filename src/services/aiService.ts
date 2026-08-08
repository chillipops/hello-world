import OpenAI from 'openai';
import { Task, Priority } from '../models/task';

export class AIService {
  private client: OpenAI;
  private model = 'hermes3-64k:latest';

  constructor(baseUrl?: string) {
    const ollamaBase = baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.client = new OpenAI({
      baseURL: `${ollamaBase}/v1`,
      apiKey: 'ollama', // Ollama ignores this but the SDK requires a value
    });
  }

  async suggestPriority(task: Task): Promise<Priority> {
    const response = await this.client.chat.completions.create({
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

    const text = response.choices[0]?.message?.content?.toLowerCase().trim() ?? 'medium';
    const validPriorities = Object.values(Priority);
    return validPriorities.includes(text as Priority) ? (text as Priority) : Priority.MEDIUM;
  }

  async generateSubtasks(task: Task): Promise<string[]> {
    const response = await this.client.chat.completions.create({
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

    const text = response.choices[0]?.message?.content ?? '[]';

    try {
      const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const lines = text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
      return lines.map(l => l.replace(/^[-\d.)\s]+/, '').trim()).filter(Boolean);
    }
  }

  async improveDescription(task: Task): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 512,
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

    return response.choices[0]?.message?.content ?? task.description ?? '';
  }

  async estimateEffort(task: Task): Promise<{ hours: number; confidence: string }> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Estimate the effort required for this task. Return a JSON object with "hours" (number) and "confidence" (string: "low", "medium", or "high"). Return only the JSON object, no markdown.

Task: ${task.title}
Description: ${task.description ?? 'No description'}
Priority: ${task.priority}
Tags: ${task.tags.join(', ') || 'None'}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    try {
      const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (typeof parsed.hours === 'number' && typeof parsed.confidence === 'string') {
        return parsed;
      }
      return { hours: 1, confidence: 'low' };
    } catch {
      return { hours: 1, confidence: 'low' };
    }
  }

  async categorizeTasks(tasks: Task[]): Promise<Record<string, string[]>> {
    if (tasks.length === 0) return {};

    const taskList = tasks.map((t, i) => `${i + 1}. [${t.id}] ${t.title}`).join('\n');

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Categorize these tasks into logical groups. Return a JSON object where keys are category names and values are arrays of task IDs. Return only the JSON object, no markdown.

Tasks:
${taskList}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    try {
      const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return {};
    }
  }
}
