const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'velocide.db');
        this.db = null;
        this.init();
    }

    init() {
        // Create database directory if it doesn't exist
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Create database connection
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Connected to VelocIDE SQLite database');
                this.createTables();
            }
        });

        // Enable foreign keys
        this.db.run('PRAGMA foreign_keys = ON');
    }

    async createTables() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split schema into individual statements
        const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            await new Promise((resolve, reject) => {
                this.db.run(statement, (err) => {
                    if (err) {
                        console.error('Error creating table:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        
        console.log('Database tables created successfully');
    }

    // User operations
    async createUser(userData) {
        const {
            github_id,
            username,
            email,
            display_name,
            avatar_url,
            bio,
            location,
            website_url,
            github_access_token
        } = userData;

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO users (
                    github_id, username, email, display_name, avatar_url,
                    bio, location, website_url, github_access_token, last_login
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);

            stmt.run([
                github_id, username, email, display_name, avatar_url,
                bio, location, website_url, github_access_token
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });

            stmt.finalize();
        });
    }

    async getUserByGithubId(github_id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE github_id = ? AND is_active = 1',
                [github_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE email = ? AND is_active = 1',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ? AND is_active = 1',
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async updateUserLastLogin(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET last_login = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
                [id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async updateUser(id, userData) {
        const fields = [];
        const values = [];
        
        Object.entries(userData).forEach(([key, value]) => {
            if (value !== undefined && key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        
        values.push(id);
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE users SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
                values,
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Workspace operations
    async createWorkspace(userId, name, description = '') {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO user_workspaces (user_id, name, description)
                VALUES (?, ?, ?)
            `);

            stmt.run([userId, name, description], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });

            stmt.finalize();
        });
    }

    async getUserWorkspaces(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM user_workspaces WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Login attempts tracking
    async recordLoginAttempt(ip, email, success, userAgent) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO login_attempts (ip_address, email, success, user_agent)
                VALUES (?, ?, ?, ?)
            `);

            stmt.run([ip, email, success, userAgent], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });

            stmt.finalize();
        });
    }

    async getRecentLoginAttempts(ip, minutes = 15) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM login_attempts 
                 WHERE ip_address = ? AND attempt_time > datetime('now', '-${minutes} minutes')
                 ORDER BY attempt_time DESC`,
                [ip],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Cleanup expired sessions
    async cleanupExpiredSessions() {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM user_sessions WHERE expires_at < datetime(\'now\')',
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

// Create singleton instance
const database = new Database();

// Cleanup expired sessions every hour
setInterval(() => {
    database.cleanupExpiredSessions().catch(console.error);
}, 60 * 60 * 1000);

module.exports = database;