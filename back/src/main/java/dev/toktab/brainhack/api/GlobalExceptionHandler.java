package dev.toktab.brainhack.api;

import dev.toktab.brainhack.api.dto.ErrorResponse;
import dev.toktab.brainhack.log.RequestIds;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> badRequest(IllegalArgumentException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("BAD_REQUEST", exception.getMessage(), request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .orElse("Validation failed");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("VALIDATION_ERROR", message, request));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> uploadTooLarge(MaxUploadSizeExceededException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(error("UPLOAD_TOO_LARGE", "File is too large. Upload a document no larger than 8 MB.", request));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> server(Exception exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error("SERVER_ERROR", "Unexpected server error", request));
    }

    private ErrorResponse error(String code, String message, HttpServletRequest request) {
        return new ErrorResponse(code, message, RequestIds.current(request));
    }
}
