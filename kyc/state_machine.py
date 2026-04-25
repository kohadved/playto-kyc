from rest_framework.exceptions import ValidationError


class KYCStateMachine:
    """
    Single source of truth for all legal KYC status transitions.

    Legal transitions:
        draft -> submitted
        submitted -> under_review
        under_review -> approved | rejected | more_info_requested
        more_info_requested -> submitted
    """

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

    @classmethod
    def can_transition(cls, current_status, new_status):
        return new_status in cls.TRANSITIONS.get(current_status, [])
