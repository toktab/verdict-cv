package dev.toktab.brainhack.log;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

public interface AppEventLogRepository extends JpaRepository<AppEventLog, Long> {
    List<AppEventLog> findTop250ByDeletedAtIsNullOrderByCreatedAtDesc();

    List<AppEventLog> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);
}
