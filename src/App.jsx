import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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

const initialForm = {
  title: '',
  platform: 'LeetCode',
  topic: 'Arrays',
  language: 'C++',
  algorithm: '',
  difficulty: 'medium',
  eta: '30 min',
  notes: ''
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
  const { items, status, error, storage } = useSelector((state) => state.todos);

  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchTodos());
    }
  }, [dispatch, status]);

  const searchValue = deferredSearch.trim().toLowerCase();

  const filteredTodos = items.filter((todo) => {
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

  const topicOptions = ['all', ...new Set(items.map((todo) => todo.topic))];

  const mastered = items.filter((todo) => todo.status === 'mastered').length;
  const active = items.filter((todo) => todo.status === 'active').length;
  const review = items.filter((todo) => todo.status === 'review').length;
  const stats = {
    total: items.length,
    active,
    review,
    completion: items.length === 0 ? 0 : Math.round((mastered / items.length) * 100)
  };

  const focusTodo =
    items.find((todo) => todo.status === 'active') ??
    items.find((todo) => todo.status === 'review') ??
    items[0];

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.algorithm.trim()) {
      return;
    }

    await dispatch(
      addTodo({
        ...form,
        title: form.title.trim(),
        algorithm: form.algorithm.trim(),
        notes: form.notes.trim()
      })
    ).unwrap();

    setForm(initialForm);
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

  return (
    <main className="app-shell">
      <div className="background-orb orb-left" />
      <div className="background-orb orb-right" />

      <section className="hero-card">
        <div className="hero-copy">
          <div className="eyebrow">Algorithm Expedition Board</div>
          <h1>Turn daily coding practice into a map of quests, camps, and summits.</h1>
          <p>
            Manage DSA problems by topic, move each challenge through solving stages, and keep your
            Redis-backed progress safe between sessions.
          </p>

          <div className="stat-grid">
            <StatCard label="Open Quests" value={stats.total} accent="teal" />
            <StatCard label="Solving Now" value={stats.active} accent="mint" />
            <StatCard label="Camp Reviews" value={stats.review} accent="sand" />
            <StatCard label="Mastery" value={`${stats.completion}%`} accent="gold" />
          </div>
        </div>

        <div className="scene-card">
          <div className="scene-sky" />
          <div className="scene-glow" />
          <div className="scene-ridge ridge-back" />
          <div className="scene-ridge ridge-mid" />
          <div className="scene-ridge ridge-front" />
          <div className="scene-path" />
          <div className="floating-orb orb-one" />
          <div className="floating-orb orb-two" />
          <div className="floating-orb orb-three" />

          <aside className="quest-panel">
            <span className={`storage-pill ${storage}`}>{storage === 'redis' ? 'Redis live' : 'Memory fallback'}</span>
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
        <form className="panel glass-panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-header">
            <div>
              <span className="eyebrow">New Quest</span>
              <h2>Add an algorithm task</h2>
            </div>
            <span className="badge">Focus + persist</span>
          </div>

          <label>
            Problem title
            <input
              name="title"
              value={form.title}
              onChange={handleFieldChange}
              placeholder="e.g. Binary Tree Zigzag Level Order Traversal"
              required
            />
          </label>

          <div className="field-row">
            <label>
              Platform
              <select name="platform" value={form.platform} onChange={handleFieldChange}>
                <option>LeetCode</option>
                <option>Codeforces</option>
                <option>GeeksforGeeks</option>
                <option>AtCoder</option>
                <option>CodeChef</option>
              </select>
            </label>

            <label>
              Topic
              <select name="topic" value={form.topic} onChange={handleFieldChange}>
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
              <select name="language" value={form.language} onChange={handleFieldChange}>
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
                value={form.algorithm}
                onChange={handleFieldChange}
                placeholder="e.g. BFS, Sliding Window, Kadane's Algorithm"
                required
              />
            </label>
          </div>

          <div className="field-row">
            <label>
              Difficulty
              <select name="difficulty" value={form.difficulty} onChange={handleFieldChange}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>

            <label>
              Time box
              <input name="eta" value={form.eta} onChange={handleFieldChange} placeholder="45 min" />
            </label>
          </div>

          <label>
            Notes
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleFieldChange}
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
              title="Active focus"
              value={`${stats.active} quest${stats.active === 1 ? '' : 's'}`}
              description="Keep only a few hard problems in the deep work lane at once."
            />
            <InsightCard
              title="Review rhythm"
              value={`${stats.review} in camp`}
              description="Use the review lane for explanation practice and optimized rewrites."
            />
            <InsightCard
              title="Persistence"
              value={storage === 'redis' ? 'Redis connected' : 'Running on fallback'}
              description="Start Redis to keep your data durable across server restarts."
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

      {status === 'loading' && <div className="floating-message">Loading your quest board…</div>}
      {error && <div className="floating-message error-message">{error}</div>}
    </main>
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
