import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { loginUser, logoutUser, registerUser, restoreSession } from '../auth/authSlice';
import { apiRequest } from '../../lib/api';

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

const getToken = (getState) => getState().auth.token;

export const fetchTodos = createAsyncThunk('todos/fetchTodos', async (_, { getState }) =>
  apiRequest('/api/todos', {
    token: getToken(getState)
  })
);

export const addTodo = createAsyncThunk('todos/addTodo', async (todo, { getState }) =>
  apiRequest('/api/todos', {
    method: 'POST',
    body: JSON.stringify(todo),
    token: getToken(getState)
  })
);

export const updateTodo = createAsyncThunk('todos/updateTodo', async ({ id, changes }, { getState }) =>
  apiRequest(`/api/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
    token: getToken(getState)
  })
);

export const deleteTodo = createAsyncThunk('todos/deleteTodo', async (id, { getState }) =>
  apiRequest(`/api/todos/${id}`, {
    method: 'DELETE',
    token: getToken(getState)
  })
);

const initialState = {
  items: [],
  status: 'idle',
  error: null,
  storage: 'memory'
};

const resetTodosState = (state) => {
  state.items = [];
  state.status = 'idle';
  state.error = null;
  state.storage = 'memory';
};

const todosSlice = createSlice({
  name: 'todos',
  initialState,
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
      .addCase(registerUser.fulfilled, resetTodosState)
      .addCase(loginUser.fulfilled, resetTodosState)
      .addCase(restoreSession.fulfilled, resetTodosState)
      .addCase(restoreSession.rejected, resetTodosState)
      .addCase(logoutUser.fulfilled, resetTodosState)
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
