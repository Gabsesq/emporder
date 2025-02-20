async function checkAdminAuth() {
    try {
        const response = await fetch('/api/admin/check-auth');
        if (!response.ok) {
            window.location.href = '/admin.html';
            throw new Error('Unauthorized access');
        }
    } catch (err) {
        window.location.href = '/admin.html';
        throw new Error('Unauthorized access');
    }
}