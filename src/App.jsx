import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearAuthError, loginUser, logoutUser, registerUser, restoreSession } from './features/auth/authSlice';
import { addTodo, deleteTodo, fetchTodos, updateTodo } from './features/todos/todosSlice';

const statusOrder = ['backlog', 'active', 'review', 'mastered'];
const statusMeta = {
  backlog: {
    label: 'Trailhead',
    description: 'Fresh problems waiting for a strategy.'
  },
  active: {
    label: 'Deep Forest',
    description: 'Problems you are actively solving today.'
  },
  review: {
    label: 'Camp Review',
    description: 'Solutions to revisit, optimize, and explain aloud.'
  },
  mastered: {
    label: 'Summit',
    description: 'Concepts you can now solve with confidence.'
  }
};

const difficultyPalette = {
  easy: 'emerald',
  medium: 'amber',
  hard: 'crimson'
};

const initialTodoForm = {
  title: '',
  platform: 'LeetCode',
  topic: 'Arrays',
  language: 'C++',
  algorithm: '',
  difficulty: 'medium',
  eta: '30 min',
  notes: ''
};

const initialAuthForm = {
  username: '',
  pin: ''
};

const advanceStatus = (currentStatus) => {
  const currentIndex = statusOrder.indexOf(currentStatus);

  if (currentIndex === -1 || currentIndex === statusOrder.length - 1) {
    return currentStatus;
  }

  return statusOrder[currentIndex + 1];
};

function App() {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  const todos = useSelector((state) => state.todos);

  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(initialAuthForm);
  const [todoForm, setTodoForm] = useState(initialTodoForm);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const deferredSearch = useDeferredValue(search);
  const isAuthenticated = auth.status === 'authenticated' && Boolean(auth.user) && Boolean(auth.token);

  useEffect(() => {
    if (auth.status === 'checking') {
      dispatch(restoreSession());
    }
  }, [auth.status, dispatch]);

  useEffect(() => {
    if (isAuthenticated && todos.status === 'idle') {
      dispatch(fetchTodos());
    }
  }, [dispatch, isAuthenticated, todos.status]);

  useEffect(() => {
    if (!isAuthenticated) {
      setTodoForm(initialTodoForm);
      setSearch('');
      setTopicFilter('all');
      setDifficultyFilter('all');
    }
  }, [isAuthenticated]);

  const searchValue = deferredSearch.trim().toLowerCase();
  const filteredTodos = todos.items.filter((todo) => {
    const matchesSearch =
      searchValue.length === 0 ||
      [todo.title, todo.platform, todo.topic, todo.language, todo.algorithm, todo.notes]
        .join(' ')
        .toLowerCase()
        .includes(searchValue);
    const matchesTopic = topicFilter === 'all' || todo.topic === topicFilter;
    const matchesDifficulty = difficultyFilter === 'all' || todo.difficulty === difficultyFilter;

    return matchesSearch && matchesTopic && matchesDifficulty;
  });

  const groupedTodos = statusOrder.reduce((groups, laneStatus) => {
    groups[laneStatus] = filteredTodos.filter((todo) => todo.status === laneStatus);
    return groups;
  }, {});

  const topicOptions = ['all', ...new Set(todos.items.map((todo) => todo.topic))];
  const mastered = todos.items.filter((todo) => todo.status === 'mastered').length;
  const active = todos.items.filter((todo) => todo.status === 'active').length;
  const review = todos.items.filter((todo) => todo.status === 'review').length;
  const stats = {
    total: todos.items.length,
    active,
    review,
    completion: todos.items.length === 0 ? 0 : Math.round((mastered / todos.items.length) * 100)
  };

  const focusTodo =
    todos.items.find((todo) => todo.status === 'active') ??
    todos.items.find((todo) => todo.status === 'review') ??
    todos.items[0];

  const handleAuthModeChange = (mode) => {
    setAuthMode(mode);
    setAuthForm(initialAuthForm);
    dispatch(clearAuthError());
  };

  const handleAuthFieldChange = (event) => {
    const { name, value } = event.target;

    setAuthForm((currentForm) => ({
      ...currentForm,
      [name]: name === 'pin' ? value.replace(/\D/g, '').slice(0, 4) : value
    }));

    if (auth.error) {
      dispatch(clearAuthError());
    }
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      username: authForm.username.trim(),
      pin: authForm.pin
    };

    if (!payload.username || payload.pin.length !== 4) {
      return;
    }

    const action = authMode === 'register' ? registerUser : loginUser;

    try {
      await dispatch(action(payload)).unwrap();
      setAuthForm(initialAuthForm);
    } catch {
      // Auth errors are already surfaced through Redux state.
    }
  };

  const handleTodoFieldChange = (event) => {
    const { name, value } = event.target;
    setTodoForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const handleTodoSubmit = async (event) => {
    event.preventDefault();

    if (!todoForm.title.trim() || !todoForm.algorithm.trim()) {
      return;
    }

    try {
      await dispatch(
        addTodo({
          ...todoForm,
          title: todoForm.title.trim(),
          algorithm: todoForm.algorithm.trim(),
          notes: todoForm.notes.trim()
        })
      ).unwrap();

      setTodoForm(initialTodoForm);
    } catch {
      // Todo errors are already surfaced through Redux state.
    }
  };

  const handleAdvance = (todo) => {
    const nextStatus = advanceStatus(todo.status);

    if (nextStatus !== todo.status) {
      dispatch(updateTodo({ id: todo.id, changes: { status: nextStatus } }));
    }
  };

  const handleSearchChange = (event) => {
    const nextValue = event.target.value;

    startTransition(() => {
      setSearch(nextValue);
    });
  };

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  if (auth.status === 'checking') {
    return (
      <main className="app-shell auth-shell">
        <div className="background-orb orb-left" />
        <div className="background-orb orb-right" />
        <section className="auth-layout">
          <div className="scene-card auth-scene">
            <SceneBackdrop />
            <aside className="quest-panel auth-callout">
              <span className="storage-pill memory">Restoring session</span>
              <h2>Reopening your quest map</h2>
              <p>Checking your saved explorer session so we can bring back the right algorithm board.</p>
            </aside>
          </div>

          <section className="panel auth-panel auth-panel-loading">
            <span className="eyebrow">One moment</span>
            <h1 className="auth-title">Loading your private dashboard…</h1>
            <p className="auth-copy">If the saved session has expired, you’ll land back on the sign-in gate.</p>
          </section>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="app-shell auth-shell">
        <div className="background-orb orb-left" />
        <div className="background-orb orb-right" />

        <section className="auth-layout">
          <div className="scene-card auth-scene">
            <SceneBackdrop />
            <aside className="quest-panel auth-callout">
              <span className="storage-pill memory">Private quest boards</span>
              <h2>One board per explorer</h2>
              <p>
                Create a username and a 4 digit PIN to keep your algorithm practice separated by user.
              </p>

              <div className="quest-stats">
                <div>
                  <strong>User based</strong>
                  <span>separate todo maps</span>
                </div>
                <div>
                  <strong>4 digit PIN</strong>
                  <span>quick sign in</span>
                </div>
                <div>
                  <strong>Redis ready</strong>
                  <span>persists when available</span>
                </div>
              </div>
            </aside>
          </div>

          <section className="panel auth-panel">
            <div className="mode-toggle">
              <button
                className={authMode === 'login' ? 'active' : ''}
                type="button"
                onClick={() => handleAuthModeChange('login')}
              >
                Sign in
              </button>
              <button
                className={authMode === 'register' ? 'active' : ''}
                type="button"
                onClick={() => handleAuthModeChange('register')}
              >
                Create user
              </button>
            </div>

            <span className="eyebrow">{authMode === 'register' ? 'New Explorer' : 'Welcome Back'}</span>
            <h1 className="auth-title">
              {authMode === 'register' ? 'Claim your own algorithm camp.' : 'Enter your private quest board.'}
            </h1>
            <p className="auth-copy">
              Each username gets a separate todo dashboard. Use any 4 digit PIN to protect it.
            </p>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>
                Username
                <input
                  name="username"
                  value={authForm.username}
                  onChange={handleAuthFieldChange}
                  placeholder="e.g. abhishek, dsa-scout, graphmaster"
                  required
                  minLength={3}
                  maxLength={20}
                />
              </label>

              <label>
                4 digit PIN
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  value={authForm.pin}
                  onChange={handleAuthFieldChange}
                  placeholder="1234"
                  maxLength={4}
                  required
                />
              </label>

              <div className="pin-help">Only numbers are allowed, and the PIN must be exactly 4 digits.</div>

              <button className="primary-button auth-submit" disabled={auth.status === 'authenticating'} type="submit">
                {auth.status === 'authenticating'
                  ? 'Opening your board…'
                  : authMode === 'register'
                    ? 'Create explorer'
                    : 'Enter board'}
              </button>
            </form>

            {auth.error && <div className="auth-error">{auth.error}</div>}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="background-orb orb-left" />
      <div className="background-orb orb-right" />

      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-toolbar">
            <div>
              <div className="eyebrow">Algorithm Expedition Board</div>
              <div className="user-chip">Explorer: {auth.user.username}</div>
            </div>

            <button className="ghost-button" type="button" onClick={handleLogout}>
              Switch user
            </button>
          </div>

          <h1>Turn daily coding practice into a private map of quests, camps, and summits.</h1>
          <p>
            This board belongs to {auth.user.username}. Your tasks, progress, and solved patterns stay
            scoped to this user account behind a 4 digit PIN.
          </p>

          <div className="stat-grid">
            <StatCard label="Open Quests" value={stats.total} accent="teal" />
            <StatCard label="Solving Now" value={stats.active} accent="mint" />
            <StatCard label="Camp Reviews" value={stats.review} accent="sand" />
            <StatCard label="Mastery" value={`${stats.completion}%`} accent="gold" />
          </div>
        </div>

        <div className="scene-card">
          <SceneBackdrop />

          <aside className="quest-panel">
            <span className={`storage-pill ${todos.storage}`}>
              {todos.storage === 'redis' ? 'Redis live' : 'Memory fallback'}
            </span>
            <h2>{focusTodo ? focusTodo.title : 'Choose the next route'}</h2>
            <p>
              {focusTodo
                ? `Current focus: ${focusTodo.algorithm} in ${focusTodo.language} for ${focusTodo.topic} on ${focusTodo.platform}.`
                : 'Add your first algorithm quest to begin mapping the journey.'}
            </p>

            <div className="quest-stats">
              <div>
                <strong>{focusTodo?.difficulty ?? 'medium'}</strong>
                <span>difficulty</span>
              </div>
              <div>
                <strong>{focusTodo?.eta ?? '30 min'}</strong>
                <span>time box</span>
              </div>
              <div>
                <strong>{stats.completion}%</strong>
                <span>journey cleared</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="dashboard-grid">
        <form className="panel glass-panel form-panel" onSubmit={handleTodoSubmit}>
          <div className="panel-header">
            <div>
              <span className="eyebrow">New Quest</span>
              <h2>Add an algorithm task</h2>
            </div>
            <span className="badge">User scoped</span>
          </div>

          <label>
            Problem title
            <input
              name="title"
              value={todoForm.title}
              onChange={handleTodoFieldChange}
              placeholder="e.g. Binary Tree Zigzag Level Order Traversal"
              required
            />
          </label>

          <div className="field-row">
            <label>
              Platform
              <select name="platform" value={todoForm.platform} onChange={handleTodoFieldChange}>
                <option>LeetCode</option>
                <option>Codeforces</option>
                <option>GeeksforGeeks</option>
                <option>AtCoder</option>
                <option>CodeChef</option>
              </select>
            </label>

            <label>
              Topic
              <select name="topic" value={todoForm.topic} onChange={handleTodoFieldChange}>
                <option>Arrays</option>
                <option>Strings</option>
                <option>Trees</option>
                <option>Graphs</option>
                <option>Dynamic Programming</option>
                <option>Greedy</option>
                <option>Backtracking</option>
                <option>Sliding Window</option>
              </select>
            </label>
          </div>

          <div className="field-row">
            <label>
              Language
              <select name="language" value={todoForm.language} onChange={handleTodoFieldChange}>
                <option>C++</option>
                <option>Java</option>
                <option>Python</option>
                <option>JavaScript</option>
                <option>TypeScript</option>
                <option>Go</option>
                <option>Rust</option>
              </select>
            </label>

            <label>
              Algorithm name
              <input
                name="algorithm"
                value={todoForm.algorithm}
                onChange={handleTodoFieldChange}
                placeholder="e.g. BFS, Sliding Window, Kadane's Algorithm"
                required
              />
            </label>
          </div>

          <div className="field-row">
            <label>
              Difficulty
              <select name="difficulty" value={todoForm.difficulty} onChange={handleTodoFieldChange}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>

            <label>
              Time box
              <input name="eta" value={todoForm.eta} onChange={handleTodoFieldChange} placeholder="45 min" />
            </label>
          </div>

          <label>
            Notes
            <textarea
              name="notes"
              value={todoForm.notes}
              onChange={handleTodoFieldChange}
              placeholder="Add hints, patterns to revisit, or edge cases to test."
            />
          </label>

          <button className="primary-button" type="submit">
            Save quest
          </button>
        </form>

        <section className="panel glass-panel insight-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Filters</span>
              <h2>Track the route</h2>
            </div>
            <span className="badge subtle">{filteredTodos.length} visible</span>
          </div>

          <div className="filter-stack">
            <label>
              Search
              <input
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by title, topic, language, algorithm, or notes"
              />
            </label>

            <div className="field-row">
              <label>
                Topic
                <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
                  {topicOptions.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic === 'all' ? 'All topics' : topic}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Difficulty
                <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
                  <option value="all">All levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
          </div>

          <div className="insight-list">
            <InsightCard
              title="Explorer"
              value={auth.user.username}
              description="Only this user can see and move the quests on this board."
            />
            <InsightCard
              title="Review rhythm"
              value={`${stats.review} in camp`}
              description="Use the review lane for explanation practice and optimized rewrites."
            />
            <InsightCard
              title="Persistence"
              value={todos.storage === 'redis' ? 'Redis connected' : 'Running on fallback'}
              description="Start Redis to keep this user’s data durable across server restarts."
            />
          </div>
        </section>
      </section>

      <section className="lanes">
        {statusOrder.map((laneStatus) => (
          <article key={laneStatus} className="panel lane-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">{statusMeta[laneStatus].label}</span>
                <h2>{statusMeta[laneStatus].description}</h2>
              </div>
              <span className="badge">{groupedTodos[laneStatus].length}</span>
            </div>

            <div className="lane-cards">
              {groupedTodos[laneStatus].length > 0 ? (
                groupedTodos[laneStatus].map((todo) => (
                  <article key={todo.id} className="todo-card">
                    <div className="todo-top">
                      <span className={`difficulty-badge ${difficultyPalette[todo.difficulty]}`}>
                        {todo.difficulty}
                      </span>
                      <button className="ghost-button" type="button" onClick={() => dispatch(deleteTodo(todo.id))}>
                        Remove
                      </button>
                    </div>

                    <h3>{todo.title}</h3>
                    <p>{todo.notes || 'No notes yet. Add hints or tricky cases for your next attempt.'}</p>

                    <div className="meta-row">
                      <span>{todo.platform}</span>
                      <span>{todo.topic}</span>
                      <span>{todo.language}</span>
                      <span>{todo.algorithm}</span>
                      <span>{todo.eta}</span>
                    </div>

                    <div className="card-actions">
                      <select
                        value={todo.status}
                        onChange={(event) =>
                          dispatch(updateTodo({ id: todo.id, changes: { status: event.target.value } }))
                        }
                      >
                        {statusOrder.map((option) => (
                          <option key={option} value={option}>
                            {statusMeta[option].label}
                          </option>
                        ))}
                      </select>

                      <button className="primary-button" type="button" onClick={() => handleAdvance(todo)}>
                        {todo.status === 'mastered' ? 'Mastered' : 'Advance'}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <span>No quests in this lane right now.</span>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      {todos.status === 'loading' && <div className="floating-message">Loading your quest board…</div>}
      {todos.error && <div className="floating-message error-message">{todos.error}</div>}
    </main>
  );
}

function SceneBackdrop() {
  return (
    <>
      <div className="scene-sky" />
      <div className="scene-glow" />
      <div className="scene-ridge ridge-back" />
      <div className="scene-ridge ridge-mid" />
      <div className="scene-ridge ridge-front" />
      <div className="scene-path" />
      <div className="floating-orb orb-one" />
      <div className="floating-orb orb-two" />
      <div className="floating-orb orb-three" />
    </>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InsightCard({ title, value, description }) {
  return (
    <div className="insight-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </div>
  );
}

export default App;
