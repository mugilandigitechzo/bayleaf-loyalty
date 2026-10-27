// Must be imported before anything that reads server/config.ts.
process.env.NODE_ENV = 'test';
process.env.APP_URL = process.env.TEST_APP_URL ?? 'http://localhost:5199';
process.env.PORT = process.env.PORT ?? '0';
