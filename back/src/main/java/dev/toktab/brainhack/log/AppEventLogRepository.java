package dev.toktab.brainhack.log;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppEventLogRepository extends JpaRepository<AppEventLog, Long> {
    List<AppEventLog> findTop250ByDeletedAtIsNullOrderByCreatedAtDesc();
}
