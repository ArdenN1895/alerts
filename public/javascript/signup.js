document.addEventListener('DOMContentLoaded', () => {
  const initSignup = async () => {
    if (!window.supabase) {
      alert('Connection failed. Please refresh the page.');
      return;
    }
    const form = document.getElementById('signupForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
      
      try {
        const username     = document.getElementById('username').value.trim();
        const email        = document.getElementById('email').value.trim().toLowerCase();
        const password     = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const firstName    = document.getElementById('firstName').value.trim();
        const lastName     = document.getElementById('lastName').value.trim();
        let phone          = document.getElementById('phone').value.trim();
        const address      = document.getElementById('address').value.trim();
        
        // ===== ENHANCED VALIDATION =====
        
        // Password validation
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match!");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        
        // Username validation
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
          throw new Error("Username: letters, numbers, underscore only (3–30 chars)");
        }
        
        // Name validation
        if (!firstName || !lastName) {
          throw new Error("First and last name required");
        }
        
        // ===== PHONE NUMBER VALIDATION (FIXED) =====
        if (!phone) {
          throw new Error("Phone number is required");
        }
        
        // Remove all non-digit characters for validation
        const digitsOnly = phone.replace(/\D/g, '');
        
        // Check if it's a valid Philippine mobile number
        if (digitsOnly.startsWith('09') && digitsOnly.length === 11) {
          // Valid 09XX format (11 digits)
          phone = '+63' + digitsOnly.slice(1); // Convert to +63 format
        } else if (digitsOnly.startsWith('639') && digitsOnly.length === 12) {
          // Already in 639 format
          phone = '+' + digitsOnly;
        } else if (digitsOnly.startsWith('63') && digitsOnly.length === 12) {
          // 63 format without +
          phone = '+' + digitsOnly;
        } else if (digitsOnly.length === 10 && digitsOnly.startsWith('9')) {
          // 9XX format (missing leading 0)
          phone = '+63' + digitsOnly;
        } else {
          throw new Error("Invalid phone number. Use format: 09XXXXXXXXX (11 digits)");
        }
        
        console.log('✅ Phone validated and formatted:', phone);
        
        // Address validation
        if (!address || address.length < 5) {
          throw new Error("Complete address is required (minimum 5 characters)");
        }
        
        // ===== SUPABASE SIGNUP =====
        
        // Step 1: Create auth user
        const { data, error: authError } = await window.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              username: username
            }
          }
        });
        
        if (authError) throw authError;
        if (!data.user) throw new Error("Signup failed – no user returned");
        
        console.log("✅ Auth user created:", data.user.id);
        
        // Step 2: UPSERT user profile with formatted phone
        const { error: profileError } = await window.supabase
          .from('users')
          .upsert({
            id              : data.user.id,
            username        : username,
            email           : email,
            first_name      : firstName,
            last_name       : lastName,
            phone           : phone,  // Now properly formatted as +63XXXXXXXXXX
            address         : address,             
            emergency_contact: null,           
            role            : 'user',         
            is_admin        : false,
            created_at      : new Date().toISOString()
          }, {
            onConflict: 'id'
          });
        
        if (profileError) {
          console.error("Profile creation error:", profileError);
          throw new Error("Failed to save profile: " + profileError.message);
        }
        
        console.log("✅ User profile saved to database");
        
        // SUCCESS - Show proper success message
        alert("Account created successfully! Please proceed to login.");
        window.location.href = '/public/html/login.html';
        
      } catch (error) {
        console.error("Signup error:", error);
        
        // Show the actual error message, not "Account Created!"
        const errorMessage = error.message || "An unknown error occurred";
        alert("Error: " + errorMessage);
        
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
      }
    });
  };
  
  // Initialize when Supabase is ready
  if (window.supabase) {
    initSignup();
  } else {
    window.addEventListener('supabase-ready', initSignup);
    setTimeout(initSignup, 8000);
  }
});
