package dev.toktab.brainhack.log;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppEventLogRepository extends JpaRepository<AppEventLog, Long> {
    List<AppEventLog> findTop250ByDeletedAtIsNullOrderByCreatedAtDesc();

    List<AppEventLog> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
            select log from AppEventLog log
            where log.deletedAt is null
              and (
                lower(log.eventType) like lower(concat('%', :search, '%'))
                or lower(log.method) like lower(concat('%', :search, '%'))
                or lower(log.path) like lower(concat('%', :search, '%'))
                or lower(log.actor) like lower(concat('%', :search, '%'))
                or lower(log.ipAddress) like lower(concat('%', :search, '%'))
                or lower(log.requestId) like lower(concat('%', :search, '%'))
                or lower(log.detail) like lower(concat('%', :search, '%'))
              )
            order by log.createdAt desc
            """)
    List<AppEventLog> search(@Param("search") String search, Pageable pageable);
}
