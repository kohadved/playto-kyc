from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework.authtoken.models import Token

from kyc.models import User, KYCSubmission, Notification


class Command(BaseCommand):
    help = "Seed the database with test data: 2 merchants and 1 reviewer"

    def handle(self, *args, **options):
        self.stdout.write("Seeding database...")

        # Create reviewer
        reviewer, created = User.objects.get_or_create(
            username="reviewer1",
            defaults={
                "email": "reviewer@playto.so",
                "role": "reviewer",
            },
        )
        if created:
            reviewer.set_password("reviewer123")
            reviewer.save()
        Token.objects.get_or_create(user=reviewer)
        self.stdout.write(f"  Reviewer: reviewer1 / reviewer123 (token: {Token.objects.get(user=reviewer).key})")

        # Create merchant 1 — submission in draft
        merchant1, created = User.objects.get_or_create(
            username="merchant1",
            defaults={
                "email": "merchant1@example.com",
                "role": "merchant",
                "phone": "+919876543210",
            },
        )
        if created:
            merchant1.set_password("merchant123")
            merchant1.save()
        Token.objects.get_or_create(user=merchant1)
        self.stdout.write(f"  Merchant: merchant1 / merchant123 (token: {Token.objects.get(user=merchant1).key})")

        if not KYCSubmission.objects.filter(merchant=merchant1).exists():
            KYCSubmission.objects.create(
                merchant=merchant1,
                status="draft",
                full_name="Aarav Sharma",
                email="aarav@agency.com",
                phone="+919876543210",
                business_name="Sharma Digital Agency",
                business_type="agency",
                expected_monthly_volume_usd=5000,
            )
            self.stdout.write("  Created draft submission for merchant1")

        # Create merchant 2 — submission in under_review
        merchant2, created = User.objects.get_or_create(
            username="merchant2",
            defaults={
                "email": "merchant2@example.com",
                "role": "merchant",
                "phone": "+919123456789",
            },
        )
        if created:
            merchant2.set_password("merchant123")
            merchant2.save()
        Token.objects.get_or_create(user=merchant2)
        self.stdout.write(f"  Merchant: merchant2 / merchant123 (token: {Token.objects.get(user=merchant2).key})")

        if not KYCSubmission.objects.filter(merchant=merchant2).exists():
            sub = KYCSubmission.objects.create(
                merchant=merchant2,
                status="under_review",
                full_name="Priya Patel",
                email="priya@freelance.com",
                phone="+919123456789",
                business_name="Priya Patel Freelancing",
                business_type="individual",
                expected_monthly_volume_usd=2000,
                submitted_at=timezone.now() - timedelta(hours=30),
                reviewer=reviewer,
            )
            # Create notification for the submission
            Notification.objects.create(
                merchant=merchant2,
                submission=sub,
                event_type="status_changed_to_submitted",
                payload={"old_status": "draft", "new_status": "submitted"},
            )
            Notification.objects.create(
                merchant=merchant2,
                submission=sub,
                event_type="status_changed_to_under_review",
                payload={"old_status": "submitted", "new_status": "under_review"},
            )
            self.stdout.write("  Created under_review submission for merchant2 (30h old, at_risk)")

        self.stdout.write(self.style.SUCCESS("\nSeeding complete!"))
        self.stdout.write("\nTest credentials:")
        self.stdout.write("  reviewer1 / reviewer123")
        self.stdout.write("  merchant1 / merchant123")
        self.stdout.write("  merchant2 / merchant123")
