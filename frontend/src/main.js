// API Configuration
const API_URL = 'http://localhost:5002/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('token');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadBloodSupply();
    loadArticles();
    setupEventListeners();
});

// Auth Functions
async function checkAuth() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.user) {
            currentUser = data.user;
            updateUIForLoggedInUser();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
    }
}

function updateUIForLoggedInUser() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.textContent = currentUser.name;
        loginBtn.onclick = () => window.location.href = './donor-dashboard.html';
    }
}

function showLogin() {
    document.getElementById('loginModal').classList.remove('hidden');
}

function showRegister() {
    document.getElementById('registerModal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                authToken = data.token;
                currentUser = data.user;
                
                // Redirect based on role
                if (data.user.role === 'admin') {
                    window.location.href = './admin-dashboard.html';
                } else {
                    window.location.href = './donor-dashboard.html';
                }
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            alert('Network error. Please try again.');
        }
    });
    
    // Register form
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.role = 'donor';
        
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Registration successful! Please sign in.');
                closeModal('registerModal');
                showLogin();
            } else {
                alert(result.error || 'Registration failed');
            }
        } catch (error) {
            alert('Network error. Please try again.');
        }
    });
    
    // Login button
    document.getElementById('loginBtn')?.addEventListener('click', showLogin);
}

// Load Blood Supply Data
async function loadBloodSupply() {
    const container = document.getElementById('bloodSupplyCards');
    if (!container) return;
    
    const bloodTypes = [
        { type: 'A+', max: 1000 },
        { type: 'A-', max: 500 },
        { type: 'B+', max: 800 },
        { type: 'B-', max: 400 },
        { type: 'AB+', max: 300 },
        { type: 'AB-', max: 200 },
        { type: 'O+', max: 1500 },
        { type: 'O-', max: 1000 }
    ];
    
    // For demo, generate random data
    bloodTypes.forEach(({ type, max }) => {
        const current = Math.floor(Math.random() * max);
        const percentage = Math.round((current / max) * 100);
        let status = 'normal';
        let statusClass = 'status-normal';
        
        if (percentage < 20) {
            status = 'critical';
            statusClass = 'status-critical';
        } else if (percentage < 50) {
            status = 'low';
            statusClass = 'status-low';
        }
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-lg">${type}</h3>
                    <p class="text-xs text-gray-500">${type === 'A+' ? 'A Positive' : type === 'A-' ? 'A Negative' : type === 'B+' ? 'B Positive' : type === 'B-' ? 'B Negative' : type === 'AB+' ? 'AB Positive' : type === 'AB-' ? 'AB Negative' : type === 'O+' ? 'O Positive' : 'O Negative'}</p>
                </div>
                <span class="status-badge ${statusClass}">${status}</span>
            </div>
            <div class="mb-2">
                <span class="text-2xl font-bold">${current}</span>
                <span class="text-gray-500 text-sm"> / ${max} units</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div class="bg-best-red h-2 rounded-full" style="width: ${percentage}%"></div>
            </div>
            ${status === 'critical' ? '<p class="text-xs text-red-600"><i class="fas fa-exclamation-triangle mr-1"></i>Immediate donations needed</p>' : ''}
        `;
        container.appendChild(card);
    });
}

// Load Articles
async function loadArticles() {
    const container = document.getElementById('articlesGrid');
    if (!container) return;
    
    // Demo articles
    const articles = [
        {
            category: 'Safety Guidelines',
            title: 'Safety Measures in Blood Donation: What You Need to Know',
            excerpt: 'Explore the comprehensive safety protocols that protect both donors and recipients in the blood donation process.',
            date: 'Feb 10, 2024',
            author: 'David Chen',
            image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400'
        },
        {
            category: 'Medical Information',
            title: 'Understanding Blood Types: A Comprehensive Guide',
            excerpt: 'Discover what blood types are, why they matter, and how blood matching ensures safe transfusions.',
            date: 'Feb 05, 2024',
            author: 'Sophia Garcia',
            image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400'
        },
        {
            category: 'Health Education',
            title: 'The Importance of Blood Donation: Saving Lives One Pint at a Time',
            excerpt: 'Learn why regular blood donations are critical for maintaining adequate blood supplies in hospitals.',
            date: 'Feb 01, 2024',
            author: 'Marcus Johnson',
            image: 'https://images.unsplash.com/photo-1615461066842-32561977e3d8?w=400'
        }
    ];
    
    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'card overflow-hidden';
        card.innerHTML = `
            <div class="relative h-48 mb-4 -mx-6 -mt-6">
                <img src="${article.image}" alt="${article.title}" class="w-full h-full object-cover">
                <span class="absolute top-4 left-4 bg-best-red text-white text-xs px-3 py-1 rounded-full">${article.category}</span>
            </div>
            <h3 class="font-bold text-lg mb-2 line-clamp-2">${article.title}</h3>
            <p class="text-gray-600 text-sm mb-4 line-clamp-3">${article.excerpt}</p>
            <div class="flex justify-between items-center text-sm text-gray-500">
                <span>${article.date}</span>
                <span>By ${article.author}</span>
            </div>
            <button class="text-best-red font-medium text-sm mt-4 hover:underline">Read Article →</button>
        `;
        container.appendChild(card);
    });
}

// Utility Functions
function checkEligibility() {
    alert('Eligibility checker coming soon! Basic requirements:\n\n• Age 18-65\n• Weight at least 50kg\n• Good health condition\n• No recent tattoos or piercings');
}

// Export for other pages
window.API_URL = API_URL;
window.authToken = authToken;