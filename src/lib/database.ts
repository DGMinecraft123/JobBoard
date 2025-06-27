import 'dotenv/config';
import mysql from 'mysql2/promise';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linkedout',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Execute a query
export const executeQuery = async (query: string, params?: any[]): Promise<any> => {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  }
};

// Get a single row
export const getRow = async (query: string, params?: any[]): Promise<any> => {
  try {
    const [rows] = await pool.execute(query, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Get row failed:', error);
    throw error;
  }
};

// Insert data and return the inserted ID
export const insertData = async (query: string, params?: any[]): Promise<number> => {
  try {
    const [result] = await pool.execute(query, params);
    return (result as any).insertId;
  } catch (error) {
    console.error('Insert failed:', error);
    throw error;
  }
};

// Update data and return affected rows
export const updateData = async (query: string, params?: any[]): Promise<number> => {
  try {
    const [result] = await pool.execute(query, params);
    return (result as any).affectedRows;
  } catch (error) {
    console.error('Update failed:', error);
    throw error;
  }
};

// Delete data and return affected rows
export const deleteData = async (query: string, params?: any[]): Promise<number> => {
  try {
    const [result] = await pool.execute(query, params);
    return (result as any).affectedRows;
  } catch (error) {
    console.error('Delete failed:', error);
    throw error;
  }
};

// Close the connection pool
export const closeConnection = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

export default pool; 