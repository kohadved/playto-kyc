from rest_framework.exceptions import ValidationError

ALLOWED_FILE_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_document_file(file):
    """
    Validates uploaded document files server-side.
    - Checks file extension against whitelist
    - Checks MIME content type against whitelist
    - Enforces 5 MB size limit
    """
    import os

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
