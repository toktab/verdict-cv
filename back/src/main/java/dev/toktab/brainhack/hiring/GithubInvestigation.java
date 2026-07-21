package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.hiring.HiringDtos.GithubProfileResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintSourceResponse;
import java.util.List;

public record GithubInvestigation(
        GithubProfileResponse profile,
        List<OsintSourceResponse> sources
) {
}
