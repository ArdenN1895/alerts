import '../javascript/supabase.js';

let supabaseClient = null;

function waitForSupabase() {
  return new Promise(resolve => {
    if (window.supabase) return resolve(window.supabase);
    window.addEventListener('supabase-ready', () => resolve(window.supabase), { once: true });
    // Fallback
    const check = setInterval(() => {
      if (window.supabase) {
        clearInterval(check);
        resolve(window.supabase);
      }
    }, 100);
    setTimeout(() => resolve(null), 10000);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  supabaseClient = await waitForSupabase();
  if (!supabaseClient) {
    alert('Failed to connect to database');
    return;
  }

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fakeAdmin = JSON.parse(localStorage.getItem('currentUser') || 'null');

      if (session?.user) {
        await loadUserFromSupabase(session.user.id);
      } else if (fakeAdmin?.is_admin) {
        loadFakeAdmin(fakeAdmin);
      } else {
        alert('You must be logged in to view this page.');
        location.href = 'login.html';
      }
    } catch (err) {
      console.error(err);
      alert('Session error. Redirecting to login.');
      location.href = 'login.html';
    }
  };

  // Call checkAuth and wait for it
  await checkAuth();

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
