from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from kyc.models import User, KYCSubmission, Document, Notification


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "role", "is_staff"]
    list_filter = ["role"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Role", {"fields": ("role", "phone")}),
    )


@admin.register(KYCSubmission)
class KYCSubmissionAdmin(admin.ModelAdmin):
    list_display = ["id", "merchant", "status", "business_name", "submitted_at", "reviewed_at"]
    list_filter = ["status"]
    readonly_fields = ["created_at", "updated_at", "submitted_at", "reviewed_at"]


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["id", "submission", "doc_type", "original_filename", "uploaded_at"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["id", "merchant", "event_type", "created_at"]
    list_filter = ["event_type"]
