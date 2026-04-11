-- Drop and recreate database
DROP DATABASE IF EXISTS rednetwork;
CREATE DATABASE rednetwork CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rednetwork;

SHOW TABLES;


-- Users (FIRST - other tables reference this)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    blood_type ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-'),
    location VARCHAR(100),
    age INT,
    role ENUM('admin','donor','healthcare_worker','general_public') DEFAULT 'general_public',
    is_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Facilities (SECOND - appointments and inventory reference this)
CREATE TABLE facilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type ENUM('blood_bank','hospital','clinic') NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    region VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    operating_hours TEXT,
    inventory_status ENUM('well-stocked','moderate','low','critical') DEFAULT 'moderate',
    is_operational BOOLEAN DEFAULT TRUE,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments
CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    facility_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('pending','confirmed','completed','cancelled') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Donations
CREATE TABLE donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    blood_type ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
    units DECIMAL(3,1) DEFAULT 1.0,
    donation_date DATE NOT NULL,
    facility_id INT,
    verified_by INT,
    status ENUM('pending','verified','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Blood Inventory
CREATE TABLE blood_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    facility_id INT NOT NULL,
    blood_type ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
    current_units INT DEFAULT 0,
    max_capacity INT DEFAULT 100,
    status ENUM('normal','low','critical') DEFAULT 'normal',
    expiry_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Articles
CREATE TABLE articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    category ENUM('safety_guidelines','medical_information','health_education','donor_care','community','health_crisis') NOT NULL,
    author_id INT,
    featured_image VARCHAR(255),
    status ENUM('draft','published') DEFAULT 'draft',
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Campaigns
CREATE TABLE campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('draft','active','completed') DEFAULT 'draft',
    target_blood_types VARCHAR(50),
    featured_image VARCHAR(255),
    engagement_link VARCHAR(500),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Audit Logs
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id INT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── SEED DATA (inserts come AFTER tables are created) ───

-- Admin user (password: admin123)
INSERT INTO users (name, email, password, role) VALUES 
('System Admin', 'admin@rednetwork.ph', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGnicdIZTqRvBMwKZD0yFG7GvJy', 'admin');

UPDATE users 
SET password = '$2b$12$uLT4H6PUdhTntxMPKQ/d0OJRkQciTWiPvtcgxWxSbHyoLn6wlhhE2'
WHERE email = 'admin@rednetwork.ph';

-- Sample Facilities
INSERT INTO facilities (name, type, address, city, phone, operating_hours) VALUES
('Philippine Red Cross Manila Center', 'blood_bank', '143 Emerald Avenue, San Juan, Metro Manila', 'Manila', '+63 2 125 6000', 'Mon-Fri: 7AM-7PM, Sat: 8AM-4PM, Sun: Closed'),
('Cebu Blood Bank & Donation Center',  'blood_bank', '45 Osmena Boulevard, Cebu City',             'Cebu',   '+63 32 255 4455', 'Mon-Fri: 6AM-6PM, Sat: 7AM-3PM, Sun: Closed'),
('Davao Medical Center Blood Services','hospital',   '221 E. Jacinto Street, Davao City',           'Davao',  '+63 82 224 6000', 'Mon-Sat: 8AM-5PM, Sun: Emergency Only');

-- Sample Blood Inventory (linked to facility IDs 1, 2, 3)
INSERT INTO blood_inventory (facility_id, blood_type, current_units, max_capacity, status) VALUES
(1, 'A+',  82,  100, 'normal'),
(1, 'A-',  9,   50,  'critical'),
(1, 'B+',  43,  80,  'normal'),
(1, 'B-',  6,   40,  'critical'),
(1, 'AB+', 21,  30,  'normal'),
(1, 'AB-', 3,   20,  'critical'),
(1, 'O+',  18,  150, 'low'),
(1, 'O-',  7,   100, 'critical'),
(2, 'A+',  45,  100, 'normal'),
(2, 'B+',  15,  80,  'low'),
(2, 'O+',  60,  150, 'normal'),
(3, 'A+',  20,  100, 'low'),
(3, 'O+',  30,  150, 'low'),
(3, 'O-',  5,   100, 'critical');
