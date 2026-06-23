package com.ucgi.integrationapi.sipextension;

import jakarta.validation.constraints.Size;

public record SipExtensionUpdateRequest(
        @Size(min = 6, max = 64) String password,
        Boolean enabled
) {
}
