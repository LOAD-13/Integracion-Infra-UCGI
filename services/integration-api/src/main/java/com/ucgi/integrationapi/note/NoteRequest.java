package com.ucgi.integrationapi.note;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NoteRequest(
        @NotNull Long clientId,
        Long cdrId,
        @NotNull @Size(max = 65535) String body
) {
}
