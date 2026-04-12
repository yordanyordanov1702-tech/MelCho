# Melexis Sofia — Production Planner

Production planning dashboard for Melexis Sofia semiconductor factory.

## Stack
- **Frontend**: React + Vite → Vercel
- **Backend**: Node.js + Express → Railway
- **Database**: SQLite (better-sqlite3)

## Production Lines
| Line | Machines | Operators |
|------|----------|-----------|
| Backend | 55 | 42 |
| T&F | 10 | 28 |
| SPEA | 2 | 35 |
| FT | 160 | 22 |
| Small FT | 15 | 18 |

## Features
1. **Production Load Monitor** — weekly load vs capacity, color-coded status
2. **OEE Tracking** — OEE % with arc gauge + machine grid visualization
3. **Headcount & Absence** — absence rate with color thresholds
4. **Certification Tracking** — operator cert expiry with EXPIRED/EXPIRING/WARNING/VALID status
5. **Excel Import** — bulk data entry via .xlsx upload

## Getting Started

```bash
# Backend
cd server && npm install && npm run dev

# Frontend (new terminal)
cd client && npm install && npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

## Excel Import Format

Create an `.xlsx` file with these sheets:

**Production**: `line_name | week | planned | capacity`  
**OEE**: `line_name | week | oee_percent | active_machines`  
**Operators**: `name | line_name | cert_expiry`

Week format: `2024-W01`  
Line names: `Backend`, `T&F`, `SPEA`, `FT`, `Small FT`

## Deployment

**Backend (Railway)**:
- Set `PORT` env variable (auto-set by Railway)

**Frontend (Vercel)**:
- Set `VITE_API_URL` to your Railway backend URL
