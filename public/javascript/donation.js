// PWA Install Button Logic
document.addEventListener('DOMContentLoaded', async () => {
  
  // Check authentication first
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
        return; // Stop execution
      }
    } catch (err) {
      console.error(err);
      alert('Session error. Redirecting to login.');
      location.href = 'login.html';
      return; // Stop execution
    }
  };

await checkAuth();

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

const burgerBtn = document.getElementById("burgerBtn");
const mainNav = document.getElementById("mainNav");

burgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mainNav.classList.toggle("show");
    burgerBtn.classList.toggle("active"); // animate
});

// Close menu on outside click
document.addEventListener("click", (e) => {
    if (!mainNav.contains(e.target) && !burgerBtn.contains(e.target)) {
        mainNav.classList.remove("show");
        burgerBtn.classList.remove("active"); // reset animation
    }
});
