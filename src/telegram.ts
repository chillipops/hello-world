import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import OpenAI from 'openai';
import { TaskService } from './services/taskService';
import { AIService } from './services/aiService';
import { Priority } from './models/task';
import { formatTaskList } from './utils/formatters';
import { validateCreateTaskInput } from './utils/validators';

const BOT_TOKEN = process.env.BOT_TOKEN ?? '8908175003:AAHeaZuiabbBrW5C2EZjF7ugtvwlsGGmq4Y';
const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

const bot = new Telegraf(BOT_TOKEN);
const taskService = new TaskService();
const aiService = new AIService(ollamaBase);

const client = new OpenAI({ baseURL: `${ollamaBase}/v1`, apiKey: 'ollama' });

// Store conversation history per user
const histories = new Map<number, OpenAI.Chat.ChatCompletionMessageParam[]>();

function getHistory(userId: number): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (!histories.has(userId)) {
    histories.set(userId, [
      {
        role: 'system',
        content: 'You are a helpful task manager assistant. Help users manage tasks and answer questions about productivity and planning. Keep responses short and friendly.',
      },
    ]);
  }
  return histories.get(userId)!;
}

async function chatWithAI(userId: number, message: string): Promise<string> {
  const history = getHistory(userId);
  history.push({ role: 'user', content: message });

  const response = await client.chat.completions.create({
    model: 'hermes3-64k:latest',
    messages: history,
    max_tokens: 1024,
  });

  const reply = response.choices[0]?.message?.content ?? 'Sorry, I had trouble responding.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

// /start command
bot.start(ctx => {
  ctx.reply(
    `👋 Hi! I'm your Hermes AI Task Manager!\n\n` +
    `Just chat with me normally, or use these commands:\n\n` +
    `/tasks — see all your tasks\n` +
    `/add <title> — add a task\n` +
    `/done <id> — mark a task complete\n` +
    `/subtasks <id> — AI breaks down a task\n` +
    `/clear — clear chat history\n` +
    `/help — show this menu`
  );
});

// /help command
bot.help(ctx => {
  ctx.reply(
    `Commands:\n\n` +
    `/tasks — see all your tasks\n` +
    `/add <title> — add a task\n` +
    `/done <id> — mark a task complete\n` +
    `/subtasks <id> — AI breaks down a task\n` +
    `/clear — clear chat history\n\n` +
    `Or just type anything to chat with me!`
  );
});

// /tasks command
bot.command('tasks', ctx => {
  const tasks = taskService.getAll();
  if (tasks.length === 0) {
    ctx.reply('No tasks yet! Use /add <title> to create one.');
  } else {
    ctx.reply(formatTaskList(tasks));
  }
});

// /add command
bot.command('add', ctx => {
  const title = ctx.message.text.replace('/add', '').trim();
  if (!title) {
    ctx.reply('Please include a title. Example:\n/add Learn coding');
    return;
  }
  const errors = validateCreateTaskInput({ title });
  if (errors.length > 0) {
    ctx.reply(`Error: ${errors.join(', ')}`);
    return;
  }
  const task = taskService.create({ title, priority: Priority.MEDIUM });
  ctx.reply(`✅ Task added: "${task.title}"\nID: \`${task.id.slice(0, 8)}\``, { parse_mode: 'Markdown' });
});

// /done command
bot.command('done', async ctx => {
  const id = ctx.message.text.replace('/done', '').trim();
  if (!id) {
    ctx.reply('Please include a task ID. Example:\n/done abc12345');
    return;
  }
  const task = taskService.getAll().find(t => t.id.startsWith(id));
  if (!task) {
    ctx.reply(`Task not found: ${id}\nUse /tasks to see IDs.`);
    return;
  }
  taskService.update(task.id, { status: 'completed' as any });
  ctx.reply(`✅ Marked complete: "${task.title}"`);
});

// /subtasks command
bot.command('subtasks', async ctx => {
  const id = ctx.message.text.replace('/subtasks', '').trim();
  if (!id) {
    ctx.reply('Please include a task ID. Example:\n/subtasks abc12345');
    return;
  }
  const task = taskService.getAll().find(t => t.id.startsWith(id));
  if (!task) {
    ctx.reply(`Task not found: ${id}\nUse /tasks to see IDs.`);
    return;
  }
  await ctx.reply(`Thinking about "${task.title}"...`);
  try {
    const subtasks = await aiService.generateSubtasks(task);
    const text = subtasks.map(s => `• ${s}`).join('\n');
    ctx.reply(`Subtasks for "${task.title}":\n\n${text}`);
  } catch {
    ctx.reply('Sorry, had trouble generating subtasks. Is Ollama running?');
  }
});

// /clear command
bot.command('clear', ctx => {
  histories.delete(ctx.from.id);
  ctx.reply('Chat history cleared! Fresh start.');
});

// Handle normal chat messages
bot.on(message('text'), async ctx => {
  const userMessage = ctx.message.text;
  await ctx.sendChatAction('typing');
  try {
    const reply = await chatWithAI(ctx.from.id, userMessage);
    ctx.reply(reply);
  } catch {
    ctx.reply('Sorry, I could not reach the AI. Is Ollama running?');
  }
});

bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log(`Hermes Agent bot is running!`);
  console.log(`Connected to Ollama: ${ollamaBase}`);
  console.log(`Open Telegram and message @HermesLindsey_bot`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
