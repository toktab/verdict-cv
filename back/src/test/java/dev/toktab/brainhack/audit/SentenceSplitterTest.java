package dev.toktab.brainhack.audit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SentenceSplitterTest {
    @Test
    void splitsBulletsAndLines() {
        SentenceSplitter splitter = new SentenceSplitter(10);

        assertThat(splitter.split("- Built API\n- Led a team\nSkills"))
                .containsExactly("Built API", "Led a team", "Skills");
    }

    @Test
    void splitsMultipleSentencesOnOneLine() {
        SentenceSplitter splitter = new SentenceSplitter(10);

        assertThat(splitter.split("Expert in systems. Led a team. Built APIs."))
                .containsExactly("Expert in systems.", "Led a team.", "Built APIs.");
    }
}
