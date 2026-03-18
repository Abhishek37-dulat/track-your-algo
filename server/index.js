import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from 'redis';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8787;
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const usersKey = 'algotodo:users';
const sessionsKey = 'algotodo:sessions';
const userTodosKeyPrefix = 'algotodo:user';
const allowedStatuses = ['backlog', 'active', 'review', 'mastered'];
const allowedDifficulties = ['easy', 'medium', 'hard'];
const usernamePattern = /^[a-zA-Z0-9 _-]{3,20}$/;

const seedTodos = [
  {
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
let memoryUsers = [];
let memorySessions = [];
let memoryTodosByUser = {};

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  response.json({
    ok: true,
    storage: storageMode,
    redisUrl
  });
});

app.post('/api/auth/register', async (request, response) => {
  const username = sanitizeUsername(request.body?.username);
  const pin = sanitizePin(request.body?.pin);
  const validationError = validateAuthInput(username, pin);

  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const usernameKey = normalizeUsernameKey(username);
  const users = await getUsers();

  if (users.some((user) => user.usernameKey === usernameKey)) {
    response.status(409).json({ error: 'That username is already in use.' });
    return;
  }

  const { hash, salt } = hashPin(pin);
  const user = {
    id: randomUUID(),
    username,
    usernameKey,
    pinHash: hash,
    pinSalt: salt,
    createdAt: new Date().toISOString()
  };

  await saveUsers([user, ...users]);
  await saveTodosForUser(user.id, createSeedTodos());

  const session = await createSession(user);

  response.status(201).json({
    token: session.token,
    user: toPublicUser(user),
    storage: storageMode
  });
});

app.post('/api/auth/login', async (request, response) => {
  const username = sanitizeUsername(request.body?.username);
  const pin = sanitizePin(request.body?.pin);
  const validationError = validateAuthInput(username, pin);

  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const users = await getUsers();
  const user = users.find((entry) => entry.usernameKey === normalizeUsernameKey(username));

  if (!user || !verifyPin(pin, user)) {
    response.status(401).json({ error: 'Invalid username or PIN.' });
    return;
  }

  const session = await createSession(user);

  response.json({
    token: session.token,
    user: toPublicUser(user),
    storage: storageMode
  });
});

app.get('/api/auth/me', requireAuth, async (request, response) => {
  response.json({
    user: toPublicUser(request.user),
    storage: storageMode
  });
});

app.post('/api/auth/logout', requireAuth, async (request, response) => {
  await deleteSession(request.token);
  response.json({ ok: true });
});

app.get('/api/todos', requireAuth, async (request, response) => {
  const todos = await getTodosForUser(request.user.id);

  response.json({
    todos,
    storage: storageMode
  });
});

app.post('/api/todos', requireAuth, async (request, response) => {
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

  const todos = await getTodosForUser(request.user.id);
  const nextTodos = [todo, ...todos];
  await saveTodosForUser(request.user.id, nextTodos);

  response.status(201).json({
    todo,
    storage: storageMode
  });
});

app.put('/api/todos/:id', requireAuth, async (request, response) => {
  const todos = await getTodosForUser(request.user.id);
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
  await saveTodosForUser(request.user.id, nextTodos);

  response.json({
    todo: updatedTodo,
    storage: storageMode
  });
});

app.delete('/api/todos/:id', requireAuth, async (request, response) => {
  const todos = await getTodosForUser(request.user.id);
  const exists = todos.some((todo) => todo.id === request.params.id);

  if (!exists) {
    response.status(404).json({ error: 'Quest not found.' });
    return;
  }

  const nextTodos = todos.filter((todo) => todo.id !== request.params.id);
  await saveTodosForUser(request.user.id, nextTodos);

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

function createSeedTodos() {
  return cloneTodos(seedTodos).map((todo) => ({
    ...todo,
    id: randomUUID()
  }));
}

function sanitizeUsername(username) {
  return String(username ?? '').trim();
}

function normalizeUsernameKey(username) {
  return sanitizeUsername(username).toLowerCase();
}

function sanitizePin(pin) {
  return String(pin ?? '').trim();
}

function validateAuthInput(username, pin) {
  if (!usernamePattern.test(username)) {
    return 'Username must be 3-20 characters and use letters, numbers, spaces, hyphens, or underscores.';
  }

  if (!/^\d{4}$/.test(pin)) {
    return 'PIN must be exactly 4 digits.';
  }

  return null;
}

function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(pin, salt, 64).toString('hex')
  };
}

function verifyPin(pin, user) {
  const inputHash = scryptSync(pin, user.pinSalt, 64);
  const storedHash = Buffer.from(user.pinHash, 'hex');

  return inputHash.length === storedHash.length && timingSafeEqual(inputHash, storedHash);
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt
  };
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

async function requireAuth(request, response, next) {
  const authHeader = request.headers.authorization ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Sign in required.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const sessions = await getSessions();
  const session = sessions.find((entry) => entry.token === token);

  if (!session) {
    response.status(401).json({ error: 'Session expired. Sign in again.' });
    return;
  }

  const users = await getUsers();
  const user = users.find((entry) => entry.id === session.userId);

  if (!user) {
    await deleteSession(token);
    response.status(401).json({ error: 'User not found for this session.' });
    return;
  }

  request.user = user;
  request.token = token;
  next();
}

async function createSession(user) {
  const sessions = await getSessions();
  const session = {
    token: randomUUID(),
    userId: user.id,
    createdAt: new Date().toISOString()
  };

  await saveSessions([session, ...sessions.filter((entry) => entry.userId !== user.id)]);
  return session;
}

async function deleteSession(token) {
  const sessions = await getSessions();
  await saveSessions(sessions.filter((entry) => entry.token !== token));
}

function getUserTodosKey(userId) {
  return `${userTodosKeyPrefix}:${userId}:quests`;
}

async function getUsers() {
  if (storageMode === 'redis' && redisClient?.isOpen) {
    try {
      const rawUsers = await redisClient.get(usersKey);
      return rawUsers ? JSON.parse(rawUsers) : [];
    } catch (error) {
      fallbackToMemory(error);
    }
  }

  return memoryUsers;
}

async function saveUsers(users) {
  if (storageMode === 'redis' && redisClient?.isOpen) {
    try {
      await redisClient.set(usersKey, JSON.stringify(users));
      return;
    } catch (error) {
      fallbackToMemory(error);
    }
  }

  memoryUsers = users;
}

async function getSessions() {
  if (storageMode === 'redis' && redisClient?.isOpen) {
    try {
      const rawSessions = await redisClient.get(sessionsKey);
      return rawSessions ? JSON.parse(rawSessions) : [];
    } catch (error) {
      fallbackToMemory(error);
    }
  }

  return memorySessions;
}

async function saveSessions(sessions) {
  if (storageMode === 'redis' && redisClient?.isOpen) {
    try {
      await redisClient.set(sessionsKey, JSON.stringify(sessions));
      return;
    } catch (error) {
      fallbackToMemory(error);
    }
  }

  memorySessions = sessions;
}

async function getTodosForUser(userId) {
  const userTodosKey = getUserTodosKey(userId);

  if (storageMode === 'redis' && redisClient?.isOpen) {
    try {
      const rawTodos = await redisClient.get(userTodosKey);

      if (!rawTodos) {
        const initialTodos = createSeedTodos();
        await redisClient.set(userTodosKey, JSON.stringify(initialTodos));
        return initialTodos;
      }

      return JSON.parse(rawTodos);
    } catch (error) {
      fallbackToMemory(error);
    }
  }

  if (!memoryTodosByUser[userId]) {
    memoryTodosByUser = {
      ...memoryTodosByUser,
      [userId]: createSeedTodos()
    };
  }

  return memoryTodosByUser[userId];
}

async function saveTodosForUser(userId, todos) {
  const userTodosKey = getUserTodosKey(userId);

  if (storageMode === 'redis' && redisClient?.isOpen) {
    try {
      await redisClient.set(userTodosKey, JSON.stringify(todos));
      return;
    } catch (error) {
      fallbackToMemory(error);
    }
  }

  memoryTodosByUser = {
    ...memoryTodosByUser,
    [userId]: todos
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
    await redisClient.ping();
  } catch (error) {
    fallbackToMemory(error, handleRedisError);
  }
}

function fallbackToMemory(error, handleRedisError) {
  storageMode = 'memory';

  if (redisClient) {
    if (handleRedisError) {
      redisClient.removeListener('error', handleRedisError);
    } else {
      redisClient.removeAllListeners('error');
    }

    try {
      redisClient.destroy();
    } catch {
      // Ignore cleanup failures while dropping into local memory mode.
    }
  }

  redisClient = null;
  console.warn(`Redis unavailable, continuing with in-memory storage. ${error.message}`);
}
