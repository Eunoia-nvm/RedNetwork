const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many attempts, please try again later'
});

// REGISTER
router.post('/register', async (req, res) => {
    const { name, email, password, phone, blood_type, location, age, role } = req.body;
    
    // Default role protection - only allow specific roles
    let safeRole = 'general_public';
    if (role === 'donor' || role === 'healthcare_worker') {
        safeRole = role;
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        
        const [result] = await pool.execute(
            `INSERT INTO users (name, email, password, phone, blood_type, location, age, role) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, hashedPassword, phone, blood_type, location, age, safeRole]
        );
        
        res.status(201).json({ 
            success: true,
            message: 'Registration successful',
            userId: result.insertId 
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email already registered' });
        }
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// LOGIN
router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?', 
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        await pool.execute(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                name: user.name 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                blood_type: user.blood_type,
                location: user.location
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET CURRENT USER
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.json({ user: null });
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const [users] = await pool.execute(
            'SELECT id, name, email, role, blood_type, location FROM users WHERE id = ?',
            [decoded.id]
        );
        
        if (users.length === 0) return res.json({ user: null });
        
        res.json({ user: users[0] });
    } catch {
        res.json({ user: null });
    }
});

module.exports = router;