# SCINTILLA — Literary & Arts Magazine

> **Igniting Minds. Illuminating Ideas.**  
> Official student-run campus magazine of Shiv Nadar University Chennai.

---

## 📖 Overview

**Scintilla** is the official student-run literary and arts magazine of Shiv Nadar University Chennai (SNU Chennai). Built by students, for students, Scintilla provides a creative platform where ideas ignite, stories unfold, and artistic expressions—spanning poetry, fiction, non-fiction, articles, photography, artworks, and multilingual pieces—find a home.

This repository contains the complete frontend web portal and the secure Node.js backend integration layer powering student authentication, multi-work submissions, file storage, and editorial record tracking.

---

## ✨ Key Features

- **Editorial Showcase & Archive**: Engaging landing page presenting the magazine’s mission, past publications (First Edition download), curated categories, and student editorial/design masthead.
- **Interactive Announcement Reveal**: Interactive envelope animation with typewriter text and animated illustration for monthly themes.
- **Institutional Microsoft SSO**: Secure single sign-on using **MSAL.js** restricted exclusively to `@snuchennai.edu.in` accounts.
- **Multi-Item Submission Cart**: Submitters can add multiple works across different categories (uploading files or pasting text directly) before submitting all entries in one batch.
- **Automated Cloud Storage**: Submitted works are sanitised, renamed with structured naming conventions (`{Name}_{Category}_{Title}.{ext}`), and stored in categorized folders within Microsoft OneDrive via the Microsoft Graph API.
- **Editorial Workbook Logging**: Metadata for every submission is appended in real-time to a centralized Excel workbook table for editorial review.
- **Enterprise-Grade Security**:
  - MIME-type verification using file buffer magic bytes.
  - Per-file (25 MB) and total request body (75 MB) upload limits.
  - Multi-tier rate limiting (global, upload endpoint, and status check).
  - Timing-safe authentication token checks on health check routes.
  - Strict Content Security Policy (CSP), CORS whitelisting, and Permissions Policy via Helmet.js.

---

## 🛠 Tech Stack

### Frontend
- **HTML5 & Vanilla CSS3**: Custom design system, responsive typography with `clamp()`, smooth CSS animations, and grid/flexbox layouts.
- **JavaScript (ES6+)**: Interactive cart state management, dynamic file handling, drag-and-drop file uploaders, and fetch API integration.
- **MSAL Browser v2 (`msal-browser`)**: Microsoft Authentication Library for institutional Azure AD SSO popup flow.

### Backend
- **Node.js (>= 18.0.0 LTS) & Express.js 5**: Robust REST API service.
- **Microsoft Graph API & `@azure/msal-node`**: OAuth 2.0 Client Credentials flow for automated OneDrive uploads and Excel workbook updates.
- **Multer**: Memory storage for zero-disk-footprint streaming of uploaded files.
- **Joi**: Strict request payload schema validation and control character sanitization.
- **file-type**: Magic-byte MIME type validation.
- **Helmet & express-rate-limit**: HTTP security headers and IP rate limiting.
- **Winston & winston-daily-rotate-file**: Structured JSON logging with daily rotation.

---

## 🏗 Architecture & Data Flow

```
[ submit.html (Browser) ]
       │
       │ (1) User signs in via MSAL (@snuchennai.edu.in)
       │ (2) Adds works to submission cart
       │ (3) POST /api/v1/submit (multipart/form-data)
       ▼
[ Security Middleware ] ──► HTTPS redirect, CORS whitelist, Helmet headers, Rate limiting
       │
       ▼
[ Multer & Validation ] ──► In-memory buffer parsing, Magic-byte MIME check, Joi schema validation
       │
       ▼
[ Submission Controller ]
       ├─────────────────────────────────┐
       ▼                                 ▼
[ OneDrive Service ]             [ Excel Service ]
  • Category folder lookup/create   • Append row to table:
  • Sanitized filename formatting     [ID, Time, Name, Email, Course,
  • Graph API resumable upload         Year, Category, Title, Link]
  • Shareable link generation
       │                                 │
       └────────────────┬────────────────┘
                        ▼
       [ JSON Response 200 / 207 Multi-Status ]
```

---

## 📁 Project Structure

```
Scintilla-website/
├── assets/                       # Images, logos, icons, and graphic elements
├── publish/                      # Category preview artwork (poetry, articles, etc.)
├── index.html                    # Main landing page & magazine showcase
├── scintilla_login.html          # Microsoft Azure AD SSO login page
├── submit.html                   # Multi-work submission form & cart interface
├── scintilla-backend/            # Node.js backend integration service
│   ├── src/
│   │   ├── app.js                # Express app configuration & middleware pipeline
│   │   ├── config/
│   │   │   └── index.js          # Centralized environment variable accessor
│   │   ├── controllers/
│   │   │   └── submissionController.js # Multi-file submission coordinator
│   │   ├── middleware/
│   │   │   ├── rateLimiter.js    # Global, submit, and status rate limiters
│   │   │   ├── security.js       # CORS, CSP, Permissions-Policy, HTTPS redirect
│   │   │   └── validate.js       # Joi schemas & control character sanitizer
│   │   ├── routes/
│   │   │   ├── status.js         # GET /api/v1/status (Timing-safe token check)
│   │   │   └── submit.js         # POST /api/v1/submit
│   │   ├── services/
│   │   │   ├── excelService.js   # Microsoft Graph API Excel table logger
│   │   │   ├── graphAuth.js      # Azure AD MSAL client credentials manager
│   │   │   └── oneDriveService.js# OneDrive folder & file upload manager
│   │   └── utils/
│   │       ├── fileRenamer.js    # Structured filename sanitization
│   │       ├── logger.js         # Winston logger configuration
│   │       └── retry.js          # Exponential back-off retry utility
│   ├── tests/                    # Automated Node.js native test suite
│   │   ├── app.test.js           # Express route & 404 integration tests
│   │   ├── fileRenamer.test.js   # Sanitization & extension unit tests
│   │   ├── security.test.js      # CORS, header, and policy tests
│   │   └── validate.test.js      # Joi schema & payload validation tests
│   ├── .env.example              # Environment variables template
│   ├── .gitignore                # Backend ignore rules
│   ├── package.json              # Project dependencies and npm scripts
│   └── server.js                 # Server entrypoint & graceful shutdown
├── .gitignore                    # Root repository ignore rules
└── README.md                     # Project documentation
```

---

## ⚙️ Environment Variables

Copy the template in `scintilla-backend/.env.example` to `scintilla-backend/.env`:

```bash
cp scintilla-backend/.env.example scintilla-backend/.env
```

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `MS_TENANT_ID` | Azure AD Directory (Tenant) ID | `your-azure-tenant-id` |
| `MS_CLIENT_ID` | Azure AD Application (Client) ID | `your-azure-client-id` |
| `MS_CLIENT_SECRET` | Azure AD App Registration Client Secret | `your-azure-client-secret` |
| `MS_DRIVE_USER_ID` | Principal name (email) of the OneDrive host | `scintilla@snuchennai.edu.in` |
| `MS_ONEDRIVE_ROOT_FOLDER` | Root folder name in OneDrive for submissions | `ScintillaSubmissions` |
| `MS_EXCEL_WORKBOOK_PATH` | Path to Excel tracker file relative to OneDrive root | `ScintillaSubmissions/Submissions.xlsx` |
| `MS_EXCEL_TABLE_NAME` | Excel table name inside the tracker workbook | `Submissions` |
| `STATUS_BEARER_TOKEN` | Bearer token protecting the `/api/v1/status` endpoint | `your_super_secret_token` |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist | `https://scintillamag.in,http://localhost:5500` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `PORT` | Backend HTTP listening port | `3000` |
| `REQUEST_TIMEOUT_MS` | Request timeout in milliseconds | `30000` |

> ⚠️ **Security Notice**: Never commit `.env` or credential files to Git. Secrets must be configured via your hosting provider's environment settings in production.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18.0.0 or higher (LTS recommended)
- **npm** v9 or higher
- Python 3 (optional, for serving static frontend locally)

### 2. Installation
Clone the repository and install backend dependencies:
```bash
git clone https://github.com/NhavyaeUS/Scintilla-website.git
cd Scintilla-website/scintilla-backend
npm install
```

### 3. Running Tests & Linting
Run the automated test suite and syntax verification:
```bash
# Run unit & integration tests
npm test

# Run syntax and lint checks
npm run lint
```

### 4. Running Locally

#### Start the Backend API Server:
```bash
cd scintilla-backend
npm start
# Server starts on http://localhost:3000
```

#### Start the Frontend Web Server (in a separate terminal at project root):
```bash
# From the root directory:
python3 -m http.server 5500
```
Open **[http://localhost:5500](http://localhost:5500)** in your browser.

---

## 🌐 API Endpoints Reference

### Public Endpoints
- `GET /api/v1/version`: Returns API version and deployment timestamp.
- `POST /api/v1/submit`: Accepts `multipart/form-data` with fields `name`, `email`, `course`, `year`, `submissions` (JSON array), and `files` (binary attachments).

### Protected Endpoints
- `GET /api/v1/status`: Health check verifying server uptime and Microsoft Graph / OneDrive / Excel connectivity. Requires `Authorization: Bearer <STATUS_BEARER_TOKEN>`.

---

## 🚢 Deployment

1. **Deploying the Backend**:
   - Platform: **Render**, **Railway**, or any Node.js host.
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment Variables: Configure all variables from `.env.example`.
   - Health Check Path: `/api/v1/version` or `/api/v1/status` (with header).
2. **Deploying the Frontend**:
   - Host the root static files (`index.html`, `scintilla_login.html`, `submit.html`, `assets/`, `publish/`) on **GitHub Pages**, **Vercel**, **Netlify**, or **Cloudflare Pages**.
   - Update `ALLOWED_ORIGINS` on the backend with your production frontend domain.

---

## 📄 License

© 2026 Scintilla Literary & Arts Magazine, Shiv Nadar University Chennai. All rights reserved.
Code released for internal institutional operation.
