package dev.toktab.brainhack.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Size(min = 3, max = 80) String username,
        @NotBlank @Email @Size(max = 160) String email,
        @NotBlank @Size(max = 120) String country,
        @NotBlank @Size(max = 220) String address,
        @Size(max = 80) String organization,
        @Size(max = 80) String role,
        @NotBlank @Size(min = 8, max = 120) String password
) {
}
