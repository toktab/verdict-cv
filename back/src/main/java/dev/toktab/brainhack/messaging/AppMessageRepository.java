package dev.toktab.brainhack.messaging;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Query(value = """
            select message from AppMessage message
            where (lower(message.recipientEmail) = lower(:email) or message.sender.id = :senderId)
              and (:search = ''
                or lower(message.subject) like concat('%', :search, '%')
                or lower(message.senderName) like concat('%', :search, '%')
                or lower(message.senderEmail) like concat('%', :search, '%')
                or lower(message.recipientEmail) like concat('%', :search, '%'))
            """, countQuery = """
            select count(message.id) from AppMessage message
            where (lower(message.recipientEmail) = lower(:email) or message.sender.id = :senderId)
              and (:search = ''
                or lower(message.subject) like concat('%', :search, '%')
                or lower(message.senderName) like concat('%', :search, '%')
                or lower(message.senderEmail) like concat('%', :search, '%')
                or lower(message.recipientEmail) like concat('%', :search, '%'))
            """)
    Page<AppMessage> findMailboxPage(@Param("email") String email, @Param("senderId") Long senderId,
                                     @Param("search") String search, Pageable pageable);

    Optional<AppMessage> findFirstByInviteToken(String inviteToken);
}
