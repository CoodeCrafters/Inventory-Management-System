const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Email transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Test email configuration
transporter.verify((error, success) => {
    if (error) {
        console.log('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// 1. DATABASE CONNECTION TEST API
app.get('/api/test-db', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        res.json({ 
            success: true, 
            message: 'Database connection successful',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database connection failed',
            details: error.message 
        });
    }
});

// 2. REGISTER API with Email Verification
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        const [existingUsers] = await pool.execute(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'User already exists with this email or username' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create user
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password, verification_token) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, verificationToken]
        );

        // Send verification email
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify Your Email - Inventory Management System',
            html: `
                <h2>Welcome to Inventory Management System</h2>
                <p>Please verify your email address by clicking the link below:</p>
                <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                <p>Or copy this link: ${verificationLink}</p>
                <p>This link will expire in 24 hours.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({
            message: 'Registration successful. Please check your email for verification link.',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// 3. EMAIL VERIFICATION API
app.post('/api/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE verification_token = ?',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        const user = users[0];

        // Update user as verified
        await pool.execute(
            'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE user_id = ?',
            [user.user_id]
        );

        res.json({ message: 'Email verified successfully. You can now login.' });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Internal server error during email verification' });
    }
});

// 4. LOGIN API - Updated to accept username or email
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body; // ← Change from 'email' to 'username'

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user exists by username OR email
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username] // Check both with same value
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check if email is verified
        if (!user.is_verified) {
            return res.status(401).json({ error: 'Please verify your email before logging in' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.user_id, 
                username: user.username,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// 5. GET USER PROFILE API
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT user_id, username, email, created_at FROM users WHERE user_id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 6. FORGOT PASSWORD API
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found with this email' });
        }

        const user = users[0];
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Save reset token to database
        await pool.execute(
            'UPDATE users SET reset_token = ? WHERE user_id = ?',
            [resetToken, user.user_id]
        );

        // Send reset password email
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reset Your Password - Inventory Management System',
            html: `
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password. Click the link below to reset it:</p>
                <a href="${resetLink}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>Or copy this link: ${resetLink}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Password reset instructions sent to your email' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 7. RESET PASSWORD API
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE reset_token = ?',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = users[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token
        await pool.execute(
            'UPDATE users SET password = ?, reset_token = NULL WHERE user_id = ?',
            [hashedPassword, user.user_id]
        );

        res.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const otpStore = new Map();

// NEW: Check username exists API
app.post('/api/check-username', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const [users] = await pool.execute(
            'SELECT user_id, username, email FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Username not found' 
            });
        }

        res.json({
            success: true,
            message: 'Username found',
            user: {
                id: users[0].user_id,
                username: users[0].username,
                email: users[0].email
            }
        });

    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// NEW: Send verification code API
app.post('/api/send-verification', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Check if user exists
        const [users] = await pool.execute(
            'SELECT user_id, username, email FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Username not found' 
            });
        }

        const user = users[0];
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        
        // Store OTP
        otpStore.set(username, { otp, expiresAt, email: user.email });
        
        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Your Verification Code - POS System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; text-align: center;">POS System Verification</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center;">
                        <h3 style="color: #007bff; margin-bottom: 20px;">Your Verification Code</h3>
                        <div style="font-size: 32px; font-weight: bold; color: #28a745; letter-spacing: 5px; margin: 20px 0;">
                            ${otp}
                        </div>
                        <p style="color: #666; margin-bottom: 10px;">This code will expire in 10 minutes.</p>
                        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({
            success: true,
            message: 'Verification code sent to your email',
            email: user.email // Return masked email for display
        });

    } catch (error) {
        console.error('Send verification error:', error);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

// NEW: Verify OTP API
app.post('/api/verify-code', async (req, res) => {
    try {
        const { username, code } = req.body;

        if (!username || !code) {
            return res.status(400).json({ error: 'Username and code are required' });
        }

        const otpData = otpStore.get(username);

        if (!otpData) {
            return res.status(400).json({ 
                success: false, 
                message: 'No verification code found or code expired' 
            });
        }

        if (Date.now() > otpData.expiresAt) {
            otpStore.delete(username);
            return res.status(400).json({ 
                success: false, 
                message: 'Verification code has expired' 
            });
        }

        if (otpData.otp !== code) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid verification code' 
            });
        }

        // OTP is valid
        otpStore.delete(username); // Clear OTP after successful verification

        res.json({
            success: true,
            message: 'Verification successful'
        });

    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// NEW: Check OTP status API
app.post('/api/check-otp-status', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const otpData = otpStore.get(username);

        if (!otpData) {
            return res.json({ 
                success: false, 
                otpSent: false,
                message: 'No OTP sent for this user' 
            });
        }

        const isExpired = Date.now() > otpData.expiresAt;
        
        if (isExpired) {
            otpStore.delete(username);
            return res.json({ 
                success: false, 
                otpSent: false,
                message: 'OTP has expired' 
            });
        }

        res.json({
            success: true,
            otpSent: true,
            expiresAt: otpData.expiresAt,
            email: otpData.email
        });

    } catch (error) {
        console.error('Check OTP status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});