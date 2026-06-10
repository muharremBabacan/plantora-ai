// ==========================================================================
// PLANTORA AI STATE ENGINE (MVP) - History & Details Updates
// ==========================================================================

interface OptimizedImage {
  thumbnail: string;
  full: string;
}

interface AnalysisReport {
  id: string;
  date: string;       // e.g. "10 Haziran"
  sağlık: number;     // 0-100
  sorun: string;      // detected status
  yorum: string;      // AI commentary
  öneri: string;      // recommended action
  image?: string;     // historical photo URL
  images?: OptimizedImage[];
}

interface Plant {
  id: string;
  nickname: string;
  bitki: string;      // species name
  image: string;
  images?: OptimizedImage[];
  addedDate: string;  // e.g. "10 Haziran"
  needsWater: boolean;
  waterFrequencyDays: number;
  lastWateredDaysAgo: number;
  sağlık: number;
  sorun: string;
  yorum?: string;
  öneri?: string;
  alarmEnabled?: boolean;
  notificationsEnabled?: boolean;
  analyses: AnalysisReport[];
}

interface ScanResult {
  bitki: string;
  image: string;
  sağlık: number;
  sorun: string;
  yorum: string;
  öneri: string;
  waterFrequencyDays: number;
}

// Preset Plant Databases for Simulation using 5-key JSON format
const PRESET_PLANTS: Record<string, { bitki: string; image: string; sağlık: number; sorun: string; yorum: string; öneri: string; waterFrequencyDays: number }> = {
  monstera: {
    bitki: "Monstera",
    image: "/monstera.png",
    sağlık: 58,
    sorun: "Yaprak sararması (Aşırı sulama riski)",
    yorum: "Deve tabanı yapraklarındaki sararma, toprağın çok nemli kalıp köklerin havasız kalmasından kaynaklanır.",
    öneri: "Sulamayı azaltın ve toprağın kurumasını bekleyin.",
    waterFrequencyDays: 7
  },
  aloe: {
    bitki: "Aloe Vera",
    image: "/aloe.png",
    sağlık: 72,
    sorun: "Yaprakta kahverengi lekeler (Güneş yanığı)",
    yorum: "Aloe vera doğrudan güneş ışığına maruz kaldığında yapraklarında güneş yanığı lekeleri oluşabilir.",
    öneri: "Bitkiyi doğrudan öğle güneşinden koruyun ve yarı gölge bir konuma taşıyın.",
    waterFrequencyDays: 14
  },
  lily: {
    bitki: "Barış Çiçeği",
    image: "/lily.png",
    sağlık: 35,
    sorun: "Yapraklarda sarkma ve solma (Şiddetli susuzluk)",
    yorum: "Barış çiçeği toprağındaki nem tamamen bittiğinde yapraklarını salarak su ihtiyacını belli eder.",
    öneri: "Hemen saksı altından su süzülene kadar derin sulama yapın ve yapraklarına nem spreyi sıkın.",
    waterFrequencyDays: 4
  },
  ficus: {
    bitki: "Keman Yapraklı İncir",
    image: "/ficus.png",
    sağlık: 95,
    sorun: "Belirgin bir sorun yok (Sağlıklı)",
    yorum: "Bitkinizin gelişimi gayet dengeli ve yaprakları sağlıklı görünmektedir.",
    öneri: "Mevcut düzeni sürdürün ve yaprakların tozunu nemli bezle silin.",
    waterFrequencyDays: 10
  }
};

// @ts-ignore
const firebase = window.firebase;
const firebaseConfig = {
  projectId: "plantora-ai-002",
  appId: "1:681383641025:web:e30a4d53515977f417f940",
  storageBucket: "plantora-ai-002.firebasestorage.app",
  apiKey: "AIzaSyBFuRFDjBmem9cRKTgkVxm_wI42ckXYsZU",
  authDomain: "plantora-ai-002.firebaseapp.com",
  messagingSenderId: "681383641025",
  measurementId: "G-JEDS6DRYWE"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
try {
  db.enablePersistence({ synchronizeTabs: true })
    .catch((err: any) => {
      if (err.code == 'failed-precondition') {
        console.warn("Firestore persistence failed-precondition: multiple tabs open.");
      } else if (err.code == 'unimplemented') {
        console.warn("Firestore persistence unimplemented in this browser.");
      }
    });
} catch (e) {
  console.error("Firestore persistence error:", e);
}
const auth = firebase.auth();
const storage = firebase.storage();
let currentUserId = "anonymous_web_user";

interface LocationData {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}
let userLocation: LocationData | null = null;

async function fetchUserLocation() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      userLocation = {
        city: data.city || "Bilinmiyor",
        region: data.region || "Bilinmiyor",
        country: data.country_name || "Bilinmiyor",
        latitude: data.latitude || 0,
        longitude: data.longitude || 0
      };
      console.log("Kullanıcı Konumu Alındı:", userLocation);
    }
  } catch (err) {
    console.warn("Konum bilgisi alınamadı:", err);
  }
}

function getSeason(): string {
  const month = new Date().getMonth();
  if (month === 11 || month === 0 || month === 1) return "Kış";
  if (month >= 2 && month <= 4) return "İlkbahar";
  if (month >= 5 && month <= 7) return "Yaz";
  return "Sonbahar";
}

function saveUserRecord(userId: string) {
  const userRef = db.collection("users").doc(userId);
  userRef.get().then((doc: any) => {
    const loc = userLocation || { city: "Bilinmiyor", region: "Bilinmiyor", country: "Bilinmiyor", latitude: 0, longitude: 0 };
    if (!doc.exists) {
      userRef.set({
        uid: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
        location: loc
      });
    } else {
      userRef.update({
        lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
        location: loc
      });
    }
  }).catch((err: any) => console.error("User record error:", err));
}

async function getImageUrl(imageSrc: string, plantId: string): Promise<string> {
  if (imageSrc && imageSrc.startsWith("data:image")) {
    try {
      const storageRef = storage.ref();
      const fileRef = storageRef.child(`users/${currentUserId}/plants/${plantId}.jpg`);
      const snapshot = await fileRef.putString(imageSrc, 'data_url', { contentType: 'image/jpeg' });
      const downloadURL = await snapshot.ref.getDownloadURL();
      return downloadURL;
    } catch (err) {
      console.error("Storage upload failed, fallback to base64:", err);
      return imageSrc;
    }
  }
  return imageSrc || "/monstera.png";
}

function resizeImageToDataUrl(file: File, maxWidth: number, quality: number = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context not available"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function showToast(title: string, message: string, type: 'success' | 'warning' | 'danger' = 'success') {
  const toast = document.getElementById("app-toast") as HTMLDivElement;
  const iconEl = document.getElementById("toast-icon") as HTMLDivElement;
  const titleEl = document.getElementById("toast-title") as HTMLDivElement;
  const messageEl = document.getElementById("toast-message") as HTMLDivElement;

  if (!toast) return;

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;

  toast.className = "app-toast";
  if (type === 'success') {
    if (iconEl) iconEl.textContent = "🌿";
    toast.classList.add("success");
  } else if (type === 'warning') {
    if (iconEl) iconEl.textContent = "⚠️";
    toast.classList.add("warning");
  } else if (type === 'danger') {
    if (iconEl) iconEl.textContent = "🚨";
    toast.classList.add("danger");
  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// Application State
let garden: Plant[] = [];
let activeScanTarget: ScanResult | null = null;
let customImageSrc: string | null = null;
let uploadedPhotos: OptimizedImage[] = [];
let activePhotoIndex: number = 0;

// Track if current scan is a re-scan of an existing plant
let activeRescanPlantId: string | null = null;
let myPairingCode: string | null = null;

function listenToGarden(userId: string) {
  db.collection("users").doc(userId).collection("plants")
    .onSnapshot((snapshot: any) => {
      const newGarden: Plant[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        newGarden.push({
          id: doc.id,
          nickname: data.nickname || data.bitki,
          bitki: data.bitki,
          image: data.image || "/monstera.png",
          addedDate: data.addedDate || getFormattedDate(),
          needsWater: data.needsWater ?? false,
          waterFrequencyDays: data.waterFrequencyDays || 7,
          lastWateredDaysAgo: data.lastWateredDaysAgo ?? 0,
          sağlık: data.sağlık || 80,
          sorun: data.sorun || "Sağlıklı",
          yorum: data.yorum || "",
          öneri: data.öneri || "",
          alarmEnabled: data.alarmEnabled ?? true,
          notificationsEnabled: data.notificationsEnabled ?? true,
          images: data.images || [],
          analyses: []
        });
      });
      garden = newGarden;
      updateGardenUI();
    }, (error: any) => {
      console.warn("Firestore listener error (likely unauthorized):", error);
      updateGardenUI();
    });
}

// Helper to derive color from health score
function getHealthColor(score: number): 'green' | 'orange' | 'red' {
  if (score >= 85) return 'green';
  if (score < 60) return 'red';
  return 'orange';
}

// Helper to get health label text
function getHealthLabel(score: number): string {
  if (score >= 85) return "🟢 İyi Durumda";
  if (score < 60) return "🔴 Acil Müdahale";
  return "🟡 Dikkat Gerek";
}

// Helper to format dates in Turkish
function getFormattedDate(): string {
  const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const now = new Date();
  return `${now.getDate()} ${months[now.getMonth()]}`;
}

// ==========================================================================
// DOM ELEMENTS & EVENT BINDINGS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Synchronously hide disclaimer overlay if already accepted in local storage
  const localAccepted = localStorage.getItem("hasAcceptedTerms");
  if (localAccepted === "true") {
    const disclaimer = document.getElementById("disclaimer-overlay");
    if (disclaimer) disclaimer.classList.add("hidden");
  }

  setupTime();
  setupNavigation();
  setupUploadAndScanner();
  setupGardenActions();
  setupDetailsOverlay();
  setupSettingsActions();
  setupDisclaimerActions();
  setupDeviceSync();
  setupGoogleAuth();
  setupFontSizeSelector();
  setupThemeSelector();
  
  // Fetch geolocation then check auth state or authenticate anonymously
  fetchUserLocation().then(() => {
    // Standard Firebase Auth state observer to prevent overriding existing logged in user
    auth.onAuthStateChanged((user: any) => {
      if (user) {
        // Use paired user ID if it exists in localStorage, otherwise use authenticated user's UID
        const savedPairedId = localStorage.getItem("paired_user_id");
        const targetUserId = savedPairedId || user.uid;

        // Check if we have a temporary anonymous account to merge
        const oldAnonUid = localStorage.getItem("old_anon_uid");
        if (oldAnonUid && oldAnonUid !== targetUserId) {
          localStorage.removeItem("old_anon_uid");
          showToast("Bahçeler Birleştiriliyor... 🔄", "Misafir verileriniz hesabınıza taşınıyor.", "warning");
          
          mergeAndDestroyUser(oldAnonUid, targetUserId).then(() => {
            currentUserId = targetUserId;
            saveUserRecord(currentUserId);
            loadUserSettings(currentUserId);
            listenToGarden(currentUserId);
            showToast("Veriler Birleştirildi! 🎉", "Tüm bitki geçmişiniz başarıyla aktarıldı.", "success");
          }).catch((err: any) => {
            console.error("Merge failed:", err);
            // Fallback to loading target user settings anyway
            currentUserId = targetUserId;
            saveUserRecord(currentUserId);
            loadUserSettings(currentUserId);
            listenToGarden(currentUserId);
          });
        } else {
          currentUserId = targetUserId;
          saveUserRecord(currentUserId);
          loadUserSettings(currentUserId);
          listenToGarden(currentUserId);
        }
      } else {
        // If not authenticated at all, sign in anonymously
        auth.signInAnonymously().catch((err: any) => {
          console.error("Auth error:", err);
          loadUserSettings(currentUserId);
          listenToGarden(currentUserId);
        });
      }
    });
  });
});

// Update Phone Top Bar Time
function setupTime() {
  const timeEl = document.getElementById("live-time");
  if (!timeEl) return;
  const update = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hrs}:${mins}`;
  };
  update();
  setInterval(update, 60000);
}

// Cancel Re-scan State helper
function cancelRescanState() {
  activeRescanPlantId = null;
  const badgeLabel = document.getElementById("result-badge-label");
  const addToGardenBtn = document.getElementById("btn-add-to-garden");
  if (badgeLabel) badgeLabel.textContent = "🌿 Plantora AI Analizi";
  if (addToGardenBtn) addToGardenBtn.innerHTML = "Bahçeme Ekle 🌿";
}

// Reset Scanner View to upload zone
function resetScannerView(preserveRescan: boolean = false) {
  const uploadZone = document.getElementById("upload-zone") as HTMLDivElement;
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const previewContainer = document.getElementById("scan-preview-container") as HTMLDivElement;
  const quickPicker = document.getElementById("quick-picker-section") as HTMLDivElement;
  const resultCard = document.getElementById("result-card") as HTMLDivElement;

  if (uploadZone) uploadZone.classList.remove("hidden");
  if (quickPicker) quickPicker.classList.remove("hidden");
  if (previewContainer) previewContainer.classList.add("hidden");
  if (resultCard) resultCard.classList.add("hidden");
  if (fileInput) fileInput.value = "";

  activeScanTarget = null;
  uploadedPhotos = [];
  activePhotoIndex = 0;

  if (!preserveRescan) {
    cancelRescanState();
    const uploadHeader = document.querySelector('#upload-zone h4');
    if (uploadHeader) {
      uploadHeader.innerHTML = "Bitkinizi Analiz Edin 🌿";
    }
  }
}

// Global tab switcher with animations
function switchTab(targetId: string, animate = false) {
  const currentView = document.querySelector(".app-view.active") as HTMLElement;
  if (!currentView) {
    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add("active");
    return;
  }

  if (currentView.id === targetId) return;

  const targetView = document.getElementById(targetId) as HTMLElement;
  if (!targetView) return;

  // Reset rescan notice if leaving/entering scanner tab
  if (targetId !== 'view-scan') {
    cancelRescanState();
  } else {
    resetScannerView(!!activeRescanPlantId);
  }

  // Close details overlay on tab switch
  const detailsOverlay = document.getElementById("plant-detail-overlay") as HTMLDivElement;
  if (detailsOverlay) {
    detailsOverlay.style.transition = "";
    detailsOverlay.style.transform = "";
    detailsOverlay.classList.remove("active");
  }

  // Update navbar active state
  const navItems = document.querySelectorAll(".nav-item, #btn-header-settings");
  navItems.forEach(n => {
    if (n.getAttribute("data-target") === targetId) {
      n.classList.add("active");
    } else {
      n.classList.remove("active");
    }
  });

  if (!animate) {
    // Instant switch
    currentView.classList.remove("active");
    targetView.classList.add("active");
    return;
  }

  const VIEW_INDEXES: Record<string, number> = {
    "view-garden": 0,
    "view-scan": 1,
    "view-calendar": 2,
    "view-settings": 3
  };
  const currentIndex = VIEW_INDEXES[currentView.id] ?? 0;
  const targetIndex = VIEW_INDEXES[targetId] ?? 0;
  const isRight = targetIndex > currentIndex;

  // Clear any existing animation classes
  currentView.classList.remove("flat-slide-in-left", "flat-slide-in-right", "flat-slide-out-left", "flat-slide-out-right");
  targetView.classList.remove("flat-slide-in-left", "flat-slide-in-right", "flat-slide-out-left", "flat-slide-out-right");

  const contentEl = document.querySelector(".app-content") as HTMLElement;
  let originalHeight = "";
  if (contentEl) {
    originalHeight = contentEl.style.height;
    contentEl.style.height = `${contentEl.offsetHeight}px`;
    contentEl.style.overflow = "hidden";
  }

  // Position absolutely to prevent layout push during animation
  currentView.style.position = 'absolute';
  currentView.style.width = '100%';
  targetView.style.position = 'absolute';
  targetView.style.width = '100%';

  // Make target active so it is rendered
  targetView.classList.add("active");

  // Trigger animations
  if (isRight) {
    currentView.classList.add("flat-slide-out-left");
    targetView.classList.add("flat-slide-in-right");
  } else {
    currentView.classList.add("flat-slide-out-right");
    targetView.classList.add("flat-slide-in-left");
  }

  // Clean up classes and restore layout after animation runs (0.22 seconds)
  setTimeout(() => {
    currentView.classList.remove("active", "flat-slide-out-left", "flat-slide-out-right");
    targetView.classList.remove("flat-slide-in-left", "flat-slide-in-right");

    currentView.style.position = '';
    currentView.style.width = '';
    targetView.style.position = '';
    targetView.style.width = '';

    if (contentEl) {
      contentEl.style.height = originalHeight;
      contentEl.style.overflow = "";
    }
  }, 220);
}

// Check if touch event started on interactive element that should not trigger page swipe
function shouldIgnoreSwipe(target: HTMLElement | null): boolean {
  if (!target) return false;
  let el: HTMLElement | null = target;
  while (el) {
    if (
      el.id === "detail-carousel-container" || 
      el.classList.contains("scan-thumbnails-container") ||
      el.classList.contains("timeline-wrapper") ||
      el.classList.contains("theme-picker") ||
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.classList.contains("slider") ||
      el.classList.contains("card-slider") ||
      el.classList.contains("no-swipe")
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

// Setup horizontal swipe gestures to transition tabs
function setupTabSwipeGestures() {
  const appScreen = document.querySelector(".app-screen");
  if (!appScreen) return;

  let startX = 0;
  let startY = 0;
  let isSwipeIgnore = false;

  appScreen.addEventListener("touchstart", (e: any) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isSwipeIgnore = shouldIgnoreSwipe(e.target as HTMLElement);
  }, { passive: true });

  appScreen.addEventListener("touchend", (e: any) => {
    if (isSwipeIgnore) return;

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - startX;
    const diffY = touch.clientY - startY;

    const thresholdX = 70;
    const thresholdY = 40;

    if (Math.abs(diffX) > thresholdX && Math.abs(diffY) < thresholdY) {
      const currentView = document.querySelector(".app-view.active") as HTMLElement;
      if (!currentView) return;

      const VIEW_INDEXES: Record<string, number> = {
        "view-garden": 0,
        "view-scan": 1,
        "view-calendar": 2,
        "view-settings": 3
      };
      const VIEW_KEYS = ["view-garden", "view-scan", "view-calendar", "view-settings"];
      const currentIndex = VIEW_INDEXES[currentView.id] ?? 0;

      if (diffX < 0) {
        // Swiped left -> Next tab
        if (currentIndex < 3) {
          switchTab(VIEW_KEYS[currentIndex + 1], true);
        }
      } else {
        // Swiped right -> Prev tab
        if (currentIndex > 0) {
          switchTab(VIEW_KEYS[currentIndex - 1], true);
        }
      }
    }
  });
}

// Pull-to-close detail screen overlay
function setupPullToCloseGesture() {
  const overlay = document.getElementById("plant-detail-overlay") as HTMLDivElement;
  if (!overlay) return;

  let startY = 0;
  let isDragging = false;
  const detailContent = overlay.querySelector(".detail-content") as HTMLElement;

  function handleStart(y: number, target: HTMLElement) {
    if (detailContent && detailContent.contains(target) && detailContent.scrollTop > 0) {
      return;
    }
    
    if (target.closest(".carousel-nav") || target.closest("button") || target.closest(".theme-picker") || target.closest("input") || target.closest("#detail-carousel-container")) {
      return;
    }

    startY = y;
    isDragging = true;
    overlay.style.transition = "none";
  }

  function handleMove(y: number) {
    if (!isDragging) return;
    const diffY = y - startY;
    if (diffY > 0) {
      overlay.style.transform = `translateY(${diffY}px)`;
    } else {
      overlay.style.transform = `translateY(0px)`;
    }
  }

  function handleEnd(y: number) {
    if (!isDragging) return;
    isDragging = false;
    
    const diffY = y - startY;
    overlay.style.transition = "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
    
    if (diffY > 120) {
      overlay.style.transform = "";
      overlay.classList.remove("active");
    } else {
      overlay.style.transform = "";
    }
  }

  overlay.addEventListener("touchstart", (e: TouchEvent) => {
    handleStart(e.touches[0].clientY, e.target as HTMLElement);
  }, { passive: true });

  overlay.addEventListener("touchmove", (e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientY);
  }, { passive: true });

  overlay.addEventListener("touchend", (e: TouchEvent) => {
    if (!isDragging) return;
    handleEnd(e.changedTouches[0].clientY);
  });

  overlay.addEventListener("mousedown", (e: MouseEvent) => {
    handleStart(e.clientY, e.target as HTMLElement);
  });

  window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientY);
  });

  window.addEventListener("mouseup", (e: MouseEvent) => {
    if (!isDragging) return;
    handleEnd(e.clientY);
  });
}

// Tab Navigation Setup
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item, #btn-header-settings");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetId = item.getAttribute("data-target");
      if (targetId) switchTab(targetId);
    });
  });

  // Home Screen "Hemen Tara" Action
  const emptyScanBtn = document.getElementById("btn-empty-scan");
  if (emptyScanBtn) {
    emptyScanBtn.addEventListener("click", () => {
      switchTab("view-scan");
    });
  }

  // Setup Touch Swipe Gestures for Mobile navigation
  setupTabSwipeGestures();

  // Setup Pull-to-Close gesture on Detail screen
  setupPullToCloseGesture();
}

// ==========================================================================
// AVATARS DICTIONARY & SETTINGS ACTIONS
// ==========================================================================
const AVATARS: Record<string, string> = {
  plant_1: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="1.5" stroke-linecap="round"><path d="M17 8C8 10 9 21 9 21s8-2 11-10c1.5-4-.5-4.5-3-3zM9 21c0-4-3-8-3-8"/></svg>`,
  plant_2: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M8 8v6c0 1.5.5 2 2 2M16 10v4c0 1.5-.5 2-2 2"/></svg>`,
  plant_3: `<svg viewBox="0 0 24 24" fill="var(--primary-light)"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5"/></svg>`,
  plant_4: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="1.5" stroke-linecap="round"><path d="M12 21v-4M8 17h8c0-3.5-2-5-4-5s-4 1.5-4 5zM6 13h12c0-3-2.5-4.5-6-4.5s-6 1.5-6 4.5z"/></svg>`,
  plant_5: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2" stroke-linecap="round"><path d="M12 21V12M12 12c0-3 3-5 6-4M12 14c0-2-3-4-5-3.5"/></svg>`,
  plant_6: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2" stroke-linecap="round"><path d="M12 21s1-6-3-12c4 2 6 7 6 7s1-4 3-7c-2 4-2 9-2 9"/></svg>`,
  
  gardener_1: `<svg viewBox="0 0 24 24" fill="var(--primary-light)"><path d="M12 14c-3.3 0-6 2.7-6 6h12c0-3.3-2.7-6-6-6zM12 4a4 4 0 100 8 4 4 0 000-8zM4 14h16v-1H4v1z"/></svg>`,
  gardener_2: `<svg viewBox="0 0 24 24" fill="var(--primary-light)"><path d="M19 12h-6V8h2V6h-4v2h2v4H7c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM3 16h2v2H3z"/></svg>`,
  gardener_3: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2" stroke-linecap="round"><path d="M12 2v12M8 5h8v2H8zm2 2h4v5h-4z"/></svg>`,
  gardener_4: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M6 20c0-3 3-5 6-5s6 2 6 5"/><path d="M10 8h4" stroke-width="1.5"/></svg>`,
  gardener_5: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2"><path d="M12 10V4M8 7l4-3 4 3"/><path d="M4 18c1-1 4-2 8-2s7 1 8 2" stroke-width="1.5"/></svg>`,
  gardener_6: `<svg viewBox="0 0 24 24" fill="var(--primary-light)"><path d="M12 2a4 4 0 100 8 4 4 0 000-8zm-6 18c0-3 3-6 6-6s6 3 6 6"/><path d="M12 2s-3 3-1 6" stroke="var(--primary-light)" stroke-width="1" fill="none"/></svg>`
};

let selectedAvatarId = "plant_1";
let hasAcceptedTermsLocal = false;

function renderAvatarPickers() {
  const plantGrid = document.getElementById("plant-avatars-grid");
  const gardenerGrid = document.getElementById("gardener-avatars-grid");
  if (!plantGrid || !gardenerGrid) return;

  plantGrid.innerHTML = "";
  gardenerGrid.innerHTML = "";

  // 6 Plants
  for (let i = 1; i <= 6; i++) {
    const avatarId = `plant_${i}`;
    const btn = document.createElement("button");
    btn.className = "avatar-btn";
    if (avatarId === selectedAvatarId) btn.classList.add("active");
    btn.setAttribute("data-avatar-id", avatarId);
    btn.innerHTML = AVATARS[avatarId];
    btn.type = "button";
    btn.addEventListener("click", () => selectAvatar(avatarId));
    plantGrid.appendChild(btn);
  }

  // 6 Gardeners
  for (let i = 1; i <= 6; i++) {
    const avatarId = `gardener_${i}`;
    const btn = document.createElement("button");
    btn.className = "avatar-btn";
    if (avatarId === selectedAvatarId) btn.classList.add("active");
    btn.setAttribute("data-avatar-id", avatarId);
    btn.innerHTML = AVATARS[avatarId];
    btn.type = "button";
    btn.addEventListener("click", () => selectAvatar(avatarId));
    gardenerGrid.appendChild(btn);
  }
}

function selectAvatar(avatarId: string) {
  selectedAvatarId = avatarId;
  const btns = document.querySelectorAll(".avatar-btn");
  btns.forEach(btn => btn.classList.remove("active"));
  
  const activeBtn = document.querySelector(`[data-avatar-id="${avatarId}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  const preview = document.getElementById("current-profile-avatar");
  if (preview) {
    preview.innerHTML = AVATARS[avatarId];
  }
}

function loadUserSettings(userId: string) {
  db.collection("users").doc(userId).get().then((doc: any) => {
    const disclaimer = document.getElementById("disclaimer-overlay");
    if (doc.exists) {
      const data = doc.data();
      
      hasAcceptedTermsLocal = data.hasAcceptedTerms || (localStorage.getItem("hasAcceptedTerms") === "true");
      if (hasAcceptedTermsLocal && disclaimer) {
        disclaimer.classList.add("hidden");
      } else if (disclaimer) {
        disclaimer.classList.remove("hidden");
      }

      const nameInput = document.getElementById("settings-name-input") as HTMLInputElement;
      if (nameInput) nameInput.value = data.name || "";
      const headerName = document.getElementById("profile-display-name");
      if (headerName) headerName.textContent = data.name || "Misafir Kullanıcı";

      const emailInput = document.getElementById("settings-email-input") as HTMLInputElement;
      if (emailInput) emailInput.value = data.email || "";

      const phoneInput = document.getElementById("settings-phone-input") as HTMLInputElement;
      if (phoneInput) phoneInput.value = data.phone || "";

      const toggleEmail = document.getElementById("settings-toggle-email") as HTMLInputElement;
      if (toggleEmail) toggleEmail.checked = data.emailNotifications !== false;
      const toggleSms = document.getElementById("settings-toggle-sms") as HTMLInputElement;
      if (toggleSms) toggleSms.checked = data.smsNotifications || false;

      if (data.avatarId && AVATARS[data.avatarId]) {
        selectedAvatarId = data.avatarId;
      } else {
        selectedAvatarId = "plant_1";
      }
      renderAvatarPickers();
      selectAvatar(selectedAvatarId);

      // Load pairingCode from settings
      myPairingCode = data.pairingCode || null;
      const generateBtn = document.getElementById("btn-generate-sync-code") as HTMLButtonElement;
      if (generateBtn) {
        if (myPairingCode) {
          generateBtn.innerText = "Eşleşme Kodunu Göster 🔑";
        } else {
          generateBtn.innerText = "Eşleşme Kodu Üret 🔑";
        }
      }
    } else {
      if (disclaimer) {
        // If not in local storage either, show it
        const localAccepted = localStorage.getItem("hasAcceptedTerms");
        if (localAccepted !== "true") {
          disclaimer.classList.remove("hidden");
        } else {
          disclaimer.classList.add("hidden");
        }
      }
      // Fallback to local storage
      const localName = localStorage.getItem("local_name") || "";
      const localEmail = localStorage.getItem("local_email") || "";
      const localPhone = localStorage.getItem("local_phone") || "";
      const localAvatar = localStorage.getItem("local_avatarId") || "plant_1";

      const nameInput = document.getElementById("settings-name-input") as HTMLInputElement;
      if (nameInput) nameInput.value = localName;
      const headerName = document.getElementById("profile-display-name");
      if (headerName) headerName.textContent = localName || "Misafir Kullanıcı";

      const emailInput = document.getElementById("settings-email-input") as HTMLInputElement;
      if (emailInput) emailInput.value = localEmail;
      const phoneInput = document.getElementById("settings-phone-input") as HTMLInputElement;
      if (phoneInput) phoneInput.value = localPhone;

      selectedAvatarId = localAvatar;
      renderAvatarPickers();
      selectAvatar(selectedAvatarId);
    }
  }).catch((err: any) => {
    console.warn("Firestore settings error, fallback to LocalStorage:", err);
    
    const disclaimer = document.getElementById("disclaimer-overlay");
    if (disclaimer) {
      const localAccepted = localStorage.getItem("hasAcceptedTerms");
      if (localAccepted === "true") {
        disclaimer.classList.add("hidden");
      } else {
        disclaimer.classList.remove("hidden");
      }
    }

    const localName = localStorage.getItem("local_name") || "";
    const localEmail = localStorage.getItem("local_email") || "";
    const localPhone = localStorage.getItem("local_phone") || "";
    const localAvatar = localStorage.getItem("local_avatarId") || "plant_1";

    const nameInput = document.getElementById("settings-name-input") as HTMLInputElement;
    if (nameInput) nameInput.value = localName;
    const headerName = document.getElementById("profile-display-name");
    if (headerName) headerName.textContent = localName || "Misafir Kullanıcı";

    const emailInput = document.getElementById("settings-email-input") as HTMLInputElement;
    if (emailInput) emailInput.value = localEmail;
    
    const phoneInput = document.getElementById("settings-phone-input") as HTMLInputElement;
    if (phoneInput) phoneInput.value = localPhone;

    selectedAvatarId = localAvatar;
    renderAvatarPickers();
    selectAvatar(selectedAvatarId);
  });
}

function setupSettingsActions() {
  const saveBtn = document.getElementById("btn-save-settings");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("settings-name-input") as HTMLInputElement;
      const emailInput = document.getElementById("settings-email-input") as HTMLInputElement;
      const phoneInput = document.getElementById("settings-phone-input") as HTMLInputElement;
      const toggleEmail = document.getElementById("settings-toggle-email") as HTMLInputElement;
      const toggleSms = document.getElementById("settings-toggle-sms") as HTMLInputElement;

      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const phone = phoneInput ? phoneInput.value.trim() : "";
      const emailNotifications = toggleEmail ? toggleEmail.checked : true;
      const smsNotifications = toggleSms ? toggleSms.checked : false;

      db.collection("users").doc(currentUserId).update({
        name,
        email,
        phone,
        avatarId: selectedAvatarId,
        emailNotifications,
        smsNotifications,
        lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        showToast("Ayarlar Kaydedildi 💾", "Profil ayarlarınız başarıyla güncellendi!", "success");
        const headerName = document.getElementById("profile-display-name");
        if (headerName) headerName.textContent = name || "Misafir Kullanıcı";
      }).catch((err: any) => {
        console.error("Save settings error:", err);
        showToast("Hata 🚨", "Ayarlar kaydedilemedi.", "danger");
      });
    });
  }
}

async function mergeAndDestroyUser(sourceUid: string, targetUid: string): Promise<void> {
  if (!sourceUid || !targetUid || sourceUid === targetUid) {
    return;
  }
  console.log(`Starting merge from ${sourceUid} to ${targetUid}...`);

  try {
    // 1. Merge settings/profile if target does not have it
    const sourceUserDoc = await db.collection("users").doc(sourceUid).get();
    const targetUserDoc = await db.collection("users").doc(targetUid).get();
    
    if (sourceUserDoc.exists) {
      const sourceUserData = sourceUserDoc.data();
      if (!targetUserDoc.exists) {
        await db.collection("users").doc(targetUid).set(sourceUserData);
      } else {
        const targetUserData = targetUserDoc.data() || {};
        const mergedUserData: any = {};
        const fieldsToMerge = ["name", "email", "phone", "avatarId", "emailNotifications", "smsNotifications", "hasAcceptedTerms"];
        
        fieldsToMerge.forEach(field => {
          if ((targetUserData[field] === undefined || targetUserData[field] === null || targetUserData[field] === "") && sourceUserData[field] !== undefined) {
            mergedUserData[field] = sourceUserData[field];
          }
        });

        if (Object.keys(mergedUserData).length > 0) {
          await db.collection("users").doc(targetUid).set(mergedUserData, { merge: true });
        }
      }
    }

    // 2. Fetch all plants of the source user
    const plantsSnapshot = await db.collection("users").doc(sourceUid).collection("plants").get();
    
    // 3. Loop and copy each plant & its reports
    for (const plantDoc of plantsSnapshot.docs) {
      const plantId = plantDoc.id;
      const plantData = plantDoc.data();

      // Write plant to target user
      await db.collection("users").doc(targetUid).collection("plants").doc(plantId).set(plantData, { merge: true });

      // Fetch all reports of this plant
      const reportsSnapshot = await db.collection("users").doc(sourceUid).collection("plants").doc(plantId).collection("reports").get();
      for (const reportDoc of reportsSnapshot.docs) {
        const reportId = reportDoc.id;
        const reportData = reportDoc.data();

        // Write report to target user
        await db.collection("users").doc(targetUid).collection("plants").doc(plantId).collection("reports").doc(reportId).set(reportData, { merge: true });

        // Delete source report
        await db.collection("users").doc(sourceUid).collection("plants").doc(plantId).collection("reports").doc(reportId).delete();
      }

      // Also copy/delete schedules if any
      const schedulesSnapshot = await db.collection("users").doc(sourceUid).collection("plants").doc(plantId).collection("schedules").get();
      for (const schedDoc of schedulesSnapshot.docs) {
        const schedId = schedDoc.id;
        const schedData = schedDoc.data();
        await db.collection("users").doc(targetUid).collection("plants").doc(plantId).collection("schedules").doc(schedId).set(schedData, { merge: true });
        await db.collection("users").doc(sourceUid).collection("plants").doc(plantId).collection("schedules").doc(schedId).delete();
      }

      // Delete source plant
      await db.collection("users").doc(sourceUid).collection("plants").doc(plantId).delete();
    }

    // 4. Delete source user document
    await db.collection("users").doc(sourceUid).delete();
    console.log(`Successfully merged and destroyed user ${sourceUid} (snake skin shed).`);
  } catch (err) {
    console.error("Error during mergeAndDestroyUser:", err);
    throw err;
  }
}

function setupDeviceSync() {
  const generateBtn = document.getElementById("btn-generate-sync-code") as HTMLButtonElement;
  const submitBtn = document.getElementById("btn-submit-sync-code") as HTMLButtonElement;
  const syncInput = document.getElementById("sync-input-code") as HTMLInputElement;
  const codeDisplay = document.getElementById("sync-code-display") as HTMLDivElement;
  const codeVal = document.getElementById("sync-code-val") as HTMLDivElement;
  const disconnectBtn = document.getElementById("btn-disconnect-sync") as HTMLButtonElement;

  // Initialize Disconnect Button state
  const checkDisconnectState = () => {
    if (disconnectBtn) {
      if (localStorage.getItem("paired_user_id")) {
        disconnectBtn.classList.remove("hidden");
      } else {
        disconnectBtn.classList.add("hidden");
      }
    }
  };
  checkDisconnectState();

  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showToast("Hata 🚨", "Oturum bulunamadı.", "danger");
        return;
      }

      // If pairing code already exists, just show it!
      if (myPairingCode) {
        if (codeVal) codeVal.textContent = myPairingCode;
        if (codeDisplay) codeDisplay.classList.remove("hidden");
        showToast("Eşleşme Kodu Hazır 🔑", "Telefonunuzdan bu kodu girerek bağlanabilirsiniz.", "success");
        return;
      }

      generateBtn.disabled = true;
      generateBtn.innerText = "Kod Üretiliyor... ⏳";

      // Generate random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Write pairing document to public pairings collection
      db.collection("pairings").doc(code).set({
        uid: currentUserId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        // Also save this code to the user's profile so it is permanent!
        return db.collection("users").doc(currentUserId).set({
          pairingCode: code
        }, { merge: true });
      }).then(() => {
        myPairingCode = code;
        if (codeVal) codeVal.textContent = code;
        if (codeDisplay) codeDisplay.classList.remove("hidden");
        generateBtn.disabled = false;
        generateBtn.innerText = "Eşleşme Kodunu Göster 🔑";
        showToast("Eşleşme Kodu Hazır 🔑", "Telefonunuzdan bu kodu girerek bağlanabilirsiniz.", "success");
      }).catch((err: any) => {
        console.error("Firestore pairing write failed:", err);
        generateBtn.disabled = false;
        generateBtn.innerText = "Eşleşme Kodu Üret 🔑";
        showToast("Hata 🚨", "Eşleşme kodu oluşturulamadı: " + err.message, "danger");
      });
    });
  }

  if (submitBtn && syncInput) {
    submitBtn.addEventListener("click", () => {
      const rawCode = syncInput.value.trim();
      const code = rawCode.replace(/\s+/g, ""); // strip whitespace
      if (!/^\d{6}$/.test(code)) {
        showToast("Hata ⚠️", "Lütfen 6 haneli kodu eksiksiz girin.", "warning");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerText = "Bağlanıyor... ⏳";

      // Read from pairings collection
      db.collection("pairings").doc(code).get().then((doc: any) => {
        if (doc.exists) {
          const data = doc.data();
          const targetUid = data.uid;

          const currentUser = auth.currentUser;
          const sourceUid = currentUser ? currentUser.uid : currentUserId;
          
          if (sourceUid && sourceUid !== targetUid) {
            showToast("Bahçeler Birleştiriliyor... 🔄", "Misafir verileriniz aktarılıyor.", "warning");
            
            mergeAndDestroyUser(sourceUid, targetUid).then(() => {
              localStorage.setItem("paired_user_id", targetUid);
              currentUserId = targetUid;

              loadUserSettings(currentUserId);
              listenToGarden(currentUserId);

              showToast("Bağlantı Başarılı! 🌿", "Diğer cihazdaki bahçe verileri birleştirilerek yüklendi.", "success");
              finishPairing();
            }).catch((err: any) => {
              console.error("Pairing merge error:", err);
              // Fallback: just link anyway
              localStorage.setItem("paired_user_id", targetUid);
              currentUserId = targetUid;
              loadUserSettings(currentUserId);
              listenToGarden(currentUserId);
              showToast("Bağlantı Kuruldu ⚠️", "Veriler tam birleştirilemedi ama bahçeye bağlanıldı.", "warning");
              finishPairing();
            });
          } else {
            localStorage.setItem("paired_user_id", targetUid);
            currentUserId = targetUid;
            loadUserSettings(currentUserId);
            listenToGarden(currentUserId);
            showToast("Bağlantı Başarılı! 🌿", "Diğer cihazdaki bahçe verileri yüklendi.", "success");
            finishPairing();
          }

          function finishPairing() {
            // Reset inputs and buttons
            syncInput.value = "";
            submitBtn.disabled = false;
            submitBtn.innerText = "Bağlan ➔";
            checkDisconnectState();

            // Switch tab view to Garden tab
            const gardenTabBtn = document.querySelector('[data-target="view-garden"]') as HTMLButtonElement;
            if (gardenTabBtn) {
              gardenTabBtn.click();
            }
          }
        } else {
          submitBtn.disabled = false;
          submitBtn.innerText = "Bağlan ➔";
          showToast("Başarısız ⚠️", "Geçersiz veya süresi dolmuş eşleşme kodu!", "danger");
        }
      }).catch((err: any) => {
        console.error("Firestore pairing read error:", err);
        submitBtn.disabled = false;
        submitBtn.innerText = "Bağlan ➔";
        showToast("Hata 🚨", "Bağlantı kurulamadı: " + err.message, "danger");
      });
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", () => {
      localStorage.removeItem("paired_user_id");
      const currentUser = auth.currentUser;
      if (currentUser) {
        currentUserId = currentUser.uid;
        loadUserSettings(currentUserId);
        listenToGarden(currentUserId);
      }
      checkDisconnectState();
      showToast("Bağlantı Kesildi ❌", "Kendi yerel cihaz bahçenize geri döndünüz.", "success");
    });
  }
}

function setupGoogleAuth() {
  const googleBtn = document.getElementById("btn-google-login") as HTMLButtonElement;
  const logoutBtn = document.getElementById("btn-google-logout") as HTMLButtonElement;
  const loggedOutDiv = document.getElementById("google-auth-logged-out") as HTMLDivElement;
  const loggedInDiv = document.getElementById("google-auth-logged-in") as HTMLDivElement;
  const userInfoP = document.getElementById("google-user-info") as HTMLParagraphElement;

  const updateUI = () => {
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      if (loggedOutDiv) loggedOutDiv.classList.add("hidden");
      if (loggedInDiv) loggedInDiv.classList.remove("hidden");
      if (userInfoP) userInfoP.textContent = `Google ile Bağlandı: ${user.email}`;
    } else {
      if (loggedOutDiv) loggedOutDiv.classList.remove("hidden");
      if (loggedInDiv) loggedInDiv.classList.add("hidden");
    }
  };

  // Run on startup
  auth.onAuthStateChanged(() => {
    updateUI();
  });

  // Handle redirect result (crucial for mobile Safari/Chrome where popup is blocked)
  auth.getRedirectResult().then((result: any) => {
    if (result && result.user) {
      showToast("Başarılı 🔑", "Google hesabınız başarıyla bağlandı!", "success");
      localStorage.removeItem("paired_user_id");
      updateUI();
    }
  }).catch((err: any) => {
    console.error("Google redirect login failed:", err);
    localStorage.removeItem("old_anon_uid");
    handleAuthError(err);
  });

  // Helper to handle descriptive error messages
  const handleAuthError = (err: any) => {
    if (err.code === "auth/unauthorized-domain") {
      showToast(
        "Yetkisiz Alan Adı 🚨",
        "Bu alan adı Firebase Console > Authentication > Ayarlar > Yetkilendirilmiş Alan Adları kısmına eklenmelidir.",
        "danger"
      );
    } else if (err.code === "auth/operation-not-allowed") {
      showToast(
        "Google Girişi Etkin Değil 🚨",
        "Firebase Console > Authentication > Sign-in method kısmından Google sağlayıcısını etkinleştirmeniz gerekiyor.",
        "danger"
      );
    } else if (err.code === "auth/popup-blocked") {
      showToast(
        "Pop-up Engellendi 🚨",
        "Tarayıcınızın pop-up engelleyicisini kapatın veya redirect modunu deneyin.",
        "danger"
      );
    } else {
      showToast("Hata 🚨", "Google girişi başarısız oldu: " + err.message, "danger");
    }
  };

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Save old anon/active UID to merge it after sign-in completes
        localStorage.setItem("old_anon_uid", currentUserId);
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      googleBtn.disabled = true;
      googleBtn.innerText = "Giriş Yapılıyor... ⏳";

      // Check if mobile (popups are unreliable or blocked on mobile Safari/in-app browsers)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isMobile) {
        auth.signInWithRedirect(provider).catch((err: any) => {
          console.error("Google redirect failed:", err);
          localStorage.removeItem("old_anon_uid");
          googleBtn.disabled = false;
          googleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" style="background: white; padding: 2px; border-radius: 50%;">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.357-2.847-6.357-6.357s2.847-6.357 6.357-6.357c1.6 0 3.056.59 4.183 1.558l3.055-3.056C19.206 1.833 15.932 1 12.24 1 5.922 1 12.24s4.922 11.24 11.24 11.24c6.046 0 11.24-4.383 11.24-11.24 0-.746-.07-1.472-.2-2.185l-11.04-.015z"/>
            </svg>
            Google ile Giriş Yap / Bağla
          `;
          handleAuthError(err);
        });
      } else {
        auth.signInWithPopup(provider).then(() => {
          showToast("Başarılı 🔑", "Google hesabınız başarıyla bağlandı!", "success");
          googleBtn.disabled = false;
          googleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" style="background: white; padding: 2px; border-radius: 50%;">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.357-2.847-6.357-6.357s2.847-6.357 6.357-6.357c1.6 0 3.056.59 4.183 1.558l3.055-3.056C19.206 1.833 15.932 1 12.24 1 5.922 1 12.24s4.922 11.24 11.24 11.24c6.046 0 11.24-4.383 11.24-11.24 0-.746-.07-1.472-.2-2.185l-11.04-.015z"/>
            </svg>
            Google ile Giriş Yap / Bağla
          `;
          localStorage.removeItem("paired_user_id");
          updateUI();
        }).catch((err: any) => {
          console.error("Google login failed:", err);
          localStorage.removeItem("old_anon_uid");
          googleBtn.disabled = false;
          googleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" style="background: white; padding: 2px; border-radius: 50%;">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.357-2.847-6.357-6.357s2.847-6.357 6.357-6.357c1.6 0 3.056.59 4.183 1.558l3.055-3.056C19.206 1.833 15.932 1 12.24 1 5.922 1 12.24s4.922 11.24 11.24 11.24c6.046 0 11.24-4.383 11.24-11.24 0-.746-.07-1.472-.2-2.185l-11.04-.015z"/>
            </svg>
            Google ile Giriş Yap / Bağla
          `;
          handleAuthError(err);
        });
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logoutBtn.disabled = true;
      logoutBtn.innerText = "Çıkış Yapılıyor... ⏳";

      auth.signOut().then(() => {
        localStorage.removeItem("paired_user_id");
        localStorage.removeItem("old_anon_uid");
        currentUserId = "anonymous_web_user";
        showToast("Oturum Kapatıldı 🚪", "Başarıyla çıkış yaptınız.", "success");
        logoutBtn.disabled = false;
        logoutBtn.innerText = "Oturumu Kapat ❌";
        updateUI();
      }).catch((err: any) => {
        console.error("Signout failed:", err);
        logoutBtn.disabled = false;
        logoutBtn.innerText = "Oturumu Kapat ❌";
        showToast("Hata 🚨", "Oturum kapatılamadı: " + err.message, "danger");
      });
    });
  }
}

function setupFontSizeSelector() {
  const sizeButtons = document.querySelectorAll(".font-size-btn");
  
  // Load saved font size on startup
  const savedSize = localStorage.getItem("app_font_size") || "medium";
  applyFontSize(savedSize);

  sizeButtons.forEach(btn => {
    const size = btn.getAttribute("data-size");
    if (size === savedSize) {
      sizeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      const targetSize = btn.getAttribute("data-size") || "medium";
      applyFontSize(targetSize);
      
      sizeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function applyFontSize(size: string) {
  const htmlEl = document.documentElement;
  htmlEl.classList.remove("font-size-small", "font-size-medium", "font-size-large");
  htmlEl.classList.add(`font-size-${size}`);
  localStorage.setItem("app_font_size", size);
}

function setupThemeSelector() {
  const themeButtons = document.querySelectorAll(".theme-btn");
  
  // Load saved theme on startup
  const savedTheme = localStorage.getItem("app_theme") || "dark";
  applyTheme(savedTheme);

  themeButtons.forEach(btn => {
    const theme = btn.getAttribute("data-theme");
    if (theme === savedTheme) {
      themeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      const targetTheme = btn.getAttribute("data-theme") || "dark";
      applyTheme(targetTheme);
      
      themeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// Media listener for system theme preference changes
let systemThemeMedia: MediaQueryList | null = null;
function handleSystemThemeChange(e: MediaQueryListEvent) {
  const isDark = e.matches;
  const htmlEl = document.documentElement;
  if (isDark) {
    htmlEl.classList.remove("theme-light");
    htmlEl.classList.add("theme-dark");
  } else {
    htmlEl.classList.remove("theme-dark");
    htmlEl.classList.add("theme-light");
  }
}

function applyTheme(theme: string) {
  const htmlEl = document.documentElement;
  localStorage.setItem("app_theme", theme);
  
  // Clean up existing media listener if any
  if (systemThemeMedia) {
    // @ts-ignore
    systemThemeMedia.removeEventListener("change", handleSystemThemeChange);
    systemThemeMedia = null;
  }

  if (theme === "system") {
    systemThemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
    // @ts-ignore
    systemThemeMedia.addEventListener("change", handleSystemThemeChange);
    // Apply initial system preference
    if (systemThemeMedia.matches) {
      htmlEl.classList.remove("theme-light");
      htmlEl.classList.add("theme-dark");
    } else {
      htmlEl.classList.remove("theme-dark");
      htmlEl.classList.add("theme-light");
    }
  } else if (theme === "light") {
    htmlEl.classList.remove("theme-dark");
    htmlEl.classList.add("theme-light");
  } else {
    // Default is dark
    htmlEl.classList.remove("theme-light");
    htmlEl.classList.add("theme-dark");
  }
}

function setupDisclaimerActions() {
  const overlay = document.getElementById("disclaimer-overlay");
  const moreBtn = document.getElementById("btn-disclaimer-more");
  const fullText = document.getElementById("disclaimer-full-text");
  const acceptBtn = document.getElementById("btn-disclaimer-accept");

  if (moreBtn && fullText) {
    moreBtn.addEventListener("click", () => {
      if (fullText.classList.contains("hidden")) {
        fullText.classList.remove("hidden");
        moreBtn.textContent = "Detayları Gizle ▴";
      } else {
        fullText.classList.add("hidden");
        moreBtn.textContent = "Detaylı Sözleşmeyi Oku ➔";
      }
    });
  }

  if (acceptBtn && overlay) {
    acceptBtn.addEventListener("click", () => {
      localStorage.setItem("hasAcceptedTerms", "true");
      hasAcceptedTermsLocal = true;
      
      // Hide overlay and show toast immediately so user isn't blocked
      overlay.classList.add("hidden");
      showToast("Sözleşme Kabul Edildi ✅", "Uygulamaya hoş geldiniz!", "success");
      
      db.collection("users").doc(currentUserId).set({
        uid: currentUserId,
        hasAcceptedTerms: true,
        lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch((err: any) => {
        console.error("Disclaimer save error in Firestore:", err);
      });
    });
  }
}

// Upload & Scan Engine
function setupUploadAndScanner() {
  const uploadZone = document.getElementById("upload-zone") as HTMLDivElement;
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const previewContainer = document.getElementById("scan-preview-container") as HTMLDivElement;
  const previewImg = document.getElementById("scan-preview-img") as HTMLImageElement;
  const quickPicker = document.getElementById("quick-picker-section") as HTMLDivElement;
  const resultCard = document.getElementById("result-card") as HTMLDivElement;
  const scanStatusOverlay = document.getElementById("scan-status-text") as HTMLDivElement;
  const addMoreBtn = document.getElementById("btn-add-more-photos") as HTMLButtonElement;
  
  const pickerButtons = document.querySelectorAll(".picker-btn");

  // Render scan thumbnails under preview image
  function renderUploadThumbnails() {
    const container = document.getElementById("scan-thumbnails-container");
    if (!container) return;
    container.innerHTML = "";

    uploadedPhotos.forEach((photo, idx) => {
      const thumb = document.createElement("div");
      thumb.className = "scan-thumb-preview";
      if (idx === activePhotoIndex) {
        thumb.classList.add("active");
      }
      thumb.style.backgroundImage = `url(${photo.thumbnail})`;

      // Remove button
      const removeBtn = document.createElement("div");
      removeBtn.className = "scan-thumb-remove";
      removeBtn.innerHTML = "×";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        uploadedPhotos.splice(idx, 1);
        if (activePhotoIndex >= uploadedPhotos.length) {
          activePhotoIndex = Math.max(0, uploadedPhotos.length - 1);
        }
        if (uploadedPhotos.length === 0) {
          resetScannerView(!!activeRescanPlantId);
        } else {
          renderUploadThumbnails();
          if (previewImg) previewImg.src = uploadedPhotos[activePhotoIndex].full;
        }
      });

      thumb.appendChild(removeBtn);

      thumb.addEventListener("click", () => {
        activePhotoIndex = idx;
        renderUploadThumbnails();
        if (previewImg) previewImg.src = photo.full;
      });

      container.appendChild(thumb);
    });
  }

  // Handle Drag & Drop / Click Upload (REAL LIVE BACKEND REQUEST)
  if (uploadZone && fileInput) {
    // Open file picker on dropzone click, but prevent double triggering if clicking child elements
    uploadZone.addEventListener("click", (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    if (addMoreBtn) {
      addMoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    fileInput.addEventListener("change", async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const isFirstUpload = (uploadedPhotos.length === 0);
        
        for (let i = 0; i < target.files.length; i++) {
          const file = target.files[i];
          try {
            // Client-side image optimizations (Canvas resizing)
            const thumbBase64 = await resizeImageToDataUrl(file, 120, 0.7);
            const fullBase64 = await resizeImageToDataUrl(file, 800, 0.85);
            uploadedPhotos.push({
              thumbnail: thumbBase64,
              full: fullBase64
            });
          } catch (err) {
            console.error("Error optimizing file:", err);
          }
        }

        target.value = ""; // reset file input

        if (uploadedPhotos.length > 0) {
          if (isFirstUpload) {
            activePhotoIndex = 0;
            triggerLiveScanning();
          } else {
            activePhotoIndex = uploadedPhotos.length - 1;
            renderUploadThumbnails();
            if (previewImg) previewImg.src = uploadedPhotos[activePhotoIndex].full;
          }
        }
      }
    });
  }

  // Handle Quick Picker Presets (offline mock)
  pickerButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const presetName = btn.getAttribute("data-preset");
      if (!presetName) return;
      
      const preset = PRESET_PLANTS[presetName];
      if (preset) {
        // Map preset image to uploadedPhotos
        uploadedPhotos = [{
          thumbnail: preset.image,
          full: preset.image
        }];
        activePhotoIndex = 0;
        triggerScanning(preset.image, preset);
      }
    });
  });

  // Real-time backend analyzer request
  function triggerLiveScanning() {
    if (uploadedPhotos.length === 0) return;
    const imgSrc = uploadedPhotos[activePhotoIndex].full;

    uploadZone.classList.add("hidden");
    resultCard.classList.add("hidden");
    quickPicker.classList.add("hidden");

    previewImg.src = imgSrc;
    previewContainer.classList.remove("hidden");
    renderUploadThumbnails();

    const statuses = [
      "Görsel yükleniyor...",
      "Canlı sunucuya gönderiliyor...",
      "Plantora AI modelleri çalıştırılıyor...",
      "Rapor şeması çözümleniyor..."
    ];

    let statusIdx = 0;
    scanStatusOverlay.textContent = statuses[statusIdx];
    const statusInterval = setInterval(() => {
      statusIdx++;
      if (statusIdx < statuses.length) {
        scanStatusOverlay.textContent = statuses[statusIdx];
      }
    }, 500);

    const startTime = Date.now();

    const payload: any = {
      image: imgSrc
    };
    if (activeRescanPlantId) {
      payload.userId = currentUserId;
      payload.plantId = activeRescanPlantId;
    }

    fetch('https://us-central1-plantora-ai-002.cloudfunctions.net/analyzePlant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) throw new Error("Sunucu hatası: " + res.status);
      return res.json();
    })
    .then(data => {
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 2500 - elapsed);

      setTimeout(() => {
        clearInterval(statusInterval);
        previewContainer.classList.add("hidden");

        activeScanTarget = {
          bitki: data.bitki || "Bilinmeyen Bitki",
          image: imgSrc,
          sağlık: data.sağlık !== undefined ? Number(data.sağlık) : 80,
          sorun: data.sorun || "Tespit edilemedi",
          yorum: data.yorum || "Bitki sağlık analizi yapıldı.",
          öneri: data.öneri || "Uygun bakım prosedürlerini sürdürün.",
          waterFrequencyDays: 7
        };

        renderResult(
          activeScanTarget!.bitki, 
          activeScanTarget!.sağlık, 
          activeScanTarget!.sorun, 
          activeScanTarget!.yorum, 
          activeScanTarget!.öneri, 
          "Plantora AI Canlı Analiz"
        );
      }, delay);
    })
    .catch(err => {
      console.warn("Backend API bağlantı hatası, simüle veriye geçiliyor:", err);
      const keys = Object.keys(PRESET_PLANTS);
      const randomPresetKey = keys[Math.floor(Math.random() * keys.length)];
      const chosen = PRESET_PLANTS[randomPresetKey];

      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 2500 - elapsed);

      setTimeout(() => {
        clearInterval(statusInterval);
        previewContainer.classList.add("hidden");

        activeScanTarget = {
          bitki: chosen.bitki,
          image: imgSrc,
          sağlık: chosen.sağlık,
          sorun: chosen.sorun,
          yorum: chosen.yorum,
          öneri: chosen.öneri,
          waterFrequencyDays: chosen.waterFrequencyDays
        };

        renderResult(
          chosen.bitki, 
          chosen.sağlık, 
          chosen.sorun, 
          chosen.yorum, 
          chosen.öneri, 
          "Simüle AI Raporu (Offline)"
        );
      }, delay);
    });
  }

  // Action for scanning local presets
  function triggerScanning(imgSrc: string, preset: typeof PRESET_PLANTS[keyof typeof PRESET_PLANTS]) {
    uploadZone.classList.add("hidden");
    resultCard.classList.add("hidden");
    quickPicker.classList.add("hidden");

    previewImg.src = imgSrc;
    previewContainer.classList.remove("hidden");
    renderUploadThumbnails();

    const statuses = [
      "Görsel yükleniyor...",
      "Görüntü analiz ediliyor...",
      "Modeller taranıyor...",
      "Sağlık raporu oluşturuluyor..."
    ];

    let statusIdx = 0;
    scanStatusOverlay.textContent = statuses[statusIdx];
    const statusInterval = setInterval(() => {
      statusIdx++;
      if (statusIdx < statuses.length) {
        scanStatusOverlay.textContent = statuses[statusIdx];
      }
    }, 500);

    setTimeout(() => {
      clearInterval(statusInterval);
      previewContainer.classList.add("hidden");
      
      activeScanTarget = {
        bitki: preset.bitki,
        image: imgSrc,
        sağlık: preset.sağlık,
        sorun: preset.sorun,
        yorum: preset.yorum,
        öneri: preset.öneri,
        waterFrequencyDays: preset.waterFrequencyDays
      };

      renderResult(
        preset.bitki, 
        preset.sağlık, 
        preset.sorun, 
        preset.yorum, 
        preset.öneri, 
        "Plantora AI Analizi"
      );
    }, 2000);
  }

  // Render health report style outputs
  function renderResult(bitki: string, sağlık: number, sorun: string, yorum: string, öneri: string, sourceBadge: string) {
    const resBadgeLabel = document.getElementById("result-badge-label") as HTMLSpanElement;
    const resHealthScore = document.getElementById("result-health-score") as HTMLDivElement;
    const resHealthBadge = document.getElementById("result-health-badge") as HTMLDivElement;
    const resStatus = document.getElementById("result-status") as HTMLDivElement;
    const resComment = document.getElementById("result-comment") as HTMLDivElement;
    const resRecommendation = document.getElementById("result-recommendation") as HTMLDivElement;
    const addToGardenBtn = document.getElementById("btn-add-to-garden") as HTMLButtonElement;

    // Adjust badge label
    if (resBadgeLabel) {
      resBadgeLabel.textContent = activeRescanPlantId ? "🌿 Gelişim Kaydediliyor..." : sourceBadge;
    }
    
    // Large prominent health score
    if (resHealthScore) {
      resHealthScore.textContent = `${sağlık}/100`;
    }
    
    // Status text badge
    if (resHealthBadge) {
      resHealthBadge.textContent = getHealthLabel(sağlık);
      resHealthBadge.className = "health-status-badge";
      const color = getHealthColor(sağlık);
      if (color === 'orange') resHealthBadge.classList.add("orange");
      if (color === 'red') resHealthBadge.classList.add("red");
    }

    // Report blocks
    if (resStatus) resStatus.textContent = `${bitki} - ${sorun}`;
    if (resComment) resComment.textContent = yorum;
    if (resRecommendation) resRecommendation.textContent = öneri;

    // Control inline nickname form
    const nicknameInput = document.getElementById("nickname-input") as HTMLInputElement;
    const nicknameWrapper = document.getElementById("nickname-form-wrapper") as HTMLDivElement;
    if (nicknameInput && nicknameWrapper) {
      if (activeRescanPlantId) {
        nicknameWrapper.classList.add("hidden");
      } else {
        nicknameWrapper.classList.remove("hidden");
        nicknameInput.value = bitki; // Auto pre-fill with detected name
      }
    }

    // Load image into result image banner
    const resultImageBanner = document.getElementById("result-image-banner") as HTMLDivElement;
    if (resultImageBanner && activeScanTarget && activeScanTarget.image) {
      resultImageBanner.style.backgroundImage = `url('${activeScanTarget.image}')`;
    }

    // Reset report scroll content to the top
    const resultScrollContent = document.querySelector(".result-scroll-content") as HTMLDivElement;
    if (resultScrollContent) {
      resultScrollContent.scrollTop = 0;
    }

    // If re-scanning, change "Bahçeme Ekle" button to "Raporu Kaydet"
    if (addToGardenBtn) {
      if (activeRescanPlantId) {
        addToGardenBtn.innerHTML = "Raporu Kaydet 📋";
      } else {
        addToGardenBtn.innerHTML = "Bahçeme Ekle 🌿";
      }
    }

    resultCard.classList.remove("hidden");
  }

  // Re-scan button click
  const reScanBtn = document.getElementById("btn-re-scan");
  if (reScanBtn) {
    reScanBtn.addEventListener("click", () => {
      resetScannerView(false);
    });
  }
}

// Add Plant & Garden logic
function setupGardenActions() {
  const addToGardenBtn = document.getElementById("btn-add-to-garden") as HTMLButtonElement;
  const resultCard = document.getElementById("result-card") as HTMLDivElement;
  const uploadZone = document.getElementById("upload-zone") as HTMLDivElement;
  const quickPicker = document.getElementById("quick-picker-section") as HTMLDivElement;

  if (addToGardenBtn) {
    addToGardenBtn.addEventListener("click", () => {
      if (!activeScanTarget) return;

      const dateStr = getFormattedDate();
      
      // Disable button to prevent double-clicks and show loading state
      addToGardenBtn.disabled = true;
      const originalText = addToGardenBtn.innerHTML;
      addToGardenBtn.innerHTML = "Kaydediliyor... ⏳";

      const plantId = activeRescanPlantId || 'plant_' + Date.now();

      // Loop through all uploaded photos, upload to storage, and keep their thumbnail/full resolutions
      const uploadPromises = uploadedPhotos.map((photo, index) => {
        const uniqueId = `${plantId}_${Date.now()}_${index}`;
        return getImageUrl(photo.full, uniqueId).then((url) => {
          return {
            thumbnail: photo.thumbnail,
            full: url
          };
        });
      });

      Promise.all(uploadPromises).then((newImagesArray) => {
        // IF RE-SCANNING AN EXISTING PLANT
        if (activeRescanPlantId) {
          const plantRef = db.collection("users").doc(currentUserId)
            .collection("plants").doc(plantId);

          return plantRef.get().then((docSnapshot: any) => {
            let existingImages: OptimizedImage[] = [];
            if (docSnapshot.exists) {
              const data = docSnapshot.data();
              existingImages = data.images || [];
            }
            const combinedImages = [...existingImages, ...newImagesArray];
            const primaryImageUrl = combinedImages.length > 0 ? combinedImages[combinedImages.length - 1].full : "/monstera.png";

            const updatedPlantData = {
              image: primaryImageUrl,
              images: combinedImages,
              needsWater: activeScanTarget!.sağlık < 85 && !activeScanTarget!.sorun.includes("Fazla sulama"),
              lastWateredDaysAgo: activeScanTarget!.sorun.includes("Fazla sulama") ? 0 : activeScanTarget!.waterFrequencyDays + 1,
              sağlık: activeScanTarget!.sağlık,
              sorun: activeScanTarget!.sorun,
              yorum: activeScanTarget!.yorum || "",
              öneri: activeScanTarget!.öneri || ""
            };

            return plantRef.update(updatedPlantData).then(() => {
              const reportId = 'rep_' + Date.now();
              return plantRef.collection("reports").doc(reportId).set({
                id: reportId,
                date: dateStr,
                sağlık: activeScanTarget!.sağlık,
                sorun: activeScanTarget!.sorun,
                yorum: activeScanTarget!.yorum || "",
                öneri: activeScanTarget!.öneri || "",
                image: primaryImageUrl,
                images: newImagesArray, // Save this scan's images specifically in the report
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }).then(() => {
              // Save to global archive
              const archiveRef = db.collection("analyses_archive").doc();
              return archiveRef.set({
                analysisId: archiveRef.id,
                userId: currentUserId,
                plantSpecies: activeScanTarget!.bitki,
                healthScore: activeScanTarget!.sağlık,
                detectedIssue: activeScanTarget!.sorun,
                comment: activeScanTarget!.yorum,
                recommendation: activeScanTarget!.öneri,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                dateStr: dateStr,
                season: getSeason(),
                location: userLocation || { city: "Bilinmiyor", region: "Bilinmiyor", country: "Bilinmiyor", latitude: 0, longitude: 0 },
                imageUrl: primaryImageUrl
              });
            });
          }).then(() => {
            addToGardenBtn.disabled = false;
            addToGardenBtn.innerHTML = originalText;
            
            showToast("Rapor Kaydedildi 📋", "Yeni sağlık raporu başarıyla kaydedildi!", "success");
            
            // Reset scanner state
            resultCard.classList.add("hidden");
            uploadZone.classList.remove("hidden");
            quickPicker.classList.remove("hidden");
            activeScanTarget = null;
            
            const targetPlantId = plantId;
            cancelRescanState();

            // Open details overlay for this plant immediately
            showPlantDetails(targetPlantId);
          });
        } 
        // IF ADDING A NEW PLANT
        else {
          const nicknameInput = document.getElementById("nickname-input") as HTMLInputElement;
          let nickname = nicknameInput ? nicknameInput.value.trim() : "";
          if (!nickname) {
            nickname = activeScanTarget!.bitki;
          }

          const primaryImageUrl = newImagesArray.length > 0 ? newImagesArray[0].full : "/monstera.png";

          const plantRef = db.collection("users").doc(currentUserId)
            .collection("plants").doc(plantId);

          const newPlantData = {
            nickname: nickname,
            bitki: activeScanTarget!.bitki,
            image: primaryImageUrl,
            images: newImagesArray,
            addedDate: dateStr,
            needsWater: activeScanTarget!.sağlık < 85 && !activeScanTarget!.sorun.includes("Fazla sulama"),
            waterFrequencyDays: activeScanTarget!.waterFrequencyDays,
            lastWateredDaysAgo: activeScanTarget!.sorun.includes("Fazla sulama") ? 0 : activeScanTarget!.waterFrequencyDays + 1,
            sağlık: activeScanTarget!.sağlık,
            sorun: activeScanTarget!.sorun,
            yorum: activeScanTarget!.yorum || "",
            öneri: activeScanTarget!.öneri || "",
            alarmEnabled: true,
            notificationsEnabled: true
          };

          return plantRef.set(newPlantData).then(() => {
            const reportId = 'rep_' + Date.now();
            return plantRef.collection("reports").doc(reportId).set({
              id: reportId,
              date: dateStr,
              sağlık: activeScanTarget!.sağlık,
              sorun: activeScanTarget!.sorun,
              yorum: activeScanTarget!.yorum || "",
              öneri: activeScanTarget!.öneri || "",
              image: primaryImageUrl,
              images: newImagesArray,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }).then(() => {
            // Save to global archive
            const archiveRef = db.collection("analyses_archive").doc();
            return archiveRef.set({
              analysisId: archiveRef.id,
              userId: currentUserId,
              plantSpecies: activeScanTarget!.bitki,
              healthScore: activeScanTarget!.sağlık,
              detectedIssue: activeScanTarget!.sorun,
              comment: activeScanTarget!.yorum,
              recommendation: activeScanTarget!.öneri,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              dateStr: dateStr,
              season: getSeason(),
              location: userLocation || { city: "Bilinmiyor", region: "Bilinmiyor", country: "Bilinmiyor", latitude: 0, longitude: 0 },
              imageUrl: primaryImageUrl
            });
          }).then(() => {
            addToGardenBtn.disabled = false;
            addToGardenBtn.innerHTML = originalText;
            
            showToast("Bahçeye Eklendi 🌱", "Bitkiniz bahçenize başarıyla eklendi!", "success");
            
            // Reset scanner state
            resultCard.classList.add("hidden");
            uploadZone.classList.remove("hidden");
            quickPicker.classList.remove("hidden");
            activeScanTarget = null;
            
            const targetPlantId = plantId;
            cancelRescanState();

            // Open details overlay for this plant immediately
            showPlantDetails(targetPlantId);
          });
        }
      }).catch((err: any) => {
        console.error("Error saving plant to Firestore:", err);
        addToGardenBtn.disabled = false;
        addToGardenBtn.innerHTML = originalText;
        showToast("Hata 🚨", "İşlem sırasında bir hata oluştu.", "danger");
      });
    });
  }
}

// ==========================================================================
// PLANT DETAILS OVERLAY ENGINE
// ==========================================================================
function setupDetailsOverlay() {
  const backBtn = document.getElementById("btn-detail-back");
  const overlay = document.getElementById("plant-detail-overlay") as HTMLDivElement;
  const rescanBtn = document.getElementById("btn-detail-rescan");

  if (backBtn && overlay) {
    backBtn.addEventListener("click", () => {
      overlay.classList.remove("active");
    });
  }

  // Yeniden Fotoğraf Tara action click
  if (rescanBtn && overlay) {
    rescanBtn.addEventListener("click", () => {
      const activePlantId = rescanBtn.getAttribute("data-plant-id");
      if (!activePlantId) return;

      const plant = garden.find(p => p.id === activePlantId);
      if (!plant) return;

      // Put app in re-scan mode
      activeRescanPlantId = plant.id;

      // Close details overlay
      overlay.classList.remove("active");

      // Go to scanner tab
      switchTab("view-scan");

      // Show alert/notice on upload zone
      const uploadHeader = document.querySelector('#upload-zone h4');
      if (uploadHeader) {
        uploadHeader.innerHTML = `📸 ${plant.nickname} İçin Yeni Fotoğraf Yükle`;
      }
    });
  }

  // Bitkiyi Sil action click
  const deleteBtn = document.getElementById("btn-delete-plant");
  if (deleteBtn && overlay) {
    deleteBtn.addEventListener("click", () => {
      const activePlantId = deleteBtn.getAttribute("data-plant-id");
      if (!activePlantId) return;

      const plant = garden.find(p => p.id === activePlantId);
      if (!plant) return;

      const confirmed = confirm(`"${plant.nickname || plant.bitki}" bitkisini ve tüm analiz geçmişini silmek istediğinize emin misiniz?`);
      if (!confirmed) return;

      deleteBtn.setAttribute("disabled", "true");
      const originalText = deleteBtn.innerHTML;
      deleteBtn.innerHTML = "Siliniyor... ⏳";

      const plantRef = db.collection("users").doc(currentUserId).collection("plants").doc(activePlantId);
      
      // 1. Fetch and delete reports
      plantRef.collection("reports").get().then((snapshot: any) => {
        const batch = db.batch();
        snapshot.forEach((doc: any) => {
          batch.delete(doc.ref);
        });
        return batch.commit();
      }).then(() => {
        // Also delete schedules if any
        return plantRef.collection("schedules").get().then((snapshot: any) => {
          const batch = db.batch();
          snapshot.forEach((doc: any) => {
            batch.delete(doc.ref);
          });
          return batch.commit();
        });
      }).then(() => {
        // 2. Delete parent plant doc
        return plantRef.delete();
      }).then(() => {
        overlay.classList.remove("active");
        showToast("Bitki Silindi 🗑️", `"${plant.nickname || plant.bitki}" bahçenizden kaldırıldı.`, "success");
        deleteBtn.removeAttribute("disabled");
        deleteBtn.innerHTML = originalText;
      }).catch((err: any) => {
        console.error("Error deleting plant:", err);
        deleteBtn.removeAttribute("disabled");
        deleteBtn.innerHTML = originalText;
        showToast("Hata 🚨", "Bitki silinemedi: " + err.message, "danger");
      });
    });
  }
}

// Carousel State
let carouselCurrentIndex = 0; // index of the active image slide inside the active report
let selectedReportIndex = 0;  // index of the active report in history
let activeReportImages: OptimizedImage[] = []; // images of the active report
let carouselReports: AnalysisReport[] = []; // all reports of the plant

// Touch/Mouse event handling for details image carousel
function setupCarouselGestures() {
  const container = document.getElementById("detail-carousel-container");
  const wrapper = document.getElementById("detail-carousel-wrapper");
  if (!container || !wrapper) return;

  let startX = 0;
  let isDragging = false;

  // Reset transforms
  wrapper.style.transform = `translateX(-${carouselCurrentIndex * 100}%)`;
  
  // Clean event listeners first by clone-replacing the element or binding to container
  const newContainer = container.cloneNode(true) as HTMLDivElement;
  container.parentNode!.replaceChild(newContainer, container);

  const freshWrapper = document.getElementById("detail-carousel-wrapper") as HTMLDivElement;

  newContainer.addEventListener("touchstart", touchStart, { passive: true });
  newContainer.addEventListener("touchend", touchEnd);
  newContainer.addEventListener("touchmove", touchMove, { passive: true });

  newContainer.addEventListener("mousedown", dragStart);
  newContainer.addEventListener("mouseup", dragEnd);
  newContainer.addEventListener("mouseleave", dragEnd);
  newContainer.addEventListener("mousemove", dragMove);

  // Bind nav buttons and dots events again since cloning strips them
  const prevBtn = document.getElementById("btn-carousel-prev");
  const nextBtn = document.getElementById("btn-carousel-next");
  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      if (carouselCurrentIndex > 0) {
        slideToImage(carouselCurrentIndex - 1);
      }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      if (carouselCurrentIndex < activeReportImages.length - 1) {
        slideToImage(carouselCurrentIndex + 1);
      }
    };
  }

  const dots = document.querySelectorAll(".carousel-dot");
  dots.forEach((dot, idx) => {
    dot.addEventListener("click", () => {
      slideToImage(idx);
    });
  });

  function dragStart(event: MouseEvent) {
    isDragging = true;
    startX = event.clientX;
    newContainer.style.cursor = 'grabbing';
  }

  function dragMove(event: MouseEvent) {
    if (!isDragging) return;
    const currentX = event.clientX;
    const diff = currentX - startX;
    const width = newContainer.offsetWidth;
    const translate = -carouselCurrentIndex * width + diff;
    freshWrapper.style.transition = 'none';
    freshWrapper.style.transform = `translateX(${translate}px)`;
  }

  function dragEnd(event: MouseEvent) {
    if (!isDragging) return;
    isDragging = false;
    newContainer.style.cursor = 'grab';
    const endX = event.clientX;
    const diff = endX - startX;
    
    freshWrapper.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    const threshold = 40; // swipe threshold in pixels
    if (diff < -threshold && carouselCurrentIndex < activeReportImages.length - 1) {
      slideToImage(carouselCurrentIndex + 1);
    } else if (diff > threshold && carouselCurrentIndex > 0) {
      slideToImage(carouselCurrentIndex - 1);
    } else {
      slideToImage(carouselCurrentIndex); // snap back
    }
  }

  function touchStart(event: TouchEvent) {
    startX = event.touches[0].clientX;
    isDragging = true;
  }

  function touchMove(event: TouchEvent) {
    if (!isDragging) return;
    const currentX = event.touches[0].clientX;
    const diff = currentX - startX;
    const width = newContainer.offsetWidth;
    const translate = -carouselCurrentIndex * width + diff;
    freshWrapper.style.transition = 'none';
    freshWrapper.style.transform = `translateX(${translate}px)`;
  }

  function touchEnd(event: TouchEvent) {
    if (!isDragging) return;
    isDragging = false;
    const endX = event.changedTouches[0].clientX;
    const diff = endX - startX;

    freshWrapper.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    const threshold = 40;
    if (diff < -threshold && carouselCurrentIndex < activeReportImages.length - 1) {
      slideToImage(carouselCurrentIndex + 1);
    } else if (diff > threshold && carouselCurrentIndex > 0) {
      slideToImage(carouselCurrentIndex - 1);
    } else {
      slideToImage(carouselCurrentIndex);
    }
  }
}

// Slide to specific image index of active report
function slideToImage(index: number) {
  const wrapper = document.getElementById("detail-carousel-wrapper");
  if (!wrapper) return;

  carouselCurrentIndex = Math.max(0, Math.min(index, activeReportImages.length - 1));
  wrapper.style.transform = `translateX(-${carouselCurrentIndex * 100}%)`;

  // Update pagination dots active state
  const dots = document.querySelectorAll(".carousel-dot");
  dots.forEach((dot, idx) => {
    if (idx === carouselCurrentIndex) dot.classList.add("active");
    else dot.classList.remove("active");
  });
}

// Select a specific report index in history
function selectReport(index: number) {
  if (index < 0 || index >= carouselReports.length) return;
  selectedReportIndex = index;
  const rep = carouselReports[index];

  // Populate activeReportImages
  activeReportImages = rep.images && rep.images.length > 0 ? rep.images : [{ thumbnail: rep.image || "/monstera.png", full: rep.image || "/monstera.png" }];
  
  // Render Carousel Slides
  const carouselWrapper = document.getElementById("detail-carousel-wrapper");
  const carouselDots = document.getElementById("detail-carousel-dots");
  
  if (carouselWrapper) {
    carouselWrapper.innerHTML = "";
    activeReportImages.forEach(img => {
      const slide = document.createElement("div");
      slide.className = "carousel-slide";
      slide.style.backgroundImage = `url('${img.full || img.thumbnail}')`;
      carouselWrapper.appendChild(slide);
    });
  }

  // Render Pagination Dots
  if (carouselDots) {
    carouselDots.innerHTML = "";
    activeReportImages.forEach((_, idx) => {
      const dot = document.createElement("div");
      dot.className = "carousel-dot";
      if (idx === 0) dot.classList.add("active");
      carouselDots.appendChild(dot);
    });
  }

  // Re-bind dot click events and gestures
  setupCarouselGestures();

  // Update texts and badges
  const detailHealthScore = document.getElementById("detail-health-score");
  const detailHealthBadge = document.getElementById("detail-health-badge-container");
  const detailReportStatus = document.getElementById("detail-report-status");
  const detailReportComment = document.getElementById("detail-report-comment");
  const detailReportRecommendation = document.getElementById("detail-report-recommendation");
  const detailLastAnalysis = document.getElementById("detail-last-analysis");

  if (detailHealthScore) detailHealthScore.textContent = String(rep.sağlık);
  if (detailLastAnalysis) detailLastAnalysis.textContent = rep.date;
  if (detailReportStatus) detailReportStatus.textContent = rep.sorun;
  if (detailReportComment) detailReportComment.textContent = rep.yorum;
  if (detailReportRecommendation) detailReportRecommendation.textContent = rep.öneri;

  if (detailHealthBadge) {
    detailHealthBadge.className = "detail-health-badge";
    const color = getHealthColor(rep.sağlık);
    if (color === 'orange') detailHealthBadge.classList.add("orange");
    if (color === 'red') detailHealthBadge.classList.add("red");
  }

  // Update timeline active state
  const allNodes = document.querySelectorAll("#detail-timeline .timeline-node");
  allNodes.forEach((node, idx) => {
    if (idx === index) {
      node.classList.add("active");
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      node.classList.remove("active");
    }
  });

  // Reset to first slide/image
  const wrapper = document.getElementById("detail-carousel-wrapper");
  if (wrapper) {
    wrapper.style.transition = "none";
    slideToImage(0);
    wrapper.offsetHeight; // force reflow
    wrapper.style.transition = "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  }
}

// Show plant detail page overlay
function showPlantDetails(plantId: string) {
  const overlay = document.getElementById("plant-detail-overlay") as HTMLDivElement;
  if (!overlay) return;

  const plant = garden.find(p => p.id === plantId);
  if (!plant) return;

  // Map elements
  const detailNickname = document.getElementById("detail-nickname") as HTMLHeadingElement;
  const detailSpecies = document.getElementById("detail-species") as HTMLSpanElement;
  const detailAddedDate = document.getElementById("detail-added-date") as HTMLSpanElement;
  const detailTimeline = document.getElementById("detail-timeline") as HTMLDivElement;
  const rescanBtn = document.getElementById("btn-detail-rescan") as HTMLButtonElement;

  // Fetch analysis reports from Firestore subcollection (asc order represents chronological journey!)
  db.collection("users").doc(currentUserId)
    .collection("plants").doc(plantId)
    .collection("reports").orderBy("createdAt", "asc")
    .get()
    .then((querySnapshot: any) => {
      const reports: AnalysisReport[] = [];
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        reports.push({
          id: doc.id,
          date: data.date || getFormattedDate(),
          sağlık: data.sağlık || 80,
          sorun: data.sorun || "Bilinmiyor",
          yorum: data.yorum || "",
          öneri: data.öneri || "",
          image: data.image || plant.image,
          images: data.images
        });
      });

      if (reports.length === 0) {
        reports.push({
          id: 'initial_' + plant.id,
          date: plant.addedDate,
          sağlık: plant.sağlık,
          sorun: plant.sorun,
          yorum: plant.yorum || "",
          öneri: plant.öneri || "",
          image: plant.image,
          images: plant.images
        });
      }

      plant.analyses = reports;
      carouselReports = reports;
      
      const latestReportIdx = reports.length - 1;

      // Bind basic values
      if (detailNickname) detailNickname.textContent = plant.nickname;
      if (detailSpecies) detailSpecies.textContent = plant.bitki;
      if (detailAddedDate) detailAddedDate.textContent = plant.addedDate;

      // Bind plant ID to rescan and delete buttons
      if (rescanBtn) {
        rescanBtn.setAttribute("data-plant-id", plant.id);
      }
      const deleteBtn = document.getElementById("btn-delete-plant") as HTMLButtonElement;
      if (deleteBtn) {
        deleteBtn.setAttribute("data-plant-id", plant.id);
      }

      // Bind Alarm & Notification Toggles
      const toggleAlarm = document.getElementById("detail-toggle-alarm") as HTMLInputElement;
      const toggleNotif = document.getElementById("detail-toggle-notifications") as HTMLInputElement;
      if (toggleAlarm) {
        toggleAlarm.checked = plant.alarmEnabled !== false;
        toggleAlarm.onchange = () => {
          const val = toggleAlarm.checked;
          db.collection("users").doc(currentUserId)
            .collection("plants").doc(plantId)
            .update({ alarmEnabled: val })
            .then(() => {
              plant.alarmEnabled = val;
              updateGardenUI();
              showToast(val ? "Alarm Açıldı 🚨" : "Alarm Kapatıldı 🔕", `${plant.nickname} için alarm ayarı güncellendi.`, "success");
            }).catch((err: any) => console.error("Error updating alarmEnabled:", err));
        };
      }
      if (toggleNotif) {
        toggleNotif.checked = plant.notificationsEnabled !== false;
        toggleNotif.onchange = () => {
          const val = toggleNotif.checked;
          db.collection("users").doc(currentUserId)
            .collection("plants").doc(plantId)
            .update({ notificationsEnabled: val })
            .then(() => {
              plant.notificationsEnabled = val;
              showToast(val ? "Bildirimler Açıldı 🔔" : "Bildirimler Kapatıldı 🔕", `${plant.nickname} için bildirim ayarı güncellendi.`, "success");
            }).catch((err: any) => console.error("Error updating notificationsEnabled:", err));
        };
      }

      // Render Timeline (Analysis History)
      if (detailTimeline) {
        detailTimeline.innerHTML = "";
        reports.forEach((rep, index) => {
          const node = document.createElement("div");
          node.className = "timeline-node";

          let labelText = `Sağlık Puanı: %${rep.sağlık}`;
          if (index === 0) {
            labelText = `🌱 Başlangıç (Sağlık: %${rep.sağlık})`;
          } else if (index === reports.length - 1) {
            labelText = `✨ Son Durum (Sağlık: %${rep.sağlık})`;
          }

          node.innerHTML = `
            <div class="timeline-date">${rep.date}</div>
            <div class="timeline-desc">${labelText} | ${rep.sorun}</div>
          `;

          // Timeline node click event
          node.addEventListener("click", () => {
            selectReport(index);
          });

          detailTimeline.appendChild(node);
        });
      }

      // Initialize the default selected report (latest one)
      selectReport(latestReportIdx);

      // Active overlay sliding transition
      overlay.classList.add("active");
    }).catch((err: any) => {
      console.error("Error fetching reports:", err);
    });
}

// Render Garden and Calendar Lists
function updateGardenUI() {
  const emptyState = document.getElementById("garden-list-empty") as HTMLDivElement;
  const gridState = document.getElementById("garden-grid") as HTMLDivElement;
  const plantCountEl = document.getElementById("plant-count") as HTMLSpanElement;

  if (garden.length === 0) {
    emptyState.classList.remove("hidden");
    gridState.classList.add("hidden");
    plantCountEl.textContent = "0";
    updateGardenHealthCard(0);
  } else {
    emptyState.classList.add("hidden");
    gridState.classList.remove("hidden");
    plantCountEl.textContent = String(garden.length);

    // Clear Grid
    gridState.innerHTML = "";
    
    let totalScore = 0;
    garden.forEach(plant => {
      totalScore += plant.sağlık;
      
      const card = document.createElement("div");
      
      // Determine alarm status
      const isAlarmEnabled = plant.alarmEnabled !== false;
      const isWaterOverdue = plant.needsWater || plant.lastWateredDaysAgo >= plant.waterFrequencyDays;
      const isLowHealth = plant.sağlık < 60;
      const triggerAlarm = isAlarmEnabled && (isLowHealth || isWaterOverdue);
      
      if (triggerAlarm) {
        card.className = "plant-card alarm-pulsing";
      } else {
        card.className = "plant-card";
      }
      
      const color = getHealthColor(plant.sağlık);
      let badgeColorClass = 'green';
      if (color === 'orange') badgeColorClass = 'orange';
      if (color === 'red') badgeColorClass = 'red';

      const latestAnalysis = plant.analyses && plant.analyses[0] 
        ? plant.analyses[0] 
        : { date: plant.addedDate };

      card.innerHTML = `
        <div class="plant-card-img" style="background-image: url('${plant.image}')">
          <div class="plant-card-health-badge ${badgeColorClass}">
            <span>%${plant.sağlık}</span>
          </div>
        </div>
        <div class="plant-card-body">
          <h4>${plant.nickname} ${triggerAlarm ? '<span style="color:var(--danger); font-size:0.8rem; margin-left: 4px;">🚨</span>' : ''}</h4>
          <span class="species">Son Rapor: ${latestAnalysis.date}</span>
          <div class="task-indicator">
            ${plant.needsWater 
              ? '<span style="color: var(--danger)">💧 Sulama Gerekli</span>' 
              : plant.sorun.includes("Fazla sulama") 
                ? '<span style="color: var(--warning)">⚠️ Kuru Tutun</span>'
                : '<span style="color: var(--success)">👍 Sağlıklı</span>'
            }
          </div>
        </div>
      `;

      // Open plant details overlay on card click
      card.addEventListener("click", () => {
        showPlantDetails(plant.id);
      });

      gridState.appendChild(card);
    });

    updateGardenHealthCard(Math.round(totalScore / garden.length));
  }

  updateCalendarUI();
}

function updateGardenHealthCard(avgScore: number) {
  const scoreEl = document.getElementById("garden-health-score") as HTMLDivElement;
  const statusEl = document.getElementById("garden-health-status") as HTMLParagraphElement;
  const strokeEl = document.getElementById("garden-health-stroke") as unknown as SVGPathElement;

  if (garden.length === 0) {
    scoreEl.textContent = "-%";
    statusEl.textContent = "Henüz bitki eklenmedi";
    strokeEl.style.strokeDasharray = "0, 100";
    return;
  }

  scoreEl.textContent = `%${avgScore}`;
  strokeEl.style.strokeDasharray = `${avgScore}, 100`;

  if (avgScore >= 85) {
    statusEl.textContent = "Mükemmel! Bitkileriniz çok sağlıklı ve mutlu 🌿";
    statusEl.style.color = "var(--success)";
  } else if (avgScore >= 60) {
    statusEl.textContent = "Bahçeniz iyi durumda, rutin bakımları takip edebilirsiniz. 👍";
    statusEl.style.color = "var(--success)";
  } else {
    statusEl.textContent = "Bazı bitkilerinizin sevgi dolu bir bakıma ihtiyacı var. 🚨";
    statusEl.style.color = "var(--warning)";
  }
}

// Render Calendar Tasks
function updateCalendarUI() {
  const emptyState = document.getElementById("calendar-empty") as HTMLDivElement;
  const listState = document.getElementById("calendar-list") as HTMLDivElement;

  const waterTasks = garden.filter(p => p.needsWater || p.lastWateredDaysAgo >= p.waterFrequencyDays);

  if (waterTasks.length === 0) {
    emptyState.classList.remove("hidden");
    listState.classList.add("hidden");
  } else {
    emptyState.classList.add("hidden");
    listState.classList.remove("hidden");
    listState.innerHTML = "";

    waterTasks.forEach(plant => {
      const row = document.createElement("div");
      row.className = "task-card";
      
      const color = getHealthColor(plant.sağlık);
      let badgeType = 'badge-warning';
      let urgencyText = 'Sulama Zamanı Yakın';
      if (color === 'red' || plant.needsWater) {
        badgeType = 'badge-danger';
        urgencyText = 'Acil Sulama Gerekli';
      }

      row.innerHTML = `
        <div class="task-info">
          <span class="badge ${badgeType}">${urgencyText}</span>
          <div class="task-title">${plant.nickname} (${plant.bitki})</div>
          <div class="task-subtitle">Sulama sıklığı: ${plant.waterFrequencyDays} günde bir</div>
        </div>
        <button class="btn btn-water btn-water-action" data-id="${plant.id}">Sulandı</button>
      `;

      // Attach Event Listener to Water Button
      const waterBtn = row.querySelector(".btn-water-action") as HTMLButtonElement;
      waterBtn.addEventListener("click", () => {
        handleWatering(plant.id);
      });

      listState.appendChild(row);
    });
  }
}

// Dynamic feedback loop when watering
function handleWatering(plantId: string) {
  const plant = garden.find(p => p.id === plantId);
  if (!plant) return;

  const plantRef = db.collection("users").doc(currentUserId)
    .collection("plants").doc(plantId);

  let updatedData: any = {};
  let feedback = "";

  if (plant.sorun.includes("Şiddetli susuzluk")) {
    updatedData = {
      sorun: "Belirgin bir sorun yok (Sağlıklı)",
      sağlık: 95,
      needsWater: false,
      lastWateredDaysAgo: 0,
      öneri: "Bitkiniz başarıyla kurtarıldı! Mevcut yerini koruyun."
    };
    feedback = `🌿 Harika İş! ${plant.nickname} bitkisini can suyu vererek susuzluktan kurtardınız. Sağlık puanı %95'e yükseldi!`;
    
    plantRef.update(updatedData).then(() => {
      return plantRef.collection("reports").orderBy("createdAt", "desc").limit(1).get();
    }).then((snap: any) => {
      if (!snap.empty) {
        const reportDoc = snap.docs[0];
        return reportDoc.ref.update({
          sağlık: 95,
          sorun: updatedData.sorun,
          öneri: updatedData.öneri
        });
      }
    }).catch((err: any) => console.error("Watering Firestore error:", err));
    
    showToast("Can Suyu Verildi 💧", feedback, "success");
  } else if (plant.sorun.includes("Fazla sulama") || plant.lastWateredDaysAgo === 0) {
    const newHealth = Math.max(10, plant.sağlık - 15);
    updatedData = {
      sağlık: newHealth,
      needsWater: false,
      lastWateredDaysAgo: 0
    };
    feedback = `⚠️ DİKKAT: ${plant.nickname} bitkiniz zaten aşırı sulanmış durumda veya yakın zamanda sulandı! Tekrar sulamak kök çürümesini tetikler. Lütfen toprağın kurumasını bekleyin!`;
    
    plantRef.update(updatedData).then(() => {
      return plantRef.collection("reports").orderBy("createdAt", "desc").limit(1).get();
    }).then((snap: any) => {
      if (!snap.empty) {
        const reportDoc = snap.docs[0];
        return reportDoc.ref.update({ sağlık: newHealth });
      }
    }).catch((err: any) => console.error("Watering Firestore error:", err));
    
    showToast("Dikkat ⚠️", feedback, "warning");
  } else {
    const newHealth = Math.min(100, plant.sağlık + 2);
    updatedData = {
      sağlık: newHealth,
      needsWater: false,
      lastWateredDaysAgo: 0
    };
    feedback = `💧 ${plant.nickname} başarıyla sulandı. Bakım takvimi güncellendi!`;
    
    plantRef.update(updatedData).then(() => {
      return plantRef.collection("reports").orderBy("createdAt", "desc").limit(1).get();
    }).then((snap: any) => {
      if (!snap.empty) {
        const reportDoc = snap.docs[0];
        return reportDoc.ref.update({ sağlık: newHealth });
      }
    }).catch((err: any) => console.error("Watering Firestore error:", err));
    
    showToast("Sulandı 💧", feedback, "success");
  }
}
