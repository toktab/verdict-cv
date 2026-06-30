package dev.toktab.brainhack.messaging;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppMessageRepository extends JpaRepository<AppMessage, Long> {
    @Query("""
            select message from AppMessage message
            where lower(message.recipientEmail) = lower(:email)
               or message.sender.id = :senderId
            order by message.createdAt desc
            """)
    List<AppMessage> findMailbox(@Param("email") String email, @Param("senderId") Long senderId);
}
