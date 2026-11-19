package com.pickle.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PublicSignupRequest(String name, @JsonProperty("login_id") String loginId, String password) {}
