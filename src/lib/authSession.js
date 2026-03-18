const sessionKey = 'algotodo.session';

export const loadStoredSession = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(sessionKey);

    if (!rawSession) {
      return null;
    }

    return JSON.parse(rawSession);
  } catch {
    return null;
  }
};

export const saveStoredSession = (session) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(sessionKey, JSON.stringify(session));
};

export const clearStoredSession = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(sessionKey);
};
