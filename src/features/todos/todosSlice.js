import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const sortTodos = (todos) =>
  [...todos].sort((left, right) => {
    const statusRank = {
      active: 0,
      review: 1,
      backlog: 2,
      mastered: 3
    };

    const leftRank = statusRank[left.status] ?? 99;
    const rightRank = statusRank[right.status] ?? 99;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

export const fetchTodos = createAsyncThunk('todos/fetchTodos', async () => request('/api/todos'));

export const addTodo = createAsyncThunk('todos/addTodo', async (todo) =>
  request('/api/todos', {
    method: 'POST',
    body: JSON.stringify(todo)
  })
);

export const updateTodo = createAsyncThunk('todos/updateTodo', async ({ id, changes }) =>
  request(`/api/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(changes)
  })
);

export const deleteTodo = createAsyncThunk('todos/deleteTodo', async (id) =>
  request(`/api/todos/${id}`, {
    method: 'DELETE'
  })
);

const todosSlice = createSlice({
  name: 'todos',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
    storage: 'memory'
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = sortTodos(action.payload.todos);
        state.storage = action.payload.storage;
      })
      .addCase(fetchTodos.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      .addCase(addTodo.fulfilled, (state, action) => {
        state.items = sortTodos([...state.items, action.payload.todo]);
        state.storage = action.payload.storage;
      })
      .addCase(updateTodo.fulfilled, (state, action) => {
        state.items = sortTodos(
          state.items.map((todo) => (todo.id === action.payload.todo.id ? action.payload.todo : todo))
        );
        state.storage = action.payload.storage;
      })
      .addCase(deleteTodo.fulfilled, (state, action) => {
        state.items = sortTodos(state.items.filter((todo) => todo.id !== action.payload.id));
        state.storage = action.payload.storage;
      })
      .addMatcher(
        (action) =>
          action.type.startsWith('todos/') &&
          action.type.endsWith('/rejected') &&
          action.type !== fetchTodos.rejected.type,
        (state, action) => {
          state.error = action.error.message;
        }
      );
  }
});

export default todosSlice.reducer;
