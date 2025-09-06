// ---------------- Firebase Config ----------------
const firebaseConfig = {
  apiKey: "AIzaSyD1j1NOcVwyPR3LAw025JBHM_1dN_G6qUc",
  authDomain: "fortlark.firebaseapp.com",
  projectId: "fortlark",
  storageBucket: "fortlark.firebasestorage.app",
  messagingSenderId: "908161926384",
  appId: "1:908161926384:web:582dfda11536e1bd6c2e35",
  measurementId: "G-YH4LFRZNFL"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------------- DOM elements ----------------
const loginContainer = document.getElementById("loginContainer");
const dashboardContainer = document.getElementById("dashboardContainer");
const userNameSpan = document.getElementById("userName");
const errorMsg = document.getElementById("errorMsg");
const chittTableBody = document.querySelector("#chittTable tbody");
const profitSpan = document.getElementById("userProfit");
const totalPaidSpan = document.getElementById("userTotalPaid");
const tabSwitcher = document.getElementById("chitTabs");

let currentChitType = "normal"; 
let currentListeningDocId = null;

// ---------------- Login ----------------
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "Please enter email and password";
    return;
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // find Firestore user doc by email
    const snapshot = await db.collection("users").where("email", "==", email).get();
    if (snapshot.empty) {
      errorMsg.textContent = "User data not found!";
      return;
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    currentListeningDocId = userDoc.id;

    // Default chit type
    if (userData.chitType === "both") currentChitType = "normal";
    else currentChitType = userData.chitType || "normal";

    // Show dashboard
    userNameSpan && (userNameSpan.textContent = userData.name || "Customer");
    loginContainer && loginContainer.classList.add("hidden");
    dashboardContainer && dashboardContainer.classList.remove("hidden");

    // Setup tabs + listener
    setupChitTabs(userData.chitType);
    listenUserData(userDoc.id);

  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Login error: " + (err.message || err);
  }
});

// ---------------- Setup chit tabs ----------------
function setupChitTabs(chitType) {
  if (!tabSwitcher) return;
  tabSwitcher.innerHTML = "";

  const makeBtn = (id, label, isActive) =>
    `<button id="${id}" class="${isActive ? "active" : ""}" style="margin-right:8px;">${label}</button>`;

  if (chitType === "both") {
    tabSwitcher.innerHTML = makeBtn("normalTab", "Normal Chit", currentChitType === "normal") +
                              makeBtn("goldTab", "Gold Chit", currentChitType === "gold");

    const normalTab = document.getElementById("normalTab");
    const goldTab = document.getElementById("goldTab");

    normalTab && normalTab.addEventListener("click", () => {
      currentChitType = "normal";
      updateActiveTab();
      renderChittTable(window.currentUserData || {});
    });

    goldTab && goldTab.addEventListener("click", () => {
      currentChitType = "gold";
      updateActiveTab();
      renderChittTable(window.currentUserData || {});
    });
  } else if (chitType === "normal") {
    tabSwitcher.innerHTML = makeBtn("onlyNormal", "Normal Chit", true);
    currentChitType = "normal";
  } else if (chitType === "gold") {
    tabSwitcher.innerHTML = makeBtn("onlyGold", "Gold Chit", true);
    currentChitType = "gold";
  }

  updateActiveTab();
}

function updateActiveTab() {
  if (!tabSwitcher) return;
  tabSwitcher.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));

  const id = currentChitType === "normal" 
    ? (document.getElementById("normalTab") ? "normalTab" : "onlyNormal")
    : (document.getElementById("goldTab") ? "goldTab" : "onlyGold");

  const activeBtn = document.getElementById(id);
  if (activeBtn) activeBtn.classList.add("active");
}

// ---------------- Real-time listener ----------------
function listenUserData(userId) {
  if (!userId) return;
  db.collection("users").doc(userId).onSnapshot((docSnap) => {
    if (!docSnap.exists) return;
    const userData = docSnap.data();
    window.currentUserData = userData;

    // Update header
    userNameSpan && (userNameSpan.textContent = userData.name || "Customer");

    // ✅ Show profits correctly based on chitType
    if (profitSpan) {
      if (userData.chitType === "normal") {
        profitSpan.innerHTML = `<strong>Normal Chit:</strong> ₹${Number(userData.profits?.normal || 0)}`;
      } else if (userData.chitType === "gold") {
        profitSpan.innerHTML = `<strong>Gold Chit:</strong> ₹${Number(userData.profits?.gold || 0)}`;
      } else if (userData.chitType === "both") {
        profitSpan.innerHTML = `
          <strong>Normal Chit:</strong> ₹${Number(userData.profits?.normal || 0)} <br>
          <strong>Gold Chit:</strong> ₹${Number(userData.profits?.gold || 0)}
        `;
      } else {
        profitSpan.innerHTML = `<em>No profit data</em>`;
      }
    }

    // Render table
    renderChittTable(userData);
  }, (err) => {
    console.error("listenUserData error:", err);
  });
}

// ---------------- Render chit table ----------------
function renderChittTable(userData) {
  chittTableBody && (chittTableBody.innerHTML = "");

  if (!userData) {
    chittTableBody.innerHTML = "<tr><td colspan='3'>No user data</td></tr>";
    totalPaidSpan && (totalPaidSpan.textContent = 0);
    return;
  }

  const showType = (userData.chitType === "both") ? currentChitType : (userData.chitType || "normal");
  const paymentsMap = getPaymentsMapForType(userData, showType);

  const totalPaid = computeTotalPaidFromMap(paymentsMap);
  totalPaidSpan && (totalPaidSpan.textContent = totalPaid);

  if (showType === "normal") {
    renderNormalChit(paymentsMap);
  } else if (showType === "gold") {
    renderGoldChit(paymentsMap);
  } else {
    chittTableBody.innerHTML = "<tr><td colspan='3'>No data to display</td></tr>";
  }
}

// ---------------- Helpers ----------------
function getPaymentsMapForType(userData, type) {
  if (type === "normal") {
    if (userData.payments && userData.payments.normal) {
      return userData.payments.normal;
    }
    if (userData.payments && !userData.payments.gold) {
      return userData.payments; // legacy = normal only
    }
    return {};
  }

  if (type === "gold") {
    if (userData.payments && userData.payments.gold) {
      return userData.payments.gold;
    }
    if (userData.goldChit) {
      return userData.goldChit;
    }
    return {};
  }

  return {};
}

function computeTotalPaidFromMap(mapObj) {
  if (!mapObj) return 0;
  return Object.values(mapObj)
    .filter(p => p && p.status === true)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

// ---------------- Renderers ----------------
function renderNormalChit(payments) {
  if (!chittTableBody) return;
  const months = Object.keys(payments || {});
  if (months.length === 0) {
    chittTableBody.innerHTML = "<tr><td colspan='3'>No Normal Chit data</td></tr>";
    return;
  }

  // ✅ Sort months in chronological order
  const sortedMonths = months.sort((a, b) => new Date(a) - new Date(b));

  sortedMonths.forEach(month => {
    const p = payments[month] || {};
    const row = `<tr>
      <td>${month}</td>
      <td>₹${p.amount || 2600}</td>
      <td>${p.status ? "Paid ✅" : "Unpaid ❌"}</td>
    </tr>`;
    chittTableBody.innerHTML += row;
  });
}

function renderGoldChit(payments) {
  if (!chittTableBody) return;
  const months = Object.keys(payments || {});
  if (months.length === 0) {
    chittTableBody.innerHTML = "<tr><td colspan='3'>No Gold Chit data</td></tr>";
    return;
  }

  // ✅ Sort months in chronological order
  const sortedMonths = months.sort((a, b) => new Date(a) - new Date(b));

  sortedMonths.forEach(month => {
    const p = payments[month] || {};
    const row = `<tr>
      <td>${month}</td>
      <td>₹${p.amount || 3000}</td>
      <td>${p.status ? "Paid ✅" : "Unpaid ❌"}</td>
    </tr>`;
    chittTableBody.innerHTML += row;
  });
}

// ---------------- Logout ----------------
document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
  loginContainer.classList.remove("hidden");
  dashboardContainer.classList.add("hidden");
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  chittTableBody.innerHTML = "";
  tabSwitcher.innerHTML = "";
  totalPaidSpan.textContent = 0;
  profitSpan.innerHTML = "";
});

