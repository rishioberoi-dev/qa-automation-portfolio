const { defineConfig } = require('cypress');
const fs = require('fs');
const path = require('path');

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        appendRunLog({ filePath, content }) {
          ensureDirForFile(filePath);
          fs.appendFileSync(filePath, content, 'utf8');
          return null;
        },

        appendJsonArrayEntry({ filePath, entry }) {
          ensureDirForFile(filePath);

          let existing = [];
          if (fs.existsSync(filePath)) {
            try {
              existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              if (!Array.isArray(existing)) {
                existing = [];
              }
            } catch {
              existing = [];
            }
          }

          existing.push(entry);
          fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');
          return null;
        },
      });

      return config;
    },
  },
});
