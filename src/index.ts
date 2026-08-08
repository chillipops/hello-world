import { TaskService } from './services/taskService';
import { AIService } from './services/aiService';
import { Priority, TaskStatus } from './models/task';
import { formatTaskList } from './utils/formatters';
import { validateCreateTaskInput } from './utils/validators';

async function main() {
  const taskService = new TaskService();
  const aiService = new AIService();

  console.log('=== Claude AI Task Manager ===\n');

  const inputs = [
    {
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment',
      priority: Priority.HIGH,
      tags: ['devops', 'automation'],
    },
    {
      title: 'Write quarterly report',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      tags: ['report', 'business'],
    },
    {
      title: 'Fix login bug',
      description: 'Users intermittently fail to log in with SSO',
      priority: Priority.URGENT,
      tags: ['bug', 'auth'],
    },
  ];

  for (const input of inputs) {
    const errors = validateCreateTaskInput(input);
    if (errors.length > 0) {
      console.error(`Validation errors for "${input.title}":`, errors);
      continue;
    }
    const task = taskService.create(input);
    console.log(`Created task: ${task.title} (${task.id})`);
  }

  console.log('\n--- All Tasks ---');
  console.log(formatTaskList(taskService.getAll()));

  const allTasks = taskService.getAll();
  if (allTasks.length > 0) {
    console.log('\n--- Generating AI subtasks for first task ---');
    try {
      const subtasks = await aiService.generateSubtasks(allTasks[0]);
      const updated = taskService.setAiSuggestions(allTasks[0].id, subtasks);
      console.log(`AI suggestions for "${updated.title}":`);
      subtasks.forEach(s => console.log(`  • ${s}`));
    } catch (err) {
      console.error('AI service error:', err);
    }
  }

  const stats = taskService.getStats();
  console.log('\n--- Stats ---');
  console.log(`Total tasks: ${stats.total}`);
  console.log(`Pending: ${stats.byStatus[TaskStatus.PENDING]}`);
  console.log(`In Progress: ${stats.byStatus[TaskStatus.IN_PROGRESS]}`);
  console.log(`Completed: ${stats.byStatus[TaskStatus.COMPLETED]}`);
  console.log(`Overdue: ${stats.overdue}`);
}

main().catch(console.error);
