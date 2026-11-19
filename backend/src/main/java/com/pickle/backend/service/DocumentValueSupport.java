package com.pickle.backend.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

// 문서에 저장된 key 표식만 사용합니다. 변경된 현재 양식을 과거 문서에 재적용하지 않습니다.
final class DocumentValueSupport {
    private static final Pattern KEY = Pattern.compile("[a-z][a-z0-9_]{0,79}");
    record Content(String html, String json) {}

    static Content synchronize(String html, Map<String, Object> input, ObjectMapper json) {
        var values = new LinkedHashMap<String, Object>();
        if (input != null) {
            if (input.size() > 1000) throw bad("입력 항목은 최대 1000개입니다.");
            input.forEach((key, value) -> {
                if (key == null || !KEY.matcher(key).matches()) throw bad("placeholder key 형식을 확인하세요.");
                if (value != null && !(value instanceof String || value instanceof Number || value instanceof Boolean)) {
                    throw bad("extracted_json 값은 문자열, 숫자 또는 참/거짓이어야 합니다.");
                }
                String text = value == null ? "" : String.valueOf(value);
                if (text.length() > 100_000) throw bad("입력 항목 값이 너무 깁니다.");
                values.put(key, text);
            });
        }
        var doc = Jsoup.parse(html == null ? "" : html);
        doc.outputSettings().prettyPrint(false);
        // key가 명시되어 있고 값이 모두 같은 경우에만 예전 문서에서 복구합니다.
        var recovered = new LinkedHashMap<String, String>();
        var ambiguous = new java.util.HashSet<String>();
        for (var node : doc.select("span.ph[data-field-key]")) {
            String key = node.attr("data-field-key");
            if (!KEY.matcher(key).matches()) throw bad("문서의 placeholder key가 올바르지 않습니다.");
            String value = node.wholeText();
            if ("date".equals(node.attr("data-field-type"))) {
                var match = Pattern.compile("(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일").matcher(value);
                if (match.matches()) value = "%s-%02d-%02d".formatted(match.group(1), Integer.parseInt(match.group(2)), Integer.parseInt(match.group(3)));
            }
            if (recovered.containsKey(key) && !recovered.get(key).equals(value)) ambiguous.add(key);
            recovered.putIfAbsent(key, value);
        }
        for (var entry : recovered.entrySet()) {
            if (!values.containsKey(entry.getKey())) {
                if (ambiguous.contains(entry.getKey())) throw bad("동일한 key의 값이 다릅니다. 입력값을 확인하세요: " + entry.getKey());
                values.put(entry.getKey(), entry.getValue());
            }
        }
        for (var node : doc.select("span.ph[data-field-key]")) {
            String value = (String) values.get(node.attr("data-field-key"));
            if ("date".equals(node.attr("data-field-type"))) {
                var match = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})").matcher(value);
                if (match.matches()) value = "%s년 %d월 %d일".formatted(match.group(1), Integer.parseInt(match.group(2)), Integer.parseInt(match.group(3)));
            }
            node.text(value).attr("style", "white-space:pre-wrap");
        }
        String rendered = doc.head().html() + doc.body().html();
        String encoded = json.writeValueAsString(values);
        if (rendered.length() > 1_000_000 || encoded.length() > 1_000_000) throw bad("문서 내용이 최대 길이를 초과했습니다.");
        return new Content(rendered, encoded);
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
