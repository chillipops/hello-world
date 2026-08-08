import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import OpenAI from 'openai';
import { TaskService } from './services/taskService';
import { AIService } from './services/aiService';
import { Priority } from './models/task';
import { formatTaskList } from './utils/formatters';
import { validateCreateTaskInput } from './utils/validators';
import {
  loadHistory, saveHistory,
  loadFacts, addFact, clearMemory,
  formatFacts, factsToSystemNote, extractFacts,
} from './memory';

const BOT_TOKEN = process.env.BOT_TOKEN ?? '8908175003:AAGqp6z1ZQI9DAyFf3J9jautjEtTPXOhJ6w';
const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

const bot = new Telegraf(BOT_TOKEN);
const taskService = new TaskService();
const aiService = new AIService(ollamaBase);
const client = new OpenAI({ baseURL: `${ollamaBase}/v1`, apiKey: 'ollama' });
const MODEL = 'hermes3-64k:latest';

function buildSystemPrompt(userId: number): string {
  const facts = loadFacts(userId);
  return (
    'You are a helpful task manager assistant. Help users manage tasks and answer questions about productivity and planning. Keep responses concise and friendly.' +
    factsToSystemNote(facts)
  );
}

async function chatWithAI(userId: number, userMessage: string): Promise<string> {
  const history = loadHistory(userId);

  // Always use a fresh system prompt with latest facts
  const systemMsg: OpenAI.Chat.ChatCompletionMessageParam = {
    role: 'system',
    content: buildSystemPrompt(userId),
  };

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    systemMsg,
    ...history,
    { role: 'user', content: userMessage },
  ];

  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 1024,
  });

  const reply = response.choices[0]?.message?.content ?? 'Sorry, I had trouble responding.';

  // Save updated history (without system message)
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'assistant', content: reply });
  saveHistory(userId, history);

  // Auto-extract facts in the background
  const facts = loadFacts(userId);
  extractFacts(client, MODEL, userMessage, reply, facts).then(updated => {
    const keys = Object.keys(updated);
    if (keys.length > Object.keys(facts).length) {
      const { saveFacts } = require('./memory');
      saveFacts(userId, updated);
    }
  }).catch(() => {});

  return reply;
}

// /start
bot.start(ctx => {
  ctx.reply(
    `👋 Hi! I'm your Hermes AI Task Manager!\n\n` +
    `I remember our conversations and learn about you over time.\n\n` +
    `/tasks — see your tasks\n` +
    `/add <title> — add a task\n` +
    `/done <id> — mark complete\n` +
    `/subtasks <id> — AI breaks down a task\n` +
    `/remember <fact> — tell me something to remember\n` +
    `/memory — see what I know about you\n` +
    `/forget — clear all memory\n` +
    `/help — show this menu`
  );
});

// /help
bot.help(ctx => {
  ctx.reply(
    `/tasks — see your tasks\n` +
    `/add <title> — add a task\n` +
    `/done <id> — mark complete\n` +
    `/subtasks <id> — AI breaks down a task\n` +
    `/remember <fact> — save a fact about yourself\n` +
    `/memory — see what I know about you\n` +
    `/forget — clear all memory\n\n` +
    `Or just chat — I remember everything!`
  );
});

// /tasks
bot.command('tasks', ctx => {
  const tasks = taskService.getAll();
  if (tasks.length === 0) {
    ctx.reply('No tasks yet! Use /add <title> to create one.');
  } else {
    ctx.reply(formatTaskList(tasks));
  }
});

// /add
bot.command('add', ctx => {
  const title = ctx.message.text.replace('/add', '').trim();
  if (!title) { ctx.reply('Example: /add Learn coding'); return; }
  const errors = validateCreateTaskInput({ title });
  if (errors.length > 0) { ctx.reply(`Error: ${errors.join(', ')}`); return; }
  const task = taskService.create({ title, priority: Priority.MEDIUM });
  ctx.reply(`✅ Task added: "${task.title}"\nID: \`${task.id.slice(0, 8)}\``, { parse_mode: 'Markdown' });
});

// /done
bot.command('done', ctx => {
  const id = ctx.message.text.replace('/done', '').trim();
  if (!id) { ctx.reply('Example: /done abc12345'); return; }
  const task = taskService.getAll().find(t => t.id.startsWith(id));
  if (!task) { ctx.reply(`Task not found. Use /tasks to see IDs.`); return; }
  taskService.update(task.id, { status: 'completed' as any });
  ctx.reply(`✅ Done: "${task.title}"`);
});

// /subtasks
bot.command('subtasks', async ctx => {
  const id = ctx.message.text.replace('/subtasks', '').trim();
  if (!id) { ctx.reply('Example: /subtasks abc12345'); return; }
  const task = taskService.getAll().find(t => t.id.startsWith(id));
  if (!task) { ctx.reply(`Task not found. Use /tasks to see IDs.`); return; }
  await ctx.reply(`Thinking about "${task.title}"...`);
  try {
    const subtasks = await aiService.generateSubtasks(task);
    ctx.reply(`Subtasks for "${task.title}":\n\n` + subtasks.map(s => `• ${s}`).join('\n'));
  } catch {
    ctx.reply('Could not reach AI. Is Ollama running?');
  }
});

// /remember
bot.command('remember', ctx => {
  const fact = ctx.message.text.replace('/remember', '').trim();
  if (!fact) { ctx.reply('Example: /remember my name is Alex'); return; }
  addFact(ctx.from.id, `note_${Date.now()}`, fact);
  ctx.reply(`Got it! I'll remember: "${fact}"`);
});

// /memory
bot.command('memory', ctx => {
  const facts = loadFacts(ctx.from.id);
  const history = loadHistory(ctx.from.id);
  ctx.reply(
    `🧠 What I know about you:\n\n${formatFacts(facts)}\n\n` +
    `📝 Conversation history: ${history.length} messages saved`
  );
});

// /forget
bot.command('forget', ctx => {
  clearMemory(ctx.from.id);
  ctx.reply('Memory cleared. Fresh start! 🧹');
});

// Normal chat
bot.on(message('text'), async ctx => {
  await ctx.sendChatAction('typing');
  try {
    const reply = await chatWithAI(ctx.from.id, ctx.message.text);
    ctx.reply(reply);
  } catch {
    ctx.reply('Could not reach AI. Is Ollama running?');
  }
});

bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log(`Hermes Agent bot is running with memory!`);
  console.log(`Connected to Ollama: ${ollamaBase}`);
  console.log(`Data saved to: ./data/`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
