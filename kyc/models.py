from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from kyc.state_machine import KYCStateMachine


class User(AbstractUser):
    ROLE_CHOICES = [
        ("merchant", "Merchant"),
        ("reviewer", "Reviewer"),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="merchant")
    phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class KYCSubmission(models.Model):
    STATE_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("under_review", "Under Review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("more_info_requested", "More Info Requested"),
    ]
    BUSINESS_TYPE_CHOICES = [
        ("individual", "Individual / Freelancer"),
        ("agency", "Agency"),
        ("company", "Company"),
    ]

    merchant = models.ForeignKey(User, on_delete=models.CASCADE, related_name="submissions")
    status = models.CharField(max_length=25, choices=STATE_CHOICES, default="draft")

    # Personal details
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)

    # Business details
    business_name = models.CharField(max_length=255, blank=True)
    business_type = models.CharField(max_length=20, choices=BUSINESS_TYPE_CHOICES, blank=True)
    expected_monthly_volume_usd = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    # Review
    reviewer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviews"
    )
    review_reason = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["submitted_at"]

    def __str__(self):
        return f"KYC #{self.pk} - {self.merchant.username} ({self.status})"

    def transition_to(self, new_status, reviewer=None, reason=""):
        KYCStateMachine.validate_transition(self.status, new_status)

        old_status = self.status
        self.status = new_status

        if new_status == "submitted":
            self.submitted_at = timezone.now()
        elif new_status in ("approved", "rejected"):
            self.reviewed_at = timezone.now()

        if reviewer:
            self.reviewer = reviewer
        if reason:
            self.review_reason = reason

        self.save()

        Notification.objects.create(
            merchant=self.merchant,
            submission=self,
            event_type=f"status_changed_to_{new_status}",
            payload={
                "old_status": old_status,
                "new_status": new_status,
                "reason": reason,
            },
        )

        return self

    @property
    def is_at_risk(self):
        if self.status not in ("submitted", "under_review"):
            return False
        if not self.submitted_at:
            return False
        return (timezone.now() - self.submitted_at).total_seconds() > 24 * 3600


class Document(models.Model):
    DOC_TYPE_CHOICES = [
        ("pan", "PAN Card"),
        ("aadhaar", "Aadhaar Card"),
        ("bank_statement", "Bank Statement"),
    ]

    submission = models.ForeignKey(
        KYCSubmission, on_delete=models.CASCADE, related_name="documents"
    )
    doc_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES)
    file = models.FileField(upload_to="kyc_documents/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.doc_type} - {self.original_filename}"


class Notification(models.Model):
    merchant = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    submission = models.ForeignKey(
        KYCSubmission, on_delete=models.CASCADE, related_name="notifications"
    )
    event_type = models.CharField(max_length=50)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} for {self.merchant.username} at {self.created_at}"
