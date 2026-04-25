from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase, APIClient
from rest_framework.authtoken.models import Token

from kyc.models import User, KYCSubmission
from kyc.state_machine import KYCStateMachine


class StateMachineUnitTest(TestCase):
    """Unit tests for the KYC state machine transitions."""

    def test_valid_transitions(self):
        valid = [
            ("draft", "submitted"),
            ("submitted", "under_review"),
            ("under_review", "approved"),
            ("under_review", "rejected"),
            ("under_review", "more_info_requested"),
            ("more_info_requested", "submitted"),
        ]
        for current, new in valid:
            KYCStateMachine.validate_transition(current, new)

    def test_illegal_transition_approved_to_draft(self):
        with self.assertRaises(ValidationError):
            KYCStateMachine.validate_transition("approved", "draft")

    def test_illegal_transition_draft_to_approved(self):
        with self.assertRaises(ValidationError):
            KYCStateMachine.validate_transition("draft", "approved")

    def test_illegal_transition_rejected_to_approved(self):
        with self.assertRaises(ValidationError):
            KYCStateMachine.validate_transition("rejected", "approved")

    def test_illegal_transition_submitted_to_approved(self):
        with self.assertRaises(ValidationError):
            KYCStateMachine.validate_transition("submitted", "approved")

    def test_illegal_transition_draft_to_under_review(self):
        with self.assertRaises(ValidationError):
            KYCStateMachine.validate_transition("draft", "under_review")

    def test_can_transition_returns_bool(self):
        self.assertTrue(KYCStateMachine.can_transition("draft", "submitted"))
        self.assertFalse(KYCStateMachine.can_transition("draft", "approved"))


class StateMachineAPITest(APITestCase):
    """Integration tests: illegal transitions return 400 via the API."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            username="testmerchant", password="pass1234", role="merchant"
        )
        self.reviewer = User.objects.create_user(
            username="testreviewer", password="pass1234", role="reviewer"
        )
        self.merchant_token = Token.objects.create(user=self.merchant)
        self.reviewer_token = Token.objects.create(user=self.reviewer)

        self.submission = KYCSubmission.objects.create(
            merchant=self.merchant,
            status="draft",
            full_name="Test User",
            email="test@test.com",
            business_name="Test Biz",
            business_type="individual",
        )

    def _reviewer_client(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.reviewer_token.key}")
        return client

    def _merchant_client(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.merchant_token.key}")
        return client

    def test_reviewer_cannot_approve_draft(self):
        """Attempting to approve a draft submission must return 400."""
        client = self._reviewer_client()
        response = client.post(
            f"/api/v1/reviewer/submissions/{self.submission.pk}/transition/",
            {"status": "approved"},
        )
        self.assertEqual(response.status_code, 400)

    def test_merchant_cannot_access_other_merchant(self):
        """Merchant A cannot see merchant B's submission."""
        other = User.objects.create_user(
            username="othermerchant", password="pass1234", role="merchant"
        )
        other_token = Token.objects.create(user=other)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {other_token.key}")

        response = client.get(f"/api/v1/merchant/submissions/{self.submission.pk}/")
        self.assertEqual(response.status_code, 404)

    def test_full_happy_path(self):
        """draft -> submitted -> under_review -> approved."""
        mc = self._merchant_client()
        rc = self._reviewer_client()

        # Submit
        resp = mc.post(f"/api/v1/merchant/submissions/{self.submission.pk}/submit/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "submitted")

        # Move to under_review
        resp = rc.post(
            f"/api/v1/reviewer/submissions/{self.submission.pk}/transition/",
            {"status": "under_review"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "under_review")

        # Approve
        resp = rc.post(
            f"/api/v1/reviewer/submissions/{self.submission.pk}/transition/",
            {"status": "approved", "reason": "All documents verified."},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "approved")

    def test_cannot_double_approve(self):
        """Already approved submission cannot be approved again."""
        self.submission.status = "approved"
        self.submission.save()

        rc = self._reviewer_client()
        resp = rc.post(
            f"/api/v1/reviewer/submissions/{self.submission.pk}/transition/",
            {"status": "approved"},
        )
        self.assertEqual(resp.status_code, 400)
