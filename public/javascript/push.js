const VAPID_PUBLIC_KEY = "BA1RcIbho_qDHz-TEjBmAAG73hbLnI0ACtV_U0kZdT9z_Bnnx_FEEFH1ZsCb_I-IIRWIF3PClSoKe4DUKq5bPQQ";

// Prevent duplicate execution
let pushInitialized = false;
let permissionCheckInterval = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// Request notification permission using browser's native prompt
async function requestNotificationPermission() {
  try {
    console.log("🔔 Requesting notification permission...");
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      console.log("✅ Notification permission granted");
      // Clear the interval checker
      if (permissionCheckInterval) {
        clearInterval(permissionCheckInterval);
        permissionCheckInterval = null;
      }
      // Proceed with subscription
      await subscribeUser();
    } else if (permission === "denied") {
      console.warn("🚫 Notification permission denied - will ask again in 10 seconds");
      // Ask again after 10 seconds even if denied
      setTimeout(checkNotificationPermission, 10000);
    } else {
      console.log("⏸️ Notification permission dismissed - will ask again in 10 seconds");
      // Ask again after 10 seconds if dismissed
      setTimeout(checkNotificationPermission, 10000);
    }
  } catch (err) {
    console.error("❌ Error requesting notification permission:", err);
    // Retry on error after 10 seconds
    setTimeout(checkNotificationPermission, 10000);
  }
}

// Check notification permission status
async function checkNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("🚫 Notifications not supported");
    return;
  }

  const permission = Notification.permission;
  console.log("🔔 Current notification permission:", permission);

  if (permission === "default") {
    // Not asked yet - request permission
    await requestNotificationPermission();
  } else if (permission === "denied") {
    // Permission denied - keep asking every 10 seconds
    console.log("⏰ Permission denied, will ask again in 10 seconds");
    setTimeout(checkNotificationPermission, 10000);
  } else if (permission === "granted") {
    // Permission granted - proceed with subscription
    if (!pushInitialized) {
      await subscribeUser();
    }
  }
}

// Start periodic permission checker (checks every 10 seconds)
function startPermissionChecker() {
  // Clear any existing interval
  if (permissionCheckInterval) {
    clearInterval(permissionCheckInterval);
  }

  // Check immediately
  checkNotificationPermission();

  // Then check every 10 seconds if not granted
  permissionCheckInterval = setInterval(() => {
    if (Notification.permission !== "granted") {
      console.log("🔄 Checking notification permission status...");
      checkNotificationPermission();
    } else {
      // Permission granted, clear interval
      console.log("✅ Permission granted, stopping permission checker");
      clearInterval(permissionCheckInterval);
      permissionCheckInterval = null;
    }
  }, 10000); // 10 seconds
}

async function subscribeUser() {
  if (pushInitialized) return;
  pushInitialized = true;

  console.log("🔔 Initializing push subscription...");

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("🚫 Push not supported on this browser");
    return;
  }

  try {
    console.log("⏳ Waiting for service worker...");
    const reg = await navigator.serviceWorker.ready;
    console.log("✅ Service worker ready:", reg.active?.scriptURL);

    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) {
      console.warn("🚫 No logged-in user — push not initialized");
      return;
    }

    console.log("👤 Logged in as:", user.email);

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      console.log("📝 Subscribing user...");
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    console.log("📍 Subscription endpoint:", sub.endpoint);

    const subscriptionObject = {
      endpoint: sub.endpoint,
      expirationTime: sub.expirationTime,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")))),
        auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth"))))
      }
    };

    console.log("💾 Saving subscription...");
    const { error } = await window.supabase
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        subscription: subscriptionObject
      }, {
        onConflict: "user_id"
      });

    if (error) throw error;

    console.log("🎉 Subscription saved successfully!");

  } catch (err) {
    console.error("❌ Push subscription failed:", err);
  }
}

// Initialize when Supabase is ready
window.addEventListener("supabase-ready", () => {
  console.log("🚀 Supabase ready — starting push setup");
  setTimeout(() => {
    startPermissionChecker();
  }, 2000); // Wait 2 seconds after login before asking
});

// Expose for debugging
window.debugPushSubscription = subscribeUser;
window.checkNotificationPermission = checkNotificationPermission;

export { subscribeUser as initPushNotifications, checkNotificationPermission };
