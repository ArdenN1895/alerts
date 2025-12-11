document.addEventListener('DOMContentLoaded', () => {

  const togglePassword = () => {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('.toggle-password');
    
    if (toggleIcon && passwordInput) {
      toggleIcon.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        toggleIcon.classList.toggle('fa-eye');
        toggleIcon.classList.toggle('fa-eye-slash');
      });
    }
  };

  const initLogin = async () => {
    if (!window.supabase) {
      alert('Connection failed. Please refresh the page.');
      return;
    }

    togglePassword();

    const signinForm = document.getElementById('signinForm');
    if (!signinForm) return;

    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const usernameInput = document.getElementById('username')?.value.trim();
      const password = document.getElementById('password')?.value.trim();
      const submitBtn = signinForm.querySelector('button[type="submit"]');

      if (!usernameInput || !password) {
        alert('Please fill in all fields.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';

      try {
        if (usernameInput === 'admin' && password === 'admin123') {
          localStorage.setItem('currentUser', JSON.stringify({
            id: 'admin-001',
            email: 'admin@spcalert.ph',
            username: 'admin',
            first_name: 'System',
            last_name: 'Administrator',
            is_admin: true,
            role: 'Administrator'
          }));
          window.location.href = '/public/html/admin-dashboard.html';
          return;
        }

        let loginEmail = usernameInput;

        if (!usernameInput.includes('@')) {
          const { data, error } = await window.supabase
            .from('users')
            .select('email')
            .eq('username', usernameInput)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') throw error;
          if (!data) throw new Error('Username not found.');

          loginEmail = data.email;
        }

        const { data: authData, error: authError } = await window.supabase.auth.signInWithPassword({
          email: loginEmail,
          password
        });

        if (authError) throw authError;
        if (!authData?.user) throw new Error('Login failed.');

        await window.supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', authData.user.id);

        const { data: profile, error: profileError } = await window.supabase
          .from('users')
          .select('username, first_name, last_name, role, is_admin')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          console.warn('Could not load profile:', profileError);
        }

        localStorage.setItem('currentUser', JSON.stringify({
          id: authData.user.id,
          email: authData.user.email,
          username: profile?.username || authData.user.email.split('@')[0],
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          role: profile?.role || 'User',
          is_admin: !!profile?.is_admin
        }));

        if (profile?.is_admin === true) {
          window.location.href = '/public/html/admin-dashboard.html';
        } else {
          window.location.href = '/public/html/index.html';
        }

      } catch (err) {
        console.error('Login Error:', err);
        const msg = err.message || 'Login failed.';
        if (msg.includes('Invalid login credentials')) {
          alert('Incorrect username/email or password.');
        } else if (msg.includes('Email not confirmed')) {
          alert('Please confirm your email first.');
        } else {
          alert(msg);
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
      }
    });
  };

  if (window.supabase) {
    initLogin();
  } else {
    window.addEventListener('supabase-ready', initLogin);
    setTimeout(initLogin, 8000);
  }
});
