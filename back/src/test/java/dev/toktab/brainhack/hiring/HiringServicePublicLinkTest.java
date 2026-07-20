package dev.toktab.brainhack.hiring;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HiringServicePublicLinkTest {

    @Test
    void discoversAndNormalizesBarePublicProfileLinksFromCvText() {
        List<String> links = HiringService.discoverPublicLinks("""
                Tbilisi | github.com/toktab | linkedin.com/in/toktab
                Portfolio: https://example.com/work.
                """);

        assertThat(links).containsExactly(
                "https://github.com/toktab",
                "https://linkedin.com/in/toktab",
                "https://example.com/work"
        );
    }

    @Test
    void doesNotTreatEmailDomainsAsPublicProfileLinks() {
        List<String> links = HiringService.discoverPublicLinks(
                "Contact toktabbusiness@gmail.com without a portfolio URL.");

        assertThat(links).isEmpty();
    }
}
