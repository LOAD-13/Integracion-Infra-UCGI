package com.ucgi.integrationapi.pjsip;

import com.samskivert.mustache.Mustache;
import com.samskivert.mustache.Template;
import com.ucgi.integrationapi.sipextension.SipExtension;
import com.ucgi.integrationapi.sipextension.SipExtensionRepository;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/**
 * Regenera el archivo {@code pjsip.conf} de Asterisk a partir de las
 * extensiones activas en {@code crm.sip_extensions}.
 *
 * <p>Idempotencia: dado el mismo set de extensiones, el output es
 * byte-a-byte idéntico. No incluye timestamp ni nada variable en el
 * tiempo. Esto permite que el flujo "consultar shaper → reescribir conf"
 * de HU-03.7 solo dispare un {@code pjsip reload} cuando el contenido
 * realmente cambia.
 */
@Component
public class PjsipConfigWriter {

    private static final Logger log = LoggerFactory.getLogger(PjsipConfigWriter.class);
    private static final String TEMPLATE_LOCATION = "classpath:templates/pjsip-dynamic.conf.mustache";

    private final SipExtensionRepository repository;
    private final Template template;

    public PjsipConfigWriter(SipExtensionRepository repository,
                             @Value(TEMPLATE_LOCATION) Resource templateResource) {
        this.repository = repository;
        this.template = compile(templateResource);
    }

    /** Constructor para tests: permite inyectar un {@link Template} ya compilado. */
    PjsipConfigWriter(SipExtensionRepository repository, Template template) {
        this.repository = repository;
        this.template = template;
    }

    public String render() {
        List<SipExtension> extensions = repository.findAllByEnabledTrueOrderByExtensionNumberAsc();
        return renderFrom(extensions);
    }

    public String renderFrom(List<SipExtension> extensions) {
        List<Map<String, Object>> rows = extensions.stream()
                .map(PjsipConfigWriter::asRow)
                .toList();
        Map<String, Object> ctx = new HashMap<>();
        ctx.put("extensionCount", rows.size());
        ctx.put("extensions", rows);
        return template.execute(ctx);
    }

    public Path writeTo(Path target) {
        String content = render();
        try {
            Files.writeString(target, content, StandardCharsets.UTF_8);
            log.info("pjsip.conf regenerado en {} ({} bytes)", target, content.length());
            return target;
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo escribir " + target, e);
        }
    }

    private static Map<String, Object> asRow(SipExtension entity) {
        Map<String, Object> row = new HashMap<>();
        row.put("number", entity.getExtensionNumber());
        row.put("password", entity.getSipPassword());
        return row;
    }

    private static Template compile(Resource resource) {
        try (InputStream in = resource.getInputStream();
             InputStreamReader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
            return Mustache.compiler().escapeHTML(false).compile(reader);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo cargar la plantilla " + TEMPLATE_LOCATION, e);
        }
    }
}
