# Playto KYC Pipeline

A full-stack KYC onboarding system for Playto Pay. Merchants submit personal details, business information, and documents for review. Reviewers manage a queue, approve/reject submissions, and track SLA metrics.

**Stack:** Django + DRF (backend), React + Tailwind (frontend), SQLite (database), Token auth.

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend Setup

```bash
# From project root
pip install django djangorestframework django-cors-headers Pillow

python manage.py migrate
python manage.py seed          # Creates test users and submissions
python manage.py runserver     # http://localhost:8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm start                      # http://localhost:3000
```

### Test Credentials (after seeding)

| Username    | Password      | Role     | State              |
|-------------|---------------|----------|---------------------|
| reviewer1   | reviewer123   | Reviewer | —                   |
| merchant1   | merchant123   | Merchant | 1 draft submission  |
| merchant2   | merchant123   | Merchant | 1 under_review (at-risk, 30h old) |

### Running Tests

```bash
python manage.py test kyc
```

## API Endpoints

All under `/api/v1/`:

### Auth
- `POST /auth/register/` — Register new merchant
- `POST /auth/login/` — Login, get token
- `GET /auth/me/` — Current user info

### Merchant
- `GET/POST /merchant/submissions/` — List/create submissions
- `GET/PATCH /merchant/submissions/:id/` — View/edit draft
- `POST /merchant/submissions/:id/submit/` — Submit for review
- `POST /merchant/submissions/:id/documents/` — Upload document (multipart)
- `GET /merchant/notifications/` — List notifications

### Reviewer
- `GET /reviewer/queue/` — Review queue (submitted + under_review, oldest first)
- `GET /reviewer/submissions/` — All submissions (with `?status=` filter)
- `GET /reviewer/submissions/:id/` — Submission detail
- `POST /reviewer/submissions/:id/transition/` — Change status `{ "status": "...", "reason": "..." }`
- `GET /reviewer/metrics/` — Dashboard metrics

## State Machine

```
draft → submitted → under_review → approved
                                 → rejected
                                 → more_info_requested → submitted
```

Illegal transitions return 400 with a descriptive error message.

## Project Structure

```
├── backend/          # Django settings, URLs
├── kyc/              # Main app
│   ├── state_machine.py   # Single source of truth for transitions
│   ├── models.py          # User, KYCSubmission, Document, Notification
│   ├── serializers.py     # DRF serializers + validation
│   ├── views.py           # API views
│   ├── permissions.py     # Role-based permissions
│   ├── validators.py      # File upload validation
│   ├── tests.py           # Unit + integration tests
│   └── management/commands/seed.py
├── frontend/         # React + Tailwind
│   └── src/
│       ├── api.js         # Axios client
│       ├── AuthContext.js  # Auth state
│       └── pages/         # Login, Register, MerchantDashboard, KYCForm, ReviewerDashboard, ReviewerDetail
└── manage.py
```
