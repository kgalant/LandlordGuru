const db = require('./db/knex');
const app = require('./app');

const PORT = process.env.PORT || 3000;

db.migrate.latest()
  .then(() => {
    // Register db on app so auth middleware can access it for logger
    app.set('db', db);

    app.listen(PORT, () => {
      console.log(`LandlordGuru backend listening on port ${PORT}`);

      db.raw('select 1')
        .then(() => console.log('DB connected'))
        .catch(err => console.warn('DB not available:', err.message));
    });
  })
  .catch(err => {
    console.error('Migration failed — server not started:', err.message);
    process.exit(1);
  });
