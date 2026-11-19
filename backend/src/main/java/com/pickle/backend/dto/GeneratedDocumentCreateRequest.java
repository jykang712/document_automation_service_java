package com.pickle.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

// ID, owner_user_id, is_sent, is_active 등은 요청으로 지정할 수 없습니다.
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeneratedDocumentCreateRequest(
        @JsonProperty("template_id") Long templateId,
        @JsonProperty("document_title") String documentTitle,
        @JsonProperty("extracted_json") Map<String, Object> extractedJson,
        @JsonProperty("html_content") String htmlContent,
        @JsonProperty("applied_rule_id") Long appliedRuleId) {
}
