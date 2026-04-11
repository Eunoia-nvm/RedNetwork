const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify user still exists
        const [users] = await pool.execute(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [decoded.id]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        req.user = users[0];
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.' 
            });
        }
        next();
    };
};

module.exports = { authenticate, requireRole };