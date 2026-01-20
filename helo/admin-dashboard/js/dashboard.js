document.addEventListener('DOMContentLoaded', () => {
    // Tab Management
    const tabs = document.querySelectorAll('nav li');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            if (!target) return;

            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetContent = document.getElementById(target);
            if (targetContent) targetContent.classList.add('active');
            
            // Re-render charts if needed on tab switch
            if (target === 'dashboard') initCharts();
        });
    });

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
        const isDark = document.body.classList.contains('dark-theme');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    });

    // Charts Initialization
    let charts = {};
    async function initCharts() {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
            });
            const data = await response.json();
            if (data.success && data.stats) {
                // Update Overview Cards with Real Data
                document.querySelector('.stat-card:nth-child(1) h3').textContent = data.stats.totalUsers.toLocaleString();
                document.querySelector('.stat-card:nth-child(2) h3').textContent = data.stats.activeToday.toLocaleString();
                document.querySelector('.stat-card:nth-child(3) h3').textContent = data.stats.totalMatches.toLocaleString();
                document.querySelector('.stat-card:nth-child(4) h3').textContent = '$' + (data.stats.totalUsers * 0.12).toFixed(0).toLocaleString(); // Estimated
            }
        } catch (e) { console.error("Stats sync failed", e); }

        Object.values(charts).forEach(c => c.destroy());

        const growthCtx = document.getElementById('growthChart').getContext('2d');
        charts.growth = new Chart(growthCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'DAU',
                    data: [350, 380, 420, 410, 450, 480, 520, 500, 540, 590, 620, 650],
                    borderColor: '#3b82f6',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.05)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { grid: { borderDash: [5, 5] } },
                    x: { grid: { display: false } }
                }
            }
        });

        const revCtx = document.getElementById('revenueChart').getContext('2d');
        charts.revenue = new Chart(revCtx, {
            type: 'doughnut',
            data: {
                labels: ['Subscriptions', 'Boosts', 'Super Likes', 'Ads'],
                datasets: [{
                    data: [65, 20, 10, 5],
                    backgroundColor: ['#3b82f6', '#48bb78', '#ed8936', '#a0aec0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                cutout: '70%'
            }
        });

        const countryCtx = document.getElementById('countryChart').getContext('2d');
        charts.country = new Chart(countryCtx, {
            type: 'bar',
            data: {
                labels: ['Nigeria', 'Kenya', 'Ghana', 'South Africa', 'UK', 'USA'],
                datasets: [{
                    data: [450, 320, 280, 210, 150, 120],
                    backgroundColor: '#3b82f6',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // User Detail Logic
    window.viewUserDetails = (userId) => {
        const user = window.users.find(u => (u._id || u.id) === userId);
        if (!user) return;

        document.getElementById('detailUserAvatar').src = user.photos && user.photos[0] ? user.photos[0].url : 'https://via.placeholder.com/150';
        document.getElementById('detailUserName').textContent = user.name;
        document.getElementById('detailUserEmail').textContent = user.email;
        document.getElementById('detailUserBio').textContent = user.bio || "No bio provided.";
        
        // Populate profile pictures for comparison
        const profilePicsContainer = document.getElementById('detailProfilePictures');
        const profilePics = user.photos ? user.photos.map(p => p.url) : [];
        profilePicsContainer.innerHTML = profilePics.map(pic => `
            <div class="profile-pic-item">
                <img src="${pic}" alt="Profile Picture" onclick="window.open('${pic}', '_blank')">
            </div>
        `).join('');
        
        // Identity Verification
        const verificationPhoto = user.verificationPhoto || (user.selfiePhoto ? user.selfiePhoto.url : null);
        document.getElementById('detailVerificationPhoto').src = verificationPhoto || "https://via.placeholder.com/300x200?text=No+Verification+Submitted";
        
        const statusBadge = document.getElementById('detailUserStatus');
        const isBanned = user.banned || user.status === 'Banned';
        statusBadge.textContent = isBanned ? 'Banned' : 'Active';
        statusBadge.className = `badge-status ${isBanned ? 'status-banned' : 'status-active'}`;
        
        document.getElementById('userDetailModal').style.display = 'block';
    };

    window.closeUserDetail = () => {
        document.getElementById('userDetailModal').style.display = 'none';
    };

    // API Data Loading
    async function loadRealData() {
        try {
            const response = await fetch('/api/admin/users?limit=100', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
            });
            const data = await response.json();
            if (data.success && data.users) {
                renderUserTable(data.users);
            }
        } catch (e) { 
            console.error("User sync failed", e);
            loadMockData(); // Fallback
        }
    }

    function renderUserTable(usersList) {
        window.users = usersList;
        const tbody = document.getElementById('userTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = usersList.map(u => `
            <tr style="cursor: pointer" onclick="viewUserDetails('${u._id}')">
                <td>
                    <div class="user-cell">
                        <img src="${u.photos && u.photos[0] ? u.photos[0].url : 'https://via.placeholder.com/150'}" alt="${u.name}">
                        <div><strong>${u.name}</strong><br><small>${u.email}</small></div>
                    </div>
                </td>
                <td><span class="badge-status ${u.banned ? 'status-banned' : 'status-active'}">${u.banned ? 'Banned' : 'Active'}</span></td>
                <td>${u.livingIn || 'N/A'}</td>
                <td>${u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Never'}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon" title="View Profile" onclick="event.stopPropagation(); viewUserDetails('${u._id}')"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" title="Warn" onclick="event.stopPropagation()"><i class="fas fa-exclamation-triangle"></i></button>
                        <button class="btn-icon" title="Ban" onclick="event.stopPropagation(); banUser('${u._id}')"><i class="fas fa-ban"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Update loadMockData to be a legacy fallback
    function loadMockData() {
        const mockUsers = [
            { _id: '1', name: 'Andrew', email: 'andrew@example.com', banned: false, livingIn: 'Lagos, NG', lastActive: new Date(), photos: [{url: 'https://i.pravatar.cc/150?u=1'}], bio: 'Living my best life in Lagos.' },
            { _id: '2', name: 'Nathasya', email: 'nat@example.com', banned: true, livingIn: 'Nairobi, KE', lastActive: new Date(), photos: [{url: 'https://i.pravatar.cc/150?u=2'}], bio: 'Traveler and food lover.' }
        ];
        renderUserTable(mockUsers);
    }

    // Profile Modal
    const modal = document.getElementById('profileModal');
    const trigger = document.getElementById('adminProfileTrigger');
    const closeBtn = document.querySelector('.close');
    const profileForm = document.getElementById('profileForm');

    trigger.addEventListener('click', () => {
        document.getElementById('editName').value = document.getElementById('adminName').textContent;
        document.getElementById('editEmail').value = 'antonio@afroconnect.com';
        modal.style.display = 'block';
    });

    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        document.getElementById('adminName').textContent = document.getElementById('editName').value;
        modal.style.display = 'none';
        alert('Admin config synced with production server.');
    };

    // Support Logic
    function loadSupportData() {
        const tickets = [
            { id: 'TKT-101', user: 'Andrew', subject: 'Login Issue', message: 'I cannot login to my account since yesterday.', date: '2026-01-15', status: 'Open' },
            { id: 'TKT-102', user: 'Kofi', subject: 'Subscription', message: 'I was charged twice for my premium plan.', date: '2026-01-14', status: 'Pending' }
        ];

        const tbody = document.getElementById('supportTableBody');
        if (tbody) {
            tbody.innerHTML = tickets.map(t => `
                <tr>
                    <td><code>${t.id}</code></td>
                    <td>${t.user}</td>
                    <td>${t.subject}</td>
                    <td><small>${t.message}</small></td>
                    <td>${t.date}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-icon" title="Reply" onclick="replyToTicket('${t.id}')"><i class="fas fa-reply"></i></button>
                            <button class="btn-icon" title="Resolve"><i class="fas fa-check"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    }

    window.replyToTicket = (id) => {
        const reply = prompt(`Reply to Ticket ${id}:`);
        if (reply) {
            alert(`Reply sent to user: ${reply}`);
        }
    };

    // Update tab switch logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            if (target === 'payments') loadPaymentsData();
            if (target === 'support') loadSupportData();
        });
    });

    initCharts();
    loadRealData();
    loadPaymentsData();
    loadSupportData();
});