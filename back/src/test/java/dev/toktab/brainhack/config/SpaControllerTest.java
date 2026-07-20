package dev.toktab.brainhack.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SpaControllerTest {
    private final SpaController controller = new SpaController();

    @Test
    void forwardsApplicationRoutesToTheFrontend() {
        assertThat(controller.app()).isEqualTo("forward:/index.html");
    }
}
