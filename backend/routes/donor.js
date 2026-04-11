const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

router.use(authenticate);

// BOOK APPOINTMENT
router.post('/appointments', async (req, res) => {
    const { facility_id, appointment_date, appointment_time, notes } = req.body;
    const user_id = req.user.id;
    
    try {
        // Check if slot is available
        const [existing] = await pool.execute(
            `SELECT COUNT(*) as count FROM appointments 
             WHERE facility_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled'`,
            [facility_id, appointment_date, appointment_time]
        );
        
        if (existing[0].count > 0) {
            return res.status(409).json({ error: 'Time slot already booked' });
        }
        
        const [result] = await pool.execute(`
            INSERT INTO appointments (user_id, facility_id, appointment_date, appointment_time, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [user_id, facility_id, appointment_date, appointment_time, notes]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Appointment booked successfully',
            appointmentId: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to book appointment' });
    }
});

// GET MY APPOINTMENTS
router.get('/my-appointments', async (req, res) => {
    try {
        const [appointments] = await pool.execute(`
            SELECT 
                a.*,
                f.name as facility_name,
                f.address as facility_address
            FROM appointments a
            JOIN facilities f ON a.facility_id = f.id
            WHERE a.user_id = ?
            ORDER BY a.appointment_date DESC
        `, [req.user.id]);
        
        res.json({ success: true, data: appointments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// GET DONOR PROFILE
router.get('/profile', async (req, res) => {
    try {
        const [[profile]] = await pool.execute(`
            SELECT 
                u.*,
                COUNT(d.id) as total_donations,
                MAX(d.donation_date) as last_donation_date
            FROM users u
            LEFT JOIN donations d ON u.id = d.user_id AND d.status = 'verified'
            WHERE u.id = ?
            GROUP BY u.id
        `, [req.user.id]);
        
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// UPDATE PROFILE
router.put('/profile', async (req, res) => {
    const { phone, location, blood_type } = req.body;
    
    try {
        await pool.execute(
            'UPDATE users SET phone = ?, location = ?, blood_type = ? WHERE id = ?',
            [phone, location, blood_type, req.user.id]
        );
        
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;