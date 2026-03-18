# AlgoTodo

A scenic algorithm practice tracker built with React, Vite, Redux Toolkit, Express, and Redis.

## Docker

Run the full app, including the built React frontend, Express API, and Redis:

```bash
docker compose up --build
```

Open `http://localhost:8787`.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start Redis:

   ```bash
   docker compose up -d redis
   ```

3. Launch the app:

   ```bash
   npm run dev
   ```

The Vite client runs at `http://localhost:5173` and the API runs at `http://localhost:8787`.

## Notes

- `npm run docker:up` is a shortcut for `docker compose up --build`.
- `npm run docker:down` stops the containers.
- If Redis is not available, the server falls back to in-memory storage so the UI still loads.
- Build the client with `npm run build`.
- Run the API only with `npm start`.
