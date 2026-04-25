from rest_framework import serializers
from django.contrib.auth import authenticate

from kyc.models import User, KYCSubmission, Document, Notification
from kyc.validators import validate_document_file


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "role", "phone"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            role=validated_data.get("role", "merchant"),
            phone=validated_data.get("phone", ""),
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        user = authenticate(username=data["username"], password=data["password"])
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        data["user"] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "phone"]


class DocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ["id", "doc_type", "file", "file_url", "original_filename", "uploaded_at"]
        read_only_fields = ["id", "original_filename", "uploaded_at", "file_url"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def validate_file(self, value):
        validate_document_file(value)
        return value


class DocumentUploadSerializer(serializers.Serializer):
    doc_type = serializers.ChoiceField(choices=Document.DOC_TYPE_CHOICES)
    file = serializers.FileField()

    def validate_file(self, value):
        validate_document_file(value)
        return value


class KYCSubmissionListSerializer(serializers.ModelSerializer):
    merchant_username = serializers.CharField(source="merchant.username", read_only=True)
    is_at_risk = serializers.BooleanField(read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)

    class Meta:
        model = KYCSubmission
        fields = [
            "id", "merchant", "merchant_username", "status",
            "full_name", "email", "phone",
            "business_name", "business_type", "expected_monthly_volume_usd",
            "review_reason", "is_at_risk",
            "documents",
            "created_at", "updated_at", "submitted_at", "reviewed_at",
        ]
        read_only_fields = [
            "id", "merchant", "status", "review_reason",
            "created_at", "updated_at", "submitted_at", "reviewed_at",
        ]


class KYCSubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCSubmission
        fields = [
            "id", "full_name", "email", "phone",
            "business_name", "business_type", "expected_monthly_volume_usd",
        ]
        read_only_fields = ["id"]


class KYCSubmissionUpdateSerializer(serializers.ModelSerializer):
    """For saving draft progress — only editable in draft/more_info_requested states."""

    class Meta:
        model = KYCSubmission
        fields = [
            "full_name", "email", "phone",
            "business_name", "business_type", "expected_monthly_volume_usd",
        ]

    def validate(self, data):
        if self.instance and self.instance.status not in ("draft", "more_info_requested"):
            raise serializers.ValidationError(
                "Can only edit submissions in 'draft' or 'more_info_requested' status."
            )
        return data


class TransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[s[0] for s in KYCSubmission.STATE_CHOICES]
    )
    reason = serializers.CharField(required=False, default="", allow_blank=True)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "merchant", "submission", "event_type", "payload", "created_at"]


class ReviewerMetricsSerializer(serializers.Serializer):
    in_queue = serializers.IntegerField()
    avg_time_in_queue_hours = serializers.FloatField()
    approval_rate_7d = serializers.FloatField()
