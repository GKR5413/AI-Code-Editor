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

// Email transporter configuration
let emailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    console.log('📧 Email service configured:', process.env.SMTP_HOST);
} else {
    console.log('⚠️  Email service not configured - OTPs will only be logged to console');
}

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
const CORS_ORIGINS = [ALLOWED_FRONTEND, 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
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

// GitHub OAuth Strategy (optional - only enabled if credentials are provided)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET &&
    process.env.GITHUB_CLIENT_ID.trim() !== '' && process.env.GITHUB_CLIENT_SECRET.trim() !== '') {
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
    console.log('✓ GitHub OAuth enabled');
} else {
    console.log('⚠ GitHub OAuth disabled (no credentials provided)');
}

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
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        console.log('📊 /api/user request received');
        console.log('Auth header:', req.headers.authorization ? 'present' : 'missing');
        console.log('User from token:', {
            id: req.user?.id,
            username: req.user?.username,
            email: req.user?.email
        });
        
        // Fetch full user data from database
        const fullUser = await database.getUserById(req.user.id);
        if (!fullUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove sensitive fields
        const { password_hash, github_access_token, ...userWithoutSensitive } = fullUser;
        res.json({ user: userWithoutSensitive });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
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

// Password reset request - Step 1: Verify user exists and send OTP
app.post('/api/forgot-password', [
    body('email').isEmail().normalizeEmail(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const { email } = req.body;

        // Find user by email - verify user exists
        const user = await new Promise((resolve, reject) => {
            database.db.get(
                'SELECT * FROM users WHERE email = ? AND is_active = 1',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // If user doesn't exist, return error (for password reset, we verify the user exists)
        if (!user) {
            console.log(`Password reset requested for non-existent email: ${email}`);
            return res.status(404).json({
                error: 'No account found with this email address. Please check and try again.'
            });
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Delete any existing OTP for this email
        await new Promise((resolve, reject) => {
            database.db.run(
                'DELETE FROM email_verifications WHERE email = ?',
                [email],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Store OTP in database
        await new Promise((resolve, reject) => {
            database.db.run(
                'INSERT INTO email_verifications (email, code, expires_at, used) VALUES (?, ?, ?, ?)',
                [email, otpCode, expiresAt.toISOString(), false],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Log OTP for development
        console.log(`🔐 Password reset OTP for ${email}: ${otpCode}`);
        console.log(`⏰ OTP expires at: ${expiresAt.toISOString()}`);
        console.log(`👤 User found: ${user.username} (ID: ${user.id})`);

        // Send email with OTP if email service is configured
        if (emailTransporter) {
            try {
                await emailTransporter.sendMail({
                    from: `"VelocIDE" <${process.env.SMTP_USER}>`,
                    to: email,
                    subject: 'VelocIDE - Password Reset OTP',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #4F46E5;">Password Reset Request</h2>
                            <p>Hello ${user.username},</p>
                            <p>You requested to reset your password for your VelocIDE account.</p>
                            <p>Your One-Time Password (OTP) is:</p>
                            <div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 8px;">
                                ${otpCode}
                            </div>
                            <p><strong>This OTP will expire in 10 minutes.</strong></p>
                            <p>If you didn't request this password reset, please ignore this email.</p>
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                            <p style="color: #6B7280; font-size: 12px;">
                                This is an automated email from VelocIDE. Please do not reply to this email.
                            </p>
                        </div>
                    `,
                    text: `
                        Password Reset Request

                        Hello ${user.username},

                        You requested to reset your password for your VelocIDE account.

                        Your One-Time Password (OTP) is: ${otpCode}

                        This OTP will expire in 10 minutes.

                        If you didn't request this password reset, please ignore this email.
                    `
                });
                console.log(`📧 Password reset email sent to ${email}`);
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
                // Continue even if email fails - OTP is still valid
            }
        }

        res.json({
            message: 'OTP has been sent to your email address. Please check your inbox.',
            email: email,
            // In development, return the OTP for testing
            ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Password reset - Step 2: Verify OTP
app.post('/api/verify-reset-otp', [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid email or OTP' });
        }

        const { email, otp } = req.body;

        // Find valid OTP
        const otpRecord = await new Promise((resolve, reject) => {
            database.db.get(
                `SELECT * FROM email_verifications
                 WHERE email = ?
                 AND code = ?
                 AND used = 0
                 AND expires_at > datetime('now')`,
                [email, otp],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Mark OTP as used
        await new Promise((resolve, reject) => {
            database.db.run(
                'UPDATE email_verifications SET used = 1 WHERE id = ?',
                [otpRecord.id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Generate a reset token for the password change
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Get user ID
        const user = await new Promise((resolve, reject) => {
            database.db.get(
                'SELECT id FROM users WHERE email = ?',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // Store reset token
        await new Promise((resolve, reject) => {
            database.db.run(
                'INSERT INTO password_resets (user_id, token, expires_at, used) VALUES (?, ?, ?, ?)',
                [user.id, hashedToken, expiresAt.toISOString(), false],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        console.log(`✅ OTP verified for ${email}, reset token generated`);

        res.json({
            message: 'OTP verified successfully',
            resetToken: resetToken,
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// Password reset - Step 3: Update password with reset token
app.post('/api/reset-password', [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid token or password' });
        }

        const { token, password } = req.body;

        // Hash the token to match the stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find valid reset token
        const resetRecord = await new Promise((resolve, reject) => {
            database.db.get(
                `SELECT pr.*, u.email, u.username
                 FROM password_resets pr
                 JOIN users u ON pr.user_id = u.id
                 WHERE pr.token = ?
                 AND pr.used = 0
                 AND pr.expires_at > datetime('now')`,
                [hashedToken],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!resetRecord) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user's password
        await new Promise((resolve, reject) => {
            database.db.run(
                'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?',
                [hashedPassword, resetRecord.user_id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Mark token as used
        await new Promise((resolve, reject) => {
            database.db.run(
                'UPDATE password_resets SET used = 1 WHERE id = ?',
                [resetRecord.id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        console.log(`✅ Password reset successful for user: ${resetRecord.username}`);

        res.json({ message: 'Password reset successful. You can now log in with your new password.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
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