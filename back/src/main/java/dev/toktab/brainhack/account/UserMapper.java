package dev.toktab.brainhack.account;

import dev.toktab.brainhack.api.dto.UserResponse;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {
    public UserResponse toResponse(UserAccount account) {
        return new UserResponse(
                account.getId(),
                account.getFullName(),
                account.getUsername(),
                account.getEmail(),
                account.getCountry(),
                account.getAddress(),
                account.getOrganization(),
                account.getRole(),
                account.isEmailVerified(),
                account.isMessageNotificationsEnabled(),
                account.getMessageNotificationsMutedUntil(),
                account.getCreatedAt(),
                account.getLastLoginAt()
        );
    }
}
