const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// GET BLOOD SUPPLY DASHBOARD DATA
router.get('/blood-supply', async (req, res) => {
    try {
        // Get inventory summary by blood type
        const [inventory] = await pool.execute(`
            SELECT 
                blood_type,
                SUM(current_units) as total_units,
                SUM(max_capacity) as total_capacity
            FROM blood_inventory
            GROUP BY blood_type
        `);
        
        // Calculate critical shortages
        const criticalTypes = inventory.filter(item => {
            const percentage = (item.total_units / item.total_capacity) * 100;
            return percentage < 20;
        });
        
        // Get low supply count
        const lowSupply = inventory.filter(item => {
            const percentage = (item.total_units / item.total_capacity) * 100;
            return percentage >= 20 && percentage < 50;
        });
        
        res.json({
            success: true,
            data: {
                totalUnits: inventory.reduce((sum, item) => sum + item.total_units, 0),
                criticalShortages: criticalTypes.length,
                lowSupply: lowSupply.length,
                inventory: inventory.map(item => ({
                    blood_type: item.blood_type,
                    current: item.total_units,
                    max: item.total_capacity,
                    percentage: Math.round((item.total_units / item.total_capacity) * 100),
                    status: (item.total_units / item.total_capacity) < 0.2 ? 'critical' : 
                            (item.total_units / item.total_capacity) < 0.5 ? 'low' : 'normal'
                }))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch blood supply data' });
    }
});

// GET ALL FACILITIES (Healthcare Locator)
router.get('/facilities', async (req, res) => {
    try {
        const { city, type, status } = req.query;
        let query = 'SELECT * FROM facilities WHERE 1=1';
        const params = [];
        
        if (city) {
            query += ' AND city = ?';
            params.push(city);
        }
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        if (status) {
            query += ' AND inventory_status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY name';
        
        const [facilities] = await pool.execute(query, params);
        
        res.json({
            success: true,
            count: facilities.length,
            data: facilities
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch facilities' });
    }
});

// GET PUBLISHED ARTICLES
router.get('/articles', async (req, res) => {
    try {
        const [articles] = await pool.execute(`
            SELECT 
                a.*,
                u.name as author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.status = 'published'
            ORDER BY a.published_at DESC
        `);
        
        res.json({
            success: true,
            count: articles.length,
            data: articles
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

// GET ACTIVE CAMPAIGNS
router.get('/campaigns', async (req, res) => {
    try {
        const [campaigns] = await pool.execute(`
            SELECT * FROM campaigns 
            WHERE status = 'active' 
            AND end_date >= CURDATE()
            ORDER BY start_date DESC
        `);
        
        res.json({
            success: true,
            count: campaigns.length,
            data: campaigns
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

module.exports = router;