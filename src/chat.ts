import * as readline from 'readline';
import OpenAI from 'openai';
import { TaskService } from './services/taskService';
import { AIService } from './services/aiService';
import { Priority } from './models/task';
import { formatTaskList } from './utils/formatters';
import { validateCreateTaskInput } from './utils/validators';

const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const client = new OpenAI({ baseURL: `${ollamaBase}/v1`, apiKey: 'ollama' });
const taskService = new TaskService();
const aiService = new AIService(process.env.OLLAMA_BASE_URL);

const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
  {
    role: 'system',
    content: `You are a helpful task manager assistant. You help users manage their tasks and can answer questions about productivity, planning, and project management. Keep responses concise and friendly.`,
  },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function prompt(q: string): Promise<string> {
  return new Promise(resolve => rl.question(q, resolve));
}

function printHelp() {
  console.log(`
Commands:
  /tasks              — list all tasks
  /add <title>        — add a new task
  /done <id>          — mark a task complete
  /subtasks <id>      — generate AI subtasks for a task
  /help               — show this menu
  /quit               — exit

Or just chat — ask me anything!
`);
}

async function chat(userMessage: string): Promise<string> {
  history.push({ role: 'user', content: userMessage });

  const response = await client.chat.completions.create({
    model: 'hermes3-64k:latest',
    messages: history,
    max_tokens: 1024,
  });

  const reply = response.choices[0]?.message?.content ?? '(no response)';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

async function handleCommand(input: string): Promise<boolean> {
  const [cmd, ...args] = input.trim().split(' ');

  if (cmd === '/quit' || cmd === '/exit') {
    console.log('Bye!');
    rl.close();
    return true;
  }

  if (cmd === '/help') {
    printHelp();
    return true;
  }

  if (cmd === '/tasks') {
    const tasks = taskService.getAll();
    if (tasks.length === 0) {
      console.log('No tasks yet. Use /add <title> to create one.\n');
    } else {
      console.log(formatTaskList(tasks));
    }
    return true;
  }

  if (cmd === '/add') {
    const title = args.join(' ').trim();
    if (!title) {
      console.log('Usage: /add <task title>\n');
      return true;
    }
    const errors = validateCreateTaskInput({ title });
    if (errors.length > 0) {
      console.log('Error:', errors.join(', '), '\n');
      return true;
    }
    const task = taskService.create({ title, priority: Priority.MEDIUM });
    console.log(`✓ Created: "${task.title}" (${task.id})\n`);
    return true;
  }

  if (cmd === '/done') {
    const id = args[0];
    if (!id) {
      console.log('Usage: /done <task-id>\n');
      return true;
    }
    const task = taskService.getAll().find(t => t.id.startsWith(id));
    if (!task) {
      console.log(`Task not found: ${id}\n`);
      return true;
    }
    taskService.update(task.id, { status: 'completed' as any });
    console.log(`✓ Marked complete: "${task.title}"\n`);
    return true;
  }

  if (cmd === '/subtasks') {
    const id = args[0];
    if (!id) {
      console.log('Usage: /subtasks <task-id>\n');
      return true;
    }
    const task = taskService.getAll().find(t => t.id.startsWith(id));
    if (!task) {
      console.log(`Task not found: ${id}\n`);
      return true;
    }
    console.log(`Thinking...\n`);
    const subtasks = await aiService.generateSubtasks(task);
    console.log(`Subtasks for "${task.title}":`);
    subtasks.forEach(s => console.log(`  • ${s}`));
    console.log();
    return true;
  }

  return false;
}

async function main() {
  console.log('\n=== Task Manager Chat ===');
  console.log(`Connected to: ${ollamaBase}`);
  console.log('Type /help for commands, or just chat.\n');

  while (true) {
    const input = await prompt('You: ');
    const trimmed = input.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('/')) {
      const handled = await handleCommand(trimmed);
      if (!handled) console.log(`Unknown command. Type /help for options.\n`);
      if (trimmed === '/quit' || trimmed === '/exit') break;
    } else {
      process.stdout.write('AI: ');
      try {
        const reply = await chat(trimmed);
        console.log(reply + '\n');
      } catch (err: any) {
        console.log(`Error: ${err.message}\n`);
      }
    }
  }
}

main().catch(console.error);
