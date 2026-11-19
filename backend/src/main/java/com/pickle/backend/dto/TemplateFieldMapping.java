package com.pickle.backend.dto;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TemplateFieldMapping(
        String key, String label, String type, Boolean required, String description,
        @JsonProperty("cell_id") String cellId,
        @JsonProperty("cell_ids") List<String> cellIds,
        List<Locator> locators,
        @JsonProperty("cell_template") String cellTemplate) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Locator(@JsonProperty("cell_id") String cellId) {}
}
