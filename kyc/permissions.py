from rest_framework.permissions import BasePermission


class IsMerchant(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "merchant"


class IsReviewer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "reviewer"


class IsMerchantOwner(BasePermission):
    """Ensures a merchant can only access their own submissions."""

    def has_object_permission(self, request, view, obj):
        if request.user.role == "reviewer":
            return True
        return obj.merchant == request.user
