
function waitForSupabase() {
  return new Promise(resolve => {
    if (window.supabase) return resolve(window.supabase);
    window.addEventListener('supabase-ready', () => resolve(window.supabase), { once: true });
    
    const check = setInterval(() => {
      if (window.supabase) {
        clearInterval(check);
        resolve(window.supabase);
      }
    }, 100);
    
    setTimeout(() => {
      clearInterval(check);
      resolve(null);
    }, 10000);
  });
}

/**
 * Checks authentication and redirects if not logged in
 */
async function checkAuthAndRedirect() {
  const supabase = await waitForSupabase();
  
  if (!supabase) {
    alert('Failed to connect to database. Please refresh the page.');
    location.href = 'login.html';
    return null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const fakeAdmin = JSON.parse(localStorage.getItem('currentUser') || 'null');

    if (session?.user) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user:', error);
        throw error;
      }

      if (!data) {
        alert('Profile not found. Please complete registration.');
        location.href = 'signup.html';
        return null;
      }

      return data;
    } else if (fakeAdmin?.is_admin) {
      return {
        id: fakeAdmin.id || 'admin-001',
        first_name: fakeAdmin.first_name || 'System',
        last_name: fakeAdmin.last_name || 'Administrator',
        email: fakeAdmin.email || 'admin@spcalert.ph',
        phone: fakeAdmin.phone || '',
        address: fakeAdmin.address || '',
        role: 'admin',
        is_admin: true,
        emergency_contact: fakeAdmin.emergency_contact || null
      };
    } else {
      alert('You must be logged in to view this page.');
      location.href = 'login.html';
      return null;
    }
  } catch (err) {
    console.error('Authentication error:', err);
    alert('Session error. Redirecting to login.');
    location.href = 'login.html';
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  const userData = await checkAuthAndRedirect();
  if (!userData) return; // Stop execution if not authenticated

  // PWA Install Button Logic
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
      installBtn.style.display = 'flex';
      
      installBtn.addEventListener('click', () => {
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
        
        deferredPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            console.log('User installed the app');
          }
          deferredPrompt = null;
        });
      });
    }
  });

  // Burger menu
  const burgerBtn = document.getElementById("burgerBtn");
  const mainNav = document.getElementById("mainNav");

  if (burgerBtn && mainNav) {
    burgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      mainNav.classList.toggle("show");
      burgerBtn.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!mainNav.contains(e.target) && !burgerBtn.contains(e.target)) {
        mainNav.classList.remove("show");
        burgerBtn.classList.remove("active");
      }
    });
  }
});
