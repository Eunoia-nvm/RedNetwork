const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const pool = require('../config/database');

const router = express.Router();

// All routes require admin
router.use(authenticate, requireRole('admin'));

// GET ADMIN DASHBOARD STATS
router.get('/dashboard', async (req, res) => {
    try {
        const [[donorStats]] = await pool.execute(`
            SELECT 
                COUNT(*) as total_donors,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_donors_30d
            FROM users 
            WHERE role = 'donor'
        `);
        
        const [[appointmentStats]] = await pool.execute(`
            SELECT 
                COUNT(*) as total_appointments,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_approvals,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM appointments
        `);
        
        const [[inventoryStats]] = await pool.execute(`
            SELECT 
                SUM(current_units) as total_units,
                SUM(CASE WHEN status = 'critical' THEN 1 ELSE 0 END) as critical_shortages
            FROM blood_inventory
        `);
        
        const [[campaignStats]] = await pool.execute(`
            SELECT 
                COUNT(*) as total_campaigns,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_campaigns
            FROM campaigns
        `);
        
        // Recent activity
        const [recentActivity] = await pool.execute(`
            SELECT * FROM audit_logs 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        res.json({
            success: true,
            data: {
                donors: donorStats,
                appointments: appointmentStats,
                inventory: inventoryStats,
                campaigns: campaignStats,
                recentActivity
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// DONOR MANAGEMENT
router.get('/donors', async (req, res) => {
    try {
        const { search, blood_type, status } = req.query;
        let query = `
            SELECT 
                u.*,
                COUNT(d.id) as total_donations,
                MAX(d.donation_date) as last_donation_date
            FROM users u
            LEFT JOIN donations d ON u.id = d.user_id
            WHERE u.role = 'donor'
        `;
        const params = [];
        
        if (search) {
            query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (blood_type) {
            query += ' AND u.blood_type = ?';
            params.push(blood_type);
        }
        
        query += ' GROUP BY u.id ORDER BY u.created_at DESC';
        
        const [donors] = await pool.execute(query, params);
        res.json({ success: true, data: donors });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch donors' });
    }
});

// APPOINTMENT MANAGEMENT
router.get('/appointments', async (req, res) => {
    try {
        const [appointments] = await pool.execute(`
            SELECT 
                a.*,
                u.name as donor_name,
                u.email as donor_email,
                f.name as facility_name
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            JOIN facilities f ON a.facility_id = f.id
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `);
        
        res.json({ success: true, data: appointments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

router.put('/appointments/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await pool.execute(
            'UPDATE appointments SET status = ? WHERE id = ?',
            [status, id]
        );
        
        res.json({ success: true, message: 'Appointment status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

// ARTICLE MANAGEMENT
router.post('/articles', async (req, res) => {
    const { title, content, category, featured_image, status } = req.body;
    
    try {
        const [result] = await pool.execute(`
            INSERT INTO articles (title, content, category, author_id, featured_image, status, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [title, content, category, req.user.id, featured_image || null, status || 'published', status === 'published' ? new Date() : null]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Article published',
            articleId: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create article' });
    }
});

router.get('/articles', async (req, res) => {
    try {
        const [articles] = await pool.execute(`
            SELECT a.*, u.name as author_name 
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            ORDER BY a.created_at DESC
        `);
        
        res.json({ success: true, data: articles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

// CAMPAIGN MANAGEMENT
router.post('/campaigns', async (req, res) => {
    const { title, description, start_date, end_date, target_blood_types, status } = req.body;
    
    try {
        const [result] = await pool.execute(`
            INSERT INTO campaigns (title, description, start_date, end_date, target_blood_types, created_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [title, description, start_date, end_date, target_blood_types || null, req.user.id, status || 'active']);
        
        res.status(201).json({ 
            success: true, 
            message: 'Campaign created',
            campaignId: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// BLOOD INVENTORY MANAGEMENT
router.get('/inventory', async (req, res) => {
    try {
        const [inventory] = await pool.execute(`
            SELECT 
                bi.*,
                f.name as facility_name,
                f.type as facility_type
            FROM blood_inventory bi
            JOIN facilities f ON bi.facility_id = f.id
            ORDER BY f.name, bi.blood_type
        `);
        
        res.json({ success: true, data: inventory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

router.put('/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { current_units, status } = req.body;
    
    try {
        await pool.execute(
            'UPDATE blood_inventory SET current_units = ?, status = ? WHERE id = ?',
            [current_units, status, id]
        );
        
        res.json({ success: true, message: 'Inventory updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

// FACILITY MANAGEMENT
router.post('/facilities', async (req, res) => {
    const { name, type, address, city, phone, operating_hours } = req.body;
    
    try {
        const [result] = await pool.execute(`
            INSERT INTO facilities (name, type, address, city, phone, operating_hours)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, type, address, city, phone, operating_hours]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Facility added',
            facilityId: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add facility' });
    }
});

// EXPORT DATA (CSV/Excel format - simplified as JSON for now)
router.get('/export/:type', async (req, res) => {
    const { type } = req.params;
    
    try {
        let data;
        let filename;
        
        switch(type) {
            case 'donors':
                [data] = await pool.execute('SELECT name, email, blood_type, location, created_at FROM users WHERE role = "donor"');
                filename = 'donors_export.json';
                break;
            case 'appointments':
                [data] = await pool.execute(`
                    SELECT a.*, u.name as donor_name, f.name as facility_name 
                    FROM appointments a
                    JOIN users u ON a.user_id = u.id
                    JOIN facilities f ON a.facility_id = f.id
                `);
                filename = 'appointments_export.json';
                break;
            case 'inventory':
                [data] = await pool.execute(`
                    SELECT bi.*, f.name as facility_name 
                    FROM blood_inventory bi
                    JOIN facilities f ON bi.facility_id = f.id
                `);
                filename = 'inventory_export.json';
                break;
            default:
                return res.status(400).json({ error: 'Invalid export type' });
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Export failed' });
    }
});

// ── ARTICLE UPDATE & DELETE ──
router.put('/articles/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, category, featured_image, status } = req.body;
    try {
        await pool.execute(
            `UPDATE articles SET title=?, content=?, category=?, featured_image=?, status=?, 
             published_at = CASE WHEN ? = 'published' THEN NOW() ELSE published_at END
             WHERE id=?`,
            [title, content, category, featured_image, status, status, id]
        );
        res.json({ success: true, message: 'Article updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update article' });
    }
});

router.put('/articles/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.execute(
            `UPDATE articles SET status=?, published_at = CASE WHEN ? = 'published' THEN NOW() ELSE published_at END WHERE id=?`,
            [status, status, id]
        );
        res.json({ success: true, message: 'Article status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

router.delete('/articles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM articles WHERE id=?', [id]);
        res.json({ success: true, message: 'Article deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete article' });
    }
});

// ── CAMPAIGN UPDATE & DELETE ──
router.put('/campaigns/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, start_date, end_date, target_blood_types, status } = req.body;
    try {
        await pool.execute(
            `UPDATE campaigns SET title=?, description=?, start_date=?, end_date=?, target_blood_types=?, status=? WHERE id=?`,
            [title, description, start_date, end_date, target_blood_types, status, id]
        );
        res.json({ success: true, message: 'Campaign updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

router.put('/campaigns/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.execute('UPDATE campaigns SET status=? WHERE id=?', [status, id]);
        res.json({ success: true, message: 'Campaign status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update campaign status' });
    }
});

router.delete('/campaigns/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM campaigns WHERE id=?', [id]);
        res.json({ success: true, message: 'Campaign deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});


module.exports = router;