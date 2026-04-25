from django.urls import path

from kyc import views

urlpatterns = [
    # Auth
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/me/", views.MeView.as_view(), name="me"),

    # Merchant endpoints
    path(
        "merchant/submissions/",
        views.MerchantSubmissionListCreate.as_view(),
        name="merchant-submissions",
    ),
    path(
        "merchant/submissions/<int:pk>/",
        views.MerchantSubmissionDetail.as_view(),
        name="merchant-submission-detail",
    ),
    path(
        "merchant/submissions/<int:pk>/submit/",
        views.MerchantSubmitView.as_view(),
        name="merchant-submit",
    ),
    path(
        "merchant/submissions/<int:pk>/documents/",
        views.MerchantDocumentUpload.as_view(),
        name="merchant-document-upload",
    ),
    path(
        "merchant/notifications/",
        views.MerchantNotifications.as_view(),
        name="merchant-notifications",
    ),

    # Reviewer endpoints
    path("reviewer/queue/", views.ReviewerQueueView.as_view(), name="reviewer-queue"),
    path(
        "reviewer/submissions/",
        views.ReviewerAllSubmissions.as_view(),
        name="reviewer-all-submissions",
    ),
    path(
        "reviewer/submissions/<int:pk>/",
        views.ReviewerSubmissionDetail.as_view(),
        name="reviewer-submission-detail",
    ),
    path(
        "reviewer/submissions/<int:pk>/transition/",
        views.ReviewerTransitionView.as_view(),
        name="reviewer-transition",
    ),
    path("reviewer/metrics/", views.ReviewerMetricsView.as_view(), name="reviewer-metrics"),
]
