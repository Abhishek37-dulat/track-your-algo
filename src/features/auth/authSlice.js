import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiRequest } from '../../lib/api';
import { clearStoredSession, loadStoredSession, saveStoredSession } from '../../lib/authSession';

const storedSession = loadStoredSession();

export const registerUser = createAsyncThunk('auth/registerUser', async (credentials) => {
  const data = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });

  saveStoredSession({
    token: data.token,
    user: data.user
  });

  return data;
});

export const loginUser = createAsyncThunk('auth/loginUser', async (credentials) => {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });

  saveStoredSession({
    token: data.token,
    user: data.user
  });

  return data;
});

export const restoreSession = createAsyncThunk('auth/restoreSession', async (_, { getState }) => {
  const token = getState().auth.token;

  try {
    const data = await apiRequest('/api/auth/me', {
      token
    });

    saveStoredSession({
      token,
      user: data.user
    });

    return {
      ...data,
      token
    };
  } catch (error) {
    clearStoredSession();
    throw error;
  }
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { getState }) => {
  const token = getState().auth.token;

  try {
    if (token) {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        token
      });
    }
  } finally {
    clearStoredSession();
  }

  return {};
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedSession?.user ?? null,
    token: storedSession?.token ?? null,
    status: storedSession?.token ? 'checking' : 'guest',
    error: null,
    storage: 'memory'
  },
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.status = 'authenticating';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.storage = action.payload.storage;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'guest';
        state.error = action.error.message;
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'authenticating';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.storage = action.payload.storage;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'guest';
        state.error = action.error.message;
      })
      .addCase(restoreSession.pending, (state) => {
        state.status = 'checking';
        state.error = null;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.storage = action.payload.storage;
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.status = 'guest';
        state.user = null;
        state.token = null;
        state.error = action.error.message;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'guest';
        state.user = null;
        state.token = null;
        state.error = null;
      });
  }
});

export const { clearAuthError } = authSlice.actions;

export default authSlice.reducer;
