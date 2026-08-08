import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function historyFile(userId: number) {
  return path.join(DATA_DIR, `history_${userId}.json`);
}

function factsFile(userId: number) {
  return path.join(DATA_DIR, `facts_${userId}.json`);
}

export function loadHistory(userId: number): OpenAI.Chat.ChatCompletionMessageParam[] {
  try {
    const raw = fs.readFileSync(historyFile(userId), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHistory(userId: number, history: OpenAI.Chat.ChatCompletionMessageParam[]) {
  // Keep last 50 messages to avoid huge files
  const trimmed = history.slice(-50);
  fs.writeFileSync(historyFile(userId), JSON.stringify(trimmed, null, 2));
}

export function loadFacts(userId: number): Record<string, string> {
  try {
    const raw = fs.readFileSync(factsFile(userId), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveFacts(userId: number, facts: Record<string, string>) {
  fs.writeFileSync(factsFile(userId), JSON.stringify(facts, null, 2));
}

export function addFact(userId: number, key: string, value: string) {
  const facts = loadFacts(userId);
  facts[key] = value;
  saveFacts(userId, facts);
}

export function clearMemory(userId: number) {
  try { fs.unlinkSync(historyFile(userId)); } catch {}
  try { fs.unlinkSync(factsFile(userId)); } catch {}
}

export function formatFacts(facts: Record<string, string>): string {
  const entries = Object.entries(facts);
  if (entries.length === 0) return 'Nothing saved yet.';
  return entries.map(([k, v]) => `• ${k}: ${v}`).join('\n');
}

export function factsToSystemNote(facts: Record<string, string>): string {
  const entries = Object.entries(facts);
  if (entries.length === 0) return '';
  return '\n\nWhat you know about this user:\n' +
    entries.map(([k, v]) => `- ${k}: ${v}`).join('\n');
}

// Auto-extract facts from a conversation exchange
export async function extractFacts(
  client: OpenAI,
  model: string,
  userMessage: string,
  aiReply: string,
  existingFacts: Record<string, string>
): Promise<Record<string, string>> {
  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Extract any personal facts about the user from this conversation (name, age, job, goals, preferences, hobbies, location, etc). Return a JSON object with short keys and values. If nothing new, return {}. Do not repeat facts already known.

Already known: ${JSON.stringify(existingFacts)}

User said: "${userMessage}"
AI replied: "${aiReply}"

Return only a JSON object, no markdown.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
    const newFacts = JSON.parse(clean);
    if (typeof newFacts === 'object' && !Array.isArray(newFacts)) {
      return { ...existingFacts, ...newFacts };
    }
  } catch {}
  return existingFacts;
}
