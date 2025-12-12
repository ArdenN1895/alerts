// notification-prompt.js - Shows notification permission prompt after login

let promptShown = false;

async function showNotificationPrompt() {
  // Prevent duplicate prompts
  if (promptShown) return;
  
  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.log('Notifications not supported in this browser');
    return;
  }

  // Check current permission status
  const permission = Notification.permission;
  
  // Only show prompt if permission hasn't been decided yet
  if (permission === 'default') {
    promptShown = true;
    showCustomPrompt();
  } else if (permission === 'granted') {
    console.log('✅ Notifications already enabled');
  } else if (permission === 'denied') {
    console.log('🚫 Notifications were denied by user');
  }
}

function showCustomPrompt() {
  const promptHTML = `
    <div class="notification-prompt-overlay" id="notificationPrompt">
      <div class="notification-prompt-container">
        <div class="notification-prompt-icon">
          <i class="fas fa-bell"></i>
        </div>
        <h3>Stay Updated with Alerts</h3>
        <p>Enable notifications to receive real-time emergency alerts, incident updates, and important safety information from SPC Alerts.</p>
        
        <div class="notification-prompt-benefits">
          <div class="benefit-item">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Emergency alerts</span>
          </div>
          <div class="benefit-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>Nearby incidents</span>
          </div>
          <div class="benefit-item">
            <i class="fas fa-bullhorn"></i>
            <span>Safety updates</span>
          </div>
        </div>

        <div class="notification-prompt-actions">
          <button class="btn-enable-notifications" id="enableNotifications">
            <i class="fas fa-check"></i> Enable Notifications
          </button>
          <button class="btn-skip-notifications" id="skipNotifications">
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  `;

  // Add to body
  document.body.insertAdjacentHTML('beforeend', promptHTML);

  // Add styles
  addPromptStyles();

  // Add event listeners
  const prompt = document.getElementById('notificationPrompt');
  const enableBtn = document.getElementById('enableNotifications');
  const skipBtn = document.getElementById('skipNotifications');

  enableBtn.addEventListener('click', async () => {
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        showSuccessMessage();
        setTimeout(() => closePrompt(prompt), 2000);
        
        // Trigger push subscription if available
        if (window.initPushNotifications) {
          window.initPushNotifications();
        }
      } else {
        showDeniedMessage();
        setTimeout(() => closePrompt(prompt), 2000);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      closePrompt(prompt);
    }
  });

  skipBtn.addEventListener('click', () => {
    closePrompt(prompt);
  });

  // Animate in
  setTimeout(() => prompt.classList.add('active'), 100);
}

function showSuccessMessage() {
  const container = document.querySelector('.notification-prompt-container');
  container.innerHTML = `
    <div class="notification-prompt-icon success">
      <i class="fas fa-check-circle"></i>
    </div>
    <h3>Notifications Enabled!</h3>
    <p>You'll now receive important alerts and updates.</p>
  `;
}

function showDeniedMessage() {
  const container = document.querySelector('.notification-prompt-container');
  container.innerHTML = `
    <div class="notification-prompt-icon denied">
      <i class="fas fa-times-circle"></i>
    </div>
    <h3>Notifications Blocked</h3>
    <p>You can enable them later in your browser settings.</p>
  `;
}

function closePrompt(prompt) {
  prompt.classList.remove('active');
  setTimeout(() => prompt.remove(), 300);
}

function addPromptStyles() {
  if (document.getElementById('notification-prompt-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'notification-prompt-styles';
  styles.textContent = `
    .notification-prompt-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
      padding: 20px;
    }

    .notification-prompt-overlay.active {
      opacity: 1;
    }

    .notification-prompt-container {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      transform: scale(0.9);
      transition: transform 0.3s ease;
      text-align: center;
    }

    .notification-prompt-overlay.active .notification-prompt-container {
      transform: scale(1);
    }

    .notification-prompt-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 36px;
      color: white;
    }

    .notification-prompt-icon.success {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }

    .notification-prompt-icon.denied {
      background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
    }

    .notification-prompt-container h3 {
      font-size: 24px;
      color: #2c3e50;
      margin: 0 0 12px;
      font-weight: 600;
    }

    .notification-prompt-container p {
      color: #7f8c8d;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 24px;
    }

    .notification-prompt-benefits {
      display: flex;
      gap: 16px;
      margin-bottom: 32px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .benefit-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #f8f9fa;
      border-radius: 20px;
      font-size: 14px;
      color: #495057;
    }

    .benefit-item i {
      color: #667eea;
      font-size: 16px;
    }

    .notification-prompt-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn-enable-notifications,
    .btn-skip-notifications {
      width: 100%;
      padding: 14px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-enable-notifications {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-enable-notifications:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-skip-notifications {
      background: #f8f9fa;
      color: #6c757d;
    }

    .btn-skip-notifications:hover {
      background: #e9ecef;
    }

    @media (max-width: 480px) {
      .notification-prompt-container {
        padding: 24px;
      }

      .notification-prompt-icon {
        width: 64px;
        height: 64px;
        font-size: 28px;
      }

      .notification-prompt-container h3 {
        font-size: 20px;
      }

      .notification-prompt-benefits {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `;

  document.head.appendChild(styles);
}

// Initialize after login and Supabase is ready
function initNotificationPrompt() {
  // Wait for authentication to complete
  window.addEventListener('supabase-ready', () => {
    // Delay prompt by 2 seconds after login to avoid overwhelming user
    setTimeout(async () => {
      // Only show if user is authenticated
      if (window.supabase) {
        const { data: { session } } = await window.supabase.auth.getSession();
        const fakeAdmin = JSON.parse(localStorage.getItem('currentUser') || 'null');
        
        if (session?.user || fakeAdmin?.is_admin) {
          showNotificationPrompt();
        }
      }
    }, 2000);
  });
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationPrompt);
} else {
  initNotificationPrompt();
}

export { showNotificationPrompt, initNotificationPrompt };
