from datetime import timedelta

from django.db.models import Avg, Count, Q, F
from django.utils import timezone
from rest_framework import generics, status, views
from rest_framework.authtoken.models import Token
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from kyc.models import KYCSubmission, Document, Notification, User
from kyc.permissions import IsMerchant, IsReviewer, IsMerchantOwner
from kyc.serializers import (
    UserRegistrationSerializer,
    LoginSerializer,
    UserSerializer,
    KYCSubmissionListSerializer,
    KYCSubmissionCreateSerializer,
    KYCSubmissionUpdateSerializer,
    TransitionSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
    NotificationSerializer,
    ReviewerMetricsSerializer,
)


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "token": token.key,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "token": token.key,
            }
        )


class MeView(views.APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─── Merchant KYC Submissions ────────────────────────────────────────────────

class MerchantSubmissionListCreate(generics.ListCreateAPIView):
    permission_classes = [IsMerchant]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return KYCSubmissionCreateSerializer
        return KYCSubmissionListSerializer

    def get_queryset(self):
        return KYCSubmission.objects.filter(merchant=self.request.user)

    def perform_create(self, serializer):
        serializer.save(merchant=self.request.user)

    def get_serializer_context(self):
        return {"request": self.request}


class MerchantSubmissionDetail(generics.RetrieveUpdateAPIView):
    permission_classes = [IsMerchant, IsMerchantOwner]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return KYCSubmissionUpdateSerializer
        return KYCSubmissionListSerializer

    def get_queryset(self):
        return KYCSubmission.objects.filter(merchant=self.request.user)

    def get_serializer_context(self):
        return {"request": self.request}


class MerchantSubmitView(views.APIView):
    """Merchant submits their KYC (draft -> submitted)."""
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        try:
            submission = KYCSubmission.objects.get(pk=pk, merchant=request.user)
        except KYCSubmission.DoesNotExist:
            return Response(
                {"detail": "Submission not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        submission.transition_to("submitted")
        return Response(KYCSubmissionListSerializer(submission, context={"request": request}).data)


class MerchantDocumentUpload(views.APIView):
    """Upload a document to a submission (only in draft or more_info_requested)."""
    permission_classes = [IsMerchant]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            submission = KYCSubmission.objects.get(pk=pk, merchant=request.user)
        except KYCSubmission.DoesNotExist:
            return Response(
                {"detail": "Submission not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if submission.status not in ("draft", "more_info_requested"):
            return Response(
                {"detail": "Can only upload documents in 'draft' or 'more_info_requested' status."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        doc = Document.objects.create(
            submission=submission,
            doc_type=serializer.validated_data["doc_type"],
            file=serializer.validated_data["file"],
            original_filename=serializer.validated_data["file"].name,
        )
        return Response(
            DocumentSerializer(doc, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MerchantNotifications(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsMerchant]

    def get_queryset(self):
        return Notification.objects.filter(merchant=self.request.user)


# ─── Reviewer ────────────────────────────────────────────────────────────────

class ReviewerQueueView(generics.ListAPIView):
    """Review queue: submitted and under_review submissions, oldest first."""
    serializer_class = KYCSubmissionListSerializer
    permission_classes = [IsReviewer]

    def get_queryset(self):
        return (
            KYCSubmission.objects
            .filter(status__in=["submitted", "under_review"])
            .order_by("submitted_at")
        )

    def get_serializer_context(self):
        return {"request": self.request}


class ReviewerSubmissionDetail(generics.RetrieveAPIView):
    serializer_class = KYCSubmissionListSerializer
    permission_classes = [IsReviewer]
    queryset = KYCSubmission.objects.all()

    def get_serializer_context(self):
        return {"request": self.request}


class ReviewerTransitionView(views.APIView):
    """Reviewer changes the status of a submission."""
    permission_classes = [IsReviewer]

    def post(self, request, pk):
        try:
            submission = KYCSubmission.objects.get(pk=pk)
        except KYCSubmission.DoesNotExist:
            return Response(
                {"detail": "Submission not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        reason = serializer.validated_data.get("reason", "")

        submission.transition_to(new_status, reviewer=request.user, reason=reason)

        return Response(
            KYCSubmissionListSerializer(submission, context={"request": request}).data,
        )


class ReviewerMetricsView(views.APIView):
    """Dashboard metrics: queue size, avg time in queue, 7-day approval rate."""
    permission_classes = [IsReviewer]

    def get(self, request):
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        in_queue = KYCSubmission.objects.filter(
            status__in=["submitted", "under_review"]
        ).count()

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

        decided_7d = KYCSubmission.objects.filter(
            status__in=["approved", "rejected"],
            reviewed_at__gte=seven_days_ago,
        )
        total_decided = decided_7d.count()
        if total_decided > 0:
            approved_count = decided_7d.filter(status="approved").count()
            approval_rate = (approved_count / total_decided) * 100
        else:
            approval_rate = 0.0

        data = {
            "in_queue": in_queue,
            "avg_time_in_queue_hours": round(avg_hours, 1),
            "approval_rate_7d": round(approval_rate, 1),
        }
        return Response(ReviewerMetricsSerializer(data).data)


class ReviewerAllSubmissions(generics.ListAPIView):
    """All submissions for the reviewer to browse."""
    serializer_class = KYCSubmissionListSerializer
    permission_classes = [IsReviewer]

    def get_queryset(self):
        qs = KYCSubmission.objects.all().order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_context(self):
        return {"request": self.request}
