package com.pickle.backend.service;

import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

final class ManagementSupport {
    private ManagementSupport() {}
    static void admin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getAuthorities().stream()
                .noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
            throw error(HttpStatus.FORBIDDEN, "ADMIN만 관리 기능을 사용할 수 있습니다.");
        }
    }
    static String required(String value, String field, int max) {
        String text = optional(value, field, max);
        if (text == null) throw error(HttpStatus.BAD_REQUEST, field + "은 필수입니다.");
        return text;
    }
    static String optional(String value, String field, int max) {
        String text = value == null ? "" : value.strip();
        if (text.codePointCount(0, text.length()) > max) {
            throw error(HttpStatus.BAD_REQUEST, field + "은 " + max + "자 이하여야 합니다.");
        }
        return text.isEmpty() ? null : text;
    }
    static String loginId(String value) {
        String text = required(value, "로그인 아이디", 50).toLowerCase(Locale.ROOT);
        if (!text.matches("[a-z0-9][a-z0-9._-]{2,49}")) {
            throw error(HttpStatus.BAD_REQUEST, "아이디는 영문·숫자로 시작하는 3~50자의 영문·숫자·점·밑줄·하이픈이어야 합니다.");
        }
        return text;
    }
    static String email(String value) {
        String text = required(value, "이메일", 255).toLowerCase(Locale.ROOT);
        if (!text.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            throw error(HttpStatus.BAD_REQUEST, "이메일 형식을 확인하세요.");
        }
        return text;
    }
    static Long nullableId(Map<String, Object> body, String key) {
        if (body == null || !body.containsKey(key)) {
            throw error(HttpStatus.BAD_REQUEST, key + "는 필수입니다. 연결 해제는 null을 보내세요.");
        }
        Object value = body.get(key);
        if (value == null) return null;
        if (!(value instanceof Integer || value instanceof Long) || ((Number) value).longValue() <= 0) {
            throw error(HttpStatus.BAD_REQUEST, key + "는 양의 정수 또는 null이어야 합니다.");
        }
        return ((Number) value).longValue();
    }
    static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
