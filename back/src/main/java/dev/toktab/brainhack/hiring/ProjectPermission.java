package dev.toktab.brainhack.hiring;

public enum ProjectPermission {
    CAN_VIEW("canView"),
    CAN_VOTE("canVote"),
    CAN_ADD_NOTE("canAddNote"),
    CAN_MARK_ON_CHECK("canMarkOnCheck"),
    CAN_SET_INTERVIEW("canSetInterview"),
    CAN_HIRE("canHire"),
    CAN_CLOSE("canClose"),
    CAN_INVITE("canInvite"),
    CAN_TEAM_MANAGE("canTeamManage"),
    CAN_KICK_MEMBERS("canKickMembers"),
    CAN_PROMOTE_MEMBERS("canPromoteMembers"),
    CAN_DEMOTE_MEMBERS("canDemoteMembers"),
    CAN_CHANGE_PERMISSIONS("canChangePermissions"),
    CAN_MESSAGE("canMessage"),
    CAN_VIEW_ACTIVITY_LOG("canViewActivityLog"),
    PROTECTED_ACCOUNT("protectedAccount");

    private final String legacyName;

    ProjectPermission(String legacyName) {
        this.legacyName = legacyName;
    }

    public String legacyName() {
        return legacyName;
    }

    public static ProjectPermission fromLegacy(String legacyName) {
        if (legacyName == null || legacyName.isBlank()) return CAN_VIEW;
        for (ProjectPermission p : values()) {
            if (p.legacyName.equals(legacyName)) return p;
        }
        return CAN_VIEW;
    }

    public static java.util.List<String> defaultPermissionsForRole(ProjectRole role) {
        java.util.List<String> perms = new java.util.ArrayList<>();
        perms.add(CAN_VIEW.legacyName);

        switch (role) {
            case VIEWER -> {}
            case VOTER -> perms.add(CAN_VOTE.legacyName);
            case REVIEWER -> {
                perms.add(CAN_VOTE.legacyName);
                perms.add(CAN_ADD_NOTE.legacyName);
            }
            case SCREENER -> {
                perms.add(CAN_VOTE.legacyName);
                perms.add(CAN_ADD_NOTE.legacyName);
                perms.add(CAN_MARK_ON_CHECK.legacyName);
            }
            case COORDINATOR, ADMIN, ORGANIZATION_ADMIN -> {
                perms.add(CAN_VOTE.legacyName);
                perms.add(CAN_ADD_NOTE.legacyName);
                perms.add(CAN_MARK_ON_CHECK.legacyName);
                perms.add(CAN_SET_INTERVIEW.legacyName);
                perms.add(CAN_HIRE.legacyName);
                perms.add(CAN_CLOSE.legacyName);
                perms.add(CAN_INVITE.legacyName);
                perms.add(CAN_TEAM_MANAGE.legacyName);
                perms.add(CAN_KICK_MEMBERS.legacyName);
                perms.add(CAN_PROMOTE_MEMBERS.legacyName);
                perms.add(CAN_DEMOTE_MEMBERS.legacyName);
                perms.add(CAN_CHANGE_PERMISSIONS.legacyName);
                perms.add(CAN_MESSAGE.legacyName);
                perms.add(CAN_VIEW_ACTIVITY_LOG.legacyName);
                if (role == ORGANIZATION_ADMIN) {
                    perms.add(PROTECTED_ACCOUNT.legacyName);
                }
            }
            case CUSTOM -> {} // Custom roles define their own permissions
        }
        return perms.stream().distinct().toList();
    }
}
