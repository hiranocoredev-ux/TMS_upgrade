/**
 * Helper script to create users via API
 * Run this in browser console (F12) while logged in as SUPER_ADMIN
 * 
 * Usage:
 *   createUser('user@example.com', 'User Name', 'MEMBER', 'active')
 */

async function createUser(email, name, role = 'MEMBER', status = 'active', editor = false) {
  const token = localStorage.getItem('token');

  if (!token) {
    console.error('❌ Not logged in. Please log in first.');
    return;
  }

  try {
    const response = await fetch('http://localhost:3003/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        name,
        role, // 'SUPER_ADMIN', 'BOSS', or 'MEMBER'
        editor,
        status // 'active', 'pending', or 'disabled'
      })
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ User created successfully!');
      console.log('📧 Email:', data.data.user.email);
      console.log('👤 Name:', data.data.user.name);
      console.log('🎭 Role:', data.data.user.role);
      console.log('📝 Status:', data.data.user.status);
      console.log('🔑 TEMPORARY PASSWORD:', data.data.tempPassword);
      console.log('\n⚠️  IMPORTANT: Save this password! User needs it to login.');
      return data;
    } else {
      console.error('❌ Error creating user:', data.message);
      return data;
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
    throw error;
  }
}

// Example usage:
// createUser('member@example.com', 'John Member', 'MEMBER', 'active')
// createUser('boss@example.com', 'Jane Boss', 'BOSS', 'active', true)

