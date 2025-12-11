// javascript/incident-report.js - WITH ENHANCED AUTHENTICATION CHECK
import './supabase.js';

let supabaseClient = null;

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
    setTimeout(() => resolve(null), 10000);
  });
}

// Authentication Check
async function checkAuthentication() {
  supabaseClient = await waitForSupabase();
  if (!supabaseClient) {
    alert('Failed to connect to database');
    location.href = 'login.html';
    return false;
  }

  try {
    const { data: { session } } = await window.supabase.auth.getSession();
    const fakeAdmin = JSON.parse(localStorage.getItem('currentUser') || 'null');

    if (!session?.user && !fakeAdmin?.is_admin) {
      alert('You must be logged in to access this page.');
      location.href = 'login.html';
      return false;
    }

    console.log('✅ User authenticated, access granted to incident report page');
    return session?.user || fakeAdmin;
  } catch (err) {
    console.error('Authentication error:', err);
    alert('Session error. Redirecting to login.');
    location.href = 'login.html';
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  const currentUser = await checkAuthentication();
  if (!currentUser) return;

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

  // Form submission
  form.onsubmit = async e => {
    e.preventDefault();
    
    const incidentType = document.getElementById('type').value;
    const description = document.getElementById('description').value.trim();

    if (!incidentType || !description) {
      return showStatus('Please fill in all required fields', 'error');
    }

    if (!currentPosition && !locationInput.value.trim()) {
      return showStatus('Please provide a location', 'error');
    }

    const submitBtn = form.querySelector('.submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    showStatus('Uploading incident report...', 'loading');

    try {
      // Get user from Supabase
      const { data: { user } } = await window.supabase.auth.getUser();
      const userId = user?.id || currentUser.id || 'anonymous';

      let photoUrl = null;

      // Upload photo
      if (photoFile) {
        showStatus('Uploading photo...', 'loading');
        
        const ext = photoFile.name.split('.').pop();
        const filename = `${userId}/${Date.now()}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await window.supabase.storage
          .from('incident-photos')
          .upload(filename, photoFile, { upsert: true });

        if (uploadError && !uploadError.message.includes('duplicate')) {
          console.error('Photo upload error:', uploadError);
          showStatus('Warning: Photo upload failed, continuing without photo', 'warning');
        } else {
          const { data: { publicUrl } } = window.supabase.storage
            .from('incident-photos')
            .getPublicUrl(filename);
          
          photoUrl = publicUrl;
          console.log('✅ Photo uploaded:', photoUrl);
        }
      }

      // Save to database
      showStatus('Saving incident report...', 'loading');

      const incidentData = {
        type: incidentType,
        description: description,
        location: currentPosition || { manual: locationInput.value.trim() },
        photo_url: photoUrl,
        reported_by: userId
      };

      const { data: insertedIncident, error: dbError } = await window.supabase
        .from('incidents')
        .insert(incidentData)
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ Incident saved to database:', insertedIncident.id);

      // Send push notifications
      showStatus('Notifying users...', 'loading');

      try {
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          console.warn('⚠️ Session error, push may fail:', sessionError);
        }

        let locationText = 'San Pablo City';
        if (currentPosition) {
          locationText = `${currentPosition.lat.toFixed(4)}, ${currentPosition.lng.toFixed(4)}`;
        } else if (locationInput.value.trim()) {
          locationText = locationInput.value.trim().substring(0, 30);
        }

        const notificationPayload = {
          title: '🚨 New Incident Reported',
          body: `${incidentType} reported in ${locationText}. ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`,
          icon: '/public/img/icon-192.png',
          badge: '/public/img/badge-72.png',
          image: photoUrl || undefined,
          url: '/public/html/index.html',
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
        console.log('📮 Push notification result:', pushResult);

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

      // Success
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

  // Status message helper
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
