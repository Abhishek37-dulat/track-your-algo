import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from 'redis';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8787;
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const todosKey = 'algotodo:quests';
const allowedStatuses = ['backlog', 'active', 'review', 'mastered'];
const allowedDifficulties = ['easy', 'medium', 'hard'];

const seedTodos = [
  {
    id: 'seed-zigzag',
    title: 'Binary Tree Zigzag Level Order Traversal',
    platform: 'LeetCode',
    topic: 'Trees',
    language: 'C++',
    algorithm: 'Breadth-First Search',
    difficulty: 'medium',
    eta: '35 min',
    status: 'active',
    notes: 'Practice BFS with alternating insertion direction.',
    createdAt: '2026-03-18T08:00:00.000Z',
    updatedAt: '2026-03-18T08:00:00.000Z'
  },
  {
    id: 'seed-lru',
    title: 'LRU Cache',
    platform: 'LeetCode',
    topic: 'Design',
    language: 'Java',
    algorithm: 'Hash Map + Doubly Linked List',
    difficulty: 'hard',
    eta: '50 min',
    status: 'review',
    notes: 'Rebuild from memory using doubly linked list + hash map.',
    createdAt: '2026-03-17T16:00:00.000Z',
    updatedAt: '2026-03-17T16:00:00.000Z'
  },
  {
    id: 'seed-dsu',
    title: 'Number of Provinces',
    platform: 'GeeksforGeeks',
    topic: 'Graphs',
    language: 'Python',
    algorithm: 'Disjoint Set Union',
    difficulty: 'medium',
    eta: '25 min',
    status: 'backlog',
    notes: 'Solve once with DFS, then again with DSU.',
    createdAt: '2026-03-16T14:00:00.000Z',
    updatedAt: '2026-03-16T14:00:00.000Z'
  },
  {
    id: 'seed-kadane',
    title: 'Maximum Subarray',
    platform: 'LeetCode',
    topic: 'Dynamic Programming',
    language: 'JavaScript',
    algorithm: "Kadane's Algorithm",
    difficulty: 'easy',
    eta: '15 min',
    status: 'mastered',
    notes: 'Explain Kadane’s algorithm without looking at notes.',
    createdAt: '2026-03-15T11:00:00.000Z',
    updatedAt: '2026-03-15T11:00:00.000Z'
  }
];

let redisClient = null;
let storageMode = 'memory';
let memoryTodos = cloneTodos(seedTodos);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  response.json({
    ok: true,
    storage: storageMode,
    redisUrl
  });
});

app.get('/api/todos', async (_request, response) => {
  const todos = await getTodos();
  response.json({
    todos,
    storage: storageMode
  });
});

app.post('/api/todos', async (request, response) => {
  if (!request.body?.title?.trim()) {
    response.status(400).json({ error: 'A title is required.' });
    return;
  }

  const todo = normalizeTodo({
    id: randomUUID(),
    ...request.body,
    status: 'backlog',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const todos = await getTodos();
  const nextTodos = [todo, ...todos];
  await saveTodos(nextTodos);

  response.status(201).json({
    todo,
    storage: storageMode
  });
});

app.put('/api/todos/:id', async (request, response) => {
  const todos = await getTodos();
  const targetTodo = todos.find((todo) => todo.id === request.params.id);

  if (!targetTodo) {
    response.status(404).json({ error: 'Quest not found.' });
    return;
  }

  const updatedTodo = normalizeTodo({
    ...targetTodo,
    ...request.body,
    id: targetTodo.id,
    updatedAt: new Date().toISOString()
  });

  const nextTodos = todos.map((todo) => (todo.id === targetTodo.id ? updatedTodo : todo));
  await saveTodos(nextTodos);

  response.json({
    todo: updatedTodo,
    storage: storageMode
  });
});

app.delete('/api/todos/:id', async (request, response) => {
  const todos = await getTodos();
  const exists = todos.some((todo) => todo.id === request.params.id);

  if (!exists) {
    response.status(404).json({ error: 'Quest not found.' });
    return;
  }

  const nextTodos = todos.filter((todo) => todo.id !== request.params.id);
  await saveTodos(nextTodos);

  response.json({
    id: request.params.id,
    storage: storageMode
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

if (existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'));
  });
}

await connectRedis();

app.listen(port, () => {
  console.log(`AlgoTodo API running on http://localhost:${port} using ${storageMode}`);
});

function cloneTodos(todos) {
  return todos.map((todo) => ({ ...todo }));
}

function normalizeTodo(todo) {
  return {
    id: String(todo.id),
    title: String(todo.title ?? '').trim(),
    platform: String(todo.platform ?? 'LeetCode').trim() || 'LeetCode',
    topic: String(todo.topic ?? 'Arrays').trim() || 'Arrays',
    language: String(todo.language ?? 'C++').trim() || 'C++',
    algorithm: String(todo.algorithm ?? 'Unspecified approach').trim() || 'Unspecified approach',
    difficulty: allowedDifficulties.includes(todo.difficulty) ? todo.difficulty : 'medium',
    eta: String(todo.eta ?? '30 min').trim() || '30 min',
    status: allowedStatuses.includes(todo.status) ? todo.status : 'backlog',
    notes: String(todo.notes ?? '').trim(),
    createdAt: todo.createdAt ?? new Date().toISOString(),
    updatedAt: todo.updatedAt ?? new Date().toISOString()
  };
}

async function connectRedis() {
  const redisConnectTimeoutMs = 1500;
  const handleRedisError = (error) => {
    if (storageMode === 'redis') {
      console.error('Redis client error:', error.message);
    }
  };

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: () => false
      }
    });

    redisClient.on('error', handleRedisError);

    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Redis connection timed out after ${redisConnectTimeoutMs}ms.`));
        }, redisConnectTimeoutMs);
      })
    ]);

    storageMode = 'redis';

    const existingTodos = await redisClient.get(todosKey);

    if (!existingTodos) {
      await redisClient.set(todosKey, JSON.stringify(seedTodos));
    }
  } catch (error) {
    storageMode = 'memory';

    if (redisClient) {
      redisClient.removeListener('error', handleRedisError);

      try {
        redisClient.destroy();
      } catch {
        // Ignore cleanup failures while dropping into local memory mode.
      }
    }

    redisClient = null;
    console.warn(`Redis unavailable, continuing with in-memory storage. ${error.message}`);
  }
}

async function getTodos() {
  if (storageMode === 'redis' && redisClient?.isOpen) {
    const rawTodos = await redisClient.get(todosKey);

    if (!rawTodos) {
      await redisClient.set(todosKey, JSON.stringify(seedTodos));
      return cloneTodos(seedTodos);
    }

    return JSON.parse(rawTodos);
  }

  return memoryTodos;
}

async function saveTodos(todos) {
  if (storageMode === 'redis' && redisClient?.isOpen) {
    await redisClient.set(todosKey, JSON.stringify(todos));
    return;
  }

  memoryTodos = todos;
}
