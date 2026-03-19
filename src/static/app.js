document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const authStatus = document.getElementById("auth-status");

  let accessToken = localStorage.getItem("accessToken");
  let currentUser = null;

  function getRole() {
    return currentUser?.role || null;
  }

  function canManageActivities() {
    const role = getRole();
    return role === "Administrator" || role === "Faculty";
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function getAuthHeaders() {
    if (!accessToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  function updateAuthUI() {
    if (currentUser) {
      authStatus.textContent = `Logged in as ${currentUser.username} (${currentUser.role})`;
      authStatus.className = "auth-status info";
      authStatus.classList.remove("hidden");
      logoutBtn.classList.remove("hidden");
      loginForm.classList.add("hidden");
    } else {
      authStatus.textContent = "Not logged in";
      authStatus.className = "auth-status info";
      authStatus.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      loginForm.classList.remove("hidden");
    }

    const isManager = canManageActivities();
    signupForm.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !isManager;
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      const showDeleteButtons = canManageActivities();

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${
                          showDeleteButtons
                            ? `<button class="delete-btn" data-activity="${name}" data-email="${email}" title="Unregister student">❌</button>`
                            : ""
                        }
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!canManageActivities()) {
      showMessage("Only Administrator and Faculty accounts can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      accessToken = result.access_token;
      currentUser = result.user;
      localStorage.setItem("accessToken", accessToken);
      loginForm.reset();
      updateAuthUI();
      await fetchActivities();
      showMessage(result.message, "success");
    } catch (error) {
      console.error("Login failed:", error);
      showMessage("Failed to log in. Please try again.", "error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (accessToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
        });
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      accessToken = null;
      currentUser = null;
      localStorage.removeItem("accessToken");
      updateAuthUI();
      await fetchActivities();
      showMessage("Logged out", "info");
    }
  });

  async function initializeSession() {
    if (!accessToken) {
      updateAuthUI();
      await fetchActivities();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Invalid session");
      }

      currentUser = await response.json();
    } catch (error) {
      console.error("Session restore failed:", error);
      accessToken = null;
      currentUser = null;
      localStorage.removeItem("accessToken");
    }

    updateAuthUI();
    await fetchActivities();
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!canManageActivities()) {
      showMessage("Only Administrator and Faculty accounts can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  initializeSession();
});
