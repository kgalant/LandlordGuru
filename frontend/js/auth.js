// ============================================================
//  AUTH — JWT token initialization and check
// ============================================================

const AUTH_STORAGE_KEY = 'landlordguru_token';

// Decode JWT payload (without verification — done server-side)
export function decodeToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}

// Check if token is expired
function isTokenExpired(token) {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

// Get token from localStorage or query params
export function getToken() {
  // Check query params for token from OAuth callback
  const params = new URLSearchParams(window.location.search);
  if (params.has('token')) {
    const token = params.get('token');
    if (!isTokenExpired(token)) {
      localStorage.setItem(AUTH_STORAGE_KEY, token);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return token;
    }
  }

  // Check localStorage
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored && !isTokenExpired(stored)) {
    return stored;
  }

  return null;
}

// Check auth error from query params
function checkAuthError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('auth_error');
  if (error) {
    const errorMessages = {
      'oauth_failed': 'Google sign-in failed. Please try again.',
      'no_workspace_assigned': 'Your account has not been assigned to a workspace. Please contact your administrator.',
      'no_workspace_access': 'You do not have access to any workspace. Please contact your administrator.',
      'server_error': 'An error occurred during sign-in. Please try again.',
    };
    alert(errorMessages[error] || 'An authentication error occurred.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Initialize auth state
function initAuth() {
  checkAuthError();
  const token = getToken();

  if (token) {
    // Authenticated — show app, hide login
    document.getElementById('app').style.display = '';
    document.getElementById('login-screen').style.display = 'none';
    window.AUTH_TOKEN = token;
    initUserAvatar();
  } else {
    // Not authenticated — hide app, show login
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    window.AUTH_TOKEN = null;
  }
}

// Logout function
export async function logout() {
  try {
    const response = await fetch('/auth/logout');
    if (response.ok) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.AUTH_TOKEN = null;
      window.location.reload();
    }
  } catch (e) {
    console.error('Logout failed:', e);
  }
}

// User menu functions
function initUserAvatar() {
  const token = window.AUTH_TOKEN;
  if (!token) return;

  const payload = decodeToken(token);
  if (!payload || !payload.name) return;

  // Extract initials from name (first letter of given name + first letter of family name)
  const parts = payload.name.trim().split(/\s+/);
  let initials = '';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0].substring(0, 2).toUpperCase();
  }

  const avatarBtn = document.getElementById('user-avatar');
  if (avatarBtn) {
    avatarBtn.textContent = initials || '?';
  }
}

export function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) {
    menu.classList.toggle('open');
  }
}

export function closeUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) {
    menu.classList.remove('open');
  }
}

// Close user menu when clicking outside
document.addEventListener('click', function(event) {
  const avatar = document.getElementById('user-avatar');
  const menu = document.getElementById('user-menu');
  if (avatar && menu && !avatar.contains(event.target) && !menu.contains(event.target)) {
    menu.classList.remove('open');
  }
});

// Run on page load
initAuth();

// Expose to inline HTML handlers
Object.assign(window, { logout, toggleUserMenu, closeUserMenu });
