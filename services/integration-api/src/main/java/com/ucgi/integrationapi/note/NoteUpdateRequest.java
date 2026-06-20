package com.ucgi.integrationapi.note;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NoteUpdateRequest(
        @NotNull @Size(max = 65535) String body
) {
}
