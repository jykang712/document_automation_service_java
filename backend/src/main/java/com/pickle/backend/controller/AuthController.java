package com.pickle.backend.controller;

import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import com.pickle.backend.dto.AuthUserResponse;
import com.pickle.backend.dto.PublicSignupRequest;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.PublicSignupService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final PublicSignupService signup;
    public AuthController(PublicSignupService signup) { this.signup = signup; }

    @GetMapping("/csrf")
    public ResponseEntity<Map<String, String>> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of(
                "token", token.getToken(), "headerName", token.getHeaderName(),
                "parameterName", token.getParameterName()));
    }
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> signup(@RequestBody PublicSignupRequest request) {
        return Map.of("status", "ok", "user", signup.signup(request));
    }
    @GetMapping("/me")
    public AuthUserResponse me(@AuthenticationPrincipal ApplicationPrincipal principal) {
        return principal.toResponse();
    }
    // POST /login, /logout은 기존 Spring Security 필터가 처리합니다.
}
