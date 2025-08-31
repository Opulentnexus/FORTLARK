// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyD1j1NOcVwyPR3LAw025JBHM_1dN_G6qUc",
  authDomain: "fortlark.firebaseapp.com",
  projectId: "fortlark",
  storageBucket: "fortlark.firebasestorage.app",
  messagingSenderId: "908161926384",
  appId: "1:908161926384:web:582dfda11536e1bd6c2e35",
  measurementId: "G-YH4LFRZNFL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements
const loginContainer = document.getElementById("loginContainer");
const dashboardContainer = document.getElementById("dashboardContainer");
const userNameSpan = document.getElementById("userName");
const errorMsg = document.getElementById("errorMsg");
const chittTableBody = document.querySelector("#chittTable tbody");

// Login button
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "Please enter email and password";
    return;
  }

  try {
    // Sign in with Firebase Auth
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Fetch Firestore user data
const snapshot = await db.collection("users").where("email", "==", email).get();
if (snapshot.empty) {
  errorMsg.textContent = "User data not found!";
  return;
}

const userDoc = snapshot.docs[0];     // 👈 get actual document
const userData = userDoc.data();

// Show dashboard
userNameSpan.textContent = userData.name || "Customer";
loginContainer.classList.add("hidden");
dashboardContainer.classList.remove("hidden");


// After you set the name and show dashboard:
userNameSpan.textContent = userData.name || "Customer";
loginContainer.classList.add("hidden");
dashboardContainer.classList.remove("hidden");

// NEW: show profit if available
const profitSpan = document.getElementById("userProfit");
if (profitSpan) {
  profitSpan.textContent = Number(userData.profit || 0);
}



 // NEW: Calculate total paid
  const totalPaidSpan = document.getElementById("userTotalPaid");
  if (totalPaidSpan && userData.payments) {
    const totalPaid = Object.values(userData.payments)
      .filter(p => p.status) // only count paid
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    totalPaidSpan.textContent = totalPaid;
  } else if (totalPaidSpan) {
    totalPaidSpan.textContent = 0;
  }



// Load Chitt / ledger data with the correct Firestore doc ID
loadChitt(userDoc.id);


  } catch (err) {
    console.error(err);
    if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
      errorMsg.textContent = "Invalid email or password";
    } else {
      errorMsg.textContent = "Error logging in: " + err.message;
    }
  }
});

// Popup function
function showWinnerPopup(message) {
  const popup = document.getElementById("winnerTopupPopup");
  popup.textContent = message;
  popup.classList.remove("hidden");
  popup.classList.add("show");

  // auto-hide after 4 seconds
  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => popup.classList.add("hidden"), 400);
  }, 4000);
}

// Listen for Winner Top-up updates
db.collection("settings").doc("winnerTopup").onSnapshot((docSnap) => {
  if (docSnap.exists) {
    const data = docSnap.data();
    if (data.amount && data.date) {
      showWinnerPopup(`Winner top-up: ₹${data.amount} on ${data.date}`);
    }
  }
});





// Logout button
document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
  loginContainer.classList.remove("hidden");
  dashboardContainer.classList.add("hidden");
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  chittTableBody.innerHTML = "";
});

// Load Chitt / ledger data
async function loadChitt(userId) {
  // Fetch the user document directly from "users" collection
  const userDoc = await db.collection("users").doc(userId).get();
  chittTableBody.innerHTML = "";

  if (!userDoc.exists) {
    chittTableBody.innerHTML = "<tr><td colspan='3'>No data found</td></tr>";
    return;
  }

  const userData = userDoc.data();


  // NEW: update profit display from latest doc data
  const profitSpan = document.getElementById("userProfit");
  if (profitSpan) {
    profitSpan.textContent = Number(userData.profit || 0);
  }


if (userData.payments) {
  // Turn object into array
  const sortedPayments = Object.entries(userData.payments).sort(([monthA], [monthB]) => {
    try {
      // Try to parse as date
      const dateA = new Date(monthA);
      const dateB = new Date(monthB);

      // If valid dates, compare normally
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateA - dateB;
      }

      // If not valid dates, fallback to string sort
      return monthA.localeCompare(monthB);
    } catch (err) {
      // If something goes wrong, keep original order
      return 0;
    }
  });

  sortedPayments.forEach(([month, payment]) => {
    const row = `<tr>
      <td>${month}</td>
      <td>₹${payment.amount || 0}</td>
      <td>${payment.status ? "Paid" : "Unpaid"}</td>
    </tr>`;
    chittTableBody.innerHTML += row;
  });
} else {
  chittTableBody.innerHTML = "<tr><td colspan='3'>No payments yet</td></tr>";
}
}
