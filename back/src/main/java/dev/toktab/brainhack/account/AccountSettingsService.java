package dev.toktab.brainhack.account;

import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class AccountSettingsService {
    public static final String REQUIRE_EMAIL_VERIFICATION = "require_email_verification";

    private final AppSettingRepository settingRepository;

    public AccountSettingsService(AppSettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    public boolean requireEmailVerification() {
        return settingRepository.findById(REQUIRE_EMAIL_VERIFICATION)
                .map(setting -> Boolean.parseBoolean(setting.getSettingValue()))
                .orElse(false);
    }

    @Transactional
    public boolean setRequireEmailVerification(boolean required) {
        AppSetting setting = settingRepository.findById(REQUIRE_EMAIL_VERIFICATION).orElseGet(AppSetting::new);
        setting.setSettingKey(REQUIRE_EMAIL_VERIFICATION);
        setting.setSettingValue(Boolean.toString(required));
        settingRepository.save(setting);
        return required;
    }
}
