package com.pickle.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GeneratedDocumentUpdateRequest(
        @JsonProperty("document_title") String documentTitle,
        @JsonProperty("extracted_json") Map<String, Object> extractedJson,
        @JsonProperty("html_content") String htmlContent) {
}
