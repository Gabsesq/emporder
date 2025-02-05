document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication on page load
    try {
        const response = await fetch('/api/admin/check-auth');
        if (!response.ok) {
            window.location.href = '/admin.html';
            return;
        }
    } catch (err) {
        window.location.href = '/admin.html';
        return;
    }

    // Handle logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.href = '/admin.html';
        } catch (err) {
            console.error('Logout failed:', err);
        }
    });
}); 