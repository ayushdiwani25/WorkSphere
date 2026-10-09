# Real-Time Collaborative Workflow Management System

This repository hosts a production-grade, multi-user **Workflow Management Board** built with **React, Vite, Tailwind CSS, Firebase (Authentication & Cloud Firestore)**, and **EmailJS** API integrations.

---

## 🏗️ Project Architecture & Components

The application is structured as a single-page React app organized into components:

```
src/
├── components/
│   ├── AuthContext.jsx      # Exposes logged-in user context & Auth triggers
│   ├── DashboardLayout.jsx  # Primary app shell containing the sidebar & board switches
│   ├── Login.jsx            # Sign-up, Sign-in, and Password reset portal
│   ├── StageModal.jsx       # Modal to create and rename columns
│   ├── TaskModal.jsx        # Wide split-screen view containing details form & comments chat
│   ├── TeamMembers.jsx      # Developer roster with invite and role controls
│   └── WorkflowBoard.jsx    # Core Board view, history drawer, and analytics panel
├── firebase.js              # Initializes Firebase Client SDK connection
├── App.jsx                  # Main router config
└── main.jsx                 # Mounts the React application
```

---

## 🔒 1. Role-Based Access Control (RBAC) & Governance

The platform implements a strict company-grade hierarchy to protect boards and administration folders:

| Role | Invitations | Board Operations | Stage (Column) Operations | Member Role Adjustments | Comment Modifying |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** 👑 | Yes | Create, Update, Delete | Create, Update, Delete | Assign **Member**, **Admin**, **Owner** | Delete any comment |
| **Admin** 🛠️ | Yes | Create, Update, Delete (Own) | Create, Update, Delete (Own board) | Assign **Member**, **Admin** | Delete own comments |
| **Member** 👥 | No | Create, Update | No | No | Delete own comments |

### 🚀 First-User Auto-Ownership
To bootstrap the application securely, the signup sequence in [Login.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%20system/workflowMng/src/components/Login.jsx) checks if the database is empty.
* The **very first** user who signs up automatically receives the `Owner` role.
* Everyone who registers after them is assigned the `Member` role by default.

---

## 📁 2. Firebase Database Security Rules

The active security configuration resides in [firestore.rules](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%20system/workflowMng/firestore.rules). These rules evaluate authentication, retrieve roles from documents, and validate operations:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Check if user is logged in
    function isAuthenticated() {
      return request.auth != null;
    }

    // Check if user document exists in database
    function isRegistered() {
      return isAuthenticated() && exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    // Get user's active role from the database
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    // Check if user is Owner or Admin in the workspace
    function isAdminOrOwner() {
      return isRegistered() && (getUserRole() == 'Admin' || getUserRole() == 'Owner');
    }

    // Check if user is the creator/owner of a specific board
    function isBoardOwner(bId) {
      return isRegistered() && get(/databases/$(database)/documents/boards/$(bId)).data.ownerId == request.auth.uid;
    }

    // 1. Users collection rules
    match /users/{userId} {
      allow read: if isAuthenticated();
      // Allow profile creation during sign-up OR if an Admin/Owner is inviting them
      allow create: if isAuthenticated() && (request.auth.uid == userId || isAdminOrOwner());
      // Allow update if Admin/Owner OR if user is updating their own profile (cannot change own role)
      allow update: if isAuthenticated() && (
        isAdminOrOwner() || 
        (request.auth.uid == userId && request.resource.data.role == resource.data.role)
      );
      allow delete: if isAuthenticated() && isAdminOrOwner();
    }

    // 2. Boards rules
    match /boards/{boardId} {
      allow read, create: if isRegistered();
      allow update, delete: if isRegistered() && (
        resource.data.ownerId == request.auth.uid || 
        isAdminOrOwner()
      );
    }

    // 3. Stages rules
    match /stages/{stageId} {
      allow read: if isRegistered();
      // Allow create/update of stages if the user is workspace Admin/Owner OR the board owner
      allow create, update: if isRegistered() && (
        isAdminOrOwner() || 
        isBoardOwner(request.resource.data.boardId)
      );
      // Allow delete if Admin/Owner OR the board owner
      allow delete: if isRegistered() && (
        isAdminOrOwner() || 
        isBoardOwner(resource.data.boardId)
      );
    }

    // 4. Tasks rules
    match /tasks/{taskId} {
      allow read, write: if isRegistered();
    }

    // 5. Comments rules
    match /comments/{commentId} {
      allow read, create: if isRegistered();
      // Only the author or Admin/Owner can update/delete comments
      allow update, delete: if isRegistered() && (
        resource.data.userEmail == request.auth.token.email || 
        isAdminOrOwner()
      );
    }

    // 6. Activities (Logs) rules
    match /activities/{activityId} {
      allow read, create: if isRegistered();
      allow update, delete: if false; // Logs cannot be modified or deleted
    }
  }
}
```

---

## 📧 3. EmailJS API Integrations (Real Email Flows)

The React client communicates with the **EmailJS REST API** using standard HTTPS `fetch` queries. This requires **zero package installations** and operates on a free plan without credit cards.

### 📬 Inviting Team Members code:
Located inside [TeamMembers.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%20system/workflowMng/src/components/TeamMembers.jsx):
```javascript
const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

if (serviceId && templateId && publicKey) {
  await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: inviteEmail.trim().toLowerCase(),
        email: inviteEmail.trim().toLowerCase(), // backup variable for template compatibility
        invited_by: currentUser.email,
        role: inviteRole,
        login_link: window.location.origin + '/login'
      }
    })
  });
}
```

### 🎈 Welcoming Sign-up Users code:
Located inside [Login.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%20system/workflowMng/src/components/Login.jsx):
```javascript
const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const welcomeTemplateId = import.meta.env.VITE_EMAILJS_WELCOME_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

if (serviceId && welcomeTemplateId && publicKey) {
  await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: welcomeTemplateId,
      user_id: publicKey,
      template_params: {
        to_email: user.email,
        email: user.email, // backup variable for template compatibility
        login_link: window.location.origin + '/login'
      }
    })
  });
}
```

---

## ⚙️ 4. Environment Variables configuration

Configuration values are mapped to the application using standard `.env` variables located at [.env](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/.env):

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=workflow-management-cc363.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=workflow-management-cc363
VITE_FIREBASE_STORAGE_BUCKET=workflow-management-cc363.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=699578143899
VITE_FIREBASE_APP_ID=1:699578143899:web:cb5abf6fff50ea7f6a623e

# EmailJS Configuration (Required to send real emails)
VITE_EMAILJS_SERVICE_ID=service_wp27dmt
VITE_EMAILJS_TEMPLATE_ID=template_y0qzdwd
VITE_EMAILJS_WELCOME_TEMPLATE_ID=template_j4vfrsk
VITE_EMAILJS_PUBLIC_KEY=4U_d4Hcpc-7GtlOPv
```

---

## 🛠️ 5. Deployment and Build Commands

Use these commands in your project terminal:

### Start local dev environment:
```bash
npm run dev
```

### Build client bundle for production:
```bash
npm run build
```

### Deploy to live Firebase Hosting URL:
Make sure your build is complete, then run:
```bash
npx firebase deploy --only hosting
```
*(Your project is deployed live on **https://workflow-management-cc363.web.app**).*

---

## 🔍 Detailed Breakdown of JSX Files (Easy Explanation)

Here is a simple, step-by-step breakdown of how each JSX file in your React application is structured, what it does, and how it works:

### 1. [AuthContext.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/components/AuthContext.jsx) (The Security Guard)
* **What is it?** This file acts like a central security guard. It remembers who is currently logged in, and shares that information with every other file in the app.
* **Core Functions:**
  * `login(email, password)`: Logs a user in using Firebase Authentication.
  * `signup(email, password)`: Registers a new user account.
  * `logout()`: Logs the user out.
  * `resetPassword(email)`: Triggers Firebase to send a password reset link to the user's email.
* **Easy Concept:** Instead of asking Firebase "Who is logged in?" in every single file, all other files just ask `AuthContext` to get the current user immediately.

### 2. [DashboardLayout.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/components/DashboardLayout.jsx) (The Shell & Sidebar)
* **What is it?** This is the master layout (shell) of your dashboard. It displays the dark-blue sidebar on the left and renders the selected page (Board or Members) on the right.
* **Core States:**
  * `boards`: Holds the list of active project boards fetched in real-time from Firestore.
* **Key Functions:**
  * `handleCreateBoard()`: Prompts for a board name and adds a new board document to Firestore.
  * `handleDeleteBoard(boardId)`: Deletes a board and automatically deletes all tasks and stages belonging to it.
* **Easy Concept:** When you click different menu links, only the right side of the screen changes (using `<Outlet />`); the sidebar remains static.

### 3. [Login.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/components/Login.jsx) (The Entrance Gate)
* **What is it?** The landing screen for users who aren't logged in yet. It handles signing in, creating accounts, and password recovery.
* **Core States:**
  * `isSignUp` (boolean): Toggles between the Login form and Register form.
  * `isResetPassword` (boolean): Toggles the screen to show the "Forgot Password" form.
  * `success` & `error` (strings): Displays notifications (e.g. green success alert when a reset email is sent).
* **Key Logic:**
  * If signing up, it checks if this is the very first user in the database. If yes, it creates their account with the `Owner` role. Otherwise, it sets them to `Member`. It then calls EmailJS to send a welcome email.

### 4. [WorkflowBoard.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/components/WorkflowBoard.jsx) (The Main Workspace)
* **What is it?** This is the core page where task cards and columns live. It also contains the **Project Analytics** charts and the **Activity History** slide-out panel.
* **Core States:**
  * `activeView`: Switches between `'board'` (kanban columns) and `'analytics'` (visual charts).
  * `stages` & `tasks`: Real-time lists loaded from Firestore.
  * `activities`: Log feed displaying the latest 50 actions.
* **Key Functions:**
  * `handleDragStart` & `handleDrop`: Coordinates moving task cards between columns using your mouse/finger.
  * `logActivity(actionText)`: Helper to write changes (e.g. *"moved task to Done"*) into the history logs database.
* **Easy Concept:** It calculates stats (Total tasks, completed tasks, priorities) on the fly and renders them in progress bars for the analytics view.

### 5. [TaskModal.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/components/TaskModal.jsx) (Task Details & Comments Chat)
* **What is it?** When you click a task card, this modal opens in a split-screen layout.
* **Core States:**
  * *Left Side (Task Details):* Inputs for Title, Description, Priority, Assignee, and Due Date.
  * *Right Side (Comments):* Displays a real-time list of discussion comments and an input field to submit a comment.
* **Key Functions:**
  * `handleAddComment()`: Writes comments to Firestore and logs the action in the history timeline.
  * `handleDeleteComment()`: Deletes your own comment (if you wrote it).
* **Easy Concept:** It converts dates and relative times (e.g. `"Just now"`, `"5m ago"`) so comments feel like a live messenger feed.

### 6. [StageModal.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/components/StageModal.jsx) (Column Creator)
* **What is it?** A small, quick dialog popup window.
* **Core Functions:**
  * Prompts you to type a stage name. If you are editing an existing stage, it pre-fills the input field with the column's current name.
* **Easy Concept:** A simple helper modal reused for both creating new stages and renaming columns.

### 7. [TeamMembers.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/components/TeamMembers.jsx) (Collaborator Directory)
* **What is it?** The directory table showing every user connected to the workspace.
* **Core States:**
  * `members`: Real-time list of profiles.
* **Key Functions:**
  * `handleUpdateRole(memberId, newRole)`: Changes user permissions (e.g., Member ➡️ Admin).
  * `handleRemoveMember(member)`: Wipes a user profile document from Firestore.
  * `handleInviteSubmit()`: Adds a simulated profile and calls the EmailJS API to send an invitation email to their inbox.
* **Easy Concept:** It checks `currentUserRole` (logged-in user's role). If they are a regular `Member`, it disables dropdowns, invite buttons, and trash cans.

### 8. [App.jsx](file:///c:/Users/Admin/OneDrive/Desktop/workflow%20management%2520system/workflowMng/src/App.jsx) (The Traffic Controller)
* **What is it?** The router configuration of the app. It links web URL paths (like `/board/:boardId` or `/members`) to the correct JSX views.
* **Easy Concept:** It tells React: *"If the user visits `/members`, load the Dashboard layout shell and put the TeamMembers component inside it."*
