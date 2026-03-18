# Smart Irrigation System

A full-stack application for smart irrigation monitoring and control.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **Python** (v3.10+) - Installed at: `C:\Users\Chandru P\AppData\Local\Programs\Python\Python311\python.exe`

### ⚡ Option 1: Quick Start (Both Servers)

```powershell
# From project root (SIH25062)
cd "SMART IRRIGATION SYSTEM"

# Terminal 1: Start Backend
cd backend

# Terminal 2: Start Frontend (in new terminal)
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173 (or 5174 if 5173 is in use)
- Backend: http://localhost:8000

### 🔧 Option 2: Step-by-Step Setup

### 🔧 Option 2: Step-by-Step Setup

#### 1. Backend Setup (Python FastAPI)

```powershell
# Navigate to backend folder
cd "SMART IRRIGATION SYSTEM\backend"

# Install dependencies
pip install -r requirements.txt

# Start the server
python -m uvicorn main:app --reload
```

**Backend will be available at:** http://localhost:8000
**Swagger API Docs:** http://localhost:8000/docs

#### 2. Frontend Setup (React + Vite)

```powershell
# Navigate to frontend folder
cd "SMART IRRIGATION SYSTEM\frontend"

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

**Frontend will be available at:** http://localhost:5173

#### 3. **CRITICAL: Fix Supabase Connection**

If you see `ERR_CONNECTION_TIMED_OUT` errors:

**Option A: Manual DNS Change (No Admin Required - RECOMMENDED):**

1. Press **Windows + R** → Type `ncpa.cpl` → Press Enter
2. Right-click **"Wi-Fi"** → Select **"Properties"**
3. Double-click **"Internet Protocol Version 4 (TCP/IPv4)"**
4. Select **"Use the following DNS server addresses"**:
   - Preferred DNS: `1.1.1.1`
   - Alternate DNS: `1.0.0.1`
5. Click **OK** twice
6. Refresh browser (Ctrl+Shift+R)

**Option B: PowerShell (Requires Admin):**

```powershell
# Run PowerShell as Administrator
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses ("1.1.1.1","1.0.0.1")
ipconfig /flushdns
```

**Option C: Command Prompt (Requires Admin):**

```cmd
# Run CMD as Administrator
netsh interface ipv4 set dns "Wi-Fi" static 1.1.1.1 primary
netsh interface ipv4 add dns "Wi-Fi" 1.0.0.1 index=2
ipconfig /flushdns
```

---

## � Features

- **📹 Face Recognition Login**: Simulated camera scan for user login
- **🌾 Field Monitoring Dashboard**: Real-time status of agricultural sectors
- **📊 Soil Analysis**: Detailed reports and crop recommendations
- **🌱 Crop Recommendation**: ML-powered crop suggestions based on soil data
- **📱 Multi-language Support**: English, Hindi, Tamil, Nepali

> **Note:** Face recognition is currently a simulation. In production, connect to backend for biometric verification.

---

## 🐛 Troubleshooting

### ❌ Python Error: "No Python at '...WindowsApps...'"

**Solution:** Your Python is installed at a different location. Use:

```powershell
# Find Python location
Get-Command python | Select-Object Source

# Use full path or ensure Python is in PATH
python -m uvicorn main:app --reload
```

### ❌ Port Already in Use

**Frontend (5173 in use):**
- Vite will automatically use 5174, 5175, etc.
- Or kill existing process:
  ```powershell
  Get-Process -Name node | Stop-Process -Force
  ```

**Backend (8000 in use):**
```powershell
# Find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <process_id> /F
```

---

---

## 🚀 Running with VS Code

1. Open the project folder in VS Code
2. Open 2 integrated terminals:
   - **Terminal 1 (Backend):**
     ```powershell
     cd backend
     python -m uvicorn main:app --reload
     ```
   - **Terminal 2 (Frontend):**
     ```powershell
     cd frontend
     npm run dev
     ```

---

## 📊 Project Structure

```
SMART IRRIGATION SYSTEM/
├── backend/              # FastAPI Python server
│   ├── main.py          # API endpoints & crop ML model
│   ├── requirements.txt # Python dependencies
│   └── ...
├── frontend/            # React + Vite UI
│   ├── src/
│   │   ├── pages/      # Dashboard, Login, Soil Analysis
│   │   ├── context/    # User & Language contexts
│   │   └── ...
│   └── package.json
└── README.md
```

---

## ✅ Current Status

- ✅ **Backend:** Running on http://localhost:8000
- ✅ **Frontend:** Running on http://localhost:5174
- ✅ **Login:** Simple camera simulation (no authentication required)

**Ready to use:** Just open http://localhost:5174 and select a user to login!

---

## 📝 Notes

- Python is installed at: `C:\Users\Chandru P\AppData\Local\Programs\Python\Python311\python.exe`
- Frontend auto-switches to alternative port if 5173 is busy
- Login uses camera simulation - no database connection required

---

## 🤝 Support

For issues:
1. Check **[TROUBLESHOOTING](#-troubleshooting)** section above
2. Ensure both backend (port 8000) and frontend (port 5173/5174) are running

---

**Last Updated:** February 24, 2026  
**Python Version:** 3.11.9  
**Node Version:** 18+  
**Vite Version:** 7.3.1