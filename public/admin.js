document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const loginForm = document.getElementById('loginForm');

    // Check if already authenticated
    async function checkAuthentication() {
        try {
            const response = await fetch('/api/admin/check-auth');
            if (response.ok) {
                window.location.href = '/admin-dashboard.html';
            }
        } catch (err) {
            console.error('Auth check failed:', err);
        }
    }

    // Run auth check on page load
    checkAuthentication();

    // Handle login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Invalid password');
            }

            const data = await response.json();
            if (data.success) {
                localStorage.setItem('isAdminAuthenticated', 'true');
                window.location.href = '/admin-dashboard.html';
            }
        } catch (err) {
            console.error('Login error:', err);
            alert(err.message || 'Login failed');
        }
    });
}); 