import './supabase.js';

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

// Authentication Check
document.addEventListener('DOMContentLoaded', async () => {
  supabaseClient = await waitForSupabase();
  if (!supabaseClient) {
    alert('Failed to connect to database');
    return;
  }

  // Check if user is authenticated
  try {
    const { data: { session } } = await window.supabase.auth.getSession();
    const fakeAdmin = JSON.parse(localStorage.getItem('currentUser') || 'null');

    // If no Supabase session and no fake admin, redirect to login
    if (!session?.user && !fakeAdmin?.is_admin) {
      alert('You must be logged in to access this page.');
      location.href = 'login.html';
      return;
    }

    console.log('✅ User authenticated, access granted to donation page');
  } catch (err) {
    console.error('Authentication error:', err);
    alert('Session error. Redirecting to login.');
    location.href = 'login.html';
  }
});

// PWA Install Button 
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show the install button
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

// Burger Menu Logic
const burgerBtn = document.getElementById("burgerBtn");
const mainNav = document.getElementById("mainNav");

if (burgerBtn && mainNav) {
    burgerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mainNav.classList.toggle("show");
        burgerBtn.classList.toggle("active");
    });

    // Close menu on outside click
    document.addEventListener("click", (e) => {
        if (!mainNav.contains(e.target) && !burgerBtn.contains(e.target)) {
            mainNav.classList.remove("show");
            burgerBtn.classList.remove("active");
        }
    });
}
