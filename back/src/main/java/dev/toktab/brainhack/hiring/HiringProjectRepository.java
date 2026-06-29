package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HiringProjectRepository extends JpaRepository<HiringProject, Long> {
    List<HiringProject> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId);
    Optional<HiringProject> findByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);
    boolean existsByOwnerIdAndTitleIgnoreCaseAndDeletedAtIsNull(Long ownerId, String title);
}
