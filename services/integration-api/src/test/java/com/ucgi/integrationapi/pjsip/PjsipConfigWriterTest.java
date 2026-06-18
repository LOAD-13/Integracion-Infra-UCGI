package com.ucgi.integrationapi.pjsip;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.samskivert.mustache.Mustache;
import com.samskivert.mustache.Template;
import com.ucgi.integrationapi.sipextension.SipExtension;
import com.ucgi.integrationapi.sipextension.SipExtensionRepository;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;

class PjsipConfigWriterTest {

    private final SipExtensionRepository repository = mock(SipExtensionRepository.class);
    private final PjsipConfigWriter writer = new PjsipConfigWriter(repository, loadTemplate());

    @Test
    void rendersOnlyHeader_whenNoExtensions() {
        String out = writer.renderFrom(List.of());

        assertThat(out)
                .contains("[global]")
                .contains("[transport-udp]")
                .contains("[transport-ws]")
                .contains("Total extensiones activas: 0")
                .doesNotContain("type=endpoint")
                .doesNotContain("type=auth")
                .doesNotContain("type=aor");
    }

    @Test
    void rendersExtensionsInAscendingOrder() {
        // El repo es quien ordena (ORDER BY en la query); el writer respeta el orden recibido.
        List<SipExtension> sorted = List.of(
                extension("1001", "passwd-1001"),
                extension("1002", "passwd-1002"),
                extension("2000", "admin-pwd"));

        String out = writer.renderFrom(sorted);

        int idx1001 = out.indexOf("[1001]");
        int idx1002 = out.indexOf("[1002]");
        int idx2000 = out.indexOf("[2000]");
        assertThat(idx1001).isPositive();
        assertThat(idx1001).isLessThan(idx1002);
        assertThat(idx1002).isLessThan(idx2000);
    }

    @Test
    void rendersThreeSectionsPerExtension_endpointAuthAor() {
        String out = writer.renderFrom(List.of(extension("1001", "x")));

        assertThat(countOccurrences(out, "[1001]")).isEqualTo(3);
        assertThat(out).contains("type=endpoint")
                       .contains("type=auth")
                       .contains("type=aor")
                       .contains("password=x");
    }

    @Test
    void renderIsIdempotent_sameInputSameOutput() {
        List<SipExtension> extensions = List.of(
                extension("1001", "passwd-1001"),
                extension("1002", "passwd-1002"),
                extension("2000", "admin-pwd"));

        String first = writer.renderFrom(extensions);
        String second = writer.renderFrom(extensions);

        assertThat(first).isEqualTo(second);
    }

    @Test
    void matchesSnapshot_threeExtensions() throws IOException {
        List<SipExtension> extensions = List.of(
                extension("1001", "passwd-1001"),
                extension("1002", "passwd-1002"),
                extension("2000", "admin-pwd"));

        String actual = writer.renderFrom(extensions);
        String expected = readClasspath("pjsip/expected.conf");

        assertThat(normalize(actual)).isEqualTo(normalize(expected));
    }

    @Test
    void writeTo_writesFileWithRenderedContent(@TempDir Path tmp) {
        org.mockito.Mockito.when(repository.findAllByEnabledTrueOrderByExtensionNumberAsc())
                .thenReturn(List.of(extension("1001", "passwd-1001")));
        Path target = tmp.resolve("pjsip.conf");

        writer.writeTo(target);

        assertThat(target).exists().isRegularFile();
    }

    // ---------- helpers ----------

    private static SipExtension extension(String number, String password) {
        return new SipExtension(0L, number, password);
    }

    private static Template loadTemplate() {
        try (InputStream in = new ClassPathResource("templates/pjsip.conf.mustache").getInputStream()) {
            return Mustache.compiler()
                    .escapeHTML(false)
                    .compile(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new RuntimeException("No se pudo cargar plantilla en test", e);
        }
    }

    private static int countOccurrences(String haystack, String needle) {
        int count = 0;
        int idx = 0;
        while ((idx = haystack.indexOf(needle, idx)) != -1) {
            count++;
            idx += needle.length();
        }
        return count;
    }

    private static String normalize(String s) {
        return s.replace("\r\n", "\n").stripTrailing();
    }

    private static String readClasspath(String path) throws IOException {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
