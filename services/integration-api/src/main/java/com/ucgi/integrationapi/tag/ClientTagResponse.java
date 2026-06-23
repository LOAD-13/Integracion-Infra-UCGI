package com.ucgi.integrationapi.tag;

public record ClientTagResponse(
        Long id,
        String name,
        String colorBg,
        String colorText,
        boolean system
) {
    public static ClientTagResponse from(ClientTag t) {
        return new ClientTagResponse(t.getId(), t.getName(),
                t.getColorBg(), t.getColorText(), t.isSystem());
    }
}
