# EXPLAINER.md

## 1. The State Machine

The state machine lives in a single file: `kyc/state_machine.py`.

```python
class KYCStateMachine:
    TRANSITIONS = {
        "draft": ["submitted"],
        "submitted": ["under_review"],
        "under_review": ["approved", "rejected", "more_info_requested"],
        "more_info_requested": ["submitted"],
        "approved": [],
        "rejected": [],
    }

    @classmethod
    def validate_transition(cls, current_status, new_status):
        allowed = cls.TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise ValidationError(
                {
                    "status": (
                        f"Cannot transition from '{current_status}' to '{new_status}'. "
                        f"Allowed transitions from '{current_status}': {allowed or 'none (terminal state)'}."
                    )
                }
            )
```

**How it prevents illegal transitions:** The `TRANSITIONS` dict is the single source of truth. Every status change goes through `KYCSubmission.transition_to()`, which calls `KYCStateMachine.validate_transition()` before anything is saved. If the transition isn't in the allowed list, it raises a `ValidationError` which DRF converts to a 400 response. No view or serializer attempts to set status directly — they all go through `transition_to()`.

**Why a class, not scattered if-statements:** Having one dict means I can audit every legal transition by reading 6 lines. If I need to add a new state (e.g., `suspended`), I add one line to the dict. No risk of forgetting to update a view somewhere.

## 2. The Upload

File validation lives in `kyc/validators.py`:

```python
ALLOWED_FILE_TYPES = {"application/pdf", "image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def validate_document_file(file):
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"File type '{ext}' is not allowed. Accepted types: PDF, JPG, PNG."
        )

    if file.content_type not in ALLOWED_FILE_TYPES:
        raise ValidationError(
            f"Content type '{file.content_type}' is not allowed. "
            f"Accepted types: PDF, JPG, PNG."
        )

    if file.size > MAX_FILE_SIZE:
        size_mb = file.size / (1024 * 1024)
        raise ValidationError(
            f"File size {size_mb:.1f} MB exceeds the 5 MB limit."
        )
```

**Three layers of defense:**
1. **Extension check** — rejects `.exe`, `.sh`, etc. before looking at content.
2. **Content-type check** — the MIME type from the upload header. This isn't bulletproof (clients can spoof it), but it catches accidental mismatches.
3. **Size check** — rejects anything over 5 MB with a clear error.

**What happens with a 50 MB file:** Django's `DATA_UPLOAD_MAX_MEMORY_SIZE` and `FILE_UPLOAD_MAX_MEMORY_SIZE` are both set to 5 MB in settings.py. For files over 2.5 MB, Django streams to a temp file instead of holding it in memory, so a 50 MB upload won't OOM the server. The size check in `validate_document_file` catches it and returns a 400.

**Why I don't trust the client:** The frontend sets `accept=".pdf,.jpg,.jpeg,.png"` on the file input, but that's just UX. A curl request or modified frontend can send anything. All validation happens server-side in the serializer's `validate_file` method, which calls `validate_document_file`.

## 3. The Queue

The reviewer queue query (`kyc/views.py`, `ReviewerQueueView`):

```python
class ReviewerQueueView(generics.ListAPIView):
    def get_queryset(self):
        return (
            KYCSubmission.objects
            .filter(status__in=["submitted", "under_review"])
            .order_by("submitted_at")
        )
```

The SLA flag is computed dynamically as a model property (`kyc/models.py`):

```python
@property
def is_at_risk(self):
    if self.status not in ("submitted", "under_review"):
        return False
    if not self.submitted_at:
        return False
    return (timezone.now() - self.submitted_at).total_seconds() > 24 * 3600
```

**Why this approach:**
- The queue shows only actionable submissions (`submitted` and `under_review`), ordered oldest-first so reviewers naturally work the FIFO.
- `is_at_risk` is a computed property, not a stored flag. A stored boolean would go stale — you'd need a cron job to update it, and there's a window where it's wrong. Computing it on read means it's always accurate. The serializer includes it via `is_at_risk = serializers.BooleanField(read_only=True)`.

The metrics endpoint computes queue count, average time-in-queue, and 7-day approval rate:

```python
# Queue count
in_queue = KYCSubmission.objects.filter(status__in=["submitted", "under_review"]).count()

# Avg time in queue (computed in Python since we need timezone.now() - submitted_at)
total_seconds = sum((now - s.submitted_at).total_seconds() for s in queue_submissions)
avg_hours = (total_seconds / queue_submissions.count()) / 3600

# 7-day approval rate
decided_7d = KYCSubmission.objects.filter(status__in=["approved", "rejected"], reviewed_at__gte=seven_days_ago)
approval_rate = (approved_count / total_decided) * 100
```

## 4. The Auth

Merchant isolation is enforced at two levels:

**1. QuerySet filtering** — Merchants only ever see their own submissions. The queryset is scoped in every merchant view:

```python
class MerchantSubmissionListCreate(generics.ListCreateAPIView):
    permission_classes = [IsMerchant]

    def get_queryset(self):
        return KYCSubmission.objects.filter(merchant=self.request.user)

    def perform_create(self, serializer):
        serializer.save(merchant=self.request.user)
```

If merchant A requests `/merchant/submissions/5/` and submission #5 belongs to merchant B, the queryset returns nothing, and DRF returns 404 — not 403, which would leak the existence of the record.

**2. Permission classes** (`kyc/permissions.py`):

```python
class IsMerchant(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "merchant"

class IsReviewer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "reviewer"
```

A merchant hitting `/reviewer/queue/` gets 403. A reviewer hitting `/merchant/submissions/` gets 403. These are separate permission classes applied at the view level.

**Auth mechanism:** Token authentication via DRF's `rest_framework.authtoken`. On login/register, the API returns a token. The React frontend stores it in localStorage and sends `Authorization: Token <key>` on every request.

## 5. The AI Audit

**The bug:** When I used Cursor (with Claude as the backend model) to scaffold the `ReviewerMetricsView`, the generated code computed the average time-in-queue using a Django `Avg` aggregate on an `F()` expression:

```python
# What Cursor generated (buggy):
avg_time = KYCSubmission.objects.filter(
    status__in=["submitted", "under_review"]
).annotate(
    wait_time=timezone.now() - F("submitted_at")
).aggregate(avg=Avg("wait_time"))["avg"]
```

**What was wrong:** `timezone.now()` is a Python datetime, and `F("submitted_at")` is a database-level expression. Mixing them in an annotation doesn't work cleanly across database backends — on SQLite it produces garbage because SQLite stores datetimes as strings and can't do arithmetic with a Python datetime constant injected into the query. The query either errors or returns `None`.

**What I replaced it with:**

```python
queue_submissions = KYCSubmission.objects.filter(
    status__in=["submitted", "under_review"],
    submitted_at__isnull=False,
)
if queue_submissions.exists():
    total_seconds = sum(
        (now - s.submitted_at).total_seconds()
        for s in queue_submissions
    )
    avg_hours = (total_seconds / queue_submissions.count()) / 3600
else:
    avg_hours = 0.0
```

Computing the time difference in Python instead of the database is slightly less efficient at scale, but for a review queue (which is unlikely to have thousands of entries) it's correct, readable, and works on any database backend. I prioritized correctness over premature optimization.
