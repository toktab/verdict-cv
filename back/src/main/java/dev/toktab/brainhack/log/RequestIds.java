package dev.toktab.brainhack.log;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.UUID;

public final class RequestIds {
    public static final String HEADER = "X-Request-Id";
    public static final String ATTRIBUTE = RequestIds.class.getName() + ".requestId";

    private RequestIds() {
    }

    public static String current(HttpServletRequest request) {
        return Optional.ofNullable(request.getAttribute(ATTRIBUTE))
                .map(Object::toString)
                .filter(value -> !value.isBlank())
                .orElseGet(() -> fromHeaderOrNew(request));
    }

    public static String fromHeaderOrNew(HttpServletRequest request) {
        String provided = request.getHeader(HEADER);
        if (provided != null && !provided.isBlank()) {
            return limit(provided.replaceAll("[^A-Za-z0-9._:-]", ""), 80);
        }
        return UUID.randomUUID().toString();
    }

    private static String limit(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
