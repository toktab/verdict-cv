package dev.toktab.brainhack.ats;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfficialAtsTemplateVersionRepository extends JpaRepository<OfficialAtsTemplateVersion, Long> {
    Optional<OfficialAtsTemplateVersion> findFirstByActiveTrueOrderByVersionNumberDesc();
    List<OfficialAtsTemplateVersion> findAllByOrderByVersionNumberDesc();
    Optional<OfficialAtsTemplateVersion> findFirstByOrderByVersionNumberDesc();
}
