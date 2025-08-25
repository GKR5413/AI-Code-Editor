const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const database = require('./database/connection');

const app = express();
const PORT = process.env.AUTH_PORT || 3010;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", "https://api.github.com"],
            imgSrc: ["'self'", "data:", "https://avatars.githubusercontent.com"]
        }
    }
}));

// Rate limiting
const rateLimiter = new RateLimiterMemory({
    keyGenerator: (req) => req.ip,
    points: 10, // Number of attempts
    duration: 900, // Per 15 minutes
});

const authRateLimiter = new RateLimiterMemory({
    keyGenerator: (req) => req.ip,
    points: 5, // Number of login attempts
    duration: 900, // Per 15 minutes
});

// CORS configuration
const ALLOWED_FRONTEND = process.env.FRONTEND_URL || 'http://localhost:8080';
const CORS_ORIGINS = [ALLOWED_FRONTEND, 'http://localhost:5173', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Simple mailer (console fallback if no SMTP set)
const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
}) : null;

async function sendEmail(to, subject, text) {
    try {
        if (!transporter) {
            console.log(`📧 [DEV] Email to ${to}: ${subject} - ${text}`);
            return;
        }
        await transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@velocide.local', to, subject, text });
    } catch (e) {
        console.warn('📧 Email delivery failed, continuing without email:', e?.message || e);
        console.log(`📧 [FALLBACK] Email to ${to}: ${subject} - ${text}`);
        // Do not throw – allow registration flow to continue in development
    }
}


// Ensure DB has password_hash column for local auth
(async () => {
    try {
        const hasColumn = await new Promise((resolve) => {
            database.db.get("PRAGMA table_info(users)", (_e, _r) => resolve(true));
        });
        // Try add column if not present
        database.db.run("ALTER TABLE users ADD COLUMN password_hash TEXT", () => {});
    } catch (e) {
        // ignore if already exists
    }
})();

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './database'
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:3010/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists
        let user = await database.getUserByGithubId(profile.id);
        
        if (user) {
            // Update existing user with latest GitHub data
            await database.updateUser(user.id, {
                display_name: profile.displayName,
                avatar_url: profile.photos?.[0]?.value,
                bio: profile._json?.bio,
                location: profile._json?.location,
                website_url: profile._json?.blog,
                github_access_token: accessToken
            });
            
            await database.updateUserLastLogin(user.id);
            user = await database.getUserById(user.id);
        } else {
            // Create new user
            const userId = await database.createUser({
                github_id: profile.id,
                username: profile.username,
                email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
                display_name: profile.displayName,
                avatar_url: profile.photos?.[0]?.value,
                bio: profile._json?.bio,
                location: profile._json?.location,
                website_url: profile._json?.blog,
                github_access_token: accessToken
            });
            
            user = await database.getUserById(userId);
            
            // Create default workspace for new user
            await database.createWorkspace(userId, 'My Workspace', 'Default workspace for VelocIDE');
        }
        
        return done(null, user);
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        return done(error, null);
    }
}));

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await database.getUserById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    
    // Check for JWT token in header
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
            req.user = decoded;
            return next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }
    
    res.status(401).json({ error: 'Authentication required' });
};

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'VelocIDE Auth Service is running',
        version: '1.0.0'
    });
});

// GitHub OAuth routes
app.get('/auth/github', (req, res, next) => {
    // Fast fail with helpful error if env is not configured
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        const fe = process.env.FRONTEND_URL || 'http://localhost:8080';
        return res.redirect(`${fe}/auth/login?error=GitHub%20OAuth%20not%20configured`);
    }
    return passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

app.get('/auth/github/callback', (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    passport.authenticate('github', async (err, user) => {
        if (err) {
            console.error('GitHub OAuth callback error:', err);
            return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('OAuth failed')}`);
        }
        if (!user) {
            return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('OAuth failed')}`);
        }

        try {
            console.log('🔐 GitHub OAuth callback received');
            console.log('User data:', { id: user?.id, username: user?.username, email: user?.email });

            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, username: user.username, email: user.email },
                process.env.JWT_SECRET || 'fallback-secret',
                { expiresIn: '24h' }
            );

            console.log('Generated JWT token:', token.substring(0, 50) + '...');

            // Redirect to frontend with token
            const redirectUrl = `${frontendUrl}/auth/callback?token=${token}`;
            console.log('Redirecting to:', redirectUrl);
            return res.redirect(redirectUrl);
        } catch (e) {
            console.error('OAuth post-processing error:', e);
            return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('Internal%20error')}`);
        }
    })(req, res, next);
});

// Email/password registration
app.post('/api/register',
    [
        body('username').isLength({ min: 3, max: 100 }),
        body('email').isEmail().isLength({ max: 255 }),
        body('password').isLength({ min: 8 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, email, password } = req.body;

            // Check existence (active and inactive)
            const existingAnyByEmail = await new Promise((resolve, reject) => {
                database.db.get('SELECT * FROM users WHERE email = ? LIMIT 1', [email], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            if (existingAnyByEmail) {
                if (existingAnyByEmail.is_active) {
                    return res.status(409).json({ error: 'Email already in use' });
                } else {
                    // Inactive account exists: refresh password hash and resend OTP
                    const hash = await bcrypt.hash(password, 10);
                    await database.updateUser(existingAnyByEmail.id, { password_hash: hash });

                    // Generate OTP
                    const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(0,6);
                    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
                    await new Promise((resolve, reject) => {
                        const stmt = database.db.prepare(`
                            INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)
                        `);
                        stmt.run([email, code, expiresAt], (err) => err ? reject(err) : resolve());
                        stmt.finalize();
                    });

                    await sendEmail(email, 'Your VelocIDE verification code', `Your code is ${code}. It expires in 10 minutes.`);

                    return res.status(200).json({ message: 'Account exists but is unverified. A new verification code was sent.' });
                }
            }

            // Check username
            const existingByUsername = await new Promise((resolve, reject) => {
                database.db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            if (existingByUsername) return res.status(409).json({ error: 'Username already in use' });

            const hash = await bcrypt.hash(password, 10);

            // Create unverified user with password_hash; mark inactive until verified
            const userId = await new Promise((resolve, reject) => {
                const stmt = database.db.prepare(`
                    INSERT INTO users (username, email, display_name, password_hash, is_active, last_login)
                    VALUES (?, ?, ?, ?, 0, datetime('now'))
                `);
                stmt.run([username, email, username, hash], function(err){
                    if (err) reject(err); else resolve(this.lastID);
                });
                stmt.finalize();
            });

            // Generate OTP
            const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(0,6);
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            await new Promise((resolve, reject) => {
                const stmt = database.db.prepare(`
                    INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)
                `);
                stmt.run([email, code, expiresAt], (err) => err ? reject(err) : resolve());
                stmt.finalize();
            });

            await sendEmail(email, 'Your VelocIDE verification code', `Your code is ${code}. It expires in 10 minutes.`);

            res.status(201).json({ message: 'Account created. Verify OTP sent to email.' });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
);

// Resend OTP for inactive accounts
app.post('/api/resend-otp', async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const user = await database.getUserByEmail(email);
        if (user && user.is_active) return res.status(400).json({ error: 'Account already active' });

        const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(0,6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await new Promise((resolve, reject) => {
            const stmt = database.db.prepare(`
                INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)
            `);
            stmt.run([email, code, expiresAt], (err) => err ? reject(err) : resolve());
            stmt.finalize();
        });
        await sendEmail(email, 'Your VelocIDE verification code', `Your code is ${code}. It expires in 10 minutes.`);
        res.json({ message: 'Verification code resent' });
    } catch (e) {
        console.error('Resend OTP error:', e);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
});

// Email/password login
app.post('/api/login',
    [
        body('email').isEmail(),
        body('password').isLength({ min: 8 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const ip = req.ip;
            const ua = req.headers['user-agent'] || '';
            const { email, password } = req.body;

            const user = await database.getUserByEmail(email);
            if (!user || !user.password_hash) {
                await database.recordLoginAttempt(ip, email, false, ua);
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) {
                await database.recordLoginAttempt(ip, email, false, ua);
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            await database.updateUserLastLogin(user.id);
            await database.recordLoginAttempt(ip, email, true, ua);

            const token = jwt.sign(
                { id: user.id, username: user.username, email: user.email },
                process.env.JWT_SECRET || 'fallback-secret',
                { expiresIn: '24h' }
            );

            const { password_hash, github_access_token, ...userSafe } = user;
            res.json({ user: userSafe, token });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
);

// Verify OTP endpoint
app.post('/api/verify-otp', [
    body('email').isEmail(),
    body('code').isLength({ min: 6, max: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Normalize inputs
        const email = (req.body.email || '').trim().toLowerCase();
        const code = String(req.body.code || '').replace(/\D/g, '').slice(0, 6);
        const row = await new Promise((resolve, reject) => {
            database.db.get(
                `SELECT * FROM email_verifications WHERE email = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`,
                [email, code],
                (err, r) => err ? reject(err) : resolve(r)
            );
        });
        if (!row) return res.status(400).json({ error: 'Invalid code' });
        if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Code expired' });

        // Mark used
        await new Promise((resolve) => {
            database.db.run(`UPDATE email_verifications SET used = 1 WHERE id = ?`, [row.id], () => resolve());
        });

        // Activate user (lookup regardless of active flag)
        const userRow = await new Promise((resolve, reject) => {
            database.db.get('SELECT * FROM users WHERE email = ? LIMIT 1', [email], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
        if (!userRow) return res.status(404).json({ error: 'User not found' });
        await database.updateUser(userRow.id, { is_active: 1 });

        const token = jwt.sign(
            { id: userRow.id, username: userRow.username, email: userRow.email },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        const { password_hash, github_access_token, ...userSafe } = await database.getUserById(userRow.id);
        res.json({ user: userSafe, token });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Dev-only: fetch latest OTP for an email (do not enable in production)
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/dev/latest-otp', async (req, res) => {
        try {
            const email = req.query.email;
            if (!email) return res.status(400).json({ error: 'email is required' });
            const row = await new Promise((resolve, reject) => {
                database.db.get(
                    `SELECT code, expires_at, used, created_at FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
                    [email],
                    (err, r) => err ? reject(err) : resolve(r)
                );
            });
            if (!row) return res.status(404).json({ error: 'No OTP found' });
            res.json(row);
        } catch (e) {
            res.status(500).json({ error: 'Failed to fetch OTP' });
        }
    });
}

// Get current user
app.get('/api/user', requireAuth, (req, res) => {
    console.log('📊 /api/user request received');
    console.log('Auth header:', req.headers.authorization ? 'present' : 'missing');
    console.log('User from token:', {
        id: req.user?.id,
        username: req.user?.username,
        email: req.user?.email
    });
    
    const { github_access_token, ...userWithoutToken } = req.user;
    res.json({ user: userWithoutToken });
});

// Update user profile
app.put('/api/user', [requireAuth, 
    body('display_name').optional().isLength({ min: 1, max: 255 }),
    body('bio').optional().isLength({ max: 500 }),
    body('location').optional().isLength({ max: 255 }),
    body('website_url').optional().isURL()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        await database.updateUser(req.user.id, req.body);
        const updatedUser = await database.getUserById(req.user.id);
        const { github_access_token, ...userWithoutToken } = updatedUser;
        
        res.json({ user: userWithoutToken });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Get user workspaces
app.get('/api/workspaces', requireAuth, async (req, res) => {
    try {
        const workspaces = await database.getUserWorkspaces(req.user.id);
        res.json({ workspaces });
    } catch (error) {
        console.error('Get workspaces error:', error);
        res.status(500).json({ error: 'Failed to fetch workspaces' });
    }
});

// Create new workspace
app.post('/api/workspaces', [requireAuth,
    body('name').isLength({ min: 1, max: 255 }),
    body('description').optional().isLength({ max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;
        const workspaceId = await database.createWorkspace(req.user.id, name, description);
        
        res.status(201).json({ 
            id: workspaceId,
            name,
            description,
            message: 'Workspace created successfully'
        });
    } catch (error) {
        console.error('Create workspace error:', error);
        res.status(500).json({ error: 'Failed to create workspace' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Session destroy failed' });
            }
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// Login attempts tracking middleware
const trackLoginAttempt = async (req, res, next) => {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';
        
        await database.recordLoginAttempt(ip, req.body.email, false, userAgent);
    } catch (error) {
        console.error('Error tracking login attempt:', error);
    }
    next();
};

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Auth service error:', err);
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    database.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    database.close();
    process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔐 VelocIDE Auth Service running on port ${PORT}`);
    console.log(`🔗 GitHub OAuth callback: ${process.env.GITHUB_CALLBACK_URL || 'http://localhost:3010/auth/github/callback'}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
});

module.exports = app;