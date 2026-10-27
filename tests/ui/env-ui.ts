// The browser's Origin must match APP_URL for the CSRF check, so UI tests use a fixed port.
process.env.PORT = '5198';
process.env.TEST_APP_URL = 'http://127.0.0.1:5198';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
