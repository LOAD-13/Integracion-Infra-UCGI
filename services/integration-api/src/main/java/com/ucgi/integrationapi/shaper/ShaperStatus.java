package com.ucgi.integrationapi.shaper;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ShaperStatus(
        @JsonProperty("bandwidthMbps") int bandwidthMbps,
        @JsonProperty("qdiscActive") boolean qdiscActive,
        @JsonProperty("policy") String policy
) {
}
