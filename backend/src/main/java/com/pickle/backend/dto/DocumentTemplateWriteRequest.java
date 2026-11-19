package com.pickle.backend.dto;

import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DocumentTemplateWriteRequest(
        @JsonProperty("template_name") String templateName,
        @JsonProperty("html_content") String htmlContent,
        @JsonProperty("file_name") String fileName,
        @JsonProperty("template_schema") Map<String, Object> templateSchema,
        @JsonProperty("placeholder_keys") List<String> placeholderKeys,
        @JsonProperty("template_fields") List<Map<String, Object>> templateFields,
        @JsonProperty("remap_fields") Boolean remapFields,
        @JsonProperty("expected_updated_at") String expectedUpdatedAt) {
}
