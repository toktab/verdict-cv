package dev.toktab.brainhack.audit;

public enum AuditFailureType {
    NONE,
    MODEL_FAILURE,
    PARSER_FAILURE,
    QUOTA_FAILURE,
    TIMEOUT,
    UNSUPPORTED_FILE,
    PERMISSION_FAILURE,
    VALIDATION_FAILURE,
    UNKNOWN
}
