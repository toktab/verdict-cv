package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.HiringDtos.InviteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.InviteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.MemberRoleRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectMemberResponse;
import dev.toktab.brainhack.hiring.ProjectInviteService;
import dev.toktab.brainhack.hiring.ProjectMemberService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}")
public class ProjectTeamController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final ProjectMemberService memberService;
    private final ProjectInviteService inviteService;

    public ProjectTeamController(UserSessionService sessionService, AuthTokenResolver tokenResolver,
                                 ProjectMemberService memberService, ProjectInviteService inviteService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.memberService = memberService;
        this.inviteService = inviteService;
    }

    @GetMapping("/members")
    public List<ProjectMemberResponse> members(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return memberService.members(owner(authorization, legacyToken), projectId);
    }

    @PatchMapping("/members/role")
    public List<ProjectMemberResponse> updateMemberRole(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @Valid @RequestBody MemberRoleRequest request) {
        return memberService.updateRole(owner(authorization, legacyToken), projectId, request);
    }

    @DeleteMapping("/members")
    public List<ProjectMemberResponse> removeMember(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @RequestParam String email) {
        return memberService.removeMember(owner(authorization, legacyToken), projectId, email);
    }

    @GetMapping("/invites")
    public List<InviteResponse> invites(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return inviteService.invites(owner(authorization, legacyToken), projectId);
    }

    @PostMapping("/invites")
    public InviteResponse invite(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @Valid @RequestBody InviteRequest request) {
        return inviteService.invite(owner(authorization, legacyToken), projectId, request);
    }

    // acceptInvite moved to InviteController at /api/projects/invites/accept

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
