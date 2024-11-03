import { Database } from 'duckdb-async';

let db: Database | null = null;
export async function initializeDB() {
  console.log('initializeDB function called');

  if (db) {
    console.log('Reusing existing connection');
    return db;
  }
  try {
    console.log('Creating new db connection');
    db = await Database.create(':memory:');
    console.log('DB connection created successfully');

    const testResult = await db.all('SELECT 1 AS test');
    console.log('Connection test result:', testResult);

    await db.run('INSTALL spatial');
    await db.run('LOAD spatial');

    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    db = null;
  }
}
