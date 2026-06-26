package dev.toktab.brainhack.account;

import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    Optional<UserAccount> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    List<UserAccount> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
            select user from UserAccount user
            where user.deletedAt is null
              and (
                lower(user.fullName) like lower(concat('%', :search, '%'))
                or lower(user.username) like lower(concat('%', :search, '%'))
                or lower(user.email) like lower(concat('%', :search, '%'))
                or lower(user.country) like lower(concat('%', :search, '%'))
                or lower(user.organization) like lower(concat('%', :search, '%'))
                or lower(user.role) like lower(concat('%', :search, '%'))
              )
            order by user.createdAt desc
            """)
    List<UserAccount> search(@Param("search") String search, Pageable pageable);
}
