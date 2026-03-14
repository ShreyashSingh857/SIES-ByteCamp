# 🚀 MERN Full Stack Template

![Node.js](https://img.shields.io/badge/Node.js-v14%2B-green) ![React](https://img.shields.io/badge/React-v18-blue) ![Express](https://img.shields.io/badge/Express-v4-lightgrey) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-forestgreen) ![License](https://img.shields.io/badge/License-MIT-yellow)

> A production-ready starter template for building full-stack web applications using the MERN stack (MongoDB, Express, React, Node.js). Designed for speed, scalability, and modularity.

---

## 📁 Project Structure

```
MERN_full_stack/
├── README.md
├── Backend/
│   ├── app.js
│   ├── index.js
│   ├── package.json
│   └── src/
│       ├── controllers/
│       │   └── auth.controller.js
│       ├── middlewares/
│       │   └── addHere.js
│       ├── models/
│       │   └── user.model.js
│       ├── routes/
│       │   ├── auth.route.js
│       │   └── user.route.js
│       ├── services/
│       │   └── auth.service.js
│       └── utils/
│           └── addhere.js
├── Frontend/
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── public/
│       └── src/
│           ├── App.jsx
│           ├── index.css
│           ├── main.jsx
│           ├── assets/
│           ├── components/
│           │   └── addHere.js
│           │   └── common/
│           │       ├── Button.jsx
│           │       └── Modal.jsx
│           ├── context/
│           │   └── authContext.jsx
│           ├── hooks/
│           │   ├── useAuth.js
│           │   └── useDebounce.js
│           ├── layouts/
│           ├── pages/
│           │   ├── Home.jsx
│           │   └── Login.jsx
│           ├── services/
│           │   ├── api.js
│           │   ├── auth.service.js
│           │   └── user.service.js
│           ├── styles/
│           │   └── global.css
│           └── utils/
│               ├── constants.js
│               └── helpers.js
```

---

## ⚡ Features
- **🔐 Full-Stack Authentication Ready:** Structure prepared for JWT/Session authentication.
- **🏗️ MVC Architecture:** Backend organized into Models, Views (Routes), and Controllers for better separation of concerns.
- **🌐 RESTful API:** Standardized API endpoints structure for easy integration.
- **⚛️ React Hooks:** Utilizes modern functional components and hooks for state management.
- **🌍 Environment Management:** Centralized configuration via `.env` for easy environment setup.
- **🔗 CORS Configured:** Seamless communication between frontend and backend.

## 🚀 Getting Started

### 📋 Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account (for database)

### 📦 Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/MERN_full_stack.git
   cd MERN_full_stack
   ```
2. Install backend dependencies:
   ```bash
   cd Backend
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd ../Frontend
   npm install
   ```

### 🏃‍♂️ Running the Application
1. Start the backend server:
   ```bash
   cd Backend
   npm start
   ```
2. Start the frontend development server:
   ```bash
   cd Frontend
   npm run dev
   ```

### 🤝 Contributing
Contributions are welcome! Let me know if there is scope of improvement or if any issue then raise issue.

### 📜 License
This project is licensed under the MIT License. free to use by anyone and speed up your development journey!

---

## 📞 Contact
For any inquiries, please reach out to [code369decode@gmail.com](mailto:code369decode@gmail.com).