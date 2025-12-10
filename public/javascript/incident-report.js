
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
  const form = document.getElementById('incidentForm');
  const statusMessage = document.getElementById('statusMessage');
  const locationInput = document.getElementById('locationInput');
  const getLocationBtn = document.getElementById('getLocationBtn');
  const photoInput = document.getElementById('incidentPhoto');
  const previewImg = document.getElementById('previewImg');
  const photoPreview = document.getElementById('photoPreview');
  const removePhotoBtn = document.getElementById('removePhoto');

  let currentPosition = null;
  let photoFile = null;

  const supabase = await waitForSupabase();
  if (!supabase) {
    showStatus('Connection failed.', 'error');
    return;
  }

  // Check authentication
  const userData = await checkAuthAndRedirect();
  if (!userData) return; // Stop execution if not authenticated

  // Photo handling
  photoInput.addEventListener('change', () => {
    photoFile = photoInput.files[0];
    if (photoFile) {
      const reader = new FileReader();
      reader.onload = e => {
        previewImg.src = e.target.result;
        photoPreview.style.display = 'block';
      };
      reader.readAsDataURL(photoFile);
    }
  });

  removePhotoBtn.onclick = () => {
    photoFile = null; 
    photoInput.value = ''; 
    photoPreview.style.display = 'none';
  };

  // Location handling
  getLocationBtn.onclick = () => {
    getLocationBtn.disabled = true;
    getLocationBtn.textContent = 'Getting location...';
    locationInput.value = 'Detecting...';

    navigator.geolocation.getCurrentPosition(
      pos => {
        currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        locationInput.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        getLocationBtn.textContent = '✓ Location Captured';
        getLocationBtn.style.background = '#4caf50';
      },
      () => {
        locationInput.value = '';
        locationInput.removeAttribute('readonly');
        locationInput.placeholder = 'Type location manually';
        getLocationBtn.disabled = false;
        getLocationBtn.textContent = 'Use My Current Location';
        showStatus('Could not get location. Please enter manually.', 'warning');
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  // ==================== FORM SUBMISSION ====================
  form.onsubmit = async e => {
    e.preventDefault();
    
    const incidentType = document.getElementById('type').value;
    const description = document.getElementById('description').value.trim();

    // Validation
    if (!incidentType || !description) {
      return showStatus('Please fill in all required fields', 'error');
    }

    if (!currentPosition && !locationInput.value.trim()) {
      return showStatus('Please provide a location', 'error');
    }

    // Disable submit button to prevent double submission
    const submitBtn = form.querySelector('.submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    showStatus('Uploading incident report...', 'loading');

    try {
      let photoUrl = null;

      // ==================== UPLOAD PHOTO ====================
      if (photoFile) {
        showStatus('Uploading photo...', 'loading');
        
        const ext = photoFile.name.split('.').pop();
        const filename = `${userData.id}/${Date.now()}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('incident-photos')
          .upload(filename, photoFile, { upsert: true });

        if (uploadError && !uploadError.message.includes('duplicate')) {
          console.error('Photo upload error:', uploadError);
          showStatus('Warning: Photo upload failed, continuing without photo', 'warning');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('incident-photos')
            .getPublicUrl(filename);
          
          photoUrl = publicUrl;
          console.log('✅ Photo uploaded:', photoUrl);
        }
      }

      // ==================== SAVE TO DATABASE ====================
      showStatus('Saving incident report...', 'loading');

      const incidentData = {
        type: incidentType,
        description: description,
        location: currentPosition || { manual: locationInput.value.trim() },
        photo_url: photoUrl,
        reported_by: userData.id
      };

      const { data: insertedIncident, error: dbError } = await supabase
        .from('incidents')
        .insert(incidentData)
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ Incident saved to database:', insertedIncident.id);

      // ==================== SEND PUSH NOTIFICATIONS ====================
      showStatus('Notifying users...', 'loading');

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          console.warn('⚠️ Session error, push may fail:', sessionError);
        }

        // Format location for notification
        let locationText = 'San Pablo City';
        if (currentPosition) {
          locationText = `${currentPosition.lat.toFixed(4)}, ${currentPosition.lng.toFixed(4)}`;
        } else if (locationInput.value.trim()) {
          locationText = locationInput.value.trim().substring(0, 30);
        }

        // Prepare notification payload
        const notificationPayload = {
          title: '🚨 New Incident Reported',
          body: `${incidentType} reported in ${locationText}. ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`,
          icon: '/public/img/icon-192.png',
          badge: '/public/img/badge-72.png',
          image: photoUrl || undefined,
          url: '/public/html/map.html',
          data: {
            incidentId: insertedIncident.id,
            incidentType: incidentType,
            timestamp: Date.now()
          }
        };

        console.log('📤 Sending push notification...', notificationPayload);

        const pushResponse = await fetch('https://oqmfjwlpuwfpbnpiavhp.supabase.co/functions/v1/send-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xbWZqd2xwdXdmcGJucGlhdmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTgxNzYsImV4cCI6MjA3OTQ3NDE3Nn0.yywiH3q3g1Rbyypt5mxvhRgDXZrSFENZn5s1EWVp8Z8'
          },
          body: JSON.stringify(notificationPayload)
        });

        const pushResult = await pushResponse.json();
        console.log('📊 Push notification result:', pushResult);

        if (pushResponse.ok) {
          if (pushResult.delivered_to > 0) {
            console.log(`✅ Push notifications sent to ${pushResult.delivered_to} user(s)`);
          } else {
            console.warn('⚠️ No users subscribed to push notifications');
          }
        } else {
          console.error('❌ Push notification failed:', pushResult.error);
        }

      } catch (pushError) {
        console.error('⚠️ Push notification error (non-critical):', pushError);
      }

      // ==================== SUCCESS ====================
      showStatus('✅ Report submitted successfully! Thank you for helping keep San Pablo City safe.', 'success');

      // Reset form after 2 seconds
      setTimeout(() => {
        form.reset();
        photoPreview.style.display = 'none';
        currentPosition = null;
        photoFile = null;
        locationInput.setAttribute('readonly', 'readonly');
        getLocationBtn.style.background = '';
        getLocationBtn.textContent = 'Use My Current Location';
        getLocationBtn.disabled = false;
        
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
      }, 2000);

    } catch (err) {
      console.error('❌ Submission error:', err);
      showStatus('Error: ' + (err.message || 'Failed to submit report. Please try again.'), 'error');
      
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  };

  // ==================== STATUS MESSAGE ====================
  function showStatus(msg, type = 'info') {
    statusMessage.textContent = msg;
    statusMessage.className = 'status-message ' + type;
    statusMessage.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 5000);
    }
  }

  // Auto-get location on page load
  setTimeout(() => {
    if (getLocationBtn && !getLocationBtn.disabled) {
      getLocationBtn.click();
    }
  }, 1000);
});
